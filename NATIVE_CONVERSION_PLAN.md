# Supercharg'd - Native React Native/Expo Conversion Plan

## Executive Summary
Complete conversion of the web-based Supercharg'd automotive CRM to a fully native React Native/Expo application. Clean slate approach - NO web app remnants.

## Target Platforms
- iOS (native build)
- Android (native build)

## Design Philosophy
Preserve the Mercedes-Benz designo Interior Program aesthetic:
- Nappa leather textures with diamond-quilted patterns
- Burr walnut wood bezels
- Bird's-Eye Maple accents
- Brushed aluminum header rails
- Chrome accents
- Picasso hand-painted patterns (dark/light modes)
- 64-color ambient lighting system
- Premium automotive luxury feel

---

## Phase 1: Feature Inventory & Architecture Planning

### Web App Features to Convert

#### 1. **Customer Management**
- Customer list with search
- Customer detail view
- CRUD operations (Create, Read, Update, Delete)
- Customer cards with status badges (new, contacted, appointment)
- Quick add functionality
- License scan integration
- Customer profiles with all fields

#### 2. **VIN Scanner**
- Camera-based barcode scanning (12 formats)
- Windshield VIN detection
- Manual VIN entry
- NHTSA vPIC API integration
- VIN decode with confidence scoring
- Save to local inventory (150 max)
- Recent scans history
- Trade-in VIN/Mileage/VOI fields

#### 3. **License Scanner (Driver's License)**
- Camera-based OCR scanning
- PDF417 barcode scanning
- Upload from gallery
- Chunked file upload (for large images)
- 10 extraction fields:
  - First Name, Middle Name, Last Name
  - License #
  - Expiration Date
  - Date of Birth
  - Address, City, State, ZIP
- Manual field editing
- Confidence scoring
- Save to customer profile

#### 4. **Tower Talk (AI Assistant)**
- Situation input field
- 8 inquiry type pills:
  - New Lead
  - Price
  - Availability
  - Trade
  - Finance
  - Test Drive
  - Follow Up
  - Objection
- 3 preset chips (quick responses)
- AI response generation (GPT-4o-mini)
- Multiple response options
- Copy/Send/Save functionality
- SMS integration
- SPORT mode integration (translation)
- Context-aware responses (customer name, vehicle)

#### 5. **Translation System**
- Multi-language support: EN, ES (🇲🇽), FR (🇫🇷), KO (🇰🇷)
- Push-to-talk (PTT) voice translation
- Tap-to-start, tap-to-stop
- Auto-translation in SPORT mode
- Language selector in settings
- Translate button on responses
- Text-to-speech (TTS)
- Speech-to-text (STT)

#### 6. **Command Center**
- Modal-based interface
- 5 tabs:
  - **Dashboard**: Analytics, stats
  - **Customers**: List, search, CRUD
  - **Import**: File upload, Manual entry, Vision extraction
  - **Printer**: Printer setup, IP configuration, test connection
  - **Settings**: Language, Eco Mode, profiles, ambient lighting
- Rounded 28px corners
- Wood bezel frame
- Picasso swirl patterns

#### 7. **Print Center**
- Printer IP management
- Test printer connection
- Print customer profile
- Print license scan
- PDF generation
- Customer list for printing

#### 8. **Vehicle Inventory**
- Local inventory storage (150 max)
- Add vehicle manually
- Add from VIN scan
- Vehicle editor
- Recent vehicles
- Inventory wheel button (spinning animation)

#### 9. **IntakeHub**
- Centered modal
- 2 tabs: VIN, License
- Wood bezel styling
- Rounded corners (34-40px)
- Open VIN Scanner
- Open License Scanner

#### 10. **SPORT Mode**
- Fire button with flame effects
- Icon size change (20px → 60px when active)
- Label hide when active
- Sound profiles: merica, euro, jdm
- Fade-out effects
- Translation activation

#### 11. **Offline Sync**
- AsyncStorage queue
- Sync when online
- Offline mode detection
- Core UI available offline
- Queue for API calls

#### 12. **Admin Settings**
- Dealership profile
- User profile
- Engine sound profiles
- CRM integrations
- Field discovery profiles
- Webhook management

#### 13. **Ambient Lighting**
- 64-color cycling system
- 3 intensity levels: Subtle (4%), Medium (8%), Vivid (12%)
- 30-second full spectrum cycle
- Toggle on/off
- Persisted to storage
- Radial gradients on screen edges
- Card glow effects

---

