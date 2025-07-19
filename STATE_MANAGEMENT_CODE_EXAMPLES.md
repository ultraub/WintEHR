# State Management Code Examples

## Critical Fix Examples

### 1. EncountersTab Loading State Fix

#### BEFORE (Broken):
```javascript
// EncountersTab.js - This causes immediate loading=false
const [loading, setLoading] = useState(true);
const [encounters, setEncounters] = useState([]);

useEffect(() => {
  setLoading(false); // BAD: Sets loading false immediately!
}, []);

useEffect(() => {
  loadEncounters();
}, [patientId]);
```

#### AFTER (Fixed):
```javascript
// EncountersTab.js - Proper loading state management
const [encounters, setEncounters] = useState([]);
const [loadingState, setLoadingState] = useState({
  isLoading: true,
  error: null
});

const loadEncounters = useCallback(async () => {
  let cancelled = false;
  
  try {
    setLoadingState({ isLoading: true, error: null });
    
    const result = await fhirClient.search('Encounter', {
      patient: patientId,
      _sort: '-date',
      _count: 50
    });
    
    if (!cancelled) {
      const encounterResources = result.entry?.map(e => e.resource) || [];
      setEncounters(encounterResources);
      setLoadingState({ isLoading: false, error: null });
    }
  } catch (error) {
    if (!cancelled) {
      console.error('Failed to load encounters:', error);
      setLoadingState({ 
        isLoading: false, 
        error: 'Failed to load encounters. Please try again.' 
      });
    }
  }
  
  return () => { cancelled = true; };
}, [patientId]);

useEffect(() => {
  loadEncounters();
}, [loadEncounters]);

// In render:
if (loadingState.isLoading) {
  return <CircularProgress />;
}

if (loadingState.error) {
  return <Alert severity="error">{loadingState.error}</Alert>;
}
```

### 2. ChartReviewTab Multiple Loading States Fix

#### BEFORE (Chaotic):
```javascript
// ChartReviewTab.js - Multiple confusing loading states
const [loading, setLoading] = useState(false);
const [loadingOptimized, setLoadingOptimized] = useState(false);
const { isLoading: contextLoading } = useFHIRResource();

// In different parts of the component:
if (loading) return <Spinner />;
// ... elsewhere ...
if (loadingOptimized) return <OptimizedSpinner />;
// ... elsewhere ...
if (contextLoading) return <ContextSpinner />;
```

#### AFTER (Unified):
```javascript
// ChartReviewTab.js - Single source of truth
const { 
  resources, 
  isLoading: isLoadingResources,
  error: resourceError 
} = useFHIRResource();

// Derive loading states
const isDataReady = !isLoadingResources && resources.conditions && resources.medications && resources.allergies;
const hasError = resourceError !== null;

// Single loading check in render:
if (!isDataReady) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress />
      <Typography sx={{ ml: 2 }}>
        Loading patient chart data...
      </Typography>
    </Box>
  );
}

if (hasError) {
  return (
    <Alert severity="error">
      Failed to load chart data: {resourceError}
      <Button onClick={() => window.location.reload()}>
        Retry
      </Button>
    </Alert>
  );
}

// Render actual content
```

### 3. Event Subscription Cleanup Fix

#### BEFORE (Memory Leak):
```javascript
// Missing cleanup causes memory leaks
useEffect(() => {
  subscribe(CLINICAL_EVENTS.MEDICATION_UPDATED, handleMedicationUpdate);
  subscribe(CLINICAL_EVENTS.ALLERGY_ADDED, handleAllergyAdded);
  subscribe(CLINICAL_EVENTS.PROBLEM_RESOLVED, handleProblemResolved);
}, []); // No cleanup!
```

#### AFTER (Proper Cleanup):
```javascript
// Proper cleanup prevents memory leaks
useEffect(() => {
  // Stable callbacks using useCallback
  const handleMedicationUpdate = useCallback((data) => {
    console.log('Medication updated:', data);
    // Refresh medications
    refreshMedications();
  }, [refreshMedications]);

  const handleAllergyAdded = useCallback((data) => {
    console.log('Allergy added:', data);
    // Refresh allergies
    refreshAllergies();
  }, [refreshAllergies]);

  // Subscribe and store unsubscribe functions
  const unsubscribeMedUpdate = subscribe(
    CLINICAL_EVENTS.MEDICATION_UPDATED, 
    handleMedicationUpdate
  );
  const unsubscribeAllergy = subscribe(
    CLINICAL_EVENTS.ALLERGY_ADDED, 
    handleAllergyAdded
  );

  // Cleanup function
  return () => {
    unsubscribeMedUpdate();
    unsubscribeAllergy();
  };
}, [refreshMedications, refreshAllergies]); // Include stable dependencies
```

