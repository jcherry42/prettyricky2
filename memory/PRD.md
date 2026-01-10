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

### ✅ Completed Features (as of Jan 10, 2026)
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
14. **Dark/Light Mode Theme Switcher** (NEW)
15. **Supercharg'd Mode - Bilingual Translation** (NEW)
16. **User Preferences Persistence** (NEW)
17. **Downloadable Import Templates** (NEW)
18. **Voice Input for Tower Talk** (NEW)
19. **Voice Output - Read Aloud** (NEW)

### 📋 Future Tasks
- Database-backed customer conversation history
- Add Categories to Favorites (e.g., "Price Negotiation", "Follow-ups")

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
    ├── Header.jsx              # Theme + Supercharg'd toggle buttons
    ├── ImportModal.jsx         # Data import wizard + template downloads
    ├── TowerTalkModal.jsx      # AI responses with translation
    ├── ResponseCards.jsx       # Response display with language toggle
    ├── FavoritesModal.jsx
    └── ...
```

### Database (MongoDB)
Collections:
- `customers` - Imported customer data
- `vehicles` - Imported vehicle inventory
- `data_sources` - Source configurations and health

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
