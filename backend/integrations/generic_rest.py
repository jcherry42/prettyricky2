"""
Generic REST API Adapter
Configurable adapter for connecting to any REST API
"""

import time
import asyncio
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
from urllib.parse import urljoin
import httpx

from .base import (
    BaseAdapter, 
    AdapterConfig, 
    AdapterRegistry,
    FetchResult,
    AuthMethod,
)

logger = logging.getLogger(__name__)


@dataclass
class RestEndpointConfig:
    """Configuration for a REST endpoint"""
    
    # Endpoint path (relative to base_url)
    path: str
    
    # HTTP method
    method: str = "GET"
    
    # Query parameters
    params: Dict[str, str] = field(default_factory=dict)
    
    # Request body (for POST/PUT)
    body: Optional[Dict[str, Any]] = None
    
    # Response parsing
    records_path: str = "data"  # JSON path to records array (e.g., "data", "results", "leads")
    total_path: Optional[str] = None  # JSON path to total count
    
    # Pagination
    pagination_type: str = "offset"  # "offset", "page", "cursor", "link"
    page_param: str = "page"  # Parameter name for page number
    limit_param: str = "limit"  # Parameter name for page size
    offset_param: str = "offset"  # Parameter name for offset
    cursor_param: str = "cursor"  # Parameter name for cursor
    cursor_path: Optional[str] = None  # JSON path to next cursor
    next_link_path: Optional[str] = None  # JSON path to next page URL
    
    # Filtering
    since_param: Optional[str] = None  # Parameter for "modified since" filtering
    since_format: str = "iso"  # "iso", "timestamp", "epoch"


