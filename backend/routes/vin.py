"""
VIN Decoder Routes
Vehicle Identification Number decoding and inventory management
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid
import httpx

router = APIRouter()


class VINDecodeResponse(BaseModel):
    success: bool
    vin: str
    vehicle_info: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class SaveVINRequest(BaseModel):
    vin: str
    mileage: Optional[int] = None
    category: str = "active_inventory"
    notes: str = ""


# Repository will be injected
vehicle_repo = None


def init_vin_routes(vehicle_repository):
    global vehicle_repo
    vehicle_repo = vehicle_repository


# NHTSA API for VIN decoding
NHTSA_API_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues"

# VIN validation
VIN_CHARS = "0123456789ABCDEFGHJKLMNPRSTUVWXYZ"
VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
VIN_TRANSLITERATION = {
    'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
    'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
    'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
}


def validate_vin_format(vin: str) -> dict:
    """Validate VIN format and checksum"""
    vin = vin.upper().strip()
    
    if len(vin) != 17:
        return {"valid": False, "error": "VIN must be 17 characters"}
    
    for char in vin:
        if char not in VIN_CHARS:
            return {"valid": False, "error": f"Invalid character: {char}"}
    
    # Validate checksum
    total = 0
    for i, char in enumerate(vin):
        value = VIN_TRANSLITERATION.get(char, 0)
        total += value * VIN_WEIGHTS[i]
    
    check_digit = total % 11
    expected = 'X' if check_digit == 10 else str(check_digit)
    
    if vin[8] != expected:
        return {"valid": True, "warning": "Checksum mismatch - VIN may be invalid"}
    
    return {"valid": True}


@router.get("/decode/{vin}", response_model=VINDecodeResponse)
async def decode_vin(vin: str):
    """Decode a VIN using NHTSA API"""
    vin = vin.upper().strip()
    
    # Validate format
    validation = validate_vin_format(vin)
    if not validation.get("valid"):
        return VINDecodeResponse(
            success=False,
            vin=vin,
            error=validation.get("error", "Invalid VIN")
        )
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NHTSA_API_URL}/{vin}",
                params={"format": "json"},
                timeout=10.0
            )
            
            if response.status_code != 200:
                return VINDecodeResponse(
                    success=False,
                    vin=vin,
                    error="NHTSA API unavailable"
                )
            
            data = response.json()
            results = data.get("Results", [{}])[0]
            
            # Extract relevant fields
            vehicle_info = {
                "year": results.get("ModelYear", ""),
                "make": results.get("Make", ""),
                "model": results.get("Model", ""),
                "trim": results.get("Trim", ""),
                "body_class": results.get("BodyClass", ""),
                "drive_type": results.get("DriveType", ""),
                "fuel_type": results.get("FuelTypePrimary", ""),
                "engine": f"{results.get('DisplacementL', '')}L {results.get('EngineCylinders', '')}cyl",
                "transmission": results.get("TransmissionStyle", ""),
                "doors": results.get("Doors", ""),
                "plant_city": results.get("PlantCity", ""),
                "plant_country": results.get("PlantCountry", ""),
            }
            
            # Clean up empty values
            vehicle_info = {k: v for k, v in vehicle_info.items() if v and v != "L cyl"}
            
            return VINDecodeResponse(
                success=True,
                vin=vin,
                vehicle_info=vehicle_info
            )
            
    except Exception as e:
        return VINDecodeResponse(
            success=False,
            vin=vin,
            error=str(e)
        )


@router.post("/save")
async def save_vin_to_inventory(request: SaveVINRequest):
    """Decode VIN and save to vehicle inventory"""
    # First decode the VIN
    decode_result = await decode_vin(request.vin)
    
    if not decode_result.success:
        raise HTTPException(status_code=400, detail=decode_result.error)
    
    # Create vehicle document
    vehicle_doc = {
        "id": str(uuid.uuid4()),
        "vin": request.vin,
        "mileage": request.mileage,
        "category": request.category,
        "notes": request.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        **decode_result.vehicle_info
    }
    
    await vehicle_repo.insert_one(vehicle_doc)
    
    return {
        "success": True,
        "vehicle": vehicle_doc
    }


@router.post("/save-to-inventory")
async def save_decoded_vin_to_inventory(
    vin: str,
    year: str = "",
    make: str = "",
    model: str = "",
    trim: str = "",
    body_class: str = "",
    drive_type: str = "",
    fuel_type: str = "",
    engine: str = "",
    transmission: str = "",
    doors: str = "",
    mileage: Optional[int] = None,
    category: str = "active_inventory",
    notes: str = ""
):
    """Save already-decoded VIN data to inventory"""
    vehicle_doc = {
        "id": str(uuid.uuid4()),
        "vin": vin.upper().strip(),
        "year": year,
        "make": make,
        "model": model,
        "trim": trim,
        "body_class": body_class,
        "drive_type": drive_type,
        "fuel_type": fuel_type,
        "engine": engine,
        "transmission": transmission,
        "doors": doors,
        "mileage": mileage,
        "category": category,
        "notes": notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await vehicle_repo.insert_one(vehicle_doc)
    
    return {
        "success": True,
        "vehicle": vehicle_doc
    }
