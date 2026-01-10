"""
Data Source Repository
Manages data source configurations and health tracking
"""

from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING
from datetime import datetime, timezone

from .base import BaseRepository
from data_integration.models import DataSourceConfig, RefreshSchedule


class DataSourceRepository(BaseRepository):
    """Repository for data source configurations"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "data_sources")
    
    async def create_indexes(self):
        """Create indexes"""
        await self.collection.create_index([("name", ASCENDING)])
        await self.collection.create_index([("is_active", ASCENDING)])
        await self.collection.create_index([("type", ASCENDING)])
        await self.collection.create_index([("data_type", ASCENDING)])
    
    async def create_source(self, config: DataSourceConfig) -> str:
        """Create a new data source"""
        doc = config.model_dump()
        doc.pop('id', None)
        return await self.insert_one(doc)
    
    async def find_active(self) -> List[Dict[str, Any]]:
        """Find all active data sources"""
        return await self.find_many(
            {"is_active": True},
            sort=[("name", ASCENDING)]
        )
    
    async def find_due_for_refresh(self, schedule: RefreshSchedule) -> List[Dict[str, Any]]:
        """Find sources due for refresh based on schedule"""
        return await self.find_many({
            "is_active": True,
            "refresh_schedule": schedule.value
        })
    
    async def update_refresh_status(
        self,
        source_id: str,
        success: bool,
        stats: Dict[str, int],
        errors: List[str] = None
    ):
        """Update source after refresh attempt"""
        updates = {
            "last_refresh_at": datetime.now(timezone.utc),
            "last_refresh_success": success,
            "last_refresh_stats": stats,
            "last_refresh_errors": (errors or [])[:10]  # Limit stored errors
        }
        
        if success:
            updates["consecutive_failures"] = 0
        else:
            # Increment failure counter
            source = await self.find_by_id(source_id)
            if source:
                updates["consecutive_failures"] = source.get("consecutive_failures", 0) + 1
        
        await self.update_one(source_id, updates)
    
    async def toggle_active(self, source_id: str, is_active: bool) -> bool:
        """Toggle source active status"""
        return await self.update_one(source_id, {"is_active": is_active})
    
    async def update_mapping_overrides(
        self,
        source_id: str,
        overrides: Dict[str, str]
    ) -> bool:
        """Update field mapping overrides"""
        return await self.update_one(source_id, {"field_mapping_overrides": overrides})
    
    async def get_health_summary(self) -> Dict[str, Any]:
        """Get health summary of all sources"""
        pipeline = [
            {"$group": {
                "_id": None,
                "total": {"$sum": 1},
                "active": {"$sum": {"$cond": ["$is_active", 1, 0]}},
                "healthy": {"$sum": {"$cond": [
                    {"$and": [
                        "$is_active",
                        "$last_refresh_success",
                        {"$lt": ["$consecutive_failures", 3]}
                    ]},
                    1, 0
                ]}},
                "needs_attention": {"$sum": {"$cond": [
                    {"$gte": ["$consecutive_failures", 2]},
                    1, 0
                ]}}
            }}
        ]
        
        results = await self.collection.aggregate(pipeline).to_list(1)
        
        if results:
            r = results[0]
            return {
                "total": r.get('total', 0),
                "active": r.get('active', 0),
                "healthy": r.get('healthy', 0),
                "needsAttention": r.get('needs_attention', 0)
            }
        
        return {"total": 0, "active": 0, "healthy": 0, "needsAttention": 0}
    
    def to_frontend_format(self, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert sources to frontend format"""
        result = []
        for s in sources:
            result.append({
                "id": s.get('id'),
                "name": s.get('name', ''),
                "type": s.get('type', ''),
                "dataType": s.get('data_type', 'customers'),
                "url": s.get('url', ''),
                "isActive": s.get('is_active', False),
                "refreshSchedule": s.get('refresh_schedule', 'manual_only'),
                "lastRefreshAt": s.get('last_refresh_at'),
                "lastRefreshSuccess": s.get('last_refresh_success', False),
                "lastRefreshStats": s.get('last_refresh_stats', {}),
                "lastRefreshErrors": s.get('last_refresh_errors', []),
                "consecutiveFailures": s.get('consecutive_failures', 0),
                "isHealthy": s.get('consecutive_failures', 0) < 3 and s.get('last_refresh_success', False),
                "needsAttention": s.get('consecutive_failures', 0) >= 2,
            })
        return result
