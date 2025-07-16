# FHIR Reference Implementation Comparison Tests

This directory contains tools for comparing our FHIR implementation against reference implementations like HAPI FHIR to ensure compatibility and compliance.

## Overview

The reference comparison framework provides:
- Automated setup of reference FHIR servers
- Data synchronization between servers
- Comprehensive query comparison tests
- Detailed compatibility reports

## Quick Start

### 1. Quick Compatibility Check

Run a quick check against the public HAPI FHIR server:

```bash
python run_comparison_tests.py --quick
```

### 2. Full Local Comparison

Run full comparison with a local reference server:

```bash
# This will start HAPI FHIR in Docker, sync data, and run tests
python run_comparison_tests.py --full --manage-reference
```

### 3. Compare Against Existing Server

If you already have a reference server running:

```bash
python run_comparison_tests.py --full \
  --reference-server http://localhost:8080/fhir
```

## Components

### 1. Reference Implementation Comparison (`reference_impl_comparison.py`)

Core comparison engine that:
- Executes identical queries on both servers
- Normalizes results for comparison
- Calculates match percentages
- Identifies specific discrepancies

### 2. Data Synchronizer (`sync_test_data.py`)

Ensures both servers have identical test data:
- Copies resources from source to target
- Maintains reference mappings
- Verifies data consistency

### 3. Reference Server Setup (`setup_reference_server.py`)

Manages reference FHIR servers:
- Starts/stops HAPI FHIR via Docker
- Loads test datasets
- Imports Synthea bundles

### 4. Test Runner (`run_comparison_tests.py`)

Orchestrates the complete testing process:
- Manages server lifecycle
- Coordinates data sync
- Runs comparisons
- Generates reports

## Docker Setup

The framework includes Docker Compose configuration for reference servers:

```yaml
# docker-compose.reference.yml
services:
  hapi-fhir:
    image: hapiproject/hapi:v6.8.0
    ports:
      - "8080:8080"
  
  hapi-db:
    image: postgres:15-alpine
```

Start manually:
```bash
docker-compose -f docker-compose.reference.yml up -d
```

## Test Coverage

The comparison suite tests:

### Basic Searches
- All resources: `GET /Patient`
- Count limits: `GET /Patient?_count=10`
- Token search: `GET /Patient?gender=female`
- String search: `GET /Patient?name=Smith`
- Date search: `GET /Patient?birthdate=ge1980-01-01`

### Advanced Features
- Include: `GET /Patient?_include=Patient:general-practitioner`
- Revinclude: `GET /Patient?_revinclude=Observation:patient`
- Chained search: `GET /Patient?general-practitioner.name=Smith`
- Has parameter: `GET /Patient?_has:Observation:patient:code=8867-4`
- Sort: `GET /Patient?_sort=birthdate`

### Resource-Specific
- Observations by code
- MedicationRequests with status
- Practitioners with patients
- Organizations with hierarchy

## Reports

Reports are generated in the `reports/` directory:

### Text Report (`comparison_report_YYYYMMDD_HHMMSS.txt`)
```
FHIR Implementation Comparison Report
=====================================
Summary
-------
Total Tests: 30
Passed: 27
Failed: 3
Success Rate: 90.0%

FAILED TESTS:
- Chained search 'general-practitioner.name=Smith'
  Match: 75.0%
  Differences:
    - Total mismatch: our=10, reference=12
```

### JSON Report (`comparison_report_YYYYMMDD_HHMMSS.json`)
Structured data for programmatic analysis.

## Interpreting Results

### Match Percentages
- **100%**: Identical results
- **90-99%**: Minor differences, likely acceptable
- **75-90%**: Notable differences, review needed
- **<75%**: Significant discrepancies

### Common Discrepancies
1. **Total mismatch**: Different result counts
2. **ID differences**: Resources included/excluded
3. **Sort order**: Different ordering algorithms
4. **Default behaviors**: Different server defaults

## Troubleshooting

### Reference Server Won't Start
```bash
# Check if ports are in use
lsof -i :8080

# Clean up Docker
docker-compose -f docker-compose.reference.yml down -v
```

### Data Sync Fails
```bash
# Verify servers are accessible
curl http://localhost:8000/fhir/R4/metadata
curl http://localhost:8080/fhir/metadata

# Check server logs
docker logs hapi-fhir-reference
```

### Comparison Errors
- Ensure both servers support FHIR R4
- Check network connectivity
- Verify data exists on both servers

## Advanced Usage

### Custom Test Queries

Add custom queries to `reference_impl_comparison.py`:

```python
test_queries = [
    # (resource_type, params, description)
    ("Patient", {"identifier": "12345"}, "Patient by identifier"),
    ("Observation", {"combo-code-value-quantity": "8867-4$gt70"}, "Composite search"),
]
```

### Alternative Reference Servers

Configure different reference implementations:

```bash
# Microsoft FHIR Server
python run_comparison_tests.py --full \
  --reference-server http://localhost:8081/

# IBM FHIR Server  
python run_comparison_tests.py --full \
  --reference-server http://localhost:9443/fhir-server/api/v4
```

### Continuous Integration

Add to CI pipeline:

```yaml
# .github/workflows/fhir-comparison.yml
- name: Run FHIR Comparison Tests
  run: |
    python run_comparison_tests.py --quick
    python run_comparison_tests.py --full --manage-reference
```

## Best Practices

1. **Regular Testing**: Run comparisons after major changes
2. **Data Consistency**: Always sync data before comparing
3. **Review Failures**: Some differences may be acceptable
4. **Document Deviations**: Track intentional differences
5. **Update Tests**: Add new queries as features are added

## Future Enhancements

- [ ] Support for other FHIR versions (STU3, R5)
- [ ] Performance comparison metrics
- [ ] Conformance statement comparison
- [ ] CapabilityStatement validation
- [ ] Automated fix suggestions