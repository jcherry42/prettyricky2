"""Iteration 18 backend verification.

Focus:
- NEW LANGUAGE SCOPE: /api/translate now supports EN, ES, FR, KO only.
  * target_lang='ko' returns Korean characters (Hangul U+AC00-U+D7AF).
  * target_lang='ja' still returns 200 (falls back to raw lang code) but is not "supported".
- NEW PRE-WARM: /api/tower-talk pre-warms ES + FR + KO in parallel; three
  follow-up /api/translate calls (es, fr, ko) on the same reply each <400ms
  (allowing up to 800ms for preview URL latency jitter).
- REGRESSION: all iteration 17 flows re-run at HTTP level.
"""
import os
import re
import time

import pytest
import requests
from jose import jwt

BASE_URL = os.environ.get(
    "BACKEND_TEST_URL", "https://vin-scanner-audit.preview.emergentagent.com"
).rstrip("/")
PIN = "11111"

HANGUL_RE = re.compile(r"[\uac00-\ud7af]")


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


# ---------- NEW: language scope for /api/translate ----------
class TestTranslateLanguageScope:
    def test_translate_korean_returns_hangul(self, auth_headers):
        body = {"text": "Hello, how are you today?", "source_lang": "en", "target_lang": "ko"}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        translated = d.get("translated_text") or ""
        assert translated, "empty Korean translation"
        assert HANGUL_RE.search(translated), (
            f"Expected Korean Hangul characters in translation, got: {translated!r}"
        )
        print(f"[ko] translated={translated!r}")

    def test_translate_french_still_works(self, auth_headers):
        body = {"text": "Hello, how are you today?", "source_lang": "en", "target_lang": "fr"}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("translated_text")

    def test_translate_spanish_still_works(self, auth_headers):
        body = {"text": "Hello, how are you today?", "source_lang": "en", "target_lang": "es"}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.json().get("translated_text")

    def test_translate_japanese_no_longer_supported_but_does_not_crash(self, auth_headers):
        """target_lang='ja' is no longer in lang_names but request should not crash.
        Route falls back to using the raw code 'ja' in the prompt. Response is 200."""
        body = {"text": "Hello there.", "source_lang": "en", "target_lang": "ja"}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        # We do NOT assert on content — 'ja' is out of the supported map now.
        assert "translated_text" in r.json()

    def test_auto_detect_korean_source(self, auth_headers):
        """Auto-detect should classify a Hangul input as 'ko'."""
        body = {"text": "안녕하세요, 오늘 어떠세요?", "source_lang": "auto", "target_lang": "en"}
        r = requests.post(f"{BASE_URL}/api/translate", json=body, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("detected_lang") == "ko", f"expected detected_lang=ko, got {d.get('detected_lang')}"


# ---------- NEW: tower-talk pre-warms es + fr + ko ----------
class TestTowerTalkTriplePrewarm:
    def _payload(self, tag="prewarm"):
        return {
            "situation": f"{tag} test {int(time.time())}: New lead asking about a 2024 Toyota Camry XSE.",
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

    def test_prewarm_es_fr_ko_all_warm(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/tower-talk",
                          json=self._payload("iter18"), headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        reply = r.json()["response"]
        assert reply

        # Give background pre-warm tasks time to finish
        time.sleep(3.0)

        results = {}
        for tgt in ("es", "fr", "ko"):
            t0 = time.monotonic()
            tr = requests.post(f"{BASE_URL}/api/translate",
                               json={"text": reply, "source_lang": "en", "target_lang": tgt},
                               headers=auth_headers, timeout=60)
            dt = (time.monotonic() - t0) * 1000
            assert tr.status_code == 200, tr.text
            assert tr.json().get("translated_text")
            results[tgt] = dt
            print(f"[prewarm-{tgt}] warm_translate={dt:.0f}ms")

        # Korean output must contain Hangul characters
        tr_ko = requests.post(f"{BASE_URL}/api/translate",
                              json={"text": reply, "source_lang": "en", "target_lang": "ko"},
                              headers=auth_headers, timeout=60).json()
        assert HANGUL_RE.search(tr_ko.get("translated_text", "")), \
            f"KO reply lacks Hangul: {tr_ko.get('translated_text')!r}"

        # All three targets should hit warm cache. Allow generous 800ms upper bound.
        for tgt, dt in results.items():
            assert dt < 800, f"pre-warm miss for {tgt}: {dt:.0f}ms"


# ---------- REGRESSION: tower-talk sales format ----------
class TestTowerTalkFormat:
    def test_sales_reply_is_sms_length_and_no_emoji(self, auth_headers):
        payload = {
            "situation": "New lead — interested in a 2024 Honda Civic Si.",
            "inquiryType": "new_lead",
            "context": {
                "customerName": "Sarah",
                "vehicle": "2024 Honda Civic Si",
                "vehiclePrice": "$29,900",
                "dealershipName": "MetroHonda",
                "salespersonName": "Chris",
            },
            "mode": "sales",
        }
        r = requests.post(f"{BASE_URL}/api/tower-talk", json=payload, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        reply = r.json()["response"]
        # SMS-ish
        assert len(reply) < 900, f"reply too long: {len(reply)}"
        # No emojis (broad range check)
        emoji_pat = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF]")
        assert not emoji_pat.search(reply), f"reply contains emoji: {reply!r}"


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
        rep = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
        assert rep.status_code == 401
        time.sleep(1)
        v = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r1}, timeout=15)
        assert v.status_code == 401
        assert "family" in v.text.lower()

    def test_logout_revokes_only_jti(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15).json()
        refresh = r["refresh_token"]
        lo = requests.post(f"{BASE_URL}/api/auth/logout", json={"refresh_token": refresh}, timeout=15)
        assert lo.status_code == 200
        rr = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": refresh}, timeout=15)
        assert rr.status_code == 401
        # But new login should still work (family not necessarily revoked)
        r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
        assert r2.status_code == 200


# ---------- REGRESSION: intelligence ----------
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

    def test_cache_hit_on_repeat(self, auth_headers):
        msg = f"Iter18-cache-{int(time.time())}: I need lower monthly payments and cannot afford this deal."
        payload = _intel_payload("sales", msg)
        t0 = time.monotonic()
        r1 = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                           json=payload, headers=auth_headers, timeout=60)
        cold_ms = (time.monotonic() - t0) * 1000
        assert r1.status_code == 200

        t1 = time.monotonic()
        r2 = requests.post(f"{BASE_URL}/api/intelligence/analyze",
                           json=payload, headers=auth_headers, timeout=60)
        warm_ms = (time.monotonic() - t1) * 1000
        assert r2.status_code == 200
        print(f"[intel-cache] cold={cold_ms:.0f}ms warm={warm_ms:.0f}ms")
        assert warm_ms < 500, f"warm call took {warm_ms:.0f}ms — cache not hit"


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
