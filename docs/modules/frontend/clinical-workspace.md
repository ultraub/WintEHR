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
├── shared/                      # Shared UI components (added 2025-01-23)
│   ├── ClinicalResourceCard.js  # Base card with severity borders
│   ├── ClinicalSummaryCard.js   # Summary statistics card
│   ├── ClinicalFilterPanel.js   # Unified filter panel
│   ├── ClinicalDataGrid.js      # Consistent data table
│   ├── ClinicalEmptyState.js    # Standardized empty states
│   ├── ClinicalLoadingState.js  # Skeleton loaders
│   ├── index.js                 # Shared components export
│   └── templates/               # FHIR resource card templates
│       ├── ConditionCardTemplate.js
│       ├── MedicationCardTemplate.js
│       ├── AllergyCardTemplate.js
│       ├── ObservationCardTemplate.js
│       ├── ProcedureCardTemplate.js
│       ├── DocumentCardTemplate.js
│       └── index.js
├── workspace/
│   ├── EnhancedPatientHeader.js # Patient banner (V3 only)
│   ├── WorkspaceContent.js      # Content wrapper (V3 only)
│   ├── TabErrorBoundary.js      # Error handling (Enhanced only)
│   └── tabs/
│       ├── SummaryTab.js        # Patient summary
│       ├── ChartReviewTab.js    # Standard version
│       ├── ChartReviewTabOptimized.js # Enhanced version (updated 2025-01-23)
│       ├── EncountersTab.js     # Visit history
│       ├── ResultsTab.js        # Standard version
│       ├── ResultsTabOptimized.js # Enhanced version
│       ├── OrdersTab.js         # Standard CPOE
│       ├── EnhancedOrdersTab.js # Enhanced CPOE (updated 2025-01-23)
│       ├── PharmacyTab.js       # Medication management (updated 2025-01-23)
│       ├── ImagingTab.js        # DICOM viewer (updated 2025-01-23)
│       ├── DocumentationTab.js  # Standard notes
│       ├── DocumentationTabEnhanced.js # Enhanced notes (updated 2025-01-23)
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

### ChartReviewTabOptimized.js (Enhanced Version)
Comprehensive patient clinical overview with all major FHIR resources.

**Features**:
- **Core Clinical Data**: Conditions, Medications, Allergies with enhanced cards
- **Additional Resources** (as of 2025-01-23):
  - Immunizations with vaccine series tracking
  - Procedures with outcomes and body site info
  - Care Plans with goals and activities
  - Clinical Documents with preview capability
- **Views**: Dashboard (default), Timeline, List views
- **Real-time Updates**: Auto-refresh on resource changes
- **Professional UI**: Sharp corners, clinical color coding, alternating rows
- **Search & Filter**: Full-text search, date range filters, status filters
- **Clinical Alerts**: Polypharmacy, critical allergies, overdue immunizations

**Data Hook**: `useChartReviewResources` provides all FHIR resources:
```javascript
const { 
  conditions, medications, allergies, immunizations,
  observations, procedures, encounters, carePlans, 
  documentReferences, loading, error, refresh, stats
} = useChartReviewResources(patientId);
```

### ChartReviewTab.js
Displays problems, medications, allergies, and immunizations.

```javascript
// Key pattern: Resource loading
const { resources, loading } = usePatientResources(patient?.id, [
  'Condition', 'MedicationRequest', 'AllergyIntolerance', 'Immunization'
]);
```

### ResultsTabOptimized.js (Enhanced Version)
Comprehensive results viewer with lab results, vital signs, and diagnostic reports.

**Features** (Updated 2025-01-23):
- **Harmonized UI**: Uses shared clinical components for consistency
- **Three Data Types**: Lab observations, vital signs, diagnostic reports
- **View Modes**: Table (default), Cards, Trends (for observations)
- **Advanced Filtering**: Search, date range, result status (normal/abnormal)
- **Real-time Updates**: Auto-refresh capability
- **Professional Styling**: Sharp corners, alternating rows, clinical color coding

**Key Improvements**:
- Replaced custom cards with `ObservationCardTemplate`
- Implemented `ClinicalFilterPanel` for unified filtering
- Added `ClinicalLoadingState` for consistent skeleton screens
- Applied `ClinicalEmptyState` for better empty/error handling
- Standardized chips with 4px border radius
- Added alternating row backgrounds in table view

```javascript
// Key pattern: Consolidated data fetching
const [allData, setAllData] = useState({
  labObservations: [],
  vitalObservations: [],
  diagnosticReports: [],
  loading: false,
  error: null
});

// Using shared components
<ObservationCardTemplate
  observation={item}
  onEdit={() => handleViewDetails(item)}
  isAlternate={index % 2 === 1}
/>
```

