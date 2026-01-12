# Sales Weapon (Closr) - Product Requirements Document

## Original Problem Statement
Build a "sales weapon" for automotive sales reps that is:
- Offline-capable
- Instant response (under 15 seconds)
- Easy to use
- iOS optimized with tap-selectable inputs

## Platform
iOS optimized web application with tap-selectable inputs

---

## Core Functionality

### 1. Context-Based Response Generator (Rule-Based)
A structured decision tree (NOT a free-form chatbot) that:
- Takes input: `inquiry type`, `vehicle`, and `tone`
- Outputs: 3 pre-structured, tokenized responses

### 2. Response Categories (Tones)
- **Fast & Direct**: Quick, no-nonsense responses
- **Balanced/Relational**: Friendly, rapport-building
- **Soft Touch/Appointment Focused**: Gentle, low-pressure

### 3. Tower Talk (AI Feature) ✅
AI-powered personalized response generation using Emergent LLM (GPT-4.1-mini)

### 4. Favorites Feature ✅
Save, view, and reuse effective AI-generated responses

### 5. Dark/Light Mode Theme ✅ (NEW - Jan 10, 2026)
- Chrome-style toggle button with sun/moon icon
- Persists to localStorage as 'closr_theme'
- Tinted glass UI effects for both themes

### 6. Supercharg'd Mode ✅ (NEW - Jan 10, 2026)
- Animated flames toggle button with EN/ES label
- Real-time English/Spanish translation
- Bilingual Tower Talk responses
- Language toggle for each response card
- Persists to localStorage as 'closr_supercharged'

