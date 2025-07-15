# FHIR Resource Testing: Condition

**FHIR R4 Specification**: https://hl7.org/fhir/R4/condition.html  
**Test Status**: 🟡 In Progress  
**Coverage**: 20% (8/40 test cases passing)

## Resource Overview

### Current Implementation Status
- ✅ **Storage**: JSONB storage in `fhir.resources`
- ✅ **Search Parameters**: Extracted to `fhir.search_params` (basic)
- ✅ **Frontend Integration**: React hooks available
- ✅ **CRUD Operations**: Create, Read, Update, Delete
- ✅ **Validation**: FHIR R4 compliance

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Implementation | Notes |
|-----------|------|--------|-------------|----------------|-------|
| _id | token | ✅ | Required | Complete | Auto-indexed |
| _lastUpdated | date | ✅ | Optional | Complete | Auto-indexed |
| identifier | token | ❌ | Optional | **Missing** | Not extracted |
| code | token | ✅ | Optional | Complete | ICD-10, SNOMED codes |
| clinical-status | token | ✅ | Optional | Complete | Active, resolved, etc. |
| verification-status | token | ❌ | Optional | **Missing** | Not extracted |
| category | token | ❌ | Optional | **Missing** | Problem list, encounter diagnosis |
| severity | token | ❌ | Optional | **Missing** | Severity assessment |
| subject | reference | ✅ | Optional | Complete | Patient reference |
| patient | reference | ✅ | Optional | Complete | Same as subject |
| encounter | reference | ✅ | Optional | Complete | Associated encounter |
| onset-date | date | ❌ | Optional | **Missing** | When condition started |
| onset-age | quantity | ❌ | Optional | **Missing** | Age at onset |
| abatement-date | date | ❌ | Optional | **Missing** | When resolved |
| recorded-date | date | ❌ | Optional | **Missing** | When first recorded |
| recorder | reference | ❌ | Optional | **Missing** | Who recorded |
| asserter | reference | ❌ | Optional | **Missing** | Who asserted |
| stage | token | ❌ | Optional | **Missing** | Disease stage |
| evidence | token | ❌ | Optional | **Missing** | Supporting evidence |
| evidence-detail | reference | ❌ | Optional | **Missing** | Evidence references |

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | Onset date search not implemented | Cannot find conditions by onset timing | Add onset date extraction |
| CRIT-002 | Verification status not indexed | Cannot distinguish confirmed vs suspected | Add verification status extraction |
| CRIT-003 | Severity search missing | Cannot filter by condition severity | Add severity field extraction |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | Category search not available | Cannot distinguish problem types | Add category extraction |
| HIGH-002 | Recorder/asserter not indexed | Cannot find conditions by recording provider | Add recorder/asserter extraction |
| HIGH-003 | Stage information not searchable | Cannot filter by disease progression | Add stage extraction |

## Test Results Summary
**Total Test Cases**: 40  
**Passing**: 8 (20%)  
**Failing**: 5 (12.5%)  
**Not Implemented**: 27 (67.5%)

---

**Next Steps**:
1. Implement onset/abatement date search parameters
2. Add verification status and severity indexing
3. Add category and stage search support