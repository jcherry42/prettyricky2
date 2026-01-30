# Supercharg'd - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives. The application features AI-powered sales assistance with a TRUSTED AUTHORITY approach (direct, calm, controlled, focused on digital-to-in-person conversion), and a highly stylized **Mercedes-Benz designo Interior Program** UI aesthetic inspired by the 1990s W140 S-Class, R129 SL, and C140 Coupes.

## Target Users
- Automotive sales representatives
- Car dealership staff
- Sales managers

## Core Features

### TRUSTED AUTHORITY Response Approach
All AI-generated responses and pre-built templates follow a single, consistent approach:
- **Direct & Calm**: No pushy sales tactics, just confident expertise
- **In-Person Focused**: Every response subtly drives toward the showroom visit
- **Value-Driven**: Focus on helping, not selling
- 2 pre-generated responses per inquiry type + 1 custom editable box

### Data Entry System (SIMPLIFIED)
- **File Upload**: CSV and JSON import for bulk customers
- **Manual Entry**: First name, last name, phone, email, policy #, vehicle of interest (VIN), trade VIN, trade mileage, lead status
- **REMOVED**: Email Parser, CRM Sync, Vehicle/Inventory import

### Language Support (STREAMLINED)
- Spanish 🇪🇸
- French 🇫🇷  
- Korean 🇰🇷
- **REMOVED**: English, Japanese

### Tower Talk (AI ASSISTANT)
- Connected to OpenAI gpt-4o-mini
- Embodies the app's trusted authority approach
- Quick responses for common objections
- Follow-up suggestions included

### Printer Connection
- **Command Center → Printer tab**: Connect to network printers via IP address
- Status indicator shows connected/disconnected state
- Saved printer IP persists in localStorage

### Eject Feature (Print)
- **Print customer profiles** when viewing a customer in Command Center
- **Print scanned driver's licenses** after successful OCR scan
- **Print vehicle profiles** from VIN scanner inventory
- Eject button appears on customer profile detail and after license scan

### IntakeHub (INTAKE Button)
- Secondary menu with two options:
  - **License Scan**: Driver's license OCR extraction
  - **VIN Scanner**: Vehicle identification number decoder with local inventory

### License Scanner
- **Take Photo**: Capture driver's license with device camera
- **Upload Image**: Upload license image from device
- **OCR Extraction**: AI-powered extraction of name, address, city, state, zip
- **Create Customer**: One-click customer creation from license data
- **Attach to Existing**: Link license to existing customer

### VIN Scanner & Local Inventory
- **ISO 3779 Checksum Validation**: Real-time VIN verification
- **NHTSA Database Integration**: Official US Government vehicle data
- **Local Device Inventory**: Up to 150 vehicles stored per device
- **Mileage Tracking**: Optional current mileage field
- **Print Vehicle Profiles**: Eject function for scanned vehicles

### Push-to-Talk Voice Translator
- Transcribes customer speech (Spanish/French/Korean) into English text
- Uses customer's selected language as source, translates to English
- MediaRecorder + OpenAI Whisper backend

---

## designo Interior Program UI Theme (January 30, 2026)

### Design Philosophy
Inspired by the authentic Mercedes-Benz designo Interior Program from the 1990s:
- **W140 S-Class** (1991-1998)
- **R129 SL Roadster**
- **C140 Coupe**

### Materials & Textures
1. **Nappa Leather**: Diamond-quilted pattern with contrast stitching
2. **Burr Walnut Wood**: Rich grain with depth and swirl patterns
3. **Bird's-Eye Maple**: Light wood with distinctive eye patterns
4. **Brushed Aluminum**: Fine horizontal brushing
5. **Chrome Accents**: High-polish reflective surfaces

### Color Stories
- **designo Night** (Dark Mode): Deep black nappa, amber gauge lighting, walnut bezels
- **designo Ivory** (Light Mode): Cream/porcelain nappa, honey wood tones, soft shadows

### UI Components Styled
- **Import Data Tab**: W140-style instrument cluster with walnut bezel, circular gauge buttons
- **Header**: Subtle wood grain texture with theme-appropriate colors
- **Search Bar**: Unified blue-glass pill (fixed box-in-box bug)
- **Inquiry Buttons**: Uniform sizing with colorful gradient icons

---

## What's Been Implemented (as of January 30, 2026)

### UI/UX Fixes ✅
1. **Search Bar Box-in-Box Bug FIXED**: Light mode search bar now displays as unified blue-glass pill
2. **Uniform Button Sizing**: Inquiry type buttons now have consistent min-height/min-width
3. **designo Theme Overhaul**: Comprehensive styling based on authentic 90s Mercedes interior

### designo Theme Implementation ✅
1. **luxury-auto.css**: New designo material classes (nappa, walnut, maple, chrome, ambient)
2. **index.css**: Updated color variables for designo Ivory and designo Night
3. **tesla-2027.css**: Updated light mode styling for import options and inputs
4. **CommandCenter.jsx**: Import tab restyled as W140 instrument cluster

---

## Technical Architecture

### Frontend
- React 18 + Vite
- Tailwind CSS
- Capacitor for native mobile
- lucide-react icons
- Sonner for toasts

### Backend
- FastAPI (Python)
- MongoDB (Motor async driver)
- JWT authentication
- OpenAI GPT integration
- OpenAI Whisper for speech-to-text

### Key Files Modified This Session
- `/app/frontend/src/styles/luxury-auto.css` - designo material system
- `/app/frontend/src/styles/tesla-2027.css` - Light mode styling, search bar fix
- `/app/frontend/src/index.css` - Theme color variables
- `/app/frontend/src/components/CommandCenter.jsx` - Import tab styling, search bar fix

---

## Prioritized Backlog

### P0 (Critical) - COMPLETED ✅
- [x] Search bar box-in-box bug fix
- [x] designo UI theme overhaul
- [x] Uniform inquiry button sizing

### P1 (High)
- [ ] Apply designo styling to more components (customer cards, modals)
- [ ] Real CRM integration (backend stubs exist)
- [ ] Batch VIN scan mode for lot inventory

### P2 (Medium)
- [ ] Picasso hand-painted pattern accent option
- [ ] Response analytics dashboard
- [ ] Offline data sync
- [ ] Refactor server.py into multiple routers

### P3 (Low)
- [ ] Custom theme color picker
- [ ] Export reports
- [ ] Team management

---

## 3rd Party Integrations
- **OpenAI GPT-4o-mini**: Tower Talk and Translation
- **OpenAI Whisper**: Speech-to-text for voice translation
- **NHTSA vPIC API**: VIN decoding
- **Emergent LLM Key**: Vision Extraction (gpt-4-vision-preview)

---

## Test Status
- Search bar fix: Verified via screenshot (light mode)
- Import tab designo styling: Verified via screenshot (both modes)
- Inquiry button sizing: Verified via screenshot

---

## Credentials
- No login required. Application loads directly into main interface.
