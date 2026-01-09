# Sales Weapon (Closr) - Product Requirements Document

## Original Problem Statement
Build a "sales weapon" for automotive sales reps that is:
- Offline-capable
- Instant response (under 15 seconds)
- Easy to use
- iOS optimized with tap-selectable inputs

## Platform
iOS optimized web application with tap-selectable inputs

## Core Functionality

### 1. Context-Based Response Generator (Rule-Based)
A structured decision tree (NOT a free-form chatbot) that:
- Takes input: `inquiry type`, `vehicle`, and `tone`
- Outputs: 3 pre-structured, tokenized responses (`[name]`, `[vehicle]`, etc.)

### 2. Response Categories (Tones)
- **Fast & Direct**: Quick, no-nonsense responses
- **Balanced/Relational**: Friendly, rapport-building
- **Soft Touch/Appointment Focused**: Gentle, low-pressure

### 3. Inquiry Types
- New Lead
- Price Question
- Availability
- Trade-In
- Financing
- Test Drive
- Follow Up
- Objection

### 4. Objection Handling
Quadrupled list of responses for common sales objections, based on:
- Real-world sales data
- Cialdini's principles of persuasion
- Behavioral psychology techniques

### 5. Follow-ups
Quadrupled list of follow-up message templates with static timing suggestions:
- 2 Hours
- Next Day
- 3 Days
- 1 Week

### 6. Tower Talk (AI Feature) ✅ IMPLEMENTED
A separate, on-demand AI-powered feature accessed via a red "Tower Talk" button:
- Uses Emergent LLM (GPT-4.1-mini) backend
- Generates deeper, more personal approaches for unique situations
- Passes customer context (name, vehicle, dealership info, salesperson style)

## User Preferences (Customization)

### Dealership Settings
- Name
- Address
- Hours
- Appointment phrasing preference ("come in" vs. "stop by")

### Salesperson Settings
- Name
- Title (optional)
- Personal style: "Straight Shooter," "Friendly," "Professional"

## UI/UX Requirements
- Modern, colorful design ✅
- Glasslike texture (glassmorphism) ✅
- iOS native functions:
  - Copy to clipboard ✅
  - Button to open iMessage ✅

---

## Implementation Status

### ✅ Completed Features (as of Jan 9, 2026)
1. **iOS-Optimized UI** - Colorful glassmorphism design with tap-selectable inputs
2. **Customer Selector** - Select from prospect list with lead status indicators
3. **Inquiry Type Selector** - 8 inquiry types with icons
4. **Tone Selector** - 3 tones (Fast & Direct, Balanced, Soft Touch)
5. **Response Cards** - 3 tokenized responses per selection with copy/iMessage buttons
6. **Objection Handling** - Quadrupled responses with persuasion psychology (12 per tone)
7. **Follow-up Templates** - Quadrupled with timing suggestions
8. **Setup Modal** - Dealership and salesperson preferences
9. **Tower Talk AI Feature** - Fully functional AI-powered personalized responses
10. **Favorites Feature** - Save, view, copy, send, and delete AI-generated responses (persisted to localStorage)

### 🔄 Upcoming Tasks (P1)
- **Data Import**: Allow dealership, inventory, and customer data import via files or hyperlinks

### 📋 Future Tasks (P2/P3)
- **Persist User Preferences**: Save dealership/salesperson settings to localStorage (partially done - favorites already persisted)
- **Offline Capability**: Service workers for app shell and data caching (Tower Talk remains online-only)
- **iMessage Integration**: Investigate deeper integration beyond `sms:` URI scheme

---

## Technical Architecture

### Frontend
- React 18
- Tailwind CSS
- shadcn/ui components
- React Context API for state management

### Backend
- Python FastAPI
- MongoDB (configured but not actively used yet)
- emergentintegrations library for LLM

### Key Files
- `/app/frontend/src/data/salesData.js` - Mock database with all templates
- `/app/frontend/src/context/SalesContext.js` - Global state management
- `/app/backend/server.py` - FastAPI server with Tower Talk endpoint

### API Endpoints
- `POST /api/tower-talk` - AI-powered personalized response generation

---

## Data Model (Current - Mocked)

### Customer
```javascript
{
  id: string,
  name: string,
  vehicle: string,
  phone: string,
  email: string,
  status: 'hot' | 'warm' | 'cold',
  tradeIn: string | null,
  notes: string
}
```

### Response Template
```javascript
{
  type: string,          // inquiry type
  tone: string,          // fast | balanced | soft
  templates: string[]    // array of 3 tokenized responses
}
```

---

## Known Limitations
- All data is currently mocked in `salesData.js`
- No persistent storage (settings reset on refresh)
- No offline support yet
- iMessage integration uses basic `sms:` URI scheme
