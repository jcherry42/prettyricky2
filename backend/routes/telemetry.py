"""Telemetry routes — extracted from server.py."""

from fastapi import APIRouter, Request
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/telemetry/summary")
async def telemetry_summary(request: Request, hours: int = 24):
    """Telemetry event summary."""
    telem = request.app.state.telemetry
    return await telem.get_summary(hours=hours)


@router.get("/telemetry/sales-funnel")
async def telemetry_sales_funnel(request: Request, days: int = 30):
    """Sales funnel analytics from telemetry."""
    telem = request.app.state.telemetry
    return await telem.get_sales_funnel(days=days)


@router.get("/telemetry/ai-usage")
async def telemetry_ai_usage(request: Request, days: int = 7):
    """AI feature usage breakdown."""
    telem = request.app.state.telemetry
    return await telem.get_ai_usage_breakdown(days=days)


@router.post("/telemetry/track")
async def telemetry_track(request: Request, body: dict):
    """Track a client-side telemetry event."""
    telem = request.app.state.telemetry
    category = body.get("category", "user_actions")
    action = body.get("action", "unknown")
    properties = body.get("properties", {})
    session_id = body.get("session_id")
    await telem.track(category, action, properties, session_id=session_id)
    return {"tracked": True}
