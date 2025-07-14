const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const OSMConverter = require('../services/osmConverter');
const JobQueue = require('../services/jobQueue');
const db = require('../utils/database');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize services
const osmConverter = new OSMConverter();
const jobQueue = new JobQueue();

// Initialize converter
osmConverter.initialize().catch(error => {
  logger.error('Failed to initialize OSM converter in upload route:', error);
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = '/app/data/uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${timestamp}_${sanitizedName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.pbf', '.osm.pbf'];
  const fileExt = path.extname(file.originalname.toLowerCase());
  
  if (allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only .pbf and .osm.pbf files are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024 * 1024 // 10GB default
  }
});

// Upload endpoint
router.post('/', upload.single('osmFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a .pbf or .osm.pbf file to upload'
      });
    }

    const fileId = uuidv4();
    const filePath = req.file.path;

    // Validate the uploaded file
    const validation = await osmConverter.validatePBFFile(filePath);
    if (!validation.valid) {
      // Remove invalid file
      await fs.unlink(filePath);
      return res.status(400).json({
        error: 'Invalid file',
        message: validation.error
      });
    }

    // Store file information in database
    const query = `
      INSERT INTO files (file_id, original_name, filename, file_path, file_size, mime_type, upload_date, status)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      fileId,
      req.file.originalname,
      req.file.filename,
      filePath,
      req.file.size,
      req.file.mimetype || 'application/octet-stream',
      'uploaded'
    ]);

    const fileInfo = result.rows[0];

    // Parse conversion options from request
    const options = {
      minZoom: parseInt(req.body.minZoom) || 0,
      maxZoom: parseInt(req.body.maxZoom) || 14,
      layers: req.body.layers ? JSON.parse(req.body.layers) : [],
      simplification: req.body.simplification || 'auto',
      autoConvert: req.body.autoConvert !== 'false'
    };

    let jobInfo = null;

    // Start conversion if auto-convert is enabled
    if (options.autoConvert) {
      jobInfo = await jobQueue.addConversionJob({
        fileId,
        filePath,
        options
      });
    }

    logger.info(`File uploaded: ${fileId}, Auto-convert: ${options.autoConvert}`);

    res.status(200).json({
      message: 'File uploaded successfully',
      file: {
        id: fileInfo.file_id,
        originalName: fileInfo.original_name,
        filename: fileInfo.filename,
        size: fileInfo.file_size,
        sizeFormatted: validation.sizeFormatted,
        uploadedAt: fileInfo.upload_date,
        status: fileInfo.status,
        validation
      },
      job: jobInfo,
      nextSteps: options.autoConvert ? 
        'Conversion started automatically' : 
        'Use /api/convert endpoint to start conversion'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

// Get upload status
router.get('/status/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    // TODO: Get file status from database
    // const fileInfo = await getFileInfo(fileId);
    
    res.status(200).json({
      fileId,
      status: 'uploaded',
      message: 'File information retrieved successfully'
    });
    
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to get file status',
      message: error.message
    });
  }
});

// List uploaded files
router.get('/list', async (req, res) => {
  try {
    const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
    
    try {
      const files = await fs.readdir(uploadDir);
      const fileList = await Promise.all(
        files.map(async (filename) => {
          const filePath = path.join(uploadDir, filename);
          const stats = await fs.stat(filePath);
          
          return {
            filename,
            size: stats.size,
            uploadedAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
      );
      
      res.status(200).json({
        files: fileList.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      });
      
    } catch (error) {
      res.status(200).json({ files: [] });
    }
    
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      error: 'Failed to list files',
      message: error.message
    });
  }
});

module.exports = router;
