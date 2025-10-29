// src/services/imageProcessor.js
const sharp = require('sharp');
const { execFile } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const logger = require('../utils/logger');
const PathHelper = require('../utils/pathHelper');

const execFileAsync = promisify(execFile);

class ImageProcessor {
  constructor() {
    this.tempDir = PathHelper.getTempDir();
    this.previewCache = new Map();
    this.exiftoolPath = PathHelper.getExiftoolPath();
    
    // ✅ FIX: Define which extensions use which processing method
    this.rawExtensions = ['.cr2', '.cr3', '.nef', '.arw', '.dng', '.raf', '.orf', '.rw2', '.pef', '.erf'];
    this.processedExtensions = ['.tif', '.tiff', '.jpg', '.jpeg', '.png', '.psd', '.psb'];
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
   * ✅ FIX: NEW METHOD - Determine if file is RAW or processed
   */
  isRawFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.rawExtensions.includes(ext);
  }

  /**
   * ✅ FIX: NEW METHOD - Process TIF/processed images with Sharp
   * Handles: TIF, TIFF, PSD, PNG, JPG
   */
  async processWithSharp(imagePath) {
    await this.ensureTempDir();

    // Check cache first
    if (this.previewCache.has(imagePath)) {
      const cachedPath = this.previewCache.get(imagePath);
      try {
        await fs.access(cachedPath);
        logger.debug('Using cached preview (Sharp)', { imagePath, cachedPath });
        return cachedPath;
      } catch {
        this.previewCache.delete(imagePath);
      }
    }

    const hash = crypto.createHash('md5').update(imagePath).digest('hex');
    const outputPath = path.join(this.tempDir, `${hash}.jpg`);

    try {
      logger.debug('Processing with Sharp', { imagePath });
      
      // Load image with Sharp and apply transformations
      await sharp(imagePath)
        .rotate() // Auto-rotate based on EXIF orientation
        .resize(1200, 1200, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      logger.debug('Sharp processing successful', { imagePath, outputPath });

      // Cache the result
      this.previewCache.set(imagePath, outputPath);

      return outputPath;

    } catch (error) {
      logger.error('Failed to process with Sharp', { 
        imagePath,
        error: error.message 
      });
      throw new Error(`Failed to process image with Sharp: ${error.message}`);
    }
  }

  /**
   * Extract embedded preview from RAW file using exiftool
   * Then rotate with Sharp based on EXIF orientation
   * Returns path to generated JPG
   */
  async extractPreview(rawPath) {
    await this.ensureTempDir();

    // ✅ FIX: Check if this is actually a RAW file, otherwise use Sharp
    if (!this.isRawFile(rawPath)) {
      logger.debug('Not a RAW file, using Sharp instead', { rawPath });
      return await this.processWithSharp(rawPath);
    }

    // Check cache first
    if (this.previewCache.has(rawPath)) {
      const cachedPath = this.previewCache.get(rawPath);
      try {
        await fs.access(cachedPath);
        logger.debug('Using cached preview', { rawPath, cachedPath });
        return cachedPath;
      } catch {
        this.previewCache.delete(rawPath);
      }
    }

    const hash = crypto.createHash('md5').update(rawPath).digest('hex');
    const outputPath = path.join(this.tempDir, `${hash}.jpg`);
    const tempExtractPath = path.join(this.tempDir, `${hash}_temp.jpg`);

    try {
      // Step 1: Extract preview JPG using exiftool
      logger.debug('Extracting preview with exiftool', { rawPath });
      
      const { stdout: previewData } = await execFileAsync(this.exiftoolPath, [
        '-b',
        '-PreviewImage',
        rawPath
      ], {
        encoding: 'buffer',
        maxBuffer: 50 * 1024 * 1024
      });

      if (!previewData || previewData.length === 0) {
        throw new Error('No preview image found in RAW file');
      }

      await fs.writeFile(tempExtractPath, previewData);
      logger.debug('Preview extracted to temp file', { tempExtractPath });

      // Step 2: Read EXIF Orientation
      let orientation = 1;
      try {
        const { stdout } = await execFileAsync(this.exiftoolPath, [
          '-Orientation',
          '-n',
          rawPath
        ]);
        
        const match = stdout.match(/Orientation\s*:\s*(\d+)/);
        if (match) {
          orientation = parseInt(match[1]);
          logger.debug('EXIF Orientation detected', { rawPath, orientation });
        }
      } catch (error) {
        logger.warn('Could not read EXIF orientation', { rawPath, error: error.message });
      }

      // Step 3: Process with Sharp
      const sharpInstance = sharp(tempExtractPath)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true });
      
      switch (orientation) {
        case 3:
          sharpInstance.rotate(180);
          logger.debug('Rotating 180°', { rawPath });
          break;
        case 6:
          sharpInstance.rotate(90);
          logger.debug('Rotating 90° CW', { rawPath });
          break;
        case 8:
          sharpInstance.rotate(270);
          logger.debug('Rotating 270° CW', { rawPath });
          break;
        default:
          logger.debug('No rotation needed', { rawPath, orientation });
          break;
      }
      
      await sharpInstance
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      // Cleanup
      try {
        await fs.unlink(tempExtractPath);
      } catch (e) {
        logger.warn('Could not delete temp file', { tempExtractPath });
      }

      logger.debug('Preview processed successfully', { rawPath, outputPath, orientation });

      this.previewCache.set(rawPath, outputPath);

      return outputPath;

    } catch (error) {
      // Cleanup on error
      try {
        await fs.unlink(tempExtractPath);
      } catch (e) {
        // Ignore
      }

      logger.error('Failed to extract and rotate preview', { 
        rawPath,
        error: error.message 
      });
      throw new Error(`Failed to extract preview: ${error.message}`);
    }
  }

  /**
   * Convert RAW file to JPEG using dcraw (fallback method)
   */
  async convertWithDcraw(rawPath, outputPath) {
    try {
      try {
        await execFileAsync('which', ['dcraw']);
      } catch (whichError) {
        logger.warn('dcraw not found in PATH, skipping dcraw conversion');
        throw new Error('dcraw not installed');
      }

      const { stdout } = await execFileAsync('dcraw', [
        '-c',
        '-w',
        '-q', '3',
        '-h',
        rawPath
      ], {
        maxBuffer: 50 * 1024 * 1024,
        timeout: 30000
      });

      if (!stdout || stdout.length === 0) {
        throw new Error('dcraw produced no output');
      }

      await sharp(Buffer.from(stdout))
        .rotate()
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
   */
  async generateHash(imagePath) {
    try {
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
   * Check if two images are similar
   */
  areSimilar(hash1, hash2, threshold = 13) {
    const distance = this.calculateHammingDistance(hash1, hash2);
    return distance < threshold;
  }

  /**
   * ✅ MAIN ENTRY POINT: Process image (RAW or processed)
   * Automatically routes to correct processing method
   */
  async processImage(imagePath, timeout = 30000) {
    try {
      logger.info('Processing image', { imagePath });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), timeout)
      );

      const processingPromise = (async () => {
        // ✅ FIX: Route to correct processing method based on file type
        const previewPath = await this.extractPreview(imagePath);
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
        imagePath, 
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
   */
  async processBatch(imagePaths, progressCallback = null) {
    const results = [];
    const total = imagePaths.length;

    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      
      const result = await this.processImage(imagePath);
      results.push({
        path: imagePath,
        ...result
      });

      if (progressCallback) {
        progressCallback({
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          currentFile: path.basename(imagePath)
        });
      }

      logger.debug('Batch progress', { 
        completed: i + 1, 
        total, 
        file: path.basename(imagePath) 
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
   */
  async cleanup(keepCache = false) {
    try {
      if (!keepCache) {
        await fs.rm(this.tempDir, { recursive: true, force: true });
        this.previewCache.clear();
        logger.info('Temp directory cleaned up');
      } else {
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
