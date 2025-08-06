# Archived Build Scripts

**Archived on:** 2025-01-11 18:15:59  
**Reason:** Replaced by new modular deployment system

## New System

The following scripts have been replaced by the new modular deployment system:

- Master script: `scripts/master-deploy.sh`
- Modules: `scripts/modules/`
  - `00-environment-setup.sh`
  - `01-database-init.sh`
  - `02-data-generation.sh`
  - `03-data-import.sh`
  - `04-data-processing.sh`
  - `05-nginx-config.sh`
  - `06-validation.sh`

## Archived Scripts

These scripts were archived from the root directory:

- `deploy-complete.sh` - Old complete deployment script
- `deploy.sh` - Production deployment script
- `dev-mode.sh` - Development mode script
- `fresh-deploy.sh` - Fresh deployment script
- `quick-start.sh` - Quick start script
- `unified-deploy.sh` - Previous unified deployment attempt

## Migration Guide

To use the new system:

```bash
# Fresh deployment (replaces fresh-deploy.sh)
./scripts/master-deploy.sh --clean --patients=10

# Production deployment (replaces deploy.sh)
./scripts/master-deploy.sh --production --patients=20

# Quick development setup (replaces quick-start.sh)
./scripts/master-deploy.sh

# Development mode (replaces dev-mode.sh)
./scripts/master-deploy.sh --skip-data
```

For more options, see `./scripts/master-deploy.sh --help`

## Key Improvements

1. **Modular Architecture** - Each deployment phase is a separate module
2. **Schema Preservation** - Database schema is never destroyed
3. **Better Error Handling** - Comprehensive error messages and recovery
4. **Cross-Platform** - Automatic line ending fixes
5. **Validation** - Complete system validation after deployment
6. **Documentation** - See `docs/BUILD_SYSTEM.md`