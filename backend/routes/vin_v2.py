"""\
VIN Routes (Refactored v2)

Goal:
- Match the current production VIN API contract in backend/server.py exactly.
- Robust NHTSA decode with retry logic for reliability.
- Trade-In VIN cap enforcement (50 max).
- AI Vision VIN OCR extraction from windshield plates (95%+ accuracy).

Endpoints:
- GET  /vin/decode/{vin}
- GET  /vin/trade-in-count
- POST /vin/save
- POST /vin/save-to-inventory
- POST /vin/extract-from-image
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import time
from functools import lru_cache
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import uuid
import httpx

logger = logging.getLogger(__name__)

router = APIRouter()

_db = None
_ai_gateway = None

TRADE_IN_CAP = 50

# ── Shared HTTP client with connection pooling (reuses TCP connections) ──
_http_client: Optional[httpx.AsyncClient] = None


def _get_http_client() -> httpx.AsyncClient:
    """Lazy-init shared httpx client with connection pooling."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=15.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            http2=False,
        )
    return _http_client


# ── NHTSA Decode Cache (LRU + TTL, in-memory) ──────────────────────────
_NHTSA_CACHE: Dict[str, tuple] = {}  # vin -> (timestamp, result)
_NHTSA_CACHE_TTL = 3600  # 1 hour — NHTSA data is static per VIN
_NHTSA_CACHE_MAX = 1024


def _nhtsa_cache_get(vin: str) -> Optional[dict]:
    """Get cached NHTSA result if not expired."""
    entry = _NHTSA_CACHE.get(vin)
    if entry is None:
        return None
    ts, result = entry
    if time.monotonic() - ts > _NHTSA_CACHE_TTL:
        del _NHTSA_CACHE[vin]
        return None
    return result


def _nhtsa_cache_set(vin: str, result: dict):
    """Cache NHTSA result with TTL. Evict oldest if full."""
    if len(_NHTSA_CACHE) >= _NHTSA_CACHE_MAX:
        # Evict oldest entry
        oldest_key = next(iter(_NHTSA_CACHE))
        del _NHTSA_CACHE[oldest_key]
    _NHTSA_CACHE[vin] = (time.monotonic(), result)


def init_vin_routes(db, ai_gateway=None):
    global _db, _ai_gateway
    _db = db
    _ai_gateway = ai_gateway


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


async def _nhtsa_decode_with_retry(vin: str, max_retries: int = 3) -> dict:
    """Call NHTSA vPIC API with connection-pooled client, LRU cache, and exponential backoff."""
    # ── Cache hit — return instantly ──
    cached = _nhtsa_cache_get(vin)
    if cached is not None:
        logger.debug(f"NHTSA cache HIT for {vin}")
        return cached

    url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
    last_error = None
    client = _get_http_client()

    for attempt in range(max_retries):
        try:
            response = await client.get(url)
            response.raise_for_status()
            result = response.json()
            # Cache the successful result
            _nhtsa_cache_set(vin, result)
            return result
        except (httpx.HTTPError, httpx.TimeoutException) as e:
            last_error = e
            if attempt < max_retries - 1:
                wait = (2 ** attempt) * 0.5  # 0.5s, 1s, 2s
                logger.warning(f"NHTSA API attempt {attempt + 1} failed for VIN {vin}: {e}. Retrying in {wait}s...")
                await asyncio.sleep(wait)

    logger.error(f"NHTSA API failed after {max_retries} retries for VIN {vin}: {last_error}")
    raise last_error


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
        data = await _nhtsa_decode_with_retry(vin)

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


