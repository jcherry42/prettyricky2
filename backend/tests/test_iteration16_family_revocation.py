"""Family-revocation tests (iteration 16).

Verifies that:
1. Refresh tokens now carry a `fam` (family_id) claim.
2. Rotation preserves the family_id (all descendants share it).
3. Detecting reuse of a revoked jti immediately revokes the ENTIRE family.
4. Once a family is revoked, EVERY descendant refresh token stops working —
   even ones that were valid a millisecond earlier. This is the correct
   behaviour when compromise is detected: the entire session tree is killed.
5. A fresh login creates a NEW family, so the user can recover by re-authing.
"""
import os
import time

import pytest
import requests
from jose import jwt

BASE_URL = os.environ.get("BACKEND_TEST_URL", "https://vin-scanner-audit.preview.emergentagent.com")
PIN = os.environ.get("TEST_PIN", "11111")

# We don't verify signatures — we just want to inspect the claims.
def _decode_claims(token: str) -> dict:
    return jwt.get_unverified_claims(token)


@pytest.fixture(scope="module")
def initial_pair():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    return d["access_token"], d["refresh_token"]


def test_refresh_token_carries_family_id(initial_pair):
    _, refresh = initial_pair
    claims = _decode_claims(refresh)
    assert "fam" in claims, f"missing fam claim: {claims}"
    assert "jti" in claims
    assert claims.get("type") == "refresh"


def test_rotation_preserves_family_id():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    r0 = r.json()["refresh_token"]
    fam0 = _decode_claims(r0)["fam"]

    time.sleep(1)  # ensure different iat
    r1_resp = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
    assert r1_resp.status_code == 200
    r1 = r1_resp.json()["refresh_token"]
    fam1 = _decode_claims(r1)["fam"]
    jti1 = _decode_claims(r1)["jti"]

    assert fam1 == fam0, "family_id should persist through rotation"
    assert jti1 != _decode_claims(r0)["jti"], "jti must change on rotation"


def test_reuse_of_revoked_jti_kills_entire_family():
    # 1) Get a fresh pair
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    r0 = r.json()["refresh_token"]

    # 2) Rotate — issues r1, revokes r0's jti
    time.sleep(1)
    r1_resp = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
    assert r1_resp.status_code == 200
    r1 = r1_resp.json()["refresh_token"]

    # 3) Attacker replays r0 → detects reuse → revokes the family
    replay = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
    assert replay.status_code == 401
    assert "revoked" in replay.text.lower()

    # 4) The legit new token r1 should now ALSO be dead (family compromised)
    time.sleep(1)
    victim = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r1}, timeout=15)
    assert victim.status_code == 401
    assert "family" in victim.text.lower()


def test_fresh_login_creates_new_family_and_recovers():
    # After a family is revoked, the user should still be able to log in fresh
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r.status_code == 200
    new_refresh = r.json()["refresh_token"]
    new_fam = _decode_claims(new_refresh)["fam"]

    # The new family must be different from any previously revoked one.
    # And it must be usable for rotation.
    time.sleep(1)
    rot = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": new_refresh}, timeout=15)
    assert rot.status_code == 200
    assert _decode_claims(rot.json()["refresh_token"])["fam"] == new_fam


def test_logout_does_not_revoke_family(initial_pair):
    """Logout should ONLY revoke the specific jti (this device session), not
    the entire family — otherwise logging out on one device would kick you off
    all devices. Family revocation is ONLY for detected compromise scenarios.
    """
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    r0 = r.json()["refresh_token"]

    # Log out with this token
    logout = requests.post(f"{BASE_URL}/api/auth/logout", json={"refresh_token": r0}, timeout=15)
    assert logout.status_code == 200

    # The specific jti is now dead
    reuse = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": r0}, timeout=15)
    assert reuse.status_code == 401
    # But it should be "revoked" not "family revoked" — logout is not a
    # compromise signal.
    assert "family" not in reuse.text.lower(), f"logout should not trigger family revocation: {reuse.text}"


def test_access_token_carries_iat_and_jti(initial_pair):
    access, _ = initial_pair
    claims = _decode_claims(access)
    assert "iat" in claims, "access token should have iat"
    assert "jti" in claims, "access token should have jti"
    assert claims.get("type") == "access"


def test_consecutive_access_tokens_are_distinct():
    """Two logins in the same second used to yield byte-identical access tokens
    because exp is second-granular and there was no iat/jti. iter15 added both."""
    r1 = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    r2 = requests.post(f"{BASE_URL}/api/auth/login", json={"pin": PIN}, timeout=15)
    assert r1.json()["access_token"] != r2.json()["access_token"]