## Phase 2: React Native Architecture Design

### Technology Stack
```
Core:
- React Native 0.81.5
- Expo SDK ~54
- React 19.1.0
- React Navigation 7.x

Camera & Media:
- expo-camera (barcode scanning)
- expo-image-picker (gallery uploads)
- expo-av (audio playback)
- expo-audio (recording)

Storage & Network:
- @react-native-async-storage/async-storage
- expo-network (connectivity detection)

UI & Gestures:
- react-native-gesture-handler
- react-native-reanimated
- expo-linear-gradient
- expo-haptics

Fonts & Assets:
- @expo-google-fonts/space-grotesk
- expo-font

Utilities:
- expo-clipboard
- expo-constants
```

### Navigation Structure
```
RootNavigator (Bottom Tabs)
├── HomeScreen (Customer list, selection)
├── IntakeScreen (VIN & License scanning)
└── Floating UI Elements:
    ├── FloatingButtonCluster (3 buttons)
    │   ├── CommandCenterModal (settings)
    │   ├── PrintCenterModal (printing)
    │   └── TowerTalkOverlay (AI assistant)
    ├── FloatingPttButton (voice translation)
    ├── FloatingCustomerButton (Bluetooth - customer modal)
    └── PttOverlayView (voice translation overlay)
```

### Context Providers
```
App.js
├── AppSettingsProvider (language, eco mode, ambient lighting)
├── PttProvider (push-to-talk state)
├── TaillightFlashProvider (brand animations)
├── CustomerProvider (NEW - customer management)
└── InventoryProvider (NEW - vehicle inventory)
```

### Screen Architecture
```
/src/
├── screens/
│   ├── HomeScreen.js ✅ (enhance with designo aesthetic)
│   ├── IntakeScreen.js ✅ (add designo styling)
│   ├── VinScanScreen.js ✅ (12 barcode types)
│   ├── DlScanScreen.js ✅ (OCR + chunked upload)
│   ├── CustomerListModal.js ✅ (enhance)
│   ├── PrintCenterModal.js ✅ (enhance)
│   └── VehicleEditorScreen.js ✅ (enhance)
├── components/
│   ├── InfotainmentShell.js ✅ (keep)
│   ├── BrandTaillights.js ✅ (keep)
│   ├── FloatingButtonCluster.js ✅ (keep)
│   ├── FloatingPttButton.js ✅ (keep)
│   ├── FloatingCustomerButton.js ✅ (keep)
│   ├── PttOverlayView.js ✅ (keep)
│   ├── CommandCenterModal.js (NEW - full implementation)
│   ├── TowerTalkOverlay.js ✅ (enhance with inquiry types, presets, SMS)
│   ├── InquiryTypeSelector.js (NEW)
│   ├── ResponseCards.js (NEW)
│   ├── AmbientLightingSystem.js (NEW)
│   ├── DesignoTextures.js (NEW)
│   ├── PicassoSwirls.js (NEW)
│   └── QuickAddButton.js (NEW)
├── context/
│   ├── AppSettingsContext.js ✅ (enhance)
│   ├── PttContext.js ✅ (keep)
│   ├── TaillightFlashContext.js ✅ (keep)
│   ├── CustomerContext.js (NEW)
│   └── InventoryContext.js (NEW)
├── hooks/
│   ├── useFontsReady.js ✅ (keep)
│   ├── useNetworkStatus.js (NEW)
│   ├── useOfflineSync.js (NEW)
│   └── useAmbientLighting.js (NEW)
├── lib/
│   ├── api.js ✅ (enhance with all endpoints)
│   ├── offlineQueue.js (NEW)
│   └── vinChecksum.js (NEW)
├── theme/
│   ├── colors.js ✅ (enhance with designo colors)
│   ├── typography.js ✅ (enhance)
│   ├── designo.js (NEW - leather, wood, metal textures)
│   └── picasso.js (NEW - hand-painted patterns)
└── utils/
    ├── chunkedUpload.js (NEW)
    ├── vinScoring.js (NEW)
    ├── licenseOcr.js (NEW)
    └── soundProfiles.js (NEW)
```

---

## Phase 3: Implementation Roadmap

### Sprint 1: Foundation & Core Architecture (Days 1-2)
**Goal**: Set up clean React Native foundation with backend connectivity