### OrdersTab.js / EnhancedOrdersTab.js
Computerized Physician Order Entry (CPOE) interface with comprehensive order management.

**EnhancedOrdersTab Features** (Updated 2025-01-23):
- **Advanced Search**: Uses `useAdvancedOrderSearch` hook with real-time filtering
- **Multi-type Support**: Medications, lab orders, imaging orders, and service requests
- **Real Provider Data**: Loads actual practitioners, locations, and organizations from FHIR
- **Statistics Panel**: Comprehensive order metrics with type breakdown
- **Unified Filtering**: ClinicalFilterPanel with custom order-specific filters
- **Order Actions**: View details, edit, cancel, send to pharmacy, reorder
- **Virtual Scrolling**: Handles large order lists efficiently

```javascript
// Key pattern: Event publishing
await publish(CLINICAL_EVENTS.ORDER_PLACED, {
  orderId: order.id,
  type: orderType,
  patient: patient.id
});

// Key pattern: Advanced search with filters
const {
  filters,
  entries,
  total,
  loading,
  error,
  analytics: statistics,
  hasActiveFilters,
  updateFilters,
  search: refreshSearch,
  getRelatedOrders
} = useAdvancedOrderSearch({ patientId, autoSearch: true });

// Key pattern: Order action handling
const handleOrderAction = async (order, action) => {
  switch (action) {
    case 'view':
      setSelectedResult(order);
      setDetailsDialogOpen(true);
      break;
    case 'cancel':
      if (confirm('Cancel order?')) {
        await fhirClient.update(order.resourceType, order.id, 
          { ...order, status: 'cancelled' });
        refreshSearch();
      }
      break;
    // ... other actions
  }
};
```

## Navigation System

### Overview
The clinical workspace uses a centralized navigation system that supports deep linking, browser history, and resource-specific navigation.

### Navigation Helper
**Location**: `/frontend/src/components/clinical/utils/navigationHelper.js`

```javascript
import { TAB_IDS, navigateToTab, navigateToResource } from '../../utils/navigationHelper';

// Navigate to a specific tab
onNavigateToTab(TAB_IDS.RESULTS);

// Navigate to a specific resource
navigateToResource(onNavigateToTab, 'Observation', 'observation-123');
```

### Tab IDs
Standardized tab identifiers:
- `summary` - Patient summary dashboard
- `chart-review` - Problems, medications, allergies
- `encounters` - Visit history
- `results` - Lab results and observations
- `orders` - Order management
- `pharmacy` - Medication dispensing
- `imaging` - Medical imaging
- `documentation` - Clinical notes
- `care-plan` - Care coordination
- `timeline` - Event timeline

### Query Parameters
Supported URL parameters:
- `tab` - Active tab identifier
- `resourceId` - FHIR resource ID to highlight
- `resourceType` - FHIR resource type
- `action` - Action to perform (view, edit, etc.)

Example: `/clinical/patient-123?tab=results&resourceId=obs-456&resourceType=Observation`

### Navigation Props
All tab components receive:
```javascript
<TabComponent
  patientId={patientId}
  patient={patient}
  onNavigateToTab={handleTabChange}
  navigationContext={navigationContext}
/>
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

## Shared Clinical Components (New)

As of 2025-01-23, a comprehensive shared component library has been created to standardize UI across all clinical tabs.

### Core Components

#### ClinicalResourceCard
Base card component with severity-based styling.
```javascript
import { ClinicalResourceCard } from '../shared';

<ClinicalResourceCard
  title="Hypertension"
  severity="moderate"  // critical, high, moderate, low, normal
  status="active"
  statusColor="error"
  icon={<ConditionIcon />}
  details={[
    { label: 'Onset', value: 'Jan 15, 2024' },
    { label: 'Severity', value: 'Moderate' }
  ]}
  onEdit={() => handleEdit(resource)}
  isAlternate={index % 2 === 1}  // For row striping
/>
```

#### ClinicalSummaryCard
Summary statistics card for dashboard views.
```javascript
<ClinicalSummaryCard
  title="Active Conditions"
  value={12}
  severity="high"
  icon={<ConditionIcon />}
  chips={[
    { label: '3 Chronic', color: 'error' }
  ]}
  trend={{ direction: 'up', value: '+2', label: 'this month' }}
/>
```

#### ClinicalFilterPanel
Unified filter panel matching Chart Review gold standard.
```javascript
<ClinicalFilterPanel
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  onRefresh={handleRefresh}
  scrollContainerRef={scrollRef}  // For auto-collapse on scroll
