"""
Conversation History Module
Stores and manages Tower Talk conversation history with 30-day auto-deletion
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

logger = logging.getLogger(__name__)


class ConversationCreate(BaseModel):
    """Model for creating a new conversation"""
    session_id: str = Field(..., description="Unique session identifier")
    situation: str = Field(..., description="The situation/question asked")
    response: str = Field(..., description="AI-generated response")
    translated_response: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    vehicle_info: Optional[str] = None
    category: Optional[str] = Field(default="general", description="Conversation category")
    language: str = Field(default="en", description="Response language")
    shortcut_used: Optional[str] = Field(default=None, description="Quick shortcut ID if used")


class ConversationResponse(BaseModel):
    """Model for conversation response"""
    id: str
    session_id: str
    situation: str
    response: str
    translated_response: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    vehicle_info: Optional[str] = None
    category: str
    language: str
    shortcut_used: Optional[str] = None
    created_at: datetime
    expires_at: datetime


class ConversationHistoryService:
    """Service for managing conversation history"""
    
    RETENTION_DAYS = 30  # Auto-delete after 30 days
    
    # Categories matching existing app patterns
    CATEGORIES = [
        {"id": "price_negotiation", "label": "Price Negotiation", "icon": "💰"},
        {"id": "trade_in", "label": "Trade-In", "icon": "🔄"},
        {"id": "objection_handling", "label": "Objection Handling", "icon": "🛡️"},
        {"id": "follow_up", "label": "Follow-Up", "icon": "📞"},
        {"id": "competitor", "label": "Competitor", "icon": "⚔️"},
        {"id": "financing", "label": "Financing", "icon": "📊"},
        {"id": "features", "label": "Features", "icon": "⚙️"},
        {"id": "general", "label": "General", "icon": "💬"},
    ]
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.conversations
    
    async def initialize(self):
        """Initialize indexes for conversations collection"""
        try:
            # TTL index for auto-deletion after 30 days
            await self.collection.create_index(
                "expires_at",
                expireAfterSeconds=0,
                name="ttl_expires_at"
            )
            # Index for efficient queries
            await self.collection.create_index("session_id")
            await self.collection.create_index("customer_id")
            await self.collection.create_index("category")
            await self.collection.create_index("created_at")
            logger.info("Conversation indexes created successfully")
        except Exception as e:
            logger.warning(f"Index creation warning: {e}")
    
    async def create_conversation(self, data: ConversationCreate) -> ConversationResponse:
        """Create a new conversation record"""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=self.RETENTION_DAYS)
        
        doc = {
            "session_id": data.session_id,
            "situation": data.situation,
            "response": data.response,
            "translated_response": data.translated_response,
            "customer_id": data.customer_id,
            "customer_name": data.customer_name,
            "vehicle_info": data.vehicle_info,
            "category": data.category or self._detect_category(data.situation, data.shortcut_used),
            "language": data.language,
            "shortcut_used": data.shortcut_used,
            "created_at": now,
            "expires_at": expires_at,
        }
        
        result = await self.collection.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        del doc["_id"] if "_id" in doc else None
        
        return ConversationResponse(**{**doc, "id": str(result.inserted_id)})
    
    def _detect_category(self, situation: str, shortcut_used: Optional[str] = None) -> str:
        """Auto-detect category based on situation text or shortcut"""
        situation_lower = situation.lower()
        
        # Map shortcuts to categories
        shortcut_map = {
            "price_high": "price_negotiation",
            "payment": "financing",
            "trade_in": "trade_in",
            "competitor": "competitor",
            "features": "features",
            "need_think": "objection_handling",
            "spouse": "objection_handling",
            "timing": "follow_up",
        }
        
        if shortcut_used and shortcut_used in shortcut_map:
            return shortcut_map[shortcut_used]
        
        # Keyword detection
        if any(w in situation_lower for w in ["price", "cost", "expensive", "discount", "deal"]):
            return "price_negotiation"
        if any(w in situation_lower for w in ["trade", "trade-in", "current car", "my car"]):
            return "trade_in"
        if any(w in situation_lower for w in ["payment", "finance", "monthly", "loan", "interest"]):
            return "financing"
        if any(w in situation_lower for w in ["competitor", "other dealer", "elsewhere", "honda", "toyota", "ford"]):
            return "competitor"
        if any(w in situation_lower for w in ["feature", "option", "doesn't have", "missing"]):
            return "features"
        if any(w in situation_lower for w in ["think about", "later", "spouse", "wife", "husband", "decide"]):
            return "objection_handling"
        if any(w in situation_lower for w in ["follow up", "call back", "check in", "tomorrow"]):
            return "follow_up"
        
        return "general"
    
    async def get_conversations(
        self,
        session_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get conversations with optional filters"""
        query = {}
        
        if session_id:
            query["session_id"] = session_id
        if customer_id:
            query["customer_id"] = customer_id
        if category:
            query["category"] = category
        
        cursor = self.collection.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(offset).limit(limit)
        
        conversations = []
        async for doc in cursor:
            doc["id"] = str(doc.get("_id", ""))
            conversations.append(doc)
        
        return conversations
    
    async def get_conversation_by_id(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get a single conversation by ID"""
        from bson import ObjectId
        
        try:
            doc = await self.collection.find_one(
                {"_id": ObjectId(conversation_id)},
                {"_id": 0}
            )
            if doc:
                doc["id"] = conversation_id
            return doc
        except Exception:
            return None
    
    async def get_session_history(self, session_id: str) -> List[Dict[str, Any]]:
        """Get all conversations in a session"""
        return await self.get_conversations(session_id=session_id, limit=100)
    
    async def get_customer_history(self, customer_id: str) -> List[Dict[str, Any]]:
        """Get all conversations for a customer"""
        return await self.get_conversations(customer_id=customer_id, limit=100)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get conversation statistics"""
        pipeline = [
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "by_category": [
                        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}}
                    ],
                    "by_language": [
                        {"$group": {"_id": "$language", "count": {"$sum": 1}}}
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
                    "shortcuts_used": [
                        {"$match": {"shortcut_used": {"$ne": None}}},
                        {"$group": {"_id": "$shortcut_used", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}}
                    ]
                }
            }
        ]
        
        result = await self.collection.aggregate(pipeline).to_list(1)
        
        if result:
            data = result[0]
            return {
                "total_conversations": data["total"][0]["count"] if data["total"] else 0,
                "conversations_24h": data["recent_24h"][0]["count"] if data["recent_24h"] else 0,
                "by_category": {item["_id"]: item["count"] for item in data["by_category"]},
                "by_language": {item["_id"]: item["count"] for item in data["by_language"]},
                "top_shortcuts": {item["_id"]: item["count"] for item in data["shortcuts_used"][:5]},
            }
        
        return {
            "total_conversations": 0,
            "conversations_24h": 0,
            "by_category": {},
            "by_language": {},
            "top_shortcuts": {},
        }
    
    async def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a specific conversation"""
        from bson import ObjectId
        
        try:
            result = await self.collection.delete_one({"_id": ObjectId(conversation_id)})
            return result.deleted_count > 0
        except Exception:
            return False
    
    async def delete_session(self, session_id: str) -> int:
        """Delete all conversations in a session"""
        result = await self.collection.delete_many({"session_id": session_id})
        return result.deleted_count
    
    async def cleanup_expired(self) -> int:
        """Manually cleanup expired conversations (TTL index handles this automatically)"""
        result = await self.collection.delete_many({
            "expires_at": {"$lt": datetime.now(timezone.utc)}
        })
        return result.deleted_count
    
    @classmethod
    def get_categories(cls) -> List[Dict[str, str]]:
        """Get available conversation categories"""
        return cls.CATEGORIES
