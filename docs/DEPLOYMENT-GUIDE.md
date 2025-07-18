# MedGenEMR Deployment Guide

> Last Updated: 2025-01-18  
> Version: 2.0

## Overview

This guide provides comprehensive instructions for deploying MedGenEMR in both development and production environments. The deployment system has been redesigned to ensure reliable, repeatable deployments with proper patient data loading and hot reload capabilities.

## Quick Start

### Development Deployment (with hot reload)
```bash
# Fresh deployment with 20 patients and hot reload
./fresh-deploy.sh

# Custom patient count
./fresh-deploy.sh --patients 50

# Skip patient data (faster startup)
./fresh-deploy.sh --skip-data
```

### Production Deployment
```bash
# Production deployment with 100 patients
./fresh-deploy.sh --mode production --patients 100

# Production with existing data
./fresh-deploy.sh --mode production --skip-data
```

## Deployment Scripts

### 1. fresh-deploy.sh
**Purpose**: Complete clean deployment with patient data  
**Features**:
- Cleans existing Docker environment
- Initializes database with proper schemas
- Generates patient data via Synthea
- Creates DICOM imaging files
- Validates all services
- Configures environment-specific settings

**Options**:
- `--patients <count>`: Number of patients to generate (default: 20)
- `--mode <mode>`: development|production (default: development)
- `--skip-data`: Skip patient data generation
- `--verbose`: Enable detailed output

### 2. dev-start.sh (Coming Soon)
**Purpose**: Quick development startup with existing data  
**Features**:
- Starts services with hot reload
- Preserves existing patient data
- Minimal startup time
- Development tools enabled

### 3. dev-build.sh
**Purpose**: Development build with configurable options  
**Features**:
- Flexible build types (quick, full, validate)
- Hot reload configuration
- Custom patient counts
- Build caching

## Architecture Changes

### Docker Configuration

#### Development (docker-compose.dev.yml)
- **Frontend**: React dev server with hot reload on port 3000
- **Backend**: Uvicorn with --reload flag on port 8000
- **Database**: PostgreSQL on port 5432
- **Volumes**: Source code mounted for live updates

#### Production (docker-compose.yml)
- **Frontend**: Nginx serving optimized build on port 80
- **Backend**: Gunicorn with multiple workers on port 8000
- **Database**: PostgreSQL with production settings
- **Security**: JWT authentication, HTTPS ready

### Key Improvements

1. **Eliminated node_modules Volume Issues**
   - Removed problematic frontend_node_modules volume
   - Dependencies installed during build
   - Prevents version conflicts

2. **Fixed WebSocket Configuration**
   - Proper WDS_SOCKET configuration for Docker
   - Correct proxy settings for API calls
   - Reliable hot reload in containers

3. **Enhanced Health Checks**
   - Proper dependency chains
   - Accurate readiness detection
   - Automatic retry logic

## Development Workflow

### Initial Setup
```bash
# 1. Clone repository
git clone <repository-url>
cd MedGenEMR

# 2. Run fresh deployment
./fresh-deploy.sh

# 3. Access application
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
```

### Daily Development
```bash
# Start services (preserves data)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View logs
docker-compose logs -f backend  # Backend logs
docker-compose logs -f frontend # Frontend logs

# Stop services
docker-compose down
```

### Code Changes
- **Frontend**: Changes in `frontend/src` auto-reload
- **Backend**: Changes in `backend/` auto-reload
- **Database**: Schema changes require migration

## Production Deployment

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 8GB+ RAM
- 20GB+ disk space
- SSL certificates (for HTTPS)

### Deployment Steps

1. **Environment Preparation**
```bash
# Set production environment variables
export JWT_ENABLED=true
export JWT_SECRET="your-secure-secret"
export DATABASE_URL="postgresql+asyncpg://emr_user:secure_password@postgres:5432/emr_db"
export ALLOWED_ORIGINS="https://your-domain.com"
```

2. **SSL Configuration**
```bash
# Place certificates in
mkdir -p nginx/certs
cp your-cert.crt nginx/certs/
cp your-cert.key nginx/certs/
```

3. **Deploy**
```bash
# Full production deployment
./fresh-deploy.sh --mode production --patients 100

# Or use docker-compose directly
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

4. **Post-Deployment**
```bash
# Verify deployment
python scripts/validate_deployment.py --verbose

