# Bundle Resource Testing Documentation

## Overview

The Bundle resource is a container for a collection of resources. It is the fundamental infrastructure resource that enables atomic transaction processing, batch operations, and resource bundling in FHIR R4. This document provides comprehensive testing strategies for Bundle functionality.

## Bundle Types & Use Cases

### 1. Transaction Bundle
**Purpose**: All operations execute as a single atomic unit
- **Rollback Behavior**: If any operation fails, entire transaction is rolled back
- **Processing Mode**: All-or-nothing execution
- **Use Cases**: Creating patient with multiple related resources, order entry workflows

### 2. Batch Bundle
**Purpose**: Independent operations that can fail individually
- **Processing Mode**: Each entry processed independently
- **Failure Handling**: Individual operation failures don't affect others
- **Use Cases**: Bulk data import, independent resource updates

### 3. Collection Bundle
**Purpose**: Simple resource grouping without processing requirements
- **Processing Mode**: No specific processing rules
- **Use Cases**: Resource packaging for distribution

### 4. Search Bundle
**Purpose**: Contains search results
- **Response Type**: System-generated from search operations
- **Contents**: Resources matching search criteria

### 5. History Bundle
**Purpose**: Contains resource history entries
- **Response Type**: System-generated from history operations
- **Contents**: Historical versions of resources

### 6. Document Bundle
**Purpose**: FHIR document with Composition as first entry
- **Structure**: Composition followed by referenced resources
- **Use Cases**: Clinical documents, care summaries

## Current Implementation Analysis

### Storage Engine Bundle Processing

Located in: `/backend/core/fhir/storage.py`

#### Transaction Processing (`process_bundle_dict`)
```python
# Transaction handling - All operations must succeed
if bundle_type == "transaction":
    try:
        for entry in entries:
            response_entry = await self._process_bundle_entry_dict(entry)
            response_bundle['entry'].append(response_entry)
        await self.session.commit()
    except Exception as e:
        await self.session.rollback()
        raise
```

#### Batch Processing
```python
# Batch - independent operations
for entry in entries:
    try:
        response_entry = await self._process_bundle_entry_dict(entry)
        await self.session.commit()
    except Exception as e:
        # Create error response but continue processing
        await self.session.rollback()
```

#### Supported Operations
- **POST**: Resource creation
- **PUT**: Resource updates
- **DELETE**: Resource deletion
- **GET**: Resource reads and searches

## Test Categories

### 1. Transaction Integrity Tests

#### TC-BUN-001: Transaction Success
**Objective**: Verify successful atomic transaction processing

**Test Steps**:
1. Create transaction bundle with multiple resource creations
2. Submit to `/fhir` endpoint
3. Verify all resources created successfully
4. Verify response bundle contains success statuses
5. Verify atomic commit

**Expected Results**:
- All resources created in database
- Response bundle type: "transaction-response"
- All entry responses have 201 status
- Single database transaction

#### TC-BUN-002: Transaction Rollback
**Objective**: Verify transaction rollback on any failure

**Test Steps**:
1. Create transaction bundle with valid and invalid resources
2. Include one resource with validation error
3. Submit bundle
4. Verify complete rollback

**Expected Results**:
- No resources created in database
- OperationOutcome with error details
- Database state unchanged
- All operations rolled back

#### TC-BUN-003: Transaction Reference Resolution
**Objective**: Verify internal reference resolution

**Test Steps**:
1. Create Patient with fullUrl: "urn:uuid:patient-1"
2. Create Observation referencing "urn:uuid:patient-1"
3. Submit as transaction bundle
4. Verify reference resolution

**Expected Results**:
- Patient created with new ID
- Observation.subject.reference updated to actual Patient ID
- Internal references resolved correctly

### 2. Batch Processing Tests

#### TC-BUN-004: Batch Independent Processing
**Objective**: Verify independent entry processing

**Test Steps**:
1. Create batch bundle with mix of valid/invalid entries
2. Submit bundle
3. Verify successful entries processed
4. Verify failed entries return errors

**Expected Results**:
- Valid resources created successfully
- Invalid entries return 4xx/5xx status
- Response bundle contains mix of success/error
- No rollback of successful operations

