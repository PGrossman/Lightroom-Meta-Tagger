const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

class ChernobylMatcher {
  constructor(csvPath = null) {
    this.csvPath = csvPath;
    this.objects = [];
    this.loaded = false;
    
    // Setup log file in z_Logs and traces folder
    const logDir = path.join(__dirname, '../../z_Logs and traces');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, 'chernobyl-matcher.log');
    
    // Clear log file on initialization (fresh log for each session)
    fs.writeFileSync(this.logFilePath, '');
    
    // ✅ ENHANCEMENT: Define significant words and their categories
    this.significantWords = {
      structures: ['statue', 'monument', 'memorial', 'sculpture', 'bust', 'building', 'tower', 'palace', 'cinema', 'theater', 'theatre'],
      locations: ['square', 'park', 'street', 'avenue', 'plaza', 'place'],
      specific: ['prometheus', 'lenin', 'reactor', 'duga', 'avanhard', 'energetik', 'pripyat', 'polissya', 'sarcophagus', 'shelter'],
      generic: ['chernobyl', 'building', 'area', 'zone']
    };
    
    // ✅ ENHANCEMENT: Category relevance mapping
    this.categoryRelevance = {
      'statue': ['statue', 'memorial', 'monument', 'sculpture', 'bust'],
      'monument': ['memorial', 'monument', 'statue', 'sculpture'],
      'memorial': ['memorial', 'monument', 'statue'],
      'cinema': ['cinema', 'theater', 'theatre', 'cultural'],
      'palace': ['palace', 'cultural', 'culture'],
      'square': ['square', 'plaza', 'place'],
      'building': ['building', 'structure'],
      'reactor': ['reactor', 'nuclear', 'power', 'unit'],
      'hospital': ['hospital', 'medical', 'health'],
      'school': ['school', 'education'],
      'hotel': ['hotel', 'hostel', 'accommodation']
    };
    