# Create admin user
docker exec emr-backend python scripts/create_admin_user.py

# Backup database
docker exec emr-postgres pg_dump -U emr_user emr_db > backup.sql
```

## Patient Data Management

### Synthea Integration
The deployment uses `synthea_master.py` for comprehensive patient data:

```bash
# Generate patients only
docker exec emr-backend python scripts/active/synthea_master.py generate --count 50

# Import existing Synthea data
docker exec emr-backend python scripts/active/synthea_master.py import

# Full workflow with DICOM
docker exec emr-backend python scripts/active/synthea_master.py full --count 20 --include-dicom
```

### Data Validation
```bash
# Validate FHIR resources
docker exec emr-backend python scripts/validate_fhir_data.py

# Check search parameters
docker exec emr-backend python scripts/validate_search_params.py

# Verify clinical data
docker exec emr-backend python scripts/validate_clinical_data.py
```

## Troubleshooting

### Common Issues

1. **Frontend not loading**
   - Check: `docker-compose logs frontend`
   - Fix: Clear browser cache, rebuild frontend

2. **API connection errors**
   - Check: `docker-compose logs backend`
   - Fix: Verify proxy configuration, check CORS settings

3. **Database connection failed**
   - Check: `docker exec emr-postgres pg_isready`
   - Fix: Ensure PostgreSQL started first, check credentials

4. **Hot reload not working**
   - Check: Volume mounts in docker-compose.dev.yml
   - Fix: Ensure CHOKIDAR_USEPOLLING=true is set

### Debug Commands
```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs -f [service-name]

# Execute commands in container
docker exec -it emr-backend bash
docker exec -it emr-frontend sh

# Database queries
docker exec emr-postgres psql -U emr_user -d emr_db

# API health check
curl http://localhost:8000/api/health

# Frontend health check
curl http://localhost:3000
```

## Performance Optimization

### Development
- Use `--skip-data` for faster restarts
- Mount only necessary directories
- Use `.dockerignore` to exclude large files

### Production
- Enable Docker BuildKit: `export DOCKER_BUILDKIT=1`
- Use multi-stage builds
- Configure proper resource limits
- Enable response compression
- Use CDN for static assets

## Security Considerations

### Development
- JWT disabled for easy testing
- CORS allows all origins
- Debug mode enabled
- Demo users available

### Production
- JWT authentication required
- CORS restricted to specific domains
- Debug mode disabled
- Strong passwords enforced
- HTTPS required
- Security headers enabled

## Monitoring

### Health Endpoints
- Backend: `GET /api/health`
- Frontend: `GET /` (200 response)
- Database: PostgreSQL health checks

### Logging
- Application logs: `docker-compose logs`
- Access logs: Nginx logs in production
- Error tracking: Configure Sentry (optional)

### Metrics
- Resource usage: `docker stats`
- Database metrics: `pg_stat_statements`
- API metrics: Custom middleware

## Maintenance

### Backup Procedures
```bash
# Database backup
docker exec emr-postgres pg_dump -U emr_user emr_db | gzip > backup_$(date +%Y%m%d).sql.gz

# Application data backup
tar -czf data_backup_$(date +%Y%m%d).tar.gz backend/data/

# Full backup script
./scripts/backup.sh
```

### Update Procedures
```bash
# 1. Backup current deployment
./scripts/backup.sh

# 2. Pull latest code
git pull origin main

# 3. Rebuild and deploy
./fresh-deploy.sh --mode production

# 4. Run migrations if needed
docker exec emr-backend python scripts/active/migration_runner.py --run-pending

# 5. Validate deployment
docker exec emr-backend python scripts/validate_deployment.py
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to server
        run: |
          ssh user@server 'cd /app/MedGenEMR && ./fresh-deploy.sh --mode production'
```

## Support

### Documentation
- [CLAUDE.md](../CLAUDE.md) - AI agent reference
- [API Documentation](http://localhost:8000/docs)
- [Module Guides](./modules/)

### Getting Help
- Check logs first: `docker-compose logs`
- Review this guide's troubleshooting section
- Submit issues to GitHub repository

---

**Remember**: Always test deployments in development before applying to production. Use the `--verbose` flag for detailed output when troubleshooting.