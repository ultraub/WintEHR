# CLAUDE.md - MedGenEMR Quick Reference

**Status**: FHIR-Native EMR | React + FastAPI | PostgreSQL  
**Updated**: 2025-01-06  
**Architecture**: Comprehensive Clinical Workflow System with Real-Time Integration

## 🚀 Quick Start

```bash
# Start system
./start.sh

# Common issues
docker-compose down -v  # Reset if errors
cd frontend && npm install  # Fix missing deps

# Authentication modes
export JWT_ENABLED=false  # Simple training auth (default)
export JWT_ENABLED=true   # JWT authentication (optional)

# Check system status
curl http://localhost:8000/api/auth/config  # Auth configuration
curl http://localhost:8000/fhir/R4/Patient  # FHIR endpoints
```

## ⛔ Critical Rules

### 1. Data Requirements
**DO**:
- ✅ Use ONLY Synthea-generated FHIR data
- ✅ Test with multiple patients  
- ✅ Handle missing/null data gracefully

**DON'T**:
- ❌ Create test patients (John Doe, etc.)
- ❌ Hardcode IDs or mock data
- ❌ Use array indexes for data access

### 2. Implementation Standards  
**DO**:
- ✅ Complete ALL features end-to-end
- ✅ Implement error handling & loading states
- ✅ Follow existing component patterns

**DON'T**:
- ❌ Leave TODOs or console.log() placeholders
- ❌ Skip validation or error cases
- ❌ Create partial implementations

### 3. Development Process
**DO**:
- ✅ Check TodoRead before starting
- ✅ Review PROJECT_INTEGRITY_GUIDE.md for errors
- ✅ Update TodoWrite frequently  

**DON'T**:
- ❌ Skip documentation updates
- ❌ Ignore build file validation after 3+ changes
- ❌ Commit without user request

### 4. File Creation Standards
**DO**:
- ✅ Use Unix line endings (LF) for all scripts
- ✅ Set executable permissions: `chmod +x script.sh`
- ✅ Test scripts on macOS/Linux before committing

**DON'T**:
- ❌ Create files with Windows line endings (CRLF)
- ❌ Use `\r\n` line endings in shell scripts
- ❌ Skip testing executable scripts

## 📍 Current State

### Core Infrastructure
- **Frontend**: 30+ FHIR-native components with **FULL CRUD OPERATIONS**
- **Backend**: Complete FHIR R4 API with CREATE/READ/UPDATE/DELETE endpoints  
- **FHIR Service**: Real-time database operations via `fhirService.js`
- **Search Integration**: Live search across conditions, medications, allergies, lab tests
- **Clinical Workspace**: **FULLY FUNCTIONAL** EMR with real data persistence
- **Cross-Module Integration**: Event-driven workflow orchestration via `ClinicalWorkflowContext`
- **Authentication**: Dual-mode auth (simple training + optional JWT)

### Clinical Modules (All Fully Implemented)
- **Chart Review**: Complete problem list management with CRUD operations
- **Results**: Lab trends with reference ranges, abnormal highlighting, multi-year data
- **Medications**: Full prescription workflow with medication resolution  
- **Orders**: Comprehensive ordering system with status tracking
- **Encounters**: Summary views with expandable clinical details
- **Pharmacy**: Complete dispensing workflow with queue management  
- **Imaging**: DICOM viewer with real image loading and multi-slice support
- **Care Planning**: Integration with problem-based order sets

### API Endpoints
- **FHIR CRUD**: `/fhir/R4/{resourceType}/` (All operations implemented)
- **Clinical Search**: `/api/emr/clinical/catalog/`
- **Pharmacy Workflows**: `/api/pharmacy/`
- **DICOM Services**: `/api/dicom/`
- **Authentication**: `/api/auth/` (dual-mode support)

### Data & Integration
- **Resources**: 20,115+ Synthea FHIR resources (10+ patients) with full support
- **Imaging**: DICOM study generation with realistic multi-slice datasets
- **Pharmacy**: MedicationDispense FHIR resource creation
- **Real-Time**: WebSocket support for clinical notifications
- **Search**: Advanced indexing with reference parameter resolution

## 🔧 Common Tasks

### Fix Data Display Issues
```javascript
// ✅ CORRECT - fhirClient format
const result = await fhirClient.search('Condition', {patient: id});
const conditions = result.resources || [];  // NOT result.entry

// ✅ CORRECT - Render FHIR objects safely  
<Typography>
  {condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}
</Typography>
```

