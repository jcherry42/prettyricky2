"""
Closr API Server - FEDERAL-GRADE SECURITY
Sales automation tool with CRM-agnostic data integration
"""

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta

# FEDERAL SECURITY IMPORTS
from security.rate_limit import RateLimitMiddleware
from security.audit import AuditLogger

# LLM Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Data Integration
from data_integration import (
    ImportProcessor,
    DataSourceConfig,
    DataSourceType,
    RefreshSchedule,
    init_scheduler,
    get_scheduler,
    shutdown_scheduler,
)
from repositories import CustomerRepository, VehicleRepository, DataSourceRepository
from ai_gateway import gateway as ai_gateway


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection with tuned pool
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,
    minPoolSize=5,
    maxIdleTimeMS=30000,
    connectTimeoutMS=5000,
    serverSelectionTimeoutMS=5000,
)
db = client[os.environ['DB_NAME']]

# Repositories
customer_repo = CustomerRepository(db)
vehicle_repo = VehicleRepository(db)
source_repo = DataSourceRepository(db)

# Import processor
import_processor = ImportProcessor()

# A/B Testing Service
from ab_testing_service import ab_testing_service, Experiment, DEFAULT_EXPERIMENTS


# ============== LIFESPAN ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    # Startup
    logger.info("Starting Closr API server - FEDERAL-GRADE SECURITY ENABLED...")
    
    # Initialize FEDERAL SECURITY
    global audit_logger
    audit_logger = AuditLogger(db)
    await audit_logger.create_indexes()
    logger.info("✅ Audit logging initialized")
    
    # Initialize auth router with database
    # PIN auth replaces email/password auth
    # from auth_endpoints import init_auth_router
    # init_auth_router(db, audit_logger)
    logger.info("✅ Auth router initialized")
    
    # Initialize repositories
    await customer_repo.create_indexes()
    await vehicle_repo.create_indexes()
    await source_repo.create_indexes()
    
    # Initialize integration layer
    from integrations import IntegrationManager
    from integrations.webhooks import FortifiedWebhookReceiver
    from integrations.profiles import ProfileManager
    
    integration_mgr = IntegrationManager(db)
    webhook_recv = FortifiedWebhookReceiver(db)
    profile_mgr = ProfileManager(db)
    
    await integration_mgr.create_indexes()
    await webhook_recv.create_indexes()
    await profile_mgr.create_indexes()
    await profile_mgr.ensure_builtin_profiles()
    
    # Initialize A/B Testing
    await ab_testing_service.initialize(db)
    for exp in DEFAULT_EXPERIMENTS:
        await ab_testing_service.create_experiment(Experiment(**exp))
    logger.info("A/B Testing service initialized with default experiments")
    
    # Initialize conversation history indexes (once at startup, not per-request)
    from conversation_history import ConversationHistoryService
    _conv_svc = ConversationHistoryService(db)
    await _conv_svc.initialize()
    app.state.conversation_service = _conv_svc
    logger.info("✅ Conversation history service initialized")
    
    # Initialize analytics service singleton
    from analytics_service import AnalyticsService
    app.state.analytics_service = AnalyticsService(db)
    logger.info("✅ Analytics service initialized")
    
    logger.info("Integration layer initialized")
    
    # Initialize TTS cache indexes (MongoDB-backed, 24h TTL)
    await ensure_tts_indexes()
    logger.info("✅ TTS cache indexes ensured")
    
    # Initialize scheduler
    await init_scheduler(db)

    # Initialize AI Gateway with DB for telemetry
    ai_gateway.init(db=db)
    logger.info("✅ AI Gateway initialised")

    # Initialize Vector Search + Sales Knowledge Base
    from vector_search import VectorSearchService
    from sales_knowledge_base import seed_knowledge_base
    vector_svc = VectorSearchService(db)
    await vector_svc.ensure_indexes()
    app.state.vector_search = vector_svc
    logger.info("✅ Vector Search service initialized")

    # Seed knowledge base in background (idempotent — skips duplicates)
    async def _seed_kb():
        try:
            count = await seed_knowledge_base(vector_svc)
            logger.info(f"✅ Sales knowledge base seeded ({count} entries)")
        except Exception as e:
            logger.warning(f"Knowledge base seed failed (non-fatal): {e}")
    asyncio.create_task(_seed_kb())

    # Initialize Telemetry Service
    from telemetry_service import TelemetryService
    telemetry_svc = TelemetryService(db)
    await telemetry_svc.ensure_indexes()
    telemetry_svc._init_posthog()
    app.state.telemetry = telemetry_svc
    logger.info("✅ Telemetry service initialized")

    # Inject vector search + telemetry into Tower Talk routes
    from routes.tower_talk_v2 import init_tower_talk_routes as _reinit_tt
    _reinit_tt(vector_search=vector_svc, telemetry=telemetry_svc)
    logger.info("✅ Tower Talk enriched with vector search + telemetry")

    logger.info("Server startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    shutdown_scheduler()
    client.close()
    logger.info("Shutdown complete")


# Create app with lifespan
app = FastAPI(lifespan=lifespan)

# GZip compression for all responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)

# Structured logging with correlation IDs (Phase 3)
from middleware.correlation import CorrelationMiddleware
app.add_middleware(CorrelationMiddleware)

# Create API router
api_router = APIRouter(prefix="/api")

# ============== ROUTE MODULES (PRODUCTION REFACTOR) ==============
# Refactor: move high-churn domain endpoints into dedicated routers.
# Goal: isolate concerns, enable targeted testing, prevent regression.
from routes.printer_v2 import router as printer_router_v2, init_printer_routes as init_printer_routes_v2
from routes.vehicles_v2 import router as vehicles_router_v2, init_vehicle_routes as init_vehicle_routes_v2
from routes.tower_talk_v2 import router as tower_talk_router_v2, init_tower_talk_routes as init_tower_talk_routes_v2
from routes.customers_v2 import router as customers_router_v2, init_customer_routes as init_customer_routes_v2
from routes.vin_v2 import router as vin_router_v2, init_vin_routes as init_vin_routes_v2

# Phase 2 refactor: extracted domain modules
from routes.tts_voice import router as tts_voice_router, init_tts_voice_routes, ensure_tts_indexes
from routes.ai_features import router as ai_features_router, init_ai_features_routes
from routes.data_management import router as data_mgmt_router, init_data_management_routes
from routes.integrations_routes import router as integrations_router, init_integrations_routes
from routes.pin_auth import router as pin_auth_router, init_pin_auth_routes

init_printer_routes_v2(db)
init_vehicle_routes_v2(db, vehicle_repo)
init_tower_talk_routes_v2(os.environ.get('EMERGENT_LLM_KEY', ''))
init_customer_routes_v2(db, customer_repo)
init_vin_routes_v2(db)
init_tts_voice_routes(db)
init_ai_features_routes(db, ab_testing_service=ab_testing_service)
init_data_management_routes(db, customer_repo, vehicle_repo, source_repo, import_processor, get_scheduler)
init_integrations_routes(db)
init_pin_auth_routes(db)

api_router.include_router(printer_router_v2)
api_router.include_router(vehicles_router_v2)
api_router.include_router(tower_talk_router_v2)
api_router.include_router(customers_router_v2)
api_router.include_router(vin_router_v2)
api_router.include_router(tts_voice_router)
api_router.include_router(ai_features_router)
api_router.include_router(data_mgmt_router)
api_router.include_router(integrations_router)
api_router.include_router(pin_auth_router)


# ============== HEALTH & STATUS ==============

@api_router.get("/ai/stats")
async def ai_gateway_stats():
    """AI Gateway observability — cost, latency, cache, circuit breakers."""
    return ai_gateway.stats()


# ============== VECTOR SEARCH / KNOWLEDGE BASE ==============

@api_router.get("/knowledge/stats")
async def knowledge_stats(request: Request):
    """Vector search + knowledge base statistics."""
    vs = request.app.state.vector_search
    return await vs.stats()


@api_router.post("/knowledge/search")
async def knowledge_search(request: Request, body: dict):
    """Semantic search across the sales knowledge base."""
    vs = request.app.state.vector_search
    query = body.get("query", "")
    category = body.get("category")
    top_k = body.get("top_k", 5)
    if not query:
        raise HTTPException(status_code=400, detail="query is required")
    results = await vs.search_knowledge(query, category=category, top_k=top_k)
    return {"results": results, "count": len(results)}


@api_router.post("/knowledge/seed")
async def knowledge_seed(request: Request):
    """Re-seed the sales knowledge base (idempotent)."""
    from sales_knowledge_base import seed_knowledge_base
    vs = request.app.state.vector_search
    count = await seed_knowledge_base(vs)
    return {"seeded": count}


# ============== TELEMETRY ==============

@api_router.get("/telemetry/summary")
async def telemetry_summary(request: Request, hours: int = 24):
    """Telemetry event summary."""
    telem = request.app.state.telemetry
    return await telem.get_summary(hours=hours)


@api_router.get("/telemetry/sales-funnel")
async def telemetry_sales_funnel(request: Request, days: int = 30):
    """Sales funnel analytics from telemetry."""
    telem = request.app.state.telemetry
    return await telem.get_sales_funnel(days=days)


@api_router.get("/telemetry/ai-usage")
async def telemetry_ai_usage(request: Request, days: int = 7):
    """AI feature usage breakdown."""
    telem = request.app.state.telemetry
    return await telem.get_ai_usage_breakdown(days=days)


@api_router.post("/telemetry/track")
async def telemetry_track(request: Request, body: dict):
    """Track a client-side telemetry event."""
    telem = request.app.state.telemetry
    category = body.get("category", "user_actions")
    action = body.get("action", "unknown")
    properties = body.get("properties", {})
    session_id = body.get("session_id")
    await telem.track(category, action, properties, session_id=session_id)
    return {"tracked": True}


@api_router.get("/")
async def root():
    return {"message": "Closr API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    scheduler = get_scheduler()
    scheduler_status = scheduler.get_status() if scheduler else {"isRunning": False}
    
    source_health = await source_repo.get_health_summary()
    
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scheduler": scheduler_status,
        "dataSources": source_health
    }


# ============== ENTERPRISE DRIVER'S LICENSE SCANNING ==============

# Configure uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
LICENSE_CHUNKS_DIR = UPLOADS_DIR / "chunks"
LICENSE_CHUNKS_DIR.mkdir(exist_ok=True)

class LicenseScanResponse(BaseModel):
    """Response for license scan with OCR extraction"""
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


def normalize_name(name: str) -> str:
    """Normalize a name to proper title case"""
    if not name:
        return name
    # Handle all-caps or all-lowercase
    return ' '.join(word.capitalize() for word in name.strip().split())


def normalize_state(state: str) -> str:
    """Normalize state to 2-letter abbreviation"""
    if not state:
        return state
    state = state.strip().upper()
    
    # Already 2 letters
    if len(state) == 2:
        return state
    
    # Common state name mappings
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
        "WISCONSIN": "WI", "WYOMING": "WY", "DISTRICT OF COLUMBIA": "DC"
    }
    return state_map.get(state, state[:2])




