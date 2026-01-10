"""
Webhook Event Handlers
Built-in handlers for processing webhook events
"""

import logging
from typing import Dict, Any, Callable, List
from abc import ABC, abstractmethod

from .receiver import WebhookEvent, WebhookEventType

logger = logging.getLogger(__name__)


class WebhookHandlerRegistry:
    """Registry for webhook handlers"""
    
    _handlers: Dict[str, type] = {}
    
    @classmethod
    def register(cls, name: str):
        """Decorator to register a handler"""
        def decorator(handler_class):
            cls._handlers[name] = handler_class
            return handler_class
        return decorator
    
    @classmethod
    def get(cls, name: str):
        return cls._handlers.get(name)
    
    @classmethod
    def list_handlers(cls) -> List[str]:
        return list(cls._handlers.keys())


class BaseWebhookHandler(ABC):
    """Base class for webhook event handlers"""
    
    # Event types this handler processes
    HANDLES_EVENTS: List[WebhookEventType] = []
    
    def __init__(self, db=None, **kwargs):
        self.db = db
        self.config = kwargs
    
    @abstractmethod
    async def handle(self, event: WebhookEvent) -> Dict[str, Any]:
        """
        Handle a webhook event
        
        Args:
            event: The webhook event to process
            
        Returns:
            Dict with processing result
        """
        pass
    
    async def __call__(self, event: WebhookEvent) -> Dict[str, Any]:
        """Make handler callable"""
        return await self.handle(event)


@WebhookHandlerRegistry.register("lead_sync")
class LeadSyncHandler(BaseWebhookHandler):
    """
    Handler for syncing leads from webhook events
    
    Processes lead.created and lead.updated events
    to keep local customer data in sync
    """
    
    HANDLES_EVENTS = [
        WebhookEventType.LEAD_CREATED,
        WebhookEventType.LEAD_UPDATED,
        WebhookEventType.LEAD_STATUS_CHANGED,
        WebhookEventType.CUSTOMER_CREATED,
        WebhookEventType.CUSTOMER_UPDATED,
    ]
    
    async def handle(self, event: WebhookEvent) -> Dict[str, Any]:
        if not self.db:
            return {"success": False, "error": "No database connection"}
        
        payload = event.payload
        
        # Extract customer data from payload
        # (field names vary by CRM, handler should normalize)
        customer_data = self._extract_customer_data(payload)
        
        if not customer_data:
            return {"success": False, "error": "Could not extract customer data"}
        
        # Upsert to customers collection
        customers = self.db["customers"]
        
        # Use source_row_id as the unique identifier
        source_id = customer_data.get("source_row_id")
        if source_id:
            await customers.update_one(
                {
                    "source_id": event.integration_id,
                    "source_row_id": source_id
                },
                {
                    "$set": customer_data,
                    "$setOnInsert": {"created_at": event.received_at}
                },
                upsert=True
            )
            
            return {"success": True, "action": "upserted", "source_row_id": source_id}
        
        return {"success": False, "error": "No source_row_id in payload"}
    
    def _extract_customer_data(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and normalize customer data from webhook payload"""
        # Common field name variations
        data = {}
        
        # Try to get nested data first
        customer = payload.get("customer") or payload.get("lead") or payload.get("data") or payload
        
        # Map common fields
        field_map = {
            "source_row_id": ["id", "customerId", "leadId", "customer_id", "lead_id"],
            "first_name": ["firstName", "first_name", "fname"],
            "last_name": ["lastName", "last_name", "lname"],
            "email": ["email", "emailAddress", "email_address"],
            "phone": ["phone", "primaryPhone", "cellPhone", "cell_phone", "mobile"],
            "lead_status": ["status", "leadStatus", "lead_status"],
            "vehicle_of_interest": ["vehicleOfInterest", "vehicle_of_interest", "interested_vehicle"],
        }
        
        for canonical, variants in field_map.items():
            for variant in variants:
                if variant in customer and customer[variant]:
                    data[canonical] = customer[variant]
                    break
        
        return data


@WebhookHandlerRegistry.register("vehicle_sync")
class VehicleSyncHandler(BaseWebhookHandler):
    """
    Handler for syncing vehicles from webhook events
    """
    
    HANDLES_EVENTS = [
        WebhookEventType.VEHICLE_ADDED,
        WebhookEventType.VEHICLE_UPDATED,
        WebhookEventType.VEHICLE_SOLD,
        WebhookEventType.VEHICLE_REMOVED,
    ]
    
    async def handle(self, event: WebhookEvent) -> Dict[str, Any]:
        if not self.db:
            return {"success": False, "error": "No database connection"}
        
        payload = event.payload
        vehicle_data = self._extract_vehicle_data(payload)
        
        if not vehicle_data:
            return {"success": False, "error": "Could not extract vehicle data"}
        
        vehicles = self.db["vehicles"]
        
        # Handle sold/removed differently
        if event.event_type in [WebhookEventType.VEHICLE_SOLD, WebhookEventType.VEHICLE_REMOVED]:
            source_id = vehicle_data.get("source_row_id")
            if source_id:
                await vehicles.update_one(
                    {"source_id": event.integration_id, "source_row_id": source_id},
                    {"$set": {"status": "sold" if event.event_type == WebhookEventType.VEHICLE_SOLD else "removed"}}
                )
                return {"success": True, "action": "status_updated"}
        
        # Upsert vehicle
        source_id = vehicle_data.get("source_row_id") or vehicle_data.get("vin")
        if source_id:
            await vehicles.update_one(
                {"source_id": event.integration_id, "source_row_id": source_id},
                {"$set": vehicle_data, "$setOnInsert": {"created_at": event.received_at}},
                upsert=True
            )
            return {"success": True, "action": "upserted"}
        
        return {"success": False, "error": "No identifier in payload"}
    
    def _extract_vehicle_data(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Extract and normalize vehicle data"""
        data = {}
        vehicle = payload.get("vehicle") or payload.get("data") or payload
        
        field_map = {
            "source_row_id": ["id", "vehicleId", "vehicle_id"],
            "vin": ["vin", "VIN", "vin_number"],
            "stock_number": ["stockNumber", "stock_number", "stock_no"],
            "year": ["year", "modelYear", "model_year"],
            "make": ["make"],
            "model": ["model"],
            "trim": ["trim", "trimLevel"],
            "price": ["price", "sellingPrice", "internetPrice"],
            "mileage": ["mileage", "miles", "odometer"],
            "status": ["status", "vehicleStatus"],
        }
        
        for canonical, variants in field_map.items():
            for variant in variants:
                if variant in vehicle and vehicle[variant]:
                    data[canonical] = vehicle[variant]
                    break
        
        return data


@WebhookHandlerRegistry.register("notification")
class NotificationHandler(BaseWebhookHandler):
    """
    Handler that sends notifications for important events
    """
    
    HANDLES_EVENTS = [
        WebhookEventType.LEAD_CREATED,
        WebhookEventType.DEAL_CREATED,
        WebhookEventType.DEAL_CLOSED,
    ]
    
    async def handle(self, event: WebhookEvent) -> Dict[str, Any]:
        # Log the event for now
        # In production, could send push notifications, emails, etc.
        logger.info(f"Notification: {event.event_type.value} - {event.payload}")
        
        return {"success": True, "notified": True}
