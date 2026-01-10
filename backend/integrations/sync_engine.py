"""
Sync Engine
Manages data synchronization from CRM integrations

Features:
- Delta sync (only fetch changes)
- Full sync capability
- Conflict resolution
- Duplicate detection
- Audit logging
- Sync scheduling
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import uuid

from motor.motor_asyncio import AsyncIOMotorDatabase

from .base import BaseAdapter, FetchResult, SyncStatus

logger = logging.getLogger(__name__)


class ConflictResolution(str, Enum):
    """How to handle conflicts between existing and incoming records"""
    NEWEST_WINS = "newest_wins"  # Keep the record with latest timestamp
    SOURCE_WINS = "source_wins"  # Incoming data always wins
    LOCAL_WINS = "local_wins"  # Existing data always wins
    MERGE = "merge"  # Merge fields, preferring non-null values


@dataclass
class SyncJob:
    """Represents a sync job"""
    id: str
    integration_id: str
    data_type: str  # "customers" or "vehicles"
    
    # Sync configuration
    full_sync: bool = False  # If True, fetch all data. If False, delta sync.
    conflict_resolution: ConflictResolution = ConflictResolution.SOURCE_WINS
    
    # Status
    status: SyncStatus = SyncStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Results
    records_fetched: int = 0
    records_created: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    records_failed: int = 0
    
    # Errors
    errors: List[Dict[str, Any]] = field(default_factory=list)
    
    # Progress (for long-running syncs)
    progress_percent: float = 0.0
    current_page: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "integration_id": self.integration_id,
            "data_type": self.data_type,
            "full_sync": self.full_sync,
            "status": self.status.value,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "records_fetched": self.records_fetched,
            "records_created": self.records_created,
            "records_updated": self.records_updated,
            "records_skipped": self.records_skipped,
            "records_failed": self.records_failed,
            "error_count": len(self.errors),
            "progress_percent": self.progress_percent,
        }


@dataclass
class SyncResult:
    """Result of a sync operation"""
    job: SyncJob
    success: bool
    message: str
    duration_ms: int = 0


class SyncEngine:
    """
    Sync Engine for managing data synchronization
    
    Handles:
    - Delta sync (only changes since last sync)
    - Full sync (all data)
    - Deduplication
    - Conflict resolution
    - Audit logging
    """
    
    SYNC_JOBS_COLLECTION = "sync_jobs"
    SYNC_AUDIT_COLLECTION = "sync_audit"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.jobs = db[self.SYNC_JOBS_COLLECTION]
        self.audit = db[self.SYNC_AUDIT_COLLECTION]
        
        # Running jobs
        self._running_jobs: Dict[str, SyncJob] = {}
    
    async def create_indexes(self):
        """Create database indexes"""
        await self.jobs.create_index("integration_id")
        await self.jobs.create_index("status")
        await self.jobs.create_index("started_at")
        await self.audit.create_index("sync_job_id")
        await self.audit.create_index("timestamp")
        # TTL index - keep audit logs for 90 days
        await self.audit.create_index("timestamp", expireAfterSeconds=90*24*60*60)
    
    async def start_sync(
        self,
        adapter: BaseAdapter,
        data_type: str = "customers",
        full_sync: bool = False,
        conflict_resolution: ConflictResolution = ConflictResolution.SOURCE_WINS,
    ) -> SyncJob:
        """
        Start a sync job
        
        Args:
            adapter: The CRM adapter to sync from
            data_type: "customers" or "vehicles"
            full_sync: If True, fetch all data. If False, only changes.
            conflict_resolution: How to handle conflicts
        
        Returns:
            SyncJob with progress tracking
        """
        job = SyncJob(
            id=str(uuid.uuid4()),
            integration_id=adapter.config.id,
            data_type=data_type,
            full_sync=full_sync,
            conflict_resolution=conflict_resolution,
            status=SyncStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        
        # Store job
        await self.jobs.insert_one({
            "_id": job.id,
            **job.to_dict(),
        })
        
        self._running_jobs[job.id] = job
        
        # Log audit
        await self._log_audit(job.id, "sync_started", {
            "integration_id": adapter.config.id,
            "data_type": data_type,
            "full_sync": full_sync,
        })
        
        try:
            # Get last sync time for delta sync
            since = None
            if not full_sync:
                since = await self._get_last_sync_time(adapter.config.id, data_type)
            
            # Fetch data
            if data_type == "customers":
                result = await adapter.fetch_customers(since=since)
            else:
                result = await adapter.fetch_vehicles(since=since)
            
            job.records_fetched = len(result.records)
            
            # Process records
            await self._process_records(job, result.records, adapter.config.id)
            
            # Update job status
            job.status = SyncStatus.SUCCESS if not result.errors else SyncStatus.PARTIAL
            job.completed_at = datetime.now(timezone.utc)
            job.progress_percent = 100.0
            
            # Add any fetch errors
            for error in result.errors:
                job.errors.append(error)
            
        except Exception as e:
            logger.error(f"Sync job {job.id} failed: {e}")
            job.status = SyncStatus.FAILED
            job.completed_at = datetime.now(timezone.utc)
            job.errors.append({
                "message": str(e),
                "type": "sync_error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        
        finally:
            # Update job in database
            await self.jobs.update_one(
                {"_id": job.id},
                {"$set": job.to_dict()}
            )
            
            # Remove from running jobs
            self._running_jobs.pop(job.id, None)
            
            # Log completion
            await self._log_audit(job.id, "sync_completed", {
                "status": job.status.value,
                "records_fetched": job.records_fetched,
                "records_created": job.records_created,
                "records_updated": job.records_updated,
            })
            
            # Update integration last sync time
            await self._update_last_sync_time(adapter.config.id, data_type)
        
        return job
    
    async def _process_records(
        self,
        job: SyncJob,
        records: List[Dict[str, Any]],
        source_id: str,
    ):
        """Process and store synced records"""
        collection_name = job.data_type
        collection = self.db[collection_name]
        
        for i, record in enumerate(records):
            try:
                # Update progress
                job.progress_percent = (i + 1) / len(records) * 100
                
                # Get unique identifier
                source_row_id = record.get("source_row_id")
                if not source_row_id:
                    # Try other identifiers
                    source_row_id = record.get("id") or record.get("vin") or record.get("email")
                
                if not source_row_id:
                    job.records_skipped += 1
                    continue
                
                # Check for existing record
                existing = await collection.find_one({
                    "source_id": source_id,
                    "source_row_id": source_row_id,
                })
                
                if existing:
                    # Handle conflict resolution
                    should_update = self._should_update(existing, record, job.conflict_resolution)
                    
                    if should_update:
                        # Merge or replace
                        if job.conflict_resolution == ConflictResolution.MERGE:
                            merged = self._merge_records(existing, record)
                            await collection.update_one(
                                {"_id": existing["_id"]},
                                {"$set": merged}
                            )
                        else:
                            record["_id"] = existing["_id"]
                            record["created_at"] = existing.get("created_at")
                            record["updated_at"] = datetime.now(timezone.utc)
                            await collection.replace_one(
                                {"_id": existing["_id"]},
                                record
                            )
                        job.records_updated += 1
                    else:
                        job.records_skipped += 1
                else:
                    # Insert new record
                    record["source_id"] = source_id
                    record["created_at"] = datetime.now(timezone.utc)
                    record["updated_at"] = record["created_at"]
                    await collection.insert_one(record)
                    job.records_created += 1
                    
            except Exception as e:
                logger.error(f"Failed to process record: {e}")
                job.records_failed += 1
                job.errors.append({
                    "message": str(e),
                    "record_id": str(record.get("source_row_id", "unknown")),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
    
    def _should_update(
        self,
        existing: Dict[str, Any],
        incoming: Dict[str, Any],
        resolution: ConflictResolution,
    ) -> bool:
        """Determine if existing record should be updated"""
        if resolution == ConflictResolution.SOURCE_WINS:
            return True
        elif resolution == ConflictResolution.LOCAL_WINS:
            return False
        elif resolution == ConflictResolution.NEWEST_WINS:
            existing_time = existing.get("updated_at") or existing.get("created_at")
            incoming_time = incoming.get("_imported_at")
            
            if existing_time and incoming_time:
                if isinstance(existing_time, str):
                    existing_time = datetime.fromisoformat(existing_time.replace('Z', '+00:00'))
                if isinstance(incoming_time, str):
                    incoming_time = datetime.fromisoformat(incoming_time.replace('Z', '+00:00'))
                return incoming_time > existing_time
            return True
        elif resolution == ConflictResolution.MERGE:
            return True
        
        return True
    
    def _merge_records(
        self,
        existing: Dict[str, Any],
        incoming: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Merge two records, preferring non-null incoming values"""
        merged = existing.copy()
        
        for key, value in incoming.items():
            if key.startswith("_"):
                continue
            if value is not None and value != "":
                merged[key] = value
        
        merged["updated_at"] = datetime.now(timezone.utc)
        return merged
    
    async def _get_last_sync_time(
        self,
        integration_id: str,
        data_type: str,
    ) -> Optional[datetime]:
        """Get the last successful sync time for an integration"""
        last_job = await self.jobs.find_one(
            {
                "integration_id": integration_id,
                "data_type": data_type,
                "status": {"$in": ["success", "partial"]},
            },
            sort=[("completed_at", -1)]
        )
        
        if last_job and last_job.get("completed_at"):
            return last_job["completed_at"]
        return None
    
    async def _update_last_sync_time(
        self,
        integration_id: str,
        data_type: str,
    ):
        """Update the last sync time in the integrations collection"""
        await self.db["integrations"].update_one(
            {"_id": integration_id},
            {
                "$set": {
                    f"last_sync_{data_type}": datetime.now(timezone.utc),
                }
            }
        )
    
    async def _log_audit(
        self,
        sync_job_id: str,
        action: str,
        details: Dict[str, Any],
    ):
        """Log sync audit entry"""
        await self.audit.insert_one({
            "sync_job_id": sync_job_id,
            "action": action,
            "details": details,
            "timestamp": datetime.now(timezone.utc),
        })
    
    async def get_job(self, job_id: str) -> Optional[SyncJob]:
        """Get a sync job by ID"""
        # Check running jobs first
        if job_id in self._running_jobs:
            return self._running_jobs[job_id]
        
        # Check database
        doc = await self.jobs.find_one({"_id": job_id})
        if not doc:
            return None
        
        return SyncJob(
            id=doc["_id"],
            integration_id=doc["integration_id"],
            data_type=doc["data_type"],
            full_sync=doc.get("full_sync", False),
            status=SyncStatus(doc["status"]),
            started_at=doc.get("started_at"),
            completed_at=doc.get("completed_at"),
            records_fetched=doc.get("records_fetched", 0),
            records_created=doc.get("records_created", 0),
            records_updated=doc.get("records_updated", 0),
            records_skipped=doc.get("records_skipped", 0),
            records_failed=doc.get("records_failed", 0),
            errors=doc.get("errors", []),
            progress_percent=doc.get("progress_percent", 0),
        )
    
    async def list_jobs(
        self,
        integration_id: Optional[str] = None,
        status: Optional[SyncStatus] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """List sync jobs"""
        query = {}
        if integration_id:
            query["integration_id"] = integration_id
        if status:
            query["status"] = status.value
        
        cursor = self.jobs.find(query).sort("started_at", -1).limit(limit)
        
        jobs = []
        async for doc in cursor:
            doc["id"] = doc.pop("_id")
            jobs.append(doc)
        
        return jobs
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a running sync job"""
        if job_id in self._running_jobs:
            job = self._running_jobs[job_id]
            job.status = SyncStatus.CANCELLED
            job.completed_at = datetime.now(timezone.utc)
            
            await self.jobs.update_one(
                {"_id": job_id},
                {"$set": job.to_dict()}
            )
            
            self._running_jobs.pop(job_id, None)
            return True
        
        return False
