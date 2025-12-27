# Distribution Guide

This guide explains what files to upload to your website for distribution.

## Building for Distribution

To build the app for both platforms:

```bash
# Build for your current platform
yarn electron-pack

# Or build for specific platforms (requires cross-compilation setup)
# macOS: yarn electron-pack --mac
# Windows: yarn electron-pack --win
```

## Output Location

After building, files will be organized by version in the `dist/` directory:

```
dist/
└── v1.0.0/                       ← Version folder (auto-created)
    ├── mac/
    │   ├── Wyzard-1.0.0.dmg      ← Upload this for macOS
    │   └── Wyzard-1.0.0-mac.zip  ← Alternative (optional)
    ├── win-unpacked/             ← Don't upload this
    └── Wyzard Setup 1.0.0.exe    ← Upload this for Windows
```

**Note:** Each version gets its own folder (`v{version}/`), keeping your builds organized as you release new versions.

## Files to Upload

### For macOS Users

**Primary file (recommended):**
- `dist/v1.0.0/mac/Wyzard-1.0.0.dmg` - Disk image file
  - Users double-click to mount, then drag the app to Applications
  - Most familiar to Mac users
  - File size: ~100-200MB typically

**Alternative (optional):**
- `dist/v1.0.0/mac/Wyzard-1.0.0-mac.zip` - ZIP archive
  - Users extract and run the .app directly
  - Good for users who prefer not to use DMG
  - File size: Similar to DMG

**Which to use?**
- **DMG is recommended** - it's the standard macOS distribution format
- You can offer both if you want

### For Windows Users

**Primary file:**
- `dist/v1.0.0/Wyzard Setup 1.0.0.exe` - NSIS installer
  - Users double-click to install
  - Standard Windows installer experience
  - File size: ~100-200MB typically

## Important Notes

### Code Signing (Recommended for Production)

**macOS:**
- Unsigned apps will show a warning: "Wyzard cannot be opened because it is from an unidentified developer"
- Users can bypass by: Right-click → Open → Open (in dialog)
- To sign: You need an Apple Developer account ($99/year)
- Add to `package.json`:
  ```json
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)"
  }
  ```

**Windows:**
- Unsigned apps may show Windows Defender SmartScreen warning
- Users can click "More info" → "Run anyway"
- To sign: You need a code signing certificate (purchased from certificate authority)
- Add to `package.json`:
  ```json
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "password"
  }
  ```

**For now (testing/early releases):**
- You can distribute unsigned apps
- Users will see warnings but can still install
- Consider signing before wider distribution

### File Naming

Files are automatically named based on:
- `productName` from package.json ("Wyzard")
- `version` from package.json ("1.0.0")

Example: `Wyzard-1.0.0.dmg`, `Wyzard Setup 1.0.0.exe`

### File Sizes

Expect files to be:
- **macOS DMG/ZIP**: 100-200MB (includes Electron runtime + your app + Poppler binaries)
- **Windows EXE**: 100-200MB (includes Electron runtime + your app + Poppler binaries)

These are normal sizes for Electron apps with bundled dependencies.

## Uploading to Your Website

### Recommended Structure

```
your-website.com/
└── downloads/
    ├── mac/
    │   └── Wyzard-1.0.0.dmg
    └── windows/
        └── Wyzard-Setup-1.0.0.exe
```

### HTML Download Links Example

```html
<!-- macOS Download -->
<a href="/downloads/mac/Wyzard-1.0.0.dmg" download>
  Download for macOS
</a>

<!-- Windows Download -->
<a href="/downloads/windows/Wyzard-Setup-1.0.0.exe" download>
  Download for Windows
</a>
```

### Best Practices

1. **Version your files**: Files are automatically organized by version in `dist/v{version}/` folders
2. **Provide checksums**: Generate SHA256 hashes for security
   ```bash
   shasum -a 256 dist/v1.0.0/mac/Wyzard-1.0.0.dmg
   shasum -a 256 dist/v1.0.0/Wyzard\ Setup\ 1.0.0.exe
   ```
3. **Test before uploading**: Always test installers on clean systems
4. **Update version**: Update `version` in `package.json` before each release (new builds will automatically go to the new version folder)
5. **Keep old versions**: Previous version folders remain in `dist/`, making it easy to keep old versions available

## Testing Before Distribution

### macOS Testing
1. Build: `yarn electron-pack`
2. Test DMG: Open `dist/v1.0.0/mac/Wyzard-1.0.0.dmg`
3. Install: Drag app to Applications
4. **Bypass security warning** (required for unsigned apps):
   - Right-click on `Wyzard.app` in Applications
   - Select "Open" → Click "Open" in dialog
   - Or run: `xattr -cr /Applications/Wyzard.app`
5. Verify: Launch the app
6. Test Poppler: Process a PDF to ensure bundled binaries work

**Note:** The malware warning is expected for unsigned apps. See `MACOS_SIGNING.md` for solutions.

### Windows Testing
1. Build on Windows (or use CI/CD)
2. Test installer: Run `dist/v1.0.0/Wyzard Setup 1.0.0.exe`
3. Verify: Install, launch app
4. Test Poppler: Process a PDF to ensure bundled binaries work

## Quick Checklist

Before uploading:
- [ ] Built with `yarn electron-pack`
- [ ] Tested installer on target platform
- [ ] Verified Poppler binaries work (process a test PDF)
- [ ] Updated version number in `package.json` (if releasing new version)
- [ ] Files are in `dist/v{version}/` directory
- [ ] File sizes are reasonable (~100-200MB)
- [ ] (Optional) Generated checksums for security

## Summary

**Upload these files (replace `1.0.0` with your actual version):**
- ✅ `dist/v1.0.0/mac/Wyzard-1.0.0.dmg` - For macOS users
- ✅ `dist/v1.0.0/Wyzard Setup 1.0.0.exe` - For Windows users

That's it! These are the only two files you need to upload.

**Version Organization:**
- Each build automatically creates a `dist/v{version}/` folder
- When you update the version in `package.json` and rebuild, new files go to the new version folder
- Old version folders remain, making it easy to maintain multiple versions

