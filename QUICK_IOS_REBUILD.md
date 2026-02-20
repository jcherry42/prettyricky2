# Quick Command Reference - iOS Rebuild

## Copy and Paste These Commands

```bash
# 1. Navigate to frontend
cd /app/frontend

# 2. Clean everything
rm -rf ios/App/public dist

# 3. Build with explicit env var
VITE_BACKEND_URL=https://pwa-native.preview.emergentagent.com yarn build:prod

# 4. Sync to iOS
npx cap sync ios

# 5. Open Xcode
npx cap open ios
```

## In Xcode
1. ⌘⇧K (Clean Build Folder)
2. Select your iPhone
3. ▶️ (Build and Run)

## What Changed
- **Vite config**: Forces compile-time URL replacement
- **backendUrl.js**: Hardcoded fallback as safety net
- **Logging**: Shows which method worked

## Success Indicators
✅ Console shows `[BackendURL Debug]` with `usedFallback: true` or `false`
✅ Tower Talk generates responses
✅ No "Native backend not configured" error

## If Still Broken
Share:
1. Full Xcode console from app launch to Tower Talk attempt
2. Error message/screenshot
3. Output of: `cd /app/frontend/dist/assets && grep -c "superchargd.preview.emergentagent.com" *.js`
