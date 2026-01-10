"""
Fortified Integration Layer - Production-Grade CRM Integration System
=====================================================================

A robust, enterprise-ready integration layer for automotive CRM systems.

Key Features:
- Read-only by design (never writes to source systems)
- Automatic retry with exponential backoff
- Rate limiting with sliding window
- Connection pooling
- Health monitoring
- Credential encryption
- OAuth token refresh
- Comprehensive logging and audit trail
- Delta sync support
- Webhook real-time updates
"""

from .base import (
    BaseAdapter,
    AdapterConfig,
    AuthMethod,
    AuthConfig,
    FetchResult,
    AdapterRegistry,
    ConnectionHealth,
    RateLimiter,
)
from .generic_rest import GenericRestAdapter, RestEndpointConfig
from .manager import IntegrationManager
from .sync_engine import SyncEngine, SyncJob, SyncResult
from .health import HealthMonitor, IntegrationHealth

__all__ = [
    # Base
    'BaseAdapter',
    'AdapterConfig', 
    'AuthMethod',
    'AuthConfig',
    'FetchResult',
    'AdapterRegistry',
    'ConnectionHealth',
    'RateLimiter',
    # REST
    'GenericRestAdapter',
    'RestEndpointConfig',
    # Manager
    'IntegrationManager',
    # Sync
    'SyncEngine',
    'SyncJob',
    'SyncResult',
    # Health
    'HealthMonitor',
    'IntegrationHealth',
]
