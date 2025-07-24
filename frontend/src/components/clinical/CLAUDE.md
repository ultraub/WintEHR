# CLAUDE.md - Clinical UI Components Quick Reference

**Purpose**: Essential guide for AI agents working with WintEHR's clinical user interface components.

**Last Updated**: 2025-01-23

## 🎯 Overview

This directory contains clinical-specific React components that power WintEHR's user interface:
- Clinical workspace with specialized tabs
- Reusable clinical UI components
- Performance-optimized implementations
- Real-time clinical data visualization
- DICOM medical imaging viewer
- Clinical decision support integration

## 📁 Directory Structure

```
frontend/src/components/clinical/
├── ClinicalWorkspaceV3.js      # Legacy workspace (self-contained)
├── ClinicalWorkspaceEnhanced.js # New workspace (modular)
├── ClinicalWorkspaceWrapper.js  # Bridge component
├── shared/                      # Shared UI components (NEW 2025-01-23)
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
├── workspace/                    # Workspace components
│   ├── EnhancedPatientHeader.js # Patient header (V3 only)
│   ├── WorkspaceContent.js      # Content wrapper (V3 only)
│   ├── TabErrorBoundary.js      # Error handling (Enhanced only)
│   ├── tabs/                     # Clinical tabs (both versions)
│   │   ├── SummaryTab.js        # Patient summary (shared)
│   │   ├── ChartReviewTab.js    # DEPRECATED - V3 only
│   │   ├── ChartReviewTabOptimized.js  # ✅ Current version
│   │   ├── EncountersTab.js     # Visit history (shared)
│   │   ├── ResultsTab.js        # DEPRECATED - V3 only
│   │   ├── ResultsTabOptimized.js      # ✅ Current version
│   │   ├── OrdersTab.js         # DEPRECATED - V3 only
│   │   ├── EnhancedOrdersTab.js # ✅ Current version
│   │   ├── PharmacyTab.js       # Medication management (shared)
│   │   ├── ImagingTab.js        # DICOM viewer (shared)
│   │   ├── DocumentationTab.js  # DEPRECATED - V3 only
│   │   ├── DocumentationTabEnhanced.js # ✅ Current version
│   │   ├── CarePlanTab.js       # DEPRECATED - V3 only
│   │   ├── CarePlanTabEnhanced.js     # ✅ Current version
│   │   ├── TimelineTab.js       # DEPRECATED - V3 only
│   │   └── TimelineTabEnhanced.js     # ✅ Current version
│   ├── dialogs/                  # Modal dialogs
│   └── sections/                 # Reusable sections
├── layouts/                      # Layout components
│   ├── ClinicalLayout.js        # Legacy layout (V3)
│   └── EnhancedClinicalLayout.js # New modular layout
├── ui/                           # UI utilities
│   └── KeyboardShortcutsDialog.js # Keyboard help (Enhanced)
├── common/                       # Shared components (legacy)
│   ├── SafeBadge.js             # Safe rendering badge (V3 only)
│   ├── ClinicalCard.js          # Context-aware cards
│   ├── StatusChip.js            # Status indicators
│   ├── ClinicalDataTable.js     # Data tables
│   ├── LoadingStates.js         # Skeleton screens
│   └── MetricCard.js            # Key metrics display
├── performance/                  # Performance utils
│   └── optimizations.js         # Optimization configs
├── medications/                  # Medication components
├── results/                      # Lab result components
├── imaging/                      # Imaging components
└── orders/                       # Order components
```

## 🔄 Workspace Architecture

### Current Implementation (2025-01-24)
The clinical workspace has been streamlined to use a single, modular architecture.

### ClinicalWorkspaceEnhanced (Current)
Modular workspace designed to work with EnhancedClinicalLayout.

