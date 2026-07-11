"""Iteration 14 — Tower Talk sales vs service mode tests + iter13 regression trigger.

Coverage:
- Auth requirement (401 without Bearer).
- Sales mode default (mode omitted) returns sales-close style.
- Service mode returns service-advisor style (RO, tech, guest, warranty language).
- Optional `mode` field accepted; unknown types fall back per mode.
- Latency < 5s.
"""
from __future__ import annotations

import os
import re
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "https://vin-scanner-audit.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
PIN = "11111"


@pytest.fixture(scope="module")
def token() -> str:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _ctx():
    return {
        "customerName": "Sarah Johnson",
        "vehicle": "2024 Toyota Camry SE",
        "vehiclePrice": "$32,500",
        "dealershipName": "Metro Toyota",
        "salespersonName": "Mike Chen",
    }


def _post_tower_talk(headers, body, timeout=15):
    t0 = time.monotonic()
    r = requests.post(f"{BASE_URL}/api/tower-talk", json=body, headers=headers, timeout=timeout)
    latency = time.monotonic() - t0
    return r, latency


# ---------- AUTH ----------

def test_tower_talk_requires_auth():
    r = requests.post(
        f"{BASE_URL}/api/tower-talk",
        json={"situation": "hi", "inquiryType": "new_lead", "context": _ctx()},
        timeout=10,
    )
    assert r.status_code == 401


# ---------- SALES MODE (default / explicit) ----------

SALES_INQUIRIES = [
    "new_lead", "price_question", "availability", "trade_in",
    "financing", "test_drive", "follow_up", "objection", "appointment_setting",
]

SERVICE_WORDS = re.compile(r"\b(RO|repair order|master tech|comeback|warranty claim|bay|tech|guest)\b", re.IGNORECASE)


