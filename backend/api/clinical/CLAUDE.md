# CLAUDE.md - Clinical Workflows Module Reference

**Purpose**: Comprehensive guide for AI agents working with WintEHR's clinical workflows, decision support, and safety-critical healthcare processes.

**Version**: 2.0

> **⚠️ HEALTHCARE SAFETY CRITICAL**: This module handles patient safety workflows including medication ordering, drug interactions, clinical decision support, and pharmacy dispensing. All implementations must prioritize patient safety and data integrity.

## 🎯 Module Overview

The Clinical Workflows module orchestrates complex healthcare processes through:
- **Clinical Decision Support (CDS Hooks)**: Real-time evidence-based clinical guidance
- **Medication Safety**: Comprehensive drug interaction and allergy checking
- **Order Management**: CPOE workflow with integrated safety checks
- **Pharmacy Operations**: Prescription processing and dispensing workflows
- **Clinical Catalogs**: Dynamic medication and lab test catalogs from real patient data
- **Event Coordination**: Cross-module clinical workflow orchestration
- **Safety Validation**: Multi-layer safety checks and audit trails
- **Compliance Monitoring**: Clinical documentation and regulatory requirements

## 📁 Clinical Workflows Architecture

```
backend/api/clinical/
├── CLAUDE.md                        # This comprehensive guide
├── __init__.py                      # Package initialization
│
├── 🔬 Clinical Decision Support
│   ├── cds_clinical_data.py         # CDS data aggregation service
│   └── ../cds_hooks/                # Full CDS Hooks 1.0 implementation
│       ├── cds_services.py          # 10+ pre-configured clinical services
│       ├── service_registry.py     # Service discovery and registration
│       └── rules_engine/            # Clinical rules and safety checks
│
├── 💊 Medication Safety & Pharmacy
│   ├── drug_interactions.py         # Comprehensive interaction checking
│   ├── drug_safety_router.py       # Drug safety validation endpoints
│   └── pharmacy/
│       └── pharmacy_router.py       # Prescription processing workflow
│
├── 📋 Order Management (CPOE)
│   └── orders/
│       └── orders_router.py         # Computerized Provider Order Entry
│
├── 📚 Clinical Catalogs
│   ├── dynamic_catalog_router.py    # Legacy compatibility layer
│   └── medication_lists_router.py   # Medication list management
│
├── 🔔 Clinical Communications
│   ├── alerts/                      # Clinical alert system
│   ├── inbox/                       # Clinical messaging
│   ├── notifications_helper.py     # Cross-module notifications
│   └── tasks/                       # Clinical task management
│
├── 📄 Clinical Documentation
│   └── documentation/
│       └── notes_router.py          # Clinical notes and documentation
│
└── 👨‍⚕️ Provider Management
    └── provider_directory_router.py # Provider directory and care teams
```

## 🔧 Core Clinical Workflow Components

### 🩺 CDS Hooks Integration (`../cds_hooks/`)
**Purpose**: Real-time clinical decision support following HL7 CDS Hooks 1.0 specification

**Key Features**:
- **10+ Pre-configured Services**: Diabetes management, hypertension, drug interactions, preventive care
- **Hook Types**: patient-view, medication-prescribe, order-review, encounter-start/discharge
- **Service Registry Pattern**: Clean separation of configuration and implementation logic
- **FHIR Prefetch**: Optimized data retrieval for clinical context
- **Card-based UI**: Standardized clinical alert presentation

**Critical Endpoints**:
```python
GET  /cds-services                    # Service discovery
POST /cds-services/{service-id}       # Execute CDS service
POST /cds-services/{id}/feedback      # Feedback collection

# Example CDS Request:
{
  "hookInstance": "uuid",
  "hook": "medication-prescribe",
  "context": {"patientId": "123", "userId": "Practitioner/456"},
  "prefetch": {"patient": {...}, "conditions": {...}}
}

# Example CDS Response:
{
  "cards": [{
    "summary": "Drug Interaction Alert",
    "indicator": "warning",
    "detail": "Warfarin + Aspirin increases bleeding risk",
    "suggestions": [{"label": "Consider alternative", "actions": [...]}]
  }]
}
```

### 💊 Comprehensive Drug Safety (`drug_interactions.py`)
**Purpose**: Multi-dimensional medication safety checking with clinical decision support

**Safety Check Categories**:
1. **Drug-Drug Interactions**: 12+ interaction patterns with severity levels
2. **Drug-Allergy Checking**: Cross-reactivity analysis and contraindication alerts
3. **Drug-Disease Contraindications**: Condition-based medication restrictions
4. **Duplicate Therapy Detection**: Therapeutic class overlap identification
5. **Dosage Range Validation**: Min/max dose checking with adjustment recommendations