### Add New Component
1. Create in `/src/components/clinical/workspace/tabs/` for workspace tabs
2. Use hooks from `/src/hooks/useFHIRResources.js` 
3. Follow pattern from existing tabs (SummaryTab, ChartReviewTab, etc.)
4. Update `FRONTEND_REDESIGN_TRACKER.md` and `WORKSPACE_REDESIGN_PLAN.md`

### Handle Icon Imports
```javascript
// ✅ CORRECT
import { Warning as WarningIcon } from '@mui/icons-material';
// ❌ WRONG  
import { Warning as WarningIcon } from '@mui/material';
```

### Real FHIR Operations
```javascript
// ✅ CORRECT - Use fhirService for all operations
import fhirService from '../services/fhirService';

// Create new condition
const condition = await fhirService.createCondition(conditionData);

// Update existing condition  
const updated = await fhirService.updateCondition(id, updatedData);

// Delete condition (soft delete)
await fhirService.deleteCondition(id);

// Automatically refreshes UI via context
await fhirService.refreshPatientResources(patientId);
```

### Search Integration
```javascript
// ✅ CORRECT - Use searchService for catalog searches
import { searchService } from '../services/searchService';

// Search conditions with live results
const conditions = await searchService.searchConditions('diabetes', 20);

// Search medications with catalog fallback
const medications = await searchService.searchMedications('lisinopril', 10);

// Universal search across all catalogs
const results = await searchService.searchAll('heart', 5);
```

### Medication Resolution
```javascript
// ✅ CORRECT - Use useMedicationResolver hook
import { useMedicationResolver } from '../hooks/useMedicationResolver';
const { getMedicationDisplay } = useMedicationResolver(medications);
// Handles both reference-based and concept-based medications
<Typography>{getMedicationDisplay(medicationRequest)}</Typography>
```

### Cross-Module Workflow Integration
```javascript
// ✅ CORRECT - Use ClinicalWorkflowContext for cross-tab communication
import { useClinicalWorkflow } from '../contexts/ClinicalWorkflowContext';

const { publish, subscribe, CLINICAL_EVENTS } = useClinicalWorkflow();

// Publish events to other tabs
await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);
await publish(CLINICAL_EVENTS.RESULT_RECEIVED, resultData);

// Subscribe to events from other tabs
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.MEDICATION_DISPENSED, (data) => {
    // Handle pharmacy notification in chart review tab
    updateMedicationStatus(data);
  });
  return unsubscribe;
}, []);
```

### DICOM Imaging Integration
```javascript
// ✅ CORRECT - Use DICOMViewer component with real image loading
import DICOMViewer from '../imaging/DICOMViewer';

// Load DICOM studies with proper metadata
const studies = await fhirService.getImagingStudies(patientId);
<DICOMViewer 
  study={selectedStudy} 
  onSeriesChange={handleSeriesChange}
  onImageNavigate={handleImageNavigate}
/>
```

### Pharmacy Workflow Management
```javascript
// ✅ CORRECT - Complete pharmacy workflow with MedicationDispense creation
import { pharmacyService } from '../services/pharmacyService';

// Create medication dispense with proper FHIR resource
const dispense = await pharmacyService.dispenseMedication({
  medicationRequestId: request.id,
  quantity: { value: 30, unit: 'tablets' },
  daysSupply: 30,
  status: 'completed'
});

// Automatically updates clinical context and notifies other tabs
```

## 🐛 Error Quick Fixes

| Error | Fix |
|-------|-----|
| `export 'X' not found` | Import from `@mui/icons-material` |
| `Objects are not valid as React child` | Extract text: `obj?.text \|\| obj?.coding?.[0]?.display` |
| `conditions.filter is not a function` | Use `conditions.activeConditions` |
| Missing clinical data | Check `fhir` schema, use `result.resources` |
| Medications showing "Unknown medication" | Use `useMedicationResolver` hook, handles both reference and concept types |
| `bad interpreter: /bin/bash^M` | Fix line endings: `sed -i '' 's/\r$//' script.sh` |
| Pillow build fails on Python 3.13 | Use `pillow>=10.3.0` in requirements.txt |
| asyncpg build fails on Python 3.13 | Use `asyncpg>=0.30.0` in requirements.txt |
| cmake not found for pylibjpeg | Install cmake: `brew install cmake` |
| pylibjpeg-openjpeg CMake error | Comment out `pylibjpeg-openjpeg` in requirements.txt |

## 📁 Key Files

### Frontend Core Services
- **FHIR Service**: `/src/services/fhirService.js` - Real FHIR CRUD operations
- **Search Service**: `/src/services/searchService.js` - Clinical catalog search  
- **Pharmacy Service**: `/src/services/pharmacyService.js` - Medication dispensing workflows
- **DICOM Service**: `/src/services/dicomService.js` - Medical imaging operations

