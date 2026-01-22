# Supercharg'd - Product Requirements Document

## Original Problem Statement
Build an offline-capable, instant-use "sales weapon" application for automotive sales representatives. The application features AI-powered sales assistance with proven persuasion psychology, CRM integration, and a highly stylized UI with a "GTA Vice City" meets high-end automotive aesthetic.

## Target Users
- Automotive sales representatives
- Car dealership staff
- Sales managers

## Core Features

### Data Entry & Integration System
- **File Upload**: CSV and Excel (.xlsx) import for bulk customers/vehicles
- **Email Parsing**: AI-powered lead email parsing with auto-customer creation
- **Manual Entry**: Premium liquid glass forms for customers and vehicles
- **CRM Integration**: Connect via API keys to VinSolutions, DealerSocket, eLeadCRM, custom APIs

### Vehicle Database
- **Active Inventory**: Vehicles for sale on lot
- **Trade-Ins**: Customer trade-in vehicles (linked to customer profiles)
- **VIN Scanner**: Enterprise-grade scanner with windshield mode, torch support, barcode formats
- **Full NHTSA Data**: Engine, transmission, safety features, assembly location

### Customer Profiles
- Store: Name, Address, Phone, Email, Lead Source, Lead Status
- **License Image**: Driver's license image saved to profile (NEW)
- Notes with interaction history tracking
- Attach up to 2 vehicles of interest per customer
- Link trade-in vehicles to customers
- Priority sorting (HOT, WARM, NEW, COLD)
- Animated priority badges

### Intake Scanner (ENTERPRISE-GRADE - Superior to VinSolutions)

**Driver's License Scanner:**
- **AI-Powered OCR**: GPT-4o Vision extracts name & address with high accuracy
- **Confidence Scoring**: Shows extraction confidence % (high/medium/low)
- **Name Normalization**: Auto-converts JOHN DOE → John Doe
- **State Normalization**: Auto-converts California → CA
- **Extraction Notes**: Alerts for partial extractions or areas needing verification
- **Retry Mechanisms**: User-friendly retry flow for failed scans
- **Image Quality Validation**: Rejects too-small or too-large images with helpful messages
- **Progress Indicators**: Multi-step progress display during scan
- **Error Handling**: Graceful timeout handling, rate limit handling

**VIN Scanner:**
- **ISO 3779 Checksum Validation**: Real-time checksum verification
- **WMI Region Detection**: Shows region (North America, Europe, Asia, etc.)
- **Year Detection**: Pre-decodes model year from 10th character
- **NHTSA Database Integration**: Official US Government vehicle data
- **Confidence Scoring**: 0-100% based on checksum + data completeness
- **Safety Features Display**: Lists airbags, ABS, ESC, backup camera, etc.
- **Engine & Location Info**: Formatted engine display, assembly location
- **Recent Scans History**: Quick access to previously scanned VINs
- **Duplicate Detection**: Prevents saving same VIN twice

**Shared Features:**
- **Haptic Feedback**: Tactile feedback on interactions
- **Loading States**: Progress messages for every operation
- **Offline-Capable**: Graceful degradation with clear error messages
- **Enterprise UI**: Premium dark theme with animations

### AI Integration (Enhanced with Persuasion Psychology)
- **Tower Talk**: AI-powered conversation assistance using OpenAI GPT
- **Persuasion Tactics**: Built-in sales psychology
- **Quick Response Shortcuts**: 8 pre-defined responses for common scenarios
- **Supercharg'd Mode (Sport Mode)**: Language translation feature (5 languages)
- **Voice Translator**: Enterprise-grade PTT with MediaRecorder + OpenAI Whisper

### Eject Feature (Enhanced)
- Send customer profile snapshot via SMS
- **NEW**: Includes license image as MMS attachment when present
- Includes: Name, Phone, Email, Status, Vehicles of Interest, Trade-In info

### Authentication System
- JWT-based authentication
- Secure registration and login
- Password hashing with bcrypt
- Skip option for quick access

---

## What's Been Implemented (as of January 22, 2026)

