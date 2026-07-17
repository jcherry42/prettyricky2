"""
Iteration 20 — Preferred Language backend contract + regression suite.

NEW:
- POST /api/customers accepts preferred_language ('en'|'es'|'fr'|'ko')
- PATCH /api/customers/{id} updates preferred_language
- GET /api/customers/{id} returns preferred_language
- Default preferred_language when not provided

REGRESSION:
- /api/translate ko target returns Hangul
- /api/translate cache-key collision fix (ES/FR/KO from same source)
- /api/intelligence/analyze cache-hit fast (<400ms)
- /api/auth/login pin=11111, refresh rotation + family revocation, logout scoped
- /api/dashboard/stats intelligence_24h int fields
- /api/tower-talk SMS-length, no-emoji, appointment invitation
"""
import os
import re
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "BACKEND_TEST_URL",
    "https://apex-service-advisor.preview.emergentagent.com",
).rstrip("/")
PIN = "11111"

HANGUL_RE = re.compile(r"[\uAC00-\uD7AF]")
EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F900-\U0001F9FF"
    "]"
)


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    return {
        "access": data["access_token"],
        "refresh": data["refresh_token"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


# ============ NEW: Preferred Language ============

class TestPreferredLanguage:
    @pytest.fixture(scope="class")
    def created(self, auth):
        payload = {
            "first_name": f"TEST_iter20_{uuid.uuid4().hex[:6]}",
            "last_name": "Kim",
            "phone": "5551234567",
            "preferred_language": "ko",
        }
        r = requests.post(
            f"{BASE_URL}/api/customers",
            json=payload,
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 201, f"create failed: {r.status_code} {r.text}"
        body = r.json()
        yield body
        # cleanup
        cid = body.get("id")
        if cid:
            requests.delete(
                f"{BASE_URL}/api/customers/{cid}",
                headers=auth["headers"],
                timeout=15,
            )

    def test_create_customer_with_ko(self, created):
        assert created.get("preferred_language") == "ko", created
        assert "id" in created

    def test_patch_customer_language_to_fr(self, auth, created):
        cid = created["id"]
        r = requests.patch(
            f"{BASE_URL}/api/customers/{cid}",
            json={"preferred_language": "fr"},
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"

    def test_get_customer_returns_fr(self, auth, created):
        cid = created["id"]
        r = requests.get(
            f"{BASE_URL}/api/customers/{cid}",
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("preferred_language") == "fr"

    def test_default_language_when_not_provided(self, auth):
        payload = {
            "first_name": f"TEST_iter20_def_{uuid.uuid4().hex[:6]}",
            "last_name": "Default",
            "phone": "5559999999",
        }
        r = requests.post(
            f"{BASE_URL}/api/customers",
            json=payload,
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body.get("preferred_language") in ("en", None), body
        # cleanup
        if body.get("id"):
            requests.delete(
                f"{BASE_URL}/api/customers/{body['id']}",
                headers=auth["headers"],
                timeout=15,
            )


# ============ REGRESSION: Translate ============

class TestTranslate:
    def test_translate_ko_returns_hangul(self, auth):
        src = f"iter20 ko test {int(time.time()*1000)}: Would you be free to test-drive tomorrow?"
        r = requests.post(
            f"{BASE_URL}/api/translate",
            json={"text": src, "source_lang": "en", "target_lang": "ko"},
            headers=auth["headers"],
            timeout=45,
        )
        assert r.status_code == 200, r.text
        translated = r.json().get("translated_text", "")
        assert HANGUL_RE.search(translated), f"no Hangul: {translated!r}"

    def test_cache_key_collision_fix(self, auth):
        src = f"iter20 collision {int(time.time()*1000)}: Hello, are you interested in the SUV?"
        outs = {}
        for lang in ("es", "fr", "ko"):
            r = requests.post(
                f"{BASE_URL}/api/translate",
                json={"text": src, "source_lang": "en", "target_lang": lang},
                headers=auth["headers"],
                timeout=45,
            )
            assert r.status_code == 200, f"{lang}: {r.text}"
            outs[lang] = r.json()["translated_text"]

        assert HANGUL_RE.search(outs["ko"]), f"KO not Hangul: {outs['ko']!r}"
        assert not HANGUL_RE.search(outs["es"]), f"ES has Hangul: {outs['es']!r}"
        assert not HANGUL_RE.search(outs["fr"]), f"FR has Hangul: {outs['fr']!r}"
        assert len({outs["es"], outs["fr"], outs["ko"]}) == 3, f"outputs collide: {outs}"


# ============ REGRESSION: Intelligence cache hit ============

class TestIntelligenceCache:
    def test_cache_hit_fast(self, auth):
        payload = {
            "input": {
                "mode": "sales",
                "channel": "sms",
                "customerMessage": f"iter20 cache {int(time.time()*1000)}: I want to schedule a test drive Saturday",
            },
            "performanceMode": False,
        }
        # prime
        r1 = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json=payload,
            headers=auth["headers"],
            timeout=45,
        )
        assert r1.status_code == 200, r1.text

        # measure second identical call
        t0 = time.perf_counter()
        r2 = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json=payload,
            headers=auth["headers"],
            timeout=45,
        )
        dt_ms = (time.perf_counter() - t0) * 1000
        assert r2.status_code == 200
        assert dt_ms < 400, f"cache hit slow: {dt_ms:.0f}ms"
        print(f"[intelligence cache hit] {dt_ms:.0f}ms")


# ============ REGRESSION: Auth ============

class TestAuth:
    def test_login_pin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("access_token") and d.get("refresh_token")

    def test_refresh_rotation_and_family_revocation(self):
        # Fresh login (isolate family)
        lg = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert lg.status_code == 200
        refresh = lg.json()["refresh_token"]

        # 1st rotation
        r1 = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": refresh},
            timeout=15,
        )
        assert r1.status_code == 200, r1.text
        new_refresh = r1.json()["refresh_token"]
        assert new_refresh != refresh

        # Reuse of old (revoked) refresh → 401, and family gets revoked
        r2 = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": refresh},
            timeout=15,
        )
        assert r2.status_code == 401, f"reuse should fail: {r2.status_code} {r2.text}"

        # After family revocation, even the rotated token should be denied
        r3 = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": new_refresh},
            timeout=15,
        )
        assert r3.status_code == 401, (
            f"family should be revoked, got {r3.status_code} {r3.text}"
        )

    def test_logout_scoped_to_jti(self):
        # Fresh login
        lg = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert lg.status_code == 200
        access = lg.json()["access_token"]
        refresh = lg.json()["refresh_token"]

        # Logout requires refresh_token in body (per pin_auth.py::logout)
        lr = requests.post(
            f"{BASE_URL}/api/auth/logout",
            json={"refresh_token": refresh},
            headers={"Authorization": f"Bearer {access}"},
            timeout=15,
        )
        assert lr.status_code == 200, lr.text
        assert lr.json().get("success") is True

        # After logout the used refresh jti is revoked → refresh should fail
        rr = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": refresh},
            timeout=15,
        )
        assert rr.status_code == 401


