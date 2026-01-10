"""
CDK Global Adapter
CDK Drive / CDK Global DMS

API Documentation: https://developer.cdkglobal.com/
"""

import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from ..base import BaseAdapter, AdapterConfig, AdapterRegistry, FetchResult
from ..generic_rest import RestEndpointConfig

logger = logging.getLogger(__name__)


@AdapterRegistry.register("cdk")
class CDKAdapter(BaseAdapter):
    """
    CDK Global / CDK Drive Adapter
    
    Features:
    - DMS integration
    - Customer database
    - Inventory management
    - Deal management
    
    Authentication: OAuth 2.0
    """
    
    ADAPTER_TYPE = "cdk"
    ADAPTER_NAME = "CDK Global / CDK Drive"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    API_BASE = "https://api.cdkglobal.com"
    
    DEFAULT_CUSTOMER_MAPPINGS = {
        "customerId": "source_row_id",
        "id": "source_row_id",
        "firstName": "first_name",
        "lastName": "last_name",
        "phone": "phone",
        "mobilePhone": "phone",
        "email": "email",
        "address": "address",
        "city": "city",
        "state": "state",
        "zipCode": "zip",
        "vehicleInterest": "vehicle_of_interest",
        "status": "lead_status",
        "source": "source",
        "notes": "notes",
    }
    
    DEFAULT_VEHICLE_MAPPINGS = {
        "vehicleId": "source_row_id",
        "stockNumber": "stock_number",
        "vin": "vin",
        "year": "year",
        "make": "make",
        "model": "model",
        "trim": "trim",
        "price": "price",
        "msrp": "msrp",
        "mileage": "mileage",
        "exteriorColor": "exterior_color",
        "interiorColor": "interior_color",
        "transmission": "transmission",
        "engine": "engine",
        "status": "status",
        "isNew": "is_new",
        "imageUrl": "image_url",
    }
    
    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        
        self.customers_endpoint = RestEndpointConfig(
            path="/customer/v1/customers",
            method="GET",
            records_path="customers",
            total_path="totalRecords",
            pagination_type="offset",
            offset_param="offset",
            limit_param="limit",
            since_param="lastModified",
            since_format="iso",
        )
        
        self.vehicles_endpoint = RestEndpointConfig(
            path="/inventory/v1/vehicles",
            method="GET",
            records_path="vehicles",
            total_path="totalRecords",
            pagination_type="offset",
            offset_param="offset",
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
            "description": "Connect to CDK Global DMS",
            "authMethods": ["oauth2"],
            "requiredFields": {
                "client_id": "OAuth Client ID",
                "client_secret": "OAuth Client Secret",
                "dealer_id": "Dealer ID",
            },
            "documentationUrl": "https://developer.cdkglobal.com/",
        }
