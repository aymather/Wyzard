const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  processPDF: (filePath) => ipcRenderer.invoke('process-pdf', filePath),
  processBatch: (filePaths, concurrency) => ipcRenderer.invoke('process-batch', filePaths, concurrency),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  saveBatchResults: (results, outputDir) => ipcRenderer.invoke('save-batch-results', results, outputDir),
  onBatchProgress: (callback) => {
    ipcRenderer.on('batch-progress', (event, progress) => callback(progress));
  },
  onPageProgress: (callback) => {
    ipcRenderer.on('page-progress', (event, progress) => callback(progress));
  },
  removeBatchProgressListener: () => {
    ipcRenderer.removeAllListeners('batch-progress');
  },
  removePageProgressListener: () => {
    ipcRenderer.removeAllListeners('page-progress');
  },
});

