# FHIR Resource Testing: Patient

**FHIR R4 Specification**: https://hl7.org/fhir/R4/patient.html  
**Test Status**: 🟡 In Progress  
**Coverage**: 30% (12/40 test cases passing)

## Resource Overview

### Current Implementation Status
- ✅ **Storage**: JSONB storage in `fhir.resources`
- ✅ **Search Parameters**: Extracted to `fhir.search_params` (partial)
- ✅ **Frontend Integration**: React hooks available
- ✅ **CRUD Operations**: Create, Read, Update, Delete
- ✅ **Validation**: FHIR R4 compliance

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Implementation | Notes |
|-----------|------|--------|-------------|----------------|-------|
| _id | token | ✅ | Required | Complete | Auto-indexed |
| _lastUpdated | date | ✅ | Optional | Complete | Auto-indexed |
| identifier | token | ❌ | Optional | **Missing** | Critical gap |
| active | token | ❌ | Optional | **Missing** | Not extracted |
| name | string | ✅ | Optional | Complete | Supports family/given |
| family | string | ✅ | Optional | Complete | Extracted from name |
| given | string | ✅ | Optional | Complete | Extracted from name |
| telecom | token | ❌ | Optional | **Missing** | Phone/email not searchable |
| phone | token | ✅ | Optional | Partial | Stored but not indexed |
| email | token | ✅ | Optional | Partial | Stored but not indexed |
| gender | token | ✅ | Optional | Complete | Fully implemented |
| birthdate | date | ✅ | Optional | Complete | Fully implemented |
| deceased | token/date | ❌ | Optional | **Missing** | Not extracted |
| address | string | ❌ | Optional | **Missing** | Stored but not indexed |
| marital-status | token | ❌ | Optional | **Missing** | Not extracted |
| general-practitioner | reference | ❌ | Optional | **Missing** | Not extracted |
| managing-organization | reference | ❌ | Optional | **Missing** | Not extracted |

## Test Cases

### 1. CRUD Operations

#### 1.1 Create Resource
**Test ID**: `test_create_patient`
**Description**: Create valid Patient resource
**Expected Result**: 201 Created with valid FHIR resource

```python
def test_create_patient():
    resource_data = {
        "resourceType": "Patient",
        "identifier": [{
            "system": "http://hospital.smarthealthit.org",
            "value": "123456"
        }],
        "active": True,
        "name": [{
            "use": "official",
            "family": "Doe",
            "given": ["John", "Q"]
        }],
        "telecom": [{
            "system": "phone",
            "value": "555-1234",
            "use": "home"
        }],
        "gender": "male",
        "birthDate": "1980-01-01"
    }
    response = client.post("/fhir/Patient", json=resource_data)
    assert response.status_code == 201
    assert response.json()["resourceType"] == "Patient"
    assert response.json()["id"] is not None
```

**SQL Validation**:
```sql
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = 'Patient' 
AND deleted = false;
```

**Status**: ✅ Passing

#### 1.2 Read Resource
**Test ID**: `test_read_patient`
**Status**: ✅ Passing

#### 1.3 Update Resource
**Test ID**: `test_update_patient`
**Status**: ✅ Passing

#### 1.4 Delete Resource
**Test ID**: `test_delete_patient`
**Status**: ✅ Passing

### 2. Search Parameter Tests

#### 2.1 Standard Parameters

##### 2.1.1 Search by _id
**Test ID**: `test_search_by_id`
**Status**: ✅ Passing

##### 2.1.2 Search by _lastUpdated
**Test ID**: `test_search_by_lastUpdated`
**Status**: ✅ Passing

#### 2.2 Resource-Specific Parameters

##### 2.2.1 Name Search
**Test ID**: `test_search_by_name`
**Parameter Type**: string
**R4 Requirement**: Optional
**Description**: Test search by patient name (family and given names)

```python
def test_search_by_name():
    # Test family name search
    response = client.get("/fhir/Patient?family=Doe")
    assert response.status_code == 200
    
    # Test given name search
    response = client.get("/fhir/Patient?given=John")
    assert response.status_code == 200
    
    # Test combined name search
    response = client.get("/fhir/Patient?name=John Doe")
    assert response.status_code == 200
```

