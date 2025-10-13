# Phase 7: Fresh Deployment Test Checklist

**Date**: 2025-10-12
**Status**: 📋 READY FOR EXECUTION
**Version**: WintEHR v4.2

---

## 🎯 Phase 7 Objective

Validate that WintEHR v4.2 pure FHIR architecture deploys correctly from scratch and all clinical workflows function without obsolete custom tables.

---

## 📋 Pre-Test Preparation

### Environment Setup
```bash
# 1. Clean environment (removes all data)
./deploy.sh clean

# 2. Verify no containers running
docker ps -a | grep emr

# 3. Verify no volumes remain
docker volume ls | grep emr

# 4. Verify database is clean
docker volume rm emr_postgres_data 2>/dev/null || true
docker volume rm emr_redis_data 2>/dev/null || true
```

### Test Environment Configuration
```yaml
# config.yaml for testing
deployment:
  environment: dev
  patient_count: 20         # Sufficient for testing
  enable_ssl: false

services:
  ports:
    frontend: 3000
    backend: 8000
    hapi_fhir: 8888
    postgres: 5432
    redis: 6379

hapi_fhir:
  memory: 2g
  validation_mode: NEVER    # For performance

synthea:
  state: Massachusetts
```

---

## ✅ Test Checklist

### 1. Fresh Deployment Test

#### 1.1 Deployment Execution
```bash
# Execute deployment
./deploy.sh --environment dev --patients 20

# Expected: All services start successfully
# ✅ Frontend (React)
# ✅ Backend (FastAPI)
# ✅ HAPI FHIR (JPA Server)
# ✅ PostgreSQL
# ✅ Redis
```

**Success Criteria**:
- [ ] All Docker containers running
- [ ] No error messages in deployment logs
- [ ] Frontend accessible at http://localhost:3000
- [ ] Backend API accessible at http://localhost:8000
- [ ] HAPI FHIR accessible at http://localhost:8888/fhir

#### 1.2 Service Health Checks
```bash
# Check all services
./deploy.sh status

# Individual health checks
curl http://localhost:8000/api/health
curl http://localhost:8888/fhir/metadata
curl http://localhost:3000/ -I
```

**Success Criteria**:
- [ ] Backend health endpoint returns 200 OK
- [ ] HAPI FHIR metadata endpoint returns capability statement
- [ ] Frontend loads without errors
- [ ] Redis connection successful
- [ ] PostgreSQL connection successful

---

### 2. Database Schema Verification

#### 2.1 Verify HAPI FHIR Tables Created
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename LIKE 'hfj_%'
ORDER BY tablename
LIMIT 20;"
```

**Expected HAPI Tables**:
- [ ] `hfj_resource` - Main FHIR resource storage
- [ ] `hfj_res_ver` - Version history
- [ ] `hfj_spidx_string` - String search parameters
- [ ] `hfj_spidx_token` - Token search parameters
- [ ] `hfj_spidx_date` - Date search parameters
- [ ] `hfj_spidx_number` - Number search parameters
- [ ] `hfj_spidx_quantity` - Quantity search parameters
- [ ] `hfj_res_link` - Resource references
- [ ] `hfj_res_tag` - Resource tags

#### 2.2 Verify Legitimate Backend Tables Created
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname IN ('auth', 'cds_hooks', 'audit', 'public')
AND tablename NOT LIKE 'hfj_%'
ORDER BY schemaname, tablename;"
```

**Expected Backend Tables**:
- [ ] `auth.users` - User authentication
- [ ] `auth.roles` - User roles
- [ ] `auth.user_roles` - Role assignments
- [ ] `auth.user_sessions` - Session management (if using table-based sessions)
- [ ] `cds_hooks.hook_configurations` - CDS Hooks config
- [ ] `cds_hooks.execution_log` - CDS Hooks execution history
- [ ] `audit.events` - Audit logging
- [ ] `dicom_files` - DICOM file metadata (public schema)

#### 2.3 Verify Obsolete Tables NOT Created
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT tablename
FROM pg_tables
WHERE tablename IN (
    'clinical_notes',
    'note_templates',
    'clinical_orders',
    'order_items',
    'clinical_tasks',
    'medication_catalog',
    'condition_catalog',
    'lab_catalog',
    'appointments'
);"
```

**Success Criteria**:
- [ ] Result should be EMPTY (no obsolete tables)
- [ ] If tables exist, Phase 5 cleanup failed

#### 2.4 Verify Synthea Staging Tables Status
```bash
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT tablename
FROM pg_tables
WHERE tablename IN (
    'patients',
    'encounters',
    'conditions',
    'procedures',
    'observations',
    'medications',
    'immunizations',
    'organizations',
    'providers'
);"
```

**Investigation**:
- [ ] Record which staging tables exist
- [ ] Check if tables have data: `SELECT COUNT(*) FROM patients;`
- [ ] Determine if tables are used or can be deleted
- [ ] Update synthea_models.py deprecation notice accordingly

---

### 3. Synthea Import Verification

#### 3.1 Verify Synthea Import Executed
```bash
# Check backend logs for import completion
docker logs emr-backend | grep -i "synthea\|import\|patient"

