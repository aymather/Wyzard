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
  const [extractionHistory, setExtractionHistory] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);

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

  const saveFile = useCallback(async (content, historyId = null) => {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API not available");
      }

      setProgress("Choose where to save the file...");
      const result = await window.electronAPI.saveFile(content);

      if (result.success) {
        setProgress(`File saved successfully to: ${result.filePath}`);
        
        // Update history item if it exists, otherwise add new one
        if (historyId) {
          setExtractionHistory(prev => 
            prev.map(item => 
              item.id === historyId
                ? { ...item, saved: true, savedPath: result.filePath }
                : item
            )
          );
        } else if (extractedText) {
          // Find the most recent history item for current extraction and update it
          setExtractionHistory(prev => {
            if (prev.length > 0 && prev[0].text === content && !prev[0].saved) {
              return prev.map((item, idx) => 
                idx === 0
                  ? { ...item, saved: true, savedPath: result.filePath }
                  : item
              );
            }
            return prev;
          });
        }
        
        setTimeout(() => {
          setProgress("");
          // Don't clear extractedText - keep it visible
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
  }, [extractedText]);

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
          setSelectedHistoryItem(null); // Clear selected history when processing new file
          setProgress("Text extracted successfully!");
          // Page progress will be updated via the page-progress event
          // Don't manually set it here as it will be updated in real-time

          // Add to history immediately (before saving)
          const historyItem = {
            id: Date.now(),
            text: result.text,
            fileName: fileName,
            timestamp: new Date(),
            saved: false
          };
          setExtractionHistory(prev => [historyItem, ...prev]);

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

  const handleHistoryItemClick = (item) => {
    setExtractedText(item.text);
    setSelectedHistoryItem(item.id);
    setError("");
    setProgress("");
  };

  const handleHistoryItemSave = async (item) => {
    await saveFile(item.text, item.id);
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <div className="logo-icon"></div>
              Wyzard
            </div>
          </div>
        </header>

        <div className="main-content">
          <h1 className="title">Wyzard</h1>
          <p className="subtitle">Extract text from PDF files using OCR</p>

          <div
            className={`drop-zone-card ${isProcessing ? "processing" : ""}`}
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
              <button onClick={handleFileSelect} className="file-input-button">
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

        {extractionHistory.length > 0 && !isProcessing && (
          <div className="history-container">
            <div className="history-header">
              <h2>Extraction History</h2>
              <span className="history-count">{extractionHistory.length} {extractionHistory.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div className="history-list">
              {extractionHistory.map((item) => (
                <div
                  key={item.id}
                  className={`history-item ${selectedHistoryItem === item.id ? 'selected' : ''}`}
                  onClick={() => handleHistoryItemClick(item)}
                >
                  <div className="history-item-header">
                    <div className="history-item-info">
                      <span className="history-item-name">{item.fileName}</span>
                      <span className="history-item-time">{formatTimestamp(item.timestamp)}</span>
                    </div>
                    <div className="history-item-actions">
                      {item.saved && (
                        <span className="history-saved-badge">Saved</span>
                      )}
                      <button
                        className="history-save-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHistoryItemSave(item);
                        }}
                      >
                        {item.saved ? 'Re-save' : 'Save'}
                      </button>
                    </div>
                  </div>
                  <div className="history-item-preview">
                    {item.text.substring(0, 150)}
                    {item.text.length > 150 && '...'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default App;
