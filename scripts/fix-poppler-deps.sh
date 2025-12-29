#!/bin/bash

# Quick fix script to restore and rebundle Poppler dependencies
# Run this after installing missing dependencies: brew install gpgmepp nss gpgme

set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POPPLER_DIR="$PROJECT_ROOT/resources/poppler/darwin"
BREW_PREFIX=$(brew --prefix 2>/dev/null || echo "/usr/local")

echo "Restoring original libpoppler.155.dylib from Homebrew..."

# Restore original libpoppler
POPPLER_LIB=$(find "$BREW_PREFIX/opt/poppler/lib" -name "libpoppler.155*.dylib" 2>/dev/null | grep -v glib | grep -v cpp | head -1)
if [ -n "$POPPLER_LIB" ] && [ -f "$POPPLER_LIB" ]; then
    cp "$POPPLER_LIB" "$POPPLER_DIR/libs/libpoppler.155.dylib"
    echo "✓ Restored original libpoppler.155.dylib"
else
    echo "⚠ Could not find original libpoppler.155.dylib in Homebrew"
    echo "  Make sure poppler is installed: brew install poppler"
    exit 1
fi

echo ""
echo "Now running bundle-poppler-deps.sh to rebundle all dependencies..."
echo ""

bash "$SCRIPT_DIR/bundle-poppler-deps.sh"

