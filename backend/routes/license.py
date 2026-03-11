"""License scanning routes — extracted from server.py.

Handles all driver's license image upload, OCR, customer creation,
and chunked upload endpoints.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from pathlib import Path
from datetime import datetime, timezone, timedelta
import uuid
import logging
import re
import json
import base64
import shutil

logger = logging.getLogger(__name__)

router = APIRouter()

# Module-level references (set by init_license_routes)
_db = None
_ai_gateway = None
_uploads_dir: Path = None
_chunks_dir: Path = None


def init_license_routes(db, ai_gateway, uploads_dir: Path):
    global _db, _ai_gateway, _uploads_dir, _chunks_dir
    _db = db
    _ai_gateway = ai_gateway
    _uploads_dir = uploads_dir
    _chunks_dir = uploads_dir / "chunks"
    _chunks_dir.mkdir(exist_ok=True)


# ─── Models ──────────────────────────────────────────────────────────

class LicenseScanResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    extracted_data: Optional[dict] = None
    confidence: Optional[float] = None
    extraction_notes: Optional[List[str]] = None
    error: Optional[str] = None


class LicenseUploadResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    error: Optional[str] = None


class LicenseUploadInitRequest(BaseModel):
    filename: str
    content_type: Optional[str] = None
    total_size: int
    total_chunks: int


class LicenseUploadInitResponse(BaseModel):
    upload_id: str
    expires_at: Optional[str] = None


class LicenseUploadChunkResponse(BaseModel):
    success: bool
    upload_id: str
    received: int
    total_chunks: int


# ─── Helpers ─────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    if not name:
        return name
    return ' '.join(word.capitalize() for word in name.strip().split())


def normalize_state(state: str) -> str:
    if not state:
        return state
    state = state.strip().upper()
    if len(state) == 2:
        return state
    state_map = {
        "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR",
        "CALIFORNIA": "CA", "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE",
        "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID",
        "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
        "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
        "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS",
        "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV",
        "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
        "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
        "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
        "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT",
        "VERMONT": "VT", "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV",
        "WISCONSIN": "WI", "WYOMING": "WY", "DISTRICT OF COLUMBIA": "DC",
    }
    return state_map.get(state, state[:2])


def normalize_date_mmddyyyy(value: str) -> Optional[str]:
    if not value:
        return value
    s = str(value).strip()
    digits = re.sub(r"[^0-9]", "", s)

    if len(digits) == 8:
        yyyy, mm, dd = digits[0:4], digits[4:6], digits[6:8]
        try:
            if 1 <= int(mm) <= 12 and 1 <= int(dd) <= 31:
                return f"{mm}/{dd}/{yyyy}"
        except Exception:
            pass
        mm2, dd2, yyyy2 = digits[0:2], digits[2:4], digits[4:8]
        try:
            if 1 <= int(mm2) <= 12 and 1 <= int(dd2) <= 31:
                return f"{mm2}/{dd2}/{yyyy2}"
        except Exception:
            pass

    m = re.search(r"(\d{1,2})\/(\d{1,2})\/(\d{4})", s)
    if m:
        return f"{m.group(1).zfill(2)}/{m.group(2).zfill(2)}/{m.group(3)}"

    return value


def calculate_license_confidence(data: dict) -> tuple:
    confidence = 0
    notes = []
    if data.get('first_name') and data.get('last_name'):
        confidence += 40
    elif data.get('first_name') or data.get('last_name'):
        confidence += 20
        notes.append("Partial name extracted - please verify")
    else:
        notes.append("Could not extract name")
    if data.get('address'):
        confidence += 20
        if data.get('city'):
            confidence += 5
        if data.get('state'):
            confidence += 5
        if data.get('zip_code'):
            confidence += 5
    else:
        notes.append("Address may need manual entry")
    if data.get('state') and len(data['state']) == 2:
        confidence += 8
    if data.get('zip_code') and len(data['zip_code']) >= 5:
        confidence += 8
    if data.get('first_name') and len(data['first_name']) >= 2:
        confidence += 4
    if data.get('license_number'):
        confidence += 3
    if data.get('expiration'):
        confidence += 2
    return confidence, notes


# ─── Endpoints ───────────────────────────────────────────────────────

@router.post("/license/scan-direct", response_model=LicenseScanResponse)
async def scan_license_direct(
    image: UploadFile = File(...),
    ml_text_hint: Optional[str] = Form(None),
):
    """High-performance license scan: upload image + OCR in one request.

    Target: <700ms full pipeline.
    Optimizations: GPT-4o-mini, JPEG 80% quality, 1536px max, compact prompt.
    """
    import time as _time
    t_start = _time.monotonic()

    try:
        image_data = await image.read()
        if not image_data or len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")

        if len(image_data) < 5 * 1024:
            raise HTTPException(
                status_code=400,
                detail="Image appears too small for reliable OCR. Please take a clearer photo.",
            )

        logger.info(f"scan-direct: received {len(image_data)} bytes")

        ext = (image.filename or "").rsplit(".", 1)[-1].lower() if image.filename else "jpg"
        if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
            ext = "jpg"

        # Optimize image BEFORE disk save — smaller file, faster API call
        from utils.image_processing import resize_image_for_ocr_jpeg
        optimized_data = resize_image_for_ocr_jpeg(image_data)
        base64_image = base64.b64encode(optimized_data).decode('utf-8')

        # Save optimized image to disk (async-safe, smaller file)
        safe_name = f"license_{uuid.uuid4().hex[:12]}.{ext}"
        filepath = _uploads_dir / safe_name
        filepath.write_bytes(optimized_data)
        image_url = f"/api/uploads/{safe_name}"

        extraction_prompt = """Extract all fields from this US Driver's License image. Return ONLY a JSON object:
{
  "first_name": "First name, Title Case",
  "middle_name": "Middle name/initial or null",
  "last_name": "Last name, Title Case",
  "license_number": "DL number exactly as printed",
  "expiration": "MM/DD/YYYY",
  "date_of_birth": "MM/DD/YYYY",
  "address": "Street address only (no city/state/zip)",
  "city": "City, Title Case",
  "state": "2-letter state code",
  "zip_code": "5-digit ZIP"
}

