"""
Smart Field Mapper
Auto-detects field mappings with confidence scores
Learns from user corrections (future capability)
"""

import re
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from difflib import SequenceMatcher


@dataclass
class FieldMapping:
    """A detected field mapping with confidence"""
    source_field: str
    target_field: str
    confidence: float
    match_type: str  # "exact", "variation", "fuzzy", "override"
    sample_values: List[str]


class SmartFieldMapper:
    """
    Intelligent field mapper that handles various CRM export formats
    Uses multiple matching strategies with confidence scoring
    """
    
    # Customer field variations - ordered by priority
    CUSTOMER_MAPPINGS = {
        'first_name': {
            'exact': ['first_name', 'firstname', 'fname', 'first'],
            'contains': ['first', 'given'],
            'variations': [
                'given_name', 'givenname', 'customer_first', 'contact_first',
                'f_name', 'customer_first_name', 'lead_first_name'
            ]
        },
        'last_name': {
            'exact': ['last_name', 'lastname', 'lname', 'last', 'surname'],
            'contains': ['last', 'family', 'surname'],
            'variations': [
                'family_name', 'familyname', 'customer_last', 'contact_last',
                'l_name', 'customer_last_name', 'lead_last_name'
            ]
        },
        'full_name': {
            'exact': ['full_name', 'fullname', 'name', 'customer_name'],
            'contains': ['name', 'customer', 'contact', 'client'],
            'variations': [
                'contact_name', 'client_name', 'lead_name', 'buyer_name',
                'prospect_name', 'person_name'
            ]
        },
        'phone': {
            'exact': ['phone', 'phone_number', 'phonenumber', 'telephone', 'tel', 'mobile', 'cell'],
            'contains': ['phone', 'cell', 'mobile', 'tel'],
            'variations': [
                'cell_phone', 'cellphone', 'mobile_phone', 'primary_phone',
                'contact_phone', 'customer_phone', 'phone1', 'home_phone',
                'work_phone', 'daytime_phone'
            ]
        },
        'email': {
            'exact': ['email', 'email_address', 'emailaddress', 'e_mail'],
            'contains': ['email', 'e-mail'],
            'variations': [
                'primary_email', 'contact_email', 'customer_email', 'email1',
                'work_email', 'personal_email'
            ]
        },
        'address': {
            'exact': ['address', 'street_address', 'street', 'address1'],
            'contains': ['address', 'street'],
            'variations': [
                'full_address', 'customer_address', 'mailing_address',
                'home_address', 'addr', 'address_line_1', 'street_1'
            ]
        },
        'city': {
            'exact': ['city', 'town'],
            'contains': ['city'],
            'variations': ['municipality', 'locality']
        },
        'state': {
            'exact': ['state', 'province', 'region'],
            'contains': ['state', 'province'],
            'variations': ['state_province', 'st']
        },
        'zip': {
            'exact': ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code'],
            'contains': ['zip', 'postal'],
            'variations': ['postcode', 'postalcode']
        },
        'vehicle_of_interest': {
            'exact': ['vehicle_of_interest', 'vehicle_interest', 'interested_vehicle'],
            'contains': ['vehicle', 'interested', 'looking'],
            'variations': [
                'vehicleofinterest', 'desired_vehicle', 'target_vehicle',
                'vehicle', 'car', 'unit', 'stock', 'interested_in', 'looking_for',
                'want_vehicle', 'inquiry_vehicle'
            ]
        },
        'lead_status': {
            'exact': ['lead_status', 'leadstatus', 'status'],
            'contains': ['status', 'stage'],
            'variations': [
                'lead_type', 'leadtype', 'customer_status', 'prospect_status',
                'lead_stage', 'pipeline_stage', 'deal_stage'
            ]
        },
        'notes': {
            'exact': ['notes', 'note', 'comments', 'comment'],
            'contains': ['note', 'comment', 'remark'],
            'variations': [
                'remarks', 'memo', 'description', 'details', 'additional_info',
                'info', 'customer_notes', 'lead_notes'
            ]
        },
        'current_vehicle': {
            'exact': ['current_vehicle', 'trade_vehicle'],
            'contains': ['current', 'trade', 'existing'],
            'variations': [
                'currentvehicle', 'tradevehicle', 'existing_vehicle',
                'owns', 'current_car', 'their_car', 'driving'
            ]
        },
        'trade_in_info': {
            'exact': ['trade_in', 'tradein', 'trade'],
            'contains': ['trade'],
            'variations': [
                'trade_info', 'trade_value', 'trade_allowance', 'trade_details',
                'payoff', 'trade_payoff', 'trade_in_value'
            ]
        },
        'source_row_id': {
            'exact': ['id', 'customer_id', 'lead_id', 'record_id'],
            'contains': ['_id'],
            'variations': [
                'crm_id', 'external_id', 'source_id', 'unique_id',
                'contact_id', 'prospect_id'
            ]
        }
    }
    
    # Vehicle field variations
    VEHICLE_MAPPINGS = {
        'year': {
            'exact': ['year', 'model_year', 'yr'],
            'contains': ['year'],
            'variations': ['vehicle_year', 'veh_year']
        },
        'make': {
            'exact': ['make', 'manufacturer', 'brand'],
            'contains': ['make', 'brand'],
            'variations': ['vehicle_make', 'oem', 'mfg']
        },
        'model': {
            'exact': ['model', 'model_name'],
            'contains': ['model'],
            'variations': ['vehicle_model', 'car_model']
        },
        'trim': {
            'exact': ['trim', 'trim_level', 'package'],
            'contains': ['trim'],
            'variations': ['series', 'edition', 'grade', 'style']
        },
        'vin': {
            'exact': ['vin', 'vin_number'],
            'contains': ['vin'],
            'variations': ['vehicle_id', 'serial', 'serial_number']
        },
        'stock_number': {
            'exact': ['stock', 'stock_number', 'stocknumber'],
            'contains': ['stock'],
            'variations': ['stock_no', 'stock#', 'unit_number', 'inventory_number', 'dealerstock']
        },
        'price': {
            'exact': ['price', 'sale_price', 'selling_price'],
            'contains': ['price'],
            'variations': [
                'internet_price', 'asking_price', 'list_price', 'our_price',
                'final_price', 'dealer_price'
            ]
        },
        'msrp': {
            'exact': ['msrp', 'sticker', 'sticker_price'],
            'contains': ['msrp', 'sticker'],
            'variations': ['retail', 'retail_price', 'manufacturer_price']
        },
        'mileage': {
            'exact': ['mileage', 'miles', 'odometer'],
            'contains': ['mile', 'odo'],
            'variations': ['odo', 'km', 'kilometers', 'distance']
        },
        'exterior_color': {
            'exact': ['exterior_color', 'exteriorcolor', 'ext_color', 'color'],
            'contains': ['exterior', 'ext_color'],
            'variations': ['body_color', 'paint', 'outside_color']
        },
        'interior_color': {
            'exact': ['interior_color', 'interiorcolor', 'int_color'],
            'contains': ['interior', 'int_color'],
            'variations': ['inside_color', 'upholstery', 'seat_color']
        },
        'transmission': {
            'exact': ['transmission', 'trans'],
            'contains': ['trans'],
            'variations': ['gearbox', 'drivetrain_type', 'trans_type']
        },
        'engine': {
            'exact': ['engine', 'motor'],
            'contains': ['engine'],
            'variations': ['engine_type', 'powertrain', 'engine_size', 'displacement']
        },
        'fuel_type': {
            'exact': ['fuel', 'fuel_type', 'fueltype'],
            'contains': ['fuel'],
            'variations': ['gas_type', 'energy', 'fuel_economy']
        },
        'body_style': {
            'exact': ['body', 'body_style', 'bodystyle'],
            'contains': ['body'],
            'variations': ['body_type', 'bodytype', 'vehicle_type', 'style', 'segment']
        },
        'drivetrain': {
            'exact': ['drivetrain', 'drive', 'awd'],
            'contains': ['drive'],
            'variations': ['drive_type', '4wd', '2wd', 'fwd', 'rwd']
        },
        'status': {
            'exact': ['status', 'availability'],
            'contains': ['status'],
            'variations': ['vehicle_status', 'inv_status', 'available']
        },
        'is_new': {
            'exact': ['new', 'is_new', 'condition'],
            'contains': ['new', 'used'],
            'variations': ['new_used', 'type', 'vehicle_type', 'certified']
        },
        'image_url': {
            'exact': ['image', 'image_url', 'photo', 'photo_url'],
            'contains': ['image', 'photo', 'picture'],
            'variations': ['picture', 'img', 'thumbnail', 'main_image']
        }
    }
    
    @staticmethod
    def normalize_field_name(field: str) -> str:
        """Normalize a field name for comparison"""
        # Remove all non-alphanumeric, convert to lowercase
        return re.sub(r'[^a-z0-9]', '', field.lower())
    
    @classmethod
    def calculate_similarity(cls, str1: str, str2: str) -> float:
        """Calculate string similarity ratio"""
        return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()
    
    @classmethod
    def detect_mappings(
        cls,
        headers: List[str],
        data_type: str = "customers",
        sample_data: Optional[List[Dict]] = None,
        overrides: Optional[Dict[str, str]] = None
    ) -> Tuple[Dict[str, FieldMapping], List[str]]:
        """
        Detect field mappings from headers
        
        Args:
            headers: List of column headers from source
            data_type: "customers" or "vehicles"
            sample_data: Optional sample rows for analysis
            overrides: User-specified mapping overrides
            
        Returns:
            Tuple of (mappings dict, list of unmapped headers)
        """
        mappings_config = cls.CUSTOMER_MAPPINGS if data_type == "customers" else cls.VEHICLE_MAPPINGS
        
        result: Dict[str, FieldMapping] = {}
        unmapped: List[str] = []
        used_headers: set = set()
        
        # Apply overrides first
        if overrides:
            for target, source in overrides.items():
                if source in headers and target in mappings_config:
                    samples = cls._get_sample_values(source, sample_data) if sample_data else []
                    result[target] = FieldMapping(
                        source_field=source,
                        target_field=target,
                        confidence=1.0,
                        match_type="override",
                        sample_values=samples
                    )
                    used_headers.add(source)
        
        # Try to map remaining fields
        for target_field, variations in mappings_config.items():
            if target_field in result:
                continue
            
            best_match: Optional[FieldMapping] = None
            best_confidence: float = 0.0
            
            for header in headers:
                if header in used_headers:
                    continue
                
                normalized = cls.normalize_field_name(header)
                confidence = 0.0
                match_type = ""
                
                # Check exact matches (highest confidence)
                if normalized in [cls.normalize_field_name(v) for v in variations.get('exact', [])]:
                    confidence = 0.95
                    match_type = "exact"
                
                # Check if normalized matches target field name
                elif normalized == cls.normalize_field_name(target_field):
                    confidence = 0.93
                    match_type = "exact"
                
                # Check variations
                elif normalized in [cls.normalize_field_name(v) for v in variations.get('variations', [])]:
                    confidence = 0.85
                    match_type = "variation"
                
                # Check contains patterns
                elif not match_type:
                    for pattern in variations.get('contains', []):
                        if pattern in normalized:
                            confidence = 0.70
                            match_type = "contains"
                            break
                
                # Fuzzy matching as last resort
                if not match_type:
                    for variation in variations.get('exact', []) + variations.get('variations', []):
                        similarity = cls.calculate_similarity(normalized, cls.normalize_field_name(variation))
                        if similarity > 0.8:
                            confidence = similarity * 0.75  # Cap fuzzy matches at 0.75
                            match_type = "fuzzy"
                            break
                
                if confidence > best_confidence:
                    samples = cls._get_sample_values(header, sample_data) if sample_data else []
                    best_match = FieldMapping(
                        source_field=header,
                        target_field=target_field,
                        confidence=confidence,
                        match_type=match_type,
                        sample_values=samples
                    )
                    best_confidence = confidence
            
            if best_match and best_confidence >= 0.5:
                result[target_field] = best_match
                used_headers.add(best_match.source_field)
        
        # Track unmapped headers
        unmapped = [h for h in headers if h not in used_headers]
        
        return result, unmapped
    
    @staticmethod
    def _get_sample_values(header: str, sample_data: List[Dict], max_samples: int = 3) -> List[str]:
        """Extract sample values for a field"""
        samples = []
        for row in sample_data[:10]:
            value = row.get(header)
            if value is not None and str(value).strip():
                sample = str(value).strip()[:50]
                if sample not in samples:
                    samples.append(sample)
                if len(samples) >= max_samples:
                    break
        return samples
    
    @classmethod
    def get_required_fields(cls, data_type: str = "customers") -> List[str]:
        """Get list of required fields for a data type"""
        if data_type == "customers":
            return ['first_name', 'phone']  # Minimum required
        else:
            return ['year', 'make', 'model']  # Minimum required
    
    @classmethod
    def validate_mappings(
        cls,
        mappings: Dict[str, FieldMapping],
        data_type: str = "customers"
    ) -> Tuple[bool, List[str]]:
        """
        Validate that required fields are mapped
        
        Returns:
            Tuple of (is_valid, list of missing required fields)
        """
        required = cls.get_required_fields(data_type)
        missing = []
        
        for field in required:
            if field not in mappings:
                # Check if we have full_name instead of first_name
                if field == 'first_name' and 'full_name' in mappings:
                    continue
                missing.append(field)
        
        return len(missing) == 0, missing
