# EAS Builds — Stable Demo & Testing Environment

**Why this exists:** Expo Go caches JS bundles aggressively and reloads inconsistently across devices. That's why the same 404 boot error resurfaces even after we fix the code — your device is still running the old cached JS.

EAS builds are **native binaries** with:
- The backend URL **baked in at compile time** (no AsyncStorage or reload risk)
- Fresh install state (no leftover Expo Go override caches)
- Distributable via a QR code / TestFlight — anyone can install with one tap
- Independent from your local Metro server — works even when your laptop is off

---

## Prerequisites (one-time, ~15 minutes)

### 1. Install EAS CLI
```bash
npm install -g eas-cli   # or:  npx eas-cli --version
```

### 2. Log in to your Expo account
```bash
cd /path/to/mobile
eas login
```

Enter the Expo account credentials that own project `6777087a-7aae-4de1-a4f7-7469586fe16d`.

### 3. Confirm the project link
```bash
eas whoami
eas project:info
```

Should show your Expo username + `Supercharg'd` project name.

### 4. iOS prerequisites (skip if Android-only)
- Apple Developer account ($99/year) linked to your Expo account
- Physical iPhone(s) you want to test on — collect their UDIDs

```bash
# Register your device(s) — sends a QR code to iPhone, walks you through UDID capture
eas device:create
```

### 5. Android prerequisites (skip if iOS-only)
- Nothing — EAS handles keystore generation on first Android build

---

## Building for the demo environment

**One command:**

```bash
cd /path/to/mobile
eas build --profile demo --platform all
```

EAS will:
1. Upload your source to the build service
2. Compile a native `.ipa` (iOS) and `.apk` (Android) with `EXPO_PUBLIC_BACKEND_URL=https://vin-scanner-audit.preview.emergentagent.com` baked in
3. Return two install links (one per platform) that expire in ~30 days

**Install on device:**
- **iOS:** Open the install link on the phone → tap the QR code preview → tap Install → trust the developer profile in Settings → General → VPN & Device Management
- **Android:** Open the install link → download `.apk` → tap to install (allow "install from unknown sources" if prompted)

**Build time:** ~15–20 min (iOS) / ~10 min (Android) on the default queue. Faster with paid tier.

---

## Available profiles (from `eas.json`)

| Profile | Distribution | Backend URL | Use case |
|---|---|---|---|
| `development` | Internal | preview.emergentagent.com | Local dev with dev-client |
| `device` | Internal | preview.emergentagent.com | Dev-client on a real phone (no simulator) |
| **`demo`** | **Internal** | **preview.emergentagent.com** | **Stable demo builds for stakeholders** |
| `staging` | Internal | preview.emergentagent.com | QA / regression testing |
| `preview` | Internal | preview.emergentagent.com | Pre-release smoke checks |
| `production` | Store | api.superchargd.com | App Store + Play Store submissions |

**All non-production profiles currently point at your preview URL.** When you promote to a stable prod backend (via Emergent's Deploy feature), update `production.env.EXPO_PUBLIC_BACKEND_URL` in `eas.json` and rebuild.

---

## Common workflows

### Rebuild after code changes
```bash
eas build --profile demo --platform ios
# OR both platforms:
eas build --profile demo --platform all
```

### List past builds
```bash
eas build:list --limit 10
```

### Get the install link for the latest build
```bash
eas build:view --latest
```

### Cancel a stuck build
```bash
eas build:cancel
```

### Publish an OTA (JavaScript-only) update — instant, no rebuild needed
```bash
eas update --channel demo --message "Fixed VIN scanner zoom slider"
```

Users get the update the next time they reopen the app. This is HUGE for demos: fix a typo at 9:58am, users see it at 10:00am. Only works for JS/asset changes — native module additions still require a full rebuild.

### Add a new tester after they receive their phone
```bash
eas device:create
# Send them the resulting QR code — after they scan and add their device,
# rebuild:
eas build --profile demo --platform ios
```

---

## Troubleshooting

### "Run this command inside a project directory"
You're not in the folder containing `app.json`. `cd` to your `mobile/` folder first.

### "This project has no associated EAS project"
Run `eas init` once. It will detect the `extra.eas.projectId` in `app.json` and confirm the link.

### iOS build fails with "Missing Apple credentials"
```bash
eas credentials
# Choose iOS → Manage credentials → follow prompts to sign in with Apple Dev
```

### Build succeeds but the app crashes immediately on launch
1. Check Sentry (if configured) for the crash
2. Or check native logs:
   - iOS: Xcode → Window → Devices and Simulators → your phone → View Device Logs
   - Android: `adb logcat` while the app is running

### Backend URL is still wrong after installing the EAS build
- `EXPO_PUBLIC_*` env vars are baked at build time. If you changed the URL AFTER building, you must rebuild.
- Verify what got baked:
  ```bash
  eas build:view --latest --json | jq '.env'
  ```

---

## For future stable-URL migration

When you promote your backend to a stable prod URL:

1. Update `eas.json`:
   ```json
   "production": {
     "env": {
       "EXPO_PUBLIC_BACKEND_URL": "https://api.your-real-domain.com",
       ...
     }
   }
   ```
2. Update the FALLBACK in `src/config/backend.ts` to match
3. Update the `CORS_ORIGINS` on the backend to whitelist your mobile domain (see `deploy/k8s/backend-deployment.yaml`)
4. Rebuild: `eas build --profile production --platform all`
5. Submit: `eas submit --profile production --platform all`

---

## Related runbooks

- Sentry source-map upload → `/app/docs/ops/sentry-source-maps.md`
- Mongo backup restore → `/app/docs/ops/mongo-backups.md`
- Uptime monitoring → `/app/docs/ops/uptime-monitoring.md`
