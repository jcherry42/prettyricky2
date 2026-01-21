#!/bin/bash

echo "🔥 NUCLEAR COCOAPODS RESET - This WILL work"
echo ""

cd /app/frontend/ios/App

# 1. Remove ALL CocoaPods data everywhere
echo "1️⃣ Removing all CocoaPods caches..."
sudo rm -rf ~/.cocoapods
rm -rf ~/Library/Caches/CocoaPods
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf Pods
rm -rf Podfile.lock
rm -rf *.xcworkspace

# 2. Uninstall and reinstall CocoaPods
echo "2️⃣ Reinstalling CocoaPods..."
sudo gem uninstall cocoapods -a -x
sudo gem install cocoapods

# 3. Setup CocoaPods from scratch
echo "3️⃣ Setting up CocoaPods repository (this takes 2-3 minutes)..."
pod setup

# 4. Install pods with verbose output
echo "4️⃣ Installing pods..."
pod install --verbose

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ✅ ✅ SUCCESS! ✅ ✅ ✅"
    echo ""
    echo "Open Xcode now: open App.xcworkspace"
else
    echo ""
    echo "❌ Still failed. This means there's an issue with the Capacitor packages themselves."
    echo ""
    echo "Last resort: cd ../.. && yarn add @capacitor/ios@latest"
fi
