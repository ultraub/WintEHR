# Archived Old FHIR Backend Scripts

**Archived**: 2025-10-05  
**Reason**: WintEHR migrated from custom FHIR backend to HAPI FHIR JPA Server

## Why These Scripts Were Archived

These scripts depended on the custom FHIR backend implementation that was archived to `backend/archived/old_fhir_backend/`. After the HAPI FHIR migration, these scripts:

1. **Import from archived modules**: They use `from fhir.core.*` and `from fhir.api.*`
2. **Reference custom FHIR tables**: They query `fhir.search_params`, `fhir.compartments` tables designed for old backend
3. **Are no longer used**: Deployment now uses HAPI FHIR native scripts

## Migration Details

See:
- `backend/docs/HAPI_FHIR_MIGRATION_2025-10-05.md` - HAPI FHIR migration documentation
- `FHIR_BACKEND_AGGRESSIVE_CLEANUP_2025-10-05.md` - Backend cleanup summary
- `SCRIPTS_CLEANUP_ANALYSIS_2025-10-05.md` - Scripts analysis and decision

## Replacement Scripts

| Old Script | New HAPI FHIR Script |
|-----------|---------------------|
| `active/synthea_master.py` | `synthea_to_hapi_pipeline.py` |
| `active/data_processor.py` | HAPI FHIR native processing |
| Various testing scripts | Direct HAPI FHIR API testing |

## What Replaced These

**Data Loading**: 
- `synthea_to_hapi_pipeline.py` - Loads Synthea data directly to HAPI FHIR
- `simple_hapi_loader.py` - Simple HTTP-based loader
- `load_test_patients_to_hapi.py` - Test patient loader

**Search & Indexing**:
- HAPI FHIR handles search indexing automatically
- No manual search parameter extraction needed

**Compartments**:
- HAPI FHIR handles compartment management natively

## Restoration

If needed, these scripts can be restored from this archive or from git history, but they would require:
1. Reverting the HAPI FHIR migration
2. Restoring the old FHIR backend from `backend/archived/old_fhir_backend/`
3. Updating database schema to old FHIR tables

**Not recommended** - HAPI FHIR is the industry-standard solution.

## Contents

See subdirectories for categorized archived scripts:
- `data_loading/` - Old Synthea and data import scripts
- `testing/` - Old FHIR backend test scripts (~250K lines)
- `setup/` - Old FHIR search and database setup scripts
