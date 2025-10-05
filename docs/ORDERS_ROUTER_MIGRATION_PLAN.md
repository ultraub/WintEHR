# Orders Router FHIR Migration Plan

**Status**: Analysis Complete - Implementation Pending
**Complexity**: High (485 lines, critical clinical workflow)
**Estimated Effort**: 6-8 hours

## Database Models Used

### Line 9: Clinical Orders Models
```python
from models.clinical.orders import Order, MedicationOrder, LaboratoryOrder, ImagingOrder, OrderSet
```

### Line 10: Core Models
```python
from models.models import Provider, Patient
```

## FHIR Resource Mapping

| Old Model | FHIR Resource | Justification |
|-----------|--------------|---------------|
| `Order` (base) | `ServiceRequest` | FHIR R4 standard for all clinical orders |
| `MedicationOrder` | `MedicationRequest` | FHIR R4 specific resource for prescriptions |
| `LaboratoryOrder` | `ServiceRequest` (category=laboratory) | Lab orders are service requests |
| `ImagingOrder` | `ServiceRequest` (category=imaging) | Imaging orders are service requests |
| `OrderSet` | `RequestGroup` | FHIR resource for order set definitions |
| `Provider` | `Practitioner` | Already in FHIR |
| `Patient` | `Patient` | Already in FHIR |

## Database Queries to Migrate

### Authentication Queries (Lines 18, 132)
```python
# BEFORE
provider = db.query(Provider).first()

# AFTER
from fhir.core.storage import FHIRStorageEngine
storage = FHIRStorageEngine()
practitioners = await storage.search_resources("Practitioner", {"_count": 1})
provider = practitioners['entry'][0]['resource'] if practitioners.get('entry') else None
```

### Patient Clinical Data (Lines 145-153)
```python
# BEFORE
patient = db.query(Patient).filter(Patient.id == patient_id).first()
allergies = patient.allergies

# AFTER
patient = await storage.read_resource("Patient", patient_id)
allergy_bundle = await storage.search_resources(
    "AllergyIntolerance",
    {"patient": f"Patient/{patient_id}"}
)
allergies = [entry['resource'] for entry in allergy_bundle.get('entry', [])]
```

### Active Medications Query (Lines 163-166)
```python
# BEFORE
current_meds = db.query(MedicationOrder).join(Order).filter(
    Order.patient_id == patient_id,
    Order.status == "active"
).all()

# AFTER
med_bundle = await storage.search_resources(
    "MedicationRequest",
    {
        "patient": f"Patient/{patient_id}",
        "status": "active"
    }
)
current_meds = [entry['resource'] for entry in med_bundle.get('entry', [])]
```

### Medication Order Creation (Lines 195-240)
```python
# BEFORE - Two-step database insert
base_order = Order(
    patient_id=order.patient_id,
    ordering_provider_id=current_user.id,
    order_type="medication",
    status="pending",
    ...
)
db.add(base_order)
db.flush()

med_order = MedicationOrder(
    order_id=base_order.id,
    **order.medication_details.dict()
)
db.add(med_order)
db.commit()

# AFTER - Single FHIR resource creation
medication_request = {
    "resourceType": "MedicationRequest",
    "status": "active",
    "intent": "order",
    "subject": {"reference": f"Patient/{order.patient_id}"},
    "requester": {"reference": f"Practitioner/{current_user.id}"},
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
        "route": {
            "coding": [{
                "system": "http://snomed.info/sct",
                "display": order.medication_details.route
            }]
        },
        "doseAndRate": [{
            "doseQuantity": {
                "value": order.medication_details.dose,
                "unit": order.medication_details.dose_unit
            }
        }]
    }],
    "priority": order.priority,
    "authoredOn": datetime.utcnow().isoformat(),
    "reasonCode": [{"text": order.indication}] if order.indication else []
}

resource_id, version, timestamp = await storage.create_resource(
    "MedicationRequest",
    medication_request
)
```

