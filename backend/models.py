"""
Enhanced Customer & Vehicle Models
Supports full CRM functionality with interaction tracking
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class LeadStatus(str, Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    NEGOTIATING = "negotiating"
    SOLD = "sold"
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
    first_name: str
    last_name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    lead_source: LeadSource = LeadSource.MANUAL
    lead_status: LeadStatus = LeadStatus.NEW
    notes: Optional[str] = None
    vehicle_interests: List[str] = Field(default_factory=list, max_length=2)  # Max 2 vehicles
    trade_in_vehicle_id: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    lead_source: Optional[LeadSource] = None
    lead_status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    vehicle_interests: Optional[List[str]] = None
    trade_in_vehicle_id: Optional[str] = None


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
