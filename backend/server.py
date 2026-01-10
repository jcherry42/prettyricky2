"""
Closr API Server
Sales automation tool with CRM-agnostic data integration
"""

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
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
from datetime import datetime, timezone

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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Repositories
customer_repo = CustomerRepository(db)
vehicle_repo = VehicleRepository(db)
source_repo = DataSourceRepository(db)

# Import processor
import_processor = ImportProcessor()


# ============== LIFESPAN ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    # Startup
    logger.info("Starting Closr API server...")
    
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
    
    logger.info("Integration layer initialized")
    
    # Initialize scheduler
    await init_scheduler(db)
    
    logger.info("Server startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    shutdown_scheduler()
    client.close()
    logger.info("Shutdown complete")


# Create app with lifespan
app = FastAPI(lifespan=lifespan)

# Create API router
api_router = APIRouter(prefix="/api")


# ============== REQUEST/RESPONSE MODELS ==============

class TowerTalkRequest(BaseModel):
    situation: str
    context: Dict[str, Any]

class TowerTalkResponse(BaseModel):
    response: str

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
    type: str  # "url" or "google_sheets"
    url: str
    data_type: str = "customers"
    refresh_schedule: str = "weekdays_10am"

class UpdateDataSourceRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    is_active: Optional[bool] = None
    refresh_schedule: Optional[str] = None
    field_mapping_overrides: Optional[Dict[str, str]] = None


# Supercharg'd Translation Models
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"  # "auto", "en", "es"
    target_lang: str = "es"    # "en", "es"

class TranslateResponse(BaseModel):
    translated_text: str
    detected_lang: Optional[str] = None


# ============== HEALTH & STATUS ==============

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


# ============== TOWER TALK (AI) ==============

@api_router.post("/tower-talk", response_model=TowerTalkResponse)
async def tower_talk(request: TowerTalkRequest):
    """Generate AI-powered personalized sales message"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            logger.error("EMERGENT_LLM_KEY not found in environment")
            raise HTTPException(status_code=500, detail="API key not configured")
        
        ctx = request.context
        customer_name = ctx.get('customerName', 'the customer')
        vehicle = ctx.get('vehicle', 'the vehicle')
        vehicle_price = ctx.get('vehiclePrice', '')
        trade_in = ctx.get('tradeIn')
        dealership = ctx.get('dealershipName', 'our dealership')
        salesperson = ctx.get('salespersonName', 'the sales rep')
        style = ctx.get('salespersonStyle', 'friendly')
        
        style_guidance = {
            'straight_shooter': 'Be direct and honest. Get to the point quickly while remaining professional.',
            'friendly': 'Be warm, personable, and conversational. Build rapport while being helpful.',
            'professional': 'Be polished and formal. Maintain a business-like tone while being approachable.',
        }
        
        tone_guide = style_guidance.get(style, style_guidance['friendly'])
        
        system_message = f"""You are an expert automotive sales consultant helping craft personalized messages.

Your personality: {tone_guide}

Context:
- You work at {dealership}
- Your name is {salesperson}
- Customer: {customer_name}
- Vehicle of interest: {vehicle} {f'at {vehicle_price}' if vehicle_price else ''}
{f'- Customer has trade-in: {trade_in}' if trade_in else ''}

Rules:
1. Write a SINGLE message ready to send via text/iMessage
2. Keep it conversational and human - NOT salesy or pushy
3. Address the specific situation described
4. Be concise (2-4 sentences max)
5. Sign off with just the salesperson's first name
6. DO NOT use emojis
7. DO NOT include any brackets or placeholders
8. Make it feel genuine and helpful"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"tower-talk-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-4.1-mini")
        
        user_message = UserMessage(
            text=f"Situation: {request.situation}\n\nWrite a personalized message for this situation."
        )
        
        response = await chat.send_message(user_message)
        
        return TowerTalkResponse(response=response.strip())
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tower Talk error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")


# ============== SUPERCHARG'D TRANSLATION ==============

@api_router.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """
    Translate text between English and Spanish (Supercharg'd mode)
    Supports auto-detection of source language
    """
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        text = request.text.strip()
        if not text:
            return TranslateResponse(translated_text="", detected_lang=None)
        
        # Determine translation direction
        if request.source_lang == "auto":
            # Auto-detect: ask LLM to detect and translate
            system_message = """You are a professional translator specializing in English and Spanish.
Your task is to:
1. Detect if the input is English or Spanish
2. Translate it to the OTHER language
3. Return ONLY the translation, nothing else

Rules:
- If input is English, translate to Spanish
- If input is Spanish, translate to English
- Maintain the same tone and style
- Keep proper names unchanged
- Preserve any specific automotive/sales terminology appropriately"""
            
            prompt = f"Translate this text (detect language automatically):\n\n{text}"
        else:
            # Explicit direction
            source = "English" if request.source_lang == "en" else "Spanish"
            target = "Spanish" if request.target_lang == "es" else "English"
            
            system_message = f"""You are a professional translator specializing in English and Spanish.
Translate the following text from {source} to {target}.
Return ONLY the translation, nothing else.

Rules:
- Maintain the same tone and style
- Keep proper names unchanged
- Preserve automotive/sales terminology appropriately"""
            
            prompt = text
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"translate-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-4.1-mini")
        
        user_message = UserMessage(text=prompt)
        translated = await chat.send_message(user_message)
        
        # Detect which language it was (simple heuristic based on output)
        detected = None
        if request.source_lang == "auto":
            # If output has Spanish characters/patterns, input was likely English
            spanish_indicators = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡']
            if any(c in translated.lower() for c in spanish_indicators):
                detected = "en"  # Input was English, output is Spanish
            else:
                detected = "es"  # Input was Spanish, output is English
        
        return TranslateResponse(
            translated_text=translated.strip(),
            detected_lang=detected
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


# ============== DATA IMPORT ==============

@api_router.post("/import/preview")
async def preview_import(request: ImportPreviewRequest):
    """
    Preview import - detect mappings and show sample data
    without committing to database
    """
    try:
        result = await import_processor.preview_import(
            request.content,
            request.format,
            request.data_type
        )
        return result
    except Exception as e:
        logger.error(f"Preview error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/import/url")
async def import_from_url(request: ImportUrlRequest):
    """Import data from a URL (JSON, CSV, or Google Sheets)"""
    try:
        result = await import_processor.import_from_url(
            request.url,
            request.data_type,
            request.custom_mapping
        )
        
        if result.success:
            # Store in database (without source_id for direct imports)
            if request.data_type == 'customers':
                stats = await customer_repo.upsert_from_import(
                    result.customers,
                    source_id="direct_import"
                )
            else:
                stats = await vehicle_repo.upsert_from_import(
                    result.vehicles,
                    source_id="direct_import"
                )
            
            return {
                "success": True,
                "stats": {
                    "total": result.total_rows,
                    "imported": result.imported_count,
                    "inserted": stats.get('inserted', 0),
                    "updated": stats.get('updated', 0),
                    "skipped": result.skipped_count
                },
                "mappings": [m.model_dump() for m in result.detected_mappings],
                "errors": result.errors[:10],
                "warnings": result.warnings[:10]
            }
        else:
            return {
                "success": False,
                "errors": result.errors,
                "warnings": result.warnings
            }
            
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/import/file")
async def import_from_file(
    file: UploadFile = File(...),
    data_type: str = Form("customers")
):
    """Import data from uploaded file"""
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Detect format from filename
        filename = file.filename.lower() if file.filename else ""
        if filename.endswith('.json'):
            format = 'json'
        else:
            format = 'csv'
        
        result = await import_processor.import_from_content(
            content_str,
            format,
            data_type
        )
        
        if result.success:
            if data_type == 'customers':
                stats = await customer_repo.upsert_from_import(
                    result.customers,
                    source_id="file_upload"
                )
            else:
                stats = await vehicle_repo.upsert_from_import(
                    result.vehicles,
                    source_id="file_upload"
                )
            
            return {
                "success": True,
                "filename": file.filename,
                "stats": {
                    "total": result.total_rows,
                    "imported": result.imported_count,
                    "inserted": stats.get('inserted', 0),
                    "updated": stats.get('updated', 0),
                    "skipped": result.skipped_count
                },
                "mappings": [m.model_dump() for m in result.detected_mappings],
                "errors": result.errors[:10]
            }
        else:
            return {
                "success": False,
                "errors": result.errors
            }
            
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File encoding not supported. Please use UTF-8.")
    except Exception as e:
        logger.error(f"File import error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============== DATA SOURCES ==============

@api_router.get("/data-sources")
async def list_data_sources():
    """List all configured data sources"""
    sources = await source_repo.find_many(sort=[("name", 1)])
    
    scheduler = get_scheduler()
    next_refresh = scheduler.get_next_scheduled_refresh() if scheduler else None
    
    return {
        "sources": source_repo.to_frontend_format(sources),
        "schedulerStatus": {
            "nextRefresh": next_refresh.isoformat() if next_refresh else None,
            "schedule": "Mon-Sat 10:00 AM ET"
        }
    }

@api_router.post("/data-sources")
async def create_data_source(request: CreateDataSourceRequest):
    """Create a new data source"""
    try:
        # Map string type to enum
        source_type = DataSourceType.GOOGLE_SHEETS if 'google' in request.type.lower() else DataSourceType.URL
        schedule = RefreshSchedule(request.refresh_schedule) if request.refresh_schedule else RefreshSchedule.WEEKDAYS_10AM
        
        config = DataSourceConfig(
            name=request.name,
            type=source_type,
            url=request.url,
            data_type=request.data_type,
            refresh_schedule=schedule
        )
        
        source_id = await source_repo.create_source(config)
        
        # Trigger initial import
        scheduler = get_scheduler()
        if scheduler:
            result = await scheduler.manual_refresh(source_id)
            return {
                "success": True,
                "sourceId": source_id,
                "initialImport": result
            }
        
        return {"success": True, "sourceId": source_id}
        
    except Exception as e:
        logger.error(f"Create source error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/data-sources/{source_id}")
async def get_data_source(source_id: str):
    """Get data source details"""
    source = await source_repo.find_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    return source_repo.to_frontend_format([source])[0]

@api_router.patch("/data-sources/{source_id}")
async def update_data_source(source_id: str, request: UpdateDataSourceRequest):
    """Update data source configuration"""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    success = await source_repo.update_one(source_id, updates)
    
    if not success:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    return {"success": True}

@api_router.delete("/data-sources/{source_id}")
async def delete_data_source(source_id: str):
    """Delete data source and its imported data"""
    source = await source_repo.find_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    # Delete associated data
    data_type = source.get('data_type', 'customers')
    if data_type == 'customers':
        await customer_repo.delete_by_source(source_id)
    else:
        await vehicle_repo.delete_by_source(source_id)
    
    # Delete source config
    await source_repo.delete_one(source_id)
    
    return {"success": True}

@api_router.post("/data-sources/{source_id}/refresh")
async def refresh_data_source(source_id: str):
    """Manually trigger refresh for a data source"""
    scheduler = get_scheduler()
    if not scheduler:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")
    
    result = await scheduler.manual_refresh(source_id)
    return result

@api_router.post("/data-sources/refresh-all")
async def refresh_all_sources():
    """Trigger refresh for all active sources"""
    scheduler = get_scheduler()
    if not scheduler:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")
    
    result = await scheduler.refresh_all_now()
    return result


# ============== CUSTOMERS ==============

@api_router.get("/customers")
async def list_customers(
    status: Optional[str] = None,
    source_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """List customers with optional filters"""
    if search:
        customers = await customer_repo.search(search, limit)
    elif status:
        from data_integration.models import LeadStatus
        customers = await customer_repo.find_by_status(
            LeadStatus(status),
            limit=limit,
            skip=skip
        )
    elif source_id:
        customers = await customer_repo.find_by_source(source_id, limit, skip)
    else:
        customers = await customer_repo.find_many(limit=limit, skip=skip)
    
    return {
        "customers": customer_repo.to_frontend_format(customers),
        "count": len(customers)
    }

@api_router.get("/customers/stats")
async def customer_stats(source_id: Optional[str] = None):
    """Get customer statistics"""
    counts = await customer_repo.get_status_counts(source_id)
    total = await customer_repo.count({"source_id": source_id} if source_id else {})
    
    return {
        "total": total,
        "byStatus": counts
    }


# ============== VEHICLES ==============

@api_router.get("/vehicles")
async def list_vehicles(
    is_new: Optional[bool] = None,
    source_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    summary: bool = False
):
    """List vehicles with optional filters"""
    if search:
        vehicles = await vehicle_repo.search(search, limit)
    elif source_id:
        vehicles = await vehicle_repo.find_by_source(source_id, limit, skip)
    elif is_new is not None:
        vehicles = await vehicle_repo.find_available(is_new, limit, skip)
    else:
        vehicles = await vehicle_repo.find_many(limit=limit, skip=skip)
    
    return {
        "vehicles": vehicle_repo.to_frontend_format(vehicles, summary=summary),
        "count": len(vehicles)
    }

@api_router.get("/vehicles/stats")
async def vehicle_stats(source_id: Optional[str] = None):
    """Get vehicle inventory statistics"""
    return await vehicle_repo.get_inventory_summary(source_id)


# ============== CRM INTEGRATIONS ==============

# Import integration modules
from integrations import IntegrationManager
from integrations.webhooks import FortifiedWebhookReceiver, WebhookAuthMethod

# Initialize managers
integration_manager = IntegrationManager(db)
webhook_receiver = FortifiedWebhookReceiver(db)


# Integration Request Models
class CreateIntegrationRequest(BaseModel):
    name: str
    adapter_type: str
    base_url: str = ""
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    data_type: str = "customers"
    field_mappings: Optional[Dict[str, str]] = None
    mock_mode: bool = False

class UpdateIntegrationRequest(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None
    mock_mode: Optional[bool] = None
    auth_config: Optional[Dict[str, Any]] = None
    field_mappings: Optional[Dict[str, str]] = None

class RegisterWebhookRequest(BaseModel):
    integration_id: str
    name: str
    auth_method: str = "hmac_sha256"
    enabled_events: Optional[List[str]] = None


@api_router.get("/integrations/adapters")
async def list_available_adapters():
    """List all available CRM adapter types"""
    return {
        "adapters": integration_manager.list_available_adapters()
    }

@api_router.get("/integrations/adapters/{adapter_type}")
async def get_adapter_setup(adapter_type: str):
    """Get setup instructions for an adapter type"""
    instructions = integration_manager.get_adapter_setup_instructions(adapter_type)
    if not instructions:
        raise HTTPException(status_code=404, detail="Adapter type not found")
    return instructions


# ============== FIELD DISCOVERY ==============

from integrations.field_discovery import get_discovery_service, CUSTOMER_SCHEMA, VEHICLE_SCHEMA

class DiscoverFieldsRequest(BaseModel):
    base_url: str
    endpoint: str
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    data_type: str = "customers"

class DiscoverFromSampleRequest(BaseModel):
    sample_json: str
    data_type: str = "customers"

@api_router.post("/integrations/discover-fields")
async def discover_fields_from_api(request: DiscoverFieldsRequest):
    """
    Discover fields by fetching a sample from an API
    
    Auto-detects available fields and suggests mappings to our schema.
    """
    discovery = get_discovery_service()
    result = await discovery.discover_from_api(
        base_url=request.base_url,
        endpoint=request.endpoint,
        auth_config=request.auth_config,
        data_type=request.data_type,
    )
    
    return {
        "success": result.success,
        "data_type": result.data_type,
        "discovered_fields": [
            {
                "source_name": f.source_name,
                "source_path": f.source_path,
                "sample_value": f.sample_value,
                "inferred_type": f.inferred_type,
                "suggested_mapping": f.suggested_mapping,
                "confidence": f.confidence,
                "is_mapped": f.is_mapped,
            }
            for f in result.discovered_fields
        ],
        "sample_record": result.sample_record,
        "unmapped_required": result.unmapped_required,
        "errors": result.errors,
        "warnings": result.warnings,
    }

@api_router.post("/integrations/discover-fields/sample")
async def discover_fields_from_sample(request: DiscoverFromSampleRequest):
    """
    Discover fields from a manually pasted JSON sample
    
    For APIs behind firewalls or when auto-fetch isn't possible.
    """
    discovery = get_discovery_service()
    result = discovery.discover_from_sample(
        sample_json=request.sample_json,
        data_type=request.data_type,
    )
    
    return {
        "success": result.success,
        "data_type": result.data_type,
        "discovered_fields": [
            {
                "source_name": f.source_name,
                "source_path": f.source_path,
                "sample_value": f.sample_value,
                "inferred_type": f.inferred_type,
                "suggested_mapping": f.suggested_mapping,
                "confidence": f.confidence,
                "is_mapped": f.is_mapped,
            }
            for f in result.discovered_fields
        ],
        "sample_record": result.sample_record,
        "unmapped_required": result.unmapped_required,
        "errors": result.errors,
        "warnings": result.warnings,
    }

@api_router.get("/integrations/schema/{data_type}")
async def get_target_schema(data_type: str):
    """Get the target schema for mapping fields"""
    if data_type == "customers":
        return {"schema": CUSTOMER_SCHEMA, "required": ["name", "phone"]}
    elif data_type == "vehicles":
        return {"schema": VEHICLE_SCHEMA, "required": ["year", "make", "model"]}
    else:
        raise HTTPException(status_code=400, detail="Invalid data_type. Use 'customers' or 'vehicles'")


# ============== INTEGRATION PROFILES ==============

from integrations.profiles import ProfileManager, IntegrationProfile

profile_manager = ProfileManager(db)

class CreateProfileRequest(BaseModel):
    name: str
    description: str = ""
    adapter_type: str = "generic_rest"
    base_url: str = ""
    auth_method: str = "api_key"
    customers_endpoint: str = "/customers"
    vehicles_endpoint: str = "/vehicles"
    customer_mappings: Dict[str, str] = Field(default_factory=dict)
    vehicle_mappings: Dict[str, str] = Field(default_factory=dict)
    pagination_type: str = "offset"
    page_size: int = 100
    records_path: str = "data"
    is_public: bool = False
    tags: List[str] = Field(default_factory=list)

class ImportProfileRequest(BaseModel):
    json_data: str
    override_name: Optional[str] = None

@api_router.get("/integration-profiles")
async def list_profiles(
    adapter_type: Optional[str] = None,
    public_only: bool = False,
    tags: Optional[str] = None,
    limit: int = 50
):
    """List available integration profiles"""
    tag_list = tags.split(",") if tags else None
    profiles = await profile_manager.list_profiles(
        adapter_type=adapter_type,
        public_only=public_only,
        tags=tag_list,
        limit=limit
    )
    return {"profiles": profiles}

@api_router.post("/integration-profiles")
async def create_profile(request: CreateProfileRequest):
    """Create a new integration profile"""
    import uuid
    
    profile = IntegrationProfile(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        adapter_type=request.adapter_type,
        base_url=request.base_url,
        auth_method=request.auth_method,
        customers_endpoint=request.customers_endpoint,
        vehicles_endpoint=request.vehicles_endpoint,
        customer_mappings=request.customer_mappings,
        vehicle_mappings=request.vehicle_mappings,
        pagination_type=request.pagination_type,
        page_size=request.page_size,
        records_path=request.records_path,
        is_public=request.is_public,
        tags=request.tags,
    )
    
    profile_id = await profile_manager.create_profile(profile)
    return {"success": True, "profile_id": profile_id, "message": f"Profile '{request.name}' created"}

@api_router.get("/integration-profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Get a profile by ID"""
    profile = await profile_manager.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile.to_dict()

@api_router.get("/integration-profiles/{profile_id}/export")
async def export_profile(profile_id: str):
    """Export a profile as JSON"""
    json_data = await profile_manager.export_profile(profile_id)
    if not json_data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"json": json_data}

@api_router.post("/integration-profiles/import")
async def import_profile(request: ImportProfileRequest):
    """Import a profile from JSON"""
    success, message, profile_id = await profile_manager.import_profile(
        json_data=request.json_data,
        override_name=request.override_name
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message, "profile_id": profile_id}

@api_router.delete("/integration-profiles/{profile_id}")
async def delete_profile(profile_id: str):
    """Delete a profile"""
    # Prevent deletion of built-in profiles
    if profile_id.startswith("builtin_"):
        raise HTTPException(status_code=400, detail="Cannot delete built-in profiles")
    
    success = await profile_manager.delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True}

@api_router.patch("/integration-profiles/{profile_id}")
async def update_profile(profile_id: str, updates: Dict[str, Any]):
    """Update a profile"""
    # Prevent modification of built-in profiles
    if profile_id.startswith("builtin_"):
        raise HTTPException(status_code=400, detail="Cannot modify built-in profiles")
    
    success = await profile_manager.update_profile(profile_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True}


# ============== INTEGRATIONS CRUD ==============

@api_router.get("/integrations")
async def list_integrations(active_only: bool = False, adapter_type: Optional[str] = None):
    """List all configured integrations"""
    integrations = await integration_manager.list_integrations(
        active_only=active_only,
        adapter_type=adapter_type
    )
    return {"integrations": integrations}

@api_router.post("/integrations")
async def create_integration(request: CreateIntegrationRequest):
    """Create a new CRM integration"""
    try:
        integration_id = await integration_manager.create_integration(
            name=request.name,
            adapter_type=request.adapter_type,
            base_url=request.base_url,
            auth_config=request.auth_config,
            data_type=request.data_type,
            field_mappings=request.field_mappings,
            mock_mode=request.mock_mode,
        )
        return {
            "success": True,
            "integration_id": integration_id,
            "message": f"Integration '{request.name}' created successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create integration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/integrations/health")
async def get_integrations_health():
    """Get health status of all integrations"""
    return await integration_manager.get_health_summary()

@api_router.get("/integrations/{integration_id}")
async def get_integration(integration_id: str):
    """Get integration details"""
    integration = await integration_manager.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration

@api_router.get("/integrations/{integration_id}/health")
async def get_integration_health(integration_id: str):
    """Get detailed health for a specific integration"""
    health = await integration_manager.get_integration_health(integration_id)
    if "error" in health:
        raise HTTPException(status_code=404, detail=health["error"])
    return health

@api_router.patch("/integrations/{integration_id}")
async def update_integration(integration_id: str, request: UpdateIntegrationRequest):
    """Update integration configuration"""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    success = await integration_manager.update_integration(integration_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return {"success": True}

@api_router.delete("/integrations/{integration_id}")
async def delete_integration(integration_id: str):
    """Delete an integration"""
    success = await integration_manager.delete_integration(integration_id)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True}

@api_router.post("/integrations/{integration_id}/test")
async def test_integration_connection(integration_id: str):
    """Test connection to the CRM"""
    result = await integration_manager.test_connection(integration_id)
    return result

@api_router.post("/integrations/{integration_id}/sync")
async def sync_integration(integration_id: str, full_sync: bool = False):
    """Trigger a data sync from the CRM"""
    result = await integration_manager.sync_integration(integration_id, full_sync=full_sync)
    return {
        "success": result.success,
        "records_fetched": result.total_records,
        "pages_fetched": result.pages_fetched,
        "duration_ms": result.fetch_duration_ms,
        "errors": result.errors[:10] if result.errors else [],
        "warnings": result.warnings[:10] if result.warnings else [],
    }

@api_router.post("/integrations/{integration_id}/toggle-mock")
async def toggle_integration_mock_mode(integration_id: str, enabled: bool):
    """Toggle mock mode for an integration"""
    success = await integration_manager.toggle_mock_mode(integration_id, enabled)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True, "mock_mode": enabled}


# ============== WEBHOOKS ==============

@api_router.get("/webhooks")
async def list_webhooks(integration_id: Optional[str] = None, active_only: bool = False):
    """List all webhooks"""
    webhooks = await webhook_receiver.list_webhooks(
        integration_id=integration_id,
        active_only=active_only
    )
    return {"webhooks": webhooks}

@api_router.post("/webhooks")
async def register_webhook(request: RegisterWebhookRequest):
    """Register a new webhook endpoint"""
    try:
        auth_method = WebhookAuthMethod(request.auth_method)
    except ValueError:
        auth_method = WebhookAuthMethod.HMAC_SHA256
    
    config = await webhook_receiver.register_webhook(
        integration_id=request.integration_id,
        name=request.name,
        auth_method=auth_method,
        enabled_events=request.enabled_events,
    )
    
    return {
        "success": True,
        "webhook_id": config.id,
        "endpoint_url": f"/api/webhooks/{config.id}/receive",
        "credentials": {
            "hmac_secret": config.auth.hmac_secret,
            "api_key": config.auth.api_key,
            "signature_header": config.auth.signature_header,
        }
    }

@api_router.get("/webhooks/{webhook_id}")
async def get_webhook(webhook_id: str):
    """Get webhook details"""
    config = await webhook_receiver.get_webhook(webhook_id)
    if not config:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return {
        "id": config.id,
        "name": config.name,
        "integration_id": config.integration_id,
        "auth_method": config.auth.method.value,
        "is_active": config.is_active,
        "events_received": config.events_received,
        "events_processed": config.events_processed,
        "last_event_at": config.last_event_at.isoformat() if config.last_event_at else None,
    }

@api_router.get("/webhooks/{webhook_id}/stats")
async def get_webhook_stats(webhook_id: str):
    """Get detailed webhook statistics"""
    return await webhook_receiver.get_webhook_stats(webhook_id)

@api_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str):
    """Delete a webhook"""
    success = await webhook_receiver.delete_webhook(webhook_id)
    if not success:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"success": True}

