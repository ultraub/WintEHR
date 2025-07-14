# Medication Workflow Integration Testing

**Purpose**: Comprehensive testing scenarios for end-to-end medication workflows  
**Scope**: Cross-resource integration testing for complete medication lifecycle  
**Test Status**: ❌ Not Started  
**Coverage**: 0% (0/12 workflow scenarios implemented)

## Overview

This document defines comprehensive integration test scenarios that span multiple medication resources to ensure proper workflow functionality in WintEHR. These tests validate the complete medication lifecycle from prescription to administration.

## Workflow Architecture

### Core Medication Resources
1. **Medication** - Drug definition and properties
2. **MedicationRequest** - Prescription/order
3. **MedicationDispense** - Pharmacy fulfillment  
4. **MedicationAdministration** - Clinical administration

### Resource Relationships
```
Patient → MedicationRequest → MedicationDispense → MedicationAdministration
   ↓            ↓                    ↓                      ↓
Medication ← Medication ←── Medication ←────── Medication
```

## Integration Test Scenarios

### 1. Complete Medication Lifecycle (CRITICAL)

#### 1.1 End-to-End Prescription Workflow
**Test ID**: `test_complete_medication_lifecycle`
**Description**: Test complete workflow from prescription to administration
**Priority**: Critical
**Current Status**: ❌ Not Implemented

```python
def test_complete_medication_lifecycle():
    """
    Complete medication workflow test covering:
    1. Medication master data creation
    2. Prescription (MedicationRequest)
    3. Pharmacy dispensing (MedicationDispense) 
    4. Clinical administration (MedicationAdministration)
    5. Cross-resource searches and relationships
    """
    
    # Step 1: Create medication master data
    medication = create_medication({
        "resourceType": "Medication",
        "code": {
            "coding": [{
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": "314076",
                "display": "Lisinopril 10 MG Oral Tablet"
            }]
        },
        "status": "active",
        "form": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "385055001",
                "display": "Tablet"
            }]
        }
    })
    
    # Step 2: Create prescription
    prescription = create_medication_request({
        "resourceType": "MedicationRequest",
        "status": "active",
        "intent": "order",
        "medicationReference": {
            "reference": f"Medication/{medication['id']}"
        },
        "subject": {
            "reference": "Patient/test-patient-1"
        },
        "requester": {
            "reference": "Practitioner/test-doctor-1"
        },
        "authoredOn": "2024-01-15T10:00:00Z",
        "dispenseRequest": {
            "quantity": {
                "value": 30,
                "unit": "tablets"
            },
            "expectedSupplyDuration": {
                "value": 30,
                "unit": "days"
            }
        }
    })
    
    # Step 3: Create dispense
    dispense = create_medication_dispense({
        "resourceType": "MedicationDispense",
        "status": "completed",
        "medicationReference": {
            "reference": f"Medication/{medication['id']}"
        },
        "subject": {
            "reference": "Patient/test-patient-1"
        },
        "authorizingPrescription": [{
            "reference": f"MedicationRequest/{prescription['id']}"
        }],
        "performer": [{
            "actor": {
                "reference": "Practitioner/test-pharmacist-1"
            }
        }],
        "quantity": {
            "value": 30,
            "unit": "tablets"
        },
        "whenPrepared": "2024-01-15T14:00:00Z",
        "whenHandedOver": "2024-01-15T14:30:00Z"
    })
    
    # Step 4: Create administration records
    administrations = []
    for day in range(1, 4):  # First 3 days
        admin = create_medication_administration({
            "resourceType": "MedicationAdministration",
            "status": "completed",
            "medicationReference": {
                "reference": f"Medication/{medication['id']}"
            },
            "subject": {
                "reference": "Patient/test-patient-1"
            },
            "context": {
                "reference": "Encounter/test-encounter-1"
            },
            "effectiveDateTime": f"2024-01-{15+day}T08:00:00Z",
            "performer": [{
                "actor": {
                    "reference": "Practitioner/test-nurse-1"
                }
            }],
            "request": {
                "reference": f"MedicationRequest/{prescription['id']}"
            }
        })
        administrations.append(admin)
    
    # Validation 1: Verify resource creation
    assert medication["id"] is not None
    assert prescription["id"] is not None
    assert dispense["id"] is not None
    assert len(administrations) == 3
    
    # Validation 2: Verify relationships through search
    # Find dispenses for this prescription
    dispense_search = client.get(
        f"/fhir/MedicationDispense?prescription={prescription['id']}"
    )
    assert dispense_search.status_code == 200
    assert len(dispense_search.json()["entry"]) == 1
    
    # Find administrations for this prescription
    admin_search = client.get(
        f"/fhir/MedicationAdministration?request={prescription['id']}"
    )
    assert admin_search.status_code == 200
    assert len(admin_search.json()["entry"]) == 3
    
    # Validation 3: Verify medication consistency across workflow
    for resource in [prescription, dispense] + administrations:
        med_ref = resource.get("medicationReference", {}).get("reference")
        assert med_ref == f"Medication/{medication['id']}"
    
    # Validation 4: Test reverse chaining
    # Find all prescriptions for this medication
    prescription_search = client.get(
        f"/fhir/MedicationRequest?medication=Medication/{medication['id']}"
    )
    assert prescription_search.status_code == 200
    assert len(prescription_search.json()["entry"]) >= 1
    
    return {
        "medication": medication,
        "prescription": prescription,
        "dispense": dispense,
        "administrations": administrations
    }
```

