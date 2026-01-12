"""
Field Transformation Engine
Advanced field mapping with transforms, composites, conditionals, and defaults

Capabilities:
1. Composite Fields - Combine multiple source fields into one target
2. Data Transforms - Clean, format, and normalize values
3. Conditional Mapping - Map based on other field values
4. Default Values - Fallback when source field is empty
"""

import logging
import re
from typing import Dict, List, Any, Optional, Callable, Union
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import json

logger = logging.getLogger(__name__)


class TransformType(str, Enum):
    """Types of field transformations"""
    # String transforms
    UPPERCASE = "uppercase"
    LOWERCASE = "lowercase"
    TITLECASE = "titlecase"
    TRIM = "trim"
    STRIP_HTML = "strip_html"
    TRUNCATE = "truncate"
    
    # Phone transforms
    PHONE_NORMALIZE = "phone_normalize"  # → +1XXXXXXXXXX
    PHONE_FORMAT_US = "phone_format_us"  # → (XXX) XXX-XXXX
    PHONE_DIGITS_ONLY = "phone_digits_only"  # → XXXXXXXXXX
    
    # Name transforms
    NAME_PARSE = "name_parse"  # Split full name into parts
    NAME_COMBINE = "name_combine"  # Combine first + last
    
    # Price/Number transforms
    PRICE_NORMALIZE = "price_normalize"  # Remove $, commas → float
    NUMBER_EXTRACT = "number_extract"  # Extract first number from string
    ROUND_PRICE = "round_price"  # Round to nearest dollar
    
    # Date transforms
    DATE_NORMALIZE = "date_normalize"  # → ISO format
    DATE_FORMAT = "date_format"  # Custom format
    
    # Address transforms
    ADDRESS_PARSE = "address_parse"  # Split into components
    ADDRESS_COMBINE = "address_combine"  # Combine components
    STATE_ABBREVIATE = "state_abbreviate"  # California → CA
    STATE_EXPAND = "state_expand"  # CA → California
    ZIP_NORMALIZE = "zip_normalize"  # Ensure 5 digits
    
    # Vehicle transforms
    VIN_VALIDATE = "vin_validate"  # Validate and uppercase
    YEAR_EXTRACT = "year_extract"  # Extract year from string
    MILEAGE_NORMALIZE = "mileage_normalize"  # Remove commas, "miles"
    
    # Status transforms
    STATUS_NORMALIZE = "status_normalize"  # Map to standard values
    
    # Generic transforms
    REGEX_EXTRACT = "regex_extract"  # Extract via regex
    REGEX_REPLACE = "regex_replace"  # Replace via regex
    TEMPLATE = "template"  # String template with placeholders
    LOOKUP = "lookup"  # Map values via lookup table
    COALESCE = "coalesce"  # First non-empty value
    SPLIT = "split"  # Split string and take part
    JOIN = "join"  # Join multiple fields
    CUSTOM = "custom"  # Custom Python expression (sandboxed)


class ConditionOperator(str, Enum):
    """Operators for conditional mapping"""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    MATCHES_REGEX = "matches_regex"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    IN_LIST = "in_list"
    NOT_IN_LIST = "not_in_list"


