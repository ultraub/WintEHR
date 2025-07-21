# Clinical Workspace Module

## Overview

The Clinical Workspace is the primary interface for healthcare providers to manage patient care. It provides a tabbed interface for accessing all clinical functions including chart review, orders, results, medications, and imaging.

**Current Versions**: 
- `ClinicalWorkspaceV3` - Legacy self-contained version
- `ClinicalWorkspaceEnhanced` - New modular version
- `ClinicalWorkspaceWrapper` - Bridge component for enhanced version

**Locations**: 
- `frontend/src/components/clinical/ClinicalWorkspaceV3.js`
- `frontend/src/components/clinical/ClinicalWorkspaceEnhanced.js`
- `frontend/src/components/clinical/ClinicalWorkspaceWrapper.js`

## Architecture

### Component Structure (Current State)
```
clinical/
├── ClinicalWorkspaceV3.js       # Legacy self-contained workspace
├── ClinicalWorkspaceEnhanced.js # New modular workspace
├── ClinicalWorkspaceWrapper.js  # Bridge component
├── workspace/
│   ├── EnhancedPatientHeader.js # Patient banner (V3 only)
│   ├── WorkspaceContent.js      # Content wrapper (V3 only)
│   ├── TabErrorBoundary.js      # Error handling (Enhanced only)
│   └── tabs/
│       ├── SummaryTab.js        # Patient summary
│       ├── ChartReviewTab.js    # Standard version
│       ├── ChartReviewTabOptimized.js # Enhanced version
│       ├── EncountersTab.js     # Visit history
│       ├── ResultsTab.js        # Standard version
│       ├── ResultsTabOptimized.js # Enhanced version
│       ├── OrdersTab.js         # Standard CPOE
│       ├── EnhancedOrdersTab.js # Enhanced CPOE
│       ├── PharmacyTab.js       # Medication management
│       ├── ImagingTab.js        # DICOM viewer
│       ├── DocumentationTab.js  # Standard notes
│       ├── DocumentationTabEnhanced.js # Enhanced notes
│       ├── CarePlanTab.js       # Standard care planning
│       ├── CarePlanTabEnhanced.js # Enhanced care planning
│       ├── TimelineTab.js       # Standard timeline
│       └── TimelineTabEnhanced.js # Enhanced timeline
├── layouts/
│   ├── ClinicalLayout.js        # Legacy layout (V3)
│   └── EnhancedClinicalLayout.js # New modular layout
└── performance/
    └── optimizations.js         # Performance utilities
```

### State Management
- Uses `FHIRResourceContext` for data management
- Integrates with `ClinicalWorkflowContext` for events
- Implements progressive loading for performance

### Version Comparison

#### ClinicalWorkspaceV3 (Legacy)
- **Architecture**: Self-contained with integrated layout
- **State**: Manages own activeTab state internally
- **Dependencies**: 
  - SafeBadge, EnhancedPatientHeader, WorkspaceContent
  - ClinicalLayout, CDSContext
- **Features**: CDS alerts display, layout builder, custom layouts
- **Tab Components**: Standard versions

#### ClinicalWorkspaceEnhanced (Current)
- **Architecture**: Modular, designed for EnhancedClinicalLayout
- **State**: Receives activeModule from parent via props
- **Dependencies**:
  - TabErrorBoundary, KeyboardShortcutsDialog
  - ClinicalWorkflowContext (no CDSContext)
- **Features**: Keyboard navigation, error boundaries, event integration
- **Tab Components**: Optimized/enhanced versions with better performance

#### Migration Strategy
```javascript
// Replace V3 with Wrapper
import ClinicalWorkspaceWrapper from './ClinicalWorkspaceWrapper';

// Wrapper manages state coordination
<ClinicalWorkspaceWrapper />
```

## Key Components

### ClinicalWorkspaceWrapper.js
Bridge component that coordinates between layout and workspace.

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
import { fhirClient } from '../../../core/fhir/services/fhirClient';

function OrderComponent() {
  const { publish } = useClinicalWorkflow();
  
  const handleOrderSubmit = async (orderData) => {
    const order = await fhirClient.create('ServiceRequest', orderData);
    
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

- **2025-01-20**: Updated documentation for V3 and Enhanced workspace versions
- **2025-01-19**: Added ClinicalWorkspaceEnhanced with modular architecture
- **2025-01-17**: Documented module structure and patterns
- **2025-01-15**: Added progressive loading for performance
- **2025-01-10**: Integrated WebSocket for real-time updates
- **2025-01-05**: Implemented cross-tab event system

## Performance Optimizations

The Enhanced version includes significant performance improvements:
- **Lazy Loading**: All tabs use webpack chunk optimization
- **Memoization**: Components wrapped with React.memo
- **Virtual Scrolling**: For long lists in tabs
- **Error Boundaries**: Prevent tab crashes from affecting workspace
- **Progressive Loading**: Load critical resources first

See `/frontend/src/components/clinical/performance/optimizations.js` for utilities.

## Related Documentation

- [Clinical Components CLAUDE.md](/frontend/src/components/clinical/CLAUDE.md) - Component patterns and guidelines
- [Frontend Services CLAUDE.md](/frontend/src/services/CLAUDE.md) - Service layer documentation
- [Cross-Module Integration](../integration/cross-module-integration.md) - Event system documentation
- [Main CLAUDE.md](../../../CLAUDE.md) - Project overview and quick reference

---

**Questions?** 
- For component-specific guidance, check `/frontend/src/components/clinical/CLAUDE.md`
- For general project reference, see `/CLAUDE.md` or `/CLAUDE-REFERENCE.md`