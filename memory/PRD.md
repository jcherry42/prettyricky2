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

---

## Data Integration Architecture ✅ IMPLEMENTED

### Overview
CRM-agnostic data integration system with:
- **Smart Field Mapping**: Auto-detects field names with confidence scores
- **Multiple Formats**: CSV, JSON, Google Sheets
- **Scheduled Refresh**: Mon-Sat at 10:00 AM ET
- **Manual Refresh**: On-demand refresh capability
- **Health Monitoring**: Tracks source health and failures

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
```

---

## Implementation Status

### ✅ Completed Features (as of Jan 10, 2026)
1. iOS-Optimized UI with colorful glassmorphism
2. Customer/Prospect Selector
3. Inquiry Type Selector (8 types)
4. Tone Selector (3 tones)
5. Response Cards with copy/iMessage
6. Objection Handling (quadrupled responses)
7. Follow-up Templates with timing
8. Setup Modal (dealership/salesperson)
9. Tower Talk AI Feature
10. Favorites Feature (localStorage persistence)
11. **CRM-Agnostic Data Integration**:
    - Smart field mapping
    - CSV, JSON, Google Sheets support
    - Scheduled refresh (Mon-Sat 10 AM)
    - Data source management UI
    - Phone/email/VIN validation
    - MongoDB persistence

### 📋 Future Tasks
- **Offline Capability**: Service workers (P2)
- **Deeper iMessage Integration**: Beyond `sms:` URI (P3)

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
├── context/SalesContext.js
├── data/salesData.js           # Mock data / templates
└── components/
    ├── ImportModal.jsx         # Data import wizard
    ├── TowerTalkModal.jsx
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
- emergentintegrations (LLM)
- React, Tailwind CSS, shadcn/ui

---

## Known Limitations
- Offline mode not yet implemented
- iMessage uses basic `sms:` URI
- Google Sheets must be publicly shared