#### TC-BUN-005: Batch Error Isolation
**Objective**: Verify error isolation in batch processing

**Test Steps**:
1. Create batch with entry causing database error
2. Include other valid entries
3. Submit bundle
4. Verify error isolation

**Expected Results**:
- Failed entry returns OperationOutcome
- Other entries process successfully
- No cross-contamination of errors

### 3. Bundle Operation Tests

#### TC-BUN-006: Create Operations
**Objective**: Test POST operations in bundles

**Test Steps**:
1. Create bundle with POST entries
2. Include conditional creates (if-none-exist)
3. Submit bundle
4. Verify creation behavior

**Expected Results**:
- Resources created with generated IDs
- Conditional creates respect existing resources
- 201 status for new resources
- Location headers in responses

#### TC-BUN-007: Update Operations
**Objective**: Test PUT operations in bundles

**Test Steps**:
1. Create resources first
2. Create bundle with PUT updates
3. Include If-Match headers
4. Submit bundle

**Expected Results**:
- Resources updated successfully
- Version IDs incremented
- 200 status for updates
- ETag validation working

#### TC-BUN-008: Delete Operations
**Objective**: Test DELETE operations in bundles

**Test Steps**:
1. Create resources first
2. Create bundle with DELETE entries
3. Submit bundle
4. Verify deletion

**Expected Results**:
- Resources soft-deleted
- 204 status for deletions
- Resources not returned in searches

#### TC-BUN-009: Search Operations
**Objective**: Test GET operations with search

**Test Steps**:
1. Create bundle with search GET entries
2. Include search parameters
3. Submit bundle
4. Verify search results

**Expected Results**:
- Search results in response entries
- Correct Bundle.type for search results
- Search parameters applied correctly

### 4. Bundle Structure Validation Tests

#### TC-BUN-010: Bundle Type Validation
**Objective**: Verify bundle type validation

**Test Steps**:
1. Submit bundles with invalid types
2. Submit bundles with missing types
3. Verify validation errors

**Expected Results**:
- Invalid types rejected
- Clear error messages
- OperationOutcome with specifics

#### TC-BUN-011: Entry Structure Validation
**Objective**: Verify bundle entry validation

**Test Steps**:
1. Submit entries without required request elements
2. Submit entries with malformed URLs
3. Verify validation

**Expected Results**:
- Malformed entries rejected
- Clear validation messages
- Processing stops appropriately

### 5. Performance and Scalability Tests

#### TC-BUN-012: Large Bundle Processing
**Objective**: Test large bundle performance

**Test Steps**:
1. Create bundle with 1000+ entries
2. Submit as transaction
3. Monitor processing time and memory
4. Verify completion

**Expected Results**:
- Bundle processes within reasonable time
- Memory usage stays within limits
- All entries processed correctly
- No timeout errors

#### TC-BUN-013: Concurrent Bundle Processing
**Objective**: Test concurrent bundle submissions

**Test Steps**:
1. Submit multiple bundles simultaneously
2. Include overlapping resources
3. Monitor for race conditions
4. Verify data integrity

**Expected Results**:
- No race conditions
- Data integrity maintained
- Proper database locking
- Consistent results

### 6. Error Handling Tests

#### TC-BUN-014: Malformed Bundle Handling
**Objective**: Test malformed bundle rejection

**Test Steps**:
1. Submit bundles with syntax errors
2. Submit bundles with missing fields
3. Verify error handling

**Expected Results**:
- Clear error messages
- OperationOutcome responses
- No system crashes
- Graceful degradation

#### TC-BUN-015: Resource Validation in Bundles
**Objective**: Test resource validation within bundles

**Test Steps**:
1. Include invalid resources in bundles
2. Test FHIR validation errors
3. Verify error propagation

**Expected Results**:
- Individual resource validation
- Clear error attribution
- Proper error responses
- No partial commits in transactions

### 7. Integration Tests

#### TC-BUN-016: WebSocket Notification Integration
**Objective**: Verify WebSocket notifications for bundle operations

**Test Steps**:
1. Subscribe to WebSocket notifications
2. Submit transaction bundle
3. Verify notifications sent

**Expected Results**:
- Notifications sent for each resource operation
- Correct notification format
- Proper timing

