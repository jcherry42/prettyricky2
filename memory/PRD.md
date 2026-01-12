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
33. **Categories for Favorites** ✅ (Jan 12, 2026) - Filter by Price, Trade-In, Objections, Follow-Up, etc.
34. **Database-Backed Conversation History** ✅ (Jan 12, 2026) - 30-day auto-delete, session tracking
35. **Webhook Event Processing** ✅ (Jan 12, 2026) - Real-time event queue, DLQ, retry logic
36. **Advanced Analytics Dashboard** ✅ (Jan 12, 2026) - Sales, Customers, Inventory, AI Insights
37. **Porsche/McLaren Glassmorphism UI Theme** ✅ (Jan 12, 2026) - Premium sports car infotainment aesthetic

### 37. Porsche/McLaren Glassmorphism UI Theme ✅ (Jan 12, 2026)
- Deep backdrop blur (40px) with carbon fiber texture overlays
- Premium glass cards with metallic border accents
- Instrument cluster-inspired metric displays
- Haptic-touch button styling
- Light mode optimized for full readability

### 38. SMS Notifications (Twilio) ✅ (Jan 12, 2026)
- Hot lead alerts with instant SMS
- Lead status change notifications
- Scheduled follow-up reminders
- Placeholder credential handling (queue notifications until configured)

### 39. Enhanced Settings & Import Modals ✅ (Jan 12, 2026)
- Premium form styling with Porsche/McLaren aesthetic
- Step indicators with progress lines
- Better input fields and buttons
- Full light/dark mode support

### 40. Admin Settings Panel ("Check Engine" Button) ✅ (Jan 12, 2026)
- "Check Engine" button with car hood opening animation in header
- Dual tabs: Notifications and CRM Integrations
- Twilio SMS configuration with credential validation
- CRM health overview with Healthy/Degraded/Unhealthy/Mock counts

### 41. CRM Credential Management UI ✅ (Jan 12, 2026)
- Click integration to open detail view
- Mock Mode / Live Mode toggle button
- API Credentials form (API Key, Username, Password, Client ID, Client Secret)
- Test Connection button with result feedback
- Save Credentials button with backend sync

### 42. Webhook-to-Notification Integration ✅ (Jan 12, 2026)
- Registered event handlers: customer.created, customer.updated, lead.status_changed, deal.created, deal.updated
- Hot lead events automatically trigger SMS notifications (queued until Twilio configured)
- Lead status change to 'hot', 'qualified', 'closed_won', 'closed_lost' trigger notifications
- Test endpoint: POST /api/events/test-hot-lead for development testing

### 📋 In Progress / Upcoming
- **Push Notifications (Web Push API)** - Browser-based alerts complementing SMS
- **Mobile App Wrapper (Capacitor)** - Package PWA for iOS/Android app stores

### 📋 Future Tasks (P3)
- A/B Testing Framework - Track tone effectiveness, shortcuts vs Tower Talk, response length
- Capacitor wrapper for native iOS/Android App Store deployment
- Performance Leaderboard for team tracking

### 🔧 Technical Note
- All CRM connectors currently operate in **MOCK MODE** using simulated data
- SMS notifications will **queue until Twilio credentials are provided**
- To enable real connections:
  - CRM: Provide API credentials for VinSolutions, DealerSocket, elead, CDK, DealerTrack, Reynolds, or ProMax
  - SMS: Provide Twilio Account SID, Auth Token, and From Number

---

## New API Endpoints (Jan 12, 2026)

### Conversation History
```
GET  /api/conversations/categories      - List available categories (9 categories)
POST /api/conversations                 - Create conversation with auto-category
GET  /api/conversations                 - List with filters (session_id, customer_id, category)
GET  /api/conversations/stats           - Aggregated statistics
GET  /api/conversations/session/{id}    - Session history
GET  /api/conversations/customer/{id}   - Customer history
DELETE /api/conversations/{id}          - Delete single conversation
DELETE /api/conversations/session/{id}  - Delete session
```

### Analytics Dashboard
```
GET /api/analytics/dashboard            - Full dashboard summary
GET /api/analytics/sales                - Sales performance (daily breakdown, shortcuts)
GET /api/analytics/customers            - Customer engagement (funnel, contact quality)
GET /api/analytics/inventory            - Inventory metrics (price stats, top makes)
GET /api/analytics/conversations        - AI insights (bilingual, peak hours)
GET /api/analytics/integrations         - Integration health summary
GET /api/analytics/trends/{metric}      - Trend data (conversations, customers, vehicles)
```

### Webhook Event Processing
```
GET  /api/events/stats                  - Event processing statistics
GET  /api/events/types                  - Available event types (11 types)
POST /api/events/enqueue                - Manually enqueue event
POST /api/events/test-hot-lead          - Test hot lead event (creates notification)
GET  /api/events/dlq                    - Dead letter queue events
POST /api/events/dlq/{id}/replay        - Replay DLQ event
```

