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
"""
from fastapi import APIRouter, HTTPException, Depends, Header
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


# --- Helpers ---

def _create_token_pair(user_id: str):
    """Create access + refresh token pair."""
    access = create_access_token(
        data={"sub": user_id, "type": "access"},
        expires_delta=timedelta(minutes=15),
    )
    refresh = create_access_token(
        data={"sub": user_id, "type": "refresh"},
        expires_delta=timedelta(days=REFRESH_TOKEN_DAYS),
    )
    return access, refresh


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
            detail = f"Invalid PIN. 1 attempt remaining before lockout."
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


@router.post("/auth/refresh")
async def refresh_token(request: RefreshRequest):
    """Exchange a valid refresh token for a new access token."""
    try:
        payload = verify_token(request.refresh_token)
    except HTTPException:
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Malformed token")

    access = create_access_token(
        data={"sub": user_id, "type": "access"},
        expires_delta=timedelta(minutes=15),
    )

    return {
        "success": True,
        "access_token": access,
        "token_type": "bearer",
        "expires_in": 900,
    }


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