**Tasks**:
1. ✅ Review existing mobile app structure
2. ⬜ Clean up unnecessary files
3. ⬜ Set up enhanced theme system (designo colors, typography)
4. ⬜ Create CustomerContext and InventoryContext
5. ⬜ Enhance api.js with all backend endpoints
6. ⬜ Test backend connectivity
7. ⬜ Set up offline queue system
8. ⬜ Create utility functions (vinChecksum, chunkedUpload)

**Success Criteria**:
- App loads with clean architecture
- Backend API calls work
- Offline queue functional
- Theme system in place

---

### Sprint 2: Customer Management (Days 3-4)
**Goal**: Full customer CRUD with designo aesthetic

**Tasks**:
1. ⬜ Enhance HomeScreen with customer list
2. ⬜ Add customer search functionality
3. ⬜ Create customer detail view
4. ⬜ Add customer form (create/edit)
5. ⬜ Implement QuickAddButton
6. ⬜ Add designo textures (quilted leather, wood)
7. ⬜ Add customer status badges
8. ⬜ Implement customer deletion
9. ⬜ Add loading states and error handling

**Success Criteria**:
- Customer list loads from backend
- Search works correctly
- Create/edit/delete operations functional
- Designo aesthetic applied
- Offline queue for customer changes

**Testing**: Backend + Frontend comprehensive testing

---

### Sprint 3: VIN Scanner Enhancement (Days 5-6)
**Goal**: World-class VIN scanning with 12 barcode types

**Tasks**:
1. ⬜ Enhance VinScanScreen with 12 barcode types:
   - code39, code128, code93, datamatrix, qr
   - ean13, ean8, pdf417, upc_e, aztec
   - interleaved2of5, itf14
2. ⬜ Add windshield detection UI (camera guide)
3. ⬜ Implement manual VIN entry
4. ⬜ Add VIN checksum validation
5. ⬜ Add confidence scoring
6. ⬜ Create recent scans list
7. ⬜ Implement save to inventory
8. ⬜ Add Trade-in VIN/Mileage/VOI fields
9. ⬜ Test NHTSA vPIC integration

**Success Criteria**:
- All 12 barcode types detected
- Windshield VINs decoded correctly
- Manual entry validated
- Saves to inventory (150 max)
- Recent scans displayed

**Testing**: Backend + Frontend comprehensive testing

---

### Sprint 4: License Scanner (Days 7-8)
**Goal**: Enterprise-grade license scanning with OCR

**Tasks**:
1. ⬜ Enhance DlScanScreen with camera view
2. ⬜ Implement PDF417 barcode scanning
3. ⬜ Add gallery upload functionality
4. ⬜ Implement chunked upload for large images
5. ⬜ Add extraction panel with 10 fields
6. ⬜ Implement manual field editing
7. ⬜ Add confidence scoring UI
8. ⬜ Add scan method badges (PDF417/OCR)
9. ⬜ Implement "Save to Customer Profile"
10. ⬜ Test backend OCR integration

**Success Criteria**:
- Camera scanning works
- PDF417 barcode decoded
- Gallery uploads processed
- Chunked upload for 5MB+ images
- All 10 fields extracted
- Manual editing functional
- Saves to customer profile

**Testing**: Backend + Frontend comprehensive testing

---

### Sprint 5: Tower Talk AI Assistant (Days 9-11)
**Goal**: Full-featured AI assistant with inquiry types, presets, SMS

**Tasks**:
1. ⬜ Create TowerTalkOverlay (full modal)
2. ⬜ Add situation input field
3. ⬜ Create InquiryTypeSelector (8 pills)
4. ⬜ Add 3 preset chips
5. ⬜ Implement AI generation (GPT-4o-mini)
6. ⬜ Create ResponseCards component
7. ⬜ Add Copy/Send/Save buttons
8. ⬜ Implement SMS integration
9. ⬜ Add SPORT mode translation
10. ⬜ Add context injection (customer name, vehicle)
11. ⬜ Test multi-language responses (EN/ES/FR/KO)

**Success Criteria**:
- Situation input works
- All 8 inquiry types functional
- Presets clickable
- AI generates responses
- Copy/Send/Save work
- SMS sends correctly
- Translation in SPORT mode
- All languages tested

**Testing**: Backend + Frontend comprehensive testing (all languages)

---

### Sprint 6: Translation System & PTT (Days 12-13)
**Goal**: World-class voice translation

**Tasks**:
1. ⬜ Enhance FloatingPttButton with SPORT mode integration
2. ⬜ Enhance PttOverlayView with language badges
3. ⬜ Implement tap-to-start, tap-to-stop
4. ⬜ Add recording visualization
5. ⬜ Test speech-to-text (Whisper)
6. ⬜ Test translation API (all languages)
7. ⬜ Test text-to-speech (TTS)
8. ⬜ Add auto-translation toggle
9. ⬜ Test all language pairs: EN↔ES, EN↔FR, EN↔KO

