"""
Customer Routes
CRUD operations for customer management
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

router = APIRouter()


class CustomerCreate(BaseModel):
    first_name: str
    last_name: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    policy_number: Optional[str] = None
    vehicle_of_interest: Optional[str] = None
    trade_vehicle: Optional[Dict[str, Any]] = None
    lead_source: str = "manual"
    lead_status: str = "new"
    notes: str = ""


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    policy_number: Optional[str] = None
    vehicle_of_interest: Optional[str] = None
    trade_vehicle: Optional[Dict[str, Any]] = None
    lead_source: Optional[str] = None
    lead_status: Optional[str] = None
    notes: Optional[str] = None


class AddInteractionRequest(BaseModel):
    type: str
    content: str
    inquiry_type: Optional[str] = None


class AttachVehicleRequest(BaseModel):
    vehicle_id: str
    relationship: str = "interested"


# These will be injected from main server
customer_repo = None
vehicle_repo = None


def init_customer_routes(customer_repository, vehicle_repository):
    """Initialize routes with repository instances"""
    global customer_repo, vehicle_repo
    customer_repo = customer_repository
    vehicle_repo = vehicle_repository


@router.get("/list")
async def list_customers(
    limit: int = 50,
    skip: int = 0,
    source_id: Optional[str] = None,
    lead_status: Optional[str] = None,
    search: Optional[str] = None
):
    """List customers with optional filtering"""
    filter_query = {}
    
    if source_id:
        filter_query["source_id"] = source_id
    if lead_status:
        filter_query["lead_status"] = lead_status
    if search:
        filter_query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    customers = await customer_repo.find_many(filter_query, limit=limit, skip=skip)
    total = await customer_repo.count(filter_query)
    
    return {
        "customers": customers,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.post("/create")
async def create_customer(customer: CustomerCreate):
    """Create a new customer"""
    doc = customer.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = doc["created_at"]
    doc["interactions"] = []
    
    await customer_repo.insert_one(doc)
    return doc


@router.get("/{customer_id}")
async def get_customer(customer_id: str):
    """Get a customer by ID"""
    customer = await customer_repo.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/{customer_id}")
async def update_customer(customer_id: str, updates: CustomerUpdate):
    """Update a customer"""
    existing = await customer_repo.find_one({"id": customer_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await customer_repo.update_one({"id": customer_id}, {"$set": update_data})
    return {"success": True}


@router.delete("/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer"""
    existing = await customer_repo.find_one({"id": customer_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await customer_repo.delete_one({"id": customer_id})
    return {"success": True}


@router.post("/{customer_id}/interaction")
async def add_interaction(customer_id: str, interaction: AddInteractionRequest):
    """Add an interaction to a customer"""
    customer = await customer_repo.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    new_interaction = {
        "id": str(uuid.uuid4()),
        "type": interaction.type,
        "content": interaction.content,
        "inquiry_type": interaction.inquiry_type,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await customer_repo.update_one(
        {"id": customer_id},
        {
            "$push": {"interactions": new_interaction},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return new_interaction


@router.post("/{customer_id}/attach-vehicle")
async def attach_vehicle(customer_id: str, request: AttachVehicleRequest):
    """Attach a vehicle to a customer"""
    customer = await customer_repo.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    vehicle = await vehicle_repo.find_one({"id": request.vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    attachment = {
        "vehicle_id": request.vehicle_id,
        "relationship": request.relationship,
        "attached_at": datetime.now(timezone.utc).isoformat()
    }
    
    await customer_repo.update_one(
        {"id": customer_id},
        {
            "$push": {"attached_vehicles": attachment},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True, "attachment": attachment}


@router.delete("/{customer_id}/detach-vehicle/{vehicle_id}")
async def detach_vehicle(customer_id: str, vehicle_id: str):
    """Detach a vehicle from a customer"""
    customer = await customer_repo.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await customer_repo.update_one(
        {"id": customer_id},
        {
            "$pull": {"attached_vehicles": {"vehicle_id": vehicle_id}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    return {"success": True}
