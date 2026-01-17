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

# A/B Testing Service
from ab_testing_service import ab_testing_service, Experiment, DEFAULT_EXPERIMENTS


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
    
    # Initialize A/B Testing
    await ab_testing_service.initialize(db)
    for exp in DEFAULT_EXPERIMENTS:
        await ab_testing_service.create_experiment(Experiment(**exp))
    logger.info("A/B Testing service initialized with default experiments")
    
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
    """Generate AI-powered personalized sales message with persuasion psychology"""
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
        
        system_message = f"""You are an elite automotive sales consultant and master of ethical persuasion. Your goal is to craft messages that build genuine relationships while strategically moving customers toward a purchase decision.

Your personality: {tone_guide}

Context:
- You work at {dealership}
- Your name is {salesperson}
- Customer: {customer_name}
- Vehicle of interest: {vehicle} {f'at {vehicle_price}' if vehicle_price else ''}
{f'- Customer has trade-in: {trade_in}' if trade_in else ''}

=== PERSUASION PSYCHOLOGY GUIDELINES ===

Apply these proven techniques naturally (pick 1-2 per message based on context):

**PURCHASING TRIGGERS:**
- SCARCITY: Subtly mention limited availability, special timing, or unique opportunities ("This color combo is rare on the lot...")
- URGENCY: Create gentle time-sensitivity without pressure ("End of month is a great time to talk numbers...")
- LOSS AVERSION: Frame around what they might miss, not just what they'll gain ("I'd hate for you to miss this one...")
- SOCIAL PROOF: Reference others' positive experiences ("My last customer with a similar trade was thrilled...")

**RELATIONSHIP BUILDERS:**
- RECIPROCITY: Offer value first - information, help, insider tips ("I pulled some numbers for you...")
- COMMITMENT/CONSISTENCY: Reference their previous interest or statements ("Since you mentioned loving the leather interior...")
- LIKING: Find common ground, give genuine compliments, use their name naturally
- PERSONAL TOUCH: Remember details they shared, show you were listening

**CLOSING PSYCHOLOGY:**
- ASSUMPTIVE FRAMING: Speak as if the sale is natural next step ("When you come in to see it...")
- FUTURE PACING: Paint the picture of ownership ("Imagine pulling into your driveway in this...")
- QUESTION CLOSES: End with easy-to-answer questions that move things forward
- REMOVE RISK: Address concerns before they're raised ("No pressure, just want to show you the options...")

**OBJECTION PREVENTION:**
- ACKNOWLEDGE CONCERNS: Show you understand their hesitation
- REFRAME VALUE: Focus on value over price, experience over specs
- BUILD TRUST: Be transparent, never pushy - long-term relationship over quick sale

=== MESSAGE RULES ===
1. Write a SINGLE message ready to send via text/iMessage
2. Sound like a helpful friend who happens to sell cars - NOT a salesperson
3. Address the specific situation with strategic persuasion woven in naturally
4. Be concise (2-4 sentences max) - every word should earn its place
5. Sign off with just the salesperson's first name
6. DO NOT use emojis
7. DO NOT include any brackets or placeholders
8. The persuasion must be subtle - if it sounds "salesy" you've failed
9. Always maintain integrity - persuade, never manipulate"""

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
    Enterprise-grade translation endpoint
    - Supports 10+ languages
    - Auto-detection
    - Quality metrics
    - Automotive terminology preservation
    """
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        text = request.text.strip()
        if not text:
            return TranslateResponse(translated_text="", detected_lang=None, confidence=0.0)
        
        # Language mapping
        lang_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
            'it': 'Italian', 'pt': 'Portuguese', 'zh': 'Chinese', 'ja': 'Japanese',
            'ko': 'Korean', 'ar': 'Arabic'
        }
        
        logger.info(f"Translation request: {request.source_lang} → {request.target_lang}, length: {len(text)}")
        
        # Build professional translation prompt
        if request.source_lang == "auto":
            system_message = """You are an enterprise-grade professional translator specializing in automotive industry terminology.

Your task:
1. Automatically detect the source language
2. Translate to the target language with perfect accuracy
3. Return ONLY the translated text

Critical Rules:
- Preserve all automotive/sales/technical terminology correctly
- Maintain the exact same tone, formality, and style
- Keep proper names, brands, and model names unchanged
- Preserve formatting (line breaks, bullet points, etc.)
- Handle colloquial/regional expressions appropriately
- Ensure cultural appropriateness for target audience

For automotive terms:
- VIN, ECU, ADAS, OEM, etc. remain unchanged
- Vehicle specs (MPG, HP, torque) maintain units unless specified
- Sales terms (APR, down payment, lease) translate with regional equivalents"""
            
            target_lang_name = lang_names.get(request.target_lang, request.target_lang)
            prompt = f"Detect the language and translate this to {target_lang_name}:\n\n{text}"
        else:
            source_lang_name = lang_names.get(request.source_lang, request.source_lang)
            target_lang_name = lang_names.get(request.target_lang, request.target_lang)
            
            system_message = f"""You are an enterprise-grade professional translator specializing in automotive industry terminology.

Translate the following text from {source_lang_name} to {target_lang_name} with perfect accuracy.
Return ONLY the translated text, no explanations.

Critical Rules:
- Preserve all automotive/sales/technical terminology correctly
- Maintain the exact same tone, formality, and style
- Keep proper names, brands, and model names unchanged
- Preserve formatting (line breaks, bullet points, etc.)
- Handle colloquial/regional expressions appropriately
- Ensure cultural appropriateness for {target_lang_name} audience