#### TC-BUN-017: Search Parameter Extraction
**Objective**: Verify search parameter extraction for bundled resources

**Test Steps**:
1. Submit bundle with various resource types
2. Verify search parameters extracted
3. Test searchability of created resources

**Expected Results**:
- Search parameters extracted correctly
- Resources findable via search
- Indexes updated properly

## Testing Implementation

### Unit Tests
```python
# Test file: test_bundle_processing.py

class TestBundleProcessing:
    async def test_transaction_success(self):
        # TC-BUN-001 implementation
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "request": {"method": "POST", "url": "Patient"},
                    "resource": valid_patient_data
                },
                {
                    "request": {"method": "POST", "url": "Observation"},
                    "resource": valid_observation_data
                }
            ]
        }
        
        response = await storage.process_bundle_dict(bundle)
        
        assert response["type"] == "transaction-response"
        assert len(response["entry"]) == 2
        assert all(entry["response"]["status"] == "201" 
                  for entry in response["entry"])
    
    async def test_transaction_rollback(self):
        # TC-BUN-002 implementation
        bundle = {
            "resourceType": "Bundle",
            "type": "transaction",
            "entry": [
                {
                    "request": {"method": "POST", "url": "Patient"},
                    "resource": valid_patient_data
                },
                {
                    "request": {"method": "POST", "url": "Patient"},
                    "resource": invalid_patient_data  # Missing required fields
                }
            ]
        }
        
        with pytest.raises(Exception):
            await storage.process_bundle_dict(bundle)
        
        # Verify no resources were created
        patients, _ = await storage.search_resources("Patient", {})
        assert len(patients) == 0
```

### Integration Tests
```python
# Test file: test_bundle_integration.py

class TestBundleIntegration:
    async def test_bundle_endpoint(self):
        # Full API integration test
        response = await client.post("/fhir", json=transaction_bundle)
        
        assert response.status_code == 200
        bundle_response = response.json()
        assert bundle_response["resourceType"] == "Bundle"
        assert bundle_response["type"] == "transaction-response"
```

### Performance Tests
```python
# Test file: test_bundle_performance.py

class TestBundlePerformance:
    async def test_large_bundle_processing(self):
        # Create bundle with 1000 entries
        large_bundle = create_large_bundle(1000)
        
        start_time = time.time()
        response = await storage.process_bundle_dict(large_bundle)
        processing_time = time.time() - start_time
        
        assert processing_time < 60  # Should complete within 1 minute
        assert len(response["entry"]) == 1000
```

## Test Data

