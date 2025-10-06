# Phase 2: FHIR Schema Dependency Migration Plan

**Created**: 2025-10-06
**Status**: Planning
**Goal**: Migrate all API services from custom `fhir.*` PostgreSQL schema to HAPI FHIR REST API

## Executive Summary

**Current State**:
- ✅ HAPI FHIR R4 server operational with 103 synthetic patients
- ✅ 34,685 observations, 3,230 conditions, 3,327 medication requests loaded
- ✅ HAPI FHIR REST API validated and working
- ⚠️ 2 production API files still using deprecated `fhir.*` schema

**Migration Scope**:
- **Actual Dependencies**: 2 files (audit_service.py, search_values.py)
- **Already Migrated**: 2 files (tasks/router.py, notification_service.py)
- **Lines to Migrate**: ~150 lines of SQL to FHIR REST API calls
- **Estimated Effort**: 4-6 hours

## File-by-File Migration Analysis

### 1. backend/api/services/audit_service.py (CRITICAL)

**Current Usage**: `fhir.audit_logs` table
**Lines**: 87-334
**Complexity**: HIGH - Core security infrastructure
**References**: 9 SQL operations

**SQL Operations**:
```sql
-- INSERT operation (lines 86-114)
INSERT INTO fhir.audit_logs (
    id, event_type, event_time, user_id, patient_id,
    resource_type, resource_id, action, outcome,
    details, ip_address, user_agent
) VALUES (...)

-- SELECT operations (lines 260-267, 288-295, 314-321)
SELECT * FROM fhir.audit_logs
WHERE user_id = :user_id
AND (:start_date IS NULL OR event_time >= :start_date)
ORDER BY event_time DESC
```

**Migration Strategy**: HAPI FHIR `AuditEvent` Resource

**FHIR AuditEvent Mapping**:
```javascript
// Current fhir.audit_logs schema
{
  id: uuid,
  event_type: string,       // → AuditEvent.type
  event_time: timestamp,    // → AuditEvent.recorded
  user_id: string,          // → AuditEvent.agent.who
  patient_id: string,       // → AuditEvent.entity[patient]
  resource_type: string,    // → AuditEvent.entity.type
  resource_id: string,      // → AuditEvent.entity.what
  action: string,           // → AuditEvent.action
  outcome: string,          // → AuditEvent.outcome
  details: jsonb,           // → AuditEvent.entity.detail
  ip_address: string,       // → AuditEvent.agent.network.address
  user_agent: string        // → AuditEvent.agent.requestor
}

// FHIR R4 AuditEvent resource
{
  "resourceType": "AuditEvent",
  "type": {
    "system": "http://terminology.hl7.org/CodeSystem/audit-event-type",
    "code": "rest",
    "display": "RESTful Operation"
  },
  "subtype": [{
    "system": "http://hl7.org/fhir/restful-interaction",
    "code": "read",
    "display": "read"
  }],
  "action": "R",  // C, R, U, D, E
  "recorded": "2025-10-06T12:00:00Z",
  "outcome": "0",  // 0=Success, 4=Minor failure, 8=Serious failure, 12=Major failure
  "agent": [{
    "who": {"reference": "Practitioner/123"},
    "requestor": true,
    "network": {
      "address": "192.168.1.1",
      "type": "2"  // IP Address
    }
  }],
  "entity": [{
    "what": {"reference": "Patient/456"},
    "type": {
      "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
      "code": "1",  // Person
      "display": "Person"
    },
    "role": {
      "system": "http://terminology.hl7.org/CodeSystem/object-role",
      "code": "1",  // Patient
      "display": "Patient"
    }
  }]
}
```

