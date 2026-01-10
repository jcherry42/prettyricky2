"""
Field Discovery & Mapping Service
Auto-discovers API fields and provides intelligent mapping suggestions
"""

import logging
import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import httpx

logger = logging.getLogger(__name__)


# Priority fields that MUST be mapped for the app to function
REQUIRED_CUSTOMER_FIELDS = ["name", "phone"]
REQUIRED_VEHICLE_FIELDS = ["year", "make", "model"]

# Target schema - what we normalize to
CUSTOMER_SCHEMA = {
    "name": {"type": "string", "required": True, "description": "Customer full name", "priority": 1},
    "phone": {"type": "string", "required": True, "description": "Phone number", "priority": 1},
    "email": {"type": "string", "required": False, "description": "Email address", "priority": 2},
    "vehicle_of_interest": {"type": "string", "required": False, "description": "Vehicle they're interested in", "priority": 2},
    "status": {"type": "string", "required": False, "description": "Lead status (hot/warm/cold/new)", "priority": 2},
    "first_name": {"type": "string", "required": False, "description": "First name", "priority": 3},
    "last_name": {"type": "string", "required": False, "description": "Last name", "priority": 3},
    "address": {"type": "string", "required": False, "description": "Street address", "priority": 3},
    "city": {"type": "string", "required": False, "description": "City", "priority": 3},
    "state": {"type": "string", "required": False, "description": "State", "priority": 3},
    "zip": {"type": "string", "required": False, "description": "ZIP code", "priority": 3},
    "notes": {"type": "string", "required": False, "description": "Notes or comments", "priority": 3},
    "source": {"type": "string", "required": False, "description": "Lead source", "priority": 3},
}

VEHICLE_SCHEMA = {
    "year": {"type": "integer", "required": True, "description": "Vehicle year", "priority": 1},
    "make": {"type": "string", "required": True, "description": "Vehicle make (Toyota, Ford, etc.)", "priority": 1},
    "model": {"type": "string", "required": True, "description": "Vehicle model (Camry, F-150, etc.)", "priority": 1},
    "price": {"type": "number", "required": False, "description": "Asking price", "priority": 2},
    "stock_number": {"type": "string", "required": False, "description": "Stock number", "priority": 2},
    "vin": {"type": "string", "required": False, "description": "VIN", "priority": 3},
    "trim": {"type": "string", "required": False, "description": "Trim level", "priority": 3},
    "mileage": {"type": "integer", "required": False, "description": "Odometer reading", "priority": 3},
    "exterior_color": {"type": "string", "required": False, "description": "Exterior color", "priority": 3},
    "interior_color": {"type": "string", "required": False, "description": "Interior color", "priority": 3},
    "transmission": {"type": "string", "required": False, "description": "Transmission type", "priority": 3},
    "engine": {"type": "string", "required": False, "description": "Engine description", "priority": 3},
    "fuel_type": {"type": "string", "required": False, "description": "Fuel type", "priority": 3},
    "drivetrain": {"type": "string", "required": False, "description": "Drivetrain (FWD/RWD/AWD/4WD)", "priority": 3},
    "body_style": {"type": "string", "required": False, "description": "Body style (Sedan, SUV, etc.)", "priority": 3},
    "status": {"type": "string", "required": False, "description": "Availability status", "priority": 3},
}

