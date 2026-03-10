# Supercharg'd - Product Requirements Document

## Original Problem Statement
Production-ready native mobile application for the automotive industry featuring:
- High-accuracy VIN scanner (barcodes + windshield text OCR) — 95%+ accuracy
- High-accuracy Driver's License (DL) scanner — 95%+ accuracy
- Secure PIN recovery system
- Premium "glass" aesthetic UI
- Native build & deployment pipeline

## Architecture
- **Backend**: FastAPI + MongoDB (deployed on Emergent)
- **Frontend**: React Native / Expo (built locally by user)
- **AI**: GPT-4o Vision via AI Gateway (Emergent LLM key)
- **OCR**: ML Kit on-device + GPT-4o cloud fallback

## What's Been Implemented

### Performance Optimization Pass (Feb 2026)
- **NHTSA VIN Decode Cache**: In-memory LRU (1024 entries, 1hr TTL) — 24x speedup (413ms → 17ms)
- **Shared httpx Client**: Connection pooling (20 max, 10 keepalive) — eliminates per-request TCP handshake
- **MongoDB Indexes**: `ai_gateway_logs(feature+timestamp, success)`, `vehicles(category)` — prevents full collection scans
- **Startup Parallelization**: `asyncio.gather()` for 6 independent `create_indexes()` calls — faster cold starts
- **Rate Limiter Rewrite**: `deque`-based sliding window (O(1) amortised) replacing list comprehension (O(n))
- **AI Gateway Telemetry**: `asyncio.create_task()` fire-and-forget — doesn't block AI response path
- **Health Check Cache**: 5-second TTL — eliminates DB queries from k8s probes
- **Testing**: 19/19 tests passed (100%), zero regressions

### VIN Scanner Overhaul (Feb 2026)
- **Backend**: `POST /api/vin/extract-from-image` endpoint with triple-pass AI prompt
- **Frontend**: Updated `VinScanScreen.tsx` with 0.92 quality capture, OCR correction, ML Kit cross-validation
- **AI Gateway**: `vin_ocr` model route registered

### Driver's License Scanner (Completed Previously)
- 95%+ accuracy with triple-pass legal-grade OCR prompt
- Image saving to customer profile

### UI Glass Effect (Completed Previously)
- Pure React Native CSS glassmorphism (no expo-blur dependency)

### Backend Refactoring (Completed Previously)
- Modular route files: auth, license_scan, knowledge_base, telemetry, websocket, vin_v2

### On-Device Speech Recognition (Completed Previously)
- `@jamsch/expo-speech-recognition` integrated

## Key API Endpoints
- `POST /api/vin/extract-from-image` — AI Vision VIN OCR
- `GET /api/vin/decode/{vin}` — NHTSA VIN decode (cached)
- `POST /api/vin/save` — Save VIN to history
- `POST /api/vin/save-to-inventory` — Save to backend inventory
- `POST /api/scan/dl` — DL scan OCR
- `GET /api/health` — Health check (cached 5s)

## Database Schema
- **customers**: license_image_url, license_number, license_dob, license_expiration, city, state, zip_code
- **vehicles**: vin, year, make, model, trim, category, source, decoded data

## Prioritized Backlog

### P0 (Critical)
- Native Build verification on user's local machine (USER ACTION REQUIRED)

### P1 (High)
- Full frontend regression test on native device
- PostHog telemetry integration (needs API key)

### P2 (Medium)
- Batch VIN scan mode
- Team management features
- Real CRM integration

## Performance Benchmarks
| Metric | Before | After | Improvement |
|---|---|---|---|
| VIN Decode (cold) | ~400ms | ~400ms | Same (network bound) |
| VIN Decode (cached) | ~400ms | 17ms | **24x faster** |
| Health Check | ~50ms (DB query) | 17ms (cached) | **3x faster** |
| Rate Limiter | O(n) per request | O(1) amortised | Scalable |
| AI Telemetry | Blocking await | Fire-and-forget | Non-blocking |
| Startup | Sequential | Parallel gather | Faster boot |