# Expected: "Successfully imported X patients to HAPI FHIR"
```

**Success Criteria**:
- [ ] Import logs show success messages
- [ ] No error messages during import
- [ ] Patient count matches configuration (20 patients)

#### 3.2 Verify Data in HAPI FHIR
```bash
# Check resource counts via HAPI FHIR API
curl "http://localhost:8888/fhir/Patient?_summary=count"
curl "http://localhost:8888/fhir/Encounter?_summary=count"
curl "http://localhost:8888/fhir/Condition?_summary=count"
curl "http://localhost:8888/fhir/MedicationRequest?_summary=count"
curl "http://localhost:8888/fhir/Observation?_summary=count"
```

**Expected Counts** (for 20 patients):
- [ ] Patients: ~20
- [ ] Encounters: ~200-400 (avg 10-20 per patient)
- [ ] Conditions: ~100-200
- [ ] MedicationRequests: ~100-200
- [ ] Observations: ~500-1000 (vitals, labs)

#### 3.3 Verify Search Indexing
```bash
# Test FHIR search parameters
curl "http://localhost:8888/fhir/Patient?name=Smith"
curl "http://localhost:8888/fhir/Condition?patient=Patient/1&category=problem-list-item"
curl "http://localhost:8888/fhir/Observation?patient=Patient/1&code=8867-4"  # Heart rate

# Expected: Bundle with matching resources
```

**Success Criteria**:
- [ ] Name searches return results
- [ ] Patient-scoped searches work
- [ ] Code-based searches work
- [ ] All searches return Bundle format with entry array

#### 3.4 Verify Patient Compartments
```bash
# Test Patient/$everything operation
curl "http://localhost:8888/fhir/Patient/1/\$everything"

# Expected: Bundle with all patient resources
```

**Success Criteria**:
- [ ] Returns comprehensive patient bundle
- [ ] Includes conditions, medications, encounters, observations
- [ ] Bundle total count > 10 (comprehensive data)

---

### 4. Clinical Workflow Testing

#### 4.1 Orders Router (Phase 3.1-3.4 Complete)
```bash
# Test medication order creation
curl -X POST http://localhost:8000/api/clinical/orders/medications \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "1",
    "medication_details": {
      "medication_name": "Metformin 500mg",
      "dose": 500,
      "dose_unit": "mg",
      "route": "oral",
      "frequency": "BID"
    }
  }'

# Test order search
curl "http://localhost:8000/api/clinical/orders?patient_id=1&order_type=medication"

# Test laboratory order
curl -X POST http://localhost:8000/api/clinical/orders/laboratory \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "1",
    "test_code": "2093-3",
    "test_name": "Total Cholesterol",
    "priority": "routine"
  }'
```

**Success Criteria**:
- [ ] Medication orders create MedicationRequest resources
- [ ] Lab orders create ServiceRequest resources with category=laboratory
- [ ] Orders searchable via backend API
- [ ] Orders visible in HAPI FHIR: `curl http://localhost:8888/fhir/MedicationRequest?_count=5`

#### 4.2 Pharmacy Router (Phase 3.5 Complete)
```bash
# Test pharmacy queue
curl "http://localhost:8000/api/clinical/pharmacy/queue"

# Test medication dispense
curl -X POST http://localhost:8000/api/clinical/pharmacy/{medication_request_id}/dispense \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 30,
    "lot_number": "LOT123",
    "expiration_date": "2026-12-31"
  }'

# Verify MedicationDispense created
curl "http://localhost:8888/fhir/MedicationDispense?_count=5"
```

**Success Criteria**:
- [ ] Pharmacy queue returns medication requests
- [ ] Dispense creates MedicationDispense resource
- [ ] Status updates reflected in HAPI FHIR
- [ ] No errors related to obsolete tables

#### 4.3 Notes Router (Phase 3.6 Complete)
```bash
# Test note creation
curl -X POST http://localhost:8000/api/clinical/documentation/ \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "1",
    "note_type": "progress",
    "title": "Progress Note",
    "content": {
      "subjective": "Patient reports feeling better",
      "objective": "Vital signs stable",
      "assessment": "Improving",
      "plan": "Continue current treatment"
    }
  }'

# Test note search
curl "http://localhost:8000/api/clinical/documentation/patient/1"

# Verify DocumentReference in HAPI
curl "http://localhost:8888/fhir/DocumentReference?patient=Patient/1"
```

