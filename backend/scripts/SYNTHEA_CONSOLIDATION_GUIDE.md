# Synthea Scripts Consolidation Guide

**Date**: 2025-07-05 19:29:53

## 🎯 What Changed

The Synthea-related scripts have been consolidated into a single master script: `synthea_master.py`

## 📋 Script Mapping

### ❌ Archived Scripts (moved to `archive/synthea_consolidation_20250705_192953/`)
- `synthea_import_with_validation.py` → Use `synthea_master.py import --validation-mode strict`
- `synthea_import_unified.py` → Use `synthea_master.py import --validation-mode <mode>`
- `setup_synthea_local.sh` → Use `synthea_master.py setup`
- `run_synthea_local.sh` → Use `synthea_master.py generate`

### ✅ Kept Scripts (for reference/fallback)
- `synthea_workflow.py` - Original workflow script (superseded by master)
- `synthea_import.py` - Basic import script (fallback option)
- `test_synthea_detection.py` - Debugging tool
- `generate_dicom_for_synthea.py` - Specialized DICOM generation

## 🚀 New Usage

### Complete Workflow
```bash
# Replace: ./setup_synthea_local.sh && ./run_synthea_local.sh && python synthea_import.py
python synthea_master.py full --count 10
```

### Individual Operations
```bash
# Setup Synthea
python synthea_master.py setup

# Generate data
python synthea_master.py generate --count 20 --state California

# Wipe database
python synthea_master.py wipe

# Import with validation
python synthea_master.py import --validation-mode light

# Validate existing data
python synthea_master.py validate

# Generate DICOM files
python synthea_master.py dicom
```

### Advanced Options
```bash
# Full workflow with DICOM generation
python synthea_master.py full --count 5 --include-dicom --validation-mode strict

# Generate with specific location
python synthea_master.py generate --count 50 --state Texas --city Houston

# Import with strict validation and reporting
python synthea_master.py import --validation-mode strict --report-file validation_report.json
```

## 🔧 Build Script Updates

Update any build scripts or documentation to use the new master script:

### Old Commands:
```bash
cd backend && python scripts/synthea_workflow.py full --count 5
./setup_synthea_local.sh && ./run_synthea_local.sh
python scripts/synthea_import_unified.py --validation-mode light
```

### New Commands:
```bash
cd backend && python scripts/synthea_master.py full --count 5
python scripts/synthea_master.py setup && python scripts/synthea_master.py generate --count 5
python scripts/synthea_master.py import --validation-mode light
```

## 📊 Benefits

1. **Single Source of Truth**: One script for all Synthea operations
2. **Consistent Interface**: Unified command-line interface
3. **Better Error Handling**: Comprehensive logging and error reporting
4. **Configurable Validation**: Multiple validation modes for different use cases
5. **Complete Workflow**: End-to-end automation with single command
6. **Extensible**: Easy to add new features and operations

## 🛠️ Migration Checklist

- [ ] Update CI/CD scripts to use `synthea_master.py`
- [ ] Update documentation to reference new script
- [ ] Update `start.sh` or other build scripts if they reference old scripts
- [ ] Test new workflow in development environment
- [ ] Update any container/Docker configurations
- [ ] Notify team of new script usage

## 🆘 Rollback Plan

If issues arise, archived scripts can be restored from `archive/synthea_consolidation_20250705_192953/`

## 📝 Notes

- The master script maintains backward compatibility with existing database schema
- All validation modes from the unified import script are preserved
- DICOM generation is now integrated into the workflow
- Comprehensive logging and reporting are built-in
