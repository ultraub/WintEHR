# WintEHR Simplified Deployment Guide

**Version**: 3.0  
**Last Updated**: 2025-07-26

## 🎯 Overview

We've dramatically simplified WintEHR deployment by consolidating multiple scripts into two main commands:
- `./deploy.sh` - All deployment operations
- `python manage_data.py` - All data management operations

## 🚀 Quick Start

### Development Deployment (Recommended)
```bash
# Quick start with 20 patients
./deploy.sh dev

# Custom patient count
./deploy.sh dev --patients 50
```

### Production Deployment
```bash
# Production mode with all optimizations
./deploy.sh prod --patients 100
```

### Other Operations
```bash
# Check system status
./deploy.sh status

# Stop all services
./deploy.sh stop

# Clean deployment (removes all data)
./deploy.sh clean
```

## 📊 Data Management

All data operations are now handled through a single Python script:

```bash
# Load patient data
docker exec emr-backend python scripts/manage_data.py load --patients 20

# Index search parameters
docker exec emr-backend python scripts/manage_data.py index

# Validate all data
docker exec emr-backend python scripts/manage_data.py validate --verbose

# Check data status
docker exec emr-backend python scripts/manage_data.py status

# Clean all data (requires confirmation)
docker exec emr-backend python scripts/manage_data.py clean --confirm
```

## 🔄 Migration from Old Scripts

### Deployment Scripts

| Old Command | New Command |
|-------------|-------------|
| `./fresh-deploy.sh` | `./deploy.sh clean` |
| `./dev-start.sh` | `./deploy.sh dev` |
| `./production-deploy-complete.sh` | `./deploy.sh prod` |
| `./scripts/master-deploy.sh` | `./deploy.sh prod` |
| `./load-patients.sh` | Automatic in deploy.sh |
| `./check-wintehr-status.sh` | `./deploy.sh status` |

### Data Scripts

| Old Script | New Command |
|------------|-------------|
| `synthea_master.py full` | `manage_data.py load` |
| `fast_search_indexing.py` | `manage_data.py index` |
| `validate_fhir_data.py` | `manage_data.py validate` |
| Multiple validation scripts | `manage_data.py status` |

## 🏗️ Architecture Improvements

### Unified Deployment (`deploy.sh`)
- Single entry point for all deployment scenarios
- Automatic environment detection
- Built-in health checks and validation
- Comprehensive error handling
- Deployment logging

### Unified Data Management (`manage_data.py`)
- Consolidated data operations
- Automatic dependency handling
- Progress tracking
- Validation at each step

## 📁 Simplified Project Structure

```
WintEHR/
├── deploy.sh                    # Main deployment script
├── docker-compose.yml           # Core services
├── docker-compose.dev.yml       # Development overrides
├── backend/
│   ├── scripts/
│   │   ├── manage_data.py      # Unified data management
│   │   ├── active/             # Active scripts (internal use)
│   │   └── archived/           # Old scripts for reference
│   └── ...
├── frontend/
└── docs/
```

## 🔧 Common Workflows

### 1. Fresh Development Setup
```bash
# Complete setup with data
./deploy.sh clean

# This automatically:
# - Cleans existing deployment
# - Builds containers
# - Initializes database
# - Loads 20 patients
# - Indexes search parameters
# - Starts all services
```

### 2. Quick Development Restart
```bash
# Restart existing deployment
./deploy.sh dev

# Keeps existing data and just restarts services
```

### 3. Production Deployment
```bash
# Full production setup
./deploy.sh prod --patients 100

# Includes:
# - Production builds
# - Nginx configuration
# - JWT authentication
# - Performance optimizations
```

### 4. Add More Patients
```bash
# Add patients to existing deployment
docker exec emr-backend python scripts/manage_data.py load --patients 30
```

### 5. Troubleshooting
```bash
# Check system status
./deploy.sh status

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Validate data
docker exec emr-backend python scripts/manage_data.py validate --verbose
```

## ⚙️ Configuration Options

### Deploy Script Options
- `--patients N` - Number of patients to generate (default: 20)
- `--skip-data` - Skip patient data generation
- `--skip-build` - Use existing Docker images
- `--verbose` - Enable detailed logging
- `--help` - Show all options

### Data Management Options
- `--patients N` - Patient count for load command
- `--no-dicom` - Skip DICOM generation
- `--verbose` - Detailed output for validation
- `--confirm` - Required for destructive operations

## 🐳 Docker Compose Simplification

We maintain two docker-compose files:
- `docker-compose.yml` - Core service definitions
- `docker-compose.dev.yml` - Development overrides (hot reload, volumes)

The deploy script automatically uses the appropriate configuration.

## 📝 Best Practices

1. **Always use deploy.sh** for deployment operations
2. **Use manage_data.py** for data-specific tasks
3. **Check status** before making changes
4. **Review logs** if something goes wrong
5. **Keep it simple** - most users only need `./deploy.sh dev`

## 🚨 Troubleshooting

### Services Won't Start
```bash
# Check what's running
./deploy.sh status

# Stop everything and restart
./deploy.sh stop
./deploy.sh dev
```

### Data Issues
```bash
# Validate data integrity
docker exec emr-backend python scripts/manage_data.py validate --verbose

# Re-index if searches aren't working
docker exec emr-backend python scripts/manage_data.py index
```

### Clean Start
```bash
# Nuclear option - removes everything
./deploy.sh clean
```

## 🎉 Benefits of Simplification

1. **Fewer Scripts** - From 30+ scripts to just 2 main commands
2. **Consistent Interface** - Same patterns for all operations
3. **Better Error Handling** - Comprehensive validation at each step
4. **Automatic Dependencies** - Scripts handle prerequisites automatically
5. **Clear Documentation** - No confusion about which script to use

## 📚 Additional Resources

- Run `./deploy.sh --help` for all deployment options
- Run `docker exec emr-backend python scripts/manage_data.py --help` for data options
- Check deployment logs in `deployment_[timestamp].log`
- Old scripts are archived in `scripts/archived/` for reference

---

**Remember**: When in doubt, just run `./deploy.sh dev` - it handles everything!