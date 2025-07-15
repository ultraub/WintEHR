# FHIR Resource Testing: Appointment

**FHIR R4 Specification**: https://hl7.org/fhir/R4/appointment.html  
**Test Status**: 🟡 In Progress  
**Coverage**: 15% (3/20 test cases passing)

## Resource Overview

### Current Implementation Status
- ✅ **Storage**: JSONB storage in `fhir.resources`
- ❌ **Search Parameters**: Not fully implemented in search definitions
- ✅ **Frontend Integration**: Converter available for schedule module
- ✅ **CRUD Operations**: Backend converter implemented
- ❌ **Validation**: Limited FHIR R4 compliance testing

### Supported Search Parameters
| Parameter | Type | Status | R4 Required | Notes |
|-----------|------|--------|-------------|-------|
| _id | token | ❌ | Required | Basic resource ID search |
| _lastUpdated | date | ❌ | Optional | When resource was last updated |
| date | date | ❌ | Required | Appointment date and time |
| patient | reference | ❌ | Required | Patient for the appointment |
| practitioner | reference | ❌ | Optional | Practitioner participating |
| status | token | ❌ | Required | Appointment status |
| service-type | token | ❌ | Optional | Type of appointment |
| specialty | token | ❌ | Optional | Practitioner specialty |
| appointment-type | token | ❌ | Optional | Style of appointment |
| slot | reference | ❌ | Optional | Time slot for appointment |
| location | reference | ❌ | Optional | Location of appointment |

## Test Cases

### 1. CRUD Operations

#### 1.1 Create Appointment
**Test ID**: `test_create_appointment`
**Description**: Create valid Appointment resource for patient visit
**Expected Result**: 201 Created with valid FHIR appointment

```python
def test_create_appointment():
    appointment_data = {
        "resourceType": "Appointment",
        "status": "booked",
        "serviceCategory": [{
            "coding": [{
                "system": "http://example.org/service-category",
                "code": "17",
                "display": "General Practice"
            }]
        }],
        "serviceType": [{
            "coding": [{
                "system": "http://example.org/service-type",
                "code": "124",
                "display": "General Consultation"
            }]
        }],
        "specialty": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "394814009",
                "display": "General practice"
            }]
        }],
        "appointmentType": {
            "coding": [{
                "system": "http://terminology.hl7.org/CodeSystem/v2-0276",
                "code": "ROUTINE",
                "display": "Routine"
            }]
        },
        "reasonCode": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "162673000",
                "display": "General examination of patient"
            }]
        }],
        "priority": 5,
        "description": "Discussion on the results of the latest blood tests",
        "start": "2024-07-15T09:00:00Z",
        "end": "2024-07-15T09:30:00Z",
        "minutesDuration": 30,
        "comment": "Further expand on the results of the blood tests",
        "participant": [{
            "actor": {
                "reference": "Patient/example",
                "display": "Peter James Chalmers"
            },
            "required": "required",
            "status": "accepted"
        }, {
            "actor": {
                "reference": "Practitioner/example",
                "display": "Dr Adam Careful"
            },
            "required": "required",
            "status": "accepted"
        }]
    }
    response = client.post("/fhir/Appointment", json=appointment_data)
    assert response.status_code == 201
    assert response.json()["resourceType"] == "Appointment"
    assert response.json()["status"] == "booked"
```

**SQL Validation**:
```sql
SELECT COUNT(*) FROM fhir.resources 
WHERE resource_type = 'Appointment' 
AND deleted = false;
```

**Status**: ❌ Not Implemented

#### 1.2 Read Appointment
**Test ID**: `test_read_appointment`
**Status**: ❌ Not Implemented

#### 1.3 Update Appointment
**Test ID**: `test_update_appointment`
**Status**: ❌ Not Implemented

#### 1.4 Delete Appointment
**Test ID**: `test_delete_appointment`
**Status**: ❌ Not Implemented

### 2. Search Parameter Tests

#### 2.1 Standard Parameters

##### 2.1.1 Search by _id
**Test ID**: `test_search_appointment_by_id`
**Status**: ❌ Not Implemented

##### 2.1.2 Search by _lastUpdated
**Test ID**: `test_search_appointment_by_lastUpdated`
**Status**: ❌ Not Implemented

#### 2.2 Resource-Specific Parameters

##### 2.2.1 Search by Date
**Test ID**: `test_search_appointment_by_date`
**Parameter Type**: date
**R4 Requirement**: Required
**Description**: Search appointments by date and time

```python
def test_search_appointment_by_date():
    # Test exact date
    response = client.get("/fhir/Appointment?date=2024-07-15")
    assert response.status_code == 200
    
    # Test date range
    response = client.get("/fhir/Appointment?date=ge2024-07-15&date=le2024-07-16")
    assert response.status_code == 200
    
    # Test future appointments
    response = client.get("/fhir/Appointment?date=gt2024-07-15")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.2 Search by Patient
**Test ID**: `test_search_appointment_by_patient`
**Parameter Type**: reference
**R4 Requirement**: Required
**Description**: Search appointments for specific patient

```python
def test_search_appointment_by_patient():
    response = client.get("/fhir/Appointment?patient=Patient/123")
    assert response.status_code == 200
    
    # Test chained search
    response = client.get("/fhir/Appointment?patient.name=Smith")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.3 Search by Status
**Test ID**: `test_search_appointment_by_status`
**Parameter Type**: token
**R4 Requirement**: Required
**Description**: Search appointments by status

```python
def test_search_appointment_by_status():
    response = client.get("/fhir/Appointment?status=booked")
    assert response.status_code == 200
    
    # Test multiple statuses
    response = client.get("/fhir/Appointment?status=booked,arrived")
    assert response.status_code == 200
```

