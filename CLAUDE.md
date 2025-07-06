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

- **Frontend**: 20+ FHIR-native components in `/src/components/clinical/`
- **Backend**: FHIR R4 API at `/fhir/R4/`, data in `fhir` schema
- **Resources**: 20,115 Synthea FHIR resources (10 patients) with full Medication support
- **FHIR Support**: Added Medication and Provenance resources to SUPPORTED_RESOURCES
- **Import System**: Unified Synthea import with validation modes for performance vs accuracy
- **Clinical Workspace**: NEW tab-based EMR interface (ClinicalWorkspaceV3) with 8 comprehensive tabs

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

## 🐛 Error Quick Fixes

| Error | Fix |
|-------|-----|
| `export 'X' not found` | Import from `@mui/icons-material` |
| `Objects are not valid as React child` | Extract text: `obj?.text \|\| obj?.coding?.[0]?.display` |
| `conditions.filter is not a function` | Use `conditions.activeConditions` |
| Missing clinical data | Check `fhir` schema, use `result.resources` |
| `bad interpreter: /bin/bash^M` | Fix line endings: `sed -i '' 's/\r$//' script.sh` |
| Pillow build fails on Python 3.13 | Use `pillow>=10.3.0` in requirements.txt |
| asyncpg build fails on Python 3.13 | Use `asyncpg>=0.30.0` in requirements.txt |
| cmake not found for pylibjpeg | Install cmake: `brew install cmake` |
| pylibjpeg-openjpeg CMake error | Comment out `pylibjpeg-openjpeg` in requirements.txt |

## 📁 Key Files

- **Hooks**: `/src/hooks/useFHIRResources.js`
- **Context**: `/src/contexts/FHIRResourceContext.js`
- **Components**: `/src/components/clinical/`
- **Workspace V3**: `/src/components/clinical/ClinicalWorkspaceV3.js`
- **Workspace Tabs**: `/src/components/clinical/workspace/tabs/`
- **Error Patterns**: `PROJECT_INTEGRITY_GUIDE.md`
- **API Reference**: `docs/API_ENDPOINTS.md`
- **Workspace Plan**: `frontend/src/components/clinical/workspace/WORKSPACE_REDESIGN_PLAN.md`

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
- Review medication references resolve correctly
- Add console.log to see actual data structure
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