**Migration Steps**:
1. Create new `AuditEventService` class using FHIRHTTPClient
2. Implement FHIR AuditEvent creation with proper terminology codes
3. Implement FHIR search for audit queries (by user, patient, date range)
4. Update all audit logging calls to use new service
5. Run parallel logging (both old and new) for validation period
6. Switch over once validated
7. Keep old audit_logs table for historical data (don't drop)

**Testing Requirements**:
- Verify audit events created correctly in HAPI FHIR
- Validate search queries return correct results
- Test user activity logging
- Test patient access logging
- Test failed login attempt tracking
- Performance test: ensure <100ms audit logging (async)

**Risk Level**: HIGH - Security and compliance critical
**Backward Compatibility**: Maintain read access to old audit_logs for compliance

---

### 2. backend/api/fhir/search_values.py (LOW PRIORITY)

**Current Usage**: `fhir.search_params` table
**Lines**: 192-197 (1 function)
**Complexity**: LOW - Single utility endpoint
**References**: 2 SQL lines

**SQL Operations**:
```sql
-- Single SELECT operation (lines 191-197)
SELECT DISTINCT sp.param_name
FROM fhir.search_params sp
JOIN fhir.resources r ON sp.resource_id = r.id
WHERE r.resource_type = :resource_type
ORDER BY sp.param_name
```

**Current Status**: MOSTLY MIGRATED
- Lines 1-180: Already using HAPI FHIR search indexes (hfj_spidx_token, hfj_spidx_string)
- Lines 182-214: One function still references old schema

**Migration Strategy**: Use HAPI FHIR SearchParameter Resources

**FHIR SearchParameter Approach**:
```python
# Option 1: Use HAPI FHIR built-in CapabilityStatement
GET http://hapi-fhir:8080/fhir/metadata
# Returns all searchable parameters per resource type

# Option 2: Query HAPI JPA search parameter configuration
SELECT DISTINCT sp_name
FROM hfj_spidx_token
WHERE res_type = :resource_type
UNION
SELECT DISTINCT sp_name
FROM hfj_spidx_string
WHERE res_type = :resource_type
```

**Migration Steps**:
1. Replace `get_searchable_parameters()` function
2. Use HAPI metadata endpoint or JPA tables directly
3. Cache CapabilityStatement for 1 hour (static data)
4. Test autocomplete functionality in UI

**Testing Requirements**:
- Verify parameter lists match HAPI capabilities
- Test UI autocomplete still works
- Validate caching performance

**Risk Level**: LOW - Non-critical utility endpoint
**Estimated Time**: 30 minutes

---

### 3. backend/api/clinical/tasks/router.py (ALREADY MIGRATED ✅)

**Status**: COMPLETE - No migration needed

**Current Implementation**:
```python
# Line 15: Already using HAPI REST API
from services.fhir_client_config import (
    get_resource,
    search_resources,
    create_resource,
    update_resource,
    delete_resource
)
```

**Validation**: No `fhir.*` schema references found
**Action**: None required - mark as complete

---

### 4. backend/api/services/notification_service.py (ALREADY MIGRATED ✅)

**Status**: COMPLETE - No migration needed

**Current Implementation**:
```python
# Lines 1-237: Fully migrated to HAPI Communication resources
from services.fhir_client_config import get_fhir_server
from fhirclient.models.communication import Communication

# Line 8 docstring mentions migration is already done:
"""
This service creates FHIR Communication resources and posts them to HAPI FHIR
to replace the deprecated notification system that wrote to fhir.resources table.

Created: 2025-10-05
Migration: Part of HAPI FHIR migration from custom FHIR backend
"""
```

**Validation**: No `fhir.*` schema references - only mentions in comments
**Action**: None required - mark as complete

---

## Migration Priority Matrix

| File | Priority | Complexity | Risk | Effort | Dependencies |
|------|----------|------------|------|--------|--------------|
| **audit_service.py** | CRITICAL | HIGH | HIGH | 4-6h | None - self-contained |
| **search_values.py** | LOW | LOW | LOW | 30min | None - utility only |
| **tasks/router.py** | DONE ✅ | - | - | - | - |
| **notification_service.py** | DONE ✅ | - | - | - | - |

## Phase 2 Execution Plan

### Step 1: Audit Service Migration (4-6 hours)

**1.1 Create FHIR AuditEvent Service** (2 hours)
```bash
# Create new service file
touch backend/api/services/audit_event_service.py

# Implement AuditEventService class with:
- create_audit_event() using HAPI REST API
- search_by_user() using FHIR search parameters
- search_by_patient() using FHIR search parameters
- search_failed_logins() using FHIR search parameters
```

**1.2 Update Audit Logging Calls** (1 hour)
```bash
# Files calling AuditService:
- backend/api/auth/router.py (login/logout logging)
- backend/api/fhir/router.py (FHIR resource access logging)
- backend/api/clinical/orders/orders_router.py (order logging)

# Update imports:
from api.services.audit_event_service import AuditEventService
```

**1.3 Parallel Logging Validation** (1 hour)
```python
# Log to both systems temporarily
await old_audit_service.log_event(...)  # fhir.audit_logs
await new_audit_service.create_audit_event(...)  # HAPI AuditEvent

# Compare results for 1 day of production use
# Validate: count matches, searchability works, performance acceptable
```

**1.4 Cutover and Testing** (1 hour)
```bash
# Switch to new service
# Remove old parallel logging
# Run comprehensive audit query tests
# Verify compliance queries still work
```

**1.5 Historical Data Preservation** (30 min)
```sql
-- Keep old audit_logs table for compliance (7-year retention)
-- Add read-only views if needed
-- Document historical data location
```

### Step 2: Search Values Migration (30 minutes)

**2.1 Update search_values.py** (15 min)
```python
# Replace get_searchable_parameters() function
# Use HAPI metadata endpoint
# Add caching for CapabilityStatement
```

**2.2 Test UI Integration** (15 min)
```bash
# Test autocomplete in FHIR Explorer
# Verify parameter lists correct
# Check performance acceptable
```

### Step 3: Validation and Documentation (1 hour)

**3.1 Integration Testing**
- Test all audit logging scenarios
- Verify search parameter autocomplete
- Check backward compatibility
- Performance testing

**3.2 Documentation Updates**
- Update API documentation
- Document HAPI AuditEvent usage
- Update deployment notes
- Create migration retrospective

---

## Technical Implementation Details

### FHIRHTTPClient Usage Pattern

```python
from api.ui_composer/agents/fhir_http_client import FHIRHTTPClient

class AuditEventService:
    """HAPI FHIR AuditEvent-based audit logging"""

    def __init__(self, base_url: str = "http://hapi-fhir:8080/fhir"):
        self.client = FHIRHTTPClient(base_url)

    async def create_audit_event(
        self,
        event_type: str,
        user_id: str,
        action: str,
        outcome: str = "success",
        **kwargs
    ) -> str:
        """Create FHIR AuditEvent resource"""

        audit_event = {
            "resourceType": "AuditEvent",
            "type": self._map_event_type(event_type),
            "action": self._map_action(action),
            "recorded": datetime.utcnow().isoformat() + "Z",
            "outcome": self._map_outcome(outcome),
            "agent": [{
                "who": {"reference": f"Practitioner/{user_id}"},
                "requestor": True,
                "network": {
                    "address": kwargs.get("ip_address"),
                    "type": "2"  # IP Address
                }
            }]
        }

        # Add patient entity if provided
        if kwargs.get("patient_id"):
            audit_event["entity"] = [{
                "what": {"reference": f"Patient/{kwargs['patient_id']}"},
                "type": {
                    "system": "http://terminology.hl7.org/CodeSystem/audit-entity-type",
                    "code": "1",  # Person
                    "display": "Person"
                }
            }]

        # Create in HAPI FHIR
        result = await self.client.create_resource("AuditEvent", audit_event)
        return result.get("id")

    async def search_by_user(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """Search audit events by user"""

        search_params = {
            "agent": f"Practitioner/{user_id}",
            "_count": limit,
            "_sort": "-date"
        }

        if start_date:
            search_params["date"] = f"ge{start_date.isoformat()}"

        return await self.client.search_resources("AuditEvent", search_params)
```

### HAPI FHIR Search Parameters

```python
# Audit event searches
GET /fhir/AuditEvent?agent=Practitioner/123&_sort=-date&_count=100
GET /fhir/AuditEvent?patient=Patient/456&date=ge2025-10-01
GET /fhir/AuditEvent?type=rest&subtype=read&outcome=0
GET /fhir/AuditEvent?entity=MedicationRequest/789

# Search parameter autocomplete
GET /fhir/metadata
# Parse CapabilityStatement.rest.resource[].searchParam[]
```

---

## Testing Strategy

### Unit Tests

```python
# tests/api/services/test_audit_event_service.py

async def test_create_audit_event():
    """Test FHIR AuditEvent creation"""
    service = AuditEventService()

    event_id = await service.create_audit_event(
        event_type="FHIR_RESOURCE_READ",
        user_id="Practitioner/123",
        patient_id="Patient/456",
        action="read",
        outcome="success",
        ip_address="192.168.1.1"
    )

    assert event_id is not None

    # Verify event created in HAPI
    event = await service.client.read_resource("AuditEvent", event_id)
    assert event["agent"][0]["who"]["reference"] == "Practitioner/123"

async def test_search_by_user():
    """Test audit event search by user"""
    service = AuditEventService()

    events = await service.search_by_user(
        user_id="Practitioner/123",
        limit=10
    )

    assert len(events) > 0
    assert all(e["resourceType"] == "AuditEvent" for e in events)
```

### Integration Tests

```python
# tests/integration/test_audit_migration.py

async def test_parallel_logging_comparison():
    """Verify new audit service matches old behavior"""
    old_service = AuditService(db)
    new_service = AuditEventService()

    # Log same event to both
    old_id = await old_service.log_event(
        event_type="FHIR_RESOURCE_READ",
        user_id="test-user",
        patient_id="Patient/123"
    )

    new_id = await new_service.create_audit_event(
        event_type="FHIR_RESOURCE_READ",
        user_id="test-user",
        patient_id="Patient/123"
    )

    # Verify both created successfully
    assert old_id is not None
    assert new_id is not None

    # Compare searchability
    old_results = await old_service.get_user_activity("test-user")
    new_results = await new_service.search_by_user("test-user")

    assert len(old_results) == len(new_results)
```

### Performance Tests

```python
# tests/performance/test_audit_performance.py

async def test_audit_logging_performance():
    """Ensure audit logging <100ms"""
    service = AuditEventService()

    start = time.time()

    # Create 100 audit events
    tasks = [
        service.create_audit_event(
            event_type="FHIR_RESOURCE_READ",
            user_id=f"Practitioner/{i}",
            action="read"
        )
        for i in range(100)
    ]

    await asyncio.gather(*tasks)

    duration = time.time() - start
    avg_time = duration / 100

    assert avg_time < 0.1, f"Average audit time {avg_time:.3f}s exceeds 100ms"
```

---

## Rollback Plan

### If Migration Issues Occur

**Immediate Rollback** (5 minutes):
```bash
# Revert to old audit_service.py
git checkout HEAD~1 backend/api/services/audit_service.py

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend

# Verify old service working
curl http://localhost:8000/health
```

**Partial Rollback** (Keep new, fall back to old):
```python
# Hybrid approach - try new, fall back to old
async def log_audit_event_hybrid(**kwargs):
    try:
        # Try new HAPI AuditEvent service
        return await new_audit_service.create_audit_event(**kwargs)
    except Exception as e:
        logger.warning(f"HAPI audit failed, using legacy: {e}")
        # Fall back to old fhir.audit_logs
        return await old_audit_service.log_event(**kwargs)
```

**Data Recovery**:
```sql
-- If HAPI AuditEvents lost, restore from audit_logs table
-- Keep both tables for 30-day overlap period
-- Validate data integrity before dropping old table
```

---

## Success Criteria

### Phase 2 Complete When:

✅ **Audit Service Migrated**:
- All audit events created as FHIR AuditEvents in HAPI
- Search functionality working for user/patient/date queries
- Performance <100ms for audit logging
- No errors in production for 7 days

✅ **Search Values Migrated**:
- Parameter autocomplete using HAPI metadata
- UI functionality unchanged from user perspective
- Performance acceptable (<300ms)

✅ **Validation Complete**:
- All integration tests passing
- Performance tests meeting targets
- No regressions in API functionality
- Documentation updated

✅ **Historical Data Preserved**:
- Old audit_logs table readable for compliance
- Migration path documented for future reference
- Rollback procedures tested and documented

---

## Risk Mitigation

### High-Risk Items

**Audit Logging Failure**:
- **Risk**: Compliance violation if audit logging breaks
- **Mitigation**: Parallel logging period, comprehensive testing, rollback plan
- **Detection**: Automated monitoring of audit event creation
- **Response**: Immediate rollback if >1% error rate

**Performance Degradation**:
- **Risk**: Slow audit logging impacts user experience
- **Mitigation**: Performance testing, async logging, HAPI optimization
- **Detection**: Response time monitoring
- **Response**: Investigate HAPI performance, consider caching

**Data Loss**:
- **Risk**: Historical audit data becomes inaccessible
- **Mitigation**: Never drop old tables, maintain read access
- **Detection**: Compliance audit queries
- **Response**: Restore from backups if needed

---

## Post-Migration Monitoring

### Metrics to Track (30 days)

**Audit Service**:
- AuditEvent creation success rate (target: >99.9%)
- Average creation time (target: <50ms)
- Search query performance (target: <200ms)
- HAPI FHIR disk usage growth
- Error rates and types

**Search Parameters**:
- Autocomplete response time
- Cache hit rates
- User satisfaction (qualitative)

**System Health**:
- HAPI FHIR resource count growth
- Database query performance
- API response times overall
- No regressions in existing functionality

---

## Conclusion

**Phase 2 Scope**: Migrate 2 production files from `fhir.*` schema to HAPI FHIR

**Estimated Timeline**:
- Audit Service Migration: 4-6 hours
- Search Values Migration: 30 minutes
- Testing & Validation: 1 hour
- **Total**: 6-8 hours

**Risk Assessment**: MEDIUM
- High-risk audit service migration offset by parallel logging validation
- Low-risk search values migration
- Comprehensive testing and rollback plans

**Next Steps**:
1. Review and approve this migration plan
2. Schedule migration work (recommend non-peak hours)
3. Execute audit_service migration with parallel logging
4. Validate for 24-48 hours
5. Complete search_values migration
6. Mark Phase 2 complete, proceed to Phase 3
