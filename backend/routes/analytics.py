"""
Analytics Routes
Dashboard and reporting endpoints
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta

router = APIRouter()

# Repositories will be injected from main server
customer_repo = None
vehicle_repo = None
db = None


def init_analytics_routes(customer_repository, vehicle_repository, database):
    """Initialize routes with repository instances"""
    global customer_repo, vehicle_repo, db
    customer_repo = customer_repository
    vehicle_repo = vehicle_repository
    db = database


@router.get("/dashboard")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    # Customer stats
    total_customers = await customer_repo.count({})
    
    # Count by status
    new_count = await customer_repo.count({"lead_status": "new"})
    contacted_count = await customer_repo.count({"lead_status": "contacted"})
    qualified_count = await customer_repo.count({"lead_status": "qualified"})
    appointment_count = await customer_repo.count({"lead_status": "appointment"})
    sold_count = await customer_repo.count({"lead_status": "sold"})
    
    # Vehicle stats
    total_vehicles = await vehicle_repo.count({})
    active_inventory = await vehicle_repo.count({"category": "active_inventory"})
    trade_ins = await vehicle_repo.count({"category": "trade_in"})
    
    return {
        "customers": {
            "total": total_customers,
            "new": new_count,
            "contacted": contacted_count,
            "qualified": qualified_count,
            "appointment": appointment_count,
            "sold": sold_count
        },
        "vehicles": {
            "total": total_vehicles,
            "active_inventory": active_inventory,
            "trade_ins": trade_ins
        }
    }


@router.get("/sales")
async def get_sales_analytics(days: int = 30):
    """Get sales analytics for specified time period"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_str = cutoff.isoformat()
    
    # Count sold in period
    sold_in_period = await customer_repo.count({
        "lead_status": "sold",
        "updated_at": {"$gte": cutoff_str}
    })
    
    # Count new leads in period
    new_in_period = await customer_repo.count({
        "created_at": {"$gte": cutoff_str}
    })
    
    return {
        "period_days": days,
        "sold": sold_in_period,
        "new_leads": new_in_period,
        "conversion_rate": round(sold_in_period / max(new_in_period, 1) * 100, 1)
    }


@router.get("/customers")
async def get_customer_analytics():
    """Get customer analytics breakdown"""
    pipeline = [
        {"$group": {
            "_id": "$lead_status",
            "count": {"$sum": 1}
        }}
    ]
    
    cursor = customer_repo.collection.aggregate(pipeline)
    results = await cursor.to_list(length=100)
    
    status_breakdown = {r["_id"]: r["count"] for r in results if r["_id"]}
    
    # Source breakdown
    source_pipeline = [
        {"$group": {
            "_id": "$lead_source",
            "count": {"$sum": 1}
        }}
    ]
    
    source_cursor = customer_repo.collection.aggregate(source_pipeline)
    source_results = await source_cursor.to_list(length=100)
    
    source_breakdown = {r["_id"]: r["count"] for r in source_results if r["_id"]}
    
    return {
        "by_status": status_breakdown,
        "by_source": source_breakdown
    }


@router.get("/inventory")
async def get_inventory_analytics():
    """Get inventory analytics breakdown"""
    # By make
    make_pipeline = [
        {"$group": {
            "_id": "$make",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    
    make_cursor = vehicle_repo.collection.aggregate(make_pipeline)
    make_results = await make_cursor.to_list(length=10)
    
    by_make = {r["_id"]: r["count"] for r in make_results if r["_id"]}
    
    # By category
    category_pipeline = [
        {"$group": {
            "_id": "$category",
            "count": {"$sum": 1}
        }}
    ]
    
    cat_cursor = vehicle_repo.collection.aggregate(category_pipeline)
    cat_results = await cat_cursor.to_list(length=100)
    
    by_category = {r["_id"]: r["count"] for r in cat_results if r["_id"]}
    
    return {
        "by_make": by_make,
        "by_category": by_category
    }


@router.get("/trends/{metric}")
async def get_metric_trends(metric: str, days: int = 30):
    """Get trends for a specific metric"""
    valid_metrics = ["customers", "vehicles", "conversations", "sold"]
    
    if metric not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric. Choose from: {valid_metrics}"
        )
    
    # For now, return basic trend data
    # In production, this would aggregate daily counts
    
    return {
        "metric": metric,
        "period_days": days,
        "trend": "stable",
        "data": []
    }
