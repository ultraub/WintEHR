# Scripts to Consolidate/Remove

**Date**: 2025-07-18
**Purpose**: Identify and consolidate search parameter fix scripts created during troubleshooting

## Search Parameter Fix Scripts

These scripts were created to fix various search parameter issues but have overlapping functionality:

### 1. Direct Fix Scripts in /backend/scripts/
- `fix_search_params_tokens.py` - Fixes token params stored in wrong column
- `fix_reference_params_storage.py` - Fixes reference params storage
- `fix_storage_reference_params.py` - Another reference param fix (duplicate?)
- `monitor_search_params.py` - Monitoring script
- `reindex_search_params.py` - Reindexing script
- `verify_search_params_after_import.py` - Verification script
- `test_search_param_integration.py` - Test script
- `test_search_params.py` - Another test script
- `test_search_api.py` - API test script

### 2. Migration Scripts in /backend/scripts/migrations/
- `fix_all_search_params.py` - Comprehensive fix (most recent)
- `migrate_search_params.py` - Migration script
- `apply_local_fixes.py` - Local environment fixes
- `apply_aws_fixes.py` - AWS environment fixes

### 3. Analysis Scripts in /backend/scripts/analysis/
- `audit_search_params_fixed.py` - Audit script
- `synthea_import_gap_analysis.py` - Gap analysis
- `test_search_functionality.py` - Search testing
- `test_search_improvements.py` - Improvement testing

## Recommendations

### Keep (Essential):
1. **`/backend/scripts/migrations/fix_all_search_params.py`** - Most comprehensive fix
2. **`/backend/scripts/active/reindex_medication_requests.py`** - Specific reindexing
3. **`/backend/scripts/analysis/audit_search_params_fixed.py`** - For verification
4. **`/backend/api/services/fhir/search_indexer.py`** - Core indexing service

### Archive/Remove:
1. All scripts in `/backend/scripts/` that duplicate migration functionality:
   - `fix_search_params_tokens.py`
   - `fix_reference_params_storage.py`
   - `fix_storage_reference_params.py`
   - `monitor_search_params.py` (functionality in audit script)
   - `reindex_search_params.py` (use active version)
   - `verify_search_params_after_import.py` (use audit script)
   - Test scripts (move to proper test directory)

2. Redundant migration scripts:
   - `migrate_search_params.py` (superseded by fix_all)
   - `apply_local_fixes.py` (if fixes are in fix_all)
   - `apply_aws_fixes.py` (if fixes are in fix_all)

### Create New Consolidated Script:
Create `/backend/scripts/active/search_param_maintenance.py` that combines:
- Audit functionality
- Fix functionality
- Reindex functionality
- Verification functionality

This will provide a single entry point for all search parameter maintenance tasks.

## Other Cleanup Opportunities

### Synthea Backups
The `/backend/scripts/data/synthea_backups/` directory contains multiple backup folders from the same day:
- synthea_backup_20250717_163854
- synthea_backup_20250717_164619
- synthea_backup_20250717_165035
- synthea_backup_20250717_165443
- synthea_backup_20250717_165846
- synthea_backup_20250717_170445
- synthea_backup_20250717_170901
- synthea_backup_20250717_175058
- synthea_backup_20250717_175145
- synthea_backup_20250717_180113
- synthea_backup_20250717_180706

**Recommendation**: Keep only the latest backup from each day or implement a retention policy.

### Archive Directory
The `/backend/scripts/archive/` directory contains old initialization scripts that may no longer be needed:
- Multiple `init_database*.py` variations
- Old DICOM generation scripts
- `pre-consolidation-backup-*` directories

**Recommendation**: Review and remove scripts that are no longer relevant to the current system.
