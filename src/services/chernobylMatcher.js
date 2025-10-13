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
    if (gps) console.log(`📍 With GPS: ${gps.latitude}, ${gps.longitude}`);
    
    const matches = [];
    const subjectLower = subject.toLowerCase().trim();
    
    // Extract key words from subject
    const subjectWords = subjectLower.split(/\s+/).filter(w => w.length >= 3);
    
    console.log(`   Subject words: [${subjectWords.join(', ')}]`);
    
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
      }
      // Contains subject as phrase
      else if (title.includes(subjectLower)) {
        textScore = 80;
        matchType = 'Title contains subject';
      }
      // Word overlap
      else {
        const matchedWords = subjectWords.filter(word => 
          searchableText.includes(word)
        );
        
        if (matchedWords.length > 0) {
          textScore = Math.min(70, (matchedWords.length / subjectWords.length) * 70);
          matchType = `${matchedWords.length}/${subjectWords.length} words matched`;
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

