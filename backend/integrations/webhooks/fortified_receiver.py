"""
Fortified Webhook Receiver
Production-grade webhook handling with multiple authentication methods

Features:
- HMAC signature verification (SHA-256, SHA-512)
- API Key authentication
- OAuth 2.0 Bearer token validation
- IP whitelist support
- Replay attack prevention
- Request logging and audit trail
"""

import logging
import uuid
import json
import hmac
import hashlib
import time
from typing import Dict, List, Any, Optional, Callable, Set
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from enum import Enum

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class WebhookAuthMethod(str, Enum):
    """Supported webhook authentication methods"""
    NONE = "none"
    HMAC_SHA256 = "hmac_sha256"
    HMAC_SHA512 = "hmac_sha512"
    API_KEY = "api_key"
    BEARER_TOKEN = "bearer_token"
    IP_WHITELIST = "ip_whitelist"
    COMBINED = "combined"  # Multiple methods required


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
    
    # System events
    PING = "ping"
    TEST = "test"
    UNKNOWN = "unknown"


@dataclass
class WebhookAuthConfig:
    """Authentication configuration for webhooks"""
    method: WebhookAuthMethod = WebhookAuthMethod.HMAC_SHA256
    
    # HMAC settings
    hmac_secret: Optional[str] = None
    signature_header: str = "X-Webhook-Signature"
    signature_prefix: str = ""  # e.g., "sha256=" for GitHub-style
    
    # API Key settings
    api_key: Optional[str] = None
    api_key_header: str = "X-API-Key"
    
    # Bearer token settings
    bearer_token: Optional[str] = None
    
    # IP whitelist settings
    allowed_ips: Set[str] = field(default_factory=set)
    
    # Combined auth - which methods to require
    required_methods: List[WebhookAuthMethod] = field(default_factory=list)
    
    # Replay attack prevention
    enforce_timestamp: bool = True
    timestamp_header: str = "X-Webhook-Timestamp"
    timestamp_tolerance_seconds: int = 300  # 5 minutes
    
    # Request ID for idempotency
    request_id_header: str = "X-Webhook-ID"


@dataclass
class WebhookConfig:
    """Full webhook endpoint configuration"""
    id: str
    integration_id: str
    name: str
    
    # Authentication
    auth: WebhookAuthConfig = field(default_factory=WebhookAuthConfig)
    
    # Event filtering
    enabled_events: List[str] = field(default_factory=list)  # Empty = all events
    
    # Processing
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Rate limiting
    max_requests_per_minute: int = 100
    
    # Stats
    events_received: int = 0
    events_processed: int = 0
    events_rejected: int = 0
    last_event_at: Optional[datetime] = None
    last_error_at: Optional[datetime] = None
    last_error_message: Optional[str] = None


@dataclass
class WebhookEvent:
    """A received webhook event"""
    id: str
    webhook_id: str
    integration_id: str
    
    # Event details
    event_type: WebhookEventType
    raw_event_type: str
    payload: Dict[str, Any]
    
    # Metadata
    received_at: datetime
    processed_at: Optional[datetime] = None
    processing_status: str = "pending"  # pending, processing, success, failed, rejected
    processing_error: Optional[str] = None
    
    # Source info
    source_ip: Optional[str] = None
    headers: Dict[str, str] = field(default_factory=dict)
    
    # Auth info
    auth_method_used: Optional[str] = None
    auth_valid: bool = False


def verify_hmac_signature(
    payload: bytes,
    signature: str,
    secret: str,
    algorithm: str = "sha256",
    prefix: str = ""
) -> bool:
    """
    Verify HMAC signature
    
    Supports GitHub-style (sha256=...) and plain signatures
    """
    if not signature or not secret:
        return False
    
    # Remove prefix if present
    if prefix and signature.startswith(prefix):
        signature = signature[len(prefix):]
    
    # Calculate expected signature
    if algorithm == "sha512":
        expected = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()
    else:
        expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    
    # Constant-time comparison to prevent timing attacks
    return hmac.compare_digest(signature.lower(), expected.lower())


def verify_api_key(provided_key: Optional[str], expected_key: str) -> bool:
    """Verify API key with constant-time comparison"""
    if not provided_key or not expected_key:
        return False
    return hmac.compare_digest(provided_key, expected_key)


