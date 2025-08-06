# FHIR Testing Scripts

This directory contains centralized testing scripts and documentation for the WintEHR FHIR system.

**Created**: 2025-01-20  
**Purpose**: Centralized location for all FHIR data validation, testing, and analysis scripts

## 📁 Directory Structure

```
testing/
├── README.md                           # This file
├── FHIR_DATA_REFERENCE.md             # Comprehensive FHIR data reference
├── check_synthea_resources.py         # Quick Synthea resource overview
├── validate_fhir_data.py              # Comprehensive FHIR data validation
├── verify_all_fhir_tables.py          # Verify all 6 FHIR database tables
├── verify_compartments.py             # Verify patient compartments
├── verify_search_params_after_import.py # Verify search parameter indexing
├── monitor_references.py              # Monitor resource references
├── monitor_search_params.py           # Monitor search parameter health
├── validate_database_schema.py        # Validate database schema
├── validate_medication_request_compliance.py # FHIR compliance validation
├── validate_search_schema.py          # Search schema validation
├── test_search_api.py                 # FHIR search API testing
├── test_search_param_integration.py   # Search parameter integration tests
├── test_search_functionality.py       # Search functionality tests
├── test_patient_load_performance.py   # Patient load performance testing
├── test_enhanced_patient_summary.py   # Enhanced patient summary tests
├── test_dicom_integration.py         # DICOM integration tests
├── test_search_improvements.py       # Search improvement tests
├── test_auto_linking.py              # Auto-linking functionality tests
├── test_generic_processor.py         # Generic processor tests
└── reports/                          # Test reports and analysis results
```

## 🔍 Main Testing Scripts

### check_synthea_resources.py
**Purpose**: Quick overview of Synthea-generated FHIR resources

**Features**:
- Categorized resource counts
- Sample patient IDs for testing
- Data quality indicators
- Testing recommendations

**Usage**:
```bash
docker exec emr-backend python scripts/testing/check_synthea_resources.py
```

### validate_fhir_data.py
**Purpose**: Comprehensive validation of FHIR data availability and quality

**Features**:
- Resource type inventory and counts
- Clinical data analysis (patients, conditions, medications, etc.)
- Data quality metrics
- Resource relationship analysis
- Available feature detection
- Sample resource identification

**Usage**:
```bash
# Basic validation
docker exec emr-backend python scripts/testing/validate_fhir_data.py

# Verbose output with report
docker exec emr-backend python scripts/testing/validate_fhir_data.py --verbose --output /tmp/fhir_report.json

# From host machine
python backend/scripts/testing/validate_fhir_data.py --database-url postgresql://emr_user:emr_password@localhost:5432/emr_db
```

### verify_all_fhir_tables.py
**Purpose**: Verify the health and population of all 6 FHIR database tables

**Tables Checked**:
- fhir.resources - Main resource storage
- fhir.resource_history - Version tracking
- fhir.search_params - Search indexes
- fhir.references - Resource relationships
- fhir.compartments - Patient compartments
- fhir.audit_logs - Audit trail

**Usage**:
```bash
# Basic verification
docker exec emr-backend python scripts/testing/verify_all_fhir_tables.py

# Verbose with table sizes
docker exec emr-backend python scripts/testing/verify_all_fhir_tables.py --verbose

# Auto-fix issues
docker exec emr-backend python scripts/testing/verify_all_fhir_tables.py --fix
```

### monitor_search_params.py
**Purpose**: Monitor search parameter health and coverage

**Metrics**:
- Parameter coverage by resource type
- Missing critical parameters
- Indexing performance
- Parameter type distribution

### verify_compartments.py
**Purpose**: Verify patient compartment assignments for Patient/$everything operations

**Checks**:
- Compartment coverage for clinical resources
- Missing compartment assignments
- Compartment integrity

### test_search_api.py
**Purpose**: Test FHIR search API functionality

**Tests**:
- Patient search by name, birthdate, identifier
- Clinical resource searches (Condition, Observation, MedicationRequest)
- Search parameter combinations
- Pagination and sorting

