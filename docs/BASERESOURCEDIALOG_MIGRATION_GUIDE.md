# BaseResourceDialog Migration Guide

**Generated**: 2025-07-13  
**Based on**: Successful AllergyIntolerance dialog migration (86% code reduction)

## Overview

This guide documents the critical patterns and lessons learned from migrating dialog components to use the BaseResourceDialog foundation. Following these patterns will prevent the debugging cycles we encountered and ensure consistent, robust implementations.

## Migration Success Metrics

- **Code Reduction**: 85-87% reduction in component size
- **Maintainability**: Centralized validation, error handling, and UI patterns  
- **Consistency**: Standardized dialog behavior across all FHIR resources
- **Reusability**: Shared form fields and resource logic

## Critical Migration Patterns

### 1. Form Data Initialization Pattern

**❌ Wrong Approach:**
```javascript
// BaseResourceDialog sets formData to raw FHIR resource
useEffect(() => {
  if (resource && mode === 'edit') {
    setFormData(resource); // Raw FHIR - causes undefined values
  }
}, [resource]);
```

**✅ Correct Approach:**
```javascript
// Always use parsed initialValues for both add and edit modes
useEffect(() => {
  if (mode === 'edit') {
    setFormData(initialValues); // Parsed form data
  } else {
    setFormData(initialValues);
  }
}, [resource, mode, initialValues, open]);
```

### 2. Safe Defaults Pattern in Form Components

**❌ Wrong Approach:**
```javascript
// Form component receives undefined values
const AllergyFormFields = ({ formData, errors, onChange }) => {
  return (
    <Select value={formData.clinicalStatus}> // undefined = MUI errors
```

**✅ Correct Approach:**
```javascript
// Always provide safe defaults to prevent undefined values
const AllergyFormFields = ({ formData = {}, errors = {}, onChange }) => {
  const safeFormData = {
    selectedAllergen: formData.selectedAllergen || null,
    customAllergen: formData.customAllergen || '',
    allergyType: formData.allergyType || 'allergy',
    criticality: formData.criticality || 'unable-to-assess',
    clinicalStatus: formData.clinicalStatus || 'active',
    verificationStatus: formData.verificationStatus || 'confirmed',
    // ... etc for all fields
  };
  
  return <Select value={safeFormData.clinicalStatus}> // Always valid
```

### 3. Autocomplete Resource Matching Pattern

**❌ Wrong Approach:**
```javascript
// Autocomplete with existing value but empty options
<Autocomplete
  options={[]} // Empty on load
  value={existingResource} // Doesn't match any option
/>
```

**✅ Correct Approach:**
```javascript
// Initialize options with existing value + proper equality check
useEffect(() => {
  if (safeFormData.selectedAllergen && allergenOptions.length === 0) {
    setAllergenOptions([safeFormData.selectedAllergen]);
  }
}, [safeFormData.selectedAllergen]);

<Autocomplete
  options={allergenOptions}
  value={safeFormData.selectedAllergen}
  isOptionEqualToValue={(option, value) => {
    if (!option || !value) return false;
    return option.code === value.code && option.system === value.system;
  }}
/>
```

### 4. Validation Field Alignment Pattern

**❌ Wrong Approach:**
```javascript
// Validation rules using different field names than form
export const validationRules = {
  allergen: { required: true }, // Field doesn't exist
};

// Form has different field names
<TextField name="selectedAllergen" error={!!errors.allergen} />
<TextField name="customAllergen" error={!!errors.allergen} />
```

**✅ Correct Approach:**
```javascript
// Validation rule keys must match exact form field names
export const validationRules = {
  selectedAllergen: {
    required: false,
    custom: (value, formData) => {
      if (!formData.selectedAllergen && !formData.customAllergen) {
        return 'Please specify an allergen';
      }
      return null;
    }
  },
  customAllergen: { required: false }
};

// Error references match validation field names
<TextField error={!!errors.selectedAllergen} helperText={errors.selectedAllergen} />
<TextField error={!!errors.customAllergen} helperText={errors.customAllergen} />
```

### 5. Unsaved Changes Handling Pattern

**❌ Wrong Approach:**
```javascript
// Change tracking overrides manual state changes
const handleSave = async () => {
  await onSave(formData);
  setHasChanges(false); // Gets overridden by useEffect
  handleClose(); // Still shows "unsaved changes"
};
```

