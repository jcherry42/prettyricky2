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


# ============== ROUTER & MIDDLEWARE ==============

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
