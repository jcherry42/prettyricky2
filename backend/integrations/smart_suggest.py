"""
Smart Field Suggest Service
AI-powered intelligent field mapping suggestions based on value analysis

Uses pattern recognition and LLM analysis to suggest field mappings
when auto-mapper can't find matches based on field names alone.
"""

import logging
import re
import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import json

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Target fields for each data type
CUSTOMER_FIELDS = {
    "name": "Full name of the customer",
    "first_name": "Customer's first/given name",
    "last_name": "Customer's last/family name", 
    "phone": "Phone number (any format)",
    "email": "Email address",
    "vehicle_of_interest": "Vehicle they want to buy",
    "status": "Lead status (hot/warm/cold/new)",
    "address": "Street address",
    "city": "City name",
    "state": "State/province",
    "zip": "ZIP/postal code",
    "source": "Lead source (website, walk-in, etc.)",
    "notes": "Notes or comments",
}

VEHICLE_FIELDS = {
    "year": "Vehicle model year (4 digits)",
    "make": "Vehicle manufacturer (Toyota, Ford, etc.)",
    "model": "Vehicle model name (Camry, F-150, etc.)",
    "price": "Sale price or MSRP",
    "stock_number": "Dealer stock number",
    "vin": "17-character VIN",
    "trim": "Trim level (LE, XLE, Limited, etc.)",
    "mileage": "Odometer reading",
    "exterior_color": "Exterior paint color",
    "interior_color": "Interior color",
    "transmission": "Transmission type",
    "engine": "Engine description",
    "fuel_type": "Fuel type (gas, diesel, electric, etc.)",
    "drivetrain": "Drivetrain (FWD, RWD, AWD, 4WD)",
    "body_style": "Body type (sedan, SUV, truck, etc.)",
    "status": "Availability status",
}


@dataclass
class FieldSuggestion:
    """A suggested field mapping"""
    source_field: str
    sample_value: Any
    suggested_target: str
    confidence: float
    reason: str
    pattern_detected: Optional[str] = None


@dataclass
class SmartSuggestResult:
    """Result of smart field suggestion"""
    success: bool
    suggestions: List[FieldSuggestion] = field(default_factory=list)
    unmapped_fields: List[str] = field(default_factory=list)
    ai_analysis: Optional[str] = None
    errors: List[str] = field(default_factory=list)


