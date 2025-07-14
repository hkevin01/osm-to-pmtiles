#!/bin/bash
# Deployment script for VPS

set -e

echo "🚀 Deploying OSM to PMTiles to VPS..."

# Configuration
VPS_HOST=${VPS_HOST:-"your-vps-ip"}
VPS_USER=${VPS_USER:-"root"}
APP_DIR=${APP_DIR:-"/opt/osm-to-pmtiles"}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-""}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check requirements
if [ -z "$VPS_HOST" ] || [ "$VPS_HOST" = "your-vps-ip" ]; then
    print_error "Please set VPS_HOST environment variable"
    exit 1
fi

# Test SSH connection
print_status "Testing SSH connection to $VPS_HOST..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 $VPS_USER@$VPS_HOST exit 2>/dev/null; then
    print_status "SSH connection successful"
else
    print_error "Cannot connect to $VPS_HOST. Please check SSH configuration."
    exit 1
fi

# Create deployment package
print_status "Creating deployment package..."
tar -czf deploy.tar.gz \
    docker-compose.prod.yml \
    .env.example \
    scripts/ \
    config/ \
    --exclude="*.log" \
    --exclude="node_modules" \
    --exclude=".git"

# Upload files to VPS
print_status "Uploading files to VPS..."
scp deploy.tar.gz $VPS_USER@$VPS_HOST:/tmp/
rm deploy.tar.gz

# Deploy on VPS
print_status "Executing deployment on VPS..."
ssh $VPS_USER@$VPS_HOST << EOF
    set -e
    
    # Create app directory
    mkdir -p $APP_DIR
    cd $APP_DIR
    
    # Extract files
    tar -xzf /tmp/deploy.tar.gz
    rm /tmp/deploy.tar.gz
    
    # Create environment file if not exists
    if [ ! -f ".env" ]; then
        cp .env.example .env
        echo "Please edit .env file with your configuration"
    fi
    
    # Create data directories
    mkdir -p data/uploads data/tiles data/temp logs
    
    # Pull latest images
    docker-compose -f docker-compose.prod.yml pull
    
    # Stop existing containers
    docker-compose -f docker-compose.prod.yml down
    
    # Start new containers
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services
    sleep 15
    
    # Health check
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo "✅ Deployment successful!"
    else
        echo "⚠️  Deployment completed but health check failed"
        echo "Please check logs: docker-compose -f docker-compose.prod.yml logs"
    fi
    
    # Clean up old images
    docker system prune -f
EOF

print_status "✅ Deployment completed!"
print_info "🌐 Application should be available at: http://$VPS_HOST"
print_info "📊 Health check: http://$VPS_HOST/health"
echo ""
print_info "📋 Post-deployment commands:"
print_info "  SSH to VPS: ssh $VPS_USER@$VPS_HOST"
print_info "  View logs: docker-compose -f docker-compose.prod.yml logs -f"
print_info "  Restart: docker-compose -f docker-compose.prod.yml restart"
