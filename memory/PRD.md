# Supercharg'd - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives. The application features AI-powered sales assistance with a TRUSTED AUTHORITY approach, and a highly stylized **Mercedes-Benz designo Interior Program** UI aesthetic inspired by the 1990s W140 S-Class.

## designo Interior Program UI Theme (January 30, 2026)

### Implemented with "Excruciating Artistic Detail"

#### Materials & Textures
1. **Nappa Leather**: Diamond-quilted pattern with contrast stitching dots
2. **Burr Walnut Wood**: Rich grain bezels with depth and swirl patterns
3. **Bird's-Eye Maple**: Light honey wood with distinctive eye patterns
4. **Brushed Aluminum**: Fine horizontal brushing on header rails
5. **Chrome Accents**: High-polish bezel borders

#### 64-Color Ambient Lighting System
- Background effect with radial gradients, 30-second cycle through 64 colors
- 3 intensity levels, toggle in Settings, persisted

### Typography
- Command Center tabs: 50% larger (15px)
- Search bar: 20% smaller (11px)
- Generated Responses: 1.3rem (75% larger from base)

### Translation System
- Uses settings language (Spanish/French/Korean)
- Sport mode only with auto-translate

---

## What's Been Completed

### February 9, 2026 - On-Device STT & Backend Refactoring
1. **On-Device Speech Recognition** — Implemented real native STT using `@jamsch/expo-speech-recognition`
   - Wraps iOS SFSpeechRecognizer / Android SpeechRecognizer
   - Automotive vocabulary hints for better recognition (VIN, MSRP, APR, etc.)
   - Falls back to Web Speech API on web platform
   - Promise-based API with timeout and graceful error handling
   - Added plugin config + iOS speech recognition permission to `app.json`
2. **Major Backend Refactoring** — server.py reduced from 1238 → 340 lines (73% reduction)
   - Extracted license scanning endpoints → `routes/license.py` (574 lines)
   - Extracted WebSocket manager → `routes/websocket.py` (118 lines)
   - Extracted knowledge base → `routes/knowledge.py` (36 lines)
   - Extracted telemetry → `routes/telemetry.py` (40 lines)
   - All 19 endpoint groups verified via regression test (100% pass rate)

### Previous Sessions (Jan 30 - Feb 2026)
- PIN Recovery Protocol (3-tier: PIN → Master Code → Factory Wipe)
- Intake Hub UX Overhaul (swipe-dismiss, auto-refresh, source badges)
- Print Feature Hardening (10 bugs fixed)
- VIN/DL Scanner Native Fixes (ML Kit safe imports, rescan button)
- Build System Configuration (EAS profiles, deployment targets)
- UI/UX Polish (glassier buttons, Tower Talk "Adding Value" category, etc.)
- designo UI overhaul with Picasso patterns
- 64-Color Ambient Lighting
- Enterprise Quality Standards (Error Boundary, Logger, Accessibility, Design Tokens)
- CommandCenter.jsx refactored: 3172 → 801 lines
- Backend routes modularized (Phase 1)
- PWA/Offline support

---

## Technical Architecture

### Frontend (Mobile)
- React Native 0.81.5 + Expo SDK 54
- TypeScript
- @react-navigation for routing
- expo-camera, expo-av for native features
- @jamsch/expo-speech-recognition for on-device STT
- @react-native-ml-kit/text-recognition for OCR

### Backend
- FastAPI (Python 3.11)
- MongoDB via Motor (async)
- Emergent LLM integrations (GPT-4o-mini)
- Modular routes architecture (14 route files)

### Backend Route Architecture (Updated Feb 9, 2026)
```
/backend/
├── server.py (340 lines - app setup, middleware, health)
├── routes/
│   ├── license.py (574 lines - DL scanning, OCR, uploads)
│   ├── printer_v2.py (681 lines - PDF generation)
│   ├── integrations_routes.py (622 lines)
│   ├── vin_v2.py (531 lines)
│   ├── data_management.py (516 lines)
│   ├── customers_v2.py (421 lines)
│   ├── tower_talk_v2.py (347 lines)
│   ├── pin_auth.py (340 lines)
│   ├── tts_voice.py (291 lines)
│   ├── ai_features.py (293 lines)
│   ├── vehicles_v2.py (215 lines)
│   ├── websocket.py (118 lines)
│   ├── telemetry.py (40 lines)
│   ├── knowledge.py (36 lines)
│   └── __init__.py
```

---

## Prioritized Backlog

### P0 - COMPLETED
- [x] All core features implemented
- [x] Backend fully modularized
- [x] On-device STT implemented
- [x] 100% backend test pass rate

### P1 (Next)
- [ ] Full frontend regression test on native device
- [ ] Verify on-device STT works on real iPhone/Android

### P2 (Medium)
- [ ] PostHog telemetry integration (needs user API key)
- [ ] Batch VIN scan mode
- [ ] Team management features
- [ ] Real CRM integration

---

## 3rd Party Integrations
- OpenAI GPT-4o-mini (Tower Talk, Translation, TTS, License OCR)
- Emergent LLM Key (Vision, Translation)
- NHTSA vPIC API (VIN decode)
- @jamsch/expo-speech-recognition (On-device STT)
- @react-native-ml-kit/text-recognition (On-device OCR)

---

## Credentials
- No login required (PIN-based auth)
- Emergent LLM key configured in backend/.env
