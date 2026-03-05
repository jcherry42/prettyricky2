"""PIN Authentication Routes.
5-digit PIN login with JWT access/refresh tokens.
PIN stored as bcrypt hash. Tokens managed via python-jose.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timedelta, timezone
import uuid
import logging

from security.auth import create_access_token, verify_token, hash_password, verify_password

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None

# Refresh token lifetime: 30 days
REFRESH_TOKEN_DAYS = 30


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


async def _get_pin_record():
    return await _db.auth.find_one({"type": "pin"})


# --- Endpoints ---

@router.get("/auth/status")
async def auth_status():
    """Check if a PIN has been configured."""
    record = await _get_pin_record()
    return {"pin_set": record is not None}


@router.post("/auth/setup-pin")
async def setup_pin(request: SetupPinRequest):
    """First-time PIN setup. Creates the dealership PIN."""
    if not request.pin.isdigit() or len(request.pin) != 5:
        raise HTTPException(status_code=400, detail="PIN must be exactly 5 digits")

    existing = await _get_pin_record()
    if existing:
        raise HTTPException(status_code=409, detail="PIN already configured. Use /auth/change-pin.")

    user_id = str(uuid.uuid4())
    pin_hash = hash_password(request.pin)

    await _db.auth.insert_one({
        "type": "pin",
        "user_id": user_id,
        "pin_hash": pin_hash,
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
    }


@router.post("/auth/login")
async def login(request: LoginRequest):
    """Verify PIN and return token pair."""
    record = await _get_pin_record()
    if not record:
        raise HTTPException(status_code=404, detail="No PIN configured. Set up a PIN first.")

    if not verify_password(request.pin, record["pin_hash"]):
        logger.warning("Invalid PIN attempt")
        raise HTTPException(status_code=401, detail="Invalid PIN")

    user_id = record["user_id"]
    access, refresh = _create_token_pair(user_id)

    # Record login
    await _db.auth.update_one(
        {"type": "pin"},
        {"$set": {"last_login": datetime.now(timezone.utc)}}
    )

    return {
        "success": True,
        "access_token": access,
        "refresh_token": refresh,
        "token_type": "bearer",
        "expires_in": 900,
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

    # Issue fresh access token (refresh token stays the same until it expires)
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
        {"$set": {"pin_hash": new_hash, "updated_at": datetime.now(timezone.utc)}}
    )

    logger.info(f"PIN changed for user {record['user_id']}")
    return {"success": True, "message": "PIN updated successfully"}
