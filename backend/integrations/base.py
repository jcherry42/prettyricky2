"""
Base Adapter Interface
Defines the contract for all CRM integrations
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
import hashlib
import hmac
import logging

logger = logging.getLogger(__name__)


class AuthMethod(str, Enum):
    """Supported authentication methods"""
    NONE = "none"
    API_KEY = "api_key"
    BEARER_TOKEN = "bearer_token"
    BASIC_AUTH = "basic_auth"
    OAUTH2 = "oauth2"
    CUSTOM_HEADER = "custom_header"


@dataclass
class AuthConfig:
    """Authentication configuration"""
    method: AuthMethod = AuthMethod.NONE
    
    # API Key / Bearer Token
    api_key: Optional[str] = None
    api_key_header: str = "X-API-Key"  # Header name for API key
    
    # Basic Auth
    username: Optional[str] = None
    password: Optional[str] = None
    
    # OAuth2
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    token_url: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: List[str] = field(default_factory=list)
    
    # Custom Header
    custom_headers: Dict[str, str] = field(default_factory=dict)
    
    def get_headers(self) -> Dict[str, str]:
        """Generate authentication headers"""
        headers = {}
        
        if self.method == AuthMethod.API_KEY and self.api_key:
            headers[self.api_key_header] = self.api_key
        elif self.method == AuthMethod.BEARER_TOKEN and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        elif self.method == AuthMethod.OAUTH2 and self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        elif self.method == AuthMethod.CUSTOM_HEADER:
            headers.update(self.custom_headers)
        # Basic auth handled separately in httpx
        
        return headers
    
    def get_basic_auth(self) -> Optional[Tuple[str, str]]:
        """Get basic auth tuple if applicable"""
        if self.method == AuthMethod.BASIC_AUTH and self.username:
            return (self.username, self.password or "")
        return None


@dataclass
class AdapterConfig:
    """Configuration for a CRM adapter"""
    id: str
    name: str
    adapter_type: str  # e.g., "vinsolutions", "dealersocket", "generic_rest"
    
    # Connection
    base_url: str
    auth: AuthConfig = field(default_factory=AuthConfig)
    
    # Rate limiting
    requests_per_minute: int = 60
    requests_per_day: int = 10000
    
    # Retry config
    max_retries: int = 3
    retry_delay_seconds: float = 1.0
    
    # Field mapping overrides (source_field -> canonical_field)
    field_mappings: Dict[str, str] = field(default_factory=dict)
    
    # Data type this adapter fetches
    data_type: str = "customers"  # "customers" or "vehicles"
    
    # Pagination
    page_size: int = 100
    max_pages: int = 100  # Safety limit
    
    # Metadata
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_sync_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "id": self.id,
            "name": self.name,
            "adapter_type": self.adapter_type,
            "base_url": self.base_url,
            "auth_method": self.auth.method.value,
            "requests_per_minute": self.requests_per_minute,
            "requests_per_day": self.requests_per_day,
            "field_mappings": self.field_mappings,
            "data_type": self.data_type,
            "page_size": self.page_size,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat(),
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
        }


@dataclass
class FetchResult:
    """Result of a data fetch operation"""
    success: bool
    records: List[Dict[str, Any]] = field(default_factory=list)
    total_records: int = 0
    pages_fetched: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # Rate limit info
    rate_limit_remaining: Optional[int] = None
    rate_limit_reset: Optional[datetime] = None
    
    # Timing
    fetch_duration_ms: int = 0
    
    def add_error(self, error: str):
        if len(self.errors) < 50:
            self.errors.append(error)
    
    def add_warning(self, warning: str):
        if len(self.warnings) < 50:
            self.warnings.append(warning)


class BaseAdapter(ABC):
    """
    Abstract base class for CRM adapters
    
    All adapters are READ-ONLY by design.
    They fetch data from external systems but never write back.
    """
    
    # Adapter metadata (override in subclasses)
    ADAPTER_TYPE: str = "base"
    ADAPTER_NAME: str = "Base Adapter"
    SUPPORTED_DATA_TYPES: List[str] = ["customers", "vehicles"]
    
    # Default field mappings (source -> canonical)
    DEFAULT_CUSTOMER_MAPPINGS: Dict[str, str] = {}
    DEFAULT_VEHICLE_MAPPINGS: Dict[str, str] = {}
    
    def __init__(self, config: AdapterConfig):
        self.config = config
        self._request_count = 0
        self._last_request_time: Optional[datetime] = None
    
    @abstractmethod
    async def fetch_customers(self, since: Optional[datetime] = None) -> FetchResult:
        """
        Fetch customers/leads from the CRM
        
        Args:
            since: Optional timestamp to fetch only records modified after this time
            
        Returns:
            FetchResult with normalized customer records
        """
        pass
    
    @abstractmethod
    async def fetch_vehicles(self, since: Optional[datetime] = None) -> FetchResult:
        """
        Fetch vehicle inventory from the CRM
        
        Args:
            since: Optional timestamp to fetch only records modified after this time
            
        Returns:
            FetchResult with normalized vehicle records
        """
        pass
    
    @abstractmethod
    async def test_connection(self) -> Tuple[bool, str]:
        """
        Test the connection to the CRM
        
        Returns:
            Tuple of (success, message)
        """
        pass
    
    def get_field_mappings(self, data_type: str) -> Dict[str, str]:
        """Get field mappings with overrides applied"""
        if data_type == "customers":
            base_mappings = self.DEFAULT_CUSTOMER_MAPPINGS.copy()
        else:
            base_mappings = self.DEFAULT_VEHICLE_MAPPINGS.copy()
        
        # Apply user overrides
        base_mappings.update(self.config.field_mappings)
        return base_mappings
    
    def normalize_record(self, record: Dict[str, Any], data_type: str) -> Dict[str, Any]:
        """
        Normalize a record using field mappings
        
        Converts CRM-specific field names to canonical names
        """
        mappings = self.get_field_mappings(data_type)
        normalized = {}
        
        for source_field, value in record.items():
            # Check if we have a mapping for this field
            if source_field in mappings:
                canonical_field = mappings[source_field]
                normalized[canonical_field] = value
            else:
                # Keep unmapped fields with original name
                normalized[source_field] = value
        
        return normalized
    
    async def _check_rate_limit(self) -> bool:
        """Check if we're within rate limits"""
        # Simple implementation - can be enhanced with sliding window
        return self._request_count < self.config.requests_per_minute
    
    async def _record_request(self):
        """Record a request for rate limiting"""
        self._request_count += 1
        self._last_request_time = datetime.now(timezone.utc)