**Key Features**:
```python
# Comprehensive Safety Check
POST /api/clinical/drug-interactions/comprehensive-safety-check
{
  "patient_id": "Patient/123",
  "medications": [{"name": "warfarin", "dose": "5mg"}],
  "include_current_medications": true,
  "include_allergies": true,
  "include_contraindications": true
}

# Returns detailed safety analysis:
{
  "overall_risk_score": 7.5,  # 0-10 scale
  "critical_alerts": 2,
  "interactions": [...],
  "allergy_alerts": [...],
  "contraindications": [...],
  "recommendations": ["HIGH RISK: Urgent pharmacy consultation"]
}
```

**Interaction Database**: Covers major drug classes including:
- Anticoagulants (warfarin, DOACs) + antiplatelet agents
- Statins + CYP3A4 inhibitors (rhabdomyolysis risk)
- ACE inhibitors + potassium supplements (hyperkalemia)
- SSRIs + NSAIDs (GI bleeding risk)
- MAOIs + SSRIs (serotonin syndrome - CONTRAINDICATED)

### 📋 CPOE Order Management (`orders/orders_router.py`)
**Purpose**: Computerized Provider Order Entry with integrated safety checks

**Order Types Supported**:
1. **Medication Orders**: Full prescription workflow with CDS integration
2. **Laboratory Orders**: Lab test ordering with specimen requirements
3. **Imaging Orders**: Radiology orders with contrast safety checks
4. **Order Sets**: Predefined order templates for common scenarios

**Workflow Integration**:
```python
# Medication Order with Safety Checks
POST /api/clinical/orders/medications
{
  "patient_id": "Patient/123",
  "medication_details": {
    "medication_name": "warfarin",
    "dose": 5.0,
    "dose_unit": "mg",
    "route": "oral",
    "frequency": "daily"
  },
  "override_alerts": false  # Safety check enforcement
}

# Returns order + safety analysis:
{
  "order_saved": false,  # Blocked by safety alerts
  "alerts": [
    {
      "severity": "high",
      "type": "allergy",
      "message": "Patient has documented allergy to warfarin"
    }
  ]
}
```

### 🏥 Pharmacy Workflow (`pharmacy/pharmacy_router.py`)
**Purpose**: Complete prescription processing and dispensing workflow

**Pharmacy Queue Management**:
```python
GET /api/clinical/pharmacy/queue
# Returns prioritized prescription queue:
[
  {
    "medication_request_id": "MedReq-123",
    "patient_name": "John Doe",
    "medication_name": "Metformin 500mg",
    "status": "pending",      # pending, verified, dispensed, ready
    "priority": 1,             # 1=highest, 5=lowest
    "due_date": "2024-01-21T10:00:00Z"
  }
]
```

**MedicationDispense FHIR Creation**:
```python
POST /api/clinical/pharmacy/dispense
{
  "medication_request_id": "MedReq-123",
  "quantity": 30,
  "lot_number": "LOT123456",
  "expiration_date": "2025-12-31",
  "pharmacist_notes": "Counseled on side effects"
}
# Creates complete FHIR MedicationDispense resource
```

### 📚 Dynamic Clinical Catalogs
**Purpose**: Real-time clinical catalogs generated from actual patient data

**Legacy Compatibility**: `dynamic_catalog_router.py` provides redirects to unified catalog system

**Unified Catalog Endpoints** (via `/api/catalogs/`):
```python
GET /api/catalogs/medications     # Medication catalog with frequencies
GET /api/catalogs/lab-tests      # Lab test catalog with reference ranges
GET /api/catalogs/conditions     # Condition catalog with ICD-10 codes
GET /api/catalogs/search         # Cross-catalog search

# Features:
- Generated from Synthea patient data
- Real clinical codes (RxNorm, LOINC, SNOMED)
- Usage frequencies and common doses
- 5-minute caching for performance
```

## 🛡️ Clinical Safety & Compliance Framework

### Multi-Layer Safety Validation
**Safety-Critical Workflow Requirements**:
1. **Pre-Order Validation**: CDS Hooks evaluation before order creation
2. **Drug Safety Screening**: Comprehensive interaction and allergy checking
3. **Clinical Decision Support**: Evidence-based recommendations and alerts
4. **Pharmacy Verification**: Multi-step dispensing workflow with verification
5. **Audit Trail**: Complete clinical action logging for compliance

