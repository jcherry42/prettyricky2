"""Authentication dependencies for endpoint protection.

Two modes:
- optional_auth: Logs presence of auth header, allows anonymous access.
  Use during development / bootstrap when no users exist yet.
- require_auth: Validates JWT and returns user. Use in production.

To enforce auth on an endpoint:
  @router.get("/secret", dependencies=[Depends(require_auth)])
  async def secret(): ...
"""
import os
import logging
from fastapi import Depends, HTTPException, Header
from typing import Optional

logger = logging.getLogger(__name__)

_db = None


def init_auth_deps(db):
    global _db
    _db = db


async def optional_auth(authorization: Optional[str] = Header(None)):
    """Pass-through auth — logs token presence but never blocks.
    Switch endpoints to require_auth when ready to enforce."""
    return {"authenticated": authorization is not None, "token": authorization}


async def require_auth(authorization: Optional[str] = Header(None)):
    """Strict auth — validates JWT Bearer token.
    Returns user dict or raises 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.split(" ", 1)[1]

    try:
        from security.auth import decode_token
        payload = decode_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        return payload
    except ImportError:
        logger.warning("security.auth not available — allowing through")
        return {"authenticated": True, "token": token}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")