def verify_bearer_token(auth_header: Optional[str], expected_token: str) -> bool:
    """Verify Bearer token"""
    if not auth_header or not expected_token:
        return False
    
    if not auth_header.startswith("Bearer "):
        return False
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    return hmac.compare_digest(token, expected_token)


def verify_ip_whitelist(source_ip: Optional[str], allowed_ips: Set[str]) -> bool:
    """Verify IP is in whitelist"""
    if not source_ip or not allowed_ips:
        return False
    
    # Check exact match
    if source_ip in allowed_ips:
        return True
    
    # Check CIDR ranges (simple implementation)
    for allowed in allowed_ips:
        if '/' in allowed:
            # Basic CIDR check
            network = allowed.split('/')[0]
            if source_ip.startswith(network.rsplit('.', 1)[0]):
                return True
    
    return False


def verify_timestamp(
    timestamp_str: Optional[str],
    tolerance_seconds: int = 300
) -> bool:
    """
    Verify timestamp is within acceptable range
    Prevents replay attacks
    """
    if not timestamp_str:
        return False
    
    try:
        # Try parsing as epoch timestamp
        if timestamp_str.isdigit():
            timestamp = int(timestamp_str)
        else:
            # Try parsing as ISO format
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            timestamp = int(dt.timestamp())
        
        now = int(time.time())
        diff = abs(now - timestamp)
        
        return diff <= tolerance_seconds
    except (ValueError, TypeError):
        return False


