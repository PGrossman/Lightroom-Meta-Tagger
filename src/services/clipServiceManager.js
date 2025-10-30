// src/services/clipServiceManager.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const logger = require('../utils/logger');
const PathHelper = require('../utils/pathHelper');

class ClipServiceManager {
  constructor() {
    this.process = null;
    this.serviceUrl = 'http://127.0.0.1:8765';
    this.isStarting = false;
    this.isReady = false;
  }

  /**
   * Start the CLIP Python service
   */
  async start() {
    if (this.process || this.isStarting) {
      logger.info('CLIP service already starting or running');
      return;
    }

    this.isStarting = true;
    
    const scriptPath = PathHelper.getScriptPath('similarity_service.py');

    // Determine user runtime venv python path
    const venvPython = PathHelper.getPythonPath();

    // Bootstrap venv in userData if missing
    try {
      const userVenvDir = PathHelper.getUserVenvPath();
      if (!fs.existsSync(venvPython)) {
        logger.info('User venv not found, bootstrapping...', { userVenvDir });

        // Prefer system python3 from /usr/bin/python3; fallback to 'python3'
        const systemPythonCandidates = [
          '/usr/bin/python3',
          '/opt/homebrew/bin/python3',
          '/usr/local/bin/python3',
          'python3'
        ];
        const systemPython = systemPythonCandidates.find(p => {
          try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
        }) || 'python3';

        // Create venv
        await new Promise((resolve, reject) => {
          const proc = spawn(systemPython, ['-m', 'venv', userVenvDir], { stdio: ['ignore', 'pipe', 'pipe'] });
          let err = '';
          proc.stderr.on('data', d => err += d.toString());
          proc.on('close', code => code === 0 ? resolve() : reject(new Error(err || `venv create failed (${code})`)));
        });

        // Upgrade pip
        await new Promise((resolve, reject) => {
          const proc = spawn(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'wheel', 'setuptools'], { stdio: ['ignore', 'pipe', 'pipe'] });
          let err = '';
          proc.stderr.on('data', d => err += d.toString());
          proc.on('close', code => code === 0 ? resolve() : reject(new Error(err || `pip upgrade failed (${code})`)));
        });

        // Install requirements from bundled file
        const reqPath = PathHelper.getRequirementsPath();
        if (fs.existsSync(reqPath)) {
          logger.info('Installing CLIP service requirements', { requirements: reqPath });
          await new Promise((resolve, reject) => {
            const proc = spawn(venvPython, ['-m', 'pip', 'install', '-r', reqPath], { stdio: ['ignore', 'pipe', 'pipe'] });
            let err = '';
            proc.stderr.on('data', d => err += d.toString());
            proc.on('close', code => code === 0 ? resolve() : reject(new Error(err || `requirements install failed (${code})`)));
          });
        } else {
          logger.warn('requirements.txt not found in resources; attempting online install of minimal deps');
          await new Promise((resolve, reject) => {
            const pkgs = ['fastapi', 'uvicorn', 'transformers', 'torch', 'pillow', 'numpy'];
            const proc = spawn(venvPython, ['-m', 'pip', 'install', ...pkgs], { stdio: ['ignore', 'pipe', 'pipe'] });
            let err = '';
            proc.stderr.on('data', d => err += d.toString());
            proc.on('close', code => code === 0 ? resolve() : reject(new Error(err || `package install failed (${code})`)));
          });
        }
      }
    } catch (bootstrapError) {
      logger.error('Failed to bootstrap user venv', { error: bootstrapError.message });
      this.isStarting = false;
      throw bootstrapError;
    }
    
    logger.info('Starting CLIP similarity service...', { 
      python: venvPython,
      script: scriptPath 
    });

    try {
      // Spawn Python process using venv Python with -u flag for unbuffered output
      // This ensures we get real-time logs from the Python service
      this.process = spawn(venvPython, ['-u', scriptPath], {
        cwd: PathHelper.getUserDataDir(),
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env } // Pass environment variables
      });

      // Log stdout
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        logger.info('[CLIP Service]', { output: output.trim() });
        
        // Check if service is ready
        if (output.includes('Uvicorn running')) {
          this.isReady = true;
          logger.info('CLIP service is ready');
        }
      });

      // Log stderr
      this.process.stderr.on('data', (data) => {
        logger.error('[CLIP Service Error]', { error: data.toString() });
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        logger.info('CLIP service exited', { code, signal });
        this.process = null;
        this.isReady = false;
        this.isStarting = false;
      });

      // Handle process error
      this.process.on('error', (error) => {
        logger.error('Failed to start CLIP service', { error: error.message });
        this.process = null;
        this.isReady = false;
        this.isStarting = false;
      });

      // Wait for service to be ready (max 30 seconds)
      await this.waitForReady(30000);
      
      logger.info('CLIP service started successfully');
      this.isStarting = false;

    } catch (error) {
      logger.error('Error starting CLIP service', { error: error.message });
      this.isStarting = false;
      throw error;
    }
  }

  /**
   * Wait for service to be ready
   */
  async waitForReady(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(`${this.serviceUrl}/health`, { 
          timeout: 2000 
        });
        
        if (response.status === 200) {
          this.isReady = true;
          return true;
        }
      } catch (error) {
        // Service not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('CLIP service failed to start within timeout');
  }

  /**
   * Check if service is running
   */
  async checkHealth() {
    if (!this.process) {
      return false;
    }

    try {
      const response = await axios.get(`${this.serviceUrl}/health`, { 
        timeout: 2000 
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop the CLIP service
   */
  stop() {
    if (this.process) {
      logger.info('Stopping CLIP service...');
      this.process.kill('SIGTERM');
      this.process = null;
      this.isReady = false;
    }
  }

  /**
   * Restart the service
   */
  async restart() {
    this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.start();
  }
}

module.exports = ClipServiceManager;