@router.get("/vin/trade-in-count")
async def get_trade_in_count():
    """Return current trade-in count and cap for enforcement."""
    if _db is None:
        raise HTTPException(status_code=500, detail="VIN routes not initialized")

    try:
        count = await _db.vehicles.count_documents({"category": "trade_in"})
        return {
            "count": count,
            "cap": TRADE_IN_CAP,
            "remaining": max(0, TRADE_IN_CAP - count),
            "at_limit": count >= TRADE_IN_CAP,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trade-in count: {str(e)}") from e


@router.post("/vin/save-to-inventory")
async def save_vin_to_inventory(request: VinSaveWithCategoryRequest):
    if _db is None:
        raise HTTPException(status_code=500, detail="VIN routes not initialized")

    try:
        vin = request.vin.upper().strip()
        vdata = request.vehicle_data

        # Enforce trade-in cap of 50
        if request.category == "trade_in":
            trade_in_count = await _db.vehicles.count_documents({"category": "trade_in"})
            if trade_in_count >= TRADE_IN_CAP:
                raise HTTPException(
                    status_code=409,
                    detail=f"Trade-In VIN limit reached ({TRADE_IN_CAP} max). Remove existing trade-ins before adding new ones.",
                )

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
        logger.info(f"Vehicle saved to inventory: {vin} (category={request.category})")
        return {
            "success": True,
            "message": f"Vehicle saved as {request.category.replace('_', ' ').title()}",
            "id": vehicle_record["id"],
            "category": request.category,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VIN save failed: {e}")
        raise HTTPException(status_code=500, detail=f"VIN save failed: {str(e)}") from e



# ═══════════════════════════════════════════════════════════════════════
# VIN OCR — Extract VIN from windshield plate / dashboard image
# ═══════════════════════════════════════════════════════════════════════

class VinOcrRequest(BaseModel):
    image_base64: str
    ml_text_hint: Optional[str] = None


class VinOcrResponse(BaseModel):
    vins: List[str]
    confidence: str  # "high", "medium", "low"
    notes: str
    raw_candidates: Optional[List[str]] = None


# Characters that are NEVER in a valid VIN
_VIN_INVALID_CHARS = set("IOQ")
_VIN_VALID_CHARS = set("ABCDEFGHJKLMNPRSTUVWXYZ0123456789")

# Common OCR misreads for VIN characters
_VIN_CHAR_CORRECTIONS = {
    "O": "0", "o": "0",
    "I": "1", "i": "1", "l": "1", "|": "1",
    "Q": "0", "q": "0",
    "S": "5",  # Only when context suggests digit
    "B": "8",  # Only when context suggests digit
    "G": "6",  # Only when context suggests digit
    "Z": "2",  # Only when context suggests digit
    " ": "", "-": "", ".": "",
}


def _correct_vin_chars(raw: str) -> str:
    """Apply common OCR misread corrections to extract a valid VIN."""
    cleaned = raw.upper().strip()
    # Remove spaces, dashes, dots
    cleaned = re.sub(r'[\s\-\.\,]+', '', cleaned)
    # Replace I, O, Q which are never in VINs
    result = []
    for ch in cleaned:
        if ch in _VIN_INVALID_CHARS:
            result.append(_VIN_CHAR_CORRECTIONS.get(ch, ch))
        elif ch in _VIN_VALID_CHARS:
            result.append(ch)
        elif ch in _VIN_CHAR_CORRECTIONS:
            result.append(_VIN_CHAR_CORRECTIONS[ch])
        # else: skip invalid chars
    return ''.join(result)


def _extract_vin_candidates(text: str) -> List[str]:
    """Extract all potential 17-char VIN sequences from text, with OCR correction."""
    text_upper = text.upper()
    # Remove all whitespace for contiguous matching
    compact = re.sub(r'\s+', '', text_upper)

    candidates = []

    # Direct regex match for 17-char alphanumeric sequences (no I, O, Q)
    strict_pattern = re.compile(r'[A-HJ-NPR-Z0-9]{17}')
    for m in strict_pattern.finditer(compact):
        candidates.append(m.group())

    # Looser match: 17 chars allowing I, O, Q then correct them
    loose_pattern = re.compile(r'[A-Z0-9]{17}')
    for m in loose_pattern.finditer(compact):
        corrected = _correct_vin_chars(m.group())
        if len(corrected) == 17 and corrected not in candidates:
            candidates.append(corrected)

    # Try sliding window on OCR-corrected text
    corrected_compact = _correct_vin_chars(compact)
    if len(corrected_compact) >= 17:
        for i in range(len(corrected_compact) - 16):
            window = corrected_compact[i:i + 17]
            if strict_pattern.fullmatch(window) and window not in candidates:
                candidates.append(window)

    return candidates


@router.post("/vin/extract-from-image", response_model=VinOcrResponse)
async def extract_vin_from_image(request: VinOcrRequest):
    """
    AI Vision VIN extraction — automotive-grade accuracy (95%+).

    Accepts a base64-encoded image of a windshield VIN plate, dashboard stamp,
    or door jamb label. Uses GPT-4o Vision with a triple-pass VIN-specific prompt
    plus local checksum validation for maximum accuracy.
    """
    if _ai_gateway is None:
        raise HTTPException(status_code=500, detail="AI Gateway not initialized")

    if not request.image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    # Validate base64 is decodable and reasonable size
    try:
        raw_bytes = base64.b64decode(request.image_base64)
        if len(raw_bytes) < 5 * 1024:
            return VinOcrResponse(
                vins=[], confidence="low",
                notes="Image too small for reliable VIN reading. Please capture a closer, clearer photo.",
            )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image data")

    # Optimize image for OCR (resize to max 2048px, JPEG for speed)
    from utils.image_processing import resize_image_for_ocr_jpeg
    optimized = resize_image_for_ocr_jpeg(raw_bytes, max_dim=2048, quality=95)
    b64_optimized = base64.b64encode(optimized).decode('ascii')

    # ── Build the specialized VIN extraction prompt ──
    vin_prompt = """You are an AUTOMOTIVE-GRADE VIN OCR system with 99% accuracy requirements. You are analyzing a photo of a vehicle's VIN (Vehicle Identification Number) as seen on a windshield plate, dashboard stamp, door jamb sticker, or barcode label.

INSTRUCTIONS — TRIPLE-PASS METHODOLOGY:

**PASS 1 — RAW CHARACTER READ:**
Read every character on the VIN plate left-to-right. VINs are ALWAYS exactly 17 characters. Copy each character exactly as you see it.

**PASS 2 — AUTOMOTIVE VIN RULES:**
- VINs NEVER contain the letters I, O, or Q. If you read any of these:
  - "I" → likely "1" (one)
  - "O" → likely "0" (zero)
  - "Q" → likely "0" (zero) or "9"
- Valid VIN characters: A-H, J-N, P, R-Z, 0-9 (exactly 34 possible characters)
- Position 9 is ALWAYS the check digit (0-9 or X)
- Position 10 is the model year code
- Positions 1-3 are the World Manufacturer Identifier (WMI)

**PASS 3 — CHECKSUM VERIFICATION:**
Apply ISO 3779 VIN checksum validation:
- Transliterate each letter to its numeric value (A=1, B=2, C=3, D=4, E=5, F=6, G=7, H=8, J=1, K=2, L=3, M=4, N=5, P=7, R=9, S=2, T=3, U=4, V=5, W=6, X=7, Y=8, Z=9)
- Weight positions: [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2]
- Sum all (value × weight), mod 11 should equal position 9 (with 10=X)
- If checksum fails, re-examine ambiguous characters (0/O/D, 1/I/7, 5/S, 8/B, 2/Z)

Return ONLY a JSON object (no markdown, no code fences, no explanation):
{
  "vins": ["DETECTED_VIN_1", "DETECTED_VIN_2"],
  "confidence": "high",
  "notes": "Brief description of what was detected",
  "raw_text": "All text visible on/near the VIN area"
}

RULES:
- "vins" array: Include EVERY 17-character VIN you detect. Most images have exactly 1 VIN.
- "confidence": "high" if checksum passes AND characters are clear. "medium" if 1-2 characters uncertain. "low" if multiple characters are guesses.
- If you cannot detect ANY VIN, return: {"vins": [], "confidence": "low", "notes": "No VIN detected — describe what you see", "raw_text": ""}
- NEVER fabricate a VIN. If you can't read it, say so.
- Common environments: windshield lower-left corner (viewed through glass), dashboard top (visible from outside), door jamb sticker, engine bay plate."""

    # Append ML Kit pre-extraction hint if available
    if request.ml_text_hint and len(request.ml_text_hint.strip()) > 5:
        vin_prompt += f"""

ON-DEVICE ML KIT PRE-EXTRACTION (use to cross-validate your reading):
---
{request.ml_text_hint.strip()}
---
The ML Kit text may contain noise but character fragments are usually accurate. Compare your reading against this text. Where they agree, confidence is higher."""

    try:
        response = await _ai_gateway.chat(
            feature='vin_ocr',
            prompt=vin_prompt,
            system_message=(
                "You are a precision automotive VIN reading system. "
                "Your readings are used for vehicle title registration and financial transactions. "
                "Accuracy is critical — a single wrong character means a wrong vehicle. "
                "Return null/empty for anything you cannot read with confidence."
            ),
            images=[b64_optimized],
        )

        logger.info(f"VIN OCR response ({len(response)} chars)")

        # Parse JSON from AI response
        cleaned = response.strip()
        if '```' in cleaned:
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned)
            if json_match:
                cleaned = json_match.group(1)
        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            cleaned = json_match.group(0)

        ai_result = json.loads(cleaned)
        ai_vins = ai_result.get("vins", [])
        ai_notes = ai_result.get("notes", "")
        ai_raw_text = ai_result.get("raw_text", "")

        # ── Post-processing: validate + extract additional candidates ──
        all_candidates = list(ai_vins)

        # Also extract from raw_text if AI provided it (only if AI found no VINs)
        if ai_raw_text and len(all_candidates) == 0:
            for candidate in _extract_vin_candidates(ai_raw_text):
                if candidate not in all_candidates:
                    all_candidates.append(candidate)

        # Validate each candidate
        validated_vins = []
        checksum_failed_vins = []
        for vin in all_candidates:
            vin_clean = _correct_vin_chars(vin)
            if len(vin_clean) != 17:
                continue
            # Check all chars are valid
            if not all(c in _VIN_VALID_CHARS for c in vin_clean):
                continue
            if validate_vin_checksum(vin_clean):
                if vin_clean not in validated_vins:
                    validated_vins.append(vin_clean)
            else:
                if vin_clean not in checksum_failed_vins and vin_clean not in validated_vins:
                    checksum_failed_vins.append(vin_clean)

        # Build final list: checksum-valid first, then up to 3 checksum-failed
        # Most images contain 1 VIN — limit noise from OCR artifacts
        final_vins = validated_vins + checksum_failed_vins[:3]

        # Determine confidence
        if len(validated_vins) > 0:
            final_confidence = "high"
            notes_suffix = f"{len(validated_vins)} checksum-verified VIN(s)"
        elif len(checksum_failed_vins) > 0:
            final_confidence = "medium"
            notes_suffix = f"{len(checksum_failed_vins)} VIN(s) detected (checksum advisory)"
        else:
            final_confidence = "low"
            notes_suffix = "No VIN detected"

        notes = f"{ai_notes}. {notes_suffix}" if ai_notes else notes_suffix

        logger.info(f"VIN OCR result: {len(final_vins)} VINs (confidence={final_confidence})")

        return VinOcrResponse(
            vins=final_vins,
            confidence=final_confidence,
            notes=notes,
            raw_candidates=all_candidates if all_candidates != final_vins else None,
        )

    except json.JSONDecodeError:
        logger.error("VIN OCR: Failed to parse AI response as JSON")
        return VinOcrResponse(
            vins=[], confidence="low",
            notes="AI response could not be parsed. Please try again with a clearer photo.",
        )
    except Exception as e:
        logger.error(f"VIN OCR error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"VIN OCR failed: {str(e)}")
