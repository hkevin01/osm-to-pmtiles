-- Create database and enable PostGIS extension
CREATE DATABASE osmtiles;

-- Connect to the database
\c osmtiles;

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create tables for the application
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    file_id VARCHAR(255) UNIQUE NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'uploaded',
    metadata JSONB
);

CREATE TABLE IF NOT EXISTS conversion_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL,
    file_id VARCHAR(255) REFERENCES files(file_id),
    status VARCHAR(50) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    options JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    current_step VARCHAR(255),
    output_file VARCHAR(255),
    output_size BIGINT,
    processing_metrics JSONB
);

CREATE TABLE IF NOT EXISTS job_logs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) REFERENCES conversion_jobs(job_id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    details JSONB
);

CREATE TABLE IF NOT EXISTS tilesets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    job_id VARCHAR(255) REFERENCES conversion_jobs(job_id),
    metadata JSONB,
    bounds GEOMETRY(POLYGON, 4326),
    min_zoom INTEGER,
    max_zoom INTEGER
);

-- Create indexes for better performance
CREATE INDEX idx_files_file_id ON files(file_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_jobs_job_id ON conversion_jobs(job_id);
CREATE INDEX idx_jobs_status ON conversion_jobs(status);
CREATE INDEX idx_jobs_created_at ON conversion_jobs(created_at);
CREATE INDEX idx_logs_job_id ON job_logs(job_id);
CREATE INDEX idx_logs_timestamp ON job_logs(timestamp);
CREATE INDEX idx_tilesets_name ON tilesets(name);
CREATE INDEX idx_tilesets_bounds ON tilesets USING GIST(bounds);

-- Insert some sample data for development
INSERT INTO files (file_id, original_name, filename, file_path, file_size, status) VALUES
('file_sample_001', 'sample_city.osm.pbf', '1640995200000_sample_city.osm.pbf', '/data/uploads/1640995200000_sample_city.osm.pbf', 45678900, 'uploaded')
ON CONFLICT (file_id) DO NOTHING;

INSERT INTO conversion_jobs (job_id, file_id, status, progress, options, created_at, started_at, completed_at, output_file, output_size) VALUES
('job_1640995200000', 'file_sample_001', 'completed', 100, '{"minZoom": 0, "maxZoom": 14, "layers": ["all"]}', 
 CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '2 hours', CURRENT_TIMESTAMP - INTERVAL '1 hour', 
 'sample_city.pmtiles', 23456789)
ON CONFLICT (job_id) DO NOTHING;

INSERT INTO tilesets (name, filename, file_path, file_size, job_id, metadata, min_zoom, max_zoom) VALUES
('sample_city', 'sample_city.pmtiles', '/data/tiles/sample_city.pmtiles', 23456789, 'job_1640995200000',
 '{"attribution": "OpenStreetMap contributors", "description": "Sample city data"}', 0, 14)
ON CONFLICT (name) DO NOTHING;
