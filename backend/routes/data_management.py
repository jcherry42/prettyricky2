"""Data Management Routes: Import, Data Sources, CRM configs,
Dashboard stats, Maintenance, Favorites.
Extracted from server.py for modularity."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import os
import uuid
import csv
import io
import re
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_customer_repo = None
_vehicle_repo = None
_source_repo = None
_import_processor = None
_get_scheduler = None


def init_data_management_routes(db, customer_repo, vehicle_repo, source_repo, import_processor, get_scheduler):
    global _db, _customer_repo, _vehicle_repo, _source_repo, _import_processor, _get_scheduler
    _db = db
    _customer_repo = customer_repo
    _vehicle_repo = vehicle_repo
    _source_repo = source_repo
    _import_processor = import_processor
    _get_scheduler = get_scheduler


# --- Request Models ---

class ImportUrlRequest(BaseModel):
    url: str
    data_type: str = "customers"
    custom_mapping: Optional[Dict[str, str]] = None

class ImportPreviewRequest(BaseModel):
    content: str
    format: str = "csv"
    data_type: str = "customers"

class CreateDataSourceRequest(BaseModel):
    name: str
    type: str
    url: str
    data_type: str = "customers"
    refresh_schedule: str = "weekdays_10am"

class UpdateDataSourceRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    is_active: Optional[bool] = None
    refresh_schedule: Optional[str] = None
    field_mapping_overrides: Optional[Dict[str, str]] = None


# ============== DATA IMPORT ==============

@router.post("/import/preview")
async def preview_import(request: ImportPreviewRequest):
    try:
        return await _import_processor.preview_import(request.content, request.format, request.data_type)
    except Exception as e:
        logger.error(f"Preview error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import/url")
async def import_from_url(request: ImportUrlRequest):
    try:
        result = await _import_processor.import_from_url(request.url, request.data_type, request.custom_mapping)
        if result.success:
            if request.data_type == 'customers':
                stats = await _customer_repo.upsert_from_import(result.customers, source_id="direct_import")
            else:
                stats = await _vehicle_repo.upsert_from_import(result.vehicles, source_id="direct_import")
            return {
                "success": True,
                "stats": {
                    "total": result.total_rows, "imported": result.imported_count,
                    "inserted": stats.get('inserted', 0), "updated": stats.get('updated', 0),
                    "skipped": result.skipped_count
                },
                "mappings": [m.model_dump() for m in result.detected_mappings],
                "errors": result.errors[:10], "warnings": result.warnings[:10]
            }
        return {"success": False, "errors": result.errors, "warnings": result.warnings}
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import/file")
async def import_from_file(
    file: UploadFile = File(...),
    data_type: str = Form("customers")
):
    """Import data from uploaded CSV/JSON/Excel file.
    Uses ImportProcessor for CSV/JSON; falls back to openpyxl for Excel."""
    try:
        content = await file.read()
        filename = (file.filename or "").lower()

        # Excel files — use openpyxl directly (no pandas dependency)
        if filename.endswith(('.xlsx', '.xls')):
            return await _import_excel(content, filename, data_type)

        # CSV / JSON — use ImportProcessor
        content_str = content.decode('utf-8')
        fmt = 'json' if filename.endswith('.json') else 'csv'

        result = await _import_processor.import_from_content(content_str, fmt, data_type)
        if result.success:
            if data_type == 'customers':
                stats = await _customer_repo.upsert_from_import(result.customers, source_id="file_upload")
            else:
                stats = await _vehicle_repo.upsert_from_import(result.vehicles, source_id="file_upload")
            return {
                "success": True, "filename": file.filename,
                "stats": {
                    "total": result.total_rows, "imported": result.imported_count,
                    "inserted": stats.get('inserted', 0), "updated": stats.get('updated', 0),
                    "skipped": result.skipped_count
                },
                "mappings": [m.model_dump() for m in result.detected_mappings],
                "errors": result.errors[:10]
            }
        return {"success": False, "errors": result.errors}

    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File encoding not supported. Please use UTF-8.")
    except Exception as e:
        logger.error(f"File import error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


async def _import_excel(content: bytes, filename: str, data_type: str):
    """Import Excel files using openpyxl (no pandas dependency)."""
    try:
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(content), read_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        wb.close()

        if len(rows) < 2:
            raise HTTPException(status_code=400, detail="File has no data rows")

        headers = [str(h or '').strip().lower() for h in rows[0]]
        imported = 0
        errors = []

        for idx, row in enumerate(rows[1:], start=2):
            try:
                record = {headers[i]: row[i] for i in range(min(len(headers), len(row))) if row[i] is not None}
                if data_type == "customers":
                    await _import_customer_row(record)
                else:
                    await _import_vehicle_row(record)
                imported += 1
            except Exception as e:
                errors.append(f"Row {idx}: {str(e)}")

        return {"success": True, "imported": imported, "errors": errors[:10], "total_errors": len(errors)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel parse error: {str(e)}")


async def _import_customer_row(record: dict):
    """Insert a single customer row from import."""
    # Normalize common column names
    col_map = {
        'first name': 'first_name', 'firstname': 'first_name', 'fname': 'first_name',
        'last name': 'last_name', 'lastname': 'last_name', 'lname': 'last_name',
        'name': 'full_name', 'phone': 'phone', 'telephone': 'phone',
        'cell': 'phone', 'mobile': 'phone', 'email': 'email', 'e-mail': 'email',
    }
    mapped = {col_map.get(k.lower().strip(), k.lower().replace(' ', '_')): v for k, v in record.items()}

    if 'full_name' in mapped and mapped['full_name']:
        parts = str(mapped['full_name']).strip().split(' ', 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ''
    else:
        first_name = str(mapped.get('first_name', '')).strip()
        last_name = str(mapped.get('last_name', '')).strip()

    if not first_name:
        return

    await _db.customers.insert_one({
        "id": str(uuid.uuid4()),
        "first_name": first_name, "last_name": last_name,
        "phone": str(mapped.get('phone', '')).strip(),
        "email": str(mapped.get('email', '')).strip() or None,
        "lead_source": "file_import", "lead_status": "new",
        "interactions": [], "vehicle_interests": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })


async def _import_vehicle_row(record: dict):
    """Insert a single vehicle row from import."""
    col_map = {
        'vin': 'vin', 'year': 'year', 'make': 'make', 'model': 'model',
        'trim': 'trim', 'price': 'price', 'mileage': 'mileage',
        'miles': 'mileage', 'odometer': 'mileage',
        'color': 'color', 'ext color': 'color', 'exterior': 'color',
        'stock': 'stock_number', 'stock #': 'stock_number', 'stock number': 'stock_number',
    }
    mapped = {col_map.get(k.lower().strip(), k.lower().replace(' ', '_')): v for k, v in record.items()}

    make = str(mapped.get('make', '')).strip()
    model = str(mapped.get('model', '')).strip()
    if not make or not model:
        return

    def safe_int(v):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None

    def safe_float(v):
        try:
            return float(str(v).replace('$', '').replace(',', ''))
        except (TypeError, ValueError):
            return None

    await _db.vehicles.insert_one({
        "id": str(uuid.uuid4()),
        "vin": str(mapped.get('vin', '')).strip().upper() or None,
        "year": safe_int(mapped.get('year')),
        "make": make, "model": model,
        "trim": str(mapped.get('trim', '')).strip() or None,
        "price": safe_float(mapped.get('price')),
        "mileage": safe_int(mapped.get('mileage')),
        "color": str(mapped.get('color', '')).strip() or None,
        "stock_number": str(mapped.get('stock_number', '')).strip() or None,
        "category": "active_inventory", "status": "available",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    })


# ============== EMAIL IMPORT ==============

@router.post("/import/email")
async def parse_lead_email(email_body: str = Form(...), email_subject: str = Form(""), email_from: str = Form("")):
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM not configured")

        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=api_key,
            session_id=f"email-parse-{uuid.uuid4()}",
            system_message="You are an expert at parsing automotive lead emails. Extract customer information and return it as JSON only."
        ).with_model("openai", "gpt-4o-mini")

        parse_prompt = f"""Parse this automotive lead email and extract customer info as JSON.
