const { app } = require('electron');
const path = require('path');

class PathHelper {
  /**
   * Get Python executable path
   */
  static getPythonPath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'venv', 'bin', 'python3');
    }
    return path.join(process.cwd(), 'venv', 'bin', 'python3');
  }

  /**
   * Get Python script path
   */
  static getScriptPath(scriptName) {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, scriptName);
    }
    return path.join(process.cwd(), scriptName);
  }

  /**
   * Get bundled tool path (exiftool, dcraw)
   */
  static getToolPath(toolName) {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'bin', toolName);
    }
    return toolName; // Use system tool in development
  }

  /**
   * Get config file path
   */
  static getConfigPath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'config.json');
    }
    return path.join(process.cwd(), 'config.json');
  }

  /**
   * Get writable temp directory
   */
  static getTempDir() {
    return path.join(app.getPath('temp'), 'lightroom-xmp-generator');
  }

  /**
   * Get writable logs directory
   */
  static getLogsDir() {
    return path.join(app.getPath('userData'), 'logs');
  }

  /**
   * Get writable data directory
   */
  static getUserDataDir() {
    return app.getPath('userData');
  }
}

module.exports = PathHelper;
