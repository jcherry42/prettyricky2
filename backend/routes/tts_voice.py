"""TTS & Voice Translation Routes.
Extracted from server.py — MongoDB-backed TTS cache replaces in-memory OrderedDict."""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
import os
import io
import uuid
import hashlib
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_tts_collection = None

# Optimal voice selection by language for natural, smooth speech
VOICE_BY_LANGUAGE = {
    'en': 'nova',
    'es': 'coral',
    'fr': 'shimmer',
    'ja': 'alloy',
    'ko': 'echo',
}

# --- Request/Response Models ---

class TTSRequest(BaseModel):
    text: str
    voice: str = "nova"
    model: str = "tts-1-hd"
    speed: float = 1.0
    language: str = "en"

class TTSResponse(BaseModel):
    audio_base64: str
    format: str = "mp3"
    voice_used: str
    cached: bool = False

class VoiceTranslateResponse(BaseModel):
    transcript: str
    translated_text: str
    source_lang: str
    target_lang: str
    success: bool
    error: Optional[str] = None

# Whisper filename resolution
_EXT_FROM_MIME: Dict[str, str] = {
    'audio/webm': 'webm', 'video/webm': 'webm',
    'audio/mp3': 'mp3', 'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a', 'audio/m4a': 'm4a', 'audio/x-m4a': 'm4a',
    'audio/aac': 'aac', 'audio/x-aac': 'aac',
    'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav',
    'audio/ogg': 'ogg', 'audio/flac': 'flac',
    'audio/x-caf': 'm4a',
    'audio/3gpp': 'mp4', 'audio/3gpp2': 'mp4',
}
_WHISPER_EXTS = {'flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm', 'aac'}


def _resolve_whisper_filename(original_name: str, content_type: str) -> str:
    ext = ''
    if original_name and '.' in original_name:
        ext = original_name.rsplit('.', 1)[-1].lower()
    if ext not in _WHISPER_EXTS:
        ext = _EXT_FROM_MIME.get(content_type, '')
    if ext not in _WHISPER_EXTS:
        ext = 'm4a'
    stem = original_name.rsplit('.', 1)[0] if original_name and '.' in original_name else 'ptt_audio'
    return f"{stem}.{ext}"


# --- MongoDB TTS Cache helpers ---

async def _get_cached_tts(cache_key: str) -> Optional[str]:
    if _tts_collection is None:
        return None
    doc = await _tts_collection.find_one({"cache_key": cache_key})
    return doc["audio_base64"] if doc else None