### CRM Integration Management
```
POST /api/integrations/{id}/toggle-mock - Toggle mock/live mode
POST /api/integrations/{id}/test        - Test connection
PATCH /api/integrations/{id}            - Update credentials (auth_config)
```

### Favorites Categories
```
GET /api/favorites/categories           - Get favorite categories (9 categories)
```

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
├── integrations/               # CRM Integration Layer
│   ├── __init__.py
│   ├── base.py                 # BaseAdapter, AdapterRegistry, AuthConfig
│   ├── generic_rest.py         # GenericRestAdapter with mock support
│   ├── manager.py              # IntegrationManager (CRUD, sync, health)
│   ├── mock_data.py            # Realistic test data generator
│   ├── sync_engine.py          # Data sync orchestration
│   ├── health.py               # Health monitoring
│   ├── field_discovery.py      # NEW - Auto-discover fields from API
│   ├── profiles.py             # NEW - Savable connection profiles
│   ├── openapi_parser.py       # NEW - OpenAPI/Swagger spec parser
│   ├── smart_suggest.py        # NEW - AI-powered field mapping
│   ├── field_transforms.py     # NEW - Advanced data transformation engine
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
    ├── ImportModal.jsx         # Data import wizard + CRM settings panel
    ├── TowerTalkModal.jsx      # AI responses with translation
    ├── ResponseCards.jsx       # Response display with language toggle
    ├── VSModal.jsx             # -VS- Battle Cards
    ├── FavoritesModal.jsx
    ├── ConnectionWizard.jsx    # NEW - 4-step CRM setup wizard
    ├── IntegrationHealthStatus.jsx  # Enhanced CRM health display
    └── ...
```

### Database (MongoDB)
Collections:
- `customers` - Imported customer data
- `vehicles` - Imported vehicle inventory
- `data_sources` - Source configurations and health
- `integrations` - CRM integration configurations
- `webhooks` - Webhook endpoint configurations
- `webhook_events` - Received webhook events
- `integration_profiles` - NEW - Savable connection profiles

---

## Open API Data Ingestion System ✅ IMPLEMENTED (Jan 12, 2026)

### Overview
A flexible, open, read-only data ingestion layer capable of connecting to any RESTful CRM:

### Features

**1. OpenAPI/Swagger Import**
- Parse OpenAPI 3.0 and Swagger 2.0 specifications (JSON/YAML)
- Auto-detect base URL, endpoints, and authentication methods
- Pre-fill connection wizard with detected configuration
- Endpoint: `POST /api/integrations/parse-openapi`

**2. AI-Powered Smart Field Suggest**
- Intelligent field mapping suggestions using pattern detection
- Optional AI enhancement via Emergent LLM
- Confidence scoring for suggestions
- Endpoint: `POST /api/integrations/smart-suggest`

**3. Advanced Field Transformation Engine**
Transform and clean data during import:
- **31+ Built-in Transforms** across 9 categories:
  - String: uppercase, lowercase, titlecase, trim
  - Phone: normalize (+1...), US format, digits only
  - Price: strip symbols, round to dollar
  - Name: combine first+last
  - Date: normalize to ISO, format
  - Status: normalize
  - Email: normalize
  - Address: normalize
  - Numeric: format numbers
- **Composite Fields**: Combine multiple fields (e.g., first_name + last_name → name)
- **Conditional Mapping**: Use fallback fields or logic-based mapping
- **Default Values**: Apply fallbacks for empty source fields
- Endpoints:
  - `GET /api/integrations/transforms` - List available transforms
  - `POST /api/integrations/transforms/preview` - Preview single transform
  - `POST /api/integrations/transforms/test` - Test full mapping config

**4. Connection Wizard UI**
4-step guided setup:
1. **Choose Method**: Quick Connect (pre-built), Custom REST API, OpenAPI Import, or Load Profile
2. **Connection Details**: URL, auth, endpoints configuration
3. **Map Fields**: Auto-discover fields, AI suggest, add transforms with expandable UI
4. **Test & Save**: Verify connection, optionally save as reusable profile

**5. Integration Profiles**
Save and reuse connection configurations:
- Share profiles across the team
- Export/import configurations
- Endpoint: `POST /api/integration-profiles`

### New API Endpoints (Jan 12, 2026)
```
POST /api/integrations/discover-fields      - Auto-discover fields from API
POST /api/integrations/discover-fields/sample - Discover from sample JSON
POST /api/integrations/parse-openapi        - Parse OpenAPI/Swagger spec
POST /api/integrations/smart-suggest        - AI-powered field suggestions
GET  /api/integrations/transforms           - List available transforms
POST /api/integrations/transforms/preview   - Preview single transform
POST /api/integrations/transforms/test      - Test full mapping config
GET  /api/integration-profiles              - List saved profiles
POST /api/integration-profiles              - Create profile
GET  /api/integration-profiles/{id}         - Get profile details
PUT  /api/integration-profiles/{id}         - Update profile
DELETE /api/integration-profiles/{id}       - Delete profile
```

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