### Intake Scanner Feature ✅ (January 22, 2026)
**Completed comprehensive Intake Scanner implementation with OCR:**

- **License OCR Extraction**: AI (GPT-4o Vision) extracts first name, last name, address, city, state, zip
- **Editable Form**: Review and edit extracted data before saving
- **Combined Intake Modal**: Single entry point for VIN and License scanning
- **Customer Creation**: Auto-create customer from extracted license data with image attached
- **Existing Customer Attach**: Option to attach license to existing customer profile
- **Backend Endpoints**:
  - `POST /api/license/scan` - Upload + OCR extraction with GPT-4o Vision
  - `POST /api/license/create-customer` - Create customer from extracted data
  - `POST /api/license/upload` - Simple upload without OCR
  - `POST /api/license/attach` - Attach previously uploaded license to customer
  - `GET /api/uploads/{filename}` - Serve uploaded license images
- **Eject Enhancement**: License image included in MMS when present on customer
- **Enterprise UI**: Premium styling matching luxury automotive aesthetic

### Enterprise-Grade Quality Pass ✅
**Completed comprehensive 10/10 quality improvements:**

#### Accessibility (WCAG 2.1 AA)
- Skip link for keyboard navigation
- Screen reader announcements
- Focus trap for modals
- Proper ARIA labels throughout

#### Error Handling
- ErrorBoundary component wrapping app and sections
- Graceful error recovery with retry options
- Development-mode error details

#### Loading States
- Skeleton loaders (cards, customers, VIN results)
- Full-screen loader with animated dots
- Progress bar component

#### Empty States
- No Customers illustration
- No Vehicles illustration
- Offline State with retry

#### Haptic Feedback System
- Light, Medium, Heavy feedback types
- Success, Warning, Error patterns
- iOS audio click fallback

### Voice Translator Enhancement ✅
- **MediaRecorder-based audio capture** - Bypasses buggy Web Speech API
- **Backend Whisper transcription** - `/api/voice-translate` endpoint
- Language indicator badge
- Recording timer and visual feedback
- Auto-stop after 30 seconds

### VIN Scanner Enhancement ✅
- Windshield scanning mode with visual overlay
- Torch/flashlight toggle for low-light
- Multiple barcode format support
- Real-time VIN validation
- Recent scans history
- Confidence score display
- Safety features display

---

## Prioritized Backlog

### P0 (Critical) - COMPLETED
- [x] Enterprise-grade quality pass
- [x] VIN Scanner windshield mode
- [x] Authentication system
- [x] Intake Scanner with License capture

### P1 (High)
- [ ] Real CRM integration (backend stubs exist)
- [ ] Batch VIN scan mode for lot inventory
- [ ] Push notifications

### P2 (Medium)
- [ ] Response analytics dashboard
- [ ] Offline data sync
- [ ] User verification of PTT on iOS device

### P3 (Low)
- [ ] Custom themes
- [ ] Export reports
- [ ] Team management

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
- File uploads stored in `/app/backend/uploads/`

### Security
- Password hashing (bcrypt)
- Rate limiting
- Secure headers
- Input validation

---

## Test Status
- **Last Test**: iteration_17.json
- **Result**: 100% pass rate (12/12 backend tests, all frontend UI verified)
- **Coverage**: 
  - License upload, attach, and serving endpoints
  - VIN decode endpoint
  - Eject preview endpoint
  - Frontend Intake Scanner modal and flows

---

## 3rd Party Integrations
- **OpenAI GPT-4o-mini**: Tower Talk and Translation
- **OpenAI Whisper**: Speech-to-text for voice translation
- **Capacitor / Capacitor MLKit**: Native mobile wrapping and barcode scanning
- **Twilio**: SMS/MMS for Eject feature (requires configuration)
- **NHTSA vPIC API**: VIN decoding

---

## Pending User Verification
1. **Push-to-Talk (PTT)**: Re-architected with MediaRecorder + Whisper - needs iOS device testing
2. **Sport Mode "Translate" Button**: Fixed to always be visible - needs user verification
