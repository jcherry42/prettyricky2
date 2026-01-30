"""
License Scanner Routes
License scanning, OCR, and print functionality
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import base64

router = APIRouter()

BACKEND_URL = os.environ.get('VITE_BACKEND_URL', '')


class LicenseScanResponse(BaseModel):
    success: bool
    customer_data: Optional[Dict[str, Any]] = None
    raw_text: Optional[str] = None
    confidence: Optional[float] = None
    error: Optional[str] = None


class LicenseUploadResponse(BaseModel):
    success: bool
    filename: Optional[str] = None
    customer_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class AttachLicenseRequest(BaseModel):
    customer_id: str
    license_image_url: str


class PrintLicenseRequest(BaseModel):
    image_data: str
    printer_ip: str
    customer_name: Optional[str] = None


class PrintCustomerRequest(BaseModel):
    customer_id: str
    printer_ip: str
    print_type: str = "profile"


# Will be initialized from main server
customer_repo = None
llm_key = None


def init_license_routes(customer_repository, emergent_key):
    global customer_repo, llm_key
    customer_repo = customer_repository
    llm_key = emergent_key


@router.post("/scan", response_model=LicenseScanResponse)
async def scan_license(image_data: str = None, image_url: str = None):
    """Scan a license image and extract customer data using AI vision"""
    if not llm_key:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    
    if not image_data and not image_url:
        raise HTTPException(status_code=400, detail="Either image_data or image_url required")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        chat = LlmChat(api_key=llm_key)
        
        # Build image content
        if image_data:
            image_content = ImageContent(base64_image=image_data)
        else:
            image_content = ImageContent(url=image_url)
        
        system_prompt = """You are a document scanner AI. Extract information from this driver's license image.
Return a JSON object with these fields:
{
    "first_name": "string",
    "last_name": "string", 
    "address": "string",
    "city": "string",
    "state": "string",
    "zip": "string",
    "dob": "string (MM/DD/YYYY)",
    "license_number": "string",
    "expiration": "string (MM/DD/YYYY)"
}
If a field is not visible or readable, use null."""
        
        response = await chat.send_message(
            model="gpt-4o-mini",
            system_prompt=system_prompt,
            messages=[UserMessage(content=[image_content, "Extract the license information from this image."])],
            temperature=0.1,
            response_format={"type": "json_object"}
        )
        
        import json
        customer_data = json.loads(response.content)
        
        return LicenseScanResponse(
            success=True,
            customer_data=customer_data,
            confidence=0.85
        )
        
    except Exception as e:
        return LicenseScanResponse(
            success=False,
            error=str(e)
        )


@router.post("/create-customer")
async def create_customer_from_license(
    first_name: str,
    last_name: str,
    address: Optional[str] = None,
    license_number: Optional[str] = None,
    license_image_url: Optional[str] = None
):
    """Create a customer from scanned license data"""
    customer_doc = {
        "id": str(uuid.uuid4()),
        "first_name": first_name,
        "last_name": last_name,
        "address": address or "",
        "phone": "",
        "email": "",
        "license_number": license_number,
        "license_image_url": license_image_url,
        "lead_source": "license_scan",
        "lead_status": "new",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "interactions": []
    }
    
    await customer_repo.insert_one(customer_doc)
    return customer_doc


@router.post("/attach")
async def attach_license_to_customer(request: AttachLicenseRequest):
    """Attach a license image to an existing customer"""
    customer = await customer_repo.find_one({"id": request.customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    await customer_repo.update_one(
        {"id": request.customer_id},
        {
            "$set": {
                "license_image_url": request.license_image_url,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {"success": True}
