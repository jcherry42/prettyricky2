# Supercharg'd - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives. The application features AI-powered sales assistance with proven persuasion psychology, CRM integration, and a highly stylized UI with a "GTA Vice City" meets high-end automotive aesthetic.

## Target Users
- Automotive sales representatives
- Car dealership staff
- Sales managers

## Core Features

### AI Integration (Enhanced with Persuasion Psychology)
- **Tower Talk**: AI-powered conversation assistance using OpenAI GPT (via emergentintegrations)
- **Persuasion Tactics**: Built-in sales psychology including:
  - Purchasing triggers (scarcity, urgency, loss aversion, social proof)
  - Relationship builders (reciprocity, commitment/consistency, liking)
  - Closing psychology (assumptive framing, future pacing, question closes)
  - Objection prevention and value reframing
- **Quick Response Shortcuts**: Pre-defined responses for common scenarios
- **Supercharg'd Mode (Sport Mode)**: Language translation feature (English/Spanish)
- **Voice Translator**: Spanish-to-English voice translation via "Push to Start" button

### CRM Integration
- **Generic REST Adapter**: Connect to any CRM via REST API
- **Built-in Connectors**: VinSolutions, DealerSocket, DealerTrack, eLead, ProMax, Reynolds
- **Mock Mode**: Test without real credentials (currently active by default)
- **Field Mapping**: AI-powered field discovery and mapping
- **Webhook Processing**: Real-time event handling

### Response Features
- **Editable Messages**: Edit AI-generated responses before sending
- **Translation Support**: Translate edited messages to Spanish
- **Text-to-Speech**: Read messages aloud with natural Spanish voice optimization
- **iMessage Integration**: Send directly to customer via iMessage

