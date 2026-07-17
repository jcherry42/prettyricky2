"""iter27 — advisor-workflow tests: verified-fact gate + advisor context
+ service response styles + deterministic unverifiedTopics.

Locks in the shift from "canned-response library" to "verified-fact-driven
advisor tool":
  - confirmedInformation / advisorNotes are separated at the schema level.
  - customerConcern / desiredNextAction chip picks are input.
  - verifiedFactGates gate 6 topics; missing = unverified regardless of model.
  - serviceResponses (Concise / ExplainClearly / DeEscalate) replace the
    tone labels in service mode; sales mode gets none.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from services.intelligence.schemas import (
    AutomotiveInteractionInput,
    VerifiedFactGate,
    VERIFIED_FACT_GATE_KEYS,
)
from services.intelligence.pipeline import _validate_and_normalize
from services.intelligence.prompts import build_user_prompt


def _service(**kw):
    kw.setdefault("mode", "service")
    kw.setdefault("channel", "sms")
    kw.setdefault("customerMessage", "Is my Camry ready and how much?")
    return AutomotiveInteractionInput(**kw)


def _sales(**kw):
    kw.setdefault("mode", "sales")
    kw.setdefault("channel", "sms")
    kw.setdefault("customerMessage", "How much for the Camry?")
    return AutomotiveInteractionInput(**kw)


# ── Input schema: advisor context fields accepted ─────────────────
def test_input_accepts_confirmed_information():
    inp = _service(confirmedInformation="Tech measured front pads at 2mm.")
    assert "2mm" in (inp.confirmedInformation or "")


def test_input_accepts_advisor_notes():
    inp = _service(advisorNotes="Guest sounded hesitant about price.")
    assert (inp.advisorNotes or "").startswith("Guest sounded")


def test_input_accepts_customer_concern_chip():
    inp = _service(customerConcern="cost")
    assert inp.customerConcern == "cost"


def test_input_accepts_desired_next_action_chip():
    inp = _service(desiredNextAction="request_approval")
    assert inp.desiredNextAction == "request_approval"


def test_input_accepts_verified_fact_gates():
    gates = VerifiedFactGate(price="$412.50", diagnosis="worn front pads")
    inp = _service(verifiedFactGates=gates)
    assert inp.verifiedFactGates is not None
    assert inp.verifiedFactGates.price == "$412.50"
    assert inp.verifiedFactGates.diagnosis == "worn front pads"


# ── Deterministic unverifiedTopics (SERVICE MODE) ─────────────────
def test_unverified_topics_all_six_when_no_gates():
    out = _validate_and_normalize({}, _service())
    assert out.unverifiedTopics == VERIFIED_FACT_GATE_KEYS


def test_unverified_topics_excludes_confirmed_keys():
    gates = VerifiedFactGate(price="$412.50", diagnosis="worn front pads")
    out = _validate_and_normalize({}, _service(verifiedFactGates=gates))
    assert out.unverifiedTopics is not None
    assert "price" not in out.unverifiedTopics
    assert "diagnosis" not in out.unverifiedTopics
    assert "warrantyCoverage" in out.unverifiedTopics


def test_unverified_topics_empty_string_treated_as_unverified():
    """Empty strings do not count as verification."""
    gates = VerifiedFactGate(price="  ", diagnosis="")
    out = _validate_and_normalize({}, _service(verifiedFactGates=gates))
    assert out.unverifiedTopics is not None
    assert "price" in out.unverifiedTopics
    assert "diagnosis" in out.unverifiedTopics


def test_unverified_topics_ignores_model_output():
    """Even if the LLM claims a topic is verified, an empty gate wins."""
    out = _validate_and_normalize(
        {"unverifiedTopics": []},  # model lies
        _service(),  # no gates provided
    )
    assert out.unverifiedTopics == VERIFIED_FACT_GATE_KEYS  # deterministic


def test_unverified_topics_null_in_sales_mode():
    out = _validate_and_normalize({}, _sales())
    assert out.unverifiedTopics is None


# ── ServiceResponses (three situation styles) ─────────────────────
def test_service_responses_populated_from_model():
    payload = {
        "serviceResponses": {
            "concise": "We are confirming with the tech, back to you shortly.",
            "explainClearly": "The tech found front pads at 2mm which is below spec. Replacing now prevents rotor damage.",
            "deEscalate": "I hear you and I own this. I am confirming the estimate right now and will call you in 10 min.",
        },
        "responses": {"recommended": "r", "direct": "d", "empathetic": "e"},
    }
    out = _validate_and_normalize(payload, _service())
    assert out.serviceResponses is not None
    assert "confirming with the tech" in out.serviceResponses.concise
    assert "2mm" in out.serviceResponses.explainClearly
    assert "own this" in out.serviceResponses.deEscalate


def test_service_responses_missing_style_falls_back_to_primary():
    payload = {
        "serviceResponses": {"concise": ""},
        "responses": {"recommended": "primary reply", "direct": "d", "empathetic": "e"},
    }
    out = _validate_and_normalize(payload, _service())
    assert out.serviceResponses is not None
    assert out.serviceResponses.concise  # non-empty via fallback


def test_service_responses_length_clamped_per_channel():
    long = "Sentence one. " * 40
    payload = {
        "serviceResponses": {
            "concise": long, "explainClearly": long, "deEscalate": long,
        },
    }
    out = _validate_and_normalize(payload, _service(channel="sms"))
    assert out.serviceResponses is not None
    assert len(out.serviceResponses.concise) <= 320
    assert len(out.serviceResponses.explainClearly) <= 320
    assert len(out.serviceResponses.deEscalate) <= 320


def test_service_responses_null_in_sales_mode():
    payload = {
        "serviceResponses": {"concise": "a", "explainClearly": "b", "deEscalate": "c"},
    }
    out = _validate_and_normalize(payload, _sales())
    assert out.serviceResponses is None


# ── guestConcern falls back to advisor's chip pick ─────────────────
def test_guest_concern_falls_back_to_customer_concern_chip():
    out = _validate_and_normalize({}, _service(customerConcern="cost"))
    assert out.guestConcern is not None
    assert "cost" in out.guestConcern.lower()


# ── User prompt template — separates facts from interpretation ────
def test_user_prompt_includes_advisor_notes_labeled_context_only():
    inp = _service(
        advisorNotes="Guest hesitant about price.",
        confirmedInformation="Tech measured front pads at 2mm.",
    )
    prompt = build_user_prompt(inp)
    assert "ADVISOR NOTES" in prompt
    assert "NEVER state to the guest as fact" in prompt
    assert "Guest hesitant about price" in prompt
    assert "CONFIRMED INFORMATION" in prompt
    assert "MAY be stated as fact" in prompt
    assert "front pads at 2mm" in prompt


def test_user_prompt_lists_unverified_topics_deterministically():
    gates = VerifiedFactGate(price="$100")
    inp = _service(verifiedFactGates=gates)
    prompt = build_user_prompt(inp)
    assert "UNVERIFIED TOPICS" in prompt
    # price is verified so should not appear
    assert '"price"' not in prompt.split("UNVERIFIED TOPICS")[1].split("\n")[0]
    # diagnosis / warrantyCoverage / etc. still appear
    assert "diagnosis" in prompt.split("UNVERIFIED TOPICS")[1].split("\n")[0]


def test_user_prompt_includes_customer_concern_and_desired_next_action():
    inp = _service(customerConcern="cost", desiredNextAction="request_approval")
    prompt = build_user_prompt(inp)
    assert "cost" in prompt
    assert "request_approval" in prompt
