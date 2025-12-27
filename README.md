# Wyzard

A simple desktop application built with Electron.js and React that extracts text from PDF files using OCR (Tesseract.js). All processing happens locally on your computer for maximum security.

## Features

- 🖱️ Drag and drop PDF files
- 🔍 OCR text extraction using Tesseract.js
- 💾 Save extracted text as .txt files
- 🔒 100% local processing - no network communication
- 🎨 Modern, clean UI

## Installation

### For End Users

**No additional installation required!** Poppler binaries are bundled with the application, so you don't need to install anything via Homebrew or package managers.

### For Developers

1. Install Node.js dependencies:
```bash
yarn install
```

## Development

To run the application in development mode:

```bash
# Terminal 1: Start React dev server
yarn start

# Terminal 2: Start Electron
yarn electron-dev
```

## Building

### Preparing Poppler Binaries

Before building, you need to download/copy Poppler binaries for each platform you want to support:

**Option 1: Use the download script (recommended)**
```bash
./scripts/download-poppler.sh
```

**Option 2: Manual installation**
See `resources/poppler/README.md` for detailed instructions.

The binaries should be placed in:
- `resources/poppler/darwin/pdftoppm` (macOS)
- `resources/poppler/win32/pdftoppm.exe` (Windows)
- `resources/poppler/linux/pdftoppm` (Linux)

### Building the Application

To build the application for production:

```bash
yarn build
yarn electron-pack
```

The built application will be in the `dist` folder.

## Usage

1. Launch the application
2. Drag and drop a PDF file into the drop zone (or click to browse)
3. Wait for OCR processing to complete
4. Choose where to save the extracted text file
5. Done!

## Technology Stack

- **Electron.js** - Desktop application framework
- **React.js** - Frontend UI
- **Tesseract.js** - OCR engine
- **Poppler** (bundled) - PDF to image conversion via pdftoppm command

## License

MIT

