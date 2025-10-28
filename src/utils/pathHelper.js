const path = require('path');

class PathHelper {
  /**
   * Check if app is packaged (Electron context)
   */
  static isPackaged() {
    try {
      const { app } = require('electron');
      return app.isPackaged;
    } catch (error) {
      // Not in Electron context
      return false;
    }
  }

  /**
   * Get Python executable path
   */
  static getPythonPath() {
    if (this.isPackaged()) {
      return path.join(process.resourcesPath, 'venv', 'bin', 'python3');
    }
    return path.join(process.cwd(), 'venv', 'bin', 'python3');
  }

  /**
   * Get Python script path
   */
  static getScriptPath(scriptName) {
    if (this.isPackaged()) {
      return path.join(process.resourcesPath, scriptName);
    }
    return path.join(process.cwd(), scriptName);
  }

  /**
   * Get bundled tool path (exiftool, dcraw)
   */
  static getToolPath(toolName) {
    if (this.isPackaged()) {
      return path.join(process.resourcesPath, 'bin', toolName);
    }
    return toolName; // Use system tool in development
  }

  /**
   * Get exiftool path
   */
  static getExiftoolPath() {
    return this.getToolPath('exiftool');
  }

  /**
   * Get dcraw path
   */
  static getDcrawPath() {
    return this.getToolPath('dcraw');
  }

  /**
   * Get config file path
   */
  static getConfigPath() {
    if (this.isPackaged()) {
      return path.join(process.resourcesPath, 'config.json');
    }
    return path.join(process.cwd(), 'config.json');
  }

  /**
   * Get writable temp directory
   */
  static getTempDir() {
    try {
      const { app } = require('electron');
      return path.join(app.getPath('temp'), 'lightroom-xmp-generator');
    } catch (error) {
      // Fallback for non-Electron context
      return path.join(process.cwd(), 'temp');
    }
  }

  /**
   * Get writable logs directory
   */
  static getLogsDir() {
    try {
      const { app } = require('electron');
      return path.join(app.getPath('userData'), 'logs');
    } catch (error) {
      // Fallback for non-Electron context
      return path.join(process.cwd(), 'logs');
    }
  }

  /**
   * Get writable data directory
   */
  static getUserDataDir() {
    try {
      const { app } = require('electron');
      return app.getPath('userData');
    } catch (error) {
      // Fallback for non-Electron context
      return process.cwd();
    }
  }
}

module.exports = PathHelper;
