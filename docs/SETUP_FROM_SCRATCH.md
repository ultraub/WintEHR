# WintEHR Setup From Scratch Guide

**Last Updated**: 2025-01-31  
**Version**: 1.0

This guide provides the complete setup process for WintEHR starting with no data or tables, incorporating all learnings from recent debugging and fixes.

## Prerequisites

- Docker and Docker Compose installed
- Git installed
- At least 8GB RAM available
- 10GB free disk space

## Step-by-Step Setup Process

### 1. Clone Repository

```bash
# Clone the repository and checkout the correct branch
git clone https://github.com/your-org/WintEHR.git
cd WintEHR
git checkout fhir-native-redesign
```

### 2. Initial Setup with Deployment Script

The simplified deployment script handles everything automatically:

```bash
# For development environment with 30 patients (default is 20)
./deploy.sh dev --patients 30

# For production environment with more patients
./deploy.sh prod --patients 100
```

This script automatically:
1. Builds Docker images
2. Creates database and tables
3. Loads patient data
4. Indexes search parameters
5. Populates compartments and references

### 3. Manual Setup (If Needed)

If you need to set up manually or understand the process:

#### 3.1 Start Infrastructure

```bash
# Start database first
docker-compose up -d postgres

# Wait for database to be ready (important!)
sleep 10

# Start backend and frontend
docker-compose up -d backend frontend
```

#### 3.2 Initialize Database

The database initialization creates all required tables:

```bash
# This is run automatically by deploy.sh, but can be run manually:
docker exec emr-backend-dev python scripts/setup/init_database_definitive.py
```

This creates 6 critical tables:
- `fhir.resources` - Main resource storage
- `fhir.resource_history` - Version tracking
- `fhir.search_params` - Search parameter indexes
- `fhir.references` - Resource relationships
- `fhir.compartments` - Patient compartments
- `fhir.audit_logs` - Audit trail

#### 3.3 Load Patient Data

```bash
# Load Synthea patient data (this includes search parameter indexing)
docker exec emr-backend-dev python scripts/active/synthea_master.py \
    process \
    --num-patients 30 \
    --state MA \
    --city Boston
```

**Important**: This script now automatically indexes search parameters during import, including the critical patient parameter aliasing.

#### 3.4 Verify Search Parameters

After data loading, verify search parameters are correctly indexed:

```bash
# Check search parameter health
docker exec emr-backend-dev python scripts/testing/verify_search_params_after_import.py

# If any issues are found, fix them:
docker exec emr-backend-dev python scripts/testing/verify_search_params_after_import.py --fix
```

#### 3.5 Populate Compartments

```bash
# Populate patient compartments for efficient $everything operations
docker exec emr-backend-dev python scripts/populate_compartments.py
```

#### 3.6 Generate DICOM Images (Optional)

```bash
# Generate medical images for imaging studies
docker exec emr-backend-dev python scripts/active/generate_dicom_from_fhir.py
```

## Critical Learnings and Fixes

### 1. Search Parameter Indexing

**Issue**: Patient parameter searches returned empty results despite having data.

**Root Cause**: 
- Synthea generates references in URN format: `urn:uuid:patient-id`
- These are stored in the `value_string` column of `search_params` table
- The optimized search builder only checked `value_reference` column

**Fix Applied**: Updated `/backend/fhir/core/search/optimized.py` to check both columns:
```python
# Now checks both value_reference and value_string for all formats:
# - Standard: "Patient/123"
# - URN: "urn:uuid:123" (Synthea format)
# - Pattern: "%/123" (any resource type)
```

### 2. Patient Parameter Aliasing

**Learning**: Many FHIR resources use `subject` reference but searches use `patient` parameter.

**Implementation**: The search indexer now creates `patient` parameter entries that map to `subject` references for these resource types:
- Observation
- Condition
- Procedure
- MedicationRequest
- CarePlan
- CareTeam
- Encounter

### 3. Data Loading Order

**Critical Order**:
1. Database tables MUST exist before any data loading
2. Search parameters MUST be indexed during or immediately after resource creation
3. Compartments should be populated after all resources are loaded
4. References are automatically extracted during resource creation

