# FHIR Resource Testing: MedicationRequest

**FHIR R4 Specification**: https://hl7.org/fhir/R4/medicationrequest.html  
**Test Status**: 🟡 In Progress  
**Coverage**: 25% (2/8 test categories implemented)

## Resource Overview

### Current Implementation Status
- ✅ **Storage**: JSONB storage in `fhir.resources`
- 🟡 **Search Parameters**: Partially implemented (6/8 R4 parameters)
- ❌ **Frontend Integration**: React hooks available but limited medication workflow
- ✅ **CRUD Operations**: Create, Read, Update, Delete
- ❌ **Validation**: FHIR R4 compliance validation needed

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | WintEHR Implementation | Notes |
|-----------|------|--------|-------------|----------------------|-------|
| _id | token | ✅ | Required | Yes | Standard FHIR parameter |
| _lastUpdated | date | ✅ | Optional | Yes | Standard FHIR parameter |
| identifier | token | ❌ | Optional | No | Business identifier missing |
| status | token | ✅ | Required | Yes | Implemented |
| intent | token | ✅ | Required | Yes | Implemented |
| subject | reference | ✅ | Required | Yes | Patient reference |
| patient | reference | ✅ | Optional | Yes | Same as subject |
| encounter | reference | ✅ | Optional | Yes | Encounter reference |
| medication | reference/token | ❌ | Required | Uses 'code' instead | Critical gap |
| requester | reference | ❌ | Optional | No | Missing prescriber info |
| performer | reference | ❌ | Optional | No | Missing dispenser info |
| authoredon | date | ✅ | Optional | Yes | Prescription date |

### Critical Implementation Gaps
1. **medication** parameter not implemented - uses 'code' instead
2. **identifier** parameter missing - affects business workflow integration
3. **requester** and **performer** references missing - affects workflow tracking

## Test Cases

### 1. CRUD Operations

#### 1.1 Create MedicationRequest
**Test ID**: `test_create_medication_request`
**Description**: Create valid MedicationRequest resource with medication reference
**Expected Result**: 201 Created with valid FHIR resource

```python
def test_create_medication_request():
    resource_data = {
        "resourceType": "MedicationRequest",
        "status": "active",
        "intent": "order",
        "medicationReference": {
            "reference": "Medication/lisinopril-10mg"
        },
        "subject": {
            "reference": "Patient/test-patient-1"
        },
        "requester": {
            "reference": "Practitioner/test-practitioner-1"
        },
        "authoredOn": "2024-01-15T10:30:00Z",
        "dosageInstruction": [{
            "text": "Take 10mg once daily",
            "timing": {
                "repeat": {
                    "frequency": 1,
                    "period": 1,
                    "periodUnit": "d"
                }
            },
            "doseAndRate": [{
                "doseQuantity": {
                    "value": 10,
                    "unit": "mg",
                    "system": "http://unitsofmeasure.org"
                }
            }]
        }]
    }
    response = client.post("/fhir/MedicationRequest", json=resource_data)
    assert response.status_code == 201
    assert response.json()["resourceType"] == "MedicationRequest"
    assert response.json()["status"] == "active"
    assert response.json()["intent"] == "order"
```

**SQL Validation**:
```sql
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = 'MedicationRequest' 
AND deleted = false;
```

**Status**: ❌ Not Implemented

#### 1.2 Read MedicationRequest
**Test ID**: `test_read_medication_request`
**Description**: Retrieve MedicationRequest by ID
**Status**: 🟡 Partially Implemented (basic test exists)

#### 1.3 Update MedicationRequest
**Test ID**: `test_update_medication_request`
**Description**: Update MedicationRequest status and dosage
**Status**: ❌ Not Implemented

#### 1.4 Delete MedicationRequest
**Test ID**: `test_delete_medication_request`
**Description**: Soft delete MedicationRequest
**Status**: ❌ Not Implemented

### 2. Search Parameter Tests

#### 2.1 Standard Parameters

##### 2.1.1 Search by _id
**Test ID**: `test_search_by_id`
**Status**: ✅ Passing

##### 2.1.2 Search by _lastUpdated
**Test ID**: `test_search_by_lastUpdated`
**Status**: ❌ Not Implemented

#### 2.2 Resource-Specific Parameters

##### 2.2.1 Status Parameter
**Test ID**: `test_search_by_status`
**Parameter Type**: token
**R4 Requirement**: Required
**Description**: Search by prescription status (active, completed, cancelled, etc.)

```python
def test_search_by_status():
    # Create test prescriptions with different statuses
    active_rx = create_medication_request(status="active")
    completed_rx = create_medication_request(status="completed")
    
    # Search for active prescriptions
    response = client.get("/fhir/MedicationRequest?status=active")
    assert response.status_code == 200
    results = response.json()["entry"]
    assert len(results) == 1
    assert results[0]["resource"]["status"] == "active"
```

