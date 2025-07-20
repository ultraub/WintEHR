# Search Indexing Scripts Review

**Date**: 2025-01-19  
**Purpose**: Review all search parameter indexing scripts to identify duplicates and consolidate

## Current Scripts Overview

### 1. **consolidated_search_indexing.py**
- **Location**: `backend/scripts/consolidated_search_indexing.py`
- **Purpose**: Main consolidated script for search parameter indexing
- **Features**:
  - Three modes: index, verify, fix
  - Handles all resource types
  - Progress tracking and error handling
- **Used in**: 
  - `fresh-deploy.sh` (Phase 4)
  - `dev-build.sh` (after data import)
  - `scripts/modules/04-data-processing.sh`

### 2. **reindex_all_search_params.py** (NEW)
- **Location**: `backend/scripts/reindex_all_search_params.py`
- **Purpose**: Comprehensive re-indexing with detailed parameter extraction
- **Features**:
  - Detailed extraction logic for each resource type
  - Progress reporting by resource type
  - Verification mode
  - Can target specific resource types
- **Used in**: Not yet integrated into build scripts

### 3. **fix_patient_search_params.py** (NEW)
- **Location**: `backend/scripts/fix_patient_search_params.py`
- **Purpose**: Specific fix for Patient resource search parameters
- **Features**:
  - Comprehensive Patient parameter extraction
  - Fixes gender parameter with proper system URI
  - One-time fix script
- **Used in**: Manual execution only

### 4. **verify_search_params_after_import.py**
- **Location**: `backend/scripts/verify_search_params_after_import.py`
- **Purpose**: Verification and auto-fix after data import
- **Features**:
  - Checks for missing critical parameters
  - Auto-fix capability
  - Used after synthea_master.py
- **Used in**: `scripts/modules/03-data-import.sh`

### 5. **monitor_search_params.py**
- **Location**: `backend/scripts/monitor_search_params.py`
- **Purpose**: Monitoring and health checks
- **Features**:
  - Shows parameter counts by type
  - Identifies missing parameters
  - Health monitoring
- **Used in**: Manual monitoring

### 6. **reindex_medication_requests.py**
- **Location**: `backend/scripts/active/reindex_medication_requests.py`
- **Purpose**: Legacy script for MedicationRequest only
- **Status**: DEPRECATED - functionality covered by consolidated scripts

### 7. **test_search_param_integration.py**
- **Location**: `backend/scripts/test_search_param_integration.py`
- **Purpose**: Testing search parameter functionality
- **Features**:
  - Tests actual search queries
  - Validates parameter extraction
- **Used in**: Manual testing

## Build Script Integration

### fresh-deploy.sh
```bash
# Phase 4: Search indexing (line ~283)
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index
# Fallback to fix mode if indexing fails
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix
```

### dev-build.sh
```bash
# Primary approach (line ~205)
python scripts/consolidated_search_indexing.py --mode index

# Fallback: inline Python script for basic patient params (line ~215-285)
# This is redundant - consolidated_search_indexing.py should handle this
```

### load-patients.sh
- No search indexing (relies on storage.py during import)
- Only applies database performance indexes

### master-deploy.sh
- Uses module `04b-search-indexing.sh`
- Calls consolidated_search_indexing.py

## Issues Found

### 1. Duplication
- **dev-build.sh** has redundant inline Python code that duplicates patient parameter indexing
- **reindex_medication_requests.py** is obsolete
- **fix_patient_search_params.py** functionality should be merged into main scripts

### 2. Inconsistent Extraction Logic
- **storage.py** has extraction logic during resource creation
- **consolidated_search_indexing.py** has different extraction logic
- **reindex_all_search_params.py** has the most comprehensive logic
- Need to consolidate into one source of truth

### 3. Missing Build Integration
- **reindex_all_search_params.py** not integrated anywhere
- Should replace or merge with consolidated_search_indexing.py

## Recommendations

### 1. Consolidate Scripts
**Keep**:
- `consolidated_search_indexing.py` - Main workhorse
- `verify_search_params_after_import.py` - Post-import validation
- `monitor_search_params.py` - Health monitoring
- `test_search_param_integration.py` - Testing

**Merge**:
- Merge `reindex_all_search_params.py` extraction logic into `consolidated_search_indexing.py`
- Merge `fix_patient_search_params.py` logic into main extraction

**Remove**:
- `reindex_medication_requests.py` - Deprecated
- Inline Python in `dev-build.sh` - Use consolidated script

### 2. Standardize Extraction Logic
- Move ALL extraction logic from `storage.py` method `_extract_search_parameters()` to a shared module
- Import and use in both storage.py and indexing scripts
- Single source of truth for parameter extraction

### 3. Simplify Build Integration
```bash
# Standard approach for all build scripts:
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index || \
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix
```

### 4. Create Shared Extraction Module
```python
# backend/fhir/core/search_param_extraction.py
class SearchParameterExtractor:
    """Single source of truth for search parameter extraction"""
    
    @staticmethod
    def extract_patient_params(resource_data):
        # Comprehensive Patient extraction
        pass
    
    @staticmethod
    def extract_observation_params(resource_data):
        # Comprehensive Observation extraction
        pass
    
    # ... etc for all resource types
```

## Action Items

1. **Create shared extraction module** with comprehensive logic for all resource types
2. **Update storage.py** to use shared module
3. **Update consolidated_search_indexing.py** to use shared module
4. **Remove deprecated scripts**
5. **Update dev-build.sh** to remove inline Python
6. **Test thoroughly** with all resource types

## Current State Summary

- We have too many scripts doing similar things
- Extraction logic is duplicated and inconsistent
- Build scripts have unnecessary fallbacks
- New comprehensive script (reindex_all_search_params.py) should be integrated
- Need single source of truth for parameter extraction logic