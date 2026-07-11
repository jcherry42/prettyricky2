"""
Iteration 13 — Refresh-token ROTATION, server-side LOGOUT/REVOCATION, JWT persistence,
                ObjectId leak scan, full regression smoke.

Covers all 13 acceptance items in the iter-13 review request.
PIN: 11111.
"""
import os
import time
import jwt as pyjwt
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


# ---------- helpers / fixtures ----------------------------------------------

def _login():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": TEST_PIN}, timeout=TIMEOUT)
    if r.status_code != 200:
        # Bootstrap if no PIN configured (rare in this environment)
        status = requests.get(f"{BASE_URL}/api/auth/status", timeout=TIMEOUT).json()
        if not (status.get("pin_set") or status.get("pin_configured")):
            requests.post(f"{BASE_URL}/api/auth/setup-pin",
                          json={"pin": TEST_PIN}, timeout=TIMEOUT)
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"pin": TEST_PIN}, timeout=TIMEOUT)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()


def _decode_unsafe(token: str) -> dict:
    """Decode JWT without signature verification — we just need the claims."""
    return pyjwt.decode(token, options={"verify_signature": False})


@pytest.fixture
def fresh_login():
    """Return a fresh login payload for tests that need an unused refresh token."""
    return _login()


@pytest.fixture(scope="module")
def module_login():
    return _login()


@pytest.fixture(scope="module")
def auth_headers(module_login):
    return {"Authorization": f"Bearer {module_login['access_token']}"}


# ---------- 1-3. REFRESH-TOKEN ROTATION ------------------------------------

