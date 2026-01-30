"""
Dashboard Routes
Statistics and dashboard data endpoints
"""

from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta

router = APIRouter()

# Repositories will be injected
customer_repo = None
vehicle_repo = None
conversation_repo = None
db = None


def init_dashboard_routes(customer_repository, vehicle_repository, conv_repository, database):
    global customer_repo, vehicle_repo, conversation_repo, db
    customer_repo = customer_repository
    vehicle_repo = vehicle_repository
    conversation_repo = conv_repository
    db = database


@router.get("/stats")
async def get_dashboard_stats():
    """Get comprehensive dashboard statistics"""
    # Customer stats
    total_customers = await customer_repo.count({})
    
    # Lead status counts
    new_count = await customer_repo.count({"lead_status": "new"})
    contacted_count = await customer_repo.count({"lead_status": "contacted"})
    qualified_count = await customer_repo.count({"lead_status": "qualified"})
    negotiating_count = await customer_repo.count({"lead_status": "negotiating"})
    sold_count = await customer_repo.count({"lead_status": "sold"})
    lost_count = await customer_repo.count({"lead_status": "lost"})
    
    # Vehicle stats
    total_vehicles = await vehicle_repo.count({})
    active_inventory = await vehicle_repo.count({"category": "active_inventory"})
    trade_ins = await vehicle_repo.count({"category": "trade_in"})
    sold_vehicles = await vehicle_repo.count({"category": "sold"})
    
    # Recent activity (last 24 hours)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    yesterday_str = yesterday.isoformat()
    
    new_today = await customer_repo.count({
        "created_at": {"$gte": yesterday_str}
    })
    
    # Conversations stats (if available)
    conversation_count = 0
    if conversation_repo:
        try:
            conversation_count = await conversation_repo.count({})
        except Exception:
            pass
    
    return {
        "customers": {
            "total": total_customers,
            "new": new_count,
            "contacted": contacted_count,
            "qualified": qualified_count,
            "negotiating": negotiating_count,
            "sold": sold_count,
            "lost": lost_count,
            "new_today": new_today
        },
        "vehicles": {
            "total": total_vehicles,
            "active_inventory": active_inventory,
            "trade_ins": trade_ins,
            "sold": sold_vehicles
        },
        "conversations": conversation_count,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/sales")
async def get_sales_stats(days: int = 30):
    """Get sales statistics for a time period"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_str = cutoff.isoformat()
    
    sold_in_period = await customer_repo.count({
        "lead_status": "sold",
        "updated_at": {"$gte": cutoff_str}
    })
    
    new_leads_in_period = await customer_repo.count({
        "created_at": {"$gte": cutoff_str}
    })
    
    lost_in_period = await customer_repo.count({
        "lead_status": "lost",
        "updated_at": {"$gte": cutoff_str}
    })
    
    conversion_rate = round(sold_in_period / max(new_leads_in_period, 1) * 100, 1)
    
    return {
        "period_days": days,
        "sold": sold_in_period,
        "new_leads": new_leads_in_period,
        "lost": lost_in_period,
        "conversion_rate": conversion_rate,
        "avg_per_day": round(sold_in_period / days, 1)
    }


@router.get("/trends")
async def get_trends(metric: str = "customers", days: int = 7):
    """Get trend data for charts"""
    valid_metrics = ["customers", "vehicles", "sold"]
    
    if metric not in valid_metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric. Choose from: {valid_metrics}"
        )
    
    # Generate daily data for the period
    trend_data = []
    
    for i in range(days, -1, -1):
        date = datetime.now(timezone.utc) - timedelta(days=i)
        date_start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        date_end = date_start + timedelta(days=1)
        
        if metric == "customers":
            count = await customer_repo.count({
                "created_at": {
                    "$gte": date_start.isoformat(),
                    "$lt": date_end.isoformat()
                }
            })
        elif metric == "vehicles":
            count = await vehicle_repo.count({
                "created_at": {
                    "$gte": date_start.isoformat(),
                    "$lt": date_end.isoformat()
                }
            })
        elif metric == "sold":
            count = await customer_repo.count({
                "lead_status": "sold",
                "updated_at": {
                    "$gte": date_start.isoformat(),
                    "$lt": date_end.isoformat()
                }
            })
        else:
            count = 0
        
        trend_data.append({
            "date": date_start.strftime("%Y-%m-%d"),
            "count": count
        })
    
    return {
        "metric": metric,
        "period_days": days,
        "data": trend_data
    }
