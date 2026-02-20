"""\
Tower Talk + Translate Routes (Refactored)

Goal:
- Match existing API contract from backend/server.py exactly (no regressions).
- Move /tower-talk and /translate out of the monolith.

Endpoints:
- POST /tower-talk
- POST /translate

Notes:
- Uses Emergent LLM Key (EMERGENT_LLM_KEY) via emergentintegrations.
- Keeps translation caching behavior from server.py.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime, timezone
import os
import uuid

from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter()


# ---------- Models (match server.py schema) ----------

INQUIRY_TYPE_GUIDANCE = {
    "new_lead": "This is a brand-new lead. Your goal: build instant rapport, spark excitement about the vehicle, and get them to schedule a visit. Be warm but efficient.",
    "price_question": "The customer is asking about price. Don't deflect. Be transparent about value. Help them see the full picture beyond the sticker price. Drive toward in-person so you can structure a real deal.",
    "availability": "The customer wants to know if the vehicle is available. Confirm availability confidently and use it as the hook to get them in before someone else does.",
    "trade_in": "The customer has a trade-in. Acknowledge the trade's value, let them know you'll give a fair number in person. This removes a barrier to coming in.",
    "financing": "The customer has financing questions or concerns. Reassure them you work with strong lenders across all credit situations. Make them comfortable and invite them in for a real conversation.",
    "test_drive": "The customer wants to test drive. This is a HOT lead. Confirm the vehicle is ready, lock in a time. Make it feel exclusive and effortless.",
    "follow_up": "This is a follow-up on a previous interaction. Keep it short, non-pushy. Remind them of the vehicle and check where they are. Offer a gentle nudge back in.",
    "objection": "The customer has an objection (price, timing, uncertainty). Don't argue. Empathize, then reframe with confidence. Help them see a path forward in person.",
}


class TowerTalkRequest(BaseModel):
    situation: str
    inquiryType: Optional[str] = "new_lead"
    context: Dict[str, Any]


class TowerTalkResponse(BaseModel):
    response: str


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"  # "auto", "en", "es"
    target_lang: str = "es"    # "en", "es"


class TranslateResponse(BaseModel):
    translated_text: str
    detected_lang: Optional[str] = None
    confidence: Optional[float] = None


# ---------- Runtime state ----------

# In-memory translation cache for instant repeated translations
_translation_cache: Dict[str, Dict[str, str]] = {}
_cache_max_size = 1000


def init_tower_talk_routes(_llm_key: str | None = None):
    """Optional initializer. We intentionally read env at request-time for safety."""
    return


@router.post("/tower-talk", response_model=TowerTalkResponse)
async def tower_talk(request: TowerTalkRequest):
    """Generate AI-powered personalized sales message with persuasion psychology."""
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        ctx = request.context
        customer_name = ctx.get("customerName", "the customer")
        vehicle = ctx.get("vehicle", "the vehicle")
        vehicle_price = ctx.get("vehiclePrice", "")
        trade_vin = ctx.get("tradeVin", "")
        trade_mileage = ctx.get("tradeMileage", "")
        dealership = ctx.get("dealershipName", "our dealership")
        salesperson = ctx.get("salespersonName", "Your Sales Team")
        first_name = salesperson.split()[0] if salesperson and salesperson != "the sales rep" else "Your Team"

        # Build trade-in context line
        trade_context = ""
        if trade_vin:
            trade_context = f"- Customer's trade-in VIN: {trade_vin}"
            if trade_mileage:
                trade_context += f" ({trade_mileage} miles)"

        # Get inquiry-type-specific guidance
        inquiry_type = (request.inquiryType or "new_lead").strip()
        inquiry_guidance = INQUIRY_TYPE_GUIDANCE.get(
            inquiry_type,
            INQUIRY_TYPE_GUIDANCE["new_lead"]
        )

        system_message = f"""You are an elite automotive sales consultant — the kind dealerships call when they need their top performer to handle a critical interaction. Your communication style: TRUSTED AUTHORITY. Direct. Calm. Precise. Laser-focused on one goal: moving this from a text conversation to an in-person meeting at the dealership.

=== SITUATION CONTEXT ===
- Dealership: {dealership}
- Your name: {salesperson}
- Customer: {customer_name}
- Vehicle of interest: {vehicle}{f' (asking {vehicle_price})' if vehicle_price else ''}
{trade_context}

=== INQUIRY TYPE: {inquiry_type.upper().replace('_', ' ')} ===
{inquiry_guidance}

