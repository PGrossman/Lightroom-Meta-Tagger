// src/services/imageProcessor.js
const sharp = require('sharp');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

class ImageProcessor {
  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.previewCache = new Map(); // Cache preview paths
  }

  /**
   * Ensure temp directory exists
   */
  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error: error.message });
      throw error;
    }
  }

  /**
   * Extract embedded preview from RAW file using Sharp
   * Falls back to exiftool if Sharp fails
   * Returns path to generated JPG
   */
  async extractPreview(rawPath) {
    await this.ensureTempDir();

    // Check cache first
    if (this.previewCache.has(rawPath)) {
      const cachedPath = this.previewCache.get(rawPath);
      try {
        await fs.access(cachedPath);
        logger.debug('Using cached preview', { rawPath, cachedPath });
        return cachedPath;
      } catch {
        // Cache entry is stale, remove it
        this.previewCache.delete(rawPath);
      }
    }

    // Generate output filename
    const hash = crypto.createHash('md5').update(rawPath).digest('hex');
    const outputPath = path.join(this.tempDir, `${hash}.jpg`);

    try {
      // Try Sharp first (fast - extracts embedded preview)
      await sharp(rawPath)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      logger.debug('Preview extracted with Sharp', { rawPath, outputPath });
      this.previewCache.set(rawPath, outputPath);
      return outputPath;

    } catch (sharpError) {
      logger.warn('Sharp extraction failed, trying exiftool', { 
        rawPath, 
        error: sharpError.message 
      });

      try {
        // Fallback to exiftool (slower but more reliable)
        // FIXED: Increase maxBuffer to handle large previews
        const { stdout } = await execFileAsync('exiftool', [
          '-b',
          '-PreviewImage',
          rawPath
        ], {
          maxBuffer: 50 * 1024 * 1024, // ✅ ADD: 50MB buffer (up from default 1MB)
          encoding: 'buffer' // ✅ ADD: Handle binary data properly
        });

        // Write the binary data to file manually
        if (stdout && stdout.length > 0) {
          await fs.writeFile(outputPath, stdout);
        } else {
          throw new Error('No preview data extracted');
        }

        // Verify file was created
        await fs.access(outputPath);
        
        logger.debug('Preview extracted with exiftool', { rawPath, outputPath });
        this.previewCache.set(rawPath, outputPath);
        return outputPath;

      } catch (exiftoolError) {
        logger.warn('Exiftool failed, trying dcraw for old CR2 files', { 
          rawPath, 
          exiftoolError: exiftoolError.message 
        });

        try {
          // Final fallback to dcraw for old CR2 files
          await this.convertWithDcraw(rawPath, outputPath);
          
          logger.debug('Preview extracted with dcraw', { rawPath, outputPath });
          this.previewCache.set(rawPath, outputPath);
          return outputPath;

        } catch (dcrawError) {
          logger.error('All extraction methods failed', { 
            rawPath, 
            sharpError: sharpError.message,
            exiftoolError: exiftoolError.message,
            dcrawError: dcrawError.message
          });
          throw new Error(`Failed to extract preview: ${dcrawError.message}`);
        }
      }
    }
  }

  /**
   * Convert RAW file to JPEG using dcraw (for old CR2 files)
   * Uses dcraw to convert to PPM, then Sharp to convert to JPEG
   */
  async convertWithDcraw(rawPath, outputPath) {
    try {
      // Check if dcraw exists first
      try {
        await execFileAsync('which', ['dcraw']);
      } catch (whichError) {
        logger.warn('dcraw not found in PATH, skipping dcraw conversion');
        throw new Error('dcraw not installed');
      }

      // Use dcraw to convert to PPM (stdout)
      const { stdout } = await execFileAsync('dcraw', [
        '-c',           // Write to stdout
        '-w',           // Use camera white balance  
        '-q', '3',      // High quality
        '-h',           // Half-size (faster processing)
        rawPath
      ], {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        timeout: 30000 // 30 second timeout
      });

      if (!stdout || stdout.length === 0) {
        throw new Error('dcraw produced no output');
      }

      // Convert PPM to JPEG with Sharp
      await sharp(Buffer.from(stdout))
        .resize(1200, 1200, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      logger.debug('dcraw conversion successful', { rawPath, outputPath });

    } catch (error) {
      logger.error('dcraw conversion failed', { rawPath, error: error.message });
      throw new Error(`dcraw conversion failed: ${error.message}`);
    }
  }

  /**
   * Generate perceptual hash for an image
   * Uses the imghash library (install with: npm install imghash)
   * Returns 16-bit hash string
   */
  async generateHash(imagePath) {
    try {
      // Use imghash library for perceptual hashing
      const imghash = require('imghash');
      
      const hash = await imghash.hash(imagePath, 16);
      
      logger.debug('Hash generated', { 
        originalPath: imagePath,
        hash: hash.substring(0, 16) + '...',
        hashLength: hash.length,
        isPreviewFile: imagePath.includes('/temp/')
      });
      return hash;

    } catch (error) {
      logger.error('Failed to generate hash', { 
        imagePath, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Calculate Hamming distance between two hashes
   * Returns number of differing bits (0-256 for 16-bit hashes)
   */
  calculateHammingDistance(hash1, hash2) {
    if (!hash1 || !hash2 || hash1.length !== hash2.length) {
      return Infinity;
    }

    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }

    return distance;
  }

  /**
   * Check if two images are similar based on hash comparison
   * Threshold: < 13 = 95%+ similar (default for bracket detection)
   */
  areSimilar(hash1, hash2, threshold = 13) {
    const distance = this.calculateHammingDistance(hash1, hash2);
    return distance < threshold;
  }

  /**
   * Process image: Extract preview + generate hash
   * Returns: { previewPath, hash }
   */
  async processImage(rawPath, timeout = 30000) {
    try {
      logger.info('Processing image', { rawPath });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), timeout)
      );

    const processingPromise = (async () => {
      const previewPath = await this.extractPreview(rawPath);
      // ✅ FIXED: Generate hash from the PREVIEW JPG, not the RAW file!
      const hash = await this.generateHash(previewPath);
      return { previewPath, hash };
    })();

      const { previewPath, hash } = await Promise.race([
        processingPromise,
        timeoutPromise
      ]);

      return {
        success: true,
        previewPath,
        hash
      };

    } catch (error) {
      logger.error('Image processing failed', { 
        rawPath, 
        error: error.message,
        stack: error.stack 
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch process multiple images
   * Returns array of results
   */
  async processBatch(rawPaths, progressCallback = null) {
    const results = [];
    const total = rawPaths.length;

    for (let i = 0; i < rawPaths.length; i++) {
      const rawPath = rawPaths[i];
      
      const result = await this.processImage(rawPath);
      results.push({
        path: rawPath,
        ...result
      });

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          currentFile: path.basename(rawPath)
        });
      }

      logger.debug('Batch progress', { 
        completed: i + 1, 
        total, 
        file: path.basename(rawPath) 
      });
    }

    logger.info('Batch processing complete', { 
      total, 
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    return results;
  }

  /**
   * Clean up temp directory
   * Optionally keep cached previews
   */
  async cleanup(keepCache = false) {
    try {
      if (!keepCache) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
        this.previewCache.clear();
        logger.info('Temp directory cleaned up');
      } else {
        // Just clear old cache entries (optional optimization)
        logger.info('Keeping preview cache');
      }
    } catch (error) {
      logger.error('Cleanup failed', { error: error.message });
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedPreviews: this.previewCache.size,
      tempDir: this.tempDir
    };
  }
}

module.exports = ImageProcessor;


