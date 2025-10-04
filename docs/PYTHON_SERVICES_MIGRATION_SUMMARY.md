# Python Services Migration to fhirclient - Summary

**Branch**: `experimental/hapi-fhir-migration`
**Date**: 2025-01-21
**Purpose**: Migrate Python backend services from direct database access to HAPI FHIR via fhirclient

## Migration Overview

All Python services have been migrated to use `fhirclient` (SMART on FHIR Python client) to access HAPI FHIR instead of direct PostgreSQL database queries.

### Migrated Services

| Service | Original File | Migrated File | Status |
|---------|--------------|---------------|--------|
| FHIR Client Config | - | `backend/services/fhir_client_config.py` | ✅ New |
| CDS Hooks | `backend/api/cds_hooks/cds_services.py` | `backend/api/cds_hooks/cds_services_fhir.py` | ✅ Complete |
| Clinical Catalogs | `backend/api/services/clinical/dynamic_catalog_service.py` | `backend/api/services/clinical/dynamic_catalog_service_fhir.py` | ✅ Complete |
| Pharmacy Workflow | `backend/api/clinical/pharmacy/pharmacy_router.py` | `backend/api/clinical/pharmacy/pharmacy_router_fhir.py` | ✅ Complete |
| WebSocket Events | `backend/api/websocket/fhir_notifications.py` | - | ✅ No migration needed |

### Key Changes

#### 1. FHIR Client Configuration (`backend/services/fhir_client_config.py`)

**Purpose**: Centralized fhirclient configuration with convenience functions

**Key Functions**:
```python
from services.fhir_client_config import (
    get_fhir_client,        # Get singleton FHIR client
    get_fhir_server,        # Get FHIR server instance
    search_resources,        # Search FHIR resources
    get_resource,           # Get resource by ID
    create_resource,        # Create new resource
    update_resource,        # Update existing resource
    get_patient,            # Get patient by ID
    search_conditions,      # Search patient conditions
    search_medications,     # Search patient medications
    search_observations,    # Search patient observations
    search_allergies        # Search patient allergies
)
```

**Configuration**:
- HAPI FHIR URL: `http://hapi-fhir:8080/fhir` (configurable via `HAPI_FHIR_URL` env var)
- App ID: `wintehr_clinical_services`
- Singleton pattern for efficient connection management

#### 2. CDS Hooks Migration (`backend/api/cds_hooks/cds_services_fhir.py`)

**Before**: Used `prefetch` data from direct database queries
**After**: Fetches data from HAPI FHIR using fhirclient

**Example**:
```python
# OLD: Used prefetched data
conditions = prefetch.get('conditions', [])

# NEW: Fetch from HAPI FHIR
conditions = search_conditions(patient_id, status='active')
has_diabetes = any(
    'diabetes' in condition.code.text.lower()
    for condition in conditions if condition.code
)
```

**Services Migrated**:
- `DiabetesManagementService`: Checks A1C levels, metformin use, annual screenings
- `AllergyCheckService`: Validates medications against patient allergies
- `DrugInteractionService`: Checks for drug-drug interactions

#### 3. Clinical Catalogs Migration (`backend/api/services/clinical/dynamic_catalog_service_fhir.py`)

**Before**: Complex SQL queries with JSON operations and aggregations
**After**: FHIR resource searches with Python-based aggregation

**Features**:
- Medication catalog from MedicationRequest/MedicationStatement
- Condition catalog with clinical statuses
- Lab test catalog with reference ranges (calculated from patient data)
- Procedure catalog with frequency tracking
- Vaccine catalog from Immunization resources
- Allergy catalog from AllergyIntolerance resources

**Example**:
```python
# Fetch and aggregate medications
med_requests = search_resources('MedicationRequest', {'_count': 1000})

# Aggregate by code
medication_map = defaultdict(lambda: {
    'code': None,
    'display': None,
    'frequency_count': 0,
    'statuses': set()
})

for med_request in med_requests:
    if hasattr(med_request, 'medicationCodeableConcept'):
        coding = med_request.medicationCodeableConcept.coding[0]
        if coding and coding.code:
            medication_map[coding.code]['frequency_count'] += 1
            # ... aggregate other fields
```

#### 4. Pharmacy Workflow Migration (`backend/api/clinical/pharmacy/pharmacy_router_fhir.py`)

**Before**: Used `FHIRStorageEngine(db)` for database operations
**After**: Uses fhirclient for HAPI FHIR operations

**Key Endpoints**:
- `GET /api/clinical/pharmacy/queue`: Pharmacy queue with FHIR search
- `POST /api/clinical/pharmacy/dispense`: Create MedicationDispense using fhirclient models
- `PUT /api/clinical/pharmacy/status/{id}`: Update pharmacy status via FHIR extensions
- `GET /api/clinical/pharmacy/metrics`: Analytics from FHIR resources