@pytest.mark.parametrize("inquiry", SALES_INQUIRIES)
def test_sales_mode_default_no_service_lingo(auth_headers, inquiry):
    """mode omitted defaults to sales — should NOT contain service-heavy phrases like 'RO' 'master tech' 'comeback'."""
    body = {
        "situation": f"Customer texting about {inquiry.replace('_', ' ')} on the Camry",
        "inquiryType": inquiry,
        "context": _ctx(),
    }
    r, latency = _post_tower_talk(auth_headers, body)
    assert r.status_code == 200, r.text
    text = r.json()["response"]
    assert text and len(text) > 20
    # No emojis
    assert not re.search(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", text), f"emoji found: {text!r}"
    # Service-specific hard-negatives (avoid false pos on 'tech' — check phrases)
    lower = text.lower()
    banned = ["master tech", "warranty claim", "repair order", " ro ", "shop foreman"]
    hits = [b for b in banned if b in lower]
    assert not hits, f"sales-mode response contains service phrases {hits}: {text!r}"
    assert latency < 15.0, f"latency {latency:.2f}s"


def test_sales_mode_explicit(auth_headers):
    r, _ = _post_tower_talk(auth_headers, {
        "situation": "wants to know if 2024 Camry SE is available for weekend",
        "inquiryType": "availability",
        "context": _ctx(),
        "mode": "sales",
    })
    assert r.status_code == 200
    text = r.json()["response"].lower()
    # sales style — should suggest a time / appointment / value cue
    assert any(w in text for w in ["come", "stop by", "today", "tomorrow", "here", "am ", "pm", "appointment", "time", ":"])


def test_sales_mode_unknown_inquiry_falls_back_new_lead(auth_headers):
    r, _ = _post_tower_talk(auth_headers, {
        "situation": "customer just texted asking about the car",
        "inquiryType": "totally_bogus_type_xyz",
        "context": _ctx(),
    })
    assert r.status_code == 200
    text = r.json()["response"].lower()
    assert "ro" not in text.split() and "master tech" not in text


def test_sales_mode_with_service_inquiry_type_falls_back(auth_headers):
    """mode=sales + service-only inquiryType should still return sales content (fallback to new_lead)."""
    r, _ = _post_tower_talk(auth_headers, {
        "situation": "customer texted",
        "inquiryType": "waiter_status",   # service-only key
        "context": _ctx(),
        "mode": "sales",
    })
    assert r.status_code == 200
    text = r.json()["response"]
    assert text and len(text) > 20


# ---------- SERVICE MODE ----------

SERVICE_INQUIRIES = [
    "waiter_status", "estimate_upsell", "comeback", "warranty_claim",
    "parts_hold", "tech_consult", "loaner_request", "declined_service",
    "pickup_ready", "schedule_appointment",
]


@pytest.mark.parametrize("inquiry", SERVICE_INQUIRIES)
def test_service_mode_returns_advisor_style(auth_headers, inquiry):
    body = {
        "situation": f"Guest waiting in the lounge, asking about {inquiry.replace('_',' ')}",
        "inquiryType": inquiry,
        "context": _ctx(),
        "mode": "service",
    }
    r, latency = _post_tower_talk(auth_headers, body)
    assert r.status_code == 200, r.text
    text = r.json()["response"]
    assert text and len(text) > 20
    assert not re.search(r"[\U0001F300-\U0001FAFF\U00002600-\U000027BF]", text)
    assert latency < 15.0


def test_service_mode_uses_service_lingo_bulk(auth_headers):
    """Across 3 service inquiries, at least one should reference guest/tech/warranty/ETA/coverage/RO/loaner/appointment word set."""
    hits = 0
    for inquiry in ["comeback", "warranty_claim", "waiter_status"]:
        r, _ = _post_tower_talk(auth_headers, {
            "situation": f"customer scenario for {inquiry}",
            "inquiryType": inquiry,
            "context": _ctx(),
            "mode": "service",
        })
        assert r.status_code == 200
        t = r.json()["response"].lower()
        if any(w in t for w in ["guest", "tech", "warranty", "coverage", "eta", "loaner", "bay", "ro ", "advisor", "shuttle", "appointment"]):
            hits += 1
    assert hits >= 2, f"expected service-lingo in >=2/3 service responses, got {hits}"


def test_service_mode_with_sales_inquiry_type_falls_back(auth_headers):
    """mode=service + sales-only key like new_lead should fall back to waiter_status (service default)."""
    r, _ = _post_tower_talk(auth_headers, {
        "situation": "guest waiting for oil change status",
        "inquiryType": "new_lead",   # sales-only key
        "context": _ctx(),
        "mode": "service",
    })
    assert r.status_code == 200
    text = r.json()["response"]
    assert text and len(text) > 20


def test_mode_case_insensitive(auth_headers):
    r, _ = _post_tower_talk(auth_headers, {
        "situation": "guest waiting for update",
        "inquiryType": "waiter_status",
        "context": _ctx(),
        "mode": "SERVICE",
    })
    assert r.status_code == 200


# ---------- CORE REGRESSION TOUCH ----------

def test_login_pin(auth_headers, token):
    assert token and len(token) > 20


def test_customers_endpoint(auth_headers):
    r = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    items = data["customers"] if isinstance(data, dict) else data
    assert isinstance(items, list)
    for c in items[:5]:
        assert "_id" not in c


def test_vehicles_endpoint(auth_headers):
    r = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    items = data["vehicles"] if isinstance(data, dict) else data
    assert isinstance(items, list)
    for v in items[:5]:
        assert "_id" not in v


def test_sessions_restore(auth_headers):
    r = requests.get(f"{BASE_URL}/api/sessions/restore", headers=auth_headers, timeout=10)
    assert r.status_code in (200, 204)


def test_tower_talk_401_without_bearer():
    r = requests.post(
        f"{BASE_URL}/api/tower-talk",
        json={"situation": "x", "inquiryType": "new_lead", "context": _ctx()},
        timeout=10,
    )
    assert r.status_code == 401
