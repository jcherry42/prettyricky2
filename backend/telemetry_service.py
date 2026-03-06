"""
Telemetry Service — Supercharg'd
═══════════════════════════════════════════════════════════════════
Comprehensive event tracking and analytics for the automotive sales platform.

Event Categories:
  • ai_usage      — Tower Talk, translations, TTS, voice-translate calls
  • user_actions   — copy, send SMS, save response, delete, edit
  • sales_flow     — customer journey: inquiry → appointment → follow-up → close
  • performance    — latency, errors, cache hits, circuit breaker trips
  • knowledge      — vector search queries, knowledge base usage

Storage: MongoDB (sc_telemetry collection)
Retention: 90-day TTL (configurable)

PostHog Integration Path:
  The service exposes a `.to_posthog_event()` method on every event,
  producing a dict compatible with PostHog's capture API.
  When ready to integrate:
    1. pip install posthog
    2. Set POSTHOG_API_KEY and POSTHOG_HOST in .env
    3. Uncomment the PostHog sink in _persist_event()
  See: https://posthog.com/docs/libraries/python
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("telemetry")

# ═══════════════════════════════════════════════════════════════════
# EVENT MODEL
# ═══════════════════════════════════════════════════════════════════

RETENTION_DAYS = 90


class TelemetryEvent:
    """Single telemetry event — lightweight, serializable."""

    __slots__ = ("event_id", "category", "action", "properties",
                 "session_id", "user_id", "timestamp")

    def __init__(
        self,
        category: str,
        action: str,
        properties: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        self.event_id = str(uuid.uuid4())
        self.category = category
        self.action = action
        self.properties = properties or {}
        self.session_id = session_id or "anonymous"
        self.user_id = user_id or "anonymous"
        self.timestamp = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "category": self.category,
            "action": self.action,
            "properties": self.properties,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "timestamp": self.timestamp,
            "expires_at": self.timestamp + timedelta(days=RETENTION_DAYS),
        }

    def to_posthog_event(self) -> Dict[str, Any]:
        """Convert to PostHog-compatible event format.
        See: https://posthog.com/docs/api/post-only-endpoints#single-event
        """
        return {
            "event": f"{self.category}.{self.action}",
            "distinct_id": self.user_id,
            "properties": {
                **self.properties,
                "category": self.category,
                "action": self.action,
                "session_id": self.session_id,
                "$lib": "superchargd-telemetry",
                "$lib_version": "1.0.0",
            },
            "timestamp": self.timestamp.isoformat(),
        }


# ═══════════════════════════════════════════════════════════════════
# TELEMETRY SERVICE
# ═══════════════════════════════════════════════════════════════════

class TelemetryService:
    """
    Centralized event tracking with MongoDB persistence.

    Usage:
        await telemetry.track('ai_usage', 'tower_talk_generate', {
            'inquiry_type': 'objection',
            'latency_ms': 1200,
            'customer_id': '...',
        })
    """

    COLLECTION = "sc_telemetry"
    AGGREGATES_COLLECTION = "sc_telemetry_aggregates"

    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._collection = db[self.COLLECTION]
        self._aggregates = db[self.AGGREGATES_COLLECTION]
        # In-memory counters for real-time dashboard
        self._counters: Dict[str, int] = defaultdict(int)
        self._hourly: Dict[str, Dict[str, int]] = {}  # hour_key → {action: count}
        # PostHog client (None until configured)
        self._posthog = None

    async def ensure_indexes(self):
        """Create TTL + query indexes."""
        await self._collection.create_index("expires_at", expireAfterSeconds=0)
        await self._collection.create_index("category")
        await self._collection.create_index("action")
        await self._collection.create_index("timestamp")
        await self._collection.create_index([("category", 1), ("action", 1), ("timestamp", -1)])
        await self._aggregates.create_index("period", unique=True)
        logger.info(f"Telemetry indexes ensured ({RETENTION_DAYS}-day TTL)")

    def _init_posthog(self):
        """Initialize PostHog client if credentials are available.
        To enable:
          1. pip install posthog
          2. Set POSTHOG_API_KEY and POSTHOG_HOST in backend/.env
        """
        api_key = os.environ.get("POSTHOG_API_KEY")
        host = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com")
        if api_key:
            try:
                import posthog
                posthog.project_api_key = api_key
                posthog.host = host
                self._posthog = posthog
                logger.info(f"PostHog telemetry sink enabled (host={host})")
            except ImportError:
                logger.info("PostHog package not installed — MongoDB-only telemetry")
        else:
            logger.info("POSTHOG_API_KEY not set — MongoDB-only telemetry")

    # ── Core Tracking ─────────────────────────────────────────────

    async def track(
        self,
        category: str,
        action: str,
        properties: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ):
        """Track a telemetry event (fire-and-forget safe)."""
        event = TelemetryEvent(
            category=category,
            action=action,
            properties=properties,
            session_id=session_id,
            user_id=user_id,
        )
        # Update in-memory counters
        key = f"{category}.{action}"
        self._counters[key] += 1

        # Update hourly buckets
        hour_key = event.timestamp.strftime("%Y-%m-%d-%H")
        if hour_key not in self._hourly:
            self._hourly[hour_key] = defaultdict(int)
        self._hourly[hour_key][key] += 1

        # Persist async (fire-and-forget)
        asyncio.create_task(self._persist_event(event))

    async def _persist_event(self, event: TelemetryEvent):
        """Persist event to MongoDB (and optionally PostHog)."""
        try:
            await self._collection.insert_one(event.to_dict())
        except Exception as e:
            logger.debug(f"Telemetry persist failed: {e}")

        # ── PostHog Sink (uncomment when ready) ──
        # if self._posthog:
        #     try:
        #         ph_event = event.to_posthog_event()
        #         self._posthog.capture(
        #             distinct_id=ph_event["distinct_id"],
        #             event=ph_event["event"],
        #             properties=ph_event["properties"],
        #             timestamp=event.timestamp,
        #         )
        #     except Exception as e:
        #         logger.debug(f"PostHog capture failed: {e}")

    # ── Query / Dashboard ────────────────────────────────────────

    async def get_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get telemetry summary for the last N hours."""
        since = datetime.now(timezone.utc) - timedelta(hours=hours)

        pipeline = [
            {"$match": {"timestamp": {"$gte": since}}},
            {
                "$facet": {
                    "total": [{"$count": "count"}],
                    "by_category": [
                        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}},
                    ],
                    "by_action": [
                        {"$group": {"_id": {"cat": "$category", "act": "$action"}, "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}},
                        {"$limit": 20},
                    ],
                    "hourly": [
                        {
                            "$group": {
                                "_id": {"$dateToString": {"format": "%Y-%m-%d %H:00", "date": "$timestamp"}},
                                "count": {"$sum": 1},
                            }
                        },
                        {"$sort": {"_id": 1}},
                    ],
                    "avg_latency": [
                        {"$match": {"properties.latency_ms": {"$exists": True}}},
                        {"$group": {"_id": "$action", "avg": {"$avg": "$properties.latency_ms"}, "count": {"$sum": 1}}},
                        {"$sort": {"avg": -1}},
                    ],
                }
            },
        ]

        result = await self._collection.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}

        total_list = data.get("total", [])
        total = total_list[0]["count"] if total_list else 0

        return {
            "period_hours": hours,
            "total_events": total,
            "by_category": {item["_id"]: item["count"] for item in data.get("by_category", [])},
            "top_actions": [
                {"category": item["_id"]["cat"], "action": item["_id"]["act"], "count": item["count"]}
                for item in data.get("by_action", [])
            ],
            "hourly_volume": data.get("hourly", []),
            "latency_by_action": [
                {"action": item["_id"], "avg_latency_ms": round(item["avg"], 1), "count": item["count"]}
                for item in data.get("avg_latency", [])
            ],
            "realtime_counters": dict(self._counters),
            "posthog_enabled": self._posthog is not None,
        }

    async def get_sales_funnel(self, days: int = 30) -> Dict[str, Any]:
        """Sales funnel analytics from telemetry events."""
        since = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"category": "sales_flow", "timestamp": {"$gte": since}}},
            {"$group": {"_id": "$action", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]

        results = await self._collection.aggregate(pipeline).to_list(20)
        funnel = {item["_id"]: item["count"] for item in results}

        return {
            "period_days": days,
            "inquiries": funnel.get("inquiry_generated", 0),
            "responses_sent": funnel.get("response_sent", 0),
            "appointments_set": funnel.get("appointment_set", 0),
            "follow_ups_sent": funnel.get("follow_up_sent", 0),
            "deals_closed": funnel.get("deal_closed", 0),
            "full_funnel": funnel,
        }

    async def get_ai_usage_breakdown(self, days: int = 7) -> Dict[str, Any]:
        """AI feature usage breakdown."""
        since = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"category": "ai_usage", "timestamp": {"$gte": since}}},
            {
                "$facet": {
                    "by_feature": [
                        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
                        {"$sort": {"count": -1}},
                    ],
                    "by_language": [
                        {"$match": {"properties.target_lang": {"$exists": True}}},
                        {"$group": {"_id": "$properties.target_lang", "count": {"$sum": 1}}},
                    ],
                    "voice_vs_text": [
                        {"$match": {"action": {"$in": ["translate", "voice_translate"]}}},
                        {"$group": {"_id": "$action", "count": {"$sum": 1}}},
                    ],
                }
            },
        ]

        result = await self._collection.aggregate(pipeline).to_list(1)
        data = result[0] if result else {}

        return {
            "period_days": days,
            "by_feature": {item["_id"]: item["count"] for item in data.get("by_feature", [])},
            "by_language": {item["_id"]: item["count"] for item in data.get("by_language", [])},
            "voice_vs_text": {item["_id"]: item["count"] for item in data.get("voice_vs_text", [])},
        }