**Dependency Graph:**
```
ClinicalWorkspaceEnhanced
├── React Core (useState, useEffect, useCallback, Suspense, useMemo)
├── React Router (useParams, useLocation, useNavigate)
├── Material-UI Components (streamlined)
├── Internal Components
│   ├── TabErrorBoundary (NEW)
│   └── KeyboardShortcutsDialog (NEW)
├── Contexts
│   ├── FHIRResourceContext
│   ├── AuthContext
│   └── ClinicalWorkflowContext (NEW - events)
├── Custom Hooks
│   └── useKeyboardNavigation (NEW)
├── Lazy Loaded Components
│   └── All Tab Components (optimized/enhanced versions)
└── Utilities
    └── decodeFhirId
```

**Key Improvements:**
- Receives activeModule from parent
- Error boundaries for each tab
- Keyboard navigation support
- Clinical workflow event integration
- Performance-optimized tab components

### ClinicalWorkspaceWrapper
Bridge component that coordinates between layout and workspace.

```javascript
// Manages state and URL synchronization
const ClinicalWorkspaceWrapper = () => {
  const [activeModule, setActiveModule] = useState('summary');
  
  return (
    <>
      <EnhancedClinicalLayout 
        activeModule={activeModule}
        onModuleChange={setActiveModule}
      />
      <ClinicalWorkspaceEnhanced 
        activeModule={activeModule}
        onModuleChange={setActiveModule}
      />
    </>
  );
};
```

### Key Features
- Modular architecture with separation of concerns
- Enhanced performance with lazy loading
- Keyboard navigation support
- Clinical workflow event integration
- Error boundaries for each tab
- Streamlined state management

**Current Tab Components:**
| Component | Location | Key Features |
|-----------|----------|--------------|
| ChartReviewTabOptimized | workspace/tabs/ | Virtual scrolling, memoization |
| ResultsTabOptimized | workspace/tabs/ | Trend visualization, batch loading |
| EnhancedOrdersTab | workspace/tabs/ | Real-time updates, catalog integration |
| DocumentationTabEnhanced | workspace/tabs/ | Rich text editor, templates |
| CarePlanTabEnhanced | workspace/tabs/ | Goal tracking, timeline view |
| TimelineTabEnhanced | workspace/tabs/ | Event grouping, filtering |

### ⚠️ Cleanup Completed (2025-01-24)

**Removed Components:**
- All deprecated tab versions (ChartReviewTab, ResultsTab, OrdersTab, etc.)
- Legacy workspace components (ClinicalWorkspaceV3, ClinicalWorkspaceDemo, SimpleClinicalDemo)
- Old patient headers (PatientHeader, PatientOverview, EnhancedPatientHeader, CollapsiblePatientHeader)
- Old layout (ClinicalLayout)
- Test/demo components
- Experimental components (already removed earlier)

## ⚠️ Critical Rules

### Component Development Standards
- **ALWAYS use React.memo** for component optimization
- **ALWAYS implement loading states** with skeleton screens
- **ALWAYS handle null/undefined data** gracefully
- **NEVER hardcode patient data** - use FHIR services
- **NEVER leave console.log** statements in components

### Performance Requirements
- Initial load: <3s on 3G networks
- Bundle size: <500KB per chunk
- Re-render optimization: Use memo, useCallback, useMemo
- Virtual scrolling for lists >50 items

### Data Handling
```javascript
// ALWAYS check data existence
const medications = patient?.medications || [];

// ALWAYS use proper error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <ClinicalComponent />
</ErrorBoundary>

// ALWAYS show loading states
if (loading) return <ClinicalSkeleton />;
if (error) return <ClinicalError error={error} />;
```

### State Management
```javascript
// Use contexts for shared state
const { patient, loading, error } = usePatientContext();

// Use local state for UI-only state
const [activeTab, setActiveTab] = useState(0);

// Use event system for cross-module communication
const { publish, subscribe } = useClinicalWorkflow();
```

## 🔧 Key Component Patterns

### Clinical Card Pattern
```javascript
import { ClinicalCard } from '../common/ClinicalCard';

<ClinicalCard
  title="Active Conditions"
  severity="warning"  // info, warning, critical
  actions={[...]}
  loading={loading}
>
  {/* Card content */}
</ClinicalCard>
```

