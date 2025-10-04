# HAPI FHIR Migration Specification

**Status**: Experimental POC
**Branch**: `experimental/hapi-fhir-migration`
**Created**: 2025-10-04
**Goal**: Migrate WintEHR from custom Python FHIR backend to HAPI FHIR with standard clients

---

## Executive Summary

### Objective
Replace the custom Python/FastAPI FHIR storage engine with HAPI FHIR (Java) and migrate all components to use standard FHIR clients:
- **Backend**: HAPI FHIR JPA Server (Java/Spring Boot)
- **Python Services**: `fhirclient` library (SMART on FHIR Python client)
- **Frontend**: `fhir.js` (SMART on FHIR JavaScript client)

### Strategic Benefits
1. **Zero FHIR Maintenance Burden** - Community maintains FHIR spec compliance, search, validation
2. **Standard Clients** - Use proven, community-maintained client libraries
3. **SMART on FHIR Compliance** - Opens ecosystem of SMART apps
4. **Clean Architecture** - Single FHIR source of truth, API-driven services

### Scope & Constraints
- **Experimental POC** - No production risk, no security requirements
- **Fresh Data** - Drop existing data, re-import via Synthea to HAPI FHIR
- **Branch Isolation** - Work on `experimental/hapi-fhir-migration` branch
- **Timeline**: 5-8 weeks for complete migration

---

## Architecture Comparison

### Current Architecture (Custom FHIR Backend)
```
┌─────────────────────────────────────┐
│  Frontend (React)                   │
│  - Custom fhirClient.js             │
└─────────────────┬───────────────────┘
                  │
                  ↓ (Custom API)
┌─────────────────────────────────────┐
│  FastAPI Backend (Python)           │
│  - Custom FHIR storage engine       │
│  - Direct PostgreSQL access         │
│  - Custom search indexing           │
│  - CDS Hooks, catalogs, events      │
└─────────────────┬───────────────────┘
                  │
                  ↓
┌─────────────────────────────────────┐
│  PostgreSQL                         │
│  - Custom schema (6 tables)         │
│  - 38 FHIR resource types           │
└─────────────────────────────────────┘
```

### Target Architecture (HAPI FHIR)
```
┌─────────────────────────────────────┐
│  Frontend (React)                   │
│  - fhir.js (SMART on FHIR client)   │
└─────────────────┬───────────────────┘
                  │
                  ↓ (Standard FHIR REST API)
┌─────────────────────────────────────┐
│  HAPI FHIR Server (Java/Spring Boot)│
│  - JPA-based FHIR storage           │
│  - Built-in search, validation      │
│  - Compartments, versioning         │
│  - SMART on FHIR support            │
└─────────────────┬───────────────────┘
                  ↑
                  │
    ┌─────────────┴─────────────┐
    │                           │
┌───▼────────────────┐  ┌──────▼─────────────────┐
│ PostgreSQL         │  │ Python Services        │
│ - HAPI JPA schema  │  │ - fhirclient library   │
│ - 100+ tables      │  │ - CDS Hooks (FastAPI)  │
└────────────────────┘  │ - Clinical Catalogs    │
                        │ - WebSocket Events     │
                        │ - Pharmacy Workflows   │
                        └────────────────────────┘
```

---

## Technology Stack Changes

| Component | Current | Target | Change Type |
|-----------|---------|--------|-------------|
| **FHIR Backend** | Custom Python/FastAPI | HAPI FHIR (Java/Spring Boot) | Complete Replacement |
| **FHIR Database** | Custom PostgreSQL (6 tables) | HAPI JPA (100+ tables) | Schema Rebuild |
| **Python FHIR Access** | Direct DB queries | `fhirclient` library | API-based |
| **Frontend FHIR Client** | Custom `fhirClient.js` | `fhir.js` (SMART) | Library Replacement |
| **Data Source** | Existing Synthea | Fresh Synthea import | Clean Import |

---

## Migration Phases

### Phase 1: HAPI FHIR Setup (1-2 weeks)

**Objective**: Deploy HAPI FHIR server and load fresh Synthea data

