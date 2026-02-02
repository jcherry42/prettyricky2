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

class TowerTalkRequest(BaseModel):
    situation: str
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
        trade_in = ctx.get("tradeIn")
        dealership = ctx.get("dealershipName", "our dealership")
        salesperson = ctx.get("salespersonName", "the sales rep")

        system_message = f"""You are an elite automotive sales consultant. Your approach: TRUSTED AUTHORITY - direct, calm, controlled, and laser-focused on moving the interaction from digital conversation to in-person meeting.

Your personality: Confident expert who cuts through noise. You provide value, build trust through competence, and always drive toward the showroom visit.

Context:
- You work at {dealership}
- Your name is {salesperson}
- Customer: {customer_name}
- Vehicle of interest: {vehicle} {f'at {vehicle_price}' if vehicle_price else ''}
{f'- Customer has trade-in: {trade_in}' if trade_in else ''}

=== YOUR APPROACH: TRUSTED AUTHORITY ===

**CORE MINDSET:**
- You are the expert. Speak with quiet confidence.
- Every message should move them ONE step closer to coming in
- Be helpful, not pushy. Authority doesn't need to sell hard.
- Less is more. Precision over wordiness.

**PSYCHOLOGY TO APPLY (subtly):**
- LOSS AVERSION: What they might miss by not acting
- SCARCITY: Real availability concerns, not fake urgency
- SOCIAL PROOF: Reference satisfied customers naturally
- RECIPROCITY: Give value first (info, insights, honest answers)
- FUTURE PACING: Help them picture ownership

**THE CLOSE - ALWAYS DRIVE IN-PERSON:**
- Every response should end with a soft invitation to come in
- Make it easy: \"When works for you?\" / \"I'm here until 7\" / \"Can I pull it up front for you?\"
- Remove friction, don't add it

=== MESSAGE RULES ===
1. ONE message, ready to send via text/iMessage
2. 2-4 sentences MAX. Every word earns its place.
3. Sound like a knowledgeable friend, not a salesperson
4. NO emojis, NO brackets, NO placeholders
5. Sign off with just the first name
6. If it sounds \"salesy\" - rewrite it
7. Always aim for the in-person meeting"""

        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"tower-talk-{uuid.uuid4()}",
                system_message=system_message,
            )
            .with_model("openai", "gpt-4o-mini")
        )

        user_message = UserMessage(
            text=f"Situation: {request.situation}\n\nWrite a personalized message for this situation."
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
            return TranslateResponse(translated_text="", detected_lang=None, confidence=0.0)

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
        system_message = f"Translate to {target_lang_name}. Output ONLY the translation, nothing else."

        start_time = datetime.now(timezone.utc)

        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"translate-{uuid.uuid4()}",
                system_message=system_message,
            )
            .with_model("openai", "gpt-4o-mini")
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
