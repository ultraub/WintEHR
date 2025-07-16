# FHIR Resource State Management Integration Guide

## Overview

The FHIR Resource State Management system provides centralized state management for all FHIR resources in the application. It includes caching, relationship mapping, and optimized data fetching strategies.

## Core Components

### 1. FHIRResourceContext
- **Location**: `/src/contexts/FHIRResourceContext.js`
- **Purpose**: Centralized state management for FHIR resources
- **Features**:
  - Resource storage organized by type and ID
  - Automatic relationship mapping between resources
  - Built-in caching with TTL support
  - Loading and error state management
  - Patient context management

### 2. Custom Hooks
- **Location**: `/src/hooks/useFHIRResources.js`
- **Purpose**: Simplified resource access patterns
- **Available Hooks**:
  - `useResourceType(resourceType, autoLoad, searchParams)`
  - `usePatientResourceType(patientId, resourceType, autoLoad)`
  - `useEncounters(patientId, autoLoad)`
  - `useConditions(patientId, autoLoad)`
  - `useMedications(patientId, autoLoad)`
  - `useObservations(patientId, category, autoLoad)`
  - `usePatientSummary(patientId)`

## Integration Steps

### Step 1: Wrap Application with Provider

Update your main App component to include the FHIRResourceProvider:

```javascript
// src/App.js
import { FHIRResourceProvider } from './contexts/FHIRResourceContext';

function App() {
  return (
    <FHIRResourceProvider>
      {/* Your existing app content */}
    </FHIRResourceProvider>
  );
}
```

### Step 2: Update Existing Components

Replace direct fhirClient calls with hooks:

#### Before (Direct API calls):
```javascript
import { fhirClient } from '../services/fhirClient';

function MyComponent({ patientId }) {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConditions = async () => {
      try {
        setLoading(true);
        const result = await fhirClient.search('Condition', { patient: patientId });
        setConditions(result.resources || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (patientId) {
      fetchConditions();
    }
  }, [patientId]);

  // Component logic...
}
```

#### After (Using hooks):
```javascript
import { useConditions } from '../hooks/useFHIRResources';

function MyComponent({ patientId }) {
  const { conditions, activeConditions, loading, error, refresh } = useConditions(patientId);

  // Component logic is now simplified...
}
```

### Step 3: Patient Context Management

Use the patient context for automatic resource management:

```javascript
import { useFHIRResource, usePatient } from '../contexts/FHIRResourceContext';

function PatientView({ patientId }) {
  const { setCurrentPatient } = useFHIRResource();
  const { patient, loadPatient } = usePatient(patientId);

  useEffect(() => {
    if (patientId) {
      setCurrentPatient(patientId); // This automatically preloads related resources
    }
  }, [patientId, setCurrentPatient]);

  // Patient and related resources are now available throughout the component tree
}
```

## Usage Examples

### 1. Simple Resource Loading
```javascript
import { useResourceType } from '../hooks/useFHIRResources';

function AllPatientsComponent() {
  const { resources: patients, loading, error, refresh } = useResourceType('Patient', true);

  if (loading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <List>
      {patients.map(patient => (
        <ListItem key={patient.id}>
          {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
        </ListItem>
      ))}
    </List>
  );
}
```

### 2. Patient-Specific Resources
```javascript
import { usePatientResourceType } from '../hooks/useFHIRResources';

function PatientMedications({ patientId }) {
  const { 
    resources: medications, 
    loading, 
    error, 
    refresh 
  } = usePatientResourceType(patientId, 'MedicationRequest');

  const activeMedications = medications.filter(med => med.status === 'active');

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">
          Active Medications ({activeMedications.length})
          <IconButton onClick={refresh}>
            <RefreshIcon />
          </IconButton>
        </Typography>
        {/* Render medications */}
      </CardContent>
    </Card>
  );
}
```

### 3. Advanced Resource Relationships
```javascript
import { useFHIRResource } from '../contexts/FHIRResourceContext';

function EncounterDetails({ encounterId }) {
  const { getResource, searchResources } = useFHIRResource();
  const [encounterData, setEncounterData] = useState(null);

  useEffect(() => {
    const loadEncounterData = async () => {
      const encounter = getResource('Encounter', encounterId);
      
      if (encounter) {
        // Load related resources
        const [observations, procedures, medications] = await Promise.all([
          searchResources('Observation', { encounter: `Encounter/${encounterId}` }),
          searchResources('Procedure', { encounter: `Encounter/${encounterId}` }),
          searchResources('MedicationRequest', { encounter: `Encounter/${encounterId}` })
        ]);

        setEncounterData({
          encounter,
          observations: observations.resources || [],
          procedures: procedures.resources || [],
          medications: medications.resources || []
        });
      }
    };

    loadEncounterData();
  }, [encounterId, getResource, searchResources]);

  // Render encounter with related data
}
```

