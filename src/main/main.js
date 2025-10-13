const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// DEBUG: Add file-based logging
console.log('🚀 MAIN.JS LOADED - VERSION 3.0 - CLIP SIMILARITY ENABLED - NEW CODE LOADED');
fs.appendFileSync('debug.txt', `\n\n=== MAIN.JS LOADED ${new Date().toISOString()} ===\n`);
const FileManager = require('../services/fileManager');
const DatabaseService = require('../services/databaseService');
const ConfigManager = require('../services/configManager');
const ExifExtractor = require('../services/exifExtractor');
const ImageProcessor = require('../services/imageProcessor');
const FolderKeywordParser = require('../services/folderKeywordParser');
const ClusterRefiner = require('../services/clusterRefiner');
const SimilarityDetector = require('../services/similarityDetector');
const ClipServiceManager = require('../services/clipServiceManager');
const AIAnalysisService = require('../services/aiAnalysisService');
const XMPGenerator = require('../services/xmpGenerator');
const SystemCheck = require('../utils/systemCheck');
const logger = require('../utils/logger');

// Initialize services
const fileManager = new FileManager();
const databaseService = new DatabaseService();
const configManager = new ConfigManager();
const exifExtractor = new ExifExtractor();
const imageProcessor = new ImageProcessor();
const folderKeywordParser = new FolderKeywordParser();
const similarityDetector = new SimilarityDetector(configManager.getAllSettings());
const clusterRefiner = new ClusterRefiner(imageProcessor);
const clipServiceManager = new ClipServiceManager();

// Initialize AI Analysis Service
let aiAnalysisService = null;

async function initializeAIServices() {
  try {
    const config = configManager.getAllSettings();
    
    // Validate config has required sections
    if (!config.ollama) {
      config.ollama = {
        endpoint: 'http://localhost:11434',
        model: 'qwen2.5vl:latest',
        temperature: 0.1,
        timeout: 60000
      };
    }
    
    if (!config.aiAnalysis) {
      config.aiAnalysis = {
        confidenceThreshold: 85,
        provider: 'ollama'
      };
    }
    
    if (!config.googleVision) {
      config.googleVision = {
        enabled: false,
        apiKey: ''
      };
    }
    
    // Initialize service with validated config
    aiAnalysisService = new AIAnalysisService(config);
    logger.info('✅ AI Analysis Service initialized successfully');
    return true;
    
  } catch (error) {
    logger.error('❌ Failed to initialize AI Analysis Service', { 
      error: error.message,
      stack: error.stack 
    });
    aiAnalysisService = null;
    return false;
  }
}

// Call initialization (non-blocking)
initializeAIServices().then(success => {
  if (!success) {
    logger.warn('⚠️ AI features will be unavailable');
  }
});

// Initialize XMP Generator (will be initialized after database)
let xmpGenerator;

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
      
      // Initialize XMP Generator with database service
      try {
        xmpGenerator = new XMPGenerator(databaseService.db);
        logger.info('✅ XMP Generator initialized with database');
      } catch (error) {
        logger.error('Failed to initialize XMP Generator', { error: error.message });
      }
      
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

