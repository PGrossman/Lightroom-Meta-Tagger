// src/services/clipServiceManager.js
const { spawn } = require('child_process');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');

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
    logger.info('Starting CLIP similarity service...');

    const scriptPath = path.join(process.cwd(), 'similarity_service.py');

    try {
      // Spawn Python process
      this.process = spawn('python3', [scriptPath], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe']
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


