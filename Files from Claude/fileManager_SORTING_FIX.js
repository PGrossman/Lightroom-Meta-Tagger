// ✅ FIX FOR FILE ORDERING ISSUE
// Add this method to FileManager class in src/services/fileManager.js

/**
 * ✅ NEW METHOD: Sort files consistently (alphabetically by basename)
 * This ensures TIF and CR2 files appear in the same order regardless of filesystem
 */
sortFilesAlphabetically(files) {
  return files.sort((a, b) => {
    const baseA = path.basename(a).toLowerCase();
    const baseB = path.basename(b).toLowerCase();
    return baseA.localeCompare(baseB, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/**
 * ✅ MODIFIED: Scan directory with consistent sorting
 */
async scanDirectory(dirPath) {
  logger.info('Starting directory scan', { dirPath });
  
  const startTime = Date.now();
  const results = {
    baseImages: [],
    derivatives: new Map(),
    stats: {
      totalFiles: 0,
      baseImagesFound: 0,
      derivativesFound: 0,
      skippedFiles: 0,
      orphansPromoted: 0
    }
  };

  // Step 1: Collect all files
  const allFiles = [];
  for await (const file of this.walkDirectory(dirPath)) {
    allFiles.push(file);
    results.stats.totalFiles++;
  }

  // ✅ FIX: Sort files alphabetically for consistent ordering
  const sortedFiles = this.sortFilesAlphabetically(allFiles);
  
  logger.info('All files found and sorted', { 
    count: sortedFiles.length,
    sample: sortedFiles.slice(0, 10).map(f => path.basename(f))
  });

  // Step 2: Identify base images (use sortedFiles instead of allFiles)
  let tifBaseCount = 0;
  let tifDerivativeCount = 0;
  let tifUnknownCount = 0;
  
  for (const file of sortedFiles) {
    const filename = path.basename(file);
    const ext = path.extname(filename).toUpperCase();
    
    if (ext === '.TIF' || ext === '.TIFF') {
      const isBase = this.isBaseImage(filename);
      const isDeriv = this.isDerivative(filename);
      logger.debug('TIF file check', { 
        filename, 
        isBase,
        isDerivative: isDeriv,
        extractedBase: this.getBaseFilename(filename)
      });
      
      if (isBase) tifBaseCount++;
      else if (isDeriv) tifDerivativeCount++;
      else tifUnknownCount++;
    }
    
    if (this.isBaseImage(filename)) {
      results.baseImages.push(file);
      results.stats.baseImagesFound++;
    }
  }
  
  if (tifBaseCount > 0 || tifDerivativeCount > 0 || tifUnknownCount > 0) {
    logger.info('TIF file classification', { 
      tifBase: tifBaseCount,
      tifDerivative: tifDerivativeCount,
      tifUnknown: tifUnknownCount
    });
  }

  logger.info('Base images identified', { 
    count: results.baseImages.length,
    redFiles: results.baseImages.filter(f => /\.tiff?$/i.test(f)).length,
    canonFiles: results.baseImages.filter(f => /\.(cr2|cr3)$/i.test(f)).length
  });

  // Step 3: Find derivatives (use sortedFiles instead of allFiles)
  for (const baseImage of results.baseImages) {
    const baseFilename = this.getBaseFilename(path.basename(baseImage));
    const derivatives = this.findDerivatives(baseFilename, sortedFiles, baseImage);
    
    results.derivatives.set(baseImage, derivatives);
    results.stats.derivativesFound += derivatives.length;
    
    if (derivatives.length > 0) {
      logger.debug('Derivatives found', { 
        baseImage: path.basename(baseImage),
        count: derivatives.length,
        derivatives: derivatives.map(d => path.basename(d))
      });
    }
  }

  // Step 4: Promote orphaned derivatives (use sortedFiles)
  const allDerivativeFiles = new Set();
  for (const derivs of results.derivatives.values()) {
    derivs.forEach(d => allDerivativeFiles.add(d));
  }
  
  const orphanedDerivatives = [];
  for (const file of sortedFiles) {
    const filename = path.basename(file);
    if (this.isDerivative(filename) && !allDerivativeFiles.has(file)) {
      orphanedDerivatives.push(file);
    }
  }
  
  if (orphanedDerivatives.length > 0) {
    logger.info('🔄 Promoting orphaned derivatives to base images', {
      count: orphanedDerivatives.length,
      files: orphanedDerivatives.map(f => path.basename(f))
    });
    
    orphanedDerivatives.forEach(orphan => {
      results.baseImages.push(orphan);
      results.derivatives.set(orphan, []);
      results.stats.baseImagesFound++;
      results.stats.orphansPromoted++;
    });
  }

  const duration = Date.now() - startTime;
  results.stats.scanDuration = duration;
  
  logger.info('Directory scan complete', {
    duration: `${duration}ms`,
    baseImages: results.stats.baseImagesFound,
    derivatives: results.stats.derivativesFound,
    orphansPromoted: results.stats.orphansPromoted,
    totalFiles: results.stats.totalFiles
  });

  return results;
}