**Success Criteria**:
- [ ] Notes create DocumentReference resources
- [ ] Notes searchable by patient
- [ ] SOAP format preserved in DocumentReference
- [ ] No errors related to obsolete clinical_notes table

#### 4.4 Tasks Router (Phase 4 - If Implemented)
```bash
# Test task creation
curl -X POST http://localhost:8000/api/clinical/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "1",
    "title": "Follow up appointment",
    "priority": "high",
    "status": "pending",
    "task_type": "follow-up"
  }'

# Test task search
curl "http://localhost:8000/api/clinical/tasks/?patient_id=1&status=pending"

# Verify Task in HAPI
curl "http://localhost:8888/fhir/Task?patient=Patient/1"
```

**Success Criteria**:
- [ ] Tasks create FHIR Task resources
- [ ] Tasks searchable by patient and status
- [ ] No errors related to obsolete clinical_tasks table

---

### 5. FHIR Context Verification (Phase 3.7.1)

```bash
# Test FHIR context endpoint
curl "http://localhost:8000/api/fhir-context?patient_id=1&organization_id=1"

# Expected: Returns context with Patient and Organization from HAPI FHIR
```

**Success Criteria**:
- [ ] Context returns patient data from HAPI FHIR
- [ ] Context returns organization data from HAPI FHIR
- [ ] No errors querying synthea_models tables
- [ ] Response includes proper FHIR references

---

### 6. Imaging Workflow Verification (Phase 3.7.2)

```bash
# Verify ImagingStudy resources exist
curl "http://localhost:8888/fhir/ImagingStudy?_count=5"

# Test imaging upload endpoint
curl -X POST http://localhost:8000/api/imaging/upload \
  -F "patient_id=1" \
  -F "study_id=Study-123" \
  -F "file=@test_dicom.dcm"
```

**Success Criteria**:
- [ ] ImagingStudy resources queryable from HAPI FHIR
- [ ] Patient validation queries HAPI FHIR (not synthea_models)
- [ ] DICOM file metadata stored in dicom_files table
- [ ] No errors related to obsolete synthea_models Patient queries

---

### 7. CDS Hooks Integration

```bash
# Test CDS service discovery
curl http://localhost:8000/cds-services

# Test medication-prescribe hook
curl -X POST http://localhost:8000/cds-services/medication-interaction-check \
  -H "Content-Type: application/json" \
  -d '{
    "hookInstance": "test-123",
    "hook": "medication-prescribe",
    "context": {
      "patientId": "Patient/1",
      "medications": [{
        "name": "Warfarin",
        "dose": "5mg"
      }]
    }
  }'
```

**Success Criteria**:
- [ ] CDS services discoverable
- [ ] CDS hooks execute without errors
- [ ] Cards returned for relevant clinical scenarios
- [ ] CDS queries HAPI FHIR for patient context

---

### 8. Performance Verification

#### 8.1 HAPI FHIR Performance
```bash
# Test search performance
time curl "http://localhost:8888/fhir/Patient?name=Smith"
time curl "http://localhost:8888/fhir/Observation?patient=Patient/1&category=vital-signs"

# Expected: <500ms for most searches
```

**Success Criteria**:
- [ ] Patient searches < 500ms
- [ ] Observation searches < 1000ms
- [ ] Complex searches < 2000ms

#### 8.2 Backend API Performance
```bash
# Test backend endpoint performance
time curl "http://localhost:8000/api/clinical/orders?patient_id=1"
time curl "http://localhost:8000/api/clinical/pharmacy/queue"
time curl "http://localhost:8000/api/catalogs/medications?limit=50"

# Expected: <1000ms for most endpoints
```

**Success Criteria**:
- [ ] Order queries < 1000ms
- [ ] Pharmacy queue < 500ms
- [ ] Catalog endpoints < 500ms (with caching)

---

### 9. Error Handling Verification

#### 9.1 Invalid Patient References
```bash
# Test with non-existent patient
curl "http://localhost:8000/api/clinical/orders?patient_id=99999"

# Expected: Empty result or appropriate 404, not database error
```

**Success Criteria**:
- [ ] Graceful handling of invalid patient IDs
- [ ] No SQLAlchemy errors from obsolete models
- [ ] Appropriate HTTP status codes (404, 400)

#### 9.2 HAPI FHIR Unavailability
```bash
# Temporarily stop HAPI FHIR
docker stop hapi-fhir

# Test backend endpoints
curl "http://localhost:8000/api/clinical/orders?patient_id=1"

# Expected: Appropriate error message, not crash

# Restart HAPI FHIR
docker start hapi-fhir
```

**Success Criteria**:
- [ ] Backend returns appropriate error messages
- [ ] No application crashes
- [ ] Services recover when HAPI FHIR restarts

---

### 10. Frontend Integration Testing

