# Comprehensive FHIR API Test Suite

This directory contains a comprehensive test suite for the WintEHR FHIR R4 API implementation.

**Created**: 2025-01-20  
**Purpose**: Ensure full FHIR R4 compliance and robust API functionality

## 📁 Test Structure

```
fhir_comprehensive/
├── test_crud_operations.py         # Basic CRUD tests for all resource types
├── test_search_simple.py           # Simple search parameter tests
├── test_search_complex.py          # Complex and chained query tests
├── test_search_modifiers.py        # Search modifier tests (:exact, :contains, etc.)
├── test_special_operations.py      # $everything, history, etc.
├── test_bundle_operations.py       # Transaction and batch bundle tests
├── test_conditional_operations.py  # Conditional create/update/delete
├── test_include_operations.py      # _include and _revinclude tests
├── test_fhir_compliance.py         # FHIR R4 spec compliance validation
├── test_error_handling.py          # Error scenarios and edge cases
├── test_performance.py             # Performance and load tests
├── test_security.py                # Security and access control tests
├── conftest.py                     # Pytest configuration and fixtures
├── test_data/                      # Test data and expected results
│   ├── sample_patients.json
│   ├── expected_results.json
│   └── invalid_resources.json
└── reports/                        # Test execution reports
```

## 🧪 Test Categories

### 1. CRUD Operations (test_crud_operations.py)
- **Create**: POST /fhir/R4/{resourceType}
- **Read**: GET /fhir/R4/{resourceType}/{id}
- **Update**: PUT /fhir/R4/{resourceType}/{id}
- **Delete**: DELETE /fhir/R4/{resourceType}/{id}
- **Vread**: GET /fhir/R4/{resourceType}/{id}/_history/{version}

### 2. Simple Search (test_search_simple.py)
- Single parameter searches (name, birthdate, identifier)
- Common parameters (_id, _lastUpdated)
- Resource-specific searches (patient, subject, code, status)
- Pagination (_count, page)
- Sorting (_sort)

### 3. Complex Search (test_search_complex.py)
- Multiple parameter combinations
- Chained searches (patient.name, subject:Patient.name)
- Reverse chaining (_has)
- Composite searches (code-value-quantity)
- Token searches with system|code

### 4. Search Modifiers (test_search_modifiers.py)
- :exact (exact string match)
- :contains (substring match)
- :missing (missing values)
- :above/:below (quantity comparisons)
- :not (negation)
- :text (text search)

### 5. Special Operations (test_special_operations.py)
- Patient/$everything
- Resource/_history
- System/_history
- $validate operation
- $meta operations

### 6. Bundle Operations (test_bundle_operations.py)
- Transaction bundles
- Batch bundles
- Search result bundles
- History bundles
- Collection bundles

### 7. Conditional Operations (test_conditional_operations.py)
- Conditional create (If-None-Exist)
- Conditional update (If-Match)
- Conditional delete
- ETag support

### 8. Include Operations (test_include_operations.py)
- _include (forward references)
- _revinclude (reverse references)
- :iterate modifier
- Multiple includes
- Circular reference handling

### 9. FHIR Compliance (test_fhir_compliance.py)
- Resource validation
- Required fields
- Cardinality rules
- Code system validation
- Reference integrity

### 10. Error Handling (test_error_handling.py)
- 400 Bad Request scenarios
- 404 Not Found handling
- 409 Conflict resolution
- 422 Unprocessable Entity
- OperationOutcome responses

## 🚀 Running Tests

### Quick Start (Recommended)
```bash
# Run the comprehensive test suite with automatic setup
cd backend/tests/fhir_comprehensive
./run_tests.sh

# This script will:
# 1. Set up the test environment (index search params, populate compartments)
# 2. Run all FHIR API tests
# 3. Generate a compliance report
```

### Test Runner Options
```bash
# Skip environment setup (if already done)
./run_tests.sh --quick

# Run specific test module
./run_tests.sh --module search_simple
./run_tests.sh --module crud
./run_tests.sh --module compliance

# Run with verbose output
./run_tests.sh --verbose

# Skip report generation
./run_tests.sh --no-report
```

### Manual Test Execution
```bash
# Set up test environment first
docker exec emr-backend-dev python tests/fhir_comprehensive/setup_test_environment.py

# Run all tests
docker exec emr-backend-dev python -m pytest tests/fhir_comprehensive/ -v -o asyncio_mode=auto

# Run with coverage
docker exec emr-backend-dev python -m pytest tests/fhir_comprehensive/ --cov=backend/fhir --cov-report=html -o asyncio_mode=auto

# Run specific category
docker exec emr-backend-dev python -m pytest tests/fhir_comprehensive/test_crud_operations.py -v -o asyncio_mode=auto
```

