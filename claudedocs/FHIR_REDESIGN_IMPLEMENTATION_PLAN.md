# FHIR Redesign Implementation Plan

**Date**: 2025-10-12
**Purpose**: Actionable plan to achieve 100% FHIR-native architecture
**Approach**: Redesign for NEW deployments (no data migration)

---

## 🎯 Goal

**Eliminate all custom workflow tables** - Use HAPI FHIR as the sole storage for clinical workflows.

---

## ✅ Current State (What's Already FHIR-Native)

### 1. Clinical Notes ✅ COMPLETE
- **Status**: API already uses FHIR DocumentReference
- **File**: `backend/api/clinical/documentation/notes_router.py`
- **Action**: ✅ None needed (already correct)
- **Cleanup**: Remove `backend/models/clinical/notes.py` (Phase 5)

### 2. Clinical Catalogs ✅ COMPLETE
- **Status**: Service already extracts from FHIR resources
- **File**: `backend/api/catalogs/service.py` (DynamicCatalogService)
- **Action**: ✅ None needed (already correct)
- **Cleanup**: Remove `backend/models/clinical/catalogs.py` (Phase 5)

---

## 🔴 Phase 3: Orders Redesign (CRITICAL - START HERE)

### Problem
`backend/api/clinical/orders/orders_router.py` creates data in BOTH:
- ❌ Custom SQLAlchemy tables (orders, medication_orders, laboratory_orders, imaging_orders)
- ✅ FHIR resources exist from Synthea (MedicationRequest, ServiceRequest)

**Result**: Data duplication and architectural inconsistency

### Solution: Pure FHIR Implementation

#### 3.1 Medication Orders
**Current**: Creates Order + MedicationOrder in custom tables
**Target**: Create MedicationRequest in HAPI FHIR only

**File**: `backend/api/clinical/orders/orders_router.py`

**Changes Required**:
```python
# REMOVE these imports:
from models.clinical.orders import Order, MedicationOrder, LaboratoryOrder, ImagingOrder, OrderSet

# ADD these imports:
from services.hapi_fhir_client import HAPIFHIRClient

# REWRITE endpoint:
@router.post("/medications")
async def create_medication_order(order: MedicationOrderCreate, ...):
    hapi_client = HAPIFHIRClient()

    # Build FHIR MedicationRequest
    medication_request = {
        "resourceType": "MedicationRequest",
        "status": "active",
        "intent": "order",
        "subject": {"reference": f"Patient/{order.patient_id}"},
        "medicationCodeableConcept": {
            "coding": [{
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": order.medication_details.medication_code,
                "display": order.medication_details.medication_name
            }],
            "text": order.medication_details.medication_name
        },
        "dosageInstruction": [{
            "text": f"{order.medication_details.dose} {order.medication_details.dose_unit} {order.medication_details.route} {order.medication_details.frequency}",
            "route": {"text": order.medication_details.route},
            "timing": {"code": {"text": order.medication_details.frequency}},
            "doseAndRate": [{
                "doseQuantity": {
                    "value": order.medication_details.dose,
                    "unit": order.medication_details.dose_unit
                }
            }]
        }],
        "authoredOn": datetime.utcnow().isoformat(),
        "requester": {"reference": f"Practitioner/{current_user.id}"}
    }

    # Create via HAPI FHIR
    created = await hapi_client.create("MedicationRequest", medication_request)

    return {"id": created["id"], "status": "success"}
```

**Testing**:
- Verify CDS Hooks integration still works (already queries FHIR)
- Test pharmacy queue (update to query FHIR MedicationRequest)
- Validate end-to-end ordering workflow

#### 3.2 Laboratory Orders
**Current**: Creates Order + LaboratoryOrder in custom tables
**Target**: Create ServiceRequest in HAPI FHIR only

**Changes Required**:
```python
@router.post("/laboratory")
async def create_laboratory_order(order: LaboratoryOrderCreate, ...):
    hapi_client = HAPIFHIRClient()

    service_request = {
        "resourceType": "ServiceRequest",
        "status": "active",
        "intent": "order",
        "category": [{
            "coding": [{
                "system": "http://snomed.info/sct",
                "code": "108252007",
                "display": "Laboratory procedure"
            }]
        }],
        "code": {
            "coding": [{
                "system": "http://loinc.org",
                "code": order.laboratory_details.test_code,
                "display": order.laboratory_details.test_name
            }],
            "text": order.laboratory_details.test_name
        },
        "subject": {"reference": f"Patient/{order.patient_id}"},
        "authoredOn": datetime.utcnow().isoformat(),
        "requester": {"reference": f"Practitioner/{current_user.id}"}
    }

    # Add lab-specific details via extensions if needed
    if order.laboratory_details.specimen_type:
        service_request["extension"] = [{
            "url": "http://wintehr.org/fhir/StructureDefinition/specimen-type",
            "valueString": order.laboratory_details.specimen_type
        }]

    created = await hapi_client.create("ServiceRequest", service_request)
    return {"id": created["id"], "status": "success"}
```

