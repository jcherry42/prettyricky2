# iOS Build Instructions for Supercharg'd

## Prerequisites

- **macOS** with Xcode 15+ installed
- **CocoaPods** installed: `sudo gem install cocoapods`
- **Node.js 18+** and **npm** installed
- iPhone/iPad running iOS 15.5 or later (physical device recommended for barcode scanning)

## Build Steps

### Step 1: Clone the Repository

Clone the repo to your Mac if you haven't already:
```bash
git clone <your-repo-url>
cd frontend
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Build the Web App

```bash
npm run build
```

### Step 4: Sync Capacitor

```bash
npx cap sync ios
```

### Step 5: Navigate to iOS Directory and Install Pods

```bash
cd ios/App
pod install
```

**Note:** If `pod install` fails, try these steps:
```bash
# Clean CocoaPods cache
pod cache clean --all

# Remove existing pods and lock file
rm -rf Pods Podfile.lock

# Update CocoaPods repo
pod repo update

# Install pods fresh
pod install
```

### Step 6: Open in Xcode

```bash
open App.xcworkspace
```

**Important:** Open `App.xcworkspace`, NOT `App.xcodeproj`

### Step 7: Configure Signing

1. In Xcode, select the "App" target
2. Go to "Signing & Capabilities" tab
3. Select your Development Team
4. Ensure "Automatically manage signing" is checked

### Step 8: Build and Run

1. Select your connected device or simulator (iOS 15.5+)
2. Press `Cmd + R` to build and run

## Troubleshooting

### Error: "CocoaPods could not find compatible versions"

This usually means the iOS deployment target is too low. The Podfile has been updated to require iOS 15.5. If you still see this error:

1. Ensure your Xcode is updated to version 15+
2. Clean and rebuild:
```bash
cd ios/App
rm -rf Pods Podfile.lock
pod cache clean --all
pod install --repo-update
```

### Error: "GoogleMLKit requires deployment target 15.5+"

The `@capacitor-mlkit/barcode-scanning` plugin requires iOS 15.5+. The Podfile has been configured for this. If Xcode still shows a lower target:

1. Open `App.xcworkspace` in Xcode
2. Select the "App" project (not target)
3. Go to "Build Settings"
4. Search for "iOS Deployment Target"
5. Set it to 15.5 for all configurations

### Error: "node_modules not found"

You need to run `npm install` in the frontend directory first:
```bash
cd /path/to/frontend
npm install
cd ios/App
pod install
```

### Barcode Scanner Not Working

Ensure camera permissions are configured:
1. Check `ios/App/App/Info.plist` has `NSCameraUsageDescription`
2. On first launch, accept the camera permission prompt

## Required iOS Deployment Target

| Component | Minimum iOS Version |
|-----------|---------------------|
| @capacitor/core v6 | 13.0 |
| @capacitor-mlkit/barcode-scanning v6 | **15.5** |
| GoogleMLKit/BarcodeScanning | **15.5** |

**Project is configured for iOS 15.5 to satisfy all requirements.**

## Testing Barcode Scanner

The barcode scanner requires a **physical device** - it will not work in the iOS Simulator (no camera).

1. Connect your iPhone (iOS 15.5+)
2. Build and run on device
3. Navigate to VIN scanner in the app
4. Grant camera permission when prompted