**Expected Results**:
- All resources created successfully
- Proper cross-resource linking maintained
- Search operations work across the workflow
- Medication consistency verified

**Current Issues**:
- MedicationDispense resource not implemented
- MedicationAdministration resource not implemented
- Missing search parameters for workflow linking
- No medication reference resolution

#### 1.2 Prescription Status Lifecycle
**Test ID**: `test_prescription_status_lifecycle`
**Description**: Test prescription status changes through workflow
**Priority**: High
**Current Status**: ❌ Not Implemented

```python
def test_prescription_status_lifecycle():
    """
    Test prescription status transitions:
    draft → active → completed
    """
    
    # Create prescription in draft status
    prescription = create_medication_request(status="draft")
    assert prescription["status"] == "draft"
    
    # Activate prescription
    updated_prescription = update_medication_request(
        prescription["id"], 
        status="active"
    )
    assert updated_prescription["status"] == "active"
    
    # Create dispense (should trigger prescription completion)
    dispense = create_medication_dispense(
        prescription_reference=f"MedicationRequest/{prescription['id']}",
        status="completed"
    )
    
    # Verify prescription status updated to completed
    final_prescription = get_medication_request(prescription["id"])
    assert final_prescription["status"] == "completed"
```

### 2. Multi-Patient Medication Management

#### 2.1 Patient Medication History
**Test ID**: `test_patient_medication_history`
**Description**: Test comprehensive medication history across all resources
**Priority**: High
**Current Status**: ❌ Not Implemented

```python
def test_patient_medication_history():
    """
    Test patient-centric medication history aggregation
    """
    patient_id = "Patient/test-patient-1"
    
    # Create multiple medications for patient
    medications = []
    for med_code, med_name in [("314076", "Lisinopril"), ("1191", "Aspirin")]:
        workflow = test_complete_medication_lifecycle()
        medications.append(workflow)
    
    # Search all medication requests for patient
    prescriptions = client.get(f"/fhir/MedicationRequest?subject={patient_id}")
    assert prescriptions.status_code == 200
    assert len(prescriptions.json()["entry"]) == 2
    
    # Search all dispenses for patient
    dispenses = client.get(f"/fhir/MedicationDispense?subject={patient_id}")
    assert dispenses.status_code == 200
    assert len(dispenses.json()["entry"]) == 2
    
    # Search all administrations for patient
    administrations = client.get(f"/fhir/MedicationAdministration?subject={patient_id}")
    assert administrations.status_code == 200
    assert len(administrations.json()["entry"]) == 6  # 3 per medication
    
    # Test combined search with includes
    combined_search = client.get(
        f"/fhir/MedicationRequest?subject={patient_id}"
        "&_include=MedicationRequest:medication"
        "&_revinclude=MedicationDispense:prescription"
        "&_revinclude=MedicationAdministration:request"
    )
    assert combined_search.status_code == 200
    # Should return prescriptions, medications, dispenses, and administrations
```

#### 2.2 Drug Interaction Checking
**Test ID**: `test_drug_interaction_workflow`
**Description**: Test drug interaction checking across medication workflow
**Priority**: Critical
**Current Status**: ❌ Not Implemented

