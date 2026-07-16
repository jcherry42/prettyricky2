"""Dashboard, favorites, and maintenance routes.

Note: This file replaces the former `data_management.py` which was removed
on 2026-02 along with:
    • Generic data source management (/data-sources/*)
    • CRM config management (/crm/*)
    • Bulk import routes (/import/*)
    • Data-source health surfacing

What remains here is the sales-floor essentials:
    • /dashboard/stats     — Command Center KPIs (used by mobile)
    • /favorites/categories — Tower Talk favorite categories
    • /maintenance/*        — periodic cleanup jobs
"""
from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None


def init_dashboard_routes(db):
    """Wire the router to the app database."""
    global _db
    _db = db


# ============== DASHBOARD STATS ==============

@router.get("/dashboard/stats")
async def get_dashboard_stats() -> Dict[str, Any]:
    """Aggregate KPI counts for the Command Center dashboard.

    Cheap: 7 count_documents queries with existing indexes. Returns zeros
    for the intelligence block if telemetry_events collection is empty.
    """
    try:
        total_customers = await _db.customers.count_documents({})
        new_leads = await _db.customers.count_documents({"lead_status": "new"})
        contacted = await _db.customers.count_documents({"lead_status": "contacted"})
        qualified = await _db.customers.count_documents({"lead_status": "qualified"})
        sold = await _db.customers.count_documents({"lead_status": "sold"})
        active_inventory = await _db.vehicles.count_documents({"category": "active_inventory"})
        trade_ins = await _db.vehicles.count_documents({"category": "trade_in"})

        now = datetime.now(timezone.utc)
        yesterday = now - timedelta(hours=24)

        sales_analyses_24h = 0
        service_analyses_24h = 0
        open_objections = 0
        hot_escalations = 0
        try:
            sales_analyses_24h = await _db.telemetry_events.count_documents({
                "event_name": "intelligence_analyze",
                "properties.mode": "sales",
                "timestamp": {"$gte": yesterday},
            })
            service_analyses_24h = await _db.telemetry_events.count_documents({
                "event_name": "intelligence_analyze",
                "properties.mode": "service",
                "timestamp": {"$gte": yesterday},
            })
            open_objections = await _db.telemetry_events.count_documents({
                "event_name": "intelligence_analyze",
                "properties.objection_detected": True,
                "timestamp": {"$gte": yesterday},
            })
            hot_escalations = await _db.telemetry_events.count_documents({
                "event_name": "intelligence_analyze",
                "properties.risk_flags_count": {"$gte": 1},
                "timestamp": {"$gte": yesterday},
            })
        except Exception:
            # telemetry_events collection missing/empty — degrade gracefully
            pass

        return {
            "customers": {
                "total": total_customers, "new": new_leads,
                "contacted": contacted, "qualified": qualified, "sold": sold,
            },
            "vehicles": {
                "active_inventory": active_inventory,
                "trade_ins": trade_ins,
                "total": active_inventory + trade_ins,
            },
            "intelligence_24h": {
                "sales_analyses": sales_analyses_24h,
                "service_analyses": service_analyses_24h,
                "open_objections": open_objections,
                "hot_escalations": hot_escalations,
            },
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== FAVORITES CATEGORIES ==============

FAVORITE_CATEGORIES: List[Dict[str, str]] = [
    {"id": "price_negotiation", "label": "Price Negotiation", "icon": "\U0001f4b0"},
    {"id": "trade_in", "label": "Trade-In", "icon": "\U0001f504"},
    {"id": "objection_handling", "label": "Objection Handling", "icon": "\U0001f6e1\ufe0f"},
    {"id": "follow_up", "label": "Follow-Up", "icon": "\U0001f4de"},
    {"id": "competitor", "label": "Competitor", "icon": "\u2694\ufe0f"},
    {"id": "financing", "label": "Financing", "icon": "\U0001f4ca"},
    {"id": "features", "label": "Features", "icon": "\u2699\ufe0f"},
    {"id": "closing", "label": "Closing", "icon": "\U0001f3af"},
    {"id": "general", "label": "General", "icon": "\U0001f4ac"},
]


@router.get("/favorites/categories")
async def get_favorite_categories():
    return {"categories": FAVORITE_CATEGORIES}


# ============== MAINTENANCE ==============

@router.post("/maintenance/cleanup-sold")
async def cleanup_sold_vehicles(days_old: int = 60):
    """Remove sold vehicles older than `days_old` days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
    result = await _db.vehicles.delete_many({
        "category": "sold",
        "sold_at": {"$lt": cutoff},
    })
    return {"deleted_count": result.deleted_count, "cutoff": cutoff.isoformat()}


@router.post("/maintenance/cleanup-uploads")
async def cleanup_upload_records(days_old: int = 30):
    """Purge orphaned upload records older than `days_old` days from Mongo."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days_old)
    result = await _db.uploads.delete_many({"created_at": {"$lt": cutoff}})
    return {"deleted_count": result.deleted_count, "cutoff": cutoff.isoformat()}
