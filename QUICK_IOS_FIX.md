# Quick iOS Build Commands - After Fixing Deployment Target

## ✅ Fix Applied
- Podfile updated to iOS 14.0
- Xcode project updated to iOS 14.0

## 🚀 Run These Commands on Your Mac

```bash
# Navigate to iOS project
cd /app/frontend/ios/App

# Clean old pods
rm -rf Pods Podfile.lock

# Install with updated deployment target
pod install

# Open in Xcode
open App.xcworkspace
```

## 🎯 Expected Result
You should see:
```
Installing Capacitor (6.2.1)
Installing CapacitorCordova (6.2.1)
...
Pod installation complete!
```

## ⚡ One-Line Fix (If pod install fails)
```bash
cd /app/frontend/ios/App && rm -rf Pods Podfile.lock && pod repo update && pod install && open App.xcworkspace
```

## 📝 Note
This is a standard iOS 14.0 deployment target update required by Capacitor 6.
No code changes needed - just update pods and rebuild!
