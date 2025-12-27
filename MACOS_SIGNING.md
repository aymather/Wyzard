# macOS Code Signing & Malware Warning Guide

## The Problem

When you try to open your unsigned Electron app, macOS shows:
- "Malware Blocked and Moved to Trash" (newer macOS versions)
- "Wyzard cannot be opened because it is from an unidentified developer" (older macOS)

This is **normal behavior** for unsigned apps. macOS Gatekeeper blocks them by default.

## Quick Fix: Bypass for Testing

To test your app right now:

1. **Right-click** on `Wyzard.app` in Applications
2. Select **"Open"** from the context menu
3. In the dialog that appears, click **"Open"** again

The app will launch and macOS will remember this choice for this app.

**Alternative method:**
```bash
# Remove the quarantine attribute (allows app to run)
xattr -cr /Applications/Wyzard.app
```

## Solutions for Production

### Option 1: Code Signing (Recommended for Public Distribution)

**Requirements:**
- Apple Developer account ($99/year)
- Xcode installed

**Steps:**

1. **Get your Developer ID:**
   ```bash
   # List available signing identities
   security find-identity -v -p codesigning
   ```
   Look for: `Developer ID Application: Your Name (TEAM_ID)`

2. **Update `package.json`:**
   ```json
   "mac": {
     "category": "public.app-category.utilities",
     "identity": "Developer ID Application: Your Name (TEAM_ID)",
     "hardenedRuntime": true,
     "gatekeeperAssess": false,
     "entitlements": "build/entitlements.mac.plist",
     "entitlementsInherit": "build/entitlements.mac.plist"
   }
   ```

3. **Create entitlements file** (`build/entitlements.mac.plist`):
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>com.apple.security.cs.allow-jit</key>
     <true/>
     <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
     <true/>
     <key>com.apple.security.cs.allow-dyld-environment-variables</key>
     <true/>
     <key>com.apple.security.cs.disable-library-validation</key>
     <true/>
   </dict>
   </plist>
   ```

4. **Rebuild:**
   ```bash
   yarn electron-pack
   ```

5. **Notarize** (required for distribution):
   ```bash
   # This is usually automated by electron-builder if configured
   # Or manually:
   xcrun notarytool submit Wyzard-1.0.0.dmg --apple-id YOUR_APPLE_ID --team-id YOUR_TEAM_ID --password YOUR_APP_SPECIFIC_PASSWORD --wait
   ```

### Option 2: Ad-Hoc Signing (Free, Limited)

You can sign with an ad-hoc signature (free, but still shows warnings):

1. **Update `package.json`:**
   ```json
   "mac": {
     "identity": null,
     "signIgnore": []
   }
   ```

2. **Sign manually after build:**
   ```bash
   codesign --force --deep --sign - /Applications/Wyzard.app
   ```

**Note:** Ad-hoc signing doesn't prevent warnings, but it does make the app more trusted by the system.

### Option 3: Provide Clear Instructions to Users

If you can't sign the app, provide clear instructions on your download page:

```
## macOS Installation Instructions

1. Download Wyzard.dmg
2. Open the DMG and drag Wyzard to Applications
3. When you first open Wyzard, you may see a security warning
4. To bypass:
   - Right-click on Wyzard in Applications
   - Select "Open"
   - Click "Open" in the dialog
5. The app will launch normally

This warning appears because the app is not signed with an Apple Developer certificate. 
The app is safe to use - all processing happens locally on your computer.
```

## Hardening Configuration (Reduces False Positives)

Even without signing, you can add hardening options that may reduce false positives:

```json
"mac": {
  "category": "public.app-category.utilities",
  "hardenedRuntime": false,
  "gatekeeperAssess": false
}
```

## Testing Your Signed App

After signing, test on a clean system:

1. Copy the DMG to a different Mac (or create a new user)
2. Try to install and run
3. It should open without warnings (if properly signed and notarized)

## Troubleshooting

### "Resource busy" error during signing
```bash
# Kill any running instances
killall Wyzard
# Then try again
```

### "The operation couldn't be completed" error
- Make sure you're using the correct Developer ID
- Check that your Apple Developer account is active
- Verify Xcode command line tools are installed: `xcode-select --install`

### App still shows warnings after signing
- Make sure you've notarized the app (required for macOS 10.15+)
- Check that hardened runtime is enabled
- Verify entitlements are correct

## Summary

**For Testing:**
- Right-click → Open → Open (bypasses warning)

**For Production:**
- **Best:** Get Apple Developer account ($99/year) and sign + notarize
- **Alternative:** Provide clear instructions to users about bypassing the warning
- **Free option:** Ad-hoc signing (still shows warnings but more trusted)

The malware warning is macOS being cautious - your app is fine, it just needs to be signed for public distribution.