### Context Providers
- **FHIR Resources**: `/src/contexts/FHIRResourceContext.js` - Auto-refresh & caching
- **Clinical Workflow**: `/src/contexts/ClinicalWorkflowContext.js` - Cross-module communication
- **Authentication**: `/src/contexts/AuthContext.js` - Dual-mode auth support
- **WebSocket**: `/src/contexts/WebSocketContext.js` - Real-time notifications

### Hooks & Utilities
- **FHIR Resources**: `/src/hooks/useFHIRResources.js` - Resource management
- **Medication Resolver**: `/src/hooks/useMedicationResolver.js` - Medication display resolution
- **Clinical Workflow**: `/src/hooks/useClinicalWorkflow.js` - Workflow integration

### Clinical Workspace Components
- **Workspace V3**: `/src/components/clinical/ClinicalWorkspaceV3.js` - Main clinical interface
- **Chart Review**: `/src/components/clinical/workspace/tabs/ChartReviewTab.js` - Problem management
- **Results Tab**: `/src/components/clinical/workspace/tabs/ResultsTab.js` - Lab trends with ranges
- **Orders Tab**: `/src/components/clinical/workspace/tabs/OrdersTab.js` - Order management
- **Pharmacy Tab**: `/src/components/clinical/workspace/tabs/PharmacyTab.js` - Dispensing workflows
- **Imaging Tab**: `/src/components/clinical/workspace/tabs/ImagingTab.js` - DICOM viewer integration
- **Encounters Tab**: `/src/components/clinical/workspace/tabs/EncountersTab.js` - Encounter summaries

### Clinical Dialogs & Forms
- **Problem Management**: 
  - `AddProblemDialog.js` - Create conditions with catalog search
  - `EditProblemDialog.js` - Edit/delete conditions with full CRUD
- **Medication Management**:
  - `PrescribeMedicationDialog.js` - Create medication requests
  - `AddAllergyDialog.js` - Create allergy intolerances
- **Encounter Management**:
  - `EncounterSummaryDialog.js` - Comprehensive encounter details

### Specialized Components
- **Lab Charts**: `/src/components/clinical/charts/LabTrendsChart.js` - Multi-year trends
- **DICOM Viewer**: `/src/components/clinical/imaging/DICOMViewer.js` - Real DICOM display
- **Medication Components**: `/src/components/clinical/medications/` - Prescription workflows

### Backend API Layer
- **FHIR Router**: `/backend/api/fhir/fhir_router.py` - Complete FHIR R4 implementation
- **FHIR Operations**: `/backend/core/fhir/operations.py` - All FHIR operations ($validate, $expand, etc.)
- **FHIR Search**: `/backend/core/fhir/search.py` - Advanced search with reference resolution
- **Clinical Search**: `/backend/api/clinical/catalog_search.py` - Clinical catalog endpoints
- **Pharmacy APIs**: `/backend/api/clinical/pharmacy/` - Medication dispensing services
- **DICOM Services**: `/backend/api/dicom/dicom_service.py` - Medical imaging APIs
- **Enhanced Auth**: `/backend/api/auth_enhanced.py` - Dual-mode authentication

### Database & Infrastructure
- **FHIR Storage**: `/backend/core/fhir/storage.py` - PostgreSQL FHIR storage engine
- **Search Indexing**: `/backend/core/fhir/search_indexer.py` - Search parameter indexing
- **Data Scripts**: `/backend/scripts/synthea_master.py` - Complete data management
- **Imaging Enhancement**: `/backend/scripts/enhance_imaging_import.py` - DICOM study creation

### Documentation & Configuration
- **System Architecture**: `docs/SYSTEM_ARCHITECTURE.md` - Complete architecture documentation
- **Quick Reference**: `CLAUDE.md` - Developer quick reference guide
- **Error Patterns**: `PROJECT_INTEGRITY_GUIDE.md` - Common issues & solutions
- **API Reference**: `docs/API_ENDPOINTS.md` - Complete API documentation
- **Workflow Integration**: `docs/CLINICAL_WORKSPACE_BUTTON_INTEGRATION_PLAN.md`
- **Frontend Tracking**: `docs/FRONTEND_REDESIGN_TRACKER.md` - Component status

## 🧪 Testing & Data Management