def normalize_date_mmddyyyy(value: str) -> Optional[str]:
    """Normalize common expiration date formats to MM/DD/YYYY."""
    if not value:
        return value
    import re

    s = str(value).strip()
    digits = re.sub(r"[^0-9]", "", s)

    # Most common: YYYYMMDD
    if len(digits) == 8:
        yyyy = digits[0:4]
        mm = digits[4:6]
        dd = digits[6:8]
        try:
            mmi = int(mm)
            ddi = int(dd)
            if 1 <= mmi <= 12 and 1 <= ddi <= 31:
                return f"{mm}/{dd}/{yyyy}"
        except Exception:
            pass

        # Alternate: MMDDYYYY
        mm2 = digits[0:2]
        dd2 = digits[2:4]
        yyyy2 = digits[4:8]
        try:
            mmi = int(mm2)
            ddi = int(dd2)
            if 1 <= mmi <= 12 and 1 <= ddi <= 31:
                return f"{mm2}/{dd2}/{yyyy2}"
        except Exception:
            pass

    # Already MM/DD/YYYY or similar
    m = re.search(r"(\d{1,2})\/(\d{1,2})\/(\d{4})", s)
    if m:
        mm, dd, yyyy = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        return f"{mm}/{dd}/{yyyy}"

    return value

