const Queue = require('bull');
const redis = require('redis');
const OSMConverter = require('./osmConverter');
const logger = require('../utils/logger');
const db = require('../utils/database');

class JobQueue {
  constructor() {
    // Initialize Redis connection
    this.redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    });

    // Initialize job queue
    this.conversionQueue = new Queue('osm conversion', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });

    this.osmConverter = new OSMConverter();
    this.setupQueueProcessors();
    this.setupQueueEvents();
  }

  /**
   * Setup queue processors
   */
  setupQueueProcessors() {
    this.conversionQueue.process('convert-osm', this.processConversionJob.bind(this));
  }

  /**
   * Setup queue event handlers
   */
  setupQueueEvents() {
    this.conversionQueue.on('completed', (job, result) => {
      logger.info(`Job ${job.id} completed:`, result);
      this.updateJobStatus(job.id, 'completed', result);
    });

    this.conversionQueue.on('failed', (job, err) => {
      logger.error(`Job ${job.id} failed:`, err);
      this.updateJobStatus(job.id, 'failed', { error: err.message });
    });

    this.conversionQueue.on('progress', (job, progress) => {
      logger.info(`Job ${job.id} progress: ${progress}%`);
      this.updateJobProgress(job.id, progress);
    });
  }

  /**
   * Add a new conversion job to the queue
   * @param {Object} jobData - Job data
   * @returns {Promise<Object>} Job information
   */
  async addConversionJob(jobData) {
    try {
      const job = await this.conversionQueue.add('convert-osm', jobData, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 5
      });

      // Store job in database
      await this.createJobRecord(job.id, jobData);

      logger.info(`Added conversion job ${job.id} to queue`);
      
      return {
        jobId: job.id,
        status: 'queued',
        data: jobData
      };
    } catch (error) {
      logger.error('Failed to add job to queue:', error);
      throw error;
    }
  }

  /**
   * Process a conversion job
   * @param {Object} job - Bull job object
   * @returns {Promise<Object>} Job result
   */
  async processConversionJob(job) {
    const { fileId, filePath, options } = job.data;
    
    try {
      logger.info(`Processing conversion job ${job.id} for file ${fileId}`);
      
      // Update progress
      await job.progress(10);

      // Validate PBF file
      const validation = await this.osmConverter.validatePBFFile(filePath);
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.error}`);
      }

      await job.progress(25);

      // Convert to PMTiles
      const result = await this.osmConverter.convertToPMTiles(filePath, options);
      
      await job.progress(90);

      // Store result in database
      await this.storeConversionResult(fileId, result);

      await job.progress(100);

      return {
        success: true,
        fileId,
        ...result
      };
    } catch (error) {
      logger.error(`Conversion job ${job.id} failed:`, error);
      throw error;
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Job status
   */
  async getJobStatus(jobId) {
    try {
      const job = await this.conversionQueue.getJob(jobId);
      
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress();

      return {
        id: job.id,
        status: state,
        progress,
        data: job.data,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason
      };
    } catch (error) {
      logger.error('Failed to get job status:', error);
      throw error;
    }
  }

  /**
   * Get all jobs with pagination
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Jobs list
   */
  async getJobs(options = {}) {
    const {
      page = 1,
      limit = 10,
      status = 'all'
    } = options;

    try {
      let jobs;
      const start = (page - 1) * limit;
      const end = start + limit - 1;

      switch (status) {
        case 'waiting':
          jobs = await this.conversionQueue.getWaiting(start, end);
          break;
        case 'active':
          jobs = await this.conversionQueue.getActive(start, end);
          break;
        case 'completed':
          jobs = await this.conversionQueue.getCompleted(start, end);
          break;
        case 'failed':
          jobs = await this.conversionQueue.getFailed(start, end);
          break;
        default:
          jobs = await this.conversionQueue.getJobs(['waiting', 'active', 'completed', 'failed'], start, end);
      }

      const jobsWithStatus = await Promise.all(
        jobs.map(async (job) => {
          const state = await job.getState();
          return {
            id: job.id,
            status: state,
            progress: job.progress(),
            data: job.data,
            createdAt: new Date(job.timestamp),
            processedAt: job.processedOn ? new Date(job.processedOn) : null,
            finishedAt: job.finishedOn ? new Date(job.finishedOn) : null
          };
        })
      );

      return {
        jobs: jobsWithStatus,
        pagination: {
          page,
          limit,
          total: jobsWithStatus.length
        }
      };
    } catch (error) {
      logger.error('Failed to get jobs:', error);
      throw error;
    }
  }

  /**
   * Cancel a job
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} Success status
   */
  async cancelJob(jobId) {
    try {
      const job = await this.conversionQueue.getJob(jobId);
      
      if (!job) {
        return false;
      }

      await job.remove();
      await this.updateJobStatus(jobId, 'cancelled');
      
      logger.info(`Job ${jobId} cancelled`);
      return true;
    } catch (error) {
      logger.error(`Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Create job record in database
   * @param {string} jobId - Job ID
   * @param {Object} jobData - Job data
   */
  async createJobRecord(jobId, jobData) {
    const query = `
      INSERT INTO conversion_jobs (id, file_id, status, options, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    
    await db.query(query, [
      jobId,
      jobData.fileId,
      'queued',
      JSON.stringify(jobData.options || {})
    ]);
  }

  /**
   * Update job status in database
   * @param {string} jobId - Job ID
   * @param {string} status - New status
   * @param {Object} result - Job result (optional)
   */
  async updateJobStatus(jobId, status, result = null) {
    const query = `
      UPDATE conversion_jobs 
      SET status = $1, result = $2, updated_at = NOW()
      WHERE id = $3
    `;
    
    await db.query(query, [
      status,
      result ? JSON.stringify(result) : null,
      jobId
    ]);
  }

  /**
   * Update job progress in database
   * @param {string} jobId - Job ID
   * @param {number} progress - Progress percentage
   */
  async updateJobProgress(jobId, progress) {
    const query = `
      UPDATE conversion_jobs 
      SET progress = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await db.query(query, [progress, jobId]);
  }

  /**
   * Store conversion result in database
   * @param {string} fileId - File ID
   * @param {Object} result - Conversion result
   */
  async storeConversionResult(fileId, result) {
    const query = `
      UPDATE files 
      SET 
        conversion_status = 'completed',
        pmtiles_path = $1,
        metadata = $2,
        updated_at = NOW()
      WHERE file_id = $3
    `;
    
    await db.query(query, [
      result.outputPath,
      JSON.stringify(result.metadata),
      fileId
    ]);
  }

  /**
   * Get queue statistics
   * @returns {Promise<Object>} Queue stats
   */
  async getQueueStats() {
    try {
      const waiting = await this.conversionQueue.getWaiting();
      const active = await this.conversionQueue.getActive();
      const completed = await this.conversionQueue.getCompleted();
      const failed = await this.conversionQueue.getFailed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', error);
      throw error;
    }
  }
}

module.exports = JobQueue;
