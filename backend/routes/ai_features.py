"""AI Feature Routes: Vision extraction, VIN OCR, A/B testing,
Conversation history, Analytics dashboard.
Extracted from server.py for modularity."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import os
import re as _re
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_ab_testing_service = None
_conversation_service = None
_analytics_service = None


def init_ai_features_routes(db, ab_testing_service=None):
    global _db, _ab_testing_service
    _db = db
    _ab_testing_service = ab_testing_service


# --- Request/Response Models ---

class VisionExtractionRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image")
    additional_context: Optional[str] = None

class VinOcrRequest(BaseModel):
    image_base64: str = Field(..., description="Base64 encoded image of VIN")

class ABTrackEvent(BaseModel):
    experiment_id: str
    user_id: str
    event_type: str
    metadata: Dict[str, Any] = None

class ConversationCreateRequest(BaseModel):
    session_id: str
    situation: str
    response: str
    translated_response: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    vehicle_info: Optional[str] = None
    category: Optional[str] = None
    language: str = "en"
    shortcut_used: Optional[str] = None


# --- Helper to get services ---

def _get_conv_service(request: Request = None):
    from conversation_history import ConversationHistoryService
    if request:
        svc = getattr(request.app.state, 'conversation_service', None)
        if svc:
            return svc
    return ConversationHistoryService(_db)


def _get_analytics_service(request: Request = None):
    from analytics_service import AnalyticsService
    if request:
        svc = getattr(request.app.state, 'analytics_service', None)
        if svc:
            return svc
    return AnalyticsService(_db)


# ============== VIN OCR FROM IMAGE ==============

@router.post("/vin/extract-from-image")
async def extract_vin_from_image(req: VinOcrRequest):
    """Extract VIN from photo using GPT Vision AI."""
    try:
        api_key = os.getenv('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="Vision AI not configured")

        from utils.image_processing import resize_base64_for_ocr

        b64_clean = req.image_base64
        if ',' in b64_clean:
            b64_clean = b64_clean.split(',', 1)[1]
        b64_clean = b64_clean.strip()
        if not b64_clean:
            raise HTTPException(status_code=400, detail="Empty image data")

        # Resize for optimal OCR performance
        b64_clean = resize_base64_for_ocr(b64_clean)

        from emergentintegrations.llm.chat import LlmChat, UserMessage
        from emergentintegrations.llm.openai import ImageContent

        system_prompt = (
            "You are a precision VIN reader for automotive dealerships. "
            "Your only job is to find and return VIN numbers visible in the image.\n\n"
            "VIN RULES:\n"
            "- A VIN is exactly 17 characters: uppercase letters A-Z (except I, O, Q) and digits 0-9\n"
            "- Common locations: lower-left windshield plate, door jamb sticker, dashboard stamp\n\n"
            "RESPONSE FORMAT (JSON only, no markdown):\n"
            '{"vins": ["VIN1"], "confidence": "high|medium|low", "notes": "brief"}\n\n'
            "If no VIN found: "
            '{"vins": [], "confidence": "low", "notes": "No VIN found"}\n'
            "IMPORTANT: Return ONLY the JSON object."
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"vin_ocr_{os.urandom(6).hex()}",
            system_message=system_prompt
        ).with_model("openai", "gpt-4o")

        image_content = ImageContent(image_base64=b64_clean)
        user_message = UserMessage(
            text="Find all VIN numbers in this image. Return ONLY valid 17-character VINs.",
            file_contents=[image_content]
        )

        response = await chat.send_message(user_message)
        raw = response.strip()

        import json as _json
        try:
            if raw.startswith('```'):
                raw = raw.split('```')[1]
                if raw.startswith('json'):
                    raw = raw[4:]
            parsed = _json.loads(raw)
        except Exception:
            vin_pattern = _re.compile(r'\b[A-HJ-NPR-Z0-9]{17}\b')
            found = vin_pattern.findall(raw)
            parsed = {"vins": list(set(found)), "confidence": "low", "notes": raw[:200]}

        vins = parsed.get("vins", [])
        vin_re = _re.compile(r'^[A-HJ-NPR-Z0-9]{17}$')
        valid_vins = [v.upper().strip() for v in vins if vin_re.match(v.upper().strip())]

        return {
            "success": True, "vins": valid_vins,
            "confidence": parsed.get("confidence", "low"),
            "notes": parsed.get("notes", ""), "count": len(valid_vins)
        }

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e).lower()
        if any(kw in err_msg for kw in ['unsupported', 'invalid image', 'cannot process']):
            return {"success": True, "vins": [], "confidence": "low",
                    "notes": "Image could not be processed.", "count": 0}
        logger.error(f"VIN OCR error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"VIN OCR failed: {str(e)}")


# ============== VISION EXTRACTION ==============

@router.post("/vision/extract-customer")
async def extract_customer_from_image(req: VisionExtractionRequest):
    """Extract customer data from image using GPT Vision."""
    try:
        from vision_extraction_service import get_vision_service
        vision_service = get_vision_service()

        if not vision_service.validate_image_format(req.image_base64):
            raise HTTPException(status_code=400, detail="Invalid image format.")

        result = await vision_service.extract_customer_data(
            image_base64=req.image_base64,
            additional_context=req.additional_context
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Extraction failed"))
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vision extraction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Vision extraction failed: {str(e)}")


# ============== A/B TESTING ==============

@router.get("/ab/experiments")
async def list_experiments(active_only: bool = False):
    return {"experiments": await _ab_testing_service.list_experiments(active_only)}

@router.get("/ab/experiments/{experiment_id}")
async def get_experiment_results(experiment_id: str):
    return await _ab_testing_service.get_experiment_results(experiment_id)

@router.get("/ab/variant/{experiment_id}")
async def get_user_variant(experiment_id: str, user_id: str):
    variant = await _ab_testing_service.get_variant(user_id, experiment_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Experiment not found or inactive")
    return variant

@router.post("/ab/track")
async def track_ab_event(event: ABTrackEvent):
    return await _ab_testing_service.track_event(
        experiment_id=event.experiment_id, user_id=event.user_id,
        event_type=event.event_type, metadata=event.metadata
    )

@router.post("/ab/experiments/{experiment_id}/toggle")
async def toggle_experiment(experiment_id: str, is_active: bool = True):
    return await _ab_testing_service.toggle_experiment(experiment_id, is_active)


# ============== CONVERSATION HISTORY ==============

@router.get("/conversations/categories")
async def get_conversation_categories():
    from conversation_history import ConversationHistoryService
    return {"categories": ConversationHistoryService.get_categories()}

@router.post("/conversations")
async def create_conversation(request: ConversationCreateRequest, req: Request = None):
    from conversation_history import ConversationCreate
    service = _get_conv_service(req)
    data = ConversationCreate(**request.model_dump())
    result = await service.create_conversation(data)
    return {"success": True, "conversation": result.model_dump()}

@router.get("/conversations")
async def get_conversations(
    request: Request, session_id: Optional[str] = None,
    customer_id: Optional[str] = None, category: Optional[str] = None,
    limit: int = 50, offset: int = 0
):
    service = _get_conv_service(request)
    conversations = await service.get_conversations(
        session_id=session_id, customer_id=customer_id,
        category=category, limit=limit, offset=offset
    )
    return {"conversations": conversations, "count": len(conversations)}

@router.get("/conversations/stats")
async def get_conversation_stats(request: Request):
    return await _get_conv_service(request).get_stats()

@router.get("/conversations/session/{session_id}")
async def get_session_history(session_id: str, request: Request):
    conversations = await _get_conv_service(request).get_session_history(session_id)
    return {"session_id": session_id, "conversations": conversations}

@router.get("/conversations/customer/{customer_id}")
async def get_customer_conversation_history(customer_id: str, request: Request):
    conversations = await _get_conv_service(request).get_customer_history(customer_id)
    return {"customer_id": customer_id, "conversations": conversations}

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, request: Request):
    success = await _get_conv_service(request).delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}

@router.delete("/conversations/session/{session_id}")
async def delete_session_conversations(session_id: str, request: Request):
    deleted_count = await _get_conv_service(request).delete_session(session_id)
    return {"success": True, "deleted_count": deleted_count}


# ============== ANALYTICS DASHBOARD ==============

@router.get("/analytics/dashboard")
async def get_analytics_dashboard(request: Request):
    return await _get_analytics_service(request).get_dashboard_summary()

@router.get("/analytics/sales")
async def get_sales_analytics(request: Request, days: int = 30):
    return await _get_analytics_service(request).get_sales_performance(days)

@router.get("/analytics/customers")
async def get_customer_analytics(request: Request):
    return await _get_analytics_service(request).get_customer_engagement()

@router.get("/analytics/inventory")
async def get_inventory_analytics(request: Request):
    return await _get_analytics_service(request).get_inventory_metrics()

@router.get("/analytics/conversations")
async def get_conversation_analytics(request: Request):
    return await _get_analytics_service(request).get_conversation_insights()

@router.get("/analytics/integrations")
async def get_integration_analytics(request: Request):
    return await _get_analytics_service(request).get_integration_health()

@router.get("/analytics/trends/{metric}")
async def get_metric_trends(metric: str, request: Request, days: int = 30):
    return await _get_analytics_service(request).get_trends(metric, days)
