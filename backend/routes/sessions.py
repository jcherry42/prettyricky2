"""Session Persistence Routes.

Server-side session backup for dealership resilience:
- POST /api/sessions/save       — Snapshot current session state
- GET  /api/sessions/restore    — Restore last session for authenticated user
- POST /api/sessions/auto-save  — Lightweight debounced auto-save (called every 30s)
- DELETE /api/sessions           — Clear session data

Sessions survive app kills, phone calls, battery deaths, and daily distractions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_sessions_col = None


def init_session_routes(db):
    global _db, _sessions_col
    _db = db
    _sessions_col = db["sessions"]


async def ensure_session_indexes():
    if _sessions_col is None:
        return
    try:
        await _sessions_col.create_index("user_id", unique=True)
        await _sessions_col.create_index(
            "updated_at",
            expireAfterSeconds=7 * 24 * 3600,
            name="ttl_sessions_7d",
        )
        logger.info("Session indexes ensured (7-day TTL)")
    except Exception as e:
        logger.warning(f"Session index creation: {e}")


class SessionSaveRequest(BaseModel):
    """Full session state snapshot from the mobile app."""
    navigation_state: Optional[Dict[str, Any]] = None
    active_customer_id: Optional[str] = None
    active_customer: Optional[Dict[str, Any]] = None
    form_drafts: Optional[Dict[str, Any]] = None
    tower_talk_history: Optional[list] = None
    ptt_last_result: Optional[Dict[str, Any]] = None
    modal_states: Optional[Dict[str, bool]] = None
    search_query: Optional[str] = None
    scroll_positions: Optional[Dict[str, float]] = None
    intake_state: Optional[Dict[str, Any]] = None
    version: int = 1


class SessionAutoSaveRequest(BaseModel):
    """Lightweight auto-save — only the fields that changed."""
    delta: Dict[str, Any]


class SessionResponse(BaseModel):
    success: bool
    session: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    age_seconds: Optional[float] = None


@router.post("/sessions/save", response_model=SessionResponse)
async def save_session(body: SessionSaveRequest, authorization: str = ""):
    """Full session snapshot — called on app background/close."""
    if _sessions_col is None:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    # Extract user_id from auth (injected by require_auth dependency)
    from middleware.auth_deps import require_auth
    # User ID comes from the route-level dependency — we get it from the header
    user_id = _extract_user_id(authorization)
    if not user_id:
        user_id = "default_user"

    now = datetime.now(timezone.utc)
    session_data = body.dict(exclude_none=True)
    session_data["user_id"] = user_id
    session_data["updated_at"] = now
    session_data["saved_at_iso"] = now.isoformat()

    await _sessions_col.update_one(
        {"user_id": user_id},
        {"$set": session_data},
        upsert=True,
    )

    logger.info(f"Session saved for user {user_id[:8]}... ({len(str(session_data))} bytes)")
    return SessionResponse(success=True, message="Session saved")


@router.post("/sessions/auto-save", response_model=SessionResponse)
async def auto_save_session(body: SessionAutoSaveRequest, authorization: str = ""):
    """Lightweight delta save — merges changed fields into existing session."""
    if _sessions_col is None:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    user_id = _extract_user_id(authorization)
    if not user_id:
        user_id = "default_user"

    now = datetime.now(timezone.utc)
    update_fields = {f"{k}": v for k, v in body.delta.items()}
    update_fields["updated_at"] = now
    update_fields["user_id"] = user_id

    await _sessions_col.update_one(
        {"user_id": user_id},
        {"$set": update_fields},
        upsert=True,
    )

    logger.debug(f"Session auto-saved for user {user_id[:8]}... (delta: {list(body.delta.keys())})")
    return SessionResponse(success=True, message="Auto-saved")


@router.get("/sessions/restore", response_model=SessionResponse)
async def restore_session(authorization: str = ""):
    """Restore the most recent session for the authenticated user."""
    if _sessions_col is None:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    user_id = _extract_user_id(authorization)
    if not user_id:
        user_id = "default_user"

    doc = await _sessions_col.find_one(
        {"user_id": user_id},
        {"_id": 0},
    )

    if not doc:
        return SessionResponse(success=True, session=None, message="No saved session")

    # Calculate session age
    updated_at = doc.get("updated_at")
    age_seconds = None
    if updated_at:
        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=timezone.utc)
        age_seconds = (datetime.now(timezone.utc) - updated_at).total_seconds()

    # Clean internal fields from response
    doc.pop("updated_at", None)
    doc.pop("user_id", None)

    logger.info(f"Session restored for user {user_id[:8]}... (age: {age_seconds:.0f}s)" if age_seconds else f"Session restored for user {user_id[:8]}...")
    return SessionResponse(success=True, session=doc, age_seconds=age_seconds)


@router.delete("/sessions")
async def clear_session(authorization: str = ""):
    """Clear saved session data."""
    if _sessions_col is None:
        raise HTTPException(status_code=503, detail="Session service not initialized")

    user_id = _extract_user_id(authorization)
    if not user_id:
        user_id = "default_user"

    result = await _sessions_col.delete_one({"user_id": user_id})
    return {"success": True, "deleted": result.deleted_count > 0}


def _extract_user_id(authorization: str) -> Optional[str]:
    """Extract user_id from Bearer token without raising on failure."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        from security.auth import verify_token
        token = authorization.split(" ", 1)[1]
        payload = verify_token(token)
        return payload.get("sub")
    except Exception:
        return None
