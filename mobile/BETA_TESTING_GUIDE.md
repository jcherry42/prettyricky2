# Supercharg'd — Build & Test on Your iPhone via Xcode

## Prerequisites
- **Mac** with **Xcode** installed (App Store → Xcode)
- **iPhone** plugged in via USB
- **Apple ID** (free — no $99 developer account needed for personal testing)
- **Node.js 18+** — install from [nodejs.org](https://nodejs.org)
- **Yarn** — `npm install -g yarn`
- **CocoaPods** — `sudo gem install cocoapods`

---

## Steps (copy-paste these in order)

```bash
# 1. Clone repo and enter mobile folder
git clone YOUR_GITHUB_REPO_URL
cd YOUR_REPO_NAME/mobile

# 2. Install JavaScript dependencies
yarn install

# 3. Set your backend URL
echo "EXPO_PUBLIC_BACKEND_URL=https://mobile-refine.preview.emergentagent.com" > .env

# 4. Generate the native iOS project
npx expo prebuild --platform ios

# 5. Install native dependencies (CocoaPods)
cd ios
pod install
cd ..

# 6. Open in Xcode
open ios/.xcworkspace
```

## In Xcode

1. **Select your iPhone** as the build target (dropdown at the top)
2. **Set your signing team:**
   - Click on the project name in the left sidebar (blue icon)
   - Go to **Signing & Capabilities** tab
   - Check **Automatically manage signing**
   - Select your **Team** (your Apple ID)
3. **Hit ▶ Run** (or Cmd+R)
4. **Trust the developer on your iPhone:**
   - First run will fail on the phone with "Untrusted Developer"
   - On your iPhone: Settings → General → VPN & Device Management → tap your Apple ID → Trust
   - Hit ▶ Run again in Xcode

The app installs directly on your phone. Done.

---

## Features to Test on Device

### Core
- [ ] Customer Management — create, edit, delete, search, pull-to-refresh
- [ ] VIN Scanner — camera scan + manual entry + decode
- [ ] License Scanner — camera capture + OCR + save to customer
- [ ] Tower Talk AI — generate responses, translate, speak, copy, SMS
- [ ] Quick Compose — write message, translate (SPORT mode), send SMS/email
- [ ] Emergency Responses — 8 inquiry types, 3 responses each

### Translation (activate SPORT mode first)
- [ ] Quick Compose translate button appears
- [ ] Emergency Modal translate button appears
- [ ] Language matches Settings selection (master control)

### Native Features (only work on real device)
- [ ] Camera (VIN + License scan)
- [ ] Haptic feedback on button presses
- [ ] SMS composer (opens iMessage)
- [ ] Audio playback (TTS)
- [ ] Portrait lock

---

## Troubleshooting

**"No bundle URL present"** → In Xcode: Product → Clean Build Folder, then Run again

**Pod install fails** → Run `cd ios && pod deintegrate && pod install`

**Signing error** → Make sure you selected a team in Signing & Capabilities

**App crashes on launch** → Check the Xcode console (bottom pane) for the error message