```bash
# Backend FHIR tests
docker exec emr-backend pytest tests/test_fhir_endpoints.py -v

# Complete Synthea workflow (recommended)
cd backend && python scripts/synthea_master.py full --count 10

# Individual operations  
python scripts/synthea_master.py setup                    # Setup Synthea
python scripts/synthea_master.py generate --count 20      # Generate patients
python scripts/synthea_master.py wipe                     # Clear database
python scripts/synthea_master.py import --validation-mode light  # Import with validation
python scripts/synthea_master.py validate                 # Validate existing data

# Advanced workflows
python scripts/synthea_master.py full --count 50 --validation-mode strict --include-dicom

# Debug data issues
- Check FHIR resource endpoints: http://localhost:8000/fhir/R4/Patient
- Verify resource counts: http://localhost:8000/fhir/R4/Medication
- Test search endpoints: http://localhost:8000/api/emr/clinical/catalog/conditions/search?query=diabetes
- Test CRUD operations: POST/PUT/DELETE /fhir/R4/Condition/{id}
- Review medication references resolve correctly
```

## 🔄 Clinical Workflow Patterns

### Complete Order-to-Result Workflow
1. **Order Placement**: Orders Tab → Create ServiceRequest → Auto-index → Pending status
2. **Result Creation**: Lab system → Create Observation → Reference original order
3. **Abnormal Detection**: ClinicalWorkflowContext → Check reference ranges → Create alert
4. **Cross-tab Notification**: Publish RESULT_RECEIVED → Subscribe handlers → Update UI
5. **Clinical Response**: Results Tab → Review abnormal → Suggest follow-up orders

### Medication Prescription-to-Dispense Workflow  
1. **Prescription**: Chart Review → PrescribeMedicationDialog → Create MedicationRequest
2. **Pharmacy Queue**: PharmacyTab → Load pending requests → Verification workflow
3. **Dispensing**: Pharmacy → Create MedicationDispense → Update request status
4. **Clinical Update**: Publish MED_DISPENSED → Chart Review subscribes → Update status
5. **Monitoring**: Auto-schedule monitoring labs based on medication type

### Imaging Order-to-Report Workflow
1. **Imaging Order**: Orders Tab → Create ServiceRequest (imaging) → DICOM study creation
2. **Study Available**: ImagingTab → Load ImagingStudy resources → DICOM viewer
3. **Image Review**: DICOMViewer → Multi-slice navigation → Windowing controls
4. **Report Creation**: Document findings → Link to original study → Clinical correlation

### Problem-Centered Care Planning
1. **Problem Addition**: Chart Review → AddProblemDialog → Create Condition
2. **Order Set Suggestion**: ClinicalWorkflowContext → Suggest relevant orders
3. **Care Goal Creation**: Auto-suggest care plan goals → Create CarePlan resources  
4. **Monitoring Setup**: Schedule appropriate monitoring → Create reminders
5. **Outcome Tracking**: Track problem resolution → Update clinical status

## 🏥 System Status & Health

### Current Implementation Status
- ✅ **Complete FHIR CRUD**: All resource types with full operations
- ✅ **Advanced Search**: Reference resolution, token indexing, date ranges
- ✅ **Clinical Workflows**: Order-result, prescription-dispense, imaging workflows
- ✅ **Cross-Module Integration**: Real-time event-driven communication
- ✅ **Authentication**: Dual-mode (simple training + optional JWT)
- ✅ **DICOM Support**: Real image loading with multi-slice viewer
- ✅ **Quality Features**: Reference ranges, abnormal highlighting, trend analysis
- ✅ **Real-time Notifications**: WebSocket support with clinical alerts

### Production Readiness
- **Training Environment**: ✅ Fully functional with Synthea data
- **FHIR Compliance**: ✅ Complete R4 implementation with validation
- **Clinical Accuracy**: ✅ Real medical workflows with proper FHIR resources
- **Integration Ready**: ✅ Standard APIs for external system integration
- **Scalability**: ✅ PostgreSQL with efficient indexing and caching
- **Security**: ✅ Role-based access with audit trails

## 📋 Session Checklist

**Before Starting**:
- [ ] Run TodoRead
- [ ] Check PROJECT_INTEGRITY_GUIDE.md  
- [ ] Verify system running: `./start.sh`
- [ ] Check auth mode: `curl http://localhost:8000/api/auth/config`

**During Work**:
- [ ] Use Synthea data only
- [ ] Test with multiple patients
- [ ] Update TodoWrite on progress
- [ ] Test cross-module workflows

**After Changes**:
- [ ] All features fully implemented
- [ ] No console errors or placeholders
- [ ] Test clinical workflows end-to-end
- [ ] Update relevant docs
- [ ] Run build validation if 3+ files changed