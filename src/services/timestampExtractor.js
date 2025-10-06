// src/services/timestampExtractor.js
const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

class TimestampExtractor {
  constructor() {
    this.cache = new Map(); // Cache timestamps to avoid re-reading files
  }

  /**
   * Extract capture timestamp from RAW file using exiftool
   * Returns timestamp in milliseconds, or null if not found
   */
  async extractFromRAW(imagePath) {
    // Check cache first
    if (this.cache.has(imagePath)) {
      return this.cache.get(imagePath);
    }

    try {
      // Use exiftool to extract DateTimeOriginal
      const { stdout } = await execFileAsync('exiftool', [
        '-DateTimeOriginal',
        '-s3', // Output only the value
        '-d', '%Y:%m:%d %H:%M:%S', // Format: YYYY:MM:DD HH:MM:SS
        imagePath
      ]);

      const dateTimeStr = stdout.trim();
      
      if (!dateTimeStr || dateTimeStr === '-') {
        logger.warn('No timestamp found in EXIF', { imagePath });
        return null;
      }

      // Parse the timestamp string
      // Format: "2012:11:03 10:07:15"
      const parts = dateTimeStr.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
      
      if (!parts) {
        logger.warn('Could not parse timestamp', { imagePath, dateTimeStr });
        return null;
      }

      const [, year, month, day, hour, minute, second] = parts;
      
      // Create Date object (month is 0-indexed in JavaScript)
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second)
      );

      const timestampMs = date.getTime();
      
      // Cache the result
      this.cache.set(imagePath, timestampMs);
      
      logger.debug('Timestamp extracted', { 
        imagePath,
        timestamp: date.toISOString(),
        timestampMs
      });
      
      return timestampMs;
      
    } catch (error) {
      logger.error('Failed to extract timestamp', { 
        imagePath, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Check if two timestamps are within the specified number of seconds
   */
  areWithinSeconds(timestamp1, timestamp2, seconds = 5) {
    if (!timestamp1 || !timestamp2) return false;
    
    const diff = Math.abs(timestamp1 - timestamp2);
    const threshold = seconds * 1000; // Convert to milliseconds
    
    return diff <= threshold;
  }

  /**
   * Format timestamp for display
   */
  formatTimestamp(timestampMs) {
    if (!timestampMs) return 'Unknown';
    
    const date = new Date(timestampMs);
    return date.toLocaleString();
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = TimestampExtractor;
