"""
Fortified Generic REST API Adapter
Production-grade adapter for connecting to any REST API

Features:
- Connection pooling
- Automatic retry with exponential backoff
- Rate limiting with sliding window
- OAuth2 token refresh
- Request/response logging
- Comprehensive error handling
"""

import time
import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urljoin, urlencode
import httpx
import uuid

from .base import (
    BaseAdapter, 
    AdapterConfig, 
    AdapterRegistry,
    FetchResult,
    AuthMethod,
    ConnectionStatus,
)

logger = logging.getLogger(__name__)


@dataclass
class RestEndpointConfig:
    """Configuration for a REST endpoint"""
    
    # Endpoint path (relative to base_url)
    path: str
    
    # HTTP method
    method: str = "GET"
    
    # Static query parameters
    params: Dict[str, str] = field(default_factory=dict)
    
    # Request body template (for POST/PUT)
    body_template: Optional[Dict[str, Any]] = None
    
    # Response parsing
    records_path: str = "data"  # JSON path to records array
    total_path: Optional[str] = None  # JSON path to total count
    
    # Pagination configuration
    pagination_type: str = "offset"  # "offset", "page", "cursor", "link", "none"
    page_param: str = "page"
    limit_param: str = "limit"
    offset_param: str = "offset"
    cursor_param: str = "cursor"
    cursor_response_path: Optional[str] = None  # Where to find next cursor in response
    next_link_path: Optional[str] = None  # Where to find next page URL
    
    # Incremental sync
    since_param: Optional[str] = None  # Parameter for "modified since" filtering
    since_format: str = "iso"  # "iso", "timestamp", "epoch", "epoch_ms"
    
    # Response validation
    success_codes: List[int] = field(default_factory=lambda: [200, 201])
    
    # Request customization
    headers: Dict[str, str] = field(default_factory=dict)


class HTTPClient:
    """
    Managed HTTP client with connection pooling and retry logic
    """
    
    def __init__(
        self,
        base_url: str,
        connect_timeout: float = 10.0,
        read_timeout: float = 30.0,
        max_connections: int = 10,
    ):
        self.base_url = base_url.rstrip('/')
        self.connect_timeout = connect_timeout
        self.read_timeout = read_timeout
        self.max_connections = max_connections
        
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client"""
        if self._client is None or self._client.is_closed:
            timeout = httpx.Timeout(
                connect=self.connect_timeout,
                read=self.read_timeout,
                write=30.0,
                pool=10.0,
            )
            
            limits = httpx.Limits(
                max_connections=self.max_connections,
                max_keepalive_connections=self.max_connections // 2,
            )
            
            self._client = httpx.AsyncClient(
                timeout=timeout,
                limits=limits,
                follow_redirects=True,
            )
        
        return self._client
    
    async def request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        auth: Optional[Tuple[str, str]] = None,
    ) -> httpx.Response:
        """Make HTTP request"""
        client = await self._get_client()
        url = f"{self.base_url}/{path.lstrip('/')}"
        
        return await client.request(
            method=method,
            url=url,
            params=params,
            json=json,
            headers=headers,
            auth=auth,
        )
    
    async def close(self):
        """Close the client"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None