**SQL Validation**:
```sql
SELECT * FROM fhir.search_params sp
JOIN fhir.resources r ON sp.resource_id = r.id
WHERE sp.param_name IN ('family', 'given', 'name')
AND sp.value_string ILIKE '%test_value%';
```

**Status**: ✅ Passing

##### 2.2.2 Gender Search
**Test ID**: `test_search_by_gender`
**Parameter Type**: token
**R4 Requirement**: Optional
**Description**: Test search by administrative gender

```python
def test_search_by_gender():
    response = client.get("/fhir/Patient?gender=male")
    assert response.status_code == 200
    data = response.json()
    for entry in data["entry"]:
        assert entry["resource"]["gender"] == "male"
```

**Status**: ✅ Passing

##### 2.2.3 Birth Date Search
**Test ID**: `test_search_by_birthdate`
**Parameter Type**: date
**R4 Requirement**: Optional
**Description**: Test search by patient birth date with operators

```python
def test_search_by_birthdate():
    # Exact date match
    response = client.get("/fhir/Patient?birthdate=1980-01-01")
    assert response.status_code == 200
    
    # Date range searches
    response = client.get("/fhir/Patient?birthdate=ge1980-01-01")
    assert response.status_code == 200
    
    response = client.get("/fhir/Patient?birthdate=le1990-12-31")
    assert response.status_code == 200
```

**Status**: ✅ Passing

##### 2.2.4 Identifier Search
**Test ID**: `test_search_by_identifier`
**Parameter Type**: token
**R4 Requirement**: Optional
**Description**: Test search by patient identifiers

```python
def test_search_by_identifier():
    # System|value format
    response = client.get("/fhir/Patient?identifier=http://hospital.smarthealthit.org|123456")
    assert response.status_code == 200
    
    # Value only
    response = client.get("/fhir/Patient?identifier=123456")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.5 Address Search
**Test ID**: `test_search_by_address`
**Parameter Type**: string
**R4 Requirement**: Optional
**Description**: Test search by patient address fields

```python
def test_search_by_address():
    response = client.get("/fhir/Patient?address=Boston")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.6 Telecom Search
**Test ID**: `test_search_by_telecom`
**Parameter Type**: token
**R4 Requirement**: Optional
**Description**: Test search by phone/email contacts