### Performance Tests
```bash
# Run performance tests (may take longer)
pytest backend/tests/fhir_comprehensive/test_performance.py -v --benchmark

# Run with specific patient count
pytest backend/tests/fhir_comprehensive/test_performance.py -v --patients=100
```

### Compliance Tests
```bash
# Generate FHIR compliance report
docker exec emr-backend-dev python tests/fhir_comprehensive/generate_compliance_matrix.py
```

## 📊 Test Data Requirements

The test suite requires a properly prepared database that mirrors the production build process:

1. **Database Schema**: All 6 FHIR tables must exist
2. **Patient Data**: At least 5 Synthea-generated patients
3. **Search Parameters**: Indexed for all resources
4. **Compartments**: Populated for Patient/$everything
5. **Database Indexes**: Optimized for performance

### Automatic Setup
The `setup_test_environment.py` script handles all requirements:
```bash
# Run setup manually if needed
docker exec emr-backend-dev python tests/fhir_comprehensive/setup_test_environment.py

# Check current status without running setup
docker exec emr-backend-dev python tests/fhir_comprehensive/setup_test_environment.py --summary-only
```

### Manual Data Preparation
If you need to prepare data manually:
```bash
# 1. Generate patient data (if not present)
docker exec emr-backend-dev python scripts/active/synthea_master.py full --count 10

# 2. Index search parameters
docker exec emr-backend-dev python scripts/fast_search_indexing.py --docker

# 3. Populate compartments
docker exec emr-backend-dev python scripts/populate_compartments.py

# 4. Optimize database
docker exec emr-backend-dev python scripts/optimize_database_indexes.py
```

## 🎯 Test Objectives

### Primary Goals
1. **FHIR R4 Compliance**: Ensure all operations conform to FHIR R4 specification
2. **Search Functionality**: Validate all search parameters and modifiers work correctly
3. **Data Integrity**: Verify resource validation and reference integrity
4. **Performance**: Ensure acceptable response times under load
5. **Error Handling**: Proper error responses with OperationOutcome

### Success Criteria
- 100% of CRUD operations pass for all resource types
- All search parameters return correct results
- Complex queries execute within 2 seconds
- Special operations complete successfully
- Error scenarios return appropriate HTTP status codes
- Performance benchmarks meet requirements

## 📈 Metrics and Reporting

### Test Metrics
- Test coverage percentage
- Pass/fail rates by category
- Performance benchmarks
- FHIR compliance score
- Error rate analysis

### Report Generation
```bash
# Generate HTML report
pytest backend/tests/fhir_comprehensive/ --html=reports/test_report.html

# Generate JSON report for CI/CD
pytest backend/tests/fhir_comprehensive/ --json=reports/test_results.json

# Generate compliance matrix
python backend/tests/fhir_comprehensive/generate_compliance_matrix.py
```

## 🔍 Common Test Patterns

### Basic Search Test
```python
async def test_patient_search_by_name():
    response = await client.get("/fhir/R4/Patient?name=Smith")
    assert response.status_code == 200
    bundle = response.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "searchset"
    assert len(bundle["entry"]) > 0
```

### Chained Search Test
```python
async def test_observation_chained_search():
    response = await client.get(
        "/fhir/R4/Observation?subject:Patient.name=Smith&category=vital-signs"
    )
    assert response.status_code == 200
    # Verify results are for patients named Smith
```

### Performance Test
```python
@pytest.mark.benchmark
async def test_patient_everything_performance():
    start = time.time()
    response = await client.get(f"/fhir/R4/Patient/{patient_id}/$everything")
    duration = time.time() - start
    assert response.status_code == 200
    assert duration < 2.0  # Should complete within 2 seconds
```

## 🐛 Debugging Failed Tests

### Enable Debug Logging
```python
# In conftest.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Inspect Database State
```bash
# Check resource counts
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT resource_type, COUNT(*) 
FROM fhir.resources 
GROUP BY resource_type;"

# Check search parameters
docker exec emr-backend python scripts/monitor_search_params.py
```

### Common Issues
1. **Missing search parameters**: Run indexing script
2. **Empty results**: Verify test data exists
3. **Slow queries**: Check database indexes
4. **Reference errors**: Validate compartment population

## 🔗 Related Documentation

- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [FHIR Search](https://hl7.org/fhir/R4/search.html)
- [FHIR Operations](https://hl7.org/fhir/R4/operations.html)
- [WintEHR API Documentation](../../../docs/API_ENDPOINTS.md)