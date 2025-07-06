# CLAUDE.md - MedGenEMR Quick Reference

**Status**: FHIR-Native EMR | React + FastAPI | PostgreSQL  
**Updated**: 2025-01-06  

## 🚀 Quick Start

```bash
# Start system
./start.sh

# Common issues
docker-compose down -v  # Reset if errors
cd frontend && npm install  # Fix missing deps
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

- **Frontend**: 20+ FHIR-native components with **FULL CRUD OPERATIONS** 
- **Backend**: Complete FHIR R4 API with CREATE/READ/UPDATE/DELETE endpoints
- **FHIR Service**: Real-time database operations via `fhirService.js`
- **Search Integration**: Live search across conditions, medications, allergies, lab tests
- **Clinical Workspace**: **FULLY FUNCTIONAL** EMR with real data persistence
- **API Endpoints**: 
  - FHIR CRUD: `/fhir/R4/{resourceType}/` 
  - Search: `/api/emr/clinical/catalog/`
- **Resources**: 20,115 Synthea FHIR resources (10 patients) with full support

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

### Frontend Core
- **FHIR Service**: `/src/services/fhirService.js` - Real FHIR CRUD operations
- **Search Service**: `/src/services/searchService.js` - Clinical catalog search
- **Context**: `/src/contexts/FHIRResourceContext.js` - Auto-refresh & caching
- **Hooks**: `/src/hooks/useFHIRResources.js`, `/src/hooks/useMedicationResolver.js`

### Clinical Components  
- **Workspace V3**: `/src/components/clinical/ClinicalWorkspaceV3.js`
- **Chart Review**: `/src/components/clinical/workspace/tabs/ChartReviewTab.js` 
- **Dialogs**: `/src/components/clinical/workspace/dialogs/`
  - `AddProblemDialog.js` - Create conditions with search
  - `EditProblemDialog.js` - Edit/delete conditions  
  - `PrescribeMedicationDialog.js` - Create medication requests
  - `AddAllergyDialog.js` - Create allergy intolerances

### Backend API
- **FHIR Router**: `/backend/api/fhir/fhir_router.py` - Full CRUD operations
- **Clinical Search**: `/backend/api/clinical/catalog_search.py` - Search endpoints
- **EMR Router**: `/backend/emr_api/clinical.py` - Extended clinical tools

### Documentation
- **Error Patterns**: `PROJECT_INTEGRITY_GUIDE.md`
- **API Reference**: `docs/API_ENDPOINTS.md`
- **Button Integration**: `docs/CLINICAL_WORKSPACE_BUTTON_INTEGRATION_PLAN.md`

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

## 📋 Session Checklist

**Before Starting**:
- [ ] Run TodoRead
- [ ] Check PROJECT_INTEGRITY_GUIDE.md
- [ ] Verify system running: `./start.sh`

**During Work**:
- [ ] Use Synthea data only
- [ ] Test with multiple patients
- [ ] Update TodoWrite on progress

**After Changes**:
- [ ] All features fully implemented
- [ ] No console errors
- [ ] Update relevant docs
- [ ] Run build validation if 3+ files changed