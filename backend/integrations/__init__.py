"""
Integration Layer - Read-Only CRM Integration System
Provides adapters for connecting to various automotive CRM systems
"""

from .base import (
    BaseAdapter,
    AdapterConfig,
    AuthMethod,
    AuthConfig,
    FetchResult,
    AdapterRegistry,
)
from .generic_rest import GenericRestAdapter, RestEndpointConfig
from .manager import IntegrationManager

__all__ = [
    'BaseAdapter',
    'AdapterConfig', 
    'AuthMethod',
    'AuthConfig',
    'FetchResult',
    'AdapterRegistry',
    'GenericRestAdapter',
    'RestEndpointConfig',
    'IntegrationManager',
]
