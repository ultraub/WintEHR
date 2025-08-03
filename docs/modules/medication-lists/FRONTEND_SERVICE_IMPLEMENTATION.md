# Frontend Service Implementation for Medication Lists

**Last Updated**: 2025-08-03

## Overview

This document describes the frontend service implementations for FHIR List-based medication management in WintEHR. The services provide comprehensive functionality for managing medication lists, reconciliation, and workflow integration.

## Implemented Services

### 1. MedicationCRUDService.js

The MedicationCRUDService has been enhanced with complete medication list management functionality:

#### Key Methods

**`initializePatientMedicationLists(patientId)`**
- Creates standard medication lists for new patients
- Checks for existing lists before creating
- Updates internal cache
- Returns array of created/existing lists

**`getPatientMedicationLists(patientId, listType)`**
- Fetches all medication lists for a patient
- Optional filtering by list type
- Updates internal cache
- Returns array of FHIR List resources

**`addMedicationToList(patientId, listType, medicationRequest, reason)`**
- Adds medication to specific list
- Creates list if it doesn't exist
- Notifies subscribers of updates
- Returns operation result

**`removeMedicationFromList(patientId, listType, medicationRequestId)`**
- Soft deletes medication from list
- Updates cache
- Notifies subscribers
- Returns operation result

**`reconcileMedicationLists(patientId, sourceListIds)`**
- Performs medication reconciliation
- Creates reconciliation list
- Returns reconciliation summary

#### Cache Management
- Internal cache using Map for fast access
- Cache key format: `${patientId}-${listType}`
- Automatic cache updates on all operations

#### Subscription System
- Subscribe to list updates: `subscribeToListUpdates(patientId, listType, callback)`
- Global subscriptions supported
- Automatic cleanup on unsubscribe

### 2. MedicationWorkflowService.js

Enhanced with sophisticated medication categorization and reconciliation analysis:

#### Categorization Methods

**`categorizeMedicationsBySource(medicationData)`**
- Processes MedicationRequest, MedicationStatement, and MedicationDispense resources
- Categorizes into: home, hospital, discharge, pharmacy, external
- Enriches data with dispense information
- Returns categorized medication object

**`determineMedicationSource(medicationRequest)`**
- Examines extensions for source metadata
- Checks category codes
- Analyzes encounter context
- Returns source type string

#### Reconciliation Analysis

**`analyzeReconciliationNeeds(categorizedMedications)`**
- Compares medications across sources
- Identifies new, discontinued, modified, and continued medications
- Detects conflicts and duplications
- Calculates risk level
- Returns comprehensive analysis with recommendations

**Helper Methods:**
- `createMedicationMap()` - Maps medications by RxNorm code or name
- `findEquivalentMedication()` - Finds matching medications across sources
- `isDosageChanged()` - Compares dosage instructions
- `identifyMedicationConflicts()` - Detects duplicates and therapeutic duplications
- `generateReconciliationRecommendations()` - Creates actionable recommendations

## Integration with Backend API

All frontend services integrate with the backend medication lists API:

### API Endpoints Used
- `POST /api/clinical/medication-lists/initialize/{patientId}`
- `GET /api/clinical/medication-lists/{patientId}`
- `POST /api/clinical/medication-lists`
- `POST /api/clinical/medication-lists/{listId}/entries`
- `DELETE /api/clinical/medication-lists/{listId}/entries/{medicationRequestId}`
- `POST /api/clinical/medication-lists/reconcile`

### Error Handling
- All API calls include proper error handling
- User-friendly error messages
- Automatic retry not implemented (could be added)

## Usage Examples

### Initialize Lists for New Patient
```javascript
import { medicationCRUDService } from '@/services/MedicationCRUDService';

// Initialize lists when creating new patient
const lists = await medicationCRUDService.initializePatientMedicationLists(patientId);
```

### Add Medication to Current List
```javascript
// When prescribing new medication
const result = await medicationCRUDService.addMedicationToCurrentList(
  patientId, 
  medicationRequest
);
```

### Perform Medication Reconciliation
```javascript
import { medicationWorkflowService } from '@/services/MedicationWorkflowService';

// Get medication data from various sources
const medicationData = await medicationWorkflowService.getMedicationReconciliation(
  patientId,
  encounterId
);

// Categorize medications
const categorized = medicationWorkflowService.categorizeMedicationsBySource(medicationData);

// Analyze reconciliation needs
const analysis = medicationWorkflowService.analyzeReconciliationNeeds(categorized);

// Display recommendations to user
analysis.recommendations.forEach(rec => {
  console.log(`${rec.priority}: ${rec.message}`);
});
```

### Subscribe to List Updates
```javascript
// Subscribe to updates for current medications
const unsubscribe = medicationCRUDService.subscribeToListUpdates(
  patientId,
  'current',
  (update) => {
    console.log(`List updated: ${update.action} - ${update.medicationRequest.name}`);
    // Refresh UI
  }
);

// Clean up when component unmounts
useEffect(() => {
  return () => unsubscribe();
}, []);
```

## Data Models

### Medication List Entry
```javascript
{
  id: "medication-request-id",
  name: "Medication Name",
  status: "active",
  dosage: { /* FHIR dosage object */ },
  source: "home|hospital|discharge",
  authoredOn: "2025-08-03T...",
  prescriber: "Dr. Smith",
  resource: { /* Full FHIR resource */ }
}
```

### Reconciliation Analysis Result
```javascript
{
  discrepancies: [
    {
      type: "new_medication|dosage_change|discontinued|conflict",
      medication: { /* medication object */ },
      severity: "high|medium|low",
      message: "Human-readable description"
    }
  ],
  recommendations: [
    {
      type: "action_required|review_required|information",
      priority: "high|medium|low",
      message: "Recommendation text",
      medications: [ /* affected medications */ ]
    }
  ],
  riskLevel: "high|medium|low",
  summary: {
    newMedications: [],
    continuedMedications: [],
    discontinuedMedications: [],
    modifiedMedications: [],
    conflicts: []
  }
}
```

## Best Practices

1. **Always Initialize Lists**: Call `initializePatientMedicationLists` for new patients
2. **Use Subscriptions**: Subscribe to updates for real-time UI updates
3. **Handle Errors**: All service methods may throw - use try/catch
4. **Cache Management**: Service handles caching automatically
5. **Reconciliation Workflow**: Always analyze before applying changes

## Future Enhancements

1. **Offline Support**: Add local storage caching
2. **Conflict Resolution UI**: Interactive reconciliation interface
3. **Batch Operations**: Add/remove multiple medications at once
4. **History Tracking**: View list changes over time
5. **Integration with Orders**: Auto-update lists when orders are placed

## Testing Considerations

1. **Mock API Responses**: Use MSW or similar for testing
2. **Cache Behavior**: Test cache invalidation scenarios
3. **Subscription Cleanup**: Ensure no memory leaks
4. **Error Scenarios**: Test network failures, invalid data
5. **Reconciliation Logic**: Test various medication combinations