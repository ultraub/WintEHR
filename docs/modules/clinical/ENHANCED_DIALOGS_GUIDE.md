# Enhanced Clinical Dialogs Guide

**Last Updated**: 2025-01-20

## Overview

WintEHR's clinical dialogs have been enhanced with modern, aesthetic designs and full FHIR R4 support. These dialogs leverage dynamic clinical catalogs, intelligent search capabilities, and comprehensive CRUD operations.

## Key Features

### 1. **Modern Aesthetic Design**
- **Material-UI Components**: Beautiful, consistent UI with smooth animations
- **Stepper Navigation**: Multi-step forms with clear progress indication
- **Color-Coded Status**: Visual indicators for different states and severities
- **Responsive Layout**: Works seamlessly on desktop and mobile devices
- **Smooth Transitions**: Fade and zoom animations for better UX

### 2. **Reusable Components**
- **ResourceSearchAutocomplete**: Powerful search with favorites and recent items
- **BatchOperationsDialog**: Bulk operations on multiple resources
- **Smart Defaults**: Context-aware default values (coming soon)
- **Undo/Redo Support**: Keyboard shortcuts for power users (coming soon)

### 3. **Dynamic Clinical Catalogs**
- **Real-Time Data**: Catalogs generated from actual patient data
- **Frequency-Based Suggestions**: Shows most commonly used items
- **Smart Search**: Type-ahead with debouncing and caching
- **Category Filtering**: Filter by type, specialty, or category
- **Usage Statistics**: See how often items are used in your system

### 4. **FHIR R4 Compliance**
- **Complete Resource Support**: Full FHIR R4 resource structure
- **Proper Coding Systems**: ICD-10, SNOMED, RxNorm, LOINC
- **Reference Management**: Proper patient and encounter references
- **Search Parameter Support**: Leverages indexed search parameters
- **Audit Trail**: Tracks who created/modified resources

### 5. **Clinical Decision Support**
- **Real-Time Alerts**: CDS Hooks integration for safety checks
- **Drug Interactions**: Automatic checking for medications
- **Allergy Alerts**: Cross-references with patient allergies
- **Clinical Guidelines**: Suggests best practices
- **Smart Defaults**: Context-aware default values

### 6. **Enhanced Search**
- **Intelligent Autocomplete**: Fast, cached search results
- **Multiple Search Methods**: By name, code, or description
- **Recent/Frequent Items**: Quick access to commonly used items
- **Trending Analysis**: Shows what's popular in your system
- **Fuzzy Matching**: Finds results even with typos

## Reusable Components

### ResourceSearchAutocomplete
A powerful reusable autocomplete component for searching FHIR resources.

**Features:**
- Dynamic search with configurable debouncing
- Support for multiple resource types
- Recent selections and favorites
- Clinical coding system integration
- Keyboard navigation
- Loading states and error handling

**Usage:**
```javascript
import ResourceSearchAutocomplete from '../common/ResourceSearchAutocomplete';

<ResourceSearchAutocomplete
  resourceType="MedicationRequest"
  value={selectedMedication}
  onChange={(event, newValue) => setSelectedMedication(newValue)}
  patientId={patient.id}
  includeCatalog={true}
  showRecent={true}
  showFavorites={true}
  label="Search Medications"
  placeholder="Type medication name..."
/>
```

### BatchOperationsDialog
Enables batch CRUD operations on multiple FHIR resources simultaneously.

**Features:**
- Multi-select resource management
- Bulk updates with field selection
- Batch deletion with confirmation
- Progress tracking and error handling
- Rollback capability
- Operation history

**Usage:**
```javascript
import BatchOperationsDialog from '../common/BatchOperationsDialog';

<BatchOperationsDialog
  open={batchDialogOpen}
  onClose={() => setBatchDialogOpen(false)}
  resources={medications}
  resourceType="MedicationRequest"
  onOperationComplete={handleBatchComplete}
  maxBatchSize={50}
/>
```

**Supported Operations:**
- **Update**: Modify fields on selected resources
- **Delete**: Permanently remove resources
- **Archive**: Mark resources as archived
- **Activate/Deactivate**: Change resource status

## Enhanced Dialogs

### ConditionDialogEnhanced

**Features:**
- Dynamic condition catalog from diagnoses
- ICD-10 code search and display
- Clinical and verification status management
- Severity and category classification
- Body site and stage tracking
- Trending conditions display

**Usage:**
```javascript
import ConditionDialog from './dialogs/ConditionDialog';

<ConditionDialog
  open={open}
  onClose={handleClose}
  condition={existingCondition} // For edit mode
  onSave={handleSaveCondition}
  patientId={patientId}
  encounterId={encounterId} // Optional
/>
```

