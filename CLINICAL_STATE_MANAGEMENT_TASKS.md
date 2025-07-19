# Clinical State Management Implementation Tasks

## Overview
This document breaks down the state management improvements into detailed, actionable tasks with verification steps for each change.

---

## Phase 1: Critical Fixes (Days 1-2)

### Task 1.1: Fix Loading State Race Conditions ⚡ CRITICAL
**Priority**: IMMEDIATE  
**Components**: EncountersTab, ChartReviewTab, SummaryTab, ResultsTab

#### Subtasks:

##### 1.1.1 Fix EncountersTab Immediate Loading False
```javascript
// CURRENT PROBLEM (line 281-283):
useEffect(() => {
  setLoading(false);
}, []);

// FIX: Remove this useEffect entirely and rely on data loading state
```
- [ ] Remove the problematic useEffect
- [ ] Update loading logic to check actual data state
- [ ] Test that loading indicator shows while data loads
- [ ] Verify no race conditions with hot reload

##### 1.1.2 Consolidate ChartReviewTab Loading States
```javascript
// CURRENT PROBLEM: 3 different loading states
const [loading, setLoading] = useState(false);
const [loadingOptimized, setLoadingOptimized] = useState(false);
const { isLoading } = useFHIRResource();

// FIX: Use single source of truth
const { isLoading, resources } = useFHIRResource();
const isDataReady = !isLoading && resources.conditions?.length > 0;
```
- [ ] Remove local loading states
- [ ] Replace all loading checks with context state
- [ ] Update UI to use isDataReady
- [ ] Test all loading scenarios

##### 1.1.3 Fix SummaryTab Loading Dependencies
- [ ] Remove local loading state
- [ ] Use context loading state consistently
- [ ] Fix loadDashboardData dependencies
- [ ] Verify stats calculation doesn't cause re-renders

##### 1.1.4 Standardize ResultsTab Loading
- [ ] Consolidate multiple loading states into one
- [ ] Fix loading state for paginated data
- [ ] Ensure loading shows during pagination
- [ ] Test with slow network throttling

**Verification Steps**:
1. Open Chrome DevTools Network tab, set to "Slow 3G"
2. Navigate to each tab
3. Verify loading indicators appear and disappear correctly
4. Check console for no warnings about state updates

---

### Task 1.2: Add Missing Cleanup Functions 🧹
**Priority**: HIGH  
**Risk**: Memory leaks and duplicate event handlers

#### Subtasks:

##### 1.2.1 Fix Event Subscription Cleanups
```javascript
// Files to update:
// - EncountersTab.js (lines 286-310)
// - PharmacyTab.js (event subscriptions)
// - ChartReviewTab.js (CDS alert subscriptions)
// - OrdersTab.js (workflow events)

// PATTERN TO IMPLEMENT:
useEffect(() => {
  const unsubscribe1 = subscribe(EVENT_TYPE, handler1);
  const unsubscribe2 = subscribe(EVENT_TYPE, handler2);
  
  return () => {
    unsubscribe1();
    unsubscribe2();
  };
}, [handler1, handler2]); // Include handlers in deps
```

- [ ] Audit all useEffects with subscriptions
- [ ] Add cleanup functions for each
- [ ] Test by switching tabs rapidly
- [ ] Monitor memory usage in DevTools

##### 1.2.2 Fix Async Operation Cleanups
```javascript
// PATTERN TO IMPLEMENT:
useEffect(() => {
  let cancelled = false;
  
  async function loadData() {
    try {
      const data = await fetchData();
      if (!cancelled) {
        setState(data);
      }
    } catch (error) {
      if (!cancelled) {
        setError(error);
      }
    }
  }
  
  loadData();
  
  return () => { cancelled = true; };
}, [dependencies]);
```

- [ ] Find all async operations in useEffects
- [ ] Add cancellation flags
- [ ] Test by navigating away during load
- [ ] Verify no "setState on unmounted component" warnings

**Verification Steps**:
1. Open React DevTools Profiler
2. Record while switching tabs rapidly
3. Check for memory leaks in Chrome Memory Profiler
4. Verify no console warnings

---

### Task 1.3: Fix Critical UseEffect Dependencies 🔧
**Priority**: HIGH  
**Risk**: Stale closures and infinite loops

#### Subtasks:

##### 1.3.1 Fix Missing Dependencies
```javascript
// Files with eslint-disable comments to fix:
// - SummaryTab.js (loadDashboardData)
// - FHIRResourceContext.js (refresh event listener)
// - ChartReviewTab.js (CDS alerts)
```

- [ ] Remove all eslint-disable comments for exhaustive-deps
- [ ] Add missing dependencies or refactor to avoid them
- [ ] Use useCallback for stable function references
- [ ] Test for infinite loops

