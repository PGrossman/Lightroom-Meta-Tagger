const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Directory selection
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // Scanning
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  scanDirectoryWithClustering: (dirPath, threshold) => 
    ipcRenderer.invoke('scan-directory-with-clustering', dirPath, threshold),
  
  // Processing (Phase 2)
  processImages: (scanResults, dirPath, useChernobylDB) => 
    ipcRenderer.invoke('process-images', scanResults, dirPath, useChernobylDB),
  
  // Database
  getDatabasePath: () => ipcRenderer.invoke('get-database-path'),
  selectDatabaseLocation: () => ipcRenderer.invoke('select-database-location'),
  setDatabasePath: (dbPath) => ipcRenderer.invoke('set-database-path', dbPath),
  getDatabaseStats: () => ipcRenderer.invoke('get-database-stats'),
  clearDatabase: () => ipcRenderer.invoke('clear-database'),
  checkDatabaseStatus: () => ipcRenderer.invoke('check-database-status'),
  getProcessedImages: () => ipcRenderer.invoke('get-processed-images'),
  
  // Thumbnail retrieval
  getPreviewImage: (imagePath) => ipcRenderer.invoke('get-preview-image', imagePath),
  
  // Settings
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  
  // CLIP service management
  checkClipService: () => ipcRenderer.invoke('check-clip-service'),
  restartClipService: () => ipcRenderer.invoke('restart-clip-service'),
  
  // AI Settings
  saveAISettings: (settings) => ipcRenderer.invoke('save-ai-settings', settings),
  testGoogleVisionAPI: (apiKey) => ipcRenderer.invoke('test-google-vision-api', apiKey),
  
  // Personal Data
  getPersonalData: () => ipcRenderer.invoke('get-personal-data'),
  savePersonalData: (data) => ipcRenderer.invoke('save-personal-data', data),
  
  // AI Analysis
  analyzeClusterWithAI: (clusterGroup, provider) => ipcRenderer.invoke('analyze-cluster-with-ai', clusterGroup, provider),
  generateXMPFiles: (data) => ipcRenderer.invoke('generate-xmp-files', data),
  
  // File system helpers for drag & drop (via IPC to main process)
  isDirectory: (filePath) => ipcRenderer.invoke('is-directory', filePath),
  getParentDir: (filePath) => ipcRenderer.invoke('get-parent-dir', filePath),
  
  // Progress events
  onProgress: (callback) => {
    ipcRenderer.on('progress', (event, data) => callback(data));
  }
});

