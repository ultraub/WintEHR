# Frontend Directory Restructure Plan
**WintEHR - Feature-Based Architecture Implementation**

*Created: 2025-07-13*  
*Status: Implementation Ready*  
*Priority: Critical Foundation*

## 🎯 Objective

Transform the current component-centric directory structure into a feature-based, modular architecture that:
- **Eliminates code duplication** through shared component libraries
- **Enables feature-based development** for better maintainability
- **Centralizes FHIR utilities** for consistent data handling
- **Facilitates component reuse** across clinical workflows

## 📊 Current Structure Analysis

### Current Issues
- **Mixed concerns**: Clinical components scattered across multiple directories
- **Deep nesting**: `components/clinical/workspace/dialogs/` creates maintenance burden
- **No clear separation**: Core utilities mixed with feature-specific code
- **Duplication**: Similar components in different locations

### Current Directory Depth
```
src/components/clinical/workspace/dialogs/AddAllergyDialog.js (5 levels deep)
src/components/clinical/workspace/tabs/ChartReviewTab.js (5 levels deep)
```

## 🏗️ New Structure Design

### Target Architecture
```
src/
├── core/                    # Core utilities and services
│   ├── fhir/               # FHIR-specific utilities
│   │   ├── components/     # Base FHIR components
│   │   ├── hooks/          # FHIR data hooks
│   │   ├── services/       # FHIR services
│   │   ├── utils/          # FHIR utilities
│   │   └── validators/     # FHIR validation
│   ├── services/           # Base service classes
│   ├── utils/              # General utilities
│   └── types/              # TypeScript definitions
├── features/               # Feature-based modules
│   ├── allergies/          # Allergy management
│   │   ├── components/     # Allergy-specific components
│   │   ├── dialogs/        # Add/Edit allergy dialogs
│   │   ├── hooks/          # Allergy-specific hooks
│   │   └── services/       # Allergy services
│   ├── conditions/         # Problem list management
│   ├── medications/        # Medication management
│   ├── orders/             # Clinical orders
│   ├── results/            # Lab/diagnostic results
│   ├── encounters/         # Encounter management
│   ├── documentation/      # Clinical documentation
│   ├── imaging/            # Medical imaging
│   ├── pharmacy/           # Pharmacy workflows
│   ├── cds/               # Clinical decision support
│   └── shared/            # Shared feature components
├── components/             # Reusable UI components
│   ├── base/              # Base components (BaseResourceDialog)
│   ├── forms/             # Form components
│   ├── layout/            # Layout components
│   ├── navigation/        # Navigation components
│   └── common/            # Common UI elements
├── contexts/              # React contexts
├── hooks/                 # General hooks
├── pages/                 # Top-level pages
├── providers/             # Context providers
├── router/                # Routing configuration
└── config/               # Configuration files
```

## 📋 Migration Plan

### Phase 1: Create New Structure (Week 1, Days 1-2)

#### Step 1: Create Core Directories
```bash
mkdir -p src/core/fhir/{components,hooks,services,utils,validators}
mkdir -p src/core/{services,utils,types}
mkdir -p src/features/{allergies,conditions,medications,orders,results,encounters,documentation,imaging,pharmacy,cds,shared}
mkdir -p src/components/{base,forms,layout,navigation,common}
```

#### Step 2: Create Feature Subdirectories
```bash
# For each feature directory
for feature in allergies conditions medications orders results encounters documentation imaging pharmacy cds; do
  mkdir -p src/features/$feature/{components,dialogs,hooks,services,types}
done
```

### Phase 2: Move Core FHIR Utilities (Week 1, Days 2-3)

#### FHIR Services
```
Current: src/services/fhirService.js
Target:  src/core/fhir/services/fhirService.js

Current: src/services/fhirClient.js  
Target:  src/core/fhir/services/fhirClient.js

Current: src/utils/fhirValidation.js
Target:  src/core/fhir/validators/fhirValidation.js
```

#### FHIR Hooks
```
Current: src/hooks/useFHIRResources.js
Target:  src/core/fhir/hooks/useFHIRResources.js

Current: src/hooks/useMedicationResolver.js
Target:  src/core/fhir/hooks/useMedicationResolver.js
```

#### FHIR Contexts
```
Current: src/contexts/FHIRResourceContext.js
Target:  src/core/fhir/contexts/FHIRResourceContext.js
```

### Phase 3: Feature-Based Component Migration (Week 1, Days 3-5)

#### Allergy Feature Migration
```
Current: src/components/clinical/workspace/dialogs/AddAllergyDialog.js
Target:  src/features/allergies/dialogs/AddAllergyDialog.js

Current: src/components/clinical/workspace/dialogs/EditAllergyDialog.js
Target:  src/features/allergies/dialogs/EditAllergyDialog.js
```

