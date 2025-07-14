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
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }

      const minSize = 1024; // 1KB
      const maxSize = 10 * 1024 * 1024 * 1024; // 10GB
      
      if (stats.size < minSize) {
        throw new Error('File too small to be a valid OSM file');
      }
      
      if (stats.size > maxSize) {
        throw new Error('File too large (max 10GB supported)');
      }

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

  async extractLayers(filePath, outputDir, options = {}) {
    return new Promise((resolve, reject) => {
      const layers = options.layers || [
        'points', 'lines', 'multilinestrings', 'multipolygons'
      ];
      
      const extractedFiles = [];
      let completedLayers = 0;

      layers.forEach(layer => {
        const outputFile = path.join(outputDir, `${layer}.geojson`);
        const args = [
          '-f', 'GeoJSON',
          outputFile,
          filePath,
          layer
        ];

        const ogr2ogr = spawn('ogr2ogr', args);
        
        ogr2ogr.stdout.on('data', (data) => {
          this.emit('progress', {
            stage: 'extraction',
            layer,
            message: data.toString()
          });
        });

        ogr2ogr.stderr.on('data', (data) => {
          logger.warn(`ogr2ogr stderr for ${layer}:`, data.toString());
        });

        ogr2ogr.on('close', (code) => {
          if (code === 0) {
            extractedFiles.push({
              layer,
              file: outputFile
            });
            completedLayers++;
            
            this.emit('progress', {
              stage: 'extraction',
              layer,
              completed: true,
              progress: (completedLayers / layers.length) * 100
            });

            if (completedLayers === layers.length) {
              resolve(extractedFiles);
            }
          } else {
            reject(new Error(`Layer extraction failed for ${layer} with code ${code}`));
          }
        });

        ogr2ogr.on('error', (error) => {
          reject(new Error(`Failed to start ogr2ogr for ${layer}: ${error.message}`));
        });
      });
    });
  }

  async generateVectorTiles(layerFiles, outputDir, options = {}) {
    return new Promise((resolve, reject) => {
      const outputFile = path.join(outputDir, 'tiles.mbtiles');
      
      const args = [
        '-o', outputFile,
        '--force',
        '--maximum-zoom', options.maxZoom || '14',
        '--minimum-zoom', options.minZoom || '0',
        '--base-zoom', options.baseZoom || '10',
        '--drop-densest-as-needed',
        '--extend-zooms-if-still-dropping'
      ];

      layerFiles.forEach(({ layer, file }) => {
        args.push('-l', layer);
        args.push(file);
      });

      const tippecanoe = spawn('tippecanoe', args);
      
      tippecanoe.stdout.on('data', (data) => {
        this.emit('progress', {
          stage: 'tiling',
          message: data.toString()
        });
      });

      tippecanoe.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('tiles written')) {
          this.emit('progress', {
            stage: 'tiling',
            message: message.trim()
          });
        }
      });

      tippecanoe.on('close', (code) => {
        if (code === 0) {
          this.emit('progress', {
            stage: 'tiling',
            completed: true,
            outputFile
          });
          resolve(outputFile);
        } else {
          reject(new Error(`Tippecanoe failed with code ${code}`));
        }
      });

      tippecanoe.on('error', (error) => {
        reject(new Error(`Failed to start tippecanoe: ${error.message}`));
      });
    });
  }

  async convertToPMTiles(mbtilesFile, outputDir, options = {}) {
    return new Promise((resolve, reject) => {
      const outputFile = path.join(outputDir, 'tiles.pmtiles');
      
      const args = [
        'convert',
        mbtilesFile,
        outputFile
      ];

      if (options.compress !== false) {
        args.push('--compression', 'gzip');
      }

      const pmtiles = spawn('pmtiles', args);
      
      pmtiles.stdout.on('data', (data) => {
        this.emit('progress', {
          stage: 'pmtiles',
          message: data.toString()
        });
      });

      pmtiles.stderr.on('data', (data) => {
        logger.warn('pmtiles stderr:', data.toString());
      });

      pmtiles.on('close', (code) => {
        if (code === 0) {
          this.emit('progress', {
            stage: 'pmtiles',
            completed: true,
            outputFile
          });
          resolve(outputFile);
        } else {
          reject(new Error(`PMTiles conversion failed with code ${code}`));
        }
      });

      pmtiles.on('error', (error) => {
        reject(new Error(`Failed to start pmtiles: ${error.message}`));
      });
    });
  }

  async convertOSMToPMTiles(filePath, jobId, options = {}) {
    try {
      this.emit('started', { jobId, stage: 'validation' });

      const validation = await this.validateOSMFile(filePath);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      this.emit('progress', {
        jobId,
        stage: 'validation',
        completed: true,
        fileSize: validation.size,
        format: validation.format
      });

      const workDir = path.join(this.tempDir, jobId);
      await fs.mkdir(workDir, { recursive: true });

      this.emit('progress', { jobId, stage: 'extraction', message: 'Extracting layers...' });
      const layerFiles = await this.extractLayers(filePath, workDir, options);

      this.emit('progress', { jobId, stage: 'tiling', message: 'Generating vector tiles...' });
      const mbtilesFile = await this.generateVectorTiles(layerFiles, workDir, options);

      this.emit('progress', { jobId, stage: 'pmtiles', message: 'Converting to PMTiles...' });
      const pmtilesFile = await this.convertToPMTiles(mbtilesFile, this.pmtilesDir, options);

      const finalPath = path.join(this.tilesDir, `${jobId}.pmtiles`);
      await fs.copyFile(pmtilesFile, finalPath);

      await this.cleanup(workDir);

      this.emit('completed', {
        jobId,
        outputFile: finalPath,
        fileSize: (await fs.stat(finalPath)).size
      });

      return {
        success: true,
        outputFile: finalPath,
        fileSize: (await fs.stat(finalPath)).size
      };

    } catch (error) {
      this.emit('error', { jobId, error: error.message });
      throw error;
    }
  }

  async cleanup(directory) {
    try {
      await fs.rm(directory, { recursive: true, force: true });
      logger.info(`Cleaned up temporary directory: ${directory}`);
    } catch (error) {
      logger.warn(`Failed to cleanup directory ${directory}:`, error);
    }
  }
}

module.exports = OSMConverter;
