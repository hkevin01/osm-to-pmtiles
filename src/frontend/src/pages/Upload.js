import React, { useState, useCallback, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
  Slider
} from '@mui/material';
import { 
  CloudUpload, 
  Description, 
  Settings,
  ExpandMore,
  CheckCircle,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';

const Upload = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [fileId, setFileId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [conversionStatus, setConversionStatus] = useState(null);
  const [conversionOptions, setConversionOptions] = useState({
    minZoom: 0,
    maxZoom: 14,
    baseZoom: 10,
    layers: ['points', 'lines', 'multilinestrings', 'multipolygons'],
    compress: true
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const steps = ['Upload File', 'Configure Options', 'Convert to PMTiles', 'Complete'];

  // Poll conversion status
  useEffect(() => {
    if (jobId && conversionStatus?.status === 'running') {
      const interval = setInterval(async () => {
        try {
          const response = await axios.get(`/api/convert/status/${jobId}`);
          setConversionStatus(response.data);
          
          if (response.data.status === 'completed') {
            setActiveStep(3);
            setSuccess('Conversion completed successfully!');
          } else if (response.data.status === 'failed') {
            setError(response.data.errorMessage || 'Conversion failed');
          }
        } catch (error) {
          console.error('Error checking conversion status:', error);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [jobId, conversionStatus?.status]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setError(null);
      setSuccess(null);
      setActiveStep(0);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.pbf', '.osm.pbf'],
      'application/x-protobuf': ['.pbf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 * 1024 // 10GB
  });

  const handleUpload = async () => {
    if (!uploadedFile) return;

    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });

      setFileId(response.data.fileId);
      setSuccess('File uploaded successfully!');
      setActiveStep(1);
    } catch (error) {
      setError(error.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleStartConversion = async () => {
    if (!fileId) return;

    try {
      setActiveStep(2);
      const response = await axios.post('/api/convert', {
        fileId,
        options: conversionOptions
      });

      setJobId(response.data.jobId);
      setConversionStatus({ status: 'pending' });
      setSuccess('Conversion started successfully!');
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to start conversion');
    }
  };

  const layerOptions = [
    { value: 'all', label: 'All Layers' },
    { value: 'roads', label: 'Roads' },
    { value: 'buildings', label: 'Buildings' },
    { value: 'water', label: 'Water Features' },
    { value: 'landuse', label: 'Land Use' },
    { value: 'natural', label: 'Natural Features' }
  ];

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConversionProgress = () => {
    if (!conversionStatus) return 0;
    return conversionStatus.progress || 0;
  };

  const isStepCompleted = (step) => {
    switch (step) {
      case 0: return fileId !== null;
      case 1: return activeStep > 1;
      case 2: return conversionStatus?.status === 'completed';
      default: return false;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Upload OSM File
      </Typography>
      
      <Grid container spacing={4}>
        {/* Upload Section */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Select OSM File
            </Typography>
            
            <Box
              {...getRootProps()}
              sx={{
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'grey.300',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                mb: 2
              }}
            >
              <input {...getInputProps()} />
              <CloudUpload sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {isDragActive
                  ? 'Drop the file here...'
                  : 'Drag & drop an OSM .pbf file here, or click to select'
                }
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supported formats: .pbf, .osm.pbf (Max size: 10GB)
              </Typography>
            </Box>

            {uploadedFile && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={1}>
                    <Description sx={{ mr: 1 }} />
                    <Typography variant="subtitle1">
                      {uploadedFile.name}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Size: {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </Typography>
                </CardContent>
              </Card>
            )}

            {uploading && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Uploading... {uploadProgress}%
                </Typography>
                <LinearProgress variant="determinate" value={uploadProgress} />
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}
          </Paper>

          {/* Conversion Options */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Conversion Options
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Minimum Zoom Level"
                  type="number"
                  value={conversionOptions.minZoom}
                  onChange={(e) => setConversionOptions(prev => ({
                    ...prev,
                    minZoom: parseInt(e.target.value)
                  }))}
                  inputProps={{ min: 0, max: 20 }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Maximum Zoom Level"
                  type="number"
                  value={conversionOptions.maxZoom}
                  onChange={(e) => setConversionOptions(prev => ({
                    ...prev,
                    maxZoom: parseInt(e.target.value)
                  }))}
                  inputProps={{ min: 0, max: 20 }}
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Layers to Include</InputLabel>
                  <Select
                    multiple
                    value={conversionOptions.layers}
                    onChange={(e) => setConversionOptions(prev => ({
                      ...prev,
                      layers: e.target.value
                    }))}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip
                            key={value}
                            label={layerOptions.find(opt => opt.value === value)?.label || value}
                            size="small"
                          />
                        ))}
                      </Box>
                    )}
                  >
                    {layerOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Box mt={3}>
              <Button
                variant="contained"
                size="large"
                onClick={handleUpload}
                disabled={!uploadedFile || uploading}
                fullWidth
              >
                {uploading ? 'Uploading...' : 'Upload and Convert'}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Info Sidebar */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upload Guidelines
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Supported Formats:</strong>
            </Typography>
            <Typography variant="body2" paragraph>
              • .pbf files (Protocol Buffer Format)
              • .osm.pbf files (OSM Protocol Buffer)
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>File Size Limits:</strong>
            </Typography>
            <Typography variant="body2" paragraph>
              • Maximum file size: 10GB
              • Recommended: Under 1GB for faster processing
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Processing Time:</strong>
            </Typography>
            <Typography variant="body2" paragraph>
              • Small files (&lt;100MB): 2-5 minutes
              • Medium files (100MB-1GB): 10-20 minutes
              • Large files (1GB+): 30+ minutes
            </Typography>
            
            <Typography variant="body2" paragraph>
              <strong>Zoom Levels:</strong>
            </Typography>
            <Typography variant="body2" paragraph>
              • Level 0: World view
              • Level 10: City view
              • Level 14: Street view
              • Level 18: Building details
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Upload;
