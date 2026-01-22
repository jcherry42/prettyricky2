"""
Notification Service Module
SMS notifications for hot leads, status changes, and follow-up reminders
Supports Twilio SMS with placeholder credential handling
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
from enum import Enum

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    HOT_LEAD = "hot_lead"
    STATUS_CHANGE = "status_change"
    FOLLOW_UP_REMINDER = "follow_up_reminder"
    DEAL_UPDATE = "deal_update"
    SYSTEM_ALERT = "system_alert"


class NotificationChannel(str, Enum):
    SMS = "sms"
    # Future: EMAIL = "email", PUSH = "push"


class NotificationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationCreate(BaseModel):
    """Model for creating a notification"""
    notification_type: NotificationType
    channel: NotificationChannel = NotificationChannel.SMS
    recipient_phone: str
    recipient_name: Optional[str] = None
    title: str
    message: str
    priority: NotificationPriority = NotificationPriority.MEDIUM
    metadata: Optional[Dict[str, Any]] = None
    scheduled_for: Optional[datetime] = None


class NotificationResult(BaseModel):
    """Model for notification result"""
    success: bool
    notification_id: str
    channel: str
    message_sid: Optional[str] = None
    error: Optional[str] = None
    sent_at: Optional[datetime] = None


class TwilioConfig(BaseModel):
    """Twilio configuration"""
    account_sid: Optional[str] = None
    auth_token: Optional[str] = None
    from_number: Optional[str] = None
    is_configured: bool = False


class NotificationService:
    """
    Service for sending notifications via SMS (Twilio)
    Supports placeholder credentials - will queue notifications if not configured
    """
    
    # Message templates for different notification types
    TEMPLATES = {
        NotificationType.HOT_LEAD: """🔥 HOT LEAD ALERT!
{customer_name} just became a hot lead.
Vehicle Interest: {vehicle}
Contact: {phone}
Reply STOP to unsubscribe.""",
        
        NotificationType.STATUS_CHANGE: """📊 Lead Status Update
{customer_name}: {old_status} → {new_status}
{notes}
Reply STOP to unsubscribe.""",
        
        NotificationType.FOLLOW_UP_REMINDER: """⏰ Follow-Up Reminder