### MedicationDialogEnhanced

**Features:**
- Dynamic medication catalog from prescriptions
- NDC code search and display
- Dosage calculation and frequency suggestions
- PRN (as-needed) medication support
- Dispensing information management
- Refill and substitution handling
- Drug interaction checking via CDS

**Usage:**
```javascript
import MedicationDialog from './dialogs/MedicationDialog';

<MedicationDialog
  open={open}
  onClose={handleClose}
  medication={existingMedication} // For edit mode
  onSave={handleSaveMedication}
  patientId={patientId}
  encounterId={encounterId} // Optional
  mode="prescribe" // 'prescribe', 'edit', 'refill'
/>
```

### AllergyDialogEnhanced

**Features:**
- Category-based allergen selection (food, medication, environment, biologic)
- Dynamic allergen search with common allergens
- Reaction manifestation tracking with SNOMED codes
- Severity assessment with visual indicators
- Criticality ratings (low, high, unable-to-assess)
- Date of onset and resolution tracking
- Beautiful Material-UI design with warning theme

**Usage:**
```javascript
import AllergyDialog from './dialogs/AllergyDialog';

<AllergyDialog
  open={open}
  onClose={handleClose}
  allergy={existingAllergy} // For edit mode
  onSave={handleSaveAllergy}
  patientId={patientId}
  encounterId={encounterId} // Optional
/>
```

### ImmunizationDialogEnhanced

**Features:**
- Dynamic vaccine catalog with CVX code support
- Trending vaccines from recent administrations
- Age-based vaccine schedule recommendations
- Category browsing (routine, flu, COVID-19, travel, occupational, pregnancy)
- Administration site and route selection
- Series tracking (dose number, total doses)
- Reaction reporting with severity levels
- Lot number and expiration date tracking
- Contraindication checking with patient allergies

**Usage:**
```javascript
import ImmunizationDialog from './dialogs/ImmunizationDialog';

<ImmunizationDialog
  open={open}
  onClose={handleClose}
  immunization={existingImmunization} // For edit mode
  onSave={handleSaveImmunization}
  patientId={patientId}
  encounterId={encounterId} // Optional
  mode="administer" // 'administer', 'edit', 'history'
/>
```

## Dialog Design Patterns

### 1. **Three-Step Process**
Most dialogs follow a three-step pattern:
1. **Search & Select**: Find and select the clinical item
2. **Details & Configuration**: Enter specific details
3. **Review & Save**: Confirm and save changes

### 2. **Visual Hierarchy**
- **Primary Actions**: Prominent buttons with icons
- **Status Indicators**: Color-coded chips and badges
- **Information Density**: Progressive disclosure of details
- **Error States**: Clear, actionable error messages

### 3. **Responsive Behavior**
- **Mobile-First**: Touch-friendly controls
- **Adaptive Layouts**: Grid system adjusts to screen size
- **Accessible**: Keyboard navigation and screen reader support

## Integration Guide

### Step 1: Import the Dialog
```javascript
import ConditionDialog from '@/components/clinical/workspace/dialogs/ConditionDialog';
// or
import MedicationDialog from '@/components/clinical/workspace/dialogs/MedicationDialog';
```

### Step 2: Manage Dialog State
```javascript
const [dialogOpen, setDialogOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState(null);

const handleOpenDialog = (item = null) => {
  setSelectedItem(item); // Pass item for edit mode
  setDialogOpen(true);
};

const handleCloseDialog = () => {
  setDialogOpen(false);
  setSelectedItem(null);
};
```

### Step 3: Handle Save
```javascript
const handleSave = async (fhirResource) => {
  try {
    if (fhirResource.id) {
      // Update existing
      await fhirClient.update(
        fhirResource.resourceType,
        fhirResource.id,
        fhirResource
      );
    } else {
      // Create new
      await fhirClient.create(
        fhirResource.resourceType,
        fhirResource
      );
    }
    
    // Refresh data
    await refreshPatientData();
    
    // Close dialog
    handleCloseDialog();
    
    // Show success message
    showNotification('Resource saved successfully', 'success');
  } catch (error) {
    console.error('Error saving resource:', error);
    showNotification('Failed to save resource', 'error');
  }
};
```

### Step 4: Render the Dialog
```javascript
<ConditionDialog
  open={dialogOpen}
  onClose={handleCloseDialog}
  condition={selectedItem}
  onSave={handleSave}
  patientId={currentPatient.id}
  encounterId={currentEncounter?.id}
/>
```

## Advanced Features

