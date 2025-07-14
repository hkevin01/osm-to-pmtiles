# API Documentation

## Overview
The OSM to PMTiles API provides endpoints for uploading OSM files, managing conversion jobs, and serving map tiles.

## Base URL
```
http://localhost:3001/api
```

## Authentication
Currently, the API does not require authentication. In production, consider implementing API keys or OAuth.

## Endpoints

### Health Check
Check if the API is running.

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00.000Z",
  "version": "1.0.0"
}
```

### File Upload

#### Upload OSM File
Upload a .pbf or .osm.pbf file for conversion.

```http
POST /api/upload
Content-Type: multipart/form-data
```

**Parameters:**
- `osmFile` (file): The OSM file to upload

**Response:**
```json
{
  "message": "File uploaded successfully",
  "file": {
    "id": "1640995200000",
    "originalName": "city.osm.pbf",
    "filename": "1640995200000_city.osm.pbf",
    "size": 45678900,
    "path": "/data/uploads/1640995200000_city.osm.pbf",
    "uploadedAt": "2023-12-01T10:00:00.000Z",
    "status": "uploaded"
  }
}
```

#### Get Upload Status
Check the status of an uploaded file.

```http
GET /api/upload/status/{fileId}
```

**Response:**
```json
{
  "fileId": "1640995200000",
  "status": "uploaded",
  "message": "File information retrieved successfully"
}
```

#### List Uploaded Files
Get a list of all uploaded files.

```http
GET /api/upload/list
```

**Response:**
```json
{
  "files": [
    {
      "filename": "1640995200000_city.osm.pbf",
      "size": 45678900,
      "uploadedAt": "2023-12-01T10:00:00.000Z",
      "modifiedAt": "2023-12-01T10:00:00.000Z"
    }
  ]
}
```

### Conversion Jobs

#### Start Conversion
Start a conversion job for an uploaded file.

```http
POST /api/convert
Content-Type: application/json
```

**Body:**
```json
{
  "fileId": "1640995200000",
  "filename": "city.osm.pbf",
  "options": {
    "minZoom": 0,
    "maxZoom": 14,
    "layers": ["roads", "buildings", "water"],
    "format": "pmtiles"
  }
}
```

**Response:**
```json
{
  "message": "Conversion job started",
  "jobId": "job_1640995200000",
  "fileId": "1640995200000",
  "options": {
    "minZoom": 0,
    "maxZoom": 14,
    "layers": ["roads", "buildings", "water"],
    "format": "pmtiles"
  },
  "status": "queued",
  "estimatedTime": "15-30 minutes"
}
```

#### Get Conversion Status
Check the status of a conversion job.

```http
GET /api/convert/status/{jobId}
```

**Response:**
```json
{
  "jobId": "job_1640995200000",
  "status": "processing",
  "progress": 45,
  "startedAt": "2023-12-01T10:00:00.000Z",
  "estimatedCompletion": "2023-12-01T10:30:00.000Z",
  "currentStep": "Generating vector tiles"
}
```

#### Get Conversion History
Get a paginated list of conversion jobs.

```http
GET /api/convert/history?page=1&limit=10
```

**Response:**
```json
{
  "jobs": [
    {
      "jobId": "job_1640995200000",
      "filename": "city.osm.pbf",
      "status": "completed",
      "startedAt": "2023-12-01T10:00:00.000Z",
      "completedAt": "2023-12-01T10:25:00.000Z",
      "outputFile": "city.pmtiles"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "pages": 1
  }
}
```

#### Cancel Conversion
Cancel a running or queued conversion job.

```http
DELETE /api/convert/{jobId}
```

**Response:**
```json
{
  "message": "Conversion job cancelled",
  "jobId": "job_1640995200000"
}
```

### Job Management

#### List All Jobs
Get a paginated list of all jobs with filtering options.

```http
GET /api/jobs?page=1&limit=10&status=completed&sortBy=createdAt&sortOrder=desc
```

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 10)
- `status` (string): Filter by status (queued, processing, completed, failed)
- `sortBy` (string): Sort field (createdAt, status, filename)
- `sortOrder` (string): Sort order (asc, desc)

**Response:**
```json
{
  "jobs": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  },
  "stats": {
    "total": 25,
    "queued": 2,
    "processing": 1,
    "completed": 20,
    "failed": 2
  }
}
```

#### Get Job Details
Get detailed information about a specific job.

```http
GET /api/jobs/{jobId}
```

**Response:**
```json
{
  "jobId": "job_1640995200000",
  "filename": "city.osm.pbf",
  "status": "completed",
  "progress": 100,
  "createdAt": "2023-12-01T10:00:00.000Z",
  "startedAt": "2023-12-01T10:00:30.000Z",
  "completedAt": "2023-12-01T10:25:00.000Z",
  "options": {
    "minZoom": 0,
    "maxZoom": 14,
    "layers": ["roads", "buildings", "water"]
  },
  "metrics": {
    "inputFileSize": 45678900,
    "outputFileSize": 23456789,
    "processingTime": 1470,
    "tilesGenerated": 15420,
    "memoryUsage": "2.1 GB",
    "cpuUsage": "85%"
  }
}
```

#### Get Job Logs
Get logs for a specific job.

```http
GET /api/jobs/{jobId}/logs?level=info&limit=100
```

**Response:**
```json
{
  "jobId": "job_1640995200000",
  "logs": [
    {
      "timestamp": "2023-12-01T10:00:30.000Z",
      "level": "info",
      "message": "Job started",
      "details": {"step": "initialization"}
    }
  ],
  "totalLogs": 45
}
```

### Tile Serving

#### List Tilesets
Get a list of available tilesets.

```http
GET /api/tiles
```

**Response:**
```json
{
  "tilesets": [
    {
      "name": "city",
      "filename": "city.pmtiles",
      "size": 23456789,
      "createdAt": "2023-12-01T10:25:00.000Z",
      "modifiedAt": "2023-12-01T10:25:00.000Z",
      "url": "/api/tiles/city/{z}/{x}/{y}",
      "metadataUrl": "/api/tiles/city/metadata"
    }
  ]
}
```

#### Get Tileset Metadata
Get metadata for a specific tileset.

```http
GET /api/tiles/{tileset}/metadata
```

**Response:**
```json
{
  "name": "city",
  "format": "pmtiles",
  "bounds": [-180, -85.0511, 180, 85.0511],
  "center": [0, 0, 2],
  "minzoom": 0,
  "maxzoom": 14,
  "attribution": "OpenStreetMap contributors",
  "description": "PMTiles generated from city",
  "version": "1.0.0",
  "layers": [
    {
      "id": "roads",
      "fields": {
        "highway": "String",
        "name": "String"
      }
    }
  ]
}
```

#### Serve Tile
Get a specific tile from a tileset.

```http
GET /api/tiles/{tileset}/{z}/{x}/{y}
```

**Response:** Vector tile data (binary)

#### Download Tileset
Download the complete PMTiles file.

```http
GET /api/tiles/{tileset}/download
```

**Response:** PMTiles file download

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**Common Status Codes:**
- `200` - Success
- `202` - Accepted (for async operations)
- `400` - Bad Request
- `404` - Not Found
- `413` - File Too Large
- `500` - Internal Server Error

## Rate Limiting

The API implements rate limiting:
- 100 requests per 15 minutes per IP address
- File upload endpoints have higher limits
- Headers include rate limit information

## WebSocket Events (Future)

For real-time updates on job progress:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
ws.on('message', (data) => {
  const event = JSON.parse(data);
  // Handle job progress updates
});
```
