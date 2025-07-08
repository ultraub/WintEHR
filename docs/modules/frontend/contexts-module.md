# Contexts Module

## Overview
The Contexts Module implements React Context API patterns to provide global state management, cross-component communication, and shared functionality throughout MedGenEMR. This module demonstrates advanced state management patterns for healthcare applications.

## Architecture
```
Contexts Module
├── FHIRResourceContext.js (Resource caching & management)
├── ClinicalWorkflowContext.js (Cross-module events)
├── AuthContext.js (Authentication state)
├── PatientContext.js (Current patient state)
└── WebSocketContext.js (Real-time updates)
```

## Core Contexts

### FHIRResourceContext
**Purpose**: Centralized FHIR resource management with caching and auto-refresh

**State Management**:
```javascript
{
  resources: {
    conditions: [],
    medications: [],
    allergies: [],
    encounters: [],
    observations: [],
    procedures: []
  },
  loading: false,
  error: null,
  lastRefresh: Date
}
```

**Key Features**:
- Automatic resource fetching on patient change
- Intelligent caching with TTL
- Batch refresh capabilities
- Optimistic updates
- Error recovery

**Provider Methods**:
```javascript
// Resource operations
createResource(resourceType, data)
updateResource(resourceType, id, data)
deleteResource(resourceType, id)
refreshResources(resourceTypes)

// Convenience methods
getActiveConditions()
getCurrentMedications()
getRecentEncounters()
```

### ClinicalWorkflowContext
**Purpose**: Event-driven communication between clinical modules

**Event System**:
```javascript
const CLINICAL_EVENTS = {
  // Order workflow
  ORDER_PLACED: 'order.placed',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  
  // Results workflow
  RESULT_RECEIVED: 'result.received',
  RESULT_REVIEWED: 'result.reviewed',
  ABNORMAL_RESULT: 'result.abnormal',
  
  // Medication workflow
  PRESCRIPTION_CREATED: 'prescription.created',
  MEDICATION_DISPENSED: 'medication.dispensed',
  MEDICATION_DISCONTINUED: 'medication.discontinued',
  
  // Clinical documentation
  NOTE_CREATED: 'note.created',
  PROBLEM_ADDED: 'problem.added',
  ALLERGY_DOCUMENTED: 'allergy.documented'
};
```

**Publisher-Subscriber Pattern**:
```javascript
// Publishing events
publish(eventType, payload, metadata)

// Subscribing to events
subscribe(eventType, handler)
subscribeMultiple(eventTypes, handler)
unsubscribe(subscriptionId)
```

**Workflow Orchestration**:
- Cross-tab coordination
- Action queuing
- Event replay
- State synchronization
- Conflict resolution

### AuthContext
**Purpose**: Authentication state and permission management

**State Structure**:
```javascript
{
  user: {
    id: string,
    name: string,
    role: string,
    permissions: []
  },
  isAuthenticated: boolean,
  authMode: 'simple' | 'jwt',
  loading: boolean,
  error: null
}
```

**Key Methods**:
```javascript
// Authentication
login(credentials)
logout()
refreshAuth()

// Authorization
hasPermission(resource, action)
canAccess(route)
getUserRole()

// Session management
validateSession()
extendSession()
```

### PatientContext
**Purpose**: Current patient state and demographics

**Patient State**:
```javascript
{
  patient: {
    id: string,
    name: object,
    birthDate: string,
    gender: string,
    identifier: [],
    address: [],
    telecom: []
  },
  loading: boolean,
  error: null
}
```

**Features**:
- Patient selection management
- Demographic caching
- Recent patients list
- Patient search integration
- Context switching

### WebSocketContext
**Purpose**: Real-time updates and notifications

**Connection Management**:
```javascript
{
  socket: WebSocket,
  connected: boolean,
  reconnecting: boolean,
  messageQueue: []
}
```

**Real-time Features**:
- Auto-reconnection
- Message queuing
- Event subscription
- Heartbeat monitoring
- Connection state

**Event Types**:
```javascript
// Real-time notifications
PATIENT_UPDATED: 'patient.updated'
LAB_RESULT_READY: 'lab.result.ready'
MEDICATION_ALERT: 'medication.alert'
SYSTEM_NOTIFICATION: 'system.notification'
```

## Shared Patterns

