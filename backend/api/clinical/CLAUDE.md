# CLAUDE.md - Clinical Services API Quick Reference

**Purpose**: Essential guide for AI agents working with WintEHR's clinical services and API endpoints.

**Last Updated**: 2025-01-20

## 🎯 Overview

This directory contains clinical-specific API endpoints that power WintEHR's clinical workflows:
- Clinical decision support (CDS) and drug interaction checking
- Dynamic clinical catalogs (medications, labs, procedures)
- Provider directory and clinical notifications
- Clinical documentation and notes
- Order management and pharmacy workflows
- Clinical tasks and alerts

## 📁 Directory Structure

```
backend/api/clinical/
├── __init__.py                      # Package initialization
├── cds_clinical_data.py            # Clinical decision support data
├── drug_interactions.py            # Medication interaction checking
├── dynamic_catalog_router.py       # Dynamic clinical catalogs
├── provider_directory_router.py    # Provider management
├── notifications_helper.py         # Clinical notifications
├── alerts/                         # Clinical alerts system
│   ├── __init__.py
│   └── router.py                   # Alert endpoints
├── documentation/                  # Clinical documentation
│   ├── __init__.py
│   └── notes_router.py            # Clinical notes endpoints
├── inbox/                          # Clinical inbox/messaging
│   ├── __init__.py
│   ├── inbox_router.py
│   └── router.py
├── orders/                         # Order management
│   ├── __init__.py
│   └── orders_router.py           # CPOE endpoints
├── pharmacy/                       # Pharmacy workflows
│   ├── __init__.py
│   └── pharmacy_router.py        # Prescription management
└── tasks/                          # Clinical tasks
    ├── __init__.py
    ├── router.py
    └── tasks_router.py
```

## 🔧 Core Components

### Dynamic Clinical Catalogs (`dynamic_catalog_router.py`)
Generates real-time catalogs from patient data:
```python
# Endpoints:
GET /api/clinical/catalogs/medications    # Medication catalog
GET /api/clinical/catalogs/labs          # Lab test catalog  
GET /api/clinical/catalogs/procedures    # Procedure catalog
GET /api/clinical/catalogs/search        # Universal search

# Features:
- Auto-generated from Synthea patient data
- Includes frequencies, common doses, units
- Real clinical codes (RxNorm, LOINC, SNOMED)
```

### Drug Interactions (`drug_interactions.py`)
Real-time medication safety checking:
```python
# Check interactions for patient
POST /api/clinical/drug-interactions/check
{
    "patient_id": "Patient/123",
    "medication_codes": ["rxnorm1", "rxnorm2"]
}

# Returns severity levels: contraindicated, major, moderate, minor
```

### Clinical Decision Support (`cds_clinical_data.py`)
Provides data for CDS Hooks:
```python
# Get clinical data for CDS evaluation
GET /api/clinical/cds-data/{patient_id}

# Includes:
- Active conditions
- Current medications  
- Recent labs
- Allergies
- Demographics
```

### Order Management (`orders/orders_router.py`)
CPOE (Computerized Provider Order Entry):
```python
# Create order
POST /api/clinical/orders
{
    "resourceType": "ServiceRequest",
    "status": "active",
    "intent": "order",
    "subject": {"reference": "Patient/123"},
    "code": {...},
    "authoredOn": "2024-01-20T10:00:00Z"
}

# Get orders for patient
GET /api/clinical/orders?patient={patient_id}
```

### Pharmacy Workflows (`pharmacy/pharmacy_router.py`)
Prescription processing:
```python
# Get prescription queue
GET /api/clinical/pharmacy/queue?status=active

# Update prescription status
PUT /api/clinical/pharmacy/prescriptions/{id}/status
{
    "status": "completed",
    "dispensed_quantity": 30
}

# Get dispense history
GET /api/clinical/pharmacy/dispense-history?patient={id}
```

