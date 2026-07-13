"""Per-endpoint rate limiter for expensive LLM routes.

Global rate limit (RateLimitMiddleware) handles broad abuse. This module adds
FINE-GRAINED per-endpoint caps on the LLM-heavy routes so a single logged-in
user can't burn the LLM budget in one minute:

  - /api/tower-talk:            20 req/min/user
  - /api/intelligence/analyze:  20 req/min/user
  - /api/translate:             40 req/min/user  (higher cap — cached hits are cheap)

Returns 429 with Retry-After header per RFC 7231. Uses in-process sliding
window; suitable for a single-instance backend. For multi-instance deployments
swap the store for Redis.
"""
from __future__ import annotations

import asyncio
import time
from collections import deque
from typing import Deque, Dict

from fastapi import HTTPException, Request

# Client-key -> deque of timestamps in the last 60s.
_windows: Dict[str, Deque[float]] = {}
_lock = asyncio.Lock()

# Configured per-endpoint caps. Keyed by an endpoint identifier passed by caller.
LIMITS = {
    "tower_talk":       (20, 60),
    "intelligence":     (20, 60),
    "translate":        (40, 60),
}


def _client_key(request: Request, endpoint: str) -> str:
    # Prefer JWT sub; fall back to IP for unauthenticated endpoints.
    sub = getattr(request.state, "user_id", None) or getattr(request.state, "sub", None)
    if sub:
        return f"{endpoint}:u:{sub}"
    host = request.client.host if request.client else "anon"
    return f"{endpoint}:ip:{host}"


async def enforce(request: Request, endpoint: str) -> None:
    """Raise HTTPException(429) if this client has exceeded the endpoint's rate.

    Non-fatal for the app — the exception propagates as a standard FastAPI 429
    with a Retry-After header.
    """
    if endpoint not in LIMITS:
        return
    limit, window_seconds = LIMITS[endpoint]
    now = time.monotonic()
    cutoff = now - window_seconds
    key = _client_key(request, endpoint)

    async with _lock:
        q = _windows.get(key)
        if q is None:
            q = deque()
            _windows[key] = q
        # Trim stale entries
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= limit:
            oldest = q[0]
            retry_after = max(1, int(oldest + window_seconds - now))
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit_exceeded",
                    "endpoint": endpoint,
                    "limit_per_minute": limit,
                    "retry_after_seconds": retry_after,
                    "message": f"Too many {endpoint} requests. Try again in {retry_after}s.",
                },
                headers={"Retry-After": str(retry_after)},
            )
        q.append(now)
