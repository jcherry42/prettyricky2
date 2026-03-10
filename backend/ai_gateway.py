"""
AI Service Gateway — Supercharg'd
═══════════════════════════════════════════════════════════════════
Centralises every AI / LLM call behind a single facade that provides:

  • Intelligent model routing   (feature → primary model + fallback chain)
  • Async rate limiting         (global + per-feature semaphores)
  • Circuit breaker             (CLOSED → OPEN → HALF_OPEN → CLOSED)
  • In-memory response cache    (TTL-based, hash-keyed)
  • Automatic retry + fallback  (exponential back-off, model downgrade)
  • Cost & latency telemetry    (MongoDB-persisted, per-feature tags)

Every AI consumer calls `gateway.chat(...)` or `gateway.tts(...)`.
Zero direct LlmChat / OpenAITextToSpeech instantiation outside this module.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai import ImageContent, OpenAITextToSpeech

logger = logging.getLogger("ai_gateway")

# ═══════════════════════════════════════════════════════════════════
# MODEL ROUTING
# ═══════════════════════════════════════════════════════════════════

@dataclass(frozen=True)
class ModelRoute:
    provider: str
    primary: str
    fallback: Optional[str] = None


# Feature → model chain.  Add a row here to register a new AI feature.
MODEL_ROUTES: Dict[str, ModelRoute] = {
    "license_ocr":    ModelRoute(provider="openai", primary="gpt-4o",     fallback="gpt-4o-mini"),
    "vin_ocr":        ModelRoute(provider="openai", primary="gpt-4o",     fallback="gpt-4o-mini"),
    "tower_talk":     ModelRoute(provider="openai", primary="gpt-4o",     fallback="gpt-4o-mini"),
    "translate":      ModelRoute(provider="openai", primary="gpt-4o-mini", fallback="gpt-4o-mini"),
    "vehicle_vision": ModelRoute(provider="openai", primary="gpt-4o",     fallback="gpt-4o-mini"),
    "extraction":     ModelRoute(provider="openai", primary="gpt-4o",     fallback="gpt-4o-mini"),
    "tts":            ModelRoute(provider="openai", primary="tts-1-hd",   fallback="tts-1"),
}

# ═══════════════════════════════════════════════════════════════════
# RATE LIMITER  (asyncio.Semaphore per feature + global)
# ═══════════════════════════════════════════════════════════════════

RATE_LIMITS: Dict[str, int] = {
    "_global":         10,
    "license_ocr":      3,
    "vin_ocr":          3,
    "tower_talk":       3,
    "translate":        5,
    "vehicle_vision":   2,
    "extraction":       2,
    "tts":              3,
}


class _RateLimiter:
    """Dual-semaphore rate limiter: one global + one per-feature."""

    def __init__(self):
        self._global = asyncio.Semaphore(RATE_LIMITS["_global"])
        self._features: Dict[str, asyncio.Semaphore] = {}

    def _sem(self, feature: str) -> asyncio.Semaphore:
        if feature not in self._features:
            limit = RATE_LIMITS.get(feature, 3)
            self._features[feature] = asyncio.Semaphore(limit)
        return self._features[feature]

    async def __aenter__(self):
        raise RuntimeError("Use acquire(feature)")

    async def acquire(self, feature: str):
        await self._global.acquire()
        await self._sem(feature).acquire()

    def release(self, feature: str):
        self._sem(feature).release()
        self._global.release()


# ═══════════════════════════════════════════════════════════════════
# CIRCUIT BREAKER
# ═══════════════════════════════════════════════════════════════════

class _CBState(Enum):
    CLOSED    = "closed"
    OPEN      = "open"
    HALF_OPEN = "half_open"


class _CircuitBreaker:
    """
    Per-provider circuit breaker.
    CLOSED  → normal traffic
    OPEN    → fail-fast for `reset_timeout` seconds
    HALF_OPEN → allow 1 probe; success → CLOSED, failure → OPEN
    """

    FAILURE_THRESHOLD = 5
    RESET_TIMEOUT     = 30          # seconds
    HALF_OPEN_MAX     = 1

    def __init__(self):
        self._states: Dict[str, _CBState] = {}
        self._failures: Dict[str, int]    = {}
        self._opened_at: Dict[str, float] = {}
        self._half_open_inflight: Dict[str, int] = {}
        self._lock = asyncio.Lock()

    async def check(self, provider: str) -> bool:
        """Return True if call is allowed.  Raises if circuit is OPEN."""
        async with self._lock:
            state = self._states.get(provider, _CBState.CLOSED)

            if state == _CBState.CLOSED:
                return True

            if state == _CBState.OPEN:
                elapsed = time.monotonic() - self._opened_at.get(provider, 0)
                if elapsed >= self.RESET_TIMEOUT:
                    self._states[provider] = _CBState.HALF_OPEN
                    self._half_open_inflight[provider] = 0
                    logger.info(f"Circuit breaker [{provider}] OPEN → HALF_OPEN")
                    state = _CBState.HALF_OPEN
                else:
                    return False

            if state == _CBState.HALF_OPEN:
                if self._half_open_inflight.get(provider, 0) < self.HALF_OPEN_MAX:
                    self._half_open_inflight[provider] = self._half_open_inflight.get(provider, 0) + 1
                    return True
                return False

            return True

    async def record_success(self, provider: str):
        async with self._lock:
            state = self._states.get(provider, _CBState.CLOSED)
            if state == _CBState.HALF_OPEN:
                logger.info(f"Circuit breaker [{provider}] HALF_OPEN → CLOSED (probe succeeded)")
            self._states[provider] = _CBState.CLOSED
            self._failures[provider] = 0

    async def record_failure(self, provider: str):
        async with self._lock:
            state = self._states.get(provider, _CBState.CLOSED)
            if state == _CBState.HALF_OPEN:
                self._states[provider] = _CBState.OPEN
                self._opened_at[provider] = time.monotonic()
                logger.warning(f"Circuit breaker [{provider}] HALF_OPEN → OPEN (probe failed)")
                return

            count = self._failures.get(provider, 0) + 1
            self._failures[provider] = count
            if count >= self.FAILURE_THRESHOLD:
                self._states[provider] = _CBState.OPEN
                self._opened_at[provider] = time.monotonic()
                logger.warning(f"Circuit breaker [{provider}] CLOSED → OPEN ({count} failures)")

    def status(self) -> Dict[str, str]:
        return {p: s.value for p, s in self._states.items()} if self._states else {"openai": "closed"}


# ═══════════════════════════════════════════════════════════════════
# RESPONSE CACHE  (LRU + TTL, in-memory)
# ═══════════════════════════════════════════════════════════════════

# Default per-feature TTLs in seconds.  None = no caching.
CACHE_TTLS: Dict[str, Optional[int]] = {
    "translate":      3600,      # 1 hour — translations are deterministic
    "tower_talk":     None,
    "license_ocr":    None,
    "vehicle_vision": None,
    "extraction":     None,
    "tts":            None,      # TTS has its own MongoDB cache
}

_MAX_CACHE_ENTRIES = 512


class _ResponseCache:
    """Thread-safe TTL+LRU cache using OrderedDict."""

    def __init__(self, max_entries: int = _MAX_CACHE_ENTRIES):
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._max = max_entries
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    @staticmethod
    def _key(feature: str, prompt: str, model: str) -> str:
        raw = f"{feature}:{model}:{prompt}"
        return hashlib.sha256(raw.encode()).hexdigest()

    async def get(self, feature: str, prompt: str, model: str) -> Optional[str]:
        ttl = CACHE_TTLS.get(feature)
        if ttl is None:
            self._misses += 1
            return None

        key = self._key(feature, prompt, model)
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None
            ts, value = entry
            if (time.monotonic() - ts) > ttl:
                del self._store[key]
                self._misses += 1
                return None
            # Move to end (LRU refresh)
            self._store.move_to_end(key)
            self._hits += 1
            return value

    async def set(self, feature: str, prompt: str, model: str, value: str):
        ttl = CACHE_TTLS.get(feature)
        if ttl is None:
            return

        key = self._key(feature, prompt, model)
        async with self._lock:
            self._store[key] = (time.monotonic(), value)
            self._store.move_to_end(key)
            while len(self._store) > self._max:
                self._store.popitem(last=False)

    def stats(self) -> Dict[str, Any]:
        total = self._hits + self._misses
        return {
            "entries": len(self._store),
            "max_entries": self._max,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total, 3) if total > 0 else 0.0,
        }


# ═══════════════════════════════════════════════════════════════════
# COST / TELEMETRY TRACKER
# ═══════════════════════════════════════════════════════════════════

@dataclass
class _CallRecord:
    feature: str
    model: str
    provider: str
    latency_ms: float
    success: bool
    cached: bool
    fallback_used: bool
    timestamp: str
    error: Optional[str] = None


class _CostTracker:
    """In-memory ring buffer (last N calls) + MongoDB persistence."""

    MAX_MEMORY = 500

    def __init__(self):
        self._records: list[_CallRecord] = []
        self._db = None
        self._totals: Dict[str, Dict[str, Any]] = {}

    def set_db(self, db):
        self._db = db

    async def log(self, rec: _CallRecord):
        # In-memory ring
        self._records.append(rec)
        if len(self._records) > self.MAX_MEMORY:
            self._records = self._records[-self.MAX_MEMORY:]

        # Aggregate totals
        ft = rec.feature
        if ft not in self._totals:
            self._totals[ft] = {"calls": 0, "errors": 0, "cache_hits": 0, "fallbacks": 0, "total_latency_ms": 0.0}
        t = self._totals[ft]
        t["calls"] += 1
        if not rec.success:
            t["errors"] += 1
        if rec.cached:
            t["cache_hits"] += 1
        if rec.fallback_used:
            t["fallbacks"] += 1
        t["total_latency_ms"] += rec.latency_ms

        # Persist to MongoDB (fire-and-forget)
        if self._db is not None:
            try:
                await self._db.ai_gateway_logs.insert_one({
                    "feature": rec.feature,
                    "model": rec.model,
                    "provider": rec.provider,
                    "latency_ms": rec.latency_ms,
                    "success": rec.success,
                    "cached": rec.cached,
                    "fallback_used": rec.fallback_used,
                    "error": rec.error,
                    "timestamp": rec.timestamp,
                })
            except Exception as e:
                logger.debug(f"Failed to persist AI gateway log: {e}")

    def stats(self) -> Dict[str, Any]:
        result = {}
        for ft, t in self._totals.items():
            avg_latency = round(t["total_latency_ms"] / t["calls"], 1) if t["calls"] > 0 else 0
            result[ft] = {
                "calls": t["calls"],
                "errors": t["errors"],
                "cache_hits": t["cache_hits"],
                "fallbacks": t["fallbacks"],
                "avg_latency_ms": avg_latency,
                "error_rate": round(t["errors"] / t["calls"], 3) if t["calls"] > 0 else 0,
            }
        return result


# ═══════════════════════════════════════════════════════════════════
# AI GATEWAY  (singleton)
# ═══════════════════════════════════════════════════════════════════

class AIGateway:
    """
    The single point of entry for every AI / LLM / TTS call in the app.

    Usage:
        response = await gateway.chat('license_ocr', prompt, system_msg, images=[b64])
        audio    = await gateway.tts('tts', text, voice='nova')
    """

    MAX_RETRIES      = 2
    RETRY_BACKOFF_S  = 1.5

    def __init__(self):
        self._rate_limiter   = _RateLimiter()
        self._circuit_breaker = _CircuitBreaker()
        self._cache          = _ResponseCache()
        self._tracker        = _CostTracker()
        self._api_key: Optional[str] = None
        logger.info("AI Gateway initialised — all AI traffic routed through gateway")

    # ── Lifecycle ──────────────────────────────────────────────────

    def init(self, db=None):
        """Call once at app startup to inject DB and API key."""
        self._api_key = os.environ.get("EMERGENT_LLM_KEY")
        if db is not None:
            self._tracker.set_db(db)
        logger.info("AI Gateway ready (key=%s, db=%s)", "set" if self._api_key else "MISSING", "connected" if db is not None else "none")

    @property
    def _key(self) -> str:
        if not self._api_key:
            self._api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not self._api_key:
            raise RuntimeError("EMERGENT_LLM_KEY not set — AI Gateway cannot operate")
        return self._api_key

    # ── Chat / Completion ──────────────────────────────────────────

    async def chat(
        self,
        feature: str,
        prompt: str,
        system_message: str = "You are a helpful assistant.",
        images: Optional[List[str]] = None,
        cache_ttl: Optional[int] = None,
    ) -> str:
        """
        Send a chat completion request through the gateway.

        Args:
            feature:        Registered feature name (e.g. 'license_ocr')
            prompt:         User message text
            system_message: System prompt
            images:         Optional list of base64-encoded images
            cache_ttl:      Override default cache TTL (seconds) or None

        Returns:
            Model response text
        """
        route = MODEL_ROUTES.get(feature)
        if not route:
            raise ValueError(f"Unknown AI feature: '{feature}'. Register it in MODEL_ROUTES.")

        # Override cache TTL if explicitly provided
        original_ttl = CACHE_TTLS.get(feature)
        if cache_ttl is not None:
            CACHE_TTLS[feature] = cache_ttl

        # ── Cache check ───────────────────────────────────────────
        cached = await self._cache.get(feature, prompt, route.primary)
        if cached is not None:
            await self._tracker.log(_CallRecord(
                feature=feature, model=route.primary, provider=route.provider,
                latency_ms=0, success=True, cached=True, fallback_used=False,
                timestamp=datetime.now(timezone.utc).isoformat(),
            ))
            if cache_ttl is not None:
                CACHE_TTLS[feature] = original_ttl
            return cached

        # ── Execute with retry + fallback ─────────────────────────
        models_to_try = [route.primary]
        if route.fallback and route.fallback != route.primary:
            models_to_try.append(route.fallback)

        last_error = None
        fallback_used = False

        for model_idx, model in enumerate(models_to_try):
            if model_idx > 0:
                fallback_used = True
                logger.warning(f"[{feature}] Falling back from {models_to_try[0]} → {model}")

            for attempt in range(self.MAX_RETRIES + 1):
                # Circuit breaker
                allowed = await self._circuit_breaker.check(route.provider)
                if not allowed:
                    last_error = f"Circuit breaker OPEN for {route.provider}"
                    logger.warning(f"[{feature}] Circuit open — skipping {model} attempt {attempt}")
                    break

                # Rate limit
                await self._rate_limiter.acquire(feature)
                t0 = time.monotonic()

                try:
                    chat_obj = LlmChat(
                        api_key=self._key,
                        session_id=f"gw-{feature}-{uuid.uuid4().hex[:8]}",
                        system_message=system_message,
                    ).with_model(route.provider, model)

                    file_contents = []
                    if images:
                        for img_b64 in images:
                            file_contents.append(ImageContent(image_base64=img_b64))

                    user_msg = UserMessage(text=prompt, file_contents=file_contents if file_contents else [])
                    response = await chat_obj.send_message(user_msg)

                    latency = (time.monotonic() - t0) * 1000
                    self._rate_limiter.release(feature)

                    await self._circuit_breaker.record_success(route.provider)
                    await self._cache.set(feature, prompt, route.primary, response)
                    await self._tracker.log(_CallRecord(
                        feature=feature, model=model, provider=route.provider,
                        latency_ms=round(latency, 1), success=True, cached=False,
                        fallback_used=fallback_used,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                    ))

                    if cache_ttl is not None:
                        CACHE_TTLS[feature] = original_ttl
                    return response

                except Exception as e:
                    latency = (time.monotonic() - t0) * 1000
                    self._rate_limiter.release(feature)
                    await self._circuit_breaker.record_failure(route.provider)
                    last_error = str(e)

                    await self._tracker.log(_CallRecord(
                        feature=feature, model=model, provider=route.provider,
                        latency_ms=round(latency, 1), success=False, cached=False,
                        fallback_used=fallback_used,
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        error=last_error,
                    ))

                    logger.error(f"[{feature}] {model} attempt {attempt+1} failed ({latency:.0f}ms): {e}")

                    if attempt < self.MAX_RETRIES:
                        backoff = self.RETRY_BACKOFF_S * (2 ** attempt)
                        await asyncio.sleep(backoff)

        # Restore TTL override
        if cache_ttl is not None:
            CACHE_TTLS[feature] = original_ttl

        raise RuntimeError(f"AI Gateway [{feature}]: all attempts exhausted — {last_error}")

    # ── Text-to-Speech ─────────────────────────────────────────────

    async def tts(
        self,
        feature: str,
        text: str,
        voice: str = "nova",
        model: Optional[str] = None,
        speed: float = 1.0,
    ) -> str:
        """
        Generate speech audio via the gateway.
        Returns base64-encoded audio string.
        """
        route = MODEL_ROUTES.get(feature, MODEL_ROUTES["tts"])
        tts_model = model or route.primary

        models_to_try = [tts_model]
        if route.fallback and route.fallback != tts_model:
            models_to_try.append(route.fallback)

        last_error = None
        fallback_used = False

        for model_idx, m in enumerate(models_to_try):
            if model_idx > 0:
                fallback_used = True
                logger.warning(f"[{feature}] TTS falling back from {models_to_try[0]} → {m}")

            allowed = await self._circuit_breaker.check(route.provider)
            if not allowed:
                last_error = f"Circuit breaker OPEN for {route.provider}"
                continue

            await self._rate_limiter.acquire(feature)
            t0 = time.monotonic()

            try:
                tts_client = OpenAITextToSpeech(api_key=self._key)
                audio_base64 = await tts_client.generate_speech_base64(
                    text=text, model=m, voice=voice, speed=speed
                )

                latency = (time.monotonic() - t0) * 1000
                self._rate_limiter.release(feature)
                await self._circuit_breaker.record_success(route.provider)

                await self._tracker.log(_CallRecord(
                    feature=feature, model=m, provider=route.provider,
                    latency_ms=round(latency, 1), success=True, cached=False,
                    fallback_used=fallback_used,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                ))

                return audio_base64

            except Exception as e:
                latency = (time.monotonic() - t0) * 1000
                self._rate_limiter.release(feature)
                await self._circuit_breaker.record_failure(route.provider)
                last_error = str(e)

                await self._tracker.log(_CallRecord(
                    feature=feature, model=m, provider=route.provider,
                    latency_ms=round(latency, 1), success=False, cached=False,
                    fallback_used=fallback_used,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    error=last_error,
                ))

                logger.error(f"[{feature}] TTS {m} failed ({latency:.0f}ms): {e}")

        raise RuntimeError(f"AI Gateway [{feature}] TTS: all attempts exhausted — {last_error}")

    # ── Observability ──────────────────────────────────────────────

    def stats(self) -> Dict[str, Any]:
        return {
            "features": self._tracker.stats(),
            "cache": self._cache.stats(),
            "circuit_breakers": self._circuit_breaker.status(),
            "model_routes": {k: {"primary": v.primary, "fallback": v.fallback} for k, v in MODEL_ROUTES.items()},
        }


# ── Module-level singleton ─────────────────────────────────────────
gateway = AIGateway()
