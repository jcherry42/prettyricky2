# CORRECT iOS Build Commands - Fixed Directory Path

## ❌ Common Mistake
Running `pod install` from wrong directory (e.g., `/app/frontend/` or `/app/frontend/ios/`)

## ✅ CORRECT Location
The Podfile is inside: `/app/frontend/ios/App/`

---

## 🚀 Correct Commands (Copy & Paste These)

### From Project Root:
```bash
cd frontend/ios/App
pod install
open App.xcworkspace
```

### Or Full Path:
```bash
cd /app/frontend/ios/App
pod install
open App.xcworkspace
```

---

## 📂 Directory Structure Reference

```
/app/
└── frontend/
    ├── capacitor.config.json
    ├── package.json
    └── ios/
        └── App/                    ← YOU NEED TO BE HERE
            ├── Podfile            ← This file must exist
            ├── App.xcodeproj/
            ├── App.xcworkspace/    (created after pod install)
            └── App/
```

---

## 🎯 Step-by-Step Instructions

1. **Navigate to correct directory:**
   ```bash
   cd /app/frontend/ios/App
   ```

2. **Verify Podfile exists:**
   ```bash
   ls -la Podfile
   # Should show: -rw-r--r-- ... Podfile
   ```

3. **Clean old pods:**
   ```bash
   rm -rf Pods Podfile.lock
   ```

4. **Install pods:**
   ```bash
   pod install
   ```

5. **Open Xcode workspace:**
   ```bash
   open App.xcworkspace
   ```

---

## ⚡ One Complete Command

```bash
cd /app/frontend/ios/App && rm -rf Pods Podfile.lock && pod install && open App.xcworkspace
```

---

## ✅ What You Should See

After `cd /app/frontend/ios/App`:
```bash
$ ls
App/                 App.xcodeproj/       Podfile
```

After `pod install`:
```
Analyzing dependencies
Downloading dependencies
Installing Capacitor (6.2.1)
...
Pod installation complete!
```

---

## 🆘 If Still Having Issues

Confirm your current directory:
```bash
pwd
# Should show: /app/frontend/ios/App (or similar path on your Mac)

ls Podfile
# Should show: Podfile
```

If Podfile doesn't exist, you may need to sync Capacitor first:
```bash
cd /app/frontend
npx cap sync ios
cd ios/App
pod install
```
