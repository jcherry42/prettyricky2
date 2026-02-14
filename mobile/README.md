# Supercharg'd - Pure Native Mobile App (iOS/Android)

## Overview
This is a **PURE NATIVE MOBILE APPLICATION** built with React Native and Expo. It is NOT a web app or PWA.

---

## ✅ Recent Fixes Implemented (Feb 15, 2026)

### 1. Command Center Language Pills
- **File:** `/app/mobile/src/components/CommandCenterModal.js`
- **Change:** Reduced gap from 8px to 2px between language selector pills
- **Result:** Tighter, fuller row appearance for ES/FR/KO language options

### 2. Bluetooth Button Icon Centering
- **File:** `/app/mobile/src/components/FloatingCustomerButton.js`
- **Change:** Optimized icon positioning for perfect centering on blue orb
- **Result:** Bluetooth icon perfectly aligned on 56px button

### 3. Tower Talk Multi-Language Crash Prevention
- **File:** `/app/mobile/src/components/TowerTalkOverlay.js`
- **Changes:**
  - Comprehensive null checks for API responses
  - Enhanced error handling with detailed context
  - 15-second timeout for translations
  - Validates empty responses and invalid language codes
  - In-overlay error display (no white screens)
  - No auto-fallback to English
- **Languages:** EN, ES, FR, KO all crash-protected

### 4. VIN Scanner Enhancement
- **File:** `/app/mobile/src/screens/VinScanScreen.js`
- **Change:** Expanded from 2 to 12 barcode formats
- **New Formats:** code93, datamatrix, qr, ean13, ean8, pdf417, upc_e, aztec, interleaved2of5, itf14
- **Result:** Robust VIN capture from windshield area

### 5. Customer Profile Fields
- Trade In VIN [17 chars] ✅
- Trade In Mileage [xxx,xxx] ✅
- VOI VIN [17 chars] ✅
- **Status:** Already implemented and working

---

## 🏗️ Architecture

### App Structure
```
/app/mobile/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── CommandCenterModal.js     # Settings & printers modal
│   │   ├── FloatingCustomerButton.js # Bluetooth customer button
│   │   ├── TowerTalkOverlay.js       # AI response generator
│   │   └── ...
│   ├── screens/          # Screen components
│   │   ├── HomeScreen.js
│   │   ├── IntakeScreen.js
│   │   ├── VinScanScreen.js
│   │   ├── CustomerListModal.js
│   │   └── ...
│   ├── navigation/       # React Navigation setup
│   ├── context/          # React Context providers
│   ├── lib/             # Utility functions & API calls
│   ├── theme/           # Colors, typography, layout
│   └── hooks/           # Custom React hooks
├── assets/              # Images, icons, fonts
├── App.js              # Root component
├── index.js            # Entry point
├── app.json            # Expo configuration (iOS/Android ONLY)
├── package.json        # Dependencies (NO web packages)
└── eas.json            # EAS Build configuration
```

---

## 📱 Platform Support

### Supported Platforms
- ✅ **iOS** (iPhone/iPad)
- ✅ **Android** (phones/tablets)
- ❌ **Web** (Not supported - pure native only)

### Platform-Specific Features
- **iOS:** Camera permission for VIN/DL scanning, microphone for voice
- **Android:** Camera & audio permissions

---

## 🚀 Development Setup

### Prerequisites
- Node.js 18+
- Yarn package manager
- Expo CLI
- iOS: Xcode (macOS only)
- Android: Android Studio

### Installation
```bash
cd /app/mobile
yarn install
```

### Run Development
```bash
# Start Expo dev server
yarn start

# Run on iOS simulator (macOS only)
yarn ios

# Run on Android emulator
yarn android

# Scan QR code with Expo Go app for physical device testing
```

---

## 🔨 Building for Production

### Using EAS Build (Recommended)

#### Prerequisites
```bash
npm install -g eas-cli
eas login
```

#### Build iOS
```bash
cd /app/mobile
eas build --platform ios --profile production
```

#### Build Android
```bash
cd /app/mobile
eas build --platform android --profile production
```

### Build Profiles
- **development:** Development builds with dev client
- **preview:** Internal testing builds (APK for Android)
- **production:** Production builds for App Store/Play Store

---

## 📦 Key Dependencies

### Core
- `expo` ~54.0.33 - Expo framework
- `react-native` 0.81.5 - React Native core
- `react` 19.1.0 - React library

### Navigation
- `@react-navigation/native` - Navigation framework
- `@react-navigation/native-stack` - Stack navigator
- `@react-navigation/bottom-tabs` - Tab navigator

