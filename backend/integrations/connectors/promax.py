"""
ProMax Adapter
ProMax Unlimited CRM

API Documentation: https://www.promaxunlimited.com/
"""

import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from ..base import BaseAdapter, AdapterConfig, AdapterRegistry, FetchResult
from ..generic_rest import RestEndpointConfig

logger = logging.getLogger(__name__)


@AdapterRegistry.register("promax")
class ProMaxAdapter(BaseAdapter):
    """
    ProMax Unlimited CRM Adapter
    
    Features:
    - Lead management
    - Desking
    - F&I
    - CRM
    
    Authentication: API Key
    """
    
    ADAPTER_TYPE = "promax"
    ADAPTER_NAME = "ProMax Unlimited CRM"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    API_BASE = "https://api.promaxunlimited.com"
    
    DEFAULT_CUSTOMER_MAPPINGS = {
        "LeadID": "source_row_id",
        "CustomerID": "source_row_id",
        "FirstName": "first_name",
        "LastName": "last_name",
        "Phone": "phone",
        "Mobile": "phone",
        "Email": "email",
        "Address": "address",
        "City": "city",
        "State": "state",
        "Zip": "zip",
        "VehicleInterest": "vehicle_of_interest",
        "Status": "lead_status",
        "Source": "source",
        "Notes": "notes",
    }
    
    DEFAULT_VEHICLE_MAPPINGS = {
        "VehicleID": "source_row_id",
        "StockNo": "stock_number",
        "VIN": "vin",
        "Year": "year",
        "Make": "make",
        "Model": "model",
        "Trim": "trim",
        "Price": "price",
        "MSRP": "msrp",
        "Miles": "mileage",
        "ExtColor": "exterior_color",
        "IntColor": "interior_color",
        "Trans": "transmission",
        "Engine": "engine",
        "Status": "status",
        "Type": "is_new",
        "Image": "image_url",
    }
    
    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        
        self.customers_endpoint = RestEndpointConfig(
            path="/api/leads",
            method="GET",
            records_path="Leads",
            total_path="Total",
            pagination_type="page",
            page_param="page",
            limit_param="limit",
            since_param="since",
            since_format="epoch",
        )
        
        self.vehicles_endpoint = RestEndpointConfig(
            path="/api/inventory",
            method="GET",
            records_path="Vehicles",
            total_path="Total",
            pagination_type="page",
            page_param="page",
            limit_param="limit",
        )
    
    async def fetch_customers(self, since: Optional[datetime] = None) -> FetchResult:
        from ..generic_rest import GenericRestAdapter
        generic = GenericRestAdapter(self.config, customers_endpoint=self.customers_endpoint)
        generic.DEFAULT_CUSTOMER_MAPPINGS = self.DEFAULT_CUSTOMER_MAPPINGS
        return await generic.fetch_customers(since)
    
    async def fetch_vehicles(self, since: Optional[datetime] = None) -> FetchResult:
        from ..generic_rest import GenericRestAdapter
        generic = GenericRestAdapter(self.config, vehicles_endpoint=self.vehicles_endpoint)
        generic.DEFAULT_VEHICLE_MAPPINGS = self.DEFAULT_VEHICLE_MAPPINGS
        return await generic.fetch_vehicles(since)
    
    async def test_connection(self) -> Tuple[bool, str]:
        from ..generic_rest import GenericRestAdapter
        generic = GenericRestAdapter(self.config, customers_endpoint=self.customers_endpoint)
        return await generic.test_connection()
    
    @classmethod
    def get_setup_instructions(cls) -> Dict[str, Any]:
        return {
            "name": cls.ADAPTER_NAME,
            "description": "Connect to ProMax Unlimited CRM",
            "authMethods": ["api_key"],
            "requiredFields": {
                "api_key": "ProMax API Key",
                "dealer_id": "Dealer ID",
            },
            "documentationUrl": "https://www.promaxunlimited.com/",
        }
