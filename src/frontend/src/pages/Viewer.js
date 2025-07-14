import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Switch,
  Alert
} from '@mui/material';
import Map, { Source, Layer } from 'react-map-gl';
import { useParams } from 'react-router-dom';

const Viewer = () => {
  const { tileset } = useParams();
  const [selectedTileset, setSelectedTileset] = useState(tileset || '');
  const [availableTilesets, setAvailableTilesets] = useState([]);
  const [layerVisibility, setLayerVisibility] = useState({
    roads: true,
    buildings: true,
    water: true,
    landuse: false,
    natural: false
  });
  const [viewState, setViewState] = useState({
    longitude: 0,
    latitude: 0,
    zoom: 2
  });
  const [mapStyle, setMapStyle] = useState('mapbox://styles/mapbox/light-v11');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAvailableTilesets();
  }, []);

  const fetchAvailableTilesets = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/tiles`);
      if (response.ok) {
        const data = await response.json();
        setAvailableTilesets(data.tilesets);
        if (!selectedTileset && data.tilesets.length > 0) {
          setSelectedTileset(data.tilesets[0].name);
        }
      }
    } catch (error) {
      setError('Failed to load available tilesets');
      console.error('Failed to fetch tilesets:', error);
    }
  };

  const handleTilesetChange = (event) => {
    setSelectedTileset(event.target.value);
  };

  const handleLayerToggle = (layer) => {
    setLayerVisibility(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

  const getTileUrl = () => {
    if (!selectedTileset) return null;
    return `${process.env.REACT_APP_API_URL}/api/tiles/${selectedTileset}/{z}/{x}/{y}`;
  };

  // Map style options
  const mapStyles = [
    { value: 'mapbox://styles/mapbox/light-v11', label: 'Light' },
    { value: 'mapbox://styles/mapbox/dark-v11', label: 'Dark' },
    { value: 'mapbox://styles/mapbox/streets-v12', label: 'Streets' },
    { value: 'mapbox://styles/mapbox/satellite-v9', label: 'Satellite' }
  ];

  // Layer styles for different OSM features
  const layerStyles = {
    roads: {
      type: 'line',
      paint: {
        'line-color': '#ff6b6b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 15, 3]
      },
      filter: ['==', ['get', 'highway'], 'primary']
    },
    buildings: {
      type: 'fill',
      paint: {
        'fill-color': '#4ecdc4',
        'fill-opacity': 0.6
      },
      filter: ['==', ['get', 'building'], true]
    },
    water: {
      type: 'fill',
      paint: {
        'fill-color': '#45b7d1',
        'fill-opacity': 0.8
      },
      filter: ['==', ['get', 'natural'], 'water']
    }
  };

  const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

  if (!MAPBOX_TOKEN) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="warning">
          Mapbox token is not configured. Please set REACT_APP_MAPBOX_TOKEN in your environment variables.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 2, mb: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Map Viewer
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box display="flex" gap={2} height="calc(100vh - 200px)">
        {/* Controls Panel */}
        <Paper sx={{ p: 2, width: 300, overflow: 'auto' }}>
          <Typography variant="h6" gutterBottom>
            Map Controls
          </Typography>

          {/* Tileset Selection */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Select Tileset</InputLabel>
            <Select
              value={selectedTileset}
              onChange={handleTilesetChange}
              label="Select Tileset"
            >
              {availableTilesets.map((tileset) => (
                <MenuItem key={tileset.name} value={tileset.name}>
                  {tileset.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Map Style Selection */}
          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Map Style</InputLabel>
            <Select
              value={mapStyle}
              onChange={(e) => setMapStyle(e.target.value)}
              label="Map Style"
            >
              {mapStyles.map((style) => (
                <MenuItem key={style.value} value={style.value}>
                  {style.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Layer Controls */}
          <Typography variant="subtitle1" gutterBottom>
            Layer Visibility
          </Typography>
          <FormGroup>
            {Object.entries(layerVisibility).map(([layer, visible]) => (
              <FormControlLabel
                key={layer}
                control={
                  <Switch
                    checked={visible}
                    onChange={() => handleLayerToggle(layer)}
                  />
                }
                label={layer.charAt(0).toUpperCase() + layer.slice(1)}
              />
            ))}
          </FormGroup>

          {/* Current View Info */}
          <Box mt={3}>
            <Typography variant="subtitle2" gutterBottom>
              Current View
            </Typography>
            <Typography variant="body2">
              Lat: {viewState.latitude.toFixed(4)}
            </Typography>
            <Typography variant="body2">
              Lng: {viewState.longitude.toFixed(4)}
            </Typography>
            <Typography variant="body2">
              Zoom: {viewState.zoom.toFixed(2)}
            </Typography>
          </Box>

          {/* Tileset Info */}
          {selectedTileset && (
            <Box mt={3}>
              <Typography variant="subtitle2" gutterBottom>
                Tileset Information
              </Typography>
              <Typography variant="body2">
                Name: {selectedTileset}
              </Typography>
              <Typography variant="body2">
                Format: PMTiles
              </Typography>
              <Typography variant="body2">
                Tile URL: {getTileUrl()}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Map Container */}
        <Box flex={1} position="relative">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            style={{ width: '100%', height: '100%' }}
            mapStyle={mapStyle}
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            {selectedTileset && getTileUrl() && (
              <Source
                id="osm-source"
                type="vector"
                tiles={[getTileUrl()]}
                minzoom={0}
                maxzoom={14}
              >
                {/* Render layers based on visibility settings */}
                {Object.entries(layerVisibility).map(([layerName, visible]) => {
                  if (!visible || !layerStyles[layerName]) return null;
                  
                  return (
                    <Layer
                      key={layerName}
                      id={`osm-${layerName}`}
                      source="osm-source"
                      source-layer={layerName}
                      {...layerStyles[layerName]}
                    />
                  );
                })}
              </Source>
            )}
          </Map>

          {/* Map Overlay Info */}
          <Paper
            sx={{
              position: 'absolute',
              top: 10,
              right: 10,
              p: 1,
              bgcolor: 'rgba(255, 255, 255, 0.9)'
            }}
          >
            <Typography variant="caption">
              {selectedTileset ? `Viewing: ${selectedTileset}` : 'No tileset selected'}
            </Typography>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
};

export default Viewer;
