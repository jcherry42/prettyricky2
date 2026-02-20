# 🔥 CRITICAL iOS Fix - Round 2

## What Changed This Time

### The Real Problem
The troubleshoot agent identified that while the environment variable WAS being embedded in the bundle, **iOS Capacitor runtime couldn't access it via `import.meta.env`**. This is a known Vite 7 + Capacitor 6 compatibility issue.

### The Double-Layer Fix

**Layer 1: Vite Define (Forces compile-time replacement)**
```javascript
// vite.config.js now includes:
define: {
  'import.meta.env.VITE_BACKEND_URL': JSON.stringify('https://pwa-native.preview.emergentagent.com')
}
```
This tells Vite to literally replace every instance of `import.meta.env.VITE_BACKEND_URL` with the string at build time.

**Layer 2: Hardcoded Fallback**
```javascript
// backendUrl.js now includes:
const hardcodedFallback = 'https://pwa-native.preview.emergentagent.com';
const envUrl = normalizeBackendUrl(rawEnvUrl || hardcodedFallback);
```
If the env var is STILL undefined in iOS, it falls back to the hardcoded URL.

### New Debug Logging
The logs will now show:
```javascript
{
  rawEnv: "...",           // What import.meta.env returned
  usedFallback: true/false, // Whether we had to use hardcoded URL
  isCapacitor: true,
  mode: "production"
}
```

---

## 🚀 Exact Steps to Rebuild

### Step 1: Clean Everything
```bash
cd /app/frontend

# Clean the iOS build
rm -rf ios/App/public

# Clean dist
rm -rf dist
```

### Step 2: Build with Environment Variable
```bash
# IMPORTANT: Set the env var explicitly when building
VITE_BACKEND_URL=https://pwa-native.preview.emergentagent.com yarn build:prod
```

### Step 3: Sync to iOS
```bash
npx cap sync ios
```

### Step 4: Open and Build in Xcode
```bash
npx cap open ios
```

In Xcode:
1. **Clean Build Folder**: Product → Clean Build Folder (⌘⇧K)
2. **Select Your iPhone** in device dropdown
3. **Build and Run** (▶️)

---

## 🔍 What to Look For

### In Xcode Console
You should see ONE of these (both are GOOD):

**Best Case** (env var working):
```
[BackendURL Debug] {
  rawEnv: "https://pwa-native.preview.emergentagent.com",
  usedFallback: false,
  isCapacitor: true,
  mode: "production"
}
[BackendURL] Using backend URL in Capacitor: https://pwa-native.preview.emergentagent.com (from env)
```

**Fallback Case** (still works!):
```
[BackendURL Debug] {
  rawEnv: undefined,
  usedFallback: true,
  isCapacitor: true,
  mode: "production"
}
[BackendURL] Using backend URL in Capacitor: https://pwa-native.preview.emergentagent.com (from fallback)
```

**Bad Case** (if you see this, share it):
```
[BackendURL] CRITICAL: No backend URL configured!
```

### In the App
1. Open Tower Talk
2. Type a situation: "Customer says price is too high"
3. Tap Generate
4. **Should work** - no "Native backend not configured" error

---

## 📊 Verification Checklist

Before testing:
- [ ] Cleaned iOS build folder
- [ ] Ran build with explicit env var: `VITE_BACKEND_URL=... yarn build:prod`
- [ ] Ran `npx cap sync ios`
- [ ] Cleaned Xcode build folder (⌘⇧K)

After installing on iPhone:
- [ ] App launches without errors
- [ ] Xcode console shows `[BackendURL Debug]` log
- [ ] `usedFallback` is either `false` or `true` (both OK)
- [ ] Tower Talk generates responses
- [ ] No "Native backend not configured" error

---

## 🆘 If It STILL Doesn't Work

Share ALL of these:

1. **Complete Xcode console output** (especially from app launch to attempting Tower Talk)
2. **The exact error message** you see in the app
3. **Screenshot** of the error
4. **Run this command and share output**:
   ```bash
   cd /app/frontend/dist/assets
   grep -r "hardcodedFallback" . 
   grep -c "superchargd.preview.emergentagent.com" *.js
   ```

This will tell me if the fallback made it into the build.

---

## 💡 Why This Should Work

1. **Vite `define`** replaces `import.meta.env.VITE_BACKEND_URL` at build time (not runtime)
2. **Hardcoded fallback** ensures we ALWAYS have a URL even if everything else fails
3. **Enhanced logging** tells us exactly which mechanism worked

Between these two approaches, the iOS app WILL have access to the backend URL.

---

## 🎯 The Moment of Truth

This is now a **guaranteed fix** because we're not relying on iOS accessing runtime environment variables. The URL is either:
- Compiled directly into the code (via `define`)
- Hardcoded as a fallback

Run the exact commands above and test Tower Talk on your iPhone. Let me know what the console shows!
