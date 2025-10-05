# CLAUDE.md - Data Management Module

**Purpose**: Comprehensive guide for WintEHR's data management infrastructure, deployment pipeline, and validation systems.

**Last Updated**: 2025-08-12  
**Version**: 2.0

## 🎯 Module Overview

The Data Management module orchestrates WintEHR's complete data lifecycle:
- **Synthea Integration**: Patient data generation and import
- **Database Management**: Schema initialization and migrations
- **Search Indexing**: FHIR search parameter extraction and optimization
- **Compartment Population**: Patient-centric resource organization
- **DICOM Generation**: Medical imaging data creation
- **Data Validation**: Quality assurance and compliance checking

### Architecture Principles
- **Atomicity**: All operations are transactional with rollback capability
- **Validation First**: Every stage includes comprehensive data validation
- **Performance Optimization**: Batch processing and parallel operations
- **Error Recovery**: Robust error handling with detailed logging
- **Modular Design**: Independent scripts that can be combined or run separately

## 📋 Deployment Pipeline (HAPI FHIR)

> **⚠️ IMPORTANT (2025-10-05)**: WintEHR now uses HAPI FHIR JPA Server. The old custom FHIR backend has been archived. See `archived_old_fhir/` for legacy scripts.

### HAPI FHIR Deployment Process

```bash
# Phase 1: Generate and Load Synthea Data to HAPI FHIR
python scripts/synthea_to_hapi_pipeline.py 50 Massachusetts

# Phase 2: Extract Clinical Catalogs from HAPI FHIR
python scripts/active/consolidated_catalog_setup.py --extract-from-fhir

# Phase 3: Optional Enhancements
python scripts/active/consolidated_enhancement.py
python scripts/active/consolidated_workflow_setup.py
```

### Simplified Deployment (Using deploy.sh)
```bash
# Deploy with 20 patients (recommended for development)
./deploy.sh dev --patients 20

# Deploy with 100 patients (production)
./deploy.sh prod --patients 100
```

### What Changed with HAPI FHIR Migration

**Old (Archived)**:
- `synthea_master.py` - Custom FHIR backend loader
- Manual search parameter indexing
- Manual compartment population
- Custom FHIR search implementation

**New (Current)**:
- `synthea_to_hapi_pipeline.py` - HAPI FHIR loader
- HAPI FHIR handles search indexing automatically
- HAPI FHIR handles compartments natively
- Industry-standard FHIR R4 compliance

## 🧬 Synthea Data Management (HAPI FHIR)

### Core Features
- **HAPI FHIR Native**: Direct integration with industry-standard FHIR server
- **Automatic Indexing**: HAPI FHIR handles search parameters automatically
- **Bundle Conversion**: Converts Synthea collection bundles to HAPI transaction format
- **Production Ready**: Tested pipeline for reliable data loading

### Primary Script: synthea_to_hapi_pipeline.py

#### Basic Usage
```bash
# Load 10 patients (default)
python scripts/synthea_to_hapi_pipeline.py

# Load specific number of patients
python scripts/synthea_to_hapi_pipeline.py 50

# Load patients from specific state
python scripts/synthea_to_hapi_pipeline.py 25 California
```

#### What It Does
1. **Generates Synthea Data**: Runs Synthea JAR to create synthetic patients
2. **Converts Bundles**: Transforms collection → transaction bundles for HAPI
3. **Uploads to HAPI**: POSTs bundles to HAPI FHIR server via HTTP
4. **Verifies Data**: Checks patient count and resource integrity

### Alternative Loaders

#### Simple Test Loader
```bash
# Generate and load test patients quickly
python scripts/simple_hapi_loader.py
```

#### Pre-generated Data Loader
```bash
# Load existing Synthea FHIR files
python scripts/load_test_patients_to_hapi.py

# Validate existing data
python scripts/active/synthea_master.py validate
```

### Advanced Features

#### URN Reference Handling
- Automatically converts Synthea's `urn:uuid:` references to standard FHIR format
- Maintains reference integrity across resource types
- Supports both formats for search compatibility

#### Resource Transformations
- Cleans numeric suffixes from patient/provider names
- Ensures proper FHIR metadata (versionId, lastUpdated)
- Validates resource structure before import

## 🔍 Search Parameter Indexing

