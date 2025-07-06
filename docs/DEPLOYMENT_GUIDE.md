# MedGenEMR Deployment Guide

## Table of Contents
1. [System Requirements](#system-requirements)
2. [Quick Start](#quick-start)
3. [Installation Methods](#installation-methods)
4. [Configuration](#configuration)
5. [Data Management](#data-management)
6. [Troubleshooting](#troubleshooting)
7. [Production Considerations](#production-considerations)

## System Requirements

### Minimum Requirements
- **Operating System**: macOS, Linux, or Windows with WSL2
- **Memory**: 8GB RAM (16GB recommended)
- **Storage**: 10GB free space (20GB recommended for full data)
- **CPU**: 4 cores (8 cores recommended)

### Software Dependencies
- Docker & Docker Compose (latest version)
- Python 3.9+ (for local development)
- Node.js 16+ (for local development)
- PostgreSQL 15+ (if not using Docker)

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/MedGenEMR.git
cd MedGenEMR
```

### 2. Option A: Docker Compose (Recommended)
```bash
# Start everything with pre-loaded data
docker-compose up -d

# View logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
```

### 2. Option B: Fresh Start Script
```bash
# Run comprehensive initialization with 20 patients
cd backend
./scripts/start_fresh.sh --patients 20

# Options:
# --no-wipe       Don't wipe the database
# --no-stop       Don't stop existing services
# --clean-files   Clean generated files
# --yes           Skip confirmation prompts
```

### 2. Option C: Manual Start
```bash
# Start the system
./start.sh

# In a separate terminal, initialize data
cd backend
python scripts/synthea_master.py full --count 20 --include-dicom --clean-names
```

## Installation Methods

### Docker Deployment (Production-Ready)

1. **Environment Setup**
```bash
# Create .env file
cat > .env << EOF
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=emr_password
POSTGRES_DB=emr_db
JWT_ENABLED=false
JWT_SECRET=your-secret-key-change-in-production
ANTHROPIC_API_KEY=your-api-key-if-using-ai-features
EOF
```

2. **Build and Start**
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Initialize database (first time only)
docker-compose exec backend bash -c "cd /app && python scripts/init_complete.sh"
```

3. **Verify Installation**
```bash
# Check service health
curl http://localhost:8000/health
curl http://localhost:3000

# Check FHIR endpoints
curl http://localhost:8000/fhir/R4/Patient
```

### Local Development Setup

1. **Backend Setup**
```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL (if not using Docker)
# Configure connection in DATABASE_URL environment variable

# Initialize database
python scripts/init_database.py
python scripts/init_search_tables.py

# Start backend
python main.py
```

2. **Frontend Setup**
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

## Configuration

### Authentication Modes

1. **Training Mode (Default)**
```bash
# No JWT required, simple username/password
JWT_ENABLED=false
# Default credentials: testuser/testpass
```

2. **JWT Authentication (Production)**
```bash
JWT_ENABLED=true
JWT_SECRET=your-secure-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440
```

### Database Configuration

```bash
# PostgreSQL connection
DATABASE_URL=postgresql://emr_user:emr_password@localhost:5432/emr_db

# Connection pool settings
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
DB_POOL_TIMEOUT=30
```

### FHIR Server Settings

```bash
# FHIR validation
FHIR_VALIDATION_MODE=strict  # Options: strict, lenient, off

# Search indexing
SEARCH_INDEX_BATCH_SIZE=100
SEARCH_INDEX_WORKERS=4
```

## Data Management

### Generate Synthetic Data

```bash
cd backend

# Full workflow with all features
python scripts/synthea_master.py full \
  --count 50 \
  --include-dicom \
  --clean-names \
  --validation-mode transform_only

# Individual operations
python scripts/synthea_master.py setup      # Install Synthea
python scripts/synthea_master.py generate    # Generate patients
python scripts/synthea_master.py wipe        # Clear database
python scripts/synthea_master.py import      # Import data
python scripts/synthea_master.py validate    # Validate data
```

### Enhance Imported Data

```bash
# Add reference ranges to lab results
python scripts/enhance_lab_results.py

# Clean patient/provider names (remove numeric suffixes)
python scripts/clean_fhir_names.py

# Generate DICOM files for imaging studies
python scripts/enhance_imaging_import.py generate-dicoms
```

### Database Operations

```bash
# Backup database
docker-compose exec postgres pg_dump -U emr_user emr_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U emr_user emr_db < backup.sql

# Clear all data
python scripts/synthea_master.py wipe
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
```bash
# Find and kill processes
lsof -ti:3000 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

2. **Database Connection Failed**
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
PGPASSWORD=emr_password psql -h localhost -U emr_user -d emr_db -c "SELECT 1"
```

3. **Missing Search Results**
```bash
# Rebuild search indexes
cd backend
python scripts/init_search_tables.py
```

4. **DICOM Viewer Not Loading Images**
```bash
# Regenerate DICOM files
python scripts/enhance_imaging_import.py generate-dicoms

# Check file permissions
chmod -R 755 data/dicom_uploads/
```

5. **CDS Hooks Error**
```bash
# Initialize CDS Hooks schema
PGPASSWORD=emr_password psql -h localhost -U emr_user -d emr_db -c "CREATE SCHEMA IF NOT EXISTS cds_hooks"
```

### Logs and Debugging

```bash
# View all logs
docker-compose logs -f

# Backend logs only
docker-compose logs -f backend

# Frontend build logs
docker-compose logs -f frontend

# PostgreSQL logs
docker-compose logs -f postgres
```

## Production Considerations

### Security

1. **Enable JWT Authentication**
```bash
JWT_ENABLED=true
JWT_SECRET=$(openssl rand -base64 32)
```

2. **Use HTTPS**
- Configure nginx with SSL certificates
- Update CORS settings in backend
- Use secure WebSocket connections

3. **Database Security**
- Change default passwords
- Use SSL for database connections
- Enable row-level security for multi-tenant deployments

### Performance Optimization

1. **Database Indexes**
```sql
-- Already included in init scripts
CREATE INDEX idx_search_params_composite ON fhir.search_params(resource_type, param_name, value_string);
CREATE INDEX idx_resources_type_updated ON fhir.resources(resource_type, last_updated DESC);
```

2. **Caching**
- Enable Redis for session management
- Use query result caching
- Implement FHIR resource caching

3. **Scaling**
- Use connection pooling
- Enable database read replicas
- Implement horizontal scaling for backend

### Monitoring

1. **Health Checks**
```yaml
# docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

2. **Metrics Collection**
- Prometheus endpoint: `/metrics`
- OpenTelemetry support included
- Custom clinical workflow metrics

### Backup Strategy

```bash
# Automated daily backups
0 2 * * * docker-compose exec -T postgres pg_dump -U emr_user emr_db | gzip > backup_$(date +\%Y\%m\%d).sql.gz

# Backup DICOM files
tar -czf dicom_backup_$(date +\%Y\%m\%d).tar.gz backend/data/dicom_uploads/
```

## Feature Flags

Control feature availability through environment variables:

```bash
# Enable/disable features
FEATURE_PHARMACY_WORKFLOWS=true
FEATURE_IMAGING_VIEWER=true
FEATURE_CDS_HOOKS=true
FEATURE_CLINICAL_NOTES=true
FEATURE_PATIENT_PORTAL=false
```

## Support and Resources

- **Documentation**: `/docs` directory
- **API Documentation**: http://localhost:8000/docs
- **FHIR Conformance**: http://localhost:8000/fhir/R4/metadata
- **Issue Tracking**: GitHub Issues
- **Community Support**: Discord/Slack channel

## Appendix: Complete Feature List

✅ **Core Features**
- FHIR R4 compliant storage
- Complete CRUD operations
- Advanced search with reference resolution
- Batch/Transaction support
- Resource versioning and history

✅ **Clinical Workflows**
- Problem list management
- Medication prescribing
- Order entry and results
- Clinical notes
- Care planning

✅ **Advanced Features**
- Pharmacy dispensing workflows
- DICOM medical imaging viewer
- Lab result trends with reference ranges
- Cross-module workflow integration
- Real-time WebSocket notifications
- CDS Hooks integration

✅ **Data Features**
- Synthea data import
- Reference range enhancement
- Name cleaning utilities
- DICOM file generation
- Search parameter indexing