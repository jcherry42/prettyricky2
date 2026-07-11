"""Apex Intelligence Framework — orchestration pipeline.

Flow: input -> system+user prompts -> LLM (via AI Gateway) -> JSON parse ->
      deterministic validation & normalization -> output.

The validator is the safety net: it corrects/clamps invalid enum values,
enforces channel character caps, strips objection.category when detected=false,
and appends riskFlags for service risks that were missed by the model.
"""
from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Dict, Tuple

from ai_gateway import gateway as ai_gateway
from services.intelligence.prompts import (
    PROMPT_VERSION,
    build_system_prompt,
    build_user_prompt,
)
from services.intelligence.schemas import (
    CHANNEL_MAX_CHARS,
    NextBestAction,
    OBJECTION_CATEGORIES,
    ObjectionAnalysis,
    RESPONSE_STRATEGIES,
    ResponseVariants,
    SALES_INTENTS,
    SALES_STAGES,
    SERVICE_ESCALATION_TRIGGERS,
    SERVICE_INTENTS,
    SERVICE_STAGES,
    SentimentAnalysis,
    AutomotiveInteractionInput,
    AutomotiveInteractionOutput,
)

logger = logging.getLogger("intelligence")

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json(text: str) -> Dict[str, Any]:
    """Strip markdown fences and parse the JSON payload deterministically."""
    if not text:
        raise ValueError("empty model response")
    stripped = text.strip()
    # Strip ```json ... ``` fences if present
    if stripped.startswith("```"):
        stripped = stripped.strip("`")
        # remove language tag on first line
        if "\n" in stripped:
            first, rest = stripped.split("\n", 1)
            if first.lower().strip() in {"json", ""}:
                stripped = rest
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        # Last-ditch: extract the widest {...} substring
        m = _JSON_RE.search(text)
        if not m:
            raise
        return json.loads(m.group(0))


def _clamp_confidence(v: Any) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, f))


def _pick_enum(value: Any, allowed: list[str], default: str) -> str:
    if isinstance(value, str) and value in allowed:
        return value
    return default


def _detect_service_risk_flags(customer_message: str) -> list[str]:
    """Deterministic fallback risk-flag detector for service mode.

    These are automatic escalation triggers — if the customer mentions any
    of them we ALWAYS flag them regardless of what the model returned.
    """
    text = customer_message.lower()
    triggers: list[str] = []

    if any(w in text for w in ["manager", "supervisor", "gm ", "general manager"]):
        triggers.append("request_for_manager")
    if any(w in text for w in ["lawyer", "attorney", "sue ", "lawsuit", "legal"]):
        triggers.append("legal_threat")
    if any(w in text for w in ["yelp", "google review", "bbb", "facebook", "twitter", "social media"]):
        triggers.append("social_media_threat")
    if any(w in text for w in ["same problem", "again", "third time", "keeps happening", "still not fixed"]):
        triggers.append("repeat_repair")
    if any(w in text for w in ["scratched", "damaged", "damage to my", "dented", "broke my"]):
        triggers.append("vehicle_damage_claim")
    if any(w in text for w in ["unsafe", "brake fail", "steering out", "smoke", "fire", "won't stop"]):
        triggers.append("safety_concern")
    return triggers


def _clamp_response_length(text: str, channel: str) -> str:
    cap = CHANNEL_MAX_CHARS.get(channel, 500)
    if len(text) <= cap:
        return text
    # trim to nearest sentence boundary under cap
    cut = text[: cap - 1]
    for sep in [". ", "! ", "? ", "\n"]:
        idx = cut.rfind(sep)
        if idx > cap * 0.6:
            return cut[: idx + 1].strip()
    return cut.rstrip() + "…"


