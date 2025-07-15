# Frontend Cleanup Candidates

## Summary
This document lists duplicate, unused, and test files that can be removed to clean up the frontend codebase.

## 1. Files with .original suffix (3 files)
These are backup copies that should be removed:
- `frontend/src/components/clinical/workspace/dialogs/CPOEDialog.original.js`
- `frontend/src/components/clinical/workspace/dialogs/EncounterCreationDialog.original.js`
- `frontend/src/components/clinical/imaging/ImagingReportDialog.original.js`

## 2. Example/Test Files (2 files)
These appear to be demonstration or test files not used in production:
- `frontend/src/components/search/SearchExample.js` - Demo component for search functionality
- `frontend/src/components/clinical/cds/CDSDismissalTest.js` - Test component

## 3. Major Duplicate Files
These files exist in both old and new locations. The old locations should be removed after verifying all imports use the new locations:

### FHIR-related duplicates:
- **OLD**: `frontend/src/contexts/FHIRResourceContext.js` (30KB)
- **NEW**: `frontend/src/core/fhir/contexts/FHIRResourceContext.js` (25KB)

- **OLD**: `frontend/src/utils/fhirFormatters.js`
- **NEW**: `frontend/src/core/fhir/utils/fhirFormatters.js`

- **OLD**: `frontend/src/utils/fhirSearchParams.js`
- **NEW**: `frontend/src/core/fhir/utils/fhirSearchParams.js`

- **OLD**: `frontend/src/hooks/useFHIRResources.js`
- **NEW**: `frontend/src/core/fhir/hooks/useFHIRResources.js`

- **OLD**: `frontend/src/hooks/useMedicationResolver.js`
- **NEW**: `frontend/src/core/fhir/hooks/useMedicationResolver.js`

### CDS Builder duplicates:
These appear to be duplicated between workspace and cds-studio:
- `frontend/src/components/clinical/workspace/cds/SuggestionBuilder.js`
- `frontend/src/components/cds-studio/build/cards/SuggestionBuilder.js`

- `frontend/src/components/clinical/workspace/cds/conditions/LabValueConditionBuilder.js`
- `frontend/src/components/cds-studio/build/conditions/LabValueConditionBuilder.js`

- `frontend/src/components/clinical/workspace/cds/conditions/MedicalConditionBuilder.js`
- `frontend/src/components/cds-studio/build/conditions/MedicalConditionBuilder.js`

- `frontend/src/components/clinical/workspace/cds/conditions/VitalSignConditionBuilder.js`
- `frontend/src/components/cds-studio/build/conditions/VitalSignConditionBuilder.js`

### Test utilities duplicates:
- `frontend/src/test-utils/test-utils.js`
- `frontend/src/tests/test-utils.js`

## 4. Empty Directories (3 directories)
These directories are completely empty and can be removed:
- `frontend/src/core/types`
- `frontend/src/core/utils`
- `frontend/src/core/services`

## 5. Single-file Directories
These directories contain only one file and might be candidates for consolidation:
- `frontend/src/test-utils` (only test-utils.js)
- `frontend/src/config` (only logging.js)
- `frontend/src/providers` (only AppProviders.js)
- `frontend/src/tests/integration` (only clinicalWorkflowIntegration.test.js)
- `frontend/src/components/theme` (1 file)
- `frontend/src/components/locations` (1 file)

## 6. Potentially Unused index.js Files
These index.js files should be checked if they're actually being imported:
- `frontend/src/components/fhir/fields/index.js`
- `frontend/src/components/base/index.js`

## Recommendations

1. **Immediate Removal** (Safe to delete):
   - All .original files
   - SearchExample.js and CDSDismissalTest.js
   - Empty directories

2. **Requires Import Update**:
   - Update all imports from old FHIR file locations to new core/fhir locations
   - Then remove the old duplicate files

3. **Requires Analysis**:
   - Determine which CDS builder files are actually used (workspace vs cds-studio)
   - Consolidate test-utils to single location
   - Review single-file directories for potential consolidation

## Import Migration Script
To help identify which files need import updates, run:
```bash
# Find imports of old FHIR files
grep -r "from.*'/contexts/FHIRResourceContext'" frontend/src
grep -r "from.*'/utils/fhir" frontend/src
grep -r "from.*'/hooks/useFHIR" frontend/src
grep -r "from.*'/hooks/useMedicationResolver'" frontend/src
```