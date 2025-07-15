# FHIR Resource Testing: CareTeam

**FHIR R4 Specification**: https://hl7.org/fhir/R4/careteam.html  
**Test Status**: ❌ Minimal  
**Coverage**: 10% (4/40 test cases passing)

## Resource Overview

### Current Implementation Status
- ✅ **Storage**: JSONB storage in `fhir.resources`
- ❌ **Search Parameters**: Extracted to `fhir.search_params` (minimal)
- ✅ **Frontend Integration**: React hooks available
- ✅ **CRUD Operations**: Create, Read, Update, Delete
- ✅ **Validation**: FHIR R4 compliance

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Implementation | Notes |
|-----------|------|--------|-------------|----------------|-------|
| _id | token | ✅ | Required | Complete | Auto-indexed |
| _lastUpdated | date | ✅ | Optional | Complete | Auto-indexed |
| identifier | token | ❌ | Optional | **Missing** | Not extracted |
| status | token | ❌ | Optional | **Missing** | Proposed, active, suspended |
| category | token | ❌ | Optional | **Missing** | Team type |
| subject | reference | ✅ | Optional | Complete | Patient reference |
| patient | reference | ✅ | Optional | Complete | Same as subject |
| encounter | reference | ❌ | Optional | **Missing** | Associated encounter |
| date | date | ❌ | Optional | **Missing** | Team period |
| participant | reference | ❌ | Optional | **Missing** | Team members |
| participant-role | token | ❌ | Optional | **Missing** | Member roles |

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | Participant search not implemented | Cannot find teams by member | Add participant extraction |
| CRIT-002 | Status search missing | Cannot filter active teams | Add status extraction |
| CRIT-003 | Role search not available | Cannot find teams by member roles | Add participant role extraction |

## Test Results Summary
**Total Test Cases**: 40  
**Passing**: 4 (10%)  
**Failing**: 2 (5%)  
**Not Implemented**: 34 (85%)

---

**Next Steps**:
1. Implement participant and role search parameters
2. Add status and category indexing
3. Add comprehensive care team management support