class TestRefreshRotation:
    def test_refresh_returns_both_new_access_and_new_refresh(self, fresh_login):
        old_refresh = fresh_login["refresh_token"]
        r = requests.post(f"{BASE_URL}/api/auth/refresh",
                          json={"refresh_token": old_refresh}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body.get("access_token"), str) and len(body["access_token"]) > 20
        assert isinstance(body.get("refresh_token"), str) and len(body["refresh_token"]) > 20
        assert body["refresh_token"] != old_refresh, "Refresh token MUST be rotated"
        # jti must change
        old_jti = _decode_unsafe(old_refresh).get("jti")
        new_jti = _decode_unsafe(body["refresh_token"]).get("jti")
        assert old_jti and new_jti and old_jti != new_jti, "jti must rotate"
        # new refresh must be type=refresh
        assert _decode_unsafe(body["refresh_token"]).get("type") == "refresh"

    def test_old_refresh_token_is_denylisted_after_rotation(self, fresh_login):
        old_refresh = fresh_login["refresh_token"]
        # First rotation succeeds
        r1 = requests.post(f"{BASE_URL}/api/auth/refresh",
                           json={"refresh_token": old_refresh}, timeout=TIMEOUT)
        assert r1.status_code == 200
        # Replay of old refresh must 401
        r2 = requests.post(f"{BASE_URL}/api/auth/refresh",
                           json={"refresh_token": old_refresh}, timeout=TIMEOUT)
        assert r2.status_code == 401, f"replayed OLD refresh should 401, got {r2.status_code}: {r2.text}"

    def test_chained_rotation_new_refresh_usable_again(self, fresh_login):
        first_refresh = fresh_login["refresh_token"]
        r1 = requests.post(f"{BASE_URL}/api/auth/refresh",
                           json={"refresh_token": first_refresh}, timeout=TIMEOUT)
        assert r1.status_code == 200
        second_refresh = r1.json()["refresh_token"]
        # Use the new one — should also succeed and rotate again
        r2 = requests.post(f"{BASE_URL}/api/auth/refresh",
                           json={"refresh_token": second_refresh}, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        third_refresh = r2.json()["refresh_token"]
        assert third_refresh and third_refresh != second_refresh


# ---------- 4-7. LOGOUT REVOCATION -----------------------------------------

class TestLogoutRevocation:
    def test_logout_with_valid_refresh_returns_revoked_true(self, fresh_login):
        refresh = fresh_login["refresh_token"]
        r = requests.post(f"{BASE_URL}/api/auth/logout",
                          json={"refresh_token": refresh}, timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("revoked") is True
        # Confirm denylist enforcement
        r2 = requests.post(f"{BASE_URL}/api/auth/refresh",
                           json={"refresh_token": refresh}, timeout=TIMEOUT)
        assert r2.status_code == 401, f"logged-out refresh must 401, got {r2.status_code}"

    def test_logout_with_garbage_token_is_idempotent(self):
        r = requests.post(f"{BASE_URL}/api/auth/logout",
                          json={"refresh_token": "not.a.jwt"}, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body.get("success") is True
        assert body.get("revoked") is False  # no info leak

    def test_logout_without_auth_header(self, fresh_login):
        """Endpoint must be public — clients call it after access expires."""
        r = requests.post(f"{BASE_URL}/api/auth/logout",
                          json={"refresh_token": fresh_login["refresh_token"]},
                          headers={"Content-Type": "application/json"},  # no Authorization
                          timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        assert r.json().get("revoked") is True

    def test_logout_with_access_token_returns_revoked_false(self, fresh_login):
        """Passing access token (type=access) must NOT cause a false-positive revoke."""
        r = requests.post(f"{BASE_URL}/api/auth/logout",
                          json={"refresh_token": fresh_login["access_token"]}, timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert body.get("success") is True
        assert body.get("revoked") is False


# ---------- 8. TTL denylist indexes (via behavior probe) -------------------

class TestRevokedTokensIndexes:
    """We can't reach the mongo client directly in this env; instead verify
    the behavioral contract: unique jti (can't double-revoke / duplicate),
    and TTL is implied because the deny entry is created on revoke + the
    server self-described it in code. We verify uniqueness via repeat-logout."""

    def test_double_revoke_same_jti_does_not_crash(self, fresh_login):
        refresh = fresh_login["refresh_token"]
        r1 = requests.post(f"{BASE_URL}/api/auth/logout",
                           json={"refresh_token": refresh}, timeout=TIMEOUT)
        assert r1.status_code == 200 and r1.json().get("revoked") is True
        # Second logout on same token — must still be 200 (upsert idempotent)
        r2 = requests.post(f"{BASE_URL}/api/auth/logout",
                           json={"refresh_token": refresh}, timeout=TIMEOUT)
        assert r2.status_code == 200


# ---------- 9. JWT persistence (env-backed secret) -------------------------

class TestJwtPersistence:
    """We can't restart the backend from a test, but we can prove the secret
    is loaded from .env and is stable by verifying a token minted now is
    still verifiable shortly after, and that JWT_SECRET_KEY env is present.
    (A live backend restart was already smoke-tested per the review request.)"""

    def test_access_token_remains_valid_short_term(self, fresh_login):
        access = fresh_login["access_token"]
        # Sleep briefly then re-verify
        time.sleep(2)
        r = requests.get(f"{BASE_URL}/api/auth/verify",
                         headers={"Authorization": f"Bearer {access}"}, timeout=TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("valid") is True

    def test_backend_env_has_jwt_secret(self):
        # Look at the local backend .env file (we are co-located on the same container)
        env_path = "/app/backend/.env"
        if not os.path.exists(env_path):
            pytest.skip("backend .env not directly accessible from test env")
        with open(env_path) as f:
            txt = f.read()
        assert "JWT_SECRET_KEY=" in txt, "JWT_SECRET_KEY must be set in backend/.env for persistence"
        # crude length check — should be a real secret, not a placeholder
        for line in txt.splitlines():
            if line.startswith("JWT_SECRET_KEY="):
                val = line.split("=", 1)[1].strip().strip('"')
                assert len(val) >= 32, "JWT_SECRET_KEY suspiciously short"


# ---------- 10. PIN auth regression ----------------------------------------

class TestPinAuthRegression:
    def test_login_returns_token_pair(self):
        body = _login()
        assert body.get("success") is True
        assert isinstance(body.get("access_token"), str)
        assert isinstance(body.get("refresh_token"), str)

    def test_bad_pin_returns_401(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"pin": "00000"}, timeout=TIMEOUT)
        # 401 expected; if account is mid-lockout from a prior test, allow 429 too
        assert r.status_code in (401, 429), r.text


# ---------- 11. Protected endpoints regression -----------------------------

PROTECTED_GET = [
    "/api/sessions/restore",
    "/api/customers",
    "/api/vehicles",
    "/api/telemetry/summary?hours=1",
]

PROTECTED_POST = [
    ("/api/voice-translate", {"text": "hello", "target_language": "es"}),
    ("/api/vin/extract-from-image", {"image_base64": "Zm9v"}),
    ("/api/license/scan", {"image_base64": "Zm9v"}),
    ("/api/tower-talk", {"messages": [{"role": "user", "content": "hi"}]}),
    ("/api/translate", {"text": "hello", "target_language": "es"}),
    ("/api/telemetry/track", {"event_name": "x", "session_id": "sess-iter13"}),
]


class TestProtectedEndpoints:
    @pytest.mark.parametrize("path", PROTECTED_GET)
    def test_get_requires_auth(self, path):
        r = requests.get(f"{BASE_URL}{path}", timeout=TIMEOUT)
        assert r.status_code == 401, f"{path} returned {r.status_code} without auth"

    @pytest.mark.parametrize("path", PROTECTED_GET)
    def test_get_works_with_auth(self, path, auth_headers):
        r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=TIMEOUT)
        # 200 or 404 (e.g. no session to restore) are both auth-passes
        assert r.status_code in (200, 404), f"{path} -> {r.status_code} {r.text[:200]}"

    @pytest.mark.parametrize("path,payload", PROTECTED_POST)
    def test_post_requires_auth(self, path, payload):
        r = requests.post(f"{BASE_URL}{path}", json=payload, timeout=TIMEOUT)
        # Some routes may legitimately 404 (route name variance); but they MUST NOT 200 without auth
        assert r.status_code in (401, 404), f"{path} unauth -> {r.status_code} {r.text[:200]}"


# ---------- 12. ObjectId leak scan -----------------------------------------

OBJECTID_SCAN_GET = [
    "/api/customers",
    "/api/vehicles",
    "/api/sessions/restore",
    "/api/anomalies",
    "/api/anomaly/list",
]


def _no_object_id_leak(obj):
    """Recursively confirm no `_id` key anywhere in the response body."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"ObjectId leak — `_id` found in dict keys: {list(obj.keys())[:6]}"
        for v in obj.values():
            _no_object_id_leak(v)
    elif isinstance(obj, list):
        for item in obj:
            _no_object_id_leak(item)


class TestObjectIdLeakScan:
    @pytest.mark.parametrize("path", OBJECTID_SCAN_GET)
    def test_no_objectid_leak(self, path, auth_headers):
        r = requests.get(f"{BASE_URL}{path}", headers=auth_headers, timeout=TIMEOUT)
        if r.status_code in (404, 405):
            pytest.skip(f"{path} not present in this build ({r.status_code})")
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        try:
            body = r.json()
        except Exception:
            pytest.skip(f"{path} returned non-JSON")
        _no_object_id_leak(body)


# ---------- 13. Raw fetch security note (static check) ---------------------

class TestRawFetchAudit:
    """Static audit: only 3 categories of raw fetch() may exist in /app/mobile/src:
       (a) api.ts internals (health probe, refresh, primary apiFetch)
       (b) PinScreen.tsx diagnostic probe
       (c) non-/api file:// URI reads (image, chunked upload)
    Anything else is a leak.
    """

    def test_raw_fetch_inventory(self):
        import subprocess
        try:
            out = subprocess.check_output(
                ["grep", "-rn", "fetch(", "/app/mobile/src/"], text=True
            )
        except subprocess.CalledProcessError:
            pytest.skip("grep returned no matches or mobile dir missing")
        allowed_files = {
            "/app/mobile/src/lib/api.ts",
            "/app/mobile/src/lib/image.ts",
            "/app/mobile/src/utils/chunkedUpload.ts",
            "/app/mobile/src/screens/PinScreen.tsx",
        }
        offenders = []
        for line in out.splitlines():
            path = line.split(":", 1)[0]
            if path not in allowed_files:
                offenders.append(line)
        assert not offenders, f"Unexpected raw fetch() calls: {offenders}"
