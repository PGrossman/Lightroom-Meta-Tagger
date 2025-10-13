const path = require('path');
const OllamaService = require('./ollamaService');
const GoogleVisionService = require('./googleVisionService');
const logger = require('../utils/logger');

class AIAnalysisService {
  constructor(config) {
    this.config = config; // Store config for strategy access
    this.ollamaService = new OllamaService(config);
    this.googleVisionService = new GoogleVisionService(config);
    this.confidenceThreshold = config.aiAnalysis?.confidenceThreshold || 85;
    this.logger = logger;
  }

  /**
   * Analyze image with Ollama (primary)
   */
  async analyzeWithOllama(imagePath, context) {
    this.logger.info('Analyzing with Ollama', { imagePath });
    
    // Use balanced strategy by default (can be configured)
    const promptStrategy = this.config?.aiAnalysis?.promptStrategy || 'balanced';
    const prompt = this.buildPrompt(context, promptStrategy);
    
    // For original strategy, add the enhanced prompt wrapper
    // For balanced strategy, confidence is already built-in
    const enhancedPrompt = promptStrategy === 'original' 
      ? `${prompt}

IMPORTANT: Include a "confidence" field (0-100) indicating how certain you are about this analysis.
Also include "uncertainFields" array listing any fields you're unsure about.
If you cannot determine a field with confidence, leave it as an empty string and add it to uncertainFields.`
      : prompt; // Balanced strategy already includes confidence requirements

    try {
      const result = await this.ollamaService.analyzeImageWithVision(imagePath, enhancedPrompt);
      
      // Parse and validate confidence
      if (!result.confidence || result.confidence < 0 || result.confidence > 100) {
        result.confidence = 75; // Default moderate confidence
      }
      
      result.provider = 'ollama';
      result.model = this.ollamaService.model;
      
      this.logger.info('Ollama analysis complete', { 
        confidence: result.confidence,
        uncertainFields: result.uncertainFields,
        strategy: promptStrategy 
      });
      
      return result;
      
    } catch (error) {
      this.logger.error('Ollama analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Analyze image with Google Vision (fallback)
   */
  async analyzeWithGoogleVision(imagePath, context) {
    this.logger.info('Analyzing with Google Vision', { imagePath });
    
    if (!this.googleVisionService.isConfigured()) {
      throw new Error('Google Vision API key not configured. Please add your API key in Settings.');
    }

    try {
      const result = await this.googleVisionService.analyzeImageForMetadata(imagePath, context);
      
      // Google Vision is generally very confident
      result.confidence = result.confidence || 98;
      result.provider = 'google_vision';
      
      this.logger.info('Google Vision analysis complete', { confidence: result.confidence });
      
      return result;
      
    } catch (error) {
      this.logger.error('Google Vision analysis failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Match AI results to Chernobyl database
   */
  async matchToDatabase(metadata, chernobylMatcher) {
    if (!chernobylMatcher) {
      return null;
    }

    try {
      // Get subject from metadata
      const subject = metadata.subjectDetection?.subject || metadata.title;
      if (!subject) {
        this.logger.warn('No subject found for database matching');
        return null;
      }
      
      // Get GPS if available
      const gps = metadata.gpsAnalysis?.latitude ? {
        latitude: metadata.gpsAnalysis.latitude,
        longitude: metadata.gpsAnalysis.longitude
      } : null;
      
      this.logger.info('Searching Chernobyl database', { subject, hasGPS: !!gps });
      
      const matches = await chernobylMatcher.findMatches(subject, gps);
      
      if (matches.length > 0 && matches[0].totalScore > 50) {
        this.logger.info('Database match found', {
          subject,
          match: matches[0].title,
          score: matches[0].totalScore,
          confidence: matches[0].confidence
        });
        
        return {
          matched: true,
          topMatch: matches[0],
          allMatches: matches
        };
      }
      
      this.logger.info('No strong database matches found', { subject });
      return { matched: false, allMatches: matches };
      
    } catch (error) {
      this.logger.error('Database matching failed', { error: error.message });
      return null;
    }
  }

  /**
   * Main analysis method with automatic fallback logic
   */
  async analyzeCluster(cluster, existingData = {}, forceProvider = null, chernobylMatcher = null) {
    const context = this.buildContext(cluster, existingData);
    const repPath = cluster.mainRep.representativePath;

    let result;

    if (forceProvider === 'google') {
      // User explicitly requested Google Vision
      result = await this.analyzeWithGoogleVision(repPath, context);
    } else {
      // Start with Ollama
      result = await this.analyzeWithOllama(repPath, context);
      
      // Check if confidence meets threshold
      if (result.confidence < this.confidenceThreshold) {
        result.needsReview = true;
        result.lowConfidenceWarning = `Analysis confidence (${result.confidence}%) is below threshold (${this.confidenceThreshold}%)`;
        
        this.logger.warn('Low confidence analysis', {
          confidence: result.confidence,
          threshold: this.confidenceThreshold
        });
      }
    }

    // ✅ NEW: Try database matching if enabled
    if (chernobylMatcher) {
      this.logger.info('Attempting Chernobyl database matching...');
      const dbMatch = await this.matchToDatabase(result, chernobylMatcher);
      
      if (dbMatch) {
        result.databaseMatch = dbMatch;
        
        // Enrich metadata with high-confidence matches
        if (dbMatch.matched && dbMatch.topMatch.totalScore > 80) {
          result.databaseEnriched = true;
          this.logger.info('Metadata enriched from database', {
            original: result.title,
            matched: dbMatch.topMatch.title,
            score: dbMatch.topMatch.totalScore
          });
        }
      }
    }

    return {
      cluster: cluster,
      metadata: result,
      affectedImages: this.getAllAffectedPaths(cluster),
      imageCount: this.countTotalImages(cluster),
      breakdown: {
        parents: 1 + (cluster.similarReps?.length || 0),
        children: this.countChildren(cluster)
      }
    };
  }

  /**
   * Build context from existing data
   */
  buildContext(cluster, existingData) {
    const folderPath = path.dirname(cluster.mainRep.representativePath);
    
    return {
      existingKeywords: cluster.mainRep.keywords || [],
      gps: cluster.mainRep.gps || null,
      folderPath: folderPath,
      folderName: path.basename(folderPath),
      totalImages: this.countTotalImages(cluster),
      imageCount: {
        parents: 1 + (cluster.similarReps?.length || 0),
        children: this.countChildren(cluster)
      }
    };
  }

  /**
   * Build LLM prompt with context
   * @param {Object} context - Context object with metadata
   * @param {String} strategy - 'original' or 'balanced' (default: 'balanced')
   * @returns {String} - Formatted prompt
   */
  buildPrompt(context, strategy = 'balanced') {
    if (strategy === 'original') {
      return this.buildPromptOriginal(context);
    } else {
      return this.buildPromptBalanced(context);
    }
  }

  /**
   * ORIGINAL PROMPT STRATEGY (context-first, keywords prioritized)
   * Kept for backward compatibility
   */
  buildPromptOriginal(context) {
    let prompt = `You are analyzing a photograph to generate comprehensive metadata for a professional photography catalog.

CONTEXT INFORMATION:`;

    if (context.existingKeywords?.length > 0) {
      prompt += `\n- Existing keywords from folder structure: ${context.existingKeywords.join(', ')}`;
    }
    
    if (context.gps) {
      prompt += `\n- GPS Coordinates: ${context.gps.latitude}, ${context.gps.longitude} (Use this to help identify the location)`;
    }
    
    if (context.folderName) {
      prompt += `\n- Folder name: ${context.folderName}`;
    }
    
    prompt += `\n- This metadata will apply to ${context.totalImages} images in this group`;

    prompt += `

CRITICAL INSTRUCTIONS FOR KEYWORDS:
- Focus on CONCRETE, SPECIFIC, TECHNICAL keywords about what is VISIBLE in the image
- Include: specific equipment/models (aircraft types, vehicle models, camera gear), locations, landmarks, architectural features, specific activities
- Technical details: "F-18 Hornet", "Boeing 747", "Canon EOS", "Golden Gate Bridge", "Gothic architecture"
- Avoid abstract concepts like: "precision", "teamwork", "excellence", "power", "beauty", "mood", "atmosphere"
- Avoid generic descriptors like: "professional", "dynamic", "stunning", "impressive"
- For aircraft: Include specific model/type, military branch if applicable (e.g., "F-18 Super Hornet", "US Navy", "Blue Angels")
- For locations: Include specific place names, not just "city" or "landscape"
- For events: Include specific event names, years, or identifying details
- Action-focused: "aerial refueling", "formation flying", "sunset landing" (not "teamwork" or "coordination")
- Visual subjects: "contrail", "afterburner", "nose art", "cockpit canopy" (specific parts visible)

BAD KEYWORDS (too abstract/generic):
❌ "precision", "teamwork", "excellence", "power", "dynamic", "professional", "stunning", "impressive", "beauty", "skill", "coordination", "synchronization"

GOOD KEYWORDS (specific/technical/visible):
✅ "F-18 Super Hornet", "Blue Angels", "US Navy", "delta formation", "smoke trails", "military aviation", "jet fighter", "afterburner", "air show", "formation flight"

KEYWORD PRIORITY (in order of importance):
1. Specific equipment/models/types visible in image
2. Specific locations, landmarks, place names
3. Technical features, parts, components visible
4. Specific activities or actions happening
5. Military branch, organization, event name (if applicable)
6. Time period indicators (if identifiable)
7. Environmental/weather conditions (only if notable and specific)

For military aviation specifically:
- Always include: aircraft model, military branch, squadron/unit if identifiable
- Technical details: "afterburner", "vapor trails", "weapons systems", "landing gear"
- Mission types: "air-to-air refueling", "carrier landing", "tactical formation"
- NOT: "power", "precision", "excellence", "teamwork"

Respond with ONLY valid JSON in this exact format:
{
  "confidence": 85,
  "uncertainFields": [],
  "title": "Short, descriptive title (10-15 words)",
  "description": "Detailed 2-3 sentence description (150-300 characters)",
  "caption": "Engaging social media caption (100-200 characters)",
  "keywords": [
    "specific technical keyword 1",
    "specific model/type 2",
    "visible subject 3",
    "location name 4",
    "specific activity 5",
    "technical feature 6",
    "equipment type 7"
  ],
  "category": "Main category (e.g., Aviation, Architecture, Nature, Sports)",
  "sceneType": "Specific scene type (e.g., Air Show, Urban Landscape, Wildlife Close-up)",
  "location": {
    "city": "City name or empty string",
    "state": "State/Province or empty string",
    "country": "Country name or empty string",
    "specificLocation": "Specific place name or empty string"
  },
  "mood": "Overall mood/atmosphere",
  "subjects": ["main subject 1", "main subject 2"],
  "hashtags": ["#specifictag1", "#technicaltag2", "#locationtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8", "#hashtag9", "#hashtag10"],
  "altText": "Accessibility description for screen readers (concise, descriptive)"
}

IMPORTANT: 
- confidence should be 0-100 based on how certain you are
- Add field names to uncertainFields if you're not confident about them
- Use GPS coordinates to help identify location if provided
- Incorporate existing keywords naturally if they're relevant and specific enough
- Always prioritize what is ACTUALLY VISIBLE over abstract concepts`;

    return prompt;
  }

  /**
   * BALANCED PROMPT STRATEGY (visual priority + full context)
   * Best practice from VLM Tester - Provides structured output with confidence scores
   */
  buildPromptBalanced(context) {
    // Build metadata context if available
    let metadataContext = '';
    if (context.existingKeywords && context.existingKeywords.length > 0) {
      metadataContext += `\nFolder keywords: ${context.existingKeywords.join(', ')}`;
    }
    if (context.folderName) {
      metadataContext += `\nFolder name: ${context.folderName}`;
    }
    if (context.gps) {
      metadataContext += `\nGPS: ${context.gps.latitude}, ${context.gps.longitude}`;
    }

    const prompt = `You are analyzing a photograph to generate comprehensive metadata for a professional photography catalog.

${metadataContext ? `CONTEXT:${metadataContext}\n` : ''}
ANALYZE THIS IMAGE AND PROVIDE:

1. **Subject Detection**
   - Identify the primary subject in the image
   - Provide confidence score (0-100%) for subject identification

2. **Metadata Generation**
   - Title: Short, descriptive title (10-15 words)
   - Description: Detailed 2-3 sentence description (150-300 characters)
   - Keywords: 7-10 specific, technical keywords (avoid generic terms like "blue sky")
   - Category: Main subject category
   - Mood: Overall mood/atmosphere of the image
   - Scene Type: Type of scene (landscape, portrait, architecture, etc.)

3. **Location Information**
   - City, State/Province, Country
   - Specific location name (if identifiable)
${context.gps ? `   - GPS validation: Does the image match GPS coordinates ${context.gps.latitude}, ${context.gps.longitude}? (AGREE/DISAGREE with reasoning)` : `   - GPS prediction: Estimate coordinates based on visual content (if possible)`}

4. **Social Media**
   - Caption: Engaging 100-200 character caption
   - Hashtags: 10-15 relevant hashtags
   - Alt Text: Concise accessibility description

CRITICAL REQUIREMENTS:
- Subject confidence must be realistic (60-90% typical range, 100% only if absolutely certain)
- Keywords must be specific technical/historical terms, NOT generic descriptions
- GPS validation reasoning must reference specific visual elements
- All fields must be filled with meaningful content

RESPONSE FORMAT (JSON only, no markdown):
{
  "subjectDetection": {
    "subject": "Primary subject description",
    "confidence": 85
  },
  "title": "Descriptive title",
  "description": "2-3 sentence detailed description",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"],
  "category": "Main category",
  "mood": "Image mood",
  "sceneType": "Scene type",
  "location": {
    "city": "City name",
    "state": "State/Province",
    "country": "Country",
    "specificLocation": "Specific location name"
  },
  ${context.gps ? `"gpsAnalysis": {
    "validation": "AGREE or DISAGREE",
    "validationReasoning": "Detailed explanation of why GPS matches or doesn't match visual content",
    "latitude": ${context.gps.latitude},
    "longitude": ${context.gps.longitude}
  },` : `"gpsAnalysis": {
    "latitude": null,
    "longitude": null,
    "predictionConfidence": 0,
    "predictionReasoning": "Cannot determine location from visual content"
  },`}
  "caption": "Social media ready caption (100-200 chars)",
  "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5", "#hashtag6", "#hashtag7", "#hashtag8", "#hashtag9", "#hashtag10"],
  "altText": "Accessibility description",
  "confidence": 85,
  "uncertainFields": []
}

DO NOT include markdown code blocks, explanations, or any text outside the JSON object.`;

    return prompt;
  }

  /**
   * Count total images in cluster (parents + children)
   */
  countTotalImages(cluster) {
    const parents = 1 + (cluster.similarReps?.length || 0);
    const children = this.countChildren(cluster);
    return parents + children;
  }

  /**
   * Count all child images (bracketed + derivatives)
   */
  countChildren(cluster) {
    let total = 0;
    
    // Main rep's bracketed images (exclude the rep itself)
    if (cluster.mainRep.isBracketed && cluster.mainRep.imageCount) {
      total += cluster.mainRep.imageCount - 1;
    }
    
    // Similar reps' bracketed images
    if (cluster.similarReps) {
      cluster.similarReps.forEach(sim => {
        if (sim.cluster.isBracketed && sim.cluster.imageCount) {
          total += sim.cluster.imageCount;
        }
      });
    }
    
    // TODO: Add derivatives count when derivative tracking is implemented
    
    return total;
  }

  /**
   * Get all image paths that will receive this XMP
   */
  getAllAffectedPaths(cluster) {
    const paths = [];
    
    // Add main representative
    paths.push(cluster.mainRep.representativePath);
    
    // Add main rep's bracketed images
    if (cluster.mainRep.imagePaths) {
      cluster.mainRep.imagePaths.forEach(imgPath => {
        if (imgPath !== cluster.mainRep.representativePath) {
          paths.push(imgPath);
        }
      });
    }
    
    // Add similar representatives and their images
    if (cluster.similarReps) {
      cluster.similarReps.forEach(sim => {
        paths.push(sim.cluster.representativePath);
        
        if (sim.cluster.imagePaths) {
          sim.cluster.imagePaths.forEach(imgPath => {
            if (imgPath !== sim.cluster.representativePath) {
              paths.push(imgPath);
            }
          });
        }
      });
    }
    
    // TODO: Add derivatives when implemented
    
    // Remove duplicates
    return [...new Set(paths)];
  }
}

module.exports = AIAnalysisService;