```python
def test_drug_interaction_workflow():
    """
    Test drug interaction detection through medication history
    """
    patient_id = "Patient/test-patient-1"
    
    # Step 1: Patient on Warfarin
    warfarin_workflow = create_medication_workflow(
        patient_id=patient_id,
        medication_code="11289",  # Warfarin
        medication_name="Warfarin 5mg"
    )
    
    # Step 2: Attempt to prescribe Aspirin (interacts with Warfarin)
    # First check current medications
    current_meds = client.get(
        f"/fhir/MedicationAdministration?subject={patient_id}&status=completed"
    )
    assert current_meds.status_code == 200
    
    # Extract medication codes for interaction checking
    current_codes = []
    for entry in current_meds.json()["entry"]:
        med_ref = entry["resource"]["medicationReference"]["reference"]
        medication = client.get(f"/fhir/{med_ref}").json()
        codes = [coding["code"] for coding in medication["code"]["coding"]]
        current_codes.extend(codes)
    
    # Verify Warfarin is in current medications
    assert "11289" in current_codes
    
    # Step 3: Create Aspirin prescription with interaction warning
    aspirin_prescription = create_medication_request(
        patient_id=patient_id,
        medication_code="1191",  # Aspirin
        medication_name="Aspirin 81mg",
        status="draft",  # Keep as draft due to interaction
        note=[{
            "text": "DRUG INTERACTION WARNING: Aspirin may increase bleeding risk with Warfarin"
        }]
    )
    
    # Verify interaction was flagged
    assert aspirin_prescription["status"] == "draft"
    assert len(aspirin_prescription["note"]) > 0
    assert "DRUG INTERACTION" in aspirin_prescription["note"][0]["text"]
```

### 3. Pharmacy Workflow Integration

#### 3.1 Pharmacy Queue Management
**Test ID**: `test_pharmacy_queue_workflow`
**Description**: Test pharmacy workflow from prescription receipt to dispense
**Priority**: High
**Current Status**: ❌ Not Implemented

```python
def test_pharmacy_queue_workflow():
    """
    Test pharmacy queue management workflow
    """
    
    # Create multiple prescriptions
    prescriptions = []
    for i in range(3):
        rx = create_medication_request(
            patient_id=f"Patient/test-patient-{i+1}",
            status="active"
        )
        prescriptions.append(rx)
    
    # Pharmacy receives prescriptions (search by status)
    pending_rx = client.get("/fhir/MedicationRequest?status=active")
    assert pending_rx.status_code == 200
    assert len(pending_rx.json()["entry"]) == 3
    
    # Process first prescription
    rx_id = prescriptions[0]["id"]
    
    # Step 1: Create dispense in preparation status
    dispense = create_medication_dispense(
        prescription_reference=f"MedicationRequest/{rx_id}",
        status="preparation",
        performer_id="Practitioner/test-pharmacist-1"
    )
    assert dispense["status"] == "preparation"
    
    # Step 2: Update to in-progress
    updated_dispense = update_medication_dispense(
        dispense["id"],
        status="in-progress",
        when_prepared="2024-01-15T14:00:00Z"
    )
    assert updated_dispense["status"] == "in-progress"
    
    # Step 3: Complete dispense
    final_dispense = update_medication_dispense(
        dispense["id"],
        status="completed",
        when_handed_over="2024-01-15T14:30:00Z"
    )
    assert final_dispense["status"] == "completed"
    assert "whenHandedOver" in final_dispense
    
    # Step 4: Update prescription status
    completed_rx = update_medication_request(rx_id, status="completed")
    assert completed_rx["status"] == "completed"
    
    # Verify queue status
    remaining_queue = client.get("/fhir/MedicationRequest?status=active")
    assert len(remaining_queue.json()["entry"]) == 2
```

#### 3.2 Partial Dispense Management
**Test ID**: `test_partial_dispense_workflow`
**Description**: Test partial dispense and refill workflows
**Priority**: Medium
**Current Status**: ❌ Not Implemented

