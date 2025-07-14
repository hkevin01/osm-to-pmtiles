#!/bin/bash
# Build script for OSM to PMTiles project

set -e

echo "🚀 Building OSM to PMTiles project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Clean previous builds
print_status "Cleaning previous builds..."
docker-compose down --volumes --remove-orphans 2>/dev/null || true
docker system prune -f > /dev/null 2>&1 || true

# Build backend
print_status "Building backend..."
cd src/backend
if [ -f "package.json" ]; then
    npm ci
    npm run build
    print_status "Backend build completed"
else
    print_warning "Backend package.json not found, skipping npm build"
fi
cd ../..

# Build frontend
print_status "Building frontend..."
cd src/frontend
if [ -f "package.json" ]; then
    npm ci
    npm run build
    print_status "Frontend build completed"
else
    print_warning "Frontend package.json not found, skipping npm build"
fi
cd ../..

# Build Docker images
print_status "Building Docker images..."
docker-compose build --no-cache

# Verify images
print_status "Verifying Docker images..."
if docker images | grep -q "osm-to-pmtiles"; then
    print_status "Docker images built successfully"
    docker images | grep "osm-to-pmtiles"
else
    print_error "Failed to build Docker images"
    exit 1
fi

print_status "✅ Build completed successfully!"
print_status "You can now run: ./scripts/start.sh"
