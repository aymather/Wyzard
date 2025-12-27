# Wyzard

A simple desktop application built with Electron.js and React that extracts text from PDF files using OCR (Tesseract.js). All processing happens locally on your computer for maximum security.

## Features

- 🖱️ Drag and drop PDF files
- 🔍 OCR text extraction using Tesseract.js
- 💾 Save extracted text as .txt files
- 🔒 100% local processing - no network communication
- 🎨 Modern, clean UI

## Installation

1. Install system dependencies (required for PDF processing):
   - **macOS**: Install poppler using Homebrew:
     ```bash
     brew install poppler
     ```
   - **Linux**: Install poppler-utils:
     ```bash
     sudo apt-get install poppler-utils  # Debian/Ubuntu
     # or
     sudo yum install poppler-utils      # RHEL/CentOS
     ```
   - **Windows**: Download poppler from [here](http://blog.alivate.com.au/poppler-windows/) and add it to your PATH

2. Install Node.js dependencies:
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
- **poppler-utils** (system) - PDF to image conversion via pdftoppm command

## License

MIT

