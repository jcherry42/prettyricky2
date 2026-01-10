"""
CRM-Agnostic Data Integration Module
Handles CSV, JSON, Google Sheets with smart field mapping
"""

import re
import csv
import json
import io
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from enum import Enum
import httpx
import logging

logger = logging.getLogger(__name__)


# ============== DATA MODELS ==============

class LeadStatus(str, Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    NEW = "new"
    SOLD = "sold"
    LOST = "lost"


class Customer(BaseModel):
    """Normalized customer model"""
    id: Optional[str] = None
    # Must-have fields
    firstName: str
    lastName: str = ""
    phone: str
    email: str = ""
    vehicleOfInterest: Optional[str] = None
    leadStatus: LeadStatus = LeadStatus.NEW
    address: str = ""
    # Nice-to-have fields
    notes: str = ""
    currentVehicle: Optional[str] = None
    tradeInInfo: Optional[str] = None
    # Metadata
    source: str = "import"
    importedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Vehicle(BaseModel):
    """Normalized vehicle inventory model"""
    id: Optional[str] = None
    # Core fields
    year: int
    make: str
    model: str
    trim: str = ""
    price: Optional[float] = None
    msrp: Optional[float] = None
    stockNumber: str = ""
    vin: str = ""
    # Details
    mileage: Optional[int] = None
    exteriorColor: str = ""
    interiorColor: str = ""
    transmission: str = ""
    engine: str = ""
    fuelType: str = ""
    bodyStyle: str = ""
    # Status
    status: str = "available"  # available, sold, pending
    isNew: bool = True
    # Metadata
    imageUrl: str = ""
    source: str = "import"
    importedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class DataSourceType(str, Enum):
    FILE = "file"
    URL = "url"
    GOOGLE_SHEETS = "google_sheets"


class DataSource(BaseModel):
    """Configuration for a data source"""
    id: Optional[str] = None
    name: str
    type: DataSourceType
    url: Optional[str] = None  # For URL and Google Sheets
    dataType: str = "customers"  # customers or vehicles
    isActive: bool = True
    lastRefresh: Optional[datetime] = None
    nextRefresh: Optional[datetime] = None
    refreshSchedule: str = "weekdays_10am"  # Mon-Sat at 10 AM
    fieldMapping: Dict[str, str] = {}  # custom overrides
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== SMART FIELD MAPPER ==============

class SmartFieldMapper:
    """Auto-detects and maps field names from various CRM exports"""
    
    # Field name variations mapped to our normalized fields
    CUSTOMER_FIELD_MAPPINGS = {
        'firstName': [
            'first_name', 'firstname', 'fname', 'first', 'given_name', 
            'givenname', 'customer_first', 'contact_first', 'f_name'
        ],
        'lastName': [
            'last_name', 'lastname', 'lname', 'last', 'surname', 
            'family_name', 'familyname', 'customer_last', 'contact_last', 'l_name'
        ],
        'name': [  # Combined name field
            'full_name', 'fullname', 'customer_name', 'contact_name', 
            'client_name', 'name', 'customer', 'contact', 'client'
        ],
        'phone': [
            'phone', 'phone_number', 'phonenumber', 'cell', 'cell_phone',
            'cellphone', 'mobile', 'mobile_phone', 'telephone', 'tel',
            'primary_phone', 'contact_phone', 'customer_phone', 'phone1'
        ],
        'email': [
            'email', 'email_address', 'emailaddress', 'e_mail', 'e-mail',
            'primary_email', 'contact_email', 'customer_email', 'email1'
        ],
        'vehicleOfInterest': [
            'vehicle_of_interest', 'vehicleofinterest', 'interested_vehicle',
            'vehicle_interest', 'desired_vehicle', 'target_vehicle',
            'vehicle', 'car', 'unit', 'stock', 'interested_in', 'looking_for'
        ],
        'leadStatus': [
            'lead_status', 'leadstatus', 'status', 'lead_type', 'leadtype',
            'customer_status', 'prospect_status', 'stage', 'lead_stage'
        ],
        'address': [
            'address', 'full_address', 'street_address', 'street', 
            'customer_address', 'mailing_address', 'home_address', 'addr'
        ],
        'city': ['city', 'town'],
        'state': ['state', 'province', 'region'],
        'zip': ['zip', 'zipcode', 'zip_code', 'postal', 'postal_code', 'postcode'],
        'notes': [
            'notes', 'note', 'comments', 'comment', 'remarks', 'memo',
            'description', 'details', 'additional_info', 'info'
        ],
        'currentVehicle': [
            'current_vehicle', 'currentvehicle', 'trade_vehicle', 'tradevehicle',
            'existing_vehicle', 'owns', 'current_car', 'their_car'
        ],
        'tradeInInfo': [
            'trade_in', 'tradein', 'trade', 'trade_info', 'trade_value',
            'trade_allowance', 'trade_details', 'payoff', 'trade_payoff'
        ],
    }
    
    VEHICLE_FIELD_MAPPINGS = {
        'year': ['year', 'model_year', 'yr', 'vehicle_year'],
        'make': ['make', 'manufacturer', 'brand', 'vehicle_make', 'oem'],
        'model': ['model', 'vehicle_model', 'model_name'],
        'trim': ['trim', 'trim_level', 'package', 'series', 'edition'],
        'price': [
            'price', 'sale_price', 'selling_price', 'internet_price',
            'asking_price', 'list_price', 'our_price', 'final_price'
        ],
        'msrp': ['msrp', 'sticker', 'sticker_price', 'retail', 'retail_price'],
        'stockNumber': [
            'stock', 'stock_number', 'stocknumber', 'stock_no', 'stock#',
            'unit_number', 'inventory_number', 'dealerstock'
        ],
        'vin': ['vin', 'vin_number', 'vehicle_id', 'serial', 'serial_number'],
        'mileage': ['mileage', 'miles', 'odometer', 'odo', 'km', 'kilometers'],
        'exteriorColor': [
            'exterior_color', 'exteriorcolor', 'ext_color', 'color',
            'body_color', 'paint', 'outside_color'
        ],
        'interiorColor': [
            'interior_color', 'interiorcolor', 'int_color', 'inside_color',
            'upholstery', 'seat_color'
        ],
        'transmission': [
            'transmission', 'trans', 'gearbox', 'drivetrain_type'
        ],
        'engine': ['engine', 'motor', 'engine_type', 'powertrain', 'engine_size'],
        'fuelType': ['fuel', 'fuel_type', 'fueltype', 'gas_type', 'energy'],
        'bodyStyle': [
            'body', 'body_style', 'bodystyle', 'body_type', 'bodytype',
            'vehicle_type', 'style', 'segment'
        ],
        'status': ['status', 'availability', 'vehicle_status', 'inv_status'],
        'isNew': ['new', 'is_new', 'condition', 'new_used', 'type'],
        'imageUrl': ['image', 'image_url', 'photo', 'photo_url', 'picture', 'img'],
    }
    
    # Lead status normalization
    STATUS_MAPPINGS = {
        'hot': ['hot', 'a', 'high', 'urgent', 'ready', 'active', '1', 'priority'],
        'warm': ['warm', 'b', 'medium', 'interested', 'engaged', '2'],
        'cold': ['cold', 'c', 'low', 'dormant', 'inactive', '3'],
        'new': ['new', 'fresh', 'uncontacted', 'unworked', 'lead'],
        'sold': ['sold', 'closed', 'won', 'delivered', 'complete'],
        'lost': ['lost', 'dead', 'closed_lost', 'not_interested', 'declined'],
    }
    
    @classmethod
    def normalize_field_name(cls, field: str) -> str:
        """Normalize a field name for comparison"""
        return re.sub(r'[^a-z0-9]', '', field.lower())
    
    @classmethod
    def detect_field_mapping(cls, headers: List[str], data_type: str = "customers") -> Dict[str, str]:
        """
        Auto-detect field mappings from headers
        Returns: {normalized_field: original_header}
        """
        mappings = cls.CUSTOMER_FIELD_MAPPINGS if data_type == "customers" else cls.VEHICLE_FIELD_MAPPINGS
        result = {}
        used_headers = set()
        
        for target_field, variations in mappings.items():
            for header in headers:
                if header in used_headers:
                    continue
                    
                normalized_header = cls.normalize_field_name(header)
                
                # Check if header matches target field directly
                if normalized_header == cls.normalize_field_name(target_field):
                    result[target_field] = header
                    used_headers.add(header)
                    break
                
                # Check against variations
                for variation in variations:
                    if normalized_header == cls.normalize_field_name(variation):
                        result[target_field] = header
                        used_headers.add(header)
                        break
                
                if target_field in result:
                    break
        
        return result
    
    @classmethod
    def normalize_lead_status(cls, status: str) -> LeadStatus:
        """Normalize various status values to our enum"""
        if not status:
            return LeadStatus.NEW
            
        normalized = cls.normalize_field_name(status)
        
        for lead_status, variations in cls.STATUS_MAPPINGS.items():
            if normalized in [cls.normalize_field_name(v) for v in variations]:
                return LeadStatus(lead_status)
        
        return LeadStatus.NEW
    
    @classmethod
    def parse_name(cls, full_name: str) -> Tuple[str, str]:
        """Split full name into first and last name"""
        if not full_name:
            return ("", "")
        
        parts = full_name.strip().split()
        if len(parts) == 1:
            return (parts[0], "")
        elif len(parts) == 2:
            return (parts[0], parts[1])
        else:
            # First word is first name, rest is last name
            return (parts[0], " ".join(parts[1:]))
    
    @classmethod
    def combine_address(cls, row: Dict, mapping: Dict[str, str]) -> str:
        """Combine address parts into full address"""
        parts = []
        
        if 'address' in mapping and mapping['address'] in row:
            parts.append(str(row[mapping['address']]).strip())
        
        city_state_zip = []
        if 'city' in mapping and mapping['city'] in row:
            city_state_zip.append(str(row[mapping['city']]).strip())
        if 'state' in mapping and mapping['state'] in row:
            city_state_zip.append(str(row[mapping['state']]).strip())
        if 'zip' in mapping and mapping['zip'] in row:
            city_state_zip.append(str(row[mapping['zip']]).strip())
        
        if city_state_zip:
            parts.append(", ".join(filter(None, city_state_zip)))
        
        return ", ".join(filter(None, parts))


# ============== FILE PARSERS ==============

class DataParser:
    """Parse various file formats into normalized data"""
    
    @staticmethod
    async def parse_csv(content: str, data_type: str = "customers") -> Tuple[List[Dict], Dict[str, str]]:
        """Parse CSV content"""
        reader = csv.DictReader(io.StringIO(content))
        headers = reader.fieldnames or []
        
        mapping = SmartFieldMapper.detect_field_mapping(headers, data_type)
        rows = list(reader)
        
        return rows, mapping
    
    @staticmethod
    async def parse_json(content: str, data_type: str = "customers") -> Tuple[List[Dict], Dict[str, str]]:
        """Parse JSON content"""
        data = json.loads(content)
        
        # Handle different JSON structures
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            # Check for common wrapper keys
            for key in ['data', 'records', 'results', 'customers', 'vehicles', 'items', 'rows']:
                if key in data and isinstance(data[key], list):
                    rows = data[key]
                    break
            else:
                rows = [data]  # Single record
        else:
            rows = []
        
        if not rows:
            return [], {}
        
        # Get headers from first row
        headers = list(rows[0].keys()) if rows else []
        mapping = SmartFieldMapper.detect_field_mapping(headers, data_type)
        
        return rows, mapping
    
    @staticmethod
    async def fetch_google_sheet(url: str) -> str:
        """
        Fetch Google Sheet as CSV
        Converts sharing URL to CSV export URL
        """
        # Convert Google Sheets URL to CSV export format
        # https://docs.google.com/spreadsheets/d/SHEET_ID/edit -> 
        # https://docs.google.com/spreadsheets/d/SHEET_ID/export?format=csv
        
        if 'docs.google.com/spreadsheets' in url:
            # Extract sheet ID
            match = re.search(r'/d/([a-zA-Z0-9-_]+)', url)
            if match:
                sheet_id = match.group(1)
                
                # Check for specific sheet (gid)
                gid_match = re.search(r'gid=(\d+)', url)
                gid = gid_match.group(1) if gid_match else '0'
                
                csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
            else:
                raise ValueError("Could not extract Google Sheet ID from URL")
        else:
            csv_url = url
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(csv_url)
            response.raise_for_status()
            return response.text
    
    @staticmethod
    async def fetch_url(url: str) -> Tuple[str, str]:
        """
        Fetch content from URL and detect format
        Returns: (content, format)
        """
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.text
            
            # Detect format
            content_type = response.headers.get('content-type', '').lower()
            
            if 'json' in content_type or content.strip().startswith(('{', '[')):
                return content, 'json'
            else:
                return content, 'csv'


# ============== DATA TRANSFORMER ==============

class DataTransformer:
    """Transform raw data into normalized models"""
    
    @staticmethod
    def transform_customer(row: Dict, mapping: Dict[str, str], custom_mapping: Dict[str, str] = None) -> Optional[Customer]:
        """Transform a row into a Customer model"""
        try:
            # Merge custom mapping overrides
            effective_mapping = {**mapping, **(custom_mapping or {})}
            
            def get_value(field: str, default: str = "") -> str:
                if field in effective_mapping:
                    return str(row.get(effective_mapping[field], default)).strip()
                return default
            
            # Handle name - either separate fields or combined
            first_name = get_value('firstName')
            last_name = get_value('lastName')
            
            if not first_name and 'name' in effective_mapping:
                full_name = get_value('name')
                first_name, last_name = SmartFieldMapper.parse_name(full_name)
            
            if not first_name:
                return None  # Name is required
            
            # Get phone - required
            phone = get_value('phone')
            if not phone:
                return None
            
            # Normalize phone (remove non-digits except leading +)
            phone_clean = re.sub(r'[^\d+]', '', phone)
            if len(phone_clean) < 7:
                return None
            
            # Build address
            address = SmartFieldMapper.combine_address(row, effective_mapping)
            if not address:
                address = get_value('address')
            
            # Normalize status
            status_raw = get_value('leadStatus', 'new')
            lead_status = SmartFieldMapper.normalize_lead_status(status_raw)
            
            return Customer(
                firstName=first_name,
                lastName=last_name,
                phone=phone_clean,
                email=get_value('email'),
                vehicleOfInterest=get_value('vehicleOfInterest') or None,
                leadStatus=lead_status,
                address=address,
                notes=get_value('notes'),
                currentVehicle=get_value('currentVehicle') or None,
                tradeInInfo=get_value('tradeInInfo') or None,
            )
        except Exception as e:
            logger.warning(f"Failed to transform customer row: {e}")
            return None
    
    @staticmethod
    def transform_vehicle(row: Dict, mapping: Dict[str, str], custom_mapping: Dict[str, str] = None) -> Optional[Vehicle]:
        """Transform a row into a Vehicle model"""
        try:
            effective_mapping = {**mapping, **(custom_mapping or {})}
            
            def get_value(field: str, default: str = "") -> str:
                if field in effective_mapping:
                    return str(row.get(effective_mapping[field], default)).strip()
                return default
            
            def get_int(field: str, default: int = 0) -> int:
                val = get_value(field)
                if val:
                    # Remove non-digits
                    clean = re.sub(r'[^\d]', '', val)
                    return int(clean) if clean else default
                return default
            
            def get_float(field: str, default: float = None) -> Optional[float]:
                val = get_value(field)
                if val:
                    # Remove currency symbols and commas
                    clean = re.sub(r'[^\d.]', '', val)
                    try:
                        return float(clean) if clean else default
                    except:
                        return default
                return default
            
            year = get_int('year')
            make = get_value('make')
            model = get_value('model')
            
            if not year or not make or not model:
                return None
            
            # Determine if new/used
            is_new_raw = get_value('isNew').lower()
            is_new = is_new_raw in ['new', 'true', 'yes', '1', 'n']
            
            return Vehicle(
                year=year,
                make=make,
                model=model,
                trim=get_value('trim'),
                price=get_float('price'),
                msrp=get_float('msrp'),
                stockNumber=get_value('stockNumber'),
                vin=get_value('vin'),
                mileage=get_int('mileage') or None,
                exteriorColor=get_value('exteriorColor'),
                interiorColor=get_value('interiorColor'),
                transmission=get_value('transmission'),
                engine=get_value('engine'),
                fuelType=get_value('fuelType'),
                bodyStyle=get_value('bodyStyle'),
                status=get_value('status', 'available'),
                isNew=is_new,
                imageUrl=get_value('imageUrl'),
            )
        except Exception as e:
            logger.warning(f"Failed to transform vehicle row: {e}")
            return None


# ============== IMPORT PROCESSOR ==============

class ImportProcessor:
    """Main processor for importing data from various sources"""
    
    @staticmethod
    async def process_import(
        content: str,
        format: str,
        data_type: str = "customers",
        custom_mapping: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Process import content and return normalized data
        
        Returns:
            {
                "success": bool,
                "data": [...],
                "mapping": {...},
                "stats": {"total": X, "imported": Y, "skipped": Z},
                "errors": [...]
            }
        """
        errors = []
        
        try:
            # Parse content
            if format == 'json':
                rows, mapping = await DataParser.parse_json(content, data_type)
            else:
                rows, mapping = await DataParser.parse_csv(content, data_type)
            
            if not rows:
                return {
                    "success": False,
                    "data": [],
                    "mapping": {},
                    "stats": {"total": 0, "imported": 0, "skipped": 0},
                    "errors": ["No data found in file"]
                }
            
            # Transform rows
            results = []
            skipped = 0
            
            transformer = DataTransformer.transform_customer if data_type == "customers" else DataTransformer.transform_vehicle
            
            for i, row in enumerate(rows):
                try:
                    item = transformer(row, mapping, custom_mapping)
                    if item:
                        results.append(item.model_dump())
                    else:
                        skipped += 1
                except Exception as e:
                    skipped += 1
                    if len(errors) < 10:  # Limit error messages
                        errors.append(f"Row {i+1}: {str(e)}")
            
            return {
                "success": True,
                "data": results,
                "mapping": mapping,
                "stats": {
                    "total": len(rows),
                    "imported": len(results),
                    "skipped": skipped
                },
                "errors": errors
            }
            
        except json.JSONDecodeError:
            return {
                "success": False,
                "data": [],
                "mapping": {},
                "stats": {"total": 0, "imported": 0, "skipped": 0},
                "errors": ["Invalid JSON format"]
            }
        except Exception as e:
            logger.error(f"Import processing error: {e}")
            return {
                "success": False,
                "data": [],
                "mapping": {},
                "stats": {"total": 0, "imported": 0, "skipped": 0},
                "errors": [str(e)]
            }
    
    @staticmethod
    async def import_from_url(
        url: str,
        data_type: str = "customers",
        custom_mapping: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Import data from a URL"""
        try:
            # Check if Google Sheets
            if 'docs.google.com/spreadsheets' in url:
                content = await DataParser.fetch_google_sheet(url)
                format = 'csv'
            else:
                content, format = await DataParser.fetch_url(url)
            
            return await ImportProcessor.process_import(content, format, data_type, custom_mapping)
            
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "data": [],
                "mapping": {},
                "stats": {"total": 0, "imported": 0, "skipped": 0},
                "errors": [f"HTTP error: {e.response.status_code}"]
            }
        except Exception as e:
            logger.error(f"URL import error: {e}")
            return {
                "success": False,
                "data": [],
                "mapping": {},
                "stats": {"total": 0, "imported": 0, "skipped": 0},
                "errors": [str(e)]
            }
