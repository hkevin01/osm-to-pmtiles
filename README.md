# OSM to PMTiles

A high-performance system for converting OpenStreetMap (OSM) .pbf files to PMTiles format for efficient web mapping applications.

## 🚀 Features

- **Fast Conversion**: Efficient OSM .pbf to PMTiles conversion
- **Web Interface**: User-friendly upload and management interface
- **Layer Control**: Filter and toggle between different map layers
- **High Performance**: Optimized for smooth loading and rendering
- **VPS Ready**: Designed for deployment on Virtual Private Servers
- **Scalable**: Handle large OSM datasets efficiently

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │  Backend API    │    │  Conversion     │
│   (React/Vue)   │◄──►│   (Node.js)     │◄──►│   Engine        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │   File Storage  │
                       │   + PostGIS     │    │   (PMTiles)     │
                       └─────────────────┘    └─────────────────┘
```

## 🛠️ Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: React with Mapbox GL JS
- **Database**: PostgreSQL + PostGIS
- **Conversion**: Tippecanoe
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- Git

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/osm-to-pmtiles.git
   cd osm-to-pmtiles
   ```

2. **Start with Docker**
   ```bash
   docker-compose up -d
   ```

3. **Access the application**
   - Web Interface: http://localhost:3000
   - API: http://localhost:3001

## 📁 Project Structure

```
osm-to-pmtiles/
├── src/                    # Source code
│   ├── backend/           # Backend API and services
│   ├── frontend/          # React web application
│   ├── converter/         # OSM to PMTiles conversion logic
│   └── utils/             # Shared utilities
├── scripts/               # Build and deployment scripts
├── config/                # Configuration files
├── docs/                  # Documentation
├── .github/               # GitHub workflows and templates
└── .copilot/              # GitHub Copilot configuration
```

## 🔧 Development

### Backend Development
```bash
cd src/backend
npm install
npm run dev
```

### Frontend Development
```bash
cd src/frontend
npm install
npm start
```

### Running Tests
```bash
npm test
```

## 📊 Performance

- **File Support**: Up to 10GB OSM .pbf files
- **Conversion Speed**: City-level data in <30 minutes
- **Tile Serving**: <100ms response time
- **Concurrent Users**: 100+ simultaneous users

## 🚢 Deployment

### VPS Deployment
1. Configure your VPS with Docker
2. Clone the repository
3. Set up environment variables
4. Run `docker-compose -f docker-compose.prod.yml up -d`

### Environment Variables
```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=osmtiles
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# API
API_PORT=3001
UPLOAD_MAX_SIZE=10GB

# Frontend
REACT_APP_API_URL=http://localhost:3001
```

## 📚 Documentation

- [API Documentation](docs/api.md)
- [Deployment Guide](docs/deployment.md)
- [Configuration](docs/configuration.md)
- [Contributing](docs/contributing.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Create an [issue](https://github.com/yourusername/osm-to-pmtiles/issues) for bugs or feature requests
- Check the [documentation](docs/) for detailed guides
- Join our community discussions

## 🙏 Acknowledgments

- [OpenStreetMap](https://www.openstreetmap.org/) for the data
- [Tippecanoe](https://github.com/mapbox/tippecanoe) for vector tile generation
- [PMTiles](https://github.com/protomaps/PMTiles) for the efficient tile format
