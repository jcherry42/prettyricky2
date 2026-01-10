"""
Webhook Receiver
Handles incoming webhooks from CRM systems
"""

import logging
import uuid
import json
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase

from ..base import verify_webhook_signature

logger = logging.getLogger(__name__)


class WebhookEventType(str, Enum):
    """Standard webhook event types"""
    # Customer/Lead events
    LEAD_CREATED = "lead.created"
    LEAD_UPDATED = "lead.updated"
    LEAD_DELETED = "lead.deleted"
    LEAD_STATUS_CHANGED = "lead.status_changed"
    LEAD_ASSIGNED = "lead.assigned"
    
    # Customer events
    CUSTOMER_CREATED = "customer.created"
    CUSTOMER_UPDATED = "customer.updated"
    CUSTOMER_DELETED = "customer.deleted"
    
    # Vehicle events
    VEHICLE_ADDED = "vehicle.added"
    VEHICLE_UPDATED = "vehicle.updated"
    VEHICLE_SOLD = "vehicle.sold"
    VEHICLE_REMOVED = "vehicle.removed"
    
    # Deal events
    DEAL_CREATED = "deal.created"
    DEAL_UPDATED = "deal.updated"
    DEAL_CLOSED = "deal.closed"
    
    # Activity events
    TASK_CREATED = "task.created"
    TASK_COMPLETED = "task.completed"
    NOTE_ADDED = "note.added"
    
    # Generic
    PING = "ping"
    UNKNOWN = "unknown"


@dataclass
class WebhookConfig:
    """Configuration for a webhook endpoint"""
    id: str
    integration_id: str  # Links to the integration this webhook belongs to
    name: str
    
    # Security
    secret: str  # HMAC secret for signature verification
    signature_header: str = "X-Webhook-Signature"
    signature_algorithm: str = "sha256"
    
    # Event filtering
    enabled_events: List[str] = field(default_factory=list)  # Empty = all events
    
    # Processing
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Stats
    events_received: int = 0
    events_processed: int = 0
    last_event_at: Optional[datetime] = None


@dataclass
class WebhookEvent:
    """A received webhook event"""
    id: str
    webhook_id: str
    integration_id: str
    
    # Event details
    event_type: WebhookEventType
    raw_event_type: str  # Original event type from source
    payload: Dict[str, Any]
    
    # Metadata
    received_at: datetime
    processed_at: Optional[datetime] = None
    processing_status: str = "pending"  # pending, processing, success, failed
    processing_error: Optional[str] = None
    
    # Source info
    source_ip: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)


