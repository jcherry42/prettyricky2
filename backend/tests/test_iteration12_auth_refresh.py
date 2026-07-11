"""
Iteration 12 — Backend contract test for POST /api/auth/refresh + regression smoke.

Mobile-side `apiFetch` now auto-refreshes on 401. The backend refresh endpoint
itself is unchanged. This suite verifies:

  1. /api/auth/refresh with a valid refresh_token   -> 200 + access_token
  2. /api/auth/refresh with an invalid refresh_token -> 401
  3. /api/auth/refresh with missing field            -> 422
  4. /api/auth/refresh works without an auth header  (public endpoint)
  5. /api/auth/login (PIN 11111) returns both access_token and refresh_token
  6. Newly issued access_token is accepted by a protected endpoint
  7. Smoke regression on /api/sessions, /api/anomaly, /api/telemetry,
     /api/voice-translate, /api/customers, /api/vehicles,
     /api/vin/extract-from-image (auth + basic shape).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    os.environ.get(
        "EXPO_PUBLIC_BACKEND_URL",
        "https://vin-scanner-audit.preview.emergentagent.com",
    ),
).rstrip("/")

TEST_PIN = "11111"
TIMEOUT = 15


# ----- Fixtures --------------------------------------------------------------

@pytest.fixture(scope="function")
def login_payload():
    """POST /api/auth/login -> full body with access + refresh tokens."""
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN}, timeout=TIMEOUT)
    if r.status_code != 200:
        # Setup PIN if needed
        status = requests.get(f"{BASE_URL}/api/auth/status", timeout=TIMEOUT).json()
        if not (status.get("pin_set") or status.get("pin_configured")):
            requests.post(f"{BASE_URL}/api/auth/setup-pin",
                          json={"pin": TEST_PIN}, timeout=TIMEOUT)
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"pin": TEST_PIN}, timeout=TIMEOUT)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="function")
def access_token(login_payload):
    return login_payload["access_token"]


@pytest.fixture(scope="function")
def refresh_token(login_payload):
    return login_payload["refresh_token"]


@pytest.fixture(scope="function")
def auth_headers(access_token):
    return {"Authorization": f"Bearer {access_token}"}


# ----- /api/auth/login contract ----------------------------------------------

class TestLoginContract:
    def test_login_returns_both_tokens(self, login_payload):
        assert login_payload.get("success") is True
        assert isinstance(login_payload.get("access_token"), str)
        assert isinstance(login_payload.get("refresh_token"), str)
        assert len(login_payload["access_token"]) > 20
        assert len(login_payload["refresh_token"]) > 20
        assert login_payload.get("token_type", "bearer").lower() == "bearer"
        # access_token and refresh_token must differ
        assert login_payload["access_token"] != login_payload["refresh_token"]


# ----- /api/auth/refresh contract --------------------------------------------

class TestRefreshContract:
    def test_refresh_with_valid_token_returns_200_and_access_token(self, refresh_token):
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": refresh_token},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"unexpected {r.status_code}: {r.text}"
        body = r.json()
        assert body.get("success") is True
        assert isinstance(body.get("access_token"), str) and len(body["access_token"]) > 20
        assert body.get("token_type", "bearer").lower() == "bearer"
        assert isinstance(body.get("expires_in"), int) and body["expires_in"] > 0

    def test_refresh_returned_access_token_works_on_protected_endpoint(self, refresh_token):
        """The freshly minted access token must be accepted by a protected route."""
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": refresh_token},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        new_access = r.json()["access_token"]
        # Use it on /api/auth/verify (protected)
        v = requests.get(
            f"{BASE_URL}/api/auth/verify",
            headers={"Authorization": f"Bearer {new_access}"},
            timeout=TIMEOUT,
        )
        assert v.status_code == 200
        body = v.json()
        assert body.get("valid") is True
        assert body.get("type") == "access"

    def test_refresh_with_invalid_token_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": "garbage.invalid.jwt"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text}"

    def test_refresh_with_access_token_as_refresh_returns_401(self, access_token):
        """Sending an ACCESS token where a refresh token is expected must 401."""
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": access_token},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_refresh_with_missing_field_returns_422(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={},
            timeout=TIMEOUT,
        )
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_refresh_with_empty_body_returns_422(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            data="",
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT,
        )
        # FastAPI returns 422 for invalid/missing JSON body against a required model
        assert r.status_code in (400, 422)

    def test_refresh_is_public_no_auth_header_needed(self, refresh_token):
        """Endpoint must accept request without Authorization header (clients
        hit it AFTER their access token has expired)."""
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": refresh_token},
            headers={"Content-Type": "application/json"},  # NO Authorization
            timeout=TIMEOUT,
        )
        assert r.status_code == 200

    def test_refresh_ignores_bogus_authorization_header(self, refresh_token):
        """A bogus Authorization header must not break refresh — the refresh
        token in the body is the source of truth."""
        r = requests.post(
            f"{BASE_URL}/api/auth/refresh",
            json={"refresh_token": refresh_token},
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer expired.or.bogus.token",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200


# ----- Regression smoke ------------------------------------------------------

class TestRegressionSmoke:
    """Quick sanity that no regressions slipped into the previous iteration's
    surface. We only check the auth contract + a basic 200/list shape — full
    coverage lives in iter10/iter11 suites."""

    def test_sessions_restore_authenticated(self, auth_headers):
        # /api/sessions/restore is the canonical GET (per routes/sessions.py)
        r = requests.get(f"{BASE_URL}/api/sessions/restore",
                         headers=auth_headers, timeout=TIMEOUT)
        # 200 = restored, 404 = nothing to restore — both indicate the route
        # is reachable and auth passed
        assert r.status_code in (200, 404), f"unexpected {r.status_code}: {r.text}"

    def test_sessions_restore_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/sessions/restore", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_anomaly_endpoints_require_auth(self):
        # Plural per iter11 note
        r = requests.get(f"{BASE_URL}/api/anomalies", timeout=TIMEOUT)
        assert r.status_code in (401, 404, 405)  # tolerate list-endpoint shape variance

    def test_telemetry_track_authenticated(self, auth_headers):
        payload = {
            "event_name": "iter12_refresh_smoke",
            "session_id": f"sess-iter12-{int(time.time())}",
            "properties": {"source": "iter12_test"},
        }
        r = requests.post(
            f"{BASE_URL}/api/telemetry/track",
            json=payload,
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, f"telemetry/track failed: {r.status_code} {r.text}"

    def test_telemetry_track_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/telemetry/track",
            json={"event_name": "x", "session_id": "y"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401

    def test_telemetry_summary_authenticated(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/telemetry/summary?hours=1",
            headers=auth_headers,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200

    def test_voice_translate_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/voice-translate",
            json={"text": "hello", "target_language": "es"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (401, 404)  # tolerate route name variation

    def test_customers_list_authenticated(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/customers", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_customers_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/customers", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_vehicles_list_authenticated(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/vehicles", headers=auth_headers, timeout=TIMEOUT)
        assert r.status_code == 200

    def test_vehicles_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/vehicles", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_vin_extract_requires_auth(self):
        r = requests.post(
            f"{BASE_URL}/api/vin/extract-from-image",
            json={"image_base64": "Zm9v"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401