def calculate_license_confidence(data: dict) -> tuple:
    """Calculate confidence score and notes for extracted license data"""
    confidence = 0
    notes = []
    
    # Name extraction (40 points)
    if data.get('first_name') and data.get('last_name'):
        confidence += 40
    elif data.get('first_name') or data.get('last_name'):
        confidence += 20
        notes.append("Partial name extracted - please verify")
    else:
        notes.append("Could not extract name")
    
    # Address extraction (35 points)
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
    
    # Validation checks (25 points)
    if data.get('state') and len(data['state']) == 2:
        confidence += 8
    if data.get('zip_code') and len(data['zip_code']) >= 5:
        confidence += 8
    if data.get('first_name') and len(data['first_name']) >= 2:
        confidence += 4

    # License-specific fields (5 points)
    if data.get('license_number'):
        confidence += 3
    if data.get('expiration'):
        confidence += 2
    
    return confidence, notes


@api_router.post("/license/scan-direct", response_model=LicenseScanResponse)
async def scan_license_direct(
    image: UploadFile = File(...),
    ml_text_hint: Optional[str] = Form(None),
):
    """
    Single-step license scan: upload image + OCR in one request.
    Optionally accepts ML Kit pre-extracted text as a parsing hint.
    """
    import base64
    import json
    import re

    try:
        image_data = await image.read()
        if not image_data or len(image_data) == 0:
            return LicenseScanResponse(success=False, error="Empty image file")

        if len(image_data) < 5 * 1024:
            return LicenseScanResponse(
                success=False, confidence=0,
                error="Image appears too small for reliable OCR. Please take a clearer photo."
            )

        logger.info(f"scan-direct: received {len(image_data)} bytes")

        # Save to disk (for history / re-scan capability)
        ext = (image.filename or "").rsplit(".", 1)[-1].lower() if image.filename else "jpg"
        if ext not in ("jpg", "jpeg", "png", "webp", "heic"):
            ext = "jpg"
        safe_name = f"license_{uuid.uuid4().hex[:12]}.{ext}"
        filepath = UPLOADS_DIR / safe_name
        filepath.write_bytes(image_data)
        image_url = f"/api/uploads/{safe_name}"

        # Resize for OCR (JPEG — smaller payload, same accuracy)
        from utils.image_processing import resize_image_for_ocr_jpeg
        optimized_data = resize_image_for_ocr_jpeg(image_data)
        base64_image = base64.b64encode(optimized_data).decode('utf-8')

        extraction_prompt = """You are an expert OCR system specialized in reading US Driver's Licenses from all 50 states.

Analyze this driver's license image carefully and extract information EXACTLY as printed.

Return ONLY a JSON object (no markdown, no explanation):
{
  "first_name": "First/Given name (Title Case)",
  "middle_name": "Middle name or null if not visible",
  "last_name": "Last/Family name (Title Case)",
  "license_number": "DL/ID number exactly as printed",
  "expiration": "Expiration date as MM/DD/YYYY",
  "date_of_birth": "Date of birth as MM/DD/YYYY",
  "address": "Street address (number and street only)",
  "city": "City name (Title Case)",
  "state": "2-letter state abbreviation (e.g. CA, TX, NY)",
  "zip_code": "5-digit or 5+4 ZIP code"
}

CRITICAL RULES:
1. NAME may be "LAST, FIRST MIDDLE" or "FIRST MIDDLE LAST" — split correctly
2. Look for labels: DL, LIC, ID #, CUSTOMER ID, DOB, EXP, ISS, CLASS
3. State is ALWAYS a 2-letter abbreviation
4. Convert dates to MM/DD/YYYY regardless of source format
5. Use Title Case for names and city (not ALL CAPS)
6. If a field is unreadable, use null
7. License number: include ALL characters exactly as shown (letters + digits)
8. ZIP: prefer 5-digit, include +4 if clearly visible
9. Address: street only — do NOT include city/state/zip in address field
10. Return ONLY the JSON — no explanations, no markdown fences"""

        # If ML Kit pre-extracted text is available, append as a parsing hint
        if ml_text_hint and len(ml_text_hint.strip()) > 10:
            extraction_prompt += f"\n\nON-DEVICE OCR PRE-EXTRACTION (use as reference to improve accuracy):\n{ml_text_hint.strip()}"
            logger.info(f"scan-direct: ML Kit hint provided ({len(ml_text_hint)} chars)")

        response = await ai_gateway.chat(
            feature='license_ocr',
            prompt=extraction_prompt,
            system_message="You are an expert document OCR system specializing in US driver's licenses from all 50 states. Be precise.",
            images=[base64_image],
        )
        logger.info(f"scan-direct Vision API response ({len(response)} chars)")

        # Parse JSON
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

        # Normalize
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

        confidence, notes = calculate_license_confidence(extracted_data)
        has_name = extracted_data.get('first_name') or extracted_data.get('last_name')

        if not has_name:
            return LicenseScanResponse(
                success=False,
                image_url=image_url,
                confidence=0,
                extraction_notes=["Could not read name from license"],
                error="Could not extract name. Please ensure the license is clearly visible and well-lit."
            )

        logger.info(f"scan-direct extracted: {extracted_data.get('first_name')} {extracted_data.get('last_name')} (confidence: {confidence}%)")

        return LicenseScanResponse(
            success=True,
            image_url=image_url,
            extracted_data=extracted_data,
            confidence=confidence,
            extraction_notes=notes if notes else None,
        )

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error in scan-direct: {e}")
        return LicenseScanResponse(
            success=False, confidence=0,
            error="Could not read license data. Please try again with a clearer photo."
        )
    except Exception as e:
        logger.error(f"scan-direct error: {e}", exc_info=True)
        return LicenseScanResponse(
            success=False, confidence=0,
            error=f"Scan failed: {str(e)}"
        )


