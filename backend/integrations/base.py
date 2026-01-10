"""
Fortified Base Adapter Interface
Production-grade foundation for all CRM integrations

Features:
- Robust error handling
- Automatic retry with exponential backoff
- Rate limiting with sliding window algorithm
- Connection health monitoring
- Request/response logging
- Secure credential handling
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from collections import deque
import hashlib
import hmac
import logging
import asyncio
import time
import uuid

logger = logging.getLogger(__name__)


class AuthMethod(str, Enum):
    """Supported authentication methods"""
    NONE = "none"
    API_KEY = "api_key"
    BEARER_TOKEN = "bearer_token"
    BASIC_AUTH = "basic_auth"
    OAUTH2 = "oauth2"
    OAUTH2_CLIENT_CREDENTIALS = "oauth2_client_credentials"
    CUSTOM_HEADER = "custom_header"
    DIGEST_AUTH = "digest_auth"


class ConnectionStatus(str, Enum):
    """Connection health status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class SyncStatus(str, Enum):
    """Sync operation status"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    PARTIAL = "partial"  # Some records failed
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AuthConfig:
    """Authentication configuration with secure handling"""
    method: AuthMethod = AuthMethod.NONE
    
    # API Key / Bearer Token
    api_key: Optional[str] = None
    api_key_header: str = "X-API-Key"
    api_key_prefix: str = ""  # e.g., "Bearer ", "Token "
    
    # Basic Auth
    username: Optional[str] = None
    password: Optional[str] = None
    
    # OAuth2
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    token_url: Optional[str] = None
    authorize_url: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: List[str] = field(default_factory=list)
    
    # Custom Headers
    custom_headers: Dict[str, str] = field(default_factory=dict)
    
    # Additional params for token requests
    token_params: Dict[str, str] = field(default_factory=dict)
    
    def get_headers(self) -> Dict[str, str]:
        """Generate authentication headers"""
        headers = {}
        
        if self.method == AuthMethod.API_KEY and self.api_key:
            value = f"{self.api_key_prefix}{self.api_key}" if self.api_key_prefix else self.api_key
            headers[self.api_key_header] = value
            
        elif self.method == AuthMethod.BEARER_TOKEN and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
            
        elif self.method in [AuthMethod.OAUTH2, AuthMethod.OAUTH2_CLIENT_CREDENTIALS] and self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
            
        elif self.method == AuthMethod.CUSTOM_HEADER:
            headers.update(self.custom_headers)
        
        return headers
    
    def get_basic_auth(self) -> Optional[Tuple[str, str]]:
        """Get basic auth tuple if applicable"""
        if self.method == AuthMethod.BASIC_AUTH and self.username:
            return (self.username, self.password or "")
        return None
    
    def is_token_expired(self) -> bool:
        """Check if OAuth token is expired"""
        if not self.token_expires_at:
            return False
        # Add 60 second buffer
        return datetime.now(timezone.utc) >= (self.token_expires_at - timedelta(seconds=60))
    
    def to_dict_safe(self) -> Dict[str, Any]:
        """Convert to dict without sensitive data"""
        return {
            "method": self.method.value,
            "has_api_key": bool(self.api_key),
            "has_credentials": bool(self.username and self.password),
            "has_oauth": bool(self.client_id and self.client_secret),
            "token_expires_at": self.token_expires_at.isoformat() if self.token_expires_at else None,
        }


@dataclass
class RateLimitConfig:
    """Rate limiting configuration"""
    requests_per_second: float = 10.0
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    requests_per_day: int = 10000
    
    # Burst allowance (short bursts above rate limit)
    burst_size: int = 10
    
    # Backoff configuration
    backoff_base: float = 1.0  # Base delay in seconds
    backoff_max: float = 60.0  # Max delay in seconds
    backoff_multiplier: float = 2.0


class RateLimiter:
    """
    Sliding window rate limiter with burst support
    
    Provides accurate rate limiting using sliding window algorithm
    to prevent thundering herd and ensure smooth request distribution.
    """
    
    def __init__(self, config: RateLimitConfig):
        self.config = config
        
        # Sliding window tracking
        self._second_window: deque = deque()
        self._minute_window: deque = deque()
        self._hour_window: deque = deque()
        self._day_window: deque = deque()
        
        # Backoff state
        self._consecutive_errors = 0
        self._last_error_time: Optional[float] = None
        
        # Lock for thread safety
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> float:
        """
        Acquire permission to make a request
        
        Returns:
            Wait time in seconds before request can be made (0 if immediate)
        """
        async with self._lock:
            now = time.time()
            
            # Clean old entries
            self._cleanup_windows(now)
            
            # Check limits
            wait_time = self._calculate_wait_time(now)
            
            if wait_time > 0:
                return wait_time
            
            # Record this request
            self._record_request(now)
            
            return 0
    
    async def wait_and_acquire(self) -> None:
        """Wait until request can be made, then acquire"""
        wait_time = await self.acquire()
        if wait_time > 0:
            await asyncio.sleep(wait_time)
            await self.acquire()
    
    def record_success(self):
        """Record successful request (reset backoff)"""
        self._consecutive_errors = 0
        self._last_error_time = None
    
    def record_error(self):
        """Record failed request (increase backoff)"""
        self._consecutive_errors += 1
        self._last_error_time = time.time()
    
    def get_backoff_delay(self) -> float:
        """Calculate current backoff delay"""
        if self._consecutive_errors == 0:
            return 0
        
        delay = self.config.backoff_base * (
            self.config.backoff_multiplier ** (self._consecutive_errors - 1)
        )
        return min(delay, self.config.backoff_max)
    
    def _cleanup_windows(self, now: float):
        """Remove expired entries from sliding windows"""
        # Second window (last 1 second)
        cutoff = now - 1
        while self._second_window and self._second_window[0] < cutoff:
            self._second_window.popleft()
        
        # Minute window (last 60 seconds)
        cutoff = now - 60
        while self._minute_window and self._minute_window[0] < cutoff:
            self._minute_window.popleft()
        
        # Hour window (last 3600 seconds)
        cutoff = now - 3600
        while self._hour_window and self._hour_window[0] < cutoff:
            self._hour_window.popleft()
        
        # Day window (last 86400 seconds)
        cutoff = now - 86400
        while self._day_window and self._day_window[0] < cutoff:
            self._day_window.popleft()
    
    def _calculate_wait_time(self, now: float) -> float:
        """Calculate time to wait before next request"""
        wait_times = []
        
        # Check per-second limit
        if len(self._second_window) >= self.config.requests_per_second:
            oldest = self._second_window[0]
            wait_times.append(1 - (now - oldest))
        
        # Check per-minute limit
        if len(self._minute_window) >= self.config.requests_per_minute:
            oldest = self._minute_window[0]
            wait_times.append(60 - (now - oldest))
        
        # Check per-hour limit
        if len(self._hour_window) >= self.config.requests_per_hour:
            oldest = self._hour_window[0]
            wait_times.append(3600 - (now - oldest))
        
        # Check per-day limit
        if len(self._day_window) >= self.config.requests_per_day:
            oldest = self._day_window[0]
            wait_times.append(86400 - (now - oldest))
        
        # Add backoff delay if we've had errors
        backoff = self.get_backoff_delay()
        if backoff > 0 and self._last_error_time:
            elapsed = now - self._last_error_time
            if elapsed < backoff:
                wait_times.append(backoff - elapsed)
        
        return max(wait_times) if wait_times else 0
    
    def _record_request(self, now: float):
        """Record a request in all windows"""
        self._second_window.append(now)
        self._minute_window.append(now)
        self._hour_window.append(now)
        self._day_window.append(now)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current rate limiter statistics"""
        now = time.time()
        self._cleanup_windows(now)
        
        return {
            "requests_last_second": len(self._second_window),
            "requests_last_minute": len(self._minute_window),
            "requests_last_hour": len(self._hour_window),
            "requests_last_day": len(self._day_window),
            "consecutive_errors": self._consecutive_errors,
            "current_backoff_delay": self.get_backoff_delay(),
        }


