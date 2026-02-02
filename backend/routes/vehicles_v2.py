"""\
Vehicle Routes (Refactored)

Purpose:
- Preserve existing API contract from server.py while moving vehicle endpoints into a modular router.
- No feature changes; behavior should match the monolith.

Endpoints moved:
- GET  /vehicles
- GET  /vehicles/stats
- GET  /vehicles/inventory
- POST /vehicles/create
- GET  /vehicles/{vehicle_id}
- PATCH /vehicles/{vehicle_id}
- DELETE /vehicles/{vehicle_id}
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import uuid

from models import VehicleCreate, VehicleUpdate

router = APIRouter()

_db = None
_vehicle_repo = None


def init_vehicle_routes(db, vehicle_repo):
    global _db, _vehicle_repo
    _db = db
    _vehicle_repo = vehicle_repo


@router.get("/vehicles")
async def list_vehicles(
    is_new: Optional[bool] = None,
    source_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    summary: bool = False,
):
    """List vehicles with optional filters (repo-backed)."""
    if _vehicle_repo is None:
        raise HTTPException(status_code=500, detail="Vehicle routes not initialized")

    if search:
        vehicles = await _vehicle_repo.search(search, limit)
    elif source_id:
        vehicles = await _vehicle_repo.find_by_source(source_id, limit, skip)
    elif is_new is not None:
        vehicles = await _vehicle_repo.find_available(is_new, limit, skip)
    else:
        vehicles = await _vehicle_repo.find_many(limit=limit, skip=skip)

    return {
        "vehicles": _vehicle_repo.to_frontend_format(vehicles, summary=summary),
        "count": len(vehicles),
    }


@router.get("/vehicles/stats")
async def vehicle_stats(source_id: Optional[str] = None):
    """Get vehicle inventory statistics."""
    if _vehicle_repo is None:
        raise HTTPException(status_code=500, detail="Vehicle routes not initialized")

    return await _vehicle_repo.get_inventory_summary(source_id)


@router.get("/vehicles/inventory")
async def list_inventory(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    """List vehicles in inventory (Mongo-backed; preserves original behavior)."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Vehicle routes not initialized")

    try:
        query: Dict[str, Any] = {}
        if category:
            query["category"] = category

        cursor = (
            _db.vehicles.find(query, {"_id": 0})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        vehicles = await cursor.to_list(limit)

        if search:
            search_lower = search.lower()
            vehicles = [
                v
                for v in vehicles
                if search_lower in (v.get("make", "").lower())
                or search_lower in (v.get("model", "").lower())
                or search_lower in (v.get("vin", "").lower())
                or search_lower in str(v.get("year", ""))
            ]

        active_count = await _db.vehicles.count_documents({"category": "active_inventory"})
        trade_in_count = await _db.vehicles.count_documents({"category": "trade_in"})

        return {
            "vehicles": vehicles,
            "counts": {
                "active_inventory": active_count,
                "trade_in": trade_in_count,
                "total": active_count + trade_in_count,
            },
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/vehicles/create")
async def create_vehicle(vehicle: VehicleCreate):
    """Create a new vehicle."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Vehicle routes not initialized")

    try:
        vehicle_data = vehicle.model_dump()
        vehicle_data["id"] = str(uuid.uuid4())
        vehicle_data["created_at"] = datetime.now(timezone.utc)
        vehicle_data["updated_at"] = datetime.now(timezone.utc)
        vehicle_data["status"] = "available"

        await _db.vehicles.insert_one(vehicle_data)

        return {
            "success": True,
            "vehicle": {k: v for k, v in vehicle_data.items() if k != "_id"},
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    """Get a single vehicle."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Vehicle routes not initialized")

    try:
        vehicle = await _db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")

        if vehicle.get("customer_id"):
            customer = await _db.customers.find_one(
                {"id": vehicle["customer_id"]},
                {"_id": 0, "first_name": 1, "last_name": 1, "phone": 1},
            )
            vehicle["linked_customer"] = customer

        return vehicle

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, updates: VehicleUpdate):
    """Update a vehicle."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Vehicle routes not initialized")

    try:
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)

        result = await _db.vehicles.update_one({"id": vehicle_id}, {"$set": update_data})

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")

        return {"success": True, "updated": update_data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Vehicle routes not initialized")

    try:
        result = await _db.vehicles.delete_one({"id": vehicle_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
