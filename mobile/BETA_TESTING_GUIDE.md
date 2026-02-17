# Supercharg'd — Beta Testing Guide

## Overview
Supercharg'd is a premium automotive CRM tool built with React Native / Expo.
Target platforms: **iOS** and **Android**.

---

## Prerequisites

1. **Node.js** >= 18
2. **Yarn** (package manager)
3. **Expo CLI**: `npm install -g eas-cli`
4. **Expo Account**: Sign up at https://expo.dev
5. **Apple Developer Account** (for iOS builds)
6. **Backend deployed** and accessible from the test device

---

## Quick Start (Development Build via Expo Go)

```bash
cd /app/mobile

# 1. Install dependencies
yarn install

# 2. Set your backend URL
cp .env.example .env
# Edit .env and set EXPO_PUBLIC_BACKEND_URL to your backend URL

# 3. Start Expo dev server
npx expo start

# 4. Scan the QR code with:
#    - iOS: Camera app → opens Expo Go
#    - Android: Expo Go app → scan QR
```

---

## Building for Real Devices (EAS Build)

### Android APK (for internal testers)
```bash
# Login to Expo
eas login

# Build preview APK
eas build --platform android --profile preview

# Download the .apk and install on device
```

### iOS (TestFlight / Internal Distribution)
```bash
# Build for internal distribution (ad-hoc)
eas build --platform ios --profile preview

# OR build for TestFlight
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

### Development Client (for debugging)
```bash
# iOS Simulator
eas build --platform ios --profile development

# Android device
eas build --platform android --profile development
```

---

## Environment Configuration

| Variable | Description | Example |
|---|---|---|
| `EXPO_PUBLIC_BACKEND_URL` | Backend API base URL | `https://api.superchargd.com` |

---

## Features to Test

### Core Features
- [ ] **Customer Management**: Create, edit, delete, search customers
- [ ] **VIN Scanner**: Camera scan + manual entry + VIN decode
- [ ] **License Scanner**: Camera capture + OCR + manual edit + save to customer
- [ ] **Tower Talk AI**: Generate sales responses, translate, speak, copy, SMS
- [ ] **Quick Compose**: Write message, translate (SPORT mode), send SMS/email
- [ ] **Emergency Responses**: 8 inquiry types, 3 responses each, copy/SMS/translate

### Translation System
- [ ] **SPORT Mode**: Activate → auto-translate enabled
- [ ] **Languages**: Spanish, French, Korean
- [ ] **Master Control**: Settings language is the only source of truth
- [ ] **Quick Compose translate**: Visible only in SPORT mode
- [ ] **Emergency Modal translate**: Visible only in SPORT mode

### UI/UX
- [ ] **Portrait Lock**: App stays portrait on all orientations
- [ ] **Ambient Lighting**: Color cycling animation on HomeScreen
- [ ] **Sound Profiles**: V8 / Euro / JDM activation sounds
- [ ] **Haptic Feedback**: Taps, button presses, notifications
- [ ] **Offline Support**: Banner appears, queue syncs when back online
- [ ] **Toast Notifications**: Success, error, offline messages
- [ ] **Skeleton Loaders**: During data loading
- [ ] **Pull-to-Refresh**: On customer list

### Floating UI Elements
- [ ] **SPORT Button**: Center top, flame animation when active
- [ ] **Quick Add (+)**: Bottom-right, gold gradient
- [ ] **Emergency (!)**: Bottom-left, red pulse animation
- [ ] **Command Center**: Floating pill cluster, center bottom
- [ ] **Bluetooth Customer**: Left side, blue glow
- [ ] **PTT Button**: Visible in SPORT mode only

---

## Known Limitations
- Camera features require a real device (not available in simulator/emulator)
- SMS integration uses `expo-sms` which opens the native composer
- Push-to-Talk requires microphone permission
- Backend must be network-accessible from the test device

---

## Reporting Issues
Please include:
1. Device model and OS version
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots/screen recordings if possible
