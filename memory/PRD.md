# Supercharg'd - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives. The application features AI-powered sales assistance with proven persuasion psychology, CRM integration, and a highly stylized UI with a "GTA Vice City" meets high-end automotive aesthetic.

## Target Users
- Automotive sales representatives
- Car dealership staff
- Sales managers

## Core Features

### Data Entry & Integration System (NEW)
- **File Upload**: CSV and Excel (.xlsx) import for bulk customers/vehicles
- **Email Parsing**: AI-powered lead email parsing with auto-customer creation
- **Manual Entry**: Premium liquid glass forms for customers and vehicles
- **CRM Integration**: Connect via API keys to VinSolutions, DealerSocket, eLeadCRM, custom APIs

### Vehicle Database (Enhanced)
- **Active Inventory**: Vehicles for sale on lot
- **Trade-Ins**: Customer trade-in vehicles (linked to customer profiles)
- **VIN Scanner**: Scan/decode VINs with category selection before saving
- **Full NHTSA Data**: Engine, transmission, safety features, assembly location

### Customer Profiles (NEW)
- Store: Name, Address, Phone, Email, Lead Source, Lead Status
- Notes with interaction history tracking
- Attach up to 2 vehicles of interest per customer
- Link trade-in vehicles to customers
- Auto-delete 30 days after marked as sold

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

## Technical Architecture