```python
def test_partial_dispense_workflow():
    """
    Test partial dispense and refill management
    """
    
    # Create prescription for 90-day supply
    prescription = create_medication_request(
        dispense_quantity=90,
        dispense_days_supply=90,
        number_of_repeats_allowed=2
    )
    
    # First dispense: 30-day supply
    dispense1 = create_medication_dispense(
        prescription_reference=f"MedicationRequest/{prescription['id']}",
        quantity=30,
        days_supply=30,
        status="completed"
    )
    
    # Second dispense: another 30-day supply
    dispense2 = create_medication_dispense(
        prescription_reference=f"MedicationRequest/{prescription['id']}",
        quantity=30,
        days_supply=30,
        status="completed"
    )
    
    # Third dispense: final 30-day supply
    dispense3 = create_medication_dispense(
        prescription_reference=f"MedicationRequest/{prescription['id']}",
        quantity=30,
        days_supply=30,
        status="completed"
    )
    
    # Verify all dispenses linked to same prescription
    all_dispenses = client.get(
        f"/fhir/MedicationDispense?prescription={prescription['id']}"
    )
    assert len(all_dispenses.json()["entry"]) == 3
    
    # Verify total quantity dispensed
    total_quantity = sum(
        entry["resource"]["quantity"]["value"]
        for entry in all_dispenses.json()["entry"]
    )
    assert total_quantity == 90
    
    # Update prescription to completed (no more refills)
    final_prescription = update_medication_request(
        prescription["id"],
        status="completed"
    )
    assert final_prescription["status"] == "completed"
```

### 4. Clinical Administration Workflows

#### 4.1 Medication Administration Record (MAR)
**Test ID**: `test_mar_workflow`
**Description**: Test systematic medication administration recording
**Priority**: Critical
**Current Status**: ❌ Not Implemented

```python
def test_mar_workflow():
    """
    Test Medication Administration Record (MAR) workflow
    """
    patient_id = "Patient/test-patient-1"
    encounter_id = "Encounter/test-encounter-1"
    prescription_id = "MedicationRequest/test-prescription-1"
    
    # Create scheduled administrations (BID dosing for 3 days)
    scheduled_times = [
        "2024-01-15T08:00:00Z", "2024-01-15T20:00:00Z",  # Day 1
        "2024-01-16T08:00:00Z", "2024-01-16T20:00:00Z",  # Day 2
        "2024-01-17T08:00:00Z", "2024-01-17T20:00:00Z",  # Day 3
    ]
    
    administrations = []
    for i, scheduled_time in enumerate(scheduled_times):
        # Most administrations completed
        status = "completed" if i < 4 else "not-done"
        status_reason = None
        
        if status == "not-done":
            status_reason = {
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "code": "182862001",
                    "display": "Drug not taken - patient refused"
                }]
            }
        
        admin = create_medication_administration(
            patient_id=patient_id,
            encounter_id=encounter_id,
            prescription_id=prescription_id,
            effective_time=scheduled_time,
            status=status,
            status_reason=status_reason,
            performer_id="Practitioner/test-nurse-1"
        )
        administrations.append(admin)
    
    # Verify MAR completeness
    all_administrations = client.get(
        f"/fhir/MedicationAdministration?subject={patient_id}"
        f"&context={encounter_id}"
        "&_sort=effective-time"
    )
    assert len(all_administrations.json()["entry"]) == 6
    
    # Check completed vs missed doses
    completed_count = len([a for a in administrations if a["status"] == "completed"])
    missed_count = len([a for a in administrations if a["status"] == "not-done"])
    assert completed_count == 4
    assert missed_count == 2
    
    # Calculate medication adherence
    adherence_rate = completed_count / len(administrations)
    assert adherence_rate == 0.67  # 4/6 = 67% adherence
```

#### 4.2 Medication Error Workflow
**Test ID**: `test_medication_error_workflow`
**Description**: Test medication error recording and correction
**Priority**: High
**Current Status**: ❌ Not Implemented

