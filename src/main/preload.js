const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Directory selection
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // Scanning
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  scanDirectoryWithClustering: (dirPath, threshold) => 
    ipcRenderer.invoke('scan-directory-with-clustering', dirPath, threshold),
  
  // Database
  getDatabasePath: () => ipcRenderer.invoke('get-database-path'),
  selectDatabaseLocation: () => ipcRenderer.invoke('select-database-location'),
  setDatabasePath: (dbPath) => ipcRenderer.invoke('set-database-path', dbPath),
  getDatabaseStats: () => ipcRenderer.invoke('get-database-stats'),
  clearDatabase: () => ipcRenderer.invoke('clear-database'),
  checkDatabaseStatus: () => ipcRenderer.invoke('check-database-status'),
  
  // Settings
  getAllSettings: () => ipcRenderer.invoke('get-all-settings'),
  
  // File system helpers for drag & drop (via IPC to main process)
  isDirectory: (filePath) => ipcRenderer.invoke('is-directory', filePath),
  getParentDir: (filePath) => ipcRenderer.invoke('get-parent-dir', filePath),
  
  // Progress events
  onProgress: (callback) => {
    ipcRenderer.on('progress', (event, data) => callback(data));
  }
});