### UI & Styling
- `@expo-google-fonts/space-grotesk` - Space Grotesk font family
- `@expo/vector-icons` - Icon library (Ionicons, etc.)
- `expo-linear-gradient` - Gradient components
- `react-native-gesture-handler` - Touch gestures
- `react-native-reanimated` - Animations

### Device Features
- `expo-barcode-scanner` - VIN barcode scanning
- `expo-camera` - Camera access for scanning
- `expo-clipboard` - Clipboard operations
- `expo-haptics` - Haptic feedback
- `expo-audio` & `expo-av` - Audio playback for TTS

### Data & Storage
- `@react-native-async-storage/async-storage` - Local storage

---

## 🎨 Features

### Core Functionality
1. **Command Center**
   - Settings management
   - Language selection (ES/FR/KO)
   - Printer configuration
   - Eco mode toggle

2. **Tower Talk** (AI Response Generator)
   - Multi-language support (EN/ES/FR/KO)
   - 8 inquiry types (New Lead, Price, Avail, Trade, Finance, Test, Follow, Obj)
   - 3 preset responses per inquiry type
   - Translation to target language
   - Text-to-speech playback
   - SMS integration

3. **VIN Scanner**
   - Camera barcode scanning (12 formats)
   - Manual VIN entry
   - NHTSA VIN decoding
   - Automatic inventory addition
   - Scan history

4. **Customer Management**
   - Driver's license scanning
   - Manual customer entry
   - Trade-in VIN capture
   - Trade-in mileage tracking
   - VOI (Vehicle of Interest) VIN

5. **Print Center**
   - Network printer configuration
   - Customer profile printing
   - License document printing

---

## 🧪 Testing

### Test on Physical Devices

#### iOS (via Expo Go)
1. Install Expo Go from App Store
2. Run `yarn start`
3. Scan QR code with Camera app
4. Opens in Expo Go

#### Android (via Expo Go)
1. Install Expo Go from Play Store
2. Run `yarn start`
3. Scan QR code with Expo Go app

### Test on Simulators/Emulators

#### iOS Simulator
```bash
yarn ios
```

#### Android Emulator
```bash
yarn android
```

---

## 🔐 Permissions

### iOS (Info.plist)
- `NSCameraUsageDescription` - VIN and license scanning
- `NSMicrophoneUsageDescription` - Voice translation

### Android (AndroidManifest.xml)
- `CAMERA` - VIN and license scanning
- `RECORD_AUDIO` - Voice translation

---

## 🌐 Backend Integration

### API Configuration
- Backend URL configured in `/app/mobile/src/config/backend.js`
- All API calls use `apiFetch` wrapper from `/app/mobile/src/lib/api.js`

### Key Endpoints
- `POST /api/tower-talk` - AI response generation
- `POST /api/translate` - Text translation
- `POST /api/tts` - Text-to-speech
- `POST /api/vin/decode/{vin}` - VIN decoding
- `POST /api/license/scan` - License OCR
- `GET /api/customers` - Customer list
- `POST /api/printer/test` - Printer connectivity test

---

## 📝 Configuration Files

### app.json
- Expo configuration
- Platform-specific settings (iOS/Android)
- Permissions declarations
- App metadata

### eas.json
- EAS Build configuration
- Build profiles (development/preview/production)
- Platform-specific build settings

### package.json
- Dependencies (NATIVE ONLY - no web packages)
- Scripts for development and building

---

## 🐛 Known Issues & Solutions

### Issue: Fonts not loading
**Solution:** Fonts are native assets loaded via `useFonts` hook. Ensure `useFontsReady` hook completes before rendering.

### Issue: Camera not working
**Solution:** Ensure permissions are granted. Check Info.plist (iOS) and AndroidManifest.xml (Android).

### Issue: Barcode scanner not detecting VINs
**Solution:** Updated to support 12 barcode formats. Ensure proper lighting and steady camera.

---

## 📚 Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [React Navigation](https://reactnavigation.org/)

---

## 🎯 Next Steps

1. **Test on Physical Devices:** Use Expo Go for testing
2. **Build Preview APK/IPA:** Test internal builds
3. **Submit to Stores:** Production builds for App Store & Play Store

---

## ✅ Configuration Status

- ✅ Pure native mobile app (iOS/Android only)
- ✅ Web platform removed from configuration
- ✅ Native dependencies only (no react-dom, no react-native-web)
- ✅ EAS Build configured for iOS/Android
- ✅ All 4 requested fixes implemented in source code
- ✅ Camera & audio permissions configured
- ✅ Ready for native testing and deployment
