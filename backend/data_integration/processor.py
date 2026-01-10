"""
Import Processor
Orchestrates the full data import pipeline
"""

import time
import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone
import httpx

from .models import (
    Customer, Vehicle, ImportResult, FieldMappingResult,
    LeadStatus, VehicleStatus
)
from .field_mapper import SmartFieldMapper, FieldMapping
from .validators import (
    PhoneValidator, EmailValidator, AddressValidator,
    VINValidator, NameValidator
)
from .parsers import get_parser, detect_format, ParseResult
from .exceptions import (
    ParseError, ValidationError, MappingError,
    FetchError, TransformError
)

logger = logging.getLogger(__name__)


class ImportProcessor:
    """
    Main processor for importing data from various sources
    
    Pipeline:
    1. Fetch content (if URL)
    2. Detect format
    3. Parse content
    4. Detect field mappings
    5. Validate mappings
    6. Transform rows
    7. Return normalized data
    """
    
    def __init__(self):
        self.field_mapper = SmartFieldMapper()
    
    async def import_from_url(
        self,
        url: str,
        data_type: str = "customers",
        custom_mapping: Optional[Dict[str, str]] = None
    ) -> ImportResult:
        """
        Import data from a URL
        
        Args:
            url: URL to fetch (can be direct file URL or Google Sheets)
            data_type: "customers" or "vehicles"
            custom_mapping: Optional user-specified field mapping overrides
        """
        start_time = time.time()
        result = ImportResult(success=False)
        
        try:
            # Handle Google Sheets specially
            if 'docs.google.com/spreadsheets' in url:
                parser = get_parser('google_sheets')
                parse_result = await parser.parse(url)
            else:
                # Fetch content
                content, detected_format = await self._fetch_url(url)
                parser = get_parser(detected_format)
                parse_result = await parser.parse(content)
            
            if not parse_result.success:
                result.errors = parse_result.errors
                result.warnings = parse_result.warnings
                return result
            
            # Process parsed data
            return await self._process_parsed_data(
                parse_result,
                data_type,
                custom_mapping,
                start_time
            )
            
        except FetchError as e:
            result.errors.append(str(e))
            return result
        except Exception as e:
            logger.exception(f"Import error: {e}")
            result.errors.append(f"Import failed: {str(e)}")
            return result
    
    async def import_from_content(
        self,
        content: str,
        format: str,
        data_type: str = "customers",
        custom_mapping: Optional[Dict[str, str]] = None
    ) -> ImportResult:
        """
        Import data from raw content
        
        Args:
            content: Raw file content
            format: 'csv' or 'json'
            data_type: "customers" or "vehicles"
            custom_mapping: Optional user-specified field mapping overrides
        """
        start_time = time.time()
        result = ImportResult(success=False)
        
        try:
            # Parse content
            parser = get_parser(format)
            parse_result = await parser.parse(content)
            
            if not parse_result.success:
                result.errors = parse_result.errors
                result.warnings = parse_result.warnings
                return result
            
            # Process parsed data
            return await self._process_parsed_data(
                parse_result,
                data_type,
                custom_mapping,
                start_time
            )
            
        except Exception as e:
            logger.exception(f"Import error: {e}")
            result.errors.append(f"Import failed: {str(e)}")
            return result
    
    async def preview_import(
        self,
        content: str,
        format: str,
        data_type: str = "customers",
        max_rows: int = 5
    ) -> Dict[str, Any]:
        """
        Preview import without fully processing
        Returns detected mappings and sample data
        """
        try:
            parser = get_parser(format)
            parse_result = await parser.parse(content)
            
            if not parse_result.success:
                return {
                    "success": False,
                    "errors": parse_result.errors
                }
            
            # Detect mappings
            mappings, unmapped = self.field_mapper.detect_mappings(
                parse_result.headers,
                data_type,
                parse_result.rows[:10]
            )
            
            # Validate required fields
            is_valid, missing = self.field_mapper.validate_mappings(mappings, data_type)
            
            # Format mapping results
            mapping_results = []
            for target, mapping in mappings.items():
                mapping_results.append({
                    "sourceField": mapping.source_field,
                    "targetField": mapping.target_field,
                    "confidence": mapping.confidence,
                    "matchType": mapping.match_type,
                    "sampleValues": mapping.sample_values
                })
            
            # Get sample rows
            sample_rows = parse_result.rows[:max_rows]
            
            return {
                "success": True,
                "totalRows": parse_result.total_rows,
                "headers": parse_result.headers,
                "mappings": mapping_results,
                "unmappedFields": unmapped,
                "missingRequired": missing,
                "isValid": is_valid,
                "sampleData": sample_rows,
                "warnings": parse_result.warnings
            }
            
        except Exception as e:
            logger.exception(f"Preview error: {e}")
            return {
                "success": False,
                "errors": [str(e)]
            }
    
    async def _fetch_url(self, url: str) -> Tuple[str, str]:
        """Fetch content from URL and detect format"""
        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                follow_redirects=True
            ) as client:
                response = await client.get(url)
                response.raise_for_status()
                content = response.text
                
                # Detect format from content-type or content
                content_type = response.headers.get('content-type', '').lower()
                
                if 'json' in content_type:
                    return content, 'json'
                elif content.strip().startswith(('{', '[')):
                    return content, 'json'
                else:
                    return content, 'csv'
                    
        except httpx.HTTPStatusError as e:
            raise FetchError(
                f"HTTP {e.response.status_code}",
                url,
                e.response.status_code
            )
        except httpx.RequestError as e:
            raise FetchError(f"Connection failed: {str(e)}", url)
    
    async def _process_parsed_data(
        self,
        parse_result: ParseResult,
        data_type: str,
        custom_mapping: Optional[Dict[str, str]],
        start_time: float
    ) -> ImportResult:
        """Process parsed data into normalized models"""
        result = ImportResult(success=False)
        result.total_rows = parse_result.total_rows
        result.warnings = parse_result.warnings.copy()
        
        # Detect field mappings
        mappings, unmapped = self.field_mapper.detect_mappings(
            parse_result.headers,
            data_type,
            parse_result.rows[:10],
            custom_mapping
        )
        
        result.unmapped_fields = unmapped
        
        # Convert mappings to result format
        for target, mapping in mappings.items():
            result.detected_mappings.append(FieldMappingResult(
                source_field=mapping.source_field,
                target_field=mapping.target_field,
                confidence=mapping.confidence,
                sample_values=mapping.sample_values
            ))
        
        # Validate required mappings
        is_valid, missing = self.field_mapper.validate_mappings(mappings, data_type)
        
        if not is_valid:
            result.add_error(f"Missing required fields: {', '.join(missing)}")
            result.processing_time_ms = int((time.time() - start_time) * 1000)
            return result
        
        # Transform rows
        if data_type == "customers":
            result.customers = await self._transform_customers(
                parse_result.rows,
                mappings,
                result
            )
            result.imported_count = len(result.customers)
        else:
            result.vehicles = await self._transform_vehicles(
                parse_result.rows,
                mappings,
                result
            )
            result.imported_count = len(result.vehicles)
        
        result.skipped_count = result.total_rows - result.imported_count
        result.success = result.imported_count > 0
        result.processing_time_ms = int((time.time() - start_time) * 1000)
        
        return result
    
    async def _transform_customers(
        self,
        rows: List[Dict],
        mappings: Dict[str, FieldMapping],
        result: ImportResult
    ) -> List[Customer]:
        """Transform rows into Customer models"""
        customers = []
        
        for i, row in enumerate(rows):
            try:
                customer = self._row_to_customer(row, mappings, i)
                if customer:
                    customers.append(customer)
                else:
                    result.skipped_count += 1
            except Exception as e:
                result.add_error(f"Row {i+1}: {str(e)}")
        
        return customers
    
    async def _transform_vehicles(
        self,
        rows: List[Dict],
        mappings: Dict[str, FieldMapping],
        result: ImportResult
    ) -> List[Vehicle]:
        """Transform rows into Vehicle models"""
        vehicles = []
        
        for i, row in enumerate(rows):
            try:
                vehicle = self._row_to_vehicle(row, mappings, i)
                if vehicle:
                    vehicles.append(vehicle)
                else:
                    result.skipped_count += 1
            except Exception as e:
                result.add_error(f"Row {i+1}: {str(e)}")
        
        return vehicles
    
    def _get_mapped_value(
        self,
        row: Dict,
        mappings: Dict[str, FieldMapping],
        field: str,
        default: str = ""
    ) -> str:
        """Get value from row using mapping"""
        if field in mappings:
            source_field = mappings[field].source_field
            value = row.get(source_field, default)
            return str(value).strip() if value else default
        return default
    
    def _row_to_customer(
        self,
        row: Dict,
        mappings: Dict[str, FieldMapping],
        row_index: int
    ) -> Optional[Customer]:
        """Transform a row into a Customer"""
        
        # Handle name
        first_name = self._get_mapped_value(row, mappings, 'first_name')
        last_name = self._get_mapped_value(row, mappings, 'last_name')
        
        # If no first name, try full name
        if not first_name:
            full_name = self._get_mapped_value(row, mappings, 'full_name')
            if full_name:
                first_name, last_name = NameValidator.parse_full_name(full_name)
        
        if not first_name:
            return None  # Name is required
        
        # Validate and normalize name
        name_result = NameValidator.validate(first_name, last_name)
        if not name_result.is_valid:
            return None
        
        # Get and validate phone
        phone = self._get_mapped_value(row, mappings, 'phone')
        phone_result = PhoneValidator.validate(phone)
        
        if not phone_result.is_valid:
            return None  # Phone is required
        
        # Get and validate email
        email = self._get_mapped_value(row, mappings, 'email')
        email_result = EmailValidator.validate(email)
        
        # Build address
        address_result = AddressValidator.combine(
            street=self._get_mapped_value(row, mappings, 'address'),
            city=self._get_mapped_value(row, mappings, 'city'),
            state=self._get_mapped_value(row, mappings, 'state'),
            zip_code=self._get_mapped_value(row, mappings, 'zip')
        )
        
        # Get status
        status_raw = self._get_mapped_value(row, mappings, 'lead_status', 'new')
        lead_status = LeadStatus.from_string(status_raw)
        
        # Get original ID for deduplication
        source_row_id = self._get_mapped_value(row, mappings, 'source_row_id')
        
        return Customer(
            first_name=first_name.strip().title(),
            last_name=last_name.strip().title() if last_name else "",
            phone=phone_result.normalized_value or phone,
            email=email_result.normalized_value or "",
            address=address_result.normalized_value or "",
            vehicle_of_interest=self._get_mapped_value(row, mappings, 'vehicle_of_interest') or None,
            lead_status=lead_status,
            notes=self._get_mapped_value(row, mappings, 'notes'),
            current_vehicle=self._get_mapped_value(row, mappings, 'current_vehicle') or None,
            trade_in_info=self._get_mapped_value(row, mappings, 'trade_in_info') or None,
            source_row_id=source_row_id or None
        )
    
    def _row_to_vehicle(
        self,
        row: Dict,
        mappings: Dict[str, FieldMapping],
        row_index: int
    ) -> Optional[Vehicle]:
        """Transform a row into a Vehicle"""
        
        # Get required fields
        year_str = self._get_mapped_value(row, mappings, 'year')
        make = self._get_mapped_value(row, mappings, 'make')
        model = self._get_mapped_value(row, mappings, 'model')
        
        # Parse year
        try:
            year = int(''.join(filter(str.isdigit, year_str)))
            if year < 1900 or year > 2100:
                return None
        except (ValueError, TypeError):
            return None
        
        if not make or not model:
            return None
        
        # Get and validate VIN
        vin = self._get_mapped_value(row, mappings, 'vin')
        vin_result = VINValidator.validate(vin)
        
        # Parse price
        price = None
        price_str = self._get_mapped_value(row, mappings, 'price')
        if price_str:
            try:
                price = float(''.join(c for c in price_str if c.isdigit() or c == '.'))
            except ValueError:
                pass
        
        # Parse MSRP
        msrp = None
        msrp_str = self._get_mapped_value(row, mappings, 'msrp')
        if msrp_str:
            try:
                msrp = float(''.join(c for c in msrp_str if c.isdigit() or c == '.'))
            except ValueError:
                pass
        
        # Parse mileage
        mileage = None
        mileage_str = self._get_mapped_value(row, mappings, 'mileage')
        if mileage_str:
            try:
                mileage = int(''.join(filter(str.isdigit, mileage_str)))
            except ValueError:
                pass
        
        # Determine new/used
        is_new_str = self._get_mapped_value(row, mappings, 'is_new').lower()
        is_new = is_new_str in ['new', 'true', 'yes', '1', 'n']
        
        # Determine status
        status_str = self._get_mapped_value(row, mappings, 'status', 'available').lower()
        if 'sold' in status_str:
            status = VehicleStatus.SOLD
        elif 'pending' in status_str or 'hold' in status_str:
            status = VehicleStatus.PENDING
        elif 'reserved' in status_str:
            status = VehicleStatus.RESERVED
        elif 'transit' in status_str:
            status = VehicleStatus.IN_TRANSIT
        else:
            status = VehicleStatus.AVAILABLE
        
        return Vehicle(
            year=year,
            make=make.strip().title(),
            model=model.strip(),
            trim=self._get_mapped_value(row, mappings, 'trim'),
            vin=vin_result.normalized_value or "",
            stock_number=self._get_mapped_value(row, mappings, 'stock_number'),
            price=price,
            msrp=msrp,
            mileage=mileage,
            exterior_color=self._get_mapped_value(row, mappings, 'exterior_color'),
            interior_color=self._get_mapped_value(row, mappings, 'interior_color'),
            transmission=self._get_mapped_value(row, mappings, 'transmission'),
            engine=self._get_mapped_value(row, mappings, 'engine'),
            fuel_type=self._get_mapped_value(row, mappings, 'fuel_type'),
            body_style=self._get_mapped_value(row, mappings, 'body_style'),
            drivetrain=self._get_mapped_value(row, mappings, 'drivetrain'),
            status=status,
            is_new=is_new,
            image_url=self._get_mapped_value(row, mappings, 'image_url')
        )