### Error Handling & Recovery
**Critical Error Patterns**:
```python
# Always wrap safety-critical operations
try:
    safety_result = await comprehensive_safety_check(patient_id, medications)
    if safety_result.overall_risk_score >= 7.0:
        # Block high-risk combinations
        raise HTTPException(400, "HIGH RISK: Pharmacy consultation required")
except Exception as e:
    logger.error(f"Safety check failed: {str(e)}", exc_info=True)
    # Return error card for user notification
    return {"cards": [create_error_card("Safety check unavailable")]}
```

### CDS Clinical Data Aggregation (`cds_clinical_data.py`)
**Purpose**: Centralized clinical data aggregation for CDS Hooks evaluation

**Data Aggregation Patterns**:
```python
GET /api/clinical/cds-data/{patient_id}
# Returns comprehensive clinical context:
{
  "patient": {...},              # Patient demographics
  "conditions": [...],           # Active conditions with onset dates
  "medications": [...],          # Current medications with doses
  "allergies": [...],            # Known allergies with severity
  "recent_labs": [...],          # Lab results within 90 days
  "recent_vitals": [...],        # Vital signs within 30 days
  "active_encounters": [...]     # Current healthcare encounters
}

# Optimized for CDS prefetch templates
# Reduces API calls during hook evaluation
# Cached for 5-minute windows
```

## 🔄 Clinical Workflow Orchestration

### Event-Driven Clinical Workflows
**Purpose**: Coordinate complex multi-step clinical processes across modules

**Event Types**:
```python
# Clinical workflow events
CLINICAL_EVENTS = {
    "ORDER_PLACED": "clinical.order.placed",
    "MEDICATION_PRESCRIBED": "clinical.medication.prescribed",
    "LAB_RESULT_RECEIVED": "clinical.lab.result_received",
    "CRITICAL_VALUE_ALERT": "clinical.alert.critical_value",
    "PHARMACY_DISPENSED": "pharmacy.medication.dispensed",
    "CDS_ALERT_TRIGGERED": "cds.alert.triggered"
}

# Event publishing pattern
await publish_event(CLINICAL_EVENTS.ORDER_PLACED, {
    "order_id": order.id,
    "patient_id": patient_id,
    "order_type": "medication",
    "urgency": "routine",
    "timestamp": datetime.utcnow().isoformat()
})
```

### Cross-Module Integration Patterns
**Integration Points**:
1. **Orders → CDS Hooks**: Real-time decision support during ordering
2. **Orders → Pharmacy**: Prescription workflow initiation
3. **CDS → Drug Safety**: Comprehensive safety evaluation
4. **Results → Alerts**: Critical value notification
5. **Pharmacy → Documentation**: Dispensing records and patient counseling

**WebSocket Integration**:
```python
# Real-time clinical updates
await websocket_manager.broadcast_to_patient(
    patient_id=patient_id,
    event_type="medication_dispensed",
    data={
        "medication_name": med_name,
        "status": "ready_for_pickup",
        "pickup_location": "Main Pharmacy"
    }
)
```

## 📊 Clinical Quality & Performance Monitoring

### Pharmacy Metrics & Analytics
**Performance Tracking**:
```python
GET /api/clinical/pharmacy/metrics?date_range=7
# Returns comprehensive pharmacy analytics:
{
  "metrics": {
    "total_requests": 150,
    "dispensed_medications": 142,
    "completion_rate": 94.7,
    "average_processing_time": "2.3 hours",
    "status_breakdown": {
      "pending": 8,
      "verified": 12,
      "dispensed": 130
    }
  }
}
```

### Clinical Decision Support Analytics
**CDS Performance Metrics**:
- Alert acceptance rates by service
- Time to decision on recommendations
- Clinical outcome correlation
- Alert fatigue measurement
- User feedback analysis

### Safety Monitoring
**Key Safety Indicators**:
- Drug interaction alert frequency
- Override rates by alert type
- Time to pharmacy verification
- Medication error incident tracking
- Patient safety event correlation

## 🚨 Critical Implementation Requirements

### Patient Safety Protocols
**MANDATORY Safety Checks**:
1. **Always validate patient identity** before clinical actions
2. **Check allergies** before medication orders
3. **Verify drug interactions** for all prescriptions
4. **Confirm contraindications** based on patient conditions
5. **Audit all clinical decisions** for compliance tracking

