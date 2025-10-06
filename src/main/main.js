const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const FileManager = require('../services/fileManager');
const DatabaseService = require('../services/databaseService');
const ConfigManager = require('../services/configManager');
const logger = require('../utils/logger');

// Initialize services
const fileManager = new FileManager();
const databaseService = new DatabaseService();
const configManager = new ConfigManager();

// DEBUG: Test derivative detection on startup
logger.info('Running derivative detection test...');
fileManager.testDerivativeDetection();

/**
 * Initialize database on app startup
 */
function initializeDatabase() {
  const savedDbPath = configManager.getDatabasePath();
  
  if (savedDbPath && DatabaseService.databaseExists(savedDbPath)) {
    // Database exists at saved location
    const result = databaseService.initialize(savedDbPath);
    if (result.success) {
      logger.info('Database loaded from saved location', { dbPath: savedDbPath });
      return { initialized: true, dbPath: savedDbPath };
    }
  }
  
  // Database not found or failed to initialize
  logger.warn('Database not found or failed to initialize');
  return { initialized: false, needsSetup: true };
}

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  try {
    logger.info('select-directory IPC called');
    
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Photo Directory'
    });
    
    logger.info('Dialog result:', { 
      canceled: result.canceled, 
      filePaths: result.filePaths 
    });
    
    if (result.canceled) {
      logger.info('User canceled directory selection');
      return { canceled: true };
    }
    
    if (!result.filePaths || result.filePaths.length === 0) {
      logger.error('No file paths returned from dialog');
      return { canceled: true };
    }
    
    const selectedPath = result.filePaths[0];
    logger.info('Directory selected:', { path: selectedPath });
    
    return { 
      canceled: false, 
      path: selectedPath
    };
  } catch (error) {
    logger.error('Error in select-directory handler:', { error: error.message });
    return { 
      canceled: true, 
      error: error.message 
    };
  }
});

ipcMain.handle('scan-directory', async (event, dirPath) => {
  try {
    logger.info('Scan directory requested', { dirPath });
    const results = await fileManager.scanDirectory(dirPath);
    const summary = fileManager.getScanSummary(results);
    
    // Convert Map to plain object for IPC serialization
    const derivativesObj = {};
    for (const [key, value] of results.derivatives) {
      derivativesObj[key] = value;
    }
    
    return { 
      success: true, 
      results: {
        baseImages: results.baseImages,
        derivatives: derivativesObj,
        stats: results.stats
      },
      summary
    };
  } catch (error) {
    logger.error('Scan directory failed', { dirPath, error: error.message });
    return { 
      success: false, 
      error: error.message 
    };
  }
});

ipcMain.handle('scan-directory-with-clustering', async (event, dirPath, timestampThreshold) => {
  try {
    logger.info('Scan with clustering requested', { dirPath, timestampThreshold });
    
    const results = await fileManager.scanDirectoryWithClustering(
      dirPath,
      timestampThreshold || 5
    );
    
    const summary = {
      ...fileManager.getScanSummary(results),
      totalClusters: results.clusterStats.totalClusters,
      bracketedClusters: results.clusterStats.bracketedClusters,
      singletonClusters: results.clusterStats.singletonClusters,
      averageClusterSize: results.clusterStats.averageClusterSize.toFixed(2)
    };
    
    // Convert Map to plain object for IPC serialization
    const derivativesObj = {};
    for (const [key, value] of results.derivatives) {
      derivativesObj[key] = value;
    }
    
    return { 
      success: true, 
      results: {
        baseImages: results.baseImages,
        derivatives: derivativesObj,
        stats: results.stats,
        clusters: results.clusters,
        clusterStats: results.clusterStats
      },
      summary
    };
  } catch (error) {
    logger.error('Scan with clustering failed', { dirPath, error: error.message });
    return { 
      success: false, 
      error: error.message 
    };
  }
});

// Database IPC Handlers
ipcMain.handle('get-database-path', async () => {
  return configManager.getDatabasePath();
});

ipcMain.handle('select-database-location', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Select Database Location',
    defaultPath: 'lightroom-metadata.db',
    filters: [
      { name: 'Database Files', extensions: ['db'] }
    ]
  });
  
  if (result.canceled) {
    return { canceled: true };
  }
  
  return { 
    canceled: false, 
    path: result.filePath 
  };
});

ipcMain.handle('set-database-path', async (event, dbPath) => {
  try {
    // Initialize database at new location
    const result = databaseService.initialize(dbPath);
    
    if (result.success) {
      // Save to config
      configManager.setDatabasePath(dbPath);
      return { success: true, dbPath };
    }
    
    return { success: false, error: result.error };
    
  } catch (error) {
    logger.error('Failed to set database path', { dbPath, error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-database-stats', async () => {
  try {
    const stats = databaseService.getStats();
    const fileSize = databaseService.getFileSize();
    
    return {
      success: true,
      stats,
      fileSize: databaseService.formatFileSize(fileSize),
      dbPath: databaseService.dbPath
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-database', async () => {
  try {
    const result = databaseService.clearAllRecords();
    return result;
  } catch (error) {
    logger.error('Failed to clear database', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-all-settings', async () => {
  return configManager.getAllSettings();
});

// File system helpers for drag & drop
ipcMain.handle('is-directory', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.isDirectory();
  } catch (error) {
    logger.error('Error checking if path is directory', { filePath, error: error.message });
    return false;
  }
});

ipcMain.handle('get-parent-dir', async (event, filePath) => {
  return path.dirname(filePath);
});

ipcMain.handle('check-database-status', async () => {
  const dbPath = configManager.getDatabasePath();
  
  if (!dbPath) {
    return { exists: false, needsSetup: true };
  }
  
  const exists = DatabaseService.databaseExists(dbPath);
  return { 
    exists, 
    needsSetup: !exists, 
    dbPath: exists ? dbPath : null 
  };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 1250,
    minWidth: 1200,
    minHeight: 1000,
    webPreferences: {
      preload: path.join(__dirname, '../main/preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('src/renderer/index.html');
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  // Check database status
  const dbStatus = initializeDatabase();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Clean up database connection on quit
app.on('before-quit', () => {
  databaseService.close();
});