class PatternDetector:
    """
    Detects patterns in field values to suggest mappings
    Uses regex and heuristics for common automotive CRM data patterns
    """
    
    # Pattern definitions
    PATTERNS = {
        "email": {
            "regex": r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$',
            "target": "email",
            "confidence": 0.95,
        },
        "phone_us": {
            "regex": r'^[\+]?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$',
            "target": "phone",
            "confidence": 0.95,
        },
        "phone_intl": {
            "regex": r'^\+?[0-9]{10,15}$',
            "target": "phone",
            "confidence": 0.85,
        },
        "vin": {
            "regex": r'^[A-HJ-NPR-Z0-9]{17}$',
            "target": "vin",
            "confidence": 0.98,
        },
        "year": {
            "regex": r'^(19[5-9][0-9]|20[0-2][0-9])$',
            "target": "year",
            "confidence": 0.90,
        },
        "zip_us": {
            "regex": r'^\d{5}(-\d{4})?$',
            "target": "zip",
            "confidence": 0.90,
        },
        "zip_canada": {
            "regex": r'^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$',
            "target": "zip",
            "confidence": 0.90,
        },
        "price": {
            "regex": r'^\$?[\d,]+\.?\d{0,2}$',
            "target": "price",
            "confidence": 0.75,
        },
        "mileage": {
            "regex": r'^\d{1,3}(,\d{3})*\s*(mi|miles|km|kilometers)?\.?$',
            "target": "mileage",
            "confidence": 0.80,
        },
        "stock_number": {
            "regex": r'^[A-Za-z]?\d{4,8}[A-Za-z]?$',
            "target": "stock_number",
            "confidence": 0.70,
        },
    }
    
    # Known status values
    STATUS_VALUES = {
        "hot", "warm", "cold", "new", "sold", "lost", "pending", 
        "active", "available", "contacted", "qualified", "closed",
        "in stock", "on order", "reserved", "delivered"
    }
    
    # Known makes
    VEHICLE_MAKES = {
        "toyota", "honda", "ford", "chevrolet", "chevy", "nissan", "hyundai",
        "kia", "subaru", "mazda", "volkswagen", "vw", "bmw", "mercedes",
        "mercedes-benz", "audi", "lexus", "jeep", "ram", "gmc", "tesla",
        "dodge", "chrysler", "buick", "cadillac", "lincoln", "acura",
        "infiniti", "volvo", "porsche", "jaguar", "land rover", "mini"
    }
    
    # Body styles
    BODY_STYLES = {
        "sedan", "suv", "truck", "coupe", "hatchback", "wagon", "van",
        "minivan", "convertible", "crossover", "pickup", "sports car"
    }
    
    # Fuel types
    FUEL_TYPES = {
        "gas", "gasoline", "diesel", "hybrid", "plug-in hybrid", "phev",
        "electric", "ev", "flex fuel", "e85"
    }
    
    # Drivetrains
    DRIVETRAINS = {"fwd", "rwd", "awd", "4wd", "4x4", "2wd"}
    
    def detect(self, field_name: str, value: Any, data_type: str) -> Optional[FieldSuggestion]:
        """
        Detect pattern in a value and suggest a mapping
        
        Args:
            field_name: Source field name
            value: Sample value
            data_type: "customers" or "vehicles"
        
        Returns:
            FieldSuggestion if pattern detected, None otherwise
        """
        if value is None:
            return None
        
        str_value = str(value).strip()
        if not str_value:
            return None
        
        # Try regex patterns
        for pattern_name, pattern_info in self.PATTERNS.items():
            if re.match(pattern_info["regex"], str_value, re.IGNORECASE):
                target = pattern_info["target"]
                
                # Check if target is valid for this data type
                valid_targets = CUSTOMER_FIELDS if data_type == "customers" else VEHICLE_FIELDS
                if target in valid_targets:
                    return FieldSuggestion(
                        source_field=field_name,
                        sample_value=value,
                        suggested_target=target,
                        confidence=pattern_info["confidence"],
                        reason=f"Value matches {pattern_name} pattern",
                        pattern_detected=pattern_name
                    )
        
        # Try categorical value detection
        lower_value = str_value.lower()
        
        # Status detection
        if lower_value in self.STATUS_VALUES:
            return FieldSuggestion(
                source_field=field_name,
                sample_value=value,
                suggested_target="status",
                confidence=0.90,
                reason="Value matches known status term",
                pattern_detected="status_keyword"
            )
        
        # Vehicle make detection
        if data_type == "vehicles" and lower_value in self.VEHICLE_MAKES:
            return FieldSuggestion(
                source_field=field_name,
                sample_value=value,
                suggested_target="make",
                confidence=0.95,
                reason="Value matches known vehicle manufacturer",
                pattern_detected="vehicle_make"
            )
        
        # Body style detection
        if data_type == "vehicles" and lower_value in self.BODY_STYLES:
            return FieldSuggestion(
                source_field=field_name,
                sample_value=value,
                suggested_target="body_style",
                confidence=0.90,
                reason="Value matches known body style",
                pattern_detected="body_style"
            )
        
        # Fuel type detection
        if data_type == "vehicles" and lower_value in self.FUEL_TYPES:
            return FieldSuggestion(
                source_field=field_name,
                sample_value=value,
                suggested_target="fuel_type",
                confidence=0.90,
                reason="Value matches known fuel type",
                pattern_detected="fuel_type"
            )
        
        # Drivetrain detection
        if data_type == "vehicles" and lower_value in self.DRIVETRAINS:
            return FieldSuggestion(
                source_field=field_name,
                sample_value=value,
                suggested_target="drivetrain",
                confidence=0.90,
                reason="Value matches known drivetrain",
                pattern_detected="drivetrain"
            )
        
        # Name heuristics (contains space, starts with capital)
        if data_type == "customers":
            words = str_value.split()
            if len(words) >= 2 and all(w[0].isupper() for w in words if w):
                # Could be a full name
                return FieldSuggestion(
                    source_field=field_name,
                    sample_value=value,
                    suggested_target="name",
                    confidence=0.70,
                    reason="Value appears to be a person's name (multiple capitalized words)",
                    pattern_detected="name_heuristic"
                )
        
        return None


