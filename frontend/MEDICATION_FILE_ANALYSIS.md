# Medication File Analysis and Consolidation Plan

## Current State Analysis

### 1. File Categories and Locations

#### Core Hooks (2 locations - DUPLICATE)
- `/src/hooks/useMedicationResolver.js`
- `/src/core/fhir/hooks/useMedicationResolver.js`
- **Purpose**: Resolves medication references to display names
- **Status**: Duplicate - same functionality in two locations

#### Medication Management Components (2 locations - DUPLICATE)
Located in both `/src/features/medications/components/` and `/src/components/clinical/medications/`:
- `MedicationEffectivenessDialog.js` (duplicate)
- `MedicationDiscontinuationDialog.js` (duplicate)
- `MedicationReconciliation.js` (duplicate)
- `ClinicalSafetyPanel.js`
- `EffectivenessMonitoringPanel.js`
- `RefillManagement.js`
- `WorkflowValidationPanel.js`

#### Dialogs (3 locations - PARTIAL DUPLICATE)
- `/src/features/medications/dialogs/`:
  - `EditMedicationDialog.js`
  - `PrescribeMedicationDialog.js`
- `/src/components/clinical/workspace/dialogs/`:
  - `EditMedicationDialog.js` (duplicate)
  - `PrescribeMedicationDialog.js` (duplicate)
  - `MedicationReconciliationDialog.js` (unique)
  - `config/medicationDialogConfig.js`
  - `components/MedicationFormFields.js`

#### Pharmacy Components
- `/src/components/pharmacy/`:
  - `PharmacyQueue.js`
  - `PharmacyAnalytics.js`
- `/src/components/clinical/pharmacy/`:
  - `MedicationAdministrationRecord.js`
- `/src/components/clinical/workspace/tabs/`:
  - `PharmacyTab.js`
  - `components/EnhancedDispenseDialog.js`

#### Prescribing Components
- `/src/components/clinical/prescribing/`:
  - `MedicationHistoryReview.js`
  - `EnhancedMedicationSearch.js`
  - `PrescriptionStatusTracker.js`
  - `PrescriptionStatusDashboard.js`

#### Services (11 files)
- `/src/services/`:
  - `MedicationWorkflowService.js`
  - `MedicationCRUDService.js`
  - `medicationReconciliationService.js`
  - `medicationWorkflowValidator.js`
  - `medicationListManagementService.js`
  - `medicationDiscontinuationService.js`
  - `medicationEffectivenessService.js`
  - `medicationSearchService.js`
  - `medicationDispenseService.js`
  - `medicationAdministrationService.js`
  - `prescriptionRefillService.js`
  - `prescriptionStatusService.js`

#### Utilities
- `/src/utils/`:
  - `medicationDisplayUtils.js`
  - `fhir/MedicationConverter.js`

#### Pages (3 files)
- `/src/pages/`:
  - `MedicationsPage.js`
  - `MedicationReconciliationPage.js`
  - `PharmacyPage.js`

#### Other
- `/src/components/clinical/documentation/ProblemMedicationLinker.js`
- `/src/components/clinical/workspace/cds/conditions/MedicationConditionBuilder.js`
- `/src/hooks/useMedicationAdministration.js`
- `/src/hooks/useMedicationDispense.js`

### 2. Active Usage Analysis

#### Actively Used Files (Referenced in ChartReviewTab)
- ✅ `/src/hooks/useMedicationResolver.js`
- ✅ `/src/components/clinical/workspace/dialogs/PrescribeMedicationDialog.js`
- ✅ `/src/components/clinical/workspace/dialogs/EditMedicationDialog.js`
- ✅ `/src/components/clinical/workspace/dialogs/MedicationReconciliationDialog.js`
- ✅ `/src/components/clinical/medications/RefillManagement.js`
- ✅ `/src/components/clinical/medications/MedicationDiscontinuationDialog.js`
- ✅ `/src/components/clinical/medications/EffectivenessMonitoringPanel.js`
- ✅ `/src/components/clinical/medications/ClinicalSafetyPanel.js`
- ✅ `/src/components/clinical/prescribing/PrescriptionStatusDashboard.js`
- ✅ Services: `medicationDiscontinuationService`, `medicationEffectivenessService`
- ✅ Utils: `medicationDisplayUtils.js`

#### Pages Actively Used (in router.js)
- ✅ `MedicationsPage.js`
- ✅ `MedicationReconciliationPage.js` 
- ✅ `PharmacyPage.js`

#### Potentially Unused/Duplicate
- ❌ `/src/core/fhir/hooks/useMedicationResolver.js` (duplicate of `/src/hooks/`)
- ❌ `/src/features/medications/` (entire directory appears to be duplicate)