// Process Images IPC Handler - Phase 2 Processing Pipeline
console.log('=== REGISTERING process-images IPC HANDLER ===');
ipcMain.handle('process-images', async (event, scanResults, dirPath) => {
  try {
    // === CRITICAL DEBUG - RUN THIS FIRST ===
    console.log('=== PROCESS-IMAGES HANDLER STARTED ===');
    console.log('Arguments received:', { 
      scanResults: !!scanResults, 
      dirPath
    });
    console.log('configManager exists:', typeof configManager);
    console.log('configManager.getAllSettings exists:', typeof configManager.getAllSettings);
    
    // Write to debug file
    fs.appendFileSync('debug.txt', `\n\n=== PROCESS-IMAGES CALLED ${new Date().toISOString()} ===\n`);
    fs.appendFileSync('debug.txt', `scanResults: ${!!scanResults}\n`);
    fs.appendFileSync('debug.txt', `dirPath: ${dirPath}\n`);
    
    const testConfig = configManager.getAllSettings();
    console.log('testConfig:', JSON.stringify(testConfig, null, 2));
    console.log('testConfig.similarity:', testConfig?.similarity);
    
    fs.appendFileSync('debug.txt', `config exists: ${!!testConfig}\n`);
    fs.appendFileSync('debug.txt', `config.similarity: ${JSON.stringify(testConfig?.similarity)}\n`);
    fs.appendFileSync('debug.txt', `config.similarity.enabled: ${testConfig?.similarity?.enabled}\n`);
    fs.appendFileSync('debug.txt', `config.similarity.hammingThreshold: ${testConfig?.similarity?.hammingThreshold}\n`);
    
    console.log('=== END CRITICAL DEBUG ===');
    
    logger.info('Image processing started', { 
      totalClusters: scanResults.clusters?.length || 0,
      dirPath 
    });

    const window = BrowserWindow.getAllWindows()[0];
    
    // Step 1: Extract metadata (GPS + timestamps) from all base images
    event.sender.send('progress', { 
      stage: 'metadata', 
      message: 'Extracting metadata from images...',
      percent: 0 
    });

    const baseImages = scanResults.clusters.flatMap(c => c.imagePaths);
    logger.info('Extracting metadata', { totalImages: baseImages.length });

    const metadataResults = [];
    for (let i = 0; i < baseImages.length; i++) {
      const imagePath = baseImages[i];
      
      try {
        const metadata = await exifExtractor.extractMetadata(imagePath);
        metadataResults.push({
          path: imagePath,
          ...metadata
        });

        event.sender.send('progress', { 
          stage: 'metadata', 
          message: `Processing ${path.basename(imagePath)}...`,
          percent: Math.round(((i + 1) / baseImages.length) * 30) // 0-30%
        });

      } catch (error) {
        logger.error('Metadata extraction failed', { imagePath, error: error.message });
      }
    }

    // Step 2: Extract folder keywords PER CLUSTER
    event.sender.send('progress', { 
      stage: 'keywords', 
      message: 'Extracting folder keywords...',
      percent: 30 
    });

    // Extract keywords for each cluster based on its representative's location
    const clusterKeywords = new Map();
    for (const cluster of scanResults.clusters) {
      const representativePath = cluster.representative || cluster.representativePath;
      const imageDir = path.dirname(representativePath);
      
      // Parse keywords from the image's directory (relative to base scan dir)
      const keywords = folderKeywordParser.parseKeywordsRelative(imageDir, dirPath);
      clusterKeywords.set(cluster.representative, keywords);
      
      logger.debug('Keywords for cluster', {
        representative: path.basename(cluster.representative),
        folder: path.basename(imageDir),
        keywords: keywords.all
      });
    }
    logger.info('Keywords extracted for all clusters', { totalClusters: clusterKeywords.size });

    // Step 3: Process ONLY cluster representatives (not all images!)
    event.sender.send('progress', { 
      stage: 'processing', 
      message: 'Processing cluster representatives...',
      percent: 35 
    });

    const imageResults = [];
    
    // DEBUG: Log cluster structure to identify path issue
    logger.info('=== REPRESENTATIVE PATHS DEBUG ===');
    scanResults.clusters.forEach((cluster, idx) => {
      logger.info(`Cluster ${idx}:`, {
        representative: cluster.representative,
        representativePath: cluster.representativePath,
        type: typeof cluster.representative,
        isAbsolute: cluster.representative?.startsWith('/'),
        sampleImagePath: cluster.imagePaths?.[0],
        imageCount: cluster.imageCount
      });
    });
    logger.info('=== END DEBUG ===');
    
    // CRITICAL FIX: Only process representatives (ensure full paths)
    const representativesToProcess = scanResults.clusters.map(c => {
      const repPath = c.representative || c.representativePath;
      
      // CRITICAL: Verify this is an absolute path
      if (!repPath || !path.isAbsolute(repPath)) {
        logger.error('❌ Invalid representative path!', { 
          cluster: c,
          representative: c.representative,
          representativePath: c.representativePath
        });
        return null;
      }
      
      return repPath;
    }).filter(p => p !== null); // Remove nulls
    
    logger.info('🎯 Representatives to process:', {
      count: representativesToProcess.length,
      samplePaths: representativesToProcess.slice(0, 3)
    });

    for (let i = 0; i < representativesToProcess.length; i++) {
      const imagePath = representativesToProcess[i];
      
      // CRITICAL: Verify this is a full path
      if (!imagePath || !imagePath.startsWith('/')) {
        logger.error('Invalid path - not absolute!', { 
          imagePath,
          cluster: scanResults.clusters[i],
          clusterIndex: i
        });
        continue;
      }
      
      const metadata = metadataResults.find(m => m.path === imagePath);

      try {
        logger.debug('Processing representative', { 
          index: i + 1,
          total: representativesToProcess.length,
          path: imagePath,
          hasMetadata: !!metadata
        });
        
        const result = await imageProcessor.processImage(imagePath);
        
        // 🔥 DEBUG: Log EVERY result to see why success is false
        console.log('🔥 IMAGE PROCESSING RESULT:', {
          file: path.basename(imagePath),
          success: result.success,
          hasHash: !!result.hash,
          hasPreview: !!result.previewPath,
          error: result.error
        });
        
        // 🔍 HASH DEBUG - Critical debugging for similarity detection
        logger.info('🔍 HASH DEBUG', {
          file: path.basename(imagePath),
          hash: result.hash,
          hashLength: result.hash?.length,
          previewPath: result.previewPath,
          success: result.success
        });
        
        // Get keywords for this specific image's cluster
        const imageCluster = scanResults.clusters.find(c => 
          c.representative === imagePath || c.representativePath === imagePath
        );
        const imageKeywords = imageCluster ? 
          (clusterKeywords.get(imageCluster.representative) || { all: [] }) : 
          { all: [] };
        
        imageResults.push({
          path: imagePath,
          success: result.success,
          hash: result.hash,
          previewPath: result.previewPath,
          timestamp: metadata?.timestamp,
          gps: metadata?.gps,
          keywords: imageKeywords.all,
          error: result.error
        });

      } catch (error) {
        logger.error('Image processing failed', { 
          imagePath, 
          error: error.message,
          stack: error.stack
        });
        
        // Get keywords for this specific image's cluster
        const imageCluster = scanResults.clusters.find(c => 
          c.representative === imagePath || c.representativePath === imagePath
        );
        const imageKeywords = imageCluster ? 
          (clusterKeywords.get(imageCluster.representative) || { all: [] }) : 
          { all: [] };
        
        imageResults.push({
          path: imagePath,
          success: false,
          error: error.message,
          timestamp: metadata?.timestamp,
          gps: metadata?.gps,
          keywords: imageKeywords.all
        });
      }

      const progress = 35 + Math.round(((i + 1) / representativesToProcess.length) * 40);
      event.sender.send('progress', { 
        stage: 'processing', 
        message: `Processing ${i + 1} of ${representativesToProcess.length} representatives...`,
        percent: progress
      });
    }

    logger.info('Image processing complete', {
      total: imageResults.length,
      successful: imageResults.filter(r => r.success).length,
      failed: imageResults.filter(r => !r.success).length
    });

    // Step 4: Refine clusters using perceptual hashing
    event.sender.send('progress', { 
      stage: 'refining', 
      message: 'Refining image clusters...',
      percent: 75 
    });

    const refinedClusters = [];
    const successfulResults = imageResults.filter(r => r.success);
    
    if (successfulResults.length > 0) {
      // CRITICAL FIX: Build image objects with required hash data
      for (const cluster of scanResults.clusters) {
        const clusterImageData = cluster.imagePaths.map(imagePath => {
          const result = imageResults.find(r => r.path === imagePath && r.success);
          if (!result) return null;
          
          return {
            path: imagePath,
            hash: result.hash,
            timestamp: result.timestamp
          };
        }).filter(img => img !== null && img.hash); // Only include successfully processed images with hashes

        if (clusterImageData.length > 0) {
          try {
            const subGroups = await clusterRefiner.refineCluster(clusterImageData, 13);
            
            refinedClusters.push({
              originalCluster: cluster,
              subGroups: subGroups,
              wasRefined: subGroups.length > 1
            });
            
            logger.info('Cluster refined', {
              representative: path.basename(cluster.representative),
              originalSize: cluster.imageCount,
              subGroups: subGroups.length
            });
            
          } catch (error) {
            logger.error('Cluster refinement failed', { 
              cluster: cluster.representative,
              error: error.message 
            });
            
            // Fallback: Keep original cluster structure
            refinedClusters.push({
              originalCluster: cluster,
              subGroups: [{
                representative: cluster.representative,
                images: cluster.imagePaths,
                similarityScore: 0
              }],
              wasRefined: false,
              error: error.message
            });
          }
        }
      }
    }

    logger.info('Cluster refinement complete', {
      totalClusters: refinedClusters.length,
      refined: refinedClusters.filter(c => c.wasRefined).length
    });
    
    console.log('🔥 CLUSTER REFINEMENT COMPLETE - MOVING TO SIMILARITY DETECTION 🔥');
    console.log('🔥 ABOUT TO START SIMILARITY DETECTION SECTION 🔥');
    fs.appendFileSync('debug.txt', `\n=== CLUSTER REFINEMENT COMPLETE - ABOUT TO START SIMILARITY ===\n`);

    // Step 5: Detect similarity between representatives using CLIP
    console.log('🔥🔥🔥 STEP 5: REACHING SIMILARITY DETECTION SECTION 🔥🔥🔥');
    fs.appendFileSync('debug.txt', `\n=== REACHING SIMILARITY DETECTION SECTION ${new Date().toISOString()} ===\n`);

    let similarityResults = [];
    const config = configManager.getAllSettings();

    fs.appendFileSync('debug.txt', `config exists: ${!!config}\n`);
    fs.appendFileSync('debug.txt', `config.similarity exists: ${!!config?.similarity}\n`);
    fs.appendFileSync('debug.txt', `config.similarity.enabled: ${config?.similarity?.enabled}\n`);
    fs.appendFileSync('debug.txt', `clusterCount: ${scanResults.clusters.length}\n`);

    // ✅ FIX: Check cluster count, not successfulResults
    if (config?.similarity?.enabled && scanResults.clusters.length >= 2) {
      console.log('🔥🔥🔥 CLIP SIMILARITY DETECTION STARTING 🔥🔥🔥');
      fs.appendFileSync('debug.txt', `\n=== CLIP SIMILARITY DETECTION ENABLED - STARTING ===\n`);
      fs.appendFileSync('debug.txt', `representatives: ${scanResults.clusters.length}\n`);
      
      logger.info('Starting CLIP similarity detection', {
        representatives: scanResults.clusters.length,
        threshold: config.similarity.hammingThreshold
      });
      
      event.sender.send('progress', { 
        stage: 'similarity', 
        message: `Analyzing ${scanResults.clusters.length} representatives...`,
        percent: 78 
      });
      
      try {
        // ✅ FIX 1: ONLY process cluster representatives (13), not all images (52)
        console.log('🔥 GENERATING PREVIEWS FOR REPRESENTATIVES ONLY...');
        const previewToOriginal = new Map(); // preview path -> original path
        const originalToPreview = new Map(); // original path -> preview path
        
        // Loop through CLUSTERS, not successfulResults!
        for (const cluster of scanResults.clusters) {
          const representativePath = cluster.representative || cluster.representativePath;
          
          if (!representativePath) {
            logger.warn('Cluster missing representative path', { cluster });
            continue;
          }
          
          try {
            // Generate fresh preview for CLIP
            const previewPath = await imageProcessor.extractPreview(representativePath);
            previewToOriginal.set(previewPath, representativePath);
            originalToPreview.set(representativePath, previewPath);
            
            console.log('✅ Representative preview:', path.basename(representativePath));
          } catch (error) {
            logger.error('Preview generation failed for representative', { 
              representativePath, 
              error: error.message 
            });
          }
        }
        
        console.log(`🎯 Generated ${previewToOriginal.size} previews (expected ${scanResults.clusters.length})`);
        
        if (previewToOriginal.size < 2) {
          throw new Error(`Only ${previewToOriginal.size} previews generated, need at least 2`);
        }
        
        event.sender.send('progress', { 
          stage: 'similarity', 
          message: 'Running CLIP analysis...',
          percent: 80 
        });
        
        // Send preview JPGs to CLIP
        const previewPaths = Array.from(previewToOriginal.keys());

        console.log('🔍 ===== CLIP INPUT DEBUG =====');
        console.log(`📊 Sending ${previewPaths.length} images to CLIP`);
        for (let i = 0; i < previewPaths.length; i++) {
          const previewPath = previewPaths[i];
          const originalPath = previewToOriginal.get(previewPath);
          console.log(`  ${i + 1}. ${path.basename(originalPath)}`);
        }
        console.log('🔍 ===========================\n');

        const clipResults = await similarityDetector.findSimilarRepresentatives(previewPaths);

        console.log('🔍 ===== CLIP RETURNED =====');
        console.log(`📊 CLIP found ${clipResults.length} pairs`);
        clipResults.forEach((pair, idx) => {
          const orig1 = previewToOriginal.get(pair.rep1);
          const orig2 = previewToOriginal.get(pair.rep2);
          console.log(`  ${idx + 1}. ${path.basename(orig1)} ↔ ${path.basename(orig2)} (${pair.similarityPercent}%)`);
        });
        console.log('🔍 ==========================\n');
        
        // ✅ FIX 2: Map preview paths back to original image paths
        similarityResults = clipResults.map(pair => {
          const original1 = previewToOriginal.get(pair.rep1);
          const original2 = previewToOriginal.get(pair.rep2);
          
          if (!original1 || !original2) {
            logger.warn('Could not map preview to original', { 
              preview1: pair.rep1, 
              preview2: pair.rep2 
            });
            return null;
          }
          
          return {
            rep1: original1,                          // ✅ Original image path
            rep2: original2,                          // ✅ Original image path
            similarity: pair.similarity,
            similarityPercent: pair.similarityPercent,
            fileName1: path.basename(original1),      // ✅ Original filename
            fileName2: path.basename(original2)       // ✅ Original filename
          };
        }).filter(pair => pair !== null); // Remove any failed mappings
        
        console.log(`✅ Mapped ${similarityResults.length} similar pairs to original filenames`);

        // 🔍 DEBUG: Log final similarity results being returned
        console.log('🔍 ===== FINAL SIMILARITY RESULTS BEING RETURNED =====');
        console.log(`📊 Total pairs: ${similarityResults.length}`);
        if (similarityResults.length > 0) {
          console.log('📋 First 3 pairs:');
          similarityResults.slice(0, 3).forEach((pair, idx) => {
            console.log(`  ${idx + 1}. ${pair.fileName1} ↔ ${pair.fileName2} (${pair.similarityPercent}%)`);
            console.log(`     rep1: ${pair.rep1}`);
            console.log(`     rep2: ${pair.rep2}`);
          });
        }
        console.log('🔍 ================================================\n');
        
        // Log the results for debugging
        similarityResults.forEach(pair => {
          logger.info('Similar representatives found', {
            file1: pair.fileName1,
            file2: pair.fileName2,
            similarity: `${pair.similarityPercent}%`
          });
        });
        
        logger.info('CLIP similarity detection complete', {
          representativesProcessed: previewToOriginal.size,
          comparisons: (previewToOriginal.size * (previewToOriginal.size - 1)) / 2,
          similarPairs: similarityResults.length,
          threshold: config.similarity.hammingThreshold + '%'
        });
        
        event.sender.send('progress', { 
          stage: 'similarity', 
          message: `Found ${similarityResults.length} similar pairs`,
          percent: 85 
        });
        
      } catch (error) {
        console.error('❌ CLIP SIMILARITY FAILED:', error.message);
        console.error('Stack:', error.stack);
        
        logger.error('CLIP similarity detection failed', {
          error: error.message,
          stack: error.stack
        });
        
        event.sender.send('progress', { 
          stage: 'similarity', 
          message: 'Similarity detection failed - ' + error.message,
          percent: 85 
        });
        
        similarityResults = [];
      }
    } else {
      const skipReason = !config?.similarity?.enabled 
        ? 'Similarity detection disabled in config'
        : `Insufficient clusters (${scanResults.clusters?.length || 0} available, need 2+)`;
      
      console.log('❌ SIMILARITY DETECTION SKIPPED:', skipReason);
      fs.appendFileSync('debug.txt', `\n=== SIMILARITY DETECTION SKIPPED ===\n`);
      fs.appendFileSync('debug.txt', `skipReason: ${skipReason}\n`);
      
      logger.info('Similarity detection skipped', { reason: skipReason });
    }

    // Step 6: Save to database
    event.sender.send('progress', { 
      stage: 'saving', 
      message: 'Saving results to database...',
      percent: 90 
    });

    const saveResult = databaseService.saveProcessingResults(imageResults);
    logger.info('Processing results saved', saveResult);

    // Complete (MOVED TO THE END)
    event.sender.send('progress', { 
      stage: 'complete', 
      message: 'Processing complete!',
      percent: 100 
    });

    // Build cluster results for UI
    const processedClusters = scanResults.clusters.map(cluster => {
      const repResult = imageResults.find(r => r.path === cluster.representative);
      const clusterKW = clusterKeywords.get(cluster.representative) || { all: [] };
      
      // ✅ ADD: Get derivatives for this cluster's representative (handle both Map and object)
      let derivatives = [];
      if (scanResults.derivatives) {
        if (scanResults.derivatives instanceof Map) {
          derivatives = scanResults.derivatives.get(cluster.representative) || [];
        } else {
          derivatives = scanResults.derivatives[cluster.representative] || [];
        }
      }
      
      return {
        representative: path.basename(cluster.representative),
        representativePath: cluster.representative,
        representativeFilename: path.basename(cluster.representative),
        imageCount: cluster.imageCount,
        imagePaths: cluster.imagePaths,
        derivatives: derivatives,  // ✅ ADD: Derivatives array for XMP generation
        isBracketed: cluster.isBracketed,
        keywords: clusterKW.all, // ✅ CORRECT - uses cluster-specific keywords
        timestamp: repResult?.timestamp,
        gps: repResult?.gps,
        processed: repResult?.success || false,
        hash: repResult?.hash,
        analysisCount: 0 // Will be updated in Phase 3
      };
    });

    // Collect all unique keywords from all clusters
    const allKeywords = new Set();
    clusterKeywords.forEach(kw => {
      kw.all.forEach(keyword => allKeywords.add(keyword));
    });
    
    return { 
      success: true,
      results: {
        clustersProcessed: representativesToProcess.length,
        imagesProcessed: imageResults.filter(r => r.success).length,
        imagesFailed: imageResults.filter(r => !r.success).length,
        keywords: Array.from(allKeywords), // All unique keywords across all clusters
        savedToDatabase: saveResult.saved || 0,
        similarPairs: similarityResults.length // NEW
      },
      processedClusters, // Return cluster data, not individual images
      similarityResults // NEW: Pass similarity data to UI
    };

  } catch (error) {
    console.error('=== PROCESS-IMAGES HANDLER ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('=== END ERROR ===');
    
    logger.error('Image processing failed', { error: error.message });
    event.sender.send('progress', { 
      stage: 'error', 
      message: `Error: ${error.message}`,
      percent: 0 
    });
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
      
      // Initialize XMP Generator with new database
      try {
        xmpGenerator = new XMPGenerator(databaseService.db);
        logger.info('✅ XMP Generator initialized with new database');
      } catch (error) {
        logger.error('Failed to initialize XMP Generator', { error: error.message });
      }
      
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

ipcMain.handle('get-processed-images', async () => {
  try {
    const result = databaseService.getAllProcessedImages();
    return result;
  } catch (error) {
    logger.error('Failed to get processed images', { error: error.message });
    return { success: false, error: error.message, images: [], totalCount: 0 };
  }
});

// Thumbnail retrieval IPC handler
ipcMain.handle('get-preview-image', async (event, imagePath) => {
  try {
    console.log('📸 Thumbnail request received:', imagePath); // ADD
    
    // Get the preview path from the image processor
    const hash = require('crypto').createHash('md5').update(imagePath).digest('hex');
    const previewPath = path.join(imageProcessor.tempDir, `${hash}.jpg`);
    
    console.log('📁 Looking for preview at:', previewPath); // ADD
    console.log('📁 Temp dir contents:', await fs.promises.readdir(imageProcessor.tempDir)); // ADD
    
    // Check if preview exists
    try {
      await fs.promises.access(previewPath);
      console.log('✅ Preview file exists'); // ADD
      // Read file as base64
      const imageBuffer = await fs.promises.readFile(previewPath);
      const base64Image = imageBuffer.toString('base64');
      return { 
        success: true, 
        dataUrl: `data:image/jpeg;base64,${base64Image}` 
      };
    } catch (error) {
      console.error('❌ Preview not found:', previewPath); // ADD
      console.error('❌ Error:', error.message); // ADD
      logger.warn('Preview not found in cache', { imagePath, previewPath });
      return { success: false, error: 'Preview not found' };
    }
  } catch (error) {
    console.error('💥 Failed to get preview:', error); // ADD
    logger.error('Failed to get preview image', { imagePath, error: error.message });
    return { success: false, error: error.message };
  }
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

// CLIP service status check
ipcMain.handle('check-clip-service', async () => {
  try {
    const isHealthy = await clipServiceManager.checkHealth();
    return { 
      running: isHealthy, 
      ready: clipServiceManager.isReady 
    };
  } catch (error) {
    return { 
      running: false, 
      ready: false, 
      error: error.message 
    };
  }
});

// Restart CLIP service
ipcMain.handle('restart-clip-service', async () => {
  try {
    await clipServiceManager.restart();
    return { success: true };
  } catch (error) {
    logger.error('Failed to restart CLIP service', { error: error.message });
    return { success: false, error: error.message };
  }
});

// ============================================
// AI Settings Handlers
// ============================================

// Save AI settings
ipcMain.handle('save-ai-settings', async (event, settings) => {
  try {
    logger.info('Saving AI settings', {
      hasOllamaEndpoint: !!settings.ollamaEndpoint,
      hasOllamaModel: !!settings.ollamaModel,
      confidenceThreshold: settings.confidenceThreshold,
      hasGoogleVisionKey: !!settings.googleVisionApiKey
    });
    
    // ✅ FIXED: Use configManager.set() for each setting
    if (settings.ollamaEndpoint) {
      const ollama = configManager.get('ollama') || {};
      ollama.endpoint = settings.ollamaEndpoint;
      configManager.set('ollama', ollama);
    }
    
    if (settings.ollamaModel) {
      const ollama = configManager.get('ollama') || {};
      ollama.model = settings.ollamaModel;
      configManager.set('ollama', ollama);
    }
    
    if (settings.confidenceThreshold !== undefined) {
      const aiAnalysis = configManager.get('aiAnalysis') || {};
      aiAnalysis.confidenceThreshold = settings.confidenceThreshold;
      configManager.set('aiAnalysis', aiAnalysis);
    }
    
    if (settings.googleVisionApiKey) {
      const googleVision = configManager.get('googleVision') || {};
      googleVision.apiKey = settings.googleVisionApiKey;
      configManager.set('googleVision', googleVision);
    }
    
    logger.info('AI settings saved successfully');
    
    // Reinitialize AI Analysis Service with new settings
    await initializeAIServices();
    
    return { success: true };
    
  } catch (error) {
    logger.error('Failed to save AI settings', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Test Google Vision API
ipcMain.handle('test-google-vision-api', async (event, apiKey) => {
  try {
    const axios = require('axios');
    
    logger.info('Testing Google Vision API connection', { hasApiKey: !!apiKey });
    
    // Simple API quota/authentication test
    const response = await axios.get(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      { timeout: 5000 }
    );
    
    // If we get a 405 (Method Not Allowed), the API key is valid but we used wrong method
    // This is actually what we want - it means the key works!
    logger.info('Google Vision API test: Key is valid');
    return { success: true };
    
  } catch (error) {
    logger.error('Google Vision API test failed', { 
      status: error.response?.status,
      error: error.message 
    });
    
    // 405 = Method Not Allowed (key is valid, just wrong HTTP method)
    // 400 = Bad Request (key is valid, just bad request format)
    if (error.response?.status === 405 || error.response?.status === 400) {
      return { success: true, message: 'API key is valid' };
    }
    
    // 403 = Forbidden (invalid key or API not enabled)
    // 401 = Unauthorized (invalid key)
    if (error.response?.status === 403 || error.response?.status === 401) {
      return { 
        success: false, 
        error: 'Invalid API key or Vision API not enabled in Google Cloud Console' 
      };
    }
    
    return { 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    };
  }
});

// ============================================
// Personal Data IPC Handlers
// ============================================

// Get personal data
ipcMain.handle('get-personal-data', async () => {
  try {
    const data = databaseService.db.prepare('SELECT * FROM personal_data WHERE id = 1').get();
    
    logger.info('Personal data retrieved', { 
      hasData: !!data,
      creator: data?.creatorName 
    });
    
    return { success: true, data };
  } catch (error) {
    logger.error('Failed to get personal data', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Save personal data
ipcMain.handle('save-personal-data', async (event, data) => {
  try {
    logger.info('Saving personal data', { creator: data.creatorName });
    
    const stmt = databaseService.db.prepare(`
      INSERT OR REPLACE INTO personal_data (
        id, creatorName, jobTitle, address, city, state, postalCode, 
        country, phone, email, website, copyrightStatus, copyrightNotice, rightsUsageTerms
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.creatorName,
      data.jobTitle || null,
      data.address || null,
      data.city || null,
      data.state || null,
      data.postalCode || null,
      data.country || null,
      data.phone || null,
      data.email,
      data.website || null,
      data.copyrightStatus || 'copyrighted',
      data.copyrightNotice,
      data.rightsUsageTerms || null
    );
    
    logger.info('Personal data saved successfully');
    
    return { success: true };
  } catch (error) {
    logger.error('Failed to save personal data', { error: error.message });
    return { success: false, error: error.message };
  }
});

// ============================================
// AI Analysis IPC Handlers
// ============================================

ipcMain.handle('analyze-cluster-with-ai', async (event, clusterGroup, forceProvider) => {
  try {
    logger.info('Starting AI analysis', { 
      representative: clusterGroup.mainRep?.representativeFilename,
      forceProvider: forceProvider || 'auto'
    });
    
    // Check if service is initialized
    if (!aiAnalysisService) {
      logger.error('AI Analysis Service not initialized');
      
      // Try to initialize it now
      const config = configManager.getAllSettings();
      try {
        aiAnalysisService = new AIAnalysisService(config);
        logger.info('✅ AI Analysis Service initialized on-demand');
      } catch (initError) {
        logger.error('Failed to initialize AI service on-demand', { error: initError.message });
        return {
          success: false,
          error: 'AI Analysis Service failed to initialize. Check that:\n' +
                 '1. Ollama is running (ollama serve)\n' +
                 '2. Vision model is installed (ollama pull qwen2.5vl:latest)\n' +
                 '3. Config file has correct settings\n\n' +
                 `Error: ${initError.message}`
        };
      }
    }
    
    // Send progress updates
    event.sender.send('progress-update', {
      stage: 'ai-analysis',
      message: forceProvider === 'google' 
        ? 'Analyzing with Google Vision...' 
        : 'Analyzing with Ollama...',
      percent: 10
    });
    
    // Perform analysis
    const analysisResult = await aiAnalysisService.analyzeCluster(
      clusterGroup,
      {},
      forceProvider
    );
    
    event.sender.send('progress-update', {
      stage: 'ai-analysis',
      message: 'Analysis complete!',
      percent: 100
    });
    
    logger.info('AI analysis complete', {
      confidence: analysisResult.metadata.confidence,
      provider: analysisResult.metadata.provider,
      imageCount: analysisResult.imageCount
    });
    
    return {
      success: true,
      data: analysisResult
    };
    
  } catch (error) {
    logger.error('AI analysis failed', { 
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('generate-xmp-files', async (event, data) => {
  try {
    logger.info('Generating XMP files for cluster', {
      clusterRep: data.cluster?.mainRep?.representativeFilename
    });
    
    if (!xmpGenerator) {
      throw new Error('XMP Generator not initialized');
    }
    
    // Send progress
    event.sender.send('progress-update', {
      stage: 'xmp-generation',
      message: 'Collecting files and generating XMP...',
      percent: 0
    });
    
    // ✅ Use the new generateXMPFiles method that handles ALL files
    const result = await xmpGenerator.generateXMPFiles(data);
    
    if (result.success) {
      logger.info('XMP generation complete', {
        total: result.filesProcessed,
        success: result.successCount,
        failed: result.failCount
      });
      
      event.sender.send('progress-update', {
        stage: 'xmp-generation',
        message: `XMP generation complete! ${result.successCount} files processed.`,
        percent: 100
      });
      
      return {
        success: true,
        count: result.successCount,
        filesProcessed: result.filesProcessed,
        results: result.results
      };
    } else {
      throw new Error(result.error || 'XMP generation failed');
    }
    
  } catch (error) {
    logger.error('XMP generation failed', {
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message
    };
  }
});

/**
 * Helper function to extract EXIF data from image
 */
async function extractEXIFData(imagePath) {
  try {
    const exiftool = require('exiftool-vendored').exiftool;
    const tags = await exiftool.read(imagePath);
    
    return {
      DateTimeOriginal: tags.DateTimeOriginal || new Date().toISOString(),
      GPSLatitude: tags.GPSLatitude,
      GPSLongitude: tags.GPSLongitude
    };
  } catch (error) {
    logger.warn('Failed to extract EXIF data', { 
      imagePath,
      error: error.message 
    });
    
    // Return defaults
    return {
      DateTimeOriginal: new Date().toISOString(),
      GPSLatitude: null,
      GPSLongitude: null
    };
  }
}

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
  
  // ✅ FIX CSP: Allow data URLs for images (SVG placeholders and base64 thumbnails)
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // CRITICAL: Allow both 'self' and data: URLs for images
        'Content-Security-Policy': [
          "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"
        ]
      }
    });
  });
  
  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  // Run system check
  const systemCheck = new SystemCheck();
  const checkResults = await systemCheck.checkAll();
  
  if (!checkResults.allPassed) {
    logger.error('Required tools missing', checkResults.results);
    
    const missingTools = Object.entries(checkResults.results)
      .filter(([tool, result]) => !result.available && ['exiftool', 'sharp', 'imghash', 'database'].includes(tool))
      .map(([tool, result]) => `${tool}: ${result.message}${result.installCommand ? '\n  Install: ' + result.installCommand : ''}`)
      .join('\n\n');
    
    const response = await dialog.showMessageBox({
      type: 'error',
      title: 'Required Tools Missing',
      message: 'Cannot start - required tools are missing',
      detail: missingTools,
      buttons: ['Exit'],
      defaultId: 0
    });
    
    app.quit();
    return;
  }
  
  // Show warnings but allow startup
  if (checkResults.warnings && checkResults.warnings.length > 0) {
    logger.warn('System check warnings', checkResults.warnings);
    
    // Only show dialog if dcraw is missing
    if (!checkResults.results.dcraw.available) {
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Optional Tool Missing',
        message: 'Some optional tools are missing',
        detail: '⚠️  dcraw: Not installed (optional)\n' +
                '   Some old CR2 files may fail to process\n' +
                '   Install with: brew install dcraw\n\n' +
                '   The application will work fine without dcraw for most images.',
        buttons: ['Continue Anyway'],
        defaultId: 0
      });
    }
  }
  
  // Start CLIP service
  try {
    logger.info('Starting CLIP similarity service...');
    await clipServiceManager.start();
    logger.info('✅ CLIP service started successfully');
  } catch (error) {
    logger.error('⚠️ CLIP service failed to start', { error: error.message });
    
    // Show warning but allow app to start
    await dialog.showMessageBox({
      type: 'warning',
      title: 'CLIP Service Warning',
      message: 'CLIP similarity service failed to start',
      detail: `Error: ${error.message}\n\n` +
              'Similarity detection will not work.\n\n' +
              'To fix:\n' +
              '1. Ensure Python 3 is installed\n' +
              '2. Install dependencies: pip3 install fastapi transformers pillow torch uvicorn\n' +
              '3. Restart the application',
      buttons: ['Continue Anyway'],
      defaultId: 0
    });
  }
  
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
  // Stop CLIP service
  if (clipServiceManager) {
    clipServiceManager.stop();
  }
  
  databaseService.close();
});