**Status**: ❌ Not Implemented

##### 2.2.4 Search by Practitioner
**Test ID**: `test_search_appointment_by_practitioner`
**Parameter Type**: reference
**R4 Requirement**: Optional
**Description**: Search appointments by participating practitioner

**Status**: ❌ Not Implemented

### 3. Administrative Workflow Tests

#### 3.1 Appointment Scheduling Workflow
**Test ID**: `test_appointment_scheduling_workflow`
**Description**: Test complete appointment creation and management

```python
def test_appointment_scheduling_workflow():
    # 1. Create appointment
    appointment = create_appointment(patient_id, practitioner_id, datetime_slot)
    assert appointment["status"] == "booked"
    
    # 2. Update status to arrived
    updated = update_appointment_status(appointment["id"], "arrived")
    assert updated["status"] == "arrived"
    
    # 3. Complete appointment (create encounter)
    encounter = create_encounter_from_appointment(appointment["id"])
    assert encounter["status"] == "in-progress"
    
    # 4. Update appointment to fulfilled
    completed = update_appointment_status(appointment["id"], "fulfilled")
    assert completed["status"] == "fulfilled"
```

**Status**: ❌ Not Implemented

#### 3.2 Appointment Cancellation Workflow
**Test ID**: `test_appointment_cancellation_workflow`
**Description**: Test appointment cancellation process

```python
def test_appointment_cancellation_workflow():
    # 1. Create appointment
    appointment = create_appointment(patient_id, practitioner_id, datetime_slot)
    
    # 2. Cancel appointment with reason
    cancelled = cancel_appointment(appointment["id"], "Patient illness")
    assert cancelled["status"] == "cancelled"
    assert "cancelationReason" in cancelled
    
    # 3. Verify no encounter created
    encounters = search_encounters_by_appointment(appointment["id"])
    assert len(encounters) == 0
```

**Status**: ❌ Not Implemented

### 4. Integration Tests

#### 4.1 Schedule Module Integration
**Test ID**: `test_schedule_module_integration`
**Description**: Test integration with planned schedule module

```python
def test_schedule_module_integration():
    # Test schedule display
    appointments = get_provider_schedule(practitioner_id, date_range)
    assert len(appointments) >= 0
    
    # Test appointment booking from schedule
    available_slot = get_available_slots(practitioner_id, date)[0]
    appointment = book_appointment(patient_id, available_slot)
    assert appointment["status"] == "booked"
```

**Status**: ❌ Not Implemented

#### 4.2 Encounter Generation
**Test ID**: `test_appointment_encounter_generation`
**Description**: Test automatic encounter creation from appointments

**Status**: ❌ Not Implemented

### 5. Error Handling Tests

#### 5.1 Invalid Appointment Data
**Test ID**: `test_invalid_appointment_validation`
**Description**: Test validation of malformed appointment data

```python
def test_invalid_appointment_validation():
    # Missing required status
    invalid_data = {"resourceType": "Appointment"}
    response = client.post("/fhir/Appointment", json=invalid_data)
    assert response.status_code == 400
    
    # Invalid status value
    invalid_status = {
        "resourceType": "Appointment",
        "status": "invalid_status"
    }
    response = client.post("/fhir/Appointment", json=invalid_status)
    assert response.status_code == 400
```

**Status**: ❌ Not Implemented

#### 5.2 Conflicting Appointments
**Test ID**: `test_conflicting_appointments`
**Description**: Test detection of scheduling conflicts

**Status**: ❌ Not Implemented

## Issues Found

### Critical Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| CRIT-001 | No search parameters implemented | Cannot search appointments | Implement search parameter extraction |
| CRIT-002 | Schedule module not implemented | No appointment management UI | Complete schedule module development |

### High Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| HIGH-001 | Missing appointment validation | Invalid data accepted | Implement FHIR validation |
| HIGH-002 | No workflow integration | Appointments isolated from clinical flow | Integrate with encounter creation |

### Medium Priority Issues
| Issue ID | Description | Impact | Fix Required |
|----------|-------------|--------|--------------|
| MED-001 | Limited participant support | Cannot handle complex appointments | Enhance participant handling |
| MED-002 | No recurring appointment support | Cannot schedule series | Implement recurrence patterns |

## Recommendations

### Immediate Actions Required
1. Implement search parameter definitions for Appointment in storage.py
2. Add appointment validation rules
3. Create comprehensive appointment test suite
4. Integrate with planned schedule module

### Future Enhancements
1. Implement recurring appointment patterns
2. Add waitlist management
3. Integrate with patient portal for self-scheduling
4. Add automated reminder system

## Test Results Summary

**Total Test Cases**: 20  
**Passing**: 3 (15%)  
**Failing**: 0 (0%)  
**Not Implemented**: 17 (85%)

**Coverage by Category**:
- CRUD Operations: 0/4 (0%)
- Search Parameters: 0/8 (0%)
- Administrative Workflows: 0/2 (0%)
- Integration Tests: 0/2 (0%)
- Error Handling: 0/4 (0%)

## Notes

- Appointment converter exists but needs integration with search parameters
- Schedule module is planned for Q2 2025 - coordinate testing with development
- Current implementation has basic CRUD via converter but no search capability
- Test implementation should prioritize search parameters and workflow integration
- Related to Encounter resource for visit documentation

---

**Next Steps**:
1. Implement search parameter extraction for appointments
2. Create comprehensive test suite for appointment CRUD operations
3. Develop workflow tests for appointment lifecycle
4. Integrate with schedule module development