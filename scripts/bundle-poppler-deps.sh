#!/bin/bash

# Script to bundle Poppler with all its dependencies for macOS
# This fixes library paths so the binary works in the packaged app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POPPLER_DIR="$PROJECT_ROOT/resources/poppler/darwin"

if [ ! -f "$POPPLER_DIR/pdftoppm" ]; then
    echo "Error: pdftoppm not found at $POPPLER_DIR/pdftoppm"
    echo "Please run download-poppler.sh first"
    exit 1
fi

echo "Bundling Poppler dependencies for macOS..."

# Get Homebrew prefix
BREW_PREFIX=$(brew --prefix)

# Create libs directory for dependencies
LIBS_DIR="$POPPLER_DIR/libs"
mkdir -p "$LIBS_DIR"

# Copy required dylibs
echo "Copying required libraries..."

# Copy libpoppler (need the main libpoppler.155.dylib, not glib or cpp versions)
POPPLER_LIB=$(find "$BREW_PREFIX/opt/poppler/lib" -name "libpoppler.155*.dylib" | grep -v glib | grep -v cpp | head -1)
if [ -z "$POPPLER_LIB" ]; then
    # Fallback to any libpoppler that's not glib or cpp
    POPPLER_LIB=$(find "$BREW_PREFIX/opt/poppler/lib" -name "libpoppler.dylib" | head -1)
fi
if [ -n "$POPPLER_LIB" ]; then
    cp "$POPPLER_LIB" "$LIBS_DIR/libpoppler.155.dylib"
    echo "  ✓ Copied libpoppler.155.dylib from $(basename $POPPLER_LIB)"
fi

# Copy liblcms2 (little-cms2)
LCMS_LIB="$BREW_PREFIX/opt/little-cms2/lib/liblcms2.2.dylib"
if [ -f "$LCMS_LIB" ]; then
    # Remove old file if it exists and is read-only
    [ -f "$LIBS_DIR/liblcms2.2.dylib" ] && chmod u+w "$LIBS_DIR/liblcms2.2.dylib" 2>/dev/null || true
    rm -f "$LIBS_DIR/liblcms2.2.dylib"
    cp "$LCMS_LIB" "$LIBS_DIR/"
    chmod 644 "$LIBS_DIR/liblcms2.2.dylib"
    echo "  ✓ Copied liblcms2.2.dylib"
fi

# Fix library paths in pdftoppm using install_name_tool
echo "Fixing library paths in pdftoppm..."

# Get absolute path to libs directory
LIBS_ABS_PATH=$(cd "$LIBS_DIR" && pwd)

# Fix libpoppler path to use @loader_path (relative to binary location)
if [ -f "$LIBS_DIR/libpoppler.155.dylib" ]; then
    # Change @rpath/libpoppler.155.dylib to @loader_path/libs/libpoppler.155.dylib
    install_name_tool -change "@rpath/libpoppler.155.dylib" "@loader_path/libs/libpoppler.155.dylib" "$POPPLER_DIR/pdftoppm"
    echo "  ✓ Fixed libpoppler path to @loader_path/libs/libpoppler.155.dylib"
    
    # Also set the rpath to include libs directory as fallback
    install_name_tool -add_rpath "@loader_path/libs" "$POPPLER_DIR/pdftoppm" 2>/dev/null || true
fi

# Fix liblcms2 path
if [ -f "$LIBS_DIR/liblcms2.2.dylib" ]; then
    install_name_tool -change "$LCMS_LIB" "@loader_path/libs/liblcms2.2.dylib" "$POPPLER_DIR/pdftoppm"
    echo "  ✓ Fixed liblcms2 path"
fi

# Fix library paths in the dylibs themselves
for DYLIB in "$LIBS_DIR"/*.dylib; do
    if [ -f "$DYLIB" ]; then
        # Fix libpoppler's own dependencies if needed
        install_name_tool -id "@loader_path/$(basename $DYLIB)" "$DYLIB" 2>/dev/null || true
        
        # Fix liblcms2 reference in libpoppler if it exists
        if otool -L "$DYLIB" | grep -q "little-cms2"; then
            install_name_tool -change "$LCMS_LIB" "@loader_path/liblcms2.2.dylib" "$DYLIB" 2>/dev/null || true
        fi
    fi
done

echo ""
echo "✅ Poppler dependencies bundled successfully!"
echo ""
echo "Files in $POPPLER_DIR:"
ls -lh "$POPPLER_DIR" | grep -E "(pdftoppm|libs)" || true