Email From: {email_from}
Subject: {email_subject}
Body:
{email_body}

Return ONLY JSON: {{"first_name":"","last_name":"","phone":"","email":"","address":"","vehicle_interest":"","notes":""}}"""

        response = await chat.send_message(UserMessage(text=parse_prompt))
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            parsed = json.loads(json_match.group())
            if parsed.get("first_name") or parsed.get("phone") or parsed.get("email"):
                customer_data = {
                    "id": str(uuid.uuid4()),
                    "first_name": parsed.get("first_name", "Unknown"),
                    "last_name": parsed.get("last_name", ""),
                    "phone": parsed.get("phone", ""),
                    "email": parsed.get("email", email_from) or email_from,
                    "address": parsed.get("address"),
                    "lead_source": "email", "lead_status": "new",
                    "notes": parsed.get("notes"),
                    "interactions": [{
                        "id": str(uuid.uuid4()), "interaction_type": "email",
                        "content": f"Lead email: {email_subject}\n\n{email_body[:500]}",
                        "created_at": datetime.now(timezone.utc)
                    }],
                    "vehicle_interests": [],
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                }
                await _db.customers.insert_one(customer_data)
                return {"success": True, "parsed": parsed, "customer_id": customer_data["id"], "message": "Customer created from email"}
            return {"success": True, "parsed": parsed, "message": "Parsed but insufficient data"}
        raise HTTPException(status_code=400, detail="Could not parse email content")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email parse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== DATA SOURCES ==============

@router.get("/data-sources")
async def list_data_sources():
    sources = await _source_repo.find_many(sort=[("name", 1)])
    scheduler = _get_scheduler()
    next_refresh = scheduler.get_next_scheduled_refresh() if scheduler else None
    return {
        "sources": _source_repo.to_frontend_format(sources),
        "schedulerStatus": {
            "nextRefresh": next_refresh.isoformat() if next_refresh else None,
            "schedule": "Mon-Sat 10:00 AM ET"
        }
    }

@router.post("/data-sources")
async def create_data_source(request: CreateDataSourceRequest):
    try:
        from data_integration.models import DataSourceType, RefreshSchedule, DataSourceConfig
        source_type = DataSourceType.GOOGLE_SHEETS if 'google' in request.type.lower() else DataSourceType.URL
        schedule = RefreshSchedule(request.refresh_schedule) if request.refresh_schedule else RefreshSchedule.WEEKDAYS_10AM
        config = DataSourceConfig(
            name=request.name, type=source_type, url=request.url,
            data_type=request.data_type, refresh_schedule=schedule
        )
        source_id = await _source_repo.create_source(config)
        scheduler = _get_scheduler()
        if scheduler:
            result = await scheduler.manual_refresh(source_id)
            return {"success": True, "sourceId": source_id, "initialImport": result}
        return {"success": True, "sourceId": source_id}
    except Exception as e:
        logger.error(f"Create source error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/data-sources/{source_id}")
async def get_data_source(source_id: str):
    source = await _source_repo.find_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    return _source_repo.to_frontend_format([source])[0]

@router.patch("/data-sources/{source_id}")
async def update_data_source(source_id: str, request: UpdateDataSourceRequest):
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    success = await _source_repo.update_one(source_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Data source not found")
    return {"success": True}

@router.delete("/data-sources/{source_id}")
async def delete_data_source(source_id: str):
    source = await _source_repo.find_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    data_type = source.get('data_type', 'customers')
    if data_type == 'customers':
        await _customer_repo.delete_by_source(source_id)
    else:
        await _vehicle_repo.delete_by_source(source_id)
    await _source_repo.delete_one(source_id)
    return {"success": True}

@router.post("/data-sources/{source_id}/refresh")
async def refresh_data_source(source_id: str):
    scheduler = _get_scheduler()
    if not scheduler:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")
    return await scheduler.manual_refresh(source_id)

@router.post("/data-sources/refresh-all")
async def refresh_all_sources():
    scheduler = _get_scheduler()
    if not scheduler:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")
    return await scheduler.refresh_all_now()


# ============== CRM CONFIGS ==============

@router.get("/crm/configs")
async def list_crm_configs():
    try:
        configs = await _db.crm_configs.find({}, {"_id": 0, "api_key": 0, "api_secret": 0}).to_list(20)
        return {"configs": configs}
    except Exception as e:
        logger.error(f"List CRM configs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/crm/configs")
async def create_crm_config(config: dict):
    try:
        config["created_at"] = datetime.now(timezone.utc)
        await _db.crm_configs.insert_one(config)
        config.pop("api_key", None)
        config.pop("api_secret", None)
        config.pop("_id", None)
        return {"success": True, "config": config}
    except Exception as e:
        logger.error(f"Create CRM config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/crm/configs/{config_id}")
async def delete_crm_config(config_id: str):
    result = await _db.crm_configs.delete_one({"id": config_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    return {"success": True}

@router.post("/crm/configs/{config_id}/test")
async def test_crm_connection(config_id: str):
    config = await _db.crm_configs.find_one({"id": config_id})
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    import httpx
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(
                f"{config['api_url']}/health",
                headers={"Authorization": f"Bearer {config['api_key']}"}
            )
            return {"success": True, "status": "connected", "status_code": response.status_code}
        except Exception as e:
            return {"success": False, "status": "failed", "error": str(e)}


# ============== DASHBOARD STATS ==============

@router.get("/dashboard/stats")
async def get_dashboard_stats():
    try:
        total_customers = await _db.customers.count_documents({})
        new_leads = await _db.customers.count_documents({"lead_status": "new"})
        contacted = await _db.customers.count_documents({"lead_status": "contacted"})
        qualified = await _db.customers.count_documents({"lead_status": "qualified"})
        sold = await _db.customers.count_documents({"lead_status": "sold"})
        active_inventory = await _db.vehicles.count_documents({"category": "active_inventory"})
        trade_ins = await _db.vehicles.count_documents({"category": "trade_in"})
        return {
            "customers": {"total": total_customers, "new": new_leads, "contacted": contacted, "qualified": qualified, "sold": sold},
            "vehicles": {"active_inventory": active_inventory, "trade_ins": trade_ins, "total": active_inventory + trade_ins}
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== FAVORITES CATEGORIES ==============

FAVORITE_CATEGORIES = [
    {"id": "price_negotiation", "label": "Price Negotiation", "icon": "\U0001f4b0"},
    {"id": "trade_in", "label": "Trade-In", "icon": "\U0001f504"},
    {"id": "objection_handling", "label": "Objection Handling", "icon": "\U0001f6e1\ufe0f"},
    {"id": "follow_up", "label": "Follow-Up", "icon": "\U0001f4de"},
    {"id": "competitor", "label": "Competitor", "icon": "\u2694\ufe0f"},
    {"id": "financing", "label": "Financing", "icon": "\U0001f4ca"},
    {"id": "features", "label": "Features", "icon": "\u2699\ufe0f"},
    {"id": "closing", "label": "Closing", "icon": "\U0001f3af"},
    {"id": "general", "label": "General", "icon": "\U0001f4ac"},
]

@router.get("/favorites/categories")
async def get_favorite_categories():
    return {"categories": FAVORITE_CATEGORIES}


# ============== MAINTENANCE ==============

@router.post("/maintenance/cleanup-sold")
async def cleanup_sold_customers():
    """Delete customers marked as sold more than 30 days ago."""
    try:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        result = await _db.customers.delete_many({"lead_status": "sold", "sold_at": {"$lt": cutoff}})
        return {"success": True, "deleted": result.deleted_count}
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/maintenance/cleanup-uploads")
async def cleanup_old_uploads():
    """Delete uploaded files older than 30 days to prevent disk accumulation."""
    import pathlib
    from datetime import timedelta
    try:
        uploads_dir = pathlib.Path(__file__).resolve().parent.parent / "uploads"
        if not uploads_dir.exists():
            return {"success": True, "deleted": 0}

        cutoff = datetime.now(timezone.utc).timestamp() - timedelta(days=30).total_seconds()
        deleted = 0
        for f in uploads_dir.iterdir():
            if f.is_file() and f.stat().st_mtime < cutoff:
                f.unlink()
                deleted += 1
        return {"success": True, "deleted": deleted}
    except Exception as e:
        logger.error(f"Upload cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
