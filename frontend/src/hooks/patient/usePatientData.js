/**
 * usePatientData Hook
 * Centralized patient data management for clinical workspace
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import { useProgressiveLoading } from '../ui/useProgressiveLoading';

export const usePatientData = (patientId, options = {}) => {
  const {
    useProgressive = true, // Enable progressive loading by default
    ...progressiveOptions
  } = options;

  const {
    currentPatient,
    setCurrentPatient,
    getResourcesByType,
    isLoading: fhirLoading,
    error: fhirError,
    searchResources,
  } = useFHIRResource();

  // Progressive loading hook
  const {
    loadingState: progressiveLoadingState,
    isCriticalDataLoaded,
    isMinimalDataLoaded,
    isFullyLoaded,
    progress: loadProgress,
    refresh: refreshProgressive
  } = useProgressiveLoading(patientId, {
    ...progressiveOptions,
    enabled: useProgressive
  });

  // Initialize loading state based on whether we need to load a patient
  const needsPatientLoad = patientId && (!currentPatient || currentPatient.id !== patientId);
  const [localLoading, setLocalLoading] = useState(needsPatientLoad);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Track the current load operation to prevent race conditions
  const loadingRef = useRef(false);
  const abortControllerRef = useRef(null);
  const lastRequestedPatientId = useRef(null);
  const requestIdCounter = useRef(0); // Incremental request ID for race condition prevention

  // Load patient if needed
  useEffect(() => {
    // Abort any previous load operation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const currentAbortController = abortControllerRef.current;

    const loadPatient = async () => {
      // Normalize IDs for comparison - handle potential case or format differences
      const normalizedPatientId = patientId?.trim();
      const normalizedCurrentId = currentPatient?.id?.trim();

      // Check if we need to load this patient
      if (normalizedPatientId && (!currentPatient || normalizedCurrentId !== normalizedPatientId)) {
        // Increment request ID for race condition prevention
        requestIdCounter.current += 1;
        const currentRequestId = requestIdCounter.current;

        loadingRef.current = true;
        lastRequestedPatientId.current = normalizedPatientId;
        setLocalLoading(true);
        setError(null);

        try {
          // Check if request was aborted before starting
          if (currentAbortController.signal.aborted) {
            return;
          }

          await setCurrentPatient(patientId);

          // Check if this request is still current (not superseded by newer request)
          if (!currentAbortController.signal.aborted && currentRequestId === requestIdCounter.current) {
            setIsInitialLoad(false);
            setLocalLoading(false);
            loadingRef.current = false;
          }
        } catch (err) {
          // Only handle error if request wasn't aborted and is still current
          if (!currentAbortController.signal.aborted && currentRequestId === requestIdCounter.current) {
            console.error('Failed to load patient:', err);
            setError(err.message || 'Failed to load patient data');
            setIsInitialLoad(false);
            setLocalLoading(false);
            loadingRef.current = false;
          }
        }
      } else if (currentPatient && normalizedCurrentId === normalizedPatientId) {
        // Patient already loaded
        setIsInitialLoad(false);
        setLocalLoading(false);
        loadingRef.current = false;
      } else if (!normalizedPatientId) {
        // No patient ID provided
        setIsInitialLoad(false);
        setLocalLoading(false);
        loadingRef.current = false;
      }
    };
    
    loadPatient();

    // Cleanup function to abort on unmount or dependency change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [patientId, currentPatient, setCurrentPatient]);

  // Remove the automatic syncing of loading states after initial load
  // This was causing the infinite loading issue because global loading state
  // might be true for other FHIR operations unrelated to this patient
  
  // Only sync error state after initial load
  useEffect(() => {
    if (!isInitialLoad && fhirError) {
      setError(fhirError);
    }
  }, [fhirError, isInitialLoad]);

  // Memoized patient data
  const patientData = useMemo(() => {
    if (!currentPatient) {
      return {
        patient: null,
        conditions: [],
        medications: [],
        allergies: [],
        encounters: [],
        observations: [],
        procedures: [],
        immunizations: [],
        carePlans: [],
        goals: [],
        documentReferences: [],
        diagnosticReports: [],
      };
    }

    return {
      patient: currentPatient,
      conditions: getResourcesByType('Condition') || [],
      medications: getResourcesByType('MedicationRequest') || [],
      allergies: getResourcesByType('AllergyIntolerance') || [],
      encounters: getResourcesByType('Encounter') || [],
      observations: getResourcesByType('Observation') || [],
      procedures: getResourcesByType('Procedure') || [],
      immunizations: getResourcesByType('Immunization') || [],
      carePlans: getResourcesByType('CarePlan') || [],
      goals: getResourcesByType('Goal') || [],
      documentReferences: getResourcesByType('DocumentReference') || [],
      diagnosticReports: getResourcesByType('DiagnosticReport') || [],
    };
  }, [currentPatient, getResourcesByType]);

  // Derived data
  const derivedData = useMemo(() => {
    const { conditions, medications, allergies, encounters, observations } = patientData;

    // Active conditions
    const activeConditions = conditions.filter(
      (c) => c.clinicalStatus?.coding?.[0]?.code === 'active'
    );

    // Active medications
    const activeMedications = medications.filter(
      (m) => m.status === 'active' || m.status === 'draft'
    );

    // Latest vitals
    const vitalSigns = observations.filter(
      (o) => o.category?.[0]?.coding?.[0]?.code === 'vital-signs'
    );

    // Sort encounters by date
    const sortedEncounters = [...encounters].sort((a, b) => {
      const dateA = new Date(a.period?.start || 0);
      const dateB = new Date(b.period?.start || 0);
      return dateB - dateA;
    });

    // Last encounter
    const lastEncounter = sortedEncounters[0] || null;

    // Risk factors
    const riskFactors = {
      hasAllergies: allergies.length > 0,
      hasCriticalAllergies: allergies.some(
        (a) => a.criticality === 'high' || a.type === 'allergy'
      ),
      polypharmacy: activeMedications.length >= 5,
      complexConditions: activeConditions.length >= 3,
    };

    return {
      activeConditions,
      activeMedications,
      vitalSigns,
      lastEncounter,
      sortedEncounters,
      riskFactors,
    };
  }, [patientData]);

  // Debounce timer ref and promise tracking for refresh function
  const refreshDebounceRef = useRef(null);
  const pendingRefreshPromise = useRef(null);

  // Refresh function with debouncing to prevent rapid consecutive calls
  const refreshPatientData = useCallback(async () => {
    if (!patientId) return;

    // Reject previous pending promise if it exists
    if (pendingRefreshPromise.current) {
      pendingRefreshPromise.current.reject(new Error('Superseded by new refresh request'));
      pendingRefreshPromise.current = null;
    }

    // Clear any pending refresh timer
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = null;
    }

    // Debounce the refresh to prevent rapid consecutive calls
    return new Promise((resolve, reject) => {
      // Store promise handlers for cleanup
      pendingRefreshPromise.current = { resolve, reject };

      refreshDebounceRef.current = setTimeout(async () => {
        // Clear the promise ref since we're executing now
        const promiseHandlers = pendingRefreshPromise.current;
        pendingRefreshPromise.current = null;
        refreshDebounceRef.current = null;

        // Abort any ongoing load operation
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        setLocalLoading(true);
        setError(null);

        try {
          // Trigger refresh through context
          await setCurrentPatient(patientId);
          if (promiseHandlers) {
            promiseHandlers.resolve();
          }
        } catch (err) {
          setError(err);
          if (promiseHandlers) {
            promiseHandlers.reject(err);
          }
        } finally {
          setLocalLoading(false);
        }
      }, 300); // 300ms debounce delay
    });
  }, [patientId, setCurrentPatient]);

  // Cleanup pending refresh promises on unmount
  useEffect(() => {
    return () => {
      if (pendingRefreshPromise.current) {
        pendingRefreshPromise.current.reject(new Error('Component unmounted'));
        pendingRefreshPromise.current = null;
      }
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, []);

  // Load specific resource type if not available
  const loadResourceType = useCallback(
    async (resourceType, params = {}) => {
      if (!patientId) return;

      try {
        await searchResources(resourceType, {
          patient: patientId,
          ...params,
        });
      } catch (err) {
        console.error(`Failed to load ${resourceType}:`, err);
      }
    },
    [patientId, searchResources]
  );

  return {
    // Core data
    ...patientData,
    
    // Derived data
    ...derivedData,
    
    // Additional summary counts
    encounterCount: patientData.encounters.length,
    conditionCount: patientData.conditions.length,
    medicationCount: patientData.medications.length,
    allergyCount: patientData.allergies.length,
    
    // Commonly needed derived data
    latestVitals: derivedData.vitalSigns[0] || null,
    criticalAllergies: patientData.allergies.filter(a => a.criticality === 'high'),
    
    // State
    loading: localLoading,
    error,
    
    // Progressive loading state
    progressiveLoading: {
      enabled: useProgressive,
      state: progressiveLoadingState,
      isCriticalDataLoaded,
      isMinimalDataLoaded,
      isFullyLoaded,
      progress: loadProgress
    },
    
    // Actions
    refreshPatientData: useProgressive ? refreshProgressive : refreshPatientData,
    loadResourceType,
  };
};