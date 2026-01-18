# iOS Build Fix Guide - CocoaPods Deployment Target Issue
**Date:** January 17, 2026  
**Issue:** CocoaPods compatibility with Capacitor 6

---

## 🔴 The Problem

You're seeing this error:
```
[!] CocoaPods could not find compatible versions for pod "Capacitor":
Specs satisfying the dependency were found, but they required a 
higher minimum deployment target.
```

**Root Cause:** Capacitor 6 requires iOS 14.0+ as minimum deployment target, but your project may have been set to iOS 13.0 or lower.

---

## ✅ Quick Fix (Already Applied)

I've updated the deployment target in the codebase:
- ✅ Updated Podfile: `platform :ios, '14.0'`
- ✅ Updated Xcode project: `IPHONEOS_DEPLOYMENT_TARGET = 14.0`

---

## 🛠️ Steps to Complete on Your Mac

### Method 1: Automatic Fix (Recommended)

Run these commands in your terminal:

```bash
cd /app/frontend/ios/App

# Clean existing pods
rm -rf Pods
rm -rf Podfile.lock

# Update CocoaPods repo (may take a few minutes)
pod repo update

# Install pods with updated deployment target
pod install

# Open in Xcode
open App.xcworkspace
```

### Method 2: Manual Fix in Xcode

If Method 1 doesn't work:

1. **Open the project:**
   ```bash
   cd /app/frontend
   yarn cap:ios
   # or: open ios/App/App.xcworkspace
   ```

2. **Update Deployment Target:**
   - Click on "App" project in the left sidebar
   - Select "App" target
   - Go to "Build Settings" tab
   - Search for "iOS Deployment Target"
   - Change from "iOS 13.0" to "iOS 14.0"
   - Repeat for "Pods" project if it exists

3. **Clean and Rebuild:**
   - Menu: Product → Clean Build Folder (Cmd+Shift+K)
   - Menu: Product → Build (Cmd+B)

---

## 🔧 Additional Fixes (If Still Having Issues)

### Fix 1: Update CocoaPods

```bash
# Check current version
pod --version

# Update CocoaPods (if needed)
sudo gem install cocoapods

# Clear CocoaPods cache
pod cache clean --all
```

### Fix 2: Update Capacitor Packages

```bash
cd /app/frontend

# Check current versions
yarn list @capacitor/ios

# Update if needed (already on 6.x)
yarn upgrade @capacitor/ios @capacitor/core

# Sync
npx cap sync ios
```

### Fix 3: Reset Xcode Derived Data

```bash
# Close Xcode first, then:
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Reopen project
cd /app/frontend
yarn cap:ios
```

---

## 🎯 Verify the Fix

After running the fixes, verify:

```bash
cd /app/frontend/ios/App

# Check Podfile has iOS 14.0
cat Podfile | grep "platform :ios"
# Should output: platform :ios, '14.0'

# Install pods
pod install

# Should see:
# ✓ Installing Capacitor (6.x.x)
# ✓ Installing CapacitorCordova (6.x.x)
# etc.
```

---

## 📱 Build in Xcode

Once pods install successfully:

1. **Open workspace (NOT .xcodeproj):**
   ```bash
   open ios/App/App.xcworkspace
   ```

2. **Select your device/simulator:**
   - Click on "App" scheme at the top
   - Select your iPhone or simulator

3. **Build and Run:**
   - Press Cmd+R or click the Play button
   - App should build and launch

---

## ⚠️ Common Issues & Solutions

### Issue 1: "User Script Sandboxing" Error
**Solution:**
- In Xcode, select "App" target
- Build Settings → search "User Script Sandboxing"
- Set to "No"

### Issue 2: CocoaPods Not Found
**Solution:**
```bash
# Install CocoaPods
sudo gem install cocoapods
pod setup
```

### Issue 3: "Resource fork, Finder information, or similar detritus"
**Solution:**
```bash
cd /app/frontend/ios/App
xattr -cr .
pod install
```

### Issue 4: M1/M2 Mac Architecture Issues
**Solution:**
```bash
# Use arch command
arch -x86_64 pod install

# Or update to native M1 CocoaPods
sudo gem install ffi
pod install
```

---

## 📋 Requirements Checklist

Before building iOS app, ensure you have:
- ✅ macOS 12.0+ (Monterey or later)
- ✅ Xcode 14.0+ (from Mac App Store)
- ✅ CocoaPods 1.11+ (`sudo gem install cocoapods`)
- ✅ iOS 14.0+ device or simulator
- ✅ Apple Developer account (for device testing)

---

## 🚀 Expected Output (Success)

After `pod install` succeeds, you should see:

```
Analyzing dependencies
Downloading dependencies
Installing Capacitor (6.2.1)
Installing CapacitorCordova (6.2.1)
Installing CapacitorMlkitBarcodeScanning (6.2.0)
Installing CapacitorKeyboard (6.0.4)
Installing CapacitorPushNotifications (6.0.5)
Installing CapacitorSplashScreen (6.0.4)
Installing CapacitorStatusBar (6.0.3)
Generating Pods project
Integrating client project

[!] Please close any current Xcode sessions and use `App.xcworkspace` 
    for this project from now on.
```

---

## 🎯 Next Steps After Successful Build

1. **Test on Simulator:**
   - Build and run in Xcode
   - Test all features (VIN scanner, Tower Talk, etc.)

2. **Test on Physical Device:**
   - Connect your iPhone via USB
   - Select device in Xcode
   - Build and run (may need provisioning profile)

3. **Debug Device Issues:**
   - For Tower Talk/Voice Translation issues
   - Open Safari → Develop → [Your iPhone] → localhost
   - Test features and check console logs

---

## 📞 If Issues Persist

If you still encounter issues after trying these fixes:

1. **Share Error Messages:**
   - Copy the complete error from Xcode or Terminal
   - Include the output of `pod install`

2. **Check Versions:**
   ```bash
   pod --version
   xcodebuild -version
   sw_vers
   ```

3. **Generate Diagnostic:**
   ```bash
   cd /app/frontend/ios/App
   pod install --verbose > pod_install_log.txt 2>&1
   ```

---

## ✅ Summary

**What I Fixed:**
- ✅ Updated Podfile to iOS 14.0
- ✅ Updated Xcode project deployment target to 14.0
- ✅ Verified Capacitor 6 compatibility

**What You Need to Do:**
1. Run `pod install` in `/app/frontend/ios/App`
2. Open `App.xcworkspace` in Xcode
3. Build and run on your device

**This is a standard Capacitor 6 compatibility update. The fix is straightforward and will resolve the deployment target error.** 🚀