**Success Criteria**:
- PTT button responsive
- Recording works
- STT accurate
- Translation correct (all languages)
- TTS plays back
- No stuck states

**Testing**: Frontend comprehensive testing (all languages)

---

### Sprint 7: Command Center (Days 14-16)
**Goal**: Full Command Center with all tabs

**Tasks**:
1. ⬜ Create CommandCenterModal shell
2. ⬜ Implement tab navigation (5 tabs)
3. ⬜ **Dashboard Tab**: Stats, analytics
4. ⬜ **Customers Tab**: List, search, CRUD
5. ⬜ **Import Tab**: 3 circular buttons (W140 instrument cluster)
   - File Upload (CSV/JSON)
   - Manual Entry
   - Vision Extraction (GPT Vision)
6. ⬜ **Printer Tab**: IP setup, test connection, save
7. ⬜ **Settings Tab**: 
   - Language selector (4 flags)
   - Eco Mode toggle
   - Dealership profile
   - User profile
   - Engine sound profiles
   - Ambient lighting controls
8. ⬜ Apply designo aesthetic:
   - 28px rounded corners
   - Wood bezel frame
   - Picasso swirl patterns
   - Nappa leather texture

**Success Criteria**:
- All 5 tabs functional
- Dashboard shows stats
- Customers CRUD works
- Import all 3 methods work
- Printer IP saves and tests
- Settings persist to AsyncStorage
- Designo aesthetic complete

**Testing**: Backend + Frontend comprehensive testing

---

### Sprint 8: Print Center (Days 17-18)
**Goal**: Full printing functionality

**Tasks**:
1. ⬜ Enhance PrintCenterModal
2. ⬜ Add customer list for printing
3. ⬜ Add printer IP display
4. ⬜ Implement print customer profile
5. ⬜ Implement print license scan
6. ⬜ Test PDF generation backend
7. ⬜ Add loading states
8. ⬜ Add print success/failure feedback

**Success Criteria**:
- Customer list loads
- Printer IP displayed
- Print customer works
- Print license works
- PDF generation tested
- Error handling robust

**Testing**: Backend + Frontend comprehensive testing

---

### Sprint 9: Vehicle Inventory (Days 19-20)
**Goal**: Local inventory management (150 max)

**Tasks**:
1. ⬜ Create InventoryContext
2. ⬜ Enhance VehicleEditorScreen
3. ⬜ Add vehicle list view
4. ⬜ Add vehicle detail view
5. ⬜ Implement add vehicle manually
6. ⬜ Implement add from VIN scan
7. ⬜ Add recent vehicles section
8. ⬜ Implement 150-vehicle limit
9. ⬜ Add inventory wheel button animation
10. ⬜ Test backend inventory endpoints

**Success Criteria**:
- Inventory list displays
- Add vehicle works (manual + VIN)
- Edit vehicle works
- Delete vehicle works
- 150-vehicle limit enforced
- Recent vehicles shown
- Wheel animation smooth

**Testing**: Backend + Frontend comprehensive testing

---

### Sprint 10: Ambient Lighting & Visual Polish (Days 21-22)
**Goal**: Mercedes designo luxury aesthetic

**Tasks**:
1. ⬜ Create AmbientLightingSystem component
2. ⬜ Implement 64-color cycling (30-second cycle)
3. ⬜ Add 3 intensity levels (Subtle, Medium, Vivid)
4. ⬜ Add radial gradients on screen edges
5. ⬜ Add card glow effects
6. ⬜ Implement toggle in Settings
7. ⬜ Persist to AsyncStorage
8. ⬜ Create DesignoTextures component:
   - Quilted leather (diamond pattern)
   - Burr walnut wood (grain, swirls)
   - Bird's-Eye Maple (honey, eye patterns)
   - Brushed aluminum (horizontal brushing)
   - Chrome accents (high-polish)
9. ⬜ Create PicassoSwirls component:
   - Dark mode: Burgundy + teal
   - Light mode: Dusty rose + sage green
10. ⬜ Apply to all components

**Success Criteria**:
- 64-color ambient lighting cycles
- 3 intensity levels work
- Toggle persists
- Designo textures on customer cards
- Picasso swirls on inquiry buttons
- Wood bezels on modals
- Premium luxury feel

