"""
Webhook Event Processing Module
Real-time event queue and processing pipeline for CRM data pushes
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any, Callable
from enum import Enum
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
import asyncio
import logging
import json

logger = logging.getLogger(__name__)


class EventStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class EventType(str, Enum):
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_DELETED = "customer.deleted"
    VEHICLE_CREATED = "vehicle.created"
    VEHICLE_UPDATED = "vehicle.updated"
    VEHICLE_DELETED = "vehicle.deleted"
    LEAD_STATUS_CHANGED = "lead.status_changed"
    DEAL_CREATED = "deal.created"
    DEAL_UPDATED = "deal.updated"
    SYNC_COMPLETED = "sync.completed"
    INTEGRATION_HEALTH = "integration.health"


class WebhookEvent(BaseModel):
    """Model for webhook events"""
    webhook_id: str
    integration_id: Optional[str] = None
    event_type: str
    payload: Dict[str, Any]
    source: str = "unknown"
    idempotency_key: Optional[str] = None


class ProcessedEvent(BaseModel):
    """Model for processed event response"""
    id: str
    webhook_id: str
    event_type: str
    status: EventStatus
    processed_at: Optional[datetime] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int = 0


class WebhookEventProcessor:
    """
    Event processing pipeline for webhook events
    Handles queueing, processing, retries, and dead letter queue
    """
    
    MAX_RETRIES = 3
    RETRY_DELAYS = [60, 300, 900]  # 1min, 5min, 15min
    BATCH_SIZE = 50
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.events_collection = db.webhook_events
        self.dlq_collection = db.webhook_dlq  # Dead letter queue
        self.handlers: Dict[str, List[Callable]] = {}
        self._processing = False
        self._processor_task: Optional[asyncio.Task] = None
    
    async def initialize(self):
        """Initialize indexes and start processor"""
        try:
            # Indexes for efficient queries
            await self.events_collection.create_index("status")
            await self.events_collection.create_index("event_type")
            await self.events_collection.create_index("created_at")
            await self.events_collection.create_index("webhook_id")
            await self.events_collection.create_index(
                "idempotency_key",
                unique=True,
                sparse=True
            )
            
            # TTL index for old completed events (30 days)
            await self.events_collection.create_index(
                "completed_at",
                expireAfterSeconds=30 * 24 * 3600,
                partialFilterExpression={"status": EventStatus.COMPLETED}
            )
            
            logger.info("Webhook event processor initialized")
        except Exception as e:
            logger.warning(f"Event processor init warning: {e}")
    
    def register_handler(self, event_type: str, handler: Callable):
        """Register a handler for an event type"""
        if event_type not in self.handlers:
            self.handlers[event_type] = []
        self.handlers[event_type].append(handler)
        logger.info(f"Registered handler for {event_type}")
    
    async def enqueue_event(self, event: WebhookEvent) -> str:
        """Add event to processing queue"""
        now = datetime.now(timezone.utc)
        
        # Check idempotency
        if event.idempotency_key:
            existing = await self.events_collection.find_one({
                "idempotency_key": event.idempotency_key
            })
            if existing:
                logger.info(f"Duplicate event ignored: {event.idempotency_key}")
                return str(existing["_id"])
        
        doc = {
            "webhook_id": event.webhook_id,
            "integration_id": event.integration_id,
            "event_type": event.event_type,
            "payload": event.payload,
            "source": event.source,
            "idempotency_key": event.idempotency_key,
            "status": EventStatus.PENDING,
            "retry_count": 0,
            "created_at": now,
            "updated_at": now,
            "next_retry_at": None,
            "processed_at": None,
            "completed_at": None,
            "result": None,
            "error": None,
        }
        
        result = await self.events_collection.insert_one(doc)
        event_id = str(result.inserted_id)
        
        logger.info(f"Event enqueued: {event_id} ({event.event_type})")
        
        # Trigger immediate processing for real-time events
        asyncio.create_task(self._process_single_event(event_id))
        
        return event_id
    
    async def _process_single_event(self, event_id: str):
        """Process a single event immediately"""
        from bson import ObjectId
        
        try:
            # Atomically claim the event
            event = await self.events_collection.find_one_and_update(
                {
                    "_id": ObjectId(event_id),
                    "status": {"$in": [EventStatus.PENDING, EventStatus.RETRYING]}
                },
                {
                    "$set": {
                        "status": EventStatus.PROCESSING,
                        "updated_at": datetime.now(timezone.utc)
                    }
                },
                return_document=True
            )
            
            if not event:
                return
            
            # Process the event
            await self._execute_handlers(event)
            
        except Exception as e:
            logger.error(f"Error processing event {event_id}: {e}")
    
    async def _execute_handlers(self, event: Dict[str, Any]):
        """Execute all handlers for an event"""
        from bson import ObjectId
        
        event_type = event["event_type"]
        event_id = event["_id"]
        
        handlers = self.handlers.get(event_type, [])
        
        # Also check for wildcard handlers
        handlers.extend(self.handlers.get("*", []))
        
        if not handlers:
            # No handlers, mark as completed
            await self.events_collection.update_one(
                {"_id": event_id},
                {
                    "$set": {
                        "status": EventStatus.COMPLETED,
                        "completed_at": datetime.now(timezone.utc),
                        "result": {"message": "No handlers registered"},
                        "updated_at": datetime.now(timezone.utc)
                    }
                }
            )
            return
        
        results = []
        errors = []
        
        for handler in handlers:
            try:
                result = await handler(event["payload"], event)
                results.append(result)
            except Exception as e:
                logger.error(f"Handler error for {event_type}: {e}")
                errors.append(str(e))
        
        now = datetime.now(timezone.utc)
        
        if errors and not results:
            # All handlers failed
            retry_count = event.get("retry_count", 0)
            
            if retry_count < self.MAX_RETRIES:
                # Schedule retry
                delay = self.RETRY_DELAYS[min(retry_count, len(self.RETRY_DELAYS) - 1)]
                next_retry = now + timedelta(seconds=delay)
                
                await self.events_collection.update_one(
                    {"_id": event_id},
                    {
                        "$set": {
                            "status": EventStatus.RETRYING,
                            "retry_count": retry_count + 1,
                            "next_retry_at": next_retry,
                            "error": "; ".join(errors),
                            "updated_at": now
                        }
                    }
                )
                logger.warning(f"Event {event_id} scheduled for retry {retry_count + 1}")
            else:
                # Move to dead letter queue
                await self._move_to_dlq(event, errors)
        else:
            # Success (at least one handler succeeded)
            await self.events_collection.update_one(
                {"_id": event_id},
                {
                    "$set": {
                        "status": EventStatus.COMPLETED,
                        "completed_at": now,
                        "processed_at": now,
                        "result": {"handler_results": results, "errors": errors},
                        "updated_at": now
                    }
                }
            )
            logger.info(f"Event {event_id} processed successfully")
    
    async def _move_to_dlq(self, event: Dict[str, Any], errors: List[str]):
        """Move failed event to dead letter queue"""
        event_id = event["_id"]
        now = datetime.now(timezone.utc)
        
        dlq_doc = {
            **event,
            "original_id": event_id,
            "moved_to_dlq_at": now,
            "final_error": "; ".join(errors),
        }
        del dlq_doc["_id"]
        
        await self.dlq_collection.insert_one(dlq_doc)
        
        await self.events_collection.update_one(
            {"_id": event_id},
            {
                "$set": {
                    "status": EventStatus.FAILED,
                    "error": "; ".join(errors),
                    "updated_at": now
                }
            }
        )
        
        logger.error(f"Event {event_id} moved to DLQ after {self.MAX_RETRIES} retries")
    
    async def process_pending_events(self):
        """Process all pending and retry-due events"""
        now = datetime.now(timezone.utc)
        
        # Find events ready for processing
        cursor = self.events_collection.find({
            "$or": [
                {"status": EventStatus.PENDING},
                {
                    "status": EventStatus.RETRYING,
                    "next_retry_at": {"$lte": now}
                }
            ]
        }).limit(self.BATCH_SIZE)
        
        async for event in cursor:
            await self._process_single_event(str(event["_id"]))
    
    async def start_background_processor(self, interval: int = 30):
        """Start background processor for retry events"""
        self._processing = True
        
        async def processor_loop():
            while self._processing:
                try:
                    await self.process_pending_events()
                except Exception as e:
                    logger.error(f"Background processor error: {e}")
                await asyncio.sleep(interval)
        
        self._processor_task = asyncio.create_task(processor_loop())
        logger.info("Background event processor started")
    
    async def stop_background_processor(self):
        """Stop background processor"""
        self._processing = False
        if self._processor_task:
            self._processor_task.cancel()
            try:
                await self._processor_task
            except asyncio.CancelledError:
                pass
        logger.info("Background event processor stopped")
    
    async def get_event_stats(self) -> Dict[str, Any]:
        """Get event processing statistics"""
        pipeline = [
            {
                "$facet": {
                    "by_status": [
                        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
                    ],
                    "by_type": [
                        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}},
                        {"$limit": 10}
                    ],
                    "recent_24h": [
                        {
                            "$match": {
                                "created_at": {
                                    "$gte": datetime.now(timezone.utc) - timedelta(hours=24)
                                }
                            }
                        },
                        {"$count": "count"}
                    ],
                    "avg_processing_time": [
                        {"$match": {"processed_at": {"$ne": None}}},
                        {
                            "$project": {
                                "duration": {
                                    "$subtract": ["$processed_at", "$created_at"]
                                }
                            }
                        },
                        {
                            "$group": {
                                "_id": None,
                                "avg_ms": {"$avg": "$duration"}
                            }
                        }
                    ],
                    "dlq_count": [
                        {"$match": {"status": EventStatus.FAILED}},
                        {"$count": "count"}
                    ]
                }
            }
        ]
        
        result = await self.events_collection.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}
        
        # Safely extract values from aggregation results
        recent_24h_list = data.get("recent_24h", [])
        events_24h = recent_24h_list[0].get("count", 0) if recent_24h_list else 0
        
        avg_processing_list = data.get("avg_processing_time", [])
        avg_processing_ms = round(avg_processing_list[0].get("avg_ms", 0), 2) if avg_processing_list else 0
        
        dlq_count_list = data.get("dlq_count", [])
        dlq_count = dlq_count_list[0].get("count", 0) if dlq_count_list else 0
        
        return {
            "status_breakdown": {item["_id"]: item["count"] for item in data.get("by_status", [])},
            "top_event_types": data.get("by_type", []),
            "events_24h": events_24h,
            "avg_processing_ms": avg_processing_ms,
            "dlq_count": dlq_count,
            "registered_handlers": list(self.handlers.keys()),
        }
    
    async def get_dlq_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get events in dead letter queue"""
        cursor = self.dlq_collection.find({}, {"_id": 0}).sort("moved_to_dlq_at", -1).limit(limit)
        return await cursor.to_list(limit)
    
    async def replay_dlq_event(self, original_id: str) -> bool:
        """Replay a dead letter queue event"""
        from bson import ObjectId
        
        dlq_event = await self.dlq_collection.find_one({"original_id": ObjectId(original_id)})
        if not dlq_event:
            return False
        
        # Re-enqueue the event
        event = WebhookEvent(
            webhook_id=dlq_event["webhook_id"],
            integration_id=dlq_event.get("integration_id"),
            event_type=dlq_event["event_type"],
            payload=dlq_event["payload"],
            source=dlq_event.get("source", "dlq_replay"),
        )
        
        await self.enqueue_event(event)
        
        # Remove from DLQ
        await self.dlq_collection.delete_one({"original_id": ObjectId(original_id)})
        
        return True


# Default event handlers
async def handle_customer_event(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    """Default handler for customer events"""
    logger.info(f"Processing customer event: {event['event_type']}")
    # Add custom processing logic here
    return {"processed": True, "event_type": event["event_type"]}


async def handle_vehicle_event(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    """Default handler for vehicle events"""
    logger.info(f"Processing vehicle event: {event['event_type']}")
    # Add custom processing logic here
    return {"processed": True, "event_type": event["event_type"]}


async def handle_sync_event(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    """Default handler for sync events"""
    logger.info(f"Processing sync event: {event['event_type']}")
    return {"processed": True, "event_type": event["event_type"]}
