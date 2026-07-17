"""TTS & Voice Translation Routes.
Extracted from server.py — MongoDB-backed TTS cache replaces in-memory OrderedDict.

Performance-optimized pipeline:
  Translation target: <800ms (full voice pipeline)
  Key optimizations: Skip preprocessing for short audio, translation caching,
  fire-and-forget telemetry, connection reuse.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime, timezone
import os
import io
import hashlib
import logging
import time

logger = logging.getLogger(__name__)
router = APIRouter()

_db = None
_tts_collection = None
_translation_cache = None  # MongoDB collection for translation caching

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
    latency_ms: Optional[float] = None

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

# Skip expensive audio preprocessing for clips under this size (bytes)
# Short dealer-floor utterances don't benefit from FFT denoising
_PREPROCESS_THRESHOLD = 512 * 1024  # 512KB


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


# --- Translation Cache (MongoDB-backed) ---

async def _get_cached_translation(source_lang: str, target_lang: str, transcript: str) -> Optional[str]:
    if _translation_cache is None:
        return None
    key = hashlib.sha256(f"{source_lang}:{target_lang}:{transcript.strip().lower()}".encode()).hexdigest()
    doc = await _translation_cache.find_one({"key": key})
    if doc:
        logger.info(f"Translation cache HIT: {transcript[:50]}...")
        return doc["translated_text"]
    return None


async def _set_cached_translation(source_lang: str, target_lang: str, transcript: str, translated_text: str):
    if _translation_cache is None:
        return
    key = hashlib.sha256(f"{source_lang}:{target_lang}:{transcript.strip().lower()}".encode()).hexdigest()
    await _translation_cache.update_one(
        {"key": key},
        {"$set": {
            "key": key,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "transcript": transcript,
            "translated_text": translated_text,
            "created_at": datetime.now(timezone.utc),
        }},
        upsert=True
    )


# --- Init ---

def init_tts_voice_routes(db):
    global _db, _tts_collection, _translation_cache
    _db = db
    _tts_collection = db["tts_cache"]
    _translation_cache = db["translation_cache"]


async def ensure_tts_indexes():
    """Create TTL + unique indexes. Call during app startup."""
    if _tts_collection is not None:
        try:
            await _tts_collection.create_index("created_at", expireAfterSeconds=86400)
            await _tts_collection.create_index("cache_key", unique=True)
            logger.info("TTS cache indexes ensured (24h TTL)")
        except Exception as e:
            logger.warning(f"TTS index creation: {e}")
    if _translation_cache is not None:
        try:
            await _translation_cache.create_index("created_at", expireAfterSeconds=86400)
            await _translation_cache.create_index("key", unique=True)
            logger.info("Translation cache indexes ensured (24h TTL)")
        except Exception as e:
            logger.warning(f"Translation cache index creation: {e}")


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

        from services.ai_gateway import gateway as ai_gateway

        start_time = datetime.now(timezone.utc)
        audio_base64 = await ai_gateway.tts(
            feature='tts',
            text=text,
            voice=voice,
            model=request.model,
            speed=request.speed,
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
    """High-performance voice translation pipeline.

    Target: <800ms full pipeline (record → STT → translate → respond).

    Optimizations:
    - Skip audio preprocessing for short clips (<512KB)
    - MongoDB-backed translation cache (repeat phrases = instant)
    - Connection reuse for OpenAI clients
    - Fire-and-forget telemetry logging
    """
    t_start = time.monotonic()

    try:
        logger.info(f"Voice translate: {audio.filename}, {audio.content_type}, {source_lang} -> {target_lang}")

        audio_data = await audio.read()
        if len(audio_data) == 0:
            raise HTTPException(status_code=422, detail="Empty audio file received")
        if len(audio_data) > 25 * 1024 * 1024:
            raise HTTPException(status_code=422, detail="Audio file too large. Max 25 MB.")

        safe_name = _resolve_whisper_filename(audio.filename or '', audio.content_type or '')
        file_ext = safe_name.rsplit('.', 1)[-1].lower() if '.' in safe_name else 'm4a'
        logger.info(f"Audio size: {len(audio_data)} bytes, resolved: {safe_name}")

        # === CONDITIONAL AUDIO PREPROCESSING ===
        # Skip expensive FFT denoising for short clips — mobile mics are good enough
        if len(audio_data) > _PREPROCESS_THRESHOLD:
            try:
                from services.audio_pipeline import preprocess_audio
                processed_audio, processed_ext, stats = preprocess_audio(
                    audio_data, file_ext, enable_denoise=True
                )
                if stats.get("preprocessed"):
                    audio_data = processed_audio
                    safe_name = f"ptt_processed.{processed_ext}"
                    logger.info(f"Audio preprocessed: {stats}")
            except Exception as preproc_err:
                logger.warning(f"Audio preprocessing skipped: {preproc_err}")
        else:
            logger.info(f"Audio preprocessing skipped (size {len(audio_data)} < threshold {_PREPROCESS_THRESHOLD})")

        from emergentintegrations.llm.openai import OpenAISpeechToText

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

        # === WHISPER STT (with automotive prompt biasing) ===
        t_stt = time.monotonic()
        try:
            from services.audio_pipeline import AUTOMOTIVE_WHISPER_PROMPT
            response = await stt.transcribe(
                file=audio_file, model="whisper-1",
                language=whisper_lang, response_format="json",
                prompt=AUTOMOTIVE_WHISPER_PROMPT,
            )
            transcript = response.text.strip() if hasattr(response, 'text') else str(response).strip()
            stt_ms = (time.monotonic() - t_stt) * 1000
            logger.info(f"STT complete ({stt_ms:.0f}ms, {len(transcript)} chars): {transcript[:80]}...")
        except Exception as stt_error:
            stt_ms = (time.monotonic() - t_stt) * 1000
            logger.error(f"Whisper failed ({stt_ms:.0f}ms): {stt_error}", exc_info=True)
            return VoiceTranslateResponse(
                transcript="", translated_text="",
                source_lang=source_lang, target_lang=target_lang,
                success=False,
                error="Speech recognition failed. Please speak clearly and try again.",
                latency_ms=round((time.monotonic() - t_start) * 1000, 1),
            )

        if not transcript:
            return VoiceTranslateResponse(
                transcript="", translated_text="",
                source_lang=source_lang, target_lang=target_lang,
                success=False,
                error="No speech detected. Please speak louder or move closer to the microphone.",
                latency_ms=round((time.monotonic() - t_start) * 1000, 1),
            )

        if source_lang == target_lang:
            return VoiceTranslateResponse(
                transcript=transcript, translated_text=transcript,
                source_lang=source_lang, target_lang=target_lang, success=True,
                latency_ms=round((time.monotonic() - t_start) * 1000, 1),
            )

        # === TRANSLATION CACHE CHECK ===
        cached_translation = await _get_cached_translation(source_lang, target_lang, transcript)
        if cached_translation:
            total_ms = round((time.monotonic() - t_start) * 1000, 1)
            logger.info(f"Translation cache hit — total pipeline: {total_ms}ms")
            return VoiceTranslateResponse(
                transcript=transcript, translated_text=cached_translation,
                source_lang=source_lang, target_lang=target_lang, success=True,
                latency_ms=total_ms,
            )

        # === GPT-4o-mini TRANSLATION (fastest model) ===
        lang_names = {
            'en': 'English', 'es': 'Spanish', 'fr': 'French',
            'ko': 'Korean', 'ja': 'Japanese', 'de': 'German',
            'it': 'Italian', 'pt': 'Portuguese', 'zh': 'Chinese', 'ru': 'Russian'
        }
        source_name = lang_names.get(source_lang, 'English')
        target_name = lang_names.get(target_lang, 'Spanish')

        # Compact prompt — fewer tokens = faster response
        system_prompt = (
            f"Expert automotive translator. Translate {source_name} to {target_name}. "
            f"Preserve car terminology. Output ONLY the translation, nothing else."
        )

        from services.ai_gateway import gateway as ai_gateway

        t_translate = time.monotonic()
        translated_text = (await ai_gateway.chat(
            feature='translate',
            prompt=transcript,
            system_message=system_prompt,
            cache_ttl=3600,
        )).strip()
        translate_ms = (time.monotonic() - t_translate) * 1000
        logger.info(f"Translation complete ({translate_ms:.0f}ms): {translated_text[:80]}...")

        # Cache translation (fire-and-forget)
        import asyncio
        asyncio.create_task(_set_cached_translation(source_lang, target_lang, transcript, translated_text))

        total_ms = round((time.monotonic() - t_start) * 1000, 1)
        logger.info(f"Full pipeline: {total_ms}ms (STT: {stt_ms:.0f}ms, Translate: {translate_ms:.0f}ms)")

        return VoiceTranslateResponse(
            transcript=transcript, translated_text=translated_text,
            source_lang=source_lang, target_lang=target_lang, success=True,
            latency_ms=total_ms,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice translation error: {str(e)}", exc_info=True)
        return VoiceTranslateResponse(
            transcript="", translated_text="",
            source_lang=source_lang, target_lang=target_lang,
            success=False, error=f"Voice translation failed: {str(e)}",
            latency_ms=round((time.monotonic() - t_start) * 1000, 1),
        )