**Tasks**:
1. ✅ Create branch `experimental/hapi-fhir-migration` from `fhir-native-redesign`
2. Add HAPI FHIR JPA Server
   - Create `backend/hapi-fhir/` directory
   - Set up Spring Boot application
   - Configure HAPI FHIR JPA dependencies
   - Configure PostgreSQL datasource
3. Docker configuration
   - Add `hapi-fhir` service to `docker-compose.yml`
   - Configure Java/Spring Boot container
   - Set up PostgreSQL for HAPI schema
4. Data import
   - Generate fresh Synthea FHIR bundles (20-50 patients)
   - Create import script for HAPI FHIR
   - Validate data loaded correctly
5. Testing
   - Verify FHIR endpoint: `http://localhost:8080/fhir/R4/Patient`
   - Test search parameters
   - Verify compartments created

**Deliverables**:
- `backend/hapi-fhir/` with Spring Boot application
- Updated `docker-compose.yml` with HAPI FHIR service
- Data import scripts for Synthea → HAPI FHIR
- FHIR endpoint operational and tested

---

### Phase 2: Python Services Migration (2-3 weeks)

**Objective**: Refactor all Python services to use `fhirclient` instead of direct DB access

#### 2.1 Install fhirclient
```bash
# Add to backend/requirements.txt
fhirclient==4.2.0

# Install
pip install fhirclient
```

#### 2.2 Create FHIR Client Configuration
**File**: `backend/services/fhir_client_config.py`
```python
from fhirclient import client

# HAPI FHIR server settings
settings = {
    'app_id': 'wintehr_clinical_services',
    'api_base': 'http://hapi-fhir:8080/fhir/R4'  # Docker service name
}

def get_fhir_client():
    """Get configured FHIR client instance"""
    return client.FHIRClient(settings=settings)
```

#### 2.3 Migrate CDS Hooks Service
**Current**: Direct PostgreSQL queries
**Target**: fhirclient API calls

**Files to Update**:
- `backend/api/clinical/cds_service.py`
- `backend/api/clinical/cds_hooks.py`

**Example Migration**:
```python
# BEFORE (Direct DB)
from backend.fhir.core.storage import FHIRStorageEngine
storage = FHIRStorageEngine()
patient = await storage.get_resource("Patient", patient_id)

# AFTER (fhirclient)
from fhirclient.models.patient import Patient
from backend.services.fhir_client_config import get_fhir_client

smart = get_fhir_client()
patient = Patient.read(patient_id, smart.server)
```

**Key Changes**:
- Replace `storage.get_resource()` → `Resource.read(id, server)`
- Replace `storage.search()` → `Resource.where(struct={'param': 'value'}).perform_resources(server)`
- Replace SQL aggregation with FHIR search + Python aggregation

#### 2.4 Migrate Clinical Catalog Service
**File**: `backend/services/cdsClinicalDataService.py`

**Current**: SQL queries for medication/lab catalogs
**Target**: FHIR search aggregation

```python
# BEFORE
async def get_medication_catalog():
    # Complex SQL joins
    query = "SELECT DISTINCT medication_code FROM ..."

# AFTER
from fhirclient.models.medicationrequest import MedicationRequest

def get_medication_catalog(smart):
    # Search all medication requests
    search = MedicationRequest.where(struct={})
    medications = search.perform_resources(smart.server)

    # Extract unique medications
    catalog = {}
    for med_req in medications:
        if med_req.medicationCodeableConcept:
            code = med_req.medicationCodeableConcept.coding[0]
            catalog[code.code] = code.display
    return catalog
```

#### 2.5 Migrate WebSocket Event Service
**File**: `backend/api/websocket.py`

**Change**: Use fhirclient to fetch data for event payloads

```python
# Event payload generation
from fhirclient.models.medicationrequest import MedicationRequest

async def send_order_event(order_id: str):
    smart = get_fhir_client()
    order = MedicationRequest.read(order_id, smart.server)

    await broadcast_event({
        'type': 'ORDER_PLACED',
        'orderId': order.id,
        'patientId': order.subject.reference.split('/')[-1],
        'medication': order.medicationCodeableConcept.text,
        'timestamp': order.authoredOn.isostring
    })
```

