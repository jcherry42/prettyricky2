"""
Data Models for CRM-Agnostic Integration
Strict Pydantic models with comprehensive validation
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, field_validator, model_validator
import re
import uuid


# ============== ENUMS ==============

class LeadStatus(str, Enum):
    """Normalized lead status values"""
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    NEW = "new"
    SOLD = "sold"
    LOST = "lost"
    
    @classmethod
    def from_string(cls, value: str) -> "LeadStatus":
        """Convert various string values to LeadStatus"""
        if not value:
            return cls.NEW
        
        normalized = value.lower().strip()
        
        mappings = {
            cls.HOT: ['hot', 'a', 'high', 'urgent', 'ready', 'active', '1', 'priority', 'qualified'],
            cls.WARM: ['warm', 'b', 'medium', 'interested', 'engaged', '2', 'working'],
            cls.COLD: ['cold', 'c', 'low', 'dormant', 'inactive', '3', 'stale'],
            cls.NEW: ['new', 'fresh', 'uncontacted', 'unworked', 'lead', 'prospect'],
            cls.SOLD: ['sold', 'closed', 'won', 'delivered', 'complete', 'purchased'],
            cls.LOST: ['lost', 'dead', 'closed_lost', 'not_interested', 'declined', 'cancelled'],
        }
        
        for status, variations in mappings.items():
            if normalized in variations:
                return status
        
        return cls.NEW


class VehicleStatus(str, Enum):
    """Vehicle availability status"""
    AVAILABLE = "available"
    SOLD = "sold"
    PENDING = "pending"
    RESERVED = "reserved"
    IN_TRANSIT = "in_transit"


class DataSourceType(str, Enum):
    """Types of data sources"""
    FILE_UPLOAD = "file_upload"
    URL = "url"
    GOOGLE_SHEETS = "google_sheets"


class RefreshSchedule(str, Enum):
    """Available refresh schedules"""
    MANUAL_ONLY = "manual_only"
    WEEKDAYS_10AM = "weekdays_10am"  # Mon-Sat 10 AM
    DAILY_10AM = "daily_10am"
    HOURLY = "hourly"


# ============== CUSTOMER MODEL ==============

class Customer(BaseModel):
    """
    Normalized customer/lead model
    Supports data from any CRM with smart field mapping
    """
    
    # Identity
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Required fields
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(default="", max_length=100)
    phone: str = Field(..., min_length=7, max_length=20)
    
    # Contact info
    email: str = Field(default="", max_length=255)
    address: str = Field(default="", max_length=500)
    
    # Sales context
    vehicle_of_interest: Optional[str] = Field(default=None, max_length=200)
    lead_status: LeadStatus = Field(default=LeadStatus.NEW)
    
    # Optional enrichment
    notes: str = Field(default="", max_length=2000)
    current_vehicle: Optional[str] = Field(default=None, max_length=200)
    trade_in_info: Optional[str] = Field(default=None, max_length=500)
    
    # Metadata
    source_id: Optional[str] = Field(default=None)
    source_row_id: Optional[str] = Field(default=None)  # Original ID from CRM
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Ensure phone has minimum digits"""
        digits = re.sub(r'[^\d]', '', v)
        if len(digits) < 7:
            raise ValueError('Phone must have at least 7 digits')
        return v
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Basic email format validation"""
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower().strip() if v else ""
    
    @property
    def full_name(self) -> str:
        """Get full name"""
        return f"{self.first_name} {self.last_name}".strip()
    
    @property
    def display_phone(self) -> str:
        """Get formatted phone for display"""
        digits = re.sub(r'[^\d]', '', self.phone)
        if len(digits) == 10:
            return f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        return self.phone
    
    def to_frontend_dict(self) -> Dict[str, Any]:
        """Convert to frontend-compatible format"""
        return {
            "id": self.id,
            "name": self.full_name,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "phone": self.display_phone,
            "email": self.email,
            "address": self.address,
            "vehicleInterest": self.vehicle_of_interest,
            "status": self.lead_status.value,
            "notes": self.notes,
            "currentVehicle": self.current_vehicle,
            "tradeIn": self.trade_in_info,
        }


# ============== VEHICLE MODEL ==============

class Vehicle(BaseModel):
    """
    Normalized vehicle inventory model
    Optimized for quick lookups and minimal memory footprint
    """
    
    # Identity
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Core identification (required)
    year: int = Field(..., ge=1900, le=2100)
    make: str = Field(..., min_length=1, max_length=50)
    model: str = Field(..., min_length=1, max_length=100)
    
    # Additional identification
    trim: str = Field(default="", max_length=100)
    vin: str = Field(default="", max_length=17)
    stock_number: str = Field(default="", max_length=50)
    
    # Pricing
    price: Optional[float] = Field(default=None, ge=0)
    msrp: Optional[float] = Field(default=None, ge=0)
    
    # Specifications (stored as simple strings to save memory)
    mileage: Optional[int] = Field(default=None, ge=0)
    exterior_color: str = Field(default="", max_length=50)
    interior_color: str = Field(default="", max_length=50)
    transmission: str = Field(default="", max_length=50)
    engine: str = Field(default="", max_length=100)
    fuel_type: str = Field(default="", max_length=30)
    body_style: str = Field(default="", max_length=50)
    drivetrain: str = Field(default="", max_length=30)
    
    # Status
    status: VehicleStatus = Field(default=VehicleStatus.AVAILABLE)
    is_new: bool = Field(default=True)
    
    # Media (single URL to save memory - full gallery via separate query)
    image_url: str = Field(default="", max_length=500)
    
    # Metadata
    source_id: Optional[str] = Field(default=None)
    source_row_id: Optional[str] = Field(default=None)
    imported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @field_validator('vin')
    @classmethod
    def validate_vin(cls, v: str) -> str:
        """Clean VIN"""
        if v:
            cleaned = re.sub(r'[^A-HJ-NPR-Z0-9]', '', v.upper())
            return cleaned[:17]
        return ""
    
    @property
    def title(self) -> str:
        """Get vehicle title (Year Make Model)"""
        return f"{self.year} {self.make} {self.model}"
    
    @property
    def full_title(self) -> str:
        """Get full vehicle title with trim"""
        if self.trim:
            return f"{self.year} {self.make} {self.model} {self.trim}"
        return self.title
    
    @property
    def formatted_price(self) -> str:
        """Get formatted price string"""
        if self.price:
            return f"${self.price:,.0f}"
        return "Call for Price"
    
    def to_frontend_dict(self) -> Dict[str, Any]:
        """Convert to frontend-compatible format (lightweight)"""
        return {
            "id": self.id,
            "year": self.year,
            "make": self.make,
            "model": self.model,
            "trim": self.trim,
            "title": self.title,
            "fullTitle": self.full_title,
            "price": self.price,
            "formattedPrice": self.formatted_price,
            "stockNumber": self.stock_number,
            "vin": self.vin,
            "mileage": self.mileage,
            "exteriorColor": self.exterior_color,
            "isNew": self.is_new,
            "status": self.status.value,
            "imageUrl": self.image_url,
        }
    
    def to_frontend_summary(self) -> Dict[str, Any]:
        """Ultra-lightweight summary for lists"""
        return {
            "id": self.id,
            "title": self.full_title,
            "price": self.formatted_price,
            "stockNumber": self.stock_number,
            "isNew": self.is_new,
        }


# ============== DATA SOURCE MODEL ==============

class DataSourceConfig(BaseModel):
    """
    Configuration for a data source
    Tracks URL, schedule, mapping overrides, and health
    """
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Basic info
    name: str = Field(..., min_length=1, max_length=100)
    type: DataSourceType
    data_type: str = Field(default="customers")  # "customers" or "vehicles"
    
    # Connection
    url: Optional[str] = Field(default=None, max_length=2000)
    
    # Scheduling
    is_active: bool = Field(default=True)
    refresh_schedule: RefreshSchedule = Field(default=RefreshSchedule.WEEKDAYS_10AM)
    
    # Field mapping overrides (user corrections)
    field_mapping_overrides: Dict[str, str] = Field(default_factory=dict)
    
    # Health tracking
    last_refresh_at: Optional[datetime] = Field(default=None)
    last_refresh_success: bool = Field(default=False)
    last_refresh_stats: Dict[str, int] = Field(default_factory=dict)
    last_refresh_errors: List[str] = Field(default_factory=list)
    consecutive_failures: int = Field(default=0)
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    @property
    def is_healthy(self) -> bool:
        """Check if source is healthy"""
        return self.consecutive_failures < 3 and self.last_refresh_success
    
    @property
    def needs_attention(self) -> bool:
        """Check if source needs user attention"""
        return self.consecutive_failures >= 2


# ============== IMPORT RESULT MODEL ==============

class FieldMappingResult(BaseModel):
    """Result of field mapping detection"""
    source_field: str
    target_field: str
    confidence: float  # 0.0 to 1.0
    sample_values: List[str] = Field(default_factory=list)


class ImportResult(BaseModel):
    """Result of a data import operation"""
    
    success: bool
    
    # Data
    customers: List[Customer] = Field(default_factory=list)
    vehicles: List[Vehicle] = Field(default_factory=list)
    
    # Mapping info
    detected_mappings: List[FieldMappingResult] = Field(default_factory=list)
    unmapped_fields: List[str] = Field(default_factory=list)
    
    # Stats
    total_rows: int = 0
    imported_count: int = 0
    skipped_count: int = 0
    error_count: int = 0
    
    # Errors (limited to prevent memory issues)
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    
    # Metadata
    processing_time_ms: int = 0
    
    def add_error(self, error: str):
        """Add error with limit"""
        if len(self.errors) < 50:
            self.errors.append(error)
        self.error_count += 1
    
    def add_warning(self, warning: str):
        """Add warning with limit"""
        if len(self.warnings) < 50:
            self.warnings.append(warning)
    
    def to_summary_dict(self) -> Dict[str, Any]:
        """Get summary for API response"""
        return {
            "success": self.success,
            "stats": {
                "total": self.total_rows,
                "imported": self.imported_count,
                "skipped": self.skipped_count,
                "errors": self.error_count,
            },
            "mappings": [m.model_dump() for m in self.detected_mappings],
            "unmappedFields": self.unmapped_fields,
            "errors": self.errors[:10],
            "warnings": self.warnings[:10],
            "processingTimeMs": self.processing_time_ms,
        }
