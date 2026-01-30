# Supercharg'd - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives. The application features AI-powered sales assistance with a TRUSTED AUTHORITY approach, and a highly stylized **Mercedes-Benz designo Interior Program** UI aesthetic inspired by the 1990s W140 S-Class.

## designo Interior Program UI Theme (January 30, 2026)

### Implemented with "Excruciating Artistic Detail"

#### Materials & Textures
1. **Nappa Leather**: Diamond-quilted pattern with contrast stitching dots
2. **Burr Walnut Wood**: Rich grain bezels with depth and swirl patterns
3. **Bird's-Eye Maple**: Light honey wood with distinctive eye patterns
4. **Brushed Aluminum**: Fine horizontal brushing on header rails
5. **Chrome Accents**: High-polish bezel borders

#### Picasso Hand-Painted Patterns
- **Dark Mode**: Burgundy + teal flowing artistic curves
- **Light Mode**: Dusty rose + sage green on ivory
- Applied throughout: modals, customer cards, response cards

#### 64-Color Ambient Lighting System (NEW)
- **Background Effect**: Radial gradients cycling through 64 colors on screen edges
- **Card Glow**: Subtle color-cycling glow behind tesla-cards, customer cards, response cards
- **30-second cycle**: Medium-speed color cycling through full spectrum
- **3 Intensity Levels**: Subtle (4% opacity), Medium (8%), Vivid (12%)
- **Toggle**: On/Off switch in Settings tab
- **Persisted**: Preference saved to localStorage

#### Import Data Tab - W140 Instrument Cluster
- Icon-focused circular gauge buttons
- **Dark mode**: Icons hidden, just amber-glowing titles on dark gauge faces
- **Light mode**: Icons hidden, white titles on ivory gauge faces
- Walnut wood bezel frame

### Components Styled
- ✅ Command Center Modal (Rounded 28px, Picasso swirl, wood bezel)
- ✅ Import Tab (W140 instrument cluster - icons visible, glowing text on top)
- ✅ IntakeHub (centered position, wood bezel, designo nappa)
- ✅ Customer Cards (quilted nappa + Picasso + stitching)
- ✅ Inquiry Buttons (100px uniform, ROUNDED glass effect, Picasso swirl on press)
- ✅ Response Cards (wood accent bar + nappa texture)
- ✅ Tower Talk (designo cardinal red accent)

### Typography
- Command Center tabs: 50% larger (15px)
- Search bar: 20% smaller (11px)
- Add Customer button: 50% larger (18px)
- Generated Responses: 75% larger (1.25rem body)

### Sound Design
- Sport Mode sound: Uses user's selected engine profile (merica/euro/jdm)
- Smooth fade-out over last 1.2 seconds of audio
- Ease-out curve for natural fade

---

## What's Been Completed (January 30, 2026)

### Session Updates ✅
1. **Sport Mode Sound Fix** - Now plays selected engine profile with fade-out
2. **Financing Button Size** - Fixed to match all other inquiry buttons (100px uniform)
3. **Dark Mode Import Buttons** - Now match light mode (icons hidden, just titles)
4. **Font Sizes Adjusted** - Tabs +50%, search -20%, add customer +50%
5. **64-Color Ambient Lighting** - Full implementation with settings toggle

### Bug Fixes ✅
1. **Search bar box-in-box** - Fixed in light mode
2. **CSS syntax errors** - Cleaned orphaned blocks
3. **Inquiry button sizing** - All 8 buttons now uniform

---

## Core Features

### TRUSTED AUTHORITY Response Approach
- Direct & Calm expertise
- In-Person focused (driving to showroom)
- Value-driven (helping, not selling)

### Data Entry
- File Upload (CSV/JSON)
- Manual Entry
- Vision Extraction

### IntakeHub
- License Scan (OCR)
- VIN Scanner (local inventory, 150 max)

### Tower Talk
- OpenAI GPT-4o-mini
- Quick objection responses

---

## Technical Architecture

### Frontend
- React 18 + Vite
- Tailwind CSS + custom designo CSS
- Capacitor for native mobile

### Backend
- FastAPI (Python)
- MongoDB
- OpenAI integrations

---

## Prioritized Backlog

### P0 - ✅ COMPLETED
- [x] designo UI overhaul with Picasso patterns
- [x] IntakeHub centered positioning
- [x] Import buttons icon-focused redesign
- [x] Uniform inquiry button sizing
- [x] 75% font size increase
- [x] Animated ambient lighting
- [x] Code cleanup (dead/duplicate removal)
- [x] Sound fade effects

### P1 (High)
- [ ] Real CRM integration
- [ ] Batch VIN scan mode
- [ ] Response analytics

### P2 (Medium)
- [ ] Offline data sync
- [ ] Team management

---

## 3rd Party Integrations
- OpenAI GPT-4o-mini (Tower Talk)
- OpenAI Whisper (Speech-to-text)
- NHTSA vPIC API (VIN decode)
- Emergent LLM Key (Vision)

---

## Credentials
- No login required