### 7. Voice Input for Tower Talk ✅ (NEW - Jan 10, 2026)
- Microphone button in Tower Talk modal
- Uses Web Speech API (SpeechRecognition)
- Supports continuous speech input
- Real-time transcript display
- Works in English and Spanish (adapts to Supercharg'd mode)
- Visual feedback with pulsing animation when listening

### 8. Voice Output (Read Aloud) ✅ (NEW - Jan 10, 2026)
- Speaker button on AI-generated responses
- Uses Web Speech API (SpeechSynthesis)
- Reads response in correct language (English or Spanish based on toggle)
- Visual feedback with animated audio bars when speaking
- Tap to start/stop reading
- Truly hands-free operation for sales reps on the move

### 9. Quick Response Shortcuts ✅ (NEW - Jan 10, 2026)
- 8 pre-programmed objection buttons in Tower Talk
- One-tap instant AI response generation
- Common objections covered:
  - 💰 Price Too High
  - 🤔 Need to Think
  - 🔄 Trade-In Value
  - 🏷️ Better Deal Elsewhere
  - 📊 Payment Too High
  - 💑 Check with Spouse
  - ⚙️ Missing Features
  - ⏰ Not Ready Yet
- Auto-hides after selection, shows response
- "New Response" button to return to shortcuts

### 10. -VS- Battle Cards ✅ (NEW - Jan 10, 2026)
- Swipeable competitor comparison cards
- 5 vehicle segments: Compact SUV, Midsize Sedan, Luxury SUV, Full-Size Truck, Electric
- Pre-loaded popular matchups per segment
- Custom matchup input for any two vehicles
- AI-generated battle card content:
  - 🏆 Winning Point headline
  - ⚡ Quick Win one-liner
  - Key Advantages (Value, Reliability, Performance, Features, Resale)
  - 🛡️ Objection Crushers (3 ready responses)
  - 🎯 Closing Line for test drive transition
- Copy buttons for quick clipboard access
- Purple/magenta luxury theme styling

---

## Data Integration Architecture ✅ IMPLEMENTED

### Overview
CRM-agnostic data integration system with:
- **Smart Field Mapping**: Auto-detects field names with confidence scores
- **Multiple Formats**: CSV, JSON, Google Sheets
- **Scheduled Refresh**: Mon-Sat at 10:00 AM ET
- **Manual Refresh**: On-demand refresh capability
- **Health Monitoring**: Tracks source health and failures
- **Downloadable Templates**: CSV templates for customers and vehicles

### Supported Data Fields

**Customers (Must-have)**:
- First Name, Last Name (or Full Name)
- Phone (required, validated)
- Email (validated)
- Vehicle of Interest
- Lead Status (hot/warm/cold/new/sold/lost)
- Address

**Customers (Nice-to-have)**:
- Notes
- Current Vehicle
- Trade-in Info

**Vehicles**:
- Year, Make, Model (required)
- Trim, VIN, Stock Number
- Price, MSRP
- Mileage, Colors, Transmission, Engine
- Status (available/sold/pending)

### Smart Field Mapper
Auto-recognizes 150+ field name variations:
- `first_name`, `firstname`, `fname`, `First Name` → `first_name`
- `phone`, `phone_number`, `cell`, `mobile` → `phone`
- Returns confidence scores (0.0-1.0) for each mapping

### Refresh Schedule
- **Automatic**: Mon-Sat at 10:00 AM ET
- **Manual**: Via UI "Refresh" button
- **Retry Logic**: 3 retries with exponential backoff

### API Endpoints
```
POST /api/tower-talk         - AI response generation
POST /api/translate          - English/Spanish translation (Supercharg'd)
POST /api/import/preview     - Preview import with detected mappings
POST /api/import/url         - One-time import from URL
POST /api/import/file        - Upload file import

GET  /api/data-sources       - List configured sources
POST /api/data-sources       - Create new source
GET  /api/data-sources/:id   - Get source details
PATCH /api/data-sources/:id  - Update source config
DELETE /api/data-sources/:id - Delete source and data
POST /api/data-sources/:id/refresh - Manual refresh

GET  /api/customers          - List customers (with search, filter)
GET  /api/customers/stats    - Customer statistics by status
GET  /api/vehicles           - List vehicles (with search, filter)
GET  /api/vehicles/stats     - Inventory statistics
GET  /api/health             - System health check

GET  /templates/customers_template.csv - Download customers import template
GET  /templates/vehicles_template.csv  - Download vehicles import template
```

---

## UI/UX Design

### Luxury Automotive Theme ✅
A premium theme inspired by high-end automotive interiors:

**Materials & Textures:**
- **Carbon Fiber**: Woven pattern for headers and selector backgrounds
- **Wood Grain**: Dark walnut-inspired card backgrounds
- **Brushed Steel**: Secondary buttons and status indicators
- **Tinted Glass**: Glassmorphism effects with backdrop blur

**Ambient Lighting:**
- **Gold/Amber**: Primary accent color, selected states, luxury feel
- **Blue**: Secondary accent for "Direct" tone
- **Green**: Success states and "Ready" indicator
- **Red**: Tower Talk feature and error states
- **Orange**: Supercharg'd mode active state

**Key Design Elements:**
- Subtle gradients and inset shadows for depth
- Pulsing ambient glow animations
- Chrome accent lines on headers
- Warm color temperature overall

**Theme Modes:**
- **Dark Mode**: Deep carbon, wood grain, and amber accents
- **Light Mode**: Cream/tan leather with gold accents

---

## Implementation Status

### ✅ Completed Features (as of Jan 12, 2026)
1. iOS-Optimized UI with **Luxury Automotive Design**
2. Customer/Prospect Selector
3. Inquiry Type Selector (8 types)
4. Tone Selector (3 tones with ambient lighting)
5. Response Cards with copy/iMessage
6. Objection Handling (quadrupled responses)
7. Follow-up Templates with timing
8. Setup Modal (dealership/salesperson)
9. Tower Talk AI Feature
10. Favorites Feature (localStorage persistence)
11. CRM-Agnostic Data Integration
12. **Offline Capability (Service Worker + PWA)**
13. **Enhanced iMessage Integration (Web Share API)**
14. **Dark/Light Mode Theme Switcher**
15. **Supercharg'd Mode - Bilingual Translation**
16. **User Preferences Persistence**
17. **Downloadable Import Templates**
18. **Voice Input for Tower Talk**
19. **Voice Output - Read Aloud**
20. **Quick Response Shortcuts**
21. **-VS- Battle Cards**
22. **Production-Grade CRM Integration Layer** (Jan 10, 2026)
23. **Integration Health Status on Frontend** (Jan 10, 2026)
24. **CRM Integration Settings Panel** (Jan 10, 2026)
25. **Open API System - Field Discovery Service** (Jan 10, 2026)
26. **Integration Profiles (Save/Export/Import)** (Jan 10, 2026)
27. **Connection Wizard (4-Step Setup)** (Jan 10, 2026)
28. **OpenAPI/Swagger Spec Import** ✅ (Jan 12, 2026)
29. **AI-Powered Smart Field Suggest** ✅ (Jan 12, 2026)
30. **Advanced Field Transformation Engine** ✅ (Jan 12, 2026)
31. **Enhanced Connection Wizard with Transforms** ✅ (Jan 12, 2026)
32. **Enhanced Integration Health Status** ✅ (Jan 12, 2026)

### 📋 Future Tasks (P2/P3)
- Add Categories to Favorites (e.g., "Price Negotiation", "Follow-ups")
- Database-backed customer conversation history
- "What If" Scenario Generator for Battle Cards

---

## CRM Integration Layer ✅ IMPLEMENTED (Jan 10, 2026)

### Overview
Production-grade, read-only CRM integration system featuring:
- **7 Pre-built CRM Connectors**: VinSolutions, DealerSocket, elead, CDK, DealerTrack, Reynolds, ProMax
- **Generic REST Adapter**: Connect to any REST API
- **Mock Mode**: Full testing without real CRM credentials
- **Fortified Webhooks**: HMAC, API Key, Bearer Token, IP Whitelist authentication
- **Health Monitoring**: Real-time status aggregation
- **Rate Limiting**: Sliding window algorithm with burst support
- **Retry Logic**: Exponential backoff on failures

### CRM Connectors
| Connector | Vendor | Auth Methods | Status |
|-----------|--------|--------------|--------|
| VinSolutions | Cox Automotive | API Key, OAuth2 | ✅ Ready |
| DealerSocket | Solera | API Key, OAuth2 | ✅ Ready |
| elead | CDK Global | API Key | ✅ Ready |
| CDK Drive | CDK Global | OAuth2 | ✅ Ready |
| DealerTrack | Cox Automotive | OAuth2 | ✅ Ready |
| Reynolds | Reynolds & Reynolds | API Key | ✅ Ready |
| ProMax | ProMax Unlimited | API Key | ✅ Ready |
| Generic REST | Custom | All | ✅ Ready |

### Mock Mode
When `mock_mode=true`, connectors generate realistic fake data:
- 50 customers with names, phones, emails, vehicle interests
- 100 vehicles with year/make/model, pricing, specs
- Useful for testing UI and data flow without CRM access

### Webhook Security
Multiple authentication methods supported:
- **HMAC SHA-256/SHA-512**: Cryptographic signature verification
- **API Key**: Header-based authentication
- **Bearer Token**: OAuth-style token auth
- **IP Whitelist**: Source IP filtering
- **Combined**: Multiple methods required
- **Replay Prevention**: Timestamp validation
- **Idempotency**: Request ID tracking

### Integration API Endpoints
```
GET  /api/integrations/adapters           - List available CRM types
GET  /api/integrations/adapters/{type}    - Get adapter setup instructions
GET  /api/integrations                    - List configured integrations
POST /api/integrations                    - Create new integration
GET  /api/integrations/{id}               - Get integration details
PATCH /api/integrations/{id}              - Update integration
DELETE /api/integrations/{id}             - Delete integration
POST /api/integrations/{id}/test          - Test connection
POST /api/integrations/{id}/sync          - Sync data from CRM
GET  /api/integrations/health             - Aggregated health status
GET  /api/integrations/{id}/health        - Detailed integration health

GET  /api/webhooks                        - List webhooks
POST /api/webhooks                        - Register new webhook
GET  /api/webhooks/{id}                   - Get webhook details
DELETE /api/webhooks/{id}                 - Delete webhook
POST /api/webhooks/{id}/receive           - Webhook event receiver
GET  /api/webhooks/{id}/events            - Get webhook events
GET  /api/webhooks/{id}/stats             - Get webhook statistics
POST /api/webhooks/{id}/rotate            - Rotate credentials
```

### Frontend Health Status Component
- Compact status indicator in header: "1/1 CRM" with health icon
- "MOCK" badge when integrations use mock mode
- Auto-refreshes every 30 seconds
- Expandable view with detailed stats per integration

---

## Technical Architecture

### Backend (`/app/backend/`)
```
├── server.py                    # FastAPI main server
├── data_integration/
│   ├── __init__.py
│   ├── models.py               # Pydantic models
│   ├── field_mapper.py         # Smart field detection
│   ├── validators.py           # Phone, email, VIN validation
│   ├── processor.py            # Import orchestration
│   ├── scheduler.py            # APScheduler for refresh
│   ├── exceptions.py           # Custom exceptions
│   └── parsers/
│       ├── base.py
│       ├── csv_parser.py
│       ├── json_parser.py
│       └── google_sheets.py
├── integrations/               # NEW - CRM Integration Layer
│   ├── __init__.py
│   ├── base.py                 # BaseAdapter, AdapterRegistry, AuthConfig
│   ├── generic_rest.py         # GenericRestAdapter with mock support
│   ├── manager.py              # IntegrationManager (CRUD, sync, health)
│   ├── mock_data.py            # Realistic test data generator
│   ├── sync_engine.py          # Data sync orchestration
│   ├── health.py               # Health monitoring
│   ├── connectors/
│   │   ├── vinsolutions.py
│   │   ├── dealersocket.py
│   │   ├── elead.py
│   │   ├── cdk.py
│   │   ├── dealertrack.py
│   │   ├── reynolds.py
│   │   └── promax.py
│   └── webhooks/
│       ├── receiver.py         # Legacy receiver
│       ├── fortified_receiver.py  # Multi-auth webhook handler
│       └── handlers.py
└── repositories/
    ├── base.py                 # Repository pattern
    ├── customer_repo.py
    ├── vehicle_repo.py
    └── data_source_repo.py
```

### Frontend (`/app/frontend/src/`)
```
├── App.js
├── index.css                   # Luxury theme with dark/light modes
├── context/SalesContext.js     # State + theme/supercharged actions
├── data/salesData.js           # Mock data / templates
└── components/
    ├── Header.jsx              # Theme + Supercharg'd + Health Status
    ├── ImportModal.jsx         # Data import wizard + template downloads
    ├── TowerTalkModal.jsx      # AI responses with translation
    ├── ResponseCards.jsx       # Response display with language toggle
    ├── VSModal.jsx             # -VS- Battle Cards
    ├── FavoritesModal.jsx
    ├── IntegrationHealthStatus.jsx  # NEW - CRM health display
    └── ...
```

### Database (MongoDB)
Collections:
- `customers` - Imported customer data
- `vehicles` - Imported vehicle inventory
- `data_sources` - Source configurations and health
- `integrations` - CRM integration configurations (NEW)
- `webhooks` - Webhook endpoint configurations (NEW)
- `webhook_events` - Received webhook events (NEW)

---

## Key Dependencies
- FastAPI, Motor (MongoDB async)
- APScheduler (scheduled jobs)
- httpx (async HTTP)
- emergentintegrations (LLM + Translation)
- React, Tailwind CSS, shadcn/ui

---

## Known Limitations
- Google Sheets must be publicly shared
- Translation uses LLM (may have slight latency)
