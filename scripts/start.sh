#!/bin/bash
# Start script for OSM to PMTiles project

set -e

echo "🚀 Starting OSM to PMTiles application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_status "Created .env file from .env.example"
    else
        print_warning "No .env.example found. Using default environment variables."
    fi
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p data/uploads data/tiles data/temp logs

# Start services
print_status "Starting services with Docker Compose..."
docker-compose up -d

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 10

# Check if services are running
print_status "Checking service health..."

# Check database
if docker-compose exec -T db pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    print_status "✅ Database is ready"
else
    print_warning "Database is not ready yet, please wait..."
fi

# Check backend
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    print_status "✅ Backend API is ready"
else
    print_warning "Backend API is not ready yet, please wait..."
fi

# Check frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    print_status "✅ Frontend is ready"
else
    print_warning "Frontend is not ready yet, please wait..."
fi

echo ""
print_info "🎉 Application started successfully!"
print_info "📱 Frontend: http://localhost:3000"
print_info "🔧 Backend API: http://localhost:3001"
print_info "📊 API Documentation: http://localhost:3001/docs"
echo ""
print_info "📋 Useful commands:"
print_info "  View logs: docker-compose logs -f"
print_info "  Stop: docker-compose down"
print_info "  Restart: docker-compose restart"
echo ""
