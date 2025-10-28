const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class OllamaService {
  constructor(config) {
    this.endpoint = config.ollama?.endpoint || 'http://localhost:11434';
    this.model = config.ollama?.model || 'qwen2.5vl:latest';
    this.temperature = config.ollama?.temperature || 0.1;
    this.timeout = config.ollama?.timeout || 120000; // Increased for cloud model
    this.logger = logger;
  }

  /**
   * Get supported vision models
   * Includes both local and cloud models
   */
  static getSupportedVisionModels() {
    return [
      {
        name: 'qwen2.5vl:latest',
        displayName: 'Qwen 2.5-VL Latest (7B)',
        type: 'local',
        description: 'Fast, accurate, runs locally',
        recommended: true
      },
      {
        name: 'qwen2.5vl:7b',
        displayName: 'Qwen 2.5-VL 7B',
        type: 'local',
        description: 'Fast inference, good quality',
        recommended: false
      },
      {
        name: 'qwen2.5vl:32b',
        displayName: 'Qwen 2.5-VL 32B',
        type: 'local',
        description: 'Higher quality, slower',
        recommended: false
      },
      {
        name: 'qwen3-vl:235b-cloud',
        displayName: 'Qwen3-VL 235B Cloud ⭐',
        type: 'cloud',
        description: '235B parameters, cloud-hosted, most powerful',
        recommended: false,
        requiresAuth: true,
        contextLength: '256K (expandable to 1M)',
        capabilities: [
          'Visual agent',
          'Visual coding',
          'Advanced spatial reasoning',
          '33 language support',
          'Long context & video understanding'
        ]
      }
    ];
  }

  /**
   * Check if model is cloud-based
   */
  isCloudModel() {
    return this.model.includes('cloud');
  }

  /**
   * Check if Ollama service is running
   */
  async isRunning() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if the vision model is available
   */
  async isVisionModelAvailable() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`);
      const models = response.data.models || [];
      
      // Check if model is available locally or is a cloud model
      const isAvailable = models.some(model => model.name === this.model);
      
      if (!isAvailable && this.isCloudModel()) {
        // Cloud models may not show up in local list
        // Return true if it's a known cloud model
        return this.model === 'qwen3-vl:235b-cloud';
      }
      
      return isAvailable;
    } catch (error) {
      return false;
    }
  }

  /**
   * Encode image to base64
   */
  async encodeImage(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      return imageBuffer.toString('base64');
    } catch (error) {
      throw new Error(`Failed to encode image: ${error.message}`);
    }
  }

  /**
   * Analyze image with vision model for metadata generation
   * Supports both local and cloud models
   */
  async analyzeImageWithVision(imagePath, prompt) {
    try {
      // Convert RAW files to JPG first
      let imageToAnalyze = imagePath;
      
      const ext = path.extname(imagePath).toLowerCase();
      const isRawFile = ['.cr2', '.cr3', '.nef', '.arw', '.dng'].includes(ext);
      
      if (isRawFile) {
        this.logger.info('Converting RAW file to JPG for Ollama', { imagePath });
        
        // Use ImageProcessor to convert RAW → JPG
        const ImageProcessor = require('./imageProcessor');
        const imageProcessor = new ImageProcessor();
        
        try {
          // Extract preview JPG from RAW
          imageToAnalyze = await imageProcessor.extractPreview(imagePath);
          this.logger.info('RAW conversion successful', { 
            original: path.basename(imagePath),
            preview: path.basename(imageToAnalyze)
          });
        } catch (conversionError) {
          throw new Error(
            `Cannot analyze RAW file: ${conversionError.message}\n\n` +
            'RAW files must be converted to JPG first. Ensure dcraw or exiftool is installed.'
          );
        }
      }
      
      const imageBase64 = await this.encodeImage(imageToAnalyze);

      // Log which type of model we're using
      if (this.isCloudModel()) {
        this.logger.info('Using Qwen3-VL 235B Cloud model', { 
          model: this.model,
          timeout: this.timeout
        });
      } else {
        this.logger.info('Using local Ollama model', { 
          model: this.model 
        });
      }

      // Make API request (same format for both local and cloud)
      const response = await axios.post(
        `${this.endpoint}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          images: [imageBase64],
          stream: false,
          options: {
            temperature: this.temperature,
            num_predict: 1000
          }
        },
        {
          timeout: this.timeout
        }
      );

      // Parse the response
      const result = this.parseJSONResponse(response.data.response);
      return result;

    } catch (error) {
      // Provide helpful error messages for cloud model issues
      if (this.isCloudModel() && error.message.includes('timeout')) {
        throw new Error(
          `Cloud model timeout: The Qwen3-VL 235B cloud model took too long to respond.\n` +
          `This may be due to high demand. Try again in a few moments.`
        );
      } else if (this.isCloudModel() && error.message.includes('authentication')) {
        throw new Error(
          `Cloud model authentication required:\n` +
          `1. Run: ollama run qwen3-vl:235b-cloud\n` +
          `2. Follow the browser sign-in prompt\n` +
          `3. Once authenticated, try again`
        );
      }
      
      throw new Error(`Ollama vision analysis failed: ${error.message}`);
    }
  }

  /**
   * Parse JSON response from Ollama (handles markdown code blocks)
   */
  parseJSONResponse(responseText) {
    try {
      // Remove markdown code blocks if present
      let cleaned = responseText.trim();
      cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Find first { and last }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      
      const parsed = JSON.parse(cleaned);
      
      // Validate and provide defaults
      return {
        confidence: parsed.confidence || 75,
        uncertainFields: parsed.uncertainFields || [],
        title: parsed.title || '',
        description: parsed.description || '',
        caption: parsed.caption || '',
        keywords: parsed.keywords || [],
        category: parsed.category || '',
        sceneType: parsed.sceneType || '',
        location: parsed.location || { city: '', state: '', country: '', specificLocation: '' },
        mood: parsed.mood || '',
        subjects: parsed.subjects || [],
        hashtags: parsed.hashtags || [],
        altText: parsed.altText || ''
      };
      
    } catch (error) {
      this.logger.error('Failed to parse Ollama JSON response', { 
        error: error.message,
        response: responseText 
      });
      throw new Error(`JSON parsing failed: ${error.message}`);
    }
  }

  /**
   * Get available models from Ollama
   */
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.endpoint}/api/tags`);
      return response.data.models || [];
    } catch (error) {
      throw new Error(`Failed to get models: ${error.message}`);
    }
  }

  /**
   * Pull a model (works for both local and cloud models)
   */
  async pullModel(modelName) {
    try {
      this.logger.info('Pulling model', { modelName });
      
      if (modelName.includes('cloud')) {
        this.logger.info('Cloud model detected - may require authentication');
      }
      
      const response = await axios.post(
        `${this.endpoint}/api/pull`, 
        {
          name: modelName,
          stream: false
        },
        {
          timeout: 300000 // 5 minutes for cloud models
        }
      );
      
      return response.data;
    } catch (error) {
      throw new Error(`Failed to pull model: ${error.message}`);
    }
  }
}

module.exports = OllamaService;
