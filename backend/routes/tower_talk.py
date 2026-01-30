"""
Tower Talk Routes
AI-powered sales response generation and translation
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os
import time

router = APIRouter()

# LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')


class TowerTalkRequest(BaseModel):
    situation: str
    customer_name: Optional[str] = None
    customer_context: Optional[str] = None
    vehicle_of_interest: Optional[str] = None
    language: str = "en"
    input_language: str = "en"


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "en"
    target_lang: str = "es"


class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"
    speed: float = 1.0


# LLM client will be initialized from main server
llm_client = None


def init_tower_talk_routes(llm_key: str):
    """Initialize routes with LLM key"""
    global llm_client, EMERGENT_LLM_KEY
    EMERGENT_LLM_KEY = llm_key
    
    if EMERGENT_LLM_KEY:
        from emergentintegrations.llm.chat import LlmChat
        llm_client = LlmChat(api_key=EMERGENT_LLM_KEY)


@router.post("/tower-talk/generate")
async def tower_talk(request: TowerTalkRequest):
    """Generate AI-powered sales response"""
    start_time = time.time()
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    
    # Build context
    context_parts = []
    if request.customer_name:
        context_parts.append(f"Customer: {request.customer_name}")
    if request.customer_context:
        context_parts.append(f"Context: {request.customer_context}")
    if request.vehicle_of_interest:
        context_parts.append(f"Vehicle of interest: {request.vehicle_of_interest}")
    
    context = "\n".join(context_parts) if context_parts else ""
    
    # TRUSTED AUTHORITY System Prompt
    system_prompt = """You are a TRUSTED AUTHORITY sales expert for automotive dealerships.
Your approach: Direct, calm, value-focused expertise. Not pushy. Not salesy.
Goal: Guide customers to visit the showroom for an in-person experience.

Response guidelines:
- Keep responses concise (2-4 sentences max)
- Be helpful and informative, not aggressive
- Focus on the customer's specific situation
- Always suggest an in-person visit naturally
- Sound human and genuine"""
    
    user_message = f"""Situation: {request.situation}

{context}

Generate a professional, helpful response that guides the customer toward visiting the dealership."""
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        chat = LlmChat(api_key=EMERGENT_LLM_KEY)
        response = await chat.send_message(
            model="gpt-4o-mini",
            system_prompt=system_prompt,
            messages=[UserMessage(content=user_message)],
            temperature=0.7,
            max_tokens=300
        )
        
        latency = int((time.time() - start_time) * 1000)
        
        return {
            "response": response.content,
            "latency_ms": latency,
            "language": request.language
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/translate")
async def translate_text(request: TranslateRequest):
    """Translate text between languages"""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        system_prompt = f"""You are a professional translator. Translate the following text from {request.source_lang} to {request.target_lang}.
Maintain the original tone and intent. Only output the translation, nothing else."""
        
        chat = LlmChat(api_key=EMERGENT_LLM_KEY)
        response = await chat.send_message(
            model="gpt-4o-mini",
            system_prompt=system_prompt,
            messages=[UserMessage(content=request.text)],
            temperature=0.3,
            max_tokens=1000
        )
        
        return {
            "translated_text": response.content,
            "source_lang": request.source_lang,
            "target_lang": request.target_lang
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
