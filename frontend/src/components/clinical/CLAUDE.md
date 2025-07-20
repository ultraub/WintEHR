# CLAUDE.md - Clinical UI Components Quick Reference

**Purpose**: Essential guide for AI agents working with WintEHR's clinical user interface components.

**Last Updated**: 2025-01-20

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
├── workspace/                    # Workspace components
│   ├── EnhancedPatientHeader.js # Patient header (V3 only)
│   ├── WorkspaceContent.js      # Content wrapper (V3 only)
│   ├── TabErrorBoundary.js      # Error handling (Enhanced only)
│   ├── tabs/                     # Clinical tabs (both versions)
│   │   ├── SummaryTab.js        # Patient summary
│   │   ├── ChartReviewTab.js    # Standard version (V3)
│   │   ├── ChartReviewTabOptimized.js  # Enhanced version
│   │   ├── EncountersTab.js     # Visit history
│   │   ├── ResultsTab.js        # Standard version (V3)
│   │   ├── ResultsTabOptimized.js      # Enhanced version
│   │   ├── OrdersTab.js         # Standard version (V3)
│   │   ├── EnhancedOrdersTab.js # Enhanced version
│   │   ├── PharmacyTab.js       # Medication management
│   │   ├── ImagingTab.js        # DICOM viewer
│   │   ├── DocumentationTab.js  # Standard version (V3)
│   │   ├── DocumentationTabEnhanced.js # Enhanced version
│   │   ├── CarePlanTab.js       # Standard version (V3)
│   │   ├── CarePlanTabEnhanced.js     # Enhanced version
│   │   ├── TimelineTab.js       # Standard version (V3)
│   │   └── TimelineTabEnhanced.js     # Enhanced version
│   ├── dialogs/                  # Modal dialogs
│   └── sections/                 # Reusable sections
├── layouts/                      # Layout components
│   ├── ClinicalLayout.js        # Legacy layout (V3)
│   └── EnhancedClinicalLayout.js # New modular layout
├── ui/                           # UI utilities
│   └── KeyboardShortcutsDialog.js # Keyboard help (Enhanced)
├── common/                       # Shared components
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

## 🔄 Workspace Versions

### ClinicalWorkspaceV3 (Legacy)
Self-contained workspace with integrated layout and patient header.

**Dependency Graph:**
```
ClinicalWorkspaceV3
├── React Core (useState, useEffect, useCallback, Suspense, useMemo, useRef)
├── React Router (useParams, useLocation, useNavigate)
├── Material-UI Components
├── Internal Components
│   ├── SafeBadge
│   ├── EnhancedPatientHeader
│   ├── WorkspaceContent
│   └── ClinicalLayout
├── Contexts
│   ├── FHIRResourceContext
│   ├── AuthContext
│   └── CDSContext (CDS alerts)
├── Lazy Loaded Components
│   ├── CDSPresentation
│   ├── LayoutBuilder
│   └── All Tab Components (standard versions)
└── Utilities
    ├── decodeFhirId
    └── getClinicalContext
```

**Key Features:**
- Manages own activeTab state
- Built-in CDS alerts display
- Layout builder support
- Self-contained navigation

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

### Migration Path
```
V3 → Enhanced:
1. Replace ClinicalWorkspaceV3 with ClinicalWorkspaceWrapper
2. Update tab imports to optimized versions
3. Remove CDSContext dependency
4. Add ClinicalWorkflowContext
5. Update event handling to use workflow events
```

### Choosing Between Versions

**Use ClinicalWorkspaceV3 when:**
- Working with legacy code that expects self-contained workspace
- Need built-in CDS alerts display
- Require layout builder functionality
- Want minimal refactoring of existing integrations

**Use ClinicalWorkspaceEnhanced when:**
- Building new features or refactoring
- Need better performance and error handling
- Want keyboard navigation support
- Require clinical workflow event integration
- Need modular architecture for flexibility

**Tab Component Mapping:**
| V3 Component | Enhanced Component | Key Improvements |
|--------------|-------------------|------------------|
| ChartReviewTab | ChartReviewTabOptimized | Virtual scrolling, memoization |
| ResultsTab | ResultsTabOptimized | Trend visualization, batch loading |
| OrdersTab | EnhancedOrdersTab | Real-time updates, catalog integration |
| DocumentationTab | DocumentationTabEnhanced | Rich text editor, templates |
| CarePlanTab | CarePlanTabEnhanced | Goal tracking, timeline view |
| TimelineTab | TimelineTabEnhanced | Event grouping, filtering |

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

## 💡 Quick Tips

- Use `lazyLoadTabs` configuration for automatic tab optimization
- Clinical severity levels: info (blue), warning (orange), critical (red)
- All tables support sorting, filtering, and pagination
- Skeleton screens match actual component layouts
- Virtual scrolling kicks in automatically for >50 items
- Theme adapts based on user role and preferences

---

**Remember**: User experience and performance are critical in healthcare. Every millisecond counts when clinicians need patient information.