For automotive terms:
- VIN, ECU, ADAS, OEM, etc. remain unchanged
- Vehicle specs (MPG, HP, torque) maintain units unless specified
- Sales terms (APR, down payment, lease) translate with regional equivalents"""
            
            prompt = text
        
        start_time = datetime.now(timezone.utc)
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"translate-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=prompt)
        translated = await chat.send_message(user_message)
        
        translation_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        # Detect source language if auto
        detected = None
        confidence = 0.95  # High confidence for GPT-4o
        
        if request.source_lang == "auto":
            # Simple language detection based on character patterns
            if any(c in text for c in ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡']):
                detected = "es"
            elif any('\u4e00' <= c <= '\u9fff' for c in text):  # Chinese characters
                detected = "zh"
            elif any('\u3040' <= c <= '\u309f' or '\u30a0' <= c <= '\u30ff' for c in text):  # Japanese
                detected = "ja"
            elif any('\uac00' <= c <= '\ud7af' for c in text):  # Korean
                detected = "ko"
            elif any('\u0600' <= c <= '\u06ff' for c in text):  # Arabic
                detected = "ar"
            else:
                detected = "en"  # Default to English
        else:
            detected = request.source_lang
        
        # Calculate quality confidence based on text characteristics
        word_count = len(text.split())
        if word_count > 100:
            confidence = 0.98  # Longer texts allow better context
        elif word_count < 5:
            confidence = 0.90  # Very short texts harder to validate
        
        logger.info(f"Translation completed in {translation_time:.2f}s, confidence: {confidence}")
        
        return TranslateResponse(
            translated_text=translated.strip(),
            detected_lang=detected,
            confidence=confidence
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


# ============== OPENAPI SPEC IMPORT ==============

from integrations.openapi_parser import get_openapi_parser

class ParseOpenAPIRequest(BaseModel):
    spec_content: Optional[str] = None
    spec_url: Optional[str] = None

@api_router.post("/integrations/parse-openapi")
async def parse_openapi_spec(request: ParseOpenAPIRequest):
    """
    Parse an OpenAPI/Swagger spec and generate integration configuration
    
    Provide either spec_content (JSON/YAML string) or spec_url (URL to fetch spec)
    """
    parser = get_openapi_parser()
    
    if request.spec_url:
        result = await parser.parse_from_url(request.spec_url)
    elif request.spec_content:
        result = parser.parse_from_string(request.spec_content)
    else:
        raise HTTPException(status_code=400, detail="Provide either spec_content or spec_url")
    
    if not result.success:
        return {
            "success": False,
            "errors": result.errors,
            "warnings": result.warnings,
        }
    
    # Generate profile config
    profile_config = parser.generate_profile_config(result)
    
    return {
        "success": True,
        "spec_version": result.spec_version,
        "api_info": {
            "title": result.title,
            "description": result.description,
            "version": result.version,
        },
        "base_url": result.base_url,
        "servers": result.servers,
        "auth_methods": [
            {
                "method": auth.method,
                "location": auth.location,
                "name": auth.name,
            }
            for auth in result.auth_methods
        ],
        "endpoints": [
            {
                "path": ep.path,
                "method": ep.method,
                "summary": ep.summary,
                "data_type": ep.data_type,
                "confidence": ep.confidence,
                "tags": ep.tags,
            }
            for ep in result.endpoints[:20]  # Limit to 20 endpoints
        ],
        "suggested_config": profile_config,
        "customers_endpoint": {
            "path": result.customers_endpoint.path if result.customers_endpoint else None,
            "confidence": result.customers_endpoint.confidence if result.customers_endpoint else 0,
        },
        "vehicles_endpoint": {
            "path": result.vehicles_endpoint.path if result.vehicles_endpoint else None,
            "confidence": result.vehicles_endpoint.confidence if result.vehicles_endpoint else 0,
        },
        "warnings": result.warnings,
    }


# ============== SMART FIELD SUGGEST ==============

from integrations.smart_suggest import get_smart_suggest_service

class SmartSuggestRequest(BaseModel):
    unmapped_fields: List[Dict[str, Any]]
    data_type: str = "customers"
    use_ai: bool = True

class AnalyzeSampleRequest(BaseModel):
    sample_record: Dict[str, Any]
    data_type: str = "customers"

@api_router.post("/integrations/smart-suggest")
async def smart_suggest_mappings(request: SmartSuggestRequest):
    """
    Get AI-powered field mapping suggestions
    
    Uses pattern detection and LLM analysis to suggest mappings
    for fields that couldn't be auto-mapped.
    """
    service = get_smart_suggest_service()
    result = await service.suggest_mappings(
        unmapped_fields=request.unmapped_fields,
        data_type=request.data_type,
        use_ai=request.use_ai
    )
    
    return {
        "success": result.success,
        "suggestions": [
            {
                "source_field": s.source_field,
                "sample_value": s.sample_value,
                "suggested_target": s.suggested_target,
                "confidence": s.confidence,
                "reason": s.reason,
                "pattern_detected": s.pattern_detected,
            }
            for s in result.suggestions
        ],
        "unmapped_fields": result.unmapped_fields,
        "errors": result.errors,
    }

@api_router.post("/integrations/analyze-sample")
async def analyze_sample_record(request: AnalyzeSampleRequest):
    """
    Analyze a complete sample record and suggest all mappings
    
    Combines auto-detection, pattern matching, and AI analysis
    for comprehensive field mapping suggestions.
    """
    service = get_smart_suggest_service()
    result = await service.analyze_sample_record(
        record=request.sample_record,
        data_type=request.data_type
    )
    
    return {
        "success": result.success,
        "suggestions": [
            {
                "source_field": s.source_field,
                "sample_value": s.sample_value,
                "suggested_target": s.suggested_target,
                "confidence": s.confidence,
                "reason": s.reason,
                "pattern_detected": s.pattern_detected,
            }
            for s in result.suggestions
        ],
        "unmapped_fields": result.unmapped_fields,
        "ai_analysis": result.ai_analysis,
        "errors": result.errors,
    }


# ============== FIELD TRANSFORMS ==============

from integrations.field_transforms import (
    FieldTransformEngine, MappingConfig, FieldMapping, Transform, Condition,
    TransformType, ConditionOperator,
    create_name_composite_mapping, create_phone_mapping, create_price_mapping
)

class TransformTestRequest(BaseModel):
    """Test transforms on sample data"""
    sample_record: Dict[str, Any]
    mapping_config: Dict[str, Any]
    data_type: str = "customers"

class TransformPreviewRequest(BaseModel):
    """Preview a single transform"""
    value: Any
    transform_type: str
    params: Dict[str, Any] = Field(default_factory=dict)
    record: Dict[str, Any] = Field(default_factory=dict)

@api_router.get("/integrations/transforms")
async def list_available_transforms():
    """List all available transform types with descriptions"""
    transforms = {
        "string": [
            {"type": "uppercase", "description": "Convert to UPPERCASE", "example": "hello → HELLO"},
            {"type": "lowercase", "description": "Convert to lowercase", "example": "HELLO → hello"},
            {"type": "titlecase", "description": "Convert to Title Case", "example": "hello world → Hello World"},
            {"type": "trim", "description": "Remove leading/trailing whitespace", "example": "  hello  → hello"},
            {"type": "strip_html", "description": "Remove HTML tags", "example": "<b>hello</b> → hello"},
            {"type": "truncate", "description": "Truncate to max length", "params": ["max_length", "suffix"]},
        ],
        "phone": [
            {"type": "phone_normalize", "description": "Normalize to +1XXXXXXXXXX", "example": "(555) 123-4567 → +15551234567"},
            {"type": "phone_format_us", "description": "Format as (XXX) XXX-XXXX", "example": "5551234567 → (555) 123-4567"},
            {"type": "phone_digits_only", "description": "Extract digits only", "example": "(555) 123-4567 → 5551234567"},
        ],
        "name": [
            {"type": "name_combine", "description": "Combine first + last name", "params": ["fields", "separator"]},
            {"type": "name_parse", "description": "Parse full name into parts", "example": "John Smith → {first_name: John, last_name: Smith}"},
        ],
        "price": [
            {"type": "price_normalize", "description": "Convert to number", "example": "$25,000.00 → 25000.00"},
            {"type": "number_extract", "description": "Extract first number", "example": "Asking $25000 OBO → 25000"},
            {"type": "round_price", "description": "Round to nearest dollar", "example": "25999.99 → 26000"},
        ],
        "date": [
            {"type": "date_normalize", "description": "Convert to ISO format", "example": "01/15/2024 → 2024-01-15"},
            {"type": "date_format", "description": "Format with custom pattern", "params": ["format"]},
        ],
        "address": [
            {"type": "address_combine", "description": "Combine address parts", "params": ["fields", "separator"]},
            {"type": "state_abbreviate", "description": "Abbreviate state name", "example": "California → CA"},
            {"type": "state_expand", "description": "Expand state abbreviation", "example": "CA → California"},
            {"type": "zip_normalize", "description": "Normalize ZIP code", "example": "9021 → 09021"},
        ],
        "vehicle": [
            {"type": "vin_validate", "description": "Validate and uppercase VIN", "example": "abc123... → ABC123..."},
            {"type": "year_extract", "description": "Extract year from string", "example": "2024 Toyota Camry → 2024"},
            {"type": "mileage_normalize", "description": "Extract mileage number", "example": "45,000 miles → 45000"},
        ],
        "status": [
            {"type": "status_normalize", "description": "Normalize to standard values", "example": "Active → hot"},
        ],
        "generic": [
            {"type": "regex_extract", "description": "Extract via regex pattern", "params": ["pattern", "group"]},
            {"type": "regex_replace", "description": "Replace via regex", "params": ["pattern", "replacement"]},
            {"type": "template", "description": "String template", "params": ["template"], "example": "{year} {make} {model}"},
            {"type": "lookup", "description": "Map via lookup table", "params": ["table", "default"]},
            {"type": "coalesce", "description": "First non-empty value", "params": ["fields"]},
            {"type": "split", "description": "Split and take part", "params": ["delimiter", "index"]},
            {"type": "join", "description": "Join multiple fields", "params": ["fields", "delimiter"]},
        ],
    }
    
    conditions = [
        {"operator": "equals", "description": "Field equals value"},
        {"operator": "not_equals", "description": "Field does not equal value"},
        {"operator": "contains", "description": "Field contains value"},
        {"operator": "not_contains", "description": "Field does not contain value"},
        {"operator": "starts_with", "description": "Field starts with value"},
        {"operator": "ends_with", "description": "Field ends with value"},
        {"operator": "matches_regex", "description": "Field matches regex pattern"},
        {"operator": "is_empty", "description": "Field is empty or null"},
        {"operator": "is_not_empty", "description": "Field has a value"},
        {"operator": "greater_than", "description": "Field > value (numeric)"},
        {"operator": "less_than", "description": "Field < value (numeric)"},
        {"operator": "in_list", "description": "Field is in list of values"},
        {"operator": "not_in_list", "description": "Field is not in list of values"},
    ]
    
    return {
        "transforms": transforms,
        "conditions": conditions,
    }

@api_router.post("/integrations/transforms/preview")
async def preview_transform(request: TransformPreviewRequest):
    """Preview a single transform on a value"""
    try:
        transform_type = TransformType(request.transform_type)
        transform = Transform(type=transform_type, params=request.params)
        result = transform.apply(request.value, request.record)
        
        return {
            "success": True,
            "input": request.value,
            "output": result,
            "transform": request.transform_type,
        }
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown transform type: {request.transform_type}")
    except Exception as e:
        return {
            "success": False,
            "input": request.value,
            "output": None,
            "error": str(e),
        }

@api_router.post("/integrations/transforms/test")
async def test_mapping_config(request: TransformTestRequest):
    """Test a complete mapping configuration on sample data"""
    try:
        config = MappingConfig.from_dict(request.mapping_config)
        engine = FieldTransformEngine(config)
        
        if request.data_type == "customers":
            result = engine.transform_customer(request.sample_record)
        else:
            result = engine.transform_vehicle(request.sample_record)
        
        return {
            "success": True,
            "input": request.sample_record,
            "output": result,
            "data_type": request.data_type,
        }
    except Exception as e:
        logger.error(f"Transform test error: {e}")
        return {
            "success": False,
            "error": str(e),
        }

@api_router.post("/integrations/transforms/suggest")
async def suggest_transforms_for_field(
    source_field: str,
    sample_value: Any,
    target_field: str,
    data_type: str = "customers"
):
    """Suggest transforms to convert source value to target field format"""
    suggestions = []
    
    # Phone field suggestions
    if target_field == "phone":
        suggestions.append({
            "transforms": [{"type": "phone_normalize", "params": {}}],
            "description": "Normalize phone to +1XXXXXXXXXX format",
            "preview": Transform(type=TransformType.PHONE_NORMALIZE).apply(sample_value, {}),
        })
        suggestions.append({
            "transforms": [{"type": "phone_format_us", "params": {}}],
            "description": "Format as (XXX) XXX-XXXX",
            "preview": Transform(type=TransformType.PHONE_FORMAT_US).apply(sample_value, {}),
        })
    
    # Name field suggestions
    elif target_field == "name":
        suggestions.append({
            "transforms": [{"type": "titlecase", "params": {}}, {"type": "trim", "params": {}}],
            "description": "Title case and trim whitespace",
            "preview": Transform(type=TransformType.TITLECASE).apply(
                Transform(type=TransformType.TRIM).apply(sample_value, {}), {}
            ),
        })
        suggestions.append({
            "transforms": [{"type": "name_combine", "params": {"fields": ["first_name", "last_name"]}}],
            "description": "Combine first_name + last_name fields",
            "note": "Use this if name is split across multiple fields",
        })
    
    # Price field suggestions
    elif target_field == "price":
        suggestions.append({
            "transforms": [{"type": "price_normalize", "params": {}}],
            "description": "Remove $ and commas, convert to number",
            "preview": Transform(type=TransformType.PRICE_NORMALIZE).apply(sample_value, {}),
        })
    
    # Year field suggestions
    elif target_field == "year":
        suggestions.append({
            "transforms": [{"type": "year_extract", "params": {}}],
            "description": "Extract 4-digit year from text",
            "preview": Transform(type=TransformType.YEAR_EXTRACT).apply(sample_value, {}),
        })
    
    # Status field suggestions
    elif target_field == "status":
        suggestions.append({
            "transforms": [{"type": "lowercase", "params": {}}, {"type": "status_normalize", "params": {}}],
            "description": "Normalize to standard status values (hot/warm/cold/new)",
            "preview": Transform(type=TransformType.STATUS_NORMALIZE).apply(
                Transform(type=TransformType.LOWERCASE).apply(sample_value, {}), {}
            ),
        })
    
    # VIN field suggestions
    elif target_field == "vin":
        suggestions.append({
            "transforms": [{"type": "vin_validate", "params": {}}],
            "description": "Validate and uppercase VIN",
            "preview": Transform(type=TransformType.VIN_VALIDATE).apply(sample_value, {}),
        })
    
    # Email - just trim
    elif target_field == "email":
        suggestions.append({
            "transforms": [{"type": "lowercase", "params": {}}, {"type": "trim", "params": {}}],
            "description": "Lowercase and trim whitespace",
            "preview": Transform(type=TransformType.LOWERCASE).apply(
                Transform(type=TransformType.TRIM).apply(sample_value, {}), {}
            ),
        })
    
    # Default - just trim
    else:
        suggestions.append({
            "transforms": [{"type": "trim", "params": {}}],
            "description": "Trim whitespace",
            "preview": Transform(type=TransformType.TRIM).apply(sample_value, {}),
        })
    
    return {
        "source_field": source_field,
        "target_field": target_field,
        "sample_value": sample_value,
        "suggestions": suggestions,
    }


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


# ============== CONVERSATION HISTORY ==============

from conversation_history import ConversationHistoryService, ConversationCreate

class ConversationCreateRequest(BaseModel):
    session_id: str
    situation: str
    response: str
    translated_response: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    vehicle_info: Optional[str] = None
    category: Optional[str] = None
    language: str = "en"
    shortcut_used: Optional[str] = None

@api_router.get("/conversations/categories")
async def get_conversation_categories():
    """Get available conversation categories"""
    return {"categories": ConversationHistoryService.get_categories()}

@api_router.post("/conversations")
async def create_conversation(request: ConversationCreateRequest):
    """Create a new conversation record"""
    service = ConversationHistoryService(db)
    await service.initialize()
    
    data = ConversationCreate(**request.model_dump())
    result = await service.create_conversation(data)
    
    return {"success": True, "conversation": result.model_dump()}

@api_router.get("/conversations")
async def get_conversations(
    session_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get conversations with optional filters"""
    service = ConversationHistoryService(db)
    conversations = await service.get_conversations(
        session_id=session_id,
        customer_id=customer_id,
        category=category,
        limit=limit,
        offset=offset
    )
    return {"conversations": conversations, "count": len(conversations)}