class SmartFieldSuggestService:
    """
    AI-powered field mapping suggestion service
    
    Uses a combination of:
    1. Pattern detection (regex, keywords)
    2. LLM analysis for complex/ambiguous cases
    """
    
    def __init__(self):
        self.pattern_detector = PatternDetector()
        self._llm_chat = None
    
    async def _get_llm(self):
        """Get or create LLM chat instance"""
        if self._llm_chat is None:
            try:
                from emergentintegrations.llm.chat import LlmChat
                
                api_key = os.environ.get("EMERGENT_LLM_KEY")
                if not api_key:
                    logger.warning("EMERGENT_LLM_KEY not found, AI suggestions disabled")
                    return None
                
                self._llm_chat = LlmChat(
                    api_key=api_key,
                    session_id=f"field_suggest_{datetime.now().timestamp()}",
                    system_message="""You are a CRM data field mapping expert for automotive dealerships.
Your task is to analyze sample data values and suggest which standardized field they should map to.
Be concise and precise. Return JSON only."""
                ).with_model("openai", "gpt-5.2")
                
            except ImportError:
                logger.warning("emergentintegrations not installed, AI suggestions disabled")
                return None
            except Exception as e:
                logger.error(f"Failed to initialize LLM: {e}")
                return None
        
        return self._llm_chat
    
    async def suggest_mappings(
        self,
        unmapped_fields: List[Dict[str, Any]],
        data_type: str = "customers",
        use_ai: bool = True
    ) -> SmartSuggestResult:
        """
        Suggest mappings for unmapped fields
        
        Args:
            unmapped_fields: List of {source_name, sample_value} dicts
            data_type: "customers" or "vehicles"
            use_ai: Whether to use AI for complex suggestions
        
        Returns:
            SmartSuggestResult with suggestions
        """
        result = SmartSuggestResult(success=True)
        
        # Track what's been suggested
        suggested_targets = set()
        fields_needing_ai = []
        
        # First pass: Pattern detection
        for field_info in unmapped_fields:
            source_name = field_info.get("source_name", "")
            sample_value = field_info.get("sample_value")
            
            suggestion = self.pattern_detector.detect(source_name, sample_value, data_type)
            
            if suggestion and suggestion.suggested_target not in suggested_targets:
                result.suggestions.append(suggestion)
                suggested_targets.add(suggestion.suggested_target)
            else:
                fields_needing_ai.append(field_info)
        
        # Second pass: AI analysis for remaining fields
        if use_ai and fields_needing_ai:
            ai_suggestions = await self._get_ai_suggestions(
                fields_needing_ai, 
                data_type,
                suggested_targets
            )
            
            for suggestion in ai_suggestions:
                if suggestion.suggested_target not in suggested_targets:
                    result.suggestions.append(suggestion)
                    suggested_targets.add(suggestion.suggested_target)
                else:
                    result.unmapped_fields.append(suggestion.source_field)
        
        # Track truly unmapped fields
        for field_info in unmapped_fields:
            source_name = field_info.get("source_name", "")
            if not any(s.source_field == source_name for s in result.suggestions):
                if source_name not in result.unmapped_fields:
                    result.unmapped_fields.append(source_name)
        
        return result
    
    async def _get_ai_suggestions(
        self,
        fields: List[Dict[str, Any]],
        data_type: str,
        already_suggested: set
    ) -> List[FieldSuggestion]:
        """Use AI to suggest mappings for complex fields"""
        suggestions = []
        
        llm = await self._get_llm()
        if not llm:
            return suggestions
        
        # Build prompt
        valid_targets = CUSTOMER_FIELDS if data_type == "customers" else VEHICLE_FIELDS
        available_targets = {k: v for k, v in valid_targets.items() if k not in already_suggested}
        
        if not available_targets:
            return suggestions
        
        fields_desc = "\n".join([
            f"- {f.get('source_name')}: \"{f.get('sample_value')}\""
            for f in fields[:10]  # Limit to 10 fields
        ])
        
        targets_desc = "\n".join([
            f"- {k}: {v}"
            for k, v in available_targets.items()
        ])
        
        prompt = f"""Analyze these CRM data fields and suggest which target field each should map to.

SOURCE FIELDS (with sample values):
{fields_desc}

AVAILABLE TARGET FIELDS:
{targets_desc}

For each source field, respond with a JSON array of objects:
[
  {{"source": "field_name", "target": "target_field", "confidence": 0.8, "reason": "brief explanation"}}
]

Only suggest mappings where you're reasonably confident. Use confidence 0.0 to skip uncertain fields.
Respond ONLY with the JSON array, no other text."""

        try:
            from emergentintegrations.llm.chat import UserMessage
            
            response = await llm.send_message(UserMessage(text=prompt))
            
            # Parse JSON response
            # Try to extract JSON from response
            json_match = re.search(r'\[.*\]', response, re.DOTALL)
            if json_match:
                ai_result = json.loads(json_match.group())
                
                for item in ai_result:
                    if isinstance(item, dict):
                        target = item.get("target", "")
                        confidence = float(item.get("confidence", 0))
                        
                        if target in available_targets and confidence > 0.5:
                            suggestions.append(FieldSuggestion(
                                source_field=item.get("source", ""),
                                sample_value=next(
                                    (f.get("sample_value") for f in fields 
                                     if f.get("source_name") == item.get("source")),
                                    None
                                ),
                                suggested_target=target,
                                confidence=confidence,
                                reason=item.get("reason", "AI analysis"),
                                pattern_detected="ai_analysis"
                            ))
                            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}")
        except Exception as e:
            logger.error(f"AI suggestion error: {e}")
        
        return suggestions
    
    async def analyze_sample_record(
        self,
        record: Dict[str, Any],
        data_type: str = "customers"
    ) -> SmartSuggestResult:
        """
        Analyze a complete sample record and suggest all mappings
        
        Args:
            record: Sample record with field:value pairs
            data_type: "customers" or "vehicles"
        
        Returns:
            SmartSuggestResult with all suggestions
        """
        unmapped_fields = [
            {"source_name": k, "sample_value": v}
            for k, v in record.items()
            if v is not None and str(v).strip()
        ]
        
        return await self.suggest_mappings(unmapped_fields, data_type, use_ai=True)


# Singleton instance
_service = None

def get_smart_suggest_service() -> SmartFieldSuggestService:
    global _service
    if _service is None:
        _service = SmartFieldSuggestService()
    return _service