@dataclass
class ConnectionHealth:
    """Connection health information"""
    status: ConnectionStatus = ConnectionStatus.UNKNOWN
    last_check: Optional[datetime] = None
    last_success: Optional[datetime] = None
    last_error: Optional[datetime] = None
    last_error_message: Optional[str] = None
    
    # Statistics
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    
    # Response times (rolling average)
    avg_response_time_ms: float = 0
    
    # Rate limit info from API
    rate_limit_remaining: Optional[int] = None
    rate_limit_reset: Optional[datetime] = None
    
    def record_success(self, response_time_ms: float):
        """Record successful request"""
        self.total_requests += 1
        self.successful_requests += 1
        self.last_success = datetime.now(timezone.utc)
        self.last_check = self.last_success
        
        # Update rolling average
        if self.avg_response_time_ms == 0:
            self.avg_response_time_ms = response_time_ms
        else:
            self.avg_response_time_ms = (self.avg_response_time_ms * 0.9) + (response_time_ms * 0.1)
        
        # Update status
        self._update_status()
    
    def record_failure(self, error_message: str):
        """Record failed request"""
        self.total_requests += 1
        self.failed_requests += 1
        self.last_error = datetime.now(timezone.utc)
        self.last_error_message = error_message
        self.last_check = self.last_error
        
        # Update status
        self._update_status()
    
    def _update_status(self):
        """Update connection status based on recent history"""
        if self.total_requests == 0:
            self.status = ConnectionStatus.UNKNOWN
            return
        
        # Calculate recent error rate
        error_rate = self.failed_requests / self.total_requests
        
        if error_rate < 0.01:  # < 1% errors
            self.status = ConnectionStatus.HEALTHY
        elif error_rate < 0.1:  # < 10% errors
            self.status = ConnectionStatus.DEGRADED
        else:
            self.status = ConnectionStatus.UNHEALTHY
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status.value,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_success": self.last_success.isoformat() if self.last_success else None,
            "last_error": self.last_error.isoformat() if self.last_error else None,
            "last_error_message": self.last_error_message,
            "total_requests": self.total_requests,
            "successful_requests": self.successful_requests,
            "failed_requests": self.failed_requests,
            "success_rate": (self.successful_requests / self.total_requests * 100) if self.total_requests > 0 else 0,
            "avg_response_time_ms": round(self.avg_response_time_ms, 2),
        }