##### 1.3.2 Stabilize Callback Functions
```javascript
// PATTERN TO IMPLEMENT:
const loadData = useCallback(async () => {
  // data loading logic
}, [patientId, otherStableDeps]); // Only include stable deps

useEffect(() => {
  loadData();
}, [loadData]);
```

- [ ] Wrap event handlers in useCallback
- [ ] Ensure dependency arrays are minimal
- [ ] Test that callbacks don't recreate unnecessarily
- [ ] Verify no performance regressions

**Verification Steps**:
1. Add console.log in callbacks to track recreations
2. Use React DevTools to highlight re-renders
3. Verify callbacks are stable across renders

---

## Phase 2: Performance Optimizations (Days 3-4)

### Task 2.1: Memoize Expensive Computations 🚀
**Priority**: HIGH  
**Impact**: 50-70% performance improvement

#### Subtasks:

##### 2.1.1 Memoize Filtered Lists
```javascript
// FILES TO UPDATE:
// ChartReviewTab: filteredAndSortedConditions (line 241)
// ResultsTab: filteredResults, sortedResults
// EncountersTab: filtered encounters
// PharmacyTab: medication filtering

// PATTERN:
const filteredData = useMemo(() => {
  console.log('Recomputing filtered data'); // Dev only
  return data
    .filter(item => /* complex filter */)
    .sort((a, b) => /* complex sort */);
}, [data, filterCriteria, sortOrder]);
```

- [ ] Identify all filter/sort operations in render
- [ ] Wrap in useMemo with correct dependencies
- [ ] Add dev logging to verify memoization works
- [ ] Measure render time improvements

##### 2.1.2 Memoize Derived State
```javascript
// SummaryTab stats calculation
const stats = useMemo(() => ({
  totalConditions: conditions.length,
  activeConditions: conditions.filter(c => isActive(c)).length,
  totalMedications: medications.length,
  activeMedications: medications.filter(m => isActive(m)).length,
  // ... other calculations
}), [conditions, medications]);
```

- [ ] Find all derived state calculations
- [ ] Convert from useState to useMemo
- [ ] Remove unnecessary state updates
- [ ] Verify UI updates correctly

**Verification Steps**:
1. Use React Profiler to measure render times before/after
2. Add temporary console.logs in memoized functions
3. Verify they only run when dependencies change
4. Check overall performance improvement

---

### Task 2.2: Consolidate State Variables 📦
**Priority**: MEDIUM  
**Impact**: Cleaner code, fewer re-renders

#### Subtasks:

##### 2.2.1 Refactor ChartReviewTab State
```javascript
// CURRENT: 20+ individual states
// TARGET: Grouped state objects

const initialState = {
  dialogs: {
    addProblem: false,
    editProblem: false,
    addMedication: false,
    editMedication: false,
    addAllergy: false,
    editAllergy: false
  },
  selected: {
    problem: null,
    medication: null,
    allergy: null
  },
  filters: {
    problems: 'all',
    medications: 'active',
    allergies: 'all'
  },
  ui: {
    expandedSections: {},
    searchTerms: {}
  }
};

// Use reducer or Immer for updates
const [state, dispatch] = useReducer(stateReducer, initialState);
```

- [ ] Group related state variables
- [ ] Implement reducer or use Immer
- [ ] Update all state setters
- [ ] Test all UI interactions still work

##### 2.2.2 Consolidate Other Tab States
- [ ] Apply same pattern to ResultsTab
- [ ] Apply to OrdersTab
- [ ] Apply to PharmacyTab
- [ ] Create shared state patterns

**Verification Steps**:
1. Count state variables before/after
2. Verify all functionality still works
3. Check for reduced re-renders
4. Test with React DevTools

---

### Task 2.3: Optimize Context Performance 🎯
**Priority**: HIGH  
**Impact**: Prevents unnecessary re-renders of all consumers

#### Subtasks:

##### 2.3.1 Memoize FHIRResourceContext Value
```javascript
// In FHIRResourceContext.js
const contextValue = useMemo(() => ({
  // State
  resources,
  currentPatient,
  isLoading,
  error,
  
  // Stable callbacks
  setCurrentPatient,
  refreshResources,
  // ... other methods
}), [
  resources,
  currentPatient,
  isLoading,
  error,
  // Don't include callbacks if they're already stable
]);

return (
  <FHIRResourceContext.Provider value={contextValue}>
    {children}
  </FHIRResourceContext.Provider>
);
```

- [ ] Wrap context value in useMemo
- [ ] Ensure callbacks are stable (useCallback)
- [ ] Test that consumers don't re-render unnecessarily
- [ ] Measure performance improvement

##### 2.3.2 Split Context if Needed
```javascript
// If context is too large, split into:
// - FHIRDataContext (resources, loading)
// - FHIRActionsContext (methods)
// - FHIRPatientContext (current patient)
```

