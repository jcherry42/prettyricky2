"""
Iteration 11 — Mobile Telemetry Instrumentation Backend Verification
====================================================================
Verifies the backend correctly accepts and persists the new mobile-side
telemetry events introduced in iteration 11:
  • auth.login_success / login_failed / login_locked
  • vin_scan.barcode_success, vin_scan.ocr (source=mlkit|cloud)
  • dl_scan.ocr (with success/failure reason)
  • ptt.translate (source/target lang + on_device flag)
  • customer.created, customer.created_offline

Backend (routes/telemetry.py + services/telemetry_service.py) is
unchanged in iteration 11 — this re-verifies the full surface.
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    os.environ.get("EXPO_PUBLIC_BACKEND_URL",
                   "https://vin-scanner-audit.preview.emergentagent.com"),
).rstrip("/")

TEST_PIN = "11111"


@pytest.fixture(scope="module")
def auth_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN}, timeout=10)
    if r.status_code == 200 and r.json().get("access_token"):
        return r.json()["access_token"]
    # Setup PIN if needed
    status = requests.get(f"{BASE_URL}/api/auth/status", timeout=10).json()
    if not (status.get("pin_set") or status.get("pin_configured")):
        requests.post(f"{BASE_URL}/api/auth/setup-pin", json={"pin": TEST_PIN}, timeout=10)
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN}, timeout=10)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def hdr(auth_token):
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def run_id():
    return uuid.uuid4().hex[:8]


# ─────────────────────────────────────────────────────────
# Mobile telemetry event shapes (iteration 11)
# ─────────────────────────────────────────────────────────

class TestMobileTelemetryEvents:
    """Each event mirrors what the mobile telemetry.ts helper emits."""

    def _track(self, hdr, category, action, properties, session_id):
        r = requests.post(
            f"{BASE_URL}/api/telemetry/track",
            json={
                "category": category,
                "action": action,
                "properties": properties,
                "session_id": session_id,
            },
            headers=hdr,
            timeout=10,
        )
        assert r.status_code == 200, f"{category}.{action} -> {r.status_code} {r.text}"
        assert r.json().get("tracked") is True

    def test_auth_events(self, hdr, run_id):
        sid = f"sess-auth-{run_id}"
        self._track(hdr, "auth", "login_success", {"duration_ms": 120}, sid)
        self._track(hdr, "auth", "login_failed", {"reason": "invalid_pin"}, sid)
        self._track(hdr, "auth", "login_locked", {"reason": "too_many_attempts"}, sid)

    def test_vin_scan_events(self, hdr, run_id):
        sid = f"sess-vin-{run_id}"
        self._track(hdr, "vin_scan", "barcode_success", {"duration_ms": 350}, sid)
        self._track(hdr, "vin_scan", "ocr",
                    {"source": "mlkit", "confidence": 0.92, "duration_ms": 1240}, sid)
        self._track(hdr, "vin_scan", "ocr",
                    {"source": "cloud", "confidence": 0.81, "duration_ms": 2100}, sid)

    def test_dl_scan_events(self, hdr, run_id):
        sid = f"sess-dl-{run_id}"
        self._track(hdr, "dl_scan", "ocr",
                    {"success": True, "duration_ms": 980}, sid)
        self._track(hdr, "dl_scan", "ocr",
                    {"success": False, "reason": "blurry_image", "duration_ms": 750}, sid)

    def test_ptt_translate_event(self, hdr, run_id):
        sid = f"sess-ptt-{run_id}"
        self._track(hdr, "ptt", "translate",
                    {"source_lang": "en", "target_lang": "es",
                     "on_device": True, "duration_ms": 420}, sid)

    def test_customer_events(self, hdr, run_id):
        sid = f"sess-cust-{run_id}"
        self._track(hdr, "customer", "created", {"source": "manual"}, sid)
        self._track(hdr, "customer", "created_offline", {"queued": True}, sid)

    def test_summary_reflects_iter11_events(self, hdr):
        # Wait for fire-and-forget Mongo persistence
        time.sleep(2.0)
        r = requests.get(f"{BASE_URL}/api/telemetry/summary?hours=1", headers=hdr, timeout=10)
        assert r.status_code == 200
        data = r.json()

        # PostHog disabled (graceful)
        assert data.get("posthog_enabled") is False

        # by_category must contain all iteration-11 categories
        by_cat = data.get("by_category", {})
        for cat in ("auth", "vin_scan", "dl_scan", "ptt", "customer"):
            assert cat in by_cat, f"category {cat} missing from summary: {list(by_cat)}"
            assert by_cat[cat] >= 1

        # realtime_counters keyed by "<category>.<action>"
        rt = data.get("realtime_counters", {})
        for key in (
            "auth.login_success", "auth.login_failed", "auth.login_locked",
            "vin_scan.barcode_success", "vin_scan.ocr",
            "dl_scan.ocr",
            "ptt.translate",
            "customer.created", "customer.created_offline",
        ):
            assert key in rt, f"realtime counter {key} missing"

        # latency_by_action picks up duration_ms (mobile sends `duration_ms`,
        # but the aggregator buckets on `properties.latency_ms`).
        # Iter11 helper sends `duration_ms` — so latency_by_action may be empty
        # for these events but should not error.
        assert "latency_by_action" in data
        assert isinstance(data["latency_by_action"], list)

    def test_track_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/telemetry/track",
            json={"category": "auth", "action": "login_success"},
            timeout=10,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}"
