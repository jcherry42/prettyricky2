"""
VinSolutions CRM Adapter
Cox Automotive's VinSolutions Connect CRM

API Documentation: https://developer.coxautoinc.com/
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone

from ..base import BaseAdapter, AdapterConfig, AdapterRegistry, FetchResult, AuthMethod
from ..generic_rest import RestEndpointConfig

logger = logging.getLogger(__name__)


@AdapterRegistry.register("vinsolutions")
class VinSolutionsAdapter(BaseAdapter):
    """
    VinSolutions Connect CRM Adapter
    
    Features:
    - Customer/Lead management
    - Vehicle inventory
    - Deal tracking
    - Activity/Task management
    
    Authentication: OAuth 2.0 or API Key
    API Base: https://api.vinsolutions.com/
    """
    
    ADAPTER_TYPE = "vinsolutions"
    ADAPTER_NAME = "VinSolutions Connect CRM"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    # VinSolutions API endpoints
    API_BASE = "https://api.vinsolutions.com"
    
    # Default field mappings: VinSolutions -> Canonical
    DEFAULT_CUSTOMER_MAPPINGS = {
        # Identity
        "customerId": "source_row_id",
        "id": "source_row_id",
        
        # Name
        "firstName": "first_name",
        "lastName": "last_name",
        "fullName": "full_name",
        
        # Contact
        "primaryPhone": "phone",
        "cellPhone": "phone",
        "homePhone": "phone",
        "workPhone": "phone",
        "email": "email",
        "emailAddress": "email",
        
        # Address
        "address1": "address",
        "address": "address",
        "city": "city",
        "state": "state",
        "zipCode": "zip",
        "postalCode": "zip",
        
        # Sales
        "vehicleOfInterest": "vehicle_of_interest",
        "desiredVehicle": "vehicle_of_interest",
        "leadStatus": "lead_status",
        "status": "lead_status",
        "leadSource": "source",
        
        # Trade
        "tradeVehicle": "current_vehicle",
        "currentVehicle": "current_vehicle",
        "tradeYear": "trade_year",
        "tradeMake": "trade_make",
        "tradeModel": "trade_model",
        
        # Notes
        "notes": "notes",
        "comments": "notes",
    }
    
    DEFAULT_VEHICLE_MAPPINGS = {
        # Identity
        "vehicleId": "source_row_id",
        "stockNumber": "stock_number",
        "vin": "vin",
        
        # Details
        "year": "year",
        "make": "make",
        "model": "model",
        "trim": "trim",
        "bodyStyle": "body_style",
        
        # Pricing
        "internetPrice": "price",
        "sellingPrice": "price",
        "msrp": "msrp",
        
        # Specs
        "mileage": "mileage",
        "odometer": "mileage",
        "exteriorColor": "exterior_color",
        "interiorColor": "interior_color",
        "transmission": "transmission",
        "engine": "engine",
        "fuelType": "fuel_type",
        "drivetrain": "drivetrain",
        
        # Status
        "status": "status",
        "isNew": "is_new",
        "condition": "is_new",
        
        # Media
        "photoUrl": "image_url",
        "primaryImage": "image_url",
    }
    
    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        
        # VinSolutions-specific endpoints
        self.customers_endpoint = RestEndpointConfig(
            path="/crm/v1/customers",
            method="GET",
            records_path="customers",
            total_path="totalCount",
            pagination_type="offset",
            offset_param="offset",
            limit_param="limit",
            since_param="modifiedSince",
            since_format="iso",
        )
        
        self.vehicles_endpoint = RestEndpointConfig(
            path="/inventory/v1/vehicles",
            method="GET",
            records_path="vehicles",
            total_path="totalCount",
            pagination_type="offset",
            offset_param="offset",
            limit_param="limit",
        )
    
    async def fetch_customers(self, since: Optional[datetime] = None) -> FetchResult:
        """Fetch customers/leads from VinSolutions"""
        from ..generic_rest import GenericRestAdapter
        
        # Use generic adapter with VinSolutions config
        generic = GenericRestAdapter(
            self.config,
            customers_endpoint=self.customers_endpoint
        )
        generic.DEFAULT_CUSTOMER_MAPPINGS = self.DEFAULT_CUSTOMER_MAPPINGS
        
        return await generic.fetch_customers(since)
    
    async def fetch_vehicles(self, since: Optional[datetime] = None) -> FetchResult:
        """Fetch vehicle inventory from VinSolutions"""
        from ..generic_rest import GenericRestAdapter
        
        generic = GenericRestAdapter(
            self.config,
            vehicles_endpoint=self.vehicles_endpoint
        )
        generic.DEFAULT_VEHICLE_MAPPINGS = self.DEFAULT_VEHICLE_MAPPINGS
        
        return await generic.fetch_vehicles(since)
    
    async def test_connection(self) -> Tuple[bool, str]:
        """Test connection to VinSolutions API"""
        from ..generic_rest import GenericRestAdapter
        
        generic = GenericRestAdapter(
            self.config,
            customers_endpoint=self.customers_endpoint
        )
        
        return await generic.test_connection()
    
    @classmethod
    def get_setup_instructions(cls) -> Dict[str, Any]:
        """Get setup instructions for VinSolutions"""
        return {
            "name": cls.ADAPTER_NAME,
            "description": "Connect to Cox Automotive's VinSolutions CRM",
            "authMethods": ["oauth2", "api_key"],
            "requiredFields": {
                "api_key": "VinSolutions API Key",
                "dealer_id": "Dealer ID (provided by VinSolutions)",
            },
            "optionalFields": {
                "base_url": "API Base URL (default: https://api.vinsolutions.com)",
            },
            "documentationUrl": "https://developer.coxautoinc.com/",
            "supportEmail": "vinsolutions-support@coxautoinc.com",
        }