@AdapterRegistry.register("generic_rest")
class GenericRestAdapter(BaseAdapter):
    """
    Fortified Generic REST API adapter
    
    Production-grade adapter that can connect to any REST API with:
    - Configurable authentication
    - Configurable endpoints and pagination
    - Automatic retry with exponential backoff
    - Rate limiting
    - Connection health tracking
    """
    
    ADAPTER_TYPE = "generic_rest"
    ADAPTER_NAME = "Generic REST API"
    ADAPTER_VERSION = "2.0.0"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    def __init__(
        self, 
        config: AdapterConfig,
        customers_endpoint: Optional[RestEndpointConfig] = None,
        vehicles_endpoint: Optional[RestEndpointConfig] = None
    ):
        super().__init__(config)
        
        # HTTP client with connection pooling
        self._http = HTTPClient(
            base_url=config.base_url,
            connect_timeout=config.connect_timeout,
            read_timeout=config.read_timeout,
        )
        
        # Default endpoints
        self.customers_endpoint = customers_endpoint or RestEndpointConfig(
            path="/customers",
            records_path="data",
        )
        self.vehicles_endpoint = vehicles_endpoint or RestEndpointConfig(
            path="/vehicles",
            records_path="data",
        )
        
        # OAuth token refresh lock
        self._token_lock = asyncio.Lock()
    
    async def _ensure_valid_token(self):
        """Ensure OAuth token is valid, refresh if needed"""
        if self.config.auth.method not in [AuthMethod.OAUTH2, AuthMethod.OAUTH2_CLIENT_CREDENTIALS]:
            return
        
        if not self.config.auth.is_token_expired():
            return
        
        async with self._token_lock:
            # Double-check after acquiring lock
            if not self.config.auth.is_token_expired():
                return
            
            await self._refresh_oauth_token()
    
    async def _refresh_oauth_token(self):
        """Refresh OAuth2 token"""
        auth = self.config.auth
        
        if not auth.token_url:
            raise ValueError("token_url is required for OAuth2")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if auth.method == AuthMethod.OAUTH2_CLIENT_CREDENTIALS:
                    # Client credentials flow
                    data = {
                        "grant_type": "client_credentials",
                        "client_id": auth.client_id,
                        "client_secret": auth.client_secret,
                    }
                    if auth.scopes:
                        data["scope"] = " ".join(auth.scopes)
                    data.update(auth.token_params)
                    
                    response = await client.post(auth.token_url, data=data)
                    
                elif auth.refresh_token:
                    # Refresh token flow
                    data = {
                        "grant_type": "refresh_token",
                        "refresh_token": auth.refresh_token,
                        "client_id": auth.client_id,
                        "client_secret": auth.client_secret,
                    }
                    data.update(auth.token_params)
                    
                    response = await client.post(auth.token_url, data=data)
                else:
                    raise ValueError("No refresh_token available")
                
                response.raise_for_status()
                token_data = response.json()
                
                # Update auth config
                auth.access_token = token_data.get("access_token")
                if "refresh_token" in token_data:
                    auth.refresh_token = token_data["refresh_token"]
                
                # Calculate expiration
                expires_in = token_data.get("expires_in", 3600)
                auth.token_expires_at = datetime.now(timezone.utc) + \
                    __import__('datetime').timedelta(seconds=expires_in)
                
                logger.info(f"OAuth token refreshed for {self.config.name}")
                
        except Exception as e:
            logger.error(f"Failed to refresh OAuth token: {e}")
            raise
    
    async def _make_request(
        self,
        endpoint: RestEndpointConfig,
        extra_params: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Make an HTTP request with retry logic
        
        Returns:
            Tuple of (success, response_data, error_message)
        """
        request_id = request_id or str(uuid.uuid4())[:8]
        
        # Ensure valid OAuth token
        await self._ensure_valid_token()
        
        # Build URL and params
        url_path = endpoint.path
        params = {**endpoint.params}
        if extra_params:
            params.update(extra_params)
        
        # Get auth
        headers = {**endpoint.headers, **self.config.auth.get_headers()}
        basic_auth = self.config.auth.get_basic_auth()
        
        # Run pre-request hooks
        for hook in self._pre_request_hooks:
            try:
                hook_result = hook(url_path, params, headers)
                if hook_result:
                    url_path, params, headers = hook_result
            except Exception as e:
                logger.warning(f"Pre-request hook error: {e}")
        
        # Retry loop
        last_error = None
        retry_count = 0
        
        while retry_count <= self.config.retry.max_retries:
            # Rate limiting
            await self.rate_limiter.wait_and_acquire()
            
            start_time = time.time()
            
            try:
                if endpoint.method.upper() == "GET":
                    response = await self._http.request(
                        "GET", url_path, params=params, headers=headers, auth=basic_auth
                    )
                elif endpoint.method.upper() == "POST":
                    response = await self._http.request(
                        "POST", url_path, params=params, json=endpoint.body_template,
                        headers=headers, auth=basic_auth
                    )
                else:
                    return False, {}, f"Unsupported method: {endpoint.method}"
                
                response_time = (time.time() - start_time) * 1000
                
                # Check rate limit headers
                self._parse_rate_limit_headers(response.headers)
                
                # Handle response
                if response.status_code == 429:
                    # Rate limited by server
                    retry_after = int(response.headers.get('Retry-After', '60'))
                    self.rate_limiter.record_error()
                    logger.warning(f"[{request_id}] Rate limited. Retry after {retry_after}s")
                    
                    if retry_count < self.config.retry.max_retries:
                        await asyncio.sleep(retry_after)
                        retry_count += 1
                        continue
                    
                    return False, {}, f"Rate limited. Retry after {retry_after}s"
                
                if response.status_code in self.config.retry.retry_on_status:
                    self.rate_limiter.record_error()
                    last_error = f"HTTP {response.status_code}: {response.text[:200]}"
                    
                    if retry_count < self.config.retry.max_retries:
                        delay = self.rate_limiter.get_backoff_delay()
                        logger.warning(f"[{request_id}] Retrying after {delay}s: {last_error}")
                        await asyncio.sleep(delay)
                        retry_count += 1
                        continue
                    
                    self.health.record_failure(last_error)
                    return False, {}, last_error
                
                response.raise_for_status()
                
                # Success
                self.rate_limiter.record_success()
                self.health.record_success(response_time)
                
                data = response.json()
                
                # Run post-request hooks
                for hook in self._post_request_hooks:
                    try:
                        hook(response, data)
                    except Exception as e:
                        logger.warning(f"Post-request hook error: {e}")
                
                return True, data, None
                
            except httpx.TimeoutException as e:
                self.rate_limiter.record_error()
                last_error = f"Request timeout: {str(e)}"
                
                if self.config.retry.retry_on_timeout and retry_count < self.config.retry.max_retries:
                    delay = self.rate_limiter.get_backoff_delay()
                    logger.warning(f"[{request_id}] Timeout, retrying after {delay}s")
                    await asyncio.sleep(delay)
                    retry_count += 1
                    continue
                
                self.health.record_failure(last_error)
                return False, {}, last_error
                
            except httpx.ConnectError as e:
                self.rate_limiter.record_error()
                last_error = f"Connection error: {str(e)}"
                
                if self.config.retry.retry_on_connection_error and retry_count < self.config.retry.max_retries:
                    delay = self.rate_limiter.get_backoff_delay()
                    logger.warning(f"[{request_id}] Connection error, retrying after {delay}s")
                    await asyncio.sleep(delay)
                    retry_count += 1
                    continue
                
                self.health.record_failure(last_error)
                return False, {}, last_error
                
            except httpx.HTTPStatusError as e:
                self.health.record_failure(str(e))
                return False, {}, f"HTTP {e.response.status_code}: {e.response.text[:200]}"
                
            except Exception as e:
                self.health.record_failure(str(e))
                return False, {}, f"Unexpected error: {str(e)}"
        
        # All retries exhausted
        self.health.record_failure(last_error or "Max retries exceeded")
        return False, {}, last_error or "Max retries exceeded"
    
    def _parse_rate_limit_headers(self, headers: httpx.Headers):
        """Parse rate limit information from response headers"""
        # Common rate limit header names
        remaining_headers = ['X-RateLimit-Remaining', 'X-Rate-Limit-Remaining', 'RateLimit-Remaining']
        reset_headers = ['X-RateLimit-Reset', 'X-Rate-Limit-Reset', 'RateLimit-Reset']
        
        for header in remaining_headers:
            if header in headers:
                try:
                    self.health.rate_limit_remaining = int(headers[header])
                    break
                except ValueError:
                    pass
        
        for header in reset_headers:
            if header in headers:
                try:
                    reset_value = headers[header]
                    # Could be epoch timestamp or seconds until reset
                    if int(reset_value) > 1e9:  # Epoch timestamp
                        self.health.rate_limit_reset = datetime.fromtimestamp(
                            int(reset_value), tz=timezone.utc
                        )
                    else:  # Seconds until reset
                        self.health.rate_limit_reset = datetime.now(timezone.utc) + \
                            __import__('datetime').timedelta(seconds=int(reset_value))
                    break
                except ValueError:
                    pass
    
    def _extract_records(self, data: Any, path: str) -> List[Dict]:
        """Extract records from response using dot-notation path"""
        if not path:
            if isinstance(data, list):
                return data
            return [data] if isinstance(data, dict) else []
        
        parts = path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list) and part.isdigit():
                idx = int(part)
                current = current[idx] if idx < len(current) else None
            else:
                return []
            
            if current is None:
                return []
        
        return current if isinstance(current, list) else [current] if current else []
    
    def _extract_value(self, data: Any, path: Optional[str]) -> Any:
        """Extract a single value using dot-notation path"""
        if not path or data is None:
            return None
        
        parts = path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list) and part.isdigit():
                idx = int(part)
                current = current[idx] if idx < len(current) else None
            else:
                return None
            
            if current is None:
                return None
        
        return current
    
    def _format_since_param(self, since: datetime, format_type: str) -> str:
        """Format datetime for since parameter"""
        if format_type == "iso":
            return since.isoformat()
        elif format_type == "timestamp":
            return since.strftime("%Y-%m-%d %H:%M:%S")
        elif format_type == "epoch":
            return str(int(since.timestamp()))
        elif format_type == "epoch_ms":
            return str(int(since.timestamp() * 1000))
        else:
            return since.isoformat()
    
    async def _fetch_paginated(
        self,
        endpoint: RestEndpointConfig,
        data_type: str,
        since: Optional[datetime] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> FetchResult:
        """Fetch all pages from a paginated endpoint"""
        sync_id = str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)
        
        result = FetchResult(
            success=False,
            sync_id=sync_id,
            started_at=start_time,
        )
        
        all_records = []
        page = 1
        offset = 0
        max_records = limit or (self.config.page_size * self.config.max_pages)
        
        while page <= self.config.max_pages and len(all_records) < max_records:
            # Build pagination params
            params: Dict[str, Any] = {}
            
            if endpoint.pagination_type == "page":
                params[endpoint.page_param] = page
                params[endpoint.limit_param] = min(
                    self.config.page_size,
                    max_records - len(all_records)
                )
            elif endpoint.pagination_type == "offset":
                params[endpoint.offset_param] = offset
                params[endpoint.limit_param] = min(
                    self.config.page_size,
                    max_records - len(all_records)
                )
            elif endpoint.pagination_type == "cursor" and cursor:
                params[endpoint.cursor_param] = cursor
                params[endpoint.limit_param] = self.config.page_size
            elif endpoint.pagination_type != "none":
                params[endpoint.limit_param] = self.config.page_size
            
            # Add since filter
            if since and endpoint.since_param:
                params[endpoint.since_param] = self._format_since_param(
                    since, endpoint.since_format
                )
            
            # Make request
            request_id = f"{sync_id[:8]}-p{page}"
            success, data, error = await self._make_request(endpoint, params, request_id)
            
            if not success:
                result.add_error(f"Page {page} failed: {error}")
                
                # If first page fails, entire fetch fails
                if page == 1:
                    result.success = False
                    result.completed_at = datetime.now(timezone.utc)
                    result.fetch_duration_ms = int(
                        (result.completed_at - start_time).total_seconds() * 1000
                    )
                    return result
                
                # Otherwise mark as partial success
                break
            
            # Extract records
            records = self._extract_records(data, endpoint.records_path)
            
            if not records:
                break  # No more records
            
            # Extract total count if available
            if endpoint.total_path and page == 1:
                total = self._extract_value(data, endpoint.total_path)
                if total is not None:
                    result.total_records = int(total)
            
            # Normalize and add records
            for record in records:
                try:
                    normalized = self.normalize_record(record, data_type, self.config.id)
                    all_records.append(normalized)
                except Exception as e:
                    result.add_error(
                        f"Failed to normalize record: {str(e)}",
                        record_id=str(record.get('id', 'unknown')),
                    )
                    result.records_failed += 1
            
            result.pages_fetched = page
            
            # Check if there are more pages
            if len(records) < self.config.page_size:
                break
            
            # Get next page info
            if endpoint.pagination_type == "cursor":
                cursor = self._extract_value(data, endpoint.cursor_response_path)
                if not cursor:
                    break
                result.next_cursor = cursor
            elif endpoint.pagination_type == "link":
                next_url = self._extract_value(data, endpoint.next_link_path)
                if not next_url:
                    break
            
            page += 1
            offset += len(records)
            
            # Brief delay between pages to be nice to the API
            await asyncio.sleep(0.05)
        
        # Check if there might be more records
        if result.total_records > 0:
            result.has_more = len(all_records) < result.total_records
        elif len(all_records) == max_records:
            result.has_more = True
        
        result.success = True
        result.records = all_records
        if result.total_records == 0:
            result.total_records = len(all_records)
        result.completed_at = datetime.now(timezone.utc)
        result.fetch_duration_ms = int(
            (result.completed_at - start_time).total_seconds() * 1000
        )
        
        logger.info(
            f"Fetched {len(all_records)} {data_type} in {result.fetch_duration_ms}ms "
            f"({result.pages_fetched} pages)"
        )
        
        return result
    
    async def fetch_customers(
        self,
        since: Optional[datetime] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> FetchResult:
        """Fetch customers from the API"""
        return await self._fetch_paginated(
            self.customers_endpoint,
            "customers",
            since=since,
            cursor=cursor,
            limit=limit,
        )
    
    async def fetch_vehicles(
        self,
        since: Optional[datetime] = None,
        cursor: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> FetchResult:
        """Fetch vehicles from the API"""
        return await self._fetch_paginated(
            self.vehicles_endpoint,
            "vehicles",
            since=since,
            cursor=cursor,
            limit=limit,
        )
    
    async def test_connection(self) -> Tuple[bool, str]:
        """Test connection to the API"""
        try:
            # Try to fetch a single record
            endpoint = self.customers_endpoint
            params = {endpoint.limit_param: 1}
            
            success, data, error = await self._make_request(endpoint, params)
            
            if success:
                records = self._extract_records(data, endpoint.records_path)
                self.health.status = ConnectionStatus.HEALTHY
                return True, f"Connected successfully. API returned {len(records)} record(s)."
            else:
                self.health.status = ConnectionStatus.UNHEALTHY
                return False, f"Connection failed: {error}"
                
        except Exception as e:
            self.health.status = ConnectionStatus.UNHEALTHY
            return False, f"Connection test failed: {str(e)}"
    
    async def close(self):
        """Close the HTTP client"""
        await self._http.close()
    
    @classmethod
    def get_setup_instructions(cls) -> Dict[str, Any]:
        return {
            "name": cls.ADAPTER_NAME,
            "type": cls.ADAPTER_TYPE,
            "version": cls.ADAPTER_VERSION,
            "description": "Connect to any REST API with configurable endpoints and authentication",
            "auth_methods": ["api_key", "bearer_token", "basic_auth", "oauth2", "custom_header"],
            "required_fields": {
                "base_url": "Base URL of the API (e.g., https://api.example.com)",
            },
            "optional_fields": {
                "api_key": "API Key for authentication",
                "customers_path": "Endpoint path for customers (default: /customers)",
                "vehicles_path": "Endpoint path for vehicles (default: /vehicles)",
                "records_path": "JSON path to records in response (default: data)",
            },
        }