### 3. Duplication Patterns

1. **Complete Duplicates**:
   - `useMedicationResolver.js` exists in 2 locations
   - `MedicationEffectivenessDialog.js` exists in 2 locations
   - `MedicationDiscontinuationDialog.js` exists in 2 locations
   - `MedicationReconciliation.js` exists in 2 locations
   - `EditMedicationDialog.js` exists in 2 locations
   - `PrescribeMedicationDialog.js` exists in 2 locations

2. **Partial Duplicates**:
   - Similar functionality in different locations (e.g., effectiveness monitoring spread across multiple files)

## Consolidation Plan

### Phase 1: Directory Structure Consolidation

**Target Structure**:
```
frontend/src/
├── components/
│   └── clinical/
│       ├── medications/          # All medication components
│       ├── pharmacy/            # Pharmacy-specific components  
│       ├── prescribing/         # Prescribing workflows
│       └── workspace/
│           ├── tabs/            # Tab components
│           └── dialogs/         # All clinical dialogs
├── services/
│   └── medications/             # NEW: Consolidated services
│       ├── core/               # Core CRUD and workflow
│       ├── clinical/           # Clinical features
│       └── pharmacy/           # Pharmacy operations
├── hooks/
│   └── medications/            # NEW: All medication hooks
├── utils/
│   └── medications/            # NEW: All medication utilities
└── pages/                      # Keep as-is

```

### Phase 2: File Migration Plan

#### 1. Remove Duplicates
**Delete these duplicate files**:
- `/src/core/fhir/hooks/useMedicationResolver.js` → Keep `/src/hooks/useMedicationResolver.js`
- `/src/features/medications/` → Delete entire directory after verification

#### 2. Consolidate Services
**Create**: `/src/services/medications/`
```
medications/
├── core/
│   ├── MedicationCRUDService.js
│   ├── MedicationWorkflowService.js
│   └── medicationWorkflowValidator.js
├── clinical/
│   ├── medicationReconciliationService.js
│   ├── medicationDiscontinuationService.js
│   ├── medicationEffectivenessService.js
│   ├── medicationListManagementService.js
│   └── medicationSearchService.js
├── pharmacy/
│   ├── medicationDispenseService.js
│   ├── medicationAdministrationService.js
│   ├── prescriptionRefillService.js
│   └── prescriptionStatusService.js
└── index.js  # Export all services
```

#### 3. Consolidate Hooks
**Create**: `/src/hooks/medications/`
```
medications/
├── useMedicationResolver.js
├── useMedicationAdministration.js
├── useMedicationDispense.js
└── index.js  # Export all hooks
```

#### 4. Consolidate Utilities
**Create**: `/src/utils/medications/`
```
medications/
├── medicationDisplayUtils.js
├── MedicationConverter.js
└── index.js  # Export all utilities
```

#### 5. Keep Current Working Structure
**Maintain these locations** (already well-organized):
- `/src/components/clinical/medications/` - All medication components
- `/src/components/clinical/pharmacy/` - Pharmacy components
- `/src/components/clinical/prescribing/` - Prescribing components
- `/src/components/clinical/workspace/dialogs/` - All dialogs
- `/src/pages/` - All pages

### Phase 3: Import Path Updates

After consolidation, update all imports:
```javascript
// Before
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import { medicationDiscontinuationService } from '../../../../services/medicationDiscontinuationService';

// After
import { useMedicationResolver } from '../../../../hooks/medications';
import { medicationDiscontinuationService } from '../../../../services/medications/clinical';
```

### Phase 4: Verification Steps

1. **Test each consolidated module**
2. **Verify all imports are updated**
3. **Run the application and test**:
   - Chart Review medication list
   - Prescribe medication workflow
   - Edit medication
   - Medication reconciliation
   - Pharmacy queue and dispensing
   - Medication administration

### Benefits of Consolidation

1. **Eliminates Duplication**: Removes 6+ duplicate files
2. **Improves Organization**: Clear separation of concerns
3. **Easier Navigation**: Logical grouping by function
4. **Better Maintainability**: Single source of truth
5. **Simplified Imports**: Cleaner import paths with index exports

### Risk Mitigation

1. **Create backup branch** before starting
2. **Move files incrementally** with testing
3. **Update imports file by file**
4. **Run tests after each phase**
5. **Keep detailed migration log**

## Implementation Priority

1. **High Priority**: Remove duplicate hooks and dialogs
2. **Medium Priority**: Consolidate services into organized structure
3. **Low Priority**: Reorganize utilities and create index exports

This consolidation will significantly reduce complexity and improve maintainability of the medication-related code.