# FHIR Resource Testing: [RESOURCE_NAME]

**FHIR R4 Specification**: https://hl7.org/fhir/R4/[resource_name].html  
**Test Status**: ❌ Not Started | 🟡 In Progress | ✅ Complete  
**Coverage**: 0% (0/X test cases passing)

## Resource Overview

### Current Implementation Status
- ✅/❌ **Storage**: JSONB storage in `fhir.resources`
- ✅/❌ **Search Parameters**: Extracted to `fhir.search_params`
- ✅/❌ **Frontend Integration**: React hooks available
- ✅/❌ **CRUD Operations**: Create, Read, Update, Delete
- ✅/❌ **Validation**: FHIR R4 compliance

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Notes |
|-----------|------|--------|-------------|-------|
| _id | token | ✅/❌ | Required | |
| _lastUpdated | date | ✅/❌ | Optional | |
| [param1] | [type] | ✅/❌ | Required/Optional | |

## Test Cases

### 1. CRUD Operations

#### 1.1 Create Resource
**Test ID**: `test_create_[resource_name]`
**Description**: Create valid [RESOURCE_NAME] resource
**Expected Result**: 201 Created with valid FHIR resource

```python
def test_create_[resource_name]():
    resource_data = {
        "resourceType": "[RESOURCE_NAME]",
        # ... test data
    }
    response = client.post("/fhir/[RESOURCE_NAME]", json=resource_data)
    assert response.status_code == 201
    # Additional assertions
```

**SQL Validation**:
```sql
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = '[RESOURCE_NAME]' 
AND deleted = false;
```

**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 1.2 Read Resource
**Test ID**: `test_read_[resource_name]`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 1.3 Update Resource
**Test ID**: `test_update_[resource_name]`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 1.4 Delete Resource
**Test ID**: `test_delete_[resource_name]`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

### 2. Search Parameter Tests

#### 2.1 Standard Parameters

##### 2.1.1 Search by _id
**Test ID**: `test_search_by_id`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

##### 2.1.2 Search by _lastUpdated
**Test ID**: `test_search_by_lastUpdated`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 2.2 Resource-Specific Parameters

##### 2.2.1 [Parameter Name]
**Test ID**: `test_search_by_[parameter]`
**Parameter Type**: [string|token|date|reference|quantity|number|uri]
**R4 Requirement**: Required/Optional
**Description**: Test search by [parameter description]

```python
def test_search_by_[parameter]():
    # Test implementation
    pass
```

**SQL Validation**:
```sql
SELECT * FROM fhir.search_params sp
JOIN fhir.resources r ON sp.resource_id = r.id
WHERE sp.parameter_name = '[parameter]'
AND sp.parameter_value = '[test_value]';
```

**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

### 3. Search Operators and Modifiers

#### 3.1 String Parameters
- `:exact` modifier
- `:contains` modifier
- Case insensitive default behavior

#### 3.2 Token Parameters
- Exact match
- `:not` modifier
- System|code format

#### 3.3 Date Parameters
- Date comparison operators: `eq`, `ne`, `gt`, `lt`, `ge`, `le`
- Date ranges
- Precision handling

#### 3.4 Reference Parameters
- Direct reference by ID
- Chained search
- Reverse chaining with `_has`

### 4. Chained Search Tests

#### 4.1 Forward Chaining
**Test ID**: `test_forward_chaining`
**Example**: `GET /fhir/[RESOURCE_NAME]?[reference_param].[target_param]=[value]`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 4.2 Reverse Chaining
**Test ID**: `test_reverse_chaining`
**Example**: `GET /fhir/[RESOURCE_NAME]?_has:[SourceType]:[reference_param]:[search_param]=[value]`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

### 5. Advanced Search Features

#### 5.1 Include/RevInclude
**Test ID**: `test_include_operations`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 5.2 Pagination
**Test ID**: `test_pagination`
**Parameters**: `_count`, `_offset`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 5.3 Sorting
**Test ID**: `test_sorting`
**Parameter**: `_sort`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

### 6. Bundle Operations

#### 6.1 Batch Create
**Test ID**: `test_batch_create`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 6.2 Transaction Operations
**Test ID**: `test_transaction_operations`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

### 7. Conditional Operations

#### 7.1 Conditional Create
**Test ID**: `test_conditional_create`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 7.2 Conditional Update
**Test ID**: `test_conditional_update`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

### 8. Error Handling

#### 8.1 Invalid Resource Data
**Test ID**: `test_invalid_resource_validation`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 8.2 Invalid Search Parameters
**Test ID**: `test_invalid_search_params`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

#### 8.3 Resource Not Found
**Test ID**: `test_resource_not_found`
**Status**: ❌ Not Implemented | 🟡 Failing | ✅ Passing

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | [Description] | [Impact] | [Fix] |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | [Description] | [Impact] | [Fix] |

### Medium Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| MED-001 | [Description] | [Impact] | [Fix] |

### Low Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| LOW-001 | [Description] | [Impact] | [Fix] |

## Recommendations

### Immediate Actions Required
1. [Action 1]
2. [Action 2]

### Future Enhancements
1. [Enhancement 1]
2. [Enhancement 2]

## Test Results Summary

**Total Test Cases**: 0  
**Passing**: 0 (0%)  
**Failing**: 0 (0%)  
**Not Implemented**: 0 (0%)

**Coverage by Category**:
- CRUD Operations: 0/4 (0%)
- Search Parameters: 0/X (0%)
- Chained Queries: 0/2 (0%)
- Advanced Features: 0/3 (0%)
- Bundle Operations: 0/2 (0%)
- Conditional Operations: 0/2 (0%)
- Error Handling: 0/3 (0%)

## Notes

- Test implementation status as of: [DATE]
- Last updated: [DATE]
- Reviewer: [NAME]
- Related Issues: [GitHub Issues]

---

**Next Steps**:
1. Implement missing test cases
2. Fix failing tests
3. Improve search parameter coverage
4. Add integration tests