# Deployment Guide

This guide covers deploying the OSM to PMTiles application to a VPS (Virtual Private Server).

## Prerequisites

### VPS Requirements
- **Operating System**: Ubuntu 20.04+ or CentOS 8+
- **CPU**: 4+ cores (8+ recommended for large files)
- **RAM**: 16GB+ (32GB+ recommended)
- **Storage**: 100GB+ SSD space
- **Network**: High bandwidth for file uploads

### Software Requirements
- Docker and Docker Compose
- Git
- SSH access to VPS
- Domain name (optional but recommended)

## VPS Setup

### 1. Initial Server Setup

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip htop

# Create application user
sudo useradd -m -s /bin/bash osm
sudo usermod -aG sudo osm
```

### 2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
sudo usermod -aG docker osm

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Start Docker service
sudo systemctl enable docker
sudo systemctl start docker
```

### 3. Configure Firewall

```bash
# Install UFW if not already installed
sudo apt install -y ufw

# Configure firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 4. Setup SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot

# Get SSL certificate (replace with your domain)
sudo certbot certonly --standalone -d yourdomain.com

# Set up automatic renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Application Deployment

### 1. Clone Repository

```bash
# Switch to application user
sudo su - osm

# Create application directory
sudo mkdir -p /opt/osm-to-pmtiles
sudo chown osm:osm /opt/osm-to-pmtiles
cd /opt/osm-to-pmtiles

# Clone repository
git clone https://github.com/yourusername/osm-to-pmtiles.git .
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Important environment variables to configure:**

```env
# Database
POSTGRES_PASSWORD=your_secure_database_password

# API Configuration
ALLOWED_ORIGINS=https://yourdomain.com

# Frontend
REACT_APP_API_URL=https://yourdomain.com

# Mapbox (get token from https://mapbox.com)
REACT_APP_MAPBOX_TOKEN=your_mapbox_token

# Security
JWT_SECRET=your_secure_jwt_secret_32_chars_min
SESSION_SECRET=your_secure_session_secret
```

### 3. Create Data Directories

```bash
# Create necessary directories
mkdir -p data/{uploads,tiles,temp,osm}
mkdir -p logs/{app,nginx}
mkdir -p config/ssl

# Set proper permissions
chmod 755 data logs config
chmod 777 data/uploads data/tiles data/temp
```

### 4. Configure Production Services

Create production nginx configuration:

```bash
# Create nginx config for production
cat > config/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;

    upstream backend {
        server backend:3001;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header Strict-Transport-Security "max-age=63072000" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;

        client_max_body_size 10G;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Upload endpoint with special rate limiting
        location /api/upload {
            limit_req zone=upload burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
        }
    }
}
EOF
```

### 5. Setup SSL Certificates

```bash
# Copy SSL certificates to config directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem config/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem config/ssl/key.pem
sudo chown osm:osm config/ssl/*.pem
```

### 6. Deploy Application

#### Option A: Using the Deploy Script

```bash
# Set environment variables
export VPS_HOST=yourdomain.com
export VPS_USER=osm

# Run deployment script from local machine
./scripts/deploy.sh
```

#### Option B: Manual Deployment

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Post-Deployment

### 1. Verify Installation

```bash
# Check if services are running
docker ps

# Test health endpoint
curl -f https://yourdomain.com/health

# Test API
curl https://yourdomain.com/api/tiles
```

### 2. Setup Monitoring

```bash
# Install system monitoring
sudo apt install -y htop iotop

# Create monitoring script
cat > /opt/osm-to-pmtiles/scripts/monitor.sh << 'EOF'
#!/bin/bash
echo "=== System Resources ==="
free -h
df -h
echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "=== Application Logs (last 20 lines) ==="
docker-compose -f /opt/osm-to-pmtiles/docker-compose.prod.yml logs --tail=20 backend
EOF

chmod +x /opt/osm-to-pmtiles/scripts/monitor.sh
```

### 3. Setup Backups

```bash
# Create backup script
cat > /opt/osm-to-pmtiles/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/osm-to-pmtiles"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup database
docker exec osm_db_prod pg_dump -U postgres osmtiles | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup data directory
tar -czf $BACKUP_DIR/data_$DATE.tar.gz -C /opt/osm-to-pmtiles data/

# Keep only last 7 backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x /opt/osm-to-pmtiles/scripts/backup.sh

# Setup cron job for daily backups
echo "0 2 * * * /opt/osm-to-pmtiles/scripts/backup.sh" | sudo crontab -u osm -
```

### 4. Log Rotation

```bash
# Configure log rotation
sudo cat > /etc/logrotate.d/osm-to-pmtiles << 'EOF'
/opt/osm-to-pmtiles/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 osm osm
    postrotate
        docker-compose -f /opt/osm-to-pmtiles/docker-compose.prod.yml restart
    endscript
}
EOF
```

## Maintenance

### Regular Tasks

1. **System Updates**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo reboot  # if kernel updates
   ```

2. **Docker Cleanup**
   ```bash
   docker system prune -f
   docker volume prune -f
   ```

3. **Application Updates**
   ```bash
   cd /opt/osm-to-pmtiles
   git pull origin main
   docker-compose -f docker-compose.prod.yml build
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Scaling Considerations

For high-traffic deployments:

1. **Load Balancing**: Use multiple backend instances
2. **Database Scaling**: Consider read replicas
3. **Storage**: Use object storage (S3, MinIO)
4. **CDN**: Implement CDN for tile serving
5. **Monitoring**: Use Prometheus/Grafana

### Troubleshooting

Common issues and solutions:

1. **Out of disk space**
   ```bash
   df -h
   docker system prune -af
   rm -rf /opt/osm-to-pmtiles/data/temp/*
   ```

2. **High memory usage**
   ```bash
   free -h
   docker stats
   # Restart services if needed
   docker-compose -f docker-compose.prod.yml restart
   ```

3. **Database connection issues**
   ```bash
   docker logs osm_db_prod
   docker exec osm_db_prod pg_isready -U postgres
   ```

4. **SSL certificate renewal**
   ```bash
   sudo certbot renew
   cp /etc/letsencrypt/live/yourdomain.com/* /opt/osm-to-pmtiles/config/ssl/
   docker-compose -f docker-compose.prod.yml restart nginx
   ```

## Security Checklist

- [ ] Firewall configured properly
- [ ] SSL certificates installed and auto-renewing
- [ ] Strong passwords for database and secrets
- [ ] Regular security updates applied
- [ ] Backup strategy implemented
- [ ] Log monitoring in place
- [ ] Rate limiting configured
- [ ] File upload validation enabled
- [ ] CORS properly configured
- [ ] Security headers implemented

## Performance Optimization

1. **Database Tuning**
   - Increase shared_buffers
   - Optimize work_mem
   - Enable connection pooling

2. **File Storage**
   - Use SSD storage
   - Implement compression
   - Regular cleanup of temp files

3. **Caching**
   - Enable Redis caching
   - Implement CDN for tiles
   - Browser caching headers

4. **Resource Limits**
   - Set appropriate memory limits
   - Configure CPU limits
   - Monitor resource usage