### Notifications
- **Twilio SMS**: Send alerts via SMS
- **Browser Notifications**: Sound profiles ('Merica, Euro, JDM) with real car engine sounds (.wav files)
- **Notification History**: Track all alerts

### Mobile Support
- **PWA**: iOS-optimized Progressive Web App
- **Capacitor Wrapper**: Native iOS/Android builds ready

## UI/UX Design

### Theme
- Dark/Light mode support
- GTA Vice City aesthetic with neon gradients
- Glassmorphism effects

### Key Visual Elements
- **R34 Skyline Taillights Logo**: JDM-style startup animation with car drifting sound
- **Sport Mode Button**: Bilingual toggle with flame animations
- **Check Engine Button**: ZL1 Camaro SVG with hood pop-up animation on hover
- **Push to Start Button**: Voice translator for Spanish-to-English

## Technical Architecture

### Backend (FastAPI + Python)
```
/app/backend/
├── server.py                 # Main API server with enhanced AI
├── ab_testing_service.py     # A/B testing logic (backend only, UI removed)
├── analytics_service.py      # Usage analytics
├── conversation_history.py   # Chat history
├── notification_service.py   # Twilio + browser notifications
├── webhook_processor.py      # Event processing
├── data_integration.py       # Data import/export
├── repositories.py           # MongoDB repositories
└── integrations/
    ├── manager.py            # Integration management
    ├── generic_rest.py       # REST API adapter
    ├── webhooks/             # Webhook handling
    └── connectors/           # CRM-specific adapters
```

### Frontend (React)
```
/app/frontend/
├── capacitor.config.json     # Mobile wrapper config
├── public/assets/sounds/     # Audio files (merica.wav, euro.wav, jdm.wav, startup.wav)
└── src/
    ├── App.js
    ├── index.css             # Custom styling + animations
    ├── components/
    │   ├── Header.jsx        # R34 taillights, Check Engine, Sport Mode
    │   ├── ResponseCards.jsx # Editable responses with TTS
    │   ├── VoiceTranslator.jsx # Push to Start voice translator
    │   ├── DataHealthIndicator.jsx # Lead data quality
    │   └── AdminSettingsPanel.jsx # CRM configuration
    ├── context/
    │   └── SalesContext.js   # Global state
    └── utils/
        └── notificationSound.js # .wav audio playback
```

## Database Collections
- `customers` - Lead/customer data
- `vehicles` - Inventory data
- `integrations` - CRM configurations
- `data_sources` - Import sources
- `conversations` - Chat history
- `notifications` - Notification log
- `webhooks` - Webhook configs

## Implementation Status

### Completed ✅
- [x] Full backend API with FastAPI
- [x] **AI Tower Talk with Persuasion Psychology** (JUST COMPLETED)
  - Purchasing triggers: scarcity, urgency, loss aversion, social proof
  - Relationship builders: reciprocity, commitment/consistency, liking
  - Closing psychology: assumptive framing, future pacing, question closes
  - Objection prevention with value reframing
- [x] CRM integration layer (mock + real mode)
- [x] Webhook processing and notifications
- [x] R34 Skyline taillight logo with JDM startup animation
- [x] ZL1 Camaro Check button with hood-opening animation
- [x] Sport Mode button with flame animations
- [x] Real .wav sound profiles ('Merica, Euro, JDM)
- [x] Voice Translator (Spanish-to-English) with Push to Start button
- [x] Editable responses with translation and TTS
- [x] Admin Settings Panel
- [x] Capacitor mobile wrapper (iOS + Android platforms synced)
- [x] Rebranded from "Taillights" to "Supercharg'd"

### Features Intentionally Removed
- [x] A/B Testing UI (backend retained)
- [x] Battle Cards (VSModal)
- [x] Favorites feature

### Ready for Production
- [ ] Real CRM credentials (user must provide)
- [ ] Twilio credentials (user must provide)
- [ ] Native mobile build (requires Xcode/Android Studio)

## API Endpoints

### Core AI
- `POST /api/tower-talk` - Generate AI response with persuasion psychology
- `POST /api/translate` - Translate text (English/Spanish)

### Integrations
- `GET /api/integrations` - List all integrations
- `POST /api/integrations` - Create new integration
- `PATCH /api/integrations/{id}` - Update credentials
- `POST /api/integrations/{id}/test` - Test connection
- `POST /api/integrations/{id}/sync` - Trigger data sync
- `POST /api/integrations/{id}/toggle-mock` - Toggle mock mode

### Data
- `GET /api/customers` - List customers
- `GET /api/vehicles` - List vehicles
- `POST /api/import/file` - Import data from file

### Notifications
- `POST /api/notifications/register-device` - Register push token
- `GET /api/notifications/history` - Notification history

## Changelog
- **2026-01-13**: Enhanced AI with persuasion psychology (purchasing triggers, relationship builders, closing techniques)
- **2026-01-12**: Completed Capacitor mobile builds (iOS + Android platforms added and synced)
- **2026-01-12**: Rebranded from "Taillights" to "Supercharg'd"
- **2026-01-12**: Added Voice Translator with Push to Start button
- **2026-01-12**: Added editable responses with translation and TTS
- **2026-01-12**: Replaced synthesized sounds with real .wav audio files
- **2026-01-12**: Removed A/B Testing UI, Battle Cards, Favorites for performance
- **2026-01-12**: JDM-style startup animation with car drifting sound
- **2026-01-12**: Enhanced ZL1 hood pop-up animation

## Pending Issues

### P1 - High Priority
- [ ] **Real CRM Integration**: Remove mock-only mode, enable live data ingestion from user CRMs

### P2 - Medium Priority  
- [ ] **Voice Translator Safari Issues**: User reported microphone access issues on Safari (fixes applied, pending verification)

## Next Steps (Backlog)

### P1 - Enhancement
- [ ] Response Analytics: Track which AI responses are used most
- [ ] Full push notification integration (Firebase via Capacitor)

### P2 - Future
- [ ] Native mobile app builds (cap add ios/android, build, sync)
- [ ] Offline mode improvements
- [ ] Advanced analytics with charts

### Rejected
- ~~"What If" Scenario Generator~~ (explicitly rejected by user)
