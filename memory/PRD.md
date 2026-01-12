# Taillights - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives, originally named "Closr" and now rebranded to "Taillights". The application features AI-powered sales assistance, CRM integration, and a highly stylized UI with a "GTA Vice City" meets high-end automotive aesthetic.

## Target Users
- Automotive sales representatives
- Car dealership staff
- Sales managers

## Core Features

### AI Integration
- **Tower Talk**: AI-powered conversation assistance using OpenAI GPT (via emergentintegrations)
- **Quick Response Shortcuts**: Pre-defined responses for common scenarios
- **Supercharg'd Mode**: Language translation feature (English/Spanish)

### CRM Integration
- **Generic REST Adapter**: Connect to any CRM via REST API
- **Built-in Connectors**: VinSolutions, DealerSocket, DealerTrack, eLead, ProMax, Reynolds
- **Mock Mode**: Test without real credentials
- **Field Mapping**: AI-powered field discovery and mapping
- **Webhook Processing**: Real-time event handling

### Notifications
- **Twilio SMS**: Send alerts via SMS
- **Browser Notifications**: Sound profiles ('Merica, Euro, JDM) with car engine sounds
- **Notification History**: Track all alerts

### A/B Testing
- **Experiment Framework**: Test different response variants
- **Analytics Dashboard**: View variant performance, conversions, and rates
- **Toggle Controls**: Pause/activate experiments from the UI

### Mobile Support
- **PWA**: iOS-optimized Progressive Web App
- **Capacitor Wrapper**: Native iOS/Android builds ready

## UI/UX Design

### Theme
- Dark/Light mode support
- GTA Vice City aesthetic with neon gradients
- Glassmorphism effects

### Key Visual Elements
- **C8 Corvette Z06 Taillights Logo**: Multi-element angular design (4 segments per side, horizontally oriented) - matches actual 2024-2026 C8 Z06
- **Brake Light Effect**: Taillights flash bright red when screen is tapped
- **ZL1 Camaro Check Button**: 70° hood-opening animation on hover, engine glow reveals, amber check engine icon BEHIND text
- **Supercharg'd Button**: Compact size with flame animations for language toggle
- **Vice City Typography**: Bebas Neue + Russo One fonts

## Technical Architecture

### Backend (FastAPI + Python)
```
/app/backend/
├── server.py                 # Main API server
├── ab_testing_service.py     # A/B testing logic
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
└── src/
    ├── App.js
    ├── index.css             # Custom styling + animations
    ├── components/
    │   ├── Header.jsx        # C8 taillights, Check button, Supercharged
    │   ├── AdminSettingsPanel.jsx  # All settings (tabs)
    │   ├── AnalyticsDashboard.jsx  # Analytics + A/B Testing UI
    │   └── ...
    └── utils/
        ├── native.js         # Capacitor bridge
        └── notificationSound.js  # Audio playback
```

### Database (MongoDB)
- `customers` - Customer records
- `vehicles` - Vehicle inventory
- `data_sources` - CRM configurations
- `conversations` - Chat history (TTL indexed)
- `device_tokens` - Push notification tokens
- `ab_experiments` - A/B test definitions
- `ab_events` - Conversion tracking

## Implementation Status

### Completed ✅
- [x] Full backend API with FastAPI
- [x] AI Tower Talk with OpenAI GPT
- [x] CRM integration layer (mock + real mode)
- [x] Webhook processing and notifications
- [x] A/B testing framework (backend + frontend UI)
- [x] C8 Corvette Z06 taillight logo (multi-element angular design)
- [x] Brake lights flash on screen tap
- [x] ZL1 Camaro Check button with 70° hood animation
- [x] Check Engine icon behind text
- [x] Smaller Supercharged button
- [x] Admin Settings Panel (5 tabs)
- [x] Sound profiles for notifications
- [x] Capacitor mobile wrapper setup
- [x] A/B Testing Dashboard in Analytics

### Ready for Production
- [ ] Real CRM credentials (user must provide)
- [ ] Twilio credentials (user must provide)
- [ ] Native mobile build (requires Xcode/Android Studio)

## API Endpoints

### Core
- `POST /api/quick-response` - Generate AI response
- `POST /api/tower-talk` - AI conversation
- `GET /api/history` - Conversation history

### Integrations
- `GET /api/integrations` - List all integrations
- `POST /api/integrations` - Create new integration
- `PATCH /api/integrations/{id}` - Update credentials
- `POST /api/integrations/{id}/test` - Test connection
- `POST /api/integrations/{id}/sync` - Trigger data sync
- `POST /api/integrations/{id}/toggle-mock` - Toggle mock mode

### A/B Testing
- `GET /api/ab/experiments` - List experiments
- `GET /api/ab/assign/{name}` - Get variant assignment
- `POST /api/ab/track` - Track conversion event
- `PATCH /api/ab/experiments/{name}` - Update experiment (activate/pause)

### Notifications
- `POST /api/notifications/register-device` - Register push token
- `GET /api/notifications/history` - Notification history

## Changelog
- **2026-01-12**: Implemented C8 Z06 multi-element angular taillights (4 segments per side)
- **2026-01-12**: Added brake light flash effect on screen tap
- **2026-01-12**: Updated Check button with 70° hood animation and icon behind text
- **2026-01-12**: Reduced Supercharged button size
- **2026-01-12**: Added A/B Testing Dashboard UI inside Analytics

## Next Steps (Backlog)

### P2 - Enhancement
- [ ] Full push notification integration (Firebase via Capacitor)
- [ ] Native mobile app builds (cap add ios/android, build, sync)

### P3 - Future
- [ ] Offline mode improvements
- [ ] Advanced analytics with charts
