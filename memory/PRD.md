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
- **Backend**: FastAPI 0.135.1 + MongoDB (deployed on Emergent) — v2.2.0
- **Frontend**: React Native / Expo SDK 54 (built locally by user)
- **AI**: GPT-4o Vision via AI Gateway (Emergent LLM key)
- **OCR**: ML Kit on-device + GPT-4o cloud fallback
- **Serialization**: ORJSONResponse (3-5x faster than stdlib json)
- **API Versioning**: `/api/v2/*` rewrite middleware (backward compatible)
- **Auth**: JWT Bearer tokens enforced on all protected endpoints
- **File Structure**: `services/`, `models/`, `routes/`, `security/`, `middleware/`

## What's Been Implemented

### Security Enforcement (Mar 2026 — Latest)

**1. JWT Authentication Enforcement (P0)**
- All protected endpoints now require valid JWT Bearer token
- Public endpoints: `/auth/*`, `/health`, `/ready`, `/diagnostics`, `/metrics`, `/ai/stats`, `/`
- Protected endpoints: all customer, vehicle, VIN, license, TTS, tower-talk, integration, telemetry, knowledge, anomaly routes
- API v2 versioned endpoints also enforce auth via middleware rewrite
- `middleware/auth_deps.py` rewritten with proper `verify_token` integration
- Mobile app already sends Bearer tokens via `apiFetch` in `api.ts`

**2. Error Response Standardization (P1)**
- License upload input validation errors (empty file, too large, wrong format) now return proper HTTPException (400/413) instead of HTTP 200 + `{success: false}`
- License scan-direct validation errors also converted to HTTPException
- Operation-result errors (OCR couldn't read, no speech detected) kept as HTTP 200 + `{success: false}` for backwards compatibility

**3. Stale Closure Fix in CustomerContext (P1)**
- Removed manual cache saves from `createCustomer` and `fetchCustomers`
- Added `useEffect` that auto-persists to cache whenever `customers` state changes
- Eliminated stale closure risk in rapid create scenarios
- Fixed unreachable code (double return) in fetchCustomers error handler

**4. AI-Powered Anomaly Detection (P2)**
- New service: `services/anomaly_detection.py`
- 4 detection checks: VIN reuse, high-frequency scans, checksum failures, make/model mismatches
- Endpoints: `POST /api/anomalies/scan`, `GET /api/anomalies`, `GET /api/anomalies/summary`, `POST /api/anomalies/{id}/resolve`
- Auto-expire anomalies after 90 days (TTL index)
- Dedup: same check+VIN won't create duplicate unresolved anomalies
- Protected by auth enforcement

**5. TypeScript Migration Progress (P2)**
- `noImplicitAny: true` enabled in tsconfig.json
- Added types for AnomalyDetection, WebSocket, and related models
- All 75 mobile source files are .ts/.tsx (migration from .js complete)

**6. Pandas Dependency Removed (P2)**
- Removed pandas (100MB+) from requirements.txt
- Data import uses built-in csv module + openpyxl for Excel
- Numpy kept (required for audio pipeline FFT/signal processing)

**7. WebSocket Auth Enhancement (P2)**
- WebSocket endpoint now supports optional auth via `?token=<jwt>` query param
- Connection manager tracks auth status per connection
- Anonymous connections still allowed for backwards compatibility

### Previous Implementations (summarized)
- Modernization & future-proofing (all 3 phases from audit)
- Backend reorganization: server.py 3,604 → ~560 lines
- MongoDB TTL indexes, TTS cache persistence, correlation tracing
- expo-av → expo-audio migration
- Offline queue + sync UI
- VIN/License scanner camera lifecycle improvements
- PIN recovery system with master reset codes
- Premium glass UI aesthetic

## Key API Endpoints
- `GET /api/health` — Health check (cached 5s, public)
- `GET /api/ready` — Readiness probe (public)
- `GET /api/metrics` — Operational metrics (public)
- `GET /api/diagnostics` — Full system self-test (public)
- `POST /api/auth/login` — PIN login (public)
- `POST /api/auth/setup-pin` — First-time PIN setup (public)
- `POST /api/auth/refresh` — Token refresh (public)
- `POST /api/anomalies/scan` — Run anomaly scan (auth required)
- `GET /api/anomalies/summary` — Anomaly dashboard (auth required)
- `GET /api/v2/*` — Versioned API (auth enforced)
- All customer, vehicle, VIN, license, TTS, integration endpoints (auth required)

## Test Coverage
- **Backend**: 37/37 auth enforcement tests (iteration 7), 30/30 modernization tests (iteration 6)
- **Mobile**: 10/10 tests passing, TypeScript 0 errors, 75/75 files .ts/.tsx
- Test files: `tests/test_auth_enforcement.py`, `tests/test_iteration6_features.py`

## Prioritized Backlog

### P0 (Critical)
- None — all critical features implemented and tested

### P1 (High)
- Full frontend regression test on native device
- PostHog telemetry integration (needs API key)
- Enable `strict: true` in tsconfig.json (incremental)

### P2 (Medium)
- Team management features
- Real CRM integration
- Lock screen audio controls (expo-audio `setActiveForLockScreen`)
- Full strict TypeScript migration (fix all `any` types)
- WebSocket real-time notifications for anomaly alerts
- Structured logging with log aggregation service