**Example - MedicationDispense Creation**:
```python
from fhirclient.models.medicationdispense import MedicationDispense
from fhirclient.models.quantity import Quantity

dispense = MedicationDispense()
dispense.id = str(uuid.uuid4())
dispense.status = "completed"
dispense.medicationCodeableConcept = med_request.medicationCodeableConcept
dispense.subject = med_request.subject

quantity = Quantity()
quantity.value = dispense_request.quantity
quantity.unit = 'units'
dispense.quantity = quantity

created_dispense = create_resource(dispense)
```

#### 5. WebSocket Events - No Migration Needed

**Why**: The WebSocket notification service (`fhir_notifications.py`) doesn't fetch FHIR data - it only broadcasts notifications. No migration required.

## Integration Steps

### 1. Install Dependencies

```bash
# Ensure fhirclient is installed
docker exec emr-backend pip install fhirclient==4.2.1
```

### 2. Configure HAPI FHIR Connection

**Environment Variable**:
```bash
# In docker-compose.yml or .env
HAPI_FHIR_URL=http://hapi-fhir:8080/fhir
```

**Verify Connection**:
```bash
# Test HAPI FHIR is accessible
curl http://localhost:8888/fhir/metadata

# Should return FHIR CapabilityStatement
```

### 3. Update Service Imports

**Option A: Gradual Migration (Recommended)**

Keep both versions and gradually switch imports:

```python
# Use new FHIR version
from api.cds_hooks.cds_services_fhir import CDS_SERVICES
from api.services.clinical.dynamic_catalog_service_fhir import DynamicCatalogServiceFHIR
from api.clinical.pharmacy.pharmacy_router_fhir import router as pharmacy_router_fhir

# Register new routers
app.include_router(pharmacy_router_fhir, prefix="/api/clinical", tags=["pharmacy-fhir"])
```

**Option B: Direct Replacement**

Replace old files with new versions:

```bash
# CDS Hooks
cp backend/api/cds_hooks/cds_services_fhir.py backend/api/cds_hooks/cds_services.py

# Clinical Catalogs
cp backend/api/services/clinical/dynamic_catalog_service_fhir.py \
   backend/api/services/clinical/dynamic_catalog_service.py

# Pharmacy Router
cp backend/api/clinical/pharmacy/pharmacy_router_fhir.py \
   backend/api/clinical/pharmacy/pharmacy_router.py
```

### 4. Update Router Registration

**In `backend/api/routers/__init__.py`** (or wherever routers are registered):

```python
# OLD: Uses FHIRStorageEngine
from api.clinical.pharmacy.pharmacy_router import router as pharmacy_router

# NEW: Uses fhirclient
from api.clinical.pharmacy.pharmacy_router_fhir import router as pharmacy_router_fhir

# Register with app
app.include_router(pharmacy_router_fhir)  # Use new FHIR version
```

### 5. Update Service Initialization

**For catalog services**:

```python
# OLD: Needs database session
from database import get_db_session
catalog_service = DynamicCatalogService(db)

# NEW: No database session needed
from api.services.clinical.dynamic_catalog_service_fhir import DynamicCatalogServiceFHIR
catalog_service = DynamicCatalogServiceFHIR()
```

## Testing Integration

### 1. Verify HAPI FHIR Connectivity

```bash
# Check HAPI FHIR is running
docker ps | grep hapi-fhir

# Verify metadata endpoint
curl http://localhost:8888/fhir/metadata | jq '.fhirVersion'
# Should return: "4.0.1"

# Check patient count
curl "http://localhost:8888/fhir/Patient?_summary=count" | jq
```

### 2. Test CDS Hooks Service

```bash
# Test diabetes management service
curl -X POST http://localhost:8000/cds-services/diabetes-management \
  -H "Content-Type: application/json" \
  -d '{
    "hookInstance": "test-123",
    "hook": "patient-view",
    "context": {"patientId": "PATIENT_ID_HERE"}
  }' | jq

# Should return CDS cards with diabetes management recommendations
```

### 3. Test Clinical Catalogs

```bash
# Test medication catalog
curl http://localhost:8000/api/catalogs/medications?limit=10 | jq

# Should return medications from HAPI FHIR with:
# - RxNorm codes
# - Display names
# - Frequency counts
# - Common statuses

# Test lab catalog
curl http://localhost:8000/api/catalogs/lab-tests?limit=5 | jq

# Should return lab tests with:
# - LOINC codes
# - Reference ranges (calculated)
# - Common units
```

### 4. Test Pharmacy Workflow

```bash
# Get pharmacy queue
curl http://localhost:8000/api/clinical/pharmacy/queue | jq

# Should return medication requests from HAPI FHIR

# Test dispense endpoint
curl -X POST http://localhost:8000/api/clinical/pharmacy/dispense \
  -H "Content-Type: application/json" \
  -d '{
    "medication_request_id": "MedReq-123",
    "quantity": 30,
    "lot_number": "LOT123456",
    "expiration_date": "2025-12-31",
    "pharmacist_notes": "Test dispense"
  }' | jq

# Should create MedicationDispense in HAPI FHIR
```

### 5. Verify Data in HAPI FHIR