@dataclass
class Condition:
    """A condition for conditional mapping"""
    field: str  # Source field to check
    operator: ConditionOperator
    value: Any = None  # Comparison value (not needed for is_empty/is_not_empty)
    
    def evaluate(self, record: Dict[str, Any]) -> bool:
        """Evaluate this condition against a record"""
        field_value = self._get_nested_value(record, self.field)
        
        if self.operator == ConditionOperator.IS_EMPTY:
            return field_value is None or str(field_value).strip() == ""
        
        if self.operator == ConditionOperator.IS_NOT_EMPTY:
            return field_value is not None and str(field_value).strip() != ""
        
        if field_value is None:
            return False
        
        str_value = str(field_value).lower()
        compare_value = str(self.value).lower() if self.value else ""
        
        if self.operator == ConditionOperator.EQUALS:
            return str_value == compare_value
        elif self.operator == ConditionOperator.NOT_EQUALS:
            return str_value != compare_value
        elif self.operator == ConditionOperator.CONTAINS:
            return compare_value in str_value
        elif self.operator == ConditionOperator.NOT_CONTAINS:
            return compare_value not in str_value
        elif self.operator == ConditionOperator.STARTS_WITH:
            return str_value.startswith(compare_value)
        elif self.operator == ConditionOperator.ENDS_WITH:
            return str_value.endswith(compare_value)
        elif self.operator == ConditionOperator.MATCHES_REGEX:
            try:
                return bool(re.match(str(self.value), str(field_value), re.IGNORECASE))
            except re.error:
                return False
        elif self.operator == ConditionOperator.GREATER_THAN:
            try:
                return float(field_value) > float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.LESS_THAN:
            try:
                return float(field_value) < float(self.value)
            except (ValueError, TypeError):
                return False
        elif self.operator == ConditionOperator.IN_LIST:
            list_values = [v.lower() for v in (self.value if isinstance(self.value, list) else str(self.value).split(","))]
            return str_value in list_values
        elif self.operator == ConditionOperator.NOT_IN_LIST:
            list_values = [v.lower() for v in (self.value if isinstance(self.value, list) else str(self.value).split(","))]
            return str_value not in list_values
        
        return False
    
    def _get_nested_value(self, record: Dict[str, Any], path: str) -> Any:
        """Get value from nested dict using dot notation"""
        keys = path.split(".")
        value = record
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value


