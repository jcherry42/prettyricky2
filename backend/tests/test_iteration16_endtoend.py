"""Iteration 16 end-to-end HTTP verification.

Covers:
- Regression: /api/auth/login and /api/auth/logout with PIN=11111
- New: family-revocation on refresh-token reuse
- New: /api/dashboard/stats includes intelligence_24h block
- Regression: /api/intelligence/analyze new body shape {input, performanceMode}
- Regression: /api/tower-talk with/without performanceMode
- Regression: /api/translate with/without performanceMode
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


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def login_pair():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["access_token"], d["refresh_token"]


@pytest.fixture(scope="module")
def auth_headers(login_pair):
    return {"Authorization": f"Bearer {login_pair[0]}"}


# ---------- REGRESSION: auth ----------
class TestAuthRegression:
    def test_login_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and "refresh_token" in d
        # verify claims
        c = _claims(d["refresh_token"])
        assert c.get("type") == "refresh"
        assert "fam" in c and "jti" in c

    def test_login_bad_pin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": "00000"}, timeout=15)
        assert r.status_code in (401, 403)

    def test_logout_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        refresh = r.json()["refresh_token"]
        lo = requests.post(f"{BASE_URL}/api/auth/logout", json={"refresh_token": refresh}, timeout=15)
        assert lo.status_code == 200
        # jti now dead
        rr = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": refresh}, timeout=15)
        assert rr.status_code == 401
        assert "family" not in rr.text.lower()


# ---------- NEW: family-revocation ----------
class TestFamilyRevocation:
    def test_family_id_present_and_persists(self):
        r0 = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15).json()["refresh_token"]
        fam0 = _claims(r0)["fam"]
        time.sleep(1)
        r1 = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
        assert r1.status_code == 200
        assert _claims(r1.json()["refresh_token"])["fam"] == fam0

    def test_reuse_kills_family_and_all_descendants(self):
        # login
        r0 = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15).json()["refresh_token"]
        time.sleep(1)
        # rotate
        r1_resp = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
        assert r1_resp.status_code == 200
        r1 = r1_resp.json()["refresh_token"]

        # attacker replays r0
        replay = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
        assert replay.status_code == 401
        assert "revoked" in replay.text.lower()

        # r1 (legit but same family) must now be dead too
        time.sleep(1)
        victim = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r1}, timeout=15)
        assert victim.status_code == 401, victim.text
        assert "family" in victim.text.lower(), f"expected 'family' in error: {victim.text}"

    def test_fresh_login_recovers_after_family_kill(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert r.status_code == 200
        new_refresh = r.json()["refresh_token"]
        time.sleep(1)
        rot = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": new_refresh}, timeout=15)
        assert rot.status_code == 200


# ---------- NEW: dashboard stats intelligence_24h ----------
class TestDashboardStats:
    def test_intelligence_24h_block_present(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "intelligence_24h" in d, f"missing intelligence_24h in: {list(d.keys())}"
        i = d["intelligence_24h"]
        for k in ("sales_analyses", "service_analyses", "open_objections", "hot_escalations"):
            assert k in i, f"missing {k}"
            assert isinstance(i[k], int), f"{k} must be int, got {type(i[k])}"
            assert i[k] >= 0


# ---------- REGRESSION: intelligence/analyze new body shape ----------
class TestIntelligenceAnalyze:
    def _payload(self, mode="sales", msg="I really don't want to pay that much for this car"):
        return {
            "input": {
                "mode": mode,
                "customerMessage": msg,
                "language": "en",
                "channel": "chat",
            },
            "performanceMode": False,
        }

    def test_sales_new_body_shape(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json=self._payload("sales"),
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("prompt_version") == "intel-v1.0.0"
        # AutomotiveInteractionOutput core fields
        for k in ("customerSentiment", "objection", "nextBestAction", "riskFlags"):
            assert k in d, f"missing {k} in response: {list(d.keys())}"

    def test_service_new_body_shape(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json=self._payload("service", "This is the third time I bring my car in, I want to speak to a manager"),
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("prompt_version") == "intel-v1.0.0"

    def test_empty_customer_message_422(self, auth_headers):
        p = self._payload("sales", "")
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json=p,
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_performance_mode_true(self, auth_headers):
        p = self._payload("sales")
        p["performanceMode"] = True
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json=p,
            headers=auth_headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text


# ---------- REGRESSION: tower-talk ----------
class TestTowerTalkRegression:
    def test_tower_talk_default(self, auth_headers):
        body = {"situation": "Customer asking about SUV pricing", "inquiryType": "pricing", "context": {"mode": "sales", "language": "en"}}
        r = requests.post(f"{BASE_URL}/api/tower-talk", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text

    def test_tower_talk_perf_mode(self, auth_headers):
        body = {
            "situation": "Customer asking about SUV pricing",
            "inquiryType": "pricing",
            "context": {"mode": "sales", "language": "en"},
            "performanceMode": True,
        }
        r = requests.post(f"{BASE_URL}/api/tower-talk", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text


# ---------- REGRESSION: translate ----------
class TestTranslateRegression:
    def test_translate_default(self, auth_headers):
        body = {"text": "Hello, how are you?", "targetLanguage": "es"}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text

    def test_translate_perf_mode(self, auth_headers):
        body = {"text": "Hello, how are you?", "targetLanguage": "es", "performanceMode": True}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
