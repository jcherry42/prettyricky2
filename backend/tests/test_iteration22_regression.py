"""
Iteration 22 — Regression suite after major backend cleanup:
- 7 backward-compat shim modules deleted from /app/backend root (ai_gateway, audio_pipeline,
  conversation_history, sales_knowledge_base, telemetry_service, vector_search,
  vision_extraction_service) — all importers rewired to services.*
- models.py shadow deleted, security/rbac.py and security/validation.py deleted
- Ruff auto-fixes applied
- Bug fix: GET /api/customers/stats get_status_counts signature mismatch

Focus: prove zero breakage in every endpoint group touched by the rewiring.
Uses a SINGLE login (brute-force lockout risk) and spaces out LLM calls (rate limits).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://apex-service-advisor.preview.emergentagent.com").rstrip("/")
PIN = "11111"


# ---------- shared session (single login for entire module) ----------
@pytest.fixture(scope="module")
def tokens():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "refresh_token" in data
    return data


@pytest.fixture(scope="module")
def client(tokens):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {tokens['access_token']}",
        "Content-Type": "application/json",
    })
    return s


# ---------- Health / Ready ----------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "healthy"

    def test_ready(self):
        r = requests.get(f"{BASE_URL}/api/ready", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert body.get("ready") is True


# ---------- Auth: refresh rotation + logout ----------
class TestAuth:
    def test_refresh_rotation_and_logout(self):
        # separate login so we don't invalidate the module-scope tokens
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert r.status_code == 200
        t = r.json()
        old_refresh = t["refresh_token"]

        # rotate
        r2 = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": old_refresh}, timeout=15)
        assert r2.status_code == 200, r2.text
        new = r2.json()
        assert "access_token" in new and "refresh_token" in new
        assert new["refresh_token"] != old_refresh, "refresh token must rotate"

        # old refresh should now be revoked
        r3 = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": old_refresh}, timeout=15)
        assert r3.status_code == 401, f"old refresh should be revoked, got {r3.status_code}"

        # logout with the new refresh
        r4 = requests.post(f"{BASE_URL}/api/auth/logout", json={"refresh_token": new["refresh_token"]}, timeout=15)
        assert r4.status_code == 200


# ---------- Customers CRUD + stats (bug fix) ----------
class TestCustomers:
    _cid = None

    def test_list(self, client):
        r = client.get(f"{BASE_URL}/api/customers/list", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "customers" in body or isinstance(body, list)

    def test_create(self, client):
        payload = {
            "first_name": "TEST_iter22",
            "last_name": "Regression",
            "phone": "+15555550022",
            "email": "test_iter22@example.com",
            "lead_status": "new",
        }
        r = client.post(f"{BASE_URL}/api/customers/create", json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        cid = data.get("id") or data.get("_id") or (data.get("customer") or {}).get("id")
        assert cid, f"no id returned: {data}"
        TestCustomers._cid = cid

    def test_get_one(self, client):
        assert TestCustomers._cid
        r = client.get(f"{BASE_URL}/api/customers/{TestCustomers._cid}", timeout=15)
        assert r.status_code == 200
        assert (r.json().get("customer") or r.json()).get("first_name", "").startswith("TEST_iter22")

    def test_patch(self, client):
        assert TestCustomers._cid
        r = client.patch(
            f"{BASE_URL}/api/customers/{TestCustomers._cid}",
            json={"lead_status": "contacted"},
            timeout=15,
        )
        assert r.status_code in (200, 204), r.text

    def test_stats_bugfix(self, client):
        # Was 500 before fix — must now return {total, byStatus}
        r = client.get(f"{BASE_URL}/api/customers/stats", timeout=15)
        assert r.status_code == 200, f"stats regression: {r.status_code} {r.text}"
        body = r.json()
        assert "total" in body
        assert "byStatus" in body or "by_status" in body

    def test_delete(self, client):
        assert TestCustomers._cid
        r = client.delete(f"{BASE_URL}/api/customers/{TestCustomers._cid}", timeout=15)
        assert r.status_code in (200, 204)


# ---------- AI features via rewired services.ai_gateway ----------
class TestAI:
    def test_translate_en_to_es(self, client):
        r = client.post(
            f"{BASE_URL}/api/translate",
            json={"text": "Hello, how are you?", "target_lang": "es"},
            timeout=45,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("translated_text") or body.get("translation") or body.get("text")

    def test_tower_talk_sales(self, client):
        time.sleep(1)
        r = client.post(
            f"{BASE_URL}/api/tower-talk",
            json={
                "situation": "The price is too high for this SUV.",
                "inquiryType": "price_objection",
                "context": {"vehicle": "2024 Honda CR-V", "askingPrice": 34500},
                "mode": "sales",
            },
            timeout=60,
        )
        assert r.status_code == 200, r.text
        assert r.json()

    def test_tts(self, client):
        r = client.post(
            f"{BASE_URL}/api/tts",
            json={"text": "Welcome to Supercharged.", "voice": "alloy"},
            timeout=45,
        )
        # TTS may return audio bytes / base64 / streaming
        assert r.status_code in (200, 201), r.text

    def test_ai_stats(self, client):
        r = client.get(f"{BASE_URL}/api/ai/stats", timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "model_routes" in body
        assert "cache" in body
        assert "circuit_breakers" in body


# ---------- Intelligence pipeline (uses services.ai_gateway after rewire) ----------
class TestIntelligence:
    def test_analyze_sales_mode(self, client):
        time.sleep(1)
        r = client.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json={
                "input": {
                    "mode": "sales",
                    "channel": "chat",
                    "customerMessage": "I'm looking for a family SUV around $35k, but I've seen better prices online.",
                }
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # camelCase keys per prior iterations
        assert "primaryIntent" in body or "primary_intent" in body
        assert "responses" in body or "recommendedStrategy" in body or "recommended_strategy" in body

    def test_analyze_service_mode(self, client):
        time.sleep(2)
        r = client.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json={
                "input": {
                    "mode": "service",
                    "channel": "in_person",
                    "customerMessage": "The car makes a grinding noise from the front-left wheel when braking below 20mph.",
                    "repairStage": "diagnosis",
                    "verifiedFactGates": {"brakePadWear": "unknown"},
                }
            },
            timeout=90,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        # service-mode specific keys
        has_service = any(
            k in body for k in ("serviceFramework", "service_framework", "serviceResponses", "unverifiedTopics")
        )
        assert has_service, f"service-mode fields missing: {list(body.keys())}"


# ---------- Knowledge base (uses services.sales_knowledge_base) ----------
class TestKnowledge:
    def test_search(self, client):
        r = client.post(f"{BASE_URL}/api/knowledge/search", json={"query": "price objection", "top_k": 5}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        # entries/results/items — accept any list-shaped payload
        items = body.get("entries") or body.get("results") or body.get("items") or body
        assert items, f"empty knowledge search: {body}"


# ---------- VIN ----------
class TestVIN:
    def test_decode(self, client):
        r = client.get(
            f"{BASE_URL}/api/vin/decode/1HGCM82633A004352",
            timeout=30,
        )
        assert r.status_code == 200, r.text

    def test_inventory(self, client):
        r = client.get(f"{BASE_URL}/api/vehicles/inventory", timeout=15)
        assert r.status_code == 200

    def test_trade_in_count(self, client):
        r = client.get(f"{BASE_URL}/api/vin/trade-in-count", timeout=15)
        assert r.status_code == 200


# ---------- License scan (uses services.vision_extraction_service) ----------
class TestLicense:
    def test_scan_direct(self, client):
        # 1x1 PNG (transparent)
        tiny_png_b64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        )
        r = client.post(
            f"{BASE_URL}/api/license/scan-direct",
            json={"image_base64": tiny_png_b64},
            timeout=60,
        )
        # accept 200 (parsed something/empty) or 422/400 for unreadable; must NOT 500
        assert r.status_code != 500, f"license scan 500 → vision_extraction_service rewire broken: {r.text}"
        assert r.status_code in (200, 400, 422)


# ---------- Dashboard ----------
class TestDashboard:
    def test_stats(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard/stats", timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("customers", "vehicles", "intelligence_24h"):
            assert k in body, f"dashboard missing {k}: {list(body.keys())}"


# ---------- Telemetry (uses services.telemetry_service) ----------
class TestTelemetry:
    def test_track_then_summary(self, client):
        r = client.post(
            f"{BASE_URL}/api/telemetry/track",
            json={
                "event": "test_iter22_event",
                "session_id": f"sess-iter22-{int(time.time())}",
                "properties": {"source": "regression"},
            },
            timeout=15,
        )
        assert r.status_code in (200, 201, 202), r.text

        r2 = client.get(f"{BASE_URL}/api/telemetry/summary", timeout=15)
        assert r2.status_code == 200, r2.text


# ---------- Voice validation ----------
class TestVoice:
    def test_voice_translate_invalid_body_returns_422(self, client):
        r = client.post(f"{BASE_URL}/api/voice-translate", json={}, timeout=15)
        # must be 422 (validation) not 500 (crash)
        assert r.status_code == 422, f"expected 422 for invalid body, got {r.status_code}: {r.text}"
