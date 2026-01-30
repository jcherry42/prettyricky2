"""
Routes Package
Modular FastAPI route definitions organized by domain
"""

from fastapi import APIRouter

# Create main API router
api_router = APIRouter()

# Import and include all route modules
from .customers import router as customers_router
from .vehicles import router as vehicles_router
from .tower_talk import router as tower_talk_router
from .analytics import router as analytics_router

# Register routes
api_router.include_router(customers_router, prefix="/customers", tags=["customers"])
api_router.include_router(vehicles_router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(tower_talk_router, tags=["tower_talk"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
