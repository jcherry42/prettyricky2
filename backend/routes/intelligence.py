"""Apex Intelligence Framework — HTTP route.

POST /api/intelligence/analyze
  Body: AutomotiveInteractionInput
  Query: performanceMode (bool) — locks to gpt-4o regardless of mode
  Returns: AutomotiveInteractionOutput
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from security.llm_rate_limit import enforce as enforce_llm_rate
from services.intelligence import analyze
from services.intelligence.schemas import (
    AutomotiveInteractionInput,
    AutomotiveInteractionOutput,
)

logger = logging.getLogger("intelligence_route")

router = APIRouter()


class AnalyzeRequest(BaseModel):
    """Wrapper for the analyze endpoint — allows performanceMode alongside the input."""
    input: AutomotiveInteractionInput = Field(..., description="The interaction to analyze")
    performanceMode: bool = Field(False, description="If true, always use gpt-4o regardless of mode")


@router.post("/intelligence/analyze", response_model=AutomotiveInteractionOutput)
async def analyze_interaction(
    request: Request,
    body: AnalyzeRequest,
) -> AutomotiveInteractionOutput:
    """Deterministic, non-hallucinating intent+response analysis.

    - Sales mode default: gpt-4o-mini (fast).
    - Service mode default: gpt-4o (higher stakes).
    - performanceMode=true: locks to gpt-4o for both.

    Rate limit: 20 req/min per authenticated user.
    """
    await enforce_llm_rate(request, "intelligence")
    try:
        out, latency = await analyze(body.input, high_performance=body.performanceMode)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Intelligence pipeline failed: {e}")
        raise HTTPException(status_code=502, detail=f"Analysis failed: {e}") from e

    # Fire-and-forget telemetry
    try:
        telemetry = getattr(request.app.state, "telemetry", None)
        if telemetry:
            asyncio.create_task(telemetry.track(
                "ai_usage",
                "intelligence_analyze",
                {
                    "mode": body.input.mode,
                    "channel": body.input.channel,
                    "primaryIntent": out.primaryIntent,
                    "conversationStage": out.conversationStage,
                    "objection_detected": out.objection.detected,
                    "sentiment": out.customerSentiment.label,
                    "risk_flags_count": len(out.riskFlags),
                    "missing_info_count": len(out.missingInformation),
                    "fallback_used": out.fallback_used,
                    "performance_mode": body.performanceMode,
                    "latency_ms": latency.get("total_ms"),
                },
            ))
    except Exception:
        pass

    return out
