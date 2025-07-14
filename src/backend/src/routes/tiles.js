const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Serve tile metadata
router.get('/:tileset/metadata', async (req, res) => {
  try {
    const { tileset } = req.params;
    const tilesDir = process.env.TILES_DIR || './data/tiles';
    const tilesetPath = path.join(tilesDir, `${tileset}.pmtiles`);
    
    // Check if tileset exists
    try {
      await fs.access(tilesetPath);
    } catch (error) {
      return res.status(404).json({
        error: 'Tileset not found',
        message: `Tileset '${tileset}' does not exist`
      });
    }
    
    // TODO: Extract actual metadata from PMTiles file
    const metadata = {
      name: tileset,
      format: 'pmtiles',
      bounds: [-180, -85.0511, 180, 85.0511],
      center: [0, 0, 2],
      minzoom: 0,
      maxzoom: 14,
      attribution: 'OpenStreetMap contributors',
      description: `PMTiles generated from ${tileset}`,
      version: '1.0.0',
      layers: [
        {
          id: 'roads',
          fields: {
            highway: 'String',
            name: 'String'
          }
        },
        {
          id: 'buildings',
          fields: {
            building: 'String',
            height: 'Number'
          }
        },
        {
          id: 'water',
          fields: {
            natural: 'String',
            name: 'String'
          }
        }
      ]
    };
    
    res.status(200).json(metadata);
    
  } catch (error) {
    console.error('Metadata retrieval error:', error);
    res.status(500).json({
      error: 'Failed to get tileset metadata',
      message: error.message
    });
  }
});

// Serve individual tiles
router.get('/:tileset/:z/:x/:y', async (req, res) => {
  try {
    const { tileset, z, x, y } = req.params;
    const tilesDir = process.env.TILES_DIR || './data/tiles';
    const tilesetPath = path.join(tilesDir, `${tileset}.pmtiles`);
    
    // Validate tile coordinates
    const zoom = parseInt(z);
    const tileX = parseInt(x);
    const tileY = parseInt(y);
    
    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return res.status(400).json({
        error: 'Invalid tile coordinates',
        message: 'z, x, and y must be valid integers'
      });
    }
    
    if (zoom < 0 || zoom > 20) {
      return res.status(400).json({
        error: 'Invalid zoom level',
        message: 'Zoom level must be between 0 and 20'
      });
    }
    
    // Check if tileset exists
    try {
      await fs.access(tilesetPath);
    } catch (error) {
      return res.status(404).json({
        error: 'Tileset not found',
        message: `Tileset '${tileset}' does not exist`
      });
    }
    
    // TODO: Extract tile from PMTiles file
    // For now, return a 204 (No Content) for tiles that don't exist
    res.status(204).send();
    
  } catch (error) {
    console.error('Tile serving error:', error);
    res.status(500).json({
      error: 'Failed to serve tile',
      message: error.message
    });
  }
});

// List available tilesets
router.get('/', async (req, res) => {
  try {
    const tilesDir = process.env.TILES_DIR || './data/tiles';
    
    try {
      const files = await fs.readdir(tilesDir);
      const tilesets = await Promise.all(
        files
          .filter(file => file.endsWith('.pmtiles'))
          .map(async (file) => {
            const filePath = path.join(tilesDir, file);
            const stats = await fs.stat(filePath);
            const name = path.basename(file, '.pmtiles');
            
            return {
              name,
              filename: file,
              size: stats.size,
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime,
              url: `/api/tiles/${name}/{z}/{x}/{y}`,
              metadataUrl: `/api/tiles/${name}/metadata`
            };
          })
      );
      
      res.status(200).json({
        tilesets: tilesets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      });
      
    } catch (error) {
      res.status(200).json({ tilesets: [] });
    }
    
  } catch (error) {
    console.error('Tileset listing error:', error);
    res.status(500).json({
      error: 'Failed to list tilesets',
      message: error.message
    });
  }
});

// Download PMTiles file
router.get('/:tileset/download', async (req, res) => {
  try {
    const { tileset } = req.params;
    const tilesDir = process.env.TILES_DIR || './data/tiles';
    const tilesetPath = path.join(tilesDir, `${tileset}.pmtiles`);
    
    // Check if tileset exists
    try {
      await fs.access(tilesetPath);
    } catch (error) {
      return res.status(404).json({
        error: 'Tileset not found',
        message: `Tileset '${tileset}' does not exist`
      });
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${tileset}.pmtiles"`);
    
    // Stream the file
    const fileStream = require('fs').createReadStream(tilesetPath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      error: 'Failed to download tileset',
      message: error.message
    });
  }
});

module.exports = router;
