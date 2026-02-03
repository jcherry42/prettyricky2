# iOS Build & Deployment Instructions for Supercharg'd

## 🎯 What Was Fixed

### Issue
Core AI features (Tower Talk, Translate) were failing in the installed iOS app because the app couldn't resolve the correct backend URL. It was incorrectly using `capacitor://localhost` instead of the real server URL.

### Root Cause
Vite environment variables weren't being properly embedded in the iOS production build. The `VITE_BACKEND_URL` variable was undefined at runtime in Capacitor.

### Solution Implemented
1. ✅ Created `.env.production` file with the backend URL
2. ✅ Enhanced `backendUrl.js` utility with better debugging and logging
3. ✅ Added production build scripts to `package.json`
4. ✅ Fixed iOS StatusBar `UNIMPLEMENTED` error spam by adding platform checks
5. ✅ Verified environment variable is embedded in production bundle

---

## 📱 Steps to Build & Test on Your iPhone

### Step 1: Sync the Latest Code to iOS
```bash
cd /app/frontend
yarn cap:sync:ios
```

This command:
- Runs `yarn build:prod` (builds with production environment variables)
- Copies the build to the iOS native project
- Updates native dependencies

### Step 2: Open Xcode
```bash
cd /app/frontend
yarn cap:ios
```

Or manually open: `/app/frontend/ios/App/App.xcworkspace` in Xcode

### Step 3: Build & Run on Your iPhone
1. Connect your iPhone via USB
2. Select your device in Xcode's device dropdown (top toolbar)
3. Click the **Play** button (▶️) to build and run
4. Wait for the app to install and launch

### Step 4: Test the Fixed Features
1. **Open Tower Talk**
   - Tap the "Tower Talk" button in the app
   - Enter a sales situation (e.g., "Customer says price is too high")
   - Tap "Generate"
   - ✅ Should successfully generate a response (no "Native backend not configured" error)

2. **Check Console Logs in Xcode**
   - Open the Console pane (⌘⇧C or View → Debug Area → Activate Console)
   - Look for these success messages:
     ```
     [BackendURL] Using build-time URL in Capacitor: https://superchargd.preview.emergentagent.com
     ```
   - ❌ Should NOT see: `UNIMPLEMENTED: StatusBar.setBackgroundColor is not implemented on ios` (this is now fixed)

3. **Test Translate Feature**
   - Generate a Tower Talk response
   - Tap the translate icon
   - ✅ Should successfully translate

---

## 🔍 Debugging If It Still Doesn't Work

### If You Still See the "Native backend not configured" Error

**Check the Console in Xcode** for this debug output:
```
[BackendURL Debug] {
  rawEnv: "https://superchargd.preview.emergentagent.com",
  normalized: "https://superchargd.preview.emergentagent.com",
  isCapacitor: true,
  mode: "production"
}
```

**If `rawEnv` shows as `undefined`:**
1. Make sure you ran `yarn cap:sync:ios` (not just `cap sync`)
2. Verify the file `/app/frontend/.env.production` exists and contains:
   ```
   VITE_BACKEND_URL=https://superchargd.preview.emergentagent.com
   ```
3. Clean the Xcode build: Product → Clean Build Folder (⌘⇧K)
4. Rebuild and run

**If Network Calls Are Still Failing:**
- Share the full Xcode console log (especially lines with `[NET:FAIL]` or `[BackendURL]`)
- Check if your iPhone has internet connectivity
- Try switching from WiFi to Cellular (or vice versa)
- Check if "Low Data Mode" is enabled on your iPhone (Settings → WiFi/Cellular → Low Data Mode)

---

## 🚀 Future iOS Builds

For all future iOS builds, always use:
```bash
yarn cap:sync:ios
```

This ensures:
- Production environment variables are embedded
- Latest code is synced to the iOS project
- No manual copy/paste needed

---

## ✅ Verification Checklist

Before considering this issue resolved, verify:

- [ ] Ran `yarn cap:sync:ios` successfully
- [ ] Rebuilt app in Xcode and installed on iPhone
- [ ] Tower Talk generates responses without errors
- [ ] Translate feature works
- [ ] No `UNIMPLEMENTED` StatusBar errors in Xcode console
- [ ] Console shows: `[BackendURL] Using build-time URL in Capacitor: https://...`

---

## 📝 Technical Details (For Reference)

### What Changed in the Code

1. **New File: `/app/frontend/.env.production`**
   - Contains `VITE_BACKEND_URL` for production builds
   - Vite automatically loads this during `vite build --mode production`

2. **Enhanced: `/app/frontend/src/utils/backendUrl.js`**
   - Added comprehensive debug logging
   - Better error messages when backend URL is missing
   - Logs exactly where the URL is coming from

3. **New Scripts: `/app/frontend/package.json`**
   ```json
   "build:prod": "vite build --mode production",
   "cap:sync:ios": "yarn build:prod && cap sync ios"
   ```

4. **Fixed: `/app/frontend/src/utils/native.jsx`**
   - Added platform check before calling `StatusBar.setBackgroundColor()`
   - iOS doesn't support this method (Android-only)

### How Vite Environment Variables Work in Capacitor

- Vite embeds `VITE_*` variables at **build time**
- They become string literals in the bundled JavaScript
- In Capacitor, the iOS app runs the **pre-built** web bundle
- Runtime environment variables don't exist in this context
- That's why we need `.env.production` and proper build scripts

---

## Need Help?

If Tower Talk still doesn't work after following these steps, share:
1. The complete Xcode console output (especially lines with `[BackendURL]` or `[NET:FAIL]`)
2. A screenshot of the error you see in the app
3. Whether you're on WiFi or cellular data

We'll debug from there! 🏎️