@dataclass
class RetryConfig:
    """Retry configuration"""
    max_retries: int = 3
    retry_on_status: List[int] = field(default_factory=lambda: [429, 500, 502, 503, 504])
    retry_on_timeout: bool = True
    retry_on_connection_error: bool = True


@dataclass
class AdapterConfig:
    """Configuration for a CRM adapter"""
    id: str
    name: str
    adapter_type: str
    
    # Connection
    base_url: str
    auth: AuthConfig = field(default_factory=AuthConfig)
    
    # Timeouts (seconds)
    connect_timeout: float = 10.0
    read_timeout: float = 30.0
    
    # Rate limiting
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)
    
    # Retry
    retry: RetryConfig = field(default_factory=RetryConfig)
    
    # Field mapping overrides
    field_mappings: Dict[str, str] = field(default_factory=dict)
    
    # Data type
    data_type: str = "customers"
    
    # Pagination
    page_size: int = 100
    max_pages: int = 1000
    
    # Metadata
    is_active: bool = True
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    last_sync_at: Optional[datetime] = None
    
    # Custom settings per adapter
    custom_settings: Dict[str, Any] = field(default_factory=dict)
    
    # Mock mode for testing without real CRM credentials
    mock_mode: bool = False
    mock_customer_count: int = 50
    mock_vehicle_count: int = 100
    mock_seed: Optional[int] = None  # For reproducible test data
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "id": self.id,
            "name": self.name,
            "adapter_type": self.adapter_type,
            "base_url": self.base_url,
            "auth": self.auth.to_dict_safe(),
            "connect_timeout": self.connect_timeout,
            "read_timeout": self.read_timeout,
            "data_type": self.data_type,
            "page_size": self.page_size,
            "is_active": self.is_active,
            "mock_mode": self.mock_mode,
            "created_at": self.created_at.isoformat(),
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
        }


