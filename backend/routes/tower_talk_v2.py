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
from pydantic import BaseModel, Field
from typing import Any, Dict, Literal, Optional
from fastapi import Request as FastAPIRequest

from security.llm_rate_limit import enforce as enforce_llm_rate
from datetime import datetime, timezone

from services.ai_gateway import gateway as ai_gateway

router = APIRouter()

import logging as _logging
_logger = _logging.getLogger("tower_talk_v2")


import re as _re

def _strip_emoji(text: str) -> str:
    """Remove all emoji / Unicode pictograph characters from a string.
    GPT-4o occasionally adds emojis to responses despite explicit instructions;
    this acts as a deterministic safety net before returning to the client.
    """
    # Broad pattern: emoji ranges + variation selectors + skin-tone modifiers
    emoji_pattern = _re.compile(
        "["
        "\U0001F600-\U0001F64F"  # Emoticons
        "\U0001F300-\U0001F5FF"  # Misc symbols & pictographs
        "\U0001F680-\U0001F6FF"  # Transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # Flags (regional indicator letters)
        "\U00002702-\U000027B0"  # Dingbats
        "\U000024C2-\U0001F251"  # Enclosed chars & misc
        "\U0001F900-\U0001F9FF"  # Supplemental symbols & pictographs
        "\U00002600-\U000026FF"  # Misc symbols
        "\U0000FE0F"             # Variation selector-16 (emoji presentation)
        "\U0001FA00-\U0001FA6F"  # Chess, medical etc.
        "\U0001FA70-\U0001FAFF"  # Extended pictographic
        "]+",
        flags=_re.UNICODE,
    )
    return emoji_pattern.sub("", text).strip()




# ---------- Models (match server.py schema) ----------

INQUIRY_TYPE_GUIDANCE = {
    "new_lead": "FRESH LEAD — STRIKE WHILE HOT. Your ONLY mission: convert this text thread into a confirmed appointment. Build instant rapport by naming the vehicle and showing you've done your homework. Create a mental picture of them behind the wheel. Close with an assumptive time offer — 'I've got a 2:00 and a 4:30 open — which works better?' Never ask 'would you like to come in.'",
    "price_question": "PRICE INQUIRY — REFRAME TO VALUE. Never lead with the number alone. Acknowledge the question, then pivot: 'Price is one part of the equation — let me show you the full picture.' Drive toward in-person where you can structure the deal. Say: 'When we sit down, I'll walk you through every line so there are zero surprises. I've got time at 3 today — can you make it?'",
    "availability": "AVAILABILITY CHECK — CREATE URGENCY. Confirm the vehicle is HERE and READY. Use real scarcity: 'It's on the lot right now. I've had two other inquiries on this exact one in the last 48 hours. If you're serious, let's lock in a time before someone else does.' Make the appointment feel like they're securing something exclusive.",
    "trade_in": "TRADE-IN INQUIRY — REMOVE THE BARRIER. The trade is their key to action. Say: 'Bring it in and I'll give you a fair, transparent number in under 10 minutes — no games. Once you know your trade value, the rest falls into place.' Frame the appraisal as fast, easy, and empowering. This is your appointment hook.",
    "financing": "FINANCING CONCERN — ELIMINATE FEAR. Customers with financing questions are READY to buy but scared. Your job: remove the fear. 'I work with 30+ lenders across every credit situation. Let me run a quick soft pull — zero impact on your score — and I'll tell you exactly where you stand. When can you come in so we can map out a payment that works?'",
    "test_drive": "TEST DRIVE REQUEST — HOTTEST LEAD IN THE BUILDING. This customer is 80% sold. DO NOT let them cool off. 'I'll have the vehicle detailed, pulled up front, and ready when you arrive. Give me a time and it's yours for a proper drive — not a parking lot loop.' Lock the appointment NOW. Every hour of delay reduces close rate by 15%.",
    "follow_up": "FOLLOW-UP — ALWAYS BRING NEW VALUE. Never say 'just checking in' — that's amateur hour. Every follow-up must contain new intel: a price change, a new incentive, a competing buyer, a market shift. Make them feel they'd be losing something by not responding. Adapt your urgency based on timing — tomorrow follow-ups are warm, weekly are strategic, monthly are re-engagement.",
    "objection": "OBJECTION — ISOLATE AND DISSOLVE. Don't argue. Don't defend. ISOLATE: 'I hear you. Let me ask — if we could solve that one thing, would you be ready to move forward today?' Once isolated, address the REAL concern with data, not emotion. Then close: 'Let's sit down and I'll show you exactly how we handle this. I've got time at 4 — does that work?'",
    "appointment_setting": "APPOINTMENT — YOUR #1 KPI. Everything you do leads here. Use the Assumptive Close: give TWO specific times, both today or tomorrow. 'I've got a 2:00 and a 4:30 — which one grabs you?' Never ask open-ended questions. Make the visit feel exclusive: 'I'll have the vehicle staged just for you.' Reduce friction: 'Give me 20 minutes — if it's not the one, you'll know fast.'",
}