#### 10.1 Patient Chart View
- [ ] Navigate to http://localhost:3000
- [ ] Select a patient from list
- [ ] Verify patient chart loads
- [ ] Check Chart Review tab displays conditions, medications, vitals
- [ ] Verify data loads from HAPI FHIR (check network tab)

#### 10.2 Orders Workflow
- [ ] Navigate to Orders tab
- [ ] Create a new medication order
- [ ] Verify order appears in order list
- [ ] Check order exists in HAPI FHIR

#### 10.3 Pharmacy Queue
- [ ] Navigate to Pharmacy Dashboard (if accessible)
- [ ] Verify medication requests appear in queue
- [ ] Test dispensing workflow
- [ ] Verify MedicationDispense created

#### 10.4 Clinical Notes
- [ ] Navigate to Documentation tab
- [ ] Create a progress note with SOAP format
- [ ] Verify note saves successfully
- [ ] Check DocumentReference in HAPI FHIR

---

## 📊 Test Results Summary Template

```markdown
# Phase 7 Test Results - WintEHR v4.2

**Test Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**: Dev/Staging/Production

## Deployment
- [ ] ✅ Fresh deployment successful
- [ ] ✅ All services running
- [ ] ✅ Database schema correct
- [ ] ⚠️ Issues: [List any issues]

## Database Verification
- [ ] ✅ HAPI FHIR tables created
- [ ] ✅ Backend tables created
- [ ] ✅ NO obsolete tables (notes, orders, tasks)
- [ ] ❓ Staging tables: [Present/Absent, Used/Unused]

## Synthea Import
- [ ] ✅ Import completed successfully
- [ ] ✅ Patient count: [Actual vs Expected]
- [ ] ✅ FHIR search working
- [ ] ✅ Compartments functional

## Clinical Workflows
- [ ] ✅ Orders: Medications, Labs, Imaging
- [ ] ✅ Pharmacy: Queue, Dispense
- [ ] ✅ Notes: Create, Search, Read
- [ ] ⏳ Tasks: [If Phase 4 complete]

## FHIR Integration
- [ ] ✅ FHIR Context queries HAPI
- [ ] ✅ Imaging validates via HAPI
- [ ] ✅ No synthea_models queries

## Performance
- [ ] ✅ HAPI searches: [Avg time]
- [ ] ✅ Backend APIs: [Avg time]
- [ ] ✅ Frontend loads: [Avg time]

## Issues Found
1. [Issue description] - Severity: [Critical/High/Medium/Low]
2. ...

## Overall Status
- [ ] ✅ PASS - Ready for next phase
- [ ] ⚠️ PASS WITH ISSUES - Document issues
- [ ] ❌ FAIL - Requires fixes

## Recommendations
1. [Recommendation 1]
2. ...
```

---

## 🚨 Critical Issues to Watch For

### Red Flags
1. **Obsolete tables exist** - Phase 5 cleanup incomplete
2. **Import queries synthea_models tables** - Phase 3.8 verification wrong
3. **Endpoints query obsolete tables** - Migration incomplete
4. **HAPI FHIR search fails** - Indexing problem
5. **Frontend errors loading data** - Integration broken

### Common Issues & Solutions

**Issue**: "Table 'clinical_notes' does not exist"
- **Cause**: Code still referencing obsolete table
- **Solution**: Find remaining references, complete migration

**Issue**: HAPI FHIR searches return empty results
- **Cause**: Data not imported to HAPI or search params not indexed
- **Solution**: Verify import logs, check HAPI FHIR directly

**Issue**: Slow FHIR searches (>5 seconds)
- **Cause**: Missing indexes or large dataset
- **Solution**: Verify hfj_spidx_* tables have data, check HAPI config

**Issue**: Frontend can't load patient data
- **Cause**: Backend not proxying HAPI correctly
- **Solution**: Check HAPIFHIRClient configuration, verify HAPI_FHIR_URL

---

## 📝 Post-Test Actions

### If Tests Pass
1. Update todo list: Mark Phase 7 as complete
2. Create final summary document
3. Update version to v4.3 (if warranted)
4. Document lessons learned
5. Plan production deployment (if applicable)

### If Tests Fail
1. Document all failures in detail
2. Create GitHub issues for each problem
3. Prioritize fixes by severity
4. Re-run affected phases (3.x, 4, 5)
5. Repeat Phase 7 after fixes

---

## 🎯 Success Definition

**Phase 7 is COMPLETE when**:
- ✅ Fresh deployment succeeds without errors
- ✅ All clinical workflows functional
- ✅ NO obsolete tables present
- ✅ All data flows through HAPI FHIR
- ✅ Performance meets targets
- ✅ Frontend integration works
- ✅ No remaining synthea_models queries (except deferred CQL)

**Status**: 📋 READY FOR EXECUTION - Comprehensive test plan defined, all prerequisites from Phases 1-6 complete.
