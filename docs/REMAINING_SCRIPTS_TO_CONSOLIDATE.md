# Remaining Scripts to Consolidate/Remove

**Date**: 2025-01-26  
**Current Status**: 110 Python scripts remain (24 archived so far)

## Summary

We've successfully consolidated the core build process, but many redundant scripts remain:
- **50 testing scripts** - Keep essential ones, consolidate duplicates
- **15+ setup/enhancement scripts** - Most functionality now inline
- **10+ one-time migration scripts** - Can be archived
- **Various utility scripts** - Need review

## Scripts to Remove/Archive (Phase 2)

### 1. Redundant Setup Scripts (Now Integrated)
These are now handled by enhanced `synthea_master.py`:

```
setup/enhance_imaging_import.py         # Now inline during import
setup/enhance_lab_results.py           # Now inline during import
setup/add_reference_ranges.py          # Now inline during import
setup/add_clinical_notes.py            # Can be separate utility
setup/generate_service_requests.py     # Now inline during import
setup/comprehensive_setup.py           # Replaced by init_database_definitive.py
setup/init_search_tables.py            # Integrated into init_database_definitive.py
setup/add_resource_type_column.py      # Column now in schema
```

### 2. Obsolete Migration Scripts
These have been applied and integrated:

```
migrate_cds_hooks_v2.py               # Already applied
init_cds_hooks_v2_complete.py         # Integrated into schema
init_cds_hooks_v2_schema.py           # Integrated into schema
update_patient_extraction.py          # One-time migration
migrations/fast_search_indexing.py    # Now inline during import
```

### 3. Duplicate Database Scripts
```
setup_secure_auth.py                  # Tables now in init_database_definitive.py
```

### 4. Redundant Optimization Scripts
These should be kept as maintenance utilities, not build scripts:

```
setup/optimize_database_indexes.py    # Keep as maintenance utility
setup/optimize_compound_indexes.py    # Keep as maintenance utility
```

### 5. Testing Scripts to Consolidate (50 scripts)

**Keep Essential Testing (10-15 scripts)**:
```
testing/validate_fhir_data.py         # Comprehensive validation
testing/verify_all_fhir_tables.py     # Table verification
testing/test_search_functionality.py  # Search testing
testing/test_patient_everything_pagination.py  # Critical functionality
testing/verify_search_params_after_import.py  # Post-import validation
testing/test_cds_drug_safety.py       # CDS testing
test_consolidated_deployment.py       # New comprehensive test
```

**Archive/Remove Redundant Tests (35+ scripts)**:
```
testing/test_auto_linking.py          # Now inline
testing/test_sort_parameter.py        # Specific test
testing/test_pagination.py            # Duplicate of patient_everything_pagination
testing/monitor_search_params.py      # Replaced by verify script
testing/test_generic_processor.py     # Old processor test
testing/test_search_api.py           # Duplicate functionality
testing/test_parameter_combinations.py # Specific test
testing/test_relationship_discovery.py # Specific feature test
testing/verify_compartments.py        # Now inline verification
testing/verify_basic_search_params.py # Duplicate of main verify
testing/monitor_references.py         # Now inline
testing/setup_test_data.py           # Use synthea_master.py instead
testing/check_synthea_resources.py    # Quick check - keep or integrate
testing/test_data_summary.py         # Utility - keep or integrate
```

### 6. Analysis Scripts (One-time Use)
```
analysis/*.py                         # Most are one-time analysis scripts
```

## Recommended Consolidation Plan

### Phase 2A: Archive Obsolete Scripts (15 scripts)
```bash
# Create archive directory
mkdir -p archived/obsolete_2025

# Move obsolete setup scripts
mv setup/enhance_imaging_import.py archived/obsolete_2025/
mv setup/enhance_lab_results.py archived/obsolete_2025/
mv setup/add_reference_ranges.py archived/obsolete_2025/
mv setup/generate_service_requests.py archived/obsolete_2025/
mv setup/comprehensive_setup.py archived/obsolete_2025/
mv setup/init_search_tables.py archived/obsolete_2025/
mv setup/add_resource_type_column.py archived/obsolete_2025/

# Move obsolete migrations
mv migrate_cds_hooks_v2.py archived/obsolete_2025/
mv init_cds_hooks_v2_complete.py archived/obsolete_2025/
mv init_cds_hooks_v2_schema.py archived/obsolete_2025/
mv update_patient_extraction.py archived/obsolete_2025/
mv migrations/fast_search_indexing.py archived/obsolete_2025/
mv setup_secure_auth.py archived/obsolete_2025/
```

### Phase 2B: Consolidate Testing (35+ scripts → 10 scripts)

Create unified test suites:
1. `test_deployment.py` - Comprehensive deployment validation
2. `test_fhir_api.py` - All FHIR API testing
3. `test_search.py` - All search functionality
4. `test_cds.py` - All CDS hooks testing
5. `test_data_integrity.py` - Data validation

### Phase 2C: Keep as Utilities (Not Build Scripts)
```
setup/optimize_database_indexes.py    # Maintenance utility
setup/optimize_compound_indexes.py    # Maintenance utility
setup/normalize_references.py         # Data cleanup utility
setup/download_official_resources.py  # Resource download utility
setup/download_structure_maps.py      # Resource download utility
```

## Final Target State

### Core Scripts (3)
- `init_database_definitive.py` - Complete schema
- `synthea_master.py` - Data management with inline processing
- `generate_dicom_for_studies.py` - DICOM generation

### Testing Suite (10)
- Consolidated test scripts covering all functionality

### Utilities (5-10)
- Maintenance and optimization scripts
- Download utilities
- Analysis tools

### Total: ~20 active scripts (from 120+)

## Impact Summary

**Scripts to Archive/Remove**: ~60 more scripts
- 15 obsolete setup/migration scripts
- 35+ redundant test scripts
- 10+ one-time analysis scripts

**Final Result**: 
- From 120+ scripts → ~20 active scripts
- 85% reduction in script count
- Clear separation: Build vs Test vs Utility
- No redundancy or overlapping functionality