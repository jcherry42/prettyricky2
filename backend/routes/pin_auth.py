"""PIN Authentication Routes.
5-digit PIN login with JWT access/refresh tokens.
PIN stored as bcrypt hash. Tokens managed via python-jose.

Reset protocol:
  - A one-time 8-char Master Reset Code is generated and stored (hashed)
    when the PIN is first configured. It is returned ONCE in the setup response
    and never retrievable again — the user must save it.
  - POST /auth/reset-pin accepts { reset_code } to wipe the PIN record,
    returning the app to setup mode.
  - Login tracks failed attempts; 5 consecutive failures triggers a 30-second lockout.

Refresh-token security:
  - Every refresh token includes a unique `jti` (JWT ID) claim.
  - On refresh, the OLD jti is added to a `revoked_tokens` denylist with TTL = remaining exp.
    A new refresh token (with a new jti) is issued. This is the "rotation" pattern —
    if a stolen refresh token is used after the legit owner refreshes, it's already revoked.
  - POST /auth/logout revokes the supplied refresh token immediately.
  - Refresh attempts with a revoked or replayed jti return 401.
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta, timezone
import uuid
import secrets
import logging

from security.auth import create_access_token, verify_token, hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None

# Refresh token lifetime: 30 days
REFRESH_TOKEN_DAYS = 30
# Brute-force: lock after this many consecutive bad attempts
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_SECONDS = 30


def init_pin_auth_routes(db):
    global _db
    _db = db
    # Schedule the TTL index creation on the running event loop
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(_ensure_revoked_tokens_ttl())
        else:
            loop.run_until_complete(_ensure_revoked_tokens_ttl())
    except Exception as e:
        logger.debug(f"revoked_tokens TTL setup deferred: {e}")


# --- Request / Response Models ---

class SetupPinRequest(BaseModel):
    pin: str = Field(..., min_length=5, max_length=5, pattern=r'^\d{5}$')

class LoginRequest(BaseModel):
    pin: str = Field(..., min_length=5, max_length=5)

class RefreshRequest(BaseModel):
    refresh_token: str

class ChangePinRequest(BaseModel):
    current_pin: str = Field(..., min_length=5, max_length=5)
    new_pin: str = Field(..., min_length=5, max_length=5, pattern=r'^\d{5}$')

class ResetPinRequest(BaseModel):
    reset_code: str = Field(..., min_length=6, max_length=20,
                            description="The one-time Master Reset Code shown at PIN setup")

class EmergencyResetRequest(BaseModel):
    override_code: str = Field(..., min_length=8, max_length=32,
                               description="The server-side Emergency Override Code from the backend .env")


# --- Helpers ---

def _create_token_pair(user_id: str, family_id: Optional[str] = None):
    """Create access + refresh token pair. The refresh token includes a unique `jti`
    so it can be individually revoked (rotation + logout). Access tokens do NOT
    carry a jti — they're short-lived (15 min) so revocation costs more than it saves.

    `family_id` groups all refresh tokens descended from a single login. On rotation,
    the family_id is preserved. On detection of a reused (revoked) jti, we mark the
    entire family as compromised in `revoked_families` and reject all future refreshes
    for that family — forcing the (likely compromised) user to re-authenticate.
    """
    if family_id is None:
        family_id = str(uuid.uuid4())
    access = create_access_token(
        data={"sub": user_id, "type": "access"},
        expires_delta=timedelta(minutes=15),
    )
    refresh_jti = str(uuid.uuid4())
    refresh = create_access_token(
        data={"sub": user_id, "type": "refresh", "jti": refresh_jti, "fam": family_id},
        expires_delta=timedelta(days=REFRESH_TOKEN_DAYS),
    )
    return access, refresh


async def _is_family_revoked(family_id: str) -> bool:
    """Return True if this refresh-token family has been marked compromised."""
    if not family_id:
        return False
    found = await _db.revoked_families.find_one({"family_id": family_id})
    return found is not None


async def _revoke_family(family_id: str, user_id: str, reason: str = "token_reuse"):
    """Mark an entire refresh-token family as compromised. All descendants (past
    and future) become unusable. TTL matches max refresh-token lifetime.
    """
    if not family_id:
        return
    try:
        expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS + 1)
        await _db.revoked_families.update_one(
            {"family_id": family_id},
            {"$set": {
                "family_id": family_id,
                "user_id": user_id,
                "reason": reason,
                "revoked_at": datetime.now(timezone.utc),
                "expires_at": expires_at,
            }},
            upsert=True,
        )
        logger.warning(f"Family revoked (family={family_id}, user={user_id}, reason={reason})")
    except Exception as e:
        logger.error(f"Failed to revoke family {family_id}: {e}")


async def _is_jti_revoked(jti: str) -> bool:
    """Return True if this refresh-token jti has been revoked (logout or rotation)."""
    if not jti:
        return False
    found = await _db.revoked_tokens.find_one({"jti": jti})
    return found is not None


async def _revoke_jti(jti: str, exp_timestamp: Optional[int] = None):
    """Add a refresh-token jti to the denylist. MongoDB TTL index on `expires_at`
    auto-cleans entries after the token would have naturally expired anyway.
    """
    if not jti:
        return
    # Use the token's `exp` as the cleanup timestamp; fall back to "now + 30 days" if unknown
    if exp_timestamp:
        expires_at = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
    else:
        expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS)
    try:
        await _db.revoked_tokens.update_one(
            {"jti": jti},
            {"$set": {"jti": jti, "revoked_at": datetime.now(timezone.utc), "expires_at": expires_at}},
            upsert=True,
        )
    except Exception as e:
        logger.warning(f"Failed to revoke jti {jti}: {e}")


async def _ensure_revoked_tokens_ttl():
    """Idempotent: create the TTL index on `expires_at` so MongoDB auto-cleans the denylist."""
    try:
        await _db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)
        await _db.revoked_tokens.create_index("jti", unique=True)
        await _db.revoked_families.create_index("expires_at", expireAfterSeconds=0)
        await _db.revoked_families.create_index("family_id", unique=True)
    except Exception as e:
        logger.debug(f"revoked_tokens index init: {e}")


def _generate_reset_code() -> str:
    """Generate a human-readable 8-char reset code (uppercase alphanumeric, no ambiguous chars)."""
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no I, O, 0, 1
    return ''.join(secrets.choice(alphabet) for _ in range(8))


async def _get_pin_record():
    return await _db.auth.find_one({"type": "pin"})


def _is_locked_out(record: dict) -> tuple[bool, int]:
    """Returns (is_locked, seconds_remaining). Lock triggers after MAX_FAILED_ATTEMPTS."""
    failed = record.get("failed_attempts", 0)
    locked_until = record.get("locked_until")
    if failed >= MAX_FAILED_ATTEMPTS and locked_until:
        now = datetime.now(timezone.utc)
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if now < locked_until:
            remaining = int((locked_until - now).total_seconds()) + 1
            return True, remaining
    return False, 0


# --- Endpoints ---

@router.get("/auth/status")
async def auth_status():
    """Check if a PIN has been configured."""
    record = await _get_pin_record()
    return {"pin_set": record is not None}


@router.post("/auth/setup-pin")
async def setup_pin(request: SetupPinRequest):
    """First-time PIN setup. Creates the dealership PIN and returns a one-time Master Reset Code."""
    if not request.pin.isdigit() or len(request.pin) != 5:
        raise HTTPException(status_code=400, detail="PIN must be exactly 5 digits")

    existing = await _get_pin_record()
    if existing:
        raise HTTPException(status_code=409, detail="PIN already configured. Use /auth/change-pin.")

    user_id = str(uuid.uuid4())
    pin_hash = hash_password(request.pin)

    # Generate a one-time master reset code — shown once, then only stored as a hash
    reset_code = _generate_reset_code()
    reset_code_hash = hash_password(reset_code)

    await _db.auth.insert_one({
        "type": "pin",
        "user_id": user_id,
        "pin_hash": pin_hash,
        "reset_code_hash": reset_code_hash,
        "failed_attempts": 0,
        "locked_until": None,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })

    access, refresh = _create_token_pair(user_id)
    logger.info(f"PIN configured for user {user_id}")

    return {
        "success": True,
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": 900,
        # ⚠️ Returned ONCE — client must display and prompt user to save it
        "reset_code": reset_code,
    }


@router.post("/auth/login")
async def login(request: LoginRequest):
    """Verify PIN and return token pair. Tracks failed attempts; locks after 5 consecutive failures."""
    record = await _get_pin_record()
    if not record:
        raise HTTPException(status_code=404, detail="No PIN configured. Set up a PIN first.")

    # Check lockout
    locked, seconds_left = _is_locked_out(record)
    if locked:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {seconds_left} seconds.",
            headers={"Retry-After": str(seconds_left)},
        )

    if not verify_password(request.pin, record["pin_hash"]):
        # Increment failure count
        new_failed = record.get("failed_attempts", 0) + 1
        update = {"failed_attempts": new_failed}
        if new_failed >= MAX_FAILED_ATTEMPTS:
            update["locked_until"] = datetime.now(timezone.utc) + timedelta(seconds=LOCKOUT_SECONDS)
            logger.warning(f"PIN locked for {LOCKOUT_SECONDS}s after {new_failed} failed attempts")
        await _db.auth.update_one({"type": "pin"}, {"$set": update})

        remaining = MAX_FAILED_ATTEMPTS - new_failed
        detail = "Invalid PIN"
        if new_failed >= MAX_FAILED_ATTEMPTS:
            detail = f"Too many failed attempts. Locked for {LOCKOUT_SECONDS} seconds."
        elif remaining == 1:
            detail = "Invalid PIN. 1 attempt remaining before lockout."
        elif remaining > 1:
            detail = f"Invalid PIN. {remaining} attempts remaining."

        logger.warning(f"Invalid PIN attempt #{new_failed}")
        raise HTTPException(status_code=401, detail=detail)

    # Success — reset failure counter
    user_id = record["user_id"]
    access, refresh = _create_token_pair(user_id)
    await _db.auth.update_one(
        {"type": "pin"},
        {"$set": {"last_login": datetime.now(timezone.utc), "failed_attempts": 0, "locked_until": None}}
    )

    return {
        "success": True,
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": 900,
    }


@router.post("/auth/reset-pin")
async def reset_pin(request: ResetPinRequest):
    """
    Wipe the PIN using the one-time Master Reset Code.
    On success, the PIN record is deleted and the app returns to setup mode.
    The reset code is single-use — a new one is issued on next setup.
    """
    record = await _get_pin_record()
    if not record:
        raise HTTPException(status_code=404, detail="No PIN configured.")

    reset_code_hash = record.get("reset_code_hash")
    if not reset_code_hash:
        raise HTTPException(
            status_code=503,
            detail="No reset code was stored for this account. Contact your system administrator.",
        )

    if not verify_password(request.reset_code.upper().strip(), reset_code_hash):
        logger.warning("Invalid PIN reset code attempt")
        raise HTTPException(status_code=401, detail="Invalid reset code.")

    # Wipe the entire PIN record — next app launch will trigger setup
    await _db.auth.delete_one({"type": "pin"})
    logger.info(f"PIN reset for user {record['user_id']} via master reset code")

    return {
        "success": True,
        "message": "PIN has been reset. Please set up a new PIN.",
        "needs_setup": True,
    }


@router.post("/auth/factory-reset")
async def factory_reset():
    """
    Tier-3 recovery: wipe the PIN record entirely.
    No credentials required — possession of the device is the implicit auth.
    The frontend enforces a typed confirmation before calling this.
    Customers, vehicles, and all business data are preserved.
    """
    record = await _get_pin_record()
    if record:
        await _db.auth.delete_one({"type": "pin"})
        logger.warning(f"Factory reset — PIN wiped for user {record.get('user_id')}. All business data preserved.")
    return {
        "success": True,
        "message": "App has been reset. Please set up a new PIN.",
        "needs_setup": True,
    }


@router.post("/auth/emergency-reset")
async def emergency_reset(request: EmergencyResetRequest):
    """Deprecated — replaced by /auth/factory-reset. Kept for backwards compatibility."""
    raise HTTPException(
        status_code=410,
        detail="Emergency override removed. Use /auth/factory-reset instead.",
    )


@router.post("/auth/refresh")
async def refresh_token(request: RefreshRequest):
    """Exchange a valid refresh token for a NEW token pair.

    Rotation:
      - The supplied refresh token's `jti` is checked against the denylist.
      - If valid + not revoked, the OLD jti is revoked immediately.
      - A fresh access token + fresh refresh token (new jti) are returned.

    This means a stolen refresh token gets invalidated the moment the legit owner
    refreshes — they can use it at most once.
    """
    try:
        payload = verify_token(request.refresh_token)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Malformed token")

    jti = payload.get("jti")
    family_id = payload.get("fam")

    # Family revocation check — if this family is marked compromised, deny
    # every descendant regardless of individual jti state.
    if family_id and await _is_family_revoked(family_id):
        logger.warning(f"Refresh attempt on revoked family (family={family_id}, user={user_id})")
        raise HTTPException(status_code=401, detail="Refresh token family has been revoked. Please log in again.")

    if jti and await _is_jti_revoked(jti):
        # Reuse of a revoked token = strong signal of theft. Nuke the entire family.
        logger.warning(f"Revoked refresh token reused (jti={jti}, user={user_id}) — REVOKING FAMILY {family_id}")
        if family_id:
            await _revoke_family(family_id, user_id, reason="token_reuse")
        raise HTTPException(status_code=401, detail="Refresh token has been revoked. Please log in again.")

    # Rotate: revoke the OLD jti, issue a new pair carrying the SAME family_id.
    if jti:
        await _revoke_jti(jti, exp_timestamp=payload.get("exp"))

    new_access, new_refresh = _create_token_pair(user_id, family_id=family_id)

    return {
        "success": True,
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "expires_in": 900,
    }


@router.post("/auth/logout")
async def logout(request: RefreshRequest):
    """Revoke the supplied refresh token so it can never be used again.

    The client should also clear its local SecureStore copies of both tokens.
    Access tokens aren't revoked server-side because they're short-lived (15 min),
    but discarding them client-side is enough for practical purposes.
    """
    try:
        payload = verify_token(request.refresh_token)
    except HTTPException:
        # Even on invalid token, return 200 — logout should be idempotent and not
        # leak information about token validity.
        return {"success": True, "revoked": False}

    if payload.get("type") != "refresh":
        return {"success": True, "revoked": False}

    jti = payload.get("jti")
    if jti:
        await _revoke_jti(jti, exp_timestamp=payload.get("exp"))
        logger.info(f"Refresh token revoked via logout (user={payload.get('sub')})")
        return {"success": True, "revoked": True}

    # Legacy refresh tokens without jti can't be individually revoked.
    return {"success": True, "revoked": False, "warning": "Legacy token without jti"}


@router.get("/auth/verify")
async def verify_current_token(authorization: Optional[str] = Header(None)):
    """Verify the current access token is valid."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")

    token = authorization.split(" ", 1)[1]
    try:
        payload = verify_token(token)
        return {
            "valid": True,
            "user_id": payload.get("sub"),
            "type": payload.get("type"),
            "expires": payload.get("exp"),
        }
    except HTTPException:
        return {"valid": False}


@router.post("/auth/change-pin")
async def change_pin(request: ChangePinRequest, authorization: Optional[str] = Header(None)):
    """Change PIN (requires current PIN verification)."""
    if not request.new_pin.isdigit() or len(request.new_pin) != 5:
        raise HTTPException(status_code=400, detail="New PIN must be exactly 5 digits")

    record = await _get_pin_record()
    if not record:
        raise HTTPException(status_code=404, detail="No PIN configured")

    if not verify_password(request.current_pin, record["pin_hash"]):
        raise HTTPException(status_code=401, detail="Current PIN is incorrect")

    new_hash = hash_password(request.new_pin)
    await _db.auth.update_one(
        {"type": "pin"},
        {"$set": {"pin_hash": new_hash, "updated_at": datetime.now(timezone.utc), "failed_attempts": 0, "locked_until": None}}
    )

    logger.info(f"PIN changed for user {record['user_id']}")
    return {"success": True, "message": "PIN updated successfully"}

