"""\
Customer Routes (Refactored v2)

Goal:
- Match the current production API contract from backend/server.py exactly.
- Move customer endpoints out of the monolith to reduce regression risk.

Endpoints (exact paths):
- GET    /customers
- GET    /customers/stats
- GET    /customers/list
- POST   /customers                (legacy payload)
- POST   /customers/create
- GET    /customers/{customer_id}
- PATCH  /customers/{customer_id}
- DELETE /customers/{customer_id}
- POST   /customers/{customer_id}/interaction
- POST   /customers/{customer_id}/attach-vehicle
- DELETE /customers/{customer_id}/detach-vehicle/{vehicle_id}

Notes:
- /customers endpoint powers the primary selector UI and merges:
  - integrated CRM customers via customer_repo
  - local Mongo customers via db.customers
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Any, Dict, Literal, Optional
from datetime import datetime, timezone
import uuid

from models import CustomerCreate, CustomerUpdate, LeadStatus

router = APIRouter()

_db = None
_customer_repo = None


def init_customer_routes(db, customer_repo):
    global _db, _customer_repo
    _db = db
    _customer_repo = customer_repo


@router.get("/customers")
async def list_customers(
    status: Optional[str] = None,
    source_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
):
    """List customers with optional filters. (Merged integrated + local)"""
    if _db is None or _customer_repo is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    fetch_n = max(0, limit + skip)

    # ---- Integrated customers ----
    if search:
        customers = await _customer_repo.search(search, fetch_n)
    elif status:
        customers = await _customer_repo.find_by_status(LeadStatus(status), limit=fetch_n, skip=0)
    elif source_id:
        customers = await _customer_repo.find_by_source(source_id, fetch_n, 0)
    else:
        customers = await _customer_repo.find_many(limit=fetch_n, skip=0)

    integrated_frontend = _customer_repo.to_frontend_format(customers)

    # ---- Local customers (Mongo) ----
    local_query: Dict[str, Any] = {}
    if status:
        local_query["lead_status"] = status

    if search:
        local_query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    local_docs = (
        await _db.customers.find(local_query, {"_id": 0})
        .sort("created_at", -1)
        .limit(fetch_n)
        .to_list(fetch_n)
    )

    def _local_to_frontend(c: Dict[str, Any]) -> Dict[str, Any]:
        first = (c.get("first_name") or "").strip()
        last = (c.get("last_name") or "").strip()
        name = (f"{first} {last}").strip() or c.get("name") or ""
        return {
            "id": c.get("id"),
            "name": name,
            "firstName": first,
            "lastName": last,
            "phone": c.get("phone") or "",
            "email": c.get("email") or "",
            "address": c.get("address"),
            "vehicleInterest": (c.get("vehicle_of_interest") or c.get("vehicleInterest") or None),
            "status": c.get("lead_status") or c.get("status") or "new",
            "notes": c.get("notes"),
            "currentVehicle": None,
            "tradeIn": c.get("trade_in_info") or None,
        }

    local_frontend = [_local_to_frontend(c) for c in local_docs]

    # Merge: local first (most recent manual adds should be immediately visible)
    local_ids = {c.get("id") for c in local_frontend if c.get("id")}
    merged = local_frontend + [c for c in integrated_frontend if c.get("id") not in local_ids]

    paged = merged[skip : skip + limit] if limit else merged[skip:]
    has_more = len(merged) > skip + limit

    # Return next_cursor for infinite-scroll pagination
    next_cursor = None
    if has_more and paged:
        next_cursor = paged[-1].get("id")

    return {"customers": paged, "count": len(merged), "has_more": has_more, "next_cursor": next_cursor}


@router.get("/customers/stats")
async def customer_stats(source_id: Optional[str] = None):
    """Get customer statistics."""
    if _customer_repo is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    counts = await _customer_repo.get_status_counts(source_id)
    total = await _customer_repo.count({"source_id": source_id} if source_id else {})
    return {"total": total, "byStatus": counts}


# ----- Enhanced customer management (local DB only) -----

class AddInteractionRequest(BaseModel):
    interaction_type: str
    content: str
    created_by: Optional[str] = None


class AttachVehicleRequest(BaseModel):
    vehicle_id: str


@router.get("/customers/list")
async def list_customers_filtered(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    """List all customers with optional filtering."""
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        query: Dict[str, Any] = {}
        if status:
            query["lead_status"] = status
        if source:
            query["lead_source"] = source

        cursor = _db.customers.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        customers = await cursor.to_list(limit)

        if search:
            search_lower = search.lower()
            customers = [
                c
                for c in customers
                if search_lower in (c.get("first_name") or "").lower()
                or search_lower in (c.get("last_name") or "").lower()
                or search_lower in (c.get("phone") or "").lower()
                or search_lower in (c.get("email") or "").lower()
            ]

        total = await _db.customers.count_documents(query)
        has_more = (skip + limit) < total
        next_cursor = customers[-1].get("id") if has_more and customers else None
        return {"customers": customers, "total": total, "has_more": has_more, "next_cursor": next_cursor}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Legacy endpoint compatibility (LicenseScanner + ImportModal)
class LegacyCustomerCreateRequest(BaseModel):
    firstName: Optional[str] = Field(default=None, max_length=100)
    lastName: Optional[str] = Field(default=None, max_length=100)
    first_name: Optional[str] = Field(default=None, max_length=100)  # Modern snake_case
    last_name: Optional[str] = Field(default=None, max_length=100)
    name: Optional[str] = Field(default=None, max_length=200)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, max_length=300)
    policyNumber: Optional[str] = Field(default=None, max_length=100)
    leadStatus: Optional[str] = None
    lead_status: Optional[str] = None
    source: Optional[str] = None
    vehicleOfInterest: Optional[str] = Field(default=None, max_length=200)
    tradeVehicle: Optional[Dict[str, Any]] = None
    license_image: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=4000)
    preferred_language: Optional[Literal['en', 'es', 'fr', 'ko']] = None

    @field_validator('email', mode='before')
    @classmethod
    def _empty_email_to_none(cls, v):
        # Callers commonly submit "" from empty form fields; treat as None so
        # EmailStr doesn't fail on it. Any non-empty string still gets full RFC validation.
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return v


@router.post("/customers", status_code=201)
async def create_customer_legacy(payload: LegacyCustomerCreateRequest):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    # Accept both camelCase (legacy) and snake_case (modern) field names
    first_name = (payload.firstName or payload.first_name or "").strip()
    last_name = (payload.lastName or payload.last_name or "").strip()

    if not first_name and payload.name:
        parts = payload.name.strip().split()
        first_name = parts[0] if parts else ""
        last_name = " ".join(parts[1:]) if len(parts) > 1 else ""

    # Reject totally-empty submissions instead of silently defaulting to
    # "License Scan" — a store-ready API must fail fast on ambiguous input.
    # An attached license_image OR a phone/email is enough to prove intent.
    has_identity = bool(first_name or last_name or payload.phone or payload.email or payload.license_image)
    if not has_identity:
        raise HTTPException(
            status_code=422,
            detail="At least one of first_name/last_name/name, phone, email, or license_image is required.",
        )

    # Validate lead_status if provided (Literal-style)
    lead_status = (payload.lead_status or payload.leadStatus or "new").strip().lower()
    if lead_status not in {"new", "contacted", "appointment", "sold", "service", "lost"}:
        raise HTTPException(
            status_code=422,
            detail=f"lead_status must be one of new|contacted|appointment|sold|service|lost, got '{lead_status}'.",
        )

    phone = (payload.phone or "").strip() or None
    email = (payload.email or "").strip() or None

    customer_id = str(uuid.uuid4())
    customer_doc: Dict[str, Any] = {
        "id": customer_id,
        # Fallbacks kept for license-only scans (image supplied, name pending OCR)
        "first_name": first_name or ("License" if payload.license_image else ""),
        "last_name": last_name or ("Scan" if payload.license_image else ""),
        "phone": phone or "",
        "email": email,
        "address": payload.address,
        "lead_source": payload.source or "manual",
        "lead_status": lead_status,
        "notes": payload.notes,
        "vehicle_interests": [],
        "trade_in_vehicle_id": None,
        "interactions": [],
        "preferred_language": (payload.preferred_language or "en"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    if payload.license_image:
        customer_doc["license_image"] = payload.license_image

    await _db.customers.insert_one(customer_doc)
    return {k: v for k, v in customer_doc.items() if k != "_id"}


@router.post("/customers/create", status_code=201)
async def create_customer(customer: CustomerCreate):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        customer_data = customer.model_dump()
        customer_data["id"] = str(uuid.uuid4())
        customer_data["created_at"] = datetime.now(timezone.utc).isoformat()
        customer_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        customer_data["interactions"] = []

        await _db.customers.insert_one(customer_data)
        return {"success": True, "customer": {k: v for k, v in customer_data.items() if k != "_id"}}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        customer = await _db.customers.find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if customer.get("vehicle_interests"):
            vehicles = await _db.vehicles.find({"id": {"$in": customer["vehicle_interests"]}}, {"_id": 0}).to_list(10)
            customer["attached_vehicles"] = vehicles

        if customer.get("trade_in_vehicle_id"):
            trade_in = await _db.vehicles.find_one({"id": customer["trade_in_vehicle_id"]}, {"_id": 0})
            customer["trade_in_vehicle"] = trade_in

        return customer

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.patch("/customers/{customer_id}")
async def update_customer(customer_id: str, updates: CustomerUpdate):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)

        if updates.lead_status == LeadStatus.SOLD:
            update_data["sold_at"] = datetime.now(timezone.utc)

        result = await _db.customers.update_one({"id": customer_id}, {"$set": update_data})
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")

        return {"success": True, "updated": update_data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        result = await _db.customers.delete_one({"id": customer_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/customers/{customer_id}/interaction")
async def add_customer_interaction(customer_id: str, interaction: AddInteractionRequest):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        interaction_data = {
            "id": str(uuid.uuid4()),
            "interaction_type": interaction.interaction_type,
            "content": interaction.content,
            "created_at": datetime.now(timezone.utc),
            "created_by": interaction.created_by,
        }

        result = await _db.customers.update_one(
            {"id": customer_id},
            {
                "$push": {"interactions": interaction_data},
                "$set": {"updated_at": datetime.now(timezone.utc)},
            },
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")

        return {"success": True, "interaction": interaction_data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/customers/{customer_id}/attach-vehicle")
async def attach_vehicle_to_customer(customer_id: str, request: AttachVehicleRequest):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        customer = await _db.customers.find_one({"id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        current_vehicles = customer.get("vehicle_interests", [])
        if len(current_vehicles) >= 2:
            raise HTTPException(status_code=400, detail="Maximum 2 vehicles allowed per customer")

        if request.vehicle_id in current_vehicles:
            raise HTTPException(status_code=400, detail="Vehicle already attached")

        await _db.customers.update_one(
            {"id": customer_id},
            {"$push": {"vehicle_interests": request.vehicle_id}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/customers/{customer_id}/detach-vehicle/{vehicle_id}")
async def detach_vehicle_from_customer(customer_id: str, vehicle_id: str):
    if _db is None:
        raise HTTPException(status_code=500, detail="Customer routes not initialized")

    try:
        result = await _db.customers.update_one(
            {"id": customer_id},
            {"$pull": {"vehicle_interests": vehicle_id}, "$set": {"updated_at": datetime.now(timezone.utc)}},
        )

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
