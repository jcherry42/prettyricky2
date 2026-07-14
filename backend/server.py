"""
Closr API Server - FEDERAL-GRADE SECURITY
Sales automation tool with CRM-agnostic data integration
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
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

# Response models for contract stability
from models.responses import (
    HealthResponse, ReadyResponse, RootResponse,
    MetricsResponse, ProcessMetrics, DatabaseMetrics,
)

# FEDERAL SECURITY IMPORTS
from security.rate_limit import RateLimitMiddleware
from security.audit import AuditLogger

# Authentication enforcement
from fastapi import Depends
from middleware.auth_deps import require_auth, init_auth_deps

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

# Configure structured logging — respects LOG_FORMAT env (text | json)
# and LOG_LEVEL env (default INFO). Call BEFORE any logger.* usage below.
from lib.logging_config import configure_logging
configure_logging()

logger = logging.getLogger(__name__)

# Startup timing
_BOOT_START = __import__('time').monotonic()

# ── Environment validation — fail fast on missing critical config ─────
_REQUIRED_ENV = ['MONGO_URL', 'DB_NAME']
_RECOMMENDED_ENV = ['EMERGENT_LLM_KEY', 'JWT_SECRET_KEY']

for var in _REQUIRED_ENV:
    if not os.environ.get(var):
        raise RuntimeError(f"FATAL: Required environment variable '{var}' is not set. Server cannot start.")

for var in _RECOMMENDED_ENV:
    if not os.environ.get(var):
        logger.warning(f"Recommended env var '{var}' not set — some features may be limited")

# ── Sentry crash reporting + performance monitoring (optional) ────────
# Enabled only when SENTRY_DSN_BACKEND is set. Fails gracefully otherwise.
_SENTRY_DSN = os.environ.get('SENTRY_DSN_BACKEND') or os.environ.get('SENTRY_DSN')
if _SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        def _scrub_event(event, _hint):
            # Strip auth headers + cookies + user PII before sending to Sentry.
            user = event.get('user') or {}
            user.pop('email', None)
            user.pop('ip_address', None)
            req = event.get('request') or {}
            headers = req.get('headers') or {}
            for h in ('authorization', 'cookie', 'x-api-key'):
                headers.pop(h, None)
            req['headers'] = headers
            event['request'] = req
            event['user'] = user
            return event

        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            environment=os.environ.get('SENTRY_ENVIRONMENT', 'production'),
            release=os.environ.get('APP_RELEASE'),
            send_default_pii=False,
            traces_sample_rate=float(os.environ.get('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
            profiles_sample_rate=float(os.environ.get('SENTRY_PROFILES_SAMPLE_RATE', '0.0')),
            integrations=[
                StarletteIntegration(transaction_style='endpoint'),
                FastApiIntegration(transaction_style='endpoint'),
            ],
            before_send=_scrub_event,
        )
        logger.info(f"Sentry initialized (env={os.environ.get('SENTRY_ENVIRONMENT', 'production')})")
    except ImportError:
        logger.warning("SENTRY_DSN set but sentry-sdk not installed — skipping crash reporting")
    except Exception as e:
        logger.warning(f"Sentry initialization failed (non-fatal): {e}")
else:
    logger.info("Sentry disabled — set SENTRY_DSN_BACKEND to enable crash reporting")

# MongoDB connection with tuned pool — production-grade settings
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(
    mongo_url,
    maxPoolSize=50,
    minPoolSize=5,
    maxIdleTimeMS=30000,
    connectTimeoutMS=5000,
    serverSelectionTimeoutMS=5000,
    retryWrites=True,
    retryReads=True,
    compressors='zstd,snappy,zlib',
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
        # Vehicles — VIN lookup (sparse to match existing index)
        db.vehicles.create_index([("vin", 1)], sparse=True),
        # Vehicles — compound: category + created_at for sorted inventory queries
        db.vehicles.create_index([("category", 1), ("created_at", -1)]),
        # Customers — text search on name fields
        db.customers.create_index([("first_name", 1), ("last_name", 1)]),
        # Customers — lead_status for filtered queries
        db.customers.create_index([("lead_status", 1), ("created_at", -1)]),
        # Customers — unique id field (used as primary key in app logic)
        db.customers.create_index([("id", 1)], unique=True, sparse=True),
        # Auth — type lookup (PIN auth)
        db.auth.create_index([("type", 1)], unique=True),
    )
    logger.info("Performance indexes ensured")


# ── TTL indexes (auto-expire old data) ────────────────────────────────
async def _ensure_ttl_indexes():
    """Create TTL indexes for automatic data expiration."""
    await asyncio.gather(
        # AI gateway logs — expire after 30 days
        db.ai_gateway_logs.create_index(
            [("timestamp", 1)],
            expireAfterSeconds=30 * 24 * 3600,
            name="ttl_ai_logs_30d",
        ),
        # Telemetry events — expire after 90 days
        db.telemetry_events.create_index(
            [("timestamp", 1)],
            expireAfterSeconds=90 * 24 * 3600,
            name="ttl_telemetry_90d",
        ),
        # Diagnostics temp collection — expire after 1 hour (safety net)
        db["_diagnostics"].create_index(
            [("ts", 1)],
            expireAfterSeconds=3600,
            name="ttl_diagnostics_1h",
        ),
    )
    logger.info("TTL indexes ensured (30d logs, 90d telemetry, 1h diagnostics)")


# ── Health check cache (avoids DB hit on every k8s probe) ──────────────
import time as _time

_health_cache: dict = {"ts": 0.0, "data": None}
_HEALTH_CACHE_TTL = 5.0  # seconds

# ── Stale upload cleanup ──────────────────────────────────────────────
_UPLOAD_MAX_AGE_HOURS = 72  # Delete uploaded files older than 3 days

async def _cleanup_stale_uploads():
    """Remove old upload files and expired chunk sessions."""
    uploads_dir = ROOT_DIR / "uploads"
    chunks_dir = uploads_dir / "chunks"
    now = _time.time()
    max_age = _UPLOAD_MAX_AGE_HOURS * 3600
    removed_files = 0
    removed_chunks = 0
    freed_bytes = 0

    # Clean stale uploaded license images
    if uploads_dir.exists():
        for f in uploads_dir.iterdir():
            if f.is_file() and f.suffix in ('.png', '.jpg', '.jpeg', '.tmp'):
                try:
                    age = now - f.stat().st_mtime
                    if age > max_age:
                        size = f.stat().st_size
                        f.unlink()
                        removed_files += 1
                        freed_bytes += size
                except OSError:
                    pass

    # Clean stale chunk directories
    if chunks_dir.exists():
        import shutil
        for d in chunks_dir.iterdir():
            if d.is_dir():
                meta = d / "meta.json"
                if meta.exists():
                    try:
                        age = now - meta.stat().st_mtime
                        if age > 3600:  # 1 hour for incomplete chunks
                            shutil.rmtree(d, ignore_errors=True)
                            removed_chunks += 1
                    except OSError:
                        pass
                else:
                    # No metadata = orphaned directory
                    shutil.rmtree(d, ignore_errors=True)
                    removed_chunks += 1

    if removed_files > 0 or removed_chunks > 0:
        freed_mb = round(freed_bytes / (1024 * 1024), 1)
        logger.info(f"Cleanup: removed {removed_files} stale files ({freed_mb}MB), {removed_chunks} chunk sessions")


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
        _ensure_ttl_indexes(),
    )
    logger.info("All indexes created (parallel)")

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
    logger.info("Integration layer initialized")

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
            logger.info(f"Sales knowledge base seeded ({count} entries)")
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

    # Initialize Anomaly Detection Service
    from services.anomaly_detection import AnomalyDetectionService
    anomaly_svc = AnomalyDetectionService(db)
    await anomaly_svc.ensure_indexes()
    app.state.anomaly_detection = anomaly_svc

    # Session persistence indexes
    await ensure_session_indexes()

    # Clean up stale uploads from previous runs
    asyncio.create_task(_cleanup_stale_uploads())

    # Mark app as ready
    app.state.ready = True
    boot_ms = (_time.monotonic() - _BOOT_START) * 1000
    logger.info(f"Server startup complete in {boot_ms:.0f}ms")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    app.state.ready = False
    shutdown_scheduler()
    # Close shared httpx client in VIN routes
    from routes.vin_v2 import _http_client as vin_http_client
    if vin_http_client and not vin_http_client.is_closed:
        await vin_http_client.aclose()
    client.close()
    logger.info("Shutdown complete")


# Create app with lifespan — ORJSONResponse for 3-5x faster serialization
app = FastAPI(
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    docs_url=None,       # Disable Swagger UI in production
    redoc_url=None,      # Disable ReDoc in production
    openapi_url=None,    # Disable OpenAPI schema in production
)

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
from routes.diagnostics import router as diagnostics_router, init_diagnostics_routes
from routes.anomaly_detection import router as anomaly_router, init_anomaly_routes
from routes.sessions import router as sessions_router, init_session_routes, ensure_session_indexes
from routes.intelligence import router as intelligence_router

# Initialize auth deps with DB
init_auth_deps(db)

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
init_diagnostics_routes(db, ai_gateway, UPLOADS_DIR)
init_anomaly_routes(db)
init_session_routes(db)

# ── AUTH ENFORCEMENT ─────────────────────────────────────────────────
# PUBLIC routers — no auth required (infrastructure + auth flow)
api_router.include_router(pin_auth_router)          # /auth/* — login, setup, refresh
api_router.include_router(diagnostics_router)        # /diagnostics — self-test

# PROTECTED routers — require valid JWT Bearer token
_auth_dep = [Depends(require_auth)]
api_router.include_router(printer_router_v2, dependencies=_auth_dep)
api_router.include_router(vehicles_router_v2, dependencies=_auth_dep)
api_router.include_router(tower_talk_router_v2, dependencies=_auth_dep)
api_router.include_router(customers_router_v2, dependencies=_auth_dep)
api_router.include_router(vin_router_v2, dependencies=_auth_dep)
api_router.include_router(tts_voice_router, dependencies=_auth_dep)
api_router.include_router(ai_features_router, dependencies=_auth_dep)
api_router.include_router(data_mgmt_router, dependencies=_auth_dep)
api_router.include_router(integrations_router, dependencies=_auth_dep)
api_router.include_router(license_router, dependencies=_auth_dep)
api_router.include_router(knowledge_router, dependencies=_auth_dep)
api_router.include_router(telemetry_router, dependencies=_auth_dep)
api_router.include_router(anomaly_router, dependencies=_auth_dep)
api_router.include_router(sessions_router, dependencies=_auth_dep)
api_router.include_router(intelligence_router, dependencies=_auth_dep)
logger.info("Auth enforcement enabled — all protected endpoints require valid JWT")


# ============== HEALTH & STATUS ==============

@api_router.get("/ai/stats")
async def ai_gateway_stats():
    """AI Gateway observability — cost, latency, cache, circuit breakers."""
    return ai_gateway.stats()


@api_router.get("/", response_model=RootResponse)
async def root():
    return {"message": "Closr API", "version": "2.1.0"}

@api_router.get("/health", response_model=HealthResponse)
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
        "version": "2.1.0",
        "scheduler": scheduler_status,
        "dataSources": source_health,
    }
    _health_cache["ts"] = now
    _health_cache["data"] = result
    return result


@api_router.get("/ready", response_model=ReadyResponse)
async def readiness_check(request: Request):
    """Readiness probe — returns 503 until app is fully initialized OR if DB is down.
    Response ALWAYS includes db status for observability (kubernetes/monitoring probes)."""
    if not getattr(request.app.state, 'ready', False):
        raise HTTPException(status_code=503, detail={"ready": False, "db": "unknown", "reason": "app_starting"})
    # Verify Mongo connectivity
    try:
        await db.command("ping")
    except Exception as e:
        raise HTTPException(status_code=503, detail={"ready": False, "db": "down", "reason": str(e)[:200]})
    return {"ready": True, "db": "up"}


@api_router.get("/metrics", response_model=MetricsResponse)
async def metrics():
    """Operational metrics for monitoring dashboards."""
    import psutil
    process = psutil.Process()

    mem = process.memory_info()
    cpu_pct = process.cpu_percent(interval=0)

    # DB stats
    try:
        db_stats = await db.command("dbStats")
        db_size_mb = round(db_stats.get("dataSize", 0) / (1024 * 1024), 2)
        db_collections = db_stats.get("collections", 0)
    except Exception:
        db_size_mb = -1
        db_collections = -1

    return {
        "uptime_seconds": round(_time.monotonic() - _BOOT_START, 1),
        "process": {
            "memory_rss_mb": round(mem.rss / (1024 * 1024), 1),
            "memory_vms_mb": round(mem.vms / (1024 * 1024), 1),
            "cpu_percent": cpu_pct,
            "threads": process.num_threads(),
        },
        "database": {
            "size_mb": db_size_mb,
            "collections": db_collections,
        },
        "ai_gateway": ai_gateway.stats(),
    }


# ============== ROUTER & MIDDLEWARE ==============

# WebSocket endpoint (registered directly on app, not on api_router)
from routes.websocket import register_websocket_route, ws_manager
register_websocket_route(app)

# Expose ws_manager for use by route modules
import builtins
builtins.ws_manager = ws_manager

# Mount the API router at /api (primary) AND /api/v2 (versioned).
# The router already has prefix="/api", so /api/v2 needs a redirect approach.
app.include_router(api_router)

# API versioning: /api/v2/* rewrites to /api/* via middleware
@app.middleware("http")
async def api_version_rewrite(request: Request, call_next):
    """Rewrite /api/v2/* to /api/* so both paths are valid."""
    path = request.scope.get("path", "")
    if path.startswith("/api/v2/"):
        request.scope["path"] = "/api/" + path[8:]  # strip "/api/v2/"
    elif path == "/api/v2":
        request.scope["path"] = "/api/"
    return await call_next(request)

# FEDERAL-LEVEL SECURITY MIDDLEWARE

# 1. Rate Limiting (DDoS Protection)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, burst_size=150)
logger.info("Rate limiting enabled: 100 req/min, 150 burst")

# 2. Security Headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # HSTS - Force HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
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
        "connect-src 'self' https://*.emergentagent.com https://*.emergent.run https://*.emergent.com"
    )
    # Permissions Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # Cache-Control for API responses
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
    return response

# 3. SECURE CORS - Whitelist only trusted domains
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://vin-scanner-audit.preview.emergentagent.com",
    os.environ.get('FRONTEND_URL', '')
]
# Filter out empty strings
ALLOWED_ORIGINS = [origin for origin in ALLOWED_ORIGINS if origin]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,  # FEDERAL-LEVEL: NO WILDCARDS
    allow_origin_regex=r"^(https?://(localhost(:\d+)?|.*\.emergentagent\.com|.*\.emergent\.run|.*\.emergent\.com)|null)$",
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Correlation-ID"],
)

logger.info(f"CORS configured for: {ALLOWED_ORIGINS}")
logger.info("Security headers enabled")
