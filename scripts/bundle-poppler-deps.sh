#!/bin/bash

# Script to bundle Poppler with all its dependencies for macOS
# This fixes library paths so the binary works in the packaged app without system dependencies

# Don't exit on error for path fixing operations
set +e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
POPPLER_DIR="$PROJECT_ROOT/resources/poppler/darwin"

if [ ! -f "$POPPLER_DIR/pdftoppm" ]; then
    echo "Error: pdftoppm not found at $POPPLER_DIR/pdftoppm"
    echo "Please run download-poppler.sh first"
    exit 1
fi

echo "Bundling Poppler dependencies for macOS..."
echo ""

# Get Homebrew prefix
BREW_PREFIX=$(brew --prefix)

# Create libs directory for dependencies
LIBS_DIR="$POPPLER_DIR/libs"
mkdir -p "$LIBS_DIR"

# Function to copy a library and return 1 if copied, 0 if not
copy_lib() {
    local lib_path="$1"
    local lib_name=$(basename "$lib_path")
    
    # Skip system libraries (in /usr/lib or /System)
    if [[ "$lib_path" == /usr/lib/* ]] || [[ "$lib_path" == /System/* ]]; then
        return 0
    fi
    
    # Skip if already copied
    if [ -f "$LIBS_DIR/$lib_name" ]; then
        return 0
    fi
    
    # Copy the library
    if [ -f "$lib_path" ]; then
        cp "$lib_path" "$LIBS_DIR/"
        chmod 644 "$LIBS_DIR/$lib_name"
        echo "  ✓ Copied $lib_name"
        return 1  # Return 1 to indicate we copied something
    fi
    
    return 0
}

# Function to find a library by name in Homebrew
find_lib() {
    local lib_name="$1"
    local found=$(find "$BREW_PREFIX/opt" -name "$lib_name" -type f 2>/dev/null | head -1)
    echo "$found"
}

# Copy required dylibs
echo "Step 1: Copying core libraries..."

# Copy libpoppler (if not already present)
if [ ! -f "$LIBS_DIR/libpoppler.155.dylib" ]; then
    POPPLER_LIB=$(find "$BREW_PREFIX/opt/poppler/lib" -name "libpoppler.155*.dylib" 2>/dev/null | grep -v glib | grep -v cpp | head -1)
    if [ -z "$POPPLER_LIB" ]; then
        POPPLER_LIB=$(find "$BREW_PREFIX/opt/poppler/lib" -name "libpoppler.dylib" 2>/dev/null | head -1)
    fi
    if [ -n "$POPPLER_LIB" ] && [ -f "$POPPLER_LIB" ]; then
        cp "$POPPLER_LIB" "$LIBS_DIR/libpoppler.155.dylib"
        chmod 644 "$LIBS_DIR/libpoppler.155.dylib"
        echo "  ✓ Copied libpoppler.155.dylib"
    else
        echo "  ⚠ libpoppler.155.dylib not found in Homebrew, using existing copy"
    fi
else
    echo "  ✓ libpoppler.155.dylib already exists"
    # Get the original path for later path fixing
    POPPLER_LIB=$(otool -L "$LIBS_DIR/libpoppler.155.dylib" | grep -E "^\s+.*libpoppler" | head -1 | awk '{print $1}' | grep -v "@loader_path" || echo "")
fi

# Copy liblcms2 (if not already present)
if [ ! -f "$LIBS_DIR/liblcms2.2.dylib" ]; then
    LCMS_LIB="$BREW_PREFIX/opt/little-cms2/lib/liblcms2.2.dylib"
    if [ -f "$LCMS_LIB" ]; then
        cp "$LCMS_LIB" "$LIBS_DIR/"
        chmod 644 "$LIBS_DIR/liblcms2.2.dylib"
        echo "  ✓ Copied liblcms2.2.dylib"
    else
        echo "  ⚠ liblcms2.2.dylib not found in Homebrew, using existing copy"
        LCMS_LIB=""
    fi
else
    echo "  ✓ liblcms2.2.dylib already exists"
    LCMS_LIB="$BREW_PREFIX/opt/little-cms2/lib/liblcms2.2.dylib"
fi

# List of known dependencies to copy (based on otool -L output)
echo ""
echo "Step 2: Copying known dependencies..."
echo "Note: Some optional dependencies (gpgmepp, nss, gpgme) may not be installed."
echo "      If you see warnings about missing libraries, you can install them with:"
echo "      brew install gpgmepp nss gpgme"
echo ""

# Get dependencies from libpoppler.155.dylib
if [ -f "$LIBS_DIR/libpoppler.155.dylib" ]; then
    deps=$(otool -L "$LIBS_DIR/libpoppler.155.dylib" | grep -E "^\s+.*\.dylib" | awk '{print $1}' | grep -v "^@" | grep -v "^/usr/lib" | grep -v "^/System")
    
    for dep in $deps; do
        dep_name=$(basename "$dep")
        
        # Try the exact path first
        if [ -f "$dep" ]; then
            copy_lib "$dep"
        else
            # Try to find it
            found=$(find_lib "$dep_name")
            if [ -n "$found" ] && [ -f "$found" ]; then
                copy_lib "$found"
            fi
        fi
    done
fi

# Recursively copy dependencies of dependencies
echo ""
echo "Step 3: Copying transitive dependencies..."

changed=true
iteration=0
max_iterations=5

while [ "$changed" = true ] && [ $iteration -lt $max_iterations ]; do
    changed=false
    iteration=$((iteration + 1))
    
    for dylib in "$LIBS_DIR"/*.dylib; do
        if [ ! -f "$dylib" ]; then
            continue
        fi
        
        deps=$(otool -L "$dylib" | grep -E "^\s+.*\.dylib" | awk '{print $1}' | grep -v "^@" | grep -v "^/usr/lib" | grep -v "^/System" | grep -v "@loader_path")
        
        for dep in $deps; do
            dep_name=$(basename "$dep")
            
            # Skip if already copied
            if [ -f "$LIBS_DIR/$dep_name" ]; then
                continue
            fi
            
            # Try the exact path first
            if [ -f "$dep" ]; then
                copy_lib "$dep"
                if [ $? -eq 1 ]; then
                    changed=true
                fi
            else
                # Try to find it
                found=$(find_lib "$dep_name")
                if [ -n "$found" ] && [ -f "$found" ]; then
                    copy_lib "$found"
                    if [ $? -eq 1 ]; then
                        changed=true
                    fi
                fi
            fi
        done
    done
done

# Fix library paths
echo ""
echo "Step 4: Fixing library paths to use @loader_path..."

# Fix paths in pdftoppm
if [ -f "$LIBS_DIR/libpoppler.155.dylib" ]; then
    install_name_tool -change "@rpath/libpoppler.155.dylib" "@loader_path/libs/libpoppler.155.dylib" "$POPPLER_DIR/pdftoppm" 2>/dev/null || true
    if [ -n "$POPPLER_LIB" ]; then
        install_name_tool -change "$POPPLER_LIB" "@loader_path/libs/libpoppler.155.dylib" "$POPPLER_DIR/pdftoppm" 2>/dev/null || true
    fi
    echo "  ✓ Fixed libpoppler path in pdftoppm"
fi

if [ -f "$LIBS_DIR/liblcms2.2.dylib" ]; then
    install_name_tool -change "$LCMS_LIB" "@loader_path/libs/liblcms2.2.dylib" "$POPPLER_DIR/pdftoppm" 2>/dev/null || true
    echo "  ✓ Fixed liblcms2 path in pdftoppm"
fi

# Fix paths in all dylibs recursively
for dylib in "$LIBS_DIR"/*.dylib; do
    if [ ! -f "$dylib" ]; then
        continue
    fi
    
    lib_name=$(basename "$dylib")
    
    # Set the library ID
    install_name_tool -id "@loader_path/$lib_name" "$dylib" 2>/dev/null || true
    
    # Get all dependencies and fix their paths
    deps=$(otool -L "$dylib" | grep -E "^\s+.*\.dylib" | awk '{print $1}' | grep -v "^@" | grep -v "^/usr/lib" | grep -v "^/System")
    
    for dep in $deps; do
        dep_name=$(basename "$dep")
        
        # Only fix if we have this library bundled
        if [ -f "$LIBS_DIR/$dep_name" ]; then
            install_name_tool -change "$dep" "@loader_path/$dep_name" "$dylib" 2>/dev/null || true
        else
            # If library doesn't exist, try to find and copy it
            if [ ! -f "$dep" ]; then
                found=$(find_lib "$dep_name")
                if [ -n "$found" ] && [ -f "$found" ]; then
                    # Found it, copy it
                    copy_lib "$found"
                    if [ -f "$LIBS_DIR/$dep_name" ]; then
                        # Now fix the path
                        install_name_tool -change "$dep" "@loader_path/$dep_name" "$dylib" 2>/dev/null || true
                    fi
                fi
                # If we still can't find it, leave the original path
                # (don't create empty load commands - that breaks dyld)
            fi
        fi
    done
done

echo ""
echo "Step 5: Verifying library paths..."

# Verify that all non-system dependencies are now using @loader_path
warnings=0
for dylib in "$LIBS_DIR"/*.dylib; do
    if [ ! -f "$dylib" ]; then
        continue
    fi
    
    bad_paths=$(otool -L "$dylib" | grep -E "^\s+.*\.dylib" | awk '{print $1}' | grep -v "^@" | grep -v "^/usr/lib" | grep -v "^/System" | grep -v "^@loader_path" || true)
    if [ -n "$bad_paths" ]; then
        echo "  ⚠ Warning: $(basename $dylib) still has hardcoded paths:"
        echo "$bad_paths" | sed 's/^/    /'
        warnings=$((warnings + 1))
    fi
done

if [ $warnings -eq 0 ]; then
    echo "  ✓ All library paths fixed successfully"
fi

echo ""
echo "✅ Poppler dependencies bundled successfully!"
echo ""
echo "Files in $POPPLER_DIR/libs:"
ls -lh "$LIBS_DIR" | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'