class FortifiedWebhookReceiver:
    """
    Production-grade webhook receiver with multiple authentication methods
    
    Features:
    - Multiple auth methods (HMAC, API Key, Bearer Token, IP Whitelist)
    - Replay attack prevention via timestamp validation
    - Request idempotency via request ID tracking
    - Comprehensive audit logging
    - Rate limiting
    """
    
    WEBHOOKS_COLLECTION = "webhooks"
    EVENTS_COLLECTION = "webhook_events"
    PROCESSED_IDS_COLLECTION = "webhook_processed_ids"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.webhooks = db[self.WEBHOOKS_COLLECTION]
        self.events = db[self.EVENTS_COLLECTION]
        self.processed_ids = db[self.PROCESSED_IDS_COLLECTION]
        
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
            
            # CDK
            "customer.new": WebhookEventType.CUSTOMER_CREATED,
            "customer.modified": WebhookEventType.CUSTOMER_UPDATED,
            "vehicle.new": WebhookEventType.VEHICLE_ADDED,
            "vehicle.modified": WebhookEventType.VEHICLE_UPDATED,
            "vehicle.sold": WebhookEventType.VEHICLE_SOLD,
            
            # Generic
            "customer.created": WebhookEventType.CUSTOMER_CREATED,
            "customer.updated": WebhookEventType.CUSTOMER_UPDATED,
            "vehicle.created": WebhookEventType.VEHICLE_ADDED,
            "vehicle.updated": WebhookEventType.VEHICLE_UPDATED,
            
            # System
            "ping": WebhookEventType.PING,
            "test": WebhookEventType.TEST,
        }
        
        # Event handlers
        self._handlers: Dict[WebhookEventType, List[Callable]] = {}
        
        # Rate limiting state (in-memory, use Redis in production)
        self._request_counts: Dict[str, List[float]] = {}
    
    async def create_indexes(self):
        """Create database indexes"""
        await self.webhooks.create_index("integration_id")
        await self.webhooks.create_index("is_active")
        await self.events.create_index("webhook_id")
        await self.events.create_index("event_type")
        await self.events.create_index("processing_status")
        await self.events.create_index([("received_at", -1)])
        # TTL index - auto-delete events after 30 days
        await self.events.create_index("received_at", expireAfterSeconds=30*24*60*60)
        # TTL index for processed IDs - 24 hours for idempotency
        await self.processed_ids.create_index("created_at", expireAfterSeconds=24*60*60)
    
    # ==================== WEBHOOK MANAGEMENT ====================
    
    async def register_webhook(
        self,
        integration_id: str,
        name: str,
        auth_method: WebhookAuthMethod = WebhookAuthMethod.HMAC_SHA256,
        hmac_secret: Optional[str] = None,
        api_key: Optional[str] = None,
        bearer_token: Optional[str] = None,
        allowed_ips: Optional[List[str]] = None,
        enabled_events: Optional[List[str]] = None,
    ) -> WebhookConfig:
        """
        Register a new webhook endpoint
        
        Returns:
            WebhookConfig with generated ID and credentials
        """
        webhook_id = str(uuid.uuid4())
        
        # Generate credentials if not provided
        if not hmac_secret:
            hmac_secret = str(uuid.uuid4()).replace('-', '') + str(uuid.uuid4()).replace('-', '')
        if not api_key:
            api_key = f"whk_{str(uuid.uuid4()).replace('-', '')}"
        if not bearer_token:
            bearer_token = str(uuid.uuid4()).replace('-', '') + str(uuid.uuid4()).replace('-', '')
        
        auth_config = WebhookAuthConfig(
            method=auth_method,
            hmac_secret=hmac_secret,
            api_key=api_key,
            bearer_token=bearer_token,
            allowed_ips=set(allowed_ips) if allowed_ips else set(),
        )
        
        config = WebhookConfig(
            id=webhook_id,
            integration_id=integration_id,
            name=name,
            auth=auth_config,
            enabled_events=enabled_events or [],
        )
        
        await self.webhooks.insert_one({
            "_id": webhook_id,
            "integration_id": integration_id,
            "name": name,
            "auth_method": auth_method.value,
            "hmac_secret": hmac_secret,  # TODO: Encrypt in production
            "api_key": api_key,
            "bearer_token": bearer_token,
            "allowed_ips": list(allowed_ips) if allowed_ips else [],
            "signature_header": auth_config.signature_header,
            "api_key_header": auth_config.api_key_header,
            "timestamp_header": auth_config.timestamp_header,
            "enforce_timestamp": auth_config.enforce_timestamp,
            "enabled_events": config.enabled_events,
            "max_requests_per_minute": config.max_requests_per_minute,
            "is_active": True,
            "created_at": config.created_at,
            "events_received": 0,
            "events_processed": 0,
            "events_rejected": 0,
            "last_event_at": None,
            "last_error_at": None,
            "last_error_message": None,
        })
        
        logger.info(f"Registered webhook {webhook_id} for integration {integration_id}")
        return config
    
    async def get_webhook(self, webhook_id: str) -> Optional[WebhookConfig]:
        """Get webhook configuration by ID"""
        doc = await self.webhooks.find_one({"_id": webhook_id})
        if not doc:
            return None
        
        auth_config = WebhookAuthConfig(
            method=WebhookAuthMethod(doc.get("auth_method", "hmac_sha256")),
            hmac_secret=doc.get("hmac_secret"),
            signature_header=doc.get("signature_header", "X-Webhook-Signature"),
            api_key=doc.get("api_key"),
            api_key_header=doc.get("api_key_header", "X-API-Key"),
            bearer_token=doc.get("bearer_token"),
            allowed_ips=set(doc.get("allowed_ips", [])),
            enforce_timestamp=doc.get("enforce_timestamp", True),
            timestamp_header=doc.get("timestamp_header", "X-Webhook-Timestamp"),
        )
        
        return WebhookConfig(
            id=doc["_id"],
            integration_id=doc["integration_id"],
            name=doc["name"],
            auth=auth_config,
            enabled_events=doc.get("enabled_events", []),
            is_active=doc.get("is_active", True),
            created_at=doc.get("created_at"),
            max_requests_per_minute=doc.get("max_requests_per_minute", 100),
            events_received=doc.get("events_received", 0),
            events_processed=doc.get("events_processed", 0),
            events_rejected=doc.get("events_rejected", 0),
            last_event_at=doc.get("last_event_at"),
            last_error_at=doc.get("last_error_at"),
            last_error_message=doc.get("last_error_message"),
        )
    
    async def list_webhooks(
        self,
        integration_id: Optional[str] = None,
        active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """List webhooks (without secrets)"""
        query = {}
        if integration_id:
            query["integration_id"] = integration_id
        if active_only:
            query["is_active"] = True
        
        cursor = self.webhooks.find(query)
        webhooks = []
        
        async for doc in cursor:
            webhooks.append({
                "id": doc["_id"],
                "integration_id": doc["integration_id"],
                "name": doc["name"],
                "auth_method": doc.get("auth_method", "hmac_sha256"),
                "is_active": doc.get("is_active", True),
                "enabled_events": doc.get("enabled_events", []),
                "events_received": doc.get("events_received", 0),
                "events_processed": doc.get("events_processed", 0),
                "events_rejected": doc.get("events_rejected", 0),
                "last_event_at": doc.get("last_event_at"),
                "created_at": doc.get("created_at"),
            })
        
        return webhooks
    
    async def update_webhook(self, webhook_id: str, updates: Dict[str, Any]) -> bool:
        """Update webhook configuration"""
        # Remove sensitive fields that shouldn't be updated directly
        for key in ["_id", "id", "created_at"]:
            updates.pop(key, None)
        
        result = await self.webhooks.update_one(
            {"_id": webhook_id},
            {"$set": updates}
        )
        return result.modified_count > 0
    
    async def delete_webhook(self, webhook_id: str) -> bool:
        """Delete a webhook"""
        result = await self.webhooks.delete_one({"_id": webhook_id})
        return result.deleted_count > 0
    
    async def rotate_credentials(self, webhook_id: str) -> Dict[str, str]:
        """Rotate webhook credentials"""
        new_creds = {
            "hmac_secret": str(uuid.uuid4()).replace('-', '') + str(uuid.uuid4()).replace('-', ''),
            "api_key": f"whk_{str(uuid.uuid4()).replace('-', '')}",
            "bearer_token": str(uuid.uuid4()).replace('-', '') + str(uuid.uuid4()).replace('-', ''),
        }
        
        await self.webhooks.update_one(
            {"_id": webhook_id},
            {"$set": new_creds}
        )
        
        logger.info(f"Rotated credentials for webhook {webhook_id}")
        return new_creds
    
    # ==================== AUTHENTICATION ====================
    
    async def _authenticate_request(
        self,
        config: WebhookConfig,
        payload: bytes,
        headers: Dict[str, str],
        source_ip: Optional[str]
    ) -> tuple[bool, str, Optional[str]]:
        """
        Authenticate a webhook request
        
        Returns:
            (is_valid, error_message, auth_method_used)
        """
        auth = config.auth
        
        # Check rate limiting first
        if not self._check_rate_limit(config.id, config.max_requests_per_minute):
            return False, "Rate limit exceeded", None
        
        # Handle different auth methods
        if auth.method == WebhookAuthMethod.NONE:
            return True, "", "none"
        
        elif auth.method == WebhookAuthMethod.HMAC_SHA256:
            signature = headers.get(auth.signature_header)
            if verify_hmac_signature(payload, signature, auth.hmac_secret, "sha256", auth.signature_prefix):
                # Also verify timestamp if enabled
                if auth.enforce_timestamp:
                    timestamp = headers.get(auth.timestamp_header)
                    if not verify_timestamp(timestamp, auth.timestamp_tolerance_seconds):
                        return False, "Invalid or expired timestamp", None
                return True, "", "hmac_sha256"
            return False, "Invalid HMAC signature", None
        
        elif auth.method == WebhookAuthMethod.HMAC_SHA512:
            signature = headers.get(auth.signature_header)
            if verify_hmac_signature(payload, signature, auth.hmac_secret, "sha512", auth.signature_prefix):
                if auth.enforce_timestamp:
                    timestamp = headers.get(auth.timestamp_header)
                    if not verify_timestamp(timestamp, auth.timestamp_tolerance_seconds):
                        return False, "Invalid or expired timestamp", None
                return True, "", "hmac_sha512"
            return False, "Invalid HMAC signature", None
        
        elif auth.method == WebhookAuthMethod.API_KEY:
            api_key = headers.get(auth.api_key_header)
            if verify_api_key(api_key, auth.api_key):
                return True, "", "api_key"
            return False, "Invalid API key", None
        
        elif auth.method == WebhookAuthMethod.BEARER_TOKEN:
            auth_header = headers.get("Authorization")
            if verify_bearer_token(auth_header, auth.bearer_token):
                return True, "", "bearer_token"
            return False, "Invalid bearer token", None
        
        elif auth.method == WebhookAuthMethod.IP_WHITELIST:
            if verify_ip_whitelist(source_ip, auth.allowed_ips):
                return True, "", "ip_whitelist"
            return False, f"IP {source_ip} not in whitelist", None
        
        elif auth.method == WebhookAuthMethod.COMBINED:
            # All required methods must pass
            for method in auth.required_methods:
                if method == WebhookAuthMethod.HMAC_SHA256:
                    signature = headers.get(auth.signature_header)
                    if not verify_hmac_signature(payload, signature, auth.hmac_secret, "sha256"):
                        return False, "Invalid HMAC signature", None
                elif method == WebhookAuthMethod.API_KEY:
                    api_key = headers.get(auth.api_key_header)
                    if not verify_api_key(api_key, auth.api_key):
                        return False, "Invalid API key", None
                elif method == WebhookAuthMethod.IP_WHITELIST:
                    if not verify_ip_whitelist(source_ip, auth.allowed_ips):
                        return False, f"IP {source_ip} not in whitelist", None
            
            return True, "", "combined"
        
        return False, "Unknown auth method", None
    
    def _check_rate_limit(self, webhook_id: str, max_per_minute: int) -> bool:
        """Check if request is within rate limit"""
        now = time.time()
        minute_ago = now - 60
        
        # Clean old entries
        if webhook_id in self._request_counts:
            self._request_counts[webhook_id] = [
                t for t in self._request_counts[webhook_id] if t > minute_ago
            ]
        else:
            self._request_counts[webhook_id] = []
        
        # Check limit
        if len(self._request_counts[webhook_id]) >= max_per_minute:
            return False
        
        # Record this request
        self._request_counts[webhook_id].append(now)
        return True
    
    async def _check_idempotency(self, request_id: str) -> bool:
        """
        Check if this request ID has been processed before
        Returns True if it's a new request, False if duplicate
        """
        if not request_id:
            return True  # No ID, can't check idempotency
        
        # Try to insert the ID
        try:
            await self.processed_ids.insert_one({
                "_id": request_id,
                "created_at": datetime.now(timezone.utc)
            })
            return True
        except Exception:
            # Duplicate key error means already processed
            return False
    
    # ==================== EVENT PROCESSING ====================
    
    async def receive_event(
        self,
        webhook_id: str,
        payload: bytes,
        headers: Optional[Dict[str, str]] = None,
        source_ip: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Receive and process an incoming webhook event
        
        Args:
            webhook_id: ID of the webhook endpoint
            payload: Raw request body (bytes)
            headers: Request headers
            source_ip: Source IP address
        
        Returns:
            Dict with processing result
        """
        headers = {k.lower(): v for k, v in (headers or {}).items()}
        headers_original = headers.copy()
        
        # Get webhook config
        config = await self.get_webhook(webhook_id)
        if not config:
            logger.warning(f"Webhook not found: {webhook_id}")
            return {"success": False, "error": "Webhook not found", "code": 404}
        
        if not config.is_active:
            return {"success": False, "error": "Webhook is disabled", "code": 403}
        
        # Authenticate
        auth_valid, auth_error, auth_method = await self._authenticate_request(
            config, payload, headers, source_ip
        )
        
        if not auth_valid:
            logger.warning(f"Auth failed for webhook {webhook_id}: {auth_error}")
            await self._record_rejection(webhook_id, auth_error)
            return {"success": False, "error": auth_error, "code": 401}
        
        # Check idempotency
        request_id = headers.get(config.auth.request_id_header.lower())
        if request_id:
            is_new = await self._check_idempotency(request_id)
            if not is_new:
                logger.info(f"Duplicate webhook request: {request_id}")
                return {"success": True, "message": "Already processed", "duplicate": True}
        
        # Parse payload
        try:
            data = json.loads(payload.decode('utf-8'))
        except json.JSONDecodeError as e:
            await self._record_rejection(webhook_id, f"Invalid JSON: {str(e)}")
            return {"success": False, "error": f"Invalid JSON: {str(e)}", "code": 400}
        
        # Extract and normalize event type
        raw_event_type = self._extract_event_type(data, headers)
        event_type = self._normalize_event_type(raw_event_type)
        
        # Check if event is enabled
        if config.enabled_events and raw_event_type not in config.enabled_events:
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
            headers={k: v for k, v in headers_original.items() if k.startswith('x-')},
            auth_method_used=auth_method,
            auth_valid=True,
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
            "auth_method_used": event.auth_method_used,
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
    
    async def _record_rejection(self, webhook_id: str, error: str):
        """Record a rejected webhook request"""
        await self.webhooks.update_one(
            {"_id": webhook_id},
            {
                "$inc": {"events_rejected": 1},
                "$set": {
                    "last_error_at": datetime.now(timezone.utc),
                    "last_error_message": error
                }
            }
        )
    
    def _extract_event_type(self, data: Dict[str, Any], headers: Dict[str, str]) -> str:
        """Extract event type from payload or headers"""
        # Try common header locations
        for header in ['x-event-type', 'x-webhook-event', 'x-github-event', 'x-event']:
            if header in headers:
                return headers[header]
        
        # Try common payload locations
        for key in ['event', 'event_type', 'eventType', 'type', 'action']:
            if key in data:
                return str(data[key])
        
        # Check nested
        if 'data' in data and isinstance(data['data'], dict):
            for key in ['event', 'event_type', 'type']:
                if key in data['data']:
                    return str(data['data'][key])
        
        return "unknown"
    
    def _normalize_event_type(self, raw_type: str) -> WebhookEventType:
        """Normalize raw event type to standard enum"""
        if raw_type in self._event_type_map:
            return self._event_type_map[raw_type]
        
        # Try lowercase
        lower = raw_type.lower()
        if lower in self._event_type_map:
            return self._event_type_map[lower]
        
        # Try matching patterns
        if 'lead' in lower and 'create' in lower:
            return WebhookEventType.LEAD_CREATED
        if 'lead' in lower and 'update' in lower:
            return WebhookEventType.LEAD_UPDATED
        if 'customer' in lower and 'create' in lower:
            return WebhookEventType.CUSTOMER_CREATED
        if 'customer' in lower and 'update' in lower:
            return WebhookEventType.CUSTOMER_UPDATED
        if 'vehicle' in lower and ('add' in lower or 'create' in lower):
            return WebhookEventType.VEHICLE_ADDED
        if 'vehicle' in lower and 'update' in lower:
            return WebhookEventType.VEHICLE_UPDATED
        if 'vehicle' in lower and 'sold' in lower:
            return WebhookEventType.VEHICLE_SOLD
        
        return WebhookEventType.UNKNOWN
    
    async def _process_event(self, event: WebhookEvent) -> Dict[str, Any]:
        """Process a webhook event"""
        try:
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
                        "processed_at": datetime.now(timezone.utc)
                    }
                }
            )
            
            await self.webhooks.update_one(
                {"_id": event.webhook_id},
                {"$inc": {"events_processed": 1}}
            )
            
            return {"processed": True}
            
        except Exception as e:
            logger.error(f"Event processing error: {e}")
            await self.events.update_one(
                {"_id": event.id},
                {
                    "$set": {
                        "processing_status": "failed",
                        "processing_error": str(e)
                    }
                }
            )
            return {"processed": False, "error": str(e)}
    
    def register_handler(self, event_type: WebhookEventType, handler: Callable):
        """Register a handler for an event type"""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
    
    async def get_events(
        self,
        webhook_id: Optional[str] = None,
        integration_id: Optional[str] = None,
        event_type: Optional[WebhookEventType] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get webhook events"""
        query = {}
        if webhook_id:
            query["webhook_id"] = webhook_id
        if integration_id:
            query["integration_id"] = integration_id
        if event_type:
            query["event_type"] = event_type.value
        if status:
            query["processing_status"] = status
        
        cursor = self.events.find(query).sort("received_at", -1).limit(limit)
        
        events = []
        async for doc in cursor:
            doc["id"] = doc.pop("_id")
            events.append(doc)
        
        return events
    
    async def get_webhook_stats(self, webhook_id: str) -> Dict[str, Any]:
        """Get detailed stats for a webhook"""
        config = await self.get_webhook(webhook_id)
        if not config:
            return {}
        
        # Get event type distribution
        pipeline = [
            {"$match": {"webhook_id": webhook_id}},
            {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
        ]
        
        event_types = {}
        async for doc in self.events.aggregate(pipeline):
            event_types[doc["_id"]] = doc["count"]
        
        return {
            "webhook_id": webhook_id,
            "name": config.name,
            "is_active": config.is_active,
            "auth_method": config.auth.method.value,
            "events_received": config.events_received,
            "events_processed": config.events_processed,
            "events_rejected": config.events_rejected,
            "success_rate": (
                config.events_processed / config.events_received * 100
                if config.events_received > 0 else 100
            ),
            "event_type_distribution": event_types,
            "last_event_at": config.last_event_at.isoformat() if config.last_event_at else None,
            "last_error_at": config.last_error_at.isoformat() if config.last_error_at else None,
            "last_error_message": config.last_error_message,
        }