=== PERSUASION FRAMEWORK ===
Apply these principles naturally — never mechanically:
- LOSS AVERSION: What they risk by waiting (inventory moves, rates change)
- SCARCITY: Real, honest availability — no fake urgency
- RECIPROCITY: Give genuine value before asking for anything
- FUTURE PACING: Help them feel what ownership looks like
- AUTHORITY: Your expertise reduces their risk. Use it.

=== THE CLOSE ===
Every message ends with a frictionless invitation. Make it feel like the obvious next step.
Examples: "When can you swing by?" / "I'll have it pulled up front for you." / "I'm here til 7 — what works?"

=== ABSOLUTE FORMAT RULES — VIOLATION OF ANY RULE INVALIDATES THE RESPONSE ===
RULE 1 — LENGTH: EXACTLY 2 to 3 sentences. Not 4. Not 5. 2 or 3 only.
RULE 2 — EMOJIS: ZERO EMOJIS. Not one. Not a subtle one. None. Zero. 🚫 = FAILURE.
RULE 3 — BRACKETS/PLACEHOLDERS: Zero brackets, zero parenthetical notes, zero [NAME] tokens.
RULE 4 — TONE: Sound like a trusted friend who happens to know cars, NOT a salesperson.
RULE 5 — SIGN-OFF: End with only your first name — "{salesperson.split()[0] if salesperson else 'Jake'}"
RULE 6 — FORMAT: One ready-to-copy text message. Plain text. No lists, no headers, no asterisks.
RULE 7 — SELF-AUDIT: Before outputting, ask: "Does this contain an emoji?" If yes, rewrite completely."""

        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"tower-talk-{uuid.uuid4()}",
                system_message=system_message,
            )
            .with_model("openai", "gpt-4o")
        )

        user_message = UserMessage(
            text=f"Inquiry type: {inquiry_type.upper().replace('_', ' ')}\nSituation: {request.situation.strip()}\n\nWrite the message now. Remember: 2-3 sentences MAXIMUM. NO emojis whatsoever."
        )

        response = await chat.send_message(user_message)
        return TowerTalkResponse(response=response.strip())

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}") from e


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """Fast translation endpoint using GPT-4o-mini with in-memory caching."""
    global _translation_cache

    try:
        text = request.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Text is required for translation")

        cache_key = f"{request.source_lang}:{request.target_lang}:{text[:200]}"
        if cache_key in _translation_cache:
            cached = _translation_cache[cache_key]
            return TranslateResponse(
                translated_text=cached["translated"],
                detected_lang=cached["detected"],
                confidence=0.99,
            )

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        lang_names = {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "ja": "Japanese",
            "ko": "Korean",
        }
        target_lang_name = lang_names.get(request.target_lang, request.target_lang)
        system_message = (
            f"You are a professional translator specializing in automotive industry communications. "
            f"Translate the following text to {target_lang_name}. "
            f"Preserve the tone, formality level, and any sales or technical automotive terminology accurately. "
            f"Output ONLY the translation — no explanations, no alternatives, no quotation marks."
        )

        start_time = datetime.now(timezone.utc)

        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"translate-{uuid.uuid4()}",
                system_message=system_message,
            )
            .with_model("openai", "gpt-4o")
        )

        translated = await chat.send_message(UserMessage(text=text))
        _ = (datetime.now(timezone.utc) - start_time).total_seconds()

        detected = request.source_lang if request.source_lang != "auto" else None
        if request.source_lang == "auto":
            if any(c in text for c in ["á", "é", "í", "ó", "ú", "ñ", "¿", "¡"]):
                detected = "es"
            elif any("\u3040" <= c <= "\u309f" or "\u30a0" <= c <= "\u30ff" for c in text):
                detected = "ja"
            elif any("\uac00" <= c <= "\ud7af" for c in text):
                detected = "ko"
            elif any(c in text for c in ["à", "â", "ç", "è", "é", "ê", "ë", "î", "ï", "ô", "ù", "û", "œ"]):
                detected = "fr"
            else:
                detected = "en"

        if len(_translation_cache) >= _cache_max_size:
            for key in list(_translation_cache.keys())[:100]:
                del _translation_cache[key]

        _translation_cache[cache_key] = {
            "translated": translated.strip(),
            "detected": detected,
        }

        return TranslateResponse(
            translated_text=translated.strip(),
            detected_lang=detected,
            confidence=0.95,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}") from e
