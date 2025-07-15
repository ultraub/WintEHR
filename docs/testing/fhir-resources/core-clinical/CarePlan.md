# FHIR Resource Testing: CarePlan

**FHIR R4 Specification**: https://hl7.org/fhir/R4/careplan.html  
**Test Status**: ❌ Minimal  
**Coverage**: 15% (6/40 test cases passing)

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
| status | token | ❌ | Optional | **Missing** | Draft, active, completed |
| intent | token | ❌ | Optional | **Missing** | Proposal, plan, order |
| category | token | ❌ | Optional | **Missing** | Assessment, plan |
| subject | reference | ✅ | Optional | Complete | Patient reference |
| patient | reference | ✅ | Optional | Complete | Same as subject |
| encounter | reference | ❌ | Optional | **Missing** | Associated encounter |
| date | date | ✅ | Optional | Complete | Plan period |
| period | date | ✅ | Optional | Complete | Same as date |
| author | reference | ❌ | Optional | **Missing** | Who authored |
| contributor | reference | ❌ | Optional | **Missing** | Who contributed |
| care-team | reference | ❌ | Optional | **Missing** | Associated care team |
| addresses | reference | ❌ | Optional | **Missing** | Health issues addressed |
| based-on | reference | ❌ | Optional | **Missing** | Fulfills plan |
| replaces | reference | ❌ | Optional | **Missing** | Completed/terminated plan |
| part-of | reference | ❌ | Optional | **Missing** | Parent plan |
| goal | reference | ❌ | Optional | **Missing** | Desired outcomes |
| activity-code | token | ❌ | Optional | **Missing** | Planned activity |
| activity-date | date | ❌ | Optional | **Missing** | When activity scheduled |
| activity-reference | reference | ❌ | Optional | **Missing** | Activity details |

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | Status search not implemented | Cannot filter active vs completed plans | Add status extraction |
| CRIT-002 | Category search missing | Cannot distinguish care plan types | Add category extraction |
| CRIT-003 | Goal reference not indexed | Cannot find plans by target goals | Add goal extraction |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | Author/contributor search missing | Cannot find plans by creator | Add author/contributor extraction |
| HIGH-002 | Activity search not supported | Cannot find plans by planned activities | Add activity extraction |
| HIGH-003 | Addresses reference missing | Cannot link plans to conditions | Add addresses extraction |

## Test Results Summary
**Total Test Cases**: 40  
**Passing**: 6 (15%)  
**Failing**: 4 (10%)  
**Not Implemented**: 30 (75%)

---

**Next Steps**:
1. Implement status and category search parameters
2. Add goal and activity indexing
3. Add comprehensive care planning workflow support