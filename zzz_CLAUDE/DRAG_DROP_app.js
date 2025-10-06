// BACKUP: src/renderer/app.js (relevant sections)
// Date: 2025-10-06
// Purpose: Drag & drop handler + file count fix

// ============================================
// DROP HANDLER IMPLEMENTATION (lines 105-129)
// ============================================

dropzone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  
  const files = e.dataTransfer.files;
  
  if (files.length > 0) {
    // In Electron, files[0].path gives the absolute file system path
    const droppedPath = files[0].path;
    console.log('Dropped path:', droppedPath);
    
    // Determine if it's a directory or file (await since it's now an IPC call)
    let dirToScan;
    const isDir = await window.electronAPI.isDirectory(droppedPath);
    if (isDir) {
      dirToScan = droppedPath;
      console.log('Directory dropped, scanning:', dirToScan);
    } else {
      dirToScan = await window.electronAPI.getParentDir(droppedPath);
      console.log('File dropped, scanning parent directory:', dirToScan);
    }
    
    // Scan the directory
    await selectAndScanDirectory(dirToScan);
  }
});

// ============================================
// MODIFIED selectAndScanDirectory (lines 172-194)
// ============================================

async function selectAndScanDirectory(dirPath = null) {
  console.log('==== selectAndScanDirectory CALLED ====');
  
  try {
    // If dirPath is provided (from drag & drop), use it directly
    if (dirPath) {
      console.log('Using provided directory path:', dirPath);
      selectedDirectory = dirPath;
    } else {
      // Otherwise, show directory selection dialog
      console.log('Step 1: Calling selectDirectory...');
      const result = await window.electronAPI.selectDirectory();
      console.log('Step 2: Directory result:', result);
      
      if (result.canceled) {
        console.log('Step 3: User canceled selection');
        return;
      }
      
      selectedDirectory = result.path;
      console.log('Step 4: Selected directory:', selectedDirectory);
    }
    
    // ... rest of function (scanning logic unchanged)
  } catch (error) {
    console.error('ERROR in selectAndScanDirectory:', error);
    updateStatus(`Error: ${error.message}`, 'error');
    showProgress(0);
  }
}

// ============================================
// FILE COUNT BUG FIX (lines 252-263)
// ============================================

function displayScanResults(summary) {
  // DEBUG: Log what we're receiving
  console.log('displayScanResults summary:', summary);
  console.log('totalFiles:', summary.totalFiles, 'type:', typeof summary.totalFiles);
  console.log('totalBaseImages:', summary.totalBaseImages, 'type:', typeof summary.totalBaseImages);
  console.log('totalDerivatives:', summary.totalDerivatives, 'type:', typeof summary.totalDerivatives);
  
  // ✅ FIX: Ensure numeric addition, not string concatenation
  const totalFiles = Number(summary.totalFiles) || (Number(summary.totalBaseImages) + Number(summary.totalDerivatives));
  console.log('Calculated totalFiles:', totalFiles);
  totalFilesEl.textContent = totalFiles;
  filesToProcessEl.textContent = summary.totalClusters || summary.totalBaseImages;
  
  // ... rest of function unchanged
}

// ============================================
// NOTES
// ============================================
// Full file available at: src/renderer/app.js
// Other sections unchanged (table rendering, pagination, settings, etc.)