def _validate_and_normalize(
    raw: Dict[str, Any],
    inp: AutomotiveInteractionInput,
) -> AutomotiveInteractionOutput:
    """Deterministic guardrails on the model output.

    All corrections are logged (via return object's fallback_used=True) so
    the caller / telemetry can measure model drift over time.
    """
    is_service = inp.mode == "service"
    intents = SERVICE_INTENTS if is_service else SALES_INTENTS
    stages = SERVICE_STAGES if is_service else SALES_STAGES

    primary_intent = _pick_enum(raw.get("primaryIntent"), intents, intents[-1])
    secondary_intent = raw.get("secondaryIntent")
    if secondary_intent and secondary_intent not in intents:
        secondary_intent = None
    stage = _pick_enum(raw.get("conversationStage"), stages, stages[0])
    strategy = _pick_enum(raw.get("recommendedStrategy"), RESPONSE_STRATEGIES, "answer_directly")

    # Objection normalization
    obj_raw = raw.get("objection") or {}
    obj_detected = bool(obj_raw.get("detected"))
    obj_category = obj_raw.get("category")
    if not obj_detected:
        obj_category = None
    elif obj_category not in OBJECTION_CATEGORIES:
        obj_category = None
    objection = ObjectionAnalysis(
        detected=obj_detected,
        category=obj_category,
        confidence=_clamp_confidence(obj_raw.get("confidence", 0.0)),
        underlyingConcern=obj_raw.get("underlyingConcern") if obj_detected else None,
    )

    # Sentiment normalization
    sent_raw = raw.get("customerSentiment") or {}
    sent_label = sent_raw.get("label", "neutral")
    if sent_label not in {"positive", "neutral", "uncertain", "frustrated", "angry"}:
        sent_label = "neutral"
    sentiment = SentimentAnalysis(
        label=sent_label,
        confidence=_clamp_confidence(sent_raw.get("confidence", 0.0)),
    )

    # Responses
    resp_raw = raw.get("responses") or {}
    recommended = str(resp_raw.get("recommended", "")).strip()
    direct = str(resp_raw.get("direct", recommended)).strip() or recommended
    empathetic = str(resp_raw.get("empathetic", recommended)).strip() or recommended
    if not recommended:
        # last-resort filler — will be flagged as fallback
        recommended = "Thanks for reaching out — let me confirm the details on our end and follow up shortly."
        direct = recommended
        empathetic = recommended
    recommended = _clamp_response_length(recommended, inp.channel)
    direct = _clamp_response_length(direct, inp.channel)
    empathetic = _clamp_response_length(empathetic, inp.channel)
    responses = ResponseVariants(recommended=recommended, direct=direct, empathetic=empathetic)

    # Next best action
    nba_raw = raw.get("nextBestAction") or {}
    nba_action = str(nba_raw.get("action", "")).strip() or "Send response and wait for reply."
    nba_reason = str(nba_raw.get("reason", "")).strip() or "Advance the conversation without pressure."
    nba = NextBestAction(action=nba_action, reason=nba_reason)

    # Missing info
    missing = raw.get("missingInformation") or []
    if not isinstance(missing, list):
        missing = []
    missing = [str(m).strip() for m in missing if str(m).strip()][:8]

    # Risk flags — union of model flags + deterministic detector
    risk_raw = raw.get("riskFlags") or []
    if not isinstance(risk_raw, list):
        risk_raw = []
    model_flags = [str(r).strip() for r in risk_raw if str(r).strip() in SERVICE_ESCALATION_TRIGGERS]
    if is_service:
        auto_flags = _detect_service_risk_flags(inp.customerMessage)
        risk_flags = sorted(set(model_flags) | set(auto_flags))
        # Force escalation strategy on hard triggers
        if any(f in {"legal_threat", "safety_concern", "vehicle_damage_claim", "request_for_manager"} for f in risk_flags):
            strategy = "escalate_to_human"
    else:
        risk_flags = model_flags

    return AutomotiveInteractionOutput(
        detectedLanguage=str(raw.get("detectedLanguage") or inp.customerLanguage or "en")[:8],
        translatedCustomerMeaning=(raw.get("translatedCustomerMeaning") or None),
        mode=inp.mode,
        primaryIntent=primary_intent,
        secondaryIntent=secondary_intent,
        conversationStage=stage,
        objection=objection,
        customerSentiment=sentiment,
        recommendedStrategy=strategy,
        responses=responses,
        nextBestAction=nba,
        missingInformation=missing,
        riskFlags=risk_flags,
        prompt_version=PROMPT_VERSION,
    )


def _pick_feature(mode: str, high_performance: bool) -> str:
    if high_performance:
        return "intelligence_high"
    return "intelligence_service" if mode == "service" else "intelligence_sales"


async def analyze(
    inp: AutomotiveInteractionInput,
    high_performance: bool = False,
) -> Tuple[AutomotiveInteractionOutput, Dict[str, int]]:
    """Run the full analysis pipeline.

    Returns (output, latency_map). `latency_map` breaks time down by stage
    so we can measure LLM vs validation cost separately.
    """
    latency: Dict[str, int] = {}
    fallback = False

    system_prompt = build_system_prompt(inp.mode)
    user_prompt = build_user_prompt(inp)

    feature = _pick_feature(inp.mode, high_performance)

    t0 = time.monotonic()
    try:
        raw_text = await ai_gateway.chat(
            feature=feature,
            prompt=user_prompt,
            system_message=system_prompt,
        )
    except Exception as e:
        logger.error(f"Intelligence LLM call failed ({feature}): {e}")
        raise
    latency["llm_ms"] = int((time.monotonic() - t0) * 1000)

    t1 = time.monotonic()
    try:
        raw = _extract_json(raw_text)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"Intelligence JSON parse failed — using fallback: {e}")
        raw = {}
        fallback = True
    latency["parse_ms"] = int((time.monotonic() - t1) * 1000)

    t2 = time.monotonic()
    out = _validate_and_normalize(raw, inp)
    latency["validate_ms"] = int((time.monotonic() - t2) * 1000)
    latency["total_ms"] = latency["llm_ms"] + latency["parse_ms"] + latency["validate_ms"]

    out.latency_ms = latency
    out.fallback_used = fallback
    out.prompt_version = PROMPT_VERSION
    return out, latency