### Custom Validation
```javascript
const handleValidate = (formData) => {
  const errors = {};
  
  // Custom validation logic
  if (formData.severity === 'severe' && !formData.note) {
    errors.note = 'Please provide notes for severe conditions';
  }
  
  return errors;
};

<ConditionDialog
  // ... other props
  onValidate={handleValidate}
/>
```

### CDS Integration
The dialogs automatically evaluate CDS rules:
```javascript
// In the dialog component
const alerts = await evaluateCDS('condition-select', {
  patient: patientId,
  condition: selectedCondition
});
```

### Event Publishing
Dialogs publish clinical workflow events:
```javascript
// Automatically published on save
publish(CLINICAL_EVENTS.CONDITION_ADDED, {
  patientId,
  conditionId: fhirCondition.id,
  condition: fhirCondition
});
```

## Performance Optimization

### 1. **Search Caching**
- Results are cached for 5 minutes
- Reduces API calls for repeated searches
- Cache is cleared on data changes

### 2. **Lazy Loading**
- Dialogs are code-split for faster initial load
- Resources load only when needed
- Progressive enhancement for complex forms

### 3. **Debounced Search**
- 300ms debounce on search input
- Prevents excessive API calls
- Smooth user experience

## Accessibility

All enhanced dialogs follow WCAG 2.1 AA guidelines:
- **Keyboard Navigation**: Tab through all controls
- **Screen Reader Support**: Proper ARIA labels
- **Focus Management**: Focus trapped in dialog
- **Error Announcements**: Errors announced to screen readers
- **High Contrast**: Works with high contrast modes

## Future Enhancements

### Planned Features
1. **Batch Operations**: Select and update multiple items
2. **Templates**: Save and reuse common configurations
3. **Voice Input**: Dictation support for text fields
4. **Offline Support**: Queue changes when offline
5. **Collaboration**: See who else is viewing/editing

### Additional Enhanced Dialogs

#### ProcedureDialogEnhanced
**Features:**
- Dynamic procedure catalog from patient data
- CPT and SNOMED code support
- Procedure status tracking (preparation, in-progress, completed)
- Duration tracking with start/end times
- Outcome recording (successful, unsuccessful, partial)
- Complication reporting
- Performer and location tracking
- Body site selection with laterality

#### ObservationDialogEnhanced
**Features:**
- Lab result and vital sign recording
- LOINC code integration
- Quick vitals mode for efficient data entry
- Reference range validation
- Interpretation flags (high, low, normal, critical)
- Trend analysis from previous values
- Multiple value types (numeric, coded, text, boolean)
- Specimen and method tracking

#### DiagnosticReportDialogEnhanced
**Features:**
- Comprehensive report creation
- Link multiple observations
- Common lab panel templates
- PDF attachment support
- Status tracking (registered, partial, final, corrected)
- Performer and result interpreter
- Conclusion and clinical context
- Automated result grouping

#### ServiceRequestDialogEnhanced
**Features:**
- Service ordering with priority levels
- Duplicate order detection
- Clinical guidance integration
- Flexible timing options
- Patient instructions
- Insurance authorization tracking
- Reason for request with ICD-10 codes
- Order sets and protocols

## Best Practices

1. **Always Include Patient ID**: Required for proper FHIR references
2. **Handle Errors Gracefully**: Show user-friendly error messages
3. **Refresh After Save**: Update the UI to reflect changes
4. **Use Loading States**: Show progress during async operations
5. **Validate Before Submit**: Prevent invalid data submission

## Troubleshooting

### Common Issues

**1. Search Returns No Results**
- Check if clinical catalogs are populated
- Verify search parameters are indexed
- Ensure proper API connectivity

**2. CDS Alerts Not Showing**
- Verify CDS Hooks service is running
- Check patient has necessary data
- Review CDS rule configuration

**3. Save Fails**
- Check FHIR resource validation
- Verify user has write permissions
- Review network connectivity

### Debug Mode
Enable debug logging:
```javascript
// In development
localStorage.setItem('debug', 'dialogs:*');
```

## Migration Guide

### From Old Dialogs
```javascript
// Old
<ConditionDialog
  open={open}
  onClose={onClose}
  condition={condition}
  onSave={onSave}
  patientId={patientId}
/>

// New - Same API, enhanced features!
<ConditionDialog
  open={open}
  onClose={onClose}
  condition={condition}
  onSave={onSave}
  patientId={patientId}
/>
```

The enhanced dialogs maintain backward compatibility while adding new features.

---

**Remember**: These dialogs handle critical clinical data. Always validate, always test, and always prioritize patient safety.