@api_router.get("/conversations/stats")
async def get_conversation_stats():
    """Get conversation statistics"""
    service = ConversationHistoryService(db)
    stats = await service.get_stats()
    return stats

@api_router.get("/conversations/session/{session_id}")
async def get_session_history(session_id: str):
    """Get all conversations in a session"""
    service = ConversationHistoryService(db)
    conversations = await service.get_session_history(session_id)
    return {"session_id": session_id, "conversations": conversations}

@api_router.get("/conversations/customer/{customer_id}")
async def get_customer_conversation_history(customer_id: str):
    """Get all conversations for a customer"""
    service = ConversationHistoryService(db)
    conversations = await service.get_customer_history(customer_id)
    return {"customer_id": customer_id, "conversations": conversations}

@api_router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a specific conversation"""
    service = ConversationHistoryService(db)
    success = await service.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}

@api_router.delete("/conversations/session/{session_id}")
async def delete_session_conversations(session_id: str):
    """Delete all conversations in a session"""
    service = ConversationHistoryService(db)
    deleted_count = await service.delete_session(session_id)
    return {"success": True, "deleted_count": deleted_count}


# ============== ANALYTICS DASHBOARD ==============

from analytics_service import AnalyticsService

@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard():
    """Get comprehensive analytics dashboard"""
    service = AnalyticsService(db)
    return await service.get_dashboard_summary()

@api_router.get("/analytics/sales")
async def get_sales_analytics(days: int = 30):
    """Get sales performance analytics"""
    service = AnalyticsService(db)
    return await service.get_sales_performance(days)

@api_router.get("/analytics/customers")
async def get_customer_analytics():
    """Get customer engagement analytics"""
    service = AnalyticsService(db)
    return await service.get_customer_engagement()

@api_router.get("/analytics/inventory")
async def get_inventory_analytics():
    """Get inventory metrics"""
    service = AnalyticsService(db)
    return await service.get_inventory_metrics()

@api_router.get("/analytics/conversations")
async def get_conversation_analytics():
    """Get conversation insights"""
    service = AnalyticsService(db)
    return await service.get_conversation_insights()

@api_router.get("/analytics/integrations")
async def get_integration_analytics():
    """Get integration health analytics"""
    service = AnalyticsService(db)
    return await service.get_integration_health()

@api_router.get("/analytics/trends/{metric}")
async def get_metric_trends(metric: str, days: int = 30):
    """Get trend data for a specific metric"""
    service = AnalyticsService(db)
    return await service.get_trends(metric, days)


# ============== WEBHOOK EVENT PROCESSING ==============

from webhook_processor import WebhookEventProcessor, WebhookEvent, EventType

# Initialize event processor
event_processor = WebhookEventProcessor(db)

@api_router.get("/events/stats")
async def get_event_stats():
    """Get webhook event processing statistics"""
    return await event_processor.get_event_stats()

@api_router.post("/events/enqueue")
async def enqueue_event(event: WebhookEvent):
    """Manually enqueue an event for processing"""
    event_id = await event_processor.enqueue_event(event)
    return {"success": True, "event_id": event_id}

@api_router.get("/events/dlq")
async def get_dlq_events(limit: int = 50):
    """Get events in dead letter queue"""
    events = await event_processor.get_dlq_events(limit)
    return {"events": events, "count": len(events)}

@api_router.post("/events/dlq/{event_id}/replay")
async def replay_dlq_event(event_id: str):
    """Replay a dead letter queue event"""
    success = await event_processor.replay_dlq_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found in DLQ")
    return {"success": True, "message": "Event re-queued for processing"}

@api_router.get("/events/types")
async def get_event_types():
    """Get available event types"""
    return {"event_types": [e.value for e in EventType]}


# ============== VIN DECODER (Multi-Source Cross Reference) ==============

import httpx
import re

class VinSaveRequest(BaseModel):
    vin: str
    vehicle_data: Dict[str, Any]

def validate_vin_checksum(vin: str) -> bool:
    """Validate VIN using ISO 3779 check digit algorithm"""
    if len(vin) != 17:
        return False
    
    transliteration = {
        'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
        'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
        'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
    }
    weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
    
    total = 0
    for i, char in enumerate(vin):
        if char.isdigit():
            value = int(char)
        elif char in transliteration:
            value = transliteration[char]
        else:
            return False
        total += value * weights[i]
    
    check_digit = total % 11
    if check_digit == 10:
        expected = 'X'
    else:
        expected = str(check_digit)
    
    return vin[8] == expected

def decode_wmi(vin: str) -> Dict[str, str]:
    """Decode World Manufacturer Identifier (first 3 characters)"""
    wmi = vin[:3].upper()
    
    # Common WMI codes for major manufacturers
    wmi_database = {
        # US Manufacturers
        '1G1': {'country': 'USA', 'manufacturer': 'Chevrolet'},
        '1G4': {'country': 'USA', 'manufacturer': 'Buick'},
        '1G6': {'country': 'USA', 'manufacturer': 'Cadillac'},
        '1GC': {'country': 'USA', 'manufacturer': 'Chevrolet Truck'},
        '1GT': {'country': 'USA', 'manufacturer': 'GMC Truck'},
        '1FA': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FB': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FC': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FD': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FM': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FT': {'country': 'USA', 'manufacturer': 'Ford Truck'},
        '1C3': {'country': 'USA', 'manufacturer': 'Chrysler'},
        '1C4': {'country': 'USA', 'manufacturer': 'Chrysler'},
        '1C6': {'country': 'USA', 'manufacturer': 'Chrysler'},
        '2C3': {'country': 'Canada', 'manufacturer': 'Chrysler'},
        '2G1': {'country': 'Canada', 'manufacturer': 'Chevrolet'},
        '3FA': {'country': 'Mexico', 'manufacturer': 'Ford'},
        '3G1': {'country': 'Mexico', 'manufacturer': 'Chevrolet'},
        # Japanese
        'JH4': {'country': 'Japan', 'manufacturer': 'Acura'},
        'JHM': {'country': 'Japan', 'manufacturer': 'Honda'},
        'JN1': {'country': 'Japan', 'manufacturer': 'Nissan'},
        'JN8': {'country': 'Japan', 'manufacturer': 'Nissan'},
        'JT2': {'country': 'Japan', 'manufacturer': 'Toyota'},
        'JT3': {'country': 'Japan', 'manufacturer': 'Toyota'},
        'JTD': {'country': 'Japan', 'manufacturer': 'Toyota'},
        'JTH': {'country': 'Japan', 'manufacturer': 'Lexus'},
        'JTJ': {'country': 'Japan', 'manufacturer': 'Lexus'},
        'JM1': {'country': 'Japan', 'manufacturer': 'Mazda'},
        'JM3': {'country': 'Japan', 'manufacturer': 'Mazda'},
        'JF1': {'country': 'Japan', 'manufacturer': 'Subaru'},
        'JF2': {'country': 'Japan', 'manufacturer': 'Subaru'},
        # Korean
        'KM8': {'country': 'South Korea', 'manufacturer': 'Hyundai'},
        'KMH': {'country': 'South Korea', 'manufacturer': 'Hyundai'},
        '5NP': {'country': 'USA', 'manufacturer': 'Hyundai (US)'},
        'KNA': {'country': 'South Korea', 'manufacturer': 'Kia'},
        'KND': {'country': 'South Korea', 'manufacturer': 'Kia'},
        # German
        'WVW': {'country': 'Germany', 'manufacturer': 'Volkswagen'},
        'WV2': {'country': 'Germany', 'manufacturer': 'Volkswagen'},
        'WAU': {'country': 'Germany', 'manufacturer': 'Audi'},
        'WBA': {'country': 'Germany', 'manufacturer': 'BMW'},
        'WBS': {'country': 'Germany', 'manufacturer': 'BMW M'},
        'WBY': {'country': 'Germany', 'manufacturer': 'BMW'},
        'WDB': {'country': 'Germany', 'manufacturer': 'Mercedes-Benz'},
        'WDC': {'country': 'Germany', 'manufacturer': 'Mercedes-Benz'},
        'WDD': {'country': 'Germany', 'manufacturer': 'Mercedes-Benz'},
        'WP0': {'country': 'Germany', 'manufacturer': 'Porsche'},
        'WP1': {'country': 'Germany', 'manufacturer': 'Porsche'},
        # British
        'SAL': {'country': 'UK', 'manufacturer': 'Land Rover'},
        'SAD': {'country': 'UK', 'manufacturer': 'Jaguar'},
        'SAJ': {'country': 'UK', 'manufacturer': 'Jaguar'},
        # Italian
        'ZFF': {'country': 'Italy', 'manufacturer': 'Ferrari'},
        'ZAM': {'country': 'Italy', 'manufacturer': 'Maserati'},
        'ZAR': {'country': 'Italy', 'manufacturer': 'Alfa Romeo'},
        # Tesla
        '5YJ': {'country': 'USA', 'manufacturer': 'Tesla'},
        # Rivian
        '7PD': {'country': 'USA', 'manufacturer': 'Rivian'},
    }
    
    # Try full 3-char WMI first, then first 2
    if wmi in wmi_database:
        return wmi_database[wmi]
    elif wmi[:2] + wmi[2] in wmi_database:
        return wmi_database.get(wmi[:2] + wmi[2], {})
    
    # Decode country from first character
    country_codes = {
        '1': 'USA', '4': 'USA', '5': 'USA',
        '2': 'Canada',
        '3': 'Mexico',
        'J': 'Japan',
        'K': 'South Korea',
        'L': 'China',
        'S': 'UK',
        'V': 'France/Spain',
        'W': 'Germany',
        'Y': 'Sweden/Finland',
        'Z': 'Italy',
        '9': 'Brazil',
    }
    
    return {'country': country_codes.get(vin[0], 'Unknown'), 'manufacturer': 'Unknown'}

@api_router.get("/vin/decode/{vin}")
async def decode_vin(vin: str):
    """
    Decode VIN using multiple sources for cross-reference accuracy:
    1. NHTSA vPIC API (primary - US Government database)
    2. WMI Database (World Manufacturer Identifier validation)
    3. Check digit validation (ISO 3779)
    
    Returns comprehensive vehicle data with confidence score
    """
    # Validate VIN format
    vin = vin.upper().strip()
    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="VIN must be exactly 17 characters")
    
    # Invalid characters for VIN (I, O, Q are never used)
    if any(c in vin for c in ['I', 'O', 'Q']):
        raise HTTPException(status_code=400, detail="VIN contains invalid characters (I, O, Q are not allowed)")
    
    # Check for valid characters only
    valid_chars = set('ABCDEFGHJKLMNPRSTUVWXYZ0123456789')
    if not all(c in valid_chars for c in vin):
        raise HTTPException(status_code=400, detail="VIN contains invalid characters")
    
    # Cross-reference sources
    validation_results = {
        "checksum_valid": validate_vin_checksum(vin),
        "wmi_data": decode_wmi(vin),
        "sources_checked": ["NHTSA vPIC", "WMI Database", "ISO 3779 Checksum"],
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            # NHTSA vPIC API endpoint
            url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
            response = await http_client.get(url)
            response.raise_for_status()
            data = response.json()
        
        results = data.get("Results", [])
        if not results:
            raise HTTPException(status_code=404, detail="No vehicle data found for this VIN")
        
        # Build a lookup dict from results
        raw_data = {}
        for item in results:
            var_name = item.get("Variable", "")
            value = item.get("Value")
            if value and str(value).strip() and str(value).strip().lower() not in ['not applicable', 'n/a', '-']:
                raw_data[var_name] = str(value).strip()
        
        # Comprehensive field mapping
        vehicle = {
            # Core Identity
            "vin": vin,
            "year": raw_data.get("Model Year"),
            "make": raw_data.get("Make"),
            "model": raw_data.get("Model"),
            "trim": raw_data.get("Trim") or raw_data.get("Series"),
            
            # Manufacturer Info
            "manufacturer": raw_data.get("Manufacturer Name"),
            "plant_country": raw_data.get("Plant Country"),
            "plant_city": raw_data.get("Plant City"),
            "plant_state": raw_data.get("Plant State"),
            
            # Body & Style
            "vehicle_type": raw_data.get("Vehicle Type"),
            "body_class": raw_data.get("Body Class"),
            "doors": raw_data.get("Doors"),
            "drive_type": raw_data.get("Drive Type"),
            "steering": raw_data.get("Steering Location"),
            
            # Powertrain
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
            
            # Safety
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
            
            # Dimensions & Weight
            "gvwr": raw_data.get("Gross Vehicle Weight Rating From"),
            "curb_weight": raw_data.get("Curb Weight (lb)"),
            "wheelbase": raw_data.get("Wheelbase (inches)"),
            "bed_length": raw_data.get("Bed Length (inches)"),
            "bed_type": raw_data.get("Bed Type"),
            
            # Additional
            "series": raw_data.get("Series"),
            "series2": raw_data.get("Series2"),
            
            # MSRP estimate (if available)
            "base_price": raw_data.get("Base Price ($)"),
        }
        
        # Clean up None values and build structured response
        vehicle = {k: v for k, v in vehicle.items() if v is not None}
        
        # Cross-reference WMI data with NHTSA results
        wmi_info = validation_results["wmi_data"]
        if wmi_info.get("manufacturer") != "Unknown":
            # Verify manufacturer matches
            nhtsa_make = vehicle.get("make", "").upper()
            wmi_make = wmi_info.get("manufacturer", "").upper()
            if wmi_make in nhtsa_make or nhtsa_make in wmi_make:
                validation_results["manufacturer_verified"] = True
            else:
                validation_results["manufacturer_verified"] = False
                validation_results["wmi_manufacturer"] = wmi_info["manufacturer"]
        
        # Build formatted engine string
        engine_parts = []
        if vehicle.get("displacement"):
            engine_parts.append(f"{vehicle['displacement']}L")
        if vehicle.get("cylinders"):
            cyl = int(vehicle['cylinders'])
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
        
        # Build location string
        loc_parts = []
        if vehicle.get("plant_city"):
            loc_parts.append(vehicle["plant_city"])
        if vehicle.get("plant_state"):
            loc_parts.append(vehicle["plant_state"])
        if vehicle.get("plant_country"):
            # Simplify country name
            country = vehicle["plant_country"]
            if "UNITED STATES" in country.upper():
                country = "USA"
            elif "(" in country:
                country = country.split("(")[1].replace(")", "").strip()
            loc_parts.append(country)
        if loc_parts:
            vehicle["assembly_location"] = ", ".join(loc_parts)
        
        # Safety features summary
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
        
        # Calculate confidence score based on validation
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
        
        # Ensure we have minimum required data
        if not vehicle.get("make") or not vehicle.get("model"):
            raise HTTPException(status_code=404, detail="Could not decode vehicle make/model from VIN")
        
        logger.info(f"VIN decoded: {vin} -> {vehicle.get('year')} {vehicle.get('make')} {vehicle.get('model')} (confidence: {confidence}%)")
        return vehicle
        
    except httpx.HTTPError as e:
        logger.error(f"NHTSA API error: {e}")
        raise HTTPException(status_code=502, detail="Failed to connect to VIN decoder service")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VIN decode error: {e}")
        raise HTTPException(status_code=500, detail=f"VIN decode failed: {str(e)}")


@api_router.post("/vin/save")
async def save_vin_vehicle(request: VinSaveRequest):
    """
    Save a decoded vehicle to inventory
    """
    try:
        vin = request.vin.upper().strip()
        vdata = request.vehicle_data
        
        # Build vehicle record for inventory
        vehicle_record = {
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
            "is_new": True,  # Assume new unless specified
            "status": "available",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        
        # Check if VIN already exists
        existing = await db.vehicles.find_one({"vin": vin})
        if existing:
            # Update existing record
            await db.vehicles.update_one(
                {"vin": vin},
                {"$set": {**vehicle_record, "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"Updated existing vehicle: {vin}")
            return {"success": True, "message": "Vehicle updated", "vin": vin}
        else:
            # Insert new record
            vehicle_record["id"] = str(uuid.uuid4())
            await db.vehicles.insert_one(vehicle_record)
            logger.info(f"Saved new vehicle: {vin}")
            return {"success": True, "message": "Vehicle saved to inventory", "vin": vin}
        
    except Exception as e:
        logger.error(f"Save VIN error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save vehicle: {str(e)}")


# ============== FAVORITES CATEGORIES ==============

# Favorites categories matching the existing patterns
FAVORITE_CATEGORIES = [
    {"id": "price_negotiation", "label": "Price Negotiation", "icon": "💰"},
    {"id": "trade_in", "label": "Trade-In", "icon": "🔄"},
    {"id": "objection_handling", "label": "Objection Handling", "icon": "🛡️"},
    {"id": "follow_up", "label": "Follow-Up", "icon": "📞"},
    {"id": "competitor", "label": "Competitor", "icon": "⚔️"},
    {"id": "financing", "label": "Financing", "icon": "📊"},
    {"id": "features", "label": "Features", "icon": "⚙️"},
    {"id": "closing", "label": "Closing", "icon": "🎯"},
    {"id": "general", "label": "General", "icon": "💬"},
]

@api_router.get("/favorites/categories")
async def get_favorite_categories():
    """Get available favorite categories"""
    return {"categories": FAVORITE_CATEGORIES}


# ============== NOTIFICATIONS (SMS via Twilio) ==============

from notification_service import (
    NotificationService, 
    NotificationCreate, 
    NotificationType,
    NotificationChannel,
    NotificationPriority
)

# Initialize notification service
notification_service = NotificationService(db)

class TwilioConfigRequest(BaseModel):
    account_sid: str
    auth_token: str
    from_number: str

class HotLeadNotificationRequest(BaseModel):
    salesperson_phone: str
    salesperson_name: str
    customer_name: str
    customer_phone: str
    vehicle_interest: Optional[str] = None

class StatusChangeNotificationRequest(BaseModel):
    salesperson_phone: str
    customer_name: str
    old_status: str
    new_status: str
    notes: Optional[str] = None

class FollowUpReminderRequest(BaseModel):
    salesperson_phone: str
    customer_name: str
    vehicle_interest: Optional[str] = None
    last_contact: Optional[str] = None
    remind_at: datetime

@api_router.get("/notifications/config")
async def get_notification_config():
    """Get notification configuration status"""
    await notification_service.initialize()
    return await notification_service.get_config_status()

@api_router.post("/notifications/config/twilio")
async def configure_twilio(config: TwilioConfigRequest):
    """Configure Twilio SMS credentials"""
    await notification_service.initialize()
    result = await notification_service.configure_twilio(
        config.account_sid,
        config.auth_token,
        config.from_number
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result

@api_router.post("/notifications/hot-lead")
async def send_hot_lead_notification(request: HotLeadNotificationRequest):
    """Send hot lead SMS notification"""
    await notification_service.initialize()
    result = await notification_service.send_hot_lead_alert(
        salesperson_phone=request.salesperson_phone,
        salesperson_name=request.salesperson_name,
        customer_name=request.customer_name,
        customer_phone=request.customer_phone,
        vehicle_interest=request.vehicle_interest
    )
    return result.model_dump()

@api_router.post("/notifications/status-change")
async def send_status_change_notification(request: StatusChangeNotificationRequest):
    """Send lead status change SMS notification"""
    await notification_service.initialize()
    result = await notification_service.send_status_change_alert(
        salesperson_phone=request.salesperson_phone,
        customer_name=request.customer_name,
        old_status=request.old_status,
        new_status=request.new_status,
        notes=request.notes
    )
    return result.model_dump()

@api_router.post("/notifications/follow-up-reminder")
async def schedule_follow_up_reminder(request: FollowUpReminderRequest):
    """Schedule a follow-up reminder SMS"""
    await notification_service.initialize()
    result = await notification_service.schedule_follow_up_reminder(
        salesperson_phone=request.salesperson_phone,
        customer_name=request.customer_name,
        vehicle_interest=request.vehicle_interest,
        last_contact=request.last_contact,
        remind_at=request.remind_at
    )
    return result.model_dump()

@api_router.get("/notifications")
async def get_notifications(
    notification_type: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get notifications with optional filters"""
    await notification_service.initialize()
    notifications = await notification_service.get_notifications(
        notification_type=notification_type,
        status=status,
        limit=limit
    )
    return {"notifications": notifications}

