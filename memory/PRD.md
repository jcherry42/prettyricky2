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
- Applied throughout: modals, customer cards, response cards, **inquiry buttons**

#### 64-Color Ambient Lighting System
- **Background Effect**: Radial gradients cycling through 64 colors on screen edges
- **Card Glow**: Subtle color-cycling glow behind tesla-cards, customer cards, response cards
- **30-second cycle**: Medium-speed color cycling through full spectrum
- **3 Intensity Levels**: Subtle (4% opacity), Medium (8%), Vivid (12%)
- **Toggle**: On/Off switch in Settings tab
- **Persisted**: Preference saved to localStorage

#### Import Data Tab - W140 Instrument Cluster
- **Three uniform 130px circular gauge buttons**
- **Icons visible**: Cyan (File Upload), Green (Manual Entry), Purple (Vision Extraction)
- **Glowing text ON TOP of icons**
- Walnut wood bezel frame

### Components Styled
- ✅ Command Center Modal (Rounded 28px, Picasso swirl, wood bezel)
- ✅ Import Tab (W140 instrument cluster - 3 uniform buttons with icons + glowing text)
- ✅ IntakeHub (centered position, wood bezel, designo nappa)
- ✅ Customer Cards (quilted nappa + Picasso + stitching)
- ✅ Inquiry Buttons (100px uniform, ROUNDED glass effect, Picasso swirl always visible)
- ✅ Response Cards (wood accent bar + nappa texture)
- ✅ Tower Talk (designo cardinal red accent)

### Typography
- Command Center tabs: 50% larger (15px)
- Search bar: 20% smaller (11px)
- Add Customer button: 50% larger (18px)
- Generated Responses: 1.3rem (75% larger from base)

### Translation System
- **Uses settings language**: Translation respects language selected in Settings (Spanish/French/Korean)
- **Sport mode only**: Translation button appears only in Sport mode
- **Auto-translate**: Responses auto-translate in Sport mode
- **Toggle**: Click translate button to switch between original/translated

### Sound Design
- Sport Mode sound: Uses user's selected engine profile (merica/euro/jdm)
- Smooth fade-out over last 1.2 seconds of audio
- Ease-out curve for natural fade

---

## What's Been Completed (January 30, 2026)

### Latest Session Updates ✅
1. **Command Center Light Mode Rounded** - Fixed border-radius in light mode (28px, matching dark mode)
2. **Lint Errors Fixed** - Fixed 3 errors:
   - CommandCenter.jsx: setState in useEffect → lazy initialization
   - LanguageSelector.jsx: removed `jsx` prop from style tag
   - VisionExtractor.jsx: removed `jsx` prop from style tag
3. **Import Buttons Uniform** - All 3 buttons now exactly 130px
4. **Translation Uses Settings Language** - Fixed TowerTalkModal
5. **Code Cleanup** - Removed unused imports from ResponseCards.jsx
6. **Inquiry Buttons Picasso** - Added Picasso swirl pattern

### Previous Session ✅
1. **Sport Mode Sound Fix** - Now plays selected engine profile with fade-out
2. **Financing Button Size** - Fixed to match all other inquiry buttons (100px uniform)
3. **64-Color Ambient Lighting** - Full implementation with settings toggle

### Bug Fixes ✅
1. **Translation API key** - Fixed corrupted EMERGENT_LLM_KEY in backend/.env
2. **Search bar box-in-box** - Fixed in light mode
3. **CSS syntax errors** - Cleaned orphaned blocks

---

## Technical Debt / Refactoring (Completed Jan 30, 2026)

### Performance Optimizations ✅
1. **React.memo** - All components wrapped with memo:
   - CommandCenter, ImportOption, IntegrationItem, CustomerForm, CustomerDetail, AmbientLightingSection, SettingsTab
2. **useMemo** - Filtered customers list memoized
3. **useCallback** - All event handlers wrapped
4. **displayName** - Added to all memoized components for debugging
5. **Lazy loading** - SettingsTab and ImportTab can be lazy loaded

### Enterprise Quality Standards ✅ (Jan 30, 2026)
1. **Error Boundary** - New ErrorBoundary.jsx with premium error UI
2. **Logger Utility** - Production-silent, development-verbose logging
3. **Accessibility System** - Comprehensive ARIA labels, focus trapping, keyboard navigation
4. **Design Tokens** - Complete CSS variables system with:
   - Full color palette (primary, wood, leather, accents)
   - Picasso swirl colors
   - Spacing scale (4px base)
   - Typography scale
   - Border radius scale
   - Shadow system
   - Transition presets
   - Z-index scale
5. **Consolidated CSS** - CommandCenter styles in dedicated file (1000+ lines)

### Files Created
- `/app/frontend/src/components/CommandCenter/styles.css` - Consolidated CSS (350 lines)
- `/app/frontend/src/components/CommandCenter/SettingsTab.jsx` - Extracted settings (memoized)
- `/app/frontend/src/components/CommandCenter/ImportTab.jsx` - Extracted import (memoized)
- `/app/frontend/src/components/CommandCenter/index.jsx` - Optimized entry point

### Remaining Technical Debt
- CommandCenter.jsx still has ~1800 lines of inline CSS (can be moved to styles.css)
- Consider extracting DashboardTab, CustomersTab, PrinterTab

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