    this.log('🗂️  ChernobylMatcher initialized');
    if (csvPath) {
      this.log(`   CSV path: ${this.csvPath}`);
    }
  }
  
  /**
   * Log to both console and file
   */
  log(message) {
    console.log(message);
    const timestamp = new Date().toISOString();
    fs.appendFileSync(this.logFilePath, `${timestamp} ${message}\n`);
  }

  /**
   * ✅ ENHANCEMENT: Determine if a word is significant (not generic)
   */
  isSignificantWord(word) {
    const lower = word.toLowerCase();
    for (const category of ['structures', 'locations', 'specific']) {
      if (this.significantWords[category].includes(lower)) {
        return true;
      }
    }
    return false;
  }

  /**
   * ✅ ENHANCEMENT: Determine if a word is generic
   */
  isGenericWord(word) {
    return this.significantWords.generic.includes(word.toLowerCase());
  }

  /**
   * ✅ ENHANCEMENT: Calculate category relevance bonus
   */
  getCategoryBonus(subjectWords, categories, tags) {
    let bonus = 0;
    const categoryText = `${categories} ${tags}`.toLowerCase();
    
    for (const word of subjectWords) {
      const wordLower = word.toLowerCase();
      if (this.categoryRelevance[wordLower]) {
        for (const relatedCategory of this.categoryRelevance[wordLower]) {
          if (categoryText.includes(relatedCategory)) {
            bonus += 15;
            this.log(`   🎯 Category relevance: "${word}" matches "${relatedCategory}" (+15)`);
            break; // Only count once per word
          }
        }
      }
    }
    
    return Math.min(bonus, 45); // Cap at 45 points
  }

  /**
   * ✅ ENHANCEMENT: Extract phrases from subject
   */
  extractPhrases(text) {
    const phrases = [];
    const words = text.split(/\s+/);
    
    // Add full text if 2+ words
    if (words.length >= 2) {
      phrases.push(text);
    }
    
    // Extract sub-phrases (consecutive words)
    for (let i = 0; i < words.length - 1; i++) {
      for (let j = i + 2; j <= words.length; j++) {
        const phrase = words.slice(i, j).join(' ');
        if (phrase.length >= 5) { // Min 5 chars
          phrases.push(phrase);
        }
      }
    }
    
    return [...new Set(phrases)]; // Remove duplicates
  }

  async loadDatabase() {
    if (this.loaded) return;
    
    if (!this.csvPath) {
      throw new Error('CSV path not configured');
    }
    
    this.log('📂 Loading Chernobyl object database...');
    this.log(`   Looking for CSV at: ${this.csvPath}`);
    
    // Check if file exists
    if (!fs.existsSync(this.csvPath)) {
      throw new Error(`CSV file not found at: ${this.csvPath}`);
    }
    
    try {
      const csvContent = fs.readFileSync(this.csvPath, 'utf8');
      
      return new Promise((resolve, reject) => {
        Papa.parse(csvContent, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            this.objects = results.data.filter(obj => 
              obj['English Title'] && obj['English Title'].trim() !== ''
            );
            this.loaded = true;
            this.log(`✅ Loaded ${this.objects.length} Chernobyl objects`);
            resolve();
          },
          error: (error) => {
            console.error('❌ Error parsing CSV:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('❌ Error reading CSV file:', error);
      throw error;
    }
  }

  /**
   * Find objects matching VLM output
   */
  async findMatches(subject, gps = null) {
    if (!this.loaded) await this.loadDatabase();
    
    this.log(`\n🔍 Searching for: "${subject}"`);
    this.log(`   Subject length: ${subject.length}`);
    this.log(`   Subject type: ${typeof subject}`);
    if (gps) this.log(`📍 With GPS: ${gps.latitude}, ${gps.longitude}`);
    
    const matches = [];
    const subjectLower = subject.toLowerCase().trim();
    
    // Extract key words from subject with improved parsing
    // Split on whitespace and extract numbers/words from compound terms
    const rawWords = subjectLower.split(/\s+/);
    const subjectWords = [];
    
    rawWords.forEach(word => {
      // Extract individual words/numbers from compound terms
      // e.g., "1-4" -> ["1", "4"], "reactor-4" -> ["reactor", "4"]
      const parts = word.split(/[-–—/]/); // Split on hyphens, dashes, slashes
      parts.forEach(part => {
        const cleaned = part.trim();
        // Keep words >= 3 chars OR single digits/numbers (for "1", "2", "3", "4")
        if (cleaned.length >= 3 || /^\d+$/.test(cleaned)) {
          subjectWords.push(cleaned);
        }
      });
    });
    
    // Remove duplicates
    const uniqueWords = [...new Set(subjectWords)];
    
    this.log(`   Subject (lowercase): "${subjectLower}"`);
    this.log(`   Subject words: [${uniqueWords.join(', ')}]`);
    this.log(`   Total database entries: ${this.objects.length}`);
    
    for (const obj of this.objects) {
      const title = (obj['English Title'] || '').toLowerCase().trim();
      const categories = (obj['English Categories'] || '').toLowerCase().trim();
      const tags = (obj['English Tags'] || '').toLowerCase().trim();
      
      if (!title) continue;
      
      const searchableText = `${title} ${categories} ${tags}`;
      
      let textScore = 0;
      let matchType = '';
      
      // Exact title match
      if (title === subjectLower) {
        textScore = 100;
        matchType = 'Exact title match';
        this.log(`   ✅ EXACT match: "${title}"`);
      }
      // Contains subject as phrase
      else if (title.includes(subjectLower)) {
        textScore = 80;
        matchType = 'Title contains subject';
        this.log(`   ✅ CONTAINS match: "${title}"`);
      }
      // ✅ ENHANCEMENT: Phrase matching first
      else {
        // Try phrase matching first
        const phrases = this.extractPhrases(subjectLower);
        let maxPhraseScore = 0;
        let bestPhraseMatch = '';
        
        for (const phrase of phrases) {
          if (phrase.length < 5) continue;
          
          if (title.includes(phrase)) {
            const phraseScore = 95 - (title.length - phrase.length) * 2;
            if (phraseScore > maxPhraseScore) {
              maxPhraseScore = Math.max(phraseScore, 85);
              bestPhraseMatch = phrase;
              matchType = `Title contains phrase "${phrase}"`;
              this.log(`   ✅ PHRASE match: "${title}" contains "${phrase}" - Score: ${Math.round(maxPhraseScore)}`);
            }
          }
          
          if (categories.includes(phrase) || tags.includes(phrase)) {
            const phraseScore = 75;
            if (phraseScore > maxPhraseScore) {
              maxPhraseScore = phraseScore;
              bestPhraseMatch = phrase;
              matchType = `Categories/tags contain phrase "${phrase}"`;
              this.log(`   ✅ CATEGORY PHRASE match: "${phrase}" - Score: ${Math.round(maxPhraseScore)}`);
            }
          }
        }
        
        if (maxPhraseScore > 0) {
          textScore = maxPhraseScore;
        }
        
        // ✅ ENHANCEMENT: Enhanced word matching (if no phrase match)
        if (textScore === 0) {
          const titleWords = title.split(/\s+/).filter(w => w.length >= 3);
          const matchedWords = titleWords.filter(w => uniqueWords.includes(w));
          
          if (matchedWords.length > 0) {
            // Base score calculation
            const overlapRatio = matchedWords.length / Math.max(titleWords.length, uniqueWords.length);
            textScore = overlapRatio * 60;
            
            // Count significant vs generic matched words
            const matchedSignificant = matchedWords.filter(w => this.isSignificantWord(w));
            const matchedGeneric = matchedWords.filter(w => this.isGenericWord(w));
            
            this.log(`   ⚠️ WORD match: "${title}" (${matchedWords.join(', ')}) - baseScore: ${Math.round(textScore)}`);
            
            // ✅ ENHANCEMENT: Combo bonus for multiple significant words
            if (matchedSignificant.length >= 2) {
              const comboBonus = 20 + (matchedSignificant.length - 2) * 10;
              textScore += comboBonus;
              this.log(`   🎯 SIGNIFICANT WORD COMBO: ${matchedSignificant.length} words (${matchedSignificant.join(', ')}) - Bonus: +${comboBonus}`);
              matchType = `${matchedSignificant.length}/${uniqueWords.length} significant words match`;
            }
            // Single significant word boost
            else if (matchedSignificant.length === 1) {
              textScore += 20;
              this.log(`   🎯 SIGNIFICANT WORD BOOST: "${title}" (${matchedSignificant[0]}) - Score: ${Math.round(textScore - 20)} → ${Math.round(textScore)}`);
              matchType = `1/${uniqueWords.length} words (significant match)`;
            }
            // Generic word penalty (only if ONLY generic words match)
            else if (matchedGeneric.length > 0 && matchedSignificant.length === 0) {
              this.log(`   ⚠️ GENERIC WORD PENALTY: Capped at 25 points`);
              textScore = Math.min(textScore, 25);
              matchType = `Generic word: ${matchedGeneric.join(', ')}`;
            }
            else {
              matchType = `Word overlap: ${matchedWords.join(', ')}`;
            }
            
            // ✅ ENHANCEMENT: Category relevance bonus
            const categoryBonus = this.getCategoryBonus(uniqueWords, categories, tags);
            if (categoryBonus > 0) {
              textScore += categoryBonus;
              matchType += ` [+${categoryBonus} category bonus]`;
            }
          }
        }
      }
      
      // GPS scoring
      let gpsScore = 0;
      let distance = null;
      
      if (gps && obj['LAT/LON']) {
        const coords = obj['LAT/LON'].split(',').map(s => parseFloat(s.trim()));
        if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
          distance = this.calculateDistance(
            gps.latitude, gps.longitude,
            coords[0], coords[1]
          );
          
          // Score based on distance (max 30 points)
          if (distance < 0.1) gpsScore = 30;        // < 100m
          else if (distance < 0.5) gpsScore = 25;   // < 500m
          else if (distance < 1) gpsScore = 20;     // < 1km
          else if (distance < 2) gpsScore = 15;     // < 2km
          else if (distance < 5) gpsScore = 10;     // < 5km
          else if (distance < 10) gpsScore = 5;     // < 10km
        }
      }
      
      const totalScore = textScore + gpsScore;
      
      // Debug: Log all potential matches with scores
      if (textScore > 0 || gpsScore > 0) {
        if (totalScore >= 30) {
          this.log(`   ✅ ADDED to matches: "${title}" (total: ${Math.round(totalScore)}, text: ${Math.round(textScore)}, gps: ${Math.round(gpsScore)})`);
        } else {
          this.log(`   ❌ FILTERED OUT: "${title}" (total: ${Math.round(totalScore)}, text: ${Math.round(textScore)}, gps: ${Math.round(gpsScore)}) - Below threshold`);
        }
      }
      
      // Only include if score is meaningful
      if (totalScore >= 30) {
        matches.push({
          objectId: obj['Object ID'],
          title: obj['English Title'],
          categories: obj['English Categories'],
          tags: obj['English Tags'],
          url: obj['URL'],
          nearbyPlaces: obj['Nearby Places English'],
          latitude: obj['LAT/LON']?.split(',')[0]?.trim(),
          longitude: obj['LAT/LON']?.split(',')[1]?.trim(),
          textScore: Math.round(textScore),
          gpsScore: Math.round(gpsScore),
          totalScore: Math.round(totalScore),
          distance: distance,
          matchType: matchType,
          confidence: this.calculateConfidence(totalScore, matchType)
        });
      }
    }
    
    // Sort by total score descending
    matches.sort((a, b) => b.totalScore - a.totalScore);
    
    // Return top 5 matches
    const topMatches = matches.slice(0, 5);
    
    if (topMatches.length > 0) {
      this.log(`✅ Found ${topMatches.length} matches (top score: ${topMatches[0].totalScore})`);
    } else {
      this.log(`⚠️  No matches found`);
    }
    
    return topMatches;
  }

  /**
   * Calculate distance between two GPS coordinates (Haversine formula)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Calculate confidence level based on score
   */
  /**
   * ✅ ENHANCEMENT: Improved confidence thresholds
   */
  calculateConfidence(totalScore, matchType) {
    // Boost confidence for multiple significant word matches
    const hasMultipleSignificant = matchType && matchType.includes('significant words match');
    const hasCategoryBonus = matchType && matchType.includes('category bonus');
    const hasPhraseMatch = matchType && matchType.includes('phrase');
    
    if (totalScore >= 130) return 'Exact Match';
    if (totalScore >= 110) return 'Very High';
    
    // Lower threshold for high confidence if phrase match or multiple significant words
    if (totalScore >= 75 && (hasMultipleSignificant || hasCategoryBonus || hasPhraseMatch)) return 'High';
    if (totalScore >= 80) return 'High';
    
    // Medium confidence for decent multi-word matches
    if (totalScore >= 55 && hasMultipleSignificant) return 'Medium';
    if (totalScore >= 50) return 'Medium';
    
    if (totalScore >= 30) return 'Low';
    return 'Very Low';
  }
}

module.exports = ChernobylMatcher;

