// src/services/configManager.js
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

class ConfigManager {
  constructor() {
    // Get user data directory from Electron
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    
    this.configPath = path.join(userDataPath, 'app-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load config from file, or create with defaults
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.error('Failed to load config', { error: error.message });
    }

    // Return defaults if file doesn't exist or can't be read
    return {
      databasePath: null,
      lastUsedDirectory: null,
      timestampThreshold: 5,
      ollamaEndpoint: 'http://localhost:11434',
      ollamaModel: 'qwen2.5vl:latest'
    };
  }

  /**
   * Save config to file
   */
  saveConfig() {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf8');
      logger.info('Config saved', { configPath: this.configPath });
    } catch (error) {
      logger.error('Failed to save config', { error: error.message });
    }
  }

  /**
   * Get a config value
   */
  get(key, defaultValue = null) {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * Set a config value and save
   */
  set(key, value) {
    this.config[key] = value;
    this.saveConfig();
  }

  /**
   * Get database path from config
   */
  getDatabasePath() {
    return this.get('databasePath');
  }

  /**
   * Set database path in config
   */
  setDatabasePath(dbPath) {
    this.set('databasePath', dbPath);
    logger.info('Database path saved to config', { dbPath });
  }

  /**
   * Get last used directory
   */
  getLastUsedDirectory() {
    return this.get('lastUsedDirectory');
  }

  /**
   * Set last used directory
   */
  setLastUsedDirectory(dirPath) {
    this.set('lastUsedDirectory', dirPath);
  }

  /**
   * Get timestamp threshold
   */
  getTimestampThreshold() {
    return this.get('timestampThreshold', 5);
  }

  /**
   * Set timestamp threshold
   */
  setTimestampThreshold(seconds) {
    this.set('timestampThreshold', seconds);
  }

  /**
   * Get Chernobyl database path
   */
  getChernobylDBPath() {
    const chernobylDB = this.get('chernobylDB') || {};
    return chernobylDB.path || null;
  }

  /**
   * Set Chernobyl database path
   */
  setChernobylDBPath(csvPath) {
    const chernobylDB = this.get('chernobylDB') || {};
    chernobylDB.path = csvPath;
    this.set('chernobylDB', chernobylDB);
    logger.info('Chernobyl DB path saved to config', { csvPath });
  }

  /**
   * Get Chernobyl DB settings
   */
  getChernobylDBSettings() {
    return this.get('chernobylDB') || { path: '' };
  }

  /**
   * Get all settings
   */
  getAllSettings() {
    // Load the main project config.json file
    const projectConfigPath = path.join(process.cwd(), 'config.json');
    
    try {
      if (fs.existsSync(projectConfigPath)) {
        const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
        
        // Merge with user settings
        return {
          ...projectConfig,
          databasePath: this.getDatabasePath(),
          lastUsedDirectory: this.getLastUsedDirectory(),
          timestampThreshold: this.getTimestampThreshold(),
          chernobylDB: this.get('chernobylDB') || projectConfig.chernobylDB || {} // ✅ Include chernobylDB from user config
        };
      }
    } catch (error) {
      logger.error('Failed to load project config', { error: error.message });
    }
    
    // Fallback to user config only
    return {
      databasePath: this.getDatabasePath(),
      lastUsedDirectory: this.getLastUsedDirectory(),
      timestampThreshold: this.getTimestampThreshold(),
      ollamaEndpoint: this.get('ollamaEndpoint'),
      ollamaModel: this.get('ollamaModel'),
      chernobylDB: this.get('chernobylDB') || {} // ✅ Include chernobylDB from user config
    };
  }

  /**
   * Clear all settings (for testing)
   */
  clearAll() {
    this.config = {
      databasePath: null,
      lastUsedDirectory: null,
      timestampThreshold: 5,
      ollamaEndpoint: 'http://localhost:11434',
      ollamaModel: 'qwen2.5vl:latest'
    };
    this.saveConfig();
    logger.info('All settings cleared');
  }
}

module.exports = ConfigManager;