@dataclass
class Transform:
    """A single transformation to apply"""
    type: TransformType
    params: Dict[str, Any] = field(default_factory=dict)
    
    def apply(self, value: Any, record: Dict[str, Any] = None) -> Any:
        """Apply this transform to a value"""
        if value is None and self.type not in [TransformType.COALESCE, TransformType.TEMPLATE]:
            return None
        
        try:
            return self._apply_transform(value, record or {})
        except Exception as e:
            logger.warning(f"Transform {self.type} failed: {e}")
            return value
    
    def _apply_transform(self, value: Any, record: Dict[str, Any]) -> Any:
        """Internal transform application"""
        str_value = str(value) if value is not None else ""
        
        # String transforms
        if self.type == TransformType.UPPERCASE:
            return str_value.upper()
        elif self.type == TransformType.LOWERCASE:
            return str_value.lower()
        elif self.type == TransformType.TITLECASE:
            return str_value.title()
        elif self.type == TransformType.TRIM:
            return str_value.strip()
        elif self.type == TransformType.STRIP_HTML:
            return re.sub(r'<[^>]+>', '', str_value)
        elif self.type == TransformType.TRUNCATE:
            max_len = self.params.get("max_length", 100)
            suffix = self.params.get("suffix", "...")
            if len(str_value) > max_len:
                return str_value[:max_len - len(suffix)] + suffix
            return str_value
        
        # Phone transforms
        elif self.type == TransformType.PHONE_NORMALIZE:
            digits = re.sub(r'\D', '', str_value)
            if len(digits) == 10:
                return f"+1{digits}"
            elif len(digits) == 11 and digits[0] == '1':
                return f"+{digits}"
            return f"+{digits}" if digits else None
        elif self.type == TransformType.PHONE_FORMAT_US:
            digits = re.sub(r'\D', '', str_value)
            if len(digits) == 10:
                return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            elif len(digits) == 11 and digits[0] == '1':
                return f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
            return str_value
        elif self.type == TransformType.PHONE_DIGITS_ONLY:
            digits = re.sub(r'\D', '', str_value)
            if len(digits) == 11 and digits[0] == '1':
                return digits[1:]
            return digits
        
        # Name transforms
        elif self.type == TransformType.NAME_COMBINE:
            fields = self.params.get("fields", ["first_name", "last_name"])
            separator = self.params.get("separator", " ")
            parts = [str(record.get(f, "")).strip() for f in fields]
            return separator.join(p for p in parts if p)
        elif self.type == TransformType.NAME_PARSE:
            parts = str_value.strip().split()
            if len(parts) >= 2:
                return {
                    "first_name": parts[0],
                    "last_name": " ".join(parts[1:]),
                    "full_name": str_value.strip()
                }
            return {"first_name": str_value.strip(), "last_name": "", "full_name": str_value.strip()}
        
        # Price/Number transforms
        elif self.type == TransformType.PRICE_NORMALIZE:
            cleaned = re.sub(r'[^\d.]', '', str_value)
            try:
                return float(cleaned) if cleaned else None
            except ValueError:
                return None
        elif self.type == TransformType.NUMBER_EXTRACT:
            match = re.search(r'[\d,]+\.?\d*', str_value)
            if match:
                cleaned = match.group().replace(',', '')
                try:
                    return float(cleaned)
                except ValueError:
                    pass
            return None
        elif self.type == TransformType.ROUND_PRICE:
            try:
                return round(float(re.sub(r'[^\d.]', '', str_value)))
            except (ValueError, TypeError):
                return None
        
        # Date transforms
        elif self.type == TransformType.DATE_NORMALIZE:
            # Try common date formats
            formats = [
                "%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d",
                "%m-%d-%Y", "%d-%m-%Y", "%B %d, %Y", "%b %d, %Y",
                "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%SZ"
            ]
            for fmt in formats:
                try:
                    dt = datetime.strptime(str_value, fmt)
                    return dt.isoformat()
                except ValueError:
                    continue
            return str_value
        elif self.type == TransformType.DATE_FORMAT:
            output_format = self.params.get("format", "%Y-%m-%d")
            try:
                # Try to parse ISO format first
                dt = datetime.fromisoformat(str_value.replace('Z', '+00:00'))
                return dt.strftime(output_format)
            except ValueError:
                return str_value
        
        # Address transforms
        elif self.type == TransformType.ADDRESS_COMBINE:
            fields = self.params.get("fields", ["address", "city", "state", "zip"])
            separator = self.params.get("separator", ", ")
            parts = [str(record.get(f, "")).strip() for f in fields]
            return separator.join(p for p in parts if p)
        elif self.type == TransformType.STATE_ABBREVIATE:
            return STATE_ABBREVIATIONS.get(str_value.lower(), str_value.upper()[:2])
        elif self.type == TransformType.STATE_EXPAND:
            return STATE_NAMES.get(str_value.upper(), str_value)
        elif self.type == TransformType.ZIP_NORMALIZE:
            digits = re.sub(r'\D', '', str_value)
            if len(digits) >= 5:
                return digits[:5]
            return digits.zfill(5) if digits else None
        
        # Vehicle transforms
        elif self.type == TransformType.VIN_VALIDATE:
            vin = re.sub(r'[^A-HJ-NPR-Z0-9]', '', str_value.upper())
            if len(vin) == 17:
                return vin
            return None
        elif self.type == TransformType.YEAR_EXTRACT:
            match = re.search(r'\b(19[5-9]\d|20[0-2]\d)\b', str_value)
            if match:
                return int(match.group())
            return None
        elif self.type == TransformType.MILEAGE_NORMALIZE:
            cleaned = re.sub(r'[^\d]', '', str_value)
            try:
                return int(cleaned) if cleaned else None
            except ValueError:
                return None
        
        # Status transforms
        elif self.type == TransformType.STATUS_NORMALIZE:
            status_map = self.params.get("status_map", DEFAULT_STATUS_MAP)
            lower_value = str_value.lower().strip()
            return status_map.get(lower_value, lower_value)
        
        # Generic transforms
        elif self.type == TransformType.REGEX_EXTRACT:
            pattern = self.params.get("pattern", "")
            group = self.params.get("group", 0)
            try:
                match = re.search(pattern, str_value)
                if match:
                    return match.group(group)
            except re.error:
                pass
            return None
        elif self.type == TransformType.REGEX_REPLACE:
            pattern = self.params.get("pattern", "")
            replacement = self.params.get("replacement", "")
            try:
                return re.sub(pattern, replacement, str_value)
            except re.error:
                return str_value
        elif self.type == TransformType.TEMPLATE:
            template = self.params.get("template", "")
            try:
                return template.format(**record, value=value)
            except (KeyError, ValueError):
                return template
        elif self.type == TransformType.LOOKUP:
            lookup_table = self.params.get("table", {})
            default = self.params.get("default", str_value)
            return lookup_table.get(str_value.lower(), default)
        elif self.type == TransformType.COALESCE:
            fields = self.params.get("fields", [])
            for f in fields:
                val = record.get(f)
                if val is not None and str(val).strip():
                    return val
            return value
        elif self.type == TransformType.SPLIT:
            delimiter = self.params.get("delimiter", " ")
            index = self.params.get("index", 0)
            parts = str_value.split(delimiter)
            if 0 <= index < len(parts):
                return parts[index].strip()
            return None
        elif self.type == TransformType.JOIN:
            fields = self.params.get("fields", [])
            delimiter = self.params.get("delimiter", " ")
            parts = [str(record.get(f, "")).strip() for f in fields]
            return delimiter.join(p for p in parts if p)
        
        return value


