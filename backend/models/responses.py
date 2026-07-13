"""Shared Pydantic response models for API contract stability.

These models ensure consistent response structures across all endpoints.
Breaking changes are caught at compile time, not in production.
"""
from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime


# ── Health / Status ──────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = Field(description="Server health status: 'healthy' or 'degraded'")
    timestamp: str = Field(description="ISO 8601 timestamp")
    version: str = Field(description="API version string")
    scheduler: Dict[str, Any] = Field(default_factory=dict)
    dataSources: Dict[str, Any] = Field(default_factory=dict)


class ReadyResponse(BaseModel):
    ready: bool
    db: Optional[str] = None  # 'up' | 'down' | 'unknown'


class RootResponse(BaseModel):
    message: str
    version: str


# ── Metrics / Diagnostics ──────────────────────────────────────────

class ProcessMetrics(BaseModel):
    memory_rss_mb: float
    memory_vms_mb: float
    cpu_percent: float
    threads: int


class DatabaseMetrics(BaseModel):
    size_mb: float
    collections: int


class MetricsResponse(BaseModel):
    uptime_seconds: float
    process: ProcessMetrics
    database: DatabaseMetrics
    ai_gateway: Dict[str, Any]


class DiagnosticProbe(BaseModel):
    name: str
    status: str = Field(description="pass | warn | fail")
    latency_ms: float = 0
    error: Optional[str] = None


class DiagnosticsSummary(BaseModel):
    passed: int
    warned: int
    failed: int
    total: int


class DiagnosticsResponse(BaseModel):
    status: str = Field(description="Overall: pass | warn | fail")
    total_ms: float
    summary: DiagnosticsSummary
    probes: List[DiagnosticProbe]
    failed_components: Optional[List[str]] = None
    warned_components: Optional[List[str]] = None


# ── Customer ─────────────────────────────────────────────────────────

class CustomerBrief(BaseModel):
    id: str
    first_name: str = ""
    last_name: str = ""
    name: str = ""
    email: Optional[str] = None
    phone: Optional[str] = None
    lead_status: Optional[str] = None
    preferred_language: Optional[str] = None
    created_at: Optional[str] = None


class CustomerListResponse(BaseModel):
    customers: List[Dict[str, Any]]
    count: int
    total: int = 0


class CustomerStatsResponse(BaseModel):
    total: int
    active: int = 0
    healthy: int = 0
    needsAttention: int = 0


# ── Vehicle / VIN ────────────────────────────────────────────────────

class VinDecodeResponse(BaseModel):
    vin: str
    year: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    trim: Optional[str] = None
    manufacturer: Optional[str] = None
    vehicle_type: Optional[str] = None
    body_class: Optional[str] = None
    fuel_type: Optional[str] = None
    engine_display: Optional[str] = None
    assembly_location: Optional[str] = None
    safety_features: List[str] = Field(default_factory=list)
    validation: Optional[Dict[str, Any]] = None

    class Config:
        extra = "allow"  # Allow additional NHTSA fields


class TradeInCountResponse(BaseModel):
    count: int
    cap: int
    remaining: int
    at_limit: bool


class VinSaveResponse(BaseModel):
    success: bool
    message: str
    vin: Optional[str] = None


class BatchVinDecodeResponse(BaseModel):
    results: List[Dict[str, Any]]
    total: int
    decoded: int
    failed: int
    cached: int = 0


class VinOcrResponse(BaseModel):
    vins: List[str]
    confidence: str = Field(description="high | medium | low")
    notes: str = ""
    raw_response: Optional[str] = None


# ── Auth ─────────────────────────────────────────────────────────────

class AuthStatusResponse(BaseModel):
    pin_set: bool
    emergency_override: bool = False


class PinVerifyResponse(BaseModel):
    success: bool
    message: str = ""