**✅ Correct Approach:**
```javascript
// Use bypass parameter to skip unsaved changes check after save
const handleClose = (bypassUnsavedCheck = false) => {
  if (!bypassUnsavedCheck && hasChanges && !justSaved && 
      !window.confirm('You have unsaved changes...')) {
    return;
  }
  // ... close logic
};

const handleSave = async () => {
  await onSave(formData);
  setJustSaved(true);
  handleClose(true); // Bypass unsaved check
};
```

### 6. FHIR Resource Parsing Standards

**✅ Required Functions for Each Resource:**
```javascript
// In /config/resourceDialogConfig.js
export const parseResourceTypeResource = (resource) => {
  // Convert FHIR resource to flat form data
  return {
    field1: resource.field1?.coding?.[0]?.code || 'default',
    field2: resource.field2 || '',
    // Handle both R4 and R5 formats
    reactions: extractReactions(resource)
  };
};

export const updateResourceTypeResource = (formData, existingResource) => {
  // Convert form data back to FHIR resource for updates
  return {
    ...existingResource,
    id: existingResource.id, // Preserve ID
    field1: createCodeableConcept(formData.field1),
    // ... update all fields
  };
};
```

### 7. Display Component Compatibility

**✅ Handle Multiple FHIR Versions:**
```javascript
// In display components (ChartReviewTab, etc.)
{resource.reaction?.[0]?.manifestation?.map((m, idx) => {
  // Handle both R4 and R5 formats
  const text = m?.concept?.text || m?.text || 
               m?.concept?.coding?.[0]?.display || 
               m?.coding?.[0]?.display;
  return text ? <Chip key={idx} label={text} /> : null;
})}
```

## Migration Checklist

### Pre-Migration Research
- [ ] Identify existing dialog component location and size
- [ ] Document current validation rules and error handling
- [ ] List all form fields and their data types
- [ ] Check current FHIR resource parsing logic

### Implementation Phase
- [ ] Create resource config file with validation rules
- [ ] Implement parseResource and updateResource functions
- [ ] Create reusable FormFields component with safe defaults
- [ ] Migrate dialog to use BaseResourceDialog pattern
- [ ] Add proper Autocomplete option matching if needed
- [ ] Ensure validation field names match form field names

### Testing & Validation
- [ ] Test with real patient data (not mock data)
- [ ] Verify edit mode loads existing data correctly
- [ ] Confirm save operations work without unsaved changes warnings
- [ ] Check display components render updated resources properly
- [ ] Test all validation scenarios and error states

### Final Review
- [ ] Remove all console.log statements
- [ ] Verify code reduction achieved (target: 80%+ reduction)
- [ ] Update related display components for R4/R5 compatibility
- [ ] Document any resource-specific patterns discovered

## Next Dialog Components to Migrate

**High Priority (Clinical Workflows):**
1. **Condition/Problem Dialogs** - Core diagnosis management
2. **Medication Dialogs** - Prescription and reconciliation
3. **Observation/Lab Result Dialogs** - Results entry and updates
4. **ServiceRequest/Order Dialogs** - Order management

**Medium Priority:**
5. Procedure Dialogs
6. Encounter Dialogs  
7. DiagnosticReport Dialogs
8. CarePlan Dialogs

## Code Reduction Targets

| Component Type | Expected Reduction | Complexity |
|---------------|-------------------|------------|
| Simple CRUD Dialogs | 85-90% | Low |
| Complex Multi-step | 75-85% | Medium |
| Integration Heavy | 70-80% | High |

## Common Pitfalls to Avoid

1. **Don't** mix raw FHIR resources with form data
2. **Don't** forget to initialize Autocomplete options for edit mode
3. **Don't** use validation field names that don't match form fields
4. **Don't** skip safe defaults in form components
5. **Don't** test only with add mode - always test edit mode thoroughly
6. **Don't** assume all FHIR resources use the same version format

## Architecture Benefits

- **Consistency**: All dialogs behave identically
- **Maintainability**: Single source of truth for dialog logic
- **Testing**: Standardized patterns reduce test complexity
- **Documentation**: Self-documenting configuration approach
- **Performance**: Shared validation and caching logic
- **Future-Proofing**: Easy to extend for R6 and profiles

---

**Next Steps**: Apply these patterns to migrate the remaining 15+ dialog components, starting with Condition/Problem dialogs as they're critical for clinical workflows.