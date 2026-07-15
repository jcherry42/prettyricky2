"""
Enhanced Customer & Vehicle Models
Supports full CRM functionality with interaction tracking
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Literal, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# Supported languages for CustomerRecord.preferred_language.
# Any value outside this literal will be rejected with 422 by FastAPI/Pydantic.
PreferredLanguage = Literal['en', 'es', 'fr', 'ko']


def _empty_str_to_none(v):
    """Coerce empty strings and whitespace-only strings to None.

    License scans and offline queue submissions frequently send `email: ""`
    for fields the OCR couldn't extract. EmailStr rejects "" outright, so we
    normalize before validation.
    """
    if v is None:
        return None
    if isinstance(v, str) and not v.strip():
        return None
    return v


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    APPOINTMENT = "appointment"
    NEGOTIATING = "negotiating"
    SOLD = "sold"
    SERVICE = "service"
    # Legacy value kept for backward compatibility with older records.
    LOST = "lost"


class LeadSource(str, Enum):
    WALK_IN = "walk_in"
    PHONE = "phone"
    WEB = "web"
    REFERRAL = "referral"
    EMAIL = "email"
    SOCIAL = "social"
    CRM_IMPORT = "crm_import"
    FILE_IMPORT = "file_import"
    LICENSE_SCAN = "license_scan"
    MANUAL = "manual"


class VehicleCategory(str, Enum):
    ACTIVE_INVENTORY = "active_inventory"
    TRADE_IN = "trade_in"


class InteractionType(str, Enum):
    NOTE = "note"
    CALL = "call"
    EMAIL = "email"
    TEXT = "text"
    VISIT = "visit"
    TEST_DRIVE = "test_drive"
    QUOTE = "quote"
    FOLLOW_UP = "follow_up"


# ============== INTERACTION ==============

class CustomerInteraction(BaseModel):
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    interaction_type: InteractionType
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(__import__('datetime').timezone.utc))
    created_by: Optional[str] = None


# ============== CUSTOMER ==============

class CustomerCreate(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    phone: str = Field(default="", max_length=40)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, max_length=300)
    lead_source: LeadSource = LeadSource.MANUAL
    lead_status: LeadStatus = LeadStatus.NEW
    notes: Optional[str] = Field(default=None, max_length=4000)
    vehicle_interests: List[str] = Field(default_factory=list, max_length=2)  # Max 2 vehicles
    trade_in_vehicle_id: Optional[str] = None
    # License scan fields
    license_image_url: Optional[str] = None
    license_number: Optional[str] = Field(default=None, max_length=64)
    license_dob: Optional[str] = None
    license_expiration: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    zip_code: Optional[str] = Field(default=None, max_length=20)
    # Preferred communication language — used by Tower Talk for auto-translation.
    # Strict enum: only 'en' | 'es' | 'fr' | 'ko' accepted. Others → 422.
    preferred_language: Optional[PreferredLanguage] = "en"

    # Normalize common empty-string submissions from OCR / license-scan flows
    # to None BEFORE Pydantic runs stricter validators (EmailStr, etc).
    @field_validator('email', 'address', 'notes', 'license_number', 'license_dob',
                     'license_expiration', 'city', 'state', 'zip_code',
                     'trade_in_vehicle_id', 'license_image_url',
                     mode='before')
    @classmethod
    def _empty_to_none(cls, v):
        return _empty_str_to_none(v)


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=40)
    email: Optional[EmailStr] = None
    address: Optional[str] = Field(default=None, max_length=300)
    lead_source: Optional[LeadSource] = None
    lead_status: Optional[LeadStatus] = None
    notes: Optional[str] = Field(default=None, max_length=4000)
    vehicle_interests: Optional[List[str]] = None
    trade_in_vehicle_id: Optional[str] = None
    license_image_url: Optional[str] = None
    license_number: Optional[str] = Field(default=None, max_length=64)
    license_dob: Optional[str] = None
    license_expiration: Optional[str] = None
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    zip_code: Optional[str] = Field(default=None, max_length=20)
    preferred_language: Optional[PreferredLanguage] = None

    @field_validator('email', 'address', 'notes', 'license_number', 'license_dob',
                     'license_expiration', 'city', 'state', 'zip_code',
                     'trade_in_vehicle_id', 'license_image_url',
                     mode='before')
    @classmethod
    def _empty_to_none(cls, v):
        return _empty_str_to_none(v)


class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    lead_source: LeadSource = LeadSource.MANUAL
    lead_status: LeadStatus = LeadStatus.NEW
    notes: Optional[str] = None
    vehicle_interests: List[str] = Field(default_factory=list)  # VIN or vehicle IDs
    trade_in_vehicle_id: Optional[str] = None
    interactions: List[CustomerInteraction] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(__import__('datetime').timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(__import__('datetime').timezone.utc))
    sold_at: Optional[datetime] = None  # For auto-delete tracking
    source_id: Optional[str] = None  # For imports
    # Preferred communication language ('en'|'es'|'fr'|'ko'). Defaults to English.
    preferred_language: Optional[str] = "en"


# ============== VEHICLE ==============

class VehicleCreate(BaseModel):
    vin: Optional[str] = None
    year: Optional[int] = None
    make: str
    model: str
    trim: Optional[str] = None
    category: VehicleCategory = VehicleCategory.ACTIVE_INVENTORY
    price: Optional[float] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    stock_number: Optional[str] = None
    notes: Optional[str] = None
    # Vehicle history — set to True when the seller has verified a clean CARFAX
    # (no accidents, single owner, clean title, etc). Rendered as a bright-green
    # "CLEAN CARFAX" badge on the vehicle profile when true.
    carfax_clean: Optional[bool] = None
    # For trade-ins
    customer_id: Optional[str] = None  # Links trade-in to customer
    trade_in_value: Optional[float] = None
    condition: Optional[str] = None


class VehicleUpdate(BaseModel):
    vin: Optional[str] = None
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    trim: Optional[str] = None
    category: Optional[VehicleCategory] = None
    price: Optional[float] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    stock_number: Optional[str] = None
    notes: Optional[str] = None
    carfax_clean: Optional[bool] = None
    customer_id: Optional[str] = None
    trade_in_value: Optional[float] = None
    condition: Optional[str] = None
    status: Optional[str] = None


class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    vin: Optional[str] = None
    year: Optional[int] = None
    make: str
    model: str
    trim: Optional[str] = None
    category: VehicleCategory = VehicleCategory.ACTIVE_INVENTORY
    price: Optional[float] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    stock_number: Optional[str] = None
    notes: Optional[str] = None
    customer_id: Optional[str] = None
    trade_in_value: Optional[float] = None
    condition: Optional[str] = None
    status: str = "available"
    # Decoded VIN data
    body_class: Optional[str] = None
    drive_type: Optional[str] = None
    fuel_type: Optional[str] = None
    engine_display: Optional[str] = None
    transmission: Optional[str] = None
    assembly_location: Optional[str] = None
    safety_features: List[str] = Field(default_factory=list)
    # Vehicle history — see VehicleCreate for semantics.
    carfax_clean: Optional[bool] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(__import__('datetime').timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(__import__('datetime').timezone.utc))
    source_id: Optional[str] = None


# ============== EMAIL PARSING ==============

class ParsedEmail(BaseModel):
    sender: str
    subject: str
    body: str
    received_at: datetime
    parsed_customer: Optional[CustomerCreate] = None
    parsed_vehicle: Optional[VehicleCreate] = None
    confidence: float = 0.0


# ============== CRM INTEGRATION ==============

class CRMConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(__import__('uuid').uuid4()))
    name: str
    provider: str  # "vinsolutions", "dealersocket", "elead", "custom"
    api_url: str
    api_key: str
    api_secret: Optional[str] = None
    is_active: bool = True
    sync_customers: bool = True
    sync_vehicles: bool = True
    last_sync: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(__import__('datetime').timezone.utc))
