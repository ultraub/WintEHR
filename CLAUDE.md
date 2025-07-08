# CLAUDE.md - MedGenEMR Developer Guide

**Status**: Production-Ready FHIR-Native EMR  
**Stack**: React 18 + FastAPI + PostgreSQL + Docker  
**Architecture**: Event-Driven with Real-Time Integration  
**Standards**: FHIR R4, CDS Hooks 1.0, DICOM  
**Data**: 20,115+ Synthea Resources, 10+ Patients  
**Updated**: 2025-01-08

## 🎯 What This System Is

A **complete, production-ready EMR** with:
- ✅ Full FHIR R4 implementation (38 resource types)
- ✅ Complete clinical workflows (order-to-result, prescribe-to-dispense)
- ✅ Real-time WebSocket updates and event-driven architecture
- ✅ Sophisticated caching and progressive loading
- ✅ Dual-mode authentication (training + JWT)
- ✅ DICOM imaging with multi-slice viewer
- ✅ CDS Hooks with 10+ clinical rules

## 🚀 Quick Start Commands

```bash
# Start entire system
./start.sh

# Common troubleshooting
docker-compose down -v          # Full reset if errors
cd frontend && npm install      # Fix missing dependencies
docker-compose logs backend -f  # View backend logs

# Authentication modes
export JWT_ENABLED=false  # Training mode (default)
export JWT_ENABLED=true   # Production JWT mode

# Data management
cd backend && python scripts/synthea_master.py full --count 10
```

## ⛔ Critical Development Rules

### 1. Data Requirements
**ALWAYS**:
- ✅ Use ONLY Synthea-generated FHIR data (no mock data)
- ✅ Test with multiple real patients from the database
- ✅ Handle missing/null data gracefully
- ✅ Use `fhirService.js` for all FHIR operations

**NEVER**:
- ❌ Create test patients (John Doe, Jane Smith, etc.)
- ❌ Hardcode resource IDs or mock data
- ❌ Use array indexes for data access
- ❌ Skip validation or error handling

### 2. Implementation Standards
**ALWAYS**:
- ✅ Complete ALL features end-to-end (no TODOs)
- ✅ Implement loading states and error handling
- ✅ Follow existing component patterns
- ✅ Use Context + Reducer pattern for complex state

**NEVER**:
- ❌ Leave console.log() statements
- ❌ Create partial implementations
- ❌ Skip cross-module integration
- ❌ Ignore the event-driven architecture

### 3. Component Communication
**ALWAYS**:
- ✅ Use `ClinicalWorkflowContext` for cross-tab events
- ✅ Implement pub/sub for workflow orchestration
- ✅ Use `FHIRResourceContext` for data management
- ✅ Follow progressive loading patterns

**NEVER**:
- ❌ Direct component coupling
- ❌ Skip workflow notifications
- ❌ Bypass the caching layer
- ❌ Create redundant data fetching

## 📊 System Components

### Clinical Modules (Complete)
| Module | Features | Status |
|--------|----------|--------|
| **Chart Review** | Problems, medications, allergies, immunizations | ✅ CRUD + Export |
| **Results** | Lab trends, reference ranges, abnormal alerts | ✅ Real-time |
| **Orders** | Multi-category CPOE, status tracking | ✅ Workflow integration |
| **Pharmacy** | Queue management, dispensing, lot tracking | ✅ MedicationDispense |
| **Imaging** | DICOM viewer, multi-slice navigation | ✅ Study generation |
| **Encounters** | Summary views, clinical documentation | ✅ Timeline view |

### API Endpoints
- `/fhir/R4/{resourceType}` - Complete FHIR R4 REST API
- `/api/emr/clinical/` - Clinical services and catalogs
- `/cds-hooks/` - Clinical decision support (10+ rules)
- `/api/ws/` - WebSocket real-time updates
- `/api/dicom/` - Medical imaging services

## 🏗️ Core Architecture Patterns

### Frontend: Context + Events + Progressive Loading
```javascript
// 1. State Management: Context + Reducer
const { resources, loading } = useFHIRResource();

// 2. Cross-Module Communication: Event System
const { publish, subscribe } = useClinicalWorkflow();
await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);

// 3. Performance: Progressive Loading
// Critical → Important → Optional
await fetchPatientBundle(patientId, false, 'critical');
```

