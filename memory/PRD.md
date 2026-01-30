# Supercharg'd - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives. The application features AI-powered sales assistance with a TRUSTED AUTHORITY approach (direct, calm, controlled, focused on digital-to-in-person conversion), and a highly stylized **Mercedes-Benz designo Interior Program** UI aesthetic inspired by the 1990s W140 S-Class, R129 SL, and C140 Coupes.

## Target Users
- Automotive sales representatives
- Car dealership staff
- Sales managers

## designo Interior Program UI Theme (January 30, 2026)

### Design Philosophy - "Rolls Royce of Automotive Middleware"
Inspired by authentic Mercedes-Benz designo Interior Program from the 1990s:
- **W140 S-Class** (1991-1998) - The flagship, "best car in the world"
- **R129 SL Roadster** - The glamorous sports car
- **C140 Coupe** - The grand touring coupe

### Materials & Textures Implemented
1. **Nappa Leather**: Diamond-quilted pattern with contrast stitching dots (gold/walnut)
2. **Burr Walnut Wood**: Rich grain with depth, swirls, and variations (dark mode)
3. **Bird's-Eye Maple**: Light honey wood with distinctive eye patterns (light mode)
4. **Brushed Aluminum**: Fine horizontal brushing on header rails and tabs
5. **Chrome Accents**: Outer ring highlights on modals and buttons

### Picasso Hand-Painted Pattern
The signature designo artistic swirl - literal yet tasteful:
- **Dark Mode**: Burgundy and teal flowing curves on black nappa
- **Light Mode**: Dusty rose and sage green on ivory nappa
- Applied to: Modal backgrounds, customer cards, main app background

### Color Stories
- **designo Night** (Dark Mode): Deep black nappa, amber gauge lighting, walnut bezels
- **designo Ivory** (Light Mode): Cream/porcelain nappa, honey wood tones, maple bezels

### W140 Instrument Cluster (Import Tab)
- Five-gauge dashboard aesthetic with circular buttons
- Walnut/maple wood bezel frame
- Black gauge faces with illuminated icons
- Amber text glow (authentic W140 instrument lighting)

### UI Components Styled with designo Treatment
- ✅ **Command Center Modal**: Nappa background + Picasso pattern + wood bezel border
- ✅ **Import Tab**: W140 instrument cluster with three circular gauge buttons
- ✅ **Header**: Brushed aluminum with subtle wood grain + wood-trimmed buttons
- ✅ **Customer Cards**: Quilted nappa with Picasso accents + wood bezel border
- ✅ **Inquiry Buttons**: Wood bezel borders + quilted background + stitching
- ✅ **Response Cards**: Nappa texture + wood accent bar + stitching pattern
- ✅ **Search Bar**: Unified blue-glass pill (box-in-box bug FIXED)
- ✅ **All Borders**: Crisp wood-grain trim throughout

---

## Core Features

### TRUSTED AUTHORITY Response Approach
All AI-generated responses follow a consistent approach:
- **Direct & Calm**: No pushy sales tactics, confident expertise
- **In-Person Focused**: Every response drives toward showroom visit
- **Value-Driven**: Focus on helping, not selling

### Data Entry System
- **File Upload**: CSV and JSON import
- **Manual Entry**: Customer details, VIN, trade info
- **Vision Extraction**: AI-powered document scanning

### Language Support
- Spanish 🇪🇸, French 🇫🇷, Korean 🇰🇷

### Tower Talk (AI ASSISTANT)
- OpenAI gpt-4o-mini powered
- Quick responses for objections
- Follow-up suggestions

### IntakeHub
- **License Scan**: Driver's license OCR extraction
- **VIN Scanner**: Vehicle decoder with local inventory (150 max)

### Printer Connection
- Network printer via IP address
- Eject/print customer profiles and vehicle profiles

---

## What's Been Implemented (January 30, 2026)

### designo UI Overhaul ✅ COMPLETE
1. **Picasso Hand-Painted Patterns** - Burgundy/teal (dark), rose/sage (light)
2. **Wood Bezel Framing** - Walnut and bird's-eye maple borders everywhere
3. **Nappa Leather Textures** - Diamond quilting with contrast stitching
4. **W140 Instrument Cluster** - Import tab with circular gauge buttons
5. **Crisp Borders** - Thoughtfully designed wood-grain trim throughout
6. **Authentic Lighting** - Amber glow (dark), honey tones (light)

### Bug Fixes ✅
1. **Search Bar Box-in-Box Bug FIXED** - Light mode displays unified blue-glass pill
2. **Uniform Button Sizing** - All inquiry buttons have consistent min-height/min-width
3. **CSS Syntax Errors** - Cleaned up orphaned blocks and duplicate rules

### Files Modified
- `/app/frontend/src/styles/luxury-auto.css` - Complete designo material system
- `/app/frontend/src/styles/tesla-2027.css` - Component styling updates
- `/app/frontend/src/index.css` - Theme color variables
- `/app/frontend/src/components/CommandCenter.jsx` - Modal styling with Picasso

---

## Technical Architecture

### Frontend
- React 18 + Vite
- Tailwind CSS
- Capacitor for native mobile
- lucide-react icons

### Backend
- FastAPI (Python)
- MongoDB (Motor async driver)
- JWT authentication
- OpenAI GPT integration

---

## Prioritized Backlog

### P0 (Critical) - ✅ COMPLETED
- [x] Search bar box-in-box bug fix
- [x] designo UI theme overhaul with Picasso patterns
- [x] Wood bezel framing on all components
- [x] Uniform inquiry button sizing

### P1 (High)
- [ ] Real CRM integration
- [ ] Batch VIN scan mode
- [ ] Response analytics dashboard

### P2 (Medium)
- [ ] Offline data sync
- [ ] Team management features
- [ ] Export reports

---

## 3rd Party Integrations
- **OpenAI GPT-4o-mini**: Tower Talk and Translation
- **OpenAI Whisper**: Speech-to-text
- **NHTSA vPIC API**: VIN decoding
- **Emergent LLM Key**: Vision Extraction

---

## Credentials
- No login required. Application loads directly into main interface.
