"""Canonical Pydantic schemas for the intelligence pipeline.

DO NOT modify these types without version-bumping the pipeline. They form
the contract between mobile clients, the AI gateway, and the validator.
"""
from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator


# ---------- Input ----------
class ConversationMessage(BaseModel):
    author: Literal["customer", "employee"]
    text: str
    timestamp: Optional[str] = None


class VehicleContext(BaseModel):
    year: Optional[int] = None
    make: Optional[str] = None
    model: Optional[str] = None
    trim: Optional[str] = None
    vin: Optional[str] = None
    stockNumber: Optional[str] = None
    mileage: Optional[int] = None


class DealershipContext(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    hours: Optional[str] = None


class EmployeeContext(BaseModel):
    name: Optional[str] = None
    role: Literal["salesperson", "service_advisor"] = "salesperson"


class ServiceRecommendation(BaseModel):
    id: str
    category: Literal["safety_critical", "required_soon", "routine_maintenance", "optional"]
    title: str
    condition: Optional[str] = None
    evidence: Optional[str] = None
    consequence: Optional[str] = None
    recommendedAction: str
    urgency: Literal["immediate", "soon", "monitor", "optional"]
    estimateAmount: Optional[float] = None
    warrantyStatus: Optional[Literal["covered", "not_covered", "pending_verification"]] = None
    approved: Optional[bool] = None


class VerifiedFacts(BaseModel):
    """Only content in `verifiedFacts` may be presented as confirmed fact.
    Everything else is `unknown` and the model must not invent it.
    """
    price: Optional[float] = None
    availability: Optional[bool] = None
    appointmentTimes: Optional[List[str]] = None
    repairStatus: Optional[str] = None
    estimateAmount: Optional[float] = None
    warrantyStatus: Optional[str] = None
    partsStatus: Optional[str] = None
    promisedCompletionTime: Optional[str] = None
    recommendations: Optional[List[ServiceRecommendation]] = None


class UserPreferences(BaseModel):
    tone: Optional[Literal["professional", "friendly", "direct", "empathetic"]] = "professional"
    responseLength: Optional[Literal["short", "standard", "detailed"]] = "standard"
    appointmentStyle: Optional[Literal["soft", "balanced", "direct"]] = "balanced"


class AutomotiveInteractionInput(BaseModel):
    mode: Literal["sales", "service"] = "sales"
    channel: Literal["sms", "email", "chat", "in_person"] = "sms"
    customerName: Optional[str] = None
    customerLanguage: Optional[str] = "en"
    customerMessage: str
    conversationHistory: Optional[List[ConversationMessage]] = None
    vehicle: Optional[VehicleContext] = None
    dealership: Optional[DealershipContext] = None
    employee: Optional[EmployeeContext] = None
    verifiedFacts: Optional[VerifiedFacts] = None
    userPreferences: Optional[UserPreferences] = None

    @field_validator("customerMessage")
    @classmethod
    def _non_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("customerMessage cannot be empty")
        return v


# ---------- Output ----------
class ObjectionAnalysis(BaseModel):
    detected: bool = False
    category: Optional[str] = None
    confidence: float = 0.0
    underlyingConcern: Optional[str] = None


class SentimentAnalysis(BaseModel):
    label: Literal["positive", "neutral", "uncertain", "frustrated", "angry"] = "neutral"
    confidence: float = 0.0


class ResponseVariants(BaseModel):
    recommended: str
    direct: str
    empathetic: str


class NextBestAction(BaseModel):
    action: str
    reason: str


class AutomotiveInteractionOutput(BaseModel):
    detectedLanguage: str = "en"
    translatedCustomerMeaning: Optional[str] = None
    mode: Literal["sales", "service"] = "sales"
    primaryIntent: str
    secondaryIntent: Optional[str] = None
    conversationStage: str
    objection: ObjectionAnalysis = Field(default_factory=ObjectionAnalysis)
    customerSentiment: SentimentAnalysis = Field(default_factory=SentimentAnalysis)
    recommendedStrategy: str
    responses: ResponseVariants
    nextBestAction: NextBestAction
    missingInformation: List[str] = Field(default_factory=list)
    riskFlags: List[str] = Field(default_factory=list)
    # instrumentation (populated by the pipeline, not the model)
    latency_ms: Optional[Dict[str, int]] = None
    prompt_version: Optional[str] = None
    fallback_used: bool = False


# ---------- Enums (for validator + tests) ----------
SALES_INTENTS = [
    "availability", "price", "payment", "financing", "trade",
    "appointment", "vehicle_features", "vehicle_comparison",
    "condition_or_history", "location_or_hours", "followup", "general_question",
]

SERVICE_INTENTS = [
    "appointment_scheduling", "vehicle_status_update", "estimate_or_price_explanation",
    "recommended_service_explanation", "warranty_or_coverage_question",
    "maintenance_interval_guidance", "transportation_request",
    "parts_availability_or_delay", "pickup_payment_completion",
]

SALES_STAGES = [
    "new_inquiry", "information_gathering", "vehicle_interest", "price_discussion",
    "payment_discussion", "trade_discussion", "appointment_negotiation",
    "appointment_confirmed", "post_visit_followup", "objection", "lost_or_inactive",
]

SERVICE_STAGES = [
    "appointment_request", "vehicle_dropoff", "initial_diagnosis", "estimate_pending",
    "approval_requested", "work_in_progress", "parts_delay", "quality_control",
    "ready_for_pickup", "post_service_followup", "complaint_or_escalation",
]

OBJECTION_CATEGORIES = [
    "price_too_high", "payment_too_high", "needs_to_think", "comparing_options",
    "not_ready", "needs_spouse_or_partner", "credit_concern", "trade_value_concern",
    "distance_or_schedule", "vehicle_feature_concern", "trust_concern",
    "availability_uncertainty", "negative_previous_experience",
]

RESPONSE_STRATEGIES = [
    "answer_directly", "ask_clarifying_question", "provide_reassurance",
    "explain_value", "request_appointment", "confirm_appointment", "request_approval",
    "provide_status_update", "set_expectations", "deescalate",
    "request_additional_information", "escalate_to_human",
]

SERVICE_ESCALATION_TRIGGERS = [
    "repeat_repair", "safety_concern", "vehicle_damage_claim", "missed_promised_time",
    "unexpected_charge", "warranty_dispute", "angry_customer", "request_for_manager",
    "legal_threat", "social_media_threat",
]

# Channel character caps for validator
CHANNEL_MAX_CHARS = {"sms": 320, "chat": 500, "email": 2000, "in_person": 800}