### 4. Memoization Example

#### BEFORE (Recalculates every render):
```javascript
// This runs on EVERY render!
const activeProblems = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active');
const resolvedProblems = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'resolved');
const severProblems = conditions.filter(c => c.severity?.coding?.[0]?.code === 'severe');

const sortedConditions = [...conditions].sort((a, b) => {
  const dateA = new Date(a.onsetDateTime || '1900-01-01');
  const dateB = new Date(b.onsetDateTime || '1900-01-01');
  return dateB - dateA;
});
```

#### AFTER (Memoized):
```javascript
// Only recalculates when conditions change
const { activeProblems, resolvedProblems, severeProblems } = useMemo(() => {
  const active = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active');
  const resolved = conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'resolved');
  const severe = conditions.filter(c => c.severity?.coding?.[0]?.code === 'severe');
  
  return {
    activeProblems: active,
    resolvedProblems: resolved,
    severeProblems: severe
  };
}, [conditions]); // Only recalculate when conditions array changes

const sortedConditions = useMemo(() => {
  return [...conditions].sort((a, b) => {
    const dateA = new Date(a.onsetDateTime || '1900-01-01');
    const dateB = new Date(b.onsetDateTime || '1900-01-01');
    return dateB - dateA;
  });
}, [conditions]);
```

### 5. Context Optimization

#### BEFORE (Context recreated every render):
```javascript
// FHIRResourceContext.js
return (
  <FHIRResourceContext.Provider value={{
    resources: {
      conditions,
      medications,
      allergies,
      procedures,
      observations
    },
    isLoading,
    error,
    currentPatient,
    setCurrentPatient,
    refreshResources,
    // ... more properties
  }}>
    {children}
  </FHIRResourceContext.Provider>
);
```

#### AFTER (Memoized context):
```javascript
// FHIRResourceContext.js
// Stable callbacks
const setCurrentPatient = useCallback(async (patientId) => {
  // implementation
}, []); // No deps if function doesn't use external values

const refreshResources = useCallback(async () => {
  // implementation
}, [currentPatient?.id]); // Only depend on what's needed

// Memoized context value
const contextValue = useMemo(() => ({
  resources: {
    conditions,
    medications,
    allergies,
    procedures,
    observations
  },
  isLoading,
  error,
  currentPatient,
  // Stable references
  setCurrentPatient,
  refreshResources
}), [
  conditions,
  medications,
  allergies,
  procedures,
  observations,
  isLoading,
  error,
  currentPatient,
  setCurrentPatient,
  refreshResources
]);

return (
  <FHIRResourceContext.Provider value={contextValue}>
    {children}
  </FHIRResourceContext.Provider>
);
```

### 6. Consolidated State Example

#### BEFORE (Many individual states):
```javascript
// ChartReviewTab.js - State chaos
const [showAddProblemDialog, setShowAddProblemDialog] = useState(false);
const [showEditProblemDialog, setShowEditProblemDialog] = useState(false);
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const [selectedProblem, setSelectedProblem] = useState(null);
const [problemFilter, setProblemFilter] = useState('all');
const [problemSearch, setProblemSearch] = useState('');
const [showAddMedicationDialog, setShowAddMedicationDialog] = useState(false);
const [showEditMedicationDialog, setShowEditMedicationDialog] = useState(false);
const [selectedMedication, setSelectedMedication] = useState(null);
// ... 10+ more states
```

