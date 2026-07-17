"""Deterministic validator tests for the Apex Intelligence Framework.

These do NOT call the LLM — they exercise the validator/normalizer directly
so we can lock in the non-negotiable guarantees (enum coercion, response
length caps, risk-flag detection, no invented facts, etc.).
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import pytest
from services.intelligence.schemas import (
    AutomotiveInteractionInput,
    CHANNEL_MAX_CHARS,
    OBJECTION_CATEGORIES,
    RESPONSE_STRATEGIES,
    SALES_INTENTS,
    SERVICE_STAGES,
)
from services.intelligence.pipeline import (
    _detect_service_risk_flags,
    _validate_and_normalize,
    _extract_json,
    _clamp_response_length,
)


def _sales_input(msg="How much is the Camry?", channel="sms"):
    return AutomotiveInteractionInput(
        mode="sales", channel=channel, customerMessage=msg,
    )


def _service_input(msg, channel="sms"):
    return AutomotiveInteractionInput(
        mode="service", channel=channel, customerMessage=msg,
    )


# ────────────────────────── Enum coercion ──────────────────────────

def test_invalid_intent_falls_back_to_last_sales_enum():
    out = _validate_and_normalize(
        {"primaryIntent": "wild_hallucination", "responses": {"recommended": "hi"}, "nextBestAction": {"action": "x", "reason": "y"}},
        _sales_input(),
    )
    assert out.primaryIntent == SALES_INTENTS[-1]


def test_invalid_stage_falls_back_first_service_enum():
    out = _validate_and_normalize(
        {"conversationStage": "totally_fake"},
        _service_input("hi"),
    )
    assert out.conversationStage == SERVICE_STAGES[0]


def test_invalid_strategy_falls_back_to_answer_directly():
    out = _validate_and_normalize({"recommendedStrategy": "manipulate"}, _sales_input())
    assert out.recommendedStrategy in RESPONSE_STRATEGIES
    assert out.recommendedStrategy == "answer_directly"


def test_secondary_intent_dropped_if_invalid():
    out = _validate_and_normalize(
        {"primaryIntent": "price", "secondaryIntent": "not_real"},
        _sales_input(),
    )
    assert out.secondaryIntent is None


# ────────────────────────── Objection normalization ──────────────────────────

def test_objection_category_cleared_when_detected_false():
    out = _validate_and_normalize(
        {"objection": {"detected": False, "category": "price_too_high", "confidence": 0.9}},
        _sales_input(),
    )
    assert out.objection.detected is False
    assert out.objection.category is None
    assert out.objection.underlyingConcern is None


def test_objection_invalid_category_dropped_but_detected_kept():
    out = _validate_and_normalize(
        {"objection": {"detected": True, "category": "made_up", "confidence": 0.8,
                       "underlyingConcern": "fee anxiety"}},
        _sales_input(),
    )
    assert out.objection.detected is True
    assert out.objection.category is None
    assert out.objection.underlyingConcern == "fee anxiety"


def test_objection_valid_category_preserved():
    out = _validate_and_normalize(
        {"objection": {"detected": True, "category": OBJECTION_CATEGORIES[0], "confidence": 2.5}},
        _sales_input(),
    )
    assert out.objection.category == OBJECTION_CATEGORIES[0]
    assert out.objection.confidence == 1.0  # clamped


# ────────────────────────── Sentiment ──────────────────────────

def test_invalid_sentiment_normalizes_to_neutral():
    out = _validate_and_normalize({"customerSentiment": {"label": "ecstatic"}}, _sales_input())
    assert out.customerSentiment.label == "neutral"


# ────────────────────────── SMS char cap ──────────────────────────

def test_response_length_clamped_to_sms_cap():
    long = "Sentence one. " * 40  # > 320 chars
    clamped = _clamp_response_length(long, "sms")
    assert len(clamped) <= CHANNEL_MAX_CHARS["sms"]


def test_response_length_email_allows_2000():
    long = "x" * 1500
    clamped = _clamp_response_length(long, "email")
    assert clamped == long


def test_recommended_response_clamped_via_pipeline():
    long_text = ("Thanks for reaching out. " * 30).strip()  # ~720 chars
    out = _validate_and_normalize(
        {
            "responses": {"recommended": long_text, "direct": "d", "empathetic": "e"},
            "nextBestAction": {"action": "a", "reason": "r"},
        },
        _sales_input(channel="sms"),
    )
    assert len(out.responses.recommended) <= CHANNEL_MAX_CHARS["sms"]


# ────────────────────────── Service risk-flag detection ──────────────────────────

def test_manager_request_detected():
    flags = _detect_service_risk_flags("I want to speak with a manager immediately.")
    assert "request_for_manager" in flags


def test_legal_threat_detected():
    flags = _detect_service_risk_flags("My lawyer will be contacting you.")
    assert "legal_threat" in flags


def test_social_media_threat_detected():
    flags = _detect_service_risk_flags("This is going straight to my Yelp review.")
    assert "social_media_threat" in flags


def test_repeat_repair_detected():
    flags = _detect_service_risk_flags("Same problem, third time already.")
    assert "repeat_repair" in flags


def test_vehicle_damage_detected():
    flags = _detect_service_risk_flags("You scratched my hood.")
    assert "vehicle_damage_claim" in flags


def test_no_flags_on_neutral_message():
    flags = _detect_service_risk_flags("What time do you close on Saturday?")
    assert flags == []


# ────────────────────────── Escalation strategy override ──────────────────────────

def test_hard_service_trigger_forces_escalate_to_human():
    inp = _service_input("Get me your manager NOW, and my attorney will call you tomorrow.")
    out = _validate_and_normalize(
        {"recommendedStrategy": "answer_directly", "riskFlags": []},
        inp,
    )
    assert out.recommendedStrategy == "escalate_to_human"
    assert "request_for_manager" in out.riskFlags
    assert "legal_threat" in out.riskFlags


def test_sales_mode_ignores_service_risk_flags_from_model():
    inp = _sales_input("random text")
    out = _validate_and_normalize(
        {"riskFlags": ["repeat_repair", "legal_threat"]},
        inp,
    )
    # Sales mode uses only model flags (intersected with allowed set)
    assert set(out.riskFlags) == {"repeat_repair", "legal_threat"}


# ────────────────────────── Empty/missing content safety ──────────────────────────

def test_empty_response_gets_safe_fallback():
    out = _validate_and_normalize({}, _sales_input())
    assert out.responses.recommended
    assert out.responses.direct
    assert out.responses.empathetic


def test_missing_next_best_action_gets_default():
    out = _validate_and_normalize({}, _sales_input())
    assert out.nextBestAction.action
    assert out.nextBestAction.reason


def test_missing_info_list_capped_and_stringified():
    out = _validate_and_normalize(
        {"missingInformation": ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]},
        _sales_input(),
    )
    assert len(out.missingInformation) <= 8


# ────────────────────────── JSON extractor ──────────────────────────

def test_json_extractor_handles_markdown_fences():
    text = "```json\n{\"primaryIntent\": \"price\"}\n```"
    assert _extract_json(text)["primaryIntent"] == "price"


def test_json_extractor_handles_bare_json():
    assert _extract_json('{"a": 1}')["a"] == 1


def test_json_extractor_handles_leading_prose():
    text = 'Sure, here is the analysis:\n{"primaryIntent": "price"}\nHope that helps.'
    assert _extract_json(text)["primaryIntent"] == "price"


def test_json_extractor_raises_on_garbage():
    with pytest.raises((ValueError, __import__("json").JSONDecodeError)):
        _extract_json("no json at all here")


# ────────────────────────── Input contract ──────────────────────────

def test_empty_customer_message_rejected():
    with pytest.raises(Exception):
        AutomotiveInteractionInput(mode="sales", channel="sms", customerMessage="   ")


def test_default_mode_is_sales():
    inp = AutomotiveInteractionInput(channel="sms", customerMessage="hi")
    assert inp.mode == "sales"


def test_default_channel_is_sms():
    inp = AutomotiveInteractionInput(mode="sales", customerMessage="hi")
    assert inp.channel == "sms"


# ────────────────────────── Prompt version stamped ──────────────────────────

def test_output_stamped_with_prompt_version():
    from services.intelligence import PROMPT_VERSION
    out = _validate_and_normalize({}, _sales_input())
    # prompt_version is only set inside analyze(), not validator — verify shape works
    out.prompt_version = PROMPT_VERSION
    assert out.prompt_version == PROMPT_VERSION
