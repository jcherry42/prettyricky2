"""
Vehicle Routes
CRUD operations for vehicle inventory and VIN decoding
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import httpx

router = APIRouter()


class VehicleCreate(BaseModel):
    vin: str
    year: Optional[str] = ""
    make: Optional[str] = ""
    model: Optional[str] = ""
    trim: Optional[str] = ""
    body_class: Optional[str] = ""
    drive_type: Optional[str] = ""
    fuel_type: Optional[str] = ""
    engine: Optional[str] = ""
    transmission: Optional[str] = ""
    doors: Optional[str] = ""
    exterior_color: Optional[str] = ""
    interior_color: Optional[str] = ""
    mileage: Optional[int] = None
    price: Optional[float] = None
    category: str = "active_inventory"
    notes: str = ""


class VehicleUpdate(BaseModel):
    year: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    trim: Optional[str] = None
    body_class: Optional[str] = None
    drive_type: Optional[str] = None
    fuel_type: Optional[str] = None
    engine: Optional[str] = None
    transmission: Optional[str] = None
    doors: Optional[str] = None
    exterior_color: Optional[str] = None
    interior_color: Optional[str] = None
    mileage: Optional[int] = None
    price: Optional[float] = None
    category: Optional[str] = None
    notes: Optional[str] = None


# Repository will be injected from main server
vehicle_repo = None


def init_vehicle_routes(vehicle_repository):
    """Initialize routes with repository instance"""
    global vehicle_repo
    vehicle_repo = vehicle_repository


# NHTSA VIN decoder constants
VIN_DECODE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues"

# VIN validation
VIN_CHARS = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ"
VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
VIN_TRANSLITERATION = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
}


def validate_vin_checksum(vin: str) -> bool:
    """Validate VIN checksum (9th character)"""
    if len(vin) != 17:
        return False
    
    vin = vin.upper()
    
    for char in vin:
        if char not in VIN_CHARS:
            return False
    
    total = 0
    for i, char in enumerate(vin):
        value = VIN_TRANSLITERATION.get(char, 0)
        total += value * VIN_WEIGHTS[i]
    
    check_digit = total % 11
    expected = 'X' if check_digit == 10 else str(check_digit)
    
    return vin[8] == expected


@router.get("/inventory")
async def list_inventory(
    limit: int = 100,
    skip: int = 0,
    category: Optional[str] = None,
    make: Optional[str] = None,
    year: Optional[str] = None
):
    """List vehicle inventory with optional filtering"""
    filter_query = {}
    
    if category:
        filter_query["category"] = category
    if make:
        filter_query["make"] = {"$regex": make, "$options": "i"}
    if year:
        filter_query["year"] = year
    
    vehicles = await vehicle_repo.find_many(filter_query, limit=limit, skip=skip)
    total = await vehicle_repo.count(filter_query)
    
    return {
        "vehicles": vehicles,
        "total": total,
        "limit": limit,
        "skip": skip
    }


@router.post("/create")
async def create_vehicle(vehicle: VehicleCreate):
    """Create a new vehicle"""
    doc = vehicle.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = doc["created_at"]
    
    await vehicle_repo.insert_one(doc)
    return doc


@router.get("/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    """Get a vehicle by ID"""
    vehicle = await vehicle_repo.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.patch("/{vehicle_id}")
async def update_vehicle(vehicle_id: str, updates: VehicleUpdate):
    """Update a vehicle"""
    existing = await vehicle_repo.find_one({"id": vehicle_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await vehicle_repo.update_one({"id": vehicle_id}, {"$set": update_data})
    return {"success": True}


@router.delete("/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle"""
    existing = await vehicle_repo.find_one({"id": vehicle_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    await vehicle_repo.delete_one({"id": vehicle_id})
    return {"success": True}
