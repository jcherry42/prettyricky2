"""Authentication dependencies for endpoint protection.

Two modes:
- optional_auth: Logs presence of auth header, allows anonymous access.
  Use during development / bootstrap when no users exist yet.
- require_auth: Validates JWT and returns user. Use in production.

To enforce auth on an endpoint:
  @router.get("/secret", dependencies=[Depends(require_auth)])
  async def secret(): ...

To enforce auth on an entire router when including it:
  api_router.include_router(some_router, dependencies=[Depends(require_auth)])
"""
import logging
from fastapi import HTTPException, Header, Request
from typing import Optional

from security.auth import verify_token

logger = logging.getLogger(__name__)

_db = None


def init_auth_deps(db):
    global _db
    _db = db


async def optional_auth(authorization: Optional[str] = Header(None)):
    """Pass-through auth — logs token presence but never blocks.
    Switch endpoints to require_auth when ready to enforce."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            payload = verify_token(token)
            return {"authenticated": True, **payload}
        except Exception:
            pass
    return {"authenticated": False}


async def require_auth(request: Request, authorization: Optional[str] = Header(None)):
    """Strict auth — validates JWT Bearer token.
    Returns user dict or raises 401. Also attaches user_id to request.state so
    downstream middleware/handlers (rate limiting, audit logging) can key off it."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.split(" ", 1)[1]

    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: no subject")
        # Attach for downstream consumers
        request.state.user_id = user_id
        request.state.sub = user_id
        return {
            "user_id": user_id,
            "type": payload.get("type", "access"),
            "role": payload.get("role", "user"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")