class AdapterRegistry:
    """Registry of available adapters"""
    
    _adapters: Dict[str, type] = {}
    
    @classmethod
    def register(cls, adapter_type: str):
        """Decorator to register an adapter class"""
        def decorator(adapter_class: type):
            cls._adapters[adapter_type] = adapter_class
            return adapter_class
        return decorator
    
    @classmethod
    def get(cls, adapter_type: str) -> Optional[type]:
        """Get an adapter class by type"""
        return cls._adapters.get(adapter_type)
    
    @classmethod
    def list_adapters(cls) -> List[Dict[str, Any]]:
        """List all registered adapters"""
        adapters = []
        for adapter_type, adapter_class in cls._adapters.items():
            adapters.append({
                "type": adapter_type,
                "name": getattr(adapter_class, 'ADAPTER_NAME', adapter_type),
                "supportedDataTypes": getattr(adapter_class, 'SUPPORTED_DATA_TYPES', []),
            })
        return adapters
    
    @classmethod
    def create(cls, config: AdapterConfig) -> Optional[BaseAdapter]:
        """Create an adapter instance from config"""
        adapter_class = cls.get(config.adapter_type)
        if adapter_class:
            return adapter_class(config)
        return None


# Webhook signature verification
def verify_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
    algorithm: str = "sha256"
) -> bool:
    """
    Verify webhook signature using HMAC
    
    Args:
        payload: Raw request body
        signature: Signature from header (may include algorithm prefix)
        secret: Webhook secret
        algorithm: Hash algorithm (sha256, sha1)
    
    Returns:
        True if signature is valid
    """
    # Handle signature formats like "sha256=abc123" or just "abc123"
    if "=" in signature:
        algo_prefix, sig = signature.split("=", 1)
    else:
        sig = signature
    
    # Compute expected signature
    if algorithm == "sha256":
        expected = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
    elif algorithm == "sha1":
        expected = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha1
        ).hexdigest()
    else:
        return False
    
    return hmac.compare_digest(expected.lower(), sig.lower())
