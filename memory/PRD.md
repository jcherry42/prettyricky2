# Supercharg'd - Product Requirements Document

## Original Problem Statement
Production-ready native mobile application for the automotive industry featuring:
- High-accuracy VIN scanner (barcodes + windshield text OCR) — 95%+ accuracy
- High-accuracy Driver's License (DL) scanner — 95%+ accuracy
- Secure PIN recovery system
- Premium "glass" aesthetic UI
- Session persistence for dealership resilience
- Performance benchmarks: Translation <800ms, VIN <500ms, License <700ms, API <300ms

## Architecture
- **Backend**: FastAPI 0.135.1 + MongoDB — v2.4.0
- **Frontend**: React Native / Expo SDK 54
- **AI**: GPT-4o Vision via AI Gateway (Emergent LLM key)
- **OCR**: ML Kit on-device + GPT-4o-mini cloud fallback
- **Auth**: JWT Bearer tokens enforced on all protected endpoints
- **Session Persistence**: Auto-save (30s timer + app background) → local AsyncStorage + remote MongoDB backup
- **File Structure**: `services/`, `models/`, `routes/`, `security/`, `middleware/`

## What's Been Implemented

### Session Persistence (Mar 2026 — Latest)

**Backend Session API:**
- `POST /api/sessions/save` — Full session snapshot (app background/close)
- `GET /api/sessions/restore` — Restore last session with age tracking
- `POST /api/sessions/auto-save` — Lightweight delta merge (30s interval)
- `DELETE /api/sessions` — Clear session data
- MongoDB `sessions` collection with 7-day TTL, per-user unique index
- All endpoints auth-protected

**Mobile Session Integration:**
- `useSessionPersistence` hook — Handles AppState changes, 30s auto-save timer, silent restore on mount
- `SessionPersistenceProvider` context — Central state manager for all persisted data
- Persists: active customer, search query, form drafts, Tower Talk conversation, modal states, navigation state, PTT results
- Wired into: App.tsx (provider chain), RootNavigator (modal states), HomeScreen (search + customer), TowerTalkOverlay (form drafts)
- Local-first with remote backup: AsyncStorage for instant restore, MongoDB for cross-device/reinstall

### Previous Implementations
- JWT Authentication Enforcement (all endpoints)
- AI-Powered Anomaly Detection (4-check fraud scanner)
- Performance Optimization (GPT-4o-mini for OCR, translation cache, image compression)
- Error Response Standardization
- Stale Closure Fix (CustomerContext)
- TypeScript Migration (75/75 files, noImplicitAny: true)
- WebSocket Auth Enhancement
- Backend Modernization (server.py 3,604 → ~570 lines)
- expo-av → expo-audio migration
- Offline queue + sync UI
- Premium glass UI aesthetic
- PIN recovery with master reset codes

## Test Coverage
- iteration_9: 17/17 session persistence tests (100%)
- iteration_8: 25/25 performance optimization tests (100%)
- iteration_7: 37/37 auth enforcement tests (100%)
- iteration_6: 30/30 modernization tests (100%)

## Prioritized Backlog

### P0 — None remaining

### P1 (High)
- PostHog telemetry integration (needs API key)
- Enable `strict: true` in tsconfig.json incrementally
- Full native device regression test with real audio/image data

### P2 (Medium)
- Team management features
- Real CRM integration
- Lock screen audio controls
- WebSocket real-time anomaly alerts
- Structured logging with log aggregation
