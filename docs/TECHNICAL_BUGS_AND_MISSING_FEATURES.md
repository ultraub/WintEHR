# Technical Bugs and Missing Features - WintEHR
**Generated**: 2025-01-27
**Focus**: Programmatic issues, missing data, and technical implementation problems

## Critical Technical Issues

### 1. Patient Context Management Issues

#### **Patient Context Can Be Lost**
- **Location**: Multiple components pass patientId as prop through many levels
- **Issue**: PatientId can become undefined during navigation or component updates
- **Impact**: Wrong patient data displayed, operations fail silently
- **Evidence**: Some components use `currentPatient`, others use `patient` prop inconsistently
- **Fix**: Implement centralized patient context with proper null checks

#### **Reference Format Inconsistency**
- **Location**: `SummaryTab.js:207-237`
```javascript
const conditions = useMemo(() => {
  const filtered = Object.values(resources.Condition || {}).filter(c => 
    c.subject?.reference === `Patient/${patientId}` || 
    c.subject?.reference === `urn:uuid:${patientId}` ||
    c.patient?.reference === `Patient/${patientId}` ||
    c.patient?.reference === `urn:uuid:${patientId}`
  );
```
- **Issue**: Checking 4 different reference patterns indicates data format inconsistency
- **Impact**: Resources may be missed, incomplete patient data shown
- **Fix**: Standardize reference format in data layer

### 2. Missing Core Functionality

#### **Print Functionality Not Implemented**
- **Location**: `SummaryTab.js`
- **Issue**: Workflow documentation mentions print button but it doesn't exist
- **Impact**: Users cannot print patient summaries
- **Evidence**: No `handlePrint` function or print button found

#### **No Duplicate Prevention**
- **Locations**: 
  - `ConditionDialogEnhanced.js` - Can add same diagnosis multiple times
  - `AllergyDialogEnhanced.js` - Can add same allergy multiple times
  - `CPOEDialog.js` - Can order same test multiple times
- **Impact**: Duplicate resources clutter the interface and confuse users
- **Fix**: Check existing resources before creation

#### **No Order Sets Implementation**
- **Location**: `EnhancedOrdersTab.js`
- **Issue**: UI mentions order sets but functionality not implemented
- **Impact**: Cannot use predefined order combinations
- **Evidence**: Button exists but no actual order set logic

### 3. Data Loading and State Management Issues

#### **Infinite Re-render Loop**
- **Location**: `SummaryTab.js:342-371`
```javascript
useEffect(() => {
  // ...
  if (hasAnyResources) {
    loadDashboardData();
    setLoading(false);
  }
  // ...
}, [patientId, conditions.length, medications.length, observations.length, 
    encounters.length, allergies.length, serviceRequests.length, 
    isResourceLoading, isCacheWarm, fetchPatientBundle, loadDashboardData]); // BUG: loadDashboardData in deps
```
- **Issue**: `loadDashboardData` in dependency array causes infinite loop
- **Impact**: Excessive API calls, performance degradation
- **Fix**: Remove `loadDashboardData` from dependencies

#### **Race Conditions in Resource Loading**
- **Location**: `SummaryTab.js:342-371`
- **Issue**: Multiple useEffect hooks can trigger simultaneous loads
- **Impact**: Duplicate API calls, inconsistent state
- **Fix**: Implement request debouncing and cancellation

#### **No Request Cancellation**
- **Location**: All data fetching hooks
- **Issue**: API requests not cancelled when component unmounts
- **Impact**: Memory leaks, React warnings: "Can't perform state update on unmounted component"
- **Fix**: Implement AbortController pattern

### 4. Event System and Real-time Updates

#### **Memory Leak in Event Subscriptions**
- **Location**: `SummaryTab.js:393-404`
```javascript
eventsToWatch.forEach(eventType => {
  const unsubscribe = subscribe(eventType, (data) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => loadDashboardData(), 100); // timeoutId is local variable
  });
  unsubscribers.push(unsubscribe);
});
```
- **Issue**: `timeoutId` is local variable, not ref - timeout not cleared properly
- **Impact**: Memory leaks, phantom updates after unmount
- **Fix**: Use useRef for timeoutId

#### **Inconsistent Event Publishing**
- **Location**: Various components
- **Issue**: Some actions publish events, others don't
- **Impact**: Real-time sync fails between tabs
- **Examples**:
  - Medication updates publish events
  - Allergy updates don't publish events
  - Order modifications don't publish events

#### **WebSocket Connection Check**
- **Location**: `ResultsTabOptimized.js:319`
```javascript
if (!patientId || !websocketService.isConnected()) return;
```
- **Issue**: If WebSocket disconnects, no fallback or reconnection attempt
- **Impact**: Real-time updates stop working silently
- **Fix**: Add connection status indicator and auto-reconnect

### 5. Data Validation and Error Handling

#### **Silent Error Swallowing**
- **Locations**: Multiple try-catch blocks
```javascript
} catch (error) {
  // Error loading summary data - in production this would show an error notification to the user
} finally {
  setLoading(false);
}
```
- **Issue**: Errors caught but not displayed or logged
- **Impact**: Users don't know operations failed
- **Fix**: Implement proper error notifications

