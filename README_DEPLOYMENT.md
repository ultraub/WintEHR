# MedGenEMR Quick Deployment Guide

## 🚀 Fastest Start (Docker)

```bash
# Clone and start
git clone https://github.com/yourusername/MedGenEMR.git
cd MedGenEMR

# One command to rule them all
make fresh

# Or if you don't have make:
docker-compose up -d
```

Access at:
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Default login: testuser/testpass

## 📋 All Build Files Are Current

✅ **Backend**
- `Dockerfile` - Includes all dependencies, DICOM libraries, Java for Synthea
- `docker-entrypoint.sh` - Complete initialization with all schemas and tables
- `requirements.txt` - All Python dependencies including latest versions
- `.dockerignore` - Optimized build exclusions

✅ **Frontend**  
- `Dockerfile` - Multi-stage build with nginx
- `nginx.conf` - All API routes including pharmacy, DICOM, clinical
- `.dockerignore` - Excludes node_modules and build artifacts

✅ **Database**
- `init_complete.sql` - All schemas, tables, indexes, permissions
- `init_complete.sh` - Shell script for local initialization
- Automatic creation of: fhir schema, cds_hooks schema, search_params, resource_history

✅ **Docker Compose**
- PostgreSQL with health checks and init scripts
- Backend with proper entrypoint and volumes
- Frontend with nginx proxy
- All environment variables configured

✅ **Automation**
- `Makefile` - Common commands (make fresh, make build, make logs)
- `start_fresh.sh` - Comprehensive fresh start with options
- `synthea_master.py` - Complete data generation workflow

## 🔧 What Gets Initialized

1. **Database Tables**
   - fhir.resources (main FHIR storage)
   - fhir.search_params (search indexes)
   - fhir.resource_history (version tracking)
   - cds_hooks.hook_configurations

2. **Data Enhancement**
   - Lab results with reference ranges
   - Clean patient/provider names (no numbers)
   - DICOM files for imaging studies
   - Search parameter indexing

3. **Features Ready Out-of-Box**
   - ✅ Complete FHIR CRUD operations
   - ✅ Pharmacy dispensing workflows  
   - ✅ DICOM medical imaging viewer
   - ✅ Lab trends with reference ranges
   - ✅ Cross-module clinical workflows
   - ✅ Real-time notifications
   - ✅ CDS Hooks support

## 🛠️ Common Commands

```bash
# View logs
make logs
# or
docker-compose logs -f

# Generate more patients
docker-compose exec backend python scripts/synthea_master.py generate --count 10

# Access backend shell
make shell
# or
docker-compose exec backend bash

# Backup database
make db-backup

# Health check
make health
```

## 📝 Configuration

All configurable via environment variables:
- `JWT_ENABLED=false` (default, simple auth)
- `PATIENT_COUNT=20` (for data generation)
- `DATABASE_URL` (PostgreSQL connection)

See `docs/DEPLOYMENT_GUIDE.md` for comprehensive documentation.