### Backend: Repository + Service + DI
```python
# Repository Pattern for data access
class FHIRStorageEngine:
    async def create_resource(self, resource_type: str, data: dict)

# Service Layer for business logic  
class PharmacyService:
    async def dispense_medication(self, data: dict)

# Dependency Injection via FastAPI
async def endpoint(storage: FHIRStorageEngine = Depends(get_storage)):
```

## 🔧 Common Implementation Tasks

### Adding New Clinical Feature
```javascript
// 1. Create component in appropriate location
src/components/clinical/workspace/tabs/NewFeatureTab.js

// 2. Use FHIR hooks for data
const { resources, loading } = usePatientResources(patient?.id, 'ResourceType');

// 3. Integrate with workflow context
const { publish, subscribe } = useClinicalWorkflow();
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.RELEVANT_EVENT, handleEvent);
  return unsubscribe;
}, []);

// 4. Implement CRUD with fhirService
await fhirService.createResource('ResourceType', resourceData);
await refreshPatientResources(patient.id);
```

### Handling FHIR References
```javascript
// ✅ CORRECT - Handle both formats
const patientRef = reference.startsWith('urn:uuid:') 
  ? reference.replace('urn:uuid:', '') 
  : reference.split('/')[1];

// ✅ CORRECT - Safe navigation
const medicationDisplay = medication?.code?.text || 
                         medication?.code?.coding?.[0]?.display || 
                         'Unknown medication';
```

### Cross-Module Workflow
```javascript
// ✅ CORRECT - Event-driven workflow
// In Orders Tab
await publish(CLINICAL_EVENTS.ORDER_PLACED, {
  orderId: order.id,
  type: 'laboratory',
  patient: patient.id
});

// In Results Tab (subscribes to event)
subscribe(CLINICAL_EVENTS.ORDER_PLACED, async (data) => {
  if (data.type === 'laboratory') {
    await createPendingResultPlaceholder(data);
  }
});
```

### WebSocket Real-time Updates
```javascript
// ✅ CORRECT - Subscribe to resource updates
import { useWebSocket } from '../contexts/WebSocketContext';

const { subscribe, unsubscribe, lastMessage } = useWebSocket();

// Subscribe to patient-specific updates
useEffect(() => {
  subscribe('patient-updates', ['Observation', 'Condition'], [patientId]);
  return () => unsubscribe('patient-updates');
}, [patientId]);

// Handle incoming messages
useEffect(() => {
  if (lastMessage?.data) {
    const message = JSON.parse(lastMessage.data);
    handleResourceUpdate(message);
  }
}, [lastMessage]);
```

### Export Clinical Data
```javascript
// ✅ CORRECT - Export data in multiple formats
import { exportClinicalData, EXPORT_COLUMNS } from '../utils/exportUtils';

exportClinicalData({
  patient: currentPatient,
  data: conditions,
  columns: EXPORT_COLUMNS.conditions,
  format: 'csv', // or 'json', 'pdf'
  title: 'Problem List',
  formatForPrint: formatConditionsForPrint
});
```

### Print Clinical Documents
```javascript
// ✅ CORRECT - Print formatted clinical documents
import { printDocument, formatLabResultsForPrint } from '../utils/printUtils';

printDocument({
  title: 'Lab Results Report',
  patient: patientInfo,
  content: formatLabResultsForPrint(labResults),
  footer: 'Printed from MedGenEMR'
});
```

### Data Migration
```javascript
// ✅ CORRECT - Run FHIR data migrations
import { MigrationManager } from '../utils/migrations';

const migrationManager = new MigrationManager();
const result = await migrationManager.migrateResource(resource);
if (result.success && result.changed) {
  // Handle migrated resource
  await fhirService.updateResource(resourceType, resource.id, result.resource);
}
```

### Clinical Catalog Search
```javascript
// ✅ CORRECT - Search clinical catalogs with caching
import { searchService } from '../services/searchService';

// Search for conditions
const conditions = await searchService.searchConditions('diabetes', 10);

// Search with allergen categories
const foodAllergies = await searchService.searchAllergens('peanut', 10, 'food');

// Universal search across all catalogs
const results = await searchService.searchAll('aspirin', 5);
```

### CDS Hooks Management
```javascript
// ✅ CORRECT - Create and manage custom CDS hooks
import { cdsHooksService } from '../services/cdsHooksService';

// Create new hook
const hookData = {
  id: 'custom-diabetes-check',
  title: 'Diabetes Screening Alert',
  hook: 'patient-view',
  conditions: [{type: 'age', operator: 'greater_than', value: 45}],
  cards: [{summary: 'Consider diabetes screening', indicator: 'warning'}]
};
await cdsHooksService.createHook(hookData);

// Test hook with patient context
const testResult = await cdsHooksService.testHook(hookData, {patientId});
```

