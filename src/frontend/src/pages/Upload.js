import React, { useState, useCallback } from 'react';
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
  CardContent
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { CloudUpload, Description } from '@mui/icons-material';

const Upload = () => {
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [conversionOptions, setConversionOptions] = useState({
    minZoom: 0,
    maxZoom: 14,
    layers: ['all']
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFile(file);
      setError(null);
      setSuccess(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.pbf', '.osm.pbf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024 * 1024 // 10GB
  });

  const handleUpload = async () => {
    if (!uploadedFile) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('osmFile', uploadedFile);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (response.ok) {
        const result = await response.json();
        setSuccess(`File uploaded successfully! File ID: ${result.file.id}`);
        
        // Start conversion
        setTimeout(() => {
          handleStartConversion(result.file.id, result.file.filename);
        }, 1000);
      } else {
        const error = await response.json();
        setError(error.message || 'Upload failed');
      }
    } catch (err) {
      setError('Network error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const handleStartConversion = async (fileId, filename) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId,
          filename,
          options: conversionOptions
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(prev => `${prev}\nConversion started! Job ID: ${result.jobId}`);
      }
    } catch (err) {
      setError('Failed to start conversion');
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
