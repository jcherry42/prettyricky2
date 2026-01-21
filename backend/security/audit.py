"""Audit logging for federal compliance"""
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

class AuditLogger:
    """Federal-grade audit logging system"""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db.audit_logs
    
    async def log(
        self,
        action: str,
        user_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        status: str = 'success'
    ):
        """Log an audit event"""
        audit_entry = {
            'timestamp': datetime.now(timezone.utc),
            'action': action,
            'user_id': user_id,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'details': details or {},
            'ip_address': ip_address,
            'user_agent': user_agent,
            'status': status
        }
        
        try:
            await self.collection.insert_one(audit_entry)
            logger.info(f'Audit log: {action} by {user_id} - {status}')
        except Exception as e:
            # NEVER fail the request if audit logging fails
            # But log the error for investigation
            logger.error(f'Failed to write audit log: {str(e)}')
    
    async def create_indexes(self):
        """Create indexes for audit logs"""
        await self.collection.create_index('timestamp')
        await self.collection.create_index('user_id')
        await self.collection.create_index('action')
        await self.collection.create_index('resource_type')
    
    async def get_user_activity(
        self,
        user_id: str,
        limit: int = 100,
        skip: int = 0
    ):
        """Get audit logs for a specific user"""
        cursor = self.collection.find(
            {'user_id': user_id},
            {'_id': 0}
        ).sort('timestamp', -1).skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def get_resource_history(
        self,
        resource_type: str,
        resource_id: str,
        limit: int = 50
    ):
        """Get audit trail for a specific resource"""
        cursor = self.collection.find(
            {
                'resource_type': resource_type,
                'resource_id': resource_id
            },
            {'_id': 0}
        ).sort('timestamp', -1).limit(limit)
        
        return await cursor.to_list(length=limit)