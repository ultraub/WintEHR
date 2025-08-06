# CLAUDE.md - Data Management Scripts Quick Reference

**Purpose**: Essential guide for AI agents working with WintEHR's data management and deployment scripts.

**Last Updated**: 2025-01-22

## 🎯 Overview

This directory contains critical scripts for:
- Database initialization and migrations
- Synthea patient data import and management
- Search parameter indexing and optimization
- DICOM imaging data generation
- Clinical catalog population
- Performance optimization and monitoring

## 📁 Directory Structure

```
backend/scripts/
├── active/                      # Production-ready scripts ✅
│   ├── synthea_master.py       # Master data import controller
│   ├── data_processor.py       # Core data processing engine
│   ├── generate_dicom_for_studies.py  # DICOM generation
│   ├── consolidated_catalog_setup.py   # Clinical catalog setup
│   └── master_build.py         # Build orchestration
├── setup/                       # Database and initial setup
│   ├── init_database_definitive.py     # Create all 6 FHIR tables ✅
│   ├── init_search_tables.py          # Search infrastructure
│   └── comprehensive_setup.py          # Full system setup
├── testing/                     # Testing and validation scripts ✅
│   ├── check_synthea_resources.py      # Quick resource overview
│   ├── validate_fhir_data.py           # Comprehensive validation
│   └── verify_all_fhir_tables.py       # Table verification
├── analysis/                    # Data analysis (mostly one-time use)
├── migrations/                  # Database migrations (already applied) ⚠️
├── data/                        # Static data and backups
│   └── synthea_backups/        # Patient data backups
└── logs/                        # Operation logs

✅ = Actively used in production
⚠️ = Deprecated/Already applied
```

## 🔧 Critical Scripts

### synthea_master.py (Master Controller)
Primary data management interface:
```bash
# Full deployment with 20 patients
python scripts/active/synthea_master.py full --count 20

# Wipe and reload
python scripts/active/synthea_master.py wipe
python scripts/active/synthea_master.py load --count 50

# Validate deployment
python scripts/active/synthea_master.py validate

# Commands:
# - generate: Create new Synthea data
# - import: Import generated data
# - wipe: Clear all patient data
# - load: Wipe + import in one step
# - full: Complete setup (wipe + load + enhance)
# - validate: Check deployment health
```

### init_database_definitive.py (Database Setup)
Creates all 6 critical FHIR tables:
```bash
# Run during initial setup
python scripts/setup/init_database_definitive.py

# Creates:
# - fhir.resources (main storage)
# - fhir.resource_history (versioning)
# - fhir.search_params (search indexes)
# - fhir.references (relationships)
# - fhir.compartments (patient grouping)
# - fhir.audit_logs (audit trail)
```

### consolidated_search_indexing.py (Search Management)
Manages search parameter indexing:
```bash
# Index all resources
python scripts/consolidated_search_indexing.py --mode index

# Monitor search health
python scripts/consolidated_search_indexing.py --mode monitor

# Fix missing parameters
python scripts/consolidated_search_indexing.py --mode fix

# Verify specific resource type
python scripts/consolidated_search_indexing.py --mode verify --resource-type Patient
```

### generate_dicom_for_studies.py (Imaging Data)
Creates DICOM files for imaging studies:
```bash
# Generate DICOM for all studies
python scripts/active/generate_dicom_for_studies.py

# Features:
# - Multi-slice CT/MRI generation
# - Proper DICOM metadata
# - Links to ImagingStudy resources
# - Stores in /data/dicom/
```

### validate_deployment.py (Health Check)
Comprehensive deployment validation:
```bash
# Full validation (use --docker flag in container)
python scripts/validate_deployment.py --docker --verbose

# Checks:
# - Database connectivity
# - Table existence
# - Resource counts
# - Search parameter health
# - Reference integrity
# - API endpoints
```

## ⚠️ Critical Workflows

### Fresh Deployment
```bash
# Recommended approach
./fresh-deploy.sh --patients 20

# Or manually:
1. python scripts/setup/init_database_definitive.py
2. python scripts/active/synthea_master.py full --count 20
3. python scripts/consolidated_search_indexing.py --mode index
4. python scripts/active/generate_dicom_for_studies.py
5. python scripts/validate_deployment.py --docker
```

### Adding More Patients
```bash
# Add 10 more patients (preserves existing)
./load-patients.sh 10

# Or directly:
python scripts/active/synthea_master.py import --count 10
```

### Wiping and Reloading
```bash
# Complete refresh with 50 patients
./load-patients.sh --wipe 50

# Or:
python scripts/active/synthea_master.py load --count 50
```

### Search Parameter Maintenance
```bash
# After any data import
python scripts/verify_search_params_after_import.py --fix

# Regular monitoring
python scripts/monitor_search_params.py

# Performance optimization
python scripts/optimize_database_indexes.py
```

## 🚀 Common Operations

### Data Import Pipeline
```python
# 1. Generate Synthea data
subprocess.run(["synthea", "-p", count, "-s", seed])

# 2. Process each patient file
for patient_file in patient_files:
    processor.process_patient_bundle(patient_file)

# 3. Index search parameters
await index_search_parameters(imported_resources)

# 4. Populate compartments
await populate_patient_compartments()

# 5. Generate DICOM if needed
generate_dicom_for_imaging_studies()
```

### Monitoring Database Health
```sql
-- Check resource counts
SELECT resource_type, COUNT(*) 
FROM fhir.resources 
GROUP BY resource_type 
ORDER BY COUNT(*) DESC;

-- Check search parameter coverage
SELECT param_name, COUNT(*) 
FROM fhir.search_params 
WHERE param_name IN ('patient', 'subject')
GROUP BY param_name;

-- Check compartment population
SELECT COUNT(DISTINCT compartment_id) as patient_count
FROM fhir.compartments 
WHERE compartment_type = 'Patient';
```

