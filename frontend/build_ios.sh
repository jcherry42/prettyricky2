#!/bin/bash
# =============================================================================
# SUPERCHARG'D iOS BUILD SCRIPT
# Run this script from the frontend directory on your Mac
# =============================================================================

set -e  # Exit on any error

echo "🔥 SUPERCHARG'D iOS BUILD SCRIPT"
echo "================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ ERROR: Run this script from the frontend directory"
    echo "   cd /path/to/frontend && ./build_ios.sh"
    exit 1
fi

# Check for required tools
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Install from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js: $(node -v)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi
echo "✅ npm: $(npm -v)"

if ! command -v pod &> /dev/null; then
    echo "❌ CocoaPods is not installed"
    echo "   Install with: sudo gem install cocoapods"
    echo "   Or via Homebrew: brew install cocoapods"
    exit 1
fi
echo "✅ CocoaPods: $(pod --version)"

if ! command -v xcodebuild &> /dev/null; then
    echo "❌ Xcode Command Line Tools not installed"
    echo "   Install with: xcode-select --install"
    exit 1
fi
echo "✅ Xcode: $(xcodebuild -version | head -1)"
echo ""

# Step 1: Install npm dependencies
echo "📦 Step 1/6: Installing npm dependencies..."
npm install
echo "✅ npm dependencies installed"
echo ""

# Step 2: Build web app
echo "🔨 Step 2/6: Building web app..."
npm run build
echo "✅ Web app built"
echo ""

# Step 3: Sync Capacitor
echo "📱 Step 3/6: Syncing Capacitor..."
npx cap sync ios
echo "✅ Capacitor synced"
echo ""

# Step 4: Clean iOS build artifacts
echo "🧹 Step 4/6: Cleaning iOS build artifacts..."
cd ios/App
rm -rf Pods Podfile.lock build DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/*supercharg* 2>/dev/null || true
pod cache clean --all
echo "✅ Build artifacts cleaned"
echo ""

# Step 5: Install CocoaPods
echo "☕ Step 5/6: Installing CocoaPods dependencies..."
echo "   (This may take a few minutes...)"
pod repo update
pod install --repo-update
echo "✅ CocoaPods installed"
echo ""

# Step 6: Open in Xcode
echo "🚀 Step 6/6: Opening in Xcode..."
echo ""
echo "============================================="
echo "IMPORTANT - READ BEFORE BUILDING IN XCODE:"
echo "============================================="
echo ""
echo "1. Select your PHYSICAL DEVICE (not simulator)"
echo "   - Barcode scanner requires real camera"
echo "   - Device must be iOS 15.5 or later"
echo ""
echo "2. Configure Signing:"
echo "   - Select App target → Signing & Capabilities"
echo "   - Choose your Development Team"
echo "   - Check 'Automatically manage signing'"
echo ""
echo "3. Build and Run: Press Cmd+R"
echo ""
echo "============================================="
echo ""

open App.xcworkspace

echo "🎉 Build script completed successfully!"
echo "   Xcode should now be open with your project."