#### 2.6 Migrate Pharmacy Service
**File**: `backend/api/pharmacy.py`

**Key Changes**:
- Create MedicationDispense via fhirclient
- Search for pending prescriptions
- Update order status

```python
from fhirclient.models.medicationdispense import MedicationDispense

async def dispense_medication(request_id: str, lot_number: str):
    smart = get_fhir_client()

    # Create dispense record
    dispense = MedicationDispense()
    dispense.status = 'completed'
    dispense.medicationReference = {'reference': f'MedicationRequest/{request_id}'}
    # ... set other fields

    dispense.create(smart.server)
    return dispense
```

**Deliverables**:
- All Python services using `fhirclient`
- No direct database access
- Updated service configurations
- Integration tests passing

---

### Phase 3: Frontend Migration (1-2 weeks)

**Objective**: Replace custom `fhirClient.js` with `fhir.js` SMART client

#### 3.1 Install Dependencies
```bash
cd frontend
npm install fhirclient
```

#### 3.2 Create FHIR Client Configuration
**File**: `frontend/src/core/fhir/fhirClient.js` (replace existing)
```javascript
import FHIR from 'fhirclient';

// HAPI FHIR server configuration
const fhirConfig = {
  serverUrl: process.env.REACT_APP_FHIR_BASE_URL || 'http://localhost:8080/fhir/R4',
  // For development, no auth required
  // For production, add SMART auth configuration
};

// Create client instance
export const fhirClient = FHIR.client(fhirConfig);

// Helper functions
export const searchResources = async (resourceType, params) => {
  return await fhirClient.request({
    url: `${resourceType}?${new URLSearchParams(params)}`
  });
};

export const getResource = async (resourceType, id) => {
  return await fhirClient.request(`${resourceType}/${id}`);
};

export const createResource = async (resource) => {
  return await fhirClient.request({
    url: resource.resourceType,
    method: 'POST',
    body: JSON.stringify(resource),
    headers: { 'Content-Type': 'application/fhir+json' }
  });
};

export const updateResource = async (resource) => {
  return await fhirClient.request({
    url: `${resource.resourceType}/${resource.id}`,
    method: 'PUT',
    body: JSON.stringify(resource),
    headers: { 'Content-Type': 'application/fhir+json' }
  });
};
```

#### 3.3 Update FHIR Context
**File**: `frontend/src/core/fhir/contexts/FHIRContext.js`

```javascript
import { fhirClient, searchResources, getResource } from '../fhirClient';

export const FHIRContext = createContext({
  client: fhirClient,
  searchResources,
  getResource,
  // ... other methods
});
```

#### 3.4 Update Clinical Components
**Files to Update**:
- `frontend/src/components/clinical/workspace/tabs/ChartReviewTabOptimized.js`
- `frontend/src/components/clinical/workspace/tabs/EnhancedOrdersTab.js`
- `frontend/src/components/clinical/workspace/tabs/PharmacyTab.js`
- `frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js`
- All other components using FHIR data

**Migration Pattern**:
```javascript
// BEFORE (Custom client)
import { fhirService } from '@/services/fhirService';
const conditions = await fhirService.searchConditions(patientId);

// AFTER (fhir.js)
import { searchResources } from '@/core/fhir/fhirClient';
const bundle = await searchResources('Condition', {
  patient: `Patient/${patientId}`,
  'clinical-status': 'active'
});
const conditions = bundle.entry?.map(e => e.resource) || [];
```

#### 3.5 Handle Response Format Differences
HAPI FHIR returns standard FHIR Bundles - update code expecting custom formats:

```javascript
// Handle FHIR Bundle structure
const parseFHIRBundle = (bundle) => {
  if (!bundle || !bundle.entry) return [];
  return bundle.entry.map(entry => entry.resource);
};

// Usage
const bundle = await searchResources('Observation', params);
const observations = parseFHIRBundle(bundle);
```

**Deliverables**:
- `fhir.js` integrated
- All components using new client
- Custom `fhirClient.js` removed
- UI functionality preserved
- E2E tests passing