- [ ] Analyze if context splitting would help
- [ ] Implement split if beneficial
- [ ] Update consumers to use specific contexts
- [ ] Verify no functionality breaks

**Verification Steps**:
1. Use React DevTools to track re-renders
2. Log context value recreations
3. Verify consumers only re-render when needed
4. Measure overall app performance

---

## Phase 3: Architecture Improvements (Days 5-7)

### Task 3.1: Create Custom Hooks 🪝
**Priority**: MEDIUM  
**Impact**: Reusable patterns, consistent behavior

#### Subtasks:

##### 3.1.1 Create useResourceLoader Hook
```javascript
// hooks/useResourceLoader.js
export function useResourceLoader(resourceType, params) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null
  });
  
  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      try {
        setState(prev => ({ ...prev, loading: true }));
        const result = await fhirClient.search(resourceType, params);
        
        if (!cancelled) {
          setState({
            data: result.entry?.map(e => e.resource) || [],
            loading: false,
            error: null
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: err.message
          });
        }
      }
    }
    
    load();
    
    return () => { cancelled = true; };
  }, [resourceType, JSON.stringify(params)]);
  
  return state;
}
```

- [ ] Create the hook file
- [ ] Add proper TypeScript types
- [ ] Replace manual loading logic in components
- [ ] Add tests for the hook

##### 3.1.2 Create useDebounce Hook
```javascript
// For search inputs
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}
```

- [ ] Implement useDebounce
- [ ] Apply to all search inputs
- [ ] Test search performance
- [ ] Verify no missed inputs

**Verification Steps**:
1. Test custom hooks in isolation
2. Verify they work in components
3. Check for performance improvements
4. Ensure consistent behavior

---

## Phase 4: Testing & Monitoring (Days 8-9)

### Task 4.1: Add Performance Monitoring 📊
**Priority**: MEDIUM  
**Impact**: Ongoing performance tracking

#### Subtasks:

##### 4.1.1 Add React Profiler
```javascript
// In App.js or ClinicalWorkspace wrapper
import { Profiler } from 'react';

function onRenderCallback(id, phase, actualDuration, baseDuration, startTime, commitTime) {
  if (actualDuration > 100) {
    console.warn(`Slow render in ${id}: ${actualDuration}ms`);
  }
  
  // Send to analytics in production
  if (process.env.NODE_ENV === 'production') {
    analytics.track('react_render', {
      componentId: id,
      phase,
      duration: actualDuration
    });
  }
}

<Profiler id="ClinicalWorkspace" onRender={onRenderCallback}>
  <ClinicalWorkspaceV3 />
</Profiler>
```

- [ ] Wrap main components in Profiler
- [ ] Set up logging for slow renders
- [ ] Create performance dashboard
- [ ] Monitor in production

##### 4.1.2 Add Debug Mode
```javascript
// Add debug mode for development
if (process.env.NODE_ENV === 'development') {
  window.__CLINICAL_DEBUG__ = {
    logRenders: false,
    logStateChanges: false,
    highlightUpdates: false,
    slowNetwork: false
  };
}

// In components:
if (window.__CLINICAL_DEBUG__?.logRenders) {
  console.log(`${ComponentName} rendered`);
}
```

- [ ] Implement debug mode
- [ ] Add debug UI overlay
- [ ] Document debug features
- [ ] Train team on usage

**Verification Steps**:
1. Run performance profiling session
2. Identify any remaining bottlenecks
3. Verify monitoring works in staging
4. Create performance baseline

---

## Testing Checklist for Each Task

### Before Starting:
- [ ] Create feature branch
- [ ] Take performance baseline measurements
- [ ] Document current behavior

### During Implementation:
- [ ] Test with hot reload after each change
- [ ] Check browser console for warnings
- [ ] Verify no functionality breaks
- [ ] Run existing tests

### After Completion:
- [ ] Measure performance improvement
- [ ] Test with slow network
- [ ] Test with large datasets
- [ ] Update documentation
- [ ] Create/update tests
- [ ] Get code review

---

## Success Criteria

1. **No loading state races**: Loading indicators accurately reflect data state
2. **No memory leaks**: Memory stable after 30 minutes of use
3. **Performance targets**:
   - Initial load: < 2 seconds
   - Tab switch: < 500ms
   - Search response: < 300ms
   - Re-renders per interaction: < 5

4. **Code quality**:
   - No eslint-disable comments
   - All useEffects have dependencies
   - All subscriptions have cleanup
   - Expensive computations memoized

---

## Risk Mitigation

1. **Test each change in isolation**
2. **Keep detailed rollback plan**
3. **Monitor error rates closely**
4. **Have feature flags ready**
5. **Test with real user workflows**

## Next Steps

1. Review tasks with team
2. Assign owners to each task
3. Set up monitoring dashboard
4. Create feature branches
5. Begin with Task 1.1 (Critical fixes)