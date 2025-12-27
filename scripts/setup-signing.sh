#!/bin/bash

# Script to help set up code signing configuration

echo "🔐 Code Signing Setup for Wyzard"
echo "================================"
echo ""

# Check for Developer ID
echo "Checking for Developer ID certificates..."
IDENTITIES=$(security find-identity -v -p codesigning | grep "Developer ID Application")

if [ -z "$IDENTITIES" ]; then
    echo "❌ No Developer ID Application certificate found."
    echo ""
    echo "You need to create one:"
    echo "1. Open Xcode"
    echo "2. Preferences → Accounts"
    echo "3. Select your Apple ID → Manage Certificates"
    echo "4. Click + → Developer ID Application"
    echo ""
    echo "Or visit: https://developer.apple.com/account/resources/certificates/list"
    echo ""
    exit 1
fi

echo "✅ Found Developer ID certificates:"
echo "$IDENTITIES"
echo ""

# Ask user to select
echo "Please copy the FULL identity string (everything in quotes) from above:"
read -p "Developer ID Identity: " DEV_ID

if [ -z "$DEV_ID" ]; then
    echo "❌ No identity provided"
    exit 1
fi

# Get Team ID
echo ""
echo "Getting Team ID..."
TEAM_ID=$(echo "$DEV_ID" | grep -o '([A-Z0-9]*)$' | tr -d '()')

if [ -z "$TEAM_ID" ]; then
    echo "Could not extract Team ID from identity. Please enter manually:"
    read -p "Team ID: " TEAM_ID
fi

# Get Apple ID
echo ""
read -p "Apple ID email (for notarization): " APPLE_ID

# Get app-specific password
echo ""
echo "You need an App-Specific Password for notarization:"
echo "1. Go to https://appleid.apple.com"
echo "2. Security → App-Specific Passwords"
echo "3. Generate a new password"
echo ""
read -p "App-Specific Password: " APP_SPECIFIC_PASSWORD

# Create .env file for electron-builder
echo ""
echo "Creating .env file with credentials..."
cat > .env << EOF
# Code Signing Configuration
APPLE_ID=$APPLE_ID
APPLE_TEAM_ID=$TEAM_ID
APPLE_APP_SPECIFIC_PASSWORD=$APP_SPECIFIC_PASSWORD
APPLE_IDENTITY=$DEV_ID
EOF

echo "✅ Created .env file with your credentials"
echo ""
echo "Next steps:"
echo "1. Update package.json with identity: $DEV_ID"
echo "2. The .env file will be used automatically by electron-builder"
echo "3. Run: yarn electron-pack"
echo ""
echo "⚠️  Make sure .env is in .gitignore (it contains sensitive info)"

