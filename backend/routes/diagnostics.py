"""Diagnostics endpoint — full system self-test.

Runs isolated, non-destructive probes against every critical subsystem
and returns a per-component pass/fail report with latency measurements.

Every probe is wrapped in an individual try/except so a single failure
never blocks the rest of the report.  The overall status is "pass" only
when ALL probes succeed.
"""

from __future__ import annotations

import asyncio
import os
import time
import uuid
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)

# Injected at startup
_db = None
_ai_gateway = None
_uploads_dir: Optional[Path] = None


def init_diagnostics_routes(db, ai_gateway, uploads_dir: Path):
    global _db, _ai_gateway, _uploads_dir
    _db = db
    _ai_gateway = ai_gateway
    _uploads_dir = uploads_dir


# ── Individual probes ─────────────────────────────────────────────────

async def _probe_db_ping() -> Dict[str, Any]:
    """MongoDB connectivity — admin ping command."""
    t0 = time.monotonic()
    await _db.command("ping")
    ms = round((time.monotonic() - t0) * 1000, 1)
    return {"status": "pass", "latency_ms": ms}


async def _probe_db_write_read_delete() -> Dict[str, Any]:
    """MongoDB CRUD cycle — write, read-back, delete a temp document."""
    col = _db["_diagnostics"]
    doc_id = f"diag-{uuid.uuid4().hex[:8]}"
    t0 = time.monotonic()

    # Write
    await col.insert_one({"_diag_id": doc_id, "ts": time.time()})
    # Read-back
    found = await col.find_one({"_diag_id": doc_id}, {"_id": 0})
    if not found or found.get("_diag_id") != doc_id:
        return {"status": "fail", "error": "Read-back mismatch", "latency_ms": 0}
    # Delete
    await col.delete_one({"_diag_id": doc_id})

    ms = round((time.monotonic() - t0) * 1000, 1)
    return {"status": "pass", "latency_ms": ms}


async def _probe_db_indexes() -> Dict[str, Any]:
    """Verify critical indexes exist on key collections."""
    t0 = time.monotonic()
    missing = []

    for col_name, expected_key in [
        ("customers", "id_1"),
        ("customers", "lead_status_1_created_at_-1"),
        ("vehicles", "category_1"),
        ("auth", "type_1"),
    ]:
        indexes = await _db[col_name].index_information()
        if expected_key not in indexes:
            missing.append(f"{col_name}.{expected_key}")

    ms = round((time.monotonic() - t0) * 1000, 1)
    if missing:
        return {"status": "warn", "latency_ms": ms, "missing_indexes": missing}
    return {"status": "pass", "latency_ms": ms, "indexes_verified": 4}


async def _probe_ai_gateway() -> Dict[str, Any]:
    """AI Gateway — verify key is set and circuit breakers are healthy."""
    t0 = time.monotonic()
    key_set = bool(os.environ.get("EMERGENT_LLM_KEY"))
    stats = _ai_gateway.stats()
    cb = stats.get("circuit_breakers", {})

    open_circuits = [p for p, s in cb.items() if s != "closed"]
    cache_stats = stats.get("cache", {})

    ms = round((time.monotonic() - t0) * 1000, 1)

    result: Dict[str, Any] = {
        "status": "pass" if key_set and not open_circuits else "fail",
        "latency_ms": ms,
        "key_configured": key_set,
        "cache_entries": cache_stats.get("entries", 0),
        "cache_hit_rate": cache_stats.get("hit_rate", 0.0),
    }
    if open_circuits:
        result["open_circuits"] = open_circuits
    if not key_set:
        result["error"] = "EMERGENT_LLM_KEY not set"
    return result


async def _probe_nhtsa_connectivity() -> Dict[str, Any]:
    """NHTSA vPIC API — lightweight HEAD request to verify external connectivity."""
    import httpx
    t0 = time.monotonic()
    async with httpx.AsyncClient(timeout=5.0) as c:
        r = await c.head("https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/1?format=json")
    ms = round((time.monotonic() - t0) * 1000, 1)
    ok = 200 <= r.status_code < 500  # 4xx is fine — means API is reachable
    return {"status": "pass" if ok else "fail", "latency_ms": ms, "http_status": r.status_code}


async def _probe_filesystem() -> Dict[str, Any]:
    """File system — verify uploads directory is writable."""
    t0 = time.monotonic()
    test_file = _uploads_dir / f"_diag_{uuid.uuid4().hex[:6]}.tmp"
    test_file.write_text("diagnostics-probe")
    content = test_file.read_text()
    test_file.unlink()

    ms = round((time.monotonic() - t0) * 1000, 1)
    if content != "diagnostics-probe":
        return {"status": "fail", "error": "Write/read mismatch", "latency_ms": ms}
    return {"status": "pass", "latency_ms": ms}


async def _probe_memory() -> Dict[str, Any]:
    """Process memory — warn if RSS exceeds threshold."""
    import psutil
    t0 = time.monotonic()
    proc = psutil.Process()
    rss_mb = round(proc.memory_info().rss / (1024 * 1024), 1)
    ms = round((time.monotonic() - t0) * 1000, 1)

    status = "pass" if rss_mb < 512 else ("warn" if rss_mb < 1024 else "fail")
    return {"status": status, "latency_ms": ms, "rss_mb": rss_mb}


# ── Main diagnostics endpoint ────────────────────────────────────────

async def _run_probe(name: str, probe_fn) -> Dict[str, Any]:
    """Run a single probe with error isolation and timeout."""
    try:
        result = await asyncio.wait_for(probe_fn(), timeout=10.0)
        return {"name": name, **result}
    except asyncio.TimeoutError:
        return {"name": name, "status": "fail", "error": "Probe timed out (10s)", "latency_ms": 10000}
    except Exception as e:
        return {"name": name, "status": "fail", "error": str(e), "latency_ms": 0}


@router.get("/diagnostics")
async def run_diagnostics():
    """
    Full system self-test.  Runs all probes in parallel (each with a 10s timeout)
    and returns a component-level pass/fail report.

    Status codes:
      - pass: component is fully operational
      - warn: component works but something is suboptimal
      - fail: component is broken or unreachable
    """
    t0 = time.monotonic()

    probes = [
        ("db_ping", _probe_db_ping),
        ("db_crud_cycle", _probe_db_write_read_delete),
        ("db_indexes", _probe_db_indexes),
        ("ai_gateway", _probe_ai_gateway),
        ("nhtsa_api", _probe_nhtsa_connectivity),
        ("filesystem", _probe_filesystem),
        ("memory", _probe_memory),
    ]

    results = await asyncio.gather(*[_run_probe(name, fn) for name, fn in probes])

    total_ms = round((time.monotonic() - t0) * 1000, 1)

    failed = [r["name"] for r in results if r["status"] == "fail"]
    warned = [r["name"] for r in results if r["status"] == "warn"]
    passed = [r["name"] for r in results if r["status"] == "pass"]

    if failed:
        overall = "fail"
    elif warned:
        overall = "warn"
    else:
        overall = "pass"

    report = {
        "status": overall,
        "total_ms": total_ms,
        "summary": {
            "passed": len(passed),
            "warned": len(warned),
            "failed": len(failed),
            "total": len(results),
        },
        "probes": results,
    }

    if failed:
        report["failed_components"] = failed
    if warned:
        report["warned_components"] = warned

    logger.info(f"Diagnostics: {overall} ({len(passed)}P/{len(warned)}W/{len(failed)}F) in {total_ms}ms")
    return report
