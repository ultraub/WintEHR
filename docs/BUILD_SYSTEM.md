# WintEHR Build System Documentation

**Last Updated:** 2025-01-11  
**Version:** 2.0 - Modular Deployment System

## 🚀 Quick Start

```bash
# Complete fresh deployment (recommended for first time)
./scripts/master-deploy.sh --clean --patients=10

# Standard development deployment
./scripts/master-deploy.sh

# Production deployment with more data
./scripts/master-deploy.sh --production --patients=50
```

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Master Deployment Script](#master-deployment-script)
4. [Deployment Modules](#deployment-modules)
5. [Database Scripts](#database-scripts)
6. [Data Processing](#data-processing)
7. [Troubleshooting](#troubleshooting)
8. [Migration Guide](#migration-guide)

## 🏗️ Overview

The WintEHR build system has been completely modernized with a modular, bulletproof deployment architecture that ensures:

- **Zero manual intervention** required
- **Schema preservation** during all operations
- **Cross-platform compatibility** (Windows/Mac/Linux)
- **Comprehensive validation** at every step
- **Proper error handling** and recovery

### Key Improvements

- ✅ Single entry point for all deployments
- ✅ Modular architecture for maintainability
- ✅ Automatic line ending fixes
- ✅ Port conflict detection
- ✅ Schema-safe data operations
- ✅ Comprehensive system validation
- ✅ Nginx configuration for manifest.json
- ✅ DICOM generation integration

## 🔧 Architecture

```
scripts/
├── master-deploy.sh          # Main entry point
├── modules/                  # Deployment phases
│   ├── 00-environment-setup.sh
│   ├── 01-database-init.sh
│   ├── 02-data-generation.sh
│   ├── 03-data-import.sh
│   ├── 04-data-processing.sh
│   ├── 05-nginx-config.sh
│   └── 06-validation.sh
└── archive-old-scripts.sh    # Clean up old scripts

backend/scripts/
├── init_database_unified.py  # Consolidated DB init
├── data_processor.py         # Data processing
└── synthea_master.py         # Patient generation
```

## 📜 Master Deployment Script

### Usage

```bash
./scripts/master-deploy.sh [OPTIONS]
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--development` | Development mode (faster, less data) | ✓ |
| `--production` | Production mode (full data, optimizations) | |
| `--patients=N` | Number of patients to generate | 5 |
| `--skip-build` | Skip Docker build (use existing images) | false |
| `--skip-data` | Skip data generation (use existing data) | false |
| `--clean` | Force clean deployment (remove all data) | false |
| `--help` | Show help message | |

### Examples

```bash
# First time setup
./scripts/master-deploy.sh --clean --patients=10

# Quick restart (keeping data)
./scripts/master-deploy.sh --skip-data

# Production deployment
./scripts/master-deploy.sh --production --patients=20 --clean

# Development with specific patient count
./scripts/master-deploy.sh --patients=15
```

### Deployment Phases

1. **Environment Setup** - Docker cleanup, permissions, line endings
2. **Database Init** - Complete schema creation with validation
3. **Data Generation** - Synthea patient data creation
4. **Data Import** - Safe FHIR import preserving schema
5. **Data Processing** - Name cleaning, CDS hooks, DICOM
6. **Configuration** - Nginx setup for static files
7. **Validation** - Comprehensive system testing

## 🔨 Deployment Modules

### 00-environment-setup.sh

**Purpose:** Prepare the deployment environment

- Stops existing containers
- Cleans Docker resources (optional)
- Fixes file permissions
- Corrects line endings
- Verifies Docker environment
- Checks port availability
- Creates directory structure
- Starts PostgreSQL

### 01-database-init.sh

**Purpose:** Initialize complete database schema

- Creates FHIR schema with all tables
- Creates CDS Hooks schema
- Sets up performance indexes
- Creates database triggers
- Tests CRUD operations
- Verifies schema integrity

**Key Tables Created:**
- `fhir.resources` - Main FHIR resource storage
- `fhir.resource_history` - Version tracking
- `fhir.search_params` - Search optimization
- `fhir.references` - Reference tracking
- `cds_hooks.hook_configurations` - CDS Hooks

### 02-data-generation.sh

**Purpose:** Generate synthetic patient data

- Sets up Synthea environment
- Configures generation parameters
- Generates FHIR bundles
- Validates generated data
- Creates generation metadata

**Configuration by Mode:**
- Development: 5 years of history
- Production: 10 years of history

### 03-data-import.sh

**Purpose:** Import FHIR data safely

- Verifies schema integrity
- Clears existing data (preserves schema)
- Imports FHIR bundles
- Creates search parameters
- Validates imported data
- Tests FHIR API access

### 04-data-processing.sh

**Purpose:** Process and enhance imported data

- Cleans patient/provider names
- Creates sample CDS hooks
- Generates DICOM files
- Validates cross-references
- Optimizes for performance
- Creates processing summary

### 05-nginx-config.sh

**Purpose:** Configure nginx for proper serving

- Updates nginx.conf
- Configures manifest.json serving
- Sets up API proxies
- Enables WebSocket support
- Applies security headers
- Tests configuration

### 06-validation.sh

**Purpose:** Comprehensive system validation

- Container health checks
- Database schema validation
- API endpoint testing
- Frontend accessibility
- Integration testing
- Performance benchmarking
- Security validation

## 💾 Database Scripts

### init_database_unified.py

Consolidated database initialization script that replaces all previous versions.

```bash
# Full initialization
python backend/scripts/init_database_unified.py

# Production mode
python backend/scripts/init_database_unified.py --mode=production

# Verify existing schema only
python backend/scripts/init_database_unified.py --verify-only
```

**Features:**
- Complete FHIR R4 schema
- CDS Hooks configuration
- Performance indexes
- Automated triggers
- CRUD validation
- Comprehensive logging

### data_processor.py

Automated data processing for quality improvements.

```bash
# Clean names only
python backend/scripts/data_processor.py --clean-names

# Validate references
python backend/scripts/data_processor.py --validate-references

# Fix reference issues
python backend/scripts/data_processor.py --validate-references --fix

# Optimize search parameters
python backend/scripts/data_processor.py --optimize-search-params

# Run complete pipeline
python backend/scripts/data_processor.py --full-process

# Dry run mode
python backend/scripts/data_processor.py --clean-names --dry-run
```

**Processing Operations:**
- Remove numbers from patient/provider names
- Validate FHIR references
- Fix orphaned resources
- Optimize search parameters
- Analyze data quality
- Generate processing reports

## 🔍 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Error: Port 80/8000 already in use
# Solution: The script automatically frees ports
# Manual fix:
lsof -ti:80 | xargs kill -9
lsof -ti:8000 | xargs kill -9
```

#### Docker Memory
```bash
# Error: Docker memory insufficient
# Solution: Increase Docker Desktop memory to 4GB+
# Check current:
docker system info | grep Memory
```

#### Database Connection
```bash
# Error: Cannot connect to database
# Solution: Ensure PostgreSQL container is running
docker-compose ps postgres
docker-compose up -d postgres
```

#### Schema Issues
```bash
# Error: Missing tables or columns
# Solution: Run unified database init
docker exec emr-backend python scripts/init_database_unified.py
```

### Validation Failures

If validation fails, check the detailed log:
```bash
# View latest validation log
cat logs/validation-*.log | tail -50

# Check specific service
docker-compose logs backend -f
docker-compose logs frontend -f
docker-compose logs postgres -f
```

### Recovery Options

```bash
# Full reset and retry
./scripts/master-deploy.sh --clean

# Just rebuild containers
docker-compose build --no-cache
./scripts/master-deploy.sh --skip-data

# Reset database only
docker-compose down -v
docker-compose up -d postgres
docker exec emr-backend python scripts/init_database_unified.py
```

## 🔄 Migration Guide

### From Old Scripts

If you were using the old deployment scripts:

```bash
# Archive old scripts
./scripts/archive-old-scripts.sh

# Replace old commands:
# OLD: ./fresh-deploy.sh
# NEW: ./scripts/master-deploy.sh --clean

# OLD: ./deploy.sh
# NEW: ./scripts/master-deploy.sh --production

# OLD: ./start.sh
# NEW: ./scripts/master-deploy.sh
```

### Database Migration

The new system preserves existing data:

```bash
# Verify existing schema
python backend/scripts/init_database_unified.py --verify-only

# If schema is outdated, reinitialize
python backend/scripts/init_database_unified.py
```

### Environment Variables

Ensure these are set appropriately:

```bash
# Development (default)
export JWT_ENABLED=false
export NODE_ENV=development

# Production
export JWT_ENABLED=true
export NODE_ENV=production
```

## 📊 Performance Tips

### Development Mode
- Use `--patients=5` for quick testing
- Enable `--skip-data` for restart without regeneration
- Use `--skip-build` when code hasn't changed

### Production Mode
- Always use `--clean` for fresh deployments
- Generate sufficient test data (`--patients=20+`)
- Allow extra time for optimizations

### Resource Requirements
- **Minimum:** 2GB RAM, 2GB disk space
- **Recommended:** 4GB RAM, 5GB disk space
- **Production:** 8GB+ RAM, 10GB+ disk space

## 🔐 Security Considerations

The build system implements several security measures:

- ✅ Automatic security header configuration
- ✅ CORS handling for API endpoints
- ✅ Proper authentication mode setup
- ✅ Secure WebSocket configuration
- ✅ No hardcoded secrets in scripts

## 📈 Monitoring Deployment

### Real-time Logs
```bash
# Watch all services
docker-compose logs -f

# Specific service
docker-compose logs backend -f --tail=100
```

### Progress Tracking
Each module provides detailed progress output:
- 🔍 Current operation
- ✅ Completed steps
- ⚠️ Warnings
- ❌ Errors with solutions

### Summary Reports
Generated in `logs/` directory:
- `validation-*.log` - System validation results
- `nginx-config-summary.txt` - Nginx configuration
- `logs/validation-status.json` - Machine-readable status

## 🎯 Best Practices

1. **Always run `--clean` for first deployment**
2. **Use `--skip-data` for code-only changes**
3. **Monitor logs during deployment**
4. **Check validation summary after completion**
5. **Keep backups of production data**
6. **Test in development mode first**
7. **Document any custom modifications**

## 📚 Additional Resources

- [CLAUDE.md](../CLAUDE.md) - Development guidelines
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Production deployment
- [API_ENDPOINTS.md](../docs/API_ENDPOINTS.md) - API documentation
- [Docker Compose Reference](../docker-compose.yml)

---

**Need Help?** Check the troubleshooting section or run:
```bash
./scripts/master-deploy.sh --help
```