**Testing**: Visual inspection + Frontend testing

---

### Sprint 11: SPORT Mode & Sound Design (Days 23-24)
**Goal**: Audio feedback and SPORT mode polish

**Tasks**:
1. ⬜ Enhance SPORT button in header
2. ⬜ Implement icon size change (20px → 60px)
3. ⬜ Add label hide when active
4. ⬜ Add flame effects
5. ⬜ Implement sound profiles:
   - merica (American V8)
   - euro (European exotic)
   - jdm (Japanese turbo)
6. ⬜ Add fade-out effects (1.2s ease-out)
7. ⬜ Connect to translation system
8. ⬜ Test in all languages

**Success Criteria**:
- SPORT button animates correctly
- Sound profiles play
- Fade-out smooth
- Translation activates in SPORT mode
- All languages tested

**Testing**: Frontend comprehensive testing

---

### Sprint 12: Offline Sync & Error Handling (Days 25-26)
**Goal**: Robust offline functionality

**Tasks**:
1. ⬜ Enhance offline queue system
2. ⬜ Add network status detection
3. ⬜ Implement sync on reconnect
4. ⬜ Add offline indicators
5. ⬜ Add error boundaries
6. ⬜ Add retry logic
7. ⬜ Add loading states everywhere
8. ⬜ Add success/failure toasts
9. ⬜ Test offline scenarios

**Success Criteria**:
- Offline detection works
- Queue stores operations
- Sync on reconnect works
- UI shows offline state
- Error handling graceful
- Retry logic functional

**Testing**: Frontend comprehensive testing

---

### Sprint 13: Final Polish & Bug Fixes (Days 27-28)
**Goal**: Production-ready quality

**Tasks**:
1. ⬜ Review all screens for designo aesthetic
2. ⬜ Review all fonts (Space Grotesk)
3. ⬜ Review all colors (designo palette)
4. ⬜ Review all animations (smooth, premium)
5. ⬜ Review all loading states
6. ⬜ Review all error messages
7. ⬜ Review all accessibility (labels, focus)
8. ⬜ Review all haptic feedback
9. ⬜ Fix any bugs from testing
10. ⬜ Optimize performance

**Success Criteria**:
- All screens match designo aesthetic
- All features work perfectly
- No bugs
- Smooth animations
- Fast performance
- Accessible UI

**Testing**: Most stringent testing possible

---

### Sprint 14: Comprehensive Testing (Days 29-30)
**Goal**: World-class quality assurance

**Testing Matrix**:

#### Backend Testing
- [ ] Customer endpoints (list, create, update, delete)
- [ ] VIN endpoints (decode, save to inventory)
- [ ] License endpoints (scan, chunked upload, create customer)
- [ ] Tower Talk endpoint (AI generation)
- [ ] Translation endpoint (all language pairs)
- [ ] TTS endpoint (all languages)
- [ ] Print endpoints (customer, license)
- [ ] Printer test endpoint
- [ ] Vehicle inventory endpoints
- [ ] Dashboard stats endpoint
- [ ] Health check

#### Frontend Testing
- [ ] HomeScreen (customer list, search, selection)
- [ ] IntakeScreen (tab navigation, modal opening)
- [ ] VinScanScreen (12 barcode types, manual entry, save)
- [ ] DlScanScreen (camera, gallery, extraction, save)
- [ ] TowerTalkOverlay (inquiry types, presets, AI generation, copy/send/save)
- [ ] CommandCenterModal (all 5 tabs, all functionality)
- [ ] PrintCenterModal (customer list, printing)
- [ ] CustomerListModal (Bluetooth button, license scans, manual add)
- [ ] VehicleEditorScreen (add, edit, delete)
- [ ] PttOverlayView (recording, STT, translation, TTS)
- [ ] FloatingButtonCluster (all 3 buttons)
- [ ] SPORT mode (activation, sound, translation)
- [ ] Ambient lighting (cycling, intensity, toggle)

#### Multi-Language Testing
- [ ] English (EN) - all features
- [ ] Spanish (ES 🇲🇽) - all features
- [ ] French (FR 🇫🇷) - all features
- [ ] Korean (KO 🇰🇷) - all features

#### Edge Cases
- [ ] Offline mode (all features)
- [ ] Slow network (timeouts, retries)
- [ ] Large images (chunked upload)
- [ ] 150-vehicle limit (inventory)
- [ ] Empty states (no customers, no vehicles)
- [ ] Error states (API failures)
- [ ] Permission denials (camera, microphone)

