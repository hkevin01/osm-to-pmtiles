#!/bin/bash
# Development setup script

set -e

echo "🛠️  Setting up development environment for OSM to PMTiles..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Node.js
if command -v node > /dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
    
    # Check if version is 18 or higher
    MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v\([0-9]*\).*/\1/')
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        print_warning "Node.js version 18+ is recommended. Current: $NODE_VERSION"
    fi
else
    print_error "Node.js not found. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Docker
if command -v docker > /dev/null 2>&1; then
    DOCKER_VERSION=$(docker --version)
    print_status "Docker found: $DOCKER_VERSION"
else
    print_error "Docker not found. Please install Docker and try again."
    exit 1
fi

# Check Docker Compose
if command -v docker-compose > /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_status "Docker Compose found: $COMPOSE_VERSION"
else
    print_error "Docker Compose not found. Please install Docker Compose and try again."
    exit 1
fi

# Create project structure
print_status "Creating project structure..."

# Source directories
mkdir -p src/{backend,frontend,converter,utils}
mkdir -p src/backend/{src,tests,docs}
mkdir -p src/frontend/{src,public,tests}
mkdir -p src/converter/{src,tests}
mkdir -p src/utils/{src,tests}

# Configuration and data directories
mkdir -p config data/{uploads,tiles,temp,osm} logs

# Documentation
mkdir -p docs/{api,deployment,user-guide}

# Create environment files
print_status "Creating environment files..."

# Root .env.example
cat > .env.example << EOF
# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=osmtiles
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_secure_password

# API Configuration
API_PORT=3001
API_HOST=0.0.0.0
UPLOAD_MAX_SIZE=10737418240
ALLOWED_ORIGINS=http://localhost:3000

# Frontend Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_MAPBOX_TOKEN=your_mapbox_token

# File Storage
UPLOAD_DIR=./data/uploads
TILES_DIR=./data/tiles
TEMP_DIR=./data/temp

# Processing Configuration
MAX_CONCURRENT_JOBS=2
TILE_MAX_ZOOM=14
TILE_MIN_ZOOM=0

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
EOF

# Backend package.json
print_status "Creating backend package.json..."
cat > src/backend/package.json << EOF
{
  "name": "osm-to-pmtiles-backend",
  "version": "1.0.0",
  "description": "Backend API for OSM to PMTiles conversion",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "build": "echo 'No build step required'",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/ --ext .js",
    "lint:fix": "eslint src/ --ext .js --fix"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5",
    "pg": "^8.8.0",
    "dotenv": "^16.0.3",
    "helmet": "^6.0.1",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^6.7.0",
    "joi": "^17.7.0",
    "winston": "^3.8.2",
    "bull": "^4.10.2",
    "redis": "^4.5.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.20",
    "jest": "^29.3.1",
    "supertest": "^6.3.3",
    "eslint": "^8.31.0",
    "eslint-config-standard": "^17.0.0"
  },
  "keywords": ["osm", "pmtiles", "gis", "maps"],
  "author": "Your Name",
  "license": "MIT"
}
EOF

# Frontend package.json
print_status "Creating frontend package.json..."
cat > src/frontend/package.json << EOF
{
  "name": "osm-to-pmtiles-frontend",
  "version": "1.0.0",
  "description": "Frontend for OSM to PMTiles conversion",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "mapbox-gl": "^2.15.0",
    "react-map-gl": "^7.0.21",
    "axios": "^1.2.2",
    "react-router-dom": "^6.6.1",
    "react-dropzone": "^14.2.3",
    "@mui/material": "^5.11.1",
    "@mui/icons-material": "^5.11.0",
    "@emotion/react": "^11.10.5",
    "@emotion/styled": "^11.10.5"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint src/ --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src/ --ext .js,.jsx,.ts,.tsx --fix"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^5.16.5",
    "@testing-library/react": "^13.4.0",
    "@testing-library/user-event": "^13.5.0",
    "eslint": "^8.31.0",
    "eslint-config-react-app": "^7.0.1"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF

# Docker Compose for development
print_status "Creating Docker Compose configuration..."
cat > docker-compose.yml << EOF
version: '3.8'

services:
  db:
    image: postgis/postgis:15-3.3
    container_name: osm_db
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-osmtiles}
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-postgres}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./config/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: osm_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  backend:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
    container_name: osm_backend
    environment:
      - NODE_ENV=development
      - POSTGRES_HOST=db
      - REDIS_HOST=redis
    ports:
      - "3001:3001"
    volumes:
      - ./src/backend:/app
      - ./data:/app/data
      - /app/node_modules
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    command: npm run dev

  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    container_name: osm_frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src/frontend:/app
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost:3001
    depends_on:
      - backend

volumes:
  postgres_data:
  redis_data:
EOF

# Make scripts executable
chmod +x scripts/*.sh

print_status "✅ Development environment setup completed!"
print_status "📋 Next steps:"
echo "  1. Copy .env.example to .env and configure your settings"
echo "  2. Run: ./scripts/build.sh"
echo "  3. Run: ./scripts/start.sh"
echo "  4. Open http://localhost:3000 in your browser"
echo ""
print_status "📚 Useful commands:"
echo "  Build project: ./scripts/build.sh"
echo "  Start development: ./scripts/start.sh"
echo "  Deploy to VPS: ./scripts/deploy.sh"