/>
```

#### ClinicalDataGrid
Consistent data table with sorting, filtering, and pagination.
```javascript
<ClinicalDataGrid
  columns={[
    { field: 'name', headerName: 'Test Name', sortable: true },
    { field: 'value', headerName: 'Result', renderCell: ({ value, row }) => (
      <ResultCell value={value} interpretation={row.interpretation} />
    )}
  ]}
  rows={labResults}
  onRowClick={handleRowClick}
  selectable
  dense={isMobile}
/>
```

#### ClinicalEmptyState & ClinicalLoadingState
Standardized empty and loading states.
```javascript
// Empty state
<ClinicalEmptyState
  title="No results found"
  message="Try adjusting your search criteria"
  actions={[
    { label: 'Clear Filters', onClick: clearFilters }
  ]}
/>

// Loading state
<ClinicalLoadingState.ResourceCard count={5} />
<ClinicalLoadingState.Table rows={10} columns={4} />
```

### FHIR Resource Templates

Pre-built templates for common FHIR resources:

```javascript
import { 
  ConditionCardTemplate,
  MedicationCardTemplate,
  AllergyCardTemplate,
  ObservationCardTemplate,
  ProcedureCardTemplate,
  DocumentCardTemplate
} from '../shared/templates';

// Direct usage
<ConditionCardTemplate 
  condition={fhirCondition}
  onEdit={() => openDialog(fhirCondition)}
  isAlternate={index % 2 === 1}
