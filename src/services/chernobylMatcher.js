const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

class ChernobylMatcher {
  constructor(csvPath = null) {
    this.csvPath = csvPath;
    this.objects = [];
    this.loaded = false;
    
    console.log(`🗂️  ChernobylMatcher initialized`);
    if (csvPath) {
      console.log(`   CSV path: ${this.csvPath}`);
    }
  }

  async loadDatabase() {
    if (this.loaded) return;
    
    if (!this.csvPath) {
      throw new Error('CSV path not configured');
    }
    
    console.log('📂 Loading Chernobyl object database...');
    console.log(`   Looking for CSV at: ${this.csvPath}`);
    
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
            console.log(`✅ Loaded ${this.objects.length} Chernobyl objects`);
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
    
    console.log(`\n🔍 Searching for: "${subject}"`);
    console.log(`   Subject length: ${subject.length}`);
    console.log(`   Subject type: ${typeof subject}`);
    if (gps) console.log(`📍 With GPS: ${gps.latitude}, ${gps.longitude}`);
    
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
    
    console.log(`   Subject (lowercase): "${subjectLower}"`);
    console.log(`   Subject words: [${uniqueWords.join(', ')}]`);
    console.log(`   Total database entries: ${this.objects.length}`);
    
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
        console.log(`   ✅ EXACT match: "${title}"`);
      }
      // Contains subject as phrase
      else if (title.includes(subjectLower)) {
        textScore = 80;
        matchType = 'Title contains subject';
        console.log(`   ✅ CONTAINS match: "${title}"`);
      }
      // Word overlap
      else {
        const matchedWords = uniqueWords.filter(word => 
          searchableText.includes(word)
        );
        
        if (matchedWords.length > 0) {
          textScore = Math.min(70, (matchedWords.length / uniqueWords.length) * 70);
          matchType = `${matchedWords.length}/${uniqueWords.length} words matched`;
          console.log(`   ⚠️ WORD match: "${title}" (${matchedWords.join(', ')}) - textScore: ${Math.round(textScore)}`);
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
          console.log(`   ✅ ADDED to matches: "${title}" (total: ${Math.round(totalScore)}, text: ${Math.round(textScore)}, gps: ${Math.round(gpsScore)})`);
        } else {
          console.log(`   ❌ FILTERED OUT: "${title}" (total: ${Math.round(totalScore)}, text: ${Math.round(textScore)}, gps: ${Math.round(gpsScore)}) - Below threshold`);
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
          confidence: this.calculateConfidence(totalScore, gps !== null)
        });
      }
    }
    
    // Sort by total score descending
    matches.sort((a, b) => b.totalScore - a.totalScore);
    
    // Return top 5 matches
    const topMatches = matches.slice(0, 5);
    
    if (topMatches.length > 0) {
      console.log(`✅ Found ${topMatches.length} matches (top score: ${topMatches[0].totalScore})`);
    } else {
      console.log(`⚠️  No matches found`);
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
  calculateConfidence(totalScore, hasGPS) {
    if (totalScore >= 90) return 'Very High';
    if (totalScore >= 70) return 'High';
    if (totalScore >= 50) return 'Medium';
    if (totalScore >= 30) return 'Low';
    return 'Very Low';
  }
}

module.exports = ChernobylMatcher;