### FHIR Resource Integrity
**Critical FHIR Patterns**:
```python
# Always use proper FHIR resource creation
async def create_medication_order(patient_id: str, medication_data: dict):
    # 1. Validate patient exists
    patient = await storage.read_resource('Patient', patient_id)
    if not patient:
        raise HTTPException(404, "Patient not found")
    
    # 2. Run safety checks
    safety_result = await comprehensive_safety_check(patient_id, [medication_data])
    if safety_result.critical_alerts > 0:
        raise HTTPException(400, "Critical safety alerts prevent ordering")
    
    # 3. Create FHIR-compliant resource
    medication_request = {
        "resourceType": "MedicationRequest",
        "status": "active",
        "intent": "order",
        "subject": {"reference": f"Patient/{patient_id}"},
        "medicationCodeableConcept": medication_data,
        "authoredOn": datetime.utcnow().isoformat(),
        # ... additional required fields
    }
    
    # 4. Store with audit trail
    resource_id, version, timestamp = await storage.create_resource(
        'MedicationRequest', 
        medication_request
    )
    
    # 5. Publish workflow event
    await publish_event(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, {
        "resource_id": resource_id,
        "patient_id": patient_id
    })
    
    return resource_id
```

### Error Handling Best Practices
**Safety-Critical Error Patterns**:
```python
# Pattern 1: Graceful degradation with user notification
try:
    cds_result = await evaluate_cds_hooks(patient_id, context)
except Exception as e:
    logger.error(f"CDS evaluation failed: {str(e)}", exc_info=True)
    # Return informational card instead of blocking workflow
    return {
        "cards": [{
            "summary": "Clinical Decision Support Unavailable",
            "indicator": "info",
            "detail": "CDS services are temporarily unavailable. Please use clinical judgment."
        }]
    }

# Pattern 2: Fail-safe for critical safety checks
try:
    interaction_check = await check_drug_interactions(medications)
except Exception as e:
    logger.critical(f"Drug interaction check failed: {str(e)}", exc_info=True)
    # Fail safe - assume interactions present
    return {
        "cards": [{
            "summary": "Drug Interaction Check Failed",
            "indicator": "critical",
            "detail": "Unable to verify drug interactions. Manual review required before dispensing."
        }]
    }
```

## ⚙️ Technical Implementation Standards

### Authentication & Authorization
**Security Requirements**:
- **Development**: JWT disabled, demo users (demo/nurse/pharmacist/admin)
- **Production**: Full JWT with role-based access control (RBAC)
- **Clinical Roles**: Prescriber, Pharmacist, Nurse, Admin permissions
- **Audit Logging**: All clinical actions must be logged with user identity

**Critical Role Checks**:
```python
# Prescribing permissions
@require_role(['prescriber', 'physician'])
async def create_medication_order(...):
    # Only prescribers can create medication orders

# Pharmacy operations
@require_role(['pharmacist'])
async def dispense_medication(...):
    # Only pharmacists can dispense medications
```

### Data Integrity Standards
**MANDATORY Data Rules**:
1. **ALWAYS use Synthea FHIR data** - Never create mock clinical data
2. **Validate all clinical codes** - RxNorm, LOINC, SNOMED, ICD-10
3. **Check resource references** - Ensure all FHIR references are valid
4. **Handle null/undefined gracefully** - Clinical data is often incomplete
5. **Use fhirClient for all FHIR operations** - Not deprecated fhirService

**FHIR Data Validation**:
```python
def validate_clinical_resource(resource: dict) -> bool:
    """Validate FHIR resource for clinical safety"""
    # Check required fields
    if not resource.get('resourceType'):
        raise ValueError("Missing resourceType")
    
    # Validate patient reference
    subject = resource.get('subject')
    if subject and not subject.get('reference'):
        raise ValueError("Invalid patient reference")
    
    # Check clinical codes
    if resource['resourceType'] == 'MedicationRequest':
        med_concept = resource.get('medicationCodeableConcept')
        if not med_concept or not med_concept.get('coding'):
            raise ValueError("Missing medication coding")
    
    return True
```

### Performance & Caching Strategy
**Caching Patterns**:
- **Clinical Catalogs**: 5-minute TTL (balance freshness vs performance)
- **CDS Prefetch Data**: 2-minute TTL (clinical context changes rapidly)
- **Drug Interaction Rules**: 24-hour TTL (static reference data)
- **Patient Safety Alerts**: No caching (always current)

**Database Optimization**:
```python
# Efficient patient medication queries
search_params = {
    "patient": f"Patient/{patient_id}",
    "status": "active",
    "_sort": "-authored",  # Most recent first
    "_count": 50          # Reasonable limit
}

# Use search parameter indexing
medications, total = await storage.search_resources(
    'MedicationRequest', 
    search_params
)
```

## 🚀 Common Clinical Workflow Patterns

