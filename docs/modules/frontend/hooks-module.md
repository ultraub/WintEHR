# Hooks Module

## Overview
The Hooks Module provides reusable React hooks that encapsulate common healthcare-specific logic, data fetching patterns, and UI behaviors. This module demonstrates custom hook patterns for medical applications and promotes code reuse across components.

## Architecture
```
Hooks Module
├── useFHIRResources.js (Resource management)
├── useMedicationResolver.js (Medication display logic)
├── useClinicalWorkflow.js (Workflow shortcuts)
├── usePatientData.js (Patient-specific data)
├── useLabTrends.js (Lab result analysis)
├── useOrderSets.js (Order management)
├── useDebounce.js (Search optimization)
└── useInfiniteScroll.js (List pagination)
```

## Core Hooks

### useFHIRResources
**Purpose**: Simplified FHIR resource operations with automatic context integration

**API**:
```javascript
const {
  // Resources
  conditions,
  medications,
  allergies,
  encounters,
  observations,
  
  // State
  loading,
  error,
  
  // Operations
  createResource,
  updateResource,
  deleteResource,
  refreshResources,
  
  // Utilities
  getResourceById,
  filterActiveResources,
  sortByDate
} = useFHIRResources();
```

**Features**:
- Automatic patient context
- Optimistic updates
- Error recovery
- Cache invalidation
- Batch operations

**Usage Example**:
```javascript
function ProblemList() {
  const { conditions, createResource, loading } = useFHIRResources();
  
  const addProblem = async (problemData) => {
    await createResource('Condition', {
      ...problemData,
      subject: { reference: `Patient/${patientId}` }
    });
  };
  
  if (loading) return <Loading />;
  
  return (
    <List>
      {conditions.map(condition => (
        <ProblemItem key={condition.id} condition={condition} />
      ))}
    </List>
  );
}
```

### useMedicationResolver
**Purpose**: Resolves medication references and provides display logic

**API**:
```javascript
const {
  getMedicationDisplay,
  getMedicationStrength,
  getMedicationForm,
  resolveMedicationReference,
  isGeneric,
  getBrandName
} = useMedicationResolver();
```

**Features**:
- Reference resolution (Medication resources)
- CodeableConcept parsing
- Generic/brand detection
- Dosage formatting
- RxNorm integration

**Medication Resolution Logic**:
```javascript
// Handles both patterns:
// 1. Reference-based
{
  medicationReference: {
    reference: "Medication/123",
    display: "Lisinopril 10mg"
  }
}

// 2. CodeableConcept-based
{
  medicationCodeableConcept: {
    coding: [{
      system: "http://www.nlm.nih.gov/research/umls/rxnorm",
      code: "329528",
      display: "Lisinopril 10 MG Oral Tablet"
    }]
  }
}
```

### useClinicalWorkflow
**Purpose**: Simplifies clinical workflow event handling

**API**:
```javascript
const {
  // Event publishing
  publishOrderPlaced,
  publishResultReceived,
  publishMedicationDispensed,
  
  // Event subscription
  onOrderUpdate,
  onAbnormalResult,
  onMedicationChange,
  
  // Workflow state
  pendingActions,
  workflowStatus
} = useClinicalWorkflow();
```

**Workflow Patterns**:
- Order-to-result tracking
- Medication lifecycle
- Alert management
- Task coordination
- Status synchronization

### usePatientData
**Purpose**: Comprehensive patient data aggregation

**API**:
```javascript
const {
  // Demographics
  patient,
  age,
  preferredName,
  
  // Clinical summary
  activeMedications,
  activeProblems,
  recentVitals,
  upcomingAppointments,
  
  // Risk scores
  riskScores,
  alerts,
  
  // Actions
  refreshPatientData
} = usePatientData(patientId);
```

**Computed Properties**:
- Age calculation
- Risk stratification
- Allergy summaries
- Medication counts
- Care gaps

### useLabTrends
**Purpose**: Lab result trending and analysis

**API**:
```javascript
const {
  // Trend data
  trends,
  timeRange,
  
  // Analysis
  detectAbnormalTrends,
  calculateDeltas,
  getReferenceRanges,
  
  // Visualization
  chartData,
  chartOptions,
  
  // Filters
  setTimeRange,
  setLabTypes,
  setGrouping
} = useLabTrends(patientId, labCodes);
```