Rules: Names shown as "LAST, FIRST MIDDLE" — parse correctly. Copy license number character-by-character (O vs 0, I vs 1). Convert any date format to MM/DD/YYYY. Set unreadable fields to null."""

        if ml_text_hint and len(ml_text_hint.strip()) > 10:
            extraction_prompt += f"""

ON-DEVICE OCR PRE-EXTRACTION (high confidence — use to cross-validate your reading):
---
{ml_text_hint.strip()}
---
Use this pre-extracted text to verify your own reading. Where your reading differs from the OCR text, examine the image more carefully. The OCR text may contain noise but the actual text fragments are usually correct."""
            logger.info(f"scan-direct: ML Kit hint provided ({len(ml_text_hint)} chars)")

        response = await _ai_gateway.chat(
            feature='license_ocr',
            prompt=extraction_prompt,
            system_message="Legal-grade document OCR. Return null for any field you cannot read with high confidence.",
            images=[base64_image],
        )
        logger.info(f"scan-direct Vision API response ({len(response)} chars)")

        cleaned = response.strip()
        if '```' in cleaned:
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned)
            if json_match:
                cleaned = json_match.group(1)
            else:
                cleaned = re.sub(r'^```json?\s*', '', cleaned)
                cleaned = re.sub(r'\s*```$', '', cleaned)

        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            cleaned = json_match.group(0)

        extracted_data = json.loads(cleaned)

        if extracted_data.get('first_name'):
            extracted_data['first_name'] = normalize_name(extracted_data['first_name'])
        if extracted_data.get('last_name'):
            extracted_data['last_name'] = normalize_name(extracted_data['last_name'])
        if extracted_data.get('middle_name'):
            extracted_data['middle_name'] = normalize_name(extracted_data['middle_name'])
        if extracted_data.get('city'):
            extracted_data['city'] = normalize_name(extracted_data['city'])
        if extracted_data.get('state'):
            extracted_data['state'] = normalize_state(extracted_data['state'])
        if extracted_data.get('zip_code'):
            extracted_data['zip_code'] = re.sub(r'[^\d-]', '', str(extracted_data['zip_code']))
        if extracted_data.get('license_number'):
            extracted_data['license_number'] = str(extracted_data['license_number']).strip()
        if extracted_data.get('expiration'):
            extracted_data['expiration'] = normalize_date_mmddyyyy(str(extracted_data['expiration']))
        if extracted_data.get('date_of_birth'):
            extracted_data['date_of_birth'] = normalize_date_mmddyyyy(str(extracted_data['date_of_birth']))

        # ── Post-extraction validation (legal-grade accuracy) ──
        validation_notes = []

        # Validate state is exactly 2 uppercase letters
        st = extracted_data.get('state')
        if st and (len(st) != 2 or not st.isalpha() or not st.isupper()):
            extracted_data['state'] = normalize_state(st)
            if len(extracted_data['state']) != 2:
                extracted_data['state'] = None
                validation_notes.append("State could not be verified — please check")

        # Validate ZIP is 5+ digits
        zc = extracted_data.get('zip_code')
        if zc:
            digits_only = re.sub(r'[^0-9]', '', zc)
            if len(digits_only) < 5:
                extracted_data['zip_code'] = None
                validation_notes.append("ZIP code appears incomplete — please verify")
            elif len(digits_only) == 5:
                extracted_data['zip_code'] = digits_only
            elif len(digits_only) == 9:
                extracted_data['zip_code'] = f"{digits_only[:5]}-{digits_only[5:]}"

        # Validate dates are plausible
        for date_field in ('expiration', 'date_of_birth'):
            dv = extracted_data.get(date_field)
            if dv:
                dm = re.match(r'^(\d{2})/(\d{2})/(\d{4})$', dv)
                if dm:
                    mm, dd, yyyy = int(dm.group(1)), int(dm.group(2)), int(dm.group(3))
                    if not (1 <= mm <= 12 and 1 <= dd <= 31):
                        extracted_data[date_field] = None
                        validation_notes.append(f"{date_field.replace('_',' ').title()} appears invalid — please verify")
                    elif date_field == 'date_of_birth' and (yyyy < 1920 or yyyy > 2010):
                        validation_notes.append(f"Date of birth year ({yyyy}) may be incorrect — please verify")
                    elif date_field == 'expiration' and yyyy < 2020:
                        validation_notes.append(f"License may be expired (exp year {yyyy})")

        # Validate license number has reasonable length
        ln = extracted_data.get('license_number')
        if ln and len(ln) < 4:
            extracted_data['license_number'] = None
            validation_notes.append("License number appears incomplete — please verify")

        # Validate name doesn't contain digits (common OCR error)
        for name_field in ('first_name', 'last_name'):
            nv = extracted_data.get(name_field)
            if nv and re.search(r'\d', nv):
                validation_notes.append(f"{name_field.replace('_',' ').title()} contains digits — please verify")

        confidence, notes = calculate_license_confidence(extracted_data)
        all_notes = validation_notes + (notes or [])
        has_name = extracted_data.get('first_name') or extracted_data.get('last_name')

        if not has_name:
            return LicenseScanResponse(
                success=False, image_url=image_url, confidence=0,
                extraction_notes=["Could not read name from license"],
                error="Could not extract name. Please ensure the license is clearly visible and well-lit.",
            )

        logger.info(f"scan-direct extracted: {extracted_data.get('first_name')} {extracted_data.get('last_name')} (confidence: {confidence}%)")

        total_ms = round((_time.monotonic() - t_start) * 1000, 1)
        logger.info(f"License scan pipeline: {total_ms}ms")

        return LicenseScanResponse(
            success=True, image_url=image_url,
            extracted_data=extracted_data, confidence=confidence,
            extraction_notes=all_notes if all_notes else None,
        )

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in scan-direct: {e}")
        return LicenseScanResponse(success=False, confidence=0, error="Could not read license data. Please try again with a clearer photo.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"scan-direct error: {e}", exc_info=True)
        return LicenseScanResponse(success=False, confidence=0, error=f"Scan failed: {str(e)}")


@router.post("/license/create-customer")
async def create_customer_from_license(
    first_name: str = Form(...),
    last_name: str = Form(...),
    middle_name: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    zip_code: Optional[str] = Form(None),
    license_number: Optional[str] = Form(None),
    expiration: Optional[str] = Form(None),
    dob: Optional[str] = Form(None),
    image_url: str = Form(...),
):
    """Create a new customer from extracted license data."""
    try:
        first_name = normalize_name(first_name)
        last_name = normalize_name(last_name)
        if middle_name:
            middle_name = normalize_name(middle_name)
        if city:
            city = normalize_name(city)
        if state:
            state = normalize_state(state)
        if license_number:
            license_number = str(license_number).strip()
        if expiration:
            expiration = normalize_date_mmddyyyy(expiration)
        if dob:
            dob = normalize_date_mmddyyyy(dob)

        address_parts = [p for p in [address, city, state, zip_code] if p]
        full_address = ', '.join(address_parts)

        customer_id = str(uuid.uuid4())
        customer_doc = {
            "id": customer_id,
            "first_name": first_name,
            "last_name": last_name,
            "middle_name": middle_name,
            "name": f"{first_name} {last_name}",
            "address": full_address,
            "city": city,
            "state": state,
            "zip_code": zip_code,
            "license_number": license_number,
            "license_expiration": expiration,
            "license_dob": dob,
            "license_image_url": image_url,
            "license_image_uploaded_at": datetime.now(timezone.utc).isoformat(),
            "lead_status": "new",
            "lead_source": "license_scan",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        await _db.customers.insert_one(customer_doc)
        customer_doc.pop('_id', None)

        logger.info(f"Customer created from license: {customer_doc['name']}")
        return {"success": True, "customer": customer_doc, "message": f"Customer {customer_doc['name']} created successfully"}
    except Exception as e:
        logger.error(f"Create customer from license error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/license/upload/init", response_model=LicenseUploadInitResponse)
async def init_license_upload(request: LicenseUploadInitRequest):
    """Initialize chunked license upload."""
    try:
        if request.total_size > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large (max 15MB).")
        if request.total_chunks <= 0:
            raise HTTPException(status_code=400, detail="Invalid chunk count")

        upload_id = uuid.uuid4().hex
        upload_dir = _chunks_dir / upload_id
        upload_dir.mkdir(parents=True, exist_ok=True)

        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        meta = {
            "upload_id": upload_id,
            "filename": request.filename,
            "content_type": request.content_type,
            "total_size": request.total_size,
            "total_chunks": request.total_chunks,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at,
        }
        with open(upload_dir / "meta.json", "w") as f:
            json.dump(meta, f)

        return LicenseUploadInitResponse(upload_id=upload_id, expires_at=expires_at)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"License upload init error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/license/upload/chunk", response_model=LicenseUploadChunkResponse)
async def upload_license_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    chunk: UploadFile = File(...),
):
    """Upload a single chunk for a license image."""
    upload_dir = _chunks_dir / upload_id
    meta_path = upload_dir / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")

    meta = json.loads(meta_path.read_text())
    expected_chunks = int(meta.get("total_chunks", 0))
    if expected_chunks <= 0:
        raise HTTPException(status_code=400, detail="Invalid upload metadata")
    if total_chunks != expected_chunks:
        raise HTTPException(status_code=400, detail="Chunk count mismatch")
    if chunk_index < 0 or chunk_index >= expected_chunks:
        raise HTTPException(status_code=400, detail="Chunk index out of range")

    chunk_data = await chunk.read()
    if not chunk_data:
        raise HTTPException(status_code=400, detail="Empty chunk received")

    chunk_path = upload_dir / f"chunk_{chunk_index:06d}.part"
    with open(chunk_path, "wb") as f:
        f.write(chunk_data)

    return LicenseUploadChunkResponse(
        success=True, upload_id=upload_id, received=chunk_index + 1, total_chunks=expected_chunks,
    )


@router.post("/license/upload/complete", response_model=LicenseUploadResponse)
async def complete_license_upload(
    upload_id: str = Form(...),
    customer_id: Optional[str] = Form(None),
):
    """Assemble uploaded chunks into a final license image."""
    upload_dir = _chunks_dir / upload_id
    meta_path = upload_dir / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")

    meta = json.loads(meta_path.read_text())
    total_chunks = int(meta.get("total_chunks", 0))
    if total_chunks <= 0:
        raise HTTPException(status_code=400, detail="Invalid upload metadata")

    for i in range(total_chunks):
        chunk_path = upload_dir / f"chunk_{i:06d}.part"
        if not chunk_path.exists():
            raise HTTPException(status_code=400, detail=f"Missing chunk {i}")

    filename_source = meta.get("filename", "image.jpg")
    ext = Path(filename_source).suffix.lower().replace(".", "")
    if ext not in ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']:
        ext = 'jpg'

    filename = f"license_{uuid.uuid4().hex[:12]}.{ext}"
    filepath = _uploads_dir / filename

    with open(filepath, "wb") as out:
        for i in range(total_chunks):
            chunk_path = upload_dir / f"chunk_{i:06d}.part"
            with open(chunk_path, "rb") as part:
                shutil.copyfileobj(part, out)

    image_url = f"/api/uploads/{filename}"
    shutil.rmtree(upload_dir, ignore_errors=True)

    if customer_id:
        result = await _db.customers.find_one_and_update(
            {"id": customer_id},
            {"$set": {"license_image_url": image_url, "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()}},
            return_document=True,
        )
        if result:
            customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
            return LicenseUploadResponse(success=True, image_url=image_url, customer_id=customer_id, customer_name=customer_name or "Customer")
        return LicenseUploadResponse(success=True, image_url=image_url, error="Customer not found, but image was saved")

    return LicenseUploadResponse(success=True, image_url=image_url)


@router.post("/license/upload", response_model=LicenseUploadResponse)
async def upload_license_image(
    image: UploadFile = File(...),
    customer_id: Optional[str] = Form(None),
):
    """Upload a driver's license image and attach it to a customer profile."""
    try:
        logger.info(f"License upload request: {image.filename}, customer_id: {customer_id}")

        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
        content_type = image.content_type or ''
        if content_type not in allowed_types:
            ext = (image.filename or '').split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']:
                raise HTTPException(status_code=400, detail="Invalid image format. Please upload JPG, PNG, or WEBP.")

        image_data = await image.read()
        if len(image_data) == 0:
            raise HTTPException(status_code=400, detail="Empty image file received")
        if len(image_data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large. Max 10MB.")

        ext = (image.filename or 'image.jpg').split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp']:
            ext = 'jpg'
        filename = f"license_{uuid.uuid4().hex[:12]}.{ext}"
        filepath = _uploads_dir / filename
        with open(filepath, 'wb') as f:
            f.write(image_data)

        image_url = f"/api/uploads/{filename}"
        logger.info(f"License image saved: {filepath}, URL: {image_url}")

        if customer_id:
            result = await _db.customers.find_one_and_update(
                {"id": customer_id},
                {"$set": {"license_image_url": image_url, "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()}},
                return_document=True,
            )
            if result:
                customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
                return LicenseUploadResponse(success=True, image_url=image_url, customer_id=customer_id, customer_name=customer_name or "Customer")
            return LicenseUploadResponse(success=True, image_url=image_url, error="Customer not found, but image was saved")

        return LicenseUploadResponse(success=True, image_url=image_url)
    except Exception as e:
        logger.error(f"License upload error: {str(e)}", exc_info=True)
        return LicenseUploadResponse(success=False, error=f"Upload failed: {str(e)}")


@router.post("/license/attach")
async def attach_license_to_customer(
    customer_id: str = Form(...),
    image_url: str = Form(...),
):
    """Attach a previously uploaded license image to a customer profile."""
    try:
        result = await _db.customers.find_one_and_update(
            {"id": customer_id},
            {"$set": {"license_image_url": image_url, "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()}},
            return_document=True,
        )
        if not result:
            raise HTTPException(status_code=404, detail="Customer not found")
        customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
        return {"success": True, "customer_id": customer_id, "customer_name": customer_name, "license_image_url": image_url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Attach license error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded license images."""
    filepath = _uploads_dir / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    ext = filename.split('.')[-1].lower()
    content_types = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}
    return FileResponse(filepath, media_type=content_types.get(ext, 'application/octet-stream'))