```bash
# Check MedicationDispense was created
curl "http://localhost:8888/fhir/MedicationDispense?_count=5" | jq

# Check MedicationRequest was updated to completed
curl "http://localhost:8888/fhir/MedicationRequest/MedReq-123" | jq '.status'
# Should return: "completed"
```

## Migration Benefits

### 1. **Standard FHIR Implementation**
- Uses official HAPI FHIR server (community-maintained)
- Reduces custom FHIR backend maintenance burden
- Automatic FHIR R4 compliance and validation

### 2. **Standard Client Libraries**
- **Backend**: `fhirclient` (SMART on FHIR Python client)
- **Frontend**: Can use `fhir.js` or `fhirclient.js`
- Consistent FHIR interaction patterns

### 3. **Decoupled Architecture**
- Services consume FHIR API instead of direct database
- Easier to scale and maintain
- Clear separation of concerns

### 4. **Performance Considerations**
- API overhead vs direct SQL queries
- HAPI FHIR has built-in caching and indexing
- Can use FHIR search parameters for optimization

### 5. **Development Benefits**
- Standard FHIR models from fhirclient
- Type safety and validation
- Easier integration with other FHIR systems

## Migration Challenges & Solutions

### Challenge 1: API Overhead
**Issue**: Network calls to HAPI FHIR vs direct database queries
**Solution**:
- Use HAPI FHIR's caching capabilities
- Implement service-level caching for frequently accessed data
- Batch operations where possible

### Challenge 2: Complex Aggregations
**Issue**: SQL aggregations (COUNT, AVG, PERCENTILE) not directly available in FHIR search
**Solution**:
- Fetch resources and aggregate in Python
- Use `_count` parameter for pagination
- Implement caching for computed catalogs

### Challenge 3: Transaction Bundles
**Issue**: Creating multiple related resources atomically
**Solution**:
- Use FHIR transaction bundles
- Implement retry logic for failed operations
- Consider eventual consistency patterns

### Challenge 4: Search Parameter Differences
**Issue**: FHIR search parameters differ from SQL queries
**Solution**:
- Map SQL queries to FHIR search parameters
- Use FHIR composite searches where needed
- Leverage HAPI FHIR's extended search capabilities

## Performance Optimization Tips

### 1. Use Search Result Limits
```python
# Limit results to reduce payload size
search_resources('MedicationRequest', {'_count': 100, 'status': 'active'})
```

### 2. Implement Caching
```python
# Cache computed catalogs
cache_key = f"medications_{limit}"
if self._is_cached(cache_key):
    return self.cache[cache_key]
```

### 3. Parallel Queries
```python
# Run independent queries in parallel
import asyncio
patient, conditions, medications = await asyncio.gather(
    get_patient(patient_id),
    search_conditions(patient_id),
    search_medications(patient_id)
)
```

### 4. Use FHIR Prefetch Templates
```python
# For CDS Hooks, define efficient prefetch templates
prefetch = {
    "patient": "Patient/{{context.patientId}}",
    "conditions": "Condition?patient={{context.patientId}}&status=active",
    "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
}
```

## Next Steps

### 1. Frontend Migration
- Update frontend to use `fhir.js` or `fhirclient.js`
- Point FHIR client to HAPI FHIR: `http://localhost:8888/fhir`
- Remove direct calls to Python FHIR backend

### 2. Data Migration
- Import Synthea data to HAPI FHIR using `scripts/import_synthea_to_hapi.py`
- Verify search parameters are indexed
- Test patient compartments and references

### 3. Testing & Validation
- Integration tests with HAPI FHIR
- Performance testing under load
- Clinical workflow validation

### 4. Documentation Updates
- Update API documentation to reflect FHIR endpoints
- Document HAPI FHIR configuration
- Update deployment procedures

## Rollback Plan

If issues arise, rollback is straightforward:

```bash
# 1. Stop using migrated services
# In router registration, use original imports
from api.clinical.pharmacy.pharmacy_router import router  # Original

# 2. Keep using FHIRStorageEngine
# Original services still available with _fhir suffix

# 3. Switch back to original database
# No data migration happened, original database intact
```

## Support & Troubleshooting

### Common Issues

**Issue**: `fhirclient` import errors
**Solution**: Ensure fhirclient is installed: `pip install fhirclient==4.2.1`

**Issue**: HAPI FHIR connection refused
**Solution**: Verify HAPI FHIR is running: `docker ps | grep hapi-fhir`

**Issue**: Empty search results
**Solution**: Check HAPI FHIR has data: `curl http://localhost:8888/fhir/Patient?_count=5`

**Issue**: FHIR model errors
**Solution**: Check fhirclient model imports match FHIR R4 spec

### Getting Help

- **HAPI FHIR Docs**: https://hapifhir.io/hapi-fhir/docs/
- **fhirclient Docs**: https://github.com/smart-on-fhir/client-py
- **FHIR R4 Spec**: https://www.hl7.org/fhir/R4/
- **Migration Spec**: `docs/HAPI_FHIR_MIGRATION_SPEC.md`

---

**Migration Status**: ✅ Complete - All Python services migrated to use fhirclient
**Next Phase**: Frontend migration to use HAPI FHIR directly via fhir.js
