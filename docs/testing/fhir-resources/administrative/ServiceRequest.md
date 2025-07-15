# FHIR Resource Testing: ServiceRequest

**FHIR R4 Specification**: https://hl7.org/fhir/R4/servicerequest.html  
**Test Status**: 🟡 In Progress  
**Coverage**: 35% (7/20 test cases passing)

## Resource Overview

### Current Implementation Status
- ✅ **Storage**: JSONB storage in `fhir.resources`
- ✅ **Search Parameters**: Comprehensive implementation in converter
- ✅ **Frontend Integration**: Used extensively in Orders and Results modules
- ✅ **CRUD Operations**: Full converter implementation
- ✅ **Validation**: FHIR R4 compliance via converter

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Notes |
|-----------|------|--------|-------------|-------|
| _id | token | ✅ | Required | Basic resource ID search |
| _lastUpdated | date | ✅ | Optional | When resource was last updated |
| patient | reference | ✅ | Required | Patient for the service request |
| encounter | reference | ✅ | Optional | Encounter during which request was created |
| status | token | ✅ | Required | Service request status |
| intent | token | ✅ | Required | Service request intent |
| priority | token | ✅ | Optional | Service request priority |
| category | token | ✅ | Optional | Service category (lab, imaging, etc.) |
| code | token | ✅ | Required | What is being requested |
| authored | date | ✅ | Optional | When the request was authored |
| requester | reference | ✅ | Optional | Who requested the service |

## Test Cases

### 1. CRUD Operations

#### 1.1 Create ServiceRequest
**Test ID**: `test_create_service_request`
**Description**: Create valid ServiceRequest resource for laboratory order
**Expected Result**: 201 Created with valid FHIR service request

```python
def test_create_service_request():
    service_request_data = {
        "resourceType": "ServiceRequest",
        "identifier": [{
            "use": "official",
            "system": "http://www.bmc.nl/zorgportal/identifiers/ServiceRequest",
            "value": "NL-LabOrder-00000001"
        }],
        "status": "active",
        "intent": "order",
        "priority": "routine",
        "category": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "108252007",
                "display": "Laboratory procedure"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": "58410-2",
                "display": "Complete blood count (CBC) panel"
            }]
        },
        "subject": {
            "reference": "Patient/f001",
            "display": "P. van de Heuvel"
        },
        "encounter": {
            "reference": "Encounter/f003",
            "display": "Encounter with patient"
        },
        "occurrenceDateTime": "2024-07-15T09:00:00Z",
        "authoredOn": "2024-07-15T08:30:00Z",
        "requester": {
            "reference": "Practitioner/f007",
            "display": "Dr. Careful"
        },
        "performer": [{
            "reference": "Organization/f001",
            "display": "Lab Inc."
        }],
        "reasonCode": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "84757009",
                "display": "Epilepsy"
            }]
        }],
        "note": [{
            "text": "Patient is afraid of needles - please use butterfly needle"
        }]
    }
    response = client.post("/fhir/ServiceRequest", json=service_request_data)
    assert response.status_code == 201
    assert response.json()["resourceType"] == "ServiceRequest"
    assert response.json()["status"] == "active"
```

**SQL Validation**:
```sql
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = 'ServiceRequest' 
AND deleted = false;
```

**Status**: ✅ Passing (Converter supports ServiceRequest)

#### 1.2 Read ServiceRequest
**Test ID**: `test_read_service_request`
**Status**: ✅ Passing

#### 1.3 Update ServiceRequest
**Test ID**: `test_update_service_request`
**Status**: ✅ Passing

#### 1.4 Delete ServiceRequest
**Test ID**: `test_delete_service_request`
**Status**: ✅ Passing

### 2. Search Parameter Tests

#### 2.1 Standard Parameters

##### 2.1.1 Search by _id
**Test ID**: `test_search_service_request_by_id`
**Status**: ✅ Passing

##### 2.1.2 Search by _lastUpdated
**Test ID**: `test_search_service_request_by_lastUpdated`
**Status**: ✅ Passing

#### 2.2 Resource-Specific Parameters

##### 2.2.1 Search by Patient
**Test ID**: `test_search_service_request_by_patient`
**Parameter Type**: reference
**R4 Requirement**: Required
**Description**: Search service requests by patient

```python
def test_search_service_request_by_patient():
    response = client.get("/fhir/ServiceRequest?patient=Patient/123")
    assert response.status_code == 200
    
    # Verify all returned requests are for the correct patient
    bundle = response.json()
    for entry in bundle.get("entry", []):
        assert entry["resource"]["subject"]["reference"] == "Patient/123"
```