### Clinical Tab Pattern
```javascript
const OptimizedTab = React.memo(() => {
  const { resources, loading, error } = useFHIRResources({
    resourceTypes: ['Condition', 'MedicationRequest'],
    patient: patientId,
    options: { 
      progressive: true,
      priority: 'critical'
    }
  });

  if (loading) return <TabSkeleton />;
  if (error) return <TabError error={error} />;
  
  return <TabContent resources={resources} />;
});
```

### Clinical Dialog Pattern
```javascript
<ClinicalDialog
  open={open}
  onClose={handleClose}
  title="Order Medication"
  actions={[
    { label: 'Cancel', onClick: handleClose },
    { label: 'Order', onClick: handleOrder, variant: 'primary' }
  ]}
>
  {/* Dialog content */}
</ClinicalDialog>
```

### Performance Optimization Pattern
```javascript
// Use lazy loading for tabs
const ChartReviewTab = lazy(() => import(
  /* webpackChunkName: "chart-review" */
  './tabs/ChartReviewTabOptimized'
));

// Use virtual scrolling for long lists
import { VirtualList } from '../common/VirtualList';

<VirtualList
  items={medications}
  itemHeight={64}
  renderItem={(med) => <MedicationItem medication={med} />}
/>
```

## 📊 UI Component Library

| Component | Location | Purpose |
|-----------|----------|---------|
| ClinicalWorkspace | workspace/ClinicalWorkspace.js | Main clinical interface container |
| ClinicalCard | common/ClinicalCard.js | Severity-aware content cards |
| StatusChip | common/StatusChip.js | Status indicators with urgency |
| ClinicalDataTable | common/ClinicalDataTable.js | Sortable, filterable data tables |
| LoadingStates | common/LoadingStates.js | Skeleton screens for all components |
| MetricCard | common/MetricCard.js | Key metric displays |
| VirtualList | common/VirtualList.js | Virtual scrolling for performance |
| ClinicalDialog | common/ClinicalDialog.js | Modal dialogs with clinical context |

## ⚡ Performance Utilities

### Available Hooks
```javascript
import { 
  useRenderOptimization,
  useVirtualScrolling,
  useDebounce,
  useThrottle 
} from '../performance/hooks';

// Track render performance
const { renderCount } = useRenderOptimization();

// Debounce search input
const debouncedSearch = useDebounce(searchTerm, 300);

// Throttle scroll events
const throttledScroll = useThrottle(handleScroll, 100);
```

### Optimization Utilities
```javascript
import { 
  lazyLoadTabs,
  RESOURCE_PRIORITIES,
  performanceMonitor,
  memoryCleanup 
} from '../performance/optimizations';

// Monitor component performance
performanceMonitor.mark('component-start');
// ... component logic
performanceMonitor.measure('component-render', 'component-start', 'component-end');

// Clean up on unmount
useEffect(() => {
  return () => memoryCleanup.clearReferences(refs);
}, []);
```

## 🧭 Navigation System

### Navigation Props Pattern
All tab components now receive navigation props for consistent navigation:

```javascript
// Tab components receive onNavigateToTab prop
<TabComponent
  patientId={patientId}
  patient={patient}
  onNavigateToTab={handleTabChange}
  navigationContext={navigationContext}
/>

// Usage within tabs
import { TAB_IDS } from '../utils/navigationHelper';

const handleResourceClick = (resource) => {
  onNavigateToTab(TAB_IDS.RESULTS, {
    resourceId: resource.id,
    resourceType: resource.resourceType,
    action: 'view'
  });
};
```

### Standardized Tab IDs
Use constants from navigationHelper for consistent tab references:

```javascript
import { TAB_IDS } from '../utils/navigationHelper';

// Available tab IDs:
TAB_IDS.SUMMARY         // 'summary'
TAB_IDS.CHART_REVIEW   // 'chart-review'
TAB_IDS.ENCOUNTERS     // 'encounters'
TAB_IDS.RESULTS        // 'results'
TAB_IDS.ORDERS         // 'orders'
TAB_IDS.PHARMACY       // 'pharmacy'
TAB_IDS.IMAGING        // 'imaging'
TAB_IDS.DOCUMENTATION  // 'documentation'
TAB_IDS.CARE_PLAN      // 'care-plan'
TAB_IDS.TIMELINE       // 'timeline'
```

