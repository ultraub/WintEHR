# FHIR API Optimization Guide

## Overview
This guide documents the optimization patterns implemented to reduce FHIR API calls in the Clinical Workspace from ~40 calls to 5-10 calls on initial load.

## Key Optimizations Implemented

### 1. Request Deduplication
Prevents multiple components from making the same API call simultaneously.

**Implementation in FHIRResourceContext:**
```javascript
// Track in-flight requests
const inFlightRequests = useRef(new Map());

// Check for existing request before making new one
const existingRequest = inFlightRequests.current.get(requestKey);
if (existingRequest && !forceRefresh) {
  return existingRequest;
}

// Store promise and cleanup after completion
const promise = fhirClient.search(...);
inFlightRequests.current.set(requestKey, promise);
promise.finally(() => inFlightRequests.current.delete(requestKey));
```

### 2. Shared Data Hook Pattern
Use `usePatientClinicalData` to access patient resources across tabs without duplicate fetching.

**Example Usage:**
```javascript
import { usePatientClinicalData } from '../hooks/usePatientClinicalData';

const MyComponent = ({ patientId }) => {
  const { 
    conditions, 
    medications, 
    allergies,
    isLoading,
    refresh
  } = usePatientClinicalData(patientId);
  
  // Use cached data instead of making new API calls
};
```

### 3. Progressive Loading
Load critical resources first, then background-load additional data.

**TimelineTab Example:**
```javascript
const criticalTypes = ['Encounter', 'Condition', 'MedicationRequest', 'Procedure'];
const importantTypes = ['Observation', 'DiagnosticReport', 'AllergyIntolerance'];
const optionalTypes = ['DocumentReference', 'CarePlan', 'CareTeam'];

// Load critical first
fetchPatientBundle(patientId, false, 'critical').then(() => {
  // Load important in background
  setTimeout(() => fetchPatientBundle(patientId, false, 'important'), 100);
  // Load optional after delay
  setTimeout(() => fetchPatientBundle(patientId, false, 'all'), 2000);
});
```

### 4. Resource Access from Context
Instead of making new API calls, access already-loaded resources from context.

**Before (causes duplicate calls):**
```javascript
const conditions = getPatientResources(patientId, 'Condition');
const medications = getPatientResources(patientId, 'MedicationRequest');
```

**After (uses cached data):**
```javascript
const conditions = Object.values(resources.Condition || {}).filter(c => 
  c.subject?.reference === `Patient/${patientId}`
);
```

### 5. Batch Request Support
Combine multiple resource requests into a single HTTP call.

**Usage:**
```javascript
const requests = [
  { method: 'GET', url: 'Condition?patient=123' },
  { method: 'GET', url: 'MedicationRequest?patient=123' },
  { method: 'GET', url: 'AllergyIntolerance?patient=123' }
];

const bundle = await fhirClient.batch(requests);
```

## Performance Impact

### Before Optimization
- **SummaryTab**: 10+ API calls (duplicate fetching)
- **TimelineTab**: 15+ API calls (all resource types at once)
- **OrdersTab**: 2-3 API calls
- **ResultsTab**: 4-5 API calls
- **Total**: ~35-40 API calls

### After Optimization
- **SummaryTab**: 1-2 calls (uses shared context)
- **TimelineTab**: 3-5 initial calls (progressive loading)
- **OrdersTab**: 0-1 calls (uses shared hook)
- **ResultsTab**: 0-2 calls (leverages cache)
- **Total**: ~5-10 API calls

## Best Practices

### 1. Always Use Shared Hooks
```javascript
// ✅ Good - uses shared hook
const { medications } = usePatientClinicalData(patientId);

// ❌ Bad - makes separate API call
const medications = await fhirClient.search('MedicationRequest', { patient: patientId });
```

### 2. Check Cache Before Fetching
```javascript
// ✅ Good - checks if data is already loaded
if (!isCacheWarm(patientId)) {
  fetchPatientBundle(patientId);
}

// ❌ Bad - always fetches
fetchPatientBundle(patientId);
```

### 3. Use Memoization for Filtering
```javascript
// ✅ Good - memoizes filtered results
const activeConditions = useMemo(() => 
  conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active'),
  [conditions]
);

// ❌ Bad - recalculates on every render
const activeConditions = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active');
```

### 4. Implement Progressive Enhancement
```javascript
// ✅ Good - loads data progressively
// 1. Show critical data immediately
// 2. Load additional data in background
// 3. Update UI as data arrives

// ❌ Bad - waits for all data before showing anything
```

## Monitoring and Debugging

### Check API Call Count
1. Open browser DevTools Network tab
2. Filter by `/fhir/` requests
3. Count requests on initial load
4. Should see 5-10 requests instead of 40+

### Verify Cache Usage
```javascript
// Add temporary logging to verify cache hits
const cached = getCachedData('searches', searchKey);
if (cached) {
  console.log('Cache hit:', searchKey);
  return cached;
}
```

### Monitor Request Deduplication
```javascript
// Check if deduplication is working
if (existingRequest) {
  console.log('Deduped request:', requestKey);
  return existingRequest;
}
```

## Future Enhancements

1. **GraphQL Integration**: Use FHIR GraphQL to request exactly needed fields
2. **Subscription Support**: Use FHIR subscriptions for real-time updates
3. **Service Worker Caching**: Implement offline-first architecture
4. **_include Parameter**: Use FHIR _include to fetch related resources
5. **Pagination**: Implement virtual scrolling for large datasets

## Migration Guide

### Updating Existing Components

1. **Replace direct API calls with shared hook:**
   ```javascript
   // Old
   const { getPatientResources } = useFHIRResource();
   const conditions = getPatientResources(patientId, 'Condition');
   
   // New
   const { conditions } = usePatientClinicalData(patientId);
   ```

2. **Remove duplicate fetching logic:**
   ```javascript
   // Remove multiple useEffect hooks that fetch same data
   // Use single shared hook instead
   ```

3. **Update loading states:**
   ```javascript
   // Old
   const loading = isResourceLoading('Condition') || isResourceLoading('MedicationRequest');
   
   // New
   const { isLoading } = usePatientClinicalData(patientId);
   ```

## Recent Updates
- **2025-07-15**: Implemented comprehensive FHIR API optimization
  - Added request deduplication to prevent concurrent duplicate calls
  - Created shared usePatientClinicalData hook
  - Optimized SummaryTab and TimelineTab
  - Added batch request support
  - Reduced API calls by 80%