```python
def test_medication_error_workflow():
    """
    Test medication error recording and correction workflow
    """
    
    # Step 1: Record incorrect administration
    incorrect_admin = create_medication_administration(
        medication_code="314076",  # Lisinopril 10mg
        dose_value=20,  # Incorrect dose - should be 10mg
        status="completed",
        effective_time="2024-01-15T08:00:00Z"
    )
    
    # Step 2: Discover error and mark as entered-in-error
    corrected_admin = update_medication_administration(
        incorrect_admin["id"],
        status="entered-in-error",
        note=[{
            "text": "ERROR: Wrong dose administered. Corrected in separate record."
        }]
    )
    assert corrected_admin["status"] == "entered-in-error"
    
    # Step 3: Create corrective administration record
    corrective_admin = create_medication_administration(
        medication_code="314076",
        dose_value=10,  # Correct dose
        status="completed",
        effective_time="2024-01-15T08:30:00Z",
        note=[{
            "text": "Corrective dose administered due to previous error."
        }]
    )
    
    # Step 4: Search for all administrations (including errors)
    all_administrations = client.get(
        "/fhir/MedicationAdministration?subject=Patient/test-patient-1"
    )
    entries = all_administrations.json()["entry"]
    assert len(entries) == 2
    
    # Step 5: Search for valid administrations only
    valid_administrations = client.get(
        "/fhir/MedicationAdministration?subject=Patient/test-patient-1"
        "&status:not=entered-in-error"
    )
    valid_entries = valid_administrations.json()["entry"]
    assert len(valid_entries) == 1
    assert valid_entries[0]["resource"]["dosage"]["dose"]["value"] == 10
```

### 5. Advanced Clinical Scenarios

#### 5.1 Complex Medication Regimen
**Test ID**: `test_complex_medication_regimen`
**Description**: Test patient with multiple medications and complex dosing
**Priority**: Medium
**Current Status**: ❌ Not Implemented

#### 5.2 Medication Reconciliation
**Test ID**: `test_medication_reconciliation`
**Description**: Test medication reconciliation during care transitions
**Priority**: Medium
**Current Status**: ❌ Not Implemented

#### 5.3 Controlled Substance Tracking
**Test ID**: `test_controlled_substance_workflow`
**Description**: Test controlled substance prescription and tracking
**Priority**: Medium
**Current Status**: ❌ Not Implemented

## Critical Implementation Gaps

### Missing Resources
1. **MedicationDispense** - Completely missing from WintEHR
2. **MedicationAdministration** - Completely missing from WintEHR

### Missing Search Parameters
1. **MedicationRequest**: medication, requester, performer parameters
2. **All medication resources**: Cross-resource search capabilities

### Missing Workflow Features
1. **Status transitions** - No automated status updates
2. **Workflow linking** - No proper resource relationships
3. **Clinical decision support** - No drug interaction checking
4. **Medication reconciliation** - No care transition support

## Priority Implementation Roadmap

### Phase 1: Critical Foundation (Weeks 1-2)
1. Implement MedicationDispense resource with basic CRUD
2. Implement MedicationAdministration resource with basic CRUD
3. Add missing search parameters for workflow linking
4. Create basic workflow integration tests

### Phase 2: Core Workflows (Weeks 3-4)
1. Implement prescription-to-dispense workflow
2. Implement dispense-to-administration workflow
3. Add status transition management
4. Create pharmacy queue management

### Phase 3: Advanced Features (Weeks 5-8)
1. Add drug interaction checking
2. Implement medication reconciliation
3. Add clinical decision support integration
4. Create comprehensive MAR functionality

### Phase 4: Quality and Performance (Weeks 9-12)
1. Add comprehensive validation
2. Implement performance optimizations
3. Add advanced search capabilities
4. Create integration with external systems

## Test Environment Requirements

### Test Data
- Multiple patients with varying medication needs
- Various medication types (oral, injectable, controlled substances)
- Different practitioners (doctors, nurses, pharmacists)
- Multiple encounters and care settings

### Infrastructure
- Complete FHIR R4 resource implementation
- Search parameter indexing
- Cross-resource relationship mapping
- Workflow state management

## Success Metrics

### Coverage Targets
- **Resource Implementation**: 100% (4/4 medication resources)
- **Search Parameters**: 90% (critical parameters implemented)
- **Workflow Integration**: 80% (core workflows functional)
- **Clinical Safety**: 95% (drug interaction checking, error handling)

### Performance Targets
- **Workflow completion**: <2 seconds end-to-end
- **Search operations**: <500ms for complex queries
- **Resource creation**: <100ms per resource

## Notes

- All workflow tests currently not implemented due to missing resources
- Priority focus should be on MedicationDispense and MedicationAdministration implementation
- Drug safety features are critical for clinical deployment
- Workflow integration is essential for user adoption

---

**Next Steps**:
1. **URGENT**: Implement MedicationDispense and MedicationAdministration resources
2. Add missing search parameters for workflow linking
3. Create basic workflow integration test framework
4. Implement status transition management
5. Add drug interaction checking capabilities