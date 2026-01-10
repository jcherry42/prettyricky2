"""
Data Refresh Scheduler
Handles periodic data source refreshes Mon-Sat at 10 AM
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase

from data_integration import ImportProcessor, DataSource, DataSourceType

logger = logging.getLogger(__name__)


class DataRefreshScheduler:
    """Manages scheduled data refreshes from configured sources"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.scheduler = AsyncIOScheduler()
        self._is_running = False
    
    def start(self):
        """Start the scheduler"""
        if not self._is_running:
            # Schedule Mon-Sat at 10:00 AM
            self.scheduler.add_job(
                self._refresh_all_sources,
                CronTrigger(
                    day_of_week='mon-sat',
                    hour=10,
                    minute=0,
                    timezone='America/New_York'  # Default to ET, could be configurable
                ),
                id='data_refresh_job',
                replace_existing=True,
                name='Daily Data Refresh'
            )
            
            self.scheduler.start()
            self._is_running = True
            logger.info("Data refresh scheduler started (Mon-Sat 10:00 AM ET)")
    
    def stop(self):
        """Stop the scheduler"""
        if self._is_running:
            self.scheduler.shutdown()
            self._is_running = False
            logger.info("Data refresh scheduler stopped")
    
    async def _refresh_all_sources(self):
        """Refresh all active data sources"""
        logger.info("Starting scheduled data refresh...")
        
        try:
            # Get all active data sources
            sources = await self.db.data_sources.find({"isActive": True}).to_list(100)
            
            for source_doc in sources:
                try:
                    await self._refresh_source(source_doc)
                except Exception as e:
                    logger.error(f"Failed to refresh source {source_doc.get('name')}: {e}")
            
            logger.info(f"Scheduled refresh complete. Processed {len(sources)} sources.")
            
        except Exception as e:
            logger.error(f"Scheduled refresh failed: {e}")
    
    async def _refresh_source(self, source_doc: Dict):
        """Refresh a single data source"""
        source_id = str(source_doc['_id'])
        source_name = source_doc.get('name', 'Unknown')
        source_type = source_doc.get('type')
        url = source_doc.get('url')
        data_type = source_doc.get('dataType', 'customers')
        custom_mapping = source_doc.get('fieldMapping', {})
        
        if not url:
            logger.warning(f"Source {source_name} has no URL, skipping")
            return
        
        logger.info(f"Refreshing source: {source_name}")
        
        # Import data
        result = await ImportProcessor.import_from_url(url, data_type, custom_mapping)
        
        if result['success'] and result['data']:
            # Update the appropriate collection
            collection = self.db.customers if data_type == 'customers' else self.db.vehicles
            
            # Clear existing data from this source and insert new
            await collection.delete_many({"source": source_id})
            
            # Add source reference to each item
            for item in result['data']:
                item['source'] = source_id
                item['sourceUrl'] = url
            
            if result['data']:
                await collection.insert_many(result['data'])
            
            # Update source metadata
            await self.db.data_sources.update_one(
                {"_id": source_doc['_id']},
                {
                    "$set": {
                        "lastRefresh": datetime.now(timezone.utc),
                        "lastRefreshStats": result['stats'],
                        "lastRefreshErrors": result['errors'][:5] if result['errors'] else []
                    }
                }
            )
            
            logger.info(f"Source {source_name} refreshed: {result['stats']}")
        else:
            # Log failure but don't clear existing data
            await self.db.data_sources.update_one(
                {"_id": source_doc['_id']},
                {
                    "$set": {
                        "lastRefreshErrors": result['errors'][:5] if result['errors'] else ['Unknown error']
                    }
                }
            )
            logger.warning(f"Source {source_name} refresh failed: {result['errors']}")
    
    async def manual_refresh(self, source_id: str) -> Dict:
        """Manually refresh a specific data source"""
        from bson import ObjectId
        
        source_doc = await self.db.data_sources.find_one({"_id": ObjectId(source_id)})
        
        if not source_doc:
            return {"success": False, "error": "Data source not found"}
        
        try:
            await self._refresh_source(source_doc)
            
            # Get updated source
            updated = await self.db.data_sources.find_one({"_id": ObjectId(source_id)})
            
            return {
                "success": True,
                "stats": updated.get('lastRefreshStats', {}),
                "errors": updated.get('lastRefreshErrors', [])
            }
        except Exception as e:
            logger.error(f"Manual refresh failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_next_refresh_time(self) -> Optional[datetime]:
        """Get the next scheduled refresh time"""
        if self._is_running:
            job = self.scheduler.get_job('data_refresh_job')
            if job:
                return job.next_run_time
        return None
    
    async def add_data_source(self, source: DataSource) -> str:
        """Add a new data source configuration"""
        doc = source.model_dump(exclude={'id'})
        doc['createdAt'] = datetime.now(timezone.utc)
        
        result = await self.db.data_sources.insert_one(doc)
        return str(result.inserted_id)
    
    async def update_data_source(self, source_id: str, updates: Dict) -> bool:
        """Update a data source configuration"""
        from bson import ObjectId
        
        result = await self.db.data_sources.update_one(
            {"_id": ObjectId(source_id)},
            {"$set": updates}
        )
        return result.modified_count > 0
    
    async def delete_data_source(self, source_id: str) -> bool:
        """Delete a data source and its imported data"""
        from bson import ObjectId
        
        # Delete source
        result = await self.db.data_sources.delete_one({"_id": ObjectId(source_id)})
        
        if result.deleted_count > 0:
            # Delete associated data
            await self.db.customers.delete_many({"source": source_id})
            await self.db.vehicles.delete_many({"source": source_id})
            return True
        
        return False
    
    async def get_all_sources(self) -> List[Dict]:
        """Get all configured data sources"""
        sources = await self.db.data_sources.find({}).to_list(100)
        
        # Convert ObjectId to string
        for source in sources:
            source['id'] = str(source.pop('_id'))
        
        return sources
    
    async def get_source(self, source_id: str) -> Optional[Dict]:
        """Get a specific data source"""
        from bson import ObjectId
        
        source = await self.db.data_sources.find_one({"_id": ObjectId(source_id)})
        
        if source:
            source['id'] = str(source.pop('_id'))
        
        return source


# Global scheduler instance (initialized in server.py)
scheduler: Optional[DataRefreshScheduler] = None


def get_scheduler() -> Optional[DataRefreshScheduler]:
    """Get the global scheduler instance"""
    return scheduler


def init_scheduler(db: AsyncIOMotorDatabase) -> DataRefreshScheduler:
    """Initialize the global scheduler"""
    global scheduler
    scheduler = DataRefreshScheduler(db)
    return scheduler
