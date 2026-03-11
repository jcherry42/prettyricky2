"""Anomaly Detection Routes.

Provides endpoints for VIN fraud/anomaly detection:
- POST /anomalies/scan      — Run full anomaly scan
- GET  /anomalies            — List detected anomalies
- GET  /anomalies/summary    — Dashboard summary
- POST /anomalies/{id}/resolve — Resolve an anomaly
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_anomaly_service = None


def init_anomaly_routes(db):
    global _anomaly_service
    from services.anomaly_detection import AnomalyDetectionService
    _anomaly_service = AnomalyDetectionService(db)


class ResolveRequest(BaseModel):
    resolution: str


@router.post("/anomalies/scan")
async def run_anomaly_scan():
    """Run a full anomaly detection scan across all VIN data."""
    if not _anomaly_service:
        raise HTTPException(status_code=503, detail="Anomaly service not initialized")
    results = await _anomaly_service.run_full_scan()
    return results


@router.get("/anomalies")
async def list_anomalies(
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    limit: int = 50,
    skip: int = 0,
):
    """List detected anomalies with optional filters."""
    if not _anomaly_service:
        raise HTTPException(status_code=503, detail="Anomaly service not initialized")
    return await _anomaly_service.get_anomalies(
        severity=severity, resolved=resolved, limit=limit, skip=skip
    )


@router.get("/anomalies/summary")
async def anomaly_summary():
    """Dashboard-friendly anomaly summary."""
    if not _anomaly_service:
        raise HTTPException(status_code=503, detail="Anomaly service not initialized")
    return await _anomaly_service.get_summary()


@router.post("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(anomaly_id: str, body: ResolveRequest):
    """Mark an anomaly as resolved with a reason."""
    if not _anomaly_service:
        raise HTTPException(status_code=503, detail="Anomaly service not initialized")
    success = await _anomaly_service.resolve_anomaly(anomaly_id, body.resolution)
    if not success:
        raise HTTPException(status_code=404, detail="Anomaly not found or already resolved")
    return {"success": True, "anomaly_id": anomaly_id}
