# Clinical Workspace Module

## Overview

The Clinical Workspace is the primary interface for healthcare providers to manage patient care. It provides a tabbed interface for accessing all clinical functions including chart review, orders, results, medications, and imaging.

**Location**: `frontend/src/components/clinical/workspace/`

## Architecture

### Component Structure
```
workspace/
├── ClinicalWorkspace.js          # Main container
├── PatientHeader.js              # Patient banner
├── tabs/
│   ├── ChartReviewTab.js        # Problems, meds, allergies
│   ├── OrdersTab.js             # CPOE interface
│   ├── ResultsTab.js            # Lab results & trends
│   ├── MedicationsTab.js        # Medication management
│   ├── ImagingTab.js            # DICOM viewer
│   └── EncountersTab.js         # Visit history
└── components/
    ├── shared/                   # Reusable components
    └── modals/                   # Dialog components
```

### State Management
- Uses `FHIRResourceContext` for data management
- Integrates with `ClinicalWorkflowContext` for events
- Implements progressive loading for performance

## Key Components

### ClinicalWorkspace.js
Main container that orchestrates the tabbed interface.

```javascript
// Key pattern: Tab management with lazy loading
const tabs = [
  { id: 'chart', label: 'Chart Review', component: ChartReviewTab },
  { id: 'orders', label: 'Orders', component: OrdersTab },
  // ...
];
```

### ChartReviewTab.js
Displays problems, medications, allergies, and immunizations.

```javascript
// Key pattern: Resource loading
const { resources, loading } = usePatientResources(patient?.id, [
  'Condition', 'MedicationRequest', 'AllergyIntolerance', 'Immunization'
]);
```

### OrdersTab.js
Computerized Physician Order Entry (CPOE) interface.

```javascript
// Key pattern: Event publishing
await publish(CLINICAL_EVENTS.ORDER_PLACED, {
  orderId: order.id,
  type: orderType,
  patient: patient.id
});
```

## Integration Points

### Event System
- **Publishes**: ORDER_PLACED, MEDICATION_PRESCRIBED, RESULT_ACKNOWLEDGED
- **Subscribes**: RESULT_RECEIVED, MEDICATION_DISPENSED, ENCOUNTER_UPDATED

### FHIR Resources
- **Creates**: ServiceRequest, MedicationRequest, Procedure
- **Reads**: All patient clinical resources
- **Updates**: Resource status changes
- **Deletes**: Cancelled orders

### WebSocket
- Subscribes to patient-specific channels
- Receives real-time updates for all clinical resources

## Usage Examples

### Loading Patient Data
```javascript
import { usePatientResources } from '../../hooks/useFHIRResources';

function MyComponent({ patient }) {
  const { resources, loading, error } = usePatientResources(
    patient?.id, 
    ['Condition', 'MedicationRequest']
  );
  
  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error.message}</Alert>;
  
  return <ResourceList resources={resources} />;
}
```

### Publishing Clinical Events
```javascript
import { useClinicalWorkflow } from '../../contexts/ClinicalWorkflowContext';

function OrderComponent() {
  const { publish } = useClinicalWorkflow();
  
  const handleOrderSubmit = async (orderData) => {
    const order = await fhirService.createResource('ServiceRequest', orderData);
    
    await publish(CLINICAL_EVENTS.ORDER_PLACED, {
      orderId: order.id,
      type: order.category?.[0]?.coding?.[0]?.code,
      patient: order.subject.reference
    });
  };
}
```

### Subscribing to Updates
```javascript
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.RESULT_RECEIVED, (data) => {
    if (data.orderId === currentOrder.id) {
      refreshResults();
    }
  });
  
  return unsubscribe;
}, [currentOrder]);
```

## API Reference

### Hooks
- `usePatientResources(patientId, resourceTypes)` - Load FHIR resources
- `useClinicalWorkflow()` - Access event system
- `useMedicationResolver()` - Resolve medication references

### Context Providers
- `FHIRResourceProvider` - Manages FHIR data
- `ClinicalWorkflowProvider` - Handles events
- `WebSocketProvider` - Real-time updates

## Testing

```bash
# Unit tests
cd frontend && npm test ClinicalWorkspace.test.js

# Integration tests
cd frontend && npm test -- --testPathPattern=clinical

# E2E tests (when implemented)
npm run test:e2e:clinical
```

## Recent Updates

- **2025-01-17**: Documented module structure and patterns
- **2025-01-15**: Added progressive loading for performance
- **2025-01-10**: Integrated WebSocket for real-time updates
- **2025-01-05**: Implemented cross-tab event system

## Related Documentation

- [Event System](./event-system.md)
- [FHIR Services](./fhir-services.md)
- [Cross-Module Integration](../integration/cross-module-events.md)

---

**Questions?** Check [CLAUDE.md](../../../CLAUDE.md) for quick reference or [CLAUDE-REFERENCE.md](../../../CLAUDE-REFERENCE.md) for detailed patterns.