## 🐛 Error Solutions

| Error | Solution |
|-------|----------|
| `export 'X' not found` | Import from `@mui/icons-material` not `@mui/material` |
| `Objects are not valid as React child` | Use `obj?.text \|\| obj?.coding?.[0]?.display` |
| `TypeError: Cannot read property of undefined` | Add optional chaining: `resource?.property?.value` |
| Medications show "Unknown" | Use `useMedicationResolver` hook |
| Missing patient data | Check `resources` not `result.entry` |
| CORS errors | Backend running? Check `docker-compose ps` |
| WebSocket connection fails | Check auth token validity, ensure JWT_ENABLED matches backend |
| Export fails with large datasets | Implement pagination or chunking for large exports |
| Print layout issues | Check print CSS media queries in printUtils.js |
| CDS hook validation errors | Ensure all required fields, check hook ID uniqueness |
| Migration fails | Check resource validation, ensure proper FHIR structure |
| Search service timeout | Check cache (5-min timeout), increase limit parameter |

## 📁 Critical Files to Know

### Frontend Core
```
src/services/fhirService.js          # FHIR CRUD operations
src/contexts/FHIRResourceContext.js  # Resource state management
src/contexts/ClinicalWorkflowContext.js # Cross-module events
src/hooks/useFHIRResources.js        # Data fetching hooks
src/hooks/useMedicationResolver.js   # Medication display logic
```

### Backend Core
```
backend/core/fhir/storage.py         # FHIR storage engine
backend/api/fhir/fhir_router.py      # FHIR R4 endpoints
backend/core/fhir/search.py          # Search implementation
backend/api/auth_enhanced.py         # Dual-mode auth
backend/scripts/synthea_master.py    # Data management
```

### Clinical Components
```
src/components/clinical/workspace/tabs/ChartReviewTab.js  # Problems/meds
src/components/clinical/workspace/tabs/ResultsTab.js      # Lab results
src/components/clinical/workspace/tabs/OrdersTab.js       # Order entry
src/components/clinical/workspace/tabs/PharmacyTab.js     # Dispensing
src/components/clinical/imaging/DICOMViewer.js           # Image viewer
```

### Utility Services
```
src/utils/printUtils.js              # Clinical document printing
src/utils/exportUtils.js             # Multi-format data export (CSV/JSON/PDF)
src/utils/migrations.js              # FHIR data migration framework
src/utils/fhirFormatters.js          # Resource display formatting
src/utils/fhirValidation.js          # Resource validation utilities
src/utils/intelligentCache.js        # Multi-level caching system
```

### Real-time & Integration Services
```
src/services/searchService.js        # Clinical catalog search with caching
src/services/websocket.js            # Raw WebSocket operations
src/contexts/WebSocketContext.js     # WebSocket React integration
src/services/cdsHooksClient.js       # CDS Hooks integration client
src/services/cdsHooksService.js      # Custom CDS hooks CRUD
src/services/providerService.js      # Provider management
src/services/vitalSignsService.js    # Vital signs operations
```

### CDS Components
```
src/components/clinical/cds/CDSHookManager.js    # Hook presentation modes
src/components/clinical/cds/CDSAlertsPanel.js    # Alert display
src/components/clinical/cds/CDSTestingPanel.js   # Hook testing UI
```

## 🧪 Testing Status

- **Backend**: ✅ Complete test coverage (pytest)
- **Frontend**: ❌ No tests (critical gap)
- **E2E**: ❌ No integration tests

```bash
# Run backend tests
docker exec emr-backend pytest tests/ -v
```

## 🚀 Deployment Options

```bash
# Local Development
./start.sh              # Start all services
./fresh-deploy.sh       # Clean start with sample data

# AWS Production
./deploy.sh             # Automated deployment (EC2, RDS, ALB)
```

## 📊 Data Management

### Synthea Integration
```bash
cd backend
python scripts/synthea_master.py full --count 10      # Complete workflow
python scripts/synthea_master.py generate --count 20  # Generate only
python scripts/synthea_master.py import               # Import to database
python scripts/synthea_master.py validate             # Validate data
```

### DICOM Generation
```bash
python scripts/generate_dicom_for_studies.py  # Create DICOM studies
# Generates multi-slice CT/MR studies linked to ImagingStudy resources
```

