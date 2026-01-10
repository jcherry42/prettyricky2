"""
Integration Manager
Central management for all CRM integrations

Features:
- Integration CRUD operations
- Adapter lifecycle management
- Mock mode for testing without credentials
- Health aggregation
- Credential encryption (placeholder)
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
    ConnectionStatus,
    RateLimitConfig,
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
from .connectors import CONNECTORS as CONNECTOR_METADATA

logger = logging.getLogger(__name__)


class IntegrationManager:
    """
    Central manager for CRM integrations
    
    Handles:
    - Integration configuration storage
    - Adapter lifecycle
    - Data fetching and normalization
    - Health aggregation
    - Mock mode for testing
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
        """List all available adapter types with metadata"""
        adapters = []
        
        # Add connector metadata
        for adapter_type, meta in CONNECTOR_METADATA.items():
            adapters.append({
                "type": adapter_type,
                "name": meta["name"],
                "vendor": meta["vendor"],
                "tier": meta["tier"],
                "description": meta["description"],
                "authMethods": meta.get("authMethods", ["api_key"]),
                "logo": meta.get("logo", adapter_type),
            })
        
        # Sort by tier, then name
        adapters.sort(key=lambda x: (x["tier"], x["name"]))
        return adapters
    
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
        mock_mode: bool = False,
        **kwargs
    ) -> str:
        """
        Create a new integration configuration
        
        Args:
            name: Display name for the integration
            adapter_type: Type of adapter (vinsolutions, dealersocket, etc.)
            base_url: API base URL
            auth_config: Authentication configuration
            data_type: Type of data to sync (customers or vehicles)
            field_mappings: Custom field mappings
            mock_mode: Enable mock mode for testing without credentials
        
        Returns:
            Integration ID
        """
        # Validate adapter type
        if adapter_type != "generic_rest" and not AdapterRegistry.get(adapter_type):
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
        
        # Store in database
        doc = {
            "_id": integration_id,
            "name": name,
            "adapter_type": adapter_type,
            "base_url": base_url,
            "auth_method": auth.method.value,
            "auth_config_encrypted": self._encrypt_auth(auth_config),
            "data_type": data_type,
            "field_mappings": field_mappings or {},
            "mock_mode": mock_mode,
            "mock_customer_count": kwargs.get('mock_customer_count', 50),
            "mock_vehicle_count": kwargs.get('mock_vehicle_count', 100),
            "requests_per_minute": kwargs.get('requests_per_minute', 60),
            "requests_per_day": kwargs.get('requests_per_day', 10000),
            "page_size": kwargs.get('page_size', 100),
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_sync_at": None,
            "last_sync_status": None,
            "sync_stats": {},
            "health_status": "unknown",
        }
        
        await self.collection.insert_one(doc)
        logger.info(f"Created integration {integration_id} ({name}) - Mock mode: {mock_mode}")
        
        return integration_id
    
    async def get_integration(self, integration_id: str) -> Optional[Dict[str, Any]]:
        """Get integration by ID"""
        doc = await self.collection.find_one({"_id": integration_id})
        if doc:
            doc['id'] = doc.pop('_id')
            # Remove sensitive data
            doc.pop('auth_config_encrypted', None)
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
            
            # Add adapter metadata
            if doc['adapter_type'] in CONNECTOR_METADATA:
                meta = CONNECTOR_METADATA[doc['adapter_type']]
                doc['adapter_name'] = meta['name']
                doc['vendor'] = meta['vendor']
            
            integrations.append(doc)
        
        return integrations
    
    async def update_integration(
        self,
        integration_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update integration configuration"""
        # Remove fields that shouldn't be updated directly
        for key in ['_id', 'id', 'created_at']:
            updates.pop(key, None)
        
        if 'auth_config' in updates:
            updates['auth_config_encrypted'] = self._encrypt_auth(updates.pop('auth_config'))
        
        result = await self.collection.update_one(
            {"_id": integration_id},
            {"$set": updates}
        )
        
        # Clear cached adapter if config changed
        self._adapters.pop(integration_id, None)
        
        return result.modified_count > 0
    
    async def delete_integration(self, integration_id: str) -> bool:
        """Delete an integration"""
        result = await self.collection.delete_one({"_id": integration_id})
        
        # Remove cached adapter
        self._adapters.pop(integration_id, None)
        
        return result.deleted_count > 0
    
    async def toggle_integration(self, integration_id: str, is_active: bool) -> bool:
        """Enable or disable an integration"""
        result = await self.collection.update_one(
            {"_id": integration_id},
            {"$set": {"is_active": is_active}}
        )
        return result.modified_count > 0
    
    async def toggle_mock_mode(self, integration_id: str, mock_mode: bool) -> bool:
        """Toggle mock mode for an integration"""
        result = await self.collection.update_one(
            {"_id": integration_id},
            {"$set": {"mock_mode": mock_mode}}
        )
        # Clear cached adapter
        self._adapters.pop(integration_id, None)
        return result.modified_count > 0
    
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
            page_size=doc.get('page_size', 100),
            mock_mode=doc.get('mock_mode', False),
            mock_customer_count=doc.get('mock_customer_count', 50),
            mock_vehicle_count=doc.get('mock_vehicle_count', 100),
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
        try:
            if adapter.config.data_type == "customers":
                result = await adapter.fetch_customers(since)
            else:
                result = await adapter.fetch_vehicles(since)
            
            # Update sync status
            status = "success" if result.success else "failed"
            health_status = "healthy" if result.success else "unhealthy"
            
            await self.collection.update_one(
                {"_id": integration_id},
                {
                    "$set": {
                        "last_sync_at": datetime.now(timezone.utc),
                        "last_sync_status": status,
                        "health_status": health_status,
                        "sync_stats": {
                            "records_fetched": result.total_records,
                            "pages_fetched": result.pages_fetched,
                            "duration_ms": result.fetch_duration_ms,
                            "errors": len(result.errors),
                            "warnings": len(result.warnings),
                            "is_mock": adapter.config.mock_mode,
                        }
                    }
                }
            )
            
            logger.info(
                f"Sync completed for {integration_id}: {result.total_records} records "
                f"in {result.fetch_duration_ms}ms (mock={adapter.config.mock_mode})"
            )
            
        except Exception as e:
            logger.error(f"Sync failed for {integration_id}: {e}")
            result = FetchResult(success=False)
            result.add_error(str(e))
            
            await self.collection.update_one(
                {"_id": integration_id},
                {
                    "$set": {
                        "last_sync_status": "failed",
                        "health_status": "unhealthy",
                        "sync_stats.last_error": str(e),
                    }
                }
            )
        
        return result
    
    async def test_connection(self, integration_id: str) -> Dict[str, Any]:
        """Test connection for an integration"""
        adapter = await self.get_adapter(integration_id)
        if not adapter:
            return {"success": False, "message": "Integration not found"}
        
        try:
            success, message = await adapter.test_connection()
            
            # Update health status
            health_status = "healthy" if success else "unhealthy"
            await self.collection.update_one(
                {"_id": integration_id},
                {"$set": {"health_status": health_status}}
            )
            
            return {
                "success": success,
                "message": message,
                "mock_mode": adapter.config.mock_mode,
            }
        except Exception as e:
            logger.error(f"Connection test failed for {integration_id}: {e}")
            await self.collection.update_one(
                {"_id": integration_id},
                {"$set": {"health_status": "unhealthy"}}
            )
            return {"success": False, "message": str(e)}
    
    # ==================== HEALTH ====================
    
    async def get_health_summary(self) -> Dict[str, Any]:
        """Get aggregated health status across all integrations"""
        integrations = await self.list_integrations(active_only=True)
        
        summary = {
            "total": len(integrations),
            "healthy": 0,
            "degraded": 0,
            "unhealthy": 0,
            "unknown": 0,
            "mock_mode": 0,
            "integrations": [],
        }
        
        for integration in integrations:
            status = integration.get('health_status', 'unknown')
            
            if status == 'healthy':
                summary['healthy'] += 1
            elif status == 'degraded':
                summary['degraded'] += 1
            elif status == 'unhealthy':
                summary['unhealthy'] += 1
            else:
                summary['unknown'] += 1
            
            if integration.get('mock_mode', False):
                summary['mock_mode'] += 1
            
            summary['integrations'].append({
                "id": integration['id'],
                "name": integration['name'],
                "adapter_type": integration['adapter_type'],
                "status": status,
                "mock_mode": integration.get('mock_mode', False),
                "last_sync_at": integration.get('last_sync_at'),
                "last_sync_status": integration.get('last_sync_status'),
            })
        
        # Overall status
        if summary['unhealthy'] > 0:
            summary['overall_status'] = 'unhealthy'
        elif summary['degraded'] > 0 or summary['unknown'] > summary['healthy']:
            summary['overall_status'] = 'degraded'
        elif summary['healthy'] > 0:
            summary['overall_status'] = 'healthy'
        else:
            summary['overall_status'] = 'no_integrations'
        
        return summary
    
    async def get_integration_health(self, integration_id: str) -> Dict[str, Any]:
        """Get detailed health info for a specific integration"""
        adapter = await self.get_adapter(integration_id)
        doc = await self.collection.find_one({"_id": integration_id})
        
        if not doc:
            return {"error": "Integration not found"}
        
        health_info = {
            "id": integration_id,
            "name": doc['name'],
            "adapter_type": doc['adapter_type'],
            "health_status": doc.get('health_status', 'unknown'),
            "is_active": doc.get('is_active', False),
            "mock_mode": doc.get('mock_mode', False),
            "last_sync_at": doc.get('last_sync_at'),
            "last_sync_status": doc.get('last_sync_status'),
            "sync_stats": doc.get('sync_stats', {}),
        }
        
        # Add adapter health if available
        if adapter:
            health_info['connection_health'] = adapter.health.to_dict()
            health_info['rate_limiter_stats'] = adapter.rate_limiter.get_stats()
        
        return health_info
    
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