### Frontend (Vite + React + Capacitor)
**Migrated from CRA to Vite for better Capacitor compatibility**
```
/app/frontend/
├── capacitor.config.json     # Mobile wrapper config
├── vite.config.js            # Vite configuration
├── tailwind.config.js        # Tailwind CSS config
├── postcss.config.js         # PostCSS config
├── dist/                     # Production build output
├── public/sounds/            # Audio files
├── ios/                      # Native iOS project
├── android/                  # Native Android project
└── src/
    ├── main.jsx              # Entry point
    ├── App.jsx               # Main app component
    ├── index.css             # Global styles + animations
    ├── components/           # React components
    ├── context/              # React context (SalesContext)
    ├── data/                 # Sales data & templates
    ├── utils/                # Utilities (messaging, sounds, native)
    └── lib/                  # Shared utilities (cn)
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
- [x] **AI Tower Talk with Persuasion Psychology** (COMPLETED)
  - Purchasing triggers: scarcity, urgency, loss aversion, social proof
  - Relationship builders: reciprocity, commitment/consistency, liking
  - Closing psychology: assumptive framing, future pacing, question closes
  - Objection prevention with value reframing
- [x] **VIN Scanner Feature** (OPTIMIZED)
  - OnStar-style button in header with pulsing glow
  - Camera barcode scanning (via Capacitor ML Kit)
  - Manual VIN entry with validation
  - NHTSA vPIC API integration (free, comprehensive data)
  - **Liquid Glass UI** with frosted glass cards
  - **Enhanced Data Fields:**
    - Core: Year, Make, Model, Trim, VIN
    - Powertrain: Engine, Horsepower, Transmission, Drive Type
    - Fuel: Type, EV/Hybrid classification
    - Body: Style, Doors, Vehicle Type
    - Assembly: City, State, Country, Manufacturer
    - Safety: Airbags (front/side/knee/curtain), ABS, ESC, Backup Camera, Blind Spot, Lane Departure, Forward Collision, AEB
  - Save to Inventory functionality
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
- **2026-01-22**: Critical Bug Fixes (Push-to-Talk, Sport Mode, Translations)
  - **Push-to-Talk Rewritten** - Now works as true push-to-talk: First press starts listening, second press stops and translates
  - **Sport Mode Fixed** - Fixed infinite re-render loop causing crashes. Added proper debouncing with ref tracking
  - **Translation Performance** - Added cache hit detection, prevented duplicate translation requests
  - **Header Padding** - Increased from 140px to 160px for better content visibility
  - **Language Toggle** - Added floating language toggle above push-to-talk button
  - **Live Transcript** - Shows real-time speech recognition while listening
- **2026-01-22**: Fixed 7 Major Issues + iOS Build + Auth Integration
  - **VIN Scanner Fixed** - Now handles multiple barcode formats (CODE_39, CODE_128, DATA_MATRIX, QR_CODE, PDF_417, AZTEC), extracts VIN from barcode data, validates format
  - **Push to Talk Fixed** - Increased button size (56px->64px), added touchAction: manipulation, improved CSS touch responsiveness
  - **Sport Mode Crash Fixed** - Fixed translateText call to properly handle object response with success/translatedText properties
  - **Quick Add Liquid Glass** - Removed wood grain texture, added backdrop-filter: blur(24px), modern frosted glass aesthetic
  - **Header Padding Fixed** - Increased paddingTop from 120px to 140px, body content no longer blocked
  - **Translation Optimized** - Using GPT-4o-mini for fast translations with caching
  - **iOS Build Fixed** - Podfile updated to iOS 15.5, project.pbxproj deployment targets fixed, comprehensive build script created
  - **JWT Authentication Integrated** - Login modal, registration, skip option all working
  - All 17 backend tests pass (100%), all frontend UI flows verified
- **2026-01-22**: Federal-Grade Security & Authentication System
  - **Full JWT Authentication Integration (Option B)** - User chose full integration over temporary bypass
  - Login modal with "Federal-Grade Security" badge appears on app load
  - User registration with email/password, first name, last name
  - User login with credentials returning JWT token
  - "Skip for now (limited features)" option for guest access
  - AuthContext provider wrapping the app
  - Secure token storage with AES-GCM encryption (secureStorage.js)
  - Role-based permissions system (sales_rep with customer/vehicle/AI permissions)
  - Audit logging for all auth events
  - Backend endpoints: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
  - iOS build configuration updated to iOS 15.5 (required for ML Kit barcode scanning)
  - All 23 backend tests pass, all frontend flows verified
  - Created comprehensive IOS_BUILD_INSTRUCTIONS.md
- **2026-01-16**: Comprehensive Review & Luxury Polish
  - Enhanced ambient lighting effects across all UI elements
  - Added stronger gold/amber glow to header accent line with underglow
  - Enhanced response card styling with wood grain texture and hover glow
  - Enhanced Tower Talk button with stronger red ambient glow
  - Enhanced modal styling with ambient glow above modal
  - Added luxury-glow-animated keyframe animation
  - Fixed ESLint warning in SetupModal.jsx
  - All 24 backend tests pass (VIN decoder, dashboard, customers, vehicles)
  - All frontend UI elements verified working correctly
  - Mobile builds synced (iOS + Android)
- **2026-01-16**: VIN Scanner Enhancement & Settings Tab
  - Enhanced VIN decoder with multi-source cross-reference validation
    - ISO 3779 checksum validation
    - World Manufacturer Identifier (WMI) database lookup
    - Confidence score displayed (0-100%)
  - Added Settings tab to Command Center with:
    - Dealership Profile (name, brand, location)
    - Salesperson Profile (name, preferred greeting)
    - Sound Effects toggle & Engine Sound profiles (USA, Euro, JDM)
    - Browser Notifications enable
    - Twilio SMS configuration (Account SID, Auth Token, From Number)
  - Mobile builds synced
- **2026-01-16**: Quick Add Button Feature
  - Added floating Bluetooth-emblem button for quick customer addition
  - Cyan/blue tech-style design with pulsing glow effect
  - Opens modal with all essential fields (name, phone, email, source, notes)
  - Mobile builds updated
- **2026-01-16**: Email Parser Feature & UI Improvements
  - Added Email Lead Parser modal with AI-powered extraction (uses GPT to parse lead emails)
  - Improved Inquiry Type button readability (warmer amber tones, better contrast)
  - Enhanced wood grain visibility (soft-light blend mode, smaller pattern size)
  - Fixed ESLint warnings (setState in effect, escaped entities)
  - Updated mobile builds (Capacitor sync completed)
- **2026-01-16**: UI/UX Enhancement - Wood Grain and Warm Theme Update
  - Fixed Check Engine button (simplified, works consistently)
  - Fixed modal centering (VIN Scanner and Command Center now use React Portals)
  - Added wood grain texture to body background (both light and dark modes)
  - Enhanced dark mode with warm amber/gold accents (JDM luxury interior feel)
  - Enhanced light mode with vibrant cyan/magenta Vice City colors
  - Wood grain texture applied to header and modal backgrounds
  - Updated font family to include Chakra Petch and Manrope
  - Fixed Vite allowedHosts configuration for preview
- **2026-01-13**: Added VIN Scanner feature with OnStar-style button, barcode/manual entry, NHTSA decoder
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

### P0 - Critical
- [x] **Web Preview Fixed**: App loads correctly, all core features working
- [x] **Authentication System Integrated**: Full JWT auth with login modal, registration, and skip option
- [x] **iOS Build Fixed**: Podfile updated to iOS 15.5, comprehensive build guide created
- [x] **VIN Scanner Fixed**: Manual entry, barcode scanning, and decode all working
- [x] **Push to Talk Fixed**: Button responsive to touch
- [x] **Sport Mode Fixed**: No longer crashes on translation
- [x] **Quick Add Liquid Glass**: Modern design implemented
- [x] **Header Padding Fixed**: Content no longer blocked
- [ ] **Eject Button Testing**: Backend endpoint and frontend UI implemented. Needs Twilio credentials for full testing.

### P1 - High Priority
- [ ] **Real CRM Integration**: Remove mock-only mode, enable live data ingestion from user CRMs
- [ ] **Device Testing**: Tower Talk, Voice Translator, VIN Scanner need testing on physical iOS device

### P2 - Medium Priority  
- [ ] **Sport Mode Translator Performance**: User reported translator "not up to par" with sport mode engaged
- [ ] **Voice Translator Safari Issues**: User reported microphone access issues on Safari (fixes applied, pending verification)
- [ ] **VIN Barcode Scanner Verification**: Needs testing on physical iOS device

## Next Steps (Backlog)

### P0 - Immediate
- [x] **Email Parsing for Lead Ingestion**: ✅ COMPLETED - AI-powered email parser modal added to Import tab

### P1 - Enhancement
- [ ] Response Analytics: Track which AI responses are used most
- [ ] Full push notification integration (Firebase via Capacitor)
- [ ] Refine Liquid Glass UI further based on user feedback

### P2 - Future
- [ ] Native mobile app builds (cap add ios/android, build, sync)
- [ ] Offline mode improvements
- [ ] Advanced analytics with charts

### Rejected
- ~~"What If" Scenario Generator~~ (explicitly rejected by user)
