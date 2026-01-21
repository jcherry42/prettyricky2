# iOS Build Instructions for Supercharg'd

## CRITICAL CHANGES MADE

The following changes have been applied to fix the CocoaPods/Capacitor build issues:

1. **Podfile**: Updated to iOS 15.5 (required by GoogleMLKit/BarcodeScanning)
2. **Xcode Project**: Updated deployment target from 13.0 → 15.5 in project.pbxproj
3. **Capacitor Config**: Added `minVersion: "15.5"` for iOS
4. **Build Script**: Created `build_ios.sh` to automate the entire process

## Quick Start (Recommended)

On your Mac, run:
```bash
cd frontend
chmod +x build_ios.sh
./build_ios.sh
```

This script will:
1. Install npm dependencies
2. Build the web app
3. Sync Capacitor
4. Clean all build artifacts
5. Install CocoaPods
6. Open Xcode

## Manual Build Steps

If the script doesn't work, follow these manual steps:

### Step 1: Install Dependencies
```bash
cd frontend
npm install
```

### Step 2: Build Web App
```bash
npm run build
```

### Step 3: Sync Capacitor
```bash
npx cap sync ios
```

### Step 4: NUCLEAR CLEAN (Important!)
```bash
cd ios/App

# Remove all pods and cache
rm -rf Pods Podfile.lock
pod cache clean --all

# Remove Xcode derived data
rm -rf ~/Library/Developer/Xcode/DerivedData/*supercharg*
```

### Step 5: Install Pods
```bash
pod repo update
pod install --repo-update
```

### Step 6: Open in Xcode
```bash
open App.xcworkspace
```

**⚠️ IMPORTANT: Open `App.xcworkspace`, NOT `App.xcodeproj`**

## Xcode Configuration

### Before Building:
1. **Select Physical Device**: The barcode scanner requires a real camera
2. **Device iOS Version**: Must be iOS 15.5 or later
3. **Signing**: 
   - Select App target → Signing & Capabilities
   - Choose your Development Team
   - Check "Automatically manage signing"

### Build:
Press `Cmd + R` to build and run

## Troubleshooting

### Error: "CocoaPods could not find compatible versions"

This is caused by iOS deployment target mismatch. Verify:

1. **Podfile** has `platform :ios, '15.5'`
2. **Xcode project** has deployment target 15.5:
   - Open Xcode
   - Select "App" project (top of navigator)
   - Build Settings → iOS Deployment Target → 15.5

### Error: "GoogleMLKit requires deployment target 15.5+"

Run the nuclear clean and reinstall pods:
```bash
cd ios/App
rm -rf Pods Podfile.lock
pod cache clean --all
pod install --repo-update
```

### Error: Build fails on Apple Silicon (M1/M2/M3)

The Podfile includes a fix for this, but if issues persist:
```bash
# Run Xcode with Rosetta
arch -x86_64 pod install
```

### Want to test without barcode scanner?

If you want to confirm the rest of the project builds:
```bash
cd ios/App
cp Podfile Podfile.backup
cp Podfile.no-scanner Podfile
rm -rf Pods Podfile.lock
pod install
# Build in Xcode
# Then restore: cp Podfile.backup Podfile
```

## Requirements Summary

| Component | Required Version |
|-----------|-----------------|
| iOS Device | 15.5+ |
| Xcode | 15+ |
| CocoaPods | Latest |
| Node.js | 18+ |
| @capacitor/ios | 6.x |
| @capacitor-mlkit/barcode-scanning | 6.2.0 |

## Files Modified

- `/ios/App/Podfile` - iOS 15.5, post_install hooks for deployment target
- `/ios/App/App.xcodeproj/project.pbxproj` - Deployment target 15.5
- `/capacitor.config.json` - Added `minVersion: "15.5"` for iOS
- `/build_ios.sh` - Automated build script

## Support

If the build still fails, please share:
1. The exact error message
2. Output of `pod --version`
3. Output of `xcodebuild -version`
4. Your Mac's chip (Intel or Apple Silicon)
