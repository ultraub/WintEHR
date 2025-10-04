# Fix for Patient Context Management Issue

## Problem
Patient context can be lost during navigation, causing:
- Wrong patient data displayed
- Operations failing silently
- Inconsistent state between components

## Current State
- `patientId` passed as prop through multiple component levels
- Some components use `currentPatient` from FHIRResourceContext
- Some components use `patient` prop
- No centralized patient management

## Proposed Solution

### 1. Create Centralized Patient Context

Create a new file: `/frontend/src/contexts/PatientContext.js`

```javascript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useFHIRResource } from './FHIRResourceContext';
import { fhirClient } from '../core/fhir/services/fhirClient';

const PatientContext = createContext();

export const usePatient = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatient must be used within PatientProvider');
  }
  return context;
};

export const PatientProvider = ({ children }) => {
  const [patientId, setPatientId] = useState(null);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { currentPatient, setCurrentPatient } = useFHIRResource();

  // Load patient when ID changes
  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      setCurrentPatient(null);
      return;
    }

    const loadPatient = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const patientData = await fhirClient.read('Patient', patientId);
        if (patientData) {
          setPatient(patientData);
          setCurrentPatient(patientData); // Keep FHIRResourceContext in sync
        } else {
          throw new Error('Patient not found');
        }
      } catch (err) {
        console.error('Failed to load patient:', err);
        setError(err.message);
        setPatient(null);
        setCurrentPatient(null);
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [patientId, setCurrentPatient]);

  const selectPatient = useCallback((newPatientId) => {
    if (newPatientId === patientId) return; // Prevent unnecessary reloads
    
    // Validate patient ID format
    if (newPatientId && typeof newPatientId !== 'string') {
      console.error('Invalid patient ID:', newPatientId);
      return;
    }
    
    setPatientId(newPatientId);
  }, [patientId]);

  const clearPatient = useCallback(() => {
    setPatientId(null);
    setPatient(null);
    setCurrentPatient(null);
    setError(null);
  }, [setCurrentPatient]);

  // Helper to ensure patient context is valid
  const ensurePatientContext = useCallback(() => {
    if (!patientId || !patient) {
      throw new Error('No patient selected');
    }
    return { patientId, patient };
  }, [patientId, patient]);

  const value = {
    patientId,
    patient,
    loading,
    error,
    selectPatient,
    clearPatient,
    ensurePatientContext,
    isPatientSelected: Boolean(patientId && patient),
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};
```

### 2. Wrap App with PatientProvider

Update `/frontend/src/App.js`:

```javascript
import { PatientProvider } from './contexts/PatientContext';

function App() {
  return (
    <AuthProvider>
      <FHIRResourceProvider>
        <PatientProvider>
          <ClinicalWorkflowProvider>
            {/* ... rest of app ... */}
          </ClinicalWorkflowProvider>
        </PatientProvider>
      </FHIRResourceProvider>
    </AuthProvider>
  );
}
```

### 3. Update Components to Use Patient Context

#### Before (Problem):
```javascript
// Component receives patientId as prop
const SomeComponent = ({ patientId }) => {
  // PatientId can be undefined or lost
  if (!patientId) return null;
  // ...
};
```

#### After (Fixed):
```javascript
import { usePatient } from '../../contexts/PatientContext';

const SomeComponent = () => {
  const { patientId, patient, isPatientSelected, ensurePatientContext } = usePatient();
  
  // Guard against missing patient
  if (!isPatientSelected) {
    return <Alert severity="warning">No patient selected</Alert>;
  }
  
  const handleSomeAction = async () => {
    try {
      // This will throw if no patient, preventing wrong patient operations
      const { patientId, patient } = ensurePatientContext();
      
      // Now safe to use patientId
      await fhirClient.create('Observation', {
        subject: { reference: `Patient/${patientId}` }
      });
    } catch (error) {
      console.error('Operation failed:', error);
    }
  };
  
  // ...
};
```

