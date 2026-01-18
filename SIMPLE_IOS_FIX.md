# Simple Step-by-Step iOS Fix (No Complex Commands)

## Run These Commands ONE AT A TIME

### Step 1: Navigate to directory
```bash
cd /app/frontend/ios/App
```

### Step 2: Remove Pods folder
```bash
rm -rf Pods
```

### Step 3: Remove Podfile.lock
```bash
rm -rf Podfile.lock
```

### Step 4: Update CocoaPods repository (this takes 2-3 minutes)
```bash
pod repo update
```

### Step 5: Install pods
```bash
pod install
```

### Step 6: Open Xcode workspace
```bash
open App.xcworkspace
```

---

## ⚡ Alternative: Use the Script

Instead of typing commands, just run the script I created:

```bash
cd /app/frontend/ios/App
```

Then:
```bash
bash fix_pods.sh
```

---

## 🆘 If "pod repo update" Takes Too Long

Skip the repo update and just do:

```bash
cd /app/frontend/ios/App
rm -rf Pods
rm -rf Podfile.lock
pod install --repo-update
```

The `--repo-update` flag updates only necessary specs, not the entire repository.

---

## ✅ What You Should See

After `pod install` succeeds:
```
Analyzing dependencies
Downloading dependencies
Installing Capacitor (6.2.1)
...
Pod installation complete!
```

Then you can open Xcode:
```bash
open App.xcworkspace
```