@api_router.post("/license/create-customer")
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
    """
    Create a new customer from extracted license data.
    Saves both the extracted info and the license image.
    """
    try:
        # Normalize key fields
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

        # Build full address string
        address_parts = []
        if address:
            address_parts.append(address)
        if city:
            address_parts.append(city)
        if state:
            address_parts.append(state)
        if zip_code:
            address_parts.append(zip_code)
        
        full_address = ', '.join(filter(None, address_parts))
        
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
        
        await db.customers.insert_one(customer_doc)
        
        # Remove _id for response
        customer_doc.pop('_id', None)
        
        logger.info(f"Customer created from license: {customer_doc['name']}")
        
        return {
            "success": True,
            "customer": customer_doc,
            "message": f"Customer {customer_doc['name']} created successfully"
        }
        
    except Exception as e:
        logger.error(f"Create customer from license error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/license/upload/init", response_model=LicenseUploadInitResponse)
async def init_license_upload(request: LicenseUploadInitRequest):
    """Initialize chunked license upload."""
    import json

    try:
        if request.total_size > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large (max 15MB).")
        if request.total_chunks <= 0:
            raise HTTPException(status_code=400, detail="Invalid chunk count")

        upload_id = uuid.uuid4().hex
        upload_dir = LICENSE_CHUNKS_DIR / upload_id
        upload_dir.mkdir(parents=True, exist_ok=True)

        expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        meta = {
            "upload_id": upload_id,
            "filename": request.filename,
            "content_type": request.content_type,
            "total_size": request.total_size,
            "total_chunks": request.total_chunks,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": expires_at
        }

        with open(upload_dir / "meta.json", "w") as f:
            json.dump(meta, f)

        return LicenseUploadInitResponse(upload_id=upload_id, expires_at=expires_at)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"License upload init error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/license/upload/chunk", response_model=LicenseUploadChunkResponse)
