"""
Analytics Service Module
Comprehensive analytics for sales performance, customer engagement, and inventory
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Service for generating analytics and insights"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def get_dashboard_summary(self) -> Dict[str, Any]:
        """Get comprehensive dashboard summary"""
        return {
            "sales_performance": await self.get_sales_performance(),
            "customer_engagement": await self.get_customer_engagement(),
            "inventory_metrics": await self.get_inventory_metrics(),
            "conversation_insights": await self.get_conversation_insights(),
            "integration_health": await self.get_integration_health(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    
    async def get_sales_performance(self, days: int = 30) -> Dict[str, Any]:
        """Get sales performance metrics"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        # Get conversation stats (responses sent)
        conversations = self.db.conversations
        conv_pipeline = [
            {"$match": {"created_at": {"$gte": start_date}}},
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "by_day": [
                        {
                            "$group": {
                                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                                "count": {"$sum": 1}
                            }
                        },
                        {"$sort": {"_id": 1}}
                    ],
                    "by_category": [
                        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}},
                        {"$limit": 5}
                    ],
                    "shortcuts_efficiency": [
                        {"$match": {"shortcut_used": {"$ne": None}}},
                        {"$count": "count"}
                    ]
                }
            }
        ]
        
        conv_result = await conversations.aggregate(conv_pipeline).to_list(1)
        conv_data = conv_result[0] if conv_result else {}
        
        total_list = conv_data.get("total", [])
        total_responses = total_list[0].get("count", 0) if total_list else 0
        
        shortcuts_list = conv_data.get("shortcuts_efficiency", [])
        shortcut_responses = shortcuts_list[0].get("count", 0) if shortcuts_list else 0
        
        return {
            "period_days": days,
            "total_responses_generated": total_responses,
            "responses_per_day": round(total_responses / max(days, 1), 1),
            "shortcut_usage_rate": round((shortcut_responses / max(total_responses, 1)) * 100, 1),
            "daily_breakdown": conv_data.get("by_day", []),
            "top_categories": conv_data.get("by_category", []),
            "efficiency_score": min(100, round((shortcut_responses / max(total_responses, 1)) * 150, 0)),
        }
    
    async def get_customer_engagement(self) -> Dict[str, Any]:
        """Get customer engagement metrics"""
        customers = self.db.customers
        
        pipeline = [
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "by_status": [
                        {"$group": {"_id": "$lead_status", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}}
                    ],
                    "with_vehicle_interest": [
                        {"$match": {"vehicle_interest": {"$exists": True, "$ne": None}}},
                        {"$count": "count"}
                    ],
                    "with_email": [
                        {"$match": {"email": {"$exists": True, "$ne": None, "$ne": ""}}},
                        {"$count": "count"}
                    ],
                    "with_phone": [
                        {"$match": {"phone": {"$exists": True, "$ne": None, "$ne": ""}}},
                        {"$count": "count"}
                    ],
                    "recent_leads": [
                        {
                            "$match": {
                                "created_at": {
                                    "$gte": datetime.now(timezone.utc) - timedelta(days=7)
                                }
                            }
                        },
                        {"$count": "count"}
                    ]
                }
            }
        ]
        
        result = await customers.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}
        
        total_list = data.get("total", [])
        total = total_list[0].get("count", 0) if total_list else 0
        
        # Calculate conversion funnel
        status_counts = {item["_id"]: item["count"] for item in data.get("by_status", [])}
        hot_leads = status_counts.get("hot", 0)
        warm_leads = status_counts.get("warm", 0)
        cold_leads = status_counts.get("cold", 0)
        sold = status_counts.get("sold", 0)
        
        recent_leads_list = data.get("recent_leads", [])
        new_leads_7d = recent_leads_list[0].get("count", 0) if recent_leads_list else 0
        
        email_list = data.get("with_email", [])
        with_email = email_list[0].get("count", 0) if email_list else 0
        
        phone_list = data.get("with_phone", [])
        with_phone = phone_list[0].get("count", 0) if phone_list else 0
        
        vehicle_list = data.get("with_vehicle_interest", [])
        with_vehicle = vehicle_list[0].get("count", 0) if vehicle_list else 0
        
        return {
            "total_customers": total,
            "new_leads_7d": new_leads_7d,
            "lead_status_breakdown": status_counts,
            "hot_leads": hot_leads,
            "warm_leads": warm_leads,
            "cold_leads": cold_leads,
            "sold": sold,
            "conversion_rate": round((sold / max(total, 1)) * 100, 1),
            "contact_completeness": {
                "with_email": round((with_email / max(total, 1)) * 100, 1),
                "with_phone": round((with_phone / max(total, 1)) * 100, 1),
                "with_vehicle_interest": round((with_vehicle / max(total, 1)) * 100, 1),
            },
            "follow_up_priority": {
                "immediate": hot_leads,
                "this_week": warm_leads,
                "nurture": cold_leads,
            }
        }
    
    async def get_inventory_metrics(self) -> Dict[str, Any]:
        """Get inventory/vehicle metrics"""
        vehicles = self.db.vehicles
        
        pipeline = [
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "by_status": [
                        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
                    ],
                    "by_make": [
                        {"$group": {"_id": "$make", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}},
                        {"$limit": 10}
                    ],
                    "price_stats": [
                        {"$match": {"price": {"$gt": 0}}},
                        {
                            "$group": {
                                "_id": None,
                                "avg_price": {"$avg": "$price"},
                                "min_price": {"$min": "$price"},
                                "max_price": {"$max": "$price"},
                                "total_value": {"$sum": "$price"}
                            }
                        }
                    ],
                    "by_year": [
                        {"$group": {"_id": "$year", "count": {"$sum": 1}}},
                        {"$sort": {"_id": -1}},
                        {"$limit": 5}
                    ],
                    "new_vs_used": [
                        {
                            "$group": {
                                "_id": {"$cond": [{"$gte": ["$year", datetime.now().year - 1]}, "new", "used"]},
                                "count": {"$sum": 1}
                            }
                        }
                    ]
                }
            }
        ]
        
        result = await vehicles.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}
        
        total_list = data.get("total", [])
        total = total_list[0].get("count", 0) if total_list else 0
        status_counts = {item["_id"]: item["count"] for item in data.get("by_status", [])}
        price_stats_list = data.get("price_stats", [])
        price_stats = price_stats_list[0] if price_stats_list else {}
        
        available = status_counts.get("available", 0)
        sold = status_counts.get("sold", 0)
        pending = status_counts.get("pending", 0)
        
        return {
            "total_vehicles": total,
            "available": available,
            "sold": sold,
            "pending": pending,
            "availability_rate": round((available / max(total, 1)) * 100, 1),
            "turnover_rate": round((sold / max(total, 1)) * 100, 1),
            "price_metrics": {
                "average_price": round(price_stats.get("avg_price", 0), 0),
                "min_price": round(price_stats.get("min_price", 0), 0),
                "max_price": round(price_stats.get("max_price", 0), 0),
                "total_inventory_value": round(price_stats.get("total_value", 0), 0),
            },
            "top_makes": data.get("by_make", []),
            "by_model_year": data.get("by_year", []),
            "new_vs_used": {item["_id"]: item["count"] for item in data.get("new_vs_used", [])},
        }
    
    async def get_conversation_insights(self) -> Dict[str, Any]:
        """Get insights from conversation history"""
        conversations = self.db.conversations
        
        pipeline = [
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "by_hour": [
                        {
                            "$group": {
                                "_id": {"$hour": "$created_at"},
                                "count": {"$sum": 1}
                            }
                        },
                        {"$sort": {"_id": 1}}
                    ],
                    "avg_response_length": [
                        {
                            "$group": {
                                "_id": None,
                                "avg_length": {"$avg": {"$strLenCP": "$response"}}
                            }
                        }
                    ],
                    "bilingual_usage": [
                        {"$match": {"translated_response": {"$ne": None}}},
                        {"$count": "count"}
                    ],
                    "top_situations": [
                        {
                            "$group": {
                                "_id": "$shortcut_used",
                                "count": {"$sum": 1}
                            }
                        },
                        {"$match": {"_id": {"$ne": None}}},
                        {"$sort": {"count": -1}},
                        {"$limit": 5}
                    ]
                }
            }
        ]
        
        result = await conversations.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}
        
        total_list = data.get("total", [])
        total = total_list[0].get("count", 0) if total_list else 0
        
        bilingual_list = data.get("bilingual_usage", [])
        bilingual = bilingual_list[0].get("count", 0) if bilingual_list else 0
        
        # Find peak hours
        by_hour = data.get("by_hour", [])
        peak_hour = max(by_hour, key=lambda x: x["count"])["_id"] if by_hour else 12
        
        return {
            "total_conversations": total,
            "bilingual_usage_rate": round((bilingual / max(total, 1)) * 100, 1),
            "avg_response_length": round(data.get("avg_response_length", [{}])[0].get("avg_length", 0), 0),
            "peak_usage_hour": peak_hour,
            "hourly_distribution": by_hour,
            "top_quick_shortcuts": data.get("top_situations", []),
            "ai_efficiency_score": min(100, round(total * 0.5 + bilingual * 2, 0)),
        }
    
    async def get_integration_health(self) -> Dict[str, Any]:
        """Get CRM integration health summary"""
        integrations = self.db.integrations
        
        pipeline = [
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "by_status": [
                        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
                    ],
                    "mock_mode": [
                        {"$match": {"mock_mode": True}},
                        {"$count": "count"}
                    ],
                    "sync_stats": [
                        {
                            "$group": {
                                "_id": None,
                                "total_synced": {"$sum": "$sync_stats.records_fetched"},
                                "last_sync": {"$max": "$last_sync_at"}
                            }
                        }
                    ]
                }
            }
        ]
        
        result = await integrations.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}
        
        total_list = data.get("total", [])
        total = total_list[0].get("count", 0) if total_list else 0
        status_counts = {item["_id"]: item["count"] for item in data.get("by_status", [])}
        
        mock_list = data.get("mock_mode", [])
        mock_count = mock_list[0].get("count", 0) if mock_list else 0
        
        sync_list = data.get("sync_stats", [])
        sync_data = sync_list[0] if sync_list else {}
        
        healthy = status_counts.get("healthy", 0)
        degraded = status_counts.get("degraded", 0)
        unhealthy = status_counts.get("unhealthy", 0)
        
        return {
            "total_integrations": total,
            "healthy": healthy,
            "degraded": degraded,
            "unhealthy": unhealthy,
            "mock_mode_count": mock_count,
            "health_score": round((healthy / max(total, 1)) * 100, 0),
            "total_records_synced": sync_data.get("total_synced", 0),
            "last_sync": sync_data.get("last_sync").isoformat() if sync_data.get("last_sync") else None,
            "real_connections": total - mock_count,
        }
    
    async def get_trends(self, metric: str, days: int = 30) -> Dict[str, Any]:
        """Get trend data for a specific metric"""
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
        
        if metric == "conversations":
            collection = self.db.conversations
            date_field = "created_at"
        elif metric == "customers":
            collection = self.db.customers
            date_field = "created_at"
        elif metric == "vehicles":
            collection = self.db.vehicles
            date_field = "created_at"
        else:
            return {"error": "Invalid metric"}
        
        pipeline = [
            {"$match": {date_field: {"$gte": start_date}}},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": f"${date_field}"}},
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}}
        ]
        
        result = await collection.aggregate(pipeline).to_list(100)
        
        return {
            "metric": metric,
            "period_days": days,
            "data_points": result,
            "total": sum(item["count"] for item in result),
        }