#### Medication Feature Migration
```
Current: src/components/clinical/workspace/dialogs/EditMedicationDialog.js
Target:  src/features/medications/dialogs/EditMedicationDialog.js

Current: src/components/clinical/workspace/dialogs/PrescribeMedicationDialog.js
Target:  src/features/medications/dialogs/PrescribeMedicationDialog.js

Current: src/components/clinical/medications/
Target:  src/features/medications/components/
```

#### Orders Feature Migration
```
Current: src/components/clinical/workspace/dialogs/CPOEDialog.js
Target:  src/features/orders/dialogs/CPOEDialog.js

Current: src/components/clinical/workspace/tabs/OrdersTab.js
Target:  src/features/orders/components/OrdersTab.js

Current: src/components/clinical/orders/
Target:  src/features/orders/components/
```

#### Results Feature Migration
```
Current: src/components/clinical/workspace/tabs/ResultsTab.js
Target:  src/features/results/components/ResultsTab.js

Current: src/components/clinical/results/
Target:  src/features/results/components/
```

### Phase 4: Base Component Architecture (Week 1, Day 5)

#### Create Base Components
```
New: src/components/base/BaseResourceDialog.js
New: src/components/base/BaseResourceForm.js
New: src/components/base/BaseResourcePreview.js
```

#### Create FHIR Form Components
```
New: src/core/fhir/components/DateTimeField.js
New: src/core/fhir/components/CodeableConceptField.js
New: src/core/fhir/components/ReferenceField.js
New: src/core/fhir/components/QuantityField.js
New: src/core/fhir/components/PeriodField.js
New: src/core/fhir/components/IdentifierField.js
```

### Phase 5: Update Import Paths (Week 2, Days 1-3)

#### Create Barrel Exports
```javascript
// src/core/fhir/index.js
export { fhirService } from './services/fhirService';
export { useFHIRResources } from './hooks/useFHIRResources';
export { FHIRResourceContext } from './contexts/FHIRResourceContext';

// src/features/allergies/index.js
export { AddAllergyDialog } from './dialogs/AddAllergyDialog';
export { EditAllergyDialog } from './dialogs/EditAllergyDialog';

// src/components/base/index.js
export { BaseResourceDialog } from './BaseResourceDialog';
```

#### Update All Import Statements
- Search and replace old import paths
- Update webpack aliases if needed
- Test all imports resolve correctly

## 🔧 Implementation Guidelines

### File Movement Process
1. **Create target directory** if it doesn't exist
2. **Move file** to new location
3. **Update imports** within the moved file
4. **Update all references** to the moved file
5. **Test functionality** to ensure no breaks
6. **Commit changes** with descriptive message

### Import Path Strategy
```javascript
// Before (current)
import AddAllergyDialog from '../../../clinical/workspace/dialogs/AddAllergyDialog';

// After (new structure)
import { AddAllergyDialog } from '@features/allergies';
// or
import { AddAllergyDialog } from '../../features/allergies';
```

### Webpack Alias Configuration
```javascript
// webpack.config.js or jsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@core/*": ["src/core/*"],
      "@features/*": ["src/features/*"],
      "@components/*": ["src/components/*"],
      "@fhir/*": ["src/core/fhir/*"]
    }
  }
}
```

## 📊 Benefits Tracking

### Before Migration Metrics
- **Dialog Components**: 17 files, 10,268 lines, scattered across 3+ directories
- **Import Complexity**: Up to 5 levels deep (`../../../clinical/workspace/dialogs/`)
- **Code Duplication**: 40-50% duplication between similar components

### After Migration Targets
- **Clear Feature Separation**: Each feature in own directory
- **Simplified Imports**: Maximum 2 levels (`@features/allergies`)
- **Centralized Core**: All FHIR utilities in one location
- **Base Component Library**: Reusable patterns for all features

### Success Criteria
- [ ] All components moved to appropriate feature directories
- [ ] All import paths updated and working
- [ ] No functionality broken during migration
- [ ] Base component architecture established
- [ ] FHIR utilities centralized and accessible

## 🚨 Risk Mitigation

### Import Resolution Issues
- **Risk**: Broken imports causing build failures
- **Mitigation**: Update imports immediately after moving files
- **Testing**: Verify build passes after each major move

### Feature Boundary Confusion
- **Risk**: Unclear what belongs in which feature
- **Mitigation**: Clear guidelines and examples provided
- **Review**: Architecture review before moving components

### Merge Conflict Potential
- **Risk**: Large file moves creating merge conflicts
- **Mitigation**: Coordinate with team, work in small batches
- **Communication**: Clear commit messages documenting moves

## 📝 Next Steps

1. **Create directory structure** (immediate)
2. **Move core FHIR utilities** (Days 1-2)
3. **Migrate feature components** (Days 3-4)
4. **Create base component library** (Day 5)
5. **Update all imports** (Week 2)
6. **Validate and test** (ongoing)

This restructure is the critical foundation for the entire FHIR architecture transformation. It must be completed successfully before any component abstraction or resource implementation work begins.