async def upload_license_chunk(
    upload_id: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    chunk: UploadFile = File(...),
):
    """Upload a single chunk for a license image."""
    import json

    upload_dir = LICENSE_CHUNKS_DIR / upload_id
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
        success=True,
        upload_id=upload_id,
        received=chunk_index + 1,
        total_chunks=expected_chunks
    )


@api_router.post("/license/upload/complete", response_model=LicenseUploadResponse)
async def complete_license_upload(
    upload_id: str = Form(...),
    customer_id: Optional[str] = Form(None),
):
    """Assemble uploaded chunks into a final license image."""
    import json
    import shutil

    upload_dir = LICENSE_CHUNKS_DIR / upload_id
    meta_path = upload_dir / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Upload session not found")

    meta = json.loads(meta_path.read_text())
    total_chunks = int(meta.get("total_chunks", 0))
    if total_chunks <= 0:
        raise HTTPException(status_code=400, detail="Invalid upload metadata")

    # Validate all chunks exist
    for i in range(total_chunks):
        chunk_path = upload_dir / f"chunk_{i:06d}.part"
        if not chunk_path.exists():
            raise HTTPException(status_code=400, detail=f"Missing chunk {i}")

    filename_source = meta.get("filename", "image.jpg")
    ext = Path(filename_source).suffix.lower().replace(".", "")
    if ext not in ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']:
        ext = 'jpg'

    filename = f"license_{uuid.uuid4().hex[:12]}.{ext}"
    filepath = UPLOADS_DIR / filename

    with open(filepath, "wb") as out:
        for i in range(total_chunks):
            chunk_path = upload_dir / f"chunk_{i:06d}.part"
            with open(chunk_path, "rb") as part:
                shutil.copyfileobj(part, out)

    image_url = f"/api/uploads/{filename}"

    # Cleanup
    shutil.rmtree(upload_dir, ignore_errors=True)

    if customer_id:
        result = await db.customers.find_one_and_update(
            {"id": customer_id},
            {
                "$set": {
                    "license_image_url": image_url,
                    "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()
                }
            },
            return_document=True
        )

        if result:
            customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
            return LicenseUploadResponse(
                success=True,
                image_url=image_url,
                customer_id=customer_id,
                customer_name=customer_name or "Customer"
            )

        return LicenseUploadResponse(
            success=True,
            image_url=image_url,
            error="Customer not found, but image was saved"
        )

    return LicenseUploadResponse(success=True, image_url=image_url)