### Comprehensive Coverage
The system indexes **ALL** FHIR R4 search parameters for optimal query performance:

#### Patient Demographics
- `family`, `given`, `gender`, `birthdate`, `identifier`

#### Clinical Resources
- **Observation**: `patient`, `code`, `date`, `status`, `category`, `encounter`
- **Condition**: `patient`, `code`, `clinical-status`, `verification-status`, `category`, `onset-date`
- **MedicationRequest**: `patient`, `medication`, `status`, `intent`, `authoredon`
- **Procedure**: `patient`, `code`, `status`, `date`, `encounter`
- **DiagnosticReport**: `patient`, `code`, `status`, `date`, `encounter`, `based-on`

#### Reference Resolution
- Supports multiple reference formats: `Patient/123`, `urn:uuid:123`, `123`
- Indexes both `value_reference` and `value_string` columns
- Handles patient/subject parameter aliasing

### Indexing Operations

#### Consolidated Search Indexing
```bash
# Index all resources (default mode)
python scripts/active/consolidated_search_indexing.py

# Reindex specific resource type
python scripts/active/consolidated_search_indexing.py --mode reindex --resource-type Condition

# Verify search parameter health
python scripts/active/consolidated_search_indexing.py --mode verify

# Fix missing parameters
python scripts/active/consolidated_search_indexing.py --mode fix

# Monitor system health
python scripts/active/consolidated_search_indexing.py --mode monitor
```

#### Performance Considerations
- **Batch Size**: Configurable (default: 2000 resources)
- **Parallel Processing**: Multi-threaded extraction
- **Memory Efficient**: Streaming processing for large datasets
- **Error Resilient**: Continues on individual resource failures

## 🗄️ Database Schema Management

### Core FHIR Tables
```sql
-- Primary resource storage
fhir.resources (id, resource_type, fhir_id, version_id, resource, last_updated)

-- Search optimization
fhir.search_params (resource_id, param_name, param_type, value_*)

-- Version history
fhir.resource_history (resource_id, version_id, operation, resource)

-- Reference tracking
fhir.references (source_id, target_type, target_id, reference_path)

-- Patient compartments
fhir.compartments (compartment_type, compartment_id, resource_id)

-- Audit trail
fhir.audit_logs (action, resource_type, resource_id, user_id, timestamp)
```

### Schema Operations

#### Database Initialization
```bash
# Development mode (localhost)
python scripts/setup/init_database_definitive.py --mode development

# Production mode (Docker/remote)
python scripts/setup/init_database_definitive.py --mode production

# Verify schema only (no changes)
python scripts/setup/init_database_definitive.py --verify-only

# Skip dropping existing tables
python scripts/setup/init_database_definitive.py --skip-drop
```

#### Advanced Operations
```bash
# Optimize database indexes
python scripts/setup/optimize_database_indexes.py

# Create compound indexes for performance
python scripts/setup/optimize_compound_indexes.py

# Normalize reference formats
python scripts/setup/normalize_references.py
```

## 🏥 Patient Compartments

### Automatic Population
Patient compartments are automatically populated during data import to enable efficient `Patient/$everything` operations.

#### Supported Resource Types
- **Direct**: Patient resources
- **Patient Referenced**: Condition, Observation, MedicationRequest, AllergyIntolerance, Procedure, Immunization
- **Subject Referenced**: DiagnosticReport, CarePlan, CareTeam, DocumentReference, ImagingStudy
- **Beneficiary Referenced**: Coverage, Claim, ExplanationOfBenefit

#### Manual Operations
```bash
# Populate compartments for existing data
python scripts/populate_compartments.py

# Verify compartment integrity
python scripts/testing/verify_compartments.py

# Test compartment queries
curl "http://localhost:8000/fhir/R4/Patient/patient-123/$everything"
```

## 🖼️ DICOM Generation

### Automated Medical Imaging
Creates realistic DICOM files for ImagingStudy resources:

#### Supported Study Types
- **CT Scans**: Chest, abdomen, head
- **MRI**: Brain, spine, joints
- **X-Ray**: Chest, extremities
- **Ultrasound**: Cardiac, abdominal