@api_router.post("/webhooks/{webhook_id}/rotate")
async def rotate_webhook_credentials(webhook_id: str):
    """Rotate webhook credentials"""
    new_creds = await webhook_receiver.rotate_credentials(webhook_id)
    return {
        "success": True,
        "credentials": new_creds
    }

@api_router.post("/webhooks/{webhook_id}/receive")
async def receive_webhook(
    webhook_id: str,
    request: Dict[str, Any] = None,
):
    """
    Receive and process a webhook event
    
    This is the endpoint CRMs will POST to with event data.
    """
    from fastapi import Request
    # Note: In a real implementation, we'd get raw body and headers from Request object
    # For now, we'll handle the JSON body directly
    
    # Convert request body to bytes for signature verification
    import json
    payload = json.dumps(request or {}).encode('utf-8')
    
    result = await webhook_receiver.receive_event(
        webhook_id=webhook_id,
        payload=payload,
        headers={},  # Would come from Request.headers in production
        source_ip=None,  # Would come from Request.client.host
    )
    
    if not result.get("success"):
        status_code = result.get("code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error"))
    
    return result

@api_router.get("/webhooks/{webhook_id}/events")
async def get_webhook_events(
    webhook_id: str,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get recent events for a webhook"""
    events = await webhook_receiver.get_events(
        webhook_id=webhook_id,
        status=status,
        limit=limit
    )
    return {"events": events}


# ============== ROUTER & MIDDLEWARE ==============

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