@api_router.post("/license/upload", response_model=LicenseUploadResponse)
async def upload_license_image(
    image: UploadFile = File(...),
    customer_id: Optional[str] = Form(None),
):
    """
    Upload a driver's license image and attach it to a customer profile.
    (No OCR - use /license/scan for extraction)
    
    The image is stored and its URL is saved to the customer's profile.
    This image will be included when using the Eject feature to send
    customer info via SMS/MMS.
    """
    import base64
    
    try:
        logger.info(f"License upload request: {image.filename}, customer_id: {customer_id}")
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
        content_type = image.content_type or ''
        
        if content_type not in allowed_types:
            ext = (image.filename or '').split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']:
                return LicenseUploadResponse(
                    success=False,
                    error="Invalid image format. Please upload JPG, PNG, or WEBP."
                )
        
        # Read image data
        image_data = await image.read()
        
        if len(image_data) == 0:
            return LicenseUploadResponse(success=False, error="Empty image file received")
        
        if len(image_data) > 10 * 1024 * 1024:  # 10MB limit for license images
            return LicenseUploadResponse(success=False, error="Image too large. Max 10MB.")
        
        # Generate unique filename
        ext = (image.filename or 'image.jpg').split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp']:
            ext = 'jpg'
        filename = f"license_{uuid.uuid4().hex[:12]}.{ext}"
        filepath = UPLOADS_DIR / filename
        
        # Save file to disk
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        # Construct the URL path for the uploaded image
        image_url = f"/api/uploads/{filename}"
        
        logger.info(f"License image saved: {filepath}, URL: {image_url}")
        
        # If customer_id provided, attach to existing customer
        if customer_id:
            result = await db.customers.find_one_and_update(
                {"id": customer_id},
                {
                    "$set": {
                        "license_image_url": image_url,
                        "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                return_document=True
            )
            
            if result:
                customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
                return LicenseUploadResponse(
                    success=True,
                    image_url=image_url,
                    customer_id=customer_id,
                    customer_name=customer_name or "Customer"
                )
            else:
                # Customer not found but image was saved
                return LicenseUploadResponse(
                    success=True,
                    image_url=image_url,
                    error="Customer not found, but image was saved"
                )
        
        # No customer_id - just return the image URL
        return LicenseUploadResponse(
            success=True,
            image_url=image_url
        )
        
    except Exception as e:
        logger.error(f"License upload error: {str(e)}", exc_info=True)
        return LicenseUploadResponse(
            success=False,
            error=f"Upload failed: {str(e)}"
        )


@api_router.post("/license/attach")
async def attach_license_to_customer(
    customer_id: str = Form(...),
    image_url: str = Form(...),
):
    """
    Attach a previously uploaded license image to a customer profile.
    """
    try:
        result = await db.customers.find_one_and_update(
            {"id": customer_id},
            {
                "$set": {
                    "license_image_url": image_url,
                    "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()
                }
            },
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
        
        return {
            "success": True,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "license_image_url": image_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Attach license error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Serve uploaded files
from fastapi.responses import FileResponse

@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded license images"""
    filepath = UPLOADS_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Security: ensure the filename is safe (no path traversal)
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Determine content type
    ext = filename.split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp'
    }
    content_type = content_types.get(ext, 'application/octet-stream')
    
    return FileResponse(filepath, media_type=content_type)


# ============== ROUTER & MIDDLEWARE ==============

# Include main API routes
# ─── WebSocket Manager ───────────────────────────────────────────────────────

import asyncio
import json as _json
from typing import Set

class ConnectionManager:
    """Manages WebSocket connections with channel support."""

    def __init__(self):
        self._connections: Set[WebSocket] = set()
        self._channels: dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket, channels: list[str] | None = None):
        await ws.accept()
        async with self._lock:
            self._connections.add(ws)
            for ch in (channels or ["general"]):
                if ch not in self._channels:
                    self._channels[ch] = set()
                self._channels[ch].add(ws)
        logger.info(f"[WS] Client connected. Total: {len(self._connections)}")

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._connections.discard(ws)
            for ch_set in self._channels.values():
                ch_set.discard(ws)
        logger.info(f"[WS] Client disconnected. Total: {len(self._connections)}")

    async def broadcast(self, event: str, data: dict, channel: str = "general"):
        """Send an event to all clients in a channel."""
        payload = _json.dumps({"event": event, "data": data, "ts": datetime.now(timezone.utc).isoformat()})
        async with self._lock:
            targets = list(self._channels.get(channel, set()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)

    async def send_personal(self, ws: WebSocket, event: str, data: dict):
        """Send a message to a single client."""
        try:
            await ws.send_text(_json.dumps({"event": event, "data": data, "ts": datetime.now(timezone.utc).isoformat()}))
        except Exception:
            await self.disconnect(ws)

    @property
    def active_count(self) -> int:
        return len(self._connections)


ws_manager = ConnectionManager()


@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint.

    Query params:
      ?channels=general,print_status,scans  (comma-separated channel list)

    Client messages:
      {"action": "ping"}                    → responds with pong
      {"action": "subscribe", "channel": "x"} → joins channel x
      {"action": "unsubscribe", "channel": "x"}
    """
    channels_param = websocket.query_params.get("channels", "general")
    channels = [c.strip() for c in channels_param.split(",") if c.strip()]

    await ws_manager.connect(websocket, channels)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = _json.loads(raw)
            except _json.JSONDecodeError:
                await ws_manager.send_personal(websocket, "error", {"message": "Invalid JSON"})
                continue

            action = msg.get("action", "")

            if action == "ping":
                await ws_manager.send_personal(websocket, "pong", {"active_clients": ws_manager.active_count})

            elif action == "subscribe":
                ch = msg.get("channel", "general")
                async with ws_manager._lock:
                    if ch not in ws_manager._channels:
                        ws_manager._channels[ch] = set()
                    ws_manager._channels[ch].add(websocket)
                await ws_manager.send_personal(websocket, "subscribed", {"channel": ch})

            elif action == "unsubscribe":
                ch = msg.get("channel", "")
                async with ws_manager._lock:
                    if ch in ws_manager._channels:
                        ws_manager._channels[ch].discard(websocket)
                await ws_manager.send_personal(websocket, "unsubscribed", {"channel": ch})

            else:
                await ws_manager.send_personal(websocket, "ack", {"action": action})

    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"[WS] Error: {e}")
        await ws_manager.disconnect(websocket)


# Expose ws_manager for use by route modules
import builtins
builtins.ws_manager = ws_manager

app.include_router(api_router)

# FEDERAL-LEVEL SECURITY MIDDLEWARE

# 1. Rate Limiting (DDoS Protection)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, burst_size=150)
logger.info("✅ Rate limiting enabled: 100 req/min, 150 burst")

# 2. Security Headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # HSTS - Force HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # XSS Protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://*.emergentagent.com https://*.emergent.run https://*.emergent.com https://deal-closer-ai-3.preview.emergentagent.com"
    )
    # Permissions Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# 3. SECURE CORS - Whitelist only trusted domains
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://deal-closer-ai-3.preview.emergentagent.com",
    os.environ.get('FRONTEND_URL', '')
]
# Filter out empty strings
ALLOWED_ORIGINS = [origin for origin in ALLOWED_ORIGINS if origin]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,  # FEDERAL-LEVEL: NO WILDCARDS
    allow_origin_regex=r"^(https?:\\/\\/(localhost(:\\d+)?|.*\\.emergentagent\\.com|.*\\.emergent\\.run|.*\\.emergent\\.com)|null)$",
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

logger.info(f"✅ CORS configured for: {ALLOWED_ORIGINS}")
logger.info("✅ Security headers enabled")