### Performance Optimization
```bash
# Run after large imports
python scripts/optimize_database_indexes.py

# Analyze query performance
python scripts/test_index_performance.sql

# Vacuum and analyze tables
docker exec emr-postgres psql -U emr_user -d emr_db -c "VACUUM ANALYZE fhir.resources;"
```

## 🐛 Troubleshooting

### Import Failures
```bash
# Check import progress
cat scripts/synthea_import_progress.json

# Verify Synthea data
ls -la output/fhir/*.json

# Check logs
tail -f scripts/logs/synthea_master.log
```

### Search Issues
```bash
# Verify search parameters
python scripts/verify_search_params_after_import.py

# Re-index if needed
python scripts/consolidated_search_indexing.py --mode fix

# Check specific parameter
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT * FROM fhir.search_params 
WHERE resource_type = 'Condition' 
AND param_name = 'patient' 
LIMIT 5;"
```

### Performance Problems
```bash
# Check table sizes
python scripts/analysis/analyze_data_elements.py

# Run EXPLAIN on slow queries
python scripts/testing/test_search_functionality.py

# Optimize indexes
python scripts/optimize_database_indexes.py
```

## 📝 Best Practices

1. **Always Validate After Import**: Run validation script after any data changes
2. **Use Master Scripts**: Prefer synthea_master.py over individual scripts
3. **Monitor Search Health**: Regular checks prevent query issues
4. **Backup Before Wipe**: Save important test data before clearing
5. **Index After Import**: Always run search indexing after new data
6. **Use Docker Flags**: Add --docker when running in containers
7. **Check Logs**: Review logs for warnings and errors

## 🔗 Related Documentation

- **Main CLAUDE.md**: `/CLAUDE.md` - Project overview
- **Deployment Guide**: `/docs/DEPLOYMENT_CHECKLIST.md`
- **Build Process**: `/docs/BUILD_PROCESS_ANALYSIS.md`
- **Search Integration**: `/docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md`

## 💡 Quick Tips

- synthea_master.py is the primary entry point for data management
- Always use --docker flag when running in containers
- Search indexing is automatic but can be manually triggered
- DICOM generation requires ImagingStudy resources to exist first
- Validation script provides comprehensive health checks
- Use --verbose flag for detailed output during troubleshooting
- Compartment population enables efficient Patient/$everything

## 🔒 Safety Notes

- **Never run wipe commands in production** without explicit confirmation
- Always backup critical test data before major operations
- Monitor disk space during large imports
- Use transaction mode for atomic operations
- Validate reference integrity after imports

## ✅ Cleanup Completed (2025-01-22)

The following deprecated scripts and files have been removed:

### Phase 1 - Initial Cleanup:
**Root backend directory (7 scripts removed):**
- `populate_references_urn_uuid 2.py` - Duplicate with space in filename
- `populate_references_table.py` - Not referenced anywhere
- `synthea_import_report.py` - Unused root-level script
- `test_tables.py` - Unused root-level script
- `analyze_synthea_resources.py` - Unused root-level script
- `synthea/build/` directory - Build artifacts (saved 1GB)
- Old test reports from July 20 with 18:xx timestamps

**Scripts reorganized (moved to proper subdirectories):**
- `consolidated_search_indexing.py` → `active/`
- `fast_search_indexing.py` → `migrations/`
- `fix_cds_hooks_enabled_column.py` → `migrations/`
- `normalize_references.py` → `setup/`
- `optimize_database_indexes.py` → `setup/`
- `populate_compartments.py` → `setup/`
- `populate_references_urn_uuid.py` → `setup/`

### Phase 2 - Additional Cleanup:
**Documentation and patches:**
- `CLAUDE 2.md` - Duplicate of CLAUDE.md
- `fix_synthea_import.patch` - Patch already applied

**Synthea backups:**
- Kept only 3 most recent backups (deleted 11 older backups)

**Migration scripts (4 removed):**
- `check_extension_import.py` - One-time analysis
- `check_migration_progress.py` - Migration complete
- `check_references_status.py` - One-time check
- `check_synthea_coverage.py` - One-time analysis

**SQL scripts (4 removed):**
- `optimize_search_params_table.sql` - One-time optimization
- `optimize_indexes.sql` - One-time optimization
- `test_index_performance.sql` - Performance testing
- `01-init-database.sql` - Replaced by init_database_definitive.py

**Python cache:**
- Removed 176 `__pycache__` directories

**Analysis scripts (4 removed):**
- `analyze_cds_patients.py` - Development analysis
- `analyze_data_elements.py` - One-time analysis
- `analyze_fhir_status.py` - Status pattern analysis
- `analyze_synthea_import.py` - Import gap analysis

**Other cleanup:**
- `scripts/scripts/` - Duplicate nested directory structure
- Old log files from test runs

### Scripts Kept (Still Actively Used):
- `migrations/fast_search_indexing.py` - Used in deployment
- `migrations/fix_cds_hooks_enabled_column.py` - Fixes CDS hooks schema
- `setup/fix_service_request_references.py` - Fixes ServiceRequest references
- All scripts in `active/` directory - Core functionality
- All scripts in `testing/` directory - Active test suite

### Total Cleanup Impact:
- **Files removed**: ~50 deprecated scripts and files
- **Space saved**: ~1.3GB (mainly from synthea/build and old backups)
- **Better organization**: Scripts moved to appropriate subdirectories
- **Cleaner codebase**: Removed one-time analyses and applied migrations

---

**Remember**: These scripts directly manipulate the database. Always validate changes and maintain backups of important test scenarios.