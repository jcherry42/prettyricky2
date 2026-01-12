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
- **Analytics**: Track conversion events

### Mobile Support
- **PWA**: iOS-optimized Progressive Web App
- **Capacitor Wrapper**: Native iOS/Android builds ready

## UI/UX Design

### Theme
- Dark/Light mode support
- GTA Vice City aesthetic with neon gradients
- Glassmorphism effects

### Key Visual Elements
- **C8 Corvette Taillights Logo**: L-shaped LED design (horizontal bar + vertical stem)
- **ZL1 Camaro Check Button**: Hood-opening animation, amber check engine icon
- **Supercharg'd Button**: Flame animations for language toggle
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
    │   ├── Header.jsx        # Taillights logo + buttons
    │   ├── AdminSettingsPanel.jsx  # All settings (tabs)
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
- [x] A/B testing framework
- [x] C8 Corvette taillight logo (L-shaped design)
- [x] ZL1 Camaro Check button with hood animation
- [x] Check Engine icon visible with amber glow
- [x] Admin Settings Panel (5 tabs)
- [x] Sound profiles for notifications
- [x] Capacitor mobile wrapper setup

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

### Notifications
- `POST /api/notifications/register-device` - Register push token
- `GET /api/notifications/history` - Notification history

## Next Steps (Backlog)

### P2 - Enhancement
- [ ] A/B Testing Dashboard UI
- [ ] Full push notification integration (Firebase)

### P3 - Future
- [ ] Offline mode improvements
- [ ] Advanced analytics dashboard

## Changelog
- **2026-01-12**: Fixed P0 UI issues (C8 taillights L-shape, Check button animation/icon)
- **2026-01-12**: Verified P1 CRM integration flow working
- **2026-01-12**: Confirmed P2 Capacitor setup complete