async def _set_cached_tts(cache_key: str, audio_base64: str):
    if _tts_collection is None:
        return
    await _tts_collection.update_one(
        {"cache_key": cache_key},
        {"$set": {
            "cache_key": cache_key,
            "audio_base64": audio_base64,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True
    )


# --- Init ---

def init_tts_voice_routes(db):
    global _db, _tts_collection
    _db = db
    _tts_collection = db["tts_cache"]


async def ensure_tts_indexes():
    """Create TTL + unique indexes. Call during app startup."""
    if _tts_collection is not None:
        try:
            await _tts_collection.create_index("created_at", expireAfterSeconds=86400)
            await _tts_collection.create_index("cache_key", unique=True)
            logger.info("TTS cache indexes ensured (24h TTL)")
        except Exception as e:
            logger.warning(f"TTS index creation: {e}")


# --- Endpoints ---

@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    """Enterprise-grade TTS with MongoDB-backed persistent cache."""
    try:
        text = request.text.strip()
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")
        if len(text) > 4096:
            raise HTTPException(status_code=400, detail="Text exceeds 4096 character limit")

        voice = request.voice
        if voice == "auto" or not voice:
            voice = VOICE_BY_LANGUAGE.get(request.language, 'nova')

        # Deterministic cache key
        raw_key = f"{voice}:{request.speed}:{text[:500]}"
        cache_key = hashlib.sha256(raw_key.encode()).hexdigest()

        # Check MongoDB cache first
        cached_audio = await _get_cached_tts(cache_key)
        if cached_audio:
            logger.info(f"TTS cache hit: {len(text)} chars, voice={voice}")
            return TTSResponse(audio_base64=cached_audio, format="mp3", voice_used=voice, cached=True)

        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        from emergentintegrations.llm.openai import OpenAITextToSpeech

        start_time = datetime.now(timezone.utc)
        tts = OpenAITextToSpeech(api_key=api_key)
        audio_base64 = await tts.generate_speech_base64(
            text=text, model=request.model, voice=voice, speed=request.speed
        )
        gen_time = (datetime.now(timezone.utc) - start_time).total_seconds()
        logger.info(f"TTS generated: {len(text)} chars, voice={voice}, time={gen_time:.2f}s")

        # Persist to MongoDB (TTL index auto-expires after 24h)
        await _set_cached_tts(cache_key, audio_base64)

        return TTSResponse(audio_base64=audio_base64, format="mp3", voice_used=voice, cached=False)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@router.post("/voice-translate", response_model=VoiceTranslateResponse)
async def voice_translate(
    audio: UploadFile = File(...),
    source_lang: str = Form(default="en"),
    target_lang: str = Form(default="es")
):
    """Enterprise Voice Translation: Whisper STT -> GPT-4o Translation."""
    try:
        logger.info(f"Voice translate: {audio.filename}, {audio.content_type}, {source_lang} -> {target_lang}")

        audio_data = await audio.read()
        if len(audio_data) == 0:
            raise HTTPException(status_code=422, detail="Empty audio file received")
        if len(audio_data) > 25 * 1024 * 1024:
            raise HTTPException(status_code=422, detail="Audio file too large. Max 25 MB.")

        safe_name = _resolve_whisper_filename(audio.filename or '', audio.content_type or '')
        logger.info(f"Audio size: {len(audio_data)} bytes, resolved: {safe_name}")

        from emergentintegrations.llm.openai import OpenAISpeechToText
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="API key not configured")

        stt = OpenAISpeechToText(api_key=api_key)
        whisper_lang_map = {
            'en': 'en', 'es': 'es', 'fr': 'fr', 'ko': 'ko',
            'ja': 'ja', 'de': 'de', 'it': 'it', 'pt': 'pt', 'zh': 'zh', 'ru': 'ru'
        }
        whisper_lang = whisper_lang_map.get(source_lang, None)

        audio_file = io.BytesIO(audio_data)
        audio_file.name = safe_name

        try:
            response = await stt.transcribe(
                file=audio_file, model="whisper-1",
                language=whisper_lang, response_format="json"
            )
            transcript = response.text.strip() if hasattr(response, 'text') else str(response).strip()
            logger.info(f"Transcription OK ({len(transcript)} chars): {transcript[:120]}...")
        except Exception as stt_error:
            logger.error(f"Whisper failed: {stt_error}", exc_info=True)
            return VoiceTranslateResponse(
                transcript="", translated_text="",
                source_lang=source_lang, target_lang=target_lang,
                success=False,
                error="Speech recognition failed. Please speak clearly and try again."
            )

        if not transcript:
            return VoiceTranslateResponse(
                transcript="", translated_text="",
                source_lang=source_lang, target_lang=target_lang,
                success=False,
                error="No speech detected. Please speak louder or move closer to the microphone."
            )

        if source_lang == target_lang:
            return VoiceTranslateResponse(
                transcript=transcript, translated_text=transcript,
                source_lang=source_lang, target_lang=target_lang, success=True
            )

        lang_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French',
            'ko': 'Korean', 'ja': 'Japanese', 'de': 'German',
            'it': 'Italian', 'pt': 'Portuguese', 'zh': 'Chinese', 'ru': 'Russian'
        }
        source_name = lang_names.get(source_lang, 'English')
        target_name = lang_names.get(target_lang, 'Spanish')

        system_prompt = (
            f"You are an expert automotive-industry translator fluent in {source_name} and {target_name}. "
            f"Translate the following {source_name} text into natural, idiomatic {target_name}. "
            f"Preserve automotive terminology accurately. "
            f"Output ONLY the translation."
        )

        chat = LlmChat(
            api_key=api_key,
            session_id=f"voice-translate-{uuid.uuid4()}",
            system_message=system_prompt,
        ).with_model("openai", "gpt-4o")

        translated_text = (await chat.send_message(UserMessage(text=transcript))).strip()
        logger.info(f"Translation OK: {translated_text[:120]}...")

        return VoiceTranslateResponse(
            transcript=transcript, translated_text=translated_text,
            source_lang=source_lang, target_lang=target_lang, success=True
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice translation error: {str(e)}", exc_info=True)
        return VoiceTranslateResponse(
            transcript="", translated_text="",
            source_lang=source_lang, target_lang=target_lang,
            success=False, error=f"Voice translation failed: {str(e)}"
        )
