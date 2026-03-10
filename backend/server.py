"""
Closr API Server - FEDERAL-GRADE SECURITY
Sales automation tool with CRM-agnostic data integration
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import asyncio
import logging
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timezone

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


# ── Performance indexes (created once at startup) ──────────────────────
async def _ensure_perf_indexes():
    """Create indexes that aren't managed by any repository."""
    await asyncio.gather(
        # AI Gateway logs — feature + timestamp for analytics queries
        db.ai_gateway_logs.create_index([("feature", 1), ("timestamp", -1)]),
        db.ai_gateway_logs.create_index([("success", 1)]),
        # Vehicles — category for trade-in count queries
        db.vehicles.create_index([("category", 1)]),
    )
    logger.info("✅ Performance indexes ensured")


# ── Health check cache (avoids DB hit on every k8s probe) ──────────────
import time as _time

_health_cache: dict = {"ts": 0.0, "data": None}
_HEALTH_CACHE_TTL = 5.0  # seconds


# ============== LIFESPAN ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    # Startup
    logger.info("Starting Closr API server - FEDERAL-GRADE SECURITY ENABLED...")
    
    # Initialize FEDERAL SECURITY
    global audit_logger
    audit_logger = AuditLogger(db)

    # ── Phase 1: Parallel index creation (all independent) ──────────
    await asyncio.gather(
        audit_logger.create_indexes(),
        customer_repo.create_indexes(),
        vehicle_repo.create_indexes(),
        source_repo.create_indexes(),
        ensure_tts_indexes(),
        _ensure_perf_indexes(),
    )
    logger.info("✅ All indexes created (parallel)")

    # ── Phase 2: Integration layer (depends on db, parallel where possible) ──
    from integrations import IntegrationManager
    from integrations.webhooks import FortifiedWebhookReceiver
    from integrations.profiles import ProfileManager
    
    integration_mgr = IntegrationManager(db)
    webhook_recv = FortifiedWebhookReceiver(db)
    profile_mgr = ProfileManager(db)
    
    await asyncio.gather(
        integration_mgr.create_indexes(),
        webhook_recv.create_indexes(),
        profile_mgr.create_indexes(),
    )
    await profile_mgr.ensure_builtin_profiles()
    logger.info("✅ Integration layer initialized")

    # ── Phase 3: Services (some depend on each other) ──
    await ab_testing_service.initialize(db)
    for exp in DEFAULT_EXPERIMENTS:
        await ab_testing_service.create_experiment(Experiment(**exp))
    
    from conversation_history import ConversationHistoryService
    _conv_svc = ConversationHistoryService(db)
    await _conv_svc.initialize()
    app.state.conversation_service = _conv_svc
    
    from analytics_service import AnalyticsService
    app.state.analytics_service = AnalyticsService(db)
    
    await init_scheduler(db)

    # Initialize AI Gateway with DB for telemetry
    ai_gateway.init(db=db)

    # Initialize Vector Search + Sales Knowledge Base
    from vector_search import VectorSearchService
    from sales_knowledge_base import seed_knowledge_base
    vector_svc = VectorSearchService(db)
    await vector_svc.ensure_indexes()
    app.state.vector_search = vector_svc

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

    # Inject vector search + telemetry into Tower Talk routes
    from routes.tower_talk_v2 import init_tower_talk_routes as _reinit_tt
    _reinit_tt(vector_search=vector_svc, telemetry=telemetry_svc)

    logger.info("Server startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    shutdown_scheduler()
    # Close shared httpx client in VIN routes
    from routes.vin_v2 import _http_client as vin_http_client
    if vin_http_client and not vin_http_client.is_closed:
        await vin_http_client.aclose()
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
from routes.license import router as license_router, init_license_routes
from routes.knowledge import router as knowledge_router
from routes.telemetry import router as telemetry_router

init_printer_routes_v2(db)
init_vehicle_routes_v2(db, vehicle_repo)
init_tower_talk_routes_v2(os.environ.get('EMERGENT_LLM_KEY', ''))
init_customer_routes_v2(db, customer_repo)
init_vin_routes_v2(db, ai_gateway)
init_tts_voice_routes(db)
init_ai_features_routes(db, ab_testing_service=ab_testing_service)
init_data_management_routes(db, customer_repo, vehicle_repo, source_repo, import_processor, get_scheduler)
init_integrations_routes(db)
init_pin_auth_routes(db)

# License routes — need ai_gateway + uploads dir
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
init_license_routes(db, ai_gateway, UPLOADS_DIR)

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
api_router.include_router(license_router)
api_router.include_router(knowledge_router)
api_router.include_router(telemetry_router)


# ============== HEALTH & STATUS ==============

@api_router.get("/ai/stats")
async def ai_gateway_stats():
    """AI Gateway observability — cost, latency, cache, circuit breakers."""
    return ai_gateway.stats()


@api_router.get("/")
async def root():
    return {"message": "Closr API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint — cached for 5s to avoid DB load from k8s probes."""
    now = _time.monotonic()
    if _health_cache["data"] is not None and (now - _health_cache["ts"]) < _HEALTH_CACHE_TTL:
        return _health_cache["data"]

    scheduler = get_scheduler()
    scheduler_status = scheduler.get_status() if scheduler else {"isRunning": False}
    source_health = await source_repo.get_health_summary()

    result = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scheduler": scheduler_status,
        "dataSources": source_health,
    }
    _health_cache["ts"] = now
    _health_cache["data"] = result
    return result


# ============== ROUTER & MIDDLEWARE ==============

# WebSocket endpoint (registered directly on app, not on api_router)
from routes.websocket import register_websocket_route, ws_manager
register_websocket_route(app)

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
        "connect-src 'self' https://*.emergentagent.com https://*.emergent.run https://*.emergent.com https://automotive-vin-ocr.preview.emergentagent.com"
    )
    # Permissions Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# 3. SECURE CORS - Whitelist only trusted domains
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://automotive-vin-ocr.preview.emergentagent.com",
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