### 4. Container Names

**Development Environment**:
- Backend: `emr-backend-dev`
- Frontend: `emr-frontend-dev`
- Database: `emr-postgres`

**Production Environment**:
- Backend: `emr-backend`
- Frontend: `emr-frontend`
- Database: `emr-postgres`

## Verification Commands

After setup, verify everything is working:

```bash
# 1. Check system status
./deploy.sh status

# 2. Verify patient count
curl -s "http://localhost:8000/fhir/R4/Patient?_summary=count" | jq '.total'

# 3. Test patient parameter search
curl -s "http://localhost:8000/fhir/R4/Condition?_count=1" | jq '.entry[0].resource.subject.reference' -r | cut -d':' -f3 | xargs -I {} curl -s "http://localhost:8000/fhir/R4/Condition?patient={}" | jq '.total'

# 4. Verify search parameters are indexed
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT param_name, COUNT(*) 
FROM fhir.search_params 
WHERE param_name IN ('patient', 'subject') 
GROUP BY param_name;"

# 5. Check compartments
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT COUNT(DISTINCT compartment_id) as patients_with_compartments
FROM fhir.compartments
WHERE compartment_type = 'Patient';"
```

## Post-Deployment Fixes

If you encounter errors after deployment, run these migration scripts:

### CDS Hooks Schema Fixes

If you see errors about missing columns in CDS Hooks tables:

```bash
# Fix missing 'enabled' column in hook_configurations
docker exec emr-backend-dev python scripts/migrations/fix_cds_hooks_enabled_column.py

# Fix missing columns in execution_log table
docker exec emr-backend-dev python scripts/migrations/fix_cds_hooks_execution_log.py
```

### Search Parameter Fixes

If you see transaction errors or missing search parameters:

```bash
# Fix missing quantity columns in search_params table
docker exec emr-backend-dev python scripts/migrations/fix_search_params_quantity_columns.py

# Fix missing search parameters for Immunization and AllergyIntolerance
docker exec emr-backend-dev python scripts/migrations/fix_missing_search_params_v2.py

# Restart backend to clear any failed transactions
docker restart emr-backend-dev
```

### Storage Engine Logging Fix

If you see 500 errors when accessing FHIR relationships:

```bash
# Check if there's a problematic import statement
grep -n "import logging" backend/fhir/core/storage.py | grep "733"

# If found, manually remove the "import logging" line inside the read_resource method
# This has already been fixed in the codebase but verify
```

## Troubleshooting

### Empty Search Results

If searches return empty results:

1. **Check if search parameters are indexed**:
```bash
docker exec emr-backend-dev python scripts/testing/verify_search_params_after_import.py --fix
```

2. **Re-index if needed**:
```bash
docker exec emr-backend-dev python scripts/consolidated_search_indexing.py --mode index
```

3. **Verify data format**:
```bash
# Check how references are stored
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT DISTINCT value_string 
FROM fhir.search_params 
WHERE param_name = 'patient' 
LIMIT 5;"
```

### Performance Issues

1. **Check indexes exist**:
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "\di fhir.*"
```

2. **Analyze query performance**:
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "
EXPLAIN ANALYZE 
SELECT * FROM fhir.search_params 
WHERE param_name = 'patient' 
AND value_string LIKE 'urn:uuid:%';"
```

## Best Practices

1. **Always use the deployment script** for initial setup - it handles all steps correctly
2. **Never skip the database initialization** - tables must exist before data loading
3. **Use Synthea data only** - never create mock patient data
4. **Monitor search parameter indexing** during large imports
5. **Verify compartments** after loading new patients

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main AI agent reference
- [DEPLOYMENT_SIMPLIFIED.md](../DEPLOYMENT_SIMPLIFIED.md) - Deployment script details
- [SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md](./SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md) - Search indexing details
- [FHIR_SEARCH_PARAMETER_FIX.md](./FHIR_SEARCH_PARAMETER_FIX.md) - Detailed fix documentation