@api_router.get("/notifications/stats")
async def get_notification_stats():
    """Get notification statistics"""
    await notification_service.initialize()
    return await notification_service.get_stats()

@api_router.post("/notifications/process-scheduled")
async def process_scheduled_notifications():
    """Process all due scheduled notifications"""
    await notification_service.initialize()
    result = await notification_service.process_scheduled_notifications()
    return {"success": True, **result}


class DeviceRegistration(BaseModel):
    token: str
    platform: str
    timestamp: str = None


@api_router.post("/notifications/register-device")
async def register_device(device: DeviceRegistration):
    """Register a device for push notifications (Capacitor mobile app)"""
    await notification_service.initialize()
    
    # Store device token in database
    device_doc = {
        "token": device.token,
        "platform": device.platform,
        "registered_at": datetime.utcnow(),
        "active": True,
    }
    
    # Upsert by token to avoid duplicates
    await db.push_devices.update_one(
        {"token": device.token},
        {"$set": device_doc},
        upsert=True
    )
    
    logger.info(f"Device registered for push: {device.platform}")
    return {"success": True, "message": "Device registered for push notifications"}


@api_router.get("/notifications/devices")
async def get_registered_devices():
    """Get all registered push notification devices"""
    cursor = db.push_devices.find({"active": True}, {"_id": 0})
    devices = await cursor.to_list(100)
    return {"devices": devices, "count": len(devices)}


