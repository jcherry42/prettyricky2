"""Structured logging with correlation IDs.
Every request gets a unique trace ID for debugging."""
import uuid
import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger("superchargd")


class CorrelationMiddleware(BaseHTTPMiddleware):
    """Adds X-Correlation-ID to every request/response for distributed tracing."""

    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4())[:12])
        request.state.correlation_id = correlation_id

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        response.headers["X-Correlation-ID"] = correlation_id

        # Structured log line
        method = request.method
        path = request.url.path
        status = response.status_code
        logger.info(f"[{correlation_id}] {method} {path} -> {status} ({duration_ms:.0f}ms)")

        return response
