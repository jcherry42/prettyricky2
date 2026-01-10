"""
Reynolds & Reynolds Adapter
Reynolds & Reynolds ERA-IGNITE / docuPAD

API Documentation: Contact Reynolds & Reynolds for API access
"""

import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

from ..base import BaseAdapter, AdapterConfig, AdapterRegistry, FetchResult
from ..generic_rest import RestEndpointConfig

logger = logging.getLogger(__name__)


@AdapterRegistry.register("reynolds")
class ReynoldsAdapter(BaseAdapter):
    """
    Reynolds & Reynolds Adapter
    
    Features:
    - ERA-IGNITE DMS
    - Customer records
    - Inventory management
    - Deal documentation
    
    Authentication: API Key with Dealer credentials
    """
    
    ADAPTER_TYPE = "reynolds"
    ADAPTER_NAME = "Reynolds & Reynolds ERA-IGNITE"
    SUPPORTED_DATA_TYPES = ["customers", "vehicles"]
    
    API_BASE = "https://api.reyrey.com"
    
    DEFAULT_CUSTOMER_MAPPINGS = {
        "customer_number": "source_row_id",
        "cust_id": "source_row_id",
        "first_name": "first_name",
        "last_name": "last_name",
        "phone_number": "phone",
        "cell_number": "phone",
        "email_addr": "email",
        "street_addr": "address",
        "city": "city",
        "state": "state",
        "zip": "zip",
        "vehicle_interest": "vehicle_of_interest",
        "cust_status": "lead_status",
        "lead_src": "source",
        "cust_notes": "notes",
    }
    
    DEFAULT_VEHICLE_MAPPINGS = {
        "veh_id": "source_row_id",
        "stock_num": "stock_number",
        "vin_num": "vin",
        "model_yr": "year",
        "make": "make",
        "model": "model",
        "trim_desc": "trim",
        "sell_price": "price",
        "msrp_amt": "msrp",
        "odometer": "mileage",
        "ext_color": "exterior_color",
        "int_color": "interior_color",
        "trans_type": "transmission",
        "engine_desc": "engine",
        "veh_status": "status",
        "new_used_flag": "is_new",
        "photo_link": "image_url",
    }
    
    def __init__(self, config: AdapterConfig):
        super().__init__(config)
        
        self.customers_endpoint = RestEndpointConfig(
            path="/api/crm/customers",
            method="GET",
            records_path="data",
            total_path="total",
            pagination_type="offset",
            offset_param="skip",
            limit_param="take",
            since_param="modifiedAfter",
            since_format="iso",
        )
        
        self.vehicles_endpoint = RestEndpointConfig(
            path="/api/inventory/vehicles",
            method="GET",
            records_path="data",
            total_path="total",
            pagination_type="offset",
            offset_param="skip",
            limit_param="take",
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
            "description": "Connect to Reynolds & Reynolds ERA-IGNITE DMS",
            "authMethods": ["api_key"],
            "requiredFields": {
                "api_key": "Reynolds API Key",
                "dealer_code": "Dealer Code",
            },
            "documentationUrl": "https://www.rfreps.com/",
            "notes": "Contact your Reynolds & Reynolds representative for API access",
        }