---

### Phase 4: Integration & Testing (1 week)

**Objective**: Validate complete system functionality

#### 4.1 End-to-End Testing
- [ ] Patient search and selection
- [ ] Chart Review tab - problems, meds, allergies, vitals
- [ ] Orders tab - CPOE, order placement, status tracking
- [ ] Results tab - lab results, trends
- [ ] Pharmacy dashboard - prescription queue, dispensing
- [ ] Imaging tab - DICOM viewer integration

#### 4.2 CDS Hooks Validation
- [ ] Drug-drug interaction checking
- [ ] Allergy checking
- [ ] Duplicate order detection
- [ ] Clinical decision support rules firing correctly

#### 4.3 Real-Time Events Testing
- [ ] WebSocket connection established
- [ ] Order events broadcast correctly
- [ ] Result events received
- [ ] UI updates in real-time

#### 4.4 Performance Testing
- [ ] Page load times acceptable
- [ ] Search response times < 500ms
- [ ] Bundle loading efficient
- [ ] No memory leaks in long-running sessions

#### 4.5 Data Validation
- [ ] All resource types loaded correctly
- [ ] References preserved (Patient → Condition, etc.)
- [ ] Search parameters indexed
- [ ] Compartments working (Patient/$everything)

**Deliverables**:
- All tests passing
- Performance benchmarks met
- Data integrity validated
- System ready for evaluation

---

## File Changes Checklist

### New Files to Create
- [ ] `backend/hapi-fhir/pom.xml` - Maven configuration
- [ ] `backend/hapi-fhir/src/main/java/...` - Spring Boot application
- [ ] `backend/hapi-fhir/application.yml` - HAPI FHIR configuration
- [ ] `backend/services/fhir_client_config.py` - fhirclient setup
- [ ] `backend/scripts/import_synthea_to_hapi.py` - Data import script
- [ ] `docker/hapi-fhir.Dockerfile` - HAPI FHIR container
- [ ] `docs/HAPI_FHIR_SETUP.md` - Setup guide

### Files to Modify (Backend)
- [ ] `backend/requirements.txt` - Add `fhirclient==4.2.0`
- [ ] `backend/api/clinical/cds_service.py` - Use fhirclient
- [ ] `backend/api/clinical/cds_hooks.py` - Use fhirclient
- [ ] `backend/services/cdsClinicalDataService.py` - Use fhirclient
- [ ] `backend/api/websocket.py` - Use fhirclient for events
- [ ] `backend/api/pharmacy.py` - Use fhirclient for dispense
- [ ] `docker-compose.yml` - Add HAPI FHIR service

### Files to Modify (Frontend)
- [ ] `frontend/package.json` - Add `fhirclient`
- [ ] `frontend/src/core/fhir/fhirClient.js` - Complete rewrite with fhir.js
- [ ] `frontend/src/core/fhir/contexts/FHIRContext.js` - Update context
- [ ] `frontend/src/components/clinical/workspace/tabs/ChartReviewTabOptimized.js`
- [ ] `frontend/src/components/clinical/workspace/tabs/EnhancedOrdersTab.js`
- [ ] `frontend/src/components/clinical/workspace/tabs/PharmacyTab.js`
- [ ] `frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js`
- [ ] All components importing `fhirService` or `fhirClient`

### Files to Delete
- [ ] `backend/fhir/core/storage.py` - Custom FHIR storage (eventually)
- [ ] `backend/fhir/core/search.py` - Custom search (eventually)
- [ ] `backend/fhir/core/validation.py` - Custom validation (eventually)
- [ ] `backend/scripts/setup/init_database_definitive.py` - Custom DB init (eventually)
- [ ] All custom FHIR backend infrastructure

---

## Docker Configuration

