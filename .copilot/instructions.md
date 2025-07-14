# GitHub Copilot Instructions for OSM to PMTiles Project

## Project Context
This is a GIS application for converting OpenStreetMap (OSM) .pbf files to PMTiles format. The project focuses on high-performance map tile generation and serving for web applications.

## Key Technologies
- **Backend**: Node.js, Express.js, PostgreSQL with PostGIS
- **Frontend**: React, Mapbox GL JS, TypeScript
- **Processing**: Tippecanoe for vector tile generation
- **Storage**: PMTiles format for efficient tile serving
- **Infrastructure**: Docker, VPS deployment

## Code Style Preferences
- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Implement comprehensive error handling
- Write unit tests for all core functionality
- Use async/await over Promises
- Prefer functional programming patterns where appropriate

## Architecture Patterns
- Clean architecture with separation of concerns
- Repository pattern for data access
- Service layer for business logic
- RESTful API design
- Event-driven processing for file conversions

## File Naming Conventions
- Use kebab-case for files and directories
- Use PascalCase for React components
- Use camelCase for functions and variables
- Add `.test.js` or `.spec.js` suffix for test files

## Common Tasks
- OSM data parsing and validation
- Vector tile generation and optimization
- Map rendering and layer management
- File upload and processing pipelines
- Performance monitoring and optimization

## Security Considerations
- Validate all file uploads
- Implement rate limiting for API endpoints
- Sanitize user inputs
- Use environment variables for sensitive configuration

## Performance Focus
- Optimize for large file processing
- Implement efficient caching strategies
- Use streaming for file operations
- Monitor memory usage and garbage collection

## Documentation Standards
- Include JSDoc comments for all functions
- Maintain up-to-date README files
- Document API endpoints with OpenAPI/Swagger
- Provide setup and deployment guides

When generating code, prioritize:
1. Performance and scalability
2. Error handling and logging
3. Type safety
4. Code maintainability
5. Test coverage
