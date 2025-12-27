#!/usr/bin/env node

/**
 * Notarization script for macOS apps
 * This runs after code signing to notarize the app with Apple
 */

const { notarize } = require('@electron/notarize');
const path = require('path');
const fs = require('fs');

// Load .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed or .env doesn't exist
}

module.exports = async function(context) {
  const { electronPlatformName, appOutDir } = context;
  
  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Check for required environment variables
  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('⚠️  Notarization skipped: Missing credentials');
    console.warn('   Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID in .env file');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  if (!fs.existsSync(appPath)) {
    console.warn(`⚠️  App not found at ${appPath}, skipping notarization`);
    return;
  }

  console.log(`📦 Notarizing ${appName}...`);
  console.log(`   App: ${appPath}`);
  console.log(`   Apple ID: ${appleId}`);
  console.log(`   Team ID: ${teamId}`);

  try {
    await notarize({
      tool: 'notarytool',
      appBundleId: 'com.wyzard.app',
      appPath: appPath,
      appleId: appleId,
      appleIdPassword: appleIdPassword,
      teamId: teamId,
    });

    console.log('✅ Notarization complete!');
  } catch (error) {
    console.error('❌ Notarization failed:', error.message);
    throw error;
  }
};

