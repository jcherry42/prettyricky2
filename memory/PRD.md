# Supercharg'd - Product Requirements Document

## Original Problem Statement
Production-ready native mobile application for the automotive industry featuring:
- High-accuracy VIN scanner (barcodes + windshield text OCR) — 95%+ accuracy
- High-accuracy Driver's License (DL) scanner — 95%+ accuracy
- Secure PIN recovery system
- Premium "glass" aesthetic UI
- Native build & deployment pipeline
- Performance benchmarks: Translation <800ms, VIN <500ms, License <700ms, API <300ms

## Architecture
- **Backend**: FastAPI 0.135.1 + MongoDB (deployed on Emergent) — v2.3.0
- **Frontend**: React Native / Expo SDK 54 (built locally by user)
- **AI**: GPT-4o Vision via AI Gateway (Emergent LLM key)
- **OCR**: ML Kit on-device + GPT-4o-mini cloud fallback (switched from GPT-4o for speed)
- **Translation**: GPT-4o-mini with MongoDB-backed translation cache
- **Serialization**: ORJSONResponse (3-5x faster than stdlib json)
- **API Versioning**: `/api/v2/*` rewrite middleware (backward compatible)
- **Auth**: JWT Bearer tokens enforced on all protected endpoints
- **File Structure**: `services/`, `models/`, `routes/`, `security/`, `middleware/`

## Performance Benchmarks (Mar 2026)

| Feature | Target | Measured | Status |
|---|---|---|---|
| API Roundtrip | <300ms | 95-234ms | PASS |
| VIN Decode (cold) | <500ms | 98-470ms | PASS |
| VIN Decode (cached) | <500ms | 100-133ms | PASS |
| Translation | <800ms | Optimized (pending real audio test) | OPTIMIZED |
| License Scan | <700ms | Optimized (pending real image test) | OPTIMIZED |

### Optimizations Applied
- **Translation pipeline**: Skip audio preprocessing for <512KB clips, MongoDB translation cache, compact prompt, fire-and-forget telemetry
- **License OCR**: GPT-4o → GPT-4o-mini (2-3x faster), image 2048→1536px, JPEG quality 92→80, prompt tokens reduced 60%
- **AI Gateway**: MAX_RETRIES 2→1, RETRY_BACKOFF 1.5s→0.5s for fast fail
- **Caching**: Translation cache (24h TTL), TTS cache (24h TTL), VIN decode NHTSA cache

## What's Been Implemented

### Performance & Security (Mar 2026 — Latest)

**JWT Authentication Enforcement (P0)**
- All protected endpoints require valid JWT Bearer token
- Public: `/auth/*`, `/health`, `/ready`, `/diagnostics`, `/metrics`, `/ai/stats`
- Mobile app auto-injects Bearer tokens via apiFetch

**AI-Powered Anomaly Detection (P2)**
- 4 checks: VIN reuse, high-frequency scans, checksum failures, make/model mismatches
- Endpoints: `POST /api/anomalies/scan`, `GET /api/anomalies`, `GET /api/anomalies/summary`
- 90-day TTL with dedup

**Error Response Standardization (P1)**
- License upload validation errors now return proper HTTPException (400/413)

**Stale Closure Fix (P1)**
- CustomerContext.tsx cache auto-persists via useEffect

**TypeScript Migration Progress**
- `noImplicitAny: true`, 75/75 files .ts/.tsx, new types for anomalies/WebSocket

**WebSocket Auth Enhancement**
- Optional JWT auth via `?token=<jwt>` query param

**Pandas Removed** — 100MB+ unused dependency

### Previous Implementations (summarized)
- Backend modernization (server.py 3,604 → ~560 lines)
- expo-av → expo-audio migration
- Offline queue + sync UI
- Premium glass UI aesthetic
- PIN recovery with master reset codes

## Test Coverage
- iteration_8: 25/25 performance optimization regression tests
- iteration_7: 37/37 auth enforcement tests
- iteration_6: 30/30 modernization tests

## Prioritized Backlog

### P0 (Critical) — None remaining

### P1 (High)
- PostHog telemetry integration (needs API key)
- Enable `strict: true` in tsconfig.json (incremental)
- Full native device regression test with real audio/image data

### P2 (Medium)
- Team management features
- Real CRM integration
- Lock screen audio controls
- WebSocket real-time anomaly alerts
- Structured logging with log aggregation