## 🔄 Workflow Patterns

### Order-to-Result Flow
1. **Order**: Create ServiceRequest → Publish ORDER_PLACED
2. **Lab System**: Create Observation → Link to order
3. **Results**: Check reference ranges → Publish RESULT_RECEIVED
4. **Alerts**: Abnormal detection → Create critical alerts
5. **Response**: Suggest follow-up → Update care plan

### Prescription-to-Dispense Flow
1. **Prescribe**: Create MedicationRequest → Notify pharmacy
2. **Queue**: PharmacyTab loads pending → Verify prescription
3. **Dispense**: Create MedicationDispense → Update status
4. **Notify**: Publish MEDICATION_DISPENSED → Update chart

## 💡 Performance & Caching

```javascript
// Multi-level caching with TTL
resources: 10min | searches: 5min | bundles: 15min | computed: 30min

// Progressive loading priority
critical: ['Condition', 'MedicationRequest', 'AllergyIntolerance']
important: ['Observation', 'Procedure', 'DiagnosticReport']
optional: ['CarePlan', 'CareTeam', 'DocumentReference']
```

## 🔒 Authentication

| Mode | Setting | Users | Features |
|------|---------|-------|----------|
| **Training** | `JWT_ENABLED=false` | demo/nurse/pharmacist/admin (all: password) | Simple auth |
| **Production** | `JWT_ENABLED=true` | Requires registration | JWT + bcrypt |

## 📋 Pre-Session Checklist

**Before ANY work**:
- [ ] System running: `docker-compose ps`
- [ ] Auth mode correct: `curl http://localhost:8000/api/auth/config`
- [ ] Data loaded: Check Patient count in UI
- [ ] No console errors in browser

**During development**:
- [ ] Using Synthea data only
- [ ] Following event-driven patterns
- [ ] Implementing complete features
- [ ] Testing with multiple patients

**Before completion**:
- [ ] No console.log() statements
- [ ] All CRUD operations work
- [ ] Cross-module events fire
- [ ] Error states handled

## 🎯 Known Gaps & Priorities

**Critical**: Frontend testing, E2E tests, Load testing  
**Medium**: Analytics dashboard, Mobile support  
**Future**: SMART on FHIR, AI integration

---

**Remember**: This is a production EMR. Patient safety and data integrity are paramount.

## 🤖 Automatic Documentation Protocol

FOR EVERY TASK:
1. When I mention a module/feature, automatically determine its directory
2. Read ALL .md files in that directory before starting
3. After implementation, update those same .md files
4. No exceptions - this is automatic

Documentation Locations:

### Architecture & Analysis
- System Architecture → `docs/architecture/overview.md`
- Gap Analysis → `docs/analysis/gap-analysis.md`
- Development Patterns → `docs/development/patterns.md`
- Current State Analysis → `docs/analysis/current-state.md`

### Module Documentation
- **Frontend Modules** → `docs/modules/frontend/`
  - Clinical Workspace → `clinical-workspace-module.md`
  - Services Layer → `services-module.md`
  - State Management → `contexts-module.md`
  - React Hooks → `hooks-module.md`
  - UI Components → `common-components-module.md`
- **Backend Modules** → `docs/modules/backend/`
  - FHIR API → `fhir-api-module.md`
  - Clinical Services → `clinical-services-module.md`
  - Authentication → `authentication-module.md`
  - Data Management → `data-management-module.md`
  - Core Infrastructure → `core-infrastructure-module.md`
- **Integration Guide** → `docs/modules/integration/cross-module-integration.md`

### API Documentation
- FHIR Endpoints → `docs/API_ENDPOINTS.md`
- Clinical Workflows → `docs/CLINICAL_WORKSPACE_BUTTON_INTEGRATION_PLAN.md`

### System Documentation
- System Architecture → `docs/SYSTEM_ARCHITECTURE.md`
- Frontend Redesign → `docs/FRONTEND_REDESIGN_TRACKER.md`
- Workspace Plan → `docs/WORKSPACE_REDESIGN_PLAN.md`
- Deployment Guide → `DEPLOYMENT.md`

### Component-Level Docs
- Clinical Tabs → Individual .md files in respective component directories
- Key Services → Individual README.md in service directories


## Session Management
- Start: Review this file and run system checks
- During: Follow patterns, update docs
- End: Update relevant documentation

- When starting a new session, always run: .claude/hooks/session-start.md