#### DICOM Operations
```bash
# Generate DICOM for all imaging studies
python scripts/active/generate_dicom_for_studies.py

# Generate with custom parameters
python scripts/active/generate_dicom_for_studies.py --study-types CT,MRI --series-count 3

# Generate imaging reports
python scripts/active/generate_imaging_reports.py
```

#### Integration Features
- **FHIR Compliant**: Links to ImagingStudy resources
- **Multi-slice Support**: Realistic slice counts per study type
- **WADO-RS Ready**: Prepared for medical imaging viewers
- **Metadata Rich**: Proper DICOM tags and patient demographics

## ✅ Data Validation & Testing

### Comprehensive Validation Suite

#### Primary Validation Script
```bash
# Complete data validation with detailed analysis
python scripts/testing/validate_fhir_data.py --verbose

# Quick resource count check
python scripts/testing/check_synthea_resources.py

# Detailed data summary with examples
python scripts/testing/test_data_summary.py
```

#### Validation Categories

**Resource Integrity**
- Resource type counts and distribution
- Required field presence
- Data structure compliance
- Reference validity

**Clinical Data Quality**
- Patient demographics completeness
- Condition status accuracy
- Medication request validity
- Observation categorization

**Search Functionality**
- Parameter extraction completeness
- Index coverage verification
- Query performance testing
- Reference resolution accuracy

**System Integration**
- Compartment population health
- Cross-reference integrity
- API endpoint functionality
- Performance metrics

### Testing Framework

#### Automated Test Suite
```bash
# Run all validation tests
python scripts/testing/run_all_tests.py

# Test specific functionality
python scripts/testing/test_search_functionality.py
python scripts/testing/test_patient_everything.py
python scripts/testing/test_reference_searches.py

# Performance testing
python scripts/testing/test_patient_load_performance.py
python scripts/testing/test_include_performance.py
```

#### Quality Metrics
- **Resource Completeness**: % of expected resources present
- **Reference Integrity**: % of references that resolve
- **Search Coverage**: % of resources with indexed parameters
- **Performance Benchmarks**: Query response times and throughput

## 🛠️ Common Operations

### Daily Management Tasks

#### Unified Data Manager
```bash
# Load fresh patient data
docker exec emr-backend python scripts/manage_data.py load --patients 50

# Validate system health
docker exec emr-backend python scripts/manage_data.py validate --verbose

# Check system status
docker exec emr-backend python scripts/manage_data.py status

# Re-index search parameters
docker exec emr-backend python scripts/manage_data.py index
```

#### Direct Script Execution
```bash
# Quick data check
docker exec emr-backend python scripts/testing/check_synthea_resources.py

# Search parameter health check
docker exec emr-backend python scripts/active/consolidated_search_indexing.py --mode monitor

# Verify database schema
docker exec emr-backend python scripts/testing/verify_all_fhir_tables.py
```

### Development Workflows

#### Data Reset and Reload
```bash
# Complete data refresh
docker exec emr-backend python scripts/active/synthea_master.py full --count 20

# Incremental data addition
docker exec emr-backend python scripts/active/synthea_master.py generate --count 10
docker exec emr-backend python scripts/active/synthea_master.py import --validation-mode light
```

#### Performance Testing
```bash
# Test search parameter performance
docker exec emr-backend python scripts/testing/test_search_improvements.py

# Test patient query performance
docker exec emr-backend python scripts/testing/test_patient_load_performance.py

# Monitor query patterns
docker exec emr-backend python scripts/testing/monitor_search_params.py
```

## 🚨 Troubleshooting Guide

### Common Issues and Solutions

#### Database Connection Issues
```bash
# Check database connectivity
docker exec emr-postgres psql -U emr_user -d emr_db -c "SELECT version();"

# Verify table structure
docker exec emr-backend python scripts/testing/validate_database_schema.py

# Reinitialize if needed
docker exec emr-backend python scripts/setup/init_database_definitive.py --mode development
```

#### Missing Search Parameters
```bash
# Diagnose missing parameters
docker exec emr-backend python scripts/active/consolidated_search_indexing.py --mode verify

# Fix missing parameters
docker exec emr-backend python scripts/active/consolidated_search_indexing.py --mode fix

# Verify patient/subject parameters specifically
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT resource_type, COUNT(*) 
FROM fhir.search_params 
WHERE param_name IN ('patient', 'subject') 
GROUP BY resource_type;"
```