@dataclass
class FieldMapping:
    """Complete mapping configuration for a single target field"""
    target_field: str
    
    # Simple mapping (single source field)
    source_field: Optional[str] = None
    
    # Composite mapping (multiple source fields)
    source_fields: List[str] = field(default_factory=list)
    composite_template: Optional[str] = None  # e.g., "{first_name} {last_name}"
    composite_delimiter: str = " "
    
    # Transforms to apply (in order)
    transforms: List[Transform] = field(default_factory=list)
    
    # Default value if source is empty
    default_value: Any = None
    
    # Conditional mapping
    conditions: List[Condition] = field(default_factory=list)
    condition_logic: str = "all"  # "all" (AND) or "any" (OR)
    
    # Alternative mappings if conditions fail
    fallback_source: Optional[str] = None
    
    def apply(self, record: Dict[str, Any]) -> Any:
        """Apply this mapping to extract and transform a value"""
        # Check conditions
        if self.conditions:
            conditions_met = self._evaluate_conditions(record)
            if not conditions_met:
                # Use fallback or return None
                if self.fallback_source:
                    value = record.get(self.fallback_source)
                else:
                    return None
            else:
                value = self._extract_value(record)
        else:
            value = self._extract_value(record)
        
        # Apply transforms
        for transform in self.transforms:
            value = transform.apply(value, record)
        
        # Apply default if empty
        if (value is None or str(value).strip() == "") and self.default_value is not None:
            value = self.default_value
        
        return value
    
    def _extract_value(self, record: Dict[str, Any]) -> Any:
        """Extract value from record"""
        # Composite mapping
        if self.source_fields:
            if self.composite_template:
                try:
                    return self.composite_template.format(**{
                        f: record.get(f, "") for f in self.source_fields
                    })
                except (KeyError, ValueError):
                    pass
            
            # Simple concatenation
            parts = [str(record.get(f, "")).strip() for f in self.source_fields]
            return self.composite_delimiter.join(p for p in parts if p)
        
        # Simple mapping
        if self.source_field:
            return self._get_nested_value(record, self.source_field)
        
        return None
    
    def _evaluate_conditions(self, record: Dict[str, Any]) -> bool:
        """Evaluate all conditions"""
        if not self.conditions:
            return True
        
        results = [c.evaluate(record) for c in self.conditions]
        
        if self.condition_logic == "any":
            return any(results)
        return all(results)
    
    def _get_nested_value(self, record: Dict[str, Any], path: str) -> Any:
        """Get value from nested dict using dot notation"""
        keys = path.split(".")
        value = record
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                return None
        return value