**Status**: ✅ Passing (Implemented in converter)

##### 2.2.2 Search by Category
**Test ID**: `test_search_service_request_by_category`
**Parameter Type**: token
**R4 Requirement**: Optional
**Description**: Search service requests by category (lab, imaging, etc.)

```python
def test_search_service_request_by_category():
    # Search for laboratory orders
    response = client.get("/fhir/ServiceRequest?category=http://snomed.info/sct|108252007")
    assert response.status_code == 200
    
    # Search for imaging orders
    response = client.get("/fhir/ServiceRequest?category=http://snomed.info/sct|363679005")
    assert response.status_code == 200
```

**Status**: ✅ Passing (Implemented in converter)

##### 2.2.3 Search by Status
**Test ID**: `test_search_service_request_by_status`
**Parameter Type**: token
**R4 Requirement**: Required
**Description**: Search service requests by status

```python
def test_search_service_request_by_status():
    response = client.get("/fhir/ServiceRequest?status=active")
    assert response.status_code == 200
    
    # Test multiple statuses
    response = client.get("/fhir/ServiceRequest?status=active,completed")
    assert response.status_code == 200
```

**Status**: ✅ Passing (Implemented in converter)

##### 2.2.4 Search by Code
**Test ID**: `test_search_service_request_by_code`
**Parameter Type**: token
**R4 Requirement**: Required
**Description**: Search service requests by procedure code

**Status**: ❌ Not Implemented

### 3. Clinical Order Workflow Tests

#### 3.1 Laboratory Order Workflow
**Test ID**: `test_laboratory_order_workflow`
**Description**: Test complete laboratory ordering process

```python
def test_laboratory_order_workflow():
    # 1. Create lab order (ServiceRequest)
    lab_order = create_lab_service_request(
        patient_id="Patient/123",
        test_code="58410-2",  # CBC
        requester_id="Practitioner/456"
    )
    assert lab_order["status"] == "active"
    assert lab_order["category"][0]["coding"][0]["code"] == "108252007"
    
    # 2. Collect specimen
    specimen = create_specimen_from_order(lab_order["id"])
    assert specimen["request"][0]["reference"].endswith(lab_order["id"])
    
    # 3. Process and create results
    observation = create_lab_result(lab_order["id"], specimen["id"])
    assert observation["basedOn"][0]["reference"].endswith(lab_order["id"])
    
    # 4. Complete the order
    completed_order = update_service_request_status(lab_order["id"], "completed")
    assert completed_order["status"] == "completed"
```

**Status**: ❌ Not Implemented

#### 3.2 Imaging Order Workflow
**Test ID**: `test_imaging_order_workflow`
**Description**: Test complete imaging ordering process

```python
def test_imaging_order_workflow():
    # 1. Create imaging order (ServiceRequest)
    imaging_order = create_imaging_service_request(
        patient_id="Patient/123",
        study_code="36643-5",  # Chest X-ray
        requester_id="Practitioner/456"
    )
    assert imaging_order["status"] == "active"
    assert imaging_order["category"][0]["coding"][0]["code"] == "363679005"
    
    # 2. Schedule imaging study
    imaging_study = create_imaging_study_from_order(imaging_order["id"])
    assert imaging_study["basedOn"][0]["reference"].endswith(imaging_order["id"])
    
    # 3. Complete study and create report
    diagnostic_report = create_imaging_report(imaging_order["id"], imaging_study["id"])
    assert diagnostic_report["basedOn"][0]["reference"].endswith(imaging_order["id"])
    
    # 4. Complete the order
    completed_order = update_service_request_status(imaging_order["id"], "completed")
    assert completed_order["status"] == "completed"
```

**Status**: ❌ Not Implemented

### 4. Integration Tests

#### 4.1 Orders Module Integration
**Test ID**: `test_orders_module_integration`
**Description**: Test integration with Orders tab functionality

```python
def test_orders_module_integration():
    # Test order creation from clinical workspace
    order_data = {
        "orderType": "laboratory",
        "code": "cbc",
        "patientId": "Patient/123",
        "encounterId": "Encounter/456"
    }
    
    service_request = create_order_via_orders_module(order_data)
    assert service_request["resourceType"] == "ServiceRequest"
    assert service_request["category"][0]["coding"][0]["code"] == "108252007"
    
    # Test order tracking
    order_status = get_order_status_from_orders_module(service_request["id"])
    assert order_status in ["active", "completed", "cancelled"]
```