### Complete Medication Ordering Workflow
```python
async def complete_medication_workflow(
    patient_id: str, 
    medication_request: dict,
    prescriber_id: str
) -> dict:
    """
    Complete medication ordering workflow with all safety checks
    """
    try:
        # 1. Get patient clinical context
        clinical_data = await get_cds_clinical_data(patient_id)
        
        # 2. Run CDS Hooks evaluation
        cds_request = {
            "hook": "medication-prescribe",
            "context": {
                "patientId": patient_id,
                "userId": prescriber_id,
                "medications": [medication_request]
            },
            "prefetch": clinical_data
        }
        
        cds_response = await evaluate_cds_service(
            "medication-interaction-check", 
            cds_request
        )
        
        # 3. Comprehensive safety check
        safety_request = SafetyCheckRequest(
            patient_id=patient_id,
            medications=[MedicationCheck(**medication_request)],
            include_current_medications=True,
            include_allergies=True,
            include_contraindications=True
        )
        
        safety_result = await comprehensive_safety_check(safety_request)
        
        # 4. Evaluate safety concerns
        if safety_result.overall_risk_score >= 7.0:
            return {
                "status": "blocked",
                "reason": "High safety risk",
                "cds_cards": cds_response.cards,
                "safety_alerts": safety_result.recommendations
            }
        
        # 5. Create medication request
        fhir_medication_request = build_fhir_medication_request(
            patient_id, medication_request, prescriber_id
        )
        
        resource_id, version, timestamp = await storage.create_resource(
            'MedicationRequest', 
            fhir_medication_request
        )
        
        # 6. Publish workflow events
        await publish_event(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, {
            "resource_id": resource_id,
            "patient_id": patient_id,
            "medication_name": medication_request.get('name'),
            "prescriber_id": prescriber_id
        })
        
        # 7. Notify pharmacy
        await publish_event(CLINICAL_EVENTS.ORDER_PLACED, {
            "order_id": resource_id,
            "order_type": "medication",
            "priority": medication_request.get('priority', 'routine')
        })
        
        return {
            "status": "success",
            "medication_request_id": resource_id,
            "cds_cards": cds_response.cards,
            "safety_score": safety_result.overall_risk_score
        }
        
    except Exception as e:
        logger.error(f"Medication workflow failed: {str(e)}", exc_info=True)
        raise HTTPException(500, "Clinical workflow error")
```

### CDS Hooks Integration Pattern
```python
async def evaluate_patient_view_hooks(patient_id: str) -> dict:
    """
    Evaluate all patient-view CDS hooks for comprehensive assessment
    """
    # Get clinical context
    clinical_data = await get_cds_clinical_data(patient_id)
    
    # Define hook context
    hook_context = {
        "hook": "patient-view",
        "context": {"patientId": patient_id},
        "prefetch": clinical_data
    }
    
    # Evaluate all patient-view services
    services = [
        "diabetes-management",
        "hypertension-management", 
        "preventive-care-gaps",
        "medication-review"
    ]
    
    all_cards = []
    for service_id in services:
        try:
            response = await evaluate_cds_service(service_id, hook_context)
            all_cards.extend(response.cards)
        except Exception as e:
            logger.warning(f"CDS service {service_id} failed: {e}")
            # Continue with other services
    
    # Sort cards by priority
    all_cards.sort(key=lambda c: {
        'critical': 0, 'warning': 1, 'info': 2
    }.get(c.get('indicator', 'info'), 2))
    
    return {"cards": all_cards}
```

### Pharmacy Queue Processing
```python
async def process_pharmacy_queue() -> dict:
    """
    Process pharmacy queue with priority-based workflow
    """
    # Get prioritized queue
    queue_items = await get_pharmacy_queue()
    
    processing_summary = {
        "processed": 0,
        "pending": 0,
        "alerts": []
    }
    
    for item in queue_items:
        try:
            # Check if due for processing
            if item.due_date and datetime.now() > item.due_date:
                processing_summary["alerts"].append(
                    f"OVERDUE: {item.medication_name} for {item.patient_name}"
                )
            
            # Auto-verify routine orders
            if item.priority >= 3 and item.status == "pending":
                await update_pharmacy_status(
                    item.medication_request_id,
                    PharmacyStatusUpdate(status="verified", updated_by="auto-verification")
                )
                processing_summary["processed"] += 1
            else:
                processing_summary["pending"] += 1
                
        except Exception as e:
            logger.error(f"Queue processing error for {item.medication_request_id}: {e}")
    
    return processing_summary
```