# ---------- SERVICE ADVISOR MODE ----------
# Same idea as INQUIRY_TYPE_GUIDANCE, but tailored for a service advisor handling
# repair orders, waiters, comebacks, warranty claims, and estimate presentations.
SERVICE_INQUIRY_GUIDANCE = {
    "waiter_status": "WAITER STATUS UPDATE — REDUCE ANXIETY. Waiting customers want three things: honesty, an ETA, and a small comfort. Give a specific milestone ('tech is finishing the multi-point right now'), a specific time range ('back in the bay in 15 minutes'), and a small comfort ('coffee, water, WiFi'). Never say 'a little while longer.'",
    "estimate_upsell": "ESTIMATE PRESENTATION — BE THE TRUSTED ADVISOR, NOT THE UPSELLER. Present findings in tiers: SAFETY-CRITICAL (must do today), WEAR ITEMS (due soon), MAINTENANCE (schedule). Show photos or invite them to see the vehicle. Bundle related work to save labor. Never surprise them at the register.",
    "comeback": "COMEBACK — OWN IT INSTANTLY. This customer trusted you and left disappointed. First words: 'I hear you and I own this.' Then: bring them back in with priority scheduling, free re-diagnosis, and a loaner if warranted. Master tech looks at it personally. Do NOT be defensive. Do NOT dispute their story. Fix it and rebuild trust.",
    "warranty_claim": "WARRANTY VERIFICATION — SHOW THE WIN. Confirm coverage with specifics (VIN pulled, months/miles remaining). If covered, say 'zero cost to you' plainly. Set the appointment. Mention the manufacturer TSB if one applies — that reassures the customer this is a known issue with a known fix, not a diagnosis-in-progress.",
    "parts_hold": "PARTS ORDER STATUS — FIRM DATE + CONTINGENCY PLAN. Give a real ETA ('here by 10 AM tomorrow'). Confirm safety of driving in the meantime. Reserve a same-day appointment for when the part arrives. If the OEM is backordered, offer a factory-warrantied alternative — the customer's decision, transparently.",
    "tech_consult": "TECH CONSULT — HAND OFF TO THE EXPERT. When the diagnosis matters, don't relay. Bring the master tech to the guest, or step away to consult and return with a concrete answer. Never guess. If a diagnostic is needed, explain that the diag fee gets applied to the repair — that reframes the cost as an investment.",
    "loaner_request": "LOANER REQUEST — SOLVE THE MOBILITY PROBLEM. Warranty loaners are a right, courtesy loaners are an offer. Present clearly: cost (usually free), timing (5-minute paperwork), and alternatives (shuttle, Uber credits). The goal is to eliminate the mobility objection so the customer approves the repair.",
    "declined_service": "DECLINED SERVICE — RESPECT THE CALL, DOCUMENT IT. When the guest declines, don't pressure. Note the decline on the RO. Explain what to watch for (specific symptoms). Offer to re-inspect at no charge next visit. This builds trust for the LONG game — declined today, approved next time.",
    "pickup_ready": "READY FOR PICKUP — RECAP + INVITE NEXT VISIT. Total came in AT or UNDER estimate (great). Explain what was done in plain English. Show them the old parts. Explain the warranty on this repair. Then invite them back for the recommended-but-deferred items with a soft appointment mention.",
    "schedule_appointment": "SCHEDULE APPOINTMENT — TWO REAL TIME SLOTS. Never say 'when works for you.' Say 'Tuesday 8 AM or Thursday 10:30.' Pre-order parts based on symptoms. Confirm quarter-tank of fuel for a road test. Offer shuttle if it's an all-day. Make it feel effortless.",
}


class TowerTalkRequest(BaseModel):
    situation: str
    inquiryType: Optional[str] = "new_lead"
    context: Dict[str, Any]
    mode: Optional[str] = "sales"  # "sales" | "service" — routes to sales-close vs service-advisor prompt
    performanceMode: Optional[bool] = False  # when true, locks to gpt-4o via tower_talk_high feature


