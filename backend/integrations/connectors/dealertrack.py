"""
DealerTrack Adapter
Cox Automotive's DealerTrack DMS

API Documentation: https://developer.dealertrack.com/
"""

import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from ..base import BaseAdapter, AdapterConfig, AdapterRegistry, FetchResult
from ..generic_rest import RestEndpointConfig

logger = logging.getLogger(__name__)


@AdapterRegistry.register("dealertrack")
class DealerTrackAdapter(BaseAdapter):
    """
    DealerTrack DMS Adapter
    
    Features:
    - DMS integration
    - F&I
    - Credit applications
    - Inventory
    
    Authentication: OAuth 2.0
    """
    
    ADAPTER_TYPE = "dealertrack"
    ADAPTER_NAME = "DealerTrack DMS"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    API_BASE = "https://api.dealertrack.com"
    
    DEFAULT_CUSTOMER_MAPPINGS = {
        "CustomerID": "source_row_id",
        "ID": "source_row_id",
        "FirstName": "first_name",
        "LastName": "last_name",
        "PrimaryPhone": "phone",
        "CellPhone": "phone",
        "Email": "email",
        "Address": "address",
        "City": "city",
        "State": "state",
        "ZipCode": "zip",
        "VehicleOfInterest": "vehicle_of_interest",
        "LeadStatus": "lead_status",
        "LeadSource": "source",
        "Notes": "notes",
    }
    
    DEFAULT_VEHICLE_MAPPINGS = {
        "VehicleID": "source_row_id",
        "StockNumber": "stock_number",
        "VIN": "vin",
        "Year": "year",
        "Make": "make",
        "Model": "model",
        "Trim": "trim",
        "Price": "price",
        "MSRP": "msrp",
        "Mileage": "mileage",
        "ExteriorColor": "exterior_color",
        "InteriorColor": "interior_color",
        "Transmission": "transmission",
        "Engine": "engine",
        "Status": "status",
        "NewUsed": "is_new",
        "PhotoURL": "image_url",
    }
    
    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        
        self.customers_endpoint = RestEndpointConfig(
            path="/v1/customers",
            method="GET",
            records_path="Customers",
            total_path="TotalCount",
            pagination_type="page",
            page_param="Page",
            limit_param="PageSize",
            since_param="ModifiedSince",
            since_format="iso",
        )
        
        self.vehicles_endpoint = RestEndpointConfig(
            path="/v1/inventory",
            method="GET",
            records_path="Vehicles",
            total_path="TotalCount",
            pagination_type="page",
            page_param="Page",
            limit_param="PageSize",
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
            "description": "Connect to Cox Automotive's DealerTrack DMS",
            "authMethods": ["oauth2"],
            "requiredFields": {
                "client_id": "OAuth Client ID",
                "client_secret": "OAuth Client Secret",
                "dealer_id": "Dealer ID",
            },
            "documentationUrl": "https://developer.dealertrack.com/",
        }