# ============== EJECT - SEND CUSTOMER SNAPSHOT VIA SMS ==============

class EjectRequest(BaseModel):
    customer_id: str
    recipient_phone: str  # User's phone number to receive the snapshot


@api_router.post("/eject/customer")
async def eject_customer_snapshot(request: EjectRequest):
    """
    Eject - Send a customer profile snapshot via SMS
    Includes: Name, Phone, Email, and attached vehicle VINs
    """
    try:
        # Get customer
        customer = await db.customers.find_one({"id": request.customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get attached vehicles
        vehicle_vins = []
        if customer.get("vehicle_interests"):
            vehicles = await db.vehicles.find(
                {"id": {"$in": customer["vehicle_interests"]}},
                {"_id": 0, "vin": 1, "year": 1, "make": 1, "model": 1}
            ).to_list(10)
            for v in vehicles:
                if v.get("vin"):
                    vehicle_vins.append(f"{v.get('year', '')} {v.get('make', '')} {v.get('model', '')} - {v['vin']}")
                else:
                    vehicle_vins.append(f"{v.get('year', '')} {v.get('make', '')} {v.get('model', '')}")
        
        # Get trade-in if exists
        trade_in_info = None
        if customer.get("trade_in_vehicle_id"):
            trade_in = await db.vehicles.find_one(
                {"id": customer["trade_in_vehicle_id"]},
                {"_id": 0, "vin": 1, "year": 1, "make": 1, "model": 1}
            )
            if trade_in:
                trade_in_info = f"{trade_in.get('year', '')} {trade_in.get('make', '')} {trade_in.get('model', '')} - {trade_in.get('vin', 'No VIN')}"
        
        # Build snapshot message
        name = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
        phone = customer.get('phone', 'N/A')
        email = customer.get('email', 'N/A')
        status = customer.get('lead_status', 'N/A').upper()
        
        message_lines = [
            "🚗 SUPERCHARG'D SNAPSHOT",
            "━━━━━━━━━━━━━━━━",
            f"👤 {name}",
            f"📱 {phone}",
            f"✉️ {email}",
            f"📊 Status: {status}",
        ]
        
        if vehicle_vins:
            message_lines.append("━━━━━━━━━━━━━━━━")
            message_lines.append("🎯 INTERESTED IN:")
            for vin in vehicle_vins:
                message_lines.append(f"  • {vin}")
        
        if trade_in_info:
            message_lines.append("━━━━━━━━━━━━━━━━")
            message_lines.append("🔄 TRADE-IN:")
            message_lines.append(f"  • {trade_in_info}")
        
        message_lines.append("━━━━━━━━━━━━━━━━")
        message_lines.append("Sent via Supercharg'd")
        
        sms_message = "\n".join(message_lines)
        
        # Initialize notification service and send SMS
        await notification_service.initialize()
        
        result = await notification_service.send_sms(
            to_number=request.recipient_phone,
            message=sms_message
        )
        
        if result.get("success"):
            # Log the eject action
            await db.customers.update_one(
                {"id": request.customer_id},
                {
                    "$push": {
                        "interactions": {
                            "id": str(uuid.uuid4()),
                            "interaction_type": "eject",
                            "content": f"Profile snapshot sent to {request.recipient_phone}",
                            "created_at": datetime.now(timezone.utc)
                        }
                    }
                }
            )
            
            return {
                "success": True,
                "message": "Snapshot sent successfully",
                "sent_to": request.recipient_phone
            }
        else:
            return {
                "success": False,
                "error": result.get("error", "Failed to send SMS"),
                "hint": "Make sure Twilio is configured in settings"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Eject error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/eject/preview/{customer_id}")
async def preview_eject_snapshot(customer_id: str):
    """Preview the snapshot message before sending"""
    try:
        customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get attached vehicles
        vehicle_vins = []
        if customer.get("vehicle_interests"):
            vehicles = await db.vehicles.find(
                {"id": {"$in": customer["vehicle_interests"]}},
                {"_id": 0, "vin": 1, "year": 1, "make": 1, "model": 1}
            ).to_list(10)
            for v in vehicles:
                if v.get("vin"):
                    vehicle_vins.append(f"{v.get('year', '')} {v.get('make', '')} {v.get('model', '')} - {v['vin']}")
                else:
                    vehicle_vins.append(f"{v.get('year', '')} {v.get('make', '')} {v.get('model', '')}")
        
        name = f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
        
        return {
            "customer_name": name,
            "phone": customer.get('phone'),
            "email": customer.get('email'),
            "status": customer.get('lead_status'),
            "vehicles": vehicle_vins,
            "trade_in_vehicle_id": customer.get("trade_in_vehicle_id")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Preview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== USER SETTINGS (Phone Number) ==============

class UserSettingsUpdate(BaseModel):
    phone_number: Optional[str] = None
    name: Optional[str] = None


@api_router.get("/user/settings")
async def get_user_settings():
    """Get user settings including phone number for eject"""
    settings = await db.user_settings.find_one({"type": "user_profile"}, {"_id": 0})
    return settings or {"phone_number": None, "name": None}


@api_router.patch("/user/settings")
async def update_user_settings(updates: UserSettingsUpdate):
    """Update user settings"""
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    update_data["type"] = "user_profile"
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.user_settings.update_one(
        {"type": "user_profile"},
        {"$set": update_data},
        upsert=True
    )
    
    return {"success": True, "updated": update_data}


# ============== WEBHOOK TO NOTIFICATION HANDLERS ==============

async def handle_hot_lead_event(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handler for hot lead events - sends SMS notification
    Payload should contain: customer_name, customer_phone, vehicle_interest, salesperson_phone, salesperson_name
    """
    await notification_service.initialize()
    
    # Extract data from payload with defaults
    customer_name = payload.get('customer_name', 'Unknown Customer')
    customer_phone = payload.get('customer_phone', '')
    vehicle_interest = payload.get('vehicle_interest', 'Not specified')
    salesperson_phone = payload.get('salesperson_phone')
    salesperson_name = payload.get('salesperson_name', 'Sales Team')
    
    if not salesperson_phone:
        logger.warning(f"Hot lead event missing salesperson_phone: {event.get('_id')}")
        return {"success": False, "error": "Missing salesperson_phone"}
    
    result = await notification_service.send_hot_lead_alert(
        salesperson_phone=salesperson_phone,
        salesperson_name=salesperson_name,
        customer_name=customer_name,
        customer_phone=customer_phone,
        vehicle_interest=vehicle_interest
    )
    
    logger.info(f"Hot lead notification sent: {result.notification_id}")
    return {"success": result.success, "notification_id": result.notification_id}


async def handle_lead_status_change_event(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handler for lead status change events - sends SMS notification
    Triggers notification when status changes to 'hot'
    """
    await notification_service.initialize()
    
    customer_name = payload.get('customer_name', 'Unknown Customer')
    old_status = payload.get('old_status', 'unknown')
    new_status = payload.get('new_status', 'unknown')
    salesperson_phone = payload.get('salesperson_phone')
    notes = payload.get('notes', '')
    
    if not salesperson_phone:
        logger.warning(f"Status change event missing salesperson_phone: {event.get('_id')}")
        return {"success": False, "error": "Missing salesperson_phone"}
    
    # Only send notification for significant status changes
    significant_statuses = ['hot', 'qualified', 'closed_won', 'closed_lost']
    if new_status.lower() not in significant_statuses:
        return {"success": True, "message": "Status change not significant enough for notification"}
    
    result = await notification_service.send_status_change_alert(
        salesperson_phone=salesperson_phone,
        customer_name=customer_name,
        old_status=old_status,
        new_status=new_status,
        notes=notes
    )
    
    logger.info(f"Status change notification sent: {result.notification_id}")
    return {"success": result.success, "notification_id": result.notification_id}


async def handle_deal_event(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handler for deal events - logs and optionally notifies
    """
    deal_stage = payload.get('deal_stage', 'unknown')
    customer_name = payload.get('customer_name', 'Unknown')
    amount = payload.get('amount', 0)
    
    logger.info(f"Deal event processed: {customer_name} - {deal_stage} - ${amount}")
    return {"success": True, "deal_stage": deal_stage, "amount": amount}


# Register webhook event handlers
def register_notification_handlers():
    """Register handlers to connect webhook events to notifications"""
    # Hot lead events -> SMS alert
    event_processor.register_handler(EventType.LEAD_STATUS_CHANGED.value, handle_lead_status_change_event)
    
    # Deal events -> logging (can be extended to notifications)
    event_processor.register_handler(EventType.DEAL_CREATED.value, handle_deal_event)
    event_processor.register_handler(EventType.DEAL_UPDATED.value, handle_deal_event)
    
    # Customer events with hot flag -> SMS alert
    async def customer_created_handler(payload: Dict[str, Any], event: Dict[str, Any]) -> Dict[str, Any]:
        """Check if new customer is a hot lead and notify"""
        if payload.get('is_hot') or payload.get('lead_status', '').lower() == 'hot':
            return await handle_hot_lead_event(payload, event)
        return {"success": True, "message": "Customer created but not a hot lead"}
    
    event_processor.register_handler(EventType.CUSTOMER_CREATED.value, customer_created_handler)
    event_processor.register_handler(EventType.CUSTOMER_UPDATED.value, customer_created_handler)
    
    logger.info("Notification handlers registered for webhook events")


# Register handlers on module load
register_notification_handlers()


@api_router.post("/events/test-hot-lead")
async def test_hot_lead_event(
    customer_name: str = "Test Customer",
    customer_phone: str = "+1234567890",
    vehicle_interest: str = "2024 Test Vehicle",
    salesperson_phone: str = "+1987654321"
):
    """Test hot lead event processing (for development/testing)"""
    test_event = WebhookEvent(
        webhook_id="test-webhook",
        event_type=EventType.CUSTOMER_CREATED.value,
        payload={
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "vehicle_interest": vehicle_interest,
            "salesperson_phone": salesperson_phone,
            "salesperson_name": "Test Salesperson",
            "is_hot": True,
        },
        source="test"
    )
    
    event_id = await event_processor.enqueue_event(test_event)
    return {
        "success": True,
        "event_id": event_id,
        "message": "Hot lead test event enqueued. Check notification service for SMS (if configured)."
    }


# ============== A/B TESTING ==============

class ABTrackEvent(BaseModel):
    experiment_id: str
    user_id: str
    event_type: str  # "impression", "conversion", "click"
    metadata: Dict[str, Any] = None


@api_router.get("/ab/experiments")
async def list_experiments(active_only: bool = False):
    """List all A/B experiments"""
    experiments = await ab_testing_service.list_experiments(active_only)
    return {"experiments": experiments}


@api_router.get("/ab/experiments/{experiment_id}")
async def get_experiment_results(experiment_id: str):
    """Get results for a specific experiment"""
    results = await ab_testing_service.get_experiment_results(experiment_id)
    return results


@api_router.get("/ab/variant/{experiment_id}")
async def get_user_variant(experiment_id: str, user_id: str):
    """Get the assigned variant for a user"""
    variant = await ab_testing_service.get_variant(user_id, experiment_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Experiment not found or inactive")
    return variant


@api_router.post("/ab/track")
async def track_ab_event(event: ABTrackEvent):
    """Track an A/B test event (impression, conversion, etc.)"""
    result = await ab_testing_service.track_event(
        experiment_id=event.experiment_id,
        user_id=event.user_id,
        event_type=event.event_type,
        metadata=event.metadata
    )
    return result


@api_router.post("/ab/experiments/{experiment_id}/toggle")
async def toggle_experiment(experiment_id: str, is_active: bool = True):
    """Activate or deactivate an experiment"""
    result = await ab_testing_service.toggle_experiment(experiment_id, is_active)
    return result


# ============== ENHANCED CUSTOMER MANAGEMENT ==============

from models import (
    CustomerCreate, CustomerUpdate, Customer as CustomerModel,
    VehicleCreate, VehicleUpdate, Vehicle as VehicleModel,
    VehicleCategory, LeadStatus, LeadSource, InteractionType,
    CustomerInteraction, CRMConfig
)
import pandas as pd
import io

class AddInteractionRequest(BaseModel):
    interaction_type: str
    content: str
    created_by: Optional[str] = None


class AttachVehicleRequest(BaseModel):
    vehicle_id: str


@api_router.get("/customers/list")
async def list_customers_filtered(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List all customers with optional filtering"""
    try:
        query = {}
        if status:
            query["lead_status"] = status
        if source:
            query["lead_source"] = source
        
        # Get customers
        cursor = db.customers.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        customers = await cursor.to_list(limit)
        
        # Search filter
        if search:
            search_lower = search.lower()
            customers = [c for c in customers if 
                search_lower in c.get('first_name', '').lower() or
                search_lower in c.get('last_name', '').lower() or
                search_lower in c.get('phone', '').lower() or
                search_lower in c.get('email', '').lower()
            ]
        
        # Get total count
        total = await db.customers.count_documents(query)
        
        return {"customers": customers, "total": total}
    except Exception as e:
        logger.error(f"List customers error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/customers/create")
async def create_customer(customer: CustomerCreate):
    """Create a new customer"""
    try:
        customer_data = customer.model_dump()
        customer_data["id"] = str(uuid.uuid4())
        customer_data["created_at"] = datetime.now(timezone.utc)
        customer_data["updated_at"] = datetime.now(timezone.utc)
        customer_data["interactions"] = []
        
        await db.customers.insert_one(customer_data)
        
        return {"success": True, "customer": {k: v for k, v in customer_data.items() if k != "_id"}}
    except Exception as e:
        logger.error(f"Create customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str):
    """Get a single customer with full details"""
    try:
        customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get attached vehicles
        if customer.get("vehicle_interests"):
            vehicles = await db.vehicles.find(
                {"id": {"$in": customer["vehicle_interests"]}},
                {"_id": 0}
            ).to_list(10)
            customer["attached_vehicles"] = vehicles
        
        # Get trade-in vehicle if exists
        if customer.get("trade_in_vehicle_id"):
            trade_in = await db.vehicles.find_one(
                {"id": customer["trade_in_vehicle_id"]},
                {"_id": 0}
            )
            customer["trade_in_vehicle"] = trade_in
        
        return customer
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/customers/{customer_id}")
async def update_customer(customer_id: str, updates: CustomerUpdate):
    """Update a customer"""
    try:
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # If status changed to sold, set sold_at for auto-deletion
        if updates.lead_status == LeadStatus.SOLD:
            update_data["sold_at"] = datetime.now(timezone.utc)
        
        result = await db.customers.update_one(
            {"id": customer_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"success": True, "updated": update_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer"""
    try:
        result = await db.customers.delete_one({"id": customer_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/customers/{customer_id}/interaction")
async def add_customer_interaction(customer_id: str, interaction: AddInteractionRequest):
    """Add an interaction to customer history"""
    try:
        interaction_data = {
            "id": str(uuid.uuid4()),
            "interaction_type": interaction.interaction_type,
            "content": interaction.content,
            "created_at": datetime.now(timezone.utc),
            "created_by": interaction.created_by
        }
        
        result = await db.customers.update_one(
            {"id": customer_id},
            {
                "$push": {"interactions": interaction_data},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"success": True, "interaction": interaction_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add interaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/customers/{customer_id}/attach-vehicle")
async def attach_vehicle_to_customer(customer_id: str, request: AttachVehicleRequest):
    """Attach a vehicle of interest to a customer (max 2)"""
    try:
        customer = await db.customers.find_one({"id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        current_vehicles = customer.get("vehicle_interests", [])
        if len(current_vehicles) >= 2:
            raise HTTPException(status_code=400, detail="Maximum 2 vehicles allowed per customer")
        
        if request.vehicle_id in current_vehicles:
            raise HTTPException(status_code=400, detail="Vehicle already attached")
        
        await db.customers.update_one(
            {"id": customer_id},
            {
                "$push": {"vehicle_interests": request.vehicle_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Attach vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/customers/{customer_id}/detach-vehicle/{vehicle_id}")
async def detach_vehicle_from_customer(customer_id: str, vehicle_id: str):
    """Remove a vehicle of interest from a customer"""
    try:
        result = await db.customers.update_one(
            {"id": customer_id},
            {
                "$pull": {"vehicle_interests": vehicle_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detach vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== ENHANCED VEHICLE MANAGEMENT ==============

@api_router.get("/vehicles/inventory")
async def list_inventory(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List vehicles in inventory"""
    try:
        query = {}
        if category:
            query["category"] = category
        
        cursor = db.vehicles.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        vehicles = await cursor.to_list(limit)
        
        # Search filter
        if search:
            search_lower = search.lower()
            vehicles = [v for v in vehicles if 
                search_lower in v.get('make', '').lower() or
                search_lower in v.get('model', '').lower() or
                search_lower in v.get('vin', '').lower() or
                search_lower in str(v.get('year', ''))
            ]
        
        # Get counts by category
        active_count = await db.vehicles.count_documents({"category": "active_inventory"})
        trade_in_count = await db.vehicles.count_documents({"category": "trade_in"})
        
        return {
            "vehicles": vehicles,
            "counts": {
                "active_inventory": active_count,
                "trade_in": trade_in_count,
                "total": active_count + trade_in_count
            }
        }
    except Exception as e:
        logger.error(f"List inventory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/vehicles/create")
async def create_vehicle(vehicle: VehicleCreate):
    """Create a new vehicle"""
    try:
        vehicle_data = vehicle.model_dump()
        vehicle_data["id"] = str(uuid.uuid4())
        vehicle_data["created_at"] = datetime.now(timezone.utc)
        vehicle_data["updated_at"] = datetime.now(timezone.utc)
        vehicle_data["status"] = "available"
        
        await db.vehicles.insert_one(vehicle_data)
        
        return {"success": True, "vehicle": {k: v for k, v in vehicle_data.items() if k != "_id"}}
    except Exception as e:
        logger.error(f"Create vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    """Get a single vehicle"""
    try:
        vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        # Get linked customer if trade-in
        if vehicle.get("customer_id"):
            customer = await db.customers.find_one(
                {"id": vehicle["customer_id"]},
                {"_id": 0, "first_name": 1, "last_name": 1, "phone": 1}
            )
            vehicle["linked_customer"] = customer
        
        return vehicle
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, updates: VehicleUpdate):
    """Update a vehicle"""
    try:
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        return {"success": True, "updated": update_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle"""
    try:
        result = await db.vehicles.delete_one({"id": vehicle_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Enhanced VIN save with category support
class VinSaveWithCategoryRequest(BaseModel):
    vin: str
    vehicle_data: Dict[str, Any]
    category: str = "active_inventory"  # "active_inventory" or "trade_in"
    customer_id: Optional[str] = None  # For trade-ins
    trade_in_value: Optional[float] = None
    condition: Optional[str] = None


@api_router.post("/vin/save-to-inventory")
async def save_vin_to_inventory(request: VinSaveWithCategoryRequest):
    """Save VIN-decoded vehicle to inventory with category"""
    try:
        vin = request.vin.upper().strip()
        vdata = request.vehicle_data
        
        # Check if VIN already exists - REJECT duplicates
        existing = await db.vehicles.find_one({"vin": vin}, {"_id": 0})
        if existing:
            logger.warning(f"Duplicate VIN rejected: {vin}")
            raise HTTPException(
                status_code=409, 
                detail=f"This VIN already exists in inventory. Vehicle: {existing.get('year')} {existing.get('make')} {existing.get('model')}"
            )
        
        vehicle_record = {
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
        
        await db.vehicles.insert_one(vehicle_record)
        logger.info(f"Vehicle added to inventory: {vin}")
        return {"success": True, "message": "Vehicle saved to inventory", "id": vehicle_record["id"]}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save VIN to inventory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== DATA IMPORT (File Upload, Email Parsing) ==============

@api_router.post("/import/file")
async def import_file(
    file: UploadFile = File(...),
    import_type: str = Form("customers")  # "customers" or "vehicles"
):
    """Import data from CSV or Excel file"""
    try:
        content = await file.read()
        filename = file.filename.lower()
        
        # Parse file
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV or Excel.")
        
        imported = 0
        errors = []
        
        if import_type == "customers":
            # Map common column names
            column_map = {
                'first name': 'first_name', 'firstname': 'first_name', 'fname': 'first_name',
                'last name': 'last_name', 'lastname': 'last_name', 'lname': 'last_name',
                'name': 'full_name',
                'phone': 'phone', 'telephone': 'phone', 'cell': 'phone', 'mobile': 'phone',
                'email': 'email', 'e-mail': 'email',
                'address': 'address', 'street': 'address',
                'source': 'lead_source', 'lead source': 'lead_source',
                'status': 'lead_status', 'lead status': 'lead_status',
            }
            
            df.columns = [column_map.get(c.lower().strip(), c.lower().replace(' ', '_')) for c in df.columns]
            
            for idx, row in df.iterrows():
                try:
                    # Handle full name split
                    if 'full_name' in row and pd.notna(row['full_name']):
                        name_parts = str(row['full_name']).strip().split(' ', 1)
                        first_name = name_parts[0]
                        last_name = name_parts[1] if len(name_parts) > 1 else ''
                    else:
                        first_name = str(row.get('first_name', '')).strip() if pd.notna(row.get('first_name')) else ''
                        last_name = str(row.get('last_name', '')).strip() if pd.notna(row.get('last_name')) else ''
                    
                    if not first_name:
                        continue
                    
                    customer_data = {
                        "id": str(uuid.uuid4()),
                        "first_name": first_name,
                        "last_name": last_name,
                        "phone": str(row.get('phone', '')).strip() if pd.notna(row.get('phone')) else '',
                        "email": str(row.get('email', '')).strip() if pd.notna(row.get('email')) else None,
                        "address": str(row.get('address', '')).strip() if pd.notna(row.get('address')) else None,
                        "lead_source": "file_import",
                        "lead_status": "new",
                        "interactions": [],
                        "vehicle_interests": [],
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                        "source_id": f"import_{file.filename}",
                    }
                    
                    await db.customers.insert_one(customer_data)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row {idx + 2}: {str(e)}")
        
        elif import_type == "vehicles":
            column_map = {
                'vin': 'vin',
                'year': 'year',
                'make': 'make',
                'model': 'model',
                'trim': 'trim',
                'price': 'price',
                'mileage': 'mileage', 'miles': 'mileage', 'odometer': 'mileage',
                'color': 'color', 'ext color': 'color', 'exterior': 'color',
                'stock': 'stock_number', 'stock #': 'stock_number', 'stock number': 'stock_number',
            }
            
            df.columns = [column_map.get(c.lower().strip(), c.lower().replace(' ', '_')) for c in df.columns]
            
            for idx, row in df.iterrows():
                try:
                    make = str(row.get('make', '')).strip() if pd.notna(row.get('make')) else ''
                    model = str(row.get('model', '')).strip() if pd.notna(row.get('model')) else ''
                    
                    if not make or not model:
                        continue
                    
                    vehicle_data = {
                        "id": str(uuid.uuid4()),
                        "vin": str(row.get('vin', '')).strip().upper() if pd.notna(row.get('vin')) else None,
                        "year": int(row['year']) if pd.notna(row.get('year')) else None,
                        "make": make,
                        "model": model,
                        "trim": str(row.get('trim', '')).strip() if pd.notna(row.get('trim')) else None,
                        "price": float(row['price']) if pd.notna(row.get('price')) else None,
                        "mileage": int(row['mileage']) if pd.notna(row.get('mileage')) else None,
                        "color": str(row.get('color', '')).strip() if pd.notna(row.get('color')) else None,
                        "stock_number": str(row.get('stock_number', '')).strip() if pd.notna(row.get('stock_number')) else None,
                        "category": "active_inventory",
                        "status": "available",
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                        "source_id": f"import_{file.filename}",
                    }
                    
                    await db.vehicles.insert_one(vehicle_data)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row {idx + 2}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported,
            "errors": errors[:10] if errors else [],
            "total_errors": len(errors)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/import/email")
async def parse_lead_email(email_body: str = Form(...), email_subject: str = Form(""), email_from: str = Form("")):
    """Parse a lead email and extract customer info"""
    try:
        # Use LLM to parse email
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM not configured")
        
        chat = LlmChat(api_key=api_key, model="gpt-4o-mini")
        
        parse_prompt = f"""Parse this automotive lead email and extract customer information in JSON format.
        
Email From: {email_from}
Subject: {email_subject}
Body:
{email_body}

Extract and return ONLY valid JSON with these fields:
{{
    "first_name": "",
    "last_name": "",
    "phone": "",
    "email": "",
    "address": "",
    "vehicle_interest": "",
    "notes": ""
}}

If a field cannot be found, use empty string. Do not include any other text."""

        response = await chat.send_message_async(UserMessage(text=parse_prompt))
        
        # Parse JSON response
        json_match = re.search(r'\{[\s\S]*\}', response.text)
        if json_match:
            import json
            parsed = json.loads(json_match.group())
            
            # Create customer if we have enough info
            if parsed.get("first_name") or parsed.get("phone") or parsed.get("email"):
                customer_data = {
                    "id": str(uuid.uuid4()),
                    "first_name": parsed.get("first_name", "Unknown"),
                    "last_name": parsed.get("last_name", ""),
                    "phone": parsed.get("phone", ""),
                    "email": parsed.get("email", email_from) or email_from,
                    "address": parsed.get("address"),
                    "lead_source": "email",
                    "lead_status": "new",
                    "notes": parsed.get("notes"),
                    "interactions": [{
                        "id": str(uuid.uuid4()),
                        "interaction_type": "email",
                        "content": f"Lead email: {email_subject}\n\n{email_body[:500]}",
                        "created_at": datetime.now(timezone.utc)
                    }],
                    "vehicle_interests": [],
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "source_id": "email_import",
                }
                
                await db.customers.insert_one(customer_data)
                
                return {
                    "success": True,
                    "parsed": parsed,
                    "customer_id": customer_data["id"],
                    "message": "Customer created from email"
                }
            
            return {"success": True, "parsed": parsed, "message": "Email parsed but insufficient data to create customer"}
        
        raise HTTPException(status_code=400, detail="Could not parse email content")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email parse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== CRM INTEGRATION ==============

@api_router.get("/crm/configs")
async def list_crm_configs():
    """List all CRM configurations"""
    try:
        configs = await db.crm_configs.find({}, {"_id": 0, "api_key": 0, "api_secret": 0}).to_list(20)
        return {"configs": configs}
    except Exception as e:
        logger.error(f"List CRM configs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/crm/configs")
async def create_crm_config(config: CRMConfig):
    """Create a new CRM configuration"""
    try:
        config_data = config.model_dump()
        config_data["created_at"] = datetime.now(timezone.utc)
        
        await db.crm_configs.insert_one(config_data)
        
        # Remove sensitive data from response
        config_data.pop("api_key", None)
        config_data.pop("api_secret", None)
        config_data.pop("_id", None)
        
        return {"success": True, "config": config_data}
    except Exception as e:
        logger.error(f"Create CRM config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/crm/configs/{config_id}")
async def delete_crm_config(config_id: str):
    """Delete a CRM configuration"""
    try:
        result = await db.crm_configs.delete_one({"id": config_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Config not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete CRM config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/crm/configs/{config_id}/test")
async def test_crm_connection(config_id: str):
    """Test a CRM connection"""
    try:
        config = await db.crm_configs.find_one({"id": config_id})
        if not config:
            raise HTTPException(status_code=404, detail="Config not found")
        
        # Test connection based on provider
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # Simple health check
                response = await client.get(
                    f"{config['api_url']}/health",
                    headers={"Authorization": f"Bearer {config['api_key']}"}
                )
                return {"success": True, "status": "connected", "status_code": response.status_code}
            except Exception as e:
                return {"success": False, "status": "failed", "error": str(e)}
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test CRM connection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== DASHBOARD STATS ==============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # Customer stats
        total_customers = await db.customers.count_documents({})
        new_leads = await db.customers.count_documents({"lead_status": "new"})
        contacted = await db.customers.count_documents({"lead_status": "contacted"})
        qualified = await db.customers.count_documents({"lead_status": "qualified"})
        sold = await db.customers.count_documents({"lead_status": "sold"})
        
        # Vehicle stats
        active_inventory = await db.vehicles.count_documents({"category": "active_inventory"})
        trade_ins = await db.vehicles.count_documents({"category": "trade_in"})
        
        return {
            "customers": {
                "total": total_customers,
                "new": new_leads,
                "contacted": contacted,
                "qualified": qualified,
                "sold": sold
            },
            "vehicles": {
                "active_inventory": active_inventory,
                "trade_ins": trade_ins,
                "total": active_inventory + trade_ins
            }
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== CLEANUP SOLD CUSTOMERS (30 days) ==============

@api_router.post("/maintenance/cleanup-sold")
async def cleanup_sold_customers():
    """Delete customers marked as sold more than 30 days ago"""
    try:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        result = await db.customers.delete_many({
            "lead_status": "sold",
            "sold_at": {"$lt": cutoff}
        })
        
        return {"success": True, "deleted": result.deleted_count}
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== ROUTER & MIDDLEWARE ==============

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
