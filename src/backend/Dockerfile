FROM node:18-alpine

# Install OSM processing tools
RUN apk add --no-cache \
    python3 \
    py3-pip \
    build-base \
    sqlite \
    sqlite-dev \
    zlib-dev \
    gdal \
    gdal-dev \
    gdal-tools \
    curl \
    && pip3 install --break-system-packages tippecanoe \
    && curl -L -o /usr/local/bin/pmtiles "https://github.com/protomaps/go-pmtiles/releases/download/v1.11.1/pmtiles_linux_x86_64" \
    && chmod +x /usr/local/bin/pmtiles

WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create necessary directories
RUN mkdir -p data/uploads data/tiles data/temp logs

# Expose port
EXPOSE 3001

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["npm", "start"]
