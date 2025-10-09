// src/services/xmpGenerator.js
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class XMPGenerator {
  constructor() {
    this.creator = "Philip Ethan Grossman";
  }

  /**
   * Generate XMP file from metadata + EXIF data
   */
  async generateXMP(imagePath, metadata, exifData) {
    try {
      // Extract year from EXIF date
      const year = this.extractYear(exifData.DateTimeOriginal);
      const copyright = `© ${year} Philip Ethan Grossman. All Rights Reserved.`;

      // Build XMP content
      const xmpContent = this.buildXMPContent({
        creator: this.creator,
        copyright: copyright,
        dateCreated: exifData.DateTimeOriginal,
        ...metadata
      });

      // Write .xmp file (same name as image, but .xmp extension)
      const xmpPath = this.getXMPPath(imagePath);
      await fs.writeFile(xmpPath, xmpContent, 'utf8');

      logger.info('XMP file generated', { imagePath, xmpPath });

      return xmpPath;
      
    } catch (error) {
      logger.error('Failed to generate XMP', { 
        imagePath, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get XMP file path for an image
   */
  getXMPPath(imagePath) {
    const parsed = path.parse(imagePath);
    return path.join(parsed.dir, `${parsed.name}.xmp`);
  }

  /**
   * Extract year from EXIF date
   */
  extractYear(dateTimeOriginal) {
    if (!dateTimeOriginal) {
      return new Date().getFullYear();
    }
    
    // Handle different date formats
    if (typeof dateTimeOriginal === 'string') {
      // EXIF format: "2025:10:08 12:34:56"
      const yearMatch = dateTimeOriginal.match(/^(\d{4})/);
      if (yearMatch) {
        return yearMatch[1];
      }
    }
    
    if (dateTimeOriginal instanceof Date) {
      return dateTimeOriginal.getFullYear();
    }
    
    return new Date().getFullYear();
  }

  /**
   * Build XMP XML content
   */
  buildXMPContent(data) {
    const timestamp = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="XMP Core 7.0.0">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/"
      xmlns:Iptc4xmpCore="http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/"
      xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">
      
      <!-- Title -->
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${this.escapeXML(data.title || '')}</rdf:li>
        </rdf:Alt>
      </dc:title>
      
      <!-- Description -->
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${this.escapeXML(data.description || '')}</rdf:li>
        </rdf:Alt>
      </dc:description>
      
      <!-- Creator -->
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${this.escapeXML(data.creator)}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      
      <!-- Rights/Copyright -->
      <dc:rights>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${this.escapeXML(data.copyright)}</rdf:li>
        </rdf:Alt>
      </dc:rights>
      
      <!-- Keywords -->
      <dc:subject>
        <rdf:Bag>
${this.formatKeywords(data.keywords || [])}
        </rdf:Bag>
      </dc:subject>
      
      <!-- Headline/Caption -->
      <photoshop:Headline>${this.escapeXML(data.caption || '')}</photoshop:Headline>
      
      <!-- Category -->
      <photoshop:Category>${this.escapeXML(data.category || '')}</photoshop:Category>
      
      <!-- Location -->
${this.formatLocation(data.location)}
      
      <!-- Metadata Date -->
      <xmp:MetadataDate>${timestamp}</xmp:MetadataDate>
      <xmp:ModifyDate>${timestamp}</xmp:ModifyDate>
      
      <!-- Alt Text for Accessibility -->
${data.altText ? `      <Iptc4xmpCore:AltTextAccessibility>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${this.escapeXML(data.altText)}</rdf:li>
        </rdf:Alt>
      </Iptc4xmpCore:AltTextAccessibility>` : ''}
      
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;
  }

  /**
   * Format keywords as RDF list items
   */
  formatKeywords(keywords) {
    if (!keywords || keywords.length === 0) return '';
    
    return keywords
      .map(kw => `          <rdf:li>${this.escapeXML(kw)}</rdf:li>`)
      .join('\n');
  }

  /**
   * Format location fields
   */
  formatLocation(location) {
    if (!location) return '';
    
    let xml = '';
    
    if (location.city) {
      xml += `      <photoshop:City>${this.escapeXML(location.city)}</photoshop:City>\n`;
    }
    
    if (location.state) {
      xml += `      <photoshop:State>${this.escapeXML(location.state)}</photoshop:State>\n`;
    }
    
    if (location.country) {
      xml += `      <photoshop:Country>${this.escapeXML(location.country)}</photoshop:Country>\n`;
    }
    
    return xml;
  }

  /**
   * Escape XML special characters
   */
  escapeXML(text) {
    if (typeof text !== 'string') return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

module.exports = XMPGenerator;

