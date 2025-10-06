// BACKUP: src/services/fileManager.js (relevant section)
// Date: 2025-10-06
// Purpose: Added totalFiles to getScanSummary()

// ============================================
// FIX: getScanSummary() (lines 314-332)
// ============================================

/**
 * Get a summary of scan results for display
 */
getScanSummary(scanResults) {
  const summary = {
    totalFiles: scanResults.stats.totalFiles,  // ✅ ADDED: Pass through actual file count
    totalBaseImages: scanResults.stats.baseImagesFound,
    totalDerivatives: scanResults.stats.derivativesFound,
    imagesWithDerivatives: 0,
    standaloneImages: 0,
    scanDuration: scanResults.stats.scanDuration
  };

  for (const [baseImage, derivatives] of scanResults.derivatives) {
    if (derivatives.length > 0) {
      summary.imagesWithDerivatives++;
    } else {
      summary.standaloneImages++;
    }
  }

  return summary;
}

// ============================================
// NOTES
// ============================================
// Full file available at: src/services/fileManager.js
// 
// This was the key fix for the "10283" display bug:
// - Backend now explicitly sends totalFiles count
// - Frontend receives it as a number (not string)
// - Frontend also converts to Number() as safety measure
// 
// Other sections unchanged:
// - RED camera file support
// - Canon file support
// - Derivative detection
// - Clustering logic