### Clinical Documentation (`documentation/notes_router.py`)
Clinical notes management:
```python
# Create clinical note
POST /api/clinical/documentation/notes
{
    "resourceType": "DocumentReference",
    "status": "current",
    "type": {...},
    "subject": {"reference": "Patient/123"},
    "content": [...]
}

# Get notes for encounter
GET /api/clinical/documentation/notes?encounter={id}
```

## ⚠️ Critical Implementation Details

### Authentication & Authorization
- Development mode: JWT disabled, demo users
- Production mode: Full JWT authentication required
- Role-based access control (RBAC) for clinical operations

### Data Sources
- **ALWAYS use Synthea data** - Never mock clinical data
- Catalogs generated from actual patient resources
- Drug interactions use real RxNorm codes
- Lab results use real LOINC codes

### Event Integration
Clinical services publish events for cross-module communication:
```python
# Example: Order placed event
await publish_event(CLINICAL_EVENTS.ORDER_PLACED, {
    "orderId": order.id,
    "patientId": patient_id,
    "orderType": "medication"
})
```

### Performance Considerations
- Catalog endpoints are cached (5-minute TTL)
- Use pagination for large result sets
- Implement proper index usage for queries

## 🚀 Common Operations

### Building Clinical Catalogs
```python
# Medication catalog from patient data
medications = await storage.search_resources(
    "MedicationRequest",
    {"_summary": "true"}
)
catalog = build_medication_catalog(medications)
```

### Checking Drug Interactions
```python
# Get patient's active medications
active_meds = await get_active_medications(patient_id)

# Check for interactions
interactions = await check_drug_interactions(
    active_meds + [new_medication]
)

# Filter by severity
major_interactions = [i for i in interactions if i.severity == "major"]
```

### Processing Orders
```python
# Create order with validation
order_data = validate_order_request(request_body)
order = await storage.create_resource("ServiceRequest", order_data)

# Update order status
await storage.update_resource(
    "ServiceRequest",
    order_id,
    {"status": new_status}
)
```

## 🐛 Troubleshooting

### Empty Catalog Results
```bash
# Verify patient data exists
docker exec emr-backend python scripts/validate_deployment.py --docker

# Check specific resource counts
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT resource_type, COUNT(*) 
FROM fhir.resources 
WHERE resource_type IN ('MedicationRequest', 'Observation', 'Procedure')
GROUP BY resource_type;"
```

### Drug Interaction Issues
```bash
# Verify RxNorm codes in medications
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT data->'medicationCodeableConcept'->'coding'->0->>'code' as rxnorm_code
FROM fhir.resources 
WHERE resource_type = 'MedicationRequest'
LIMIT 10;"
```

### Order Processing Errors
- Check patient reference validity
- Verify practitioner authorization
- Ensure proper status transitions
- Validate required fields

## 📝 Best Practices

1. **Use Real Clinical Data**: Always work with Synthea-generated resources
2. **Validate Clinical Codes**: Ensure RxNorm, LOINC, SNOMED codes are valid
3. **Handle Edge Cases**: Null references, missing data, invalid statuses
4. **Implement Proper Auth**: Respect clinical roles and permissions
5. **Publish Events**: Use event system for cross-module updates
6. **Cache Appropriately**: Balance performance with data freshness
7. **Log Clinical Actions**: Maintain audit trail for compliance

## 🔗 Related Documentation

- **Main CLAUDE.md**: `/CLAUDE.md` - Project overview
- **FHIR Storage**: `/backend/fhir/CLAUDE.md` - Storage engine details
- **API Endpoints**: `/docs/API_ENDPOINTS.md` - Complete API reference
- **Clinical Modules**: `/docs/modules/` - Frontend integration

## 💡 Quick Tips

- Dynamic catalogs update automatically as new patient data is added
- Drug interaction API supports both RxNorm codes and medication names
- Order statuses follow FHIR workflow: draft → active → completed/cancelled
- Pharmacy queue filters by status, priority, and date
- Clinical notes support multiple content types (PDF, text, structured)
- Provider directory includes scheduling and specialty information

---

**Remember**: Clinical safety is paramount. Always validate data, check interactions, and maintain proper audit trails.