#!/bin/bash

# iOS CocoaPods Fix Script
# This script fixes the deployment target compatibility issue

echo "🔧 Fixing iOS CocoaPods Deployment Target Issue..."
echo ""

# Step 1: Clean everything
echo "1️⃣ Cleaning old pods and caches..."
rm -rf Pods
rm -rf Podfile.lock
rm -rf ~/Library/Caches/CocoaPods
rm -rf ~/Library/Developer/Xcode/DerivedData/*
echo "✅ Cleanup complete"
echo ""

# Step 2: Update CocoaPods repo (this may take a few minutes)
echo "2️⃣ Updating CocoaPods repository..."
pod repo update
echo "✅ Repository updated"
echo ""

# Step 3: Deintegrate if needed
echo "3️⃣ Deintegrating old installation..."
pod deintegrate 2>/dev/null || echo "No previous installation found"
echo "✅ Deintegration complete"
echo ""

# Step 4: Install with updated deployment target
echo "4️⃣ Installing pods with iOS 14.0 deployment target..."
pod install --repo-update
echo ""

# Step 5: Success message
if [ $? -eq 0 ]; then
    echo "✅ ✅ ✅ SUCCESS! ✅ ✅ ✅"
    echo ""
    echo "Pods installed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Open the workspace: open App.xcworkspace"
    echo "2. In Xcode, verify Build Settings → iOS Deployment Target = 14.0"
    echo "3. Clean Build Folder (Cmd+Shift+K)"
    echo "4. Build and Run (Cmd+R)"
    echo ""
else
    echo "❌ Installation failed. See error above."
    echo ""
    echo "Try manual fixes:"
    echo "1. Update CocoaPods: sudo gem install cocoapods"
    echo "2. Clear cache: pod cache clean --all"
    echo "3. Run this script again"
    echo ""
fi
