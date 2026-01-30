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

#### Animated Ambient Lighting Effects
- **Breathing glow**: Subtle pulsing on wood bezels (6s cycle)
- **Icon glow**: Pulsing color halos on icons (3s cycle)
- **Border glow**: Interactive highlight on hover (2s cycle)
- **Text glow**: Amber illumination pulse on gauge text (3s cycle)

#### Import Data Tab - W140 Instrument Cluster
- Icon-focused circular gauge buttons
- Large, detailed colorful icons (72px) - cyan, green, purple
- Chrome bezel borders with glowing halos
- Title text centered below each icon
- No description text (cleaner design)
- Walnut wood bezel frame

### Components Styled
- ✅ Command Center Modal (Picasso + wood bezel + breathing animation)
- ✅ Import Tab (W140 instrument cluster with chrome gauge buttons)
- ✅ IntakeHub (centered position, wood bezel, designo nappa)
- ✅ Customer Cards (quilted nappa + Picasso + stitching)
- ✅ Inquiry Buttons (uniform 110px height, wood bezel borders)
- ✅ Response Cards (wood accent bar + nappa texture)
- ✅ Tower Talk (designo cardinal red accent)

### Typography
- Command Center: 75% larger font sizes
- Generated Responses: 75% larger (1.25rem body, 1.4rem titles)
- Import options: Standard 1rem for readability

### Sound Design
- All audio fades gradually (1 second fade-out)
- Startup sound: 3-second fade-in/fade-out

---

## What's Been Completed (January 30, 2026)

### UI Enhancements ✅
1. **IntakeHub centered** - Modal now appears in screen center
2. **Import buttons redesigned** - Icon-focused with large colorful icons, no descriptions
3. **Inquiry buttons uniform** - All 8 buttons exactly 110px height
4. **Font size increased 75%** - Command Center and response cards
5. **Animated ambient lighting** - Breathing, glowing, pulsing effects
6. **Code cleanup** - Removed duplicate and dead CSS rules

### Bug Fixes ✅
1. **Search bar box-in-box** - Fixed in light mode
2. **CSS syntax errors** - Cleaned orphaned blocks

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
