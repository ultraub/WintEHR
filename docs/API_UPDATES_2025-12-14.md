# API Updates - December 14, 2025

This document summarizes the new API endpoints and fixes implemented to address workflow gaps.

## Security Fixes

### DICOM Path Traversal Fix (IMG-1)
- **File**: `backend/api/dicom/dicom_service.py`
- **Change**: Added `validate_study_dir()` function that:
  - Rejects path traversal sequences (`..`, absolute paths)
  - Validates resolved path is within `DICOM_BASE_DIR`
  - Applied to all DICOM endpoints that accept `study_dir` parameter

## New Pharmacy Endpoints

### Refill Management (PHR-1)
Using FHIR Task resources to track refill requests.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clinical/pharmacy/refills` | GET | Get pending refill requests |
| `/api/clinical/pharmacy/refills/request` | POST | Create a new refill request |
| `/api/clinical/pharmacy/refills/{task_id}/approve` | POST | Approve a refill request |
| `/api/clinical/pharmacy/refills/{task_id}/reject` | POST | Reject a refill request |

**FHIR Resources Used**:
- `Task` - Represents the refill request workflow
- `MedicationRequest` - New prescription created on approval (linked via `priorPrescription`)

### Medication Administration Record (PHR-3)
Using FHIR MedicationAdministration resources.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clinical/pharmacy/mar/{patient_id}` | GET | Get MAR entries for a patient |
| `/api/clinical/pharmacy/mar/administer` | POST | Record medication administration |
| `/api/clinical/pharmacy/mar/schedule/{patient_id}` | GET | Get medication schedule for a patient |

**FHIR Resources Used**:
- `MedicationAdministration` - Records actual medication given
- `MedicationRequest` - Referenced for scheduled medications

## New Results Endpoints

### Critical Value Detection & Result Acknowledgment (RES-1, RES-2, RES-4)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clinical/results/patient/{patient_id}` | GET | Get patient results with critical value analysis |
| `/api/clinical/results/critical-values` | GET | Get critical value alerts across patients |
| `/api/clinical/results/acknowledge` | POST | Acknowledge a lab result |
| `/api/clinical/results/{observation_id}` | GET | Get detailed result information |
| `/api/clinical/results/trends/{patient_id}/{loinc_code}` | GET | Get trending data for a specific test |

**FHIR Resources Used**:
- `Observation` - Lab results with critical value checking
- Extensions for acknowledgment tracking

**Critical Value Thresholds Defined**:
- Sodium (2951-2): < 120 or > 160 mmol/L
- Potassium (2823-3): < 2.5 or > 6.5 mmol/L
- Glucose (2345-7): < 40 or > 500 mg/dL
- Hemoglobin (718-7): < 7.0 or > 20.0 g/dL
- Platelets (777-3): < 20 or > 1000 10*3/uL
- And more (see `notifications_helper.py`)

## New Order Set Endpoints (ORD-10)

Using FHIR PlanDefinition resources.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clinical/orders/order-sets/` | GET | List available order sets |
| `/api/clinical/orders/order-sets/{set_id}` | GET | Get order set details |
| `/api/clinical/orders/order-sets/` | POST | Create a new order set |
| `/api/clinical/orders/order-sets/{set_id}/apply` | POST | Apply order set to a patient |

**FHIR Resources Used**:
- `PlanDefinition` - Stores order set templates (type: "order-set")
- `MedicationRequest` / `ServiceRequest` - Created when order set is applied

## Frontend Changes

### Orders Tab (ORD-2)
- **File**: `frontend/src/components/clinical/orders/FHIROrdersTab.js`
- **Change**: Orders now route through backend API instead of direct FHIR calls
  - Medication orders: `POST /api/clinical/orders/medications`
  - Lab orders: `POST /api/clinical/orders/laboratory`
  - Imaging orders: `POST /api/clinical/orders/imaging`
  - Discontinue: `PUT /api/clinical/orders/{id}/discontinue`
- **Benefits**:
  - Proper audit trail
  - Backend safety checks (drug interactions, allergies)
  - CDS Hooks integration

## Testing the New Endpoints

### Test Refill Workflow
```bash
# Create a refill request
curl -X POST http://localhost:8000/api/clinical/pharmacy/refills/request \
  -H "Content-Type: application/json" \
  -d '{
    "medication_request_id": "123",
    "patient_id": "456",
    "reason": "Continuing therapy"
  }'

# Approve the refill
curl -X POST http://localhost:8000/api/clinical/pharmacy/refills/{task_id}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "pharmacist_id": "789",
    "decision_notes": "Approved for 30-day supply"
  }'
```

### Test Critical Values
```bash
# Get critical values for a patient
curl http://localhost:8000/api/clinical/results/critical-values?patient_id=123

# Acknowledge a result
curl -X POST http://localhost:8000/api/clinical/results/acknowledge \
  -H "Content-Type: application/json" \
  -d '{
    "observation_id": "obs-123",
    "acknowledged_by": "dr-456",
    "notes": "Reviewed and addressed"
  }'
```

### Test Order Sets
```bash
# Create an order set
curl -X POST http://localhost:8000/api/clinical/orders/order-sets/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Chest Pain Admission",
    "category": "admission",
    "specialty": "cardiology",
    "items": [
      {"order_type": "laboratory", "display": "Troponin I"},
      {"order_type": "laboratory", "display": "BMP"},
      {"order_type": "medication", "display": "Aspirin 325mg", "dose": 325, "dose_unit": "mg"}
    ]
  }'

# Apply order set to patient
curl -X POST "http://localhost:8000/api/clinical/orders/order-sets/{set_id}/apply?patient_id=123"
```

### Test MAR
```bash
# Get medication schedule
curl http://localhost:8000/api/clinical/pharmacy/mar/schedule/123

# Record administration
curl -X POST http://localhost:8000/api/clinical/pharmacy/mar/administer \
  -H "Content-Type: application/json" \
  -d '{
    "medication_request_id": "med-123",
    "patient_id": "123",
    "administered_by": "nurse-456",
    "dose_given": 500,
    "dose_unit": "mg",
    "route": "oral"
  }'
```

## Remaining Work

The following items were identified but not yet addressed:

1. **ORD-1**: Drug interaction endpoint path mismatch in frontend
2. **ORD-5**: Medication order form missing dose/route/frequency fields
3. **ORD-7/ORD-8**: Lab/imaging order forms missing detailed fields
4. **CDS-3**: CDS feedback submission not implemented
5. **PAT-1**: N+1 query in patient list (performance)