@dataclass
class MappingConfig:
    """Complete mapping configuration for an integration"""
    customer_mappings: List[FieldMapping] = field(default_factory=list)
    vehicle_mappings: List[FieldMapping] = field(default_factory=list)
    
    # Global transforms applied to all fields
    global_transforms: List[Transform] = field(default_factory=list)
    
    # Global defaults
    global_defaults: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage"""
        return {
            "customer_mappings": [
                self._mapping_to_dict(m) for m in self.customer_mappings
            ],
            "vehicle_mappings": [
                self._mapping_to_dict(m) for m in self.vehicle_mappings
            ],
            "global_transforms": [
                {"type": t.type.value, "params": t.params} for t in self.global_transforms
            ],
            "global_defaults": self.global_defaults,
        }
    
    def _mapping_to_dict(self, mapping: FieldMapping) -> Dict[str, Any]:
        """Convert a single mapping to dict"""
        return {
            "target_field": mapping.target_field,
            "source_field": mapping.source_field,
            "source_fields": mapping.source_fields,
            "composite_template": mapping.composite_template,
            "composite_delimiter": mapping.composite_delimiter,
            "transforms": [
                {"type": t.type.value, "params": t.params} for t in mapping.transforms
            ],
            "default_value": mapping.default_value,
            "conditions": [
                {"field": c.field, "operator": c.operator.value, "value": c.value}
                for c in mapping.conditions
            ],
            "condition_logic": mapping.condition_logic,
            "fallback_source": mapping.fallback_source,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MappingConfig":
        """Create from dictionary"""
        config = cls()
        
        for m_data in data.get("customer_mappings", []):
            config.customer_mappings.append(cls._mapping_from_dict(m_data))
        
        for m_data in data.get("vehicle_mappings", []):
            config.vehicle_mappings.append(cls._mapping_from_dict(m_data))
        
        for t_data in data.get("global_transforms", []):
            config.global_transforms.append(Transform(
                type=TransformType(t_data["type"]),
                params=t_data.get("params", {})
            ))
        
        config.global_defaults = data.get("global_defaults", {})
        
        return config
    
    @classmethod
    def _mapping_from_dict(cls, data: Dict[str, Any]) -> FieldMapping:
        """Create a FieldMapping from dict"""
        transforms = []
        for t_data in data.get("transforms", []):
            transforms.append(Transform(
                type=TransformType(t_data["type"]),
                params=t_data.get("params", {})
            ))
        
        conditions = []
        for c_data in data.get("conditions", []):
            conditions.append(Condition(
                field=c_data["field"],
                operator=ConditionOperator(c_data["operator"]),
                value=c_data.get("value")
            ))
        
        return FieldMapping(
            target_field=data["target_field"],
            source_field=data.get("source_field"),
            source_fields=data.get("source_fields", []),
            composite_template=data.get("composite_template"),
            composite_delimiter=data.get("composite_delimiter", " "),
            transforms=transforms,
            default_value=data.get("default_value"),
            conditions=conditions,
            condition_logic=data.get("condition_logic", "all"),
            fallback_source=data.get("fallback_source"),
        )


class FieldTransformEngine:
    """
    Engine for applying field transformations to records
    """
    
    def __init__(self, config: MappingConfig):
        self.config = config
    
    def transform_customer(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a customer record"""
        return self._transform_record(record, self.config.customer_mappings)
    
    def transform_vehicle(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a vehicle record"""
        return self._transform_record(record, self.config.vehicle_mappings)
    
    def _transform_record(
        self, 
        record: Dict[str, Any], 
        mappings: List[FieldMapping]
    ) -> Dict[str, Any]:
        """Transform a record using the given mappings"""
        result = {}
        
        for mapping in mappings:
            value = mapping.apply(record)
            
            # Apply global transforms
            for transform in self.config.global_transforms:
                value = transform.apply(value, record)
            
            # Apply global default if still empty
            if (value is None or str(value).strip() == "") and mapping.target_field in self.config.global_defaults:
                value = self.config.global_defaults[mapping.target_field]
            
            if value is not None:
                result[mapping.target_field] = value
        
        return result
    
    def transform_batch(
        self, 
        records: List[Dict[str, Any]], 
        data_type: str
    ) -> List[Dict[str, Any]]:
        """Transform a batch of records"""
        if data_type == "customers":
            return [self.transform_customer(r) for r in records]
        else:
            return [self.transform_vehicle(r) for r in records]


# State abbreviation lookup tables
STATE_ABBREVIATIONS = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
    "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
    "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
    "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
    "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
}

STATE_NAMES = {v: k.title() for k, v in STATE_ABBREVIATIONS.items()}

# Default status normalization map
DEFAULT_STATUS_MAP = {
    "hot": "hot", "warm": "warm", "cold": "cold", "new": "new",
    "active": "hot", "interested": "warm", "not interested": "cold",
    "qualified": "hot", "unqualified": "cold", "contacted": "warm",
    "pending": "new", "follow up": "warm", "follow-up": "warm",
    "sold": "sold", "closed": "sold", "won": "sold",
    "lost": "lost", "dead": "lost", "declined": "lost",
    "available": "available", "in stock": "available",
    "sold out": "sold", "reserved": "reserved", "on order": "pending",
}


# Convenience functions for creating common mapping configurations
def create_name_composite_mapping(
    first_name_field: str = "first_name",
    last_name_field: str = "last_name"
) -> FieldMapping:
    """Create a mapping that combines first and last name"""
    return FieldMapping(
        target_field="name",
        source_fields=[first_name_field, last_name_field],
        composite_template="{" + first_name_field + "} {" + last_name_field + "}",
        transforms=[Transform(type=TransformType.TRIM), Transform(type=TransformType.TITLECASE)],
    )


def create_phone_mapping(source_field: str = "phone") -> FieldMapping:
    """Create a phone mapping with normalization"""
    return FieldMapping(
        target_field="phone",
        source_field=source_field,
        transforms=[Transform(type=TransformType.PHONE_NORMALIZE)],
    )


def create_price_mapping(source_field: str = "price") -> FieldMapping:
    """Create a price mapping with normalization"""
    return FieldMapping(
        target_field="price",
        source_field=source_field,
        transforms=[Transform(type=TransformType.PRICE_NORMALIZE)],
    )


def create_address_composite_mapping(
    street_field: str = "address",
    city_field: str = "city",
    state_field: str = "state",
    zip_field: str = "zip"
) -> FieldMapping:
    """Create a full address composite mapping"""
    return FieldMapping(
        target_field="full_address",
        source_fields=[street_field, city_field, state_field, zip_field],
        transforms=[
            Transform(type=TransformType.ADDRESS_COMBINE, params={
                "fields": [street_field, city_field, state_field, zip_field],
                "separator": ", "
            })
        ],
    )


def create_conditional_status_mapping(
    status_field: str = "status",
    hot_values: List[str] = None,
    cold_values: List[str] = None
) -> FieldMapping:
    """Create a status mapping with conditional logic"""
    hot_values = hot_values or ["active", "interested", "qualified"]
    cold_values = cold_values or ["inactive", "not interested", "unqualified"]
    
    custom_map = {v: "hot" for v in hot_values}
    custom_map.update({v: "cold" for v in cold_values})
    
    return FieldMapping(
        target_field="status",
        source_field=status_field,
        transforms=[
            Transform(type=TransformType.LOWERCASE),
            Transform(type=TransformType.STATUS_NORMALIZE, params={"status_map": {**DEFAULT_STATUS_MAP, **custom_map}}),
        ],
        default_value="new",
    )
