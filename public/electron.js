const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec, execSync } = require("child_process");
const { promisify } = require("util");
const Tesseract = require("tesseract.js");
const os = require("os");

const execAsync = promisify(exec);

// Get optimal concurrency based on CPU cores
const getOptimalConcurrency = () => {
  const cores = os.cpus().length;
  // Use 2x CPU cores for I/O bound operations, but cap at 16 to avoid overwhelming
  return Math.min(Math.max(cores * 2, 4), 16);
};

// Get path to bundled Poppler binary
function getPopplerBinaryPath() {
  const platform = process.platform;
  const isDev = process.env.ELECTRON_IS_DEV === "1";
  
  let binaryName;
  let resourcesPath;
  let platformDir;
  
  if (isDev) {
    // In development, binaries are in resources/poppler relative to project root
    resourcesPath = path.join(__dirname, "..", "resources", "poppler");
  } else {
    // In production, use app's resources path
    resourcesPath = path.join(process.resourcesPath, "poppler");
  }
  
  // Map process.platform to our directory structure
  // process.platform: 'darwin' (macOS), 'win32' (Windows), 'linux' (Linux)
  if (platform === "darwin") {
    platformDir = "darwin";
    binaryName = "pdftoppm";
  } else if (platform === "win32") {
    platformDir = "win32";
    binaryName = "pdftoppm.exe";
  } else if (platform === "linux") {
    platformDir = "linux";
    binaryName = "pdftoppm";
  } else {
    // Unknown platform, fallback to system binary
    return "pdftoppm";
  }
  
  const binaryPath = path.join(resourcesPath, platformDir, binaryName);
  
  // Check if bundled binary exists
  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }
  
  // Fallback to system-installed binary if bundled one doesn't exist
  // This allows development without bundling binaries first
  return "pdftoppm";
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Enable file drop
  mainWindow.webContents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    if (
      parsedUrl.origin !== "http://localhost:3000" &&
      parsedUrl.origin !== "file://"
    ) {
      event.preventDefault();
    }
  });

  const isDev = process.env.ELECTRON_IS_DEV === "1";

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../build/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Process PDF and extract text using OCR (optimized for speed)
async function processPDF(pdfPath, onProgress = null) {
  let tempDir = null;
  let workers = [];
  try {
    // Create a temporary directory for images
    tempDir = path.join(
      os.tmpdir(),
      `wyzard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    );
    fs.mkdirSync(tempDir, { recursive: true });

    const outputPrefix = path.join(tempDir, "page");

    // Get path to bundled Poppler binary (or fallback to system-installed)
    const pdftoppmPath = getPopplerBinaryPath();
    
    console.log(`[PDF Processing] Using pdftoppm at: ${pdftoppmPath}`);
    
    // On macOS, remove quarantine attribute if present (allows execution of bundled binaries)
    if (process.platform === "darwin" && pdftoppmPath !== "pdftoppm" && fs.existsSync(pdftoppmPath)) {
      try {
        // Remove quarantine attribute to allow execution
        execSync(`xattr -d com.apple.quarantine "${pdftoppmPath}" 2>/dev/null || true`);
        // Ensure binary is executable
        fs.chmodSync(pdftoppmPath, 0o755);
        
        // Check for required libraries
        const binaryDir = path.dirname(pdftoppmPath);
        const libsDir = path.join(binaryDir, "libs");
        if (fs.existsSync(libsDir)) {
          const libs = fs.readdirSync(libsDir).filter(f => f.endsWith('.dylib'));
          console.log(`[PDF Processing] Found ${libs.length} library dependencies: ${libs.join(', ')}`);
        } else {
          console.warn(`[PDF Processing] Warning: libs directory not found at ${libsDir}. Binary may fail to execute.`);
        }
      } catch (e) {
        // Ignore errors - binary might already be executable
        console.error(`[PDF Processing] Warning: Could not prepare pdftoppm binary: ${e.message}`);
      }
    }
    
    // Use DPI-based rendering (200 DPI) for good OCR quality while maintaining speed
    // Convert to grayscale (-gray) for faster OCR processing
    // This is better than scale-to as it ensures proper resolution for OCR
    // Quote the binary path in case it contains spaces (especially on Windows)
    
    // On macOS, set library path for bundled binaries
    let command;
    let execOptions = {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 5 * 60 * 1000, // 5 minutes
    };
    
    if (process.platform === "darwin" && pdftoppmPath !== "pdftoppm" && fs.existsSync(pdftoppmPath)) {
      // Set DYLD_LIBRARY_PATH to include the libs directory for bundled binary
      const binaryDir = path.dirname(pdftoppmPath);
      const libsDir = path.join(binaryDir, "libs");
      const env = { ...process.env };
      
      // Add libs directory to library path if it exists
      if (fs.existsSync(libsDir)) {
        env.DYLD_LIBRARY_PATH = libsDir + (env.DYLD_LIBRARY_PATH ? `:${env.DYLD_LIBRARY_PATH}` : '');
      }
      // Also add the binary directory itself (for @rpath resolution)
      env.DYLD_LIBRARY_PATH = binaryDir + (env.DYLD_LIBRARY_PATH ? `:${env.DYLD_LIBRARY_PATH}` : '');
      
      execOptions.env = env;
      command = `"${pdftoppmPath}" -png -gray -r 200 "${pdfPath}" "${outputPrefix}"`;
    } else {
      command = `"${pdftoppmPath}" -png -gray -r 200 "${pdfPath}" "${outputPrefix}"`;
    }

    console.log(`[PDF Processing] Executing: ${command}`);
    console.log(`[PDF Processing] Library path: ${execOptions.env?.DYLD_LIBRARY_PATH || 'default'}`);
    
    try {
      // Add timeout to prevent hanging (5 minutes max for large PDFs)
      const timeout = 5 * 60 * 1000; // 5 minutes in milliseconds
      const startTime = Date.now();
      
      const result = await Promise.race([
        execAsync(command, execOptions),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Command timed out after 5 minutes')), timeout)
        )
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`[PDF Processing] pdftoppm completed in ${duration}ms`);
      
      if (result.stderr) {
        console.warn(`[PDF Processing] pdftoppm stderr: ${result.stderr}`);
      }
    } catch (execError) {
      console.error(`[PDF Processing] Error executing pdftoppm:`, execError);
      // Check if pdftoppm is not found
      if (
        execError.message.includes("command not found") ||
        execError.message.includes("ENOENT") ||
        execError.code === 127
      ) {
        // Check if we tried to use bundled binary but it doesn't exist
        const bundledPath = getPopplerBinaryPath();
        if (bundledPath !== "pdftoppm") {
          if (!fs.existsSync(bundledPath)) {
            throw new Error(
              `Bundled Poppler binary not found at: ${bundledPath}. Please ensure Poppler binaries are included in the app bundle.`
            );
          }
          // Binary exists but can't execute - might be a permissions or signing issue
          throw new Error(
            `Bundled Poppler binary found at ${bundledPath} but cannot be executed. This may be a code signing or permissions issue.`
          );
        }
        throw new Error(
          "pdftoppm command not found. Please install poppler-utils: brew install poppler (macOS) or sudo apt-get install poppler-utils (Linux)"
        );
      }
      throw execError;
    }

    // Get all generated image files
    // pdftoppm outputs files like: page-01.png, page-02.png, etc.
    const files = fs
      .readdirSync(tempDir)
      .filter((f) => f.endsWith(".png") && f.startsWith("page-"))
      .sort((a, b) => {
        // Sort by page number (extract number from filename)
        const numA = parseInt(a.match(/page-(\d+)\.png$/)?.[1] || "0");
        const numB = parseInt(b.match(/page-(\d+)\.png$/)?.[1] || "0");
        return numA - numB;
      });

    if (files.length === 0) {
      throw new Error(
        "No pages were converted from the PDF. Make sure poppler-utils is installed (brew install poppler on macOS)."
      );
    }

    // Create a Tesseract worker pool for better performance
    // Reusing workers is much faster than creating new ones for each page
    const createWorker = async () => {
      return await Tesseract.createWorker("eng", 1, {
        logger: () => {}, // Suppress logging
      });
    };

    // Initialize worker pool
    const pageConcurrency = getOptimalConcurrency();
    workers = await Promise.all(
      Array(pageConcurrency)
        .fill(null)
        .map(() => createWorker())
    );

    // Process pages in parallel for faster processing
    const processPage = async (file, index, worker) => {
      const imagePath = path.join(tempDir, file);
      const imageBuffer = fs.readFileSync(imagePath);

      // Perform OCR with optimized settings for speed
      const {
        data: { text },
      } = await worker.recognize(imageBuffer, {
        // Use AUTO page segmentation for speed (faster than default)
        // This works well for most documents
      });

      // Clean up image file immediately
      fs.unlinkSync(imagePath);

      return { index, text };
    };
    // Process pages in parallel using worker pool
    const pageResults = [];
    let completedCount = 0;

    // Process all pages in parallel batches using the worker pool
    for (let i = 0; i < files.length; i += pageConcurrency) {
      const batch = files.slice(i, i + pageConcurrency);
      const batchPromises = batch.map((file, batchIndex) => {
        const fileIndex = i + batchIndex;
        const worker = workers[batchIndex % workers.length]; // Round-robin worker assignment
        return processPage(file, fileIndex, worker).then((result) => {
          completedCount++;
          // Report progress more frequently
          if (onProgress) {
            onProgress(completedCount, files.length);
          }
          return result;
        });
      });

      const batchResults = await Promise.all(batchPromises);
      pageResults.push(...batchResults);
    }

    // Terminate all workers
    await Promise.all(workers.map((worker) => worker.terminate()));

    // Sort results by page index and combine text
    pageResults.sort((a, b) => a.index - b.index);
    let allText = "";

    for (let i = 0; i < pageResults.length; i++) {
      allText += pageResults[i].text;
      if (i < pageResults.length - 1) {
        allText += "\n\n--- Page " + (i + 1) + " ---\n\n";
      }
    }

    // Clean up temp directory
    try {
      fs.rmdirSync(tempDir);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    return allText;
  } catch (error) {
    // Make sure workers are terminated even on error
    if (workers && workers.length > 0) {
      try {
        await Promise.all(workers.map((worker) => worker.terminate()));
      } catch (e) {
        // Ignore termination errors
      }
    }

    // Clean up temp directory on error
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        const files = fs.readdirSync(tempDir);
        files.forEach((file) => {
          try {
            fs.unlinkSync(path.join(tempDir, file));
          } catch (e) {
            // Ignore individual file errors
          }
        });
        try {
          fs.rmdirSync(tempDir);
        } catch (e) {
          // Ignore directory removal errors
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    // Provide helpful error message for missing poppler
    if (
      error.message.includes("pdftoppm") ||
      error.message.includes("command not found") ||
      error.message.includes("ENOENT") ||
      error.message.includes("Bundled Poppler binary not found")
    ) {
      // Check if bundled binary exists
      const bundledPath = getPopplerBinaryPath();
      if (bundledPath !== "pdftoppm" && !fs.existsSync(bundledPath)) {
        throw new Error(
          "Bundled Poppler binary not found. Please ensure Poppler binaries are included in the app bundle."
        );
      }
      throw new Error(
        "Poppler-utils is not installed. Please install it: brew install poppler (macOS) or sudo apt-get install poppler-utils (Linux)"
      );
    }

    throw new Error(`Error processing PDF: ${error.message}`);
  }
}

// Batch processing with parallel execution
async function processBatch(filePaths, concurrency = 4, onProgress = null) {
  const results = [];
  const errors = [];
  let completed = 0;
  const total = filePaths.length;

  // Process files in batches with concurrency limit
  for (let i = 0; i < filePaths.length; i += concurrency) {
    const batch = filePaths.slice(i, i + concurrency);

    const batchPromises = batch.map(async (filePath, batchIndex) => {
      const fileIndex = i + batchIndex;
      const fileName = path.basename(filePath);

      try {
        const text = await processPDF(filePath, (page, totalPages) => {
          // Individual file progress could be reported here if needed
        });

        completed++;
        if (onProgress) {
          onProgress({
            completed,
            total,
            current: fileName,
            success: true,
          });
        }

        return {
          filePath,
          fileName,
          text,
          success: true,
        };
      } catch (error) {
        completed++;
        const errorResult = {
          filePath,
          fileName,
          error: error.message,
          success: false,
        };

        if (onProgress) {
          onProgress({
            completed,
            total,
            current: fileName,
            success: false,
            error: error.message,
          });
        }

        return errorResult;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}

// IPC handlers
ipcMain.handle("open-file-dialog", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Select PDF File(s)",
      filters: [
        { name: "PDF Files", extensions: ["pdf"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile", "multiSelections"],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, filePaths };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("open-directory-dialog", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Select Directory to Save Results",
      properties: ["openDirectory"],
    });

    if (canceled || filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    return { success: true, directory: filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("process-pdf", async (event, filePath) => {
  try {
    const fileName = path.basename(filePath);
    let totalPages = 0;

    const extractedText = await processPDF(
      filePath,
      (completedPages, totalPagesCount) => {
        totalPages = totalPagesCount;
        // Send page progress updates to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("page-progress", {
            completed: completedPages,
            total: totalPagesCount,
            current: fileName,
            isPages: true,
          });
        }
      }
    );

    return { success: true, text: extractedText, totalPages };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Batch processing with progress updates
let batchProgressCallback = null;

ipcMain.handle("process-batch", async (event, filePaths, concurrency = 4) => {
  try {
    const results = await processBatch(filePaths, concurrency, (progress) => {
      // Send progress updates to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("batch-progress", progress);
      }
    });

    return { success: true, results };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-batch-results", async (event, results, outputDir) => {
  try {
    const savedFiles = [];

    for (const result of results) {
      if (result.success && result.text) {
        const fileName = path.basename(result.filePath, ".pdf") + ".txt";
        const outputPath = path.join(outputDir, fileName);
        fs.writeFileSync(outputPath, result.text, "utf8");
        savedFiles.push(outputPath);
      }
    }

    return { success: true, savedFiles, count: savedFiles.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("save-file", async (event, content) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Save Extracted Text",
      defaultPath: "extracted-text.txt",
      filters: [
        { name: "Text Files", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (canceled) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(filePath, content, "utf8");
    return { success: true, filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