class WebhookReceiver:
    """
    Webhook receiver and processor
    
    Handles:
    - Webhook registration
    - Signature verification
    - Event parsing and normalization
    - Event processing/routing
    """
    
    WEBHOOKS_COLLECTION = "webhooks"
    EVENTS_COLLECTION = "webhook_events"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.webhooks = db[self.WEBHOOKS_COLLECTION]
        self.events = db[self.EVENTS_COLLECTION]
        
        # Event type mapping from various CRMs to standard types
        self._event_type_map: Dict[str, WebhookEventType] = {
            # VinSolutions
            "lead_created": WebhookEventType.LEAD_CREATED,
            "lead_updated": WebhookEventType.LEAD_UPDATED,
            "LeadCreated": WebhookEventType.LEAD_CREATED,
            "LeadUpdated": WebhookEventType.LEAD_UPDATED,
            
            # DealerSocket
            "NEW_LEAD": WebhookEventType.LEAD_CREATED,
            "LEAD_UPDATE": WebhookEventType.LEAD_UPDATED,
            "LEAD_STATUS_CHANGE": WebhookEventType.LEAD_STATUS_CHANGED,
            
            # elead
            "prospect.created": WebhookEventType.LEAD_CREATED,
            "prospect.updated": WebhookEventType.LEAD_UPDATED,
            "prospect.status_changed": WebhookEventType.LEAD_STATUS_CHANGED,
            
            # Generic
            "customer.created": WebhookEventType.CUSTOMER_CREATED,
            "customer.updated": WebhookEventType.CUSTOMER_UPDATED,
            "vehicle.created": WebhookEventType.VEHICLE_ADDED,
            "vehicle.updated": WebhookEventType.VEHICLE_UPDATED,
            "vehicle.sold": WebhookEventType.VEHICLE_SOLD,
            
            # Ping/health
            "ping": WebhookEventType.PING,
            "test": WebhookEventType.PING,
        }
        
        # Event handlers
        self._handlers: Dict[WebhookEventType, List[Callable]] = {}
    
    async def create_indexes(self):
        """Create database indexes"""
        await self.webhooks.create_index("integration_id")
        await self.webhooks.create_index("is_active")
        await self.events.create_index("webhook_id")
        await self.events.create_index("event_type")
        await self.events.create_index("processing_status")
        await self.events.create_index("received_at")
        # TTL index - auto-delete events after 30 days
        await self.events.create_index("received_at", expireAfterSeconds=30*24*60*60)
    
    # ==================== WEBHOOK MANAGEMENT ====================
    
    async def register_webhook(
        self,
        integration_id: str,
        name: str,
        secret: Optional[str] = None,
        enabled_events: Optional[List[str]] = None,
        signature_header: str = "X-Webhook-Signature",
        signature_algorithm: str = "sha256",
    ) -> WebhookConfig:
        """
        Register a new webhook endpoint
        
        Returns:
            WebhookConfig with generated ID and secret
        """
        webhook_id = str(uuid.uuid4())
        
        # Generate secret if not provided
        if not secret:
            secret = str(uuid.uuid4()).replace('-', '')
        
        config = WebhookConfig(
            id=webhook_id,
            integration_id=integration_id,
            name=name,
            secret=secret,
            signature_header=signature_header,
            signature_algorithm=signature_algorithm,
            enabled_events=enabled_events or [],
        )
        
        await self.webhooks.insert_one({
            "_id": webhook_id,
            "integration_id": integration_id,
            "name": name,
            "secret": secret,  # TODO: Encrypt in production
            "signature_header": signature_header,
            "signature_algorithm": signature_algorithm,
            "enabled_events": config.enabled_events,
            "is_active": True,
            "created_at": config.created_at,
            "events_received": 0,
            "events_processed": 0,
            "last_event_at": None,
        })
        
        return config
    
    async def get_webhook(self, webhook_id: str) -> Optional[WebhookConfig]:
        """Get webhook configuration by ID"""
        doc = await self.webhooks.find_one({"_id": webhook_id})
        if not doc:
            return None
        
        return WebhookConfig(
            id=doc["_id"],
            integration_id=doc["integration_id"],
            name=doc["name"],
            secret=doc["secret"],
            signature_header=doc.get("signature_header", "X-Webhook-Signature"),
            signature_algorithm=doc.get("signature_algorithm", "sha256"),
            enabled_events=doc.get("enabled_events", []),
            is_active=doc.get("is_active", True),
            created_at=doc.get("created_at"),
            events_received=doc.get("events_received", 0),
            events_processed=doc.get("events_processed", 0),
            last_event_at=doc.get("last_event_at"),
        )
    
    async def list_webhooks(
        self,
        integration_id: Optional[str] = None,
        active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """List webhooks"""
        query = {}
        if integration_id:
            query["integration_id"] = integration_id
        if active_only:
            query["is_active"] = True
        
        cursor = self.webhooks.find(query)
        webhooks = []
        
        async for doc in cursor:
            doc["id"] = doc.pop("_id")
            # Remove secret from listing
            doc.pop("secret", None)
            webhooks.append(doc)
        
        return webhooks
    
    async def delete_webhook(self, webhook_id: str) -> bool:
        """Delete a webhook"""
        result = await self.webhooks.delete_one({"_id": webhook_id})
        return result.deleted_count > 0
    
    # ==================== EVENT PROCESSING ====================
    
    async def receive_event(
        self,
        webhook_id: str,
        payload: bytes,
        signature: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Receive and process an incoming webhook event
        
        Args:
            webhook_id: ID of the webhook endpoint
            payload: Raw request body (bytes)
            signature: Signature from header (if provided)
            headers: Request headers
            source_ip: Source IP address
        
        Returns:
            Dict with processing result
        """
        headers = headers or {}
        
        # Get webhook config
        config = await self.get_webhook(webhook_id)
        if not config:
            return {"success": False, "error": "Webhook not found"}
        
        if not config.is_active:
            return {"success": False, "error": "Webhook is disabled"}
        
        # Verify signature if secret is configured
        if config.secret and signature:
            if not verify_webhook_signature(
                payload,
                signature,
                config.secret,
                config.signature_algorithm
            ):
                logger.warning(f"Invalid webhook signature for {webhook_id}")
                return {"success": False, "error": "Invalid signature"}
        
        # Parse payload
        try:
            data = json.loads(payload.decode('utf-8'))
        except json.JSONDecodeError as e:
            return {"success": False, "error": f"Invalid JSON: {str(e)}"}
        
        # Extract event type
        raw_event_type = self._extract_event_type(data, headers)
        event_type = self._normalize_event_type(raw_event_type)
        
        # Check if event is enabled
        if config.enabled_events and raw_event_type not in config.enabled_events:
            # Silently ignore disabled events
            return {"success": True, "message": "Event type not enabled", "ignored": True}
        
        # Create event record
        event = WebhookEvent(
            id=str(uuid.uuid4()),
            webhook_id=webhook_id,
            integration_id=config.integration_id,
            event_type=event_type,
            raw_event_type=raw_event_type,
            payload=data,
            received_at=datetime.now(timezone.utc),
            source_ip=source_ip,
            headers={k: v for k, v in headers.items() if k.lower().startswith('x-')},
        )
        
        # Store event
        await self.events.insert_one({
            "_id": event.id,
            "webhook_id": event.webhook_id,
            "integration_id": event.integration_id,
            "event_type": event.event_type.value,
            "raw_event_type": event.raw_event_type,
            "payload": event.payload,
            "received_at": event.received_at,
            "processed_at": None,
            "processing_status": "pending",
            "source_ip": event.source_ip,
            "headers": event.headers,
        })
        
        # Update webhook stats
        await self.webhooks.update_one(
            {"_id": webhook_id},
            {
                "$inc": {"events_received": 1},
                "$set": {"last_event_at": event.received_at}
            }
        )
        
        # Process event
        result = await self._process_event(event)
        
        return {
            "success": True,
            "event_id": event.id,
            "event_type": event.event_type.value,
            "processed": result.get("processed", False),
        }
    
    async def _process_event(self, event: WebhookEvent) -> Dict[str, Any]:
        """Process a webhook event"""
        try:
            # Update status
            await self.events.update_one(
                {"_id": event.id},
                {"$set": {"processing_status": "processing"}}
            )
            
            # Call registered handlers
            handlers = self._handlers.get(event.event_type, [])
            for handler in handlers:
                try:
                    await handler(event)
                except Exception as e:
                    logger.error(f"Handler error for {event.event_type}: {e}")
            
            # Update status
            await self.events.update_one(
                {"_id": event.id},
                {
                    "$set": {
                        "processing_status": "success",
                        "processed_at": datetime.now(timezone.utc),
                    }
                }
            )
            
            # Update webhook processed count
            await self.webhooks.update_one(
                {"_id": event.webhook_id},
                {"$inc": {"events_processed": 1}}
            )
            
            return {"processed": True}
            
        except Exception as e:
            logger.error(f"Error processing event {event.id}: {e}")
            
            await self.events.update_one(
                {"_id": event.id},
                {
                    "$set": {
                        "processing_status": "failed",
                        "processing_error": str(e),
                    }
                }
            )
            
            return {"processed": False, "error": str(e)}
    
    def _extract_event_type(self, data: Dict[str, Any], headers: Dict[str, str]) -> str:
        """Extract event type from payload or headers"""
        # Check common locations
        for key in ['event', 'event_type', 'type', 'action', 'eventType', 'Action']:
            if key in data:
                return str(data[key])
        
        # Check headers
        for header in ['X-Event-Type', 'X-Webhook-Event', 'X-Github-Event']:
            if header in headers:
                return headers[header]
        
        return "unknown"
    
    def _normalize_event_type(self, raw_type: str) -> WebhookEventType:
        """Normalize event type to standard enum"""
        # Check mapping
        if raw_type in self._event_type_map:
            return self._event_type_map[raw_type]
        
        # Check if it's already a standard type
        raw_lower = raw_type.lower().replace('-', '_').replace('.', '_')
        for event_type in WebhookEventType:
            if event_type.value.replace('.', '_') == raw_lower:
                return event_type
        
        return WebhookEventType.UNKNOWN
    
    # ==================== EVENT HANDLERS ====================
    
    def register_handler(
        self,
        event_type: WebhookEventType,
        handler: Callable
    ):
        """Register an event handler"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    def on_event(self, event_type: WebhookEventType):
        """Decorator to register an event handler"""
        def decorator(func):
            self.register_handler(event_type, func)
            return func
        return decorator
    
    # ==================== EVENT RETRIEVAL ====================
    
    async def get_recent_events(
        self,
        webhook_id: Optional[str] = None,
        integration_id: Optional[str] = None,
        event_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get recent webhook events"""
        query = {}
        if webhook_id:
            query["webhook_id"] = webhook_id
        if integration_id:
            query["integration_id"] = integration_id
        if event_type:
            query["event_type"] = event_type
        if status:
            query["processing_status"] = status
        
        cursor = self.events.find(query).sort("received_at", -1).limit(limit)
        
        events = []
        async for doc in cursor:
            doc["id"] = doc.pop("_id")
            events.append(doc)
        
        return events
