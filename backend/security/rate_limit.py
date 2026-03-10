"""Rate limiting middleware — sliding-window counters with deque.

Performance: O(1) amortised per request (deque.popleft is O(1)).
Memory: bounded by max(requests_per_minute, burst_size) per client.
Cleanup: stale clients pruned every 200 requests (amortised O(1)).
"""

import time
from collections import deque, defaultdict
from typing import Dict
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

# Paths exempt from rate limiting (k8s probes, CORS preflight, ops tools)
_EXEMPT_PATHS = frozenset({"/api/health", "/api/ready", "/api/diagnostics"})


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window rate limiter with burst protection."""

    __slots__ = ('requests_per_minute', 'burst_size', '_minute_windows', '_second_windows', '_req_count')

    def __init__(self, app, requests_per_minute: int = 60, burst_size: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        # client_id -> deque of timestamps (last 60s)
        self._minute_windows: Dict[str, deque] = defaultdict(deque)
        # client_id -> deque of timestamps (last 1s)
        self._second_windows: Dict[str, deque] = defaultdict(deque)
        self._req_count = 0

    async def dispatch(self, request: Request, call_next):
        # Exempt health probes and preflight requests
        if request.url.path in _EXEMPT_PATHS or request.method == "OPTIONS":
            return await call_next(request)

        client_ip = request.client.host
        ua_hash = hash(request.headers.get('user-agent', ''))
        client_id = f"{client_ip}:{ua_hash}"

        now = time.monotonic()

        # ── Evict expired timestamps from deques (O(expired) amortised) ──
        minute_q = self._minute_windows[client_id]
        while minute_q and now - minute_q[0] > 60.0:
            minute_q.popleft()

        second_q = self._second_windows[client_id]
        while second_q and now - second_q[0] > 1.0:
            second_q.popleft()

        # ── Check burst limit (per-second) ──
        if len(second_q) >= self.burst_size:
            logger.warning(f'Rate limit burst exceeded for {client_ip}')
            raise HTTPException(status_code=429, detail='Too many requests. Please slow down.')

        # ── Check per-minute limit ──
        if len(minute_q) >= self.requests_per_minute:
            logger.warning(f'Rate limit exceeded for {client_ip}')
            raise HTTPException(status_code=429, detail='Rate limit exceeded. Try again in 60 seconds.')

        # ── Record request ──
        minute_q.append(now)
        second_q.append(now)

        # ── Periodic stale-client cleanup (every 200 requests) ──
        self._req_count += 1
        if self._req_count % 200 == 0:
            self._cleanup_stale(now)

        response = await call_next(request)
        return response

    def _cleanup_stale(self, now: float):
        """Remove clients with no activity in the last 5 minutes."""
        stale = [
            cid for cid, q in self._minute_windows.items()
            if not q or now - q[-1] > 300.0
        ]
        for cid in stale:
            self._minute_windows.pop(cid, None)
            self._second_windows.pop(cid, None)