#### AFTER (Consolidated state):
```javascript
// ChartReviewTab.js - Organized state
const initialState = {
  dialogs: {
    addProblem: false,
    editProblem: false,
    deleteProblem: false,
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
  search: {
    problems: '',
    medications: '',
    allergies: ''
  },
  ui: {
    expandedSections: {},
    activeTab: 0
  }
};

// Using useReducer for complex state
function chartReducer(state, action) {
  switch (action.type) {
    case 'OPEN_DIALOG':
      return {
        ...state,
        dialogs: { ...state.dialogs, [action.dialog]: true }
      };
    case 'CLOSE_DIALOG':
      return {
        ...state,
        dialogs: { ...state.dialogs, [action.dialog]: false },
        selected: { ...state.selected, [action.entityType]: null }
      };
    case 'SELECT_ITEM':
      return {
        ...state,
        selected: { ...state.selected, [action.entityType]: action.item }
      };
    case 'SET_FILTER':
      return {
        ...state,
        filters: { ...state.filters, [action.entityType]: action.filter }
      };
    case 'SET_SEARCH':
      return {
        ...state,
        search: { ...state.search, [action.entityType]: action.term }
      };
    default:
      return state;
  }
}

const [state, dispatch] = useReducer(chartReducer, initialState);

// Usage:
dispatch({ type: 'OPEN_DIALOG', dialog: 'addProblem' });
dispatch({ type: 'SELECT_ITEM', entityType: 'problem', item: problemData });
```

### 7. Custom Hook Example

#### Create Reusable Loading Hook:
```javascript
// hooks/useAsyncResource.js
export function useAsyncResource(asyncFunction, dependencies = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null
  });

  const execute = useCallback(async () => {
    let cancelled = false;
    
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await asyncFunction();
      
      if (!cancelled) {
        setState({
          data: result,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      if (!cancelled) {
        console.error('useAsyncResource error:', error);
        setState({
          data: null,
          loading: false,
          error: error.message || 'An error occurred'
        });
      }
    }
    
    return () => { cancelled = true; };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cleanup = execute();
    return cleanup;
  }, [execute]);

  const refresh = useCallback(() => {
    execute();
  }, [execute]);

  return { ...state, refresh };
}

// Usage in component:
const { data: encounters, loading, error, refresh } = useAsyncResource(
  async () => {
    const result = await fhirClient.search('Encounter', {
      patient: patientId,
      _sort: '-date'
    });
    return result.entry?.map(e => e.resource) || [];
  },
  [patientId]
);
```

### 8. Debug Helpers for Development

```javascript
// utils/devHelpers.js
export const DevPanel = ({ componentName, state }) => {
  if (process.env.NODE_ENV !== 'development') return null;
  
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        bgcolor: 'black',
        color: 'lime',
        p: 1,
        fontSize: 12,
        fontFamily: 'monospace',
        zIndex: 9999
      }}
    >
      <div>{componentName}</div>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </Box>
  );
};

// Usage in component:
<DevPanel 
  componentName="ChartReviewTab" 
  state={{ loading, errorCount, itemCount: conditions.length }} 
/>
```

## Testing Patterns

### 1. Test Loading States
```javascript
it('shows loading state while fetching data', async () => {
  const { getByRole } = render(<ChartReviewTab patientId="123" />);
  
  // Should show loading initially
  expect(getByRole('progressbar')).toBeInTheDocument();
  
  // Wait for loading to complete
  await waitFor(() => {
    expect(queryByRole('progressbar')).not.toBeInTheDocument();
  });
  
  // Should show data
  expect(getByText(/conditions found/i)).toBeInTheDocument();
});
```

### 2. Test Cleanup
```javascript
it('cleans up subscriptions on unmount', () => {
  const unsubscribeMock = jest.fn();
  const subscribeMock = jest.fn(() => unsubscribeMock);
  
  const { unmount } = render(
    <ChartReviewTab 
      patientId="123" 
      subscribe={subscribeMock}
    />
  );
  
  // Verify subscription was created
  expect(subscribeMock).toHaveBeenCalled();
  
  // Unmount component
  unmount();
  
  // Verify cleanup was called
  expect(unsubscribeMock).toHaveBeenCalled();
});
```

## Performance Monitoring

```javascript
// Add to App.js or main component
if (process.env.NODE_ENV === 'development') {
  // Log slow renders
  const logSlowRenders = (id, phase, actualDuration) => {
    if (actualDuration > 50) {
      console.warn(`⚠️ Slow render in ${id} (${phase}): ${actualDuration.toFixed(2)}ms`);
    }
  };
  
  // Wrap components
  <Profiler id="ClinicalWorkspace" onRender={logSlowRenders}>
    <ClinicalWorkspaceV3 />
  </Profiler>
}
```