#### 3.3 Imaging Orders
**Current**: Creates Order + ImagingOrder in custom tables
**Target**: Create ServiceRequest in HAPI FHIR only

**Changes Required**: Similar to lab orders, but with imaging-specific fields:
- `category`: Imaging procedure
- `bodySite`: Anatomical location
- Extensions for modality, contrast, clinical indication

#### 3.4 Order Sets
**Current**: OrderSet table with predefined order templates
**Target**: PlanDefinition in HAPI FHIR

**Deferred**: Can implement in Phase 3.4 or defer to future enhancement

---

## 🟡 Phase 4: Tasks Redesign (IMPORTANT)

### Problem
`backend/models/clinical/tasks.py` defines custom tables:
- clinical_tasks
- inbox_items
- care_team_members
- patient_lists

**All can be replaced with standard FHIR resources**

### Solution: Pure FHIR Implementation

#### 4.1 Clinical Tasks → FHIR Task
**Target Resource**: Task
**Router**: `backend/api/clinical/tasks/router.py`

**FHIR Mapping**:
```python
{
    "resourceType": "Task",
    "status": "requested",  # draft, requested, accepted, in-progress, completed
    "intent": "order",
    "code": {"text": task.task_type},
    "description": task.title,
    "for": {"reference": f"Patient/{task.patient_id}"},
    "owner": {"reference": f"Practitioner/{task.assigned_to_id}"},
    "requester": {"reference": f"Practitioner/{task.assigned_by_id}"},
    "authoredOn": datetime.utcnow().isoformat(),
    "restriction": {
        "period": {"end": task.due_date.isoformat()}
    }
}
```

#### 4.2 Inbox Items → FHIR Communication
**Target Resource**: Communication
**Router**: `backend/api/clinical/inbox/router.py`

**FHIR Mapping**:
```python
{
    "resourceType": "Communication",
    "status": "in-progress",  # preparation, in-progress, completed
    "category": [{"text": inbox_item.message_type}],
    "subject": {"reference": f"Patient/{inbox_item.patient_id}"},
    "recipient": [{"reference": f"Practitioner/{inbox_item.recipient_id}"}],
    "sender": {"reference": f"Practitioner/{inbox_item.sender_id}"},
    "sent": datetime.utcnow().isoformat(),
    "payload": [{
        "contentString": inbox_item.message_content
    }]
}
```

#### 4.3 Care Team Members → FHIR CareTeam
**Target Resource**: CareTeam

**FHIR Mapping**:
```python
{
    "resourceType": "CareTeam",
    "status": "active",
    "subject": {"reference": f"Patient/{patient_id}"},
    "participant": [{
        "role": [{"text": member.role}],
        "member": {"reference": f"Practitioner/{member.provider_id}"},
        "period": {
            "start": member.start_date.isoformat(),
            "end": member.end_date.isoformat() if member.end_date else None
        }
    }]
}
```

#### 4.4 Patient Lists → FHIR Group
**Target Resource**: Group

**FHIR Mapping**:
```python
{
    "resourceType": "Group",
    "type": "person",
    "actual": True,
    "name": patient_list.name,
    "managingEntity": {"reference": f"Practitioner/{patient_list.owner_id}"},
    "member": [
        {"entity": {"reference": f"Patient/{patient_id}"}}
        for patient_id in patient_list.patient_ids
    ]
}
```

---

## 🟢 Phase 5: Model Cleanup

### Files to DELETE:
```bash
rm backend/models/clinical/notes.py
rm backend/models/clinical/orders.py
rm backend/models/clinical/tasks.py
rm backend/models/clinical/catalogs.py
```

### Files to UPDATE:
**Remove imports of deleted models**:
- Search codebase for `from models.clinical.orders import`
- Search codebase for `from models.clinical.tasks import`
- Search codebase for `from models.clinical.notes import`
- Search codebase for `from models.clinical.catalogs import`

### Database Initialization to UPDATE:
**File**: `backend/scripts/setup/init_database_definitive.py`

**Verify**: Ensure it does NOT create:
- `clinical_notes` table
- `orders` table
- `medication_orders`, `laboratory_orders`, `imaging_orders` tables
- `order_sets` table
- `clinical_tasks` table
- `inbox_items` table
- `care_team_members` table
- `patient_lists`, `patient_list_memberships` tables
- `medication_catalog`, `lab_test_catalog`, `imaging_study_catalog` tables

**Keep**: Only HAPI FHIR tables (hfj_* tables)

---

## 🧪 Phase 6: Testing & Validation