**Features**:
- Multi-parameter trending
- Reference range overlay
- Abnormal value detection
- Statistical analysis
- Chart.js integration

### useOrderSets
**Purpose**: Order set management and recommendations

**API**:
```javascript
const {
  // Order sets
  availableOrderSets,
  recommendedSets,
  
  // Orders
  createOrdersFromSet,
  customizeOrderSet,
  
  // Templates
  diseaseSpecificSets,
  preventiveCare
} = useOrderSets();
```

**Clinical Logic**:
- Problem-based recommendations
- Evidence-based protocols
- Customization support
- Bulk order creation
- Preference learning

## Utility Hooks

### useDebounce
**Purpose**: Optimize search and input handling

```javascript
const debouncedSearchTerm = useDebounce(searchTerm, 500);

useEffect(() => {
  if (debouncedSearchTerm) {
    searchMedications(debouncedSearchTerm);
  }
}, [debouncedSearchTerm]);
```

### useInfiniteScroll
**Purpose**: Efficient list rendering for large datasets

```javascript
const {
  items,
  loading,
  hasMore,
  loadMore,
  containerRef
} = useInfiniteScroll({
  fetchMore: fetchNextPage,
  threshold: 0.8
});
```

## Shared Patterns

### Error Handling Pattern
```javascript
const useResourceWithErrorHandling = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('Hook error:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { data, loading, error, refetch: fetch };
};
```

### Memoization Pattern
```javascript
const useExpensiveComputation = (data) => {
  return useMemo(() => {
    if (!data) return null;
    
    // Expensive computation
    return data.reduce((acc, item) => {
      // Complex logic
      return acc;
    }, {});
  }, [data]);
};
```

### Cleanup Pattern
```javascript
const useSubscription = (event, handler) => {
  useEffect(() => {
    const subscription = eventBus.subscribe(event, handler);
    
    return () => {
      subscription.unsubscribe();
    };
  }, [event, handler]);
};
```

## Integration Points

### Context Integration
- Hooks consume contexts for global state
- Automatic patient context awareness
- Auth state integration
- Resource cache utilization

### Service Layer
- Hooks use services for API calls
- Error handling delegation
- Response transformation
- Cache management

### Component Usage
- Hooks provide component-ready data
- Handle loading/error states
- Manage side effects
- Enable composition

## Key Features

### Healthcare-Specific Logic
- FHIR resource handling
- Clinical calculations
- Medical terminology
- Workflow automation
- Safety checks

### Performance Optimization
- Memoization strategies
- Debouncing/throttling
- Virtual scrolling
- Lazy loading
- Cache utilization

### Developer Experience
- Clear API design
- TypeScript support (planned)
- Comprehensive docs
- Usage examples
- Error messages

## Educational Value

### React Patterns
- Custom hook design
- Hook composition
- Effect management
- State encapsulation
- Performance hooks

### Healthcare Patterns
- Clinical workflows
- Medical calculations
- FHIR integration
- Terminology handling
- Safety patterns

### Best Practices
- Hook naming conventions
- Dependency arrays
- Cleanup functions
- Error boundaries
- Testing strategies

## Missing Features & Improvements

### Planned Enhancements
- TypeScript definitions
- Hook composition library
- Performance monitoring
- Usage analytics
- Auto-generation tools

### Clinical Features
- CDS Hooks integration
- Clinical calculators
- Risk scoring
- Quality measures
- Care coordination

### Technical Improvements
- Better error handling
- Request cancellation
- Offline support
- State persistence
- DevTools integration

## Best Practices

### Hook Design
- Single responsibility
- Clear naming (use prefix)
- Return consistent shape
- Handle edge cases
- Document thoroughly

### Performance
- Minimize re-renders
- Use proper dependencies
- Implement cleanup
- Memoize expensive ops
- Profile regularly

### Testing
- Test in isolation
- Mock dependencies
- Test error cases
- Verify cleanup
- Integration tests

## Module Dependencies
```
Hooks Module
├── Contexts Module (state access)
├── Services Module (API calls)
├── Utils Module (helpers)
└── External Dependencies
    ├── React Hooks API
    ├── Third-party hooks
    └── Testing utilities
```

## Testing Strategy
- Hook testing with @testing-library/react-hooks
- Mocking strategies for dependencies
- Async hook testing
- Error scenario coverage
- Performance benchmarks