@AdapterRegistry.register("generic_rest")
class GenericRestAdapter(BaseAdapter):
    """
    Generic REST API adapter
    
    Can be configured to connect to any REST API with:
    - Configurable authentication
    - Configurable endpoints
    - Configurable pagination
    - Configurable field mappings
    """
    
    ADAPTER_TYPE = "generic_rest"
    ADAPTER_NAME = "Generic REST API"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    def __init__(
        self, 
        config: AdapterConfig,
        customers_endpoint: Optional[RestEndpointConfig] = None,
        vehicles_endpoint: Optional[RestEndpointConfig] = None
    ):
        super().__init__(config)
        
        # Default endpoints if not provided
        self.customers_endpoint = customers_endpoint or RestEndpointConfig(
            path="/customers",
            records_path="data",
        )
        self.vehicles_endpoint = vehicles_endpoint or RestEndpointConfig(
            path="/vehicles",
            records_path="data",
        )
    
    async def _make_request(
        self,
        endpoint: RestEndpointConfig,
        extra_params: Optional[Dict[str, Any]] = None
    ) -> Tuple[bool, Dict[str, Any], Optional[str]]:
        """
        Make an HTTP request to the API
        
        Returns:
            Tuple of (success, response_data, error_message)
        """
        url = urljoin(self.config.base_url.rstrip('/') + '/', endpoint.path.lstrip('/'))
        
        # Build params
        params = endpoint.params.copy()
        if extra_params:
            params.update(extra_params)
        
        # Get auth
        headers = self.config.auth.get_headers()
        basic_auth = self.config.auth.get_basic_auth()
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if endpoint.method.upper() == "GET":
                    response = await client.get(
                        url,
                        params=params,
                        headers=headers,
                        auth=basic_auth
                    )
                elif endpoint.method.upper() == "POST":
                    response = await client.post(
                        url,
                        params=params,
                        json=endpoint.body,
                        headers=headers,
                        auth=basic_auth
                    )
                else:
                    return False, {}, f"Unsupported method: {endpoint.method}"
                
                await self._record_request()
                
                if response.status_code == 429:
                    # Rate limited
                    retry_after = response.headers.get('Retry-After', '60')
                    return False, {}, f"Rate limited. Retry after {retry_after}s"
                
                response.raise_for_status()
                return True, response.json(), None
                
        except httpx.HTTPStatusError as e:
            return False, {}, f"HTTP {e.response.status_code}: {e.response.text[:200]}"
        except httpx.RequestError as e:
            return False, {}, f"Request failed: {str(e)}"
        except Exception as e:
            return False, {}, f"Unexpected error: {str(e)}"
    
    def _extract_records(self, data: Dict[str, Any], path: str) -> List[Dict]:
        """Extract records from response using dot-notation path"""
        if not path:
            if isinstance(data, list):
                return data
            return [data]
        
        parts = path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part, [])
            else:
                return []
        
        return current if isinstance(current, list) else [current]
    
    def _extract_value(self, data: Dict[str, Any], path: Optional[str]) -> Any:
        """Extract a single value using dot-notation path"""
        if not path:
            return None
        
        parts = path.split('.')
        current = data
        
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            else:
                return None
        
        return current
    
    async def _fetch_paginated(
        self,
        endpoint: RestEndpointConfig,
        since: Optional[datetime] = None
    ) -> FetchResult:
        """Fetch all pages from a paginated endpoint"""
        start_time = time.time()
        result = FetchResult(success=False)
        
        all_records = []
        page = 1
        offset = 0
        cursor = None
        next_url = None
        
        while page <= self.config.max_pages:
            # Build pagination params
            params = {}
            
            if endpoint.pagination_type == "page":
                params[endpoint.page_param] = page
                params[endpoint.limit_param] = self.config.page_size
            elif endpoint.pagination_type == "offset":
                params[endpoint.offset_param] = offset
                params[endpoint.limit_param] = self.config.page_size
            elif endpoint.pagination_type == "cursor" and cursor:
                params[endpoint.cursor_param] = cursor
                params[endpoint.limit_param] = self.config.page_size
            elif endpoint.pagination_type == "link" and next_url:
                # For link pagination, use the full URL
                pass
            else:
                params[endpoint.limit_param] = self.config.page_size
            
            # Add since filter if supported
            if since and endpoint.since_param:
                if endpoint.since_format == "iso":
                    params[endpoint.since_param] = since.isoformat()
                elif endpoint.since_format == "timestamp":
                    params[endpoint.since_param] = since.strftime("%Y-%m-%d %H:%M:%S")
                elif endpoint.since_format == "epoch":
                    params[endpoint.since_param] = int(since.timestamp())
            
            # Check rate limit
            if not await self._check_rate_limit():
                await asyncio.sleep(1)  # Brief pause
            
            # Make request
            success, data, error = await self._make_request(endpoint, params)
            
            if not success:
                result.add_error(f"Page {page}: {error}")
                break
            
            # Extract records
            records = self._extract_records(data, endpoint.records_path)
            
            if not records:
                break  # No more records
            
            # Normalize and add records
            for record in records:
                normalized = self.normalize_record(record, self.config.data_type)
                all_records.append(normalized)
            
            result.pages_fetched = page
            
            # Check if there are more pages
            if len(records) < self.config.page_size:
                break  # Last page
            
            # Get next page info
            if endpoint.pagination_type == "cursor":
                cursor = self._extract_value(data, endpoint.cursor_path)
                if not cursor:
                    break
            elif endpoint.pagination_type == "link":
                next_url = self._extract_value(data, endpoint.next_link_path)
                if not next_url:
                    break
            
            page += 1
            offset += len(records)
            
            # Brief delay between requests
            await asyncio.sleep(0.1)
        
        result.success = True
        result.records = all_records
        result.total_records = len(all_records)
        result.fetch_duration_ms = int((time.time() - start_time) * 1000)
        
        return result
    
    async def fetch_customers(self, since: Optional[datetime] = None) -> FetchResult:
        """Fetch customers from the API"""
        return await self._fetch_paginated(self.customers_endpoint, since)
    
    async def fetch_vehicles(self, since: Optional[datetime] = None) -> FetchResult:
        """Fetch vehicles from the API"""
        return await self._fetch_paginated(self.vehicles_endpoint, since)
    
    async def test_connection(self) -> Tuple[bool, str]:
        """Test connection to the API"""
        try:
            # Try to fetch one record
            endpoint = self.customers_endpoint
            params = {endpoint.limit_param: 1}
            
            success, data, error = await self._make_request(endpoint, params)
            
            if success:
                records = self._extract_records(data, endpoint.records_path)
                return True, f"Connected successfully. Found {len(records)} record(s)."
            else:
                return False, f"Connection failed: {error}"
                
        except Exception as e:
            return False, f"Connection test failed: {str(e)}"
