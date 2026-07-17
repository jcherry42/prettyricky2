"""Iteration 15 — Apex Intelligence Framework backend tests.

Covers:
- /api/intelligence/analyze auth, contract, sales(es), service escalation, validation, perf mode
- Backward compat for /api/tower-talk & /api/translate with/without performanceMode
- Regression: auth login/refresh/logout, health/ready
"""
import os
import pytest
import requests

BASE_URL = "https://vin-scanner-audit.preview.emergentagent.com"
PIN = "11111"
TIMEOUT = 30


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=TIMEOUT)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "refresh_token" in data
    return data


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token['access_token']}", "Content-Type": "application/json"}


# ---------- Regression health ----------
class TestHealth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
        assert r.status_code == 200

    def test_ready(self):
        r = requests.get(f"{BASE_URL}/api/ready", timeout=TIMEOUT)
        assert r.status_code == 200


# ---------- Intelligence endpoint ----------
class TestIntelligenceAnalyze:
    def test_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json={"mode": "sales", "channel": "sms", "customerMessage": "hi"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}"

    def test_spanish_sales_inquiry(self, headers):
        payload = {
            "input": {
                "mode": "sales",
                "channel": "sms",
                "customerLanguage": "es",
                "customerMessage": "¿Cuánto cuesta el Camry 2023?",
                "vehicle": {"year": 2023, "make": "Toyota", "model": "Camry"},
            }
        }
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze", json=payload, headers=headers, timeout=60
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        d = r.json()
        assert d["detectedLanguage"].lower().startswith("es"), f"lang={d['detectedLanguage']}"
        assert d.get("translatedCustomerMeaning"), "translatedCustomerMeaning missing"
        SALES_INTENTS = [
            "availability", "price", "payment", "financing", "trade",
            "appointment", "vehicle_features", "vehicle_comparison",
            "condition_or_history", "location_or_hours", "followup", "general_question",
        ]
        SALES_STAGES = [
            "new_inquiry", "information_gathering", "vehicle_interest", "price_discussion",
            "payment_discussion", "trade_discussion", "appointment_negotiation",
            "appointment_confirmed", "post_visit_followup", "objection", "lost_or_inactive",
        ]
        assert d["primaryIntent"] in SALES_INTENTS, d["primaryIntent"]
        assert d["conversationStage"] in SALES_STAGES, d["conversationStage"]
        assert len(d["responses"]["recommended"]) <= 320
        assert (d.get("prompt_version") or "").startswith("intel-v1")

    def test_service_escalation(self, headers):
        payload = {
            "input": {
                "mode": "service",
                "channel": "sms",
                "customerLanguage": "en",
                "customerMessage": (
                    "This is the third time you have my car for the same brake problem. "
                    "I want to speak to a manager and my attorney will hear about this"
                ),
            }
        }
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze", json=payload, headers=headers, timeout=60
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        d = r.json()
        flags = set(d["riskFlags"])
        for req in ("request_for_manager", "legal_threat", "repeat_repair"):
            assert req in flags, f"missing flag {req}: {flags}"
        assert d["recommendedStrategy"] == "escalate_to_human", d["recommendedStrategy"]
        assert d["customerSentiment"]["label"] in ("frustrated", "angry"), d["customerSentiment"]

    def test_empty_customer_message(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json={"input": {"mode": "sales", "channel": "sms", "customerMessage": ""}},
            headers=headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_performance_mode_true(self, headers):
        payload = {
            "performanceMode": True,
            "input": {
                "mode": "sales",
                "channel": "sms",
                "customerMessage": "Is the 2023 Camry still available?",
            },
        }
        r = requests.post(
            f"{BASE_URL}/api/intelligence/analyze",
            json=payload, headers=headers, timeout=60,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        d = r.json()
        assert d["primaryIntent"]
        assert d["conversationStage"]
        assert d["responses"]["recommended"]
        assert (d.get("prompt_version") or "").startswith("intel-v1")


# ---------- Tower Talk backward compatibility ----------
class TestTowerTalk:
    def _payload(self, extra=None):
        p = {
            "situation": "Customer asked about the 2023 Camry price",
            "inquiryType": "price_question",
            "context": {
                "customerName": "John",
                "vehicle": "2023 Toyota Camry",
                "vehiclePrice": "$28,500",
                "dealershipName": "Apex Motors",
                "salespersonName": "Mike",
            },
            "mode": "sales",
        }
        if extra:
            p.update(extra)
        return p

    def test_tower_talk_no_perf_mode(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/tower-talk", json=self._payload(), headers=headers, timeout=60
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        text = r.json()["response"]
        assert text and len(text) > 20
        # No emoji regression
        import re
        assert not re.search(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", text), f"emoji found: {text}"

    def test_tower_talk_with_perf_mode(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/tower-talk",
            json=self._payload({"performanceMode": True}),
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        text = r.json()["response"]
        assert text and len(text) > 20


# ---------- Translate backward compatibility ----------
class TestTranslate:
    def test_translate_no_perf(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/translate",
            json={"text": "Hello, how are you?", "source_lang": "en", "target_lang": "es"},
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        d = r.json()
        assert d["translated_text"]

    def test_translate_with_perf(self, headers):
        r = requests.post(
            f"{BASE_URL}/api/translate",
            json={
                "text": "The vehicle is ready for pickup.",
                "source_lang": "en",
                "target_lang": "es",
                "performanceMode": True,
            },
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text}"
        d = r.json()
        assert d["translated_text"]


# ---------- Auth regression ----------
class TestAuthRegression:
    def test_login_refresh_logout(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=TIMEOUT)
        assert r.status_code == 200
        tok = r.json()
        assert tok.get("access_token") and tok.get("refresh_token")

        r2 = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": tok["refresh_token"]},
            timeout=TIMEOUT,
        )
        assert r2.status_code == 200, f"refresh failed: {r2.text}"
        new_tok = r2.json()
        assert new_tok["access_token"] != tok["access_token"]
        assert new_tok["refresh_token"] != tok["refresh_token"]

        r3 = requests.post(
            f"{BASE_URL}/api/auth/logout",
            json={"refresh_token": new_tok["refresh_token"]},
            timeout=TIMEOUT,
        )
        assert r3.status_code == 200
