"""
Routes Package
Modular FastAPI route definitions organized by domain

This package contains all API routes split by domain:
- customers: Customer CRUD operations
- vehicles: Vehicle inventory management  
- tower_talk: AI-powered sales responses
- analytics: Analytics and reporting
- license: License scanning and OCR
- vin: VIN decoding
- imports: File/email import
- dashboard: Dashboard statistics
- printer: Printer connectivity
"""

from fastapi import APIRouter

# Create main API router
api_router = APIRouter()

# Import route modules
from .customers import router as customers_router, init_customer_routes
from .vehicles import router as vehicles_router, init_vehicle_routes
from .tower_talk import router as tower_talk_router, init_tower_talk_routes
from .analytics import router as analytics_router, init_analytics_routes
from .license import router as license_router, init_license_routes
from .vin import router as vin_router, init_vin_routes
from .imports import router as imports_router, init_import_routes
from .dashboard import router as dashboard_router, init_dashboard_routes
from .printer import router as printer_router, init_printer_routes


def register_routes(
    customer_repo,
    vehicle_repo,
    conversation_repo,
    db,
    import_processor,
    llm_key
):
    """
    Initialize all route modules with their dependencies
    and register them with the main router
    """
    # Initialize each module with its dependencies
    init_customer_routes(customer_repo, vehicle_repo)
    init_vehicle_routes(vehicle_repo)
    init_tower_talk_routes(llm_key)
    init_analytics_routes(customer_repo, vehicle_repo, db)
    init_license_routes(customer_repo, llm_key)
    init_vin_routes(vehicle_repo)
    init_import_routes(customer_repo, vehicle_repo, import_processor, llm_key)
    init_dashboard_routes(customer_repo, vehicle_repo, conversation_repo, db)
    init_printer_routes(customer_repo)
    
    # Register all routers with prefixes
    api_router.include_router(customers_router, prefix="/customers", tags=["customers"])
    api_router.include_router(vehicles_router, prefix="/vehicles", tags=["vehicles"])
    api_router.include_router(tower_talk_router, tags=["tower_talk"])
    api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
    api_router.include_router(license_router, prefix="/license", tags=["license"])
    api_router.include_router(vin_router, prefix="/vin", tags=["vin"])
    api_router.include_router(imports_router, prefix="/import", tags=["import"])
    api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
    api_router.include_router(printer_router, prefix="/printer", tags=["printer"])
    api_router.include_router(printer_router, prefix="/print", tags=["print"])  # Alias for /print/*
    
    return api_router


__all__ = [
    'api_router',
    'register_routes',
    'customers_router',
    'vehicles_router', 
    'tower_talk_router',
    'analytics_router',
    'license_router',
    'vin_router',
    'imports_router',
    'dashboard_router',
    'printer_router'
]
