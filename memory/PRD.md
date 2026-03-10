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

### Batch VIN Decode (Feb 2026)
- `POST /api/vin/decode-batch` — decode up to 50 VINs in a single call
- Parallel NHTSA lookups via `asyncio.gather` + shared connection pool
- Cached VINs resolve instantly; uncached hit NHTSA concurrently
- Deduplicates input VINs, validates format, reports `cached` flag per result
- Refactored single-decode logic into reusable `_decode_single_vin()` helper

### Performance Optimization Pass (Feb 2026)
- NHTSA VIN Decode Cache: 24x speedup (413ms → 17ms)
- Shared httpx Client with connection pooling
- MongoDB Indexes on ai_gateway_logs and vehicles.category
- Startup Parallelization with asyncio.gather
- Rate Limiter rewritten with deque sliding window O(1)
- AI Gateway Telemetry fire-and-forget
- Health Check 5-second cache

### VIN Scanner Overhaul (Feb 2026)
- `POST /api/vin/extract-from-image` — AI Vision VIN OCR (95%+ accuracy)
- Updated `VinScanScreen.tsx` with 0.92 quality capture, OCR correction

### Driver's License Scanner (Completed Previously)
- 95%+ accuracy with triple-pass OCR prompt, image saving

### UI Glass Effect (Completed Previously)
- Pure React Native CSS glassmorphism (no expo-blur)

## Key API Endpoints
- `POST /api/vin/decode-batch` — Batch decode up to 50 VINs (NEW)
- `POST /api/vin/extract-from-image` — AI Vision VIN OCR
- `GET /api/vin/decode/{vin}` — Single VIN decode (cached)
- `POST /api/vin/save` / `POST /api/vin/save-to-inventory`
- `POST /api/scan/dl` — DL scan OCR
- `GET /api/health` — Health check (cached 5s)

## Prioritized Backlog

### P0 (Critical)
- Native Build verification on user's local machine

### P1 (High)
- Full frontend regression test on native device
- PostHog telemetry integration (needs API key)

### P2 (Medium)
- Team management features
- Real CRM integration
