const express = require('express');
const OSMConverter = require('../services/osmConverter');
const JobQueue = require('../services/jobQueue');
const db = require('../utils/database');
const logger = require('../utils/logger');

const router = express.Router();
const jobQueue = new JobQueue();
const osmConverter = new OSMConverter();

// Initialize converter
osmConverter.initialize().catch(error => {
  logger.error('Failed to initialize OSM converter:', error);
});

// Start conversion job
router.post('/', async (req, res) => {
  try {
    const { fileId, options = {} } = req.body;
    
    if (!fileId) {
      return res.status(400).json({
        error: 'Missing required parameter',
        message: 'fileId is required'
      });
    }

    // Check if file exists
    const fileQuery = 'SELECT * FROM files WHERE file_id = $1';
    const fileResult = await db.query(fileQuery, [fileId]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({
        error: 'File not found',
        message: `No file found with ID: ${fileId}`
      });
    }

    const file = fileResult.rows[0];
    
    // Validate file type
    if (!file.mime_type.includes('application/octet-stream') && !file.original_name.endsWith('.pbf')) {
      return res.status(400).json({
        error: 'Invalid file type',
        message: 'Only OSM PBF files are supported'
      });
    }

    // Create conversion job
    const jobId = require('crypto').randomUUID();
    const jobData = {
      id: jobId,
      fileId: fileId,
      filePath: file.file_path,
      options: {
        maxZoom: options.maxZoom || 14,
        minZoom: options.minZoom || 0,
        baseZoom: options.baseZoom || 10,
        layers: options.layers || ['points', 'lines', 'multilinestrings', 'multipolygons']
      },
      status: 'pending',
      createdAt: new Date()
    };

    // Add job to queue
    await jobQueue.addJob('osm-conversion', jobData);
    
    // Save job to database
    const insertJobQuery = `
      INSERT INTO conversion_jobs (job_id, file_id, status, options, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await db.query(insertJobQuery, [
      jobId,
      fileId,
      'pending',
      JSON.stringify(jobData.options),
      new Date()
    ]);

    res.status(201).json({
      success: true,
      jobId: jobId,
      status: 'pending',
      message: 'Conversion job created successfully'
    });

  } catch (error) {
    logger.error('Error creating conversion job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create conversion job'
    });
  }
});

// Get conversion status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const query = 'SELECT * FROM conversion_jobs WHERE job_id = $1';
    const result = await db.query(query, [jobId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }

    const job = result.rows[0];
    
    res.json({
      jobId: job.job_id,
      status: job.status,
      progress: job.progress || 0,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      errorMessage: job.error_message,
      outputFile: job.output_file,
      fileSize: job.output_file_size,
      options: job.options
    });

  } catch (error) {
    logger.error('Error getting job status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get job status'
    });
  }
});

// Cancel conversion job
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // Update job status to cancelled
    const updateQuery = `
      UPDATE conversion_jobs 
      SET status = 'cancelled', completed_at = NOW()
      WHERE job_id = $1 AND status IN ('pending', 'running')
    `;
    const result = await db.query(updateQuery, [jobId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Job not found or cannot be cancelled',
        message: 'Job may already be completed or does not exist'
      });
    }

    // Remove from queue if pending
    await jobQueue.removeJob(jobId);

    res.json({
      success: true,
      message: 'Job cancelled successfully'
    });

  } catch (error) {
    logger.error('Error cancelling job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to cancel job'
    });
  }
});

module.exports = router;