### Deep Linking Support
Navigation supports query parameters for deep linking:

```javascript
// Navigate to specific resource
import { navigateToResource } from '../utils/navigationHelper';

navigateToResource(onNavigateToTab, 'Observation', 'obs-123');

// Results in: /clinical/patient-123?tab=results&resourceId=obs-123&resourceType=Observation
```

### Navigation Helper Utilities
```javascript
import { 
  TAB_IDS,
  navigateToTab,
  navigateToResource,
  getTabForResourceType,
  parseNavigationParams
} from '../utils/navigationHelper';

// Navigate to tab with context
navigateToTab(onNavigateToTab, TAB_IDS.ORDERS, {
  action: 'create',
  orderType: 'medication'
});

// Get appropriate tab for resource type
const tabId = getTabForResourceType('MedicationRequest'); // returns 'chart-review'

// Parse URL parameters
const context = parseNavigationParams(searchParams);
// { tab: 'results', resourceId: 'obs-123', resourceType: 'Observation' }
```

## 🎨 Clinical Context Integration

### Theme Awareness
```javascript
// Components adapt to clinical severity
const theme = useClinicalTheme();
const severityColor = theme.getSeverityColor(condition.severity);

// Automatic theming based on context
<ClinicalCard severity={getSeverity(labResult)}>
  {/* Card adapts color based on severity */}
</ClinicalCard>
```

### CDS Integration
```javascript
// Components can trigger CDS evaluations
const { evaluateCDS } = useCDSHooks();

const handleMedicationOrder = async (medication) => {
  const alerts = await evaluateCDS('medication-prescribe', {
    patient: patientId,
    medications: [medication]
  });
  
  if (alerts.length > 0) {
    showCDSAlerts(alerts);
  }
};
```

## 🚀 Development Workflow

### Creating New Clinical Components
```bash
# 1. Create component file
touch src/components/clinical/[module]/NewComponent.js

# 2. Use clinical component template
import React, { memo } from 'react';
import { useFHIRResource } from '@/hooks/useFHIRResource';
import { ClinicalCard } from '../common/ClinicalCard';
import { LoadingStates } from '../common/LoadingStates';

const NewComponent = memo(({ patientId }) => {
  const { data, loading, error } = useFHIRResource({
    resourceType: 'ResourceType',
    patient: patientId
  });

  if (loading) return <LoadingStates.Card />;
  if (error) return <ClinicalError error={error} />;

  return (
    <ClinicalCard title="Component Title">
      {/* Component content */}
    </ClinicalCard>
  );
});

NewComponent.displayName = 'NewComponent';
export default NewComponent;

# 3. Add to lazy loading if it's a tab
# 4. Test with multiple patients
# 5. Verify performance metrics
```

## 📍 Important Component Locations (Updated 2025-01-24)

### UI Components with Non-Obvious Names
- **ContextualFAB**: Located in `ui/QuickActionFAB.js` (not ContextualFAB.js)
- **ClinicalCard**: Two versions exist:
  - `common/ClinicalCard.js` - Legacy version
  - `ui/ClinicalCard.js` - UI utilities version
- **ResourceTimeline**: Located in `ui/ResourceTimeline.js`
- **SmartTable**: Located in `ui/SmartTable.js`

### Shared Components Export Pattern
```javascript
// Import from shared index
import { 
  ClinicalResourceCard,
  ClinicalSummaryCard,
  ClinicalFilterPanel,
  ClinicalDataGrid,
  ClinicalEmptyState,
  ClinicalLoadingState
} from '../../shared';

// Import templates separately
import { DocumentCardTemplate } from '../../shared/templates';
```

### Common Import Patterns
```javascript
// UI Components
import { ContextualFAB } from '../../ui/QuickActionFAB';
import ResourceTimeline from '../../ui/ResourceTimeline';
import SmartTable from '../../ui/SmartTable';
import MetricsBar from '../../ui/MetricsBar';

// Animation Libraries
import { motion, AnimatePresence } from 'framer-motion';

// Tree View Components
import { TreeView } from '@mui/x-tree-view/TreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
```

