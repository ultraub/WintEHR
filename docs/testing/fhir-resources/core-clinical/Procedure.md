# FHIR Resource Testing: Procedure

**FHIR R4 Specification**: https://hl7.org/fhir/R4/procedure.html  
**Test Status**: 🟡 In Progress  
**Coverage**: 25% (10/40 test cases passing)

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
| code | token | ✅ | Optional | Complete | CPT, SNOMED codes |
| status | token | ✅ | Optional | Complete | Completed, in-progress |
| subject | reference | ✅ | Optional | Complete | Patient reference |
| patient | reference | ✅ | Optional | Complete | Same as subject |
| encounter | reference | ❌ | Optional | **Missing** | Associated encounter |
| date | date | ✅ | Optional | Complete | When performed |
| performed | date | ✅ | Optional | Complete | Same as date |
| performer | reference | ❌ | Optional | **Missing** | Who performed |
| location | reference | ❌ | Optional | **Missing** | Where performed |
| category | token | ❌ | Optional | **Missing** | Procedure category |
| instantiates-canonical | reference | ❌ | Optional | **Missing** | Protocol followed |
| instantiates-uri | uri | ❌ | Optional | **Missing** | External protocol |
| based-on | reference | ❌ | Optional | **Missing** | Originating request |
| part-of | reference | ❌ | Optional | **Missing** | Parent procedure |
| reason-code | token | ❌ | Optional | **Missing** | Why performed |
| reason-reference | reference | ❌ | Optional | **Missing** | Condition/observation |

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | Performer search not implemented | Cannot find procedures by surgeon/provider | Add performer reference extraction |
| CRIT-002 | Encounter reference missing | Cannot link procedures to visits | Add encounter reference extraction |
| CRIT-003 | Location search not available | Cannot search by OR, clinic, etc. | Add location reference extraction |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | Category search missing | Cannot filter by procedure type | Add category extraction |
| HIGH-002 | Reason code/reference not indexed | Cannot find procedures by indication | Add reason field extraction |
| HIGH-003 | Based-on reference not supported | Cannot link to originating orders | Add based-on extraction |

## Test Results Summary
**Total Test Cases**: 40  
**Passing**: 10 (25%)  
**Failing**: 8 (20%)  
**Not Implemented**: 22 (55%)

---

**Next Steps**:
1. Implement performer and encounter reference indexing
2. Add location and category search support
3. Add reason code/reference search parameters