Time to reach out to {customer_name}!
Vehicle: {vehicle}
Last Contact: {last_contact}
Reply STOP to unsubscribe.""",
        
        NotificationType.DEAL_UPDATE: """🎯 Deal Update
{customer_name} - {deal_stage}
Amount: ${amount}
Next Step: {next_step}
Reply STOP to unsubscribe.""",
        
        NotificationType.SYSTEM_ALERT: """⚠️ System Alert
{title}
{message}
Reply STOP to unsubscribe.""",
    }
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.notifications_collection = db.notifications
        self.settings_collection = db.notification_settings
        self._twilio_client = None
        self._config: Optional[TwilioConfig] = None
    
    async def initialize(self):
        """Initialize the notification service"""
        # Create indexes
        await self.notifications_collection.create_index("created_at")
        await self.notifications_collection.create_index("status")
        await self.notifications_collection.create_index("notification_type")
        await self.notifications_collection.create_index("recipient_phone")
        await self.notifications_collection.create_index("scheduled_for")
        
        # Load config
        await self._load_config()
        
        logger.info("Notification service initialized")
    
    async def _load_config(self):
        """Load Twilio configuration from environment or database"""
        # Check environment variables first
        account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
        auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
        from_number = os.environ.get('TWILIO_FROM_NUMBER')
        
        # Check database for stored config
        if not account_sid:
            stored_config = await self.settings_collection.find_one({"type": "twilio"})
            if stored_config:
                account_sid = stored_config.get('account_sid')
                auth_token = stored_config.get('auth_token')
                from_number = stored_config.get('from_number')
        
        is_configured = bool(account_sid and auth_token and from_number)
        
        self._config = TwilioConfig(
            account_sid=account_sid,
            auth_token=auth_token,
            from_number=from_number,
            is_configured=is_configured
        )
        
        if is_configured:
            try:
                from twilio.rest import Client
                self._twilio_client = Client(account_sid, auth_token)
                logger.info("Twilio client initialized successfully")
            except ImportError:
                logger.warning("Twilio library not installed. SMS notifications will be queued.")
                self._config.is_configured = False
            except Exception as e:
                logger.error(f"Failed to initialize Twilio client: {e}")
                self._config.is_configured = False
        else:
            logger.info("Twilio not configured. Notifications will be queued for later delivery.")
    
    async def configure_twilio(
        self,
        account_sid: str,
        auth_token: str,
        from_number: str
    ) -> Dict[str, Any]:
        """Configure Twilio credentials"""
        # Validate credentials by making a test API call
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            
            # Verify the account
            account = client.api.accounts(account_sid).fetch()
            
            if account.status != 'active':
                return {
                    "success": False,
                    "error": f"Twilio account is not active. Status: {account.status}"
                }
            
            # Store in database
            await self.settings_collection.update_one(
                {"type": "twilio"},
                {
                    "$set": {
                        "type": "twilio",
                        "account_sid": account_sid,
                        "auth_token": auth_token,
                        "from_number": from_number,
                        "configured_at": datetime.now(timezone.utc),
                        "account_name": account.friendly_name,
                    }
                },
                upsert=True
            )
            
            # Update in-memory config
            self._config = TwilioConfig(
                account_sid=account_sid,
                auth_token=auth_token,
                from_number=from_number,
                is_configured=True
            )
            self._twilio_client = client
            
            return {
                "success": True,
                "message": "Twilio configured successfully",
                "account_name": account.friendly_name,
            }
            
        except ImportError:
            return {
                "success": False,
                "error": "Twilio library not installed. Run: pip install twilio"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_config_status(self) -> Dict[str, Any]:
        """Get current notification configuration status"""
        return {
            "sms_configured": self._config.is_configured if self._config else False,
            "from_number": self._config.from_number[:6] + "****" if self._config and self._config.from_number else None,
            "pending_notifications": await self.notifications_collection.count_documents({"status": "pending"}),
        }
    
    async def send_notification(self, notification: NotificationCreate) -> NotificationResult:
        """
        Send a notification via the specified channel
        If not configured, queues the notification for later delivery
        """
        now = datetime.now(timezone.utc)
        
        # Create notification record
        notification_doc = {
            "notification_type": notification.notification_type.value,
            "channel": notification.channel.value,
            "recipient_phone": notification.recipient_phone,
            "recipient_name": notification.recipient_name,
            "title": notification.title,
            "message": notification.message,
            "priority": notification.priority.value,
            "metadata": notification.metadata or {},
            "scheduled_for": notification.scheduled_for,
            "created_at": now,
            "status": "pending",
            "attempts": 0,
            "sent_at": None,
            "message_sid": None,
            "error": None,
        }
        
        result = await self.notifications_collection.insert_one(notification_doc)
        notification_id = str(result.inserted_id)
        
        # If scheduled for later, just queue it
        if notification.scheduled_for and notification.scheduled_for > now:
            return NotificationResult(
                success=True,
                notification_id=notification_id,
                channel=notification.channel.value,
                message_sid=None,
                error=None,
                sent_at=None
            )
        
        # Try to send immediately
        if notification.channel == NotificationChannel.SMS:
            return await self._send_sms(notification_id, notification)
        
        return NotificationResult(
            success=False,
            notification_id=notification_id,
            channel=notification.channel.value,
            error="Unsupported channel"
        )
    
    async def _send_sms(
        self,
        notification_id: str,
        notification: NotificationCreate
    ) -> NotificationResult:
        """Send SMS via Twilio"""
        from bson import ObjectId
        
        # Check if configured
        if not self._config or not self._config.is_configured or not self._twilio_client:
            # Queue for later
            await self.notifications_collection.update_one(
                {"_id": ObjectId(notification_id)},
                {
                    "$set": {
                        "status": "queued",
                        "error": "Twilio not configured. SMS will be sent when credentials are provided."
                    }
                }
            )
            return NotificationResult(
                success=True,  # Queued successfully
                notification_id=notification_id,
                channel="sms",
                message_sid=None,
                error="Queued - Twilio not configured"
            )
        
        try:
            # Send via Twilio
            message = self._twilio_client.messages.create(
                body=notification.message,
                from_=self._config.from_number,
                to=notification.recipient_phone
            )
            
            # Update notification record
            await self.notifications_collection.update_one(
                {"_id": ObjectId(notification_id)},
                {
                    "$set": {
                        "status": "sent",
                        "sent_at": datetime.now(timezone.utc),
                        "message_sid": message.sid,
                        "attempts": 1,
                    }
                }
            )
            
            logger.info(f"SMS sent successfully: {message.sid}")
            
            return NotificationResult(
                success=True,
                notification_id=notification_id,
                channel="sms",
                message_sid=message.sid,
                sent_at=datetime.now(timezone.utc)
            )
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send SMS: {error_msg}")
            
            # Update with error
            await self.notifications_collection.update_one(
                {"_id": ObjectId(notification_id)},
                {
                    "$set": {
                        "status": "failed",
                        "error": error_msg,
                    },
                    "$inc": {"attempts": 1}
                }
            )
            
            return NotificationResult(
                success=False,
                notification_id=notification_id,
                channel="sms",
                error=error_msg
            )
    
    async def send_sms(
        self,
        to_number: str,
        message: str,
        media_urls: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send a direct SMS/MMS message.
        
        Args:
            to_number: Recipient phone number
            message: SMS message body
            media_urls: Optional list of media URLs for MMS
        
        Returns:
            Dict with success status and details
        """
        # Check if configured
        if not self._config or not self._config.is_configured or not self._twilio_client:
            return {
                "success": False,
                "error": "Twilio not configured. Please configure SMS settings first."
            }
        
        try:
            # Build message params
            msg_params = {
                "body": message,
                "from_": self._config.from_number,
                "to": to_number
            }
            
            # Add media URLs for MMS if provided
            if media_urls:
                msg_params["media_url"] = media_urls
                logger.info(f"Sending MMS with {len(media_urls)} media attachment(s)")
            
            # Send via Twilio
            twilio_message = self._twilio_client.messages.create(**msg_params)
            
            logger.info(f"SMS/MMS sent successfully: {twilio_message.sid}")
            
            return {
                "success": True,
                "message_sid": twilio_message.sid,
                "to": to_number,
                "has_media": bool(media_urls)
            }
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to send SMS/MMS: {error_msg}")
            return {
                "success": False,
                "error": error_msg
            }
    
    async def send_hot_lead_alert(
        self,
        salesperson_phone: str,
        salesperson_name: str,
        customer_name: str,
        customer_phone: str,
        vehicle_interest: Optional[str] = None
    ) -> NotificationResult:
        """Send hot lead notification to salesperson"""
        message = self.TEMPLATES[NotificationType.HOT_LEAD].format(
            customer_name=customer_name,
            vehicle=vehicle_interest or "Not specified",
            phone=customer_phone
        )
        
        notification = NotificationCreate(
            notification_type=NotificationType.HOT_LEAD,
            channel=NotificationChannel.SMS,
            recipient_phone=salesperson_phone,
            recipient_name=salesperson_name,
            title="Hot Lead Alert",
            message=message,
            priority=NotificationPriority.URGENT,
            metadata={
                "customer_name": customer_name,
                "customer_phone": customer_phone,
                "vehicle_interest": vehicle_interest,
            }
        )
        
        return await self.send_notification(notification)
    
    async def send_status_change_alert(
        self,
        salesperson_phone: str,
        customer_name: str,
        old_status: str,
        new_status: str,
        notes: Optional[str] = None
    ) -> NotificationResult:
        """Send lead status change notification"""
        message = self.TEMPLATES[NotificationType.STATUS_CHANGE].format(
            customer_name=customer_name,
            old_status=old_status.upper(),
            new_status=new_status.upper(),
            notes=notes or ""
        )
        
        notification = NotificationCreate(
            notification_type=NotificationType.STATUS_CHANGE,
            channel=NotificationChannel.SMS,
            recipient_phone=salesperson_phone,
            title="Status Change",
            message=message,
            priority=NotificationPriority.HIGH if new_status == "hot" else NotificationPriority.MEDIUM,
            metadata={
                "customer_name": customer_name,
                "old_status": old_status,
                "new_status": new_status,
            }
        )
        
        return await self.send_notification(notification)
    
    async def schedule_follow_up_reminder(
        self,
        salesperson_phone: str,
        customer_name: str,
        vehicle_interest: Optional[str],
        last_contact: Optional[str],
        remind_at: datetime
    ) -> NotificationResult:
        """Schedule a follow-up reminder"""
        message = self.TEMPLATES[NotificationType.FOLLOW_UP_REMINDER].format(
            customer_name=customer_name,
            vehicle=vehicle_interest or "Not specified",
            last_contact=last_contact or "Unknown"
        )
        
        notification = NotificationCreate(
            notification_type=NotificationType.FOLLOW_UP_REMINDER,
            channel=NotificationChannel.SMS,
            recipient_phone=salesperson_phone,
            title="Follow-Up Reminder",
            message=message,
            priority=NotificationPriority.MEDIUM,
            scheduled_for=remind_at,
            metadata={
                "customer_name": customer_name,
                "vehicle_interest": vehicle_interest,
            }
        )
        
        return await self.send_notification(notification)
    
    async def process_scheduled_notifications(self) -> Dict[str, int]:
        """Process all scheduled notifications that are due"""
        now = datetime.now(timezone.utc)
        
        # Find due notifications
        cursor = self.notifications_collection.find({
            "status": {"$in": ["pending", "queued"]},
            "$or": [
                {"scheduled_for": {"$lte": now}},
                {"scheduled_for": None}
            ]
        })
        
        sent = 0
        failed = 0
        skipped = 0
        
        async for doc in cursor:
            if not self._config or not self._config.is_configured:
                skipped += 1
                continue
            
            notification = NotificationCreate(
                notification_type=NotificationType(doc["notification_type"]),
                channel=NotificationChannel(doc["channel"]),
                recipient_phone=doc["recipient_phone"],
                recipient_name=doc.get("recipient_name"),
                title=doc["title"],
                message=doc["message"],
                priority=NotificationPriority(doc["priority"]),
                metadata=doc.get("metadata"),
            )
            
            result = await self._send_sms(str(doc["_id"]), notification)
            
            if result.success and result.message_sid:
                sent += 1
            else:
                failed += 1
        
        return {"sent": sent, "failed": failed, "skipped": skipped}
    
    async def get_notifications(
        self,
        notification_type: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get notifications with optional filters"""
        query = {}
        if notification_type:
            query["notification_type"] = notification_type
        if status:
            query["status"] = status
        
        cursor = self.notifications_collection.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).limit(limit)
        
        return await cursor.to_list(limit)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get notification statistics"""
        pipeline = [
            {
                "$facet": {
                    "by_status": [
                        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
                    ],
                    "by_type": [
                        {"$group": {"_id": "$notification_type", "count": {"$sum": 1}}}
                    ],
                    "total": [{"$count": "count"}],
                    "sent_today": [
                        {
                            "$match": {
                                "sent_at": {
                                    "$gte": datetime.now(timezone.utc).replace(
                                        hour=0, minute=0, second=0, microsecond=0
                                    )
                                }
                            }
                        },
                        {"$count": "count"}
                    ]
                }
            }
        ]
        
        result = await self.notifications_collection.aggregate(pipeline).to_list(1)
        
        if result:
            data = result[0]
            total_list = data.get("total", [])
            sent_today_list = data.get("sent_today", [])
            
            return {
                "total": total_list[0].get("count", 0) if total_list else 0,
                "sent_today": sent_today_list[0].get("count", 0) if sent_today_list else 0,
                "by_status": {item["_id"]: item["count"] for item in data.get("by_status", [])},
                "by_type": {item["_id"]: item["count"] for item in data.get("by_type", [])},
                "configured": self._config.is_configured if self._config else False,
            }
        
        return {
            "total": 0,
            "sent_today": 0,
            "by_status": {},
            "by_type": {},
            "configured": False,
        }
