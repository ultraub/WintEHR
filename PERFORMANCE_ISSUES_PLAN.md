# Performance Issues Resolution Plan

**Date**: 2025-08-03
**Author**: AI Assistant
**Status**: In Progress

## Executive Summary

During WebSocket debugging, we identified four major performance issues affecting the WintEHR application. This document provides a systematic plan to address each issue with specific implementation steps and expected outcomes.

## Issues Overview

### 1. Duplicate FHIR Resource Fetching (HIGH PRIORITY)
**Severity**: High
**Impact**: Performance degradation, unnecessary API calls, increased memory usage

### 2. Provider Directory 404 Error (MEDIUM PRIORITY)
**Severity**: Medium  
**Impact**: Failed requests, console errors, potential UI issues

### 3. React Router v7 Warning (LOW PRIORITY)
**Severity**: Low
**Impact**: Future compatibility warning

### 4. Long Task Performance Warnings (MEDIUM PRIORITY)
**Severity**: Medium
**Impact**: UI responsiveness, user experience

---

## Issue 1: Duplicate FHIR Resource Fetching

### Root Cause Analysis

1. **Multiple Component Calls**: Many components independently call `getPatientResources()` for the same data:
   - CollapsiblePatientHeaderOptimized (4 calls)
   - CareTeamSummary (3 calls)
   - Multiple workspace tabs
   - Various hooks (useClinicalResources, useChartReviewResources)

2. **No Result Memoization**: The `getPatientResources` function recalculates results on every call, even when the underlying data hasn't changed.

3. **React StrictMode**: In development, React StrictMode double-invokes effects, doubling the calls.

### Solution Strategy

#### Phase 1: Add Memoization to getPatientResources
```javascript
// In FHIRResourceContext.js
const getPatientResourcesMemo = useRef(new Map());

const getPatientResources = useCallback((patientId, resourceType = null) => {
  const memoKey = `${patientId}-${resourceType || 'all'}`;
  
  // Check memo cache
  const cached = getPatientResourcesMemo.current.get(memoKey);
  if (cached && cached.relationships === state.relationships[patientId]) {
    return cached.result;
  }
  
  // ... existing logic ...
  
  // Cache the result
  getPatientResourcesMemo.current.set(memoKey, {
    result: resources,
    relationships: state.relationships[patientId]
  });
  
  return resources;
}, [state.relationships, state.resources]);
```

#### Phase 2: Create Resource-Specific Hooks
```javascript
// New file: hooks/useFHIRResourceMemo.js
export const usePatientConditions = (patientId) => {
  const { getPatientResources } = useFHIRResource();
  return useMemo(
    () => getPatientResources(patientId, 'Condition') || [],
    [patientId, getPatientResources]
  );
};

export const usePatientMedications = (patientId) => {
  const { getPatientResources } = useFHIRResource();
  return useMemo(
    () => getPatientResources(patientId, 'MedicationRequest') || [],
    [patientId, getPatientResources]
  );
};
```

#### Phase 3: Implement Request Deduplication
- Leverage existing `intelligentCache` for cross-component caching
- Add request coalescing for simultaneous identical requests

### Expected Outcome
- 70-80% reduction in duplicate API calls
- Improved page load times
- Reduced memory pressure

---

## Issue 2: Provider Directory 404 Error

### Root Cause Analysis

1. **Missing Endpoint**: `/api/provider-directory/providers/current-user/profile` is not implemented
2. **CareTeamSummary Component**: Attempts to fetch current user's provider profile
3. **No Error Handling**: Component doesn't gracefully handle 404 response

### Solution Strategy

#### Option A: Implement the Endpoint (Recommended)
```python
# backend/api/clinical/provider_directory_router.py
@router.get("/providers/current-user/profile")
async def get_current_user_provider_profile(
    current_user: dict = Depends(get_current_user_or_demo),
    storage: FHIRStorageEngine = Depends(get_storage)
):
    """Get provider profile for current user."""
    # Map user to practitioner
    practitioner = await storage.search_resources(
        "Practitioner",
        {"identifier": f"system|{current_user['username']}"}
    )
    
    if not practitioner or not practitioner.get('entry'):
        raise HTTPException(404, "Provider profile not found")
    
    return practitioner['entry'][0]['resource']
```

