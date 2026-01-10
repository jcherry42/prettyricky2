"""
elead CRM Adapter
CDK Global's elead CRM (formerly elead1one)

API Documentation: https://www.eleadcrm.com/
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from ..base import BaseAdapter, AdapterConfig, AdapterRegistry, FetchResult
from ..generic_rest import RestEndpointConfig

logger = logging.getLogger(__name__)


@AdapterRegistry.register("elead")
class EleadAdapter(BaseAdapter):
    """
    elead CRM Adapter
    
    Features:
    - Lead management & scoring
    - Customer database
    - Desking
    - F&I
    - Service scheduling
    
    Authentication: API Key with Dealer ID
    """
    
    ADAPTER_TYPE = "elead"
    ADAPTER_NAME = "elead CRM"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    API_BASE = "https://api.eleadcrm.com"
    
    DEFAULT_CUSTOMER_MAPPINGS = {
        # Identity
        "lead_id": "source_row_id",
        "customer_id": "source_row_id",
        "prospect_id": "source_row_id",
        
        # Name
        "first_name": "first_name",
        "last_name": "last_name",
        "name": "full_name",
        
        # Contact
        "primary_phone": "phone",
        "cell_phone": "phone",
        "home_phone": "phone",
        "work_phone": "phone",
        "email_address": "email",
        "email": "email",
        
        # Address
        "street_address": "address",
        "address_1": "address",
        "city": "city",
        "state": "state",
        "zip_code": "zip",
        "postal_code": "zip",
        
        # Sales
        "vehicle_interest": "vehicle_of_interest",
        "interested_vehicle": "vehicle_of_interest",
        "lead_status": "lead_status",
        "status": "lead_status",
        "lead_source": "source",
        "source_name": "source",
        
        # Trade
        "trade_vehicle": "current_vehicle",
        "current_vehicle": "current_vehicle",
        "trade_info": "trade_in_info",
        
        # Notes
        "notes": "notes",
        "comments": "notes",
        "lead_notes": "notes",
    }
    
    DEFAULT_VEHICLE_MAPPINGS = {
        # Identity
        "vehicle_id": "source_row_id",
        "stock_no": "stock_number",
        "stock_number": "stock_number",
        "vin_number": "vin",
        "vin": "vin",
        
        # Details
        "model_year": "year",
        "year": "year",
        "make": "make",
        "model": "model",
        "trim_level": "trim",
        "trim": "trim",
        "body_style": "body_style",
        
        # Pricing
        "selling_price": "price",
        "internet_price": "price",
        "price": "price",
        "msrp": "msrp",
        "sticker_price": "msrp",
        
        # Specs
        "mileage": "mileage",
        "odometer": "mileage",
        "exterior_color": "exterior_color",
        "ext_color": "exterior_color",
        "interior_color": "interior_color",
        "int_color": "interior_color",
        "transmission": "transmission",
        "trans": "transmission",
        "engine": "engine",
        "engine_type": "engine",
        "fuel_type": "fuel_type",
        "fuel": "fuel_type",
        "drive_type": "drivetrain",
        "drivetrain": "drivetrain",
        
        # Status
        "vehicle_status": "status",
        "status": "status",
        "new_used": "is_new",
        "is_new": "is_new",
        
        # Media
        "photo_url": "image_url",
        "primary_photo": "image_url",
        "image_url": "image_url",
    }
    
    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        
        self.customers_endpoint = RestEndpointConfig(
            path="/api/v1/leads",
            method="GET",
            records_path="data.leads",
            total_path="data.total",
            pagination_type="page",
            page_param="page",
            limit_param="per_page",
            since_param="updated_since",
            since_format="iso",
        )
        
        self.vehicles_endpoint = RestEndpointConfig(
            path="/api/v1/inventory",
            method="GET",
            records_path="data.vehicles",
            total_path="data.total",
            pagination_type="page",
            page_param="page",
            limit_param="per_page",
        )
    
    async def fetch_customers(self, since: Optional[datetime] = None) -> FetchResult:
        from ..generic_rest import GenericRestAdapter
        
        generic = GenericRestAdapter(
            self.config,
            customers_endpoint=self.customers_endpoint
        )
        generic.DEFAULT_CUSTOMER_MAPPINGS = self.DEFAULT_CUSTOMER_MAPPINGS
        
        return await generic.fetch_customers(since)
    
    async def fetch_vehicles(self, since: Optional[datetime] = None) -> FetchResult:
        from ..generic_rest import GenericRestAdapter
        
        generic = GenericRestAdapter(
            self.config,
            vehicles_endpoint=self.vehicles_endpoint
        )
        generic.DEFAULT_VEHICLE_MAPPINGS = self.DEFAULT_VEHICLE_MAPPINGS
        
        return await generic.fetch_vehicles(since)
    
    async def test_connection(self) -> Tuple[bool, str]:
        from ..generic_rest import GenericRestAdapter
        
        generic = GenericRestAdapter(
            self.config,
            customers_endpoint=self.customers_endpoint
        )
        
        return await generic.test_connection()
    
    @classmethod
    def get_setup_instructions(cls) -> Dict[str, Any]:
        return {
            "name": cls.ADAPTER_NAME,
            "description": "Connect to CDK Global's elead CRM",
            "authMethods": ["api_key"],
            "requiredFields": {
                "api_key": "elead API Key",
                "dealer_id": "Dealer ID",
            },
            "optionalFields": {
                "base_url": "API Base URL (default: https://api.eleadcrm.com)",
            },
            "documentationUrl": "https://www.eleadcrm.com/",
        }