### 6.1 Fresh Deployment Test
```bash
# Deploy from scratch
./deploy.sh dev

# Verify no custom workflow tables
docker exec emr-postgres psql -U emr_user -d emr_db -c "\dt" | grep -E "(orders|clinical_tasks|inbox_items)"
# Should return NOTHING

# Verify HAPI FHIR tables exist
docker exec emr-postgres psql -U emr_user -d emr_db -c "\dt" | grep hfj_
# Should show hfj_resource, hfj_spidx_*, etc.
```

### 6.2 Workflow Testing
```bash
# Test medication ordering
curl -X POST http://localhost:8000/api/clinical/orders/medications \
  -H "Content-Type: application/json" \
  -d '{...medication order data...}'

# Verify created in HAPI FHIR
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT COUNT(*) FROM hfj_resource
WHERE res_type = 'MedicationRequest'
AND res_deleted_at IS NULL;"

# Test pharmacy queue (should query FHIR)
curl http://localhost:8000/api/clinical/pharmacy/queue

# Test CDS Hooks (should query FHIR)
curl -X POST http://localhost:8000/cds-services/medication-interaction-check \
  -H "Content-Type: application/json" \
  -d '{...cds hook request...}'
```

### 6.3 Integration Testing
- Order creation → Pharmacy queue appearance
- CDS Hooks evaluation → Order validation
- Task creation → Inbox notification
- Care team assignment → Patient access

---

## 📋 Implementation Checklist

### Phase 3: Orders Redesign
- [ ] 3.1: Rewrite medication order endpoint (FHIR MedicationRequest)
- [ ] 3.2: Rewrite lab order endpoint (FHIR ServiceRequest)
- [ ] 3.3: Rewrite imaging order endpoint (FHIR ServiceRequest)
- [ ] 3.4: (Optional) Implement order sets (FHIR PlanDefinition)
- [ ] Update pharmacy queue to query FHIR MedicationRequest
- [ ] Update CDS Hooks integration (verify FHIR queries)
- [ ] Test end-to-end ordering workflow

### Phase 4: Tasks Redesign
- [ ] 4.1: Rewrite clinical tasks (FHIR Task)
- [ ] 4.2: Rewrite inbox items (FHIR Communication)
- [ ] 4.3: Rewrite care team (FHIR CareTeam)
- [ ] 4.4: Rewrite patient lists (FHIR Group)
- [ ] Test task management workflows
- [ ] Test inbox functionality

### Phase 5: Model Cleanup
- [ ] Delete backend/models/clinical/notes.py
- [ ] Delete backend/models/clinical/orders.py
- [ ] Delete backend/models/clinical/tasks.py
- [ ] Delete backend/models/clinical/catalogs.py
- [ ] Remove all imports of deleted models
- [ ] Update database initialization script
- [ ] Verify no custom workflow tables created

### Phase 6: Testing
- [ ] Fresh deployment test
- [ ] Verify HAPI FHIR-only storage
- [ ] Test all clinical workflows
- [ ] Integration testing
- [ ] Performance testing

### Documentation Updates
- [ ] Update README.md (pure FHIR architecture)
- [ ] Update CLAUDE.md (remove custom table references)
- [ ] Update API documentation
- [ ] Update deployment guides

---

## 🚀 Getting Started

**Start immediately with Phase 3.1**: Rewrite medication order endpoint

```bash
# 1. Create feature branch
git checkout -b redesign/pure-fhir-orders

# 2. Open orders router
code backend/api/clinical/orders/orders_router.py

# 3. Begin rewriting create_medication_order endpoint
# - Remove SQLAlchemy model imports
# - Add HAPIFHIRClient import
# - Rebuild endpoint to create FHIR MedicationRequest

# 4. Test with existing CDS Hooks
# They already query FHIR, so should work immediately

# 5. Update pharmacy queue queries
# Change from custom tables to FHIR search
```

---

## ⏱️ Estimated Timeline

- **Phase 3 (Orders)**: 8-12 hours
- **Phase 4 (Tasks)**: 6-8 hours
- **Phase 5 (Cleanup)**: 2-3 hours
- **Phase 6 (Testing)**: 2-4 hours
- **Total**: **18-27 hours**

**Much simpler than data migration!**

---

## ✅ Success Criteria

1. ✅ Fresh deployment creates ONLY HAPI FHIR tables (no custom workflow tables)
2. ✅ All order workflows use FHIR MedicationRequest/ServiceRequest
3. ✅ All task workflows use FHIR Task/Communication/CareTeam/Group
4. ✅ CDS Hooks integration works with pure FHIR
5. ✅ Pharmacy queue queries FHIR resources
6. ✅ Frontend workflows function correctly
7. ✅ No SQLAlchemy models for clinical workflows exist
8. ✅ Documentation reflects pure FHIR architecture

---

**Status**: Ready to begin Phase 3 - Orders Redesign
**Next Action**: Rewrite `create_medication_order` endpoint in `orders_router.py`