class TowerTalkResponse(BaseModel):
    response: str


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    source_lang: str = Field(default="auto", max_length=8)  # "auto", "en", "es", "fr", "ko"
    target_lang: Literal["en", "es", "fr", "ko"] = "es"     # Strict whitelist — 422 on anything else
    performanceMode: Optional[bool] = False


class TranslateResponse(BaseModel):
    translated_text: str
    detected_lang: Optional[str] = None
    confidence: Optional[float] = None


# ---------- Runtime state ----------

# In-memory translation cache for instant repeated translations
_translation_cache: Dict[str, Dict[str, str]] = {}
_cache_max_size = 1000


def init_tower_talk_routes(_llm_key: str | None = None, vector_search=None, telemetry=None):
    """Optional initializer. Stores app-level services for route access."""
    if vector_search is not None:
        router._app_state_vector_search = vector_search
    if telemetry is not None:
        router._app_state_telemetry = telemetry
    return


@router.post("/tower-talk", response_model=TowerTalkResponse)
async def tower_talk(request: TowerTalkRequest, http_request: FastAPIRequest):
    await enforce_llm_rate(http_request, "tower_talk")
    """Generate AI-powered personalized sales message with persuasion psychology.
    Enriched with vector search context from sales knowledge base."""
    try:
        ctx = request.context
        customer_name = ctx.get("customerName", "the customer")
        vehicle = ctx.get("vehicle", "the vehicle")
        vehicle_price = ctx.get("vehiclePrice", "")
        trade_vin = ctx.get("tradeVin", "")
        trade_mileage = ctx.get("tradeMileage", "")
        dealership = ctx.get("dealershipName", "our dealership")
        salesperson = ctx.get("salespersonName", "")
        first_name = salesperson.strip().split()[0] if salesperson and salesperson.strip() else ""
        signoff_rule = f'RULE 5 — SIGN-OFF: End with a new line containing only your first name: "{first_name}"' if first_name else "RULE 5 — SIGN-OFF: No sign-off needed. End with the closing question only."

        # Build trade-in context line
        trade_context = ""
        if trade_vin:
            trade_context = f"- Customer's trade-in VIN: {trade_vin}"
            if trade_mileage:
                trade_context += f" ({trade_mileage} miles)"

        # Get inquiry-type-specific guidance — routes to sales OR service prompt based on `mode`
        inquiry_type = (request.inquiryType or "new_lead").strip()
        is_service_mode = (request.mode or "sales").lower() == "service"
        guidance_dict = SERVICE_INQUIRY_GUIDANCE if is_service_mode else INQUIRY_TYPE_GUIDANCE
        fallback_key = "waiter_status" if is_service_mode else "new_lead"
        inquiry_guidance = guidance_dict.get(inquiry_type, guidance_dict[fallback_key])

        # === VECTOR SEARCH CONTEXT ENRICHMENT ===
        knowledge_context = ""
        similar_responses_context = ""
        try:
            # Access vector search from app state via module-level ref
            # Try to get vector search service
            if hasattr(router, '_app_state_vector_search'):
                vs = router._app_state_vector_search
            else:
                vs = None

            if vs:
                # Search knowledge base for relevant sales techniques
                kb_results = await vs.search_knowledge(
                    query=f"{inquiry_type} {request.situation}",
                    category=None,
                    top_k=2,
                    min_score=0.70,
                )
                if kb_results:
                    tips = "\n".join(f"- {r['text'][:200]}" for r in kb_results)
                    knowledge_context = f"\n\n=== SALES PLAYBOOK CONTEXT (use as inspiration, don't copy verbatim) ===\n{tips}"

                # Find similar past winning responses
                similar = await vs.find_similar_responses(
                    situation=request.situation,
                    inquiry_type=inquiry_type,
                    top_k=1,
                    min_score=0.78,
                )
                if similar:
                    resp = similar[0]
                    similar_responses_context = f"\n\n=== PAST WINNING RESPONSE (similar situation, use as calibration) ===\n\"{resp['response'][:200]}\""
        except Exception as e:
            _logger.debug(f"Vector search enrichment skipped: {e}")

        if is_service_mode:
            system_message = f"""You are the top-performing SERVICE ADVISOR at a busy dealership — the person guests ask for by name because you treat them like family, give straight answers, and never surprise them with a bill. You speak with technical accuracy but plain-English clarity. Your job: turn confused, worried, or frustrated guests into loyal repeat customers.

=== YOUR IDENTITY ===
- Dealership Service Dept: {dealership}
- Your name: {salesperson}
- Guest: {customer_name}
- RO Vehicle: {vehicle}{f' (estimate {vehicle_price})' if vehicle_price else ''}
{trade_context}

=== SITUATION: {inquiry_type.upper().replace('_', ' ')} ===
{inquiry_guidance}

=== SERVICE ADVISOR METHODOLOGY ===
You operate on four principles:
1. HONESTY OVER UPSELL: Never invent findings. Tiered recommendations, always.
2. EDUCATE, DON'T PRESSURE: Show photos, explain "why this matters." Let the guest decide.
3. OWN COMEBACKS: The moment a guest is upset, apologize first, fix it second, ask questions third.
4. WARRANTY-FIRST: Always check coverage before quoting. "Zero cost to you" is the strongest phrase in the service lane.

Language rules:
- Use "guest" not "customer" (dealership brand standard).
- Use "RO" (Repair Order) not "ticket" or "job."
- Use "tech" not "mechanic."
- Use "master tech" or "shop foreman" when escalating.
- Prefer "recommend" over "need" — respect the guest's authority to decide.

=== THE CLOSE — NON-NEGOTIABLE ===
EVERY message must end with a specific, low-friction next step.
Not "let us know" — that's passive.
Use: "Coffee or WiFi while you wait?" / "I'll call the moment the part lands." / "Want me to hold the loaner?" / "Should I book Tuesday 8 AM or Thursday 10:30?"

=== ABSOLUTE FORMAT RULES — VIOLATION INVALIDATES THE RESPONSE ===
RULE 1 — LENGTH: EXACTLY 2 to 3 sentences maximum. Direct. No fluff.
RULE 2 — EMOJIS: ZERO. None. Not one. This is professional communication.
RULE 3 — BRACKETS/PLACEHOLDERS: Zero brackets, zero [NAME] tokens, zero parenthetical notes.
RULE 4 — TONE: Calm, confident, technically credible — like a trusted family mechanic who happens to work at the dealer. Never patronizing, never dismissive.
{signoff_rule}
RULE 6 — FORMAT: One ready-to-copy text message. Plain text only. No lists, headers, bullets, or asterisks.
RULE 7 — SELF-AUDIT: Before output, verify: (a) No emojis? (b) Ends with a specific low-friction next step? (c) 2-3 sentences max? If any fail, rewrite.{knowledge_context}{similar_responses_context}"""
        else:
            system_message = f"""You are the #1 closer at a high-volume dealership — the person every GM calls when a deal is about to walk. You don't just sell cars, you set appointments, crush objections, and close deals at a level most salespeople will never reach. Your communication style: TRUSTED AUTHORITY who speaks like a sharp friend, not a stereotypical car salesman.

=== YOUR IDENTITY ===
- Dealership: {dealership}
- Your name: {salesperson}
- Customer: {customer_name}
- Vehicle: {vehicle}{f' (asking {vehicle_price})' if vehicle_price else ''}
{trade_context}

=== MISSION: {inquiry_type.upper().replace('_', ' ')} ===
{inquiry_guidance}

=== ELITE SALES METHODOLOGY ===
You operate on three principles that separate closers from order-takers:
1. ISOLATE THE REAL OBJECTION: Behind every "I need to think" is a real concern. Find it. Solve it.
2. ASSUMPTIVE CLOSE: Stop asking IF they want to come in. Ask WHEN. Give two specific times.
3. VALUE OVER PRICE: Break big numbers into daily cost. Compare to what they already spend. Frame ownership as investment.

Advanced techniques (deploy naturally, never robotically):
- LOSS AVERSION: "I have someone else looking at this one tomorrow."
- FUTURE PACING: "Picture yourself driving this to work Monday morning."
- TAKEAWAY: "This might not be the right timing for you — and that's okay."
- RECIPROCITY: Give real insight or data before asking for anything.

=== THE CLOSE — NON-NEGOTIABLE ===
EVERY message must end with a specific, frictionless invitation to an in-person meeting.
Not "let me know" — that's passive and weak.
Use: "I've got a 2 and a 4:30 — which one works?" / "I'll have it pulled up when you get here." / "I'm here til 7, come by after work."

=== ABSOLUTE FORMAT RULES — VIOLATION INVALIDATES THE RESPONSE ===
RULE 1 — LENGTH: EXACTLY 2 to 3 sentences maximum. Punchy. No fluff. Every word earns its place.
RULE 2 — EMOJIS: ZERO. None. Not one. This is professional communication.
RULE 3 — BRACKETS/PLACEHOLDERS: Zero brackets, zero [NAME] tokens, zero parenthetical notes.
RULE 4 — TONE: Confident, direct, warm — like a sharp friend who happens to be a master closer. Never sleazy, never desperate, never generic.
{signoff_rule}
RULE 6 — FORMAT: One ready-to-copy text message. Plain text only. No lists, headers, bullets, or asterisks.
RULE 7 — SELF-AUDIT: Before output, verify: (a) No emojis? (b) Ends with specific appointment invitation? (c) 2-3 sentences max? If any fail, rewrite.{knowledge_context}{similar_responses_context}"""

        user_prompt = f"Inquiry type: {inquiry_type.upper().replace('_', ' ')}\nSituation: {request.situation.strip()}\n\nWrite the message now. Remember: 2-3 sentences MAXIMUM. NO emojis whatsoever."

        import time as _time
        _t0 = _time.monotonic()
        response = await ai_gateway.chat(
            feature='tower_talk_high' if bool(request.performanceMode) else 'tower_talk',
            prompt=user_prompt,
            system_message=system_message,
        )
        _latency = (_time.monotonic() - _t0) * 1000

        # Deterministic emoji strip — GPT-4o occasionally adds emojis despite instructions.
        # We own the pipeline, so we enforce the rule here unconditionally.
        clean = _strip_emoji(response.strip())

        # Store winning response in vector DB for future context (fire-and-forget)
        try:
            if vs:
                import asyncio as _aio
                _aio.create_task(vs.store_response(
                    situation=request.situation,
                    response=clean,
                    inquiry_type=inquiry_type,
                ))
        except Exception:
            pass

        # Telemetry tracking (fire-and-forget)
        try:
            if hasattr(router, '_app_state_telemetry') and router._app_state_telemetry:
                import asyncio as _aio
                _aio.create_task(router._app_state_telemetry.track(
                    'ai_usage', 'tower_talk_generate',
                    {'inquiry_type': inquiry_type, 'latency_ms': round(_latency, 1),
                     'customer': customer_name, 'vehicle': vehicle,
                     'knowledge_enriched': bool(knowledge_context)},
                ))
        except Exception:
            pass

        # Zero-lag toggle: pre-warm the translation cache for the most common
        # target languages so the "Show translation" button responds instantly.
        # Fire-and-forget — never blocks the primary reply. Cache is 24h so even
        # if the user doesn't toggle immediately, the warm-up isn't wasted.
        try:
            import asyncio as _aio_pw
            # Supported customer languages for this app: EN, ES, FR, KO.
            # Pre-warm all three non-English targets so every toggle is sub-200ms.
            _prewarm_targets = ('es', 'fr', 'ko')
            _prewarm_source = 'en'
            for _tgt in _prewarm_targets:
                _lang_names = {'en': 'English', 'es': 'Spanish', 'fr': 'French', 'ko': 'Korean'}
                _prewarm_system = (
                    f"You are a professional translator specializing in automotive industry communications. "
                    f"Translate the following text to {_lang_names.get(_tgt, _tgt)}. "
                    f"Preserve the tone, formality level, and any sales or technical automotive terminology accurately. "
                    f"Output ONLY the translation — no explanations, no alternatives, no quotation marks."
                )
                # We deliberately DO NOT await — the cache warms in the background.
                _aio_pw.create_task(ai_gateway.chat(
                    feature='translate_high' if bool(request.performanceMode) else 'translate',
                    prompt=clean,
                    system_message=_prewarm_system,
                    cache_ttl=86400,
                ))
                _ = _prewarm_source  # placeholder to make lint happy on unused var
        except Exception:
            pass  # pre-warming is best-effort; never break the response

        return TowerTalkResponse(response=clean)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}") from e


@router.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest, http_request: FastAPIRequest):
    await enforce_llm_rate(http_request, "translate")
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

        lang_names = {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
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

        translated = await ai_gateway.chat(
            feature='translate_high' if bool(request.performanceMode) else 'translate',
            prompt=text,
            system_message=system_message,
            cache_ttl=86400,
        )
        _ = (datetime.now(timezone.utc) - start_time).total_seconds()

        detected = request.source_lang if request.source_lang != "auto" else None
        if request.source_lang == "auto":
            if any(c in text for c in ["á", "é", "í", "ó", "ú", "ñ", "¿", "¡"]):
                detected = "es"
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