**Success Criteria**:
- 100% feature coverage
- All languages tested
- All edge cases handled
- Zero crashes
- Smooth performance
- Production-ready

---

## Phase 4: Cleanup & Deployment Preparation

### Tasks
1. ⬜ Remove `/app/frontend/` directory completely
2. ⬜ Update `/app/README.md` with mobile app instructions
3. ⬜ Update `/app/mobile/README.md` with full documentation
4. ⬜ Remove Capacitor from package.json
5. ⬜ Remove Vite, React-DOM, web dependencies
6. ⬜ Clean up any web-specific files
7. ⬜ Update backend CORS for mobile app
8. ⬜ Configure Expo EAS Build for iOS
9. ⬜ Configure Expo EAS Build for Android
10. ⬜ Test builds on physical devices

---

## Backend Endpoints Reference

### Customer Endpoints
- `GET /api/customers/list?limit=50&skip=0` - List customers
- `POST /api/customers/create` - Create customer
- `GET /api/customers/{id}` - Get customer
- `PATCH /api/customers/{id}` - Update customer
- `DELETE /api/customers/{id}` - Delete customer
- `GET /api/customers/stats` - Customer statistics

### VIN Endpoints
- `POST /api/vin/decode/{vin}` - Decode VIN
- `POST /api/vin/save-to-inventory` - Save to inventory
- `GET /api/vehicles/inventory` - Get inventory

### License Endpoints
- `POST /api/license/upload/init` - Init chunked upload
- `POST /api/license/upload/chunk` - Upload chunk
- `POST /api/license/upload/complete` - Complete upload
- `POST /api/license/scan` - Scan license (OCR)
- `POST /api/license/create-customer` - Create customer from license

### Tower Talk Endpoints
- `POST /api/tower-talk` - Generate AI response
- `POST /api/translate` - Translate text
- `POST /api/tts` - Text-to-speech

### Print Endpoints
- `POST /api/printer/test` - Test printer connection
- `POST /api/print/customer` - Print customer profile
- `POST /api/print/license` - Print license

### Other Endpoints
- `GET /api/health` - Health check
- `GET /api/dashboard/stats` - Dashboard stats

---

## Success Metrics

### Performance
- App launch < 2 seconds
- Screen transitions < 300ms
- Camera open < 500ms
- API calls < 2 seconds
- Smooth 60fps animations

### Quality
- Zero crashes
- Zero console errors
- Zero memory leaks
- All features working
- All tests passing

### User Experience
- Intuitive navigation
- Clear loading states
- Helpful error messages
- Responsive UI
- Premium feel

---

## Risk Mitigation

### High-Risk Areas
1. **Camera Performance**: Test on older devices
2. **OCR Accuracy**: Fallback to manual entry
3. **Network Reliability**: Robust offline queue
4. **Large Image Uploads**: Chunked upload tested
5. **Multi-Language**: All languages tested thoroughly

### Fallback Plans
- Manual entry for failed scans
- Offline queue for network issues
- Error boundaries for crashes
- Retry logic for failed API calls
- Graceful degradation for missing features

---

## Timeline Summary

- **Sprint 1-2**: Foundation & Customer Management (4 days)
- **Sprint 3-4**: Scanning Features (4 days)
- **Sprint 5-6**: AI & Translation (4 days)
- **Sprint 7-8**: Command Center & Print (4 days)
- **Sprint 9-10**: Inventory & Visual Polish (4 days)
- **Sprint 11-12**: SPORT Mode & Offline (4 days)
- **Sprint 13-14**: Polish & Testing (4 days)

**Total Estimated Time**: 28-30 days

---

## Notes

- Backend remains unchanged (FastAPI + MongoDB)
- All API contracts preserved
- Environment variables: REACT_APP_BACKEND_URL → EXPO_PUBLIC_BACKEND_URL
- AsyncStorage replaces localStorage
- React Native components replace web components
- Expo APIs replace web APIs (Camera, Audio, etc.)
- Testing after each sprint before moving forward

---

## Deliverables

1. ✅ Fully native React Native/Expo app
2. ✅ iOS build configuration
3. ✅ Android build configuration
4. ✅ Complete documentation
5. ✅ All features from web app
6. ✅ Mercedes designo aesthetic
7. ✅ 100% test coverage
8. ✅ Zero web app remnants

---

**Status**: Ready to Begin
**Next Step**: Sprint 1 - Foundation & Core Architecture
