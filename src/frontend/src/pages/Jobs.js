import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  LinearProgress,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import {
  Refresh,
  Cancel,
  Visibility,
  Download,
  Replay
} from '@mui/icons-material';

const Jobs = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [filters]);

  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.append('status', filters.status);
      params.append('sortBy', filters.sortBy);
      params.append('sortOrder', filters.sortOrder);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/jobs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJobAction = async (jobId, action) => {
    try {
      let url = `${process.env.REACT_APP_API_URL}/api/jobs/${jobId}`;
      let method = 'DELETE';
      
      if (action === 'retry') {
        url += '/retry';
        method = 'POST';
      }

      const response = await fetch(url, { method });
      if (response.ok) {
        fetchJobs(); // Refresh the list
      }
    } catch (error) {
      console.error(`Failed to ${action} job:`, error);
    }
  };

  const handleViewDetails = async (jobId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/jobs/${jobId}`);
      if (response.ok) {
        const jobDetails = await response.json();
        setSelectedJob(jobDetails);
        setDetailsOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch job details:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'primary';
      case 'queued': return 'default';
      case 'failed': return 'error';
      default: return 'default';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = Math.floor((end - start) / 1000); // seconds
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Conversion Jobs
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={fetchJobs}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            size="small"
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="queued">Queued</MenuItem>
            <MenuItem value="processing">Processing</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </TextField>

          <TextField
            select
            label="Sort By"
            value={filters.sortBy}
            onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
            size="small"
            sx={{ minWidth: 120 }}
          >
            <MenuItem value="createdAt">Created</MenuItem>
            <MenuItem value="status">Status</MenuItem>
            <MenuItem value="filename">Filename</MenuItem>
          </TextField>

          <TextField
            select
            label="Order"
            value={filters.sortOrder}
            onChange={(e) => setFilters(prev => ({ ...prev, sortOrder: e.target.value }))}
            size="small"
            sx={{ minWidth: 100 }}
          >
            <MenuItem value="desc">Newest</MenuItem>
            <MenuItem value="asc">Oldest</MenuItem>
          </TextField>
        </Box>
      </Paper>

      {/* Jobs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Filename</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <LinearProgress />
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.jobId}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {job.filename}
                    </Typography>
                    {job.outputFile && (
                      <Typography variant="caption" color="text.secondary">
                        → {job.outputFile}
                      </Typography>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <Chip
                      label={job.status}
                      color={getStatusColor(job.status)}
                      size="small"
                    />
                  </TableCell>
                  
                  <TableCell>
                    {job.status === 'processing' ? (
                      <Box>
                        <LinearProgress
                          variant="determinate"
                          value={job.progress}
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="caption">
                          {job.progress}% - {job.currentStep}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2">
                        {job.status === 'completed' ? '100%' : '-'}
                      </Typography>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(job.createdAt).toLocaleTimeString()}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Typography variant="body2">
                      {job.startedAt && formatDuration(job.startedAt, job.completedAt)}
                    </Typography>
                  </TableCell>
                  
                  <TableCell>
                    <Box display="flex" gap={1}>
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(job.jobId)}
                        title="View Details"
                      >
                        <Visibility />
                      </IconButton>
                      
                      {job.status === 'completed' && job.outputFile && (
                        <IconButton
                          size="small"
                          onClick={() => window.open(`/api/tiles/${job.outputFile.replace('.pmtiles', '')}/download`)}
                          title="Download"
                        >
                          <Download />
                        </IconButton>
                      )}
                      
                      {(job.status === 'queued' || job.status === 'processing') && (
                        <IconButton
                          size="small"
                          onClick={() => handleJobAction(job.jobId, 'cancel')}
                          title="Cancel"
                        >
                          <Cancel />
                        </IconButton>
                      )}
                      
                      {job.status === 'failed' && (
                        <IconButton
                          size="small"
                          onClick={() => handleJobAction(job.jobId, 'retry')}
                          title="Retry"
                        >
                          <Replay />
                        </IconButton>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Job Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Job Details: {selectedJob?.jobId}
        </DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box>
              <Typography variant="h6" gutterBottom>
                General Information
              </Typography>
              <Box mb={3}>
                <Typography><strong>Filename:</strong> {selectedJob.filename}</Typography>
                <Typography><strong>Status:</strong> {selectedJob.status}</Typography>
                <Typography><strong>Progress:</strong> {selectedJob.progress}%</Typography>
                <Typography><strong>Created:</strong> {new Date(selectedJob.createdAt).toLocaleString()}</Typography>
                {selectedJob.startedAt && (
                  <Typography><strong>Started:</strong> {new Date(selectedJob.startedAt).toLocaleString()}</Typography>
                )}
                {selectedJob.completedAt && (
                  <Typography><strong>Completed:</strong> {new Date(selectedJob.completedAt).toLocaleString()}</Typography>
                )}
              </Box>

              <Typography variant="h6" gutterBottom>
                Conversion Options
              </Typography>
              <Box mb={3}>
                <Typography><strong>Min Zoom:</strong> {selectedJob.options?.minZoom}</Typography>
                <Typography><strong>Max Zoom:</strong> {selectedJob.options?.maxZoom}</Typography>
                <Typography><strong>Layers:</strong> {selectedJob.options?.layers?.join(', ')}</Typography>
                <Typography><strong>Format:</strong> {selectedJob.options?.format}</Typography>
              </Box>

              {selectedJob.metrics && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Performance Metrics
                  </Typography>
                  <Box mb={3}>
                    <Typography><strong>Input Size:</strong> {formatFileSize(selectedJob.metrics.inputFileSize)}</Typography>
                    <Typography><strong>Output Size:</strong> {formatFileSize(selectedJob.metrics.outputFileSize)}</Typography>
                    <Typography><strong>Processing Time:</strong> {Math.floor(selectedJob.metrics.processingTime / 60)}m {selectedJob.metrics.processingTime % 60}s</Typography>
                    <Typography><strong>Tiles Generated:</strong> {selectedJob.metrics.tilesGenerated?.toLocaleString()}</Typography>
                    <Typography><strong>Memory Usage:</strong> {selectedJob.metrics.memoryUsage}</Typography>
                    <Typography><strong>CPU Usage:</strong> {selectedJob.metrics.cpuUsage}</Typography>
                  </Box>
                </>
              )}

              {selectedJob.logs && selectedJob.logs.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom>
                    Recent Logs
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 200, overflow: 'auto' }}>
                    {selectedJob.logs.map((log, index) => (
                      <Typography key={index} variant="body2" fontFamily="monospace">
                        [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                      </Typography>
                    ))}
                  </Paper>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Jobs;