### Clinical Data Aggregation
```python
async def get_comprehensive_patient_summary(patient_id: str) -> dict:
    """
    Aggregate comprehensive patient data for clinical decision making
    """
    # Run parallel queries for efficiency
    patient_data, conditions, medications, allergies, labs, vitals = await asyncio.gather(
        storage.read_resource('Patient', patient_id),
        get_patient_conditions(patient_id),
        get_patient_current_medications(patient_id),
        get_patient_allergies(patient_id),
        get_recent_lab_results(patient_id, days=90),
        get_recent_vital_signs(patient_id, days=30),
        return_exceptions=True
    )
    
    # Handle any query failures gracefully
    summary = {
        "patient": patient_data if not isinstance(patient_data, Exception) else None,
        "conditions": conditions if not isinstance(conditions, Exception) else [],
        "medications": medications if not isinstance(medications, Exception) else [],
        "allergies": allergies if not isinstance(allergies, Exception) else [],
        "recent_labs": labs if not isinstance(labs, Exception) else [],
        "recent_vitals": vitals if not isinstance(vitals, Exception) else [],
        "clinical_summary": {
            "active_problems": len(conditions) if conditions else 0,
            "current_medications": len(medications) if medications else 0,
            "known_allergies": len(allergies) if allergies else 0
        }
    }
    
    return summary
```

## 🐛 Clinical Workflow Troubleshooting

### CDS Hooks Debugging
```bash
# Test CDS service discovery
curl -X GET http://localhost:8000/cds-services

# Test specific CDS service
curl -X POST http://localhost:8000/cds-services/diabetes-management \
  -H "Content-Type: application/json" \
  -d '{
    "hookInstance": "test-123",
    "hook": "patient-view", 
    "context": {"patientId": "Patient/123"}
  }'

# Check CDS service logs
docker exec emr-backend tail -f /var/log/cds_hooks.log
```

### Drug Safety Troubleshooting
```bash
# Verify patient medication data
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
  r.id,
  r.data->'medicationCodeableConcept'->>'text' as medication_name,
  r.data->>'status' as status
FROM fhir.resources r 
WHERE r.resource_type = 'MedicationRequest' 
AND r.data->'subject'->>'reference' = 'Patient/123'
ORDER BY r.data->>'authoredOn' DESC;"

# Check allergy data
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
  r.data->'code'->>'text' as allergen,
  r.data->>'criticality' as severity
FROM fhir.resources r 
WHERE r.resource_type = 'AllergyIntolerance'
AND r.data->'patient'->>'reference' = 'Patient/123';"

# Test drug interaction endpoint
curl -X POST http://localhost:8000/api/clinical/drug-interactions/comprehensive-safety-check \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "123",
    "medications": [{"name": "warfarin", "dose": "5mg"}]
  }'
```

### Pharmacy Workflow Issues
```bash
# Check pharmacy queue status
docker exec emr-backend python -c "
import asyncio
from api.clinical.pharmacy.pharmacy_router import get_pharmacy_queue
from database import get_db_session

async def check_queue():
    async with get_db_session() as db:
        queue = await get_pharmacy_queue(db=db)
        print(f'Queue items: {len(queue)}')
        for item in queue[:5]:
            print(f'  {item.medication_name} - Status: {item.status}')

asyncio.run(check_queue())
"

# Verify MedicationDispense creation
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT COUNT(*) as dispense_count
FROM fhir.resources 
WHERE resource_type = 'MedicationDispense';"
```

### Clinical Catalog Issues
```bash
# Check catalog data availability
curl http://localhost:8000/api/catalogs/medications?limit=5

# Verify source data exists
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
  resource_type, 
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM fhir.resources 
WHERE resource_type IN ('MedicationRequest', 'Observation', 'Condition')
GROUP BY resource_type;"

# Check search parameters
docker exec emr-backend python scripts/testing/verify_search_params_after_import.py
```

### Order Processing Diagnostics
```bash
# Check order creation workflow
docker exec emr-backend python -c "
import asyncio
from api.clinical.orders.orders_router import create_medication_order
from database import get_db_session
from models.models import Provider

# Test order creation
print('Testing order creation workflow...')
# Implementation would include actual test
"

# Verify provider data
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT id, first_name, last_name, npi 
FROM providers 
LIMIT 5;"
```