### Context Provider Pattern
```javascript
export const SomeContext = createContext();

export const SomeProvider = ({ children }) => {
  const [state, setState] = useState(initialState);
  
  // Memoize context value
  const value = useMemo(() => ({
    ...state,
    actions: {
      someAction,
      anotherAction
    }
  }), [state]);
  
  return (
    <SomeContext.Provider value={value}>
      {children}
    </SomeContext.Provider>
  );
};

// Custom hook for consuming context
export const useSome = () => {
  const context = useContext(SomeContext);
  if (!context) {
    throw new Error('useSome must be used within SomeProvider');
  }
  return context;
};
```

### State Update Pattern
```javascript
// Optimistic updates
const updateResource = async (type, id, data) => {
  // Optimistic update
  setState(prev => ({
    ...prev,
    resources: {
      ...prev.resources,
      [type]: prev.resources[type].map(r => 
        r.id === id ? { ...r, ...data } : r
      )
    }
  }));
  
  try {
    // Actual update
    const updated = await fhirService.updateResource(type, id, data);
    // Confirm update
    setState(prev => ({
      ...prev,
      resources: {
        ...prev.resources,
        [type]: prev.resources[type].map(r => 
          r.id === id ? updated : r
        )
      }
    }));
  } catch (error) {
    // Rollback on error
    await refreshResources([type]);
    throw error;
  }
};
```

### Error Boundary Integration
```javascript
class ContextErrorBoundary extends Component {
  componentDidCatch(error, errorInfo) {
    // Log context-related errors
    console.error('Context error:', error, errorInfo);
    // Reset context state if needed
  }
  
  render() {
    return this.props.children;
  }
}
```

## Integration Points

### Provider Hierarchy
```javascript
<AuthProvider>
  <PatientProvider>
    <FHIRResourceProvider>
      <ClinicalWorkflowProvider>
        <WebSocketProvider>
          <App />
        </WebSocketProvider>
      </ClinicalWorkflowProvider>
    </FHIRResourceProvider>
  </PatientProvider>
</AuthProvider>
```

### Cross-Context Communication
- Auth changes trigger resource refresh
- Patient changes clear resource cache
- WebSocket events update FHIR resources
- Workflow events coordinate UI updates

### Service Integration
- Contexts use service layer for API calls
- Services notify contexts of changes
- Bidirectional data flow
- Event-driven updates

## Key Features

### Performance Optimization
- React.memo for provider components
- useMemo for context values
- Selective re-renders
- Lazy loading strategies
- Subscription cleanup

### Developer Experience
- Custom hooks for each context
- TypeScript support (planned)
- Dev tools integration
- Clear error messages
- Comprehensive logging

### Healthcare-Specific
- HIPAA compliance considerations
- Audit trail integration
- Patient safety features
- Clinical workflow support
- Real-time collaboration

## Educational Value

### React Patterns
- Context API best practices
- Custom hook patterns
- State management strategies
- Performance optimization
- Error handling

### Architecture Patterns
- Pub/sub implementation
- Event-driven architecture
- Separation of concerns
- Dependency injection
- Observer pattern

### Healthcare Development
- Patient context switching
- Clinical event handling
- Real-time medical data
- Workflow orchestration
- Safety considerations

## Missing Features & Improvements

### Planned Enhancements
- Redux Toolkit migration (optional)
- Persistent state management
- Undo/redo functionality
- State time travel
- Analytics integration

### Technical Improvements
- TypeScript conversion
- Unit test coverage
- Performance profiling
- Memory leak prevention
- State validation

### Healthcare Features
- Multi-patient support
- Team collaboration
- Offline mode
- Conflict resolution
- Audit logging

## Best Practices

### Context Design
- Keep contexts focused
- Avoid deeply nested providers
- Use composition over inheritance
- Implement proper cleanup
- Document context contracts

### State Management
- Normalize complex state
- Use immutable updates
- Implement optimistic UI
- Handle loading states
- Provide error recovery

### Performance
- Memoize expensive computations
- Use React.memo wisely
- Implement virtual scrolling
- Lazy load heavy contexts
- Monitor re-render frequency

## Module Dependencies
```
Contexts Module
├── Services Module (API calls)
├── Utils Module (helpers)
├── Constants Module (event types)
└── External Dependencies
    ├── React Context API
    ├── WebSocket API
    └── Storage APIs
```

## Testing Strategy
- Context provider testing
- Hook testing with renderHook
- Integration testing
- Event flow testing
- State mutation testing