**SQL Validation**:
```sql
SELECT * FROM fhir.search_params sp
JOIN fhir.resources r ON sp.resource_id = r.id
WHERE sp.parameter_name = 'status'
AND sp.parameter_value = 'active'
AND r.resource_type = 'MedicationRequest';
```

**Status**: 🟡 Partially Passing (basic test exists)

##### 2.2.2 Intent Parameter
**Test ID**: `test_search_by_intent`
**Parameter Type**: token
**R4 Requirement**: Required
**Description**: Search by prescription intent (order, plan, proposal, etc.)

**Status**: ❌ Not Implemented

##### 2.2.3 Patient/Subject Parameter
**Test ID**: `test_search_by_patient`
**Parameter Type**: reference
**R4 Requirement**: Required
**Description**: Search prescriptions for specific patient

```python
def test_search_by_patient():
    patient_id = "test-patient-1"
    response = client.get(f"/fhir/MedicationRequest?subject={patient_id}")
    assert response.status_code == 200
    results = response.json()["entry"]
    for entry in results:
        patient_ref = entry["resource"]["subject"]["reference"]
        assert patient_id in patient_ref
```

**Status**: ✅ Passing

##### 2.2.4 Medication Parameter (CRITICAL GAP)
**Test ID**: `test_search_by_medication`
**Parameter Type**: reference/token
**R4 Requirement**: Required
**Description**: Search by medication reference or medication code

```python
def test_search_by_medication_reference():
    medication_id = "Medication/lisinopril-10mg"
    response = client.get(f"/fhir/MedicationRequest?medication={medication_id}")
    assert response.status_code == 200
    
def test_search_by_medication_code():
    # Test with medication coding
    medication_code = "29046004"  # SNOMED code for Lisinopril
    response = client.get(f"/fhir/MedicationRequest?medication={medication_code}")
    assert response.status_code == 200
```

**Status**: ❌ CRITICAL - Not Implemented (uses 'code' parameter instead)

##### 2.2.5 Encounter Parameter
**Test ID**: `test_search_by_encounter`
**Parameter Type**: reference
**R4 Requirement**: Optional
**Description**: Search prescriptions by encounter

**Status**: ❌ Not Implemented

##### 2.2.6 Authored On Parameter
**Test ID**: `test_search_by_authoredon`
**Parameter Type**: date
**R4 Requirement**: Optional
**Description**: Search by prescription date with date operators

```python
def test_search_by_authoredon():
    # Test date range search
    start_date = "2024-01-01"
    end_date = "2024-01-31"
    response = client.get(f"/fhir/MedicationRequest?authoredon=ge{start_date}&authoredon=le{end_date}")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

### 3. Search Operators and Modifiers

#### 3.1 Token Parameters
- **Status exact match**: ✅ Working
- **Intent exact match**: ❌ Not tested
- **Status :not modifier**: ❌ Not implemented
- **System|code format for medication**: ❌ Critical gap

#### 3.2 Date Parameters
- **Date comparison operators**: ❌ Not tested
- **Date ranges**: ❌ Not tested
- **Precision handling**: ❌ Not tested

#### 3.3 Reference Parameters
- **Direct reference by ID**: ✅ Working for patient
- **Chained search**: ❌ Not tested
- **Reverse chaining**: ❌ Not implemented

### 4. Chained Search Tests

#### 4.1 Forward Chaining
**Test ID**: `test_forward_chaining`
**Example**: `GET /fhir/MedicationRequest?subject.name=Smith`
**Status**: ❌ Not Implemented

#### 4.2 Reverse Chaining
**Test ID**: `test_reverse_chaining`
**Example**: `GET /fhir/MedicationRequest?_has:MedicationDispense:prescription:status=completed`
**Status**: ❌ Not Implemented

### 5. Advanced Search Features

#### 5.1 Include/RevInclude
**Test ID**: `test_include_operations`
**Description**: Include related resources (Patient, Medication, Practitioner)
**Status**: ❌ Not Implemented

#### 5.2 Pagination
**Test ID**: `test_pagination`
**Parameters**: `_count`, `_offset`
**Status**: ❌ Not Implemented

#### 5.3 Sorting
**Test ID**: `test_sorting`
**Parameter**: `_sort`
**Status**: ❌ Not Implemented

### 6. Bundle Operations

#### 6.1 Batch Create
**Test ID**: `test_batch_create`
**Description**: Create multiple prescriptions in batch
**Status**: ❌ Not Implemented

#### 6.2 Transaction Operations
**Test ID**: `test_transaction_operations`
**Description**: Transactional prescription creation with medication
**Status**: ❌ Not Implemented

### 7. Conditional Operations

#### 7.1 Conditional Create
**Test ID**: `test_conditional_create`
**Description**: Create if prescription doesn't exist
**Status**: ❌ Not Implemented

#### 7.2 Conditional Update
**Test ID**: `test_conditional_update`
**Description**: Update prescription based on business rules
**Status**: ❌ Not Implemented

### 8. Error Handling

#### 8.1 Invalid Resource Data
**Test ID**: `test_invalid_resource_validation`
**Description**: Test validation of required fields
**Status**: ❌ Not Implemented

#### 8.2 Invalid Search Parameters
**Test ID**: `test_invalid_search_params`
**Description**: Test handling of unknown parameters
**Status**: ❌ Not Implemented

#### 8.3 Resource Not Found
**Test ID**: `test_resource_not_found`
**Description**: Test 404 handling
**Status**: ❌ Not Implemented

### 9. Medication Workflow Integration Tests

#### 9.1 Prescription to Dispense Workflow
**Test ID**: `test_prescription_to_dispense_workflow`
**Description**: Test complete prescription workflow
```python
def test_prescription_to_dispense_workflow():
    # 1. Create MedicationRequest
    prescription = create_medication_request()
    
    # 2. Create MedicationDispense linked to prescription
    dispense = create_medication_dispense(
        basedOn=[{"reference": f"MedicationRequest/{prescription['id']}"}]
    )
    
    # 3. Verify workflow relationships
    assert dispense["basedOn"][0]["reference"] == f"MedicationRequest/{prescription['id']}"
    
    # 4. Test reverse chaining to find related dispenses
    response = client.get(f"/fhir/MedicationRequest/{prescription['id']}?_revinclude=MedicationDispense:prescription")
    # Should include both prescription and dispense
