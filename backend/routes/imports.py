"""
Import Routes
File upload, email parsing, and data import functionality
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import uuid
import os

router = APIRouter()


class ImportPreviewRequest(BaseModel):
    content: str
    source_type: str = "csv"


class ImportUrlRequest(BaseModel):
    url: str
    source_type: str = "csv"


class EmailImportRequest(BaseModel):
    email_content: str
    sender: Optional[str] = None
    subject: Optional[str] = None


# Repositories will be injected
customer_repo = None
vehicle_repo = None
import_processor = None
llm_key = None


def init_import_routes(customer_repository, vehicle_repository, processor, emergent_key):
    global customer_repo, vehicle_repo, import_processor, llm_key
    customer_repo = customer_repository
    vehicle_repo = vehicle_repository
    import_processor = processor
    llm_key = emergent_key


@router.post("/preview")
async def preview_import(request: ImportPreviewRequest):
    """Preview import data before committing"""
    try:
        if import_processor:
            result = import_processor.parse_content(request.content, request.source_type)
            return {
                "success": True,
                "records": result.get("records", []),
                "fields": result.get("fields", []),
                "total": len(result.get("records", []))
            }
        return {"success": False, "error": "Import processor not available"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/url")
async def import_from_url(request: ImportUrlRequest):
    """Import data from a URL"""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(request.url, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to fetch URL")
            
            content = response.text
            
            if import_processor:
                result = import_processor.parse_content(content, request.source_type)
                return {
                    "success": True,
                    "records": result.get("records", []),
                    "total": len(result.get("records", []))
                }
            return {"success": False, "error": "Import processor not available"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file")
async def import_from_file(
    file: UploadFile = File(...),
    import_type: str = Form("customers")
):
    """Import data from uploaded file (CSV, Excel, etc.)"""
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Determine file type
        filename = file.filename.lower()
        if filename.endswith('.csv'):
            source_type = 'csv'
        elif filename.endswith(('.xlsx', '.xls')):
            source_type = 'excel'
        else:
            source_type = 'csv'
        
        if import_processor:
            result = import_processor.parse_content(content_str, source_type)
            records = result.get("records", [])
            
            imported = 0
            errors = []
            
            for record in records:
                try:
                    if import_type == "customers":
                        customer_doc = {
                            "id": str(uuid.uuid4()),
                            "first_name": record.get("first_name", record.get("name", "").split()[0] if record.get("name") else ""),
                            "last_name": record.get("last_name", " ".join(record.get("name", "").split()[1:]) if record.get("name") else ""),
                            "phone": record.get("phone", ""),
                            "email": record.get("email", ""),
                            "address": record.get("address", ""),
                            "lead_source": "import",
                            "lead_status": "new",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "interactions": []
                        }
                        await customer_repo.insert_one(customer_doc)
                        imported += 1
                    elif import_type == "vehicles":
                        vehicle_doc = {
                            "id": str(uuid.uuid4()),
                            "vin": record.get("vin", ""),
                            "year": record.get("year", ""),
                            "make": record.get("make", ""),
                            "model": record.get("model", ""),
                            "category": "active_inventory",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        await vehicle_repo.insert_one(vehicle_doc)
                        imported += 1
                except Exception as e:
                    errors.append(str(e))
            
            return {
                "success": True,
                "imported": imported,
                "total": len(records),
                "errors": errors[:5] if errors else []
            }
        
        return {"success": False, "error": "Import processor not available"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/email")
async def import_from_email(request: EmailImportRequest):
    """Parse customer info from email content using AI"""
    if not llm_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(api_key=llm_key)
        
        system_prompt = """You are an email parser. Extract customer information from this email.
Return a JSON object with these fields:
{
    "first_name": "string or null",
    "last_name": "string or null",
    "phone": "string or null",
    "email": "string or null",
    "address": "string or null",
    "vehicle_interest": "string or null (vehicle they're interested in)",
    "inquiry_type": "string or null (buying, selling, service, etc.)",
    "notes": "string (summary of their request)"
}
Extract what you can find. Use null for fields not present."""
        
        response = await chat.send_message(
            model="gpt-4o-mini",
            system_prompt=system_prompt,
            messages=[UserMessage(content=f"Parse this email:\n\nFrom: {request.sender}\nSubject: {request.subject}\n\n{request.email_content}")],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        import json
        customer_data = json.loads(response.content)
        
        return {
            "success": True,
            "customer_data": customer_data
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
