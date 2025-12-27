# Setting Up Code Signing for Wyzard

## Step 1: Get Your Developer ID Certificate

You need a **Developer ID Application** certificate (not just a regular development certificate).

### Option A: Download from Apple Developer Portal (Recommended)

1. Go to https://developer.apple.com/account
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Certificates** → **+** (Create new)
4. Select **Developer ID Application** → Continue
5. Upload a Certificate Signing Request (CSR):
   - Open **Keychain Access** app
   - Go to **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
   - Enter your email and name
   - Select **Saved to disk**
   - Save the CSR file
   - Upload it in the Apple Developer portal
6. Download the certificate
7. Double-click the downloaded `.cer` file to install it in Keychain

### Option B: Use Xcode (Easier)

1. Open **Xcode**
2. Go to **Preferences** → **Accounts**
3. Add your Apple ID (if not already added)
4. Select your account → Click **Manage Certificates**
5. Click **+** → Select **Developer ID Application**
6. Xcode will create and install it automatically

## Step 2: Verify Your Certificate

Run this command to see your Developer ID:

```bash
security find-identity -v -p codesigning
```

Look for a line like:
```
Developer ID Application: Your Name (TEAM_ID)
```

Copy the **entire identity string** (everything in quotes).

## Step 3: Get Your Team ID

You'll need your Team ID for notarization. Find it:

1. Go to https://developer.apple.com/account
2. Click on your name/team in the top right
3. Your Team ID is shown there (format: `ABC123DEF4`)

Or run:
```bash
# If you have Xcode installed
xcodebuild -showBuildSettings 2>/dev/null | grep DEVELOPMENT_TEAM
```

## Step 4: Create App-Specific Password (for Notarization)

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. Go to **Security** section
4. Under **App-Specific Passwords**, click **Generate Password**
5. Name it "Electron Notarization" or similar
6. **Copy the password** (you'll only see it once!)

## Step 5: Update package.json

I'll help you update the configuration once you have:
- Your Developer ID identity string
- Your Team ID
- Your Apple ID email
- Your app-specific password

## Step 6: Configure Environment Variables

For security, store your credentials as environment variables:

```bash
# Add to ~/.zshrc or ~/.bash_profile
export APPLE_ID="your-email@example.com"
export APPLE_TEAM_ID="ABC123DEF4"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

Then reload:
```bash
source ~/.zshrc
```

## Next Steps

Once you have your Developer ID identity, Team ID, and app-specific password, I'll update your `package.json` with the signing configuration.