### 4. Comprehensive Patient Summary
```javascript
import { usePatientSummary } from '../hooks/useFHIRResources';

function PatientSummaryCard({ patientId }) {
  const { summary, loading, refresh } = usePatientSummary(patientId);

  if (loading) return <Skeleton />;

  return (
    <Grid container spacing={2}>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4">{summary.encounters.total}</Typography>
          <Typography variant="caption">Total Encounters</Typography>
        </Paper>
      </Grid>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4">{summary.conditions.active}</Typography>
          <Typography variant="caption">Active Conditions</Typography>
        </Paper>
      </Grid>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4">{summary.medications.active}</Typography>
          <Typography variant="caption">Active Medications</Typography>
        </Paper>
      </Grid>
      <Grid item xs={3}>
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="h4">{summary.allergies}</Typography>
          <Typography variant="caption">Known Allergies</Typography>
        </Paper>
      </Grid>
    </Grid>
  );
}
```

## Migration Strategy

### Phase 1: Core Components
1. Wrap App with FHIRResourceProvider
2. Update PatientView components to use patient context
3. Migrate PatientDashboard to use summary hooks

### Phase 2: Clinical Components
1. Update VitalSignsFlowsheet to use `useObservations`
2. Update MedicationReconciliation to use `useMedications`
3. Update ChartReviewTab to use specific resource hooks
4. Update OrdersResultsTab to use observation hooks

### Phase 3: Advanced Features
1. Implement real-time updates via WebSocket integration
2. Add offline support with service worker caching
3. Implement resource relationship visualizations
4. Add audit trail integration

## Best Practices

### 1. Resource Loading
- Use `autoLoad=true` for components that immediately need data
- Use `autoLoad=false` for components that load data conditionally
- Always handle loading and error states

### 2. Caching
- Default cache TTL is 5 minutes for resources, 10 minutes for bundles
- Use `forceRefresh=true` when you need fresh data
- Clear cache when data might be stale

### 3. Performance
- Use patient context to preload related resources
- Batch related resource requests when possible
- Implement pagination for large resource sets

### 4. Error Handling
- Always check for and display error states
- Provide refresh mechanisms for failed requests
- Log errors for debugging but show user-friendly messages

## Testing

### Unit Tests
```javascript
import { renderHook } from '@testing-library/react-hooks';
import { FHIRResourceProvider } from '../contexts/FHIRResourceContext';
import { useConditions } from '../hooks/useFHIRResources';

const wrapper = ({ children }) => <FHIRResourceProvider>{children}</FHIRResourceProvider>;

test('useConditions loads patient conditions', async () => {
  const { result, waitForNextUpdate } = renderHook(
    () => useConditions('patient-123'),
    { wrapper }
  );

  expect(result.current.loading).toBe(true);
  
  await waitForNextUpdate();
  
  expect(result.current.loading).toBe(false);
  expect(result.current.conditions).toHaveLength(5);
  expect(result.current.activeConditions).toHaveLength(3);
});
```

### Integration Tests
```javascript
import { render, screen, waitFor } from '@testing-library/react';
import { FHIRResourceProvider } from '../contexts/FHIRResourceContext';
import PatientDashboard from '../components/PatientDashboard';

test('PatientDashboard displays patient summary', async () => {
  render(
    <FHIRResourceProvider>
      <PatientDashboard patientId="patient-123" />
    </FHIRResourceProvider>
  );

  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('5 Active Conditions')).toBeInTheDocument();
    expect(screen.getByText('12 Active Medications')).toBeInTheDocument();
  });
});
```

## Troubleshooting

### Common Issues

1. **Resources not loading**
   - Check if FHIRResourceProvider is wrapping the component
   - Verify fhirClient configuration
   - Check browser network tab for API errors

2. **Stale data**
   - Use `refresh()` method to force data reload
   - Check cache TTL settings
   - Clear cache if needed with `clearCache()`

3. **Performance issues**
   - Ensure you're not loading unnecessary resources
   - Use patient context for better resource batching
   - Implement proper loading states to avoid UI blocking

4. **Memory leaks**
   - Make sure components unmount properly
   - Avoid holding references to large resource objects
   - Clear cache periodically in long-running sessions