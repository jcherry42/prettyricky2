"""
DealerSocket CRM Adapter
Solera's DealerSocket CRM

API Documentation: https://dealersocket.com/api-documentation/
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime

from ..base import BaseAdapter, AdapterConfig, AdapterRegistry, FetchResult
from ..generic_rest import RestEndpointConfig

logger = logging.getLogger(__name__)


@AdapterRegistry.register("dealersocket")
class DealerSocketAdapter(BaseAdapter):
    """
    DealerSocket CRM Adapter
    
    Features:
    - Lead management
    - Customer database
    - Vehicle inventory
    - Desking & F&I
    
    Authentication: API Key or OAuth 2.0
    """
    
    ADAPTER_TYPE = "dealersocket"
    ADAPTER_NAME = "DealerSocket CRM"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    API_BASE = "https://api.dealersocket.com"
    
    DEFAULT_CUSTOMER_MAPPINGS = {
        # Identity
        "LeadId": "source_row_id",
        "CustomerId": "source_row_id",
        "Id": "source_row_id",
        
        # Name
        "FirstName": "first_name",
        "LastName": "last_name",
        "FullName": "full_name",
        
        # Contact
        "Phone": "phone",
        "CellPhone": "phone",
        "HomePhone": "phone",
        "WorkPhone": "phone",
        "Email": "email",
        "EmailAddress": "email",
        
        # Address
        "Address": "address",
        "Street": "address",
        "City": "city",
        "State": "state",
        "Zip": "zip",
        "ZipCode": "zip",
        
        # Sales
        "VehicleInterest": "vehicle_of_interest",
        "InterestedVehicle": "vehicle_of_interest",
        "Status": "lead_status",
        "LeadStatus": "lead_status",
        "Source": "source",
        "LeadSource": "source",
        
        # Trade
        "TradeIn": "current_vehicle",
        "CurrentVehicle": "current_vehicle",
        
        # Notes
        "Notes": "notes",
        "Comments": "notes",
    }
    
    DEFAULT_VEHICLE_MAPPINGS = {
        # Identity
        "VehicleId": "source_row_id",
        "StockNo": "stock_number",
        "StockNumber": "stock_number",
        "VIN": "vin",
        
        # Details
        "Year": "year",
        "Make": "make",
        "Model": "model",
        "Trim": "trim",
        "Style": "body_style",
        
        # Pricing
        "Price": "price",
        "SellingPrice": "price",
        "InternetPrice": "price",
        "MSRP": "msrp",
        
        # Specs
        "Mileage": "mileage",
        "Miles": "mileage",
        "ExteriorColor": "exterior_color",
        "ExtColor": "exterior_color",
        "InteriorColor": "interior_color",
        "IntColor": "interior_color",
        "Transmission": "transmission",
        "Engine": "engine",
        "FuelType": "fuel_type",
        "DriveTrain": "drivetrain",
        
        # Status
        "Status": "status",
        "New": "is_new",
        "IsNew": "is_new",
        
        # Media
        "ImageURL": "image_url",
        "PhotoURL": "image_url",
    }
    
    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        
        self.customers_endpoint = RestEndpointConfig(
            path="/api/v2/leads",
            method="GET",
            records_path="Leads",
            total_path="TotalCount",
            pagination_type="page",
            page_param="page",
            limit_param="pageSize",
            since_param="modifiedAfter",
            since_format="iso",
        )
        
        self.vehicles_endpoint = RestEndpointConfig(
            path="/api/v2/inventory",
            method="GET",
            records_path="Vehicles",
            total_path="TotalCount",
            pagination_type="page",
            page_param="page",
            limit_param="pageSize",
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
            "description": "Connect to Solera's DealerSocket CRM",
            "authMethods": ["api_key", "oauth2"],
            "requiredFields": {
                "api_key": "DealerSocket API Key",
                "dealer_id": "Dealer ID",
            },
            "optionalFields": {
                "base_url": "API Base URL",
            },
            "documentationUrl": "https://dealersocket.com/api-documentation/",
        }