# Field name variations for auto-mapping (lowercase)
FIELD_ALIASES = {
    # Customer fields
    "name": ["name", "full_name", "fullname", "customer_name", "customername", "contact_name", "lead_name", "client_name", "customer"],
    "first_name": ["first_name", "firstname", "fname", "first", "given_name", "givenname"],
    "last_name": ["last_name", "lastname", "lname", "last", "surname", "family_name", "familyname"],
    "phone": ["phone", "phone_number", "phonenumber", "mobile", "cell", "telephone", "tel", "contact_phone", "primary_phone", "cell_phone", "mobile_phone"],
    "email": ["email", "email_address", "emailaddress", "e_mail", "contact_email", "primary_email"],
    "vehicle_of_interest": ["vehicle_of_interest", "vehicleofinterest", "interested_vehicle", "vehicle_interest", "voi", "interest", "desired_vehicle", "looking_for"],
    "status": ["status", "lead_status", "leadstatus", "customer_status", "stage", "lead_stage", "availability", "available", "inventory_status", "vehicle_status", "condition"],
    "address": ["address", "street", "street_address", "address1", "address_1", "line1"],
    "city": ["city", "town"],
    "state": ["state", "province", "region"],
    "zip": ["zip", "zipcode", "zip_code", "postal", "postal_code", "postalcode"],
    "notes": ["notes", "note", "comments", "comment", "description", "remarks"],
    "source": ["source", "lead_source", "leadsource", "origin", "referral_source", "how_heard"],
    
    # Vehicle fields
    "year": ["year", "model_year", "modelyear", "yr", "vehicle_year"],
    "make": ["make", "manufacturer", "brand", "vehicle_make", "oem"],
    "model": ["model", "model_name", "modelname", "vehicle_model"],
    "trim": ["trim", "trim_level", "trimlevel", "package", "edition"],
    "price": ["price", "asking_price", "askingprice", "sale_price", "saleprice", "list_price", "listprice", "selling_price", "msrp", "cost"],
    "stock_number": ["stock_number", "stocknumber", "stock", "stock_no", "stockno", "stk", "stock_id", "inventory_id"],
    "vin": ["vin", "vehicle_vin", "vin_number", "vinnumber", "vehicle_identification_number"],
    "mileage": ["mileage", "miles", "odometer", "km", "kilometers"],
    "exterior_color": ["exterior_color", "exteriorcolor", "ext_color", "extcolor", "color", "outside_color", "paint_color"],
    "interior_color": ["interior_color", "interiorcolor", "int_color", "intcolor", "inside_color", "upholstery"],
    "transmission": ["transmission", "trans", "gearbox", "transmission_type"],
    "engine": ["engine", "motor", "engine_type", "enginetype", "displacement", "engine_size"],
    "fuel_type": ["fuel_type", "fueltype", "fuel", "gas_type"],
    "drivetrain": ["drivetrain", "drive_train", "drive_type", "drivetype", "drive", "awd", "fwd", "rwd", "4wd"],
    "body_style": ["body_style", "bodystyle", "body_type", "bodytype", "body", "vehicle_type", "style"],
}


@dataclass
class DiscoveredField:
    """A field discovered from an API response"""
    source_name: str  # Original field name from API
    source_path: str  # JSON path (e.g., "data.customer.name")
    sample_value: Any  # Example value
    inferred_type: str  # string, number, boolean, array, object
    suggested_mapping: Optional[str] = None  # Our target field
    confidence: float = 0.0  # 0-1 confidence in mapping
    is_mapped: bool = False


