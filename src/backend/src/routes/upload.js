const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
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

    const fileInfo = {
      id: Date.now().toString(),
      originalName: req.file.originalname,
      filename: req.file.filename,
      size: req.file.size,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded'
    };

    // TODO: Save file info to database
    // await saveFileInfo(fileInfo);

    res.status(200).json({
      message: 'File uploaded successfully',
      file: fileInfo
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