```

**Status**: ❌ Not Implemented

#### 9.2 Medication Reference Resolution
**Test ID**: `test_medication_reference_resolution`
**Description**: Test medication reference vs medication code handling
**Status**: ❌ Critical Gap

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | medication search parameter not implemented | Cannot search prescriptions by medication | Implement medication parameter with reference/token support |
| CRIT-002 | Using 'code' instead of 'medication' parameter | Non-compliant with FHIR R4 specification | Replace 'code' with 'medication' parameter |
| CRIT-003 | Missing identifier parameter | Cannot integrate with external prescription systems | Add identifier search parameter |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | No requester/performer parameters | Cannot track who prescribed/dispenses | Add requester and performer search parameters |
| HIGH-002 | Limited search operator support | Reduced query flexibility | Implement :not, date operators, chaining |
| HIGH-003 | No workflow relationship testing | Integration gaps not caught | Add prescription-to-dispense workflow tests |

### Medium Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| MED-001 | Missing include/revinclude operations | Performance impact on related resource fetching | Implement _include and _revinclude |
| MED-002 | No validation testing | Invalid data may be stored | Add comprehensive validation tests |
| MED-003 | Limited error handling tests | Poor error user experience | Add error scenario coverage |

### Low Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| LOW-001 | No pagination testing | Potential performance issues with large datasets | Add pagination test coverage |
| LOW-002 | No sorting capability | Limited query result control | Implement _sort parameter |

## Recommendations

### Immediate Actions Required
1. **Fix medication parameter** - Replace 'code' with proper 'medication' parameter supporting both reference and token types
2. **Add identifier parameter** - Critical for business workflow integration
3. **Implement requester/performer parameters** - Essential for prescription workflow tracking
4. **Add medication reference resolution tests** - Ensure proper medication linking

### Future Enhancements
1. Implement advanced search features (include, pagination, sorting)
2. Add comprehensive workflow integration tests
3. Improve error handling and validation
4. Add performance testing for large prescription datasets

## Test Results Summary

**Total Test Cases**: 32  
**Passing**: 3 (9%)  
**Failing**: 5 (16%)  
**Not Implemented**: 24 (75%)

**Coverage by Category**:
- CRUD Operations: 1/4 (25%)
- Search Parameters: 2/8 (25%)
- Chained Queries: 0/2 (0%)
- Advanced Features: 0/3 (0%)
- Bundle Operations: 0/2 (0%)
- Conditional Operations: 0/2 (0%)
- Error Handling: 0/3 (0%)
- Workflow Integration: 0/2 (0%)

## Notes

- Test implementation status as of: 2025-07-14
- Last updated: 2025-07-14
- Reviewer: Agent 2
- Related Issues: Critical medication parameter gap, missing workflow integration

---

**Next Steps**:
1. Fix critical medication parameter implementation
2. Add missing identifier and workflow parameters
3. Implement medication workflow integration tests
4. Add comprehensive validation and error handling tests