@dataclass  
class FieldDiscoveryResult:
    """Result of field discovery"""
    success: bool
    data_type: str  # customers or vehicles
    discovered_fields: List[DiscoveredField] = field(default_factory=list)
    sample_record: Dict[str, Any] = field(default_factory=dict)
    unmapped_required: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class FieldDiscoveryService:
    """
    Service for discovering and mapping fields from external APIs
    """
    
    def __init__(self):
        self._http = httpx.AsyncClient(timeout=30.0)
    
    async def discover_from_api(
        self,
        base_url: str,
        endpoint: str,
        auth_config: Dict[str, Any],
        data_type: str = "customers",
    ) -> FieldDiscoveryResult:
        """
        Fetch a sample from the API and discover available fields
        
        Args:
            base_url: API base URL
            endpoint: Endpoint path (e.g., /customers)
            auth_config: Authentication configuration
            data_type: "customers" or "vehicles"
        
        Returns:
            FieldDiscoveryResult with discovered fields and mappings
        """
        result = FieldDiscoveryResult(success=False, data_type=data_type)
        
        try:
            # Build request
            url = f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"
            headers = self._build_headers(auth_config)
            params = {"limit": 1, "per_page": 1, "page_size": 1}  # Try to get just 1 record
            
            logger.info(f"Discovering fields from {url}")
            
            response = await self._http.get(url, headers=headers, params=params)
            
            if response.status_code != 200:
                result.errors.append(f"API returned status {response.status_code}: {response.text[:200]}")
                return result
            
            data = response.json()
            
            # Extract sample record
            sample = self._extract_sample_record(data)
            if not sample:
                result.errors.append("No records found in API response")
                return result
            
            result.sample_record = sample
            
            # Discover and map fields
            result.discovered_fields = self._discover_fields(sample, data_type)
            result.success = True
            
            # Check for unmapped required fields
            required = REQUIRED_CUSTOMER_FIELDS if data_type == "customers" else REQUIRED_VEHICLE_FIELDS
            
            mapped_targets = {f.suggested_mapping for f in result.discovered_fields if f.suggested_mapping}
            result.unmapped_required = [f for f in required if f not in mapped_targets]
            
            if result.unmapped_required:
                result.warnings.append(f"Required fields not auto-mapped: {', '.join(result.unmapped_required)}")
            
        except httpx.RequestError as e:
            result.errors.append(f"Connection error: {str(e)}")
        except json.JSONDecodeError:
            result.errors.append("Invalid JSON response from API")
        except Exception as e:
            logger.error(f"Field discovery error: {e}")
            result.errors.append(f"Discovery failed: {str(e)}")
        
        return result
    
    def discover_from_sample(
        self,
        sample_json: str,
        data_type: str = "customers",
    ) -> FieldDiscoveryResult:
        """
        Discover fields from a manually pasted JSON sample
        
        Args:
            sample_json: JSON string of sample data
            data_type: "customers" or "vehicles"
        
        Returns:
            FieldDiscoveryResult with discovered fields
        """
        result = FieldDiscoveryResult(success=False, data_type=data_type)
        
        try:
            data = json.loads(sample_json)
            
            # Extract sample record
            sample = self._extract_sample_record(data)
            if not sample:
                # Maybe it's already a single record
                if isinstance(data, dict) and not any(k in data for k in ['data', 'results', 'records', 'items']):
                    sample = data
                else:
                    result.errors.append("Could not extract a record from the JSON")
                    return result
            
            result.sample_record = sample
            result.discovered_fields = self._discover_fields(sample, data_type)
            result.success = True
            
            # Check required fields
            required = REQUIRED_CUSTOMER_FIELDS if data_type == "customers" else REQUIRED_VEHICLE_FIELDS
            mapped_targets = {f.suggested_mapping for f in result.discovered_fields if f.suggested_mapping}
            result.unmapped_required = [f for f in required if f not in mapped_targets]
            
            if result.unmapped_required:
                result.warnings.append(f"Required fields not auto-mapped: {', '.join(result.unmapped_required)}")
                
        except json.JSONDecodeError as e:
            result.errors.append(f"Invalid JSON: {str(e)}")
        except Exception as e:
            result.errors.append(f"Discovery failed: {str(e)}")
        
        return result
    
    def _build_headers(self, auth_config: Dict[str, Any]) -> Dict[str, str]:
        """Build request headers from auth config"""
        headers = {"Accept": "application/json"}
        
        method = auth_config.get("method", "api_key")
        
        if method == "api_key":
            header_name = auth_config.get("api_key_header", "X-API-Key")
            api_key = auth_config.get("api_key", "")
            if api_key:
                headers[header_name] = api_key
                
        elif method == "bearer_token":
            token = auth_config.get("access_token") or auth_config.get("api_key", "")
            if token:
                headers["Authorization"] = f"Bearer {token}"
                
        elif method == "basic_auth":
            import base64
            username = auth_config.get("username", "")
            password = auth_config.get("password", "")
            if username:
                creds = base64.b64encode(f"{username}:{password}".encode()).decode()
                headers["Authorization"] = f"Basic {creds}"
        
        # Add any custom headers
        custom = auth_config.get("custom_headers", {})
        headers.update(custom)
        
        return headers
    
    def _extract_sample_record(self, data: Any) -> Optional[Dict[str, Any]]:
        """Extract a single sample record from API response"""
        if isinstance(data, list) and len(data) > 0:
            return data[0] if isinstance(data[0], dict) else None
        
        if isinstance(data, dict):
            # Check common wrapper keys
            for key in ['data', 'results', 'records', 'items', 'leads', 'customers', 'vehicles', 'inventory']:
                if key in data:
                    nested = data[key]
                    if isinstance(nested, list) and len(nested) > 0:
                        return nested[0] if isinstance(nested[0], dict) else None
                    if isinstance(nested, dict):
                        return nested
            
            # Maybe it's already the record
            return data
        
        return None
    
    def _discover_fields(
        self,
        record: Dict[str, Any],
        data_type: str,
        prefix: str = ""
    ) -> List[DiscoveredField]:
        """
        Recursively discover fields from a record
        """
        fields = []
        schema = CUSTOMER_SCHEMA if data_type == "customers" else VEHICLE_SCHEMA
        
        for key, value in record.items():
            path = f"{prefix}.{key}" if prefix else key
            
            # Handle nested objects
            if isinstance(value, dict):
                # Recurse into nested object
                nested_fields = self._discover_fields(value, data_type, path)
                fields.extend(nested_fields)
                continue
            
            # Skip arrays for now (could be expanded later)
            if isinstance(value, list):
                continue
            
            # Infer type
            inferred_type = self._infer_type(value)
            
            # Try to find a mapping
            suggested, confidence = self._suggest_mapping(key, value, schema)
            
            field = DiscoveredField(
                source_name=key,
                source_path=path,
                sample_value=value,
                inferred_type=inferred_type,
                suggested_mapping=suggested,
                confidence=confidence,
                is_mapped=suggested is not None
            )
            fields.append(field)
        
        # Sort by confidence (highest first), then by priority
        fields.sort(key=lambda f: (-f.confidence, f.source_name))
        
        return fields
    
    def _infer_type(self, value: Any) -> str:
        """Infer the type of a value"""
        if value is None:
            return "null"
        if isinstance(value, bool):
            return "boolean"
        if isinstance(value, int):
            return "integer"
        if isinstance(value, float):
            return "number"
        if isinstance(value, str):
            return "string"
        if isinstance(value, list):
            return "array"
        if isinstance(value, dict):
            return "object"
        return "unknown"
    
    def _suggest_mapping(
        self,
        field_name: str,
        sample_value: Any,
        schema: Dict[str, Any]
    ) -> Tuple[Optional[str], float]:
        """
        Suggest a target field mapping based on name and value
        
        Returns:
            (target_field, confidence) or (None, 0)
        """
        field_lower = field_name.lower().replace("-", "_").replace(" ", "_")
        
        best_match = None
        best_confidence = 0.0
        
        for target_field, aliases in FIELD_ALIASES.items():
            if target_field not in schema:
                continue
            
            # Exact match
            if field_lower in aliases:
                return (target_field, 1.0)
            
            # Partial match - field contains alias or alias contains field
            for alias in aliases:
                if alias in field_lower or field_lower in alias:
                    confidence = 0.7
                    if confidence > best_confidence:
                        best_match = target_field
                        best_confidence = confidence
                        
            # Fuzzy match using common patterns
            if best_confidence < 0.5:
                # Check if field ends with target name
                if field_lower.endswith(target_field) or field_lower.endswith(target_field.replace("_", "")):
                    if 0.6 > best_confidence:
                        best_match = target_field
                        best_confidence = 0.6
        
        # Value-based inference for ambiguous fields
        if best_confidence < 0.7 and sample_value:
            inferred = self._infer_from_value(str(sample_value), schema)
            if inferred and inferred[1] > best_confidence:
                best_match, best_confidence = inferred
        
        return (best_match, best_confidence) if best_confidence > 0 else (None, 0)
    
    def _infer_from_value(
        self,
        value: str,
        schema: Dict[str, Any]
    ) -> Optional[Tuple[str, float]]:
        """Infer field type from the actual value"""
        value = value.strip()
        
        # Phone number pattern
        if re.match(r'^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$', value):
            if "phone" in schema:
                return ("phone", 0.8)
        
        # Email pattern
        if re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', value):
            if "email" in schema:
                return ("email", 0.9)
        
        # VIN pattern (17 chars, no I, O, Q)
        if re.match(r'^[A-HJ-NPR-Z0-9]{17}$', value.upper()):
            if "vin" in schema:
                return ("vin", 0.95)
        
        # Year pattern (4 digits, 1900-2099)
        if re.match(r'^(19|20)\d{2}$', value):
            if "year" in schema:
                return ("year", 0.85)
        
        # ZIP code pattern
        if re.match(r'^\d{5}(-\d{4})?$', value):
            if "zip" in schema:
                return ("zip", 0.9)
        
        # Status keywords
        status_keywords = ["hot", "warm", "cold", "new", "sold", "lost", "pending", "active", "available"]
        if value.lower() in status_keywords:
            if "status" in schema:
                return ("status", 0.85)
        
        return None
    
    def get_target_schema(self, data_type: str) -> Dict[str, Any]:
        """Get the target schema for a data type"""
        return CUSTOMER_SCHEMA if data_type == "customers" else VEHICLE_SCHEMA
    
    def validate_mappings(
        self,
        mappings: Dict[str, str],
        data_type: str
    ) -> Tuple[bool, List[str]]:
        """
        Validate that all required fields are mapped
        
        Args:
            mappings: Dict of source_field -> target_field
            data_type: "customers" or "vehicles"
        
        Returns:
            (is_valid, list of missing required fields)
        """
        required = REQUIRED_CUSTOMER_FIELDS if data_type == "customers" else REQUIRED_VEHICLE_FIELDS
        mapped_targets = set(mappings.values())
        
        missing = [f for f in required if f not in mapped_targets]
        
        return (len(missing) == 0, missing)
    
    async def close(self):
        """Close HTTP client"""
        await self._http.aclose()


# Singleton instance
_discovery_service = None

def get_discovery_service() -> FieldDiscoveryService:
    global _discovery_service
    if _discovery_service is None:
        _discovery_service = FieldDiscoveryService()
    return _discovery_service