### 4. Update Navigation to Maintain Context

In `/frontend/src/components/clinical/ClinicalWorkspaceEnhanced.js`:

```javascript
import { usePatient } from '../../contexts/PatientContext';

const ClinicalWorkspaceEnhanced = () => {
  const { patientId: urlPatientId } = useParams();
  const { selectPatient, patientId: contextPatientId } = usePatient();
  
  // Sync URL patient with context
  useEffect(() => {
    if (urlPatientId && urlPatientId !== contextPatientId) {
      selectPatient(decodeFhirId(urlPatientId));
    }
  }, [urlPatientId, contextPatientId, selectPatient]);
  
  // ...
};
```

### 5. Fix Reference Format Handling

Create a utility: `/frontend/src/utils/fhirReferences.js`

```javascript
/**
 * Normalizes FHIR references to a standard format
 * Handles: Patient/123, urn:uuid:123, 123
 */
export const normalizeReference = (reference, resourceType = 'Patient') => {
  if (!reference) return null;
  
  // Already in correct format
  if (reference.startsWith(`${resourceType}/`)) {
    return reference;
  }
  
  // URN format
  if (reference.startsWith('urn:uuid:')) {
    const id = reference.replace('urn:uuid:', '');
    return `${resourceType}/${id}`;
  }
  
  // Just the ID
  if (!reference.includes('/')) {
    return `${resourceType}/${reference}`;
  }
  
  return reference;
};

/**
 * Extracts ID from any reference format
 */
export const extractIdFromReference = (reference) => {
  if (!reference) return null;
  
  // Handle urn:uuid format
  if (reference.startsWith('urn:uuid:')) {
    return reference.replace('urn:uuid:', '');
  }
  
  // Handle ResourceType/id format
  if (reference.includes('/')) {
    return reference.split('/').pop();
  }
  
  // Assume it's just the ID
  return reference;
};

/**
 * Checks if a reference points to a specific patient
 */
export const isReferenceToPatient = (reference, patientId) => {
  const id = extractIdFromReference(reference);
  return id === patientId;
};
```

### 6. Update Resource Filtering

Fix the reference checking in components:

```javascript
import { isReferenceToPatient } from '../../utils/fhirReferences';

const conditions = useMemo(() => {
  if (!patientId) return [];
  
  return Object.values(resources.Condition || {}).filter(c => {
    // Check both possible reference fields
    const subjectRef = c.subject?.reference;
    const patientRef = c.patient?.reference;
    
    return isReferenceToPatient(subjectRef, patientId) || 
           isReferenceToPatient(patientRef, patientId);
  });
}, [resources.Condition, patientId]);
```

## Testing Plan

1. **Context Persistence Test**:
   - Navigate between tabs rapidly
   - Ensure patient context remains consistent
   - Check that patient data doesn't disappear

2. **Reference Format Test**:
   - Test with resources using `Patient/123` format
   - Test with resources using `urn:uuid:123` format
   - Test with resources using just `123`
   - Ensure all formats work correctly

3. **Error Handling Test**:
   - Try operations without patient selected
   - Ensure proper error messages appear
   - Verify no operations on wrong patient

4. **Performance Test**:
   - Ensure patient isn't reloaded unnecessarily
   - Check that context changes are efficient
   - Verify no infinite loops

## Migration Steps

1. **Phase 1**: Create PatientContext and wrap app
2. **Phase 2**: Update critical components (medication, orders, allergies)
3. **Phase 3**: Update remaining components
4. **Phase 4**: Remove prop drilling of patientId
5. **Phase 5**: Add comprehensive error boundaries

## Benefits

1. **Prevents Wrong Patient Errors**: Context ensures consistent patient across all components
2. **Cleaner Code**: No more prop drilling
3. **Better Error Handling**: Centralized patient validation
4. **Improved Performance**: Patient loaded once, shared everywhere
5. **Type Safety**: Can add TypeScript for additional safety