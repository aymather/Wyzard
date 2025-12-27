# Poppler Binaries

This directory contains platform-specific Poppler binaries (`pdftoppm`) that are bundled with the Electron app.

## Directory Structure

```
poppler/
├── darwin/     # macOS binaries
│   └── pdftoppm
├── win32/      # Windows binaries
│   └── pdftoppm.exe
└── linux/      # Linux binaries
    └── pdftoppm
```

## Downloading Binaries

### Option 1: Use the Download Script (Recommended)

Run the provided script to automatically download/copy Poppler binaries:

```bash
./scripts/download-poppler.sh
```

### Option 2: Manual Installation

#### macOS (darwin)

1. Install Poppler using Homebrew:
   ```bash
   brew install poppler
   ```

2. Copy the binary:
   ```bash
   cp $(brew --prefix)/bin/pdftoppm resources/poppler/darwin/
   ```

#### Windows (win32)

1. Download Poppler for Windows from:
   - https://github.com/oschwartz10612/poppler-windows/releases
   - Or: http://blog.alivate.com.au/poppler-windows/

2. Extract the archive and copy `pdftoppm.exe` to `resources/poppler/win32/`

#### Linux

1. Install Poppler using your package manager:
   ```bash
   # Debian/Ubuntu
   sudo apt-get install poppler-utils
   
   # RHEL/CentOS
   sudo yum install poppler-utils
   ```

2. Copy the binary:
   ```bash
   cp /usr/bin/pdftoppm resources/poppler/linux/
   ```

## Important Notes

- **macOS**: You may need to adjust library paths or use `@rpath` for the bundled binary to find its dependencies. Consider using `install_name_tool` if needed.

- **Linux**: You may need to bundle required shared libraries. Use `ldd pdftoppm` to check dependencies and copy them to the same directory or adjust `LD_LIBRARY_PATH`.

- **Windows**: The binary should be self-contained, but ensure all required DLLs are included.

## Testing

After adding binaries, test them locally:

```bash
# macOS
./resources/poppler/darwin/pdftoppm -h

# Windows (in PowerShell)
.\resources\poppler\win32\pdftoppm.exe -h

# Linux
./resources/poppler/linux/pdftoppm -h
```

## Git

The binaries are typically large and platform-specific. Consider adding them to `.gitignore` if you prefer to download them during the build process, or commit them if you want them in version control.

