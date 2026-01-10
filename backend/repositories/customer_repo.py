"""
Customer Repository
Handles customer data persistence with optimized queries
"""

from typing import List, Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, TEXT

from .base import BaseRepository
from data_integration.models import Customer, LeadStatus


class CustomerRepository(BaseRepository):
    """Repository for customer/lead data"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "customers")
    
    async def create_indexes(self):
        """Create indexes for efficient queries"""
        await self.collection.create_index([("phone", ASCENDING)], unique=False)
        await self.collection.create_index([("email", ASCENDING)])
        await self.collection.create_index([("lead_status", ASCENDING)])
        await self.collection.create_index([("source_id", ASCENDING)])
        await self.collection.create_index([("imported_at", DESCENDING)])
        await self.collection.create_index([
            ("first_name", TEXT),
            ("last_name", TEXT),
            ("email", TEXT)
        ])
    
    async def upsert_from_import(
        self,
        customers: List[Customer],
        source_id: str
    ) -> Dict[str, int]:
        """
        Upsert customers from import
        Uses phone number as unique identifier for deduplication
        """
        stats = {"inserted": 0, "updated": 0, "skipped": 0}
        
        for customer in customers:
            doc = customer.model_dump()
            doc['source_id'] = source_id
            
            # Try to find existing by phone (within same source)
            existing = await self.collection.find_one({
                "phone": customer.phone,
                "source_id": source_id
            })
            
            if existing:
                # Update existing
                doc.pop('id', None)
                doc.pop('imported_at', None)
                await self.collection.update_one(
                    {"_id": existing['_id']},
                    {"$set": doc}
                )
                stats['updated'] += 1
            else:
                # Insert new
                await self.insert_one(doc)
                stats['inserted'] += 1
        
        return stats
    
    async def find_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        """Find customer by phone number"""
        # Normalize phone for search
        normalized = ''.join(filter(str.isdigit, phone))
        
        # Search with regex for flexible matching
        doc = await self.collection.find_one({
            "$or": [
                {"phone": phone},
                {"phone": {"$regex": normalized}}
            ]
        })
        return self._convert_doc(doc) if doc else None
    
    async def find_by_status(
        self,
        status: LeadStatus,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Find customers by lead status"""
        return await self.find_many(
            {"lead_status": status.value},
            limit=limit,
            skip=skip,
            sort=[("imported_at", DESCENDING)]
        )
    
    async def find_by_source(
        self,
        source_id: str,
        limit: int = 100,
        skip: int = 0
    ) -> List[Dict[str, Any]]:
        """Find customers from a specific data source"""
        return await self.find_many(
            {"source_id": source_id},
            limit=limit,
            skip=skip,
            sort=[("imported_at", DESCENDING)]
        )
    
    async def search(
        self,
        query: str,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Full-text search customers"""
        if not query:
            return []
        
        docs = await self.collection.find(
            {"$text": {"$search": query}},
            {"score": {"$meta": "textScore"}}
        ).sort([("score", {"$meta": "textScore"})]).limit(limit).to_list(limit)
        
        return [self._convert_doc(doc) for doc in docs]
    
    async def delete_by_source(self, source_id: str) -> int:
        """Delete all customers from a source"""
        return await self.delete_many({"source_id": source_id})
    
    async def get_status_counts(self, source_id: Optional[str] = None) -> Dict[str, int]:
        """Get count of customers by status"""
        match_stage = {"source_id": source_id} if source_id else {}
        
        pipeline = [
            {"$match": match_stage} if match_stage else {"$match": {}},
            {"$group": {"_id": "$lead_status", "count": {"$sum": 1}}}
        ]
        
        results = await self.collection.aggregate(pipeline).to_list(10)
        return {r['_id']: r['count'] for r in results if r['_id']}
    
    def to_frontend_format(self, customers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert customers to frontend format"""
        result = []
        for c in customers:
            result.append({
                "id": c.get('id'),
                "name": f"{c.get('first_name', '')} {c.get('last_name', '')}".strip(),
                "firstName": c.get('first_name', ''),
                "lastName": c.get('last_name', ''),
                "phone": c.get('phone', ''),
                "email": c.get('email', ''),
                "address": c.get('address', ''),
                "vehicleInterest": c.get('vehicle_of_interest'),
                "status": c.get('lead_status', 'new'),
                "notes": c.get('notes', ''),
                "currentVehicle": c.get('current_vehicle'),
                "tradeIn": c.get('trade_in_info'),
            })
        return result