/>
```

### Design Standards

All shared components follow these standards:
- **Sharp corners**: `borderRadius: 0` for professional appearance
- **4px left borders**: Visual hierarchy with severity colors
- **Consistent spacing**: 16px padding, 8px gaps
- **Alternating backgrounds**: Better readability in lists
- **Clinical color coding**: Error (red), Warning (orange), Success (green), Info (blue)

## Recent Updates

- **2025-01-24**: Navigation System Improvements:
  - Standardized all tab parameter names (chart → chart-review, careplan → care-plan)
  - Added comprehensive query parameter support for deep linking
  - Created centralized navigation helper utility (`/frontend/src/components/clinical/utils/navigationHelper.js`)
  - Enhanced breadcrumb navigation with resource context display
  - Fixed state management and URL synchronization in ClinicalWorkspaceWrapper
  - Improved back button behavior with proper state handling
  - Navigation now supports: `?tab=results&resourceId=123&resourceType=Observation&action=view`

- **2025-01-23**: Harmonized CarePlanTabEnhanced with shared components:
  - Replaced old UI components (MetricsBar, ResourceTimeline, ContextualFAB) with new shared clinical components
  - Updated EnhancedGoalCard to use ClinicalResourceCard as the base component with severity indicators based on goal status and due dates
  - Replaced MetricsBar with multiple ClinicalSummaryCard components displaying goal metrics
  - Applied ClinicalFilterPanel to all tab views (Goals, Activities, Care Team, Timeline)
  - Used ClinicalDataGrid for goal list view with progress indicators and status chips
  - Replaced ResourceTimeline with simplified List component in timeline view with alternating row backgrounds
  - Replaced Alert components with ClinicalEmptyState for activities and care team empty states
  - Applied sharp corners design pattern to all dialogs, buttons, cards, and FAB
  - Standardized all chip components with 4px border radius
  - Fixed spacing and padding to match clinical standards (16px cards, 24px sections)
  - Replaced ContextualFAB with simple FAB button for adding new goals
  - Maintained goal progress tracking with LinearProgress components
  - Enhanced timeline view with item-specific icons and status indicators
- **2025-01-23**: Harmonized DocumentationTabEnhanced with shared components:
  - Replaced old UI components (ClinicalCard, MetricsBar, ResourceTimeline, SmartTable, ContextualFAB, DensityControl) with new shared clinical components
  - Updated EnhancedNoteCard to use ClinicalResourceCard base component with severity-based styling
  - Replaced MetricsBar with multiple ClinicalSummaryCard components for documentation metrics
  - Replaced custom filter panel with ClinicalFilterPanel while keeping tree view filters
  - Replaced SmartTable with ClinicalDataGrid for document table view
  - Simplified timeline view using standard List components with alternating backgrounds
  - Replaced Alert with ClinicalEmptyState for better empty state handling
  - Applied sharp corners design pattern to all buttons, dialogs, selects, and paper components
  - Standardized spacing and padding according to clinical design standards
  - Removed framer-motion animations for consistency with harmonized components
  - Added proper loading states using ClinicalLoadingState components
  - Fixed all chip border radius to use 4px standard
  - Replaced ContextualFAB with simple FAB button with sharp corners
  - Maintained tree view structure with proper clinical styling
- **2025-01-23**: Harmonized ImagingTab with shared components:
  - Replaced old UI components (ClinicalCard, MetricsBar, ResourceTimeline, SmartTable, ContextualFAB, DensityControl) with new shared clinical components
  - Updated ImagingStudyCard to use ClinicalResourceCard for standard card view while keeping gallery view
  - Replaced MetricsBar with multiple ClinicalSummaryCard components for imaging metrics
  - Replaced SmartTable with ClinicalDataGrid for imaging studies table view
  - Replaced Timeline view with simple card list view using alternating backgrounds
  - Replaced Alert with ClinicalEmptyState for better empty state handling
  - Applied sharp corners design pattern to all buttons, dialogs, and select components
  - Standardized spacing and padding according to clinical design standards
  - Removed framer-motion animations and AnimatePresence for consistency
  - Added proper loading states using ClinicalLoadingState
  - Fixed all chip border radius to use 4px standard
  - Maintained body map view with sharp corners and clinical styling
  - Kept DICOM viewer integration unchanged
- **2025-01-23**: Harmonized PharmacyTab with shared components:
  - Replaced old UI components (ClinicalCard, ResourceTimeline, MetricsBar, SmartTable, ViewControls, ContextualFAB) with new shared clinical components
  - Updated MedicationRequestCard and RefillRequestCard to use ClinicalResourceCard base component
  - Replaced MetricsBar with multiple ClinicalSummaryCard components for pharmacy metrics
  - Replaced SmartTable with ClinicalDataGrid for medication table view
  - Simplified timeline view using standard List components instead of ResourceTimeline
  - Replaced Alert with ClinicalEmptyState for better empty state handling
  - Applied sharp corners design pattern to all buttons, dialogs, and input components
  - Standardized spacing and padding according to clinical design standards (16px cards, 24px sections)
  - Enhanced DispenseDialog with prescription context information and professional styling
  - Removed framer-motion animations for consistency with harmonized components
  - Added proper loading states using ClinicalLoadingState
  - Fixed all chip border radius to use 4px standard
- **2025-01-23**: Harmonized TimelineTabEnhanced with shared components:
  - Simplified complex multi-track timeline to three view modes (cards, list, timeline)
  - Replaced custom components with shared clinical components (ClinicalResourceCard, ClinicalFilterPanel)
  - Removed complex state management (zoom, pan, hover tracking) for cleaner implementation
  - Applied consistent styling with sharp corners and clinical colors throughout
  - Ensured mobile responsiveness with appropriate spacing adjustments
  - Streamlined event visualization using existing UI patterns
  - Fixed missing imports and removed references to non-existent components
  - Maintained all core functionality while improving code maintainability
- **2025-01-23**: Harmonized EnhancedOrdersTab with shared components:
  - Replaced mock data with real FHIR resource loading for providers, locations, and organizations
  - Implemented ClinicalFilterPanel for consistent filtering with custom order-specific filters
  - Applied ClinicalResourceCard via temporary OrderCard component with severity-based coloring
  - Added ClinicalLoadingState and ClinicalEmptyState for better user experience
  - Enhanced OrderStatisticsPanel with comprehensive metrics and ClinicalSummaryCard
  - Applied sharp corners design pattern to all UI elements
  - Used clinical theme utilities for consistent color schemes
  - Added proper error handling with detailed snackbar notifications
  - Created order details dialog with full resource data display
- **2025-01-23**: Harmonized ResultsTabOptimized with shared components:
  - Replaced custom cards with ObservationCardTemplate
  - Implemented ClinicalFilterPanel for consistent filtering
  - Added ClinicalLoadingState and ClinicalEmptyState
  - Applied sharp corners and alternating row backgrounds
  - Standardized chip styling with 4px border radius
- **2025-01-23**: Created shared clinical component library:
  - Implemented 6 core shared components based on Chart Review gold standard
  - Created FHIR resource card templates for all major resource types
  - Established clinical design standards with sharp corners and severity indicators
  - Added comprehensive loading states to prevent layout shift
  - Created standardized empty states with helpful actions
  - Documented in new Clinical UI Harmonization Plan
- **2025-01-23**: Enhanced Chart Review tab with comprehensive clinical resources:
  - Added Immunizations section with vaccine details and series tracking
  - Added Procedures section with procedure outcomes and body site info
  - Added Care Plans section with goals and activities display
  - Added Clinical Documents section with document preview capability
  - Updated useChartReviewResources hook to fetch CarePlan and DocumentReference data
  - Implemented EnhancedCard components for all new resource types
  - Added stub dialogs for CarePlan and DocumentReference
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