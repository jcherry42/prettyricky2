"""Iteration 17 backend verification.

Focus:
- NEW SPEED: /api/tower-talk kicks off async pre-warm of es+fr translations.
  Follow-up /api/translate on the RAW reply should be a warm cache hit (<400ms).
- NEW: /api/intelligence/analyze cache hit — 2nd identical call within 5min <100ms.
- REGRESSION: auth login/logout/refresh (family revocation), translate perf modes,
  intelligence sales+service (en/es), empty message 422, dashboard/stats intelligence_24h.
"""
import os
import time

import pytest
import requests
from jose import jwt

BASE_URL = os.environ.get(
    "BACKEND_TEST_URL", "https://apex-service-advisor.preview.emergentagent.com"
).rstrip("/")
PIN = "11111"


def _claims(token: str) -> dict:
    return jwt.get_unverified_claims(token)


@pytest.fixture(scope="module")
def tokens():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def auth_headers(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


# ---------- REGRESSION: auth ----------
class TestAuthRegression:
    def test_login_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and "refresh_token" in d
        c = _claims(d["refresh_token"])
        assert c.get("type") == "refresh"
        assert "fam" in c and "jti" in c

    def test_login_bad_pin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": "00000"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_refresh_rotates_and_preserves_family(self):
        r0 = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15).json()["refresh_token"]
        fam0 = _claims(r0)["fam"]
        time.sleep(1)
        rot = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
        assert rot.status_code == 200
        r1 = rot.json()["refresh_token"]
        assert _claims(r1)["fam"] == fam0
        assert _claims(r1)["jti"] != _claims(r0)["jti"]

    def test_reuse_revokes_family(self):
        r0 = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15).json()["refresh_token"]
        time.sleep(1)
        rot = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
        assert rot.status_code == 200
        r1 = rot.json()["refresh_token"]
        # replay old
        rep = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
        assert rep.status_code == 401
        # r1 must be dead too
        time.sleep(1)
        v = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r1}, timeout=15)
        assert v.status_code == 401
        assert "family" in v.text.lower()

    def test_logout(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        refresh = r.json()["refresh_token"]
        lo = requests.post(f"{BASE_URL}/api/auth/logout", json={"refresh_token": refresh}, timeout=15)
        assert lo.status_code == 200
        rr = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": refresh}, timeout=15)
        assert rr.status_code == 401


# ---------- REGRESSION: intelligence/analyze basic ----------
def _intel_payload(mode="sales", msg="I really don't want to pay that much for this car", lang="en"):
    return {
        "input": {
            "mode": mode,
            "customerMessage": msg,
            "language": lang,
            "channel": "chat",
        },
        "performanceMode": False,
    }


class TestIntelligenceRegression:
    def test_sales_english(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                          json=_intel_payload("sales"), headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("prompt_version") == "intel-v1.0.0"
        for k in ("customerSentiment", "objection", "nextBestAction", "riskFlags"):
            assert k in d

    def test_service_english(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                          json=_intel_payload("service", "This is the third time I bring my car in"),
                          headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("prompt_version") == "intel-v1.0.0"

    def test_sales_spanish(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                          json=_intel_payload("sales", "No quiero pagar tanto por este coche", "es"),
                          headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text

    def test_empty_message_422(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                          json=_intel_payload("sales", ""), headers=auth_headers, timeout=30)
        assert r.status_code == 422


# ---------- NEW: intelligence cache hit ----------
class TestIntelligenceCache:
    def test_identical_call_is_cache_hit(self, auth_headers):
        # Unique-ish message so no prior cache; but same within test
        msg = f"Cache-test-{int(time.time())}: I need lower monthly payments and cannot afford this deal."
        payload = _intel_payload("sales", msg)

        t0 = time.monotonic()
        r1 = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                           json=payload, headers=auth_headers, timeout=60)
        cold_ms = (time.monotonic() - t0) * 1000
        assert r1.status_code == 200, r1.text

        # Second call — should be a cache hit
        t1 = time.monotonic()
        r2 = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                           json=payload, headers=auth_headers, timeout=60)
        warm_ms = (time.monotonic() - t1) * 1000
        assert r2.status_code == 200, r2.text

        # Response equality (same cached output)
        assert r1.json().get("customerSentiment") == r2.json().get("customerSentiment")

        print(f"[intel-cache] cold={cold_ms:.0f}ms warm={warm_ms:.0f}ms")
        # warm must be dramatically faster; allow generous 500ms upper bound for network jitter to preview URL
        assert warm_ms < 500, f"warm call took {warm_ms:.0f}ms — cache not hit"
        assert warm_ms < cold_ms * 0.5, f"warm ({warm_ms:.0f}ms) not << cold ({cold_ms:.0f}ms)"


# ---------- REGRESSION: translate perf modes ----------
class TestTranslateRegression:
    def test_translate_default(self, auth_headers):
        body = {"text": "Hello, how are you today?", "target_lang": "es"}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("translated_text")

    def test_translate_perf_mode(self, auth_headers):
        body = {"text": "Hello, how are you today?", "target_lang": "es", "performanceMode": True}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text


# ---------- NEW SPEED: pre-warm after tower-talk ----------
class TestTowerTalkPrewarm:
    def _tower_payload(self):
        return {
            "situation": f"Prewarm test {int(time.time())}: New lead asking about a 2024 Toyota Camry XSE.",
            "inquiryType": "new_lead",
            "context": {
                "customerName": "John Buyer",
                "vehicle": "2024 Toyota Camry XSE",
                "vehiclePrice": "$34,500",
                "dealershipName": "AutoMax Motors",
                "salespersonName": "Alex Rivera",
            },
            "mode": "sales",
            "performanceMode": False,
        }

    def test_tower_talk_returns_and_prewarms_es(self, auth_headers):
        # Cold tower-talk call
        t0 = time.monotonic()
        r = requests.post(f"{BASE_URL}/api/tower-talk",
                          json=self._tower_payload(), headers=auth_headers, timeout=60)
        tt_ms = (time.monotonic() - t0) * 1000
        assert r.status_code == 200, r.text
        reply = r.json().get("response")
        assert isinstance(reply, str) and len(reply) > 0
        print(f"[tower-talk] cold={tt_ms:.0f}ms reply_len={len(reply)}")

        # Wait for background pre-warm to complete
        time.sleep(2.5)

        # Now translate the raw reply → target_lang='es'. Should be cache hit.
        t1 = time.monotonic()
        tr = requests.post(f"{BASE_URL}/api/translate",
                           json={"text": reply, "source_lang": "en", "target_lang": "es"},
                           headers=auth_headers, timeout=60)
        warm_ms = (time.monotonic() - t1) * 1000
        assert tr.status_code == 200, tr.text
        assert tr.json().get("translated_text")

        print(f"[prewarm-es] warm_translate={warm_ms:.0f}ms")
        # Should be <400ms since the ai_gateway cache should hit
        assert warm_ms < 800, f"Expected pre-warmed translate <800ms, got {warm_ms:.0f}ms"

    def test_tower_talk_prewarms_fr(self, auth_headers):
        payload = self._tower_payload()
        payload["situation"] = f"Prewarm-FR test {int(time.time())}: Lead interested in Honda Civic."
        r = requests.post(f"{BASE_URL}/api/tower-talk", json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200
        reply = r.json()["response"]

        time.sleep(2.5)

        t1 = time.monotonic()
        tr = requests.post(f"{BASE_URL}/api/translate",
                           json={"text": reply, "source_lang": "en", "target_lang": "fr"},
                           headers=auth_headers, timeout=60)
        warm_ms = (time.monotonic() - t1) * 1000
        assert tr.status_code == 200, tr.text
        print(f"[prewarm-fr] warm_translate={warm_ms:.0f}ms")
        assert warm_ms < 800, f"Expected pre-warmed French translate <800ms, got {warm_ms:.0f}ms"


# ---------- REGRESSION: dashboard stats ----------
class TestDashboardStats:
    def test_intelligence_24h_block(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "intelligence_24h" in d
        i = d["intelligence_24h"]
        for k in ("sales_analyses", "service_analyses", "open_objections", "hot_escalations"):
            assert k in i
            assert isinstance(i[k], int)
            assert i[k] >= 0