# ============ REGRESSION: Dashboard stats ============

class TestDashboardStats:
    def test_intelligence_24h_ints(self, auth):
        r = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers=auth["headers"],
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        i24 = data.get("intelligence_24h")
        assert isinstance(i24, dict), f"missing intelligence_24h: {list(data.keys())}"
        assert i24, "intelligence_24h empty"
        for k, v in i24.items():
            assert isinstance(v, int), f"{k}={v!r} is not int ({type(v).__name__})"


# ============ REGRESSION: Tower Talk ============

class TestTowerTalk:
    def test_tower_talk_sms_no_emoji_invitation(self, auth):
        payload = {
            "situation": f"iter20 tt {int(time.time()*1000)}: Interested in a 2024 F-150 XLT.",
            "inquiryType": "new_lead",
            "context": {
                "customerName": "Test User",
                "vehicle": "2024 F-150 XLT",
                "vehiclePrice": "$52,000",
                "dealershipName": "TestMotors",
                "salespersonName": "Alex",
            },
            "mode": "sales",
            "performanceMode": False,
        }
        r = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json=payload,
            headers=auth["headers"],
            timeout=60,
        )
        assert r.status_code == 200, r.text
        reply = r.json().get("response") or ""
        assert reply, f"empty reply: {r.json()}"
        # SMS-length
        assert len(reply) <= 500, f"reply too long ({len(reply)}): {reply!r}"
        # No emoji
        assert not EMOJI_RE.search(reply), f"emoji present: {reply!r}"
        # Appointment invitation: look for scheduling/visit language
        lower = reply.lower()
        markers = [
            "appointment", "schedule", "visit", "come in", "come by",
            "stop by", "test drive", "see you", "time work", "time works",
            "which works", "available", "meet", "book", "open",
            ":00", ":30", ":15", ":45",
        ]
        assert any(m in lower for m in markers), f"no appointment invitation: {reply!r}"
