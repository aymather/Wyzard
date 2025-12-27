# Quick Code Signing Setup

## Step 1: Get Your Developer ID Certificate

You need a **Developer ID Application** certificate. Easiest way:

1. **Open Xcode**
2. Go to **Preferences** → **Accounts**
3. Add your Apple ID (if not already)
4. Select your account → Click **Manage Certificates**
5. Click **+** → Select **Developer ID Application**
6. Xcode creates and installs it automatically

## Step 2: Get Your Credentials

Run this to find your Developer ID:

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
```

You'll see something like:
```
Developer ID Application: John Doe (ABC123DEF4)
```

**Copy the entire string** (including the part in parentheses).

## Step 3: Get Your Team ID

The Team ID is the part in parentheses from above (e.g., `ABC123DEF4`).

Or find it at: https://developer.apple.com/account → Click your name/team in top right.

## Step 4: Create App-Specific Password

1. Go to https://appleid.apple.com
2. Sign in
3. **Security** section → **App-Specific Passwords**
4. Click **Generate Password**
5. Name it "Electron Notarization"
6. **Copy the password** (format: `xxxx-xxxx-xxxx-xxxx`)

## Step 5: Create .env File

Create a `.env` file in the project root:

```bash
cd /Users/alecmather/Desktop/projects/wyzard/wyzard-electron
```

Create `.env` with:

```bash
APPLE_ID=your-email@example.com
APPLE_TEAM_ID=ABC123DEF4
APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
APPLE_IDENTITY="Developer ID Application: Your Name (ABC123DEF4)"
```

**Replace:**
- `your-email@example.com` with your Apple ID email
- `ABC123DEF4` with your Team ID
- `xxxx-xxxx-xxxx-xxxx` with your app-specific password
- `Developer ID Application: Your Name (ABC123DEF4)` with your full Developer ID identity

## Step 6: Build and Sign

```bash
yarn electron-pack
```

The build will:
1. Sign the app with your Developer ID
2. Automatically notarize it with Apple
3. Create signed DMG files

## Verification

After building, verify the signature:

```bash
codesign --verify --deep --strict --verbose=2 dist/v1.0.0/mac/Wyzard.app
```

You should see: `dist/v1.0.0/mac/Wyzard.app: valid on disk`

Check notarization:

```bash
spctl --assess --verbose --type install dist/v1.0.0/mac/Wyzard.app
```

## Troubleshooting

### "No identity found"
- Make sure you created a **Developer ID Application** certificate (not just Development)
- Verify it's installed: `security find-identity -v -p codesigning`

### "Invalid credentials" during notarization
- Double-check your app-specific password
- Make sure there are no extra spaces in `.env` file
- Try generating a new app-specific password

### Notarization fails
- Check Apple's notarization status: https://developer.apple.com/system-status/
- Verify your Apple Developer account is active
- Make sure you're using the correct Team ID

## That's It!

Once set up, every build will automatically sign and notarize your app. Users won't see any security warnings! 🎉