## 🚨 Common Import Errors & Fixes (Updated 2025-01-24)

### Import Path Issues
```javascript
// ❌ Wrong - Looking for wrong filename
import ContextualFAB from '../../ui/ContextualFAB';

// ✅ Correct - Component exported from QuickActionFAB.js
import { ContextualFAB } from '../../ui/QuickActionFAB';
```

### TypeScript Syntax in JavaScript Files
```javascript
// ❌ Wrong - TypeScript syntax in .js file
color: getModalityColor(mod) as any

// ✅ Correct - Plain JavaScript
color: getModalityColor(mod)
```

### Missing Material-UI Imports
```javascript
// ❌ Incomplete imports
import { Box, Stack } from '@mui/material';
// Using Typography, IconButton, useTheme without importing

// ✅ Complete imports
import { 
  Box, 
  Stack, 
  Typography,
  IconButton,
  useTheme 
} from '@mui/material';
```

### Undefined Variables in Components
```javascript
// ❌ Using undefined variables
<Component severity={severity} metrics={metrics} />
// Where severity and metrics are not defined

// ✅ Define or provide defaults
const severity = 'normal'; // or calculate based on logic
// OR remove if not needed
<Component severity="normal" />
```

### Missing Component State
```javascript
// ❌ Using state without defining
{expanded ? 'Show More' : 'Show Less'}

// ✅ Define state in component
const [expanded, setExpanded] = useState(false);
```

## 🐛 Common Issues & Solutions

### Performance Issues
```javascript
// Problem: Slow rendering
// Solution: Use React.memo and optimization hooks
const OptimizedComponent = memo(Component, (prevProps, nextProps) => {
  return prevProps.patientId === nextProps.patientId;
});

// Problem: Large lists lag
// Solution: Implement virtual scrolling
<VirtualList items={items} itemHeight={64} />
```

### Data Loading Issues
```javascript
// Problem: Null reference errors
// Solution: Always use optional chaining
const medicationName = medication?.code?.coding?.[0]?.display || 'Unknown';

// Problem: Race conditions
// Solution: Use abort controllers
useEffect(() => {
  const controller = new AbortController();
  fetchData(controller.signal);
  return () => controller.abort();
}, [dependency]);
```

### UI Consistency Issues
```javascript
// Problem: Inconsistent styling
// Solution: Use clinical theme system
const classes = useClinicalStyles();

// Problem: Different loading states
// Solution: Use standardized skeletons
import { LoadingStates } from '../common/LoadingStates';
if (loading) return <LoadingStates.Table rows={5} />;
```

## 📝 Best Practices Summary

1. **Performance First**: Always consider load time and bundle size
2. **Real Data Only**: Test with actual Synthea patients
3. **Progressive Loading**: Load critical data first
4. **Error Boundaries**: Wrap components for graceful failures
5. **Accessibility**: Ensure keyboard navigation and screen readers
6. **Theme Consistency**: Use clinical theme system
7. **Event Communication**: Use event system for cross-module updates

## 🔗 Related Documentation

- **Main CLAUDE.md**: `/CLAUDE.md` - Project overview
- **Frontend Services**: `/frontend/src/services/CLAUDE.md`
- **Component Docs**: `/docs/modules/frontend/`
- **Performance Guide**: `/docs/performance/frontend-optimization.md`
- **Navigation Helper**: `/frontend/src/components/clinical/utils/navigationHelper.js`

## 💡 Quick Tips

- Use `lazyLoadTabs` configuration for automatic tab optimization
- Clinical severity levels: info (blue), warning (orange), critical (red)
- All tables support sorting, filtering, and pagination
- Skeleton screens match actual component layouts
- Virtual scrolling kicks in automatically for >50 items
- Theme adapts based on user role and preferences

---

**Remember**: User experience and performance are critical in healthcare. Every millisecond counts when clinicians need patient information.