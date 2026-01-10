"""
Integration Manager
Central management for all CRM integrations
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone
import uuid

from motor.motor_asyncio import AsyncIOMotorDatabase

from .base import (
    BaseAdapter,
    AdapterConfig,
    AdapterRegistry,
    AuthConfig,
    AuthMethod,
    FetchResult,
)

# Import all connectors to register them
from .connectors import (
    VinSolutionsAdapter,
    DealerSocketAdapter,
    EleadAdapter,
    CDKAdapter,
    DealerTrackAdapter,
    ReynoldsAdapter,
    ProMaxAdapter,
)

logger = logging.getLogger(__name__)


class IntegrationManager:
    """
    Central manager for CRM integrations
    
    Handles:
    - Integration configuration storage
    - Adapter lifecycle
    - Data fetching and normalization
    - Sync scheduling
    """
    
    COLLECTION_NAME = "integrations"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db[self.COLLECTION_NAME]
        self._adapters: Dict[str, BaseAdapter] = {}
    
    async def create_indexes(self):
        """Create database indexes"""
        await self.collection.create_index("adapter_type")
        await self.collection.create_index("is_active")
        await self.collection.create_index("created_at")
    
    # ==================== ADAPTER REGISTRY ====================
    
    def list_available_adapters(self) -> List[Dict[str, Any]]:
        """List all available adapter types"""
        return AdapterRegistry.list_adapters()
    
    def get_adapter_setup_instructions(self, adapter_type: str) -> Optional[Dict[str, Any]]:
        """Get setup instructions for an adapter type"""
        adapter_class = AdapterRegistry.get(adapter_type)
        if adapter_class and hasattr(adapter_class, 'get_setup_instructions'):
            return adapter_class.get_setup_instructions()
        return None
    
    # ==================== INTEGRATION CRUD ====================
    
    async def create_integration(
        self,
        name: str,
        adapter_type: str,
        base_url: str,
        auth_config: Dict[str, Any],
        data_type: str = "customers",
        field_mappings: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> str:
        """
        Create a new integration configuration
        
        Returns:
            Integration ID
        """
        # Validate adapter type
        if not AdapterRegistry.get(adapter_type):
            raise ValueError(f"Unknown adapter type: {adapter_type}")
        
        integration_id = str(uuid.uuid4())
        
        # Build auth config
        auth = AuthConfig(
            method=AuthMethod(auth_config.get('method', 'api_key')),
            api_key=auth_config.get('api_key'),
            api_key_header=auth_config.get('api_key_header', 'X-API-Key'),
            username=auth_config.get('username'),
            password=auth_config.get('password'),
            client_id=auth_config.get('client_id'),
            client_secret=auth_config.get('client_secret'),
            token_url=auth_config.get('token_url'),
            custom_headers=auth_config.get('custom_headers', {}),
        )
        
        # Create config
        config = AdapterConfig(
            id=integration_id,
            name=name,
            adapter_type=adapter_type,
            base_url=base_url,
            auth=auth,
            data_type=data_type,
            field_mappings=field_mappings or {},
            requests_per_minute=kwargs.get('requests_per_minute', 60),
            requests_per_day=kwargs.get('requests_per_day', 10000),
            page_size=kwargs.get('page_size', 100),
        )
        
        # Store in database (without sensitive auth data in plain text)
        doc = {
            "_id": integration_id,
            "name": name,
            "adapter_type": adapter_type,
            "base_url": base_url,
            "auth_method": auth.method.value,
            "auth_config_encrypted": self._encrypt_auth(auth_config),  # TODO: Implement encryption
            "data_type": data_type,
            "field_mappings": field_mappings or {},
            "requests_per_minute": config.requests_per_minute,
            "requests_per_day": config.requests_per_day,
            "page_size": config.page_size,
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_sync_at": None,
            "last_sync_status": None,
            "sync_stats": {},
        }
        
        await self.collection.insert_one(doc)
        
        return integration_id
    
    async def get_integration(self, integration_id: str) -> Optional[Dict[str, Any]]:
        """Get integration by ID"""
        doc = await self.collection.find_one({"_id": integration_id})
        if doc:
            doc['id'] = doc.pop('_id')
        return doc
    
    async def list_integrations(
        self,
        active_only: bool = False,
        adapter_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all integrations"""
        query = {}
        if active_only:
            query['is_active'] = True
        if adapter_type:
            query['adapter_type'] = adapter_type
        
        cursor = self.collection.find(query).sort("name", 1)
        integrations = []
        
        async for doc in cursor:
            doc['id'] = doc.pop('_id')
            # Remove sensitive data
            doc.pop('auth_config_encrypted', None)
            integrations.append(doc)
        
        return integrations
    
    async def update_integration(
        self,
        integration_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update integration configuration"""
        # Remove fields that shouldn't be updated directly
        updates.pop('_id', None)
        updates.pop('id', None)
        updates.pop('created_at', None)
        
        if 'auth_config' in updates:
            updates['auth_config_encrypted'] = self._encrypt_auth(updates.pop('auth_config'))
        
        result = await self.collection.update_one(
            {"_id": integration_id},
            {"$set": updates}
        )
        
        return result.modified_count > 0
    
    async def delete_integration(self, integration_id: str) -> bool:
        """Delete an integration"""
        result = await self.collection.delete_one({"_id": integration_id})
        
        # Remove cached adapter
        self._adapters.pop(integration_id, None)
        
        return result.deleted_count > 0
    
    # ==================== ADAPTER LIFECYCLE ====================
    
    async def get_adapter(self, integration_id: str) -> Optional[BaseAdapter]:
        """Get or create an adapter instance for an integration"""
        # Check cache
        if integration_id in self._adapters:
            return self._adapters[integration_id]
        
        # Load from database
        doc = await self.collection.find_one({"_id": integration_id})
        if not doc:
            return None
        
        # Decrypt auth config
        auth_config = self._decrypt_auth(doc.get('auth_config_encrypted', {}))
        
        # Build adapter config
        auth = AuthConfig(
            method=AuthMethod(doc.get('auth_method', 'api_key')),
            api_key=auth_config.get('api_key'),
            api_key_header=auth_config.get('api_key_header', 'X-API-Key'),
            username=auth_config.get('username'),
            password=auth_config.get('password'),
            client_id=auth_config.get('client_id'),
            client_secret=auth_config.get('client_secret'),
            token_url=auth_config.get('token_url'),
            access_token=auth_config.get('access_token'),
            custom_headers=auth_config.get('custom_headers', {}),
        )
        
        config = AdapterConfig(
            id=integration_id,
            name=doc['name'],
            adapter_type=doc['adapter_type'],
            base_url=doc['base_url'],
            auth=auth,
            data_type=doc.get('data_type', 'customers'),
            field_mappings=doc.get('field_mappings', {}),
            requests_per_minute=doc.get('requests_per_minute', 60),
            requests_per_day=doc.get('requests_per_day', 10000),
            page_size=doc.get('page_size', 100),
        )
        
        # Create adapter
        adapter = AdapterRegistry.create(config)
        if adapter:
            self._adapters[integration_id] = adapter
        
        return adapter
    
    # ==================== DATA SYNC ====================
    
    async def sync_integration(
        self,
        integration_id: str,
        full_sync: bool = False
    ) -> FetchResult:
        """
        Sync data from an integration
        
        Args:
            integration_id: Integration to sync
            full_sync: If True, fetch all data. If False, fetch only updates since last sync.
        
        Returns:
            FetchResult with synced data
        """
        adapter = await self.get_adapter(integration_id)
        if not adapter:
            result = FetchResult(success=False)
            result.add_error(f"Integration not found: {integration_id}")
            return result
        
        # Get last sync time for incremental sync
        doc = await self.collection.find_one({"_id": integration_id})
        since = None
        if not full_sync and doc.get('last_sync_at'):
            since = doc['last_sync_at']
        
        # Fetch data
        if adapter.config.data_type == "customers":
            result = await adapter.fetch_customers(since)
        else:
            result = await adapter.fetch_vehicles(since)
        
        # Update sync status
        await self.collection.update_one(
            {"_id": integration_id},
            {
                "$set": {
                    "last_sync_at": datetime.now(timezone.utc),
                    "last_sync_status": "success" if result.success else "failed",
                    "sync_stats": {
                        "records_fetched": result.total_records,
                        "pages_fetched": result.pages_fetched,
                        "duration_ms": result.fetch_duration_ms,
                        "errors": len(result.errors),
                    }
                }
            }
        )
        
        return result
    
    async def test_connection(self, integration_id: str) -> Dict[str, Any]:
        """Test connection for an integration"""
        adapter = await self.get_adapter(integration_id)
        if not adapter:
            return {"success": False, "message": "Integration not found"}
        
        success, message = await adapter.test_connection()
        return {"success": success, "message": message}
    
    # ==================== HELPERS ====================
    
    def _encrypt_auth(self, auth_config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Encrypt sensitive auth data
        
        TODO: Implement proper encryption (AES-256, etc.)
        For now, returns as-is (should use a secrets manager in production)
        """
        return auth_config
    
    def _decrypt_auth(self, encrypted: Dict[str, Any]) -> Dict[str, Any]:
        """
        Decrypt auth data
        
        TODO: Implement proper decryption
        """
        return encrypted if encrypted else {}