@dataclass
class FetchResult:
    """Result of a data fetch operation"""
    success: bool
    records: List[Dict[str, Any]] = field(default_factory=list)
    
    # Counts
    total_records: int = 0
    pages_fetched: int = 0
    records_skipped: int = 0
    records_failed: int = 0
    
    # Errors and warnings
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    # Rate limit info
    rate_limit_remaining: Optional[int] = None
    rate_limit_reset: Optional[datetime] = None
    
    # Timing
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    fetch_duration_ms: int = 0
    
    # Sync metadata
    sync_id: Optional[str] = None
    has_more: bool = False
    next_cursor: Optional[str] = None
    
    def add_error(self, error: str, record_id: Optional[str] = None, details: Optional[Dict] = None):
        """Add an error with optional context"""
        if len(self.errors) < 100:  # Limit stored errors
            self.errors.append({
                "message": error,
                "record_id": record_id,
                "details": details,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    
    def add_warning(self, warning: str):
        """Add a warning"""
        if len(self.warnings) < 100:
            self.warnings.append(warning)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "total_records": self.total_records,
            "pages_fetched": self.pages_fetched,
            "records_skipped": self.records_skipped,
            "records_failed": self.records_failed,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "fetch_duration_ms": self.fetch_duration_ms,
            "has_more": self.has_more,
        }


class BaseAdapter(ABC):
    """
    Abstract base class for CRM adapters
    
    All adapters are READ-ONLY by design.
    They fetch data from external systems but NEVER write back.
    
    Features:
    - Automatic retry with exponential backoff
    - Rate limiting
    - Connection health tracking
    - Request/response logging
    """
    
    # Adapter metadata (override in subclasses)
    ADAPTER_TYPE: str = "base"
    ADAPTER_NAME: str = "Base Adapter"
    ADAPTER_VERSION: str = "1.0.0"
    SUPPORTED_DATA_TYPES: List[str] = ["customers", "vehicles"]
    
    # Default field mappings (source -> canonical)
    DEFAULT_CUSTOMER_MAPPINGS: Dict[str, str] = {}
    DEFAULT_VEHICLE_MAPPINGS: Dict[str, str] = {}
    
    # Canonical field lists for validation
    CANONICAL_CUSTOMER_FIELDS = [
        "source_row_id", "first_name", "last_name", "full_name",
        "phone", "email", "address", "city", "state", "zip",
        "vehicle_of_interest", "lead_status", "source",
        "current_vehicle", "trade_in_info", "notes",
    ]
    
    CANONICAL_VEHICLE_FIELDS = [
        "source_row_id", "vin", "stock_number",
        "year", "make", "model", "trim", "body_style",
        "price", "msrp", "mileage",
        "exterior_color", "interior_color",
        "transmission", "engine", "fuel_type", "drivetrain",
        "status", "is_new", "image_url",
    ]
    
    def __init__(self, config: AdapterConfig):
        self.config = config
        self.rate_limiter = RateLimiter(config.rate_limit)
        self.health = ConnectionHealth()
        
        # Request tracking
        self._request_id = 0
        
        # Hooks for custom processing
        self._pre_request_hooks: List[Callable] = []
        self._post_request_hooks: List[Callable] = []
        self._transform_hooks: List[Callable] = []
    
    @abstractmethod
    async def fetch_customers(
        self, 
        since: Optional[datetime] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> FetchResult:
        """
        Fetch customers/leads from the CRM
        
        Args:
            since: Only fetch records modified after this time
            cursor: Pagination cursor for continuing a previous fetch
            limit: Maximum records to fetch (None = use config default)
            
        Returns:
            FetchResult with normalized customer records
        """
        pass
    
    @abstractmethod
    async def fetch_vehicles(
        self,
        since: Optional[datetime] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> FetchResult:
        """
        Fetch vehicle inventory from the CRM
        
        Args:
            since: Only fetch records modified after this time
            cursor: Pagination cursor for continuing a previous fetch
            limit: Maximum records to fetch (None = use config default)
            
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
        """Get field mappings with user overrides applied"""
        if data_type == "customers":
            base_mappings = self.DEFAULT_CUSTOMER_MAPPINGS.copy()
        else:
            base_mappings = self.DEFAULT_VEHICLE_MAPPINGS.copy()
        
        # Apply user overrides
        base_mappings.update(self.config.field_mappings)
        return base_mappings
    
    def normalize_record(
        self, 
        record: Dict[str, Any], 
        data_type: str,
        source_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Normalize a record using field mappings
        
        Converts CRM-specific field names to canonical names.
        Applies data cleaning and validation.
        """
        mappings = self.get_field_mappings(data_type)
        normalized = {}
        unmapped_fields = {}
        
        # Get canonical fields for validation
        canonical_fields = (
            self.CANONICAL_CUSTOMER_FIELDS if data_type == "customers" 
            else self.CANONICAL_VEHICLE_FIELDS
        )
        
        for source_field, value in record.items():
            if value is None or value == "":
                continue
            
            # Check if we have a mapping
            if source_field in mappings:
                canonical_field = mappings[source_field]
                normalized[canonical_field] = self._clean_value(value, canonical_field)
            elif source_field.lower() in mappings:
                canonical_field = mappings[source_field.lower()]
                normalized[canonical_field] = self._clean_value(value, canonical_field)
            else:
                # Try fuzzy matching for unmapped fields
                matched = self._fuzzy_match_field(source_field, canonical_fields)
                if matched:
                    normalized[matched] = self._clean_value(value, matched)
                else:
                    unmapped_fields[source_field] = value
        
        # Add source metadata
        normalized["_source_adapter"] = self.ADAPTER_TYPE
        normalized["_source_id"] = source_id or self.config.id
        normalized["_imported_at"] = datetime.now(timezone.utc).isoformat()
        
        # Store unmapped fields for debugging
        if unmapped_fields:
            normalized["_unmapped_fields"] = unmapped_fields
        
        # Apply custom transform hooks
        for hook in self._transform_hooks:
            normalized = hook(normalized, data_type)
        
        return normalized
    
    def _clean_value(self, value: Any, field_name: str) -> Any:
        """Clean and validate a field value"""
        if value is None:
            return None
        
        # String cleaning
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
        
        # Phone number cleaning
        if field_name == "phone" and isinstance(value, str):
            # Remove common formatting
            cleaned = ''.join(c for c in value if c.isdigit() or c == '+')
            if len(cleaned) >= 10:
                return cleaned
            return value  # Return original if cleaning fails
        
        # Email validation
        if field_name == "email" and isinstance(value, str):
            if '@' in value and '.' in value:
                return value.lower()
            return None  # Invalid email
        
        # Year validation
        if field_name == "year":
            try:
                year = int(value)
                if 1900 <= year <= datetime.now().year + 2:
                    return year
            except (ValueError, TypeError):
                pass
            return None
        
        # Price cleaning
        if field_name in ["price", "msrp"]:
            try:
                if isinstance(value, str):
                    # Remove currency symbols and commas
                    cleaned = ''.join(c for c in value if c.isdigit() or c == '.')
                    return float(cleaned) if cleaned else None
                return float(value)
            except (ValueError, TypeError):
                return None
        
        # Mileage cleaning
        if field_name == "mileage":
            try:
                if isinstance(value, str):
                    cleaned = ''.join(c for c in value if c.isdigit())
                    return int(cleaned) if cleaned else None
                return int(value)
            except (ValueError, TypeError):
                return None
        
        # Lead status normalization
        if field_name == "lead_status" and isinstance(value, str):
            status_map = {
                "hot": "hot", "warm": "warm", "cold": "cold",
                "new": "new", "sold": "sold", "lost": "lost",
                "active": "hot", "inactive": "cold",
                "prospect": "new", "customer": "sold",
            }
            return status_map.get(value.lower(), value.lower())
        
        return value
    
    def _fuzzy_match_field(self, source_field: str, canonical_fields: List[str]) -> Optional[str]:
        """Attempt to fuzzy match a source field to canonical fields"""
        source_lower = source_field.lower().replace('_', '').replace('-', '')
        
        for canonical in canonical_fields:
            canonical_lower = canonical.lower().replace('_', '')
            
            # Exact match after normalization
            if source_lower == canonical_lower:
                return canonical
            
            # Common variations
            variations = {
                "firstname": "first_name",
                "lastname": "last_name",
                "fullname": "full_name",
                "phonenumber": "phone",
                "cellphone": "phone",
                "mobilephone": "phone",
                "emailaddress": "email",
                "streetaddress": "address",
                "zipcode": "zip",
                "postalcode": "zip",
                "stockno": "stock_number",
                "stocknum": "stock_number",
                "vinnumber": "vin",
                "modelyear": "year",
                "extcolor": "exterior_color",
                "intcolor": "interior_color",
            }
            
            if source_lower in variations:
                return variations[source_lower]
        
        return None
    
    def add_pre_request_hook(self, hook: Callable):
        """Add a hook to run before each request"""
        self._pre_request_hooks.append(hook)
    
    def add_post_request_hook(self, hook: Callable):
        """Add a hook to run after each request"""
        self._post_request_hooks.append(hook)
    
    def add_transform_hook(self, hook: Callable):
        """Add a hook to transform normalized records"""
        self._transform_hooks.append(hook)
    
    def get_health(self) -> Dict[str, Any]:
        """Get adapter health information"""
        return {
            "adapter_type": self.ADAPTER_TYPE,
            "adapter_name": self.ADAPTER_NAME,
            "connection": self.health.to_dict(),
            "rate_limiter": self.rate_limiter.get_stats(),
        }
    
    @classmethod
    def get_setup_instructions(cls) -> Dict[str, Any]:
        """Get setup instructions for this adapter type"""
        return {
            "name": cls.ADAPTER_NAME,
            "type": cls.ADAPTER_TYPE,
            "version": cls.ADAPTER_VERSION,
            "supported_data_types": cls.SUPPORTED_DATA_TYPES,
            "auth_methods": ["api_key"],
            "required_fields": {},
            "optional_fields": {},
            "documentation_url": None,
        }


class AdapterRegistry:
    """Registry of available adapters"""
    
    _adapters: Dict[str, type] = {}
    
    @classmethod
    def register(cls, adapter_type: str):
        """Decorator to register an adapter class"""
        def decorator(adapter_class: type):
            cls._adapters[adapter_type] = adapter_class
            logger.info(f"Registered adapter: {adapter_type} ({adapter_class.ADAPTER_NAME})")
            return adapter_class
        return decorator
    
    @classmethod
    def get(cls, adapter_type: str) -> Optional[type]:
        """Get an adapter class by type"""
        return cls._adapters.get(adapter_type)
    
    @classmethod
    def list_adapters(cls) -> List[Dict[str, Any]]:
        """List all registered adapters with their capabilities"""
        adapters = []
        for adapter_type, adapter_class in cls._adapters.items():
            info = {
                "type": adapter_type,
                "name": getattr(adapter_class, 'ADAPTER_NAME', adapter_type),
                "version": getattr(adapter_class, 'ADAPTER_VERSION', '1.0.0'),
                "supported_data_types": getattr(adapter_class, 'SUPPORTED_DATA_TYPES', []),
            }
            
            # Get setup instructions if available
            if hasattr(adapter_class, 'get_setup_instructions'):
                setup = adapter_class.get_setup_instructions()
                info["auth_methods"] = setup.get("auth_methods", [])
                info["documentation_url"] = setup.get("documentation_url")
            
            adapters.append(info)
        
        return adapters
    
    @classmethod
    def create(cls, config: AdapterConfig) -> Optional[BaseAdapter]:
        """Create an adapter instance from config"""
        adapter_class = cls.get(config.adapter_type)
        if adapter_class:
            return adapter_class(config)
        return None


def verify_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
    algorithm: str = "sha256"
) -> bool:
    """
    Verify webhook signature using HMAC
    
    Supports multiple signature formats:
    - Plain signature: "abc123..."
    - Prefixed signature: "sha256=abc123..."
    - Multiple signatures: "sha256=abc,sha1=def"
    """
    if not signature or not secret:
        return False
    
    # Handle multiple signatures (some webhooks send multiple)
    signatures = signature.split(',')
    
    for sig in signatures:
        sig = sig.strip()
        
        # Handle prefixed signatures
        if "=" in sig:
            algo_prefix, sig_value = sig.split("=", 1)
            # Use the specified algorithm if it matches
            if algo_prefix.lower() == algorithm.lower():
                sig = sig_value
            else:
                continue
        
        # Compute expected signature
        if algorithm.lower() == "sha256":
            expected = hmac.new(
                secret.encode('utf-8'),
                payload,
                hashlib.sha256
            ).hexdigest()
        elif algorithm.lower() == "sha1":
            expected = hmac.new(
                secret.encode('utf-8'),
                payload,
                hashlib.sha1
            ).hexdigest()
        elif algorithm.lower() == "sha512":
            expected = hmac.new(
                secret.encode('utf-8'),
                payload,
                hashlib.sha512
            ).hexdigest()
        else:
            continue
        
        # Constant-time comparison
        if hmac.compare_digest(expected.lower(), sig.lower()):
            return True
    
    return False
