# Supercharg'd - Product Requirements Document

## Original Problem Statement
Production-ready native mobile application for the automotive industry featuring:
- High-accuracy VIN scanner (barcodes + windshield text OCR) — 95%+ accuracy
- High-accuracy Driver's License (DL) scanner — 95%+ accuracy
- Secure PIN recovery system
- Premium "glass" aesthetic UI
- Native build & deployment pipeline
- Deployment hardening & optimization

## Architecture
- **Backend**: FastAPI + MongoDB (deployed on Emergent) — v2.1.0
- **Frontend**: React Native / Expo (built locally by user)
- **AI**: GPT-4o Vision via AI Gateway (Emergent LLM key)
- **OCR**: ML Kit on-device + GPT-4o cloud fallback
- **Serialization**: ORJSONResponse (3-5x faster than stdlib json)

## What's Been Implemented

### Deployment Hardening v2.1.0 (Mar 2026)
- **ORJSONResponse**: Default response class for 3-5x faster JSON serialization
- **Readiness Probe**: `GET /api/ready` — checks `app.state.ready` + DB ping, returns 503 until fully initialized
- **Metrics Endpoint**: `GET /api/metrics` — uptime, process memory/CPU/threads, database stats, AI gateway stats
- **Diagnostics Endpoint**: `GET /api/diagnostics` — full self-test: DB ping, DB CRUD cycle, index verification, AI gateway health, NHTSA connectivity, filesystem write, memory check — all probes run in parallel with 10s timeout each
- **Security Headers Enhanced**: HSTS with `preload`, `Cache-Control: no-store`, `Pragma: no-cache`, `X-Response-Time` header
- **CORS Regex Fixed**: Double-escaped backslashes corrected for proper regex matching
- **Rate Limiter**: Health/ready/diagnostics probes and OPTIONS preflight exempt from rate limiting
- **JWT Security**: Auto-generates random key with warning if `JWT_SECRET_KEY` not set (no insecure default)
- **Database Indexes**: Compound indexes on vehicles (vin, category+created_at), customers (name, lead_status+created_at, id unique), auth (type unique)
- **MongoDB**: Enabled `retryWrites`, `retryReads`, `compressors` (zstd, snappy, zlib)
- **Upload Cleanup**: Background task prunes stale chunk upload sessions (>1hr) on startup
- **Structured Logging**: Consistent format, health probes excluded from request logs
- **Startup Time Tracking**: Boot time logged in ms (currently ~211ms)
- **Swagger/ReDoc/OpenAPI Disabled**: Docs endpoints disabled for production security
- **Correlation Middleware**: X-Correlation-ID + X-Response-Time on all responses
- **Version**: Bumped to 2.1.0

### Batch VIN Decode (Feb 2026)
- `POST /api/vin/decode-batch` — decode up to 50 VINs in a single call
- Parallel NHTSA lookups via `asyncio.gather` + shared connection pool
- Cached VINs resolve instantly; uncached hit NHTSA concurrently

### Performance Optimization Pass (Feb 2026)
- NHTSA VIN Decode Cache: 24x speedup (413ms → 17ms)
- Shared httpx Client with connection pooling
- Rate Limiter rewritten with deque sliding window O(1)
- Health Check 5-second cache

### VIN Scanner Overhaul (Feb 2026)
- `POST /api/vin/extract-from-image` — AI Vision VIN OCR (95%+ accuracy)

### Driver's License Scanner (Completed Previously)
- 95%+ accuracy with triple-pass OCR prompt

### UI Glass Effect (Completed Previously)
- Pure React Native CSS glassmorphism

## Key API Endpoints
- `GET /api/health` — Health check (cached 5s, version included)
- `GET /api/ready` — Readiness probe (DB ping) **NEW**
- `GET /api/metrics` — Operational metrics **NEW**
- `GET /api/diagnostics` — Full system self-test (7 parallel probes) **NEW**
- `POST /api/vin/decode-batch` — Batch decode up to 50 VINs
- `POST /api/vin/extract-from-image` — AI Vision VIN OCR
- `GET /api/vin/decode/{vin}` — Single VIN decode (cached)
- `POST /api/vin/save` / `POST /api/vin/save-to-inventory`
- `POST /api/license/scan-direct` — DL scan OCR
- `DELETE /api/customers/{customer_id}` — Delete customer
- `GET /api/ai/stats` — AI gateway observability

## Prioritized Backlog

### P0 (Critical)
- None — all critical features implemented and tested

### P1 (High)
- Full frontend regression test on native device
- PostHog telemetry integration (needs API key)

### P2 (Medium)
- Team management features
- Real CRM integration
- Replace `expo-av` with `expo-audio`/`expo-video` before Expo SDK 54

## Test Coverage
- **32 tests passing** (19 performance + 13 deployment hardening)
- Backend fully tested via testing agent — 100% pass rate
- Test files: `tests/test_performance_optimizations.py`, `tests/test_deployment_hardening.py`
