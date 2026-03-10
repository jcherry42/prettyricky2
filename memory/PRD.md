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

### VIN Scanner Overhaul (Completed Feb 2026)
- **Backend**: `POST /api/vin/extract-from-image` endpoint with triple-pass AI prompt
  - GPT-4o Vision with automotive-grade VIN extraction prompt
  - ISO 3779 checksum validation on all detected VINs
  - Image optimization (JPEG resize to 2048px) for API latency
  - ML Kit text hint cross-validation support
  - Graceful handling of small/invalid images
- **Frontend**: Updated `VinScanScreen.tsx` with:
  - Capture quality bumped 0.65 → 0.92 for clearer OCR
  - Smart OCR character correction (I→1, O→0, Q→0)
  - `extractVinCandidates()` with strict/loose/sliding-window matching
  - ML Kit raw text passed as hint to cloud API
  - "POSITION VIN PLATE HERE" guide label in AI Vision mode
  - Blue-themed scan frame for AI Vision mode
- **AI Gateway**: `vin_ocr` model route registered (GPT-4o primary, GPT-4o-mini fallback)
- **Testing**: 13/13 backend tests passed (100%)

### Driver's License Scanner (Completed Previously)
- 95%+ accuracy with triple-pass legal-grade OCR prompt
- Image saving to customer profile
- High quality capture (0.92)

### UI Glass Effect (Completed Previously)
- Pure React Native CSS glassmorphism (no expo-blur dependency)
- Applied to Tab bar, Search bar, Customer cards, PIN keypad, Command Center tabs, etc.

### Backend Refactoring (Completed Previously)
- Modular route files: auth, license_scan, knowledge_base, telemetry, websocket, vin_v2
- 25/25 regression tests passed

### On-Device Speech Recognition (Completed Previously)
- `@jamsch/expo-speech-recognition` integrated

### Build Fortification (Completed Previously)
- metro.config.js added
- expo-blur removed (replaced with CSS glass)
- eas-cli installed

## Key API Endpoints
- `POST /api/vin/extract-from-image` — AI Vision VIN OCR (NEW)
- `GET /api/vin/decode/{vin}` — NHTSA VIN decode
- `POST /api/vin/save` — Save VIN to history
- `POST /api/vin/save-to-inventory` — Save to backend inventory
- `POST /api/scan/dl` — DL scan OCR

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

## 3rd Party Integrations
- GPT-4o Vision via Emergent LLM key (AI Gateway)
- @react-native-ml-kit/text-recognition
- @react-native-ml-kit/barcode-scanning
- @jamsch/expo-speech-recognition
- PostHog (placeholder)

## Key Files
- `/app/backend/routes/vin_v2.py` — VIN routes + OCR endpoint
- `/app/backend/ai_gateway.py` — AI Gateway with vin_ocr route
- `/app/frontend/VinScanScreen.tsx` — Updated VIN scan screen (copy to local project)
- `/app/backend/tests/test_vin_ocr_extract.py` — VIN OCR tests