#### Empty Search Results
1. **Check Resource Existence**:
   ```bash
   docker exec emr-postgres psql -U emr_user -d emr_db -c "
   SELECT resource_type, COUNT(*) FROM fhir.resources GROUP BY resource_type;"
   ```

2. **Verify Search Parameters**:
   ```bash
   docker exec emr-backend python scripts/testing/verify_search_params_after_import.py --fix
   ```

3. **Test Direct Queries**:
   ```bash
   curl "http://localhost:8000/fhir/R4/Patient?name=Smith"
   curl "http://localhost:8000/fhir/R4/Condition?patient=Patient/123"
   ```

#### Performance Issues
```bash
# Check database indexes
docker exec emr-backend python scripts/setup/optimize_database_indexes.py

# Monitor query performance
docker exec emr-backend python scripts/testing/test_optimized_search.py

# Analyze slow queries
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;"
```

### Error Recovery Procedures

#### Data Corruption Recovery
1. **Backup Current State**: Always backup before recovery
2. **Validate Schema**: Ensure database structure is intact
3. **Re-import Data**: Use synthea_master.py with validation
4. **Re-index Search Parameters**: Run consolidated indexing
5. **Validate Results**: Run comprehensive validation suite

#### Reference Resolution Errors
```bash
# Fix URN reference mapping
docker exec emr-backend python scripts/fix_patient_search_params.py

# Normalize all references
docker exec emr-backend python scripts/setup/normalize_references.py

# Verify reference integrity
docker exec emr-backend python scripts/testing/monitor_references.py
```

## ⚡ Performance Optimization

### Batch Processing Guidelines
- **Import Batch Size**: 50-100 resources (configurable)
- **Search Indexing**: 2000 resources per batch
- **Compartment Population**: Process by resource type
- **Memory Management**: Stream processing for large datasets

### Database Optimization
- **Compound Indexes**: Multi-column indexes for common query patterns
- **Partial Indexes**: Filtered indexes for specific use cases  
- **Connection Pooling**: Async connection management
- **Query Optimization**: Prepared statements and parameterized queries

### Monitoring and Metrics
```bash
# System health monitoring
docker exec emr-backend python scripts/active/consolidated_search_indexing.py --mode monitor

# Performance benchmarking
docker exec emr-backend python scripts/testing/test_patient_load_performance.py

# Resource utilization
docker stats emr-backend emr-postgres
```

## 🔧 Configuration Options

### Environment Variables
```bash
# Database configuration
DATABASE_URL="postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db"

# Processing configuration
BATCH_SIZE=50
VALIDATION_MODE=light
PARALLEL_WORKERS=4

# Feature flags
ENABLE_DICOM=true
ENABLE_ENHANCEMENT=true
ENABLE_PERFORMANCE_LOGGING=true
```

### Script Parameters

#### Synthea Master Configuration
```bash
# Validation modes: none, transform_only, light, strict
--validation-mode light

# Batch processing
--batch-size 50

# Enhancement options
--full-enhancement  # Run all enhancement modules
--include-dicom     # Generate DICOM files
--clean-names       # Remove numeric suffixes from names
```

#### Search Indexing Configuration
```bash
# Operation modes: index, reindex, verify, fix, monitor
--mode fix

# Resource filtering
--resource-type Condition

# Performance tuning
--batch-size 2000
--parallel-workers 4
```

## 📚 Integration with WintEHR Core

### Frontend Integration
- **FHIR Client**: Direct API calls to indexed resources
- **Patient Context**: Uses compartments for efficient data loading
- **Search Optimization**: Leverages indexed parameters for fast queries
- **Real-time Updates**: WebSocket integration for data changes

### Backend Services
- **FHIR Storage Engine**: Uses validated schema and indexes
- **Search Service**: Optimized parameter-based queries
- **Audit Service**: Logs all data operations
- **Performance Monitoring**: Tracks query patterns and response times

### Clinical Modules
- **Chart Review**: Patient compartment queries
- **Orders**: Clinical catalog integration
- **Results**: Observation searches and trending
- **Pharmacy**: Medication request management
- **Imaging**: DICOM integration and viewer support

---

**Remember**: Data integrity is paramount in healthcare systems. Always validate operations and maintain comprehensive audit trails. When in doubt, use the most conservative validation modes and verify results thoroughly.