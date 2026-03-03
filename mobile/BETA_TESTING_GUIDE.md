# Supercharg'd — Beta Testing Guide

> **Single source of truth for building and running the app on device.**
> **Last updated: March 2026 — Post-cleanup & performance optimization**

---

## Build Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend API | ✅ Production-Ready | 27/28 endpoints tested, GZip compression, connection pooling |
| Mobile App | ✅ Beta-Ready | All PTT, translation, VIN scanner, license scanner features working |
| Translation (EN/ES/FR/KO) | ✅ Verified | Bi-directional voice + text translation |
| Push-to-Talk (PTT) | ✅ Verified | Fixed & hardened (RN 0.81 Animated.multiply fix, MIME types, race conditions) |
| VIN Scanner | ✅ Verified | 12 barcode types, trade-in cap, category system |
| License Scanner | ✅ Verified | PDF417 AAMVA + OCR fallback, chunked upload |
| Engine Sounds | ✅ Verified | 3 profiles (Merica/Euro/JDM), silent mode compatible |
| Customer Management | ✅ Verified | Full CRUD, search, status tracking |

---

## Prerequisites

Install these once on your Mac:

```bash
npm install -g yarn
npm install -g eas-cli
```

Xcode must be installed with iOS simulators. Log in to your Apple Developer account in Xcode → Settings → Accounts.

---

## 1. Install Dependencies

```bash
cd /path/to/project/mobile
yarn install
```

---

## 2. Configure Environment

`mobile/.env` is already in the repo with the default backend URL:

```env
EXPO_PUBLIC_BACKEND_URL=https://crm-scanner-sync.preview.emergentagent.com
```

This URL is also configurable **in-app** without rebuilding: Command Center → Settings → Backend.

---

## 3a. Run on Physical Device — Expo Go (Fastest, No Build)

1. Install **Expo Go** from the App Store on your iPhone.
2. Ensure your iPhone and Mac are on the **same Wi-Fi network**.
3. In `mobile/`:
   ```bash
   npx expo start
   ```
4. Scan the QR code with your iPhone camera or the Expo Go app.

> **Note**: Some native features (Bluetooth, custom audio sessions) work fully only in a Development Build (3b).

---

## 3b. Development Build via EAS (Recommended for Beta)

A development build is a full native binary that includes all native modules and supports live hot-reload.

```bash
cd mobile
eas build --platform ios --profile development
```

- Takes ~10–15 min on EAS remote servers (no Xcode required).
- Download and install the `.ipa` from the link EAS emails you.
- Run the dev server locally:
  ```bash
  npx expo start --dev-client
  ```

---

## 3c. Local Xcode Build

```bash
cd mobile
npx expo prebuild --clean      # generates ios/ and android/ folders
npx expo run:ios --device      # builds and installs directly to connected iPhone
```

Or open in Xcode manually:
```bash
open ios/SuperchargdMobile.xcworkspace
```
Select your device in the top bar → press ▶.

---

## 4. Production Build (TestFlight / App Store)

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Metro bundler not found" | Run `yarn install` in `mobile/` |
| "No development build found" | Use Expo Go (3a) or run `eas build` (3b) |
| Backend URL error in app | Command Center → Settings → Backend → enter URL → Save |
| Pod install fails | `cd ios && pod install --repo-update` |
| Black screen on launch | Confirm `.env` exists with `EXPO_PUBLIC_BACKEND_URL` |
| Xcode signing error | Xcode → Project → Signing & Capabilities → select your team |
| Build cache issues | `npx expo prebuild --clean` then rebuild |

---

## App Reference

| Setting | Value |
|---------|-------|
| Bundle ID | `com.superchargd.mobile` |
| Default Backend | `https://crm-scanner-sync.preview.emergentagent.com` |
| Orientation | Portrait locked |
| Min iOS | 16.0 |

---

## Beta Test Checklist

Use this checklist during beta testing to validate all critical features:

### Core Features
- [ ] App launches without crash (no black screen, no white screen)
- [ ] Home screen loads with customer list and search bar
- [ ] SUPERCHARG'D branding visible with designo aesthetic

### Customer Management
- [ ] Create new customer (name, phone, email, status)
- [ ] Search customers by name/phone/email
- [ ] View customer detail modal
- [ ] Edit customer information
- [ ] Delete customer

### Push-to-Talk (PTT) Translation
- [ ] Enable SPORT mode in Command Center
- [ ] PTT button appears (purple microphone)
- [ ] Press and hold to record audio
- [ ] Release to stop recording
- [ ] Transcription appears correctly
- [ ] Translation displays in target language
- [ ] Test EN→ES, EN→FR, EN→KO directions
- [ ] Test reverse: ES→EN, FR→EN, KO→EN

### Tower Talk AI
- [ ] Select customer → type situation
- [ ] Generate AI response (should be automotive-context aware)
- [ ] Copy/send/save response buttons work

### VIN Scanner
- [ ] Open via INTAKE tab
- [ ] Camera activates with scan line animation
- [ ] Torch/flashlight toggle works
- [ ] Zoom controls functional
- [ ] Scan windshield barcode → VIN decoded
- [ ] Category picker (Dealer Inventory vs Trade-In) appears
- [ ] Duplicate VIN detection works

### License Scanner
- [ ] Open via INTAKE tab
- [ ] Camera/upload from gallery works
- [ ] PDF417 barcode on license back parses correctly
- [ ] OCR fallback extracts name, DOB, license #, address
- [ ] Save to customer profile works

### Engine Sound Profiles
- [ ] Command Center → Engine Sound section
- [ ] Switch between Merica / Euro / JDM
- [ ] Toggle SPORT mode → correct sound plays
- [ ] Sound plays even with iPhone silent switch ON

### Settings & Offline
- [ ] Command Center opens (gear icon)
- [ ] Language selection (ES/FR/KO flags)
- [ ] Eco Mode toggle works
- [ ] App shows offline banner when Wi-Fi disabled
- [ ] App recovers gracefully when back online

---

## Known Limitations (Beta)
- Voice translate requires stable network (30s timeout)
- License OCR accuracy depends on photo quality and lighting
- Printer integration requires `pyipp` module on backend (optional feature)
- TTS caching is in-memory only (resets on backend restart)
