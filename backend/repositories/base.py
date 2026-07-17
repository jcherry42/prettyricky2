"""
Repository Base Class
Provides common database operations
"""

from abc import ABC
from typing import List, Dict, Any, Optional, TypeVar, Generic
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorCollection
from bson import ObjectId
from datetime import datetime, timezone

T = TypeVar('T')


class BaseRepository(ABC, Generic[T]):
    """
    Abstract base repository with common CRUD operations
    Handles MongoDB ObjectId conversion and timestamp management
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str):
        self.db = db
        self.collection: AsyncIOMotorCollection = db[collection_name]
        self.collection_name = collection_name
    
    async def create_indexes(self):
        """Create necessary indexes - override in subclasses"""
        pass
    
    async def insert_one(self, document: Dict[str, Any]) -> str:
        """Insert a single document and return ID"""
        document['created_at'] = datetime.now(timezone.utc)
        document['updated_at'] = datetime.now(timezone.utc)
        
        result = await self.collection.insert_one(document)
        return str(result.inserted_id)
    
    async def insert_many(self, documents: List[Dict[str, Any]]) -> List[str]:
        """Insert multiple documents and return IDs"""
        now = datetime.now(timezone.utc)
        
        for doc in documents:
            doc['created_at'] = now
            doc['updated_at'] = now
        
        result = await self.collection.insert_many(documents)
        return [str(id) for id in result.inserted_ids]
    
    async def find_by_id(self, id: str) -> Optional[Dict[str, Any]]:
        """Find document by ID"""
        try:
            doc = await self.collection.find_one({"_id": ObjectId(id)})
            return self._convert_doc(doc) if doc else None
        except Exception:
            return None
    
    async def find_one(self, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Find single document matching query"""
        doc = await self.collection.find_one(query)
        return self._convert_doc(doc) if doc else None
    
    async def find_many(
        self,
        query: Dict[str, Any] = None,
        limit: int = 100,
        skip: int = 0,
        sort: List[tuple] = None
    ) -> List[Dict[str, Any]]:
        """Find multiple documents"""
        cursor = self.collection.find(query or {})
        
        if sort:
            cursor = cursor.sort(sort)
        
        cursor = cursor.skip(skip).limit(limit)
        
        docs = await cursor.to_list(limit)
        return [self._convert_doc(doc) for doc in docs]
    
    async def update_one(self, id: str, updates: Dict[str, Any]) -> bool:
        """Update a single document"""
        updates['updated_at'] = datetime.now(timezone.utc)
        
        result = await self.collection.update_one(
            {"_id": ObjectId(id)},
            {"$set": updates}
        )
        return result.modified_count > 0
    
    async def delete_one(self, id: str) -> bool:
        """Delete a single document"""
        result = await self.collection.delete_one({"_id": ObjectId(id)})
        return result.deleted_count > 0
    
    async def delete_many(self, query: Dict[str, Any]) -> int:
        """Delete multiple documents"""
        result = await self.collection.delete_many(query)
        return result.deleted_count
    
    async def count(self, query: Dict[str, Any] = None) -> int:
        """Count documents matching query"""
        return await self.collection.count_documents(query or {})
    
    async def exists(self, query: Dict[str, Any]) -> bool:
        """Check if any document matches query"""
        doc = await self.collection.find_one(query, {"_id": 1})
        return doc is not None
    
    def _convert_doc(self, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Convert MongoDB document (handle ObjectId)"""
        if doc and '_id' in doc:
            doc['id'] = str(doc.pop('_id'))
        return doc
