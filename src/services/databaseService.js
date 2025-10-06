// src/services/databaseService.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = null;
  }

  /**
   * Initialize database at specified location
   * Creates database file and tables if they don't exist
   */
  initialize(dbPath) {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Connect to database (creates file if doesn't exist)
      this.db = new Database(dbPath, { verbose: logger.debug });
      this.dbPath = dbPath;

      // Create tables
      this.createTables();

      logger.info('Database initialized', { dbPath });
      return { success: true, dbPath };

    } catch (error) {
      logger.error('Database initialization failed', { dbPath, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Create database tables if they don't exist
   */
  createTables() {
    // Images table - stores base image information
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        directory TEXT NOT NULL,
        file_size INTEGER,
        capture_timestamp INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Derivatives table - stores edited/processed versions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS derivatives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_image_id INTEGER NOT NULL,
        file_path TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (parent_image_id) REFERENCES images(id) ON DELETE CASCADE
      )
    `);

    // Clusters table - stores timestamp-based groupings
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clusters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        representative_image_id INTEGER NOT NULL,
        start_timestamp INTEGER,
        end_timestamp INTEGER,
        image_count INTEGER,
        is_bracketed BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (representative_image_id) REFERENCES images(id) ON DELETE CASCADE
      )
    `);

    // Cluster members table - maps images to clusters
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cluster_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cluster_id INTEGER NOT NULL,
        image_id INTEGER NOT NULL,
        FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE,
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
        UNIQUE(cluster_id, image_id)
      )
    `);

    // Analysis results table - stores AI/Ollama analysis
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        analysis_method TEXT,
        subjects TEXT,
        scene_type TEXT,
        keywords TEXT,
        description TEXT,
        confidence REAL,
        analyzed_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
      )
    `);

    // Processing status table - tracks processing pipeline
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS processing_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_id INTEGER NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        processed_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_images_path ON images(file_path);
      CREATE INDEX IF NOT EXISTS idx_images_timestamp ON images(capture_timestamp);
      CREATE INDEX IF NOT EXISTS idx_derivatives_parent ON derivatives(parent_image_id);
      CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON cluster_members(cluster_id);
      CREATE INDEX IF NOT EXISTS idx_cluster_members_image ON cluster_members(image_id);
      CREATE INDEX IF NOT EXISTS idx_analysis_image ON analysis_results(image_id);
      CREATE INDEX IF NOT EXISTS idx_processing_image ON processing_status(image_id);
    `);

    logger.info('Database tables created/verified');
  }

  /**
   * Check if database exists at path
   */
  static databaseExists(dbPath) {
    return fs.existsSync(dbPath);
  }

  /**
   * Clear all records from database (for testing)
   */
  clearAllRecords() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const transaction = this.db.transaction(() => {
        this.db.exec('DELETE FROM processing_status');
        this.db.exec('DELETE FROM analysis_results');
        this.db.exec('DELETE FROM cluster_members');
        this.db.exec('DELETE FROM clusters');
        this.db.exec('DELETE FROM derivatives');
        this.db.exec('DELETE FROM images');
        
        // Reset auto-increment counters
        this.db.exec('DELETE FROM sqlite_sequence');
      });

      transaction();

      logger.info('Database cleared - all records deleted');
      return { success: true, message: 'Database cleared successfully' };

    } catch (error) {
      logger.error('Failed to clear database', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get database statistics
   */
  getStats() {
    if (!this.db) {
      return null;
    }

    try {
      const stats = {
        images: this.db.prepare('SELECT COUNT(*) as count FROM images').get().count,
        derivatives: this.db.prepare('SELECT COUNT(*) as count FROM derivatives').get().count,
        clusters: this.db.prepare('SELECT COUNT(*) as count FROM clusters').get().count,
        analyzed: this.db.prepare('SELECT COUNT(*) as count FROM analysis_results').get().count
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', { error: error.message });
      return null;
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      logger.info('Database connection closed');
    }
  }

  /**
   * Get database file size
   */
  getFileSize() {
    if (!this.dbPath || !fs.existsSync(this.dbPath)) {
      return 0;
    }

    const stats = fs.statSync(this.dbPath);
    return stats.size;
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = DatabaseService;

