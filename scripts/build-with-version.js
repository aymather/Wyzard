#!/usr/bin/env node

/**
 * Build script that organizes output by version number
 * Creates dist/v{version}/ directory structure
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed or .env doesn't exist
}

// Read version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

if (!version) {
  console.error('Error: No version found in package.json');
  process.exit(1);
}

// Set output directory to dist/v{version}/
const outputDir = path.join(__dirname, '..', 'dist', `v${version}`);
const outputDirRelative = `dist/v${version}`;

console.log(`Building version ${version}...`);
console.log(`Output directory: ${outputDirRelative}\n`);

// Ensure React build is done first
console.log('Step 1: Building React app...');
try {
  execSync('yarn build', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
  console.log('✅ React build complete\n');
} catch (error) {
  console.error('❌ React build failed:', error.message);
  process.exit(1);
}

// Ensure entitlements file exists (React build clears the build/ folder)
const entitlementsPath = path.join(__dirname, '..', 'resources', 'mac', 'entitlements.mac.plist');
const entitlementsDir = path.dirname(entitlementsPath);
if (!fs.existsSync(entitlementsDir)) {
  fs.mkdirSync(entitlementsDir, { recursive: true });
}
if (!fs.existsSync(entitlementsPath)) {
  console.log('Creating entitlements file...');
  const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
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
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
`;
  fs.writeFileSync(entitlementsPath, entitlementsContent, 'utf8');
}

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Build electron app with custom output directory
console.log('Step 2: Packaging Electron app...');
try {
  // Build command with output directory
  let command = `electron-builder --config.directories.output=${outputDirRelative}`;
  
  // If identity is set in .env, pass it via command line
  // electron-builder doesn't expand env vars in package.json, so we pass it here
  if (process.env.APPLE_IDENTITY) {
    // electron-builder expects just the name and team ID, not "Developer ID Application:"
    // So we strip that prefix if present
    let identity = process.env.APPLE_IDENTITY;
    identity = identity.replace(/^Developer ID Application:\s*/i, '');
    identity = identity.replace(/"/g, '\\"');
    command += ` --config.mac.identity="${identity}"`;
    console.log(`Using identity: ${identity}`);
  }
  
  console.log(`Running: ${command}`);
  execSync(command, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: { ...process.env }, // Pass environment variables
  });
  
  console.log(`\n✅ Build complete! Files are in: ${outputDirRelative}`);
  console.log(`\nFiles to upload:`);
  
  // List files that should be uploaded
  if (fs.existsSync(path.join(outputDir, 'mac'))) {
    const macFiles = fs.readdirSync(path.join(outputDir, 'mac'))
      .filter(f => f.endsWith('.dmg') || f.endsWith('.zip'));
    macFiles.forEach(file => {
      console.log(`  macOS: ${outputDirRelative}/mac/${file}`);
    });
  }
  
  const winFiles = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.exe'));
  winFiles.forEach(file => {
    console.log(`  Windows: ${outputDirRelative}/${file}`);
  });
  
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}

