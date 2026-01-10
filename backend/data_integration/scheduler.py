"""
Data Refresh Scheduler
Reliable scheduler with retry logic and health monitoring
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorDatabase

from data_integration.models import RefreshSchedule, DataSourceType
from data_integration.processor import ImportProcessor
from repositories import CustomerRepository, VehicleRepository, DataSourceRepository

logger = logging.getLogger(__name__)


class DataRefreshScheduler:
    """
    Reliable data refresh scheduler with:
    - Scheduled refreshes (Mon-Sat 10 AM)
    - Retry logic with exponential backoff
    - Health monitoring
    - Manual refresh capability
    """
    
    MAX_RETRIES = 3
    BASE_RETRY_DELAY = 60  # seconds
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.scheduler = AsyncIOScheduler()
        self.processor = ImportProcessor()
        
        # Repositories
        self.customer_repo = CustomerRepository(db)
        self.vehicle_repo = VehicleRepository(db)
        self.source_repo = DataSourceRepository(db)
        
        self._is_running = False
        self._current_refresh_task: Optional[asyncio.Task] = None
    
    async def initialize(self):
        """Initialize repositories and indexes"""
        await self.customer_repo.create_indexes()
        await self.vehicle_repo.create_indexes()
        await self.source_repo.create_indexes()
        logger.info("Scheduler repositories initialized")
    
    def start(self):
        """Start the scheduler"""
        if not self._is_running:
            # Mon-Sat at 10:00 AM (America/New_York)
            self.scheduler.add_job(
                self._scheduled_refresh,
                CronTrigger(
                    day_of_week='mon-sat',
                    hour=10,
                    minute=0,
                    timezone='America/New_York'
                ),
                id='weekday_refresh',
                replace_existing=True,
                name='Weekday Data Refresh (Mon-Sat 10 AM ET)'
            )
            
            self.scheduler.start()
            self._is_running = True
            logger.info("Data refresh scheduler started")
    
    def stop(self):
        """Stop the scheduler"""
        if self._is_running:
            if self._current_refresh_task:
                self._current_refresh_task.cancel()
            self.scheduler.shutdown(wait=False)
            self._is_running = False
            logger.info("Data refresh scheduler stopped")
    
    async def _scheduled_refresh(self):
        """Execute scheduled refresh for all active sources"""
        logger.info("Starting scheduled data refresh...")
        
        try:
            # Get sources with weekday schedule
            sources = await self.source_repo.find_due_for_refresh(
                RefreshSchedule.WEEKDAYS_10AM
            )
            
            if not sources:
                logger.info("No sources configured for scheduled refresh")
                return
            
            logger.info(f"Refreshing {len(sources)} data sources")
            
            for source in sources:
                try:
                    await self._refresh_source_with_retry(source)
                except Exception as e:
                    logger.error(f"Failed to refresh source {source.get('name')}: {e}")
            
            logger.info("Scheduled refresh complete")
            
        except Exception as e:
            logger.exception(f"Scheduled refresh error: {e}")
    
    async def _refresh_source_with_retry(
        self,
        source: Dict,
        retry_count: int = 0
    ):
        """Refresh a source with retry logic"""
        source_id = source.get('id')
        source_name = source.get('name', 'Unknown')
        url = source.get('url')
        data_type = source.get('data_type', 'customers')
        custom_mapping = source.get('field_mapping_overrides', {})
        
        if not url:
            logger.warning(f"Source {source_name} has no URL, skipping")
            return
        
        logger.info(f"Refreshing source: {source_name} (attempt {retry_count + 1})")
        
        try:
            # Import data
            result = await self.processor.import_from_url(
                url,
                data_type,
                custom_mapping
            )
            
            if result.success:
                # Upsert to database
                if data_type == 'customers':
                    stats = await self.customer_repo.upsert_from_import(
                        result.customers,
                        source_id
                    )
                else:
                    stats = await self.vehicle_repo.upsert_from_import(
                        result.vehicles,
                        source_id
                    )
                
                # Update source status
                await self.source_repo.update_refresh_status(
                    source_id,
                    success=True,
                    stats={
                        "total": result.total_rows,
                        "imported": result.imported_count,
                        "inserted": stats.get('inserted', 0),
                        "updated": stats.get('updated', 0),
                        "skipped": result.skipped_count
                    }
                )
                
                logger.info(f"Source {source_name} refreshed successfully: {stats}")
                
            else:
                # Handle failure with retry
                if retry_count < self.MAX_RETRIES:
                    delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
                    logger.warning(
                        f"Source {source_name} failed, retrying in {delay}s. "
                        f"Errors: {result.errors[:3]}"
                    )
                    await asyncio.sleep(delay)
                    await self._refresh_source_with_retry(source, retry_count + 1)
                else:
                    # Max retries exceeded
                    await self.source_repo.update_refresh_status(
                        source_id,
                        success=False,
                        stats={"total": 0, "imported": 0},
                        errors=result.errors[:10]
                    )
                    logger.error(f"Source {source_name} failed after {self.MAX_RETRIES} retries")
                    
        except Exception as e:
            logger.exception(f"Error refreshing source {source_name}: {e}")
            
            if retry_count < self.MAX_RETRIES:
                delay = self.BASE_RETRY_DELAY * (2 ** retry_count)
                await asyncio.sleep(delay)
                await self._refresh_source_with_retry(source, retry_count + 1)
            else:
                await self.source_repo.update_refresh_status(
                    source_id,
                    success=False,
                    stats={"total": 0, "imported": 0},
                    errors=[str(e)]
                )
    
    async def manual_refresh(self, source_id: str) -> Dict:
        """
        Manually trigger refresh for a specific source
        
        Returns:
            {
                "success": bool,
                "stats": {...},
                "errors": [...]
            }
        """
        source = await self.source_repo.find_by_id(source_id)
        
        if not source:
            return {"success": False, "errors": ["Data source not found"]}
        
        url = source.get('url')
        if not url:
            return {"success": False, "errors": ["Data source has no URL configured"]}
        
        data_type = source.get('data_type', 'customers')
        custom_mapping = source.get('field_mapping_overrides', {})
        
        logger.info(f"Manual refresh triggered for: {source.get('name')}")
        
        try:
            result = await self.processor.import_from_url(
                url,
                data_type,
                custom_mapping
            )
            
            if result.success:
                # Upsert to database
                if data_type == 'customers':
                    stats = await self.customer_repo.upsert_from_import(
                        result.customers,
                        source_id
                    )
                else:
                    stats = await self.vehicle_repo.upsert_from_import(
                        result.vehicles,
                        source_id
                    )
                
                full_stats = {
                    "total": result.total_rows,
                    "imported": result.imported_count,
                    "inserted": stats.get('inserted', 0),
                    "updated": stats.get('updated', 0),
                    "skipped": result.skipped_count
                }
                
                await self.source_repo.update_refresh_status(
                    source_id,
                    success=True,
                    stats=full_stats
                )
                
                return {
                    "success": True,
                    "stats": full_stats,
                    "errors": result.errors[:5],
                    "warnings": result.warnings[:5]
                }
            else:
                await self.source_repo.update_refresh_status(
                    source_id,
                    success=False,
                    stats={"total": 0, "imported": 0},
                    errors=result.errors[:10]
                )
                
                return {
                    "success": False,
                    "stats": {"total": 0, "imported": 0},
                    "errors": result.errors
                }
                
        except Exception as e:
            logger.exception(f"Manual refresh error: {e}")
            
            await self.source_repo.update_refresh_status(
                source_id,
                success=False,
                stats={"total": 0, "imported": 0},
                errors=[str(e)]
            )
            
            return {
                "success": False,
                "errors": [str(e)]
            }
    
    async def refresh_all_now(self) -> Dict:
        """Trigger immediate refresh of all active sources"""
        sources = await self.source_repo.find_active()
        
        results = {
            "total": len(sources),
            "successful": 0,
            "failed": 0,
            "details": []
        }
        
        for source in sources:
            result = await self.manual_refresh(source.get('id'))
            
            if result.get('success'):
                results['successful'] += 1
            else:
                results['failed'] += 1
            
            results['details'].append({
                "name": source.get('name'),
                "success": result.get('success'),
                "stats": result.get('stats', {}),
                "errors": result.get('errors', [])[:3]
            })
        
        return results
    
    def get_next_scheduled_refresh(self) -> Optional[datetime]:
        """Get the next scheduled refresh time"""
        if self._is_running:
            job = self.scheduler.get_job('weekday_refresh')
            if job and job.next_run_time:
                return job.next_run_time
        return None
    
    def get_status(self) -> Dict:
        """Get scheduler status"""
        next_refresh = self.get_next_scheduled_refresh()
        
        return {
            "isRunning": self._is_running,
            "nextRefresh": next_refresh.isoformat() if next_refresh else None,
            "schedule": "Mon-Sat 10:00 AM ET"
        }


# Global scheduler instance
_scheduler: Optional[DataRefreshScheduler] = None


def get_scheduler() -> Optional[DataRefreshScheduler]:
    """Get the global scheduler instance"""
    return _scheduler


async def init_scheduler(db: AsyncIOMotorDatabase) -> DataRefreshScheduler:
    """Initialize and return the global scheduler"""
    global _scheduler
    _scheduler = DataRefreshScheduler(db)
    await _scheduler.initialize()
    _scheduler.start()
    return _scheduler


def shutdown_scheduler():
    """Shutdown the global scheduler"""
    global _scheduler
    if _scheduler:
        _scheduler.stop()
        _scheduler = None
