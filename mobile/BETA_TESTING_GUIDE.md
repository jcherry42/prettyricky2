# Supercharg'd — Beta Testing Guide

> **Single source of truth for building and running the app on device.**

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
EXPO_PUBLIC_BACKEND_URL=https://pwa-native.preview.emergentagent.com
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
| Default Backend | `https://pwa-native.preview.emergentagent.com` |
| Orientation | Portrait locked |
| Min iOS | 16.0 |