### Sample Transaction Bundle
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "fullUrl": "urn:uuid:patient-1",
      "request": {
        "method": "POST",
        "url": "Patient"
      },
      "resource": {
        "resourceType": "Patient",
        "name": [{"family": "Test", "given": ["Transaction"]}],
        "gender": "unknown"
      }
    },
    {
      "request": {
        "method": "POST",
        "url": "Observation"
      },
      "resource": {
        "resourceType": "Observation",
        "status": "final",
        "code": {
          "coding": [{"system": "http://loinc.org", "code": "8302-2"}]
        },
        "subject": {"reference": "urn:uuid:patient-1"},
        "valueQuantity": {"value": 185, "unit": "cm"}
      }
    }
  ]
}
```

### Sample Batch Bundle
```json
{
  "resourceType": "Bundle",
  "type": "batch",
  "entry": [
    {
      "request": {
        "method": "GET",
        "url": "Patient?name=Test"
      }
    },
    {
      "request": {
        "method": "POST",
        "url": "Patient"
      },
      "resource": {
        "resourceType": "Patient",
        "name": [{"family": "Batch", "given": ["Test"]}],
        "gender": "unknown"
      }
    }
  ]
}
```

## Critical Test Scenarios

### Scenario 1: Patient Admission Workflow
```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "fullUrl": "urn:uuid:patient-1",
      "request": {"method": "POST", "url": "Patient"},
      "resource": {/* Patient data */}
    },
    {
      "fullUrl": "urn:uuid:encounter-1", 
      "request": {"method": "POST", "url": "Encounter"},
      "resource": {
        "resourceType": "Encounter",
        "subject": {"reference": "urn:uuid:patient-1"},
        "status": "in-progress"
      }
    },
    {
      "request": {"method": "POST", "url": "Observation"},
      "resource": {
        "resourceType": "Observation",
        "subject": {"reference": "urn:uuid:patient-1"},
        "encounter": {"reference": "urn:uuid:encounter-1"},
        "status": "final"
      }
    }
  ]
}
```

### Scenario 2: Bulk Data Import
```json
{
  "resourceType": "Bundle",
  "type": "batch",
  "entry": [
    /* Multiple Patient resources from external system */
    /* Some may already exist, some may have validation errors */
    /* Batch processing ensures independent handling */
  ]
}
```

## Validation Rules

### Bundle-Level Validation
1. **Bundle.type** is required and must be valid value
2. **Bundle.entry** array validation
3. **Bundle.entry.request** required for transaction/batch bundles
4. **Bundle.entry.fullUrl** uniqueness within bundle

### Entry-Level Validation
1. **entry.request.method** must be valid HTTP method
2. **entry.request.url** must be valid relative URL
3. **entry.resource** required for POST/PUT operations
4. **conditional parameters** properly formatted

### Transaction-Specific Validation
1. **Reference integrity** within bundle
2. **Circular reference** detection
3. **Resource dependency** ordering
4. **Conditional operation** validation

## Error Scenarios & Expected Outcomes

### Bundle Processing Errors
| Error Type | Bundle Type | Expected Outcome |
|------------|-------------|------------------|
| Invalid JSON | Any | 400 Bad Request |
| Missing Bundle.type | Any | 400 Bad Request |
| Invalid entry.request | Transaction/Batch | 400 Bad Request |
| Resource validation error | Transaction | Complete rollback |
| Resource validation error | Batch | Individual entry error |
| Database constraint violation | Transaction | Complete rollback |
| Database constraint violation | Batch | Individual entry error |

### Reference Resolution Errors
| Scenario | Expected Outcome |
|----------|------------------|
| Invalid fullUrl format | 400 Bad Request |
| Circular references | 400 Bad Request |
| Missing referenced resource | 400 Bad Request |
| Duplicate fullUrl values | 400 Bad Request |

## Implementation Notes

### Current Limitations
1. **Search in bundles**: Limited search parameter support
2. **Reference resolution**: Basic implementation for urn:uuid
3. **Conditional operations**: Partial implementation
4. **Bundle validation**: Basic structure validation

### Performance Considerations
1. **Memory usage**: Large bundles may consume significant memory
2. **Database connections**: Transaction bundles hold connections longer
3. **Processing time**: Complex bundles may timeout
4. **Concurrent access**: Bundle processing may create contention

### Security Considerations
1. **Resource access**: Bundle operations respect resource-level security
2. **Operation authorization**: Each operation checked independently
3. **Data validation**: Full FHIR validation applied
4. **Audit logging**: Bundle operations logged appropriately

## Automation & CI/CD

### Automated Test Execution
```bash
# Run all bundle tests
pytest tests/test_bundle_* -v

# Run specific test category
pytest tests/test_bundle_transactions.py -v

# Run performance tests
pytest tests/test_bundle_performance.py -v --benchmark
```

### Test Coverage Requirements
- **Transaction processing**: 100% path coverage
- **Batch processing**: 100% path coverage  
- **Error handling**: 95% branch coverage
- **Bundle validation**: 100% condition coverage

### CI/CD Integration
```yaml
# .github/workflows/bundle-tests.yml
name: Bundle Testing
on: [push, pull_request]
jobs:
  bundle-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Bundle Tests
        run: |
          docker-compose up -d postgres
          pytest tests/test_bundle_* --cov --cov-report=xml
      - name: Upload Coverage
        uses: codecov/codecov-action@v1
```

## Recent Updates

### 2025-07-14
- Created comprehensive Bundle testing documentation
- Defined transaction integrity test cases
- Established batch processing validation scenarios
- Added performance and scalability test requirements
- Documented error handling and validation rules

---

**Next Steps**: 
1. Implement automated test suite based on this documentation
2. Add bundle-specific performance monitoring
3. Enhance reference resolution capabilities
4. Implement advanced conditional operation support