### Laboratory Order Creation (Lines 251-277)
```python
# BEFORE - Database insert
base_order = Order(...)
db.add(base_order)
db.flush()

lab_order = LaboratoryOrder(
    order_id=base_order.id,
    **order.laboratory_details.dict()
)
db.add(lab_order)
db.commit()

# AFTER - FHIR ServiceRequest
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
    "requester": {"reference": f"Practitioner/{current_user.id}"},
    "occurrenceDateTime": order.laboratory_details.collection_datetime.isoformat() if order.laboratory_details.collection_datetime else None,
    "priority": order.priority,
    "authoredOn": datetime.utcnow().isoformat()
}

resource_id, version, timestamp = await storage.create_resource(
    "ServiceRequest",
    service_request
)
```

### Get Orders Query (Lines 329-342)
```python
# BEFORE
query = db.query(Order)
if patient_id:
    query = query.filter(Order.patient_id == patient_id)
if order_type:
    query = query.filter(Order.order_type == order_type)
if status:
    query = query.filter(Order.status == status)
orders = query.order_by(Order.order_date.desc()).offset(skip).limit(limit).all()

# AFTER - Need to handle multiple resource types
results = []

# Get MedicationRequests if order_type is medication or None
if not order_type or order_type == "medication":
    search_params = {"_count": limit, "_sort": "-authored"}
    if patient_id:
        search_params["patient"] = f"Patient/{patient_id}"
    if status:
        search_params["status"] = status

    med_bundle = await storage.search_resources("MedicationRequest", search_params)
    results.extend([
        convert_medication_request_to_order_response(entry['resource'])
        for entry in med_bundle.get('entry', [])
    ])

# Get ServiceRequests if order_type is lab/imaging or None
if not order_type or order_type in ["laboratory", "imaging"]:
    search_params = {"_count": limit, "_sort": "-authored"}
    if patient_id:
        search_params["patient"] = f"Patient/{patient_id}"
    if status:
        search_params["status"] = status

    # Filter by category for specific order types
    if order_type == "laboratory":
        search_params["category"] = "108252007"  # SNOMED code for lab procedure
    elif order_type == "imaging":
        search_params["category"] = "363679005"  # SNOMED code for imaging

    svc_bundle = await storage.search_resources("ServiceRequest", search_params)
    results.extend([
        convert_service_request_to_order_response(entry['resource'])
        for entry in svc_bundle.get('entry', [])
    ])

# Sort and limit combined results
results.sort(key=lambda x: x.order_date, reverse=True)
return results[:limit]
```

### Discontinue Order (Lines 372-388)
```python
# BEFORE
order = db.query(Order).filter(Order.id == order_id).first()
order.status = "discontinued"
order.discontinued_at = datetime.utcnow()
order.discontinued_by_id = current_user.id
order.discontinue_reason = reason
db.commit()

# AFTER - Need to determine resource type first
# Try MedicationRequest
try:
    resource = await storage.read_resource("MedicationRequest", order_id)
    resource_type = "MedicationRequest"
except:
    # Try ServiceRequest
    try:
        resource = await storage.read_resource("ServiceRequest", order_id)
        resource_type = "ServiceRequest"
    except:
        raise HTTPException(404, "Order not found")

# Update resource
resource["status"] = "revoked"  # FHIR status for discontinued
resource["statusReason"] = {
    "text": reason
}

# Store extension for additional discontinuation data
if "extension" not in resource:
    resource["extension"] = []

resource["extension"].append({
    "url": "http://wintehr.org/fhir/StructureDefinition/discontinuation",
    "extension": [
        {
            "url": "discontinuedBy",
            "valueReference": {"reference": f"Practitioner/{current_user.id}"}
        },
        {
            "url": "discontinuedAt",
            "valueDateTime": datetime.utcnow().isoformat()
        },
        {
            "url": "reason",
            "valueString": reason
        }
    ]
})

await storage.update_resource(resource_type, order_id, resource)
```

## Implementation Strategy

### Phase 1: Create Converter Utilities (2 hours)
Create converter functions to transform between API models and FHIR resources:

```python
# converters/order_converters.py

def convert_medication_order_to_fhir(
    order: MedicationOrderCreate,
    prescriber_id: str
) -> dict:
    """Convert API medication order to FHIR MedicationRequest"""
    return {
        "resourceType": "MedicationRequest",
        # ... full implementation
    }

def convert_lab_order_to_fhir(
    order: LaboratoryOrderCreate,
    requester_id: str
) -> dict:
    """Convert API lab order to FHIR ServiceRequest"""
    return {
        "resourceType": "ServiceRequest",
        "category": [{"coding": [{"code": "108252007"}]}],
        # ... full implementation
    }

def convert_fhir_to_order_response(
    resource: dict
) -> OrderResponse:
    """Convert FHIR resource to API OrderResponse"""
    return OrderResponse(
        id=resource["id"],
        patient_id=resource["subject"]["reference"].split("/")[1],
        # ... full conversion
    )
```

### Phase 2: Update Authentication (30 min)
Replace Provider queries with Practitioner FHIR queries

### Phase 3: Migrate Medication Orders (2 hours)
- Update `create_medication_order()` endpoint
- Update `check_medication_cds()` to use FHIR resources
- Test with existing CDS Hooks integration

### Phase 4: Migrate Lab/Imaging Orders (1.5 hours)
- Update `create_laboratory_order()` endpoint
- Update `create_imaging_order()` endpoint
- Test order creation workflow

### Phase 5: Migrate Query Endpoints (2 hours)
- Update `get_orders()` to query multiple FHIR resource types
- Update `get_active_orders()`
- Update `discontinue_order()` with proper FHIR status

### Phase 6: Migrate Order Sets (1.5 hours)
- Convert OrderSet to RequestGroup FHIR resource
- Update `get_order_sets()` and `create_order_set()`
- Update `apply_order_set()` to create FHIR resources

### Phase 7: Testing & Validation (1 hour)
- Test complete order workflow
- Verify CDS Hooks integration still works
- Test pharmacy integration
- Performance testing

## Breaking Changes

### API Response Format Changes
The API responses will remain compatible, but internally:
- Order IDs will be FHIR resource IDs
- Some fields may have different values (FHIR status codes vs custom)
- Timestamps will be ISO 8601 format

### Database Migration Required
- Existing Order/MedicationOrder/etc. data needs migration to FHIR resources
- Migration script required to convert old orders to FHIR format
- Consider keeping old tables temporarily for rollback capability

## Testing Requirements

### Unit Tests
- Test each converter function
- Test FHIR resource creation
- Test query parameter handling

### Integration Tests
- Test complete medication ordering workflow
- Test order retrieval and filtering
- Test order discontinuation
- Test order set application

### End-to-End Tests
- Test frontend integration
- Test CDS Hooks integration
- Test pharmacy workflow integration
- Test real Synthea patient data

## Rollout Strategy

### Stage 1: Parallel Operation (1 week)
- Run both old and new code paths
- Log differences
- Verify FHIR resources created correctly

### Stage 2: Gradual Rollout (1 week)
- Enable FHIR path for 10% of requests
- Monitor for errors
- Gradually increase to 100%

### Stage 3: Cleanup (1 week)
- Remove old database code
- Archive old order tables (don't delete)
- Update documentation

## Risk Mitigation

### High Risk Areas
1. **Medication Safety**: CDS Hooks must continue working
2. **Pharmacy Integration**: Order workflow must be uninterrupted
3. **Data Integrity**: No orders can be lost during migration
4. **Performance**: FHIR queries must be as fast as database queries

### Mitigation Strategies
1. Comprehensive testing with real clinical scenarios
2. Parallel operation mode for validation
3. Complete audit logging for debugging
4. Rollback plan to old code if issues arise
5. Database backup before migration

## Success Criteria

- [ ] All endpoints work with FHIR resources
- [ ] CDS Hooks integration verified
- [ ] Pharmacy workflow unchanged
- [ ] Performance within acceptable limits (<2s for order creation)
- [ ] Zero data loss
- [ ] Complete audit trail maintained
- [ ] All tests passing

## Next Steps

1. Get approval for migration approach
2. Create converter utilities
3. Start with simplest endpoint (get_orders)
4. Progressive migration of creation endpoints
5. Comprehensive testing before production

---

**Note**: This is a critical clinical workflow. Migration must be carefully planned and thoroughly tested. Patient safety depends on order accuracy and system reliability.
