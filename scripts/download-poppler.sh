#!/bin/bash

# Script to download Poppler binaries for bundling with Electron app
# This script downloads Poppler binaries for macOS, Windows, and Linux

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESOURCES_DIR="$PROJECT_ROOT/resources/poppler"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Downloading Poppler binaries for Electron bundling...${NC}"

# macOS (darwin)
echo -e "\n${YELLOW}Downloading macOS (darwin) binaries...${NC}"
DARWIN_DIR="$RESOURCES_DIR/darwin"
mkdir -p "$DARWIN_DIR"

# For macOS, we'll use Homebrew's poppler if available, or download from a reliable source
if command -v brew &> /dev/null; then
    echo "Using Homebrew to get Poppler binaries..."
    BREW_PREFIX=$(brew --prefix)
    if [ -f "$BREW_PREFIX/bin/pdftoppm" ]; then
        cp "$BREW_PREFIX/bin/pdftoppm" "$DARWIN_DIR/"
        echo "✓ Copied pdftoppm for macOS"
        
        # Copy required libraries if they exist
        if [ -d "$BREW_PREFIX/lib" ]; then
            # Note: You may need to adjust library paths or use @rpath
            echo "Note: You may need to adjust library paths for macOS binaries"
        fi
    else
        echo "⚠ Homebrew Poppler not found. Please install with: brew install poppler"
        echo "  Then run this script again, or manually copy pdftoppm to $DARWIN_DIR/"
    fi
else
    echo "⚠ Homebrew not found. Please install Poppler manually:"
    echo "  1. Install Homebrew: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo "  2. Install Poppler: brew install poppler"
    echo "  3. Copy pdftoppm to $DARWIN_DIR/"
fi

# Windows (win32)
echo -e "\n${YELLOW}Downloading Windows (win32) binaries...${NC}"
WIN32_DIR="$RESOURCES_DIR/win32"
mkdir -p "$WIN32_DIR"

# Download from a reliable Windows Poppler distribution
POPPLER_VERSION="23.11.0"
WINDOWS_URL="https://github.com/oschwartz10612/poppler-windows/releases/download/v${POPPLER_VERSION}-0/Release-${POPPLER_VERSION}-0.zip"

if command -v curl &> /dev/null; then
    echo "Downloading Windows Poppler from GitHub..."
    TEMP_ZIP=$(mktemp)
    curl -L -o "$TEMP_ZIP" "$WINDOWS_URL" || {
        echo "⚠ Failed to download Windows binaries. You can manually download from:"
        echo "  $WINDOWS_URL"
        echo "  Extract pdftoppm.exe to $WIN32_DIR/"
        rm -f "$TEMP_ZIP"
    }
    
    if [ -f "$TEMP_ZIP" ]; then
        TEMP_DIR=$(mktemp -d)
        unzip -q "$TEMP_ZIP" -d "$TEMP_DIR" || {
            echo "⚠ Failed to extract. Please extract manually and copy pdftoppm.exe to $WIN32_DIR/"
            rm -rf "$TEMP_DIR" "$TEMP_ZIP"
        }
        
        # Find pdftoppm.exe in the extracted files
        if find "$TEMP_DIR" -name "pdftoppm.exe" -type f | head -1 | xargs -I {} cp {} "$WIN32_DIR/"; then
            echo "✓ Downloaded pdftoppm.exe for Windows"
        else
            echo "⚠ Could not find pdftoppm.exe in downloaded archive"
        fi
        
        rm -rf "$TEMP_DIR" "$TEMP_ZIP"
    fi
else
    echo "⚠ curl not found. Please download Windows Poppler manually from:"
    echo "  $WINDOWS_URL"
    echo "  Extract pdftoppm.exe to $WIN32_DIR/"
fi

# Linux
echo -e "\n${YELLOW}Downloading Linux binaries...${NC}"
LINUX_DIR="$RESOURCES_DIR/linux"
mkdir -p "$LINUX_DIR"

# For Linux, we can use the system package manager or download static binaries
if command -v apt-get &> /dev/null; then
    echo "Using apt-get to get Poppler binaries..."
    if dpkg -l | grep -q poppler-utils; then
        # Copy from system installation
        if [ -f "/usr/bin/pdftoppm" ]; then
            cp "/usr/bin/pdftoppm" "$LINUX_DIR/"
            echo "✓ Copied pdftoppm for Linux"
            
            # Copy required libraries
            echo "Note: You may need to bundle required libraries for Linux"
            ldd /usr/bin/pdftoppm 2>/dev/null || echo "  (ldd not available to check dependencies)"
        fi
    else
        echo "⚠ poppler-utils not installed. Please install with: sudo apt-get install poppler-utils"
        echo "  Then run this script again, or manually copy pdftoppm to $LINUX_DIR/"
    fi
elif command -v yum &> /dev/null; then
    echo "Using yum to get Poppler binaries..."
    if rpm -q poppler-utils &> /dev/null; then
        if [ -f "/usr/bin/pdftoppm" ]; then
            cp "/usr/bin/pdftoppm" "$LINUX_DIR/"
            echo "✓ Copied pdftoppm for Linux"
        fi
    else
        echo "⚠ poppler-utils not installed. Please install with: sudo yum install poppler-utils"
    fi
else
    echo "⚠ Package manager not found. Please install Poppler manually and copy pdftoppm to $LINUX_DIR/"
fi

echo -e "\n${GREEN}Done!${NC}"
echo ""
echo "Summary:"
echo "  macOS:   $DARWIN_DIR/pdftoppm"
echo "  Windows: $WIN32_DIR/pdftoppm.exe"
echo "  Linux:   $LINUX_DIR/pdftoppm"
echo ""
echo "Note: For production builds, you may need to:"
echo "  - Adjust library paths (especially on macOS)"
echo "  - Bundle required shared libraries (especially on Linux)"
echo "  - Test the bundled binaries before distribution"