### Performance Monitoring
```bash
# Monitor clinical API performance
docker exec emr-backend python -c "
import time
import requests

# Test critical endpoints
endpoints = [
    '/api/clinical/cds-data/Patient/123',
    '/api/clinical/pharmacy/queue',
    '/api/catalogs/medications?limit=10'
]

for endpoint in endpoints:
    start = time.time()
    response = requests.get(f'http://localhost:8000{endpoint}')
    duration = time.time() - start
    print(f'{endpoint}: {response.status_code} ({duration:.2f}s)')
"

# Check database query performance
docker exec emr-postgres psql -U emr_user -d emr_db -c "
EXPLAIN ANALYZE 
SELECT * FROM fhir.search_params 
WHERE param_name = 'patient' 
AND value_string LIKE 'Patient/%'
LIMIT 100;"
```

## 📝 Clinical Workflow Best Practices

### 1. Patient Safety First
**Critical Safety Rules**:
- **Never bypass safety checks** for convenience or performance
- **Always validate patient identity** before clinical actions
- **Implement fail-safe patterns** - when in doubt, err on the side of caution
- **Provide clear error messages** that help clinicians make safe decisions
- **Log all safety-related decisions** for audit and improvement

```python
# GOOD: Fail-safe drug interaction checking
try:
    interactions = await check_drug_interactions(medications)
    if not interactions:  # Empty list could mean no interactions OR check failed
        # Verify the check actually ran
        if not await verify_interaction_service_health():
            # Service unhealthy - fail safe
            return create_warning_card("Drug interaction check unavailable")
except Exception:
    # Always fail safe on errors
    return create_critical_card("Unable to verify drug safety")

# BAD: Ignoring safety check failures
try:
    interactions = await check_drug_interactions(medications)
except Exception:
    interactions = []  # Dangerous - assumes no interactions
```

### 2. FHIR Resource Integrity
**FHIR Best Practices**:
- **Use proper resource types** - Don't abuse generic resources
- **Validate references** - Ensure all resource references exist
- **Handle coding systems correctly** - RxNorm, LOINC, SNOMED, ICD-10
- **Preserve resource history** - Don't delete, mark as inactive
- **Use extensions appropriately** - Follow FHIR extension patterns

```python
# GOOD: Proper FHIR resource creation
def create_medication_request(patient_id: str, medication_data: dict) -> dict:
    return {
        "resourceType": "MedicationRequest",
        "status": "active",
        "intent": "order",
        "subject": {"reference": f"Patient/{patient_id}"},
        "medicationCodeableConcept": {
            "coding": [{
                "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
                "code": medication_data["rxnorm_code"],
                "display": medication_data["name"]
            }],
            "text": medication_data["name"]
        },
        "authoredOn": datetime.utcnow().isoformat(),
        "requester": {"reference": f"Practitioner/{prescriber_id}"}
    }

# BAD: Incomplete or invalid FHIR resource
def create_bad_medication_request():
    return {
        "type": "medication",  # Wrong field name
        "patient": "123",      # Should be reference object
        "drug": "aspirin"      # Non-FHIR field
    }
```

### 3. Clinical Workflow Orchestration
**Event-Driven Patterns**:
- **Use events for loose coupling** between clinical modules
- **Handle event failures gracefully** - don't block critical workflows
- **Provide event replay capabilities** for workflow recovery
- **Monitor event processing** for clinical workflow health

```python
# GOOD: Robust event publishing
async def publish_clinical_event(event_type: str, data: dict):
    try:
        await event_publisher.publish(event_type, data)
    except Exception as e:
        # Log but don't fail the main workflow
        logger.error(f"Event publishing failed: {event_type} - {e}")
        # Store for retry
        await store_failed_event(event_type, data, str(e))

# BAD: Blocking workflow on event failures
async def bad_event_handling(event_type: str, data: dict):
    await event_publisher.publish(event_type, data)  # Will raise if fails
    # Main workflow blocked if event system is down
```

### 4. Performance & Scalability
**Clinical Performance Patterns**:
- **Cache static clinical data** (drug databases, reference ranges)
- **Don't cache patient-specific data** longer than necessary
- **Use database indexes** for clinical queries
- **Implement progressive loading** for large datasets
- **Monitor clinical response times** - slow responses affect patient care

### 5. Error Handling & User Experience
**Clinical Error Patterns**:
- **Provide actionable error messages** for clinicians
- **Distinguish between system errors and clinical warnings**
- **Never show technical stack traces** to clinical users
- **Offer alternative workflows** when systems are unavailable
- **Log errors with clinical context** for meaningful debugging

### 6. Compliance & Audit
**Regulatory Compliance**:
- **Log all clinical decisions** with user identity and timestamp
- **Preserve audit trails** - never delete clinical audit logs
- **Document safety overrides** with clinical justification
- **Track clinical outcomes** for quality improvement
- **Implement data retention policies** per healthcare regulations

