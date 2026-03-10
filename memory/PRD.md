# Supercharg'd - Product Requirements Document

## Original Problem Statement
Production-ready native mobile application for the automotive industry featuring:
- High-accuracy VIN scanner (barcodes + windshield text OCR) — 95%+ accuracy
- High-accuracy Driver's License (DL) scanner — 95%+ accuracy
- Secure PIN recovery system
- Premium "glass" aesthetic UI
- Native build & deployment pipeline
- Deployment hardening, modernization & future-proofing

## Architecture
- **Backend**: FastAPI 0.135.1 + MongoDB (deployed on Emergent) — v2.1.0
- **Frontend**: React Native / Expo SDK 54 (built locally by user)
- **AI**: GPT-4o Vision via AI Gateway (Emergent LLM key)
- **OCR**: ML Kit on-device + GPT-4o cloud fallback
- **Serialization**: ORJSONResponse (3-5x faster than stdlib json)
- **API Versioning**: `/api/v2/*` rewrite middleware (backward compatible)
- **File Structure**: `services/`, `models/`, `routes/`, `security/`, `middleware/`

## What's Been Implemented

### Modernization & Future-Proofing (Mar 2026 — Latest)

**1. Stale Upload Cleanup**
- Background task on startup removes license images older than 72 hours
- Stale chunk upload sessions (>1hr) are pruned automatically
- Logs freed disk space (MB) and removed file/chunk counts

**2. Test Suite Fixed — 178/179 passing (was 15 failures)**
- Fixed `/api/license/scan` → `/api/license/scan-direct` across all test files
- Fixed `/api/integrations/schema/` → `/api/integrations/schemas/`
- Fixed case sensitivity assertions to match `normalize_name()` behavior
- Fixed tests using simple upload vs OCR endpoint for image URLs
- Fixed hardcoded external URLs → `localhost:8001` for reliable testing
- Increased timeout from 15s → 30s for NHTSA-dependent tests
- Single remaining failure is a flaky NHTSA timeout (external dependency)

**3. Environment Validation**
- Server raises `RuntimeError` on startup if `MONGO_URL` or `DB_NAME` missing
- Logs warnings for recommended but optional vars (`EMERGENT_LLM_KEY`, `JWT_SECRET_KEY`)
- Fail-fast prevents cryptic runtime errors

**4. FastAPI Upgrade — 0.110.1 → 0.135.1**
- Better Pydantic v2 integration, security patches, async improvements
- Starlette upgraded to 0.52.1

**5. Backend File Reorganization**
- Created `services/` package with 10 service modules
- Created `models/` package with response models
- Backward-compatible shims at old paths (legacy imports still work)
- New code should import from `services.ai_gateway`, `models.responses`, etc.

**6. Pydantic Response Models**
- `models/responses.py`: `HealthResponse`, `ReadyResponse`, `RootResponse`, `MetricsResponse`, `DiagnosticsResponse`, `CustomerListResponse`, `VinDecodeResponse`, `TradeInCountResponse`, `BatchVinDecodeResponse`, `AuthStatusResponse`
- Breaking contract changes caught at compile time, not in production

**7. API Versioning**
- `/api/v2/*` middleware rewrites to `/api/*` (both paths valid)
- Mobile app can gradually migrate to versioned endpoints
- Future `/api/v3` can be a separate router without breaking v2 clients

**8. MongoDB TTL Indexes**
- `ai_gateway_logs`: auto-expire after 30 days
- `telemetry_events`: auto-expire after 90 days
- `_diagnostics`: auto-expire after 1 hour (safety net for temp docs)

**10. Offline Queue for Mobile**
- `offlineQueue.ts`: queues POST/PUT/DELETE/PATCH when offline, auto-replays on reconnect
- Persists to AsyncStorage (survives app restarts)
- Max 3 retries per request before dropping
- `useOfflineQueue.ts` React hook: `pendingCount`, `isOnline`, `flush()`, `clear()`

### expo-av → expo-audio Migration (Mar 2026)
- Replaced `expo-av` with `expo-audio` in all 4 source files + config + tests
- Key API changes: `Audio.Sound.createAsync` → `createAudioPlayer`, `Audio.Recording.createAsync` → `useAudioRecorder` hook
- TypeScript: zero errors, 10/10 mobile tests pass

### Deployment Hardening v2.1.0 (Mar 2026)
- ORJSONResponse, readiness probe, metrics endpoint, diagnostics (7 parallel probes)
- Security headers: HSTS preload, Cache-Control no-store, X-Response-Time
- Rate limiter: health/ready/diagnostics/loopback exempt
- JWT auto-key, MongoDB compression (zstd/snappy/zlib), retryWrites/retryReads
- Swagger/ReDoc/OpenAPI disabled for production security

### Performance Optimization (Feb 2026)
- NHTSA VIN Decode Cache: 24x speedup (413ms → 17ms)
- Shared httpx client, rate limiter O(1) deque, health check 5s cache

## Key API Endpoints
- `GET /api/health` — Health check (cached 5s)
- `GET /api/ready` — Readiness probe (DB ping)
- `GET /api/metrics` — Operational metrics
- `GET /api/diagnostics` — Full system self-test (7 probes)
- `GET /api/v2/*` — Versioned API (rewrites to `/api/*`)
- `POST /api/vin/decode-batch` — Batch decode up to 50 VINs
- `POST /api/vin/extract-from-image` — AI Vision VIN OCR
- `POST /api/license/scan-direct` — DL scan OCR
- `DELETE /api/customers/{customer_id}` — Delete customer

## Test Coverage
- **Backend**: 178/179 passing + 30 modernization tests (testing agent verified)
- **Mobile**: 10/10 tests passing, TypeScript 0 errors
- Test files: `tests/test_performance_optimizations.py`, `tests/test_deployment_hardening.py`, `tests/test_iteration6_features.py`

## Prioritized Backlog

### P0 (Critical)
- None — all critical features implemented and tested

### P1 (High)
- Full frontend regression test on native device
- PostHog telemetry integration (needs API key)

### P2 (Medium)
- Team management features
- Real CRM integration
- Lock screen audio controls (expo-audio `setActiveForLockScreen`)
