"""
OpenAPI/Swagger Spec Parser
Auto-generates integration configurations from API specifications

Supports:
- OpenAPI 3.0.x
- OpenAPI 3.1.x  
- Swagger 2.0
"""

import logging
import json
import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
import yaml
import httpx

logger = logging.getLogger(__name__)


@dataclass
class ParsedEndpoint:
    """A parsed API endpoint"""
    path: str
    method: str
    operation_id: Optional[str]
    summary: Optional[str]
    description: Optional[str]
    parameters: List[Dict[str, Any]] = field(default_factory=list)
    request_body: Optional[Dict[str, Any]] = None
    response_schema: Optional[Dict[str, Any]] = None
    tags: List[str] = field(default_factory=list)
    
    # Inferred data type
    data_type: Optional[str] = None  # customers, vehicles, leads, inventory, etc.
    confidence: float = 0.0


@dataclass
class ParsedAuth:
    """Parsed authentication configuration"""
    method: str  # api_key, bearer_token, basic_auth, oauth2
    location: str  # header, query, cookie
    name: str  # Header name or parameter name
    oauth_flows: Optional[Dict[str, Any]] = None


@dataclass
class OpenAPIParseResult:
    """Result of parsing an OpenAPI spec"""
    success: bool
    spec_version: str  # "openapi_3.0", "openapi_3.1", "swagger_2.0"
    
    # API Info
    title: str = ""
    description: str = ""
    version: str = ""
    
    # Server/Base URL
    base_url: str = ""
    servers: List[str] = field(default_factory=list)
    
    # Authentication
    auth_methods: List[ParsedAuth] = field(default_factory=list)
    
    # Endpoints
    endpoints: List[ParsedEndpoint] = field(default_factory=list)
    
    # Suggested endpoints for customers/vehicles
    customers_endpoint: Optional[ParsedEndpoint] = None
    vehicles_endpoint: Optional[ParsedEndpoint] = None
    
    # Schemas
    schemas: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    
    # Errors/Warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


# Keywords for identifying endpoint types
CUSTOMER_KEYWORDS = [
    "customer", "customers", "lead", "leads", "prospect", "prospects",
    "contact", "contacts", "client", "clients", "person", "people",
    "buyer", "buyers", "shopper", "shoppers"
]

VEHICLE_KEYWORDS = [
    "vehicle", "vehicles", "inventory", "car", "cars", "auto", "autos",
    "automobile", "automobiles", "unit", "units", "stock", "listing",
    "listings", "product", "products"
]


