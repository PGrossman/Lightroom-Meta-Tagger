// BACKUP: src/main/main.js (relevant sections)
// Date: 2025-10-06
// Purpose: IPC handlers for drag & drop + window size increase

// ============================================
// IPC HANDLERS FOR DRAG & DROP (lines 224-237)
// ============================================

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

// ============================================
// WINDOW SIZE INCREASE (lines 254-265)
// ============================================

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,      // Kept at 1200
    height: 1250,     // ✅ Increased from 800 to 1250
    minWidth: 1200,
    minHeight: 1000,  // ✅ Increased from 800
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

// ============================================
// NOTES
// ============================================
// Full file available at: src/main/main.js
// Other sections unchanged (database handlers, scanning, etc.)