#### **Date Parsing Without Error Handling**
- **Location**: `SummaryTab.js:274-286`
```javascript
const date = o.effectiveDateTime || o.issued;
if (date) {
  return isWithinInterval(parseISO(date), { // Can throw if invalid format
    start: subDays(new Date(), 7),
    end: new Date()
  });
}
```
- **Issue**: `parseISO()` can throw if date format invalid
- **Impact**: Entire component crashes on bad date
- **Fix**: Wrap in try-catch or validate date format first

#### **Invalid Date Fallback**
- **Location**: `SummaryTab.js:509-512`
```javascript
.sort((a, b) => new Date(b.effectiveDateTime || b.issued || 0) - 
                new Date(a.effectiveDateTime || a.issued || 0))
```
- **Issue**: Falls back to `new Date(0)` which is Jan 1, 1970
- **Impact**: Labs with missing dates show as from 1970
- **Fix**: Filter out items without valid dates

### 6. Performance Issues

#### **Loading 200+ Resources at Once**
- **Location**: `useChartReviewResources.js:115-141`
```javascript
searchParams._count = '200'; // For Observations
```
- **Issue**: Loads all resources without pagination
- **Impact**: Slow initial load, high memory usage
- **Fix**: Implement virtual scrolling or pagination

#### **No Caching Strategy**
- **Location**: Multiple components
- **Issue**: Same data fetched repeatedly without caching
- **Impact**: Unnecessary API calls, slow navigation
- **Fix**: Implement proper caching layer

#### **Missing Loading States**
- **Locations**: Various dialogs and components
- **Issue**: No skeleton loaders or loading indicators
- **Impact**: UI appears frozen during data fetch
- **Fix**: Add loading skeletons

### 7. UI/UX Technical Issues

#### **Browser Alert for Critical Values**
- **Location**: `ResultsTabOptimized.js:418`
```javascript
alert(`CRITICAL VALUE ALERT!\n\n${code}: ${value}\n\nImmediate action required!`);
```
- **Issue**: Uses blocking browser alert()
- **Impact**: Blocks UI thread, can be disabled by browser
- **Fix**: Use proper modal/notification system

#### **Hardcoded Practitioner References**
- **Multiple Locations**:
```javascript
recorder: {
  reference: 'Practitioner/current-user' // Would be actual user in production
}
```
- **Issue**: Cannot track actual user making changes
- **Impact**: No proper audit trail
- **Fix**: Use actual user context

### 8. Missing Data Relationships

#### **No Version Control/Optimistic Locking**
- **Location**: All update operations
- **Issue**: No version checking on resource updates
- **Impact**: Last write wins, users overwrite each other's changes
- **Fix**: Implement ETags or version checking

#### **Compartment Population Issues**
- **Issue**: Patient compartments may not be fully populated
- **Impact**: Patient/$everything returns incomplete results
- **Fix**: Run compartment population scripts

## Priority Fix Order (Technical Focus)

### Phase 1: Data Integrity & State Management
1. **Fix patient context management** - Centralize and prevent loss
2. **Fix infinite re-render loop** - Remove loadDashboardData from deps
3. **Implement request cancellation** - Add AbortController
4. **Fix memory leaks** - Use refs for timeouts
5. **Standardize reference formats** - Handle all FHIR reference patterns

### Phase 2: Missing Core Features
1. **Add duplicate prevention** - Check before creating resources
2. **Implement print functionality** - Add patient summary printing
3. **Add pagination** - Don't load 200+ resources at once
4. **Implement order sets** - Complete the feature
5. **Add proper error handling** - Show user-friendly error messages

### Phase 3: Performance & Polish
1. **Add caching layer** - Reduce redundant API calls
2. **Implement loading states** - Add skeletons everywhere
3. **Fix date handling** - Validate all date parsing
4. **Standardize event publishing** - Ensure all actions publish events
5. **Replace browser alerts** - Use proper notification system

## Code Patterns to Fix

### Pattern 1: Fix Patient Context
```javascript
// BAD - Prop drilling
<Component patientId={patientId} />

// GOOD - Context API
const { patientId } = usePatientContext();
```

### Pattern 2: Fix Request Cancellation
```javascript
// BAD
useEffect(() => {
  fetchData();
}, []);

// GOOD
useEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal });
  return () => controller.abort();
}, []);
```

### Pattern 3: Fix Timeout Refs
```javascript
// BAD
let timeoutId = setTimeout(...);

// GOOD
const timeoutRef = useRef();
timeoutRef.current = setTimeout(...);
```

### Pattern 4: Fix Error Handling
```javascript
// BAD
} catch (error) {
  // Silent fail
}

// GOOD
} catch (error) {
  console.error('Operation failed:', error);
  showNotification({ type: 'error', message: 'Operation failed. Please try again.' });
}
```

## Testing Requirements

1. **Patient Context**: Test switching between patients rapidly
2. **Performance**: Test with 100+ resources per type
3. **Memory Leaks**: Test mounting/unmounting components repeatedly
4. **Concurrent Updates**: Test multiple users editing same resource
5. **Error States**: Test with network failures and invalid data