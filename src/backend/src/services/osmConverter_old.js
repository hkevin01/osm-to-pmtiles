const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class OSMConverter extends EventEmitter {
  constructor() {
    super();
    this.dataDir = '/app/data';
    this.tempDir = '/app/data/temp';
    this.tilesDir = '/app/data/tiles';
    this.pmtilesDir = '/app/data/pmtiles';
  }

  async initialize() {
    // Ensure directories exist
    await this.ensureDirectories();
  }

  async ensureDirectories() {
    const dirs = [this.dataDir, this.tempDir, this.tilesDir, this.pmtilesDir];
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        logger.error(`Failed to create directory ${dir}:`, error);
        throw error;
      }
    }
  }

  async validateOSMFile(filePath) {
    try {
      // Check if file exists and is readable
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      // Check file size (minimum 1KB, maximum 10GB)
      const minSize = 1024; // 1KB
      const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
      
      if (stats.size < minSize) {
        throw new Error('File too small to be a valid OSM file');
      }
      
      if (stats.size > maxSize) {
        throw new Error('File too large (max 10GB supported)');
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (!ext.includes('.pbf') && !ext.includes('.osm')) {
        throw new Error('Invalid file format. Expected .pbf or .osm file');
      }

      return {
        valid: true,
        size: stats.size,
        format: ext.includes('.pbf') ? 'pbf' : 'osm'
      };
    } catch (error) {
      logger.error('OSM file validation failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }
        valid: true,
        size: stats.size,
        sizeFormatted: this.formatFileSize(stats.size),
        lastModified: stats.mtime
      };
    } catch (error) {
      logger.error('PBF validation failed:', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Check if file is valid PBF format
   * @param {Buffer} buffer - File buffer
   * @returns {boolean} Is valid PBF
   */
  isPBFFormat(buffer) {
    // Basic PBF magic number check
    // PBF files contain protobuf messages with specific patterns
    return buffer.length > 8 && (
      buffer[0] === 0x0A || // Common protobuf start
      buffer.toString().includes('OSMHeader') ||
      buffer.toString().includes('OSMData')
    );
  }

  /**
   * Convert OSM PBF to PMTiles
   * @param {string} inputPath - Path to input PBF file
   * @param {Object} options - Conversion options
   * @returns {Promise<Object>} Conversion result
   */
  async convertToPMTiles(inputPath, options = {}) {
    const jobId = uuidv4();
    const outputPath = path.join(this.tilesDir, `${jobId}.pmtiles`);
    const tempMbtiles = path.join(this.tempDir, `${jobId}.mbtiles`);

    try {
      logger.info(`Starting conversion job ${jobId} for ${inputPath}`);

      // Step 1: Convert PBF to MBTiles using tippecanoe
      await this.convertToMBTiles(inputPath, tempMbtiles, options);

      // Step 2: Convert MBTiles to PMTiles
      await this.convertMBTilesToPMTiles(tempMbtiles, outputPath);

      // Step 3: Generate metadata
      const metadata = await this.generateMetadata(outputPath, inputPath);

      // Cleanup temporary files
      await fs.remove(tempMbtiles);

      logger.info(`Conversion job ${jobId} completed successfully`);

      return {
        success: true,
        jobId,
        outputPath,
        metadata
      };
    } catch (error) {
      logger.error(`Conversion job ${jobId} failed:`, error);
      
      // Cleanup on failure
      await this.cleanup([tempMbtiles, outputPath]);
      
      throw error;
    }
  }

  /**
   * Convert PBF to MBTiles using tippecanoe
   * @param {string} inputPath - Input PBF path
   * @param {string} outputPath - Output MBTiles path
   * @param {Object} options - Conversion options
   */
  async convertToMBTiles(inputPath, outputPath, options) {
    const {
      minZoom = 0,
      maxZoom = 14,
      layers = [],
      simplification = 'auto'
    } = options;

    // Build tippecanoe command
    let command = `tippecanoe -o "${outputPath}" -z ${maxZoom} -Z ${minZoom}`;
    
    // Add layer specifications if provided
    if (layers.length > 0) {
      const layerSpecs = layers.map(layer => `--include="${layer}"`).join(' ');
      command += ` ${layerSpecs}`;
    }

    // Add simplification options
    if (simplification !== 'auto') {
      command += ` --simplification=${simplification}`;
    }

    // Add other performance options
    command += ` --force --drop-densest-as-needed --extend-zooms-if-still-dropping`;
    command += ` "${inputPath}"`;

    return new Promise((resolve, reject) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          logger.error('Tippecanoe conversion failed:', { error, stderr });
          reject(new Error(`Tippecanoe failed: ${stderr || error.message}`));
        } else {
          logger.info('Tippecanoe conversion completed:', stdout);
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Convert MBTiles to PMTiles
   * @param {string} inputPath - Input MBTiles path
   * @param {string} outputPath - Output PMTiles path
   */
  async convertMBTilesToPMTiles(inputPath, outputPath) {
    // For now, we'll use a simple approach
    // In production, you might want to use the official pmtiles CLI tool
    const command = `pmtiles convert "${inputPath}" "${outputPath}"`;

    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          logger.error('PMTiles conversion failed:', { error, stderr });
          reject(new Error(`PMTiles conversion failed: ${stderr || error.message}`));
        } else {
          logger.info('PMTiles conversion completed:', stdout);
          resolve(stdout);
        }
      });
    });
  }

  /**
   * Generate metadata for converted tiles
   * @param {string} tilesPath - Path to PMTiles file
   * @param {string} sourcePath - Path to source PBF file
   * @returns {Promise<Object>} Metadata object
   */
  async generateMetadata(tilesPath, sourcePath) {
    const tilesStats = await fs.stat(tilesPath);
    const sourceStats = await fs.stat(sourcePath);

    return {
      source: {
        path: path.basename(sourcePath),
        size: sourceStats.size,
        sizeFormatted: this.formatFileSize(sourceStats.size),
        lastModified: sourceStats.mtime
      },
      output: {
        path: path.basename(tilesPath),
        size: tilesStats.size,
        sizeFormatted: this.formatFileSize(tilesStats.size),
        createdAt: tilesStats.ctime
      },
      compression: {
        ratio: ((sourceStats.size - tilesStats.size) / sourceStats.size * 100).toFixed(2) + '%',
        savings: this.formatFileSize(sourceStats.size - tilesStats.size)
      }
    };
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * Cleanup temporary files
   * @param {Array<string>} filePaths - Paths to cleanup
   */
  async cleanup(filePaths) {
    for (const filePath of filePaths) {
      try {
        await fs.remove(filePath);
        logger.info(`Cleaned up: ${filePath}`);
      } catch (error) {
        logger.warn(`Failed to cleanup ${filePath}:`, error);
      }
    }
  }
}

module.exports = OSMConverter;