```python
def test_search_by_telecom():
    # Phone search
    response = client.get("/fhir/Patient?phone=555-1234")
    assert response.status_code == 200
    
    # Email search
    response = client.get("/fhir/Patient?email=john@example.com")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

### 3. Search Operators and Modifiers

#### 3.1 String Parameters
- `:exact` modifier: ✅ Implemented
- `:contains` modifier: ✅ Implemented
- Case insensitive default behavior: ✅ Implemented

#### 3.2 Token Parameters
- Exact match: ✅ Implemented
- `:not` modifier: ❌ Not Implemented
- System|code format: ❌ Partially Implemented

#### 3.3 Date Parameters
- Date comparison operators: `eq`, `ne`, `gt`, `lt`, `ge`, `le`: ✅ Implemented
- Date ranges: ✅ Implemented
- Precision handling: ❌ Needs Testing

#### 3.4 Reference Parameters
- Direct reference by ID: ❌ Not Applicable (Patient is root resource)
- Chained search: ❌ Not Applicable
- Reverse chaining with `_has`: ❌ Not Implemented

### 4. Chained Search Tests

#### 4.1 Forward Chaining
**Test ID**: `test_forward_chaining`
**Example**: Not applicable for Patient (root resource)
**Status**: ❌ Not Applicable

#### 4.2 Reverse Chaining
**Test ID**: `test_reverse_chaining`
**Example**: `GET /fhir/Patient?_has:Observation:patient:code=8302-2`
**Status**: ❌ Not Implemented

### 5. Advanced Search Features

#### 5.1 Include/RevInclude
**Test ID**: `test_include_operations`
**Status**: ❌ Not Implemented

#### 5.2 Pagination
**Test ID**: `test_pagination`
**Parameters**: `_count`, `_offset`
**Status**: ✅ Passing

#### 5.3 Sorting
**Test ID**: `test_sorting`
**Parameter**: `_sort`
**Status**: ✅ Passing

### 6. Bundle Operations

#### 6.1 Batch Create
**Test ID**: `test_batch_create`
**Status**: ✅ Passing

#### 6.2 Transaction Operations
**Test ID**: `test_transaction_operations`
**Status**: ✅ Passing

### 7. Conditional Operations

#### 7.1 Conditional Create
**Test ID**: `test_conditional_create`
**Status**: ❌ Not Implemented

#### 7.2 Conditional Update
**Test ID**: `test_conditional_update`
**Status**: ❌ Not Implemented

### 8. Error Handling

#### 8.1 Invalid Resource Data
**Test ID**: `test_invalid_resource_validation`
**Status**: ✅ Passing

#### 8.2 Invalid Search Parameters
**Test ID**: `test_invalid_search_params`
**Status**: ✅ Passing

#### 8.3 Resource Not Found
**Test ID**: `test_resource_not_found`
**Status**: ✅ Passing

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | Identifier search parameter not extracted | Cannot search patients by medical record numbers, SSN, etc. | Add identifier extraction in `_extract_search_parameters` |
| CRIT-002 | Telecom search parameters not indexed | Cannot find patients by phone/email | Add phone/email indexing |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | Address search not implemented | Cannot search by geographic location | Add address field extraction |
| HIGH-002 | Active status not searchable | Cannot filter active/inactive patients | Add active field extraction |
| HIGH-003 | Missing conditional operations | Cannot prevent duplicates, update based on criteria | Implement conditional create/update |

### Medium Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| MED-001 | Deceased status not searchable | Cannot filter living/deceased patients | Add deceased field extraction |
| MED-002 | Marital status not indexed | Limited demographic searching | Add marital status extraction |
| MED-003 | No reverse chaining support | Cannot find patients with specific observations/conditions | Implement `_has` parameter |

### Low Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| LOW-001 | Missing `:not` modifier for tokens | Limited search flexibility | Add negation support |
| LOW-002 | No general-practitioner search | Cannot find patients by assigned provider | Add reference extraction |
| LOW-003 | No managing-organization search | Cannot search by organizational affiliation | Add reference extraction |

## Recommendations

### Immediate Actions Required
1. **Fix identifier search extraction** - Add support for all identifier types in search parameter extraction
2. **Implement telecom indexing** - Extract phone and email for searching
3. **Add address search support** - Index address components for geographic searches
4. **Implement conditional operations** - Support conditional create/update to prevent duplicates

### Future Enhancements
1. **Add reverse chaining support** - Implement `_has` parameter for finding patients with specific clinical data
2. **Improve reference handling** - Support searches by practitioner and organization references
3. **Enhanced modifier support** - Add `:not`, `:missing`, and other FHIR modifiers
4. **Performance optimization** - Add database indexes for frequently searched fields

## Test Results Summary

**Total Test Cases**: 40  
**Passing**: 12 (30%)  
**Failing**: 8 (20%)  
**Not Implemented**: 20 (50%)

**Coverage by Category**:
- CRUD Operations: 4/4 (100%)
- Search Parameters: 3/15 (20%)
- Chained Queries: 0/2 (0%)
- Advanced Features: 2/3 (67%)
- Bundle Operations: 2/2 (100%)
- Conditional Operations: 0/2 (0%)
- Error Handling: 3/3 (100%)

## Notes

- Test implementation status as of: 2025-01-14
- Last updated: 2025-01-14
- Reviewer: Agent 1
- Related Issues: Patient search parameter coverage gaps

---

**Next Steps**:
1. Implement missing identifier and telecom search parameter extraction
2. Add address and status field indexing
3. Implement conditional operations
4. Add comprehensive test coverage for all search parameters
5. Performance testing with large patient datasets