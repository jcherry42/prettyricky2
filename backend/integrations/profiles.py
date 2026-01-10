"""
Integration Profile Management
Save, load, export/import CRM connection configurations
"""

import logging
import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import uuid

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


@dataclass
class IntegrationProfile:
    """A saved CRM connection profile"""
    id: str
    name: str
    description: str
    
    # Connection settings
    adapter_type: str  # vinsolutions, dealersocket, generic_rest, etc.
    base_url: str
    auth_method: str  # api_key, bearer_token, basic_auth, oauth2
    
    # Endpoints
    customers_endpoint: str
    vehicles_endpoint: str
    
    # Field mappings
    customer_mappings: Dict[str, str] = field(default_factory=dict)  # source -> target
    vehicle_mappings: Dict[str, str] = field(default_factory=dict)
    
    # Pagination settings
    pagination_type: str = "offset"  # offset, cursor, page
    page_size: int = 100
    limit_param: str = "limit"
    offset_param: str = "offset"
    page_param: str = "page"
    cursor_param: str = "cursor"
    records_path: str = "data"  # JSON path to records array
    
    # Metadata
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None
    is_public: bool = False  # Can others in dealership use this?
    use_count: int = 0  # How many times has this been used?
    
    # Tags for organization
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/export"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "adapter_type": self.adapter_type,
            "base_url": self.base_url,
            "auth_method": self.auth_method,
            "customers_endpoint": self.customers_endpoint,
            "vehicles_endpoint": self.vehicles_endpoint,
            "customer_mappings": self.customer_mappings,
            "vehicle_mappings": self.vehicle_mappings,
            "pagination_type": self.pagination_type,
            "page_size": self.page_size,
            "limit_param": self.limit_param,
            "offset_param": self.offset_param,
            "page_param": self.page_param,
            "cursor_param": self.cursor_param,
            "records_path": self.records_path,
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else self.created_at,
            "updated_at": self.updated_at.isoformat() if isinstance(self.updated_at, datetime) else self.updated_at,
            "created_by": self.created_by,
            "is_public": self.is_public,
            "use_count": self.use_count,
            "tags": self.tags,
        }
    
    def to_export_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON export (excludes sensitive/internal fields)"""
        return {
            "name": self.name,
            "description": self.description,
            "adapter_type": self.adapter_type,
            "base_url": self.base_url,
            "auth_method": self.auth_method,
            "customers_endpoint": self.customers_endpoint,
            "vehicles_endpoint": self.vehicles_endpoint,
            "customer_mappings": self.customer_mappings,
            "vehicle_mappings": self.vehicle_mappings,
            "pagination_type": self.pagination_type,
            "page_size": self.page_size,
            "limit_param": self.limit_param,
            "offset_param": self.offset_param,
            "page_param": self.page_param,
            "cursor_param": self.cursor_param,
            "records_path": self.records_path,
            "tags": self.tags,
            "_export_version": "1.0",
            "_exported_at": datetime.now(timezone.utc).isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "IntegrationProfile":
        """Create from dictionary"""
        # Handle datetime fields
        created_at = data.get("created_at")
        if isinstance(created_at, str):
            created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        elif created_at is None:
            created_at = datetime.now(timezone.utc)
            
        updated_at = data.get("updated_at")
        if isinstance(updated_at, str):
            updated_at = datetime.fromisoformat(updated_at.replace('Z', '+00:00'))
        elif updated_at is None:
            updated_at = datetime.now(timezone.utc)
        
        return cls(
            id=data.get("id", str(uuid.uuid4())),
            name=data.get("name", "Unnamed Profile"),
            description=data.get("description", ""),
            adapter_type=data.get("adapter_type", "generic_rest"),
            base_url=data.get("base_url", ""),
            auth_method=data.get("auth_method", "api_key"),
            customers_endpoint=data.get("customers_endpoint", "/customers"),
            vehicles_endpoint=data.get("vehicles_endpoint", "/vehicles"),
            customer_mappings=data.get("customer_mappings", {}),
            vehicle_mappings=data.get("vehicle_mappings", {}),
            pagination_type=data.get("pagination_type", "offset"),
            page_size=data.get("page_size", 100),
            limit_param=data.get("limit_param", "limit"),
            offset_param=data.get("offset_param", "offset"),
            page_param=data.get("page_param", "page"),
            cursor_param=data.get("cursor_param", "cursor"),
            records_path=data.get("records_path", "data"),
            created_at=created_at,
            updated_at=updated_at,
            created_by=data.get("created_by"),
            is_public=data.get("is_public", False),
            use_count=data.get("use_count", 0),
            tags=data.get("tags", []),
        )


class ProfileManager:
    """
    Manages integration profiles (save, load, export, import)
    """
    
    COLLECTION_NAME = "integration_profiles"
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.collection = db[self.COLLECTION_NAME]
    
    async def create_indexes(self):
        """Create database indexes"""
        await self.collection.create_index("name")
        await self.collection.create_index("adapter_type")
        await self.collection.create_index("is_public")
        await self.collection.create_index("tags")
        await self.collection.create_index([("use_count", -1)])
    
    # ==================== CRUD ====================
    
    async def create_profile(self, profile: IntegrationProfile) -> str:
        """Save a new profile"""
        doc = profile.to_dict()
        doc["_id"] = profile.id
        
        await self.collection.insert_one(doc)
        logger.info(f"Created profile: {profile.name} ({profile.id})")
        
        return profile.id
    
    async def get_profile(self, profile_id: str) -> Optional[IntegrationProfile]:
        """Get a profile by ID"""
        doc = await self.collection.find_one({"_id": profile_id})
        if not doc:
            return None
        
        doc["id"] = doc.pop("_id")
        return IntegrationProfile.from_dict(doc)
    
    async def get_profile_by_name(self, name: str) -> Optional[IntegrationProfile]:
        """Get a profile by name"""
        doc = await self.collection.find_one({"name": name})
        if not doc:
            return None
        
        doc["id"] = doc.pop("_id")
        return IntegrationProfile.from_dict(doc)
    
    async def list_profiles(
        self,
        adapter_type: Optional[str] = None,
        public_only: bool = False,
        tags: Optional[List[str]] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List profiles with filters"""
        query = {}
        
        if adapter_type:
            query["adapter_type"] = adapter_type
        if public_only:
            query["is_public"] = True
        if tags:
            query["tags"] = {"$in": tags}
        
        cursor = self.collection.find(query).sort("use_count", -1).limit(limit)
        
        profiles = []
        async for doc in cursor:
            doc["id"] = doc.pop("_id")
            profiles.append({
                "id": doc["id"],
                "name": doc["name"],
                "description": doc.get("description", ""),
                "adapter_type": doc["adapter_type"],
                "auth_method": doc.get("auth_method", "api_key"),
                "is_public": doc.get("is_public", False),
                "use_count": doc.get("use_count", 0),
                "tags": doc.get("tags", []),
                "created_at": doc.get("created_at"),
            })
        
        return profiles
    
    async def update_profile(self, profile_id: str, updates: Dict[str, Any]) -> bool:
        """Update a profile"""
        # Remove protected fields
        for key in ["_id", "id", "created_at"]:
            updates.pop(key, None)
        
        updates["updated_at"] = datetime.now(timezone.utc)
        
        result = await self.collection.update_one(
            {"_id": profile_id},
            {"$set": updates}
        )
        return result.modified_count > 0
    
    async def delete_profile(self, profile_id: str) -> bool:
        """Delete a profile"""
        result = await self.collection.delete_one({"_id": profile_id})
        return result.deleted_count > 0
    
    async def increment_use_count(self, profile_id: str) -> None:
        """Increment the use count when a profile is used"""
        await self.collection.update_one(
            {"_id": profile_id},
            {"$inc": {"use_count": 1}}
        )
    
    # ==================== EXPORT / IMPORT ====================
    
    async def export_profile(self, profile_id: str) -> Optional[str]:
        """Export a profile as JSON string"""
        profile = await self.get_profile(profile_id)
        if not profile:
            return None
        
        export_data = profile.to_export_dict()
        return json.dumps(export_data, indent=2)
    
    async def import_profile(
        self,
        json_data: str,
        override_name: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str]]:
        """
        Import a profile from JSON
        
        Args:
            json_data: JSON string of profile
            override_name: Optional name to use instead of the one in JSON
        
        Returns:
            (success, message, profile_id)
        """
        try:
            data = json.loads(json_data)
            
            # Validate required fields
            required = ["adapter_type", "customers_endpoint", "vehicles_endpoint"]
            missing = [f for f in required if not data.get(f)]
            if missing:
                return (False, f"Missing required fields: {', '.join(missing)}", None)
            
            # Generate new ID
            data["id"] = str(uuid.uuid4())
            
            # Override name if provided
            if override_name:
                data["name"] = override_name
            elif not data.get("name"):
                data["name"] = f"Imported Profile {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            
            # Check for duplicate name
            existing = await self.get_profile_by_name(data["name"])
            if existing:
                data["name"] = f"{data['name']} (copy)"
            
            # Create profile
            profile = IntegrationProfile.from_dict(data)
            profile_id = await self.create_profile(profile)
            
            return (True, f"Profile '{profile.name}' imported successfully", profile_id)
            
        except json.JSONDecodeError as e:
            return (False, f"Invalid JSON: {str(e)}", None)
        except Exception as e:
            logger.error(f"Profile import error: {e}")
            return (False, f"Import failed: {str(e)}", None)
    
    # ==================== BUILT-IN PROFILES ====================
    
    async def ensure_builtin_profiles(self):
        """Ensure built-in profiles exist for known CRMs"""
        builtin_profiles = [
            IntegrationProfile(
                id="builtin_vinsolutions",
                name="VinSolutions Standard",
                description="Standard configuration for VinSolutions Connect CRM",
                adapter_type="vinsolutions",
                base_url="https://api.vinsolutions.com/v1",
                auth_method="api_key",
                customers_endpoint="/leads",
                vehicles_endpoint="/inventory",
                customer_mappings={
                    "lead_id": "source_id",
                    "first_name": "first_name",
                    "last_name": "last_name",
                    "email_address": "email",
                    "phone_number": "phone",
                    "interested_vehicle": "vehicle_of_interest",
                    "lead_status": "status",
                },
                vehicle_mappings={
                    "vehicle_id": "source_id",
                    "model_year": "year",
                    "make": "make",
                    "model": "model",
                    "trim": "trim",
                    "asking_price": "price",
                    "stock_number": "stock_number",
                    "vin": "vin",
                },
                records_path="data",
                is_public=True,
                tags=["builtin", "crm", "vinsolutions"],
            ),
            IntegrationProfile(
                id="builtin_dealersocket",
                name="DealerSocket Standard",
                description="Standard configuration for DealerSocket CRM",
                adapter_type="dealersocket",
                base_url="https://api.dealersocket.com/api/v3",
                auth_method="oauth2",
                customers_endpoint="/crm/customers",
                vehicles_endpoint="/inventory/vehicles",
                customer_mappings={
                    "customerId": "source_id",
                    "firstName": "first_name",
                    "lastName": "last_name",
                    "emailAddress": "email",
                    "primaryPhone": "phone",
                    "vehicleInterest": "vehicle_of_interest",
                    "status": "status",
                },
                vehicle_mappings={
                    "vehicleId": "source_id",
                    "year": "year",
                    "make": "make",
                    "model": "model",
                    "trim": "trim",
                    "internetPrice": "price",
                    "stockNumber": "stock_number",
                    "vin": "vin",
                },
                records_path="results",
                is_public=True,
                tags=["builtin", "crm", "dealersocket"],
            ),
            IntegrationProfile(
                id="builtin_elead",
                name="elead CRM Standard",
                description="Standard configuration for elead CRM",
                adapter_type="elead",
                base_url="https://api.eleadcrm.com/v1",
                auth_method="api_key",
                customers_endpoint="/prospects",
                vehicles_endpoint="/vehicles",
                customer_mappings={
                    "prospect_id": "source_id",
                    "first_name": "first_name",
                    "last_name": "last_name",
                    "email": "email",
                    "phone": "phone",
                    "vehicle_of_interest": "vehicle_of_interest",
                    "status": "status",
                },
                vehicle_mappings={
                    "vehicle_id": "source_id",
                    "year": "year",
                    "make": "make",
                    "model": "model",
                    "trim": "trim",
                    "price": "price",
                    "stock_no": "stock_number",
                    "vin": "vin",
                },
                records_path="data",
                is_public=True,
                tags=["builtin", "crm", "elead"],
            ),
            IntegrationProfile(
                id="builtin_generic_rest",
                name="Generic REST API",
                description="Template for connecting to any REST API",
                adapter_type="generic_rest",
                base_url="https://api.example.com",
                auth_method="api_key",
                customers_endpoint="/customers",
                vehicles_endpoint="/vehicles",
                customer_mappings={},
                vehicle_mappings={},
                records_path="data",
                is_public=True,
                tags=["builtin", "generic", "rest"],
            ),
        ]
        
        for profile in builtin_profiles:
            existing = await self.get_profile(profile.id)
            if not existing:
                await self.create_profile(profile)
                logger.info(f"Created built-in profile: {profile.name}")


# Type alias for cleaner imports
from typing import Tuple
