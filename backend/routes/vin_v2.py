"""\
VIN Routes (Refactored v2)

Goal:
- Match the current production VIN API contract in backend/server.py exactly.

Endpoints:
- GET  /vin/decode/{vin}
- POST /vin/save
- POST /vin/save-to-inventory
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import uuid
import httpx

router = APIRouter()

_db = None


def init_vin_routes(db):
    global _db
    _db = db


# ----- Request models (match server.py usage) -----

class VinSaveRequest(BaseModel):
    vin: str
    vehicle_data: Dict[str, Any]


class VinSaveWithCategoryRequest(BaseModel):
    vin: str
    vehicle_data: Dict[str, Any]
    category: str = "active_inventory"  # "active_inventory" or "trade_in"
    customer_id: Optional[str] = None
    trade_in_value: Optional[float] = None
    condition: Optional[str] = None


# ----- Helpers (copied from server.py to keep behavior identical) -----

VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
VIN_TRANSLITERATION = {
    **{str(i): i for i in range(10)},
    "A": 1,
    "B": 2,
    "C": 3,
    "D": 4,
    "E": 5,
    "F": 6,
    "G": 7,
    "H": 8,
    "J": 1,
    "K": 2,
    "L": 3,
    "M": 4,
    "N": 5,
    "P": 7,
    "R": 9,
    "S": 2,
    "T": 3,
    "U": 4,
    "V": 5,
    "W": 6,
    "X": 7,
    "Y": 8,
    "Z": 9,
}


def validate_vin_checksum(vin: str) -> bool:
    """ISO 3779 VIN checksum validation."""
    try:
        vin = vin.upper().strip()
        total = 0
        for i, char in enumerate(vin):
            value = VIN_TRANSLITERATION.get(char, 0)
            total += value * VIN_WEIGHTS[i]

        check_digit = total % 11
        expected = "X" if check_digit == 10 else str(check_digit)
        return vin[8] == expected
    except Exception:
        return False


def decode_wmi(vin: str) -> Dict[str, str]:
    wmi = vin[:3].upper()

    wmi_database = {
        # USA
        "1G1": {"country": "USA", "manufacturer": "Chevrolet"},
        "1C4": {"country": "USA", "manufacturer": "Chrysler"},
        "1F": {"country": "USA", "manufacturer": "Ford"},
        "1FA": {"country": "USA", "manufacturer": "Ford"},
        "1FM": {"country": "USA", "manufacturer": "Ford"},
        "1FT": {"country": "USA", "manufacturer": "Ford"},
        "1GC": {"country": "USA", "manufacturer": "Chevrolet"},
        "1GN": {"country": "USA", "manufacturer": "Chevrolet"},
        "1HG": {"country": "USA", "manufacturer": "Honda (US)"},
        "1J4": {"country": "USA", "manufacturer": "Jeep"},
        "1ME": {"country": "USA", "manufacturer": "Mercury"},
        "1N": {"country": "USA", "manufacturer": "Nissan (US)"},
        "1VW": {"country": "USA", "manufacturer": "Volkswagen (US)"},
        "2G": {"country": "Canada", "manufacturer": "GM Canada"},
        "2HG": {"country": "Canada", "manufacturer": "Honda Canada"},
        "3G": {"country": "Mexico", "manufacturer": "GM Mexico"},
        "3HG": {"country": "Mexico", "manufacturer": "Honda Mexico"},
        "3VW": {"country": "Mexico", "manufacturer": "Volkswagen Mexico"},
        # Japanese
        "JH4": {"country": "Japan", "manufacturer": "Acura"},
        "JHM": {"country": "Japan", "manufacturer": "Honda"},
        "JN1": {"country": "Japan", "manufacturer": "Nissan"},
        "JN8": {"country": "Japan", "manufacturer": "Nissan"},
        "JT2": {"country": "Japan", "manufacturer": "Toyota"},
        "JT3": {"country": "Japan", "manufacturer": "Toyota"},
        "JTD": {"country": "Japan", "manufacturer": "Toyota"},
        "JTH": {"country": "Japan", "manufacturer": "Lexus"},
        "JTJ": {"country": "Japan", "manufacturer": "Lexus"},
        "JM1": {"country": "Japan", "manufacturer": "Mazda"},
        "JM3": {"country": "Japan", "manufacturer": "Mazda"},
        "JF1": {"country": "Japan", "manufacturer": "Subaru"},
        "JF2": {"country": "Japan", "manufacturer": "Subaru"},
        # Korean
        "KM8": {"country": "South Korea", "manufacturer": "Hyundai"},
        "KMH": {"country": "South Korea", "manufacturer": "Hyundai"},
        "5NP": {"country": "USA", "manufacturer": "Hyundai (US)"},
        "KNA": {"country": "South Korea", "manufacturer": "Kia"},
        "KND": {"country": "South Korea", "manufacturer": "Kia"},
        # German
        "WVW": {"country": "Germany", "manufacturer": "Volkswagen"},
        "WV2": {"country": "Germany", "manufacturer": "Volkswagen"},
        "WAU": {"country": "Germany", "manufacturer": "Audi"},
        "WBA": {"country": "Germany", "manufacturer": "BMW"},
        "WBS": {"country": "Germany", "manufacturer": "BMW M"},
        "WBY": {"country": "Germany", "manufacturer": "BMW"},
        "WDB": {"country": "Germany", "manufacturer": "Mercedes-Benz"},
        "WDC": {"country": "Germany", "manufacturer": "Mercedes-Benz"},
        "WDD": {"country": "Germany", "manufacturer": "Mercedes-Benz"},
        "WP0": {"country": "Germany", "manufacturer": "Porsche"},
        "WP1": {"country": "Germany", "manufacturer": "Porsche"},
        # British
        "SAL": {"country": "UK", "manufacturer": "Land Rover"},
        "SAD": {"country": "UK", "manufacturer": "Jaguar"},
        "SAJ": {"country": "UK", "manufacturer": "Jaguar"},
        # Italian
        "ZFF": {"country": "Italy", "manufacturer": "Ferrari"},
        "ZAM": {"country": "Italy", "manufacturer": "Maserati"},
        "ZAR": {"country": "Italy", "manufacturer": "Alfa Romeo"},
        # Tesla
        "5YJ": {"country": "USA", "manufacturer": "Tesla"},
        # Rivian
        "7PD": {"country": "USA", "manufacturer": "Rivian"},
    }

    if wmi in wmi_database:
        return wmi_database[wmi]
    elif wmi[:2] + wmi[2] in wmi_database:
        return wmi_database.get(wmi[:2] + wmi[2], {})

    country_codes = {
        "1": "USA",
        "4": "USA",
        "5": "USA",
        "2": "Canada",
        "3": "Mexico",
        "J": "Japan",
        "K": "South Korea",
        "L": "China",
        "S": "UK",
        "V": "France/Spain",
        "W": "Germany",
        "Y": "Sweden/Finland",
        "Z": "Italy",
        "9": "Brazil",
    }

    return {"country": country_codes.get(vin[0], "Unknown"), "manufacturer": "Unknown"}


@router.get("/vin/decode/{vin}")
async def decode_vin(vin: str):
    """Decode VIN using multiple sources for cross-reference accuracy."""
    vin = vin.upper().strip()

    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="VIN must be exactly 17 characters")

    if any(c in vin for c in ["I", "O", "Q"]):
        raise HTTPException(status_code=400, detail="VIN contains invalid characters (I, O, Q are not allowed)")

    valid_chars = set("ABCDEFGHJKLMNPRSTUVWXYZ0123456789")
    if not all(c in valid_chars for c in vin):
        raise HTTPException(status_code=400, detail="VIN contains invalid characters")

    validation_results = {
        "checksum_valid": validate_vin_checksum(vin),
        "wmi_data": decode_wmi(vin),
        "sources_checked": ["NHTSA vPIC", "WMI Database", "ISO 3779 Checksum"],
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
            response = await http_client.get(url)
            response.raise_for_status()
            data = response.json()

        results = data.get("Results", [])
        if not results:
            raise HTTPException(status_code=404, detail="No vehicle data found for this VIN")

        raw_data: Dict[str, str] = {}
        for item in results:
            var_name = item.get("Variable", "")
            value = item.get("Value")
            if value and str(value).strip() and str(value).strip().lower() not in ["not applicable", "n/a", "-"]:
                raw_data[var_name] = str(value).strip()

        vehicle: Dict[str, Any] = {
            "vin": vin,
            "year": raw_data.get("Model Year"),
            "make": raw_data.get("Make"),
            "model": raw_data.get("Model"),
            "trim": raw_data.get("Trim") or raw_data.get("Series"),
            "manufacturer": raw_data.get("Manufacturer Name"),
            "plant_country": raw_data.get("Plant Country"),
            "plant_city": raw_data.get("Plant City"),
            "plant_state": raw_data.get("Plant State"),
            "vehicle_type": raw_data.get("Vehicle Type"),
            "body_class": raw_data.get("Body Class"),
            "doors": raw_data.get("Doors"),
            "drive_type": raw_data.get("Drive Type"),
            "steering": raw_data.get("Steering Location"),
            "fuel_type": raw_data.get("Fuel Type - Primary"),
            "electrification": raw_data.get("Electrification Level"),
            "cylinders": raw_data.get("Engine Number of Cylinders"),
            "displacement": raw_data.get("Displacement (L)"),
            "engine_model": raw_data.get("Engine Model"),
            "engine_config": raw_data.get("Engine Configuration"),
            "horsepower": raw_data.get("Engine Brake (hp) From"),
            "other_engine_info": raw_data.get("Other Engine Info"),
            "transmission": raw_data.get("Transmission Style"),
            "transmission_speeds": raw_data.get("Transmission Speeds"),
            "airbags_front": raw_data.get("Front Air Bag Locations"),
            "airbags_side": raw_data.get("Side Air Bag Locations"),
            "airbags_knee": raw_data.get("Knee Air Bag Locations"),
            "airbags_curtain": raw_data.get("Curtain Air Bag Locations"),
            "seat_belts": raw_data.get("Seat Belt Type"),
            "abs": raw_data.get("Anti-lock Braking System (ABS)"),
            "esc": raw_data.get("Electronic Stability Control (ESC)"),
            "traction_control": raw_data.get("Traction Control"),
            "tpms": raw_data.get("Tire Pressure Monitoring System (TPMS) Type"),
            "backup_camera": raw_data.get("Backup Camera"),
            "blind_spot": raw_data.get("Blind Spot Warning (BSW)"),
            "lane_departure": raw_data.get("Lane Departure Warning (LDW)"),
            "forward_collision": raw_data.get("Forward Collision Warning (FCW)"),
            "auto_emergency_braking": raw_data.get("Automatic Emergency Braking (AEB)"),
            "gvwr": raw_data.get("Gross Vehicle Weight Rating From"),
            "curb_weight": raw_data.get("Curb Weight (lb)"),
            "wheelbase": raw_data.get("Wheelbase (inches)"),
            "bed_length": raw_data.get("Bed Length (inches)"),
            "bed_type": raw_data.get("Bed Type"),
            "series": raw_data.get("Series"),
            "series2": raw_data.get("Series2"),
            "base_price": raw_data.get("Base Price ($)"),
        }

        vehicle = {k: v for k, v in vehicle.items() if v is not None}

        wmi_info = validation_results["wmi_data"]
        if wmi_info.get("manufacturer") != "Unknown":
            nhtsa_make = vehicle.get("make", "").upper()
            wmi_make = wmi_info.get("manufacturer", "").upper()
            if wmi_make in nhtsa_make or nhtsa_make in wmi_make:
                validation_results["manufacturer_verified"] = True
            else:
                validation_results["manufacturer_verified"] = False
                validation_results["wmi_manufacturer"] = wmi_info["manufacturer"]

        engine_parts = []
        if vehicle.get("displacement"):
            engine_parts.append(f"{vehicle['displacement']}L")
        if vehicle.get("cylinders"):
            cyl = int(vehicle["cylinders"])
            if cyl >= 6:
                engine_parts.append(f"V{cyl}")
            elif cyl == 4:
                engine_parts.append("4-Cylinder")
            else:
                engine_parts.append(f"{cyl}-Cylinder")
        if vehicle.get("engine_config") and "engine_config" not in str(engine_parts):
            engine_parts.append(vehicle["engine_config"])
        if engine_parts:
            vehicle["engine_display"] = " ".join(engine_parts)
        elif vehicle.get("other_engine_info"):
            vehicle["engine_display"] = vehicle["other_engine_info"]
        elif vehicle.get("electrification"):
            vehicle["engine_display"] = vehicle["electrification"]

        loc_parts = []
        if vehicle.get("plant_city"):
            loc_parts.append(vehicle["plant_city"])
        if vehicle.get("plant_state"):
            loc_parts.append(vehicle["plant_state"])
        if vehicle.get("plant_country"):
            country = vehicle["plant_country"]
            if "UNITED STATES" in country.upper():
                country = "USA"
            elif "(" in country:
                country = country.split("(")[1].replace(")", "").strip()
            loc_parts.append(country)
        if loc_parts:
            vehicle["assembly_location"] = ", ".join(loc_parts)

        safety_features = []
        if vehicle.get("airbags_front"):
            safety_features.append("Front Airbags")
        if vehicle.get("airbags_side"):
            safety_features.append("Side Airbags")
        if vehicle.get("airbags_knee"):
            safety_features.append("Knee Airbags")
        if vehicle.get("airbags_curtain"):
            safety_features.append("Curtain Airbags")
        if vehicle.get("abs"):
            safety_features.append("ABS")
        if vehicle.get("esc"):
            safety_features.append("ESC")
        if vehicle.get("backup_camera"):
            safety_features.append("Backup Camera")
        if vehicle.get("blind_spot"):
            safety_features.append("Blind Spot Warning")
        if vehicle.get("lane_departure"):
            safety_features.append("Lane Departure Warning")
        if vehicle.get("forward_collision"):
            safety_features.append("Forward Collision Warning")
        if vehicle.get("auto_emergency_braking"):
            safety_features.append("Auto Emergency Braking")
        if safety_features:
            vehicle["safety_features"] = safety_features

        confidence = 0
        if validation_results["checksum_valid"]:
            confidence += 40
        if vehicle.get("make") and vehicle.get("model"):
            confidence += 30
        if vehicle.get("year"):
            confidence += 15
        if validation_results.get("manufacturer_verified", True):
            confidence += 15

        vehicle["validation"] = {
            "confidence_score": confidence,
            "checksum_valid": validation_results["checksum_valid"],
            "sources_checked": validation_results["sources_checked"],
            "manufacturer_verified": validation_results.get("manufacturer_verified", True),
        }

        if not vehicle.get("make") or not vehicle.get("model"):
            raise HTTPException(status_code=404, detail="Could not decode vehicle make/model from VIN")

        return vehicle

    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail="Failed to connect to VIN decoder service") from e


@router.post("/vin/save")
async def save_vin_vehicle(request: VinSaveRequest):
    if _db is None:
        raise HTTPException(status_code=500, detail="VIN routes not initialized")

    try:
        vin = request.vin.upper().strip()
        vdata = request.vehicle_data

        vehicle_record: Dict[str, Any] = {
            "vin": vin,
            "year": int(vdata.get("year", 0)) if vdata.get("year") else None,
            "make": vdata.get("make", ""),
            "model": vdata.get("model", ""),
            "trim": vdata.get("trim"),
            "body_class": vdata.get("body_class"),
            "drive_type": vdata.get("drive_type"),
            "fuel_type": vdata.get("fuel_type"),
            "engine": vdata.get("engine"),
            "transmission": vdata.get("transmission"),
            "doors": vdata.get("doors"),
            "plant_country": vdata.get("plant_country"),
            "source_id": "vin_scanner",
            "is_new": True,
            "status": "available",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        existing = await _db.vehicles.find_one({"vin": vin})
        if existing:
            await _db.vehicles.update_one(
                {"vin": vin},
                {"$set": {**vehicle_record, "updated_at": datetime.now(timezone.utc)}},
            )
            return {"success": True, "message": "Vehicle updated", "vin": vin}

        vehicle_record["id"] = str(uuid.uuid4())
        await _db.vehicles.insert_one(vehicle_record)
        return {"success": True, "message": "Vehicle saved to inventory", "vin": vin}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save vehicle: {str(e)}") from e


@router.post("/vin/save-to-inventory")
async def save_vin_to_inventory(request: VinSaveWithCategoryRequest):
    if _db is None:
        raise HTTPException(status_code=500, detail="VIN routes not initialized")

    try:
        vin = request.vin.upper().strip()
        vdata = request.vehicle_data

        existing = await _db.vehicles.find_one({"vin": vin}, {"_id": 0})
        if existing:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This VIN already exists in inventory. "
                    f"Vehicle: {existing.get('year')} {existing.get('make')} {existing.get('model')}"
                ),
            )

        vehicle_record: Dict[str, Any] = {
            "id": str(uuid.uuid4()),
            "vin": vin,
            "year": int(vdata.get("year", 0)) if vdata.get("year") else None,
            "make": vdata.get("make", ""),
            "model": vdata.get("model", ""),
            "trim": vdata.get("trim"),
            "category": request.category,
            "body_class": vdata.get("body_class"),
            "drive_type": vdata.get("drive_type"),
            "fuel_type": vdata.get("fuel_type"),
            "engine_display": vdata.get("engine_display"),
            "transmission": vdata.get("transmission"),
            "assembly_location": vdata.get("assembly_location"),
            "safety_features": vdata.get("safety_features", []),
            "customer_id": request.customer_id,
            "trade_in_value": request.trade_in_value,
            "condition": request.condition,
            "status": "available",
            "source_id": "vin_scanner",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }

        await _db.vehicles.insert_one(vehicle_record)
        return {"success": True, "message": "Vehicle saved to inventory", "id": vehicle_record["id"]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"VIN save failed: {str(e)}") from e
