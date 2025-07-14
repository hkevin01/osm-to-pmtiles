import React from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  CloudUpload,
  Speed,
  Layers,
  Storage,
  CheckCircle,
  TrendingUp
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Speed color="primary" />,
      title: 'High Performance',
      description: 'Fast conversion and optimized tile serving for smooth user experience'
    },
    {
      icon: <Layers color="primary" />,
      title: 'Layer Control',
      description: 'Filter and toggle between different map layers with ease'
    },
    {
      icon: <Storage color="primary" />,
      title: 'PMTiles Format',
      description: 'Efficient storage and serving with the modern PMTiles format'
    },
    {
      icon: <CloudUpload color="primary" />,
      title: 'Easy Upload',
      description: 'Simple drag-and-drop interface for OSM .pbf file uploads'
    }
  ];

  const workflow = [
    'Upload your OSM .pbf file',
    'Configure conversion options',
    'Monitor processing progress',
    'View and interact with your maps',
    'Download or serve tiles directly'
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Hero Section */}
      <Box textAlign="center" mb={6}>
        <Typography variant="h2" component="h1" gutterBottom>
          OSM to PMTiles
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Convert OpenStreetMap data to high-performance PMTiles for web mapping
        </Typography>
        <Box mt={3}>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/upload')}
            sx={{ mr: 2 }}
          >
            Get Started
          </Button>
          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/viewer')}
          >
            View Demo
          </Button>
        </Box>
      </Box>

      {/* Features Grid */}
      <Grid container spacing={4} mb={6}>
        {features.map((feature, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent>
                <Box mb={2}>
                  {feature.icon}
                </Box>
                <Typography variant="h6" component="h3" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Workflow Section */}
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Typography variant="h4" component="h2" gutterBottom>
            Simple Workflow
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Our streamlined process makes it easy to convert your OSM data to 
            high-performance tiles that load quickly in web applications.
          </Typography>
          <List>
            {workflow.map((step, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <CheckCircle color="primary" />
                </ListItemIcon>
                <ListItemText primary={step} />
              </ListItem>
            ))}
          </List>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="h3" gutterBottom>
                <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
                Performance Benefits
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                PMTiles format provides significant advantages over traditional 
                tile serving methods:
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="Single file deployment" 
                    secondary="No complex tile server setup required"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="HTTP range requests" 
                    secondary="Efficient loading of only needed tiles"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Cloud-native design" 
                    secondary="Works perfectly with CDNs and object storage"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Reduced bandwidth" 
                    secondary="Optimized compression and encoding"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Stats Section */}
      <Box mt={6} textAlign="center">
        <Typography variant="h4" component="h2" gutterBottom>
          Built for Scale
        </Typography>
        <Grid container spacing={4} mt={2}>
          <Grid item xs={12} sm={4}>
            <Typography variant="h3" color="primary">
              10GB+
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Maximum file size supported
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="h3" color="primary">
              &lt;100ms
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Average tile response time
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="h3" color="primary">
              100+
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Concurrent users supported
            </Typography>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default Home;