#### Option B: Remove the Call (Quick Fix)
```javascript
// In CareTeamSummary.js
const loadCareTeam = useCallback(async () => {
  try {
    // Comment out or remove this call
    // const profile = await getCurrentUserProfile();
    
    // Proceed without profile
    const careTeams = getPatientResources(patientId, 'CareTeam') || [];
    // ... rest of logic
  } catch (error) {
    // Handle gracefully
    console.warn('Provider profile not available');
  }
}, [patientId, getPatientResources]);
```

### Expected Outcome
- No more 404 errors in console
- CareTeam functionality works without provider profile
- Cleaner error logs

---

## Issue 3: React Router v7 Warning

### Root Cause Analysis

1. **Future Flag Not Set**: React Router v7 will wrap state updates in `React.startTransition`
2. **Current Version**: Using v6 without future flags enabled

### Solution Strategy

```javascript
// In App.js or router configuration
import { createBrowserRouter } from 'react-router-dom';

const router = createBrowserRouter(routes, {
  future: {
    v7_startTransition: true,
    // Other v7 flags as needed
  }
});
```

### Expected Outcome
- Warning eliminated
- Prepared for React Router v7 migration
- Potentially smoother transitions

---

## Issue 4: Long Task Performance Warnings

### Root Cause Analysis

1. **Heavy Initial Renders**: Tasks taking 59-191ms
2. **Synchronous Data Processing**: Large amounts of FHIR data processed synchronously
3. **Component Complexity**: Complex components doing too much work

### Solution Strategy

#### Phase 1: Identify Bottlenecks
```javascript
// Add performance marks
performance.mark('component-start');
// ... heavy operation ...
performance.mark('component-end');
performance.measure('component-render', 'component-start', 'component-end');
```

#### Phase 2: Implement Code Splitting
```javascript
// Lazy load heavy components
const ChartReviewTab = lazy(() => 
  import(/* webpackChunkName: "chart-review" */ './tabs/ChartReviewTab')
);
```

#### Phase 3: Use React.memo and useMemo
```javascript
// Memoize expensive computations
const processedData = useMemo(() => {
  return heavyDataProcessing(rawData);
}, [rawData]);

// Memoize components
export default React.memo(HeavyComponent, (prevProps, nextProps) => {
  return prevProps.dataId === nextProps.dataId;
});
```

#### Phase 4: Implement Virtual Scrolling
- For long lists (medications, conditions)
- Use react-window or react-virtualized

### Expected Outcome
- Tasks under 50ms threshold
- Smoother UI interactions
- Better perceived performance

---

## Implementation Priority

1. **Week 1**: Fix duplicate FHIR fetching (High impact, moderate effort)
2. **Week 1**: Fix provider directory 404 (Low effort, improves UX)
3. **Week 2**: Address long task warnings (High effort, high impact)
4. **Week 2**: Add React Router v7 flag (Low effort, future-proofing)

## Success Metrics

- **API Calls**: 70% reduction in duplicate FHIR requests
- **Console Errors**: Zero 404 errors from provider directory
- **Performance**: 90% of tasks under 50ms
- **Memory**: 20% reduction in memory usage

## Testing Plan

1. **Performance Testing**
   - Use Chrome DevTools Performance tab
   - Monitor network requests
   - Track memory usage

2. **Regression Testing**
   - Ensure all clinical workflows still function
   - Verify data accuracy
   - Test with multiple concurrent users

3. **Load Testing**
   - Test with 100+ patient records
   - Simulate real-world usage patterns

## Rollback Plan

Each fix will be implemented in a separate commit, allowing for easy rollback if issues arise. Feature flags can be used for larger changes.

---

## Next Steps

1. Review and approve this plan
2. Create feature branches for each issue
3. Implement fixes following the priority order
4. Test thoroughly in development
5. Deploy to staging for UAT
6. Monitor production metrics after deployment