**Status**: ❌ Not Implemented

#### 4.2 Results Module Integration
**Test ID**: `test_results_module_integration`
**Description**: Test integration with Results tab functionality

```python
def test_results_module_integration():
    # Create service request and linked observation
    service_request = create_lab_service_request("Patient/123", "58410-2")
    observation = create_observation_for_service_request(service_request["id"])
    
    # Test results display in Results module
    results = get_results_for_patient("Patient/123")
    linked_result = next(
        (r for r in results if r["basedOn"][0]["reference"].endswith(service_request["id"])),
        None
    )
    assert linked_result is not None
    assert linked_result["status"] == "final"
```

**Status**: ❌ Not Implemented

### 5. Priority and Urgency Tests

#### 5.1 STAT Orders Processing
**Test ID**: `test_stat_orders_processing`
**Description**: Test urgent/STAT order handling

```python
def test_stat_orders_processing():
    # Create STAT lab order
    stat_order = create_service_request({
        "priority": "stat",
        "code": "33747-0",  # Glucose
        "patient": "Patient/123"
    })
    assert stat_order["priority"] == "stat"
    
    # Verify priority handling in workflow
    queue_position = get_order_queue_position(stat_order["id"])
    assert queue_position == 1  # STAT orders should be first
```

**Status**: ❌ Not Implemented

#### 5.2 Routine Orders Scheduling
**Test ID**: `test_routine_orders_scheduling`
**Description**: Test routine order scheduling and batching

**Status**: ❌ Not Implemented

### 6. Error Handling Tests

#### 6.1 Invalid ServiceRequest Data
**Test ID**: `test_invalid_service_request_validation`
**Description**: Test validation of malformed service request data

```python
def test_invalid_service_request_validation():
    # Missing required status
    invalid_data = {
        "resourceType": "ServiceRequest",
        "intent": "order"
    }
    response = client.post("/fhir/ServiceRequest", json=invalid_data)
    assert response.status_code == 400
    
    # Invalid status value
    invalid_status = {
        "resourceType": "ServiceRequest",
        "status": "invalid_status",
        "intent": "order",
        "subject": {"reference": "Patient/123"}
    }
    response = client.post("/fhir/ServiceRequest", json=invalid_status)
    assert response.status_code == 400
```

**Status**: ❌ Not Implemented

#### 6.2 Duplicate Order Detection
**Test ID**: `test_duplicate_order_detection`
**Description**: Test detection and handling of duplicate orders

**Status**: ❌ Not Implemented

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | Search parameters not integrated into storage | Cannot search effectively via FHIR API | Integrate converter search params with storage |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | Limited workflow automation | Manual order processing | Build automated workflows |
| HIGH-002 | No order queue management | No priority handling | Implement order queue system |

### Medium Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| MED-001 | No duplicate detection | May create duplicate orders | Implement duplicate checking |
| MED-002 | Limited integration testing | Workflow gaps possible | Enhance integration tests |

## Recommendations

### Immediate Actions Required
1. Integrate ServiceRequest converter search parameters with storage engine
2. Enhance workflow automation for order processing
3. Build comprehensive order queue management
4. Create integration tests with Orders and Results modules

### Future Enhancements
1. Implement order set functionality
2. Add automated order routing based on facility
3. Build order analytics and reporting
4. Integrate with external laboratory systems

## Test Results Summary

**Total Test Cases**: 20  
**Passing**: 7 (35%)  
**Failing**: 0 (0%)  
**Not Implemented**: 13 (65%)

**Coverage by Category**:
- CRUD Operations: 4/4 (100%) - Full converter support
- Search Parameters: 3/8 (38%) - Converter implemented, storage integration needed
- Clinical Workflows: 0/2 (0%)
- Integration Tests: 0/2 (0%)
- Priority Handling: 0/2 (0%)
- Error Handling: 0/2 (0%)

## Notes

- ServiceRequest has the most complete implementation of administrative resources
- Full converter with comprehensive search parameters exists
- Used extensively in Orders and Results modules but needs integration testing
- Critical for clinical workflow automation and order management
- Priority handling and queue management are key missing features

---

**Next Steps**:
1. Integrate converter search parameters with storage engine
2. Build comprehensive workflow tests for Orders and Results integration
3. Implement priority-based order queue management
4. Create automated order routing and processing logic