### Updated docker-compose.yml
```yaml
services:
  # HAPI FHIR Server (NEW)
  hapi-fhir:
    build:
      context: ./docker
      dockerfile: hapi-fhir.Dockerfile
    ports:
      - "8080:8080"
    environment:
      - SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/hapi_fhir
      - SPRING_DATASOURCE_USERNAME=hapi_user
      - SPRING_DATASOURCE_PASSWORD=hapi_password
      - HAPI_FHIR_VERSION=R4
    depends_on:
      - postgres
    networks:
      - emr-network

  # Python Backend (MODIFIED - now uses fhirclient)
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - FHIR_BASE_URL=http://hapi-fhir:8080/fhir/R4
    depends_on:
      - hapi-fhir
    networks:
      - emr-network

  # Frontend (MODIFIED - now uses fhir.js)
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_FHIR_BASE_URL=http://localhost:8080/fhir/R4
    depends_on:
      - hapi-fhir
    networks:
      - emr-network

  # PostgreSQL (MODIFIED - HAPI schema)
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=hapi_fhir
      - POSTGRES_USER=hapi_user
      - POSTGRES_PASSWORD=hapi_password
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - emr-network

networks:
  emr-network:

volumes:
  postgres-data:
```

---

## Success Criteria

### Functional Requirements
- [ ] All clinical workflows operational (Chart Review, Orders, Results, Pharmacy, Imaging)
- [ ] CDS Hooks firing correctly for all rules
- [ ] Real-time WebSocket events working
- [ ] DICOM imaging integration preserved
- [ ] Clinical catalogs generating from HAPI FHIR data

### Technical Requirements
- [ ] HAPI FHIR serving all FHIR operations
- [ ] No direct database access in Python services
- [ ] Frontend using fhir.js exclusively
- [ ] All FHIR resources searchable
- [ ] Patient compartments working

### Performance Requirements
- [ ] Search response times < 500ms
- [ ] Page load times < 2 seconds
- [ ] Bundle loading efficient (< 1 second for patient data)
- [ ] No memory leaks or performance degradation

### Data Integrity
- [ ] All 38 resource types loaded to HAPI FHIR
- [ ] References preserved correctly
- [ ] Search parameters indexed automatically
- [ ] Data validation passing

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| HAPI FHIR performance issues | High | Medium | Benchmark early, optimize queries, use caching |
| fhirclient API limitations | Medium | Low | Test thoroughly, have fallback to REST API |
| Frontend migration complexity | Medium | Medium | Incremental migration, component-by-component |
| Data import issues | High | Low | Validate early, test with subset first |
| Java/Spring Boot learning curve | Low | Medium | Use HAPI FHIR starter, minimal customization |

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: HAPI FHIR Setup | 1-2 weeks | None |
| Phase 2: Python Services | 2-3 weeks | Phase 1 complete |
| Phase 3: Frontend Migration | 1-2 weeks | Phase 1 complete |
| Phase 4: Integration & Testing | 1 week | Phases 2 & 3 complete |
| **Total** | **5-8 weeks** | - |

---

## Next Steps

1. **Immediate Actions** (This Week):
   - [ ] Set up HAPI FHIR JPA Server in `backend/hapi-fhir/`
   - [ ] Configure Docker for HAPI FHIR service
   - [ ] Generate fresh Synthea FHIR bundles
   - [ ] Test data import to HAPI FHIR

2. **Week 2-3**:
   - [ ] Migrate CDS Hooks service to fhirclient
   - [ ] Migrate clinical catalog service
   - [ ] Test Python services with HAPI FHIR

3. **Week 4-5**:
   - [ ] Migrate frontend to fhir.js
   - [ ] Update all clinical components
   - [ ] E2E testing

4. **Week 6**:
   - [ ] Final integration testing
   - [ ] Performance optimization
   - [ ] Documentation updates

---

## References

- **HAPI FHIR**: https://hapifhir.io/
- **HAPI FHIR GitHub**: https://github.com/hapifhir/hapi-fhir
- **fhirclient (Python)**: https://github.com/smart-on-fhir/client-py
- **fhir.js (JavaScript)**: https://github.com/FHIR/fhir.js
- **SMART on FHIR**: https://docs.smarthealthit.org/
- **FHIR R4 Spec**: https://www.hl7.org/fhir/R4/

---

**Document Version**: 1.0
**Last Updated**: 2025-10-04
**Author**: AI-assisted migration planning
**Status**: Ready for Implementation