### test_patient_load_performance.py
**Purpose**: Performance testing for patient data loading

**Metrics**:
- Load time for patient bundles
- Resource fetch performance
- Search parameter indexing speed
- Memory usage during operations

### test_search_param_integration.py
**Purpose**: Validate search parameter extraction and indexing

**Coverage**:
- All FHIR resource types
- Common search parameters (patient, subject, code, status, date)
- Reference parameter resolution
- Token parameter indexing

## 🧪 Running Tests

### Prerequisites
1. System must have FHIR data loaded:
   ```bash
   ./fresh-deploy.sh --patients 20
   ```

2. Verify data is available:
   ```bash
   docker exec emr-backend python scripts/testing/validate_fhir_data.py
   ```

### Test Execution

**Run all tests**:
```bash
# From within container
docker exec emr-backend bash -c "cd /app/scripts/testing && python -m pytest test*.py -v"

# Individual test
docker exec emr-backend python scripts/testing/test_search_api.py
```

**Performance tests**:
```bash
# Patient load performance
docker exec emr-backend python scripts/testing/test_patient_load_performance.py

# Search performance
docker exec emr-backend python scripts/testing/test_search_functionality.py --performance
```

## 📊 Test Reports

Test results and analysis reports are saved in the `reports/` subdirectory:

- `fhir_validation_report_YYYYMMDD.json` - Daily validation reports
- `performance_metrics_YYYYMMDD.csv` - Performance test results
- `search_coverage_YYYYMMDD.json` - Search parameter coverage analysis

## 🔧 Common Testing Scenarios

### 1. Verify Fresh Deployment
```bash
# Validate all FHIR tables
docker exec emr-backend python scripts/verify_all_fhir_tables.py

# Check data availability
docker exec emr-backend python scripts/testing/validate_fhir_data.py

# Test search functionality
docker exec emr-backend python scripts/testing/test_search_api.py
```

### 2. Performance Testing
```bash
# Test patient load performance
docker exec emr-backend python scripts/testing/test_patient_load_performance.py

# Test search performance with various patient counts
for count in 10 20 50 100; do
    ./fresh-deploy.sh --patients $count
    docker exec emr-backend python scripts/testing/test_patient_load_performance.py --output reports/perf_${count}_patients.json
done
```

### 3. Search Parameter Validation
```bash
# Verify search parameters are indexed
docker exec emr-backend python scripts/testing/test_search_param_integration.py

# Fix missing search parameters
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix

# Re-test
docker exec emr-backend python scripts/testing/test_search_param_integration.py
```

## 🐛 Troubleshooting

### No Data Found
If tests report no data:
```bash
# Load sample data
./fresh-deploy.sh --patients 20

# Or use synthea_master directly
docker exec emr-backend python scripts/active/synthea_master.py full --count 20
```

### Search Tests Failing
If search tests fail:
```bash
# Check search parameter indexing
docker exec emr-backend python scripts/monitor_search_params.py

# Re-index if needed
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode fix
```

### Performance Issues
If performance tests show poor results:
```bash
# Check database indexes
docker exec emr-backend python scripts/optimize_database_indexes.py

# Monitor during tests
docker exec emr-postgres pg_top
```

## 📝 Adding New Tests

When adding new test scripts:

1. Place in this directory with descriptive name
2. Add documentation header explaining purpose
3. Update this README with script details
4. Include error handling and logging
5. Generate reports in `reports/` directory

Example template:
```python
#!/usr/bin/env python3
"""
Test [Feature Name]

Purpose: [Brief description]
Created: [Date]
Author: [Name]
"""

import asyncio
import logging
# ... rest of test
```

## 🔗 Related Documentation

- [FHIR Search Parameter Documentation](../../docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md)
- [Database Architecture](../../docs/DATABASE_ARCHITECTURE.md)
- [Clinical Module Testing](../../docs/modules/testing/README.md)