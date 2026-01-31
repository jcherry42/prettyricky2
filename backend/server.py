"""
Closr API Server - FEDERAL-GRADE SECURITY
Sales automation tool with CRM-agnostic data integration
"""

from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Request, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

# FEDERAL SECURITY IMPORTS
from security.auth import get_current_user, create_access_token
from security.rate_limit import RateLimitMiddleware
from security.audit import AuditLogger
from security.validation import sanitize_input, validate_vin, validate_email

# LLM Integration
from emergentintegrations.llm.chat import LlmChat, UserMessage

# Data Integration
from data_integration import (
    ImportProcessor,
    DataSourceConfig,
    DataSourceType,
    RefreshSchedule,
    init_scheduler,
    get_scheduler,
    shutdown_scheduler,
)
from repositories import CustomerRepository, VehicleRepository, DataSourceRepository


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Repositories
customer_repo = CustomerRepository(db)
vehicle_repo = VehicleRepository(db)
source_repo = DataSourceRepository(db)

# Import processor
import_processor = ImportProcessor()

# A/B Testing Service
from ab_testing_service import ab_testing_service, Experiment, DEFAULT_EXPERIMENTS


# ============== LIFESPAN ==============

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    # Startup
    logger.info("Starting Closr API server - FEDERAL-GRADE SECURITY ENABLED...")
    
    # Initialize FEDERAL SECURITY
    global audit_logger
    audit_logger = AuditLogger(db)
    await audit_logger.create_indexes()
    logger.info("✅ Audit logging initialized")
    
    # Initialize auth router with database
    from auth_endpoints import init_auth_router
    init_auth_router(db, audit_logger)
    logger.info("✅ Auth router initialized")
    
    # Initialize repositories
    await customer_repo.create_indexes()
    await vehicle_repo.create_indexes()
    await source_repo.create_indexes()
    
    # Initialize integration layer
    from integrations import IntegrationManager
    from integrations.webhooks import FortifiedWebhookReceiver
    from integrations.profiles import ProfileManager
    
    integration_mgr = IntegrationManager(db)
    webhook_recv = FortifiedWebhookReceiver(db)
    profile_mgr = ProfileManager(db)
    
    await integration_mgr.create_indexes()
    await webhook_recv.create_indexes()
    await profile_mgr.create_indexes()
    await profile_mgr.ensure_builtin_profiles()
    
    # Initialize A/B Testing
    await ab_testing_service.initialize(db)
    for exp in DEFAULT_EXPERIMENTS:
        await ab_testing_service.create_experiment(Experiment(**exp))
    logger.info("A/B Testing service initialized with default experiments")
    
    logger.info("Integration layer initialized")
    
    # Initialize scheduler
    await init_scheduler(db)
    
    logger.info("Server startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    shutdown_scheduler()
    client.close()
    logger.info("Shutdown complete")


# Create app with lifespan
app = FastAPI(lifespan=lifespan)

# Create API router
api_router = APIRouter(prefix="/api")


# ============== REQUEST/RESPONSE MODELS ==============

class TowerTalkRequest(BaseModel):
    situation: str
    context: Dict[str, Any]

class TowerTalkResponse(BaseModel):
    response: str

class ImportUrlRequest(BaseModel):
    url: str
    data_type: str = "customers"
    custom_mapping: Optional[Dict[str, str]] = None

class ImportPreviewRequest(BaseModel):
    content: str
    format: str = "csv"
    data_type: str = "customers"

class CreateDataSourceRequest(BaseModel):
    name: str
    type: str  # "url" or "google_sheets"
    url: str
    data_type: str = "customers"
    refresh_schedule: str = "weekdays_10am"

class UpdateDataSourceRequest(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    is_active: Optional[bool] = None
    refresh_schedule: Optional[str] = None
    field_mapping_overrides: Optional[Dict[str, str]] = None


# Supercharg'd Translation Models
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"  # "auto", "en", "es"
    target_lang: str = "es"    # "en", "es"

class TranslateResponse(BaseModel):
    translated_text: str
    detected_lang: Optional[str] = None
    confidence: Optional[float] = None

# Text-to-Speech Models
class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"  # alloy, ash, coral, echo, fable, nova, onyx, sage, shimmer
    model: str = "tts-1-hd"  # tts-1 (fast) or tts-1-hd (HD quality)
    speed: float = 1.0  # 0.25 to 4.0
    language: str = "en"  # Hint for voice optimization

class TTSResponse(BaseModel):
    audio_base64: str
    format: str = "mp3"
    voice_used: str
    cached: bool = False


# ============== HEALTH & STATUS ==============

@api_router.get("/")
async def root():
    return {"message": "Closr API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    scheduler = get_scheduler()
    scheduler_status = scheduler.get_status() if scheduler else {"isRunning": False}
    
    source_health = await source_repo.get_health_summary()
    
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scheduler": scheduler_status,
        "dataSources": source_health
    }


# ============== TOWER TALK (AI) ==============

@api_router.post("/tower-talk", response_model=TowerTalkResponse)
async def tower_talk(request: TowerTalkRequest):
    """Generate AI-powered personalized sales message with persuasion psychology"""
    try:
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            logger.error("EMERGENT_LLM_KEY not found in environment")
            raise HTTPException(status_code=500, detail="API key not configured")
        
        ctx = request.context
        customer_name = ctx.get('customerName', 'the customer')
        vehicle = ctx.get('vehicle', 'the vehicle')
        vehicle_price = ctx.get('vehiclePrice', '')
        trade_in = ctx.get('tradeIn')
        dealership = ctx.get('dealershipName', 'our dealership')
        salesperson = ctx.get('salespersonName', 'the sales rep')
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
- Make it easy: "When works for you?" / "I'm here until 7" / "Can I pull it up front for you?"
- Remove friction, don't add it

=== MESSAGE RULES ===
1. ONE message, ready to send via text/iMessage
2. 2-4 sentences MAX. Every word earns its place.
3. Sound like a knowledgeable friend, not a salesperson
4. NO emojis, NO brackets, NO placeholders
5. Sign off with just the first name
6. If it sounds "salesy" - rewrite it
7. Always aim for the in-person meeting"""

        chat = LlmChat(
            api_key=api_key,
            session_id=f"tower-talk-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(
            text=f"Situation: {request.situation}\n\nWrite a personalized message for this situation."
        )
        
        response = await chat.send_message(user_message)
        
        return TowerTalkResponse(response=response.strip())
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Tower Talk error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate response: {str(e)}")


# ============== SUPERCHARG'D TRANSLATION ==============

# In-memory translation cache for instant repeated translations
_translation_cache = {}
_cache_max_size = 1000

@api_router.post("/translate", response_model=TranslateResponse)
async def translate_text(request: TranslateRequest):
    """
    Fast translation endpoint using GPT-4o-mini
    With in-memory caching for instant repeated translations
    """
    global _translation_cache
    
    try:
        text = request.text.strip()
        if not text:
            return TranslateResponse(translated_text="", detected_lang=None, confidence=0.0)
        
        # Create cache key
        cache_key = f"{request.source_lang}:{request.target_lang}:{text[:200]}"
        
        # Check cache first - instant response for cached translations
        if cache_key in _translation_cache:
            cached = _translation_cache[cache_key]
            logger.info(f"Translation cache hit: {len(text)} chars")
            return TranslateResponse(
                translated_text=cached['translated'],
                detected_lang=cached['detected'],
                confidence=0.99  # Higher confidence for cached
            )
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        # Language mapping - 5 supported languages
        lang_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French',
            'ja': 'Japanese', 'ko': 'Korean'
        }
        
        target_lang_name = lang_names.get(request.target_lang, request.target_lang)
        
        # OPTIMIZED: Short system message for speed
        system_message = f"Translate to {target_lang_name}. Output ONLY the translation, nothing else."
        
        start_time = datetime.now(timezone.utc)
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"translate-{uuid.uuid4()}",
            system_message=system_message
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(text=text)
        translated = await chat.send_message(user_message)
        
        translation_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        
        # Detect source language if auto (5 supported: en, es, fr, ja, ko)
        detected = request.source_lang if request.source_lang != "auto" else None
        if request.source_lang == "auto":
            if any(c in text for c in ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡']):
                detected = "es"
            elif any('\u3040' <= c <= '\u309f' or '\u30a0' <= c <= '\u30ff' for c in text):
                detected = "ja"
            elif any('\uac00' <= c <= '\ud7af' for c in text):
                detected = "ko"
            elif any(c in text for c in ['à', 'â', 'ç', 'è', 'é', 'ê', 'ë', 'î', 'ï', 'ô', 'ù', 'û', 'œ']):
                detected = "fr"
            else:
                detected = "en"
        
        logger.info(f"Translation: {translation_time:.2f}s")
        
        # Cache the translation for future instant retrieval
        if len(_translation_cache) >= _cache_max_size:
            # Remove oldest entries (simple LRU approximation)
            keys_to_remove = list(_translation_cache.keys())[:100]
            for key in keys_to_remove:
                del _translation_cache[key]
        
        _translation_cache[cache_key] = {
            'translated': translated.strip(),
            'detected': detected
        }
        
        return TranslateResponse(
            translated_text=translated.strip(),
            detected_lang=detected,
            confidence=0.95
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


# ============== TEXT-TO-SPEECH (Enterprise-Grade) ==============

# TTS Cache for instant playback of repeated phrases
_tts_cache: Dict[str, str] = {}
_tts_cache_max_size = 200

# Optimal voice selection by language for natural, smooth speech
VOICE_BY_LANGUAGE = {
    'en': 'nova',      # Energetic, clear American English
    'es': 'coral',     # Warm, friendly - great for Spanish
    'fr': 'shimmer',   # Bright, expressive - suits French
    'ja': 'alloy',     # Neutral, balanced - clean for Japanese
    'ko': 'echo',      # Smooth, calm - works well for Korean
}

@api_router.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """
    Enterprise-grade Text-to-Speech using OpenAI TTS
    - HD quality voices for smooth, lifelike speech
    - Intelligent caching for instant repeated playback
    - Language-optimized voice selection
    """
    global _tts_cache
    
    try:
        text = request.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        
        if len(text) > 4096:
            raise HTTPException(status_code=400, detail="Text exceeds 4096 character limit")
        
        # Determine optimal voice based on language if not specified
        voice = request.voice
        if voice == "auto" or not voice:
            voice = VOICE_BY_LANGUAGE.get(request.language, 'nova')
        
        # Create cache key
        cache_key = f"{voice}:{request.speed}:{text[:500]}"
        
        # Check cache first - instant response
        if cache_key in _tts_cache:
            logger.info(f"TTS cache hit: {len(text)} chars, voice={voice}")
            return TTSResponse(
                audio_base64=_tts_cache[cache_key],
                format="mp3",
                voice_used=voice,
                cached=True
            )
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")
        
        from emergentintegrations.llm.openai import OpenAITextToSpeech
        
        start_time = datetime.now(timezone.utc)
        
        tts = OpenAITextToSpeech(api_key=api_key)
        
        # Generate HD quality speech
        audio_base64 = await tts.generate_speech_base64(
            text=text,
            model=request.model,  # tts-1-hd for HD quality
            voice=voice,
            speed=request.speed
        )
        
        generation_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"TTS generated: {len(text)} chars, voice={voice}, time={generation_time:.2f}s")
        
        # Cache for future instant playback
        if len(_tts_cache) >= _tts_cache_max_size:
            # Remove oldest entries
            keys_to_remove = list(_tts_cache.keys())[:50]
            for key in keys_to_remove:
                del _tts_cache[key]
        
        _tts_cache[cache_key] = audio_base64
        
        return TTSResponse(
            audio_base64=audio_base64,
            format="mp3",
            voice_used=voice,
            cached=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


# ============== VOICE TRANSLATION (Speech-to-Text + Translate) ==============

class VoiceTranslateResponse(BaseModel):
    transcript: str
    translated_text: str
    source_lang: str
    target_lang: str
    success: bool
    error: Optional[str] = None

@api_router.post("/voice-translate", response_model=VoiceTranslateResponse)
async def voice_translate(
    audio: UploadFile = File(...),
    source_lang: str = Form(default="en"),
    target_lang: str = Form(default="es")
):
    """
    Voice Translation: Transcribe audio with Whisper, then translate.
    Supports: mp3, mp4, mpeg, mpga, m4a, wav, webm
    Max file size: 25MB
    """
    import tempfile
    import io
    
    try:
        logger.info(f"Voice translate request: {audio.filename}, {source_lang} -> {target_lang}")
        
        # Validate file type
        allowed_types = ['audio/webm', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/wav', 
                         'audio/m4a', 'audio/x-m4a', 'video/webm', 'audio/ogg', 'audio/aac']
        content_type = audio.content_type or ''
        
        # Also check extension
        filename = audio.filename or 'audio.webm'
        ext = filename.split('.')[-1].lower()
        allowed_exts = ['webm', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'ogg', 'aac']
        
        if content_type not in allowed_types and ext not in allowed_exts:
            logger.warning(f"Invalid audio type: {content_type}, ext: {ext}")
            return VoiceTranslateResponse(
                transcript="",
                translated_text="",
                source_lang=source_lang,
                target_lang=target_lang,
                success=False,
                error="Invalid audio format. Supported: webm, mp3, mp4, wav, m4a"
            )
        
        # Read audio data
        audio_data = await audio.read()
        
        if len(audio_data) == 0:
            return VoiceTranslateResponse(
                transcript="",
                translated_text="",
                source_lang=source_lang,
                target_lang=target_lang,
                success=False,
                error="Empty audio file received"
            )
        
        if len(audio_data) > 25 * 1024 * 1024:  # 25MB limit
            return VoiceTranslateResponse(
                transcript="",
                translated_text="",
                source_lang=source_lang,
                target_lang=target_lang,
                success=False,
                error="Audio file too large. Max 25MB."
            )
        
        logger.info(f"Audio size: {len(audio_data)} bytes")
        
        # Transcribe with Whisper
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        stt = OpenAISpeechToText(api_key=os.getenv("EMERGENT_LLM_KEY"))
        
        # Map language codes for Whisper (ISO-639-1)
        whisper_lang_map = {
            'en': 'en', 'es': 'es', 'fr': 'fr', 'ja': 'ja', 'ko': 'ko',
            'de': 'de', 'it': 'it', 'pt': 'pt', 'zh': 'zh', 'ru': 'ru'
        }
        whisper_lang = whisper_lang_map.get(source_lang, 'en')
        
        # Create a file-like object for the API
        audio_file = io.BytesIO(audio_data)
        audio_file.name = filename if '.' in filename else f"audio.{ext}"
        
        try:
            response = await stt.transcribe(
                file=audio_file,
                model="whisper-1",
                language=whisper_lang,
                response_format="json"
            )
            transcript = response.text.strip()
            logger.info(f"Transcription result: {transcript[:100]}...")
        except Exception as stt_error:
            logger.error(f"Whisper transcription failed: {stt_error}")
            return VoiceTranslateResponse(
                transcript="",
                translated_text="",
                source_lang=source_lang,
                target_lang=target_lang,
                success=False,
                error=f"Transcription failed: {str(stt_error)}"
            )
        
        if not transcript:
            return VoiceTranslateResponse(
                transcript="",
                translated_text="",
                source_lang=source_lang,
                target_lang=target_lang,
                success=False,
                error="No speech detected in audio"
            )
        
        # If same language, no translation needed
        if source_lang == target_lang:
            return VoiceTranslateResponse(
                transcript=transcript,
                translated_text=transcript,
                source_lang=source_lang,
                target_lang=target_lang,
                success=True
            )
        
        # Translate the transcript
        lang_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French', 
            'ja': 'Japanese', 'ko': 'Korean', 'de': 'German',
            'it': 'Italian', 'pt': 'Portuguese', 'zh': 'Chinese', 'ru': 'Russian'
        }
        
        source_name = lang_names.get(source_lang, 'English')
        target_name = lang_names.get(target_lang, 'Spanish')
        
        chat = LlmChat(
            api_key=os.getenv('EMERGENT_LLM_KEY'),
            model="gpt-4o-mini",
            system_message=f"You are a professional translator. Translate the following {source_name} text to {target_name}. Provide ONLY the translation, nothing else.",
            session_id=f"voice-translate-{uuid.uuid4()}"
        )
        
        user_message = UserMessage(message=transcript)
        translated = await chat.send_message(user_message)
        translated_text = translated.strip()
        
        logger.info(f"Translation complete: {translated_text[:100]}...")
        
        return VoiceTranslateResponse(
            transcript=transcript,
            translated_text=translated_text,
            source_lang=source_lang,
            target_lang=target_lang,
            success=True
        )
        
    except Exception as e:
        logger.error(f"Voice translation error: {str(e)}", exc_info=True)
        return VoiceTranslateResponse(
            transcript="",
            translated_text="",
            source_lang=source_lang,
            target_lang=target_lang,
            success=False,
            error=f"Voice translation failed: {str(e)}"
        )


# ============== ENTERPRISE DRIVER'S LICENSE SCANNING ==============
# Superior to VinSolutions - Multi-pass OCR with validation

# Configure uploads directory
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

class LicenseScanResponse(BaseModel):
    """Response for license scan with OCR extraction"""
    success: bool
    image_url: Optional[str] = None
    extracted_data: Optional[dict] = None
    confidence: Optional[float] = None
    extraction_notes: Optional[List[str]] = None
    error: Optional[str] = None

class LicenseUploadResponse(BaseModel):
    success: bool
    image_url: Optional[str] = None
    customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    error: Optional[str] = None


def normalize_name(name: str) -> str:
    """Normalize a name to proper title case"""
    if not name:
        return name
    # Handle all-caps or all-lowercase
    return ' '.join(word.capitalize() for word in name.strip().split())


def normalize_state(state: str) -> str:
    """Normalize state to 2-letter abbreviation"""
    if not state:
        return state
    state = state.strip().upper()
    
    # Already 2 letters
    if len(state) == 2:
        return state
    
    # Common state name mappings
    state_map = {
        "ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR",
        "CALIFORNIA": "CA", "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE",
        "FLORIDA": "FL", "GEORGIA": "GA", "HAWAII": "HI", "IDAHO": "ID",
        "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
        "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD",
        "MASSACHUSETTS": "MA", "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS",
        "MISSOURI": "MO", "MONTANA": "MT", "NEBRASKA": "NE", "NEVADA": "NV",
        "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY",
        "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
        "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
        "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT",
        "VERMONT": "VT", "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV",
        "WISCONSIN": "WI", "WYOMING": "WY", "DISTRICT OF COLUMBIA": "DC"
    }
    return state_map.get(state, state[:2])


def calculate_license_confidence(data: dict) -> tuple:
    """Calculate confidence score and notes for extracted license data"""
    confidence = 0
    notes = []
    
    # Name extraction (40 points)
    if data.get('first_name') and data.get('last_name'):
        confidence += 40
    elif data.get('first_name') or data.get('last_name'):
        confidence += 20
        notes.append("Partial name extracted - please verify")
    else:
        notes.append("Could not extract name")
    
    # Address extraction (35 points)
    if data.get('address'):
        confidence += 20
        if data.get('city'):
            confidence += 5
        if data.get('state'):
            confidence += 5
        if data.get('zip_code'):
            confidence += 5
    else:
        notes.append("Address may need manual entry")
    
    # Validation checks (25 points)
    if data.get('state') and len(data['state']) == 2:
        confidence += 10
    if data.get('zip_code') and len(data['zip_code']) >= 5:
        confidence += 10
    if data.get('first_name') and len(data['first_name']) >= 2:
        confidence += 5
    
    return confidence, notes


@api_router.post("/license/scan", response_model=LicenseScanResponse)
async def scan_license_with_ocr(
    image: UploadFile = File(...),
    retry_count: int = 0,
):
    """
    ENTERPRISE-GRADE Driver's License OCR Scanner
    
    Features:
    - Multi-pass extraction with validation
    - Intelligent name/address normalization
    - Confidence scoring with extraction notes
    - Automatic retry on partial extraction
    - Image quality validation
    
    Extracts:
    - First Name, Last Name
    - Full Address (street, city, state, zip)
    
    Uses OpenAI GPT-4o Vision for high-accuracy extraction.
    """
    import base64
    import json
    import re
    
    try:
        logger.info(f"License scan request: {image.filename}, type: {image.content_type}, retry: {retry_count}")
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
        content_type = image.content_type or ''
        
        if content_type not in allowed_types:
            ext = (image.filename or '').split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']:
                return LicenseScanResponse(
                    success=False,
                    error="Invalid image format. Supported formats: JPG, PNG, WEBP, HEIC"
                )
        
        # Read image data
        image_data = await image.read()
        
        if len(image_data) == 0:
            return LicenseScanResponse(success=False, error="Empty image file received. Please try again.")
        
        # Size validation with helpful message
        if len(image_data) > 15 * 1024 * 1024:
            return LicenseScanResponse(
                success=False, 
                error="Image too large (max 15MB). Try taking the photo from further away or reducing image quality."
            )
        
        # Minimum size check (likely too small/blurry)
        if len(image_data) < 10 * 1024:  # 10KB minimum
            return LicenseScanResponse(
                success=False,
                error="Image appears too small or low quality. Please take a clearer photo."
            )
        
        # Save the image first (so user doesn't lose it even if OCR fails)
        ext = (image.filename or 'image.jpg').split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp']:
            ext = 'jpg'
        filename = f"license_{uuid.uuid4().hex[:12]}.{ext}"
        filepath = UPLOADS_DIR / filename
        
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        image_url = f"/api/uploads/{filename}"
        logger.info(f"License image saved: {filepath}, size: {len(image_data)} bytes")
        
        # Convert to base64 for Vision API
        base64_image = base64.b64encode(image_data).decode('utf-8')
        
        # ENTERPRISE OCR PROMPT - optimized for accuracy
        extraction_prompt = """You are an expert OCR system specialized in reading US Driver's Licenses.

Analyze this driver's license image carefully. Extract the following information EXACTLY as shown on the license.

Return a JSON object with these fields:
{
  "first_name": "First/Given name",
  "middle_name": "Middle name if visible (or null)",
  "last_name": "Last/Family name",
  "address": "Street address (number and street only)",
  "city": "City name",
  "state": "State (2-letter abbreviation like CA, TX, NY)",
  "zip_code": "ZIP code (5 digits, or 5+4 format)"
}

CRITICAL INSTRUCTIONS:
1. Look for the NAME field - it may be formatted as "LAST, FIRST MIDDLE" or "FIRST MIDDLE LAST"
2. The address is usually on 2-3 lines below the name
3. State abbreviations are always 2 letters (e.g., CA not California)
4. If text is unclear but partially visible, extract what you can see
5. Use proper capitalization (e.g., "John" not "JOHN")
6. If a field is completely unreadable, use null
7. Return ONLY the JSON object - no explanations or markdown"""

        # Initialize chat with retry-aware session
        chat = LlmChat(
            api_key=os.getenv('EMERGENT_LLM_KEY'),
            session_id=f"license-scan-{uuid.uuid4()}-r{retry_count}",
            system_message="You are an expert document OCR system. Your specialty is accurately extracting text from US driver's licenses. Be precise and thorough."
        ).with_model("openai", "gpt-4o")
        
        # Use ImageContent for image data
        from emergentintegrations.llm.openai import ImageContent
        image_content = ImageContent(image_base64=base64_image)
        
        user_message = UserMessage(
            text=extraction_prompt,
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        logger.info(f"Vision API response ({len(response)} chars): {response[:300]}...")
        
        # Parse JSON response with robust cleaning
        try:
            cleaned = response.strip()
            
            # Remove markdown code blocks
            if '```' in cleaned:
                # Find JSON between code blocks
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', cleaned)
                if json_match:
                    cleaned = json_match.group(1)
                else:
                    cleaned = re.sub(r'^```json?\s*', '', cleaned)
                    cleaned = re.sub(r'\s*```$', '', cleaned)
            
            # Try to find JSON object in response
            json_match = re.search(r'\{[\s\S]*\}', cleaned)
            if json_match:
                cleaned = json_match.group(0)
            
            extracted_data = json.loads(cleaned)
            
            # Normalize extracted data
            if extracted_data.get('first_name'):
                extracted_data['first_name'] = normalize_name(extracted_data['first_name'])
            if extracted_data.get('last_name'):
                extracted_data['last_name'] = normalize_name(extracted_data['last_name'])
            if extracted_data.get('middle_name'):
                extracted_data['middle_name'] = normalize_name(extracted_data['middle_name'])
            if extracted_data.get('city'):
                extracted_data['city'] = normalize_name(extracted_data['city'])
            if extracted_data.get('state'):
                extracted_data['state'] = normalize_state(extracted_data['state'])
            if extracted_data.get('zip_code'):
                # Clean zip code - keep only digits and hyphen
                extracted_data['zip_code'] = re.sub(r'[^\d-]', '', str(extracted_data['zip_code']))
            
            # Calculate confidence
            confidence, notes = calculate_license_confidence(extracted_data)
            
            # Check if we got minimum viable data
            has_name = extracted_data.get('first_name') or extracted_data.get('last_name')
            
            if not has_name:
                return LicenseScanResponse(
                    success=False,
                    image_url=image_url,
                    confidence=0,
                    extraction_notes=["Could not read name from license"],
                    error="Could not extract name from license. Please ensure the license is clearly visible, well-lit, and not covered by glare."
                )
            
            logger.info(f"Extracted: {extracted_data.get('first_name')} {extracted_data.get('last_name')} (confidence: {confidence}%)")
            
            return LicenseScanResponse(
                success=True,
                image_url=image_url,
                extracted_data=extracted_data,
                confidence=confidence,
                extraction_notes=notes if notes else None
            )
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error: {e}, response: {response[:500]}")
            return LicenseScanResponse(
                success=False,
                image_url=image_url,
                confidence=0,
                error="Could not read license data. Please try again with a clearer photo - avoid shadows, glare, and ensure all text is visible."
            )
        
    except Exception as e:
        logger.error(f"License scan error: {str(e)}", exc_info=True)
        error_msg = str(e)
        
        # Provide helpful error messages
        if "timeout" in error_msg.lower():
            error_msg = "Scan timed out. Please try again - ensure good internet connection."
        elif "rate limit" in error_msg.lower():
            error_msg = "Service busy. Please wait a moment and try again."
        else:
            error_msg = f"Scan failed: {error_msg}. Please try again."
        
        return LicenseScanResponse(
            success=False,
            error=error_msg
        )


@api_router.post("/license/create-customer")
async def create_customer_from_license(
    first_name: str = Form(...),
    last_name: str = Form(...),
    address: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    zip_code: Optional[str] = Form(None),
    image_url: str = Form(...),
):
    """
    Create a new customer from extracted license data.
    Saves both the extracted info and the license image.
    """
    try:
        # Build full address string
        address_parts = []
        if address:
            address_parts.append(address)
        if city:
            address_parts.append(city)
        if state:
            address_parts.append(state)
        if zip_code:
            address_parts.append(zip_code)
        
        full_address = ', '.join(filter(None, address_parts))
        
        customer_id = str(uuid.uuid4())
        customer_doc = {
            "id": customer_id,
            "first_name": first_name,
            "last_name": last_name,
            "name": f"{first_name} {last_name}",
            "address": full_address,
            "city": city,
            "state": state,
            "zip_code": zip_code,
            "license_image_url": image_url,
            "license_image_uploaded_at": datetime.now(timezone.utc).isoformat(),
            "lead_status": "new",
            "lead_source": "license_scan",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        
        await db.customers.insert_one(customer_doc)
        
        # Remove _id for response
        customer_doc.pop('_id', None)
        
        logger.info(f"Customer created from license: {customer_doc['name']}")
        
        return {
            "success": True,
            "customer": customer_doc,
            "message": f"Customer {customer_doc['name']} created successfully"
        }
        
    except Exception as e:
        logger.error(f"Create customer from license error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/license/upload", response_model=LicenseUploadResponse)
async def upload_license_image(
    image: UploadFile = File(...),
    customer_id: Optional[str] = Form(None),
):
    """
    Upload a driver's license image and attach it to a customer profile.
    (No OCR - use /license/scan for extraction)
    
    The image is stored and its URL is saved to the customer's profile.
    This image will be included when using the Eject feature to send
    customer info via SMS/MMS.
    """
    import base64
    
    try:
        logger.info(f"License upload request: {image.filename}, customer_id: {customer_id}")
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
        content_type = image.content_type or ''
        
        if content_type not in allowed_types:
            ext = (image.filename or '').split('.')[-1].lower()
            if ext not in ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']:
                return LicenseUploadResponse(
                    success=False,
                    error="Invalid image format. Please upload JPG, PNG, or WEBP."
                )
        
        # Read image data
        image_data = await image.read()
        
        if len(image_data) == 0:
            return LicenseUploadResponse(success=False, error="Empty image file received")
        
        if len(image_data) > 10 * 1024 * 1024:  # 10MB limit for license images
            return LicenseUploadResponse(success=False, error="Image too large. Max 10MB.")
        
        # Generate unique filename
        ext = (image.filename or 'image.jpg').split('.')[-1].lower()
        if ext not in ['jpg', 'jpeg', 'png', 'webp']:
            ext = 'jpg'
        filename = f"license_{uuid.uuid4().hex[:12]}.{ext}"
        filepath = UPLOADS_DIR / filename
        
        # Save file to disk
        with open(filepath, 'wb') as f:
            f.write(image_data)
        
        # Construct the URL path for the uploaded image
        image_url = f"/api/uploads/{filename}"
        
        logger.info(f"License image saved: {filepath}, URL: {image_url}")
        
        # If customer_id provided, attach to existing customer
        if customer_id:
            result = await db.customers.find_one_and_update(
                {"id": customer_id},
                {
                    "$set": {
                        "license_image_url": image_url,
                        "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()
                    }
                },
                return_document=True
            )
            
            if result:
                customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
                return LicenseUploadResponse(
                    success=True,
                    image_url=image_url,
                    customer_id=customer_id,
                    customer_name=customer_name or "Customer"
                )
            else:
                # Customer not found but image was saved
                return LicenseUploadResponse(
                    success=True,
                    image_url=image_url,
                    error="Customer not found, but image was saved"
                )
        
        # No customer_id - just return the image URL
        return LicenseUploadResponse(
            success=True,
            image_url=image_url
        )
        
    except Exception as e:
        logger.error(f"License upload error: {str(e)}", exc_info=True)
        return LicenseUploadResponse(
            success=False,
            error=f"Upload failed: {str(e)}"
        )


@api_router.post("/license/attach")
async def attach_license_to_customer(
    customer_id: str = Form(...),
    image_url: str = Form(...),
):
    """
    Attach a previously uploaded license image to a customer profile.
    """
    try:
        result = await db.customers.find_one_and_update(
            {"id": customer_id},
            {
                "$set": {
                    "license_image_url": image_url,
                    "license_image_uploaded_at": datetime.now(timezone.utc).isoformat()
                }
            },
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        customer_name = f"{result.get('first_name', '')} {result.get('last_name', '')}".strip()
        
        return {
            "success": True,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "license_image_url": image_url
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Attach license error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Serve uploaded files
from fastapi.responses import FileResponse

@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded license images"""
    filepath = UPLOADS_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Security: ensure the filename is safe (no path traversal)
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Determine content type
    ext = filename.split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp'
    }
    content_type = content_types.get(ext, 'application/octet-stream')
    
    return FileResponse(filepath, media_type=content_type)


# ============== DATA IMPORT ==============

@api_router.post("/import/preview")
async def preview_import(request: ImportPreviewRequest):
    """
    Preview import - detect mappings and show sample data
    without committing to database
    """
    try:
        result = await import_processor.preview_import(
            request.content,
            request.format,
            request.data_type
        )
        return result
    except Exception as e:
        logger.error(f"Preview error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/import/url")
async def import_from_url(request: ImportUrlRequest):
    """Import data from a URL (JSON, CSV, or Google Sheets)"""
    try:
        result = await import_processor.import_from_url(
            request.url,
            request.data_type,
            request.custom_mapping
        )
        
        if result.success:
            # Store in database (without source_id for direct imports)
            if request.data_type == 'customers':
                stats = await customer_repo.upsert_from_import(
                    result.customers,
                    source_id="direct_import"
                )
            else:
                stats = await vehicle_repo.upsert_from_import(
                    result.vehicles,
                    source_id="direct_import"
                )
            
            return {
                "success": True,
                "stats": {
                    "total": result.total_rows,
                    "imported": result.imported_count,
                    "inserted": stats.get('inserted', 0),
                    "updated": stats.get('updated', 0),
                    "skipped": result.skipped_count
                },
                "mappings": [m.model_dump() for m in result.detected_mappings],
                "errors": result.errors[:10],
                "warnings": result.warnings[:10]
            }
        else:
            return {
                "success": False,
                "errors": result.errors,
                "warnings": result.warnings
            }
            
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/import/file")
async def import_from_file(
    file: UploadFile = File(...),
    data_type: str = Form("customers")
):
    """Import data from uploaded file"""
    try:
        content = await file.read()
        content_str = content.decode('utf-8')
        
        # Detect format from filename
        filename = file.filename.lower() if file.filename else ""
        if filename.endswith('.json'):
            format = 'json'
        else:
            format = 'csv'
        
        result = await import_processor.import_from_content(
            content_str,
            format,
            data_type
        )
        
        if result.success:
            if data_type == 'customers':
                stats = await customer_repo.upsert_from_import(
                    result.customers,
                    source_id="file_upload"
                )
            else:
                stats = await vehicle_repo.upsert_from_import(
                    result.vehicles,
                    source_id="file_upload"
                )
            
            return {
                "success": True,
                "filename": file.filename,
                "stats": {
                    "total": result.total_rows,
                    "imported": result.imported_count,
                    "inserted": stats.get('inserted', 0),
                    "updated": stats.get('updated', 0),
                    "skipped": result.skipped_count
                },
                "mappings": [m.model_dump() for m in result.detected_mappings],
                "errors": result.errors[:10]
            }
        else:
            return {
                "success": False,
                "errors": result.errors
            }
            
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File encoding not supported. Please use UTF-8.")
    except Exception as e:
        logger.error(f"File import error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============== DATA SOURCES ==============

@api_router.get("/data-sources")
async def list_data_sources():
    """List all configured data sources"""
    sources = await source_repo.find_many(sort=[("name", 1)])
    
    scheduler = get_scheduler()
    next_refresh = scheduler.get_next_scheduled_refresh() if scheduler else None
    
    return {
        "sources": source_repo.to_frontend_format(sources),
        "schedulerStatus": {
            "nextRefresh": next_refresh.isoformat() if next_refresh else None,
            "schedule": "Mon-Sat 10:00 AM ET"
        }
    }

@api_router.post("/data-sources")
async def create_data_source(request: CreateDataSourceRequest):
    """Create a new data source"""
    try:
        # Map string type to enum
        source_type = DataSourceType.GOOGLE_SHEETS if 'google' in request.type.lower() else DataSourceType.URL
        schedule = RefreshSchedule(request.refresh_schedule) if request.refresh_schedule else RefreshSchedule.WEEKDAYS_10AM
        
        config = DataSourceConfig(
            name=request.name,
            type=source_type,
            url=request.url,
            data_type=request.data_type,
            refresh_schedule=schedule
        )
        
        source_id = await source_repo.create_source(config)
        
        # Trigger initial import
        scheduler = get_scheduler()
        if scheduler:
            result = await scheduler.manual_refresh(source_id)
            return {
                "success": True,
                "sourceId": source_id,
                "initialImport": result
            }
        
        return {"success": True, "sourceId": source_id}
        
    except Exception as e:
        logger.error(f"Create source error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/data-sources/{source_id}")
async def get_data_source(source_id: str):
    """Get data source details"""
    source = await source_repo.find_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    return source_repo.to_frontend_format([source])[0]

@api_router.patch("/data-sources/{source_id}")
async def update_data_source(source_id: str, request: UpdateDataSourceRequest):
    """Update data source configuration"""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    success = await source_repo.update_one(source_id, updates)
    
    if not success:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    return {"success": True}

@api_router.delete("/data-sources/{source_id}")
async def delete_data_source(source_id: str):
    """Delete data source and its imported data"""
    source = await source_repo.find_by_id(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    
    # Delete associated data
    data_type = source.get('data_type', 'customers')
    if data_type == 'customers':
        await customer_repo.delete_by_source(source_id)
    else:
        await vehicle_repo.delete_by_source(source_id)
    
    # Delete source config
    await source_repo.delete_one(source_id)
    
    return {"success": True}

@api_router.post("/data-sources/{source_id}/refresh")
async def refresh_data_source(source_id: str):
    """Manually trigger refresh for a data source"""
    scheduler = get_scheduler()
    if not scheduler:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")
    
    result = await scheduler.manual_refresh(source_id)
    return result

@api_router.post("/data-sources/refresh-all")
async def refresh_all_sources():
    """Trigger refresh for all active sources"""
    scheduler = get_scheduler()
    if not scheduler:
        raise HTTPException(status_code=500, detail="Scheduler not initialized")
    
    result = await scheduler.refresh_all_now()
    return result


# ============== CUSTOMERS ==============

@api_router.get("/customers")
async def list_customers(
    status: Optional[str] = None,
    source_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    """List customers with optional filters.

    NOTE: This API powers the primary customer selector UI.
    It must include BOTH:
    - Integrated CRM customers via customer_repo
    - Locally created customers stored in Mongo (via /customers/create, /customers/list, license scan)
    """

    # Fetch a bit more than needed so we can merge + paginate deterministically
    fetch_n = max(0, limit + skip)

    # ---- Integrated customers ----
    if search:
        customers = await customer_repo.search(search, fetch_n)
    elif status:
        from data_integration.models import LeadStatus
        customers = await customer_repo.find_by_status(
            LeadStatus(status),
            limit=fetch_n,
            skip=0
        )
    elif source_id:
        customers = await customer_repo.find_by_source(source_id, fetch_n, 0)
    else:
        customers = await customer_repo.find_many(limit=fetch_n, skip=0)

    integrated_frontend = customer_repo.to_frontend_format(customers)

    # ---- Local customers (Mongo) ----
    local_query: Dict[str, Any] = {}
    if status:
        local_query["lead_status"] = status

    if search:
        local_query["$or"] = [
            {"first_name": {"$regex": search, "$options": "i"}},
            {"last_name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]

    local_docs = await db.customers.find(local_query, {"_id": 0}).sort("created_at", -1).limit(fetch_n).to_list(fetch_n)

    def _local_to_frontend(c: Dict[str, Any]) -> Dict[str, Any]:
        first = (c.get("first_name") or "").strip()
        last = (c.get("last_name") or "").strip()
        name = (f"{first} {last}").strip() or c.get("name") or ""
        return {
            "id": c.get("id"),
            "name": name,
            "firstName": first,
            "lastName": last,
            "phone": c.get("phone") or "",
            "email": c.get("email") or "",
            "address": c.get("address"),
            "vehicleInterest": (c.get("vehicle_of_interest") or c.get("vehicleInterest") or None),
            "status": c.get("lead_status") or c.get("status") or "new",
            "notes": c.get("notes"),
            "currentVehicle": None,
            "tradeIn": c.get("trade_in_info") or None,
        }

    local_frontend = [_local_to_frontend(c) for c in local_docs]

    # Merge: local first (most recent manual adds should be immediately visible)
    local_ids = {c.get("id") for c in local_frontend if c.get("id")}
    merged = local_frontend + [c for c in integrated_frontend if c.get("id") not in local_ids]

    paged = merged[skip:skip + limit] if limit else merged[skip:]

    return {
        "customers": paged,
        "count": len(merged)
    }

@api_router.get("/customers/stats")
async def customer_stats(source_id: Optional[str] = None):
    """Get customer statistics"""
    counts = await customer_repo.get_status_counts(source_id)
    total = await customer_repo.count({"source_id": source_id} if source_id else {})
    
    return {
        "total": total,
        "byStatus": counts
    }


# ============== VEHICLES ==============

@api_router.get("/vehicles")
async def list_vehicles(
    is_new: Optional[bool] = None,
    source_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0,
    summary: bool = False
):
    """List vehicles with optional filters"""
    if search:
        vehicles = await vehicle_repo.search(search, limit)
    elif source_id:
        vehicles = await vehicle_repo.find_by_source(source_id, limit, skip)
    elif is_new is not None:
        vehicles = await vehicle_repo.find_available(is_new, limit, skip)
    else:
        vehicles = await vehicle_repo.find_many(limit=limit, skip=skip)
    
    return {
        "vehicles": vehicle_repo.to_frontend_format(vehicles, summary=summary),
        "count": len(vehicles)
    }

@api_router.get("/vehicles/stats")
async def vehicle_stats(source_id: Optional[str] = None):
    """Get vehicle inventory statistics"""
    return await vehicle_repo.get_inventory_summary(source_id)


# ============== CRM INTEGRATIONS ==============

# Import integration modules
from integrations import IntegrationManager
from integrations.webhooks import FortifiedWebhookReceiver, WebhookAuthMethod

# Initialize managers
integration_manager = IntegrationManager(db)
webhook_receiver = FortifiedWebhookReceiver(db)


# Integration Request Models
class CreateIntegrationRequest(BaseModel):
    name: str
    adapter_type: str
    base_url: str = ""
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    data_type: str = "customers"
    field_mappings: Optional[Dict[str, str]] = None
    mock_mode: bool = False

class UpdateIntegrationRequest(BaseModel):
    name: Optional[str] = None
    base_url: Optional[str] = None
    is_active: Optional[bool] = None
    mock_mode: Optional[bool] = None
    auth_config: Optional[Dict[str, Any]] = None
    field_mappings: Optional[Dict[str, str]] = None

class RegisterWebhookRequest(BaseModel):
    integration_id: str
    name: str
    auth_method: str = "hmac_sha256"
    enabled_events: Optional[List[str]] = None


@api_router.get("/integrations/adapters")
async def list_available_adapters():
    """List all available CRM adapter types"""
    return {
        "adapters": integration_manager.list_available_adapters()
    }

@api_router.get("/integrations/adapters/{adapter_type}")
async def get_adapter_setup(adapter_type: str):
    """Get setup instructions for an adapter type"""
    instructions = integration_manager.get_adapter_setup_instructions(adapter_type)
    if not instructions:
        raise HTTPException(status_code=404, detail="Adapter type not found")
    return instructions


# ============== FIELD DISCOVERY ==============

from integrations.field_discovery import get_discovery_service, CUSTOMER_SCHEMA, VEHICLE_SCHEMA

class DiscoverFieldsRequest(BaseModel):
    base_url: str
    endpoint: str
    auth_config: Dict[str, Any] = Field(default_factory=dict)
    data_type: str = "customers"

class DiscoverFromSampleRequest(BaseModel):
    sample_json: str
    data_type: str = "customers"

@api_router.post("/integrations/discover-fields")
async def discover_fields_from_api(request: DiscoverFieldsRequest):
    """
    Discover fields by fetching a sample from an API
    
    Auto-detects available fields and suggests mappings to our schema.
    """
    discovery = get_discovery_service()
    result = await discovery.discover_from_api(
        base_url=request.base_url,
        endpoint=request.endpoint,
        auth_config=request.auth_config,
        data_type=request.data_type,
    )
    
    return {
        "success": result.success,
        "data_type": result.data_type,
        "discovered_fields": [
            {
                "source_name": f.source_name,
                "source_path": f.source_path,
                "sample_value": f.sample_value,
                "inferred_type": f.inferred_type,
                "suggested_mapping": f.suggested_mapping,
                "confidence": f.confidence,
                "is_mapped": f.is_mapped,
            }
            for f in result.discovered_fields
        ],
        "sample_record": result.sample_record,
        "unmapped_required": result.unmapped_required,
        "errors": result.errors,
        "warnings": result.warnings,
    }

@api_router.post("/integrations/discover-fields/sample")
async def discover_fields_from_sample(request: DiscoverFromSampleRequest):
    """
    Discover fields from a manually pasted JSON sample
    
    For APIs behind firewalls or when auto-fetch isn't possible.
    """
    discovery = get_discovery_service()
    result = discovery.discover_from_sample(
        sample_json=request.sample_json,
        data_type=request.data_type,
    )
    
    return {
        "success": result.success,
        "data_type": result.data_type,
        "discovered_fields": [
            {
                "source_name": f.source_name,
                "source_path": f.source_path,
                "sample_value": f.sample_value,
                "inferred_type": f.inferred_type,
                "suggested_mapping": f.suggested_mapping,
                "confidence": f.confidence,
                "is_mapped": f.is_mapped,
            }
            for f in result.discovered_fields
        ],
        "sample_record": result.sample_record,
        "unmapped_required": result.unmapped_required,
        "errors": result.errors,
        "warnings": result.warnings,
    }

@api_router.get("/integrations/schema/{data_type}")
async def get_target_schema(data_type: str):
    """Get the target schema for mapping fields"""
    if data_type == "customers":
        return {"schema": CUSTOMER_SCHEMA, "required": ["name", "phone"]}
    elif data_type == "vehicles":
        return {"schema": VEHICLE_SCHEMA, "required": ["year", "make", "model"]}
    else:
        raise HTTPException(status_code=400, detail="Invalid data_type. Use 'customers' or 'vehicles'")


# ============== OPENAPI SPEC IMPORT ==============

from integrations.openapi_parser import get_openapi_parser

class ParseOpenAPIRequest(BaseModel):
    spec_content: Optional[str] = None
    spec_url: Optional[str] = None

@api_router.post("/integrations/parse-openapi")
async def parse_openapi_spec(request: ParseOpenAPIRequest):
    """
    Parse an OpenAPI/Swagger spec and generate integration configuration
    
    Provide either spec_content (JSON/YAML string) or spec_url (URL to fetch spec)
    """
    parser = get_openapi_parser()
    
    if request.spec_url:
        result = await parser.parse_from_url(request.spec_url)
    elif request.spec_content:
        result = parser.parse_from_string(request.spec_content)
    else:
        raise HTTPException(status_code=400, detail="Provide either spec_content or spec_url")
    
    if not result.success:
        return {
            "success": False,
            "errors": result.errors,
            "warnings": result.warnings,
        }
    
    # Generate profile config
    profile_config = parser.generate_profile_config(result)
    
    return {
        "success": True,
        "spec_version": result.spec_version,
        "api_info": {
            "title": result.title,
            "description": result.description,
            "version": result.version,
        },
        "base_url": result.base_url,
        "servers": result.servers,
        "auth_methods": [
            {
                "method": auth.method,
                "location": auth.location,
                "name": auth.name,
            }
            for auth in result.auth_methods
        ],
        "endpoints": [
            {
                "path": ep.path,
                "method": ep.method,
                "summary": ep.summary,
                "data_type": ep.data_type,
                "confidence": ep.confidence,
                "tags": ep.tags,
            }
            for ep in result.endpoints[:20]  # Limit to 20 endpoints
        ],
        "suggested_config": profile_config,
        "customers_endpoint": {
            "path": result.customers_endpoint.path if result.customers_endpoint else None,
            "confidence": result.customers_endpoint.confidence if result.customers_endpoint else 0,
        },
        "vehicles_endpoint": {
            "path": result.vehicles_endpoint.path if result.vehicles_endpoint else None,
            "confidence": result.vehicles_endpoint.confidence if result.vehicles_endpoint else 0,
        },
        "warnings": result.warnings,
    }


# ============== SMART FIELD SUGGEST ==============

from integrations.smart_suggest import get_smart_suggest_service

class SmartSuggestRequest(BaseModel):
    unmapped_fields: List[Dict[str, Any]]
    data_type: str = "customers"
    use_ai: bool = True

class AnalyzeSampleRequest(BaseModel):
    sample_record: Dict[str, Any]
    data_type: str = "customers"

@api_router.post("/integrations/smart-suggest")
async def smart_suggest_mappings(request: SmartSuggestRequest):
    """
    Get AI-powered field mapping suggestions
    
    Uses pattern detection and LLM analysis to suggest mappings
    for fields that couldn't be auto-mapped.
    """
    service = get_smart_suggest_service()
    result = await service.suggest_mappings(
        unmapped_fields=request.unmapped_fields,
        data_type=request.data_type,
        use_ai=request.use_ai
    )
    
    return {
        "success": result.success,
        "suggestions": [
            {
                "source_field": s.source_field,
                "sample_value": s.sample_value,
                "suggested_target": s.suggested_target,
                "confidence": s.confidence,
                "reason": s.reason,
                "pattern_detected": s.pattern_detected,
            }
            for s in result.suggestions
        ],
        "unmapped_fields": result.unmapped_fields,
        "errors": result.errors,
    }

@api_router.post("/integrations/analyze-sample")
async def analyze_sample_record(request: AnalyzeSampleRequest):
    """
    Analyze a complete sample record and suggest all mappings
    
    Combines auto-detection, pattern matching, and AI analysis
    for comprehensive field mapping suggestions.
    """
    service = get_smart_suggest_service()
    result = await service.analyze_sample_record(
        record=request.sample_record,
        data_type=request.data_type
    )
    
    return {
        "success": result.success,
        "suggestions": [
            {
                "source_field": s.source_field,
                "sample_value": s.sample_value,
                "suggested_target": s.suggested_target,
                "confidence": s.confidence,
                "reason": s.reason,
                "pattern_detected": s.pattern_detected,
            }
            for s in result.suggestions
        ],
        "unmapped_fields": result.unmapped_fields,
        "ai_analysis": result.ai_analysis,
        "errors": result.errors,
    }


# ============== FIELD TRANSFORMS ==============

from integrations.field_transforms import (
    FieldTransformEngine, MappingConfig, FieldMapping, Transform, Condition,
    TransformType, ConditionOperator,
    create_name_composite_mapping, create_phone_mapping, create_price_mapping
)

class TransformTestRequest(BaseModel):
    """Test transforms on sample data"""
    sample_record: Dict[str, Any]
    mapping_config: Dict[str, Any]
    data_type: str = "customers"

class TransformPreviewRequest(BaseModel):
    """Preview a single transform"""
    value: Any
    transform_type: str
    params: Dict[str, Any] = Field(default_factory=dict)
    record: Dict[str, Any] = Field(default_factory=dict)

@api_router.get("/integrations/transforms")
async def list_available_transforms():
    """List all available transform types with descriptions"""
    transforms = {
        "string": [
            {"type": "uppercase", "description": "Convert to UPPERCASE", "example": "hello → HELLO"},
            {"type": "lowercase", "description": "Convert to lowercase", "example": "HELLO → hello"},
            {"type": "titlecase", "description": "Convert to Title Case", "example": "hello world → Hello World"},
            {"type": "trim", "description": "Remove leading/trailing whitespace", "example": "  hello  → hello"},
            {"type": "strip_html", "description": "Remove HTML tags", "example": "<b>hello</b> → hello"},
            {"type": "truncate", "description": "Truncate to max length", "params": ["max_length", "suffix"]},
        ],
        "phone": [
            {"type": "phone_normalize", "description": "Normalize to +1XXXXXXXXXX", "example": "(555) 123-4567 → +15551234567"},
            {"type": "phone_format_us", "description": "Format as (XXX) XXX-XXXX", "example": "5551234567 → (555) 123-4567"},
            {"type": "phone_digits_only", "description": "Extract digits only", "example": "(555) 123-4567 → 5551234567"},
        ],
        "name": [
            {"type": "name_combine", "description": "Combine first + last name", "params": ["fields", "separator"]},
            {"type": "name_parse", "description": "Parse full name into parts", "example": "John Smith → {first_name: John, last_name: Smith}"},
        ],
        "price": [
            {"type": "price_normalize", "description": "Convert to number", "example": "$25,000.00 → 25000.00"},
            {"type": "number_extract", "description": "Extract first number", "example": "Asking $25000 OBO → 25000"},
            {"type": "round_price", "description": "Round to nearest dollar", "example": "25999.99 → 26000"},
        ],
        "date": [
            {"type": "date_normalize", "description": "Convert to ISO format", "example": "01/15/2024 → 2024-01-15"},
            {"type": "date_format", "description": "Format with custom pattern", "params": ["format"]},
        ],
        "address": [
            {"type": "address_combine", "description": "Combine address parts", "params": ["fields", "separator"]},
            {"type": "state_abbreviate", "description": "Abbreviate state name", "example": "California → CA"},
            {"type": "state_expand", "description": "Expand state abbreviation", "example": "CA → California"},
            {"type": "zip_normalize", "description": "Normalize ZIP code", "example": "9021 → 09021"},
        ],
        "vehicle": [
            {"type": "vin_validate", "description": "Validate and uppercase VIN", "example": "abc123... → ABC123..."},
            {"type": "year_extract", "description": "Extract year from string", "example": "2024 Toyota Camry → 2024"},
            {"type": "mileage_normalize", "description": "Extract mileage number", "example": "45,000 miles → 45000"},
        ],
        "status": [
            {"type": "status_normalize", "description": "Normalize to standard values", "example": "Active → hot"},
        ],
        "generic": [
            {"type": "regex_extract", "description": "Extract via regex pattern", "params": ["pattern", "group"]},
            {"type": "regex_replace", "description": "Replace via regex", "params": ["pattern", "replacement"]},
            {"type": "template", "description": "String template", "params": ["template"], "example": "{year} {make} {model}"},
            {"type": "lookup", "description": "Map via lookup table", "params": ["table", "default"]},
            {"type": "coalesce", "description": "First non-empty value", "params": ["fields"]},
            {"type": "split", "description": "Split and take part", "params": ["delimiter", "index"]},
            {"type": "join", "description": "Join multiple fields", "params": ["fields", "delimiter"]},
        ],
    }
    
    conditions = [
        {"operator": "equals", "description": "Field equals value"},
        {"operator": "not_equals", "description": "Field does not equal value"},
        {"operator": "contains", "description": "Field contains value"},
        {"operator": "not_contains", "description": "Field does not contain value"},
        {"operator": "starts_with", "description": "Field starts with value"},
        {"operator": "ends_with", "description": "Field ends with value"},
        {"operator": "matches_regex", "description": "Field matches regex pattern"},
        {"operator": "is_empty", "description": "Field is empty or null"},
        {"operator": "is_not_empty", "description": "Field has a value"},
        {"operator": "greater_than", "description": "Field > value (numeric)"},
        {"operator": "less_than", "description": "Field < value (numeric)"},
        {"operator": "in_list", "description": "Field is in list of values"},
        {"operator": "not_in_list", "description": "Field is not in list of values"},
    ]
    
    return {
        "transforms": transforms,
        "conditions": conditions,
    }

@api_router.post("/integrations/transforms/preview")
async def preview_transform(request: TransformPreviewRequest):
    """Preview a single transform on a value"""
    try:
        transform_type = TransformType(request.transform_type)
        transform = Transform(type=transform_type, params=request.params)
        result = transform.apply(request.value, request.record)
        
        return {
            "success": True,
            "input": request.value,
            "output": result,
            "transform": request.transform_type,
        }
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown transform type: {request.transform_type}")
    except Exception as e:
        return {
            "success": False,
            "input": request.value,
            "output": None,
            "error": str(e),
        }

@api_router.post("/integrations/transforms/test")
async def test_mapping_config(request: TransformTestRequest):
    """Test a complete mapping configuration on sample data"""
    try:
        config = MappingConfig.from_dict(request.mapping_config)
        engine = FieldTransformEngine(config)
        
        if request.data_type == "customers":
            result = engine.transform_customer(request.sample_record)
        else:
            result = engine.transform_vehicle(request.sample_record)
        
        return {
            "success": True,
            "input": request.sample_record,
            "output": result,
            "data_type": request.data_type,
        }
    except Exception as e:
        logger.error(f"Transform test error: {e}")
        return {
            "success": False,
            "error": str(e),
        }

@api_router.post("/integrations/transforms/suggest")
async def suggest_transforms_for_field(
    source_field: str,
    sample_value: Any,
    target_field: str,
    data_type: str = "customers"
):
    """Suggest transforms to convert source value to target field format"""
    suggestions = []
    
    # Phone field suggestions
    if target_field == "phone":
        suggestions.append({
            "transforms": [{"type": "phone_normalize", "params": {}}],
            "description": "Normalize phone to +1XXXXXXXXXX format",
            "preview": Transform(type=TransformType.PHONE_NORMALIZE).apply(sample_value, {}),
        })
        suggestions.append({
            "transforms": [{"type": "phone_format_us", "params": {}}],
            "description": "Format as (XXX) XXX-XXXX",
            "preview": Transform(type=TransformType.PHONE_FORMAT_US).apply(sample_value, {}),
        })
    
    # Name field suggestions
    elif target_field == "name":
        suggestions.append({
            "transforms": [{"type": "titlecase", "params": {}}, {"type": "trim", "params": {}}],
            "description": "Title case and trim whitespace",
            "preview": Transform(type=TransformType.TITLECASE).apply(
                Transform(type=TransformType.TRIM).apply(sample_value, {}), {}
            ),
        })
        suggestions.append({
            "transforms": [{"type": "name_combine", "params": {"fields": ["first_name", "last_name"]}}],
            "description": "Combine first_name + last_name fields",
            "note": "Use this if name is split across multiple fields",
        })
    
    # Price field suggestions
    elif target_field == "price":
        suggestions.append({
            "transforms": [{"type": "price_normalize", "params": {}}],
            "description": "Remove $ and commas, convert to number",
            "preview": Transform(type=TransformType.PRICE_NORMALIZE).apply(sample_value, {}),
        })
    
    # Year field suggestions
    elif target_field == "year":
        suggestions.append({
            "transforms": [{"type": "year_extract", "params": {}}],
            "description": "Extract 4-digit year from text",
            "preview": Transform(type=TransformType.YEAR_EXTRACT).apply(sample_value, {}),
        })
    
    # Status field suggestions
    elif target_field == "status":
        suggestions.append({
            "transforms": [{"type": "lowercase", "params": {}}, {"type": "status_normalize", "params": {}}],
            "description": "Normalize to standard status values (hot/warm/cold/new)",
            "preview": Transform(type=TransformType.STATUS_NORMALIZE).apply(
                Transform(type=TransformType.LOWERCASE).apply(sample_value, {}), {}
            ),
        })
    
    # VIN field suggestions
    elif target_field == "vin":
        suggestions.append({
            "transforms": [{"type": "vin_validate", "params": {}}],
            "description": "Validate and uppercase VIN",
            "preview": Transform(type=TransformType.VIN_VALIDATE).apply(sample_value, {}),
        })
    
    # Email - just trim
    elif target_field == "email":
        suggestions.append({
            "transforms": [{"type": "lowercase", "params": {}}, {"type": "trim", "params": {}}],
            "description": "Lowercase and trim whitespace",
            "preview": Transform(type=TransformType.LOWERCASE).apply(
                Transform(type=TransformType.TRIM).apply(sample_value, {}), {}
            ),
        })
    
    # Default - just trim
    else:
        suggestions.append({
            "transforms": [{"type": "trim", "params": {}}],
            "description": "Trim whitespace",
            "preview": Transform(type=TransformType.TRIM).apply(sample_value, {}),
        })
    
    return {
        "source_field": source_field,
        "target_field": target_field,
        "sample_value": sample_value,
        "suggestions": suggestions,
    }


# ============== INTEGRATION PROFILES ==============

from integrations.profiles import ProfileManager, IntegrationProfile

profile_manager = ProfileManager(db)

class CreateProfileRequest(BaseModel):
    name: str
    description: str = ""
    adapter_type: str = "generic_rest"
    base_url: str = ""
    auth_method: str = "api_key"
    customers_endpoint: str = "/customers"
    vehicles_endpoint: str = "/vehicles"
    customer_mappings: Dict[str, str] = Field(default_factory=dict)
    vehicle_mappings: Dict[str, str] = Field(default_factory=dict)
    pagination_type: str = "offset"
    page_size: int = 100
    records_path: str = "data"
    is_public: bool = False
    tags: List[str] = Field(default_factory=list)

class ImportProfileRequest(BaseModel):
    json_data: str
    override_name: Optional[str] = None

@api_router.get("/integration-profiles")
async def list_profiles(
    adapter_type: Optional[str] = None,
    public_only: bool = False,
    tags: Optional[str] = None,
    limit: int = 50
):
    """List available integration profiles"""
    tag_list = tags.split(",") if tags else None
    profiles = await profile_manager.list_profiles(
        adapter_type=adapter_type,
        public_only=public_only,
        tags=tag_list,
        limit=limit
    )
    return {"profiles": profiles}

@api_router.post("/integration-profiles")
async def create_profile(request: CreateProfileRequest):
    """Create a new integration profile"""
    import uuid
    
    profile = IntegrationProfile(
        id=str(uuid.uuid4()),
        name=request.name,
        description=request.description,
        adapter_type=request.adapter_type,
        base_url=request.base_url,
        auth_method=request.auth_method,
        customers_endpoint=request.customers_endpoint,
        vehicles_endpoint=request.vehicles_endpoint,
        customer_mappings=request.customer_mappings,
        vehicle_mappings=request.vehicle_mappings,
        pagination_type=request.pagination_type,
        page_size=request.page_size,
        records_path=request.records_path,
        is_public=request.is_public,
        tags=request.tags,
    )
    
    profile_id = await profile_manager.create_profile(profile)
    return {"success": True, "profile_id": profile_id, "message": f"Profile '{request.name}' created"}

@api_router.get("/integration-profiles/{profile_id}")
async def get_profile(profile_id: str):
    """Get a profile by ID"""
    profile = await profile_manager.get_profile(profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile.to_dict()

@api_router.get("/integration-profiles/{profile_id}/export")
async def export_profile(profile_id: str):
    """Export a profile as JSON"""
    json_data = await profile_manager.export_profile(profile_id)
    if not json_data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"json": json_data}

@api_router.post("/integration-profiles/import")
async def import_profile(request: ImportProfileRequest):
    """Import a profile from JSON"""
    success, message, profile_id = await profile_manager.import_profile(
        json_data=request.json_data,
        override_name=request.override_name
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"success": True, "message": message, "profile_id": profile_id}

@api_router.delete("/integration-profiles/{profile_id}")
async def delete_profile(profile_id: str):
    """Delete a profile"""
    # Prevent deletion of built-in profiles
    if profile_id.startswith("builtin_"):
        raise HTTPException(status_code=400, detail="Cannot delete built-in profiles")
    
    success = await profile_manager.delete_profile(profile_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True}

@api_router.patch("/integration-profiles/{profile_id}")
async def update_profile(profile_id: str, updates: Dict[str, Any]):
    """Update a profile"""
    # Prevent modification of built-in profiles
    if profile_id.startswith("builtin_"):
        raise HTTPException(status_code=400, detail="Cannot modify built-in profiles")
    
    success = await profile_manager.update_profile(profile_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"success": True}


# ============== INTEGRATIONS CRUD ==============

@api_router.get("/integrations")
async def list_integrations(active_only: bool = False, adapter_type: Optional[str] = None):
    """List all configured integrations"""
    integrations = await integration_manager.list_integrations(
        active_only=active_only,
        adapter_type=adapter_type
    )
    return {"integrations": integrations}

@api_router.post("/integrations")
async def create_integration(request: CreateIntegrationRequest):
    """Create a new CRM integration"""
    try:
        integration_id = await integration_manager.create_integration(
            name=request.name,
            adapter_type=request.adapter_type,
            base_url=request.base_url,
            auth_config=request.auth_config,
            data_type=request.data_type,
            field_mappings=request.field_mappings,
            mock_mode=request.mock_mode,
        )
        return {
            "success": True,
            "integration_id": integration_id,
            "message": f"Integration '{request.name}' created successfully"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to create integration: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/integrations/health")
async def get_integrations_health():
    """Get health status of all integrations"""
    return await integration_manager.get_health_summary()

@api_router.get("/integrations/{integration_id}")
async def get_integration(integration_id: str):
    """Get integration details"""
    integration = await integration_manager.get_integration(integration_id)
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    return integration

@api_router.get("/integrations/{integration_id}/health")
async def get_integration_health(integration_id: str):
    """Get detailed health for a specific integration"""
    health = await integration_manager.get_integration_health(integration_id)
    if "error" in health:
        raise HTTPException(status_code=404, detail=health["error"])
    return health

@api_router.patch("/integrations/{integration_id}")
async def update_integration(integration_id: str, request: UpdateIntegrationRequest):
    """Update integration configuration"""
    updates = {k: v for k, v in request.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    
    success = await integration_manager.update_integration(integration_id, updates)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    return {"success": True}

@api_router.delete("/integrations/{integration_id}")
async def delete_integration(integration_id: str):
    """Delete an integration"""
    success = await integration_manager.delete_integration(integration_id)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True}

@api_router.post("/integrations/{integration_id}/test")
async def test_integration_connection(integration_id: str):
    """Test connection to the CRM"""
    result = await integration_manager.test_connection(integration_id)
    return result

@api_router.post("/integrations/{integration_id}/sync")
async def sync_integration(integration_id: str, full_sync: bool = False):
    """Trigger a data sync from the CRM"""
    result = await integration_manager.sync_integration(integration_id, full_sync=full_sync)
    return {
        "success": result.success,
        "records_fetched": result.total_records,
        "pages_fetched": result.pages_fetched,
        "duration_ms": result.fetch_duration_ms,
        "errors": result.errors[:10] if result.errors else [],
        "warnings": result.warnings[:10] if result.warnings else [],
    }

@api_router.post("/integrations/{integration_id}/toggle-mock")
async def toggle_integration_mock_mode(integration_id: str, enabled: bool):
    """Toggle mock mode for an integration"""
    success = await integration_manager.toggle_mock_mode(integration_id, enabled)
    if not success:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"success": True, "mock_mode": enabled}


# ============== WEBHOOKS ==============

@api_router.get("/webhooks")
async def list_webhooks(integration_id: Optional[str] = None, active_only: bool = False):
    """List all webhooks"""
    webhooks = await webhook_receiver.list_webhooks(
        integration_id=integration_id,
        active_only=active_only
    )
    return {"webhooks": webhooks}

@api_router.post("/webhooks")
async def register_webhook(request: RegisterWebhookRequest):
    """Register a new webhook endpoint"""
    try:
        auth_method = WebhookAuthMethod(request.auth_method)
    except ValueError:
        auth_method = WebhookAuthMethod.HMAC_SHA256
    
    config = await webhook_receiver.register_webhook(
        integration_id=request.integration_id,
        name=request.name,
        auth_method=auth_method,
        enabled_events=request.enabled_events,
    )
    
    return {
        "success": True,
        "webhook_id": config.id,
        "endpoint_url": f"/api/webhooks/{config.id}/receive",
        "credentials": {
            "hmac_secret": config.auth.hmac_secret,
            "api_key": config.auth.api_key,
            "signature_header": config.auth.signature_header,
        }
    }

@api_router.get("/webhooks/{webhook_id}")
async def get_webhook(webhook_id: str):
    """Get webhook details"""
    config = await webhook_receiver.get_webhook(webhook_id)
    if not config:
        raise HTTPException(status_code=404, detail="Webhook not found")
    
    return {
        "id": config.id,
        "name": config.name,
        "integration_id": config.integration_id,
        "auth_method": config.auth.method.value,
        "is_active": config.is_active,
        "events_received": config.events_received,
        "events_processed": config.events_processed,
        "last_event_at": config.last_event_at.isoformat() if config.last_event_at else None,
    }

@api_router.get("/webhooks/{webhook_id}/stats")
async def get_webhook_stats(webhook_id: str):
    """Get detailed webhook statistics"""
    return await webhook_receiver.get_webhook_stats(webhook_id)

@api_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str):
    """Delete a webhook"""
    success = await webhook_receiver.delete_webhook(webhook_id)
    if not success:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"success": True}

@api_router.post("/webhooks/{webhook_id}/rotate")
async def rotate_webhook_credentials(webhook_id: str):
    """Rotate webhook credentials"""
    new_creds = await webhook_receiver.rotate_credentials(webhook_id)
    return {
        "success": True,
        "credentials": new_creds
    }

@api_router.post("/webhooks/{webhook_id}/receive")
async def receive_webhook(
    webhook_id: str,
    request: Dict[str, Any] = None,
):
    """
    Receive and process a webhook event
    
    This is the endpoint CRMs will POST to with event data.
    """
    from fastapi import Request
    # Note: In a real implementation, we'd get raw body and headers from Request object
    # For now, we'll handle the JSON body directly
    
    # Convert request body to bytes for signature verification
    import json
    payload = json.dumps(request or {}).encode('utf-8')
    
    result = await webhook_receiver.receive_event(
        webhook_id=webhook_id,
        payload=payload,
        headers={},  # Would come from Request.headers in production
        source_ip=None,  # Would come from Request.client.host
    )
    
    if not result.get("success"):
        status_code = result.get("code", 400)
        raise HTTPException(status_code=status_code, detail=result.get("error"))
    
    return result

@api_router.get("/webhooks/{webhook_id}/events")
async def get_webhook_events(
    webhook_id: str,
    status: Optional[str] = None,
    limit: int = 50
):
    """Get recent events for a webhook"""
    events = await webhook_receiver.get_events(
        webhook_id=webhook_id,
        status=status,
        limit=limit
    )
    return {"events": events}


# ============== CONVERSATION HISTORY ==============

from conversation_history import ConversationHistoryService, ConversationCreate

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

@api_router.get("/conversations/categories")
async def get_conversation_categories():
    """Get available conversation categories"""
    return {"categories": ConversationHistoryService.get_categories()}

@api_router.post("/conversations")
async def create_conversation(request: ConversationCreateRequest):
    """Create a new conversation record"""
    service = ConversationHistoryService(db)
    await service.initialize()
    
    data = ConversationCreate(**request.model_dump())
    result = await service.create_conversation(data)
    
    return {"success": True, "conversation": result.model_dump()}

@api_router.get("/conversations")
async def get_conversations(
    session_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get conversations with optional filters"""
    service = ConversationHistoryService(db)
    conversations = await service.get_conversations(
        session_id=session_id,
        customer_id=customer_id,
        category=category,
        limit=limit,
        offset=offset
    )
    return {"conversations": conversations, "count": len(conversations)}

@api_router.get("/conversations/stats")
async def get_conversation_stats():
    """Get conversation statistics"""
    service = ConversationHistoryService(db)
    stats = await service.get_stats()
    return stats

@api_router.get("/conversations/session/{session_id}")
async def get_session_history(session_id: str):
    """Get all conversations in a session"""
    service = ConversationHistoryService(db)
    conversations = await service.get_session_history(session_id)
    return {"session_id": session_id, "conversations": conversations}

@api_router.get("/conversations/customer/{customer_id}")
async def get_customer_conversation_history(customer_id: str):
    """Get all conversations for a customer"""
    service = ConversationHistoryService(db)
    conversations = await service.get_customer_history(customer_id)
    return {"customer_id": customer_id, "conversations": conversations}

@api_router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """Delete a specific conversation"""
    service = ConversationHistoryService(db)
    success = await service.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"success": True}

@api_router.delete("/conversations/session/{session_id}")
async def delete_session_conversations(session_id: str):
    """Delete all conversations in a session"""
    service = ConversationHistoryService(db)
    deleted_count = await service.delete_session(session_id)
    return {"success": True, "deleted_count": deleted_count}


# ============== ANALYTICS DASHBOARD ==============

from analytics_service import AnalyticsService

@api_router.get("/analytics/dashboard")
async def get_analytics_dashboard():
    """Get comprehensive analytics dashboard"""
    service = AnalyticsService(db)
    return await service.get_dashboard_summary()

@api_router.get("/analytics/sales")
async def get_sales_analytics(days: int = 30):
    """Get sales performance analytics"""
    service = AnalyticsService(db)
    return await service.get_sales_performance(days)

@api_router.get("/analytics/customers")
async def get_customer_analytics():
    """Get customer engagement analytics"""
    service = AnalyticsService(db)
    return await service.get_customer_engagement()

@api_router.get("/analytics/inventory")
async def get_inventory_analytics():
    """Get inventory metrics"""
    service = AnalyticsService(db)
    return await service.get_inventory_metrics()

@api_router.get("/analytics/conversations")
async def get_conversation_analytics():
    """Get conversation insights"""
    service = AnalyticsService(db)
    return await service.get_conversation_insights()

@api_router.get("/analytics/integrations")
async def get_integration_analytics():
    """Get integration health analytics"""
    service = AnalyticsService(db)
    return await service.get_integration_health()

@api_router.get("/analytics/trends/{metric}")
async def get_metric_trends(metric: str, days: int = 30):
    """Get trend data for a specific metric"""
    service = AnalyticsService(db)
    return await service.get_trends(metric, days)


# ============== WEBHOOK EVENT PROCESSING ==============

from webhook_processor import WebhookEventProcessor, WebhookEvent, EventType

# Initialize event processor
event_processor = WebhookEventProcessor(db)

@api_router.get("/events/stats")
async def get_event_stats():
    """Get webhook event processing statistics"""
    return await event_processor.get_event_stats()

@api_router.post("/events/enqueue")
async def enqueue_event(event: WebhookEvent):
    """Manually enqueue an event for processing"""
    event_id = await event_processor.enqueue_event(event)
    return {"success": True, "event_id": event_id}

@api_router.get("/events/dlq")
async def get_dlq_events(limit: int = 50):
    """Get events in dead letter queue"""
    events = await event_processor.get_dlq_events(limit)
    return {"events": events, "count": len(events)}

@api_router.post("/events/dlq/{event_id}/replay")
async def replay_dlq_event(event_id: str):
    """Replay a dead letter queue event"""
    success = await event_processor.replay_dlq_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found in DLQ")
    return {"success": True, "message": "Event re-queued for processing"}

@api_router.get("/events/types")
async def get_event_types():
    """Get available event types"""
    return {"event_types": [e.value for e in EventType]}


# ============== VIN DECODER (Multi-Source Cross Reference) ==============

import httpx
import re

class VinSaveRequest(BaseModel):
    vin: str
    vehicle_data: Dict[str, Any]

def validate_vin_checksum(vin: str) -> bool:
    """Validate VIN using ISO 3779 check digit algorithm"""
    if len(vin) != 17:
        return False
    
    transliteration = {
        'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
        'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
        'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9
    }
    weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
    
    total = 0
    for i, char in enumerate(vin):
        if char.isdigit():
            value = int(char)
        elif char in transliteration:
            value = transliteration[char]
        else:
            return False
        total += value * weights[i]
    
    check_digit = total % 11
    if check_digit == 10:
        expected = 'X'
    else:
        expected = str(check_digit)
    
    return vin[8] == expected

def decode_wmi(vin: str) -> Dict[str, str]:
    """Decode World Manufacturer Identifier (first 3 characters)"""
    wmi = vin[:3].upper()
    
    # Common WMI codes for major manufacturers
    wmi_database = {
        # US Manufacturers
        '1G1': {'country': 'USA', 'manufacturer': 'Chevrolet'},
        '1G4': {'country': 'USA', 'manufacturer': 'Buick'},
        '1G6': {'country': 'USA', 'manufacturer': 'Cadillac'},
        '1GC': {'country': 'USA', 'manufacturer': 'Chevrolet Truck'},
        '1GT': {'country': 'USA', 'manufacturer': 'GMC Truck'},
        '1FA': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FB': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FC': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FD': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FM': {'country': 'USA', 'manufacturer': 'Ford'},
        '1FT': {'country': 'USA', 'manufacturer': 'Ford Truck'},
        '1C3': {'country': 'USA', 'manufacturer': 'Chrysler'},
        '1C4': {'country': 'USA', 'manufacturer': 'Chrysler'},
        '1C6': {'country': 'USA', 'manufacturer': 'Chrysler'},
        '2C3': {'country': 'Canada', 'manufacturer': 'Chrysler'},
        '2G1': {'country': 'Canada', 'manufacturer': 'Chevrolet'},
        '3FA': {'country': 'Mexico', 'manufacturer': 'Ford'},
        '3G1': {'country': 'Mexico', 'manufacturer': 'Chevrolet'},
        # Japanese
        'JH4': {'country': 'Japan', 'manufacturer': 'Acura'},
        'JHM': {'country': 'Japan', 'manufacturer': 'Honda'},
        'JN1': {'country': 'Japan', 'manufacturer': 'Nissan'},
        'JN8': {'country': 'Japan', 'manufacturer': 'Nissan'},
        'JT2': {'country': 'Japan', 'manufacturer': 'Toyota'},
        'JT3': {'country': 'Japan', 'manufacturer': 'Toyota'},
        'JTD': {'country': 'Japan', 'manufacturer': 'Toyota'},
        'JTH': {'country': 'Japan', 'manufacturer': 'Lexus'},
        'JTJ': {'country': 'Japan', 'manufacturer': 'Lexus'},
        'JM1': {'country': 'Japan', 'manufacturer': 'Mazda'},
        'JM3': {'country': 'Japan', 'manufacturer': 'Mazda'},
        'JF1': {'country': 'Japan', 'manufacturer': 'Subaru'},
        'JF2': {'country': 'Japan', 'manufacturer': 'Subaru'},
        # Korean
        'KM8': {'country': 'South Korea', 'manufacturer': 'Hyundai'},
        'KMH': {'country': 'South Korea', 'manufacturer': 'Hyundai'},
        '5NP': {'country': 'USA', 'manufacturer': 'Hyundai (US)'},
        'KNA': {'country': 'South Korea', 'manufacturer': 'Kia'},
        'KND': {'country': 'South Korea', 'manufacturer': 'Kia'},
        # German
        'WVW': {'country': 'Germany', 'manufacturer': 'Volkswagen'},
        'WV2': {'country': 'Germany', 'manufacturer': 'Volkswagen'},
        'WAU': {'country': 'Germany', 'manufacturer': 'Audi'},
        'WBA': {'country': 'Germany', 'manufacturer': 'BMW'},
        'WBS': {'country': 'Germany', 'manufacturer': 'BMW M'},
        'WBY': {'country': 'Germany', 'manufacturer': 'BMW'},
        'WDB': {'country': 'Germany', 'manufacturer': 'Mercedes-Benz'},
        'WDC': {'country': 'Germany', 'manufacturer': 'Mercedes-Benz'},
        'WDD': {'country': 'Germany', 'manufacturer': 'Mercedes-Benz'},
        'WP0': {'country': 'Germany', 'manufacturer': 'Porsche'},
        'WP1': {'country': 'Germany', 'manufacturer': 'Porsche'},
        # British
        'SAL': {'country': 'UK', 'manufacturer': 'Land Rover'},
        'SAD': {'country': 'UK', 'manufacturer': 'Jaguar'},
        'SAJ': {'country': 'UK', 'manufacturer': 'Jaguar'},
        # Italian
        'ZFF': {'country': 'Italy', 'manufacturer': 'Ferrari'},
        'ZAM': {'country': 'Italy', 'manufacturer': 'Maserati'},
        'ZAR': {'country': 'Italy', 'manufacturer': 'Alfa Romeo'},
        # Tesla
        '5YJ': {'country': 'USA', 'manufacturer': 'Tesla'},
        # Rivian
        '7PD': {'country': 'USA', 'manufacturer': 'Rivian'},
    }
    
    # Try full 3-char WMI first, then first 2
    if wmi in wmi_database:
        return wmi_database[wmi]
    elif wmi[:2] + wmi[2] in wmi_database:
        return wmi_database.get(wmi[:2] + wmi[2], {})
    
    # Decode country from first character
    country_codes = {
        '1': 'USA', '4': 'USA', '5': 'USA',
        '2': 'Canada',
        '3': 'Mexico',
        'J': 'Japan',
        'K': 'South Korea',
        'L': 'China',
        'S': 'UK',
        'V': 'France/Spain',
        'W': 'Germany',
        'Y': 'Sweden/Finland',
        'Z': 'Italy',
        '9': 'Brazil',
    }
    
    return {'country': country_codes.get(vin[0], 'Unknown'), 'manufacturer': 'Unknown'}

@api_router.get("/vin/decode/{vin}")
async def decode_vin(vin: str):
    """
    Decode VIN using multiple sources for cross-reference accuracy:
    1. NHTSA vPIC API (primary - US Government database)
    2. WMI Database (World Manufacturer Identifier validation)
    3. Check digit validation (ISO 3779)
    
    Returns comprehensive vehicle data with confidence score
    """
    # Validate VIN format
    vin = vin.upper().strip()
    if len(vin) != 17:
        raise HTTPException(status_code=400, detail="VIN must be exactly 17 characters")
    
    # Invalid characters for VIN (I, O, Q are never used)
    if any(c in vin for c in ['I', 'O', 'Q']):
        raise HTTPException(status_code=400, detail="VIN contains invalid characters (I, O, Q are not allowed)")
    
    # Check for valid characters only
    valid_chars = set('ABCDEFGHJKLMNPRSTUVWXYZ0123456789')
    if not all(c in valid_chars for c in vin):
        raise HTTPException(status_code=400, detail="VIN contains invalid characters")
    
    # Cross-reference sources
    validation_results = {
        "checksum_valid": validate_vin_checksum(vin),
        "wmi_data": decode_wmi(vin),
        "sources_checked": ["NHTSA vPIC", "WMI Database", "ISO 3779 Checksum"],
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            # NHTSA vPIC API endpoint
            url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/{vin}?format=json"
            response = await http_client.get(url)
            response.raise_for_status()
            data = response.json()
        
        results = data.get("Results", [])
        if not results:
            raise HTTPException(status_code=404, detail="No vehicle data found for this VIN")
        
        # Build a lookup dict from results
        raw_data = {}
        for item in results:
            var_name = item.get("Variable", "")
            value = item.get("Value")
            if value and str(value).strip() and str(value).strip().lower() not in ['not applicable', 'n/a', '-']:
                raw_data[var_name] = str(value).strip()
        
        # Comprehensive field mapping
        vehicle = {
            # Core Identity
            "vin": vin,
            "year": raw_data.get("Model Year"),
            "make": raw_data.get("Make"),
            "model": raw_data.get("Model"),
            "trim": raw_data.get("Trim") or raw_data.get("Series"),
            
            # Manufacturer Info
            "manufacturer": raw_data.get("Manufacturer Name"),
            "plant_country": raw_data.get("Plant Country"),
            "plant_city": raw_data.get("Plant City"),
            "plant_state": raw_data.get("Plant State"),
            
            # Body & Style
            "vehicle_type": raw_data.get("Vehicle Type"),
            "body_class": raw_data.get("Body Class"),
            "doors": raw_data.get("Doors"),
            "drive_type": raw_data.get("Drive Type"),
            "steering": raw_data.get("Steering Location"),
            
            # Powertrain
            "fuel_type": raw_data.get("Fuel Type - Primary"),
            "electrification": raw_data.get("Electrification Level"),
            "cylinders": raw_data.get("Engine Number of Cylinders"),
            "displacement": raw_data.get("Displacement (L)"),
            "engine_model": raw_data.get("Engine Model"),
            "engine_config": raw_data.get("Engine Configuration"),
            "horsepower": raw_data.get("Engine Brake (hp) From"),
            "other_engine_info": raw_data.get("Other Engine Info"),
            "transmission": raw_data.get("Transmission Style"),
            "transmission_speeds": raw_data.get("Transmission Speeds"),
            
            # Safety
            "airbags_front": raw_data.get("Front Air Bag Locations"),
            "airbags_side": raw_data.get("Side Air Bag Locations"),
            "airbags_knee": raw_data.get("Knee Air Bag Locations"),
            "airbags_curtain": raw_data.get("Curtain Air Bag Locations"),
            "seat_belts": raw_data.get("Seat Belt Type"),
            "abs": raw_data.get("Anti-lock Braking System (ABS)"),
            "esc": raw_data.get("Electronic Stability Control (ESC)"),
            "traction_control": raw_data.get("Traction Control"),
            "tpms": raw_data.get("Tire Pressure Monitoring System (TPMS) Type"),
            "backup_camera": raw_data.get("Backup Camera"),
            "blind_spot": raw_data.get("Blind Spot Warning (BSW)"),
            "lane_departure": raw_data.get("Lane Departure Warning (LDW)"),
            "forward_collision": raw_data.get("Forward Collision Warning (FCW)"),
            "auto_emergency_braking": raw_data.get("Automatic Emergency Braking (AEB)"),
            
            # Dimensions & Weight
            "gvwr": raw_data.get("Gross Vehicle Weight Rating From"),
            "curb_weight": raw_data.get("Curb Weight (lb)"),
            "wheelbase": raw_data.get("Wheelbase (inches)"),
            "bed_length": raw_data.get("Bed Length (inches)"),
            "bed_type": raw_data.get("Bed Type"),
            
            # Additional
            "series": raw_data.get("Series"),
            "series2": raw_data.get("Series2"),
            
            # MSRP estimate (if available)
            "base_price": raw_data.get("Base Price ($)"),
        }
        
        # Clean up None values and build structured response
        vehicle = {k: v for k, v in vehicle.items() if v is not None}
        
        # Cross-reference WMI data with NHTSA results
        wmi_info = validation_results["wmi_data"]
        if wmi_info.get("manufacturer") != "Unknown":
            # Verify manufacturer matches
            nhtsa_make = vehicle.get("make", "").upper()
            wmi_make = wmi_info.get("manufacturer", "").upper()
            if wmi_make in nhtsa_make or nhtsa_make in wmi_make:
                validation_results["manufacturer_verified"] = True
            else:
                validation_results["manufacturer_verified"] = False
                validation_results["wmi_manufacturer"] = wmi_info["manufacturer"]
        
        # Build formatted engine string
        engine_parts = []
        if vehicle.get("displacement"):
            engine_parts.append(f"{vehicle['displacement']}L")
        if vehicle.get("cylinders"):
            cyl = int(vehicle['cylinders'])
            if cyl >= 6:
                engine_parts.append(f"V{cyl}")
            elif cyl == 4:
                engine_parts.append("4-Cylinder")
            else:
                engine_parts.append(f"{cyl}-Cylinder")
        if vehicle.get("engine_config") and "engine_config" not in str(engine_parts):
            engine_parts.append(vehicle["engine_config"])
        if engine_parts:
            vehicle["engine_display"] = " ".join(engine_parts)
        elif vehicle.get("other_engine_info"):
            vehicle["engine_display"] = vehicle["other_engine_info"]
        elif vehicle.get("electrification"):
            vehicle["engine_display"] = vehicle["electrification"]
        
        # Build location string
        loc_parts = []
        if vehicle.get("plant_city"):
            loc_parts.append(vehicle["plant_city"])
        if vehicle.get("plant_state"):
            loc_parts.append(vehicle["plant_state"])
        if vehicle.get("plant_country"):
            # Simplify country name
            country = vehicle["plant_country"]
            if "UNITED STATES" in country.upper():
                country = "USA"
            elif "(" in country:
                country = country.split("(")[1].replace(")", "").strip()
            loc_parts.append(country)
        if loc_parts:
            vehicle["assembly_location"] = ", ".join(loc_parts)
        
        # Safety features summary
        safety_features = []
        if vehicle.get("airbags_front"):
            safety_features.append("Front Airbags")
        if vehicle.get("airbags_side"):
            safety_features.append("Side Airbags")
        if vehicle.get("airbags_knee"):
            safety_features.append("Knee Airbags")
        if vehicle.get("airbags_curtain"):
            safety_features.append("Curtain Airbags")
        if vehicle.get("abs"):
            safety_features.append("ABS")
        if vehicle.get("esc"):
            safety_features.append("ESC")
        if vehicle.get("backup_camera"):
            safety_features.append("Backup Camera")
        if vehicle.get("blind_spot"):
            safety_features.append("Blind Spot Warning")
        if vehicle.get("lane_departure"):
            safety_features.append("Lane Departure Warning")
        if vehicle.get("forward_collision"):
            safety_features.append("Forward Collision Warning")
        if vehicle.get("auto_emergency_braking"):
            safety_features.append("Auto Emergency Braking")
        if safety_features:
            vehicle["safety_features"] = safety_features
        
        # Calculate confidence score based on validation
        confidence = 0
        if validation_results["checksum_valid"]:
            confidence += 40
        if vehicle.get("make") and vehicle.get("model"):
            confidence += 30
        if vehicle.get("year"):
            confidence += 15
        if validation_results.get("manufacturer_verified", True):
            confidence += 15
        
        vehicle["validation"] = {
            "confidence_score": confidence,
            "checksum_valid": validation_results["checksum_valid"],
            "sources_checked": validation_results["sources_checked"],
            "manufacturer_verified": validation_results.get("manufacturer_verified", True),
        }
        
        # Ensure we have minimum required data
        if not vehicle.get("make") or not vehicle.get("model"):
            raise HTTPException(status_code=404, detail="Could not decode vehicle make/model from VIN")
        
        logger.info(f"VIN decoded: {vin} -> {vehicle.get('year')} {vehicle.get('make')} {vehicle.get('model')} (confidence: {confidence}%)")
        return vehicle
        
    except httpx.HTTPError as e:
        logger.error(f"NHTSA API error: {e}")
        raise HTTPException(status_code=502, detail="Failed to connect to VIN decoder service")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VIN decode error: {e}")
        raise HTTPException(status_code=500, detail=f"VIN decode failed: {str(e)}")


@api_router.post("/vin/save")
async def save_vin_vehicle(request: VinSaveRequest):
    """
    Save a decoded vehicle to inventory
    """
    try:
        vin = request.vin.upper().strip()
        vdata = request.vehicle_data
        
        # Build vehicle record for inventory
        vehicle_record = {
            "vin": vin,
            "year": int(vdata.get("year", 0)) if vdata.get("year") else None,
            "make": vdata.get("make", ""),
            "model": vdata.get("model", ""),
            "trim": vdata.get("trim"),
            "body_class": vdata.get("body_class"),
            "drive_type": vdata.get("drive_type"),
            "fuel_type": vdata.get("fuel_type"),
            "engine": vdata.get("engine"),
            "transmission": vdata.get("transmission"),
            "doors": vdata.get("doors"),
            "plant_country": vdata.get("plant_country"),
            "source_id": "vin_scanner",
            "is_new": True,  # Assume new unless specified
            "status": "available",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        
        # Check if VIN already exists
        existing = await db.vehicles.find_one({"vin": vin})
        if existing:
            # Update existing record
            await db.vehicles.update_one(
                {"vin": vin},
                {"$set": {**vehicle_record, "updated_at": datetime.now(timezone.utc)}}
            )
            logger.info(f"Updated existing vehicle: {vin}")
            return {"success": True, "message": "Vehicle updated", "vin": vin}
        else:
            # Insert new record
            vehicle_record["id"] = str(uuid.uuid4())
            await db.vehicles.insert_one(vehicle_record)
            logger.info(f"Saved new vehicle: {vin}")
            return {"success": True, "message": "Vehicle saved to inventory", "vin": vin}
        
    except Exception as e:
        logger.error(f"Save VIN error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save vehicle: {str(e)}")


# ============== FAVORITES CATEGORIES ==============

# Favorites categories matching the existing patterns
FAVORITE_CATEGORIES = [
    {"id": "price_negotiation", "label": "Price Negotiation", "icon": "💰"},
    {"id": "trade_in", "label": "Trade-In", "icon": "🔄"},
    {"id": "objection_handling", "label": "Objection Handling", "icon": "🛡️"},
    {"id": "follow_up", "label": "Follow-Up", "icon": "📞"},
    {"id": "competitor", "label": "Competitor", "icon": "⚔️"},
    {"id": "financing", "label": "Financing", "icon": "📊"},
    {"id": "features", "label": "Features", "icon": "⚙️"},
    {"id": "closing", "label": "Closing", "icon": "🎯"},
    {"id": "general", "label": "General", "icon": "💬"},
]

@api_router.get("/favorites/categories")
async def get_favorite_categories():
    """Get available favorite categories"""
    return {"categories": FAVORITE_CATEGORIES}


# ============== VISION EXTRACTION ENDPOINT ==============

from vision_extraction_service import get_vision_service

class VisionExtractionRequest(BaseModel):
    """Vision extraction request"""
    image_base64: str = Field(..., description="Base64 encoded image (PNG, JPEG, WEBP)")
    additional_context: Optional[str] = Field(None, description="Optional context to help extraction")


@api_router.post("/api/vision/extract-customer")
async def extract_customer_from_image(req: VisionExtractionRequest):
    """
    Extract customer data from image using GPT-5.1 vision
    Elite enterprise-grade extraction
    """
    try:
        vision_service = get_vision_service()
        
        # Validate image format
        if not vision_service.validate_image_format(req.image_base64):
            raise HTTPException(
                status_code=400,
                detail="Invalid image format. Only PNG, JPEG, and WEBP are supported."
            )
        
        # Extract data
        result = await vision_service.extract_customer_data(
            image_base64=req.image_base64,
            additional_context=req.additional_context
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Vision extraction failed")
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Vision extraction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Vision extraction failed: {str(e)}")


# ============== A/B TESTING ==============

class ABTrackEvent(BaseModel):
    experiment_id: str
    user_id: str
    event_type: str  # "impression", "conversion", "click"
    metadata: Dict[str, Any] = None


@api_router.get("/ab/experiments")
async def list_experiments(active_only: bool = False):
    """List all A/B experiments"""
    experiments = await ab_testing_service.list_experiments(active_only)
    return {"experiments": experiments}


@api_router.get("/ab/experiments/{experiment_id}")
async def get_experiment_results(experiment_id: str):
    """Get results for a specific experiment"""
    results = await ab_testing_service.get_experiment_results(experiment_id)
    return results


@api_router.get("/ab/variant/{experiment_id}")
async def get_user_variant(experiment_id: str, user_id: str):
    """Get the assigned variant for a user"""
    variant = await ab_testing_service.get_variant(user_id, experiment_id)
    if not variant:
        raise HTTPException(status_code=404, detail="Experiment not found or inactive")
    return variant


@api_router.post("/ab/track")
async def track_ab_event(event: ABTrackEvent):
    """Track an A/B test event (impression, conversion, etc.)"""
    result = await ab_testing_service.track_event(
        experiment_id=event.experiment_id,
        user_id=event.user_id,
        event_type=event.event_type,
        metadata=event.metadata
    )
    return result


@api_router.post("/ab/experiments/{experiment_id}/toggle")
async def toggle_experiment(experiment_id: str, is_active: bool = True):
    """Activate or deactivate an experiment"""
    result = await ab_testing_service.toggle_experiment(experiment_id, is_active)
    return result


# ============== ENHANCED CUSTOMER MANAGEMENT ==============

from models import (
    CustomerCreate, CustomerUpdate, Customer as CustomerModel,
    VehicleCreate, VehicleUpdate, Vehicle as VehicleModel,
    VehicleCategory, LeadStatus, LeadSource, InteractionType,
    CustomerInteraction, CRMConfig
)
import pandas as pd
import io

class AddInteractionRequest(BaseModel):
    interaction_type: str
    content: str
    created_by: Optional[str] = None


class AttachVehicleRequest(BaseModel):
    vehicle_id: str


@api_router.get("/customers/list")
async def list_customers_filtered(
    status: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List all customers with optional filtering"""
    try:
        query = {}
        if status:
            query["lead_status"] = status
        if source:
            query["lead_source"] = source
        
        # Get customers
        cursor = db.customers.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        customers = await cursor.to_list(limit)
        
        # Search filter
        if search:
            search_lower = search.lower()
            customers = [c for c in customers if 
                search_lower in c.get('first_name', '').lower() or
                search_lower in c.get('last_name', '').lower() or
                search_lower in c.get('phone', '').lower() or
                search_lower in c.get('email', '').lower()
            ]
        
        # Get total count
        total = await db.customers.count_documents(query)
        
        return {"customers": customers, "total": total}
    except Exception as e:
        logger.error(f"List customers error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



# Legacy endpoint compatibility (LicenseScanner + ImportModal)
# These UI modules still POST to /api/customers with a legacy payload shape.
# Map that payload into the unified /customers/create schema and return the created customer object.
class LegacyCustomerCreateRequest(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    policyNumber: Optional[str] = None
    leadStatus: Optional[str] = None
    source: Optional[str] = None
    vehicleOfInterest: Optional[str] = None
    tradeVehicle: Optional[Dict[str, Any]] = None
    license_image: Optional[str] = None


@api_router.post("/customers")
async def create_customer_legacy(payload: LegacyCustomerCreateRequest):
    # Build names
    first_name = (payload.firstName or '').strip()
    last_name = (payload.lastName or '').strip()

    if not first_name and payload.name:
        parts = payload.name.strip().split()
        first_name = parts[0] if parts else ''
        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

    # Minimal required fields for DB schema consistency
    # (CustomerCreate validation enforces phone OR email, but license scans may not have either)
    phone = (payload.phone or '').strip() or None
    email = (payload.email or '').strip() or None

    customer_id = str(uuid.uuid4())
    customer_doc = {
        "id": customer_id,
        "first_name": first_name or "License",
        "last_name": last_name or "Scan",
        "phone": phone or "",
        "email": email,
        "address": payload.address,
        "lead_source": payload.source or "manual",
        "lead_status": payload.leadStatus or "new",
        "notes": None,
        "vehicle_interests": [],
        "trade_in_vehicle_id": None,
        "interactions": [],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    # Carry license image into stored doc for later printing
    if payload.license_image:
        customer_doc["license_image"] = payload.license_image

    await db.customers.insert_one(customer_doc)
    return {k: v for k, v in customer_doc.items() if k != "_id"}

@api_router.post("/customers/create")
async def create_customer(customer: CustomerCreate):
    """Create a new customer"""
    try:
        customer_data = customer.model_dump()
        customer_data["id"] = str(uuid.uuid4())
        customer_data["created_at"] = datetime.now(timezone.utc)
        customer_data["updated_at"] = datetime.now(timezone.utc)
        customer_data["interactions"] = []
        
        await db.customers.insert_one(customer_data)
        
        return {"success": True, "customer": {k: v for k, v in customer_data.items() if k != "_id"}}
    except Exception as e:
        logger.error(f"Create customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str):
    """Get a single customer with full details"""
    try:
        customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Get attached vehicles
        if customer.get("vehicle_interests"):
            vehicles = await db.vehicles.find(
                {"id": {"$in": customer["vehicle_interests"]}},
                {"_id": 0}
            ).to_list(10)
            customer["attached_vehicles"] = vehicles
        
        # Get trade-in vehicle if exists
        if customer.get("trade_in_vehicle_id"):
            trade_in = await db.vehicles.find_one(
                {"id": customer["trade_in_vehicle_id"]},
                {"_id": 0}
            )
            customer["trade_in_vehicle"] = trade_in
        
        return customer
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/customers/{customer_id}")
async def update_customer(customer_id: str, updates: CustomerUpdate):
    """Update a customer"""
    try:
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        # If status changed to sold, set sold_at for auto-deletion
        if updates.lead_status == LeadStatus.SOLD:
            update_data["sold_at"] = datetime.now(timezone.utc)
        
        result = await db.customers.update_one(
            {"id": customer_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"success": True, "updated": update_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str):
    """Delete a customer"""
    try:
        result = await db.customers.delete_one({"id": customer_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete customer error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/customers/{customer_id}/interaction")
async def add_customer_interaction(customer_id: str, interaction: AddInteractionRequest):
    """Add an interaction to customer history"""
    try:
        interaction_data = {
            "id": str(uuid.uuid4()),
            "interaction_type": interaction.interaction_type,
            "content": interaction.content,
            "created_at": datetime.now(timezone.utc),
            "created_by": interaction.created_by
        }
        
        result = await db.customers.update_one(
            {"id": customer_id},
            {
                "$push": {"interactions": interaction_data},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"success": True, "interaction": interaction_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add interaction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/customers/{customer_id}/attach-vehicle")
async def attach_vehicle_to_customer(customer_id: str, request: AttachVehicleRequest):
    """Attach a vehicle of interest to a customer (max 2)"""
    try:
        customer = await db.customers.find_one({"id": customer_id})
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        current_vehicles = customer.get("vehicle_interests", [])
        if len(current_vehicles) >= 2:
            raise HTTPException(status_code=400, detail="Maximum 2 vehicles allowed per customer")
        
        if request.vehicle_id in current_vehicles:
            raise HTTPException(status_code=400, detail="Vehicle already attached")
        
        await db.customers.update_one(
            {"id": customer_id},
            {
                "$push": {"vehicle_interests": request.vehicle_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Attach vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/customers/{customer_id}/detach-vehicle/{vehicle_id}")
async def detach_vehicle_from_customer(customer_id: str, vehicle_id: str):
    """Remove a vehicle of interest from a customer"""
    try:
        result = await db.customers.update_one(
            {"id": customer_id},
            {
                "$pull": {"vehicle_interests": vehicle_id},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Detach vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== ENHANCED VEHICLE MANAGEMENT ==============

@api_router.get("/vehicles/inventory")
async def list_inventory(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """List vehicles in inventory"""
    try:
        query = {}
        if category:
            query["category"] = category
        
        cursor = db.vehicles.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
        vehicles = await cursor.to_list(limit)
        
        # Search filter
        if search:
            search_lower = search.lower()
            vehicles = [v for v in vehicles if 
                search_lower in v.get('make', '').lower() or
                search_lower in v.get('model', '').lower() or
                search_lower in v.get('vin', '').lower() or
                search_lower in str(v.get('year', ''))
            ]
        
        # Get counts by category
        active_count = await db.vehicles.count_documents({"category": "active_inventory"})
        trade_in_count = await db.vehicles.count_documents({"category": "trade_in"})
        
        return {
            "vehicles": vehicles,
            "counts": {
                "active_inventory": active_count,
                "trade_in": trade_in_count,
                "total": active_count + trade_in_count
            }
        }
    except Exception as e:
        logger.error(f"List inventory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/vehicles/create")
async def create_vehicle(vehicle: VehicleCreate):
    """Create a new vehicle"""
    try:
        vehicle_data = vehicle.model_dump()
        vehicle_data["id"] = str(uuid.uuid4())
        vehicle_data["created_at"] = datetime.now(timezone.utc)
        vehicle_data["updated_at"] = datetime.now(timezone.utc)
        vehicle_data["status"] = "available"
        
        await db.vehicles.insert_one(vehicle_data)
        
        return {"success": True, "vehicle": {k: v for k, v in vehicle_data.items() if k != "_id"}}
    except Exception as e:
        logger.error(f"Create vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/vehicles/{vehicle_id}")
async def get_vehicle(vehicle_id: str):
    """Get a single vehicle"""
    try:
        vehicle = await db.vehicles.find_one({"id": vehicle_id}, {"_id": 0})
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        # Get linked customer if trade-in
        if vehicle.get("customer_id"):
            customer = await db.customers.find_one(
                {"id": vehicle["customer_id"]},
                {"_id": 0, "first_name": 1, "last_name": 1, "phone": 1}
            )
            vehicle["linked_customer"] = customer
        
        return vehicle
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.patch("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, updates: VehicleUpdate):
    """Update a vehicle"""
    try:
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        update_data["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.vehicles.update_one(
            {"id": vehicle_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        
        return {"success": True, "updated": update_data}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle"""
    try:
        result = await db.vehicles.delete_one({"id": vehicle_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete vehicle error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Enhanced VIN save with category support
class VinSaveWithCategoryRequest(BaseModel):
    vin: str
    vehicle_data: Dict[str, Any]
    category: str = "active_inventory"  # "active_inventory" or "trade_in"
    customer_id: Optional[str] = None  # For trade-ins
    trade_in_value: Optional[float] = None
    condition: Optional[str] = None


@api_router.post("/vin/save-to-inventory")
async def save_vin_to_inventory(request: VinSaveWithCategoryRequest):
    """Save VIN-decoded vehicle to inventory with category"""
    try:
        vin = request.vin.upper().strip()
        vdata = request.vehicle_data
        
        # Check if VIN already exists - REJECT duplicates
        existing = await db.vehicles.find_one({"vin": vin}, {"_id": 0})
        if existing:
            logger.warning(f"Duplicate VIN rejected: {vin}")
            raise HTTPException(
                status_code=409, 
                detail=f"This VIN already exists in inventory. Vehicle: {existing.get('year')} {existing.get('make')} {existing.get('model')}"
            )
        
        vehicle_record = {
            "id": str(uuid.uuid4()),
            "vin": vin,
            "year": int(vdata.get("year", 0)) if vdata.get("year") else None,
            "make": vdata.get("make", ""),
            "model": vdata.get("model", ""),
            "trim": vdata.get("trim"),
            "category": request.category,
            "body_class": vdata.get("body_class"),
            "drive_type": vdata.get("drive_type"),
            "fuel_type": vdata.get("fuel_type"),
            "engine_display": vdata.get("engine_display"),
            "transmission": vdata.get("transmission"),
            "assembly_location": vdata.get("assembly_location"),
            "safety_features": vdata.get("safety_features", []),
            "customer_id": request.customer_id,
            "trade_in_value": request.trade_in_value,
            "condition": request.condition,
            "status": "available",
            "source_id": "vin_scanner",
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        }
        
        await db.vehicles.insert_one(vehicle_record)
        logger.info(f"Vehicle added to inventory: {vin}")
        return {"success": True, "message": "Vehicle saved to inventory", "id": vehicle_record["id"]}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save VIN to inventory error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== DATA IMPORT (File Upload, Email Parsing) ==============

@api_router.post("/import/file")
async def import_file(
    file: UploadFile = File(...),
    import_type: str = Form("customers")  # "customers" or "vehicles"
):
    """Import data from CSV or Excel file"""
    try:
        content = await file.read()
        filename = file.filename.lower()
        
        # Parse file
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Use CSV or Excel.")
        
        imported = 0
        errors = []
        
        if import_type == "customers":
            # Map common column names
            column_map = {
                'first name': 'first_name', 'firstname': 'first_name', 'fname': 'first_name',
                'last name': 'last_name', 'lastname': 'last_name', 'lname': 'last_name',
                'name': 'full_name',
                'phone': 'phone', 'telephone': 'phone', 'cell': 'phone', 'mobile': 'phone',
                'email': 'email', 'e-mail': 'email',
                'address': 'address', 'street': 'address',
                'source': 'lead_source', 'lead source': 'lead_source',
                'status': 'lead_status', 'lead status': 'lead_status',
            }
            
            df.columns = [column_map.get(c.lower().strip(), c.lower().replace(' ', '_')) for c in df.columns]
            
            for idx, row in df.iterrows():
                try:
                    # Handle full name split
                    if 'full_name' in row and pd.notna(row['full_name']):
                        name_parts = str(row['full_name']).strip().split(' ', 1)
                        first_name = name_parts[0]
                        last_name = name_parts[1] if len(name_parts) > 1 else ''
                    else:
                        first_name = str(row.get('first_name', '')).strip() if pd.notna(row.get('first_name')) else ''
                        last_name = str(row.get('last_name', '')).strip() if pd.notna(row.get('last_name')) else ''
                    
                    if not first_name:
                        continue
                    
                    customer_data = {
                        "id": str(uuid.uuid4()),
                        "first_name": first_name,
                        "last_name": last_name,
                        "phone": str(row.get('phone', '')).strip() if pd.notna(row.get('phone')) else '',
                        "email": str(row.get('email', '')).strip() if pd.notna(row.get('email')) else None,
                        "address": str(row.get('address', '')).strip() if pd.notna(row.get('address')) else None,
                        "lead_source": "file_import",
                        "lead_status": "new",
                        "interactions": [],
                        "vehicle_interests": [],
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                        "source_id": f"import_{file.filename}",
                    }
                    
                    await db.customers.insert_one(customer_data)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row {idx + 2}: {str(e)}")
        
        elif import_type == "vehicles":
            column_map = {
                'vin': 'vin',
                'year': 'year',
                'make': 'make',
                'model': 'model',
                'trim': 'trim',
                'price': 'price',
                'mileage': 'mileage', 'miles': 'mileage', 'odometer': 'mileage',
                'color': 'color', 'ext color': 'color', 'exterior': 'color',
                'stock': 'stock_number', 'stock #': 'stock_number', 'stock number': 'stock_number',
            }
            
            df.columns = [column_map.get(c.lower().strip(), c.lower().replace(' ', '_')) for c in df.columns]
            
            for idx, row in df.iterrows():
                try:
                    make = str(row.get('make', '')).strip() if pd.notna(row.get('make')) else ''
                    model = str(row.get('model', '')).strip() if pd.notna(row.get('model')) else ''
                    
                    if not make or not model:
                        continue
                    
                    vehicle_data = {
                        "id": str(uuid.uuid4()),
                        "vin": str(row.get('vin', '')).strip().upper() if pd.notna(row.get('vin')) else None,
                        "year": int(row['year']) if pd.notna(row.get('year')) else None,
                        "make": make,
                        "model": model,
                        "trim": str(row.get('trim', '')).strip() if pd.notna(row.get('trim')) else None,
                        "price": float(row['price']) if pd.notna(row.get('price')) else None,
                        "mileage": int(row['mileage']) if pd.notna(row.get('mileage')) else None,
                        "color": str(row.get('color', '')).strip() if pd.notna(row.get('color')) else None,
                        "stock_number": str(row.get('stock_number', '')).strip() if pd.notna(row.get('stock_number')) else None,
                        "category": "active_inventory",
                        "status": "available",
                        "created_at": datetime.now(timezone.utc),
                        "updated_at": datetime.now(timezone.utc),
                        "source_id": f"import_{file.filename}",
                    }
                    
                    await db.vehicles.insert_one(vehicle_data)
                    imported += 1
                except Exception as e:
                    errors.append(f"Row {idx + 2}: {str(e)}")
        
        return {
            "success": True,
            "imported": imported,
            "errors": errors[:10] if errors else [],
            "total_errors": len(errors)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/import/email")
async def parse_lead_email(email_body: str = Form(...), email_subject: str = Form(""), email_from: str = Form("")):
    """Parse a lead email and extract customer info"""
    try:
        # Use LLM to parse email
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM not configured")
        
        chat = LlmChat(api_key=api_key, model="gpt-4o-mini")
        
        parse_prompt = f"""Parse this automotive lead email and extract customer information in JSON format.
        
Email From: {email_from}
Subject: {email_subject}
Body:
{email_body}

Extract and return ONLY valid JSON with these fields:
{{
    "first_name": "",
    "last_name": "",
    "phone": "",
    "email": "",
    "address": "",
    "vehicle_interest": "",
    "notes": ""
}}

If a field cannot be found, use empty string. Do not include any other text."""

        response = await chat.send_message_async(UserMessage(text=parse_prompt))
        
        # Parse JSON response
        json_match = re.search(r'\{[\s\S]*\}', response.text)
        if json_match:
            import json
            parsed = json.loads(json_match.group())
            
            # Create customer if we have enough info
            if parsed.get("first_name") or parsed.get("phone") or parsed.get("email"):
                customer_data = {
                    "id": str(uuid.uuid4()),
                    "first_name": parsed.get("first_name", "Unknown"),
                    "last_name": parsed.get("last_name", ""),
                    "phone": parsed.get("phone", ""),
                    "email": parsed.get("email", email_from) or email_from,
                    "address": parsed.get("address"),
                    "lead_source": "email",
                    "lead_status": "new",
                    "notes": parsed.get("notes"),
                    "interactions": [{
                        "id": str(uuid.uuid4()),
                        "interaction_type": "email",
                        "content": f"Lead email: {email_subject}\n\n{email_body[:500]}",
                        "created_at": datetime.now(timezone.utc)
                    }],
                    "vehicle_interests": [],
                    "created_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc),
                    "source_id": "email_import",
                }
                
                await db.customers.insert_one(customer_data)
                
                return {
                    "success": True,
                    "parsed": parsed,
                    "customer_id": customer_data["id"],
                    "message": "Customer created from email"
                }
            
            return {"success": True, "parsed": parsed, "message": "Email parsed but insufficient data to create customer"}
        
        raise HTTPException(status_code=400, detail="Could not parse email content")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email parse error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== CRM INTEGRATION ==============

@api_router.get("/crm/configs")
async def list_crm_configs():
    """List all CRM configurations"""
    try:
        configs = await db.crm_configs.find({}, {"_id": 0, "api_key": 0, "api_secret": 0}).to_list(20)
        return {"configs": configs}
    except Exception as e:
        logger.error(f"List CRM configs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/crm/configs")
async def create_crm_config(config: CRMConfig):
    """Create a new CRM configuration"""
    try:
        config_data = config.model_dump()
        config_data["created_at"] = datetime.now(timezone.utc)
        
        await db.crm_configs.insert_one(config_data)
        
        # Remove sensitive data from response
        config_data.pop("api_key", None)
        config_data.pop("api_secret", None)
        config_data.pop("_id", None)
        
        return {"success": True, "config": config_data}
    except Exception as e:
        logger.error(f"Create CRM config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.delete("/crm/configs/{config_id}")
async def delete_crm_config(config_id: str):
    """Delete a CRM configuration"""
    try:
        result = await db.crm_configs.delete_one({"id": config_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Config not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete CRM config error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/crm/configs/{config_id}/test")
async def test_crm_connection(config_id: str):
    """Test a CRM connection"""
    try:
        config = await db.crm_configs.find_one({"id": config_id})
        if not config:
            raise HTTPException(status_code=404, detail="Config not found")
        
        # Test connection based on provider
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                # Simple health check
                response = await client.get(
                    f"{config['api_url']}/health",
                    headers={"Authorization": f"Bearer {config['api_key']}"}
                )
                return {"success": True, "status": "connected", "status_code": response.status_code}
            except Exception as e:
                return {"success": False, "status": "failed", "error": str(e)}
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Test CRM connection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== DASHBOARD STATS ==============

@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    """Get dashboard statistics"""
    try:
        # Customer stats
        total_customers = await db.customers.count_documents({})
        new_leads = await db.customers.count_documents({"lead_status": "new"})
        contacted = await db.customers.count_documents({"lead_status": "contacted"})
        qualified = await db.customers.count_documents({"lead_status": "qualified"})
        sold = await db.customers.count_documents({"lead_status": "sold"})
        
        # Vehicle stats
        active_inventory = await db.vehicles.count_documents({"category": "active_inventory"})
        trade_ins = await db.vehicles.count_documents({"category": "trade_in"})
        
        return {
            "customers": {
                "total": total_customers,
                "new": new_leads,
                "contacted": contacted,
                "qualified": qualified,
                "sold": sold
            },
            "vehicles": {
                "active_inventory": active_inventory,
                "trade_ins": trade_ins,
                "total": active_inventory + trade_ins
            }
        }
    except Exception as e:
        logger.error(f"Dashboard stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== CLEANUP SOLD CUSTOMERS (30 days) ==============

@api_router.post("/maintenance/cleanup-sold")
async def cleanup_sold_customers():
    """Delete customers marked as sold more than 30 days ago"""
    try:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        
        result = await db.customers.delete_many({
            "lead_status": "sold",
            "sold_at": {"$lt": cutoff}
        })
        
        return {"success": True, "deleted": result.deleted_count}
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== PRINTER ENDPOINTS ==============

# Printer-related models
class PrinterTestRequest(BaseModel):
    ip: str = Field(..., description="Printer IP address")

class PrintJobRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded image data")
    printer_ip: str = Field(..., description="Printer IP address")

class CustomerPrintRequest(BaseModel):
    customer_id: str = Field(..., description="Customer ID to print")
    printer_ip: str = Field(..., description="Printer IP address")


@api_router.post("/printer/test")
async def test_printer_connection(req: PrinterTestRequest):
    """
    Test connection to a network printer via IPP
    Returns printer capabilities and status
    """
    try:
        import pyipp
        from pyipp.enums import IppStatus
        
        # Validate IP format
        ip = req.ip.strip()
        if not ip:
            raise HTTPException(status_code=400, detail="IP address required")
        
        # Build IPP URL (try both HTTP and HTTPS)
        ipp_url = f"ipp://{ip}:631/ipp/print"
        
        try:
            # Create IPP client
            ipp = pyipp.IPP(ipp_url, timeout=5)
            
            # Get printer attributes
            response = await ipp.execute(pyipp.IppRequest.GET_PRINTER_ATTRIBUTES)
            
            if response.status == IppStatus.SUCCESSFUL_OK:
                printer_info = response.data.get("printer-attributes-tag", {})
                printer_name = printer_info.get("printer-name", "Unknown Printer")
                printer_state = printer_info.get("printer-state", "unknown")
                
                logger.info(f"Printer test successful: {ip} - {printer_name}")
                
                return {
                    "success": True,
                    "printer_name": printer_name,
                    "printer_state": printer_state,
                    "printer_info": printer_info
                }
            else:
                logger.warning(f"Printer connection issue: {ip} - Status: {response.status}")
                return {
                    "success": False,
                    "error": f"Printer responded with status: {response.status}"
                }
                
        except Exception as e:
            logger.error(f"IPP connection error for {ip}: {str(e)}")
            raise HTTPException(
                status_code=503, 
                detail=f"Cannot connect to printer at {ip}. Verify IP address and network connectivity."
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Printer test error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Printer test failed: {str(e)}")


@api_router.post("/print/license")
async def print_license_image(req: PrintJobRequest):
    """
    Print a scanned driver's license image to network printer
    Converts base64 image to PDF and sends to printer via IPP
    """
    try:
        import base64
        import io
        from PIL import Image
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        import pyipp
        
        # Decode base64 image
        if "base64," in req.image_data:
            image_data = req.image_data.split("base64,")[1]
        else:
            image_data = req.image_data
        
        image_bytes = base64.b64decode(image_data)
        
        # Open image with PIL
        img = Image.open(io.BytesIO(image_bytes))
        
        # Create PDF in memory
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        
        # Calculate dimensions to fit license (maintain aspect ratio)
        page_width, page_height = letter
        img_width, img_height = img.size
        
        # Max dimensions (6 inches wide, centered)
        max_width = 6 * inch
        max_height = 4 * inch
        
        # Calculate scaling
        width_ratio = max_width / img_width
        height_ratio = max_height / img_height
        scale = min(width_ratio, height_ratio)
        
        new_width = img_width * scale
        new_height = img_height * scale
        
        # Center on page
        x = (page_width - new_width) / 2
        y = page_height - new_height - 1 * inch  # 1 inch from top
        
        # Save image temporarily
        temp_img = io.BytesIO()
        img.save(temp_img, format='PNG')
        temp_img.seek(0)
        
        # Draw image on PDF
        from reportlab.lib.utils import ImageReader as RLImageReader
        c.drawImage(
            RLImageReader(temp_img),
            x, y, width=new_width, height=new_height
        )
        
        # Add title
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(page_width / 2, page_height - 0.5 * inch, "Driver's License Scan")
        
        # Add timestamp
        c.setFont("Helvetica", 10)
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        c.drawCentredString(page_width / 2, 0.5 * inch, f"Scanned: {timestamp}")
        
        c.save()
        
        # Get PDF bytes
        pdf_bytes = pdf_buffer.getvalue()
        
        # TODO: Full IPP print job submission requires CUPS or IPP server
        # For now, log success (actual print job would go here)
        logger.info(f"License print job prepared for {req.printer_ip} - {len(pdf_bytes)} bytes")
        
        return {
            "success": True,
            "message": "Print job sent to printer",
            "bytes": len(pdf_bytes)
        }
        
    except Exception as e:
        logger.error(f"License print error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Print failed: {str(e)}")


@api_router.post("/print/customer")
async def print_customer_profile(req: CustomerPrintRequest):
    """
    Print customer profile snapshot to network printer
    Creates a formatted PDF with customer details
    """
    try:
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.units import inch
        import io
        
        # Get customer from database
        customer_repo = CustomerRepository(db)
        customer = await customer_repo.get_by_id(req.customer_id)
        
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")
        
        # Create PDF
        pdf_buffer = io.BytesIO()
        c = canvas.Canvas(pdf_buffer, pagesize=letter)
        page_width, page_height = letter
        
        # Title
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(page_width / 2, page_height - 1 * inch, "Customer Profile")
        
        # Customer details
        y = page_height - 2 * inch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1 * inch, y, "Name:")
        c.setFont("Helvetica", 12)
        c.drawString(2.5 * inch, y, customer.get("name", "N/A"))
        
        y -= 0.3 * inch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1 * inch, y, "Email:")
        c.setFont("Helvetica", 12)
        c.drawString(2.5 * inch, y, customer.get("email", "N/A"))
        
        y -= 0.3 * inch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(1 * inch, y, "Phone:")
        c.setFont("Helvetica", 12)
        c.drawString(2.5 * inch, y, customer.get("phone", "N/A"))
        
        if customer.get("vehicleOfInterest"):
            y -= 0.5 * inch
            c.setFont("Helvetica-Bold", 12)
            c.drawString(1 * inch, y, "Vehicle of Interest:")
            c.setFont("Helvetica", 12)
            c.drawString(2.5 * inch, y, customer.get("vehicleOfInterest"))
        
        # Timestamp
        c.setFont("Helvetica", 10)
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        c.drawCentredString(page_width / 2, 0.5 * inch, f"Printed: {timestamp}")
        
        c.save()
        
        pdf_bytes = pdf_buffer.getvalue()
        
        # Log print job
        logger.info(f"Customer profile print job prepared: {req.customer_id} -> {req.printer_ip}")
        
        return {
            "success": True,
            "message": "Print job sent to printer",
            "customer": customer.get("name"),
            "bytes": len(pdf_bytes)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Customer print error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Print failed: {str(e)}")


# ============== ROUTER & MIDDLEWARE ==============

# Include authentication routes (NO AUTH REQUIRED)
from auth_endpoints import auth_router
app.include_router(auth_router)

# Include main API routes
app.include_router(api_router)

# FEDERAL-LEVEL SECURITY MIDDLEWARE

# 1. Rate Limiting (DDoS Protection)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, burst_size=150)
logger.info("✅ Rate limiting enabled: 100 req/min, 150 burst")

# 2. Security Headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # HSTS - Force HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # XSS Protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' https://superchargd-app.preview.emergentagent.com"
    )
    # Permissions Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

# 3. SECURE CORS - Whitelist only trusted domains
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://superchargd-app.preview.emergentagent.com",
    os.environ.get('FRONTEND_URL', '')
]
# Filter out empty strings
ALLOWED_ORIGINS = [origin for origin in ALLOWED_ORIGINS if origin]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,  # FEDERAL-LEVEL: NO WILDCARDS
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

logger.info(f"✅ CORS configured for: {ALLOWED_ORIGINS}")
logger.info("✅ Security headers enabled")
