"""Service Mode Overhaul (iter26) — validator tests for new service fields.

Locks in:
  - repairStage enum coercion + input-fallback
  - urgencyClassification coercion + safety-critical bump from risk flags
  - guestConcern string sanitization
  - serviceFramework 4-phase population + partial-fill safety
  - Service-specific objection categories accepted only in service mode
  - Sales mode DOES NOT emit any of the service-only fields (null)
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from services.intelligence.schemas import (
    AutomotiveInteractionInput,
    REPAIR_STAGES,
    SERVICE_OBJECTION_CATEGORIES,
    SERVICE_URGENCY_LEVELS,
)
from services.intelligence.pipeline import _validate_and_normalize


def _service(msg="Is my Camry ready yet?", stage=None):
    return AutomotiveInteractionInput(
        mode="service",
        channel="sms",
        customerMessage=msg,
        repairStage=stage,
    )


def _sales(msg="How much for the Camry?"):
    return AutomotiveInteractionInput(mode="sales", channel="sms", customerMessage=msg)


# ── repairStage ─────────────────────────────────────────────────────
def test_repair_stage_from_model_output_when_valid():
    out = _validate_and_normalize({"repairStage": "in_repair"}, _service())
    assert out.repairStage == "in_repair"


def test_repair_stage_falls_back_to_input_hint():
    out = _validate_and_normalize({"repairStage": "garbage"}, _service(stage="ready_for_pickup"))
    assert out.repairStage == "ready_for_pickup"


def test_repair_stage_defaults_to_diagnosis_when_no_signal():
    out = _validate_and_normalize({}, _service())
    assert out.repairStage == "diagnosis"


def test_repair_stage_post_service_followup_supported():
    """User specifically requested a final post-service follow-up stage."""
    assert "post_service_followup" in REPAIR_STAGES
    out = _validate_and_normalize({"repairStage": "post_service_followup"}, _service())
    assert out.repairStage == "post_service_followup"


def test_repair_stage_null_in_sales_mode():
    out = _validate_and_normalize({"repairStage": "in_repair"}, _sales())
    assert out.repairStage is None


# ── urgencyClassification ──────────────────────────────────────────
def test_urgency_from_model_output_when_valid():
    for u in SERVICE_URGENCY_LEVELS:
        out = _validate_and_normalize({"urgencyClassification": u}, _service())
        assert out.urgencyClassification == u


def test_urgency_defaults_to_routine_maintenance():
    out = _validate_and_normalize({}, _service())
    assert out.urgencyClassification == "routine_maintenance"


def test_urgency_forced_safety_critical_on_safety_flag():
    inp = _service("My brakes are completely gone, unsafe to drive.")
    out = _validate_and_normalize({}, inp)
    assert "safety_concern" in out.riskFlags
    assert out.urgencyClassification == "safety_critical"


def test_urgency_null_in_sales_mode():
    out = _validate_and_normalize({"urgencyClassification": "safety_critical"}, _sales())
    assert out.urgencyClassification is None


# ── guestConcern ───────────────────────────────────────────────────
def test_guest_concern_populated_from_model():
    out = _validate_and_normalize(
        {"guestConcern": "Guest worried the same brake noise is back a week after repair."},
        _service(),
    )
    assert out.guestConcern is not None
    assert "brake" in out.guestConcern.lower()


def test_guest_concern_capped_at_400_chars():
    long = "concern " * 100  # ~800 chars
    out = _validate_and_normalize({"guestConcern": long}, _service())
    assert out.guestConcern is not None
    assert len(out.guestConcern) <= 400


def test_guest_concern_none_when_missing():
    out = _validate_and_normalize({}, _service())
    assert out.guestConcern is None


def test_guest_concern_null_in_sales_mode():
    out = _validate_and_normalize(
        {"guestConcern": "should be dropped in sales"}, _sales()
    )
    assert out.guestConcern is None


# ── serviceFramework (Acknowledge -> Facts -> Impact -> Next Step) ─
def test_service_framework_all_four_phases():
    payload = {
        "serviceFramework": {
            "acknowledge": "I hear you — waiting is frustrating.",
            "verifiedFactsStatement": "Your Camry is in bay 3 with the tech.",
            "impact": "You'll be back on the road today.",
            "nextStep": "We'll text you the moment it clears QC.",
        }
    }
    out = _validate_and_normalize(payload, _service())
    assert out.serviceFramework is not None
    assert out.serviceFramework.acknowledge.startswith("I hear you")
    assert "bay 3" in out.serviceFramework.verifiedFactsStatement
    assert "road today" in out.serviceFramework.impact
    assert "text you" in out.serviceFramework.nextStep


def test_service_framework_partial_fill_gets_safe_defaults():
    payload = {
        "serviceFramework": {
            "acknowledge": "Understood.",
            # verifiedFactsStatement + impact missing
            "nextStep": "We will call you back within the hour.",
        }
    }
    out = _validate_and_normalize(payload, _service())
    assert out.serviceFramework is not None
    assert out.serviceFramework.verifiedFactsStatement  # non-empty safe default
    assert out.serviceFramework.impact  # non-empty safe default


def test_service_framework_dropped_when_ack_or_next_missing():
    """If the model can't fill the two anchor phases, drop the whole block."""
    out = _validate_and_normalize({"serviceFramework": {"impact": "only impact"}}, _service())
    assert out.serviceFramework is None


def test_service_framework_null_in_sales_mode():
    payload = {
        "serviceFramework": {
            "acknowledge": "a",
            "verifiedFactsStatement": "b",
            "impact": "c",
            "nextStep": "d",
        }
    }
    out = _validate_and_normalize(payload, _sales())
    assert out.serviceFramework is None


# ── Service objection categories ───────────────────────────────────
def test_service_objection_category_accepted_in_service_mode():
    for cat in SERVICE_OBJECTION_CATEGORIES:
        out = _validate_and_normalize(
            {"objection": {"detected": True, "category": cat, "confidence": 0.8}},
            _service(),
        )
        assert out.objection.category == cat, f"expected {cat} to be accepted"


def test_service_objection_category_rejected_in_sales_mode():
    """Sales mode must NOT accept service-only categories."""
    out = _validate_and_normalize(
        {"objection": {"detected": True, "category": "parts_availability_delay", "confidence": 0.8}},
        _sales(),
    )
    assert out.objection.detected is True
    assert out.objection.category is None  # dropped


def test_sales_objection_category_still_accepted_in_service_mode():
    """Service mode is a superset — sales categories should still validate."""
    out = _validate_and_normalize(
        {"objection": {"detected": True, "category": "price_too_high", "confidence": 0.8}},
        _service(),
    )
    assert out.objection.category == "price_too_high"


# ── Sales mode fully unaffected by service extension ──────────────
def test_sales_mode_has_no_service_fields_ever():
    payload = {
        "repairStage": "in_repair",
        "urgencyClassification": "safety_critical",
        "guestConcern": "should not appear",
        "serviceFramework": {
            "acknowledge": "a", "verifiedFactsStatement": "b",
            "impact": "c", "nextStep": "d",
        },
    }
    out = _validate_and_normalize(payload, _sales())
    assert out.repairStage is None
    assert out.urgencyClassification is None
    assert out.guestConcern is None
    assert out.serviceFramework is None