### 7. Testing Clinical Workflows
**Clinical Testing Strategies**:
- **Test with realistic clinical scenarios** - not just happy paths
- **Include edge cases** - missing data, system failures, unusual combinations
- **Test safety checks thoroughly** - verify alerts trigger correctly
- **Performance test under clinical load** - multiple users, large datasets
- **Test cross-module integration** - ensure clinical workflows work end-to-end

## 🔗 Clinical Workflow Documentation

### Core Documentation
- **[Main CLAUDE.md](../../../CLAUDE.md)**: WintEHR project overview and setup
- **[CDS Hooks README](../cds_hooks/README.md)**: Detailed CDS Hooks implementation guide
- **[FHIR Storage](../../fhir/CLAUDE.md)**: FHIR storage engine and search capabilities
- **[Clinical Design System](../../../docs/CLINICAL_DESIGN_SYSTEM.md)**: UI components and patterns

### Integration Documentation
- **[API Endpoints](../../../docs/API_ENDPOINTS.md)**: Complete API reference
- **[Cross-Module Integration](../../../docs/modules/integration/cross-module-integration.md)**: Clinical workflow coordination
- **[WebSocket Integration](../../../docs/modules/websocket/README.md)**: Real-time clinical updates
- **[Event System](../../../docs/modules/events/clinical-events.md)**: Clinical workflow events

### Frontend Integration
- **[Clinical Workspace](../../../docs/modules/clinical-workspace/README.md)**: Main clinical interface
- **[CPOE Interface](../../../docs/modules/orders/README.md)**: Order entry workflow
- **[Pharmacy Dashboard](../../../docs/modules/pharmacy/README.md)**: Pharmacy workflow interface
- **[CDS Integration](../../../docs/modules/cds-hooks/integration.md)**: Frontend CDS display

### Testing & Validation
- **[Clinical Testing](../../../docs/testing/clinical-workflows.md)**: Clinical workflow testing strategies
- **[FHIR Validation](../../../docs/testing/fhir-validation.md)**: FHIR resource validation
- **[Performance Testing](../../../docs/testing/performance.md)**: Clinical system performance

## 💡 Clinical Workflow Quick Reference

### Essential Clinical Patterns
```python
# Complete medication safety check
safety_result = await comprehensive_safety_check(
    patient_id, medications, include_all=True
)
if safety_result.overall_risk_score >= 7.0:
    return block_with_pharmacist_consultation()

# CDS Hooks evaluation
cds_cards = await evaluate_cds_hooks(
    hook="medication-prescribe",
    patient_id=patient_id,
    context={"medications": medications}
)

# Event-driven workflow coordination
await publish_event(CLINICAL_EVENTS.ORDER_PLACED, {
    "order_id": order_id,
    "requires_pharmacist_review": high_risk
})
```

### Clinical Status Workflows
- **Order States**: draft → active → completed/cancelled/discontinued
- **Pharmacy States**: pending → verified → dispensed → ready → completed
- **CDS Response Types**: info, warning, critical (with color coding)
- **Alert Priorities**: 1=critical (immediate), 5=routine (24-hour turnaround)

### Performance Targets
- **CDS Evaluation**: <500ms for medication-prescribe hooks
- **Drug Safety Check**: <1000ms for comprehensive analysis
- **Pharmacy Queue**: <200ms for queue retrieval
- **Clinical Catalogs**: <300ms with caching
- **Order Creation**: <2000ms end-to-end with all safety checks

### Clinical Data Integration
- **Patient Context**: Demographics, conditions, allergies, medications
- **Clinical Codes**: RxNorm (medications), LOINC (labs), SNOMED (conditions)
- **Reference Ranges**: Age/gender-specific normal values
- **Drug Databases**: Interaction rules, contraindications, dosage ranges
- **Clinical Guidelines**: Evidence-based decision support rules

---

## ⚠️ CRITICAL SAFETY REMINDER

**This is a healthcare system handling patient safety workflows. Every clinical decision, medication order, and safety check directly impacts patient care.**

### Non-Negotiable Requirements:
1. **Patient safety always comes first** - never compromise safety for convenience
2. **Validate all clinical data** - bad data leads to bad clinical decisions
3. **Implement comprehensive error handling** - system failures must not compromise patient care
4. **Maintain complete audit trails** - clinical decisions must be traceable
5. **Test thoroughly with real clinical scenarios** - edge cases matter in healthcare
6. **Follow clinical coding standards** - incorrect codes can be dangerous
7. **Respect clinical workflows** - understand the human processes behind the technology

**When in doubt, consult with clinical staff and prioritize patient safety over system functionality.**