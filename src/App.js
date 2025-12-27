import React, { useCallback, useEffect, useState } from "react";
import "./App.css";

function App() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [progress, setProgress] = useState("");
  const [batchProgress, setBatchProgress] = useState(null);
  const [documentProgress, setDocumentProgress] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [error, setError] = useState("");
  const [batchResults, setBatchResults] = useState(null);

  // Set up batch and page progress listeners
  useEffect(() => {
    if (window.electronAPI) {
      // Batch progress listener (for multiple PDFs)
      if (window.electronAPI.onBatchProgress) {
        window.electronAPI.onBatchProgress((progress) => {
          setBatchProgress(progress);
          // Update document progress from batch progress
          setDocumentProgress({
            completed: progress.completed,
            total: progress.total,
            current: progress.current || "",
            isPages: false,
          });
        });
      }

      // Page progress listener (for pages within a single PDF)
      if (window.electronAPI.onPageProgress) {
        window.electronAPI.onPageProgress((progress) => {
          setDocumentProgress({
            completed: progress.completed,
            total: progress.total,
            current: progress.current || "",
            isPages: true,
          });
        });
      }
    }

    return () => {
      if (window.electronAPI) {
        if (window.electronAPI.removeBatchProgressListener) {
          window.electronAPI.removeBatchProgressListener();
        }
        if (window.electronAPI.removePageProgressListener) {
          window.electronAPI.removePageProgressListener();
        }
      }
    };
  }, []);

  const saveFile = useCallback(async (content) => {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      setProgress("Choose where to save the file...");
      const result = await window.electronAPI.saveFile(content);

      if (result.success) {
        setProgress(`File saved successfully to: ${result.filePath}`);
        setTimeout(() => {
          setProgress("");
          setExtractedText("");
        }, 3000);
      } else if (result.canceled) {
        setProgress("Save cancelled");
        setTimeout(() => setProgress(""), 2000);
      } else {
        setError(result.error || "Failed to save file");
        setProgress("");
      }
    } catch (err) {
      setError(err.message || "An error occurred while saving the file");
      setProgress("");
    }
  }, []);

  const processPDF = useCallback(
    async (filePath) => {
      setIsProcessing(true);
      setIsBatchMode(false);
      setError("");
      setProgress("Processing PDF... This may take a few moments.");
      setExtractedText("");
      setBatchProgress(null);
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      // Initial state - will be updated with actual page count via page-progress event
      setDocumentProgress({
        completed: 0,
        total: 1,
        current: fileName,
        isPages: true,
      });

      try {
        if (!window.electronAPI) {
          throw new Error("Electron API not available");
        }

        const result = await window.electronAPI.processPDF(filePath);

        if (result.success) {
          setExtractedText(result.text);
          setProgress("Text extracted successfully!");
          // Page progress will be updated via the page-progress event
          // Don't manually set it here as it will be updated in real-time

          // Automatically prompt to save
          setTimeout(async () => {
            await saveFile(result.text);
          }, 500);
        } else {
          setError(result.error || "Failed to process PDF");
          setProgress("");
          setDocumentProgress(null);
        }
      } catch (err) {
        setError(err.message || "An error occurred while processing the PDF");
        setProgress("");
        setDocumentProgress(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [saveFile]
  );

  const processBatch = useCallback(async (filePaths) => {
    setIsProcessing(true);
    setIsBatchMode(true);
    setError("");
    setProgress(`Processing ${filePaths.length} PDF files...`);
    setExtractedText("");
    setBatchProgress({ completed: 0, total: filePaths.length, current: "" });
    setDocumentProgress({ completed: 0, total: filePaths.length, current: "" });
    setBatchResults(null);

    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      // Process batch with concurrency of 4 (adjust based on your system)
      const result = await window.electronAPI.processBatch(filePaths, 4);

      if (result.success) {
        setBatchResults(result.results);
        const successCount = result.results.filter((r) => r.success).length;
        const errorCount = result.results.filter((r) => !r.success).length;

        setProgress(
          `Batch processing complete! ${successCount} succeeded, ${errorCount} failed.`
        );

        // Prompt to save results
        setTimeout(async () => {
          await saveBatchResults(result.results);
        }, 500);
      } else {
        setError(result.error || "Failed to process batch");
        setProgress("");
      }
    } catch (err) {
      setError(err.message || "An error occurred while processing the batch");
      setProgress("");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const saveBatchResults = async (results) => {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      setProgress("Choose directory to save all results...");
      const dirResult = await window.electronAPI.openDirectoryDialog();

      if (dirResult.success) {
        setProgress("Saving files...");
        const saveResult = await window.electronAPI.saveBatchResults(
          results,
          dirResult.directory
        );

        if (saveResult.success) {
          setProgress(
            `Successfully saved ${saveResult.count} files to: ${dirResult.directory}`
          );
          setTimeout(() => {
            setProgress("");
            setBatchResults(null);
            setBatchProgress(null);
          }, 5000);
        } else {
          setError(saveResult.error || "Failed to save batch results");
          setProgress("");
        }
      } else if (!dirResult.canceled) {
        setError(dirResult.error || "Failed to open directory dialog");
        setProgress("");
      } else {
        setProgress("Save cancelled");
        setTimeout(() => setProgress(""), 2000);
      }
    } catch (err) {
      setError(err.message || "An error occurred while saving batch results");
      setProgress("");
    }
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      const pdfFiles = files.filter((file) => {
        const fileName = file.name.toLowerCase();
        return fileName.endsWith(".pdf");
      });

      if (pdfFiles.length === 0) {
        setError("Please drop PDF file(s)");
        return;
      }

      // Get file paths
      const filePaths = pdfFiles.map((f) => f.path).filter(Boolean);

      if (filePaths.length === 0) {
        setError(
          'Could not access file paths. Please use "Browse Files" button instead.'
        );
        return;
      }

      // Process single or batch
      if (filePaths.length === 1) {
        await processPDF(filePaths[0]);
      } else {
        await processBatch(filePaths);
      }
    },
    [processPDF, processBatch]
  );

  const handleFileSelect = useCallback(async () => {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      const result = await window.electronAPI.openFileDialog();

      if (result.success) {
        if (result.filePaths.length === 1) {
          await processPDF(result.filePaths[0]);
        } else {
          await processBatch(result.filePaths);
        }
      } else if (!result.canceled) {
        setError(result.error || "Failed to open file dialog");
      }
    } catch (err) {
      setError(err.message || "An error occurred while selecting the file");
    }
  }, [processPDF, processBatch]);

  const handleSaveClick = () => {
    if (extractedText) {
      saveFile(extractedText);
    }
  };

  const getProgressPercentage = () => {
    if (documentProgress && documentProgress.total > 0) {
      return Math.round(
        (documentProgress.completed / documentProgress.total) * 100
      );
    }
    return 0;
  };

  return (
    <div className="App">
      <div className="container">
        <h1 className="title">Wyzard</h1>
        <p className="subtitle">Extract text from PDF files using OCR</p>

        <div
          className={`drop-zone ${isProcessing ? "processing" : ""}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isProcessing ? (
            <div className="processing-content">
              <div className="spinner"></div>
              <p>{progress}</p>
              {documentProgress && (
                <div className="document-progress">
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar"
                      style={{ width: `${getProgressPercentage()}%` }}
                    ></div>
                  </div>
                  <p className="progress-text">
                    {documentProgress.completed} / {documentProgress.total}{" "}
                    {documentProgress.isPages ? "page" : "document"}
                    {documentProgress.total !== 1 ? "s" : ""} processed
                    {getProgressPercentage() > 0 &&
                      ` (${getProgressPercentage()}%)`}
                  </p>
                  {documentProgress.current && (
                    <p className="current-file">
                      Currently processing: {documentProgress.current}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="drop-content">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p className="drop-text">Drag and drop PDF file(s) here</p>
              <p className="drop-subtext">or</p>
              <button onClick={handleFileSelect} className="file-input-label">
                Browse Files
              </button>
              <p className="batch-hint">
                Select multiple files for batch processing
              </p>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <p>⚠️ {error}</p>
          </div>
        )}

        {progress && !error && (
          <div className="progress-message">
            <p>{progress}</p>
          </div>
        )}

        {batchResults && !isProcessing && (
          <div className="batch-results">
            <h3>Batch Processing Results</h3>
            <div className="results-summary">
              <p>
                ✅ Successful: {batchResults.filter((r) => r.success).length}
              </p>
              <p>❌ Failed: {batchResults.filter((r) => !r.success).length}</p>
            </div>
            {batchResults.filter((r) => !r.success).length > 0 && (
              <div className="errors-list">
                <h4>Errors:</h4>
                <ul>
                  {batchResults
                    .filter((r) => !r.success)
                    .map((result, idx) => (
                      <li key={idx}>
                        {result.fileName}: {result.error}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {extractedText && !isProcessing && !isBatchMode && (
          <div className="extracted-text-container">
            <div className="extracted-text-header">
              <h2>Extracted Text</h2>
              <button onClick={handleSaveClick} className="save-button">
                Save to File
              </button>
            </div>
            <div className="extracted-text">
              <pre>{extractedText}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