class OpenAPIParser:
    """
    Parser for OpenAPI/Swagger specifications
    
    Usage:
        parser = OpenAPIParser()
        result = await parser.parse_from_url("https://api.example.com/openapi.json")
        # or
        result = parser.parse_from_string(spec_content)
    """
    
    def __init__(self):
        self._http = httpx.AsyncClient(timeout=30.0)
    
    async def parse_from_url(self, url: str) -> OpenAPIParseResult:
        """Fetch and parse an OpenAPI spec from a URL"""
        result = OpenAPIParseResult(success=False, spec_version="unknown")
        
        try:
            response = await self._http.get(url)
            response.raise_for_status()
            
            content = response.text
            content_type = response.headers.get("content-type", "")
            
            return self.parse_from_string(content, content_type)
            
        except httpx.RequestError as e:
            result.errors.append(f"Failed to fetch spec: {str(e)}")
        except Exception as e:
            result.errors.append(f"Error fetching spec: {str(e)}")
        
        return result
    
    def parse_from_string(
        self, 
        content: str, 
        content_type: str = ""
    ) -> OpenAPIParseResult:
        """Parse an OpenAPI spec from a string (JSON or YAML)"""
        result = OpenAPIParseResult(success=False, spec_version="unknown")
        
        try:
            # Try to parse as JSON first, then YAML
            spec = None
            if "yaml" in content_type.lower() or content.strip().startswith(("openapi:", "swagger:", "info:")):
                try:
                    spec = yaml.safe_load(content)
                except yaml.YAMLError:
                    pass
            
            if spec is None:
                try:
                    spec = json.loads(content)
                except json.JSONDecodeError:
                    try:
                        spec = yaml.safe_load(content)
                    except yaml.YAMLError as e:
                        result.errors.append(f"Failed to parse spec as JSON or YAML: {str(e)}")
                        return result
            
            if not isinstance(spec, dict):
                result.errors.append("Spec must be a JSON/YAML object")
                return result
            
            # Detect spec version
            if "openapi" in spec:
                version = spec.get("openapi", "")
                if version.startswith("3.1"):
                    result.spec_version = "openapi_3.1"
                elif version.startswith("3.0"):
                    result.spec_version = "openapi_3.0"
                else:
                    result.spec_version = f"openapi_{version}"
                return self._parse_openapi_3(spec, result)
            elif "swagger" in spec:
                result.spec_version = "swagger_2.0"
                return self._parse_swagger_2(spec, result)
            else:
                result.errors.append("Could not detect spec version (missing 'openapi' or 'swagger' field)")
                return result
                
        except Exception as e:
            logger.error(f"OpenAPI parse error: {e}")
            result.errors.append(f"Parse error: {str(e)}")
        
        return result
    
    def _parse_openapi_3(
        self, 
        spec: Dict[str, Any], 
        result: OpenAPIParseResult
    ) -> OpenAPIParseResult:
        """Parse OpenAPI 3.x specification"""
        
        # Parse info
        info = spec.get("info", {})
        result.title = info.get("title", "")
        result.description = info.get("description", "")
        result.version = info.get("version", "")
        
        # Parse servers
        servers = spec.get("servers", [])
        for server in servers:
            url = server.get("url", "")
            if url:
                result.servers.append(url)
        
        if result.servers:
            result.base_url = result.servers[0]
        
        # Parse security schemes
        components = spec.get("components", {})
        security_schemes = components.get("securitySchemes", {})
        
        for name, scheme in security_schemes.items():
            auth = self._parse_security_scheme_v3(name, scheme)
            if auth:
                result.auth_methods.append(auth)
        
        # Parse schemas
        schemas = components.get("schemas", {})
        result.schemas = schemas
        
        # Parse paths/endpoints
        paths = spec.get("paths", {})
        for path, methods in paths.items():
            if not isinstance(methods, dict):
                continue
            
            for method, operation in methods.items():
                if method.lower() not in ["get", "post", "put", "patch", "delete"]:
                    continue
                
                if not isinstance(operation, dict):
                    continue
                
                endpoint = self._parse_endpoint_v3(path, method, operation, schemas)
                result.endpoints.append(endpoint)
        
        # Identify customer/vehicle endpoints
        self._identify_data_endpoints(result)
        
        result.success = True
        return result
    
    def _parse_swagger_2(
        self, 
        spec: Dict[str, Any], 
        result: OpenAPIParseResult
    ) -> OpenAPIParseResult:
        """Parse Swagger 2.0 specification"""
        
        # Parse info
        info = spec.get("info", {})
        result.title = info.get("title", "")
        result.description = info.get("description", "")
        result.version = info.get("version", "")
        
        # Parse host/basePath
        host = spec.get("host", "")
        base_path = spec.get("basePath", "")
        schemes = spec.get("schemes", ["https"])
        
        if host:
            scheme = schemes[0] if schemes else "https"
            result.base_url = f"{scheme}://{host}{base_path}"
            result.servers.append(result.base_url)
        
        # Parse security definitions
        security_defs = spec.get("securityDefinitions", {})
        
        for name, definition in security_defs.items():
            auth = self._parse_security_scheme_v2(name, definition)
            if auth:
                result.auth_methods.append(auth)
        
        # Parse definitions (schemas)
        definitions = spec.get("definitions", {})
        result.schemas = definitions
        
        # Parse paths
        paths = spec.get("paths", {})
        for path, methods in paths.items():
            if not isinstance(methods, dict):
                continue
            
            for method, operation in methods.items():
                if method.lower() not in ["get", "post", "put", "patch", "delete"]:
                    continue
                
                if not isinstance(operation, dict):
                    continue
                
                endpoint = self._parse_endpoint_v2(path, method, operation, definitions)
                result.endpoints.append(endpoint)
        
        # Identify customer/vehicle endpoints
        self._identify_data_endpoints(result)
        
        result.success = True
        return result
    
    def _parse_security_scheme_v3(
        self, 
        name: str, 
        scheme: Dict[str, Any]
    ) -> Optional[ParsedAuth]:
        """Parse OpenAPI 3.x security scheme"""
        scheme_type = scheme.get("type", "")
        
        if scheme_type == "apiKey":
            return ParsedAuth(
                method="api_key",
                location=scheme.get("in", "header"),
                name=scheme.get("name", "X-API-Key")
            )
        elif scheme_type == "http":
            http_scheme = scheme.get("scheme", "").lower()
            if http_scheme == "bearer":
                return ParsedAuth(
                    method="bearer_token",
                    location="header",
                    name="Authorization"
                )
            elif http_scheme == "basic":
                return ParsedAuth(
                    method="basic_auth",
                    location="header",
                    name="Authorization"
                )
        elif scheme_type == "oauth2":
            return ParsedAuth(
                method="oauth2",
                location="header",
                name="Authorization",
                oauth_flows=scheme.get("flows", {})
            )
        
        return None
    
    def _parse_security_scheme_v2(
        self, 
        name: str, 
        definition: Dict[str, Any]
    ) -> Optional[ParsedAuth]:
        """Parse Swagger 2.0 security definition"""
        def_type = definition.get("type", "")
        
        if def_type == "apiKey":
            return ParsedAuth(
                method="api_key",
                location=definition.get("in", "header"),
                name=definition.get("name", "X-API-Key")
            )
        elif def_type == "basic":
            return ParsedAuth(
                method="basic_auth",
                location="header",
                name="Authorization"
            )
        elif def_type == "oauth2":
            return ParsedAuth(
                method="oauth2",
                location="header",
                name="Authorization",
                oauth_flows={
                    "flow": definition.get("flow"),
                    "authorizationUrl": definition.get("authorizationUrl"),
                    "tokenUrl": definition.get("tokenUrl"),
                    "scopes": definition.get("scopes", {})
                }
            )
        
        return None
    
    def _parse_endpoint_v3(
        self,
        path: str,
        method: str,
        operation: Dict[str, Any],
        schemas: Dict[str, Any]
    ) -> ParsedEndpoint:
        """Parse an OpenAPI 3.x endpoint"""
        endpoint = ParsedEndpoint(
            path=path,
            method=method.upper(),
            operation_id=operation.get("operationId"),
            summary=operation.get("summary"),
            description=operation.get("description"),
            tags=operation.get("tags", []),
            parameters=operation.get("parameters", [])
        )
        
        # Parse request body
        request_body = operation.get("requestBody", {})
        if request_body:
            content = request_body.get("content", {})
            json_content = content.get("application/json", {})
            endpoint.request_body = json_content.get("schema")
        
        # Parse response schema (200 response)
        responses = operation.get("responses", {})
        success_response = responses.get("200") or responses.get("201") or responses.get("default")
        if success_response:
            content = success_response.get("content", {})
            json_content = content.get("application/json", {})
            endpoint.response_schema = json_content.get("schema")
        
        # Infer data type
        endpoint.data_type, endpoint.confidence = self._infer_data_type(endpoint)
        
        return endpoint
    
    def _parse_endpoint_v2(
        self,
        path: str,
        method: str,
        operation: Dict[str, Any],
        definitions: Dict[str, Any]
    ) -> ParsedEndpoint:
        """Parse a Swagger 2.0 endpoint"""
        endpoint = ParsedEndpoint(
            path=path,
            method=method.upper(),
            operation_id=operation.get("operationId"),
            summary=operation.get("summary"),
            description=operation.get("description"),
            tags=operation.get("tags", []),
            parameters=operation.get("parameters", [])
        )
        
        # Parse body parameter
        for param in endpoint.parameters:
            if param.get("in") == "body":
                endpoint.request_body = param.get("schema")
                break
        
        # Parse response schema
        responses = operation.get("responses", {})
        success_response = responses.get("200") or responses.get("201")
        if success_response:
            endpoint.response_schema = success_response.get("schema")
        
        # Infer data type
        endpoint.data_type, endpoint.confidence = self._infer_data_type(endpoint)
        
        return endpoint
    
    def _infer_data_type(self, endpoint: ParsedEndpoint) -> Tuple[Optional[str], float]:
        """Infer whether an endpoint is for customers or vehicles"""
        # Combine all text for analysis
        text = " ".join([
            endpoint.path,
            endpoint.operation_id or "",
            endpoint.summary or "",
            endpoint.description or "",
            " ".join(endpoint.tags)
        ]).lower()
        
        # Check for customer keywords
        customer_score = sum(1 for kw in CUSTOMER_KEYWORDS if kw in text)
        vehicle_score = sum(1 for kw in VEHICLE_KEYWORDS if kw in text)
        
        if customer_score > vehicle_score and customer_score > 0:
            confidence = min(1.0, customer_score * 0.3)
            return ("customers", confidence)
        elif vehicle_score > customer_score and vehicle_score > 0:
            confidence = min(1.0, vehicle_score * 0.3)
            return ("vehicles", confidence)
        
        return (None, 0.0)
    
    def _identify_data_endpoints(self, result: OpenAPIParseResult):
        """Identify the best endpoints for customers and vehicles"""
        # Prefer GET endpoints for list operations
        customer_candidates = []
        vehicle_candidates = []
        
        for endpoint in result.endpoints:
            if endpoint.method != "GET":
                continue
            
            if endpoint.data_type == "customers":
                customer_candidates.append(endpoint)
            elif endpoint.data_type == "vehicles":
                vehicle_candidates.append(endpoint)
        
        # Sort by confidence and pick best
        if customer_candidates:
            customer_candidates.sort(key=lambda e: -e.confidence)
            result.customers_endpoint = customer_candidates[0]
        
        if vehicle_candidates:
            vehicle_candidates.sort(key=lambda e: -e.confidence)
            result.vehicles_endpoint = vehicle_candidates[0]
    
    def generate_profile_config(self, result: OpenAPIParseResult) -> Dict[str, Any]:
        """Generate an integration profile configuration from parsed spec"""
        if not result.success:
            return {}
        
        # Determine auth method
        auth_method = "api_key"
        api_key_header = "X-API-Key"
        
        if result.auth_methods:
            auth = result.auth_methods[0]
            auth_method = auth.method
            if auth.method == "api_key":
                api_key_header = auth.name
        
        config = {
            "name": result.title or "Imported API",
            "description": result.description or f"Auto-generated from {result.spec_version} spec",
            "adapter_type": "generic_rest",
            "base_url": result.base_url,
            "auth_method": auth_method,
            "api_key_header": api_key_header,
            "customers_endpoint": result.customers_endpoint.path if result.customers_endpoint else "/customers",
            "vehicles_endpoint": result.vehicles_endpoint.path if result.vehicles_endpoint else "/vehicles",
            "customer_mappings": {},
            "vehicle_mappings": {},
            "pagination_type": "offset",
            "records_path": "data",
            "tags": ["imported", result.spec_version],
        }
        
        # Try to infer field mappings from response schema
        if result.customers_endpoint and result.customers_endpoint.response_schema:
            config["customer_mappings"] = self._infer_mappings_from_schema(
                result.customers_endpoint.response_schema,
                result.schemas,
                "customers"
            )
        
        if result.vehicles_endpoint and result.vehicles_endpoint.response_schema:
            config["vehicle_mappings"] = self._infer_mappings_from_schema(
                result.vehicles_endpoint.response_schema,
                result.schemas,
                "vehicles"
            )
        
        return config
    
    def _infer_mappings_from_schema(
        self,
        response_schema: Dict[str, Any],
        schemas: Dict[str, Any],
        data_type: str
    ) -> Dict[str, str]:
        """Infer field mappings from response schema"""
        from .field_discovery import FIELD_ALIASES
        
        mappings = {}
        
        # Resolve $ref if present
        if "$ref" in response_schema:
            ref = response_schema["$ref"]
            schema_name = ref.split("/")[-1]
            response_schema = schemas.get(schema_name, {})
        
        # Get properties
        properties = response_schema.get("properties", {})
        
        # Handle array response (items)
        if response_schema.get("type") == "array":
            items = response_schema.get("items", {})
            if "$ref" in items:
                ref = items["$ref"]
                schema_name = ref.split("/")[-1]
                items = schemas.get(schema_name, {})
            properties = items.get("properties", {})
        
        # Map fields
        for field_name in properties.keys():
            field_lower = field_name.lower().replace("-", "_")
            
            for target, aliases in FIELD_ALIASES.items():
                if field_lower in aliases or any(a in field_lower for a in aliases[:3]):
                    mappings[field_name] = target
                    break
        
        return mappings
    
    async def close(self):
        """Close HTTP client"""
        await self._http.aclose()


# Singleton instance
_parser = None

def get_openapi_parser() -> OpenAPIParser:
    global _parser
    if _parser is None:
        _parser = OpenAPIParser()
    return _parser
