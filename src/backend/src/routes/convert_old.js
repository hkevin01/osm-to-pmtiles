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

    const file = fileResult.rows[0];

    // Check if conversion is already in progress or completed
    if (file.conversion_status === 'completed') {
      return res.status(400).json({
        error: 'Already converted',
        message: 'This file has already been converted',
        pmtilesPath: file.pmtiles_path
      });
    }

    // Default conversion options
    const conversionOptions = {
      minZoom: options.minZoom || 0,
      maxZoom: options.maxZoom || 14,
      layers: options.layers || [],
      simplification: options.simplification || 'auto'
    };

    // Add conversion job to queue
    const jobInfo = await jobQueue.addConversionJob({
      fileId,
      filePath: file.file_path,
      options: conversionOptions
    });

    // Update file status
    await db.query(
      'UPDATE files SET conversion_status = $1, updated_at = NOW() WHERE file_id = $2',
      ['processing', fileId]
    );

    logger.info(`Conversion job started for file ${fileId}:`, jobInfo);

    res.status(200).json({
      message: 'Conversion job started successfully',
      job: jobInfo,
      file: {
        id: file.file_id,
        originalName: file.original_name,
        size: file.file_size
      },
      options: conversionOptions
    });

  } catch (error) {
    logger.error('Conversion start error:', error);
    res.status(500).json({
      error: 'Failed to start conversion',
      message: error.message
    });
  }
});

// Get conversion status
router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const jobStatus = await jobQueue.getJobStatus(jobId);
    
    if (jobStatus.status === 'not_found') {
      return res.status(404).json({
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }
    
    res.status(200).json(jobStatus);
    
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to get conversion status',
      message: error.message
    });
  }
});

// Get all jobs with pagination
router.get('/jobs', async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query;
    
    const jobs = await jobQueue.getJobs({
      page: parseInt(page),
      limit: parseInt(limit),
      status
    });
    
    res.status(200).json(jobs);
    
  } catch (error) {
    logger.error('Jobs retrieval error:', error);
    res.status(500).json({
      error: 'Failed to get jobs',
      message: error.message
    });
  }
});

// Cancel a conversion job
router.delete('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const cancelled = await jobQueue.cancelJob(jobId);
    
    if (!cancelled) {
      return res.status(404).json({
        error: 'Job not found',
        message: `No job found with ID: ${jobId}`
      });
    }
    
    res.status(200).json({
      message: 'Job cancelled successfully',
      jobId
    });
    
  } catch (error) {
    logger.error('Job cancellation error:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message
    });
  }
});

// Get queue statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await jobQueue.getQueueStats();
    
    res.status(200).json({
      queue: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Stats retrieval error:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});
    
    const mockHistory = {
      jobs: [
        {
          jobId: 'job_1234567890',
          filename: 'sample_city.osm.pbf',
          status: 'completed',
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          completedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          outputFile: 'sample_city.pmtiles'
        }
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1,
        pages: 1
      }
    };
    
    res.status(200).json(mockHistory);
    
  } catch (error) {
    console.error('History retrieval error:', error);
    res.status(500).json({
      error: 'Failed to get conversion history',
      message: error.message
    });
  }
});

// Cancel conversion job
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    
    // TODO: Cancel job in queue
    // await cancelJob(jobId);
    
    res.status(200).json({
      message: 'Conversion job cancelled',
      jobId
    });
    
  } catch (error) {
    console.error('Job cancellation error:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: error.message
    });
  }
});

module.exports = router;
