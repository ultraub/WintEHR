import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

/**
 * Hook for managing a specific resource type with loading and error states
 */
export function useResourceType(resourceType, autoLoad = false, searchParams = {}) {
  const {
    getResourcesByType,
    searchResources,
    isLoading,
    getError,
    currentPatient
  } = useFHIRResource();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  const resources = getResourcesByType(resourceType);
  const loading = isLoading(resourceType) || localLoading;
  const error = getError(resourceType) || localError;

  const loadResources = useCallback(async (params = {}, forceRefresh = false) => {
    setLocalLoading(true);
    setLocalError(null);

    try {
      const finalParams = { ...searchParams, ...params };
      if (currentPatient && !finalParams.patient && !finalParams.subject) {
        finalParams.patient = currentPatient.id;
      }
      
      const result = await searchResources(resourceType, finalParams, forceRefresh);
      return result;
    } catch (err) {
      setLocalError(err.message);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  }, [resourceType, searchResources, searchParams, currentPatient]);

  const refresh = useCallback(() => {
    return loadResources({}, true);
  }, [loadResources]);

  // Auto-load on mount if requested
  useEffect(() => {
    if (autoLoad && resources.length === 0 && !loading && !error) {
      loadResources();
    }
  }, [autoLoad, resources.length, loading, error, loadResources]);

  return {
    resources,
    loading,
    error,
    loadResources,
    refresh,
    isEmpty: resources.length === 0 && !loading
  };
}

/**
 * Hook for managing patient-specific resources
 */
export function usePatientResourceType(patientId, resourceType, autoLoad = true) {
  const {
    getPatientResources,
    searchResources,
    isLoading,
    getError
  } = useFHIRResource();

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  const resources = useMemo(() => {
    return patientId ? getPatientResources(patientId, resourceType) : [];
  }, [patientId, getPatientResources, resourceType]);

  const loading = isLoading(resourceType) || localLoading;
  const error = getError(resourceType) || localError;

  const loadResources = useCallback(async (params = {}, forceRefresh = false) => {
    if (!patientId) return { resources: [] };

    setLocalLoading(true);
    setLocalError(null);

    try {
      const searchParams = { patient: patientId, ...params };
      const result = await searchResources(resourceType, searchParams, forceRefresh);
      return result;
    } catch (err) {
      setLocalError(err.message);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  }, [patientId, resourceType, searchResources]);

  const refresh = useCallback(() => {
    return loadResources({}, true);
  }, [loadResources]);

  // Auto-load on mount and when patientId changes
  useEffect(() => {
    if (autoLoad && patientId && resources.length === 0 && !loading && !error) {
      loadResources();
    }
  }, [autoLoad, patientId, resources.length, loading, error, loadResources]);

  return {
    resources,
    loading,
    error,
    loadResources,
    refresh,
    isEmpty: resources.length === 0 && !loading && patientId
  };
}

/**
 * Hook for managing encounters with additional encounter-specific logic
 */
export function useEncounters(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Encounter', autoLoad);
  
  const encounters = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.period?.start || a.period?.end || '1970-01-01');
      const dateB = new Date(b.period?.start || b.period?.end || '1970-01-01');
      return dateB - dateA; // Most recent first
    });
  }, [baseHook.resources]);

  const activeEncounters = useMemo(() => {
    return encounters.filter(enc => enc.status === 'in-progress' || enc.status === 'arrived');
  }, [encounters]);

  const recentEncounters = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return encounters.filter(enc => {
      const encDate = new Date(enc.period?.start || enc.period?.end || '1970-01-01');
      return encDate >= thirtyDaysAgo;
    });
  }, [encounters]);

  return {
    ...baseHook,
    encounters,
    activeEncounters,
    recentEncounters
  };
}

/**
 * Hook for managing conditions/problems with clinical logic
 */
export function useConditions(patientId, autoLoad = true) {
  const baseHook = usePatientResourceType(patientId, 'Condition', autoLoad);
  
  const conditions = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.recordedDate || a.onsetDateTime || '1970-01-01');
      const dateB = new Date(b.recordedDate || b.onsetDateTime || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources]);

  const activeConditions = useMemo(() => {
    return conditions.filter(condition => 
      condition.clinicalStatus?.coding?.[0]?.code === 'active'
    );
  }, [conditions]);

  const chronicConditions = useMemo(() => {
    return activeConditions.filter(condition => {
      const categories = condition.category || [];
      return categories.some(cat => 
        cat.coding?.some(code => 
          code.code === 'problem-list-item' || code.display?.toLowerCase().includes('chronic')
        )
      );
    });
  }, [activeConditions]);

  return {
    ...baseHook,
    conditions,
    activeConditions,
    chronicConditions
  };
}

/**
 * Hook for managing medications with medication-specific logic
 */
export function useMedications(patientId, autoLoad = true) {
  const medicationRequests = usePatientResourceType(patientId, 'MedicationRequest', autoLoad);
  const medicationStatements = usePatientResourceType(patientId, 'MedicationStatement', autoLoad);

  const allMedications = useMemo(() => {
    return [
      ...medicationRequests.resources.map(med => ({ ...med, sourceType: 'MedicationRequest' })),
      ...medicationStatements.resources.map(med => ({ ...med, sourceType: 'MedicationStatement' }))
    ].sort((a, b) => {
      const dateA = new Date(a.authoredOn || a.effectiveDateTime || '1970-01-01');
      const dateB = new Date(b.authoredOn || b.effectiveDateTime || '1970-01-01');
      return dateB - dateA;
    });
  }, [medicationRequests.resources, medicationStatements.resources]);

  const activeMedications = useMemo(() => {
    return allMedications.filter(med => med.status === 'active');
  }, [allMedications]);

  const loading = medicationRequests.loading || medicationStatements.loading;
  const error = medicationRequests.error || medicationStatements.error;

  const refresh = useCallback(async () => {
    await Promise.all([
      medicationRequests.refresh(),
      medicationStatements.refresh()
    ]);
  }, [medicationRequests.refresh, medicationStatements.refresh]);

  return {
    allMedications,
    activeMedications,
    medicationRequests: medicationRequests.resources,
    medicationStatements: medicationStatements.resources,
    loading,
    error,
    refresh,
    isEmpty: allMedications.length === 0 && !loading
  };
}

/**
 * Hook for managing observations with clinical filtering
 */
export function useObservations(patientId, category = null, autoLoad = true) {
  const searchParams = category ? { category } : {};
  const baseHook = usePatientResourceType(patientId, 'Observation', autoLoad);

  const observations = useMemo(() => {
    let filtered = baseHook.resources;
    
    if (category) {
      filtered = filtered.filter(obs => 
        obs.category?.some(cat => 
          cat.coding?.some(code => code.code === category)
        )
      );
    }
    
    return filtered.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.effectiveInstant || a.issued || '1970-01-01');
      const dateB = new Date(b.effectiveDateTime || b.effectiveInstant || b.issued || '1970-01-01');
      return dateB - dateA;
    });
  }, [baseHook.resources, category]);

  const vitals = useMemo(() => {
    return observations.filter(obs => 
      obs.category?.some(cat => 
        cat.coding?.some(code => code.code === 'vital-signs')
      )
    );
  }, [observations]);

  const labResults = useMemo(() => {
    return observations.filter(obs => 
      obs.category?.some(cat => 
        cat.coding?.some(code => code.code === 'laboratory')
      )
    );
  }, [observations]);

  return {
    ...baseHook,
    observations,
    vitals,
    labResults
  };
}

/**
 * Hook for comprehensive patient summary data
 */
export function usePatientSummary(patientId) {
  const { currentPatient } = useFHIRResource();
  const encounters = useEncounters(patientId);
  const conditions = useConditions(patientId);
  const medications = useMedications(patientId);
  const observations = useObservations(patientId);
  const allergies = usePatientResourceType(patientId, 'AllergyIntolerance');
  const procedures = usePatientResourceType(patientId, 'Procedure');

  const loading = encounters.loading || conditions.loading || medications.loading || 
                 observations.loading || allergies.loading || procedures.loading;

  const summary = useMemo(() => {
    if (!patientId || loading) return null;

    return {
      patient: currentPatient,
      demographics: {
        age: currentPatient ? calculateAge(currentPatient.birthDate) : null,
        gender: currentPatient?.gender,
        name: currentPatient?.name?.[0]
      },
      encounters: {
        total: encounters.encounters.length,
        active: encounters.activeEncounters.length,
        recent: encounters.recentEncounters.length
      },
      conditions: {
        total: conditions.conditions.length,
        active: conditions.activeConditions.length,
        chronic: conditions.chronicConditions.length
      },
      medications: {
        total: medications.allMedications.length,
        active: medications.activeMedications.length
      },
      observations: {
        total: observations.observations.length,
        vitals: observations.vitals.length,
        labs: observations.labResults.length
      },
      allergies: allergies.resources.length,
      procedures: procedures.resources.length
    };
  }, [patientId, loading, currentPatient, encounters, conditions, medications, observations, allergies, procedures]);

  return {
    summary,
    loading,
    refresh: async () => {
      await Promise.all([
        encounters.refresh(),
        conditions.refresh(),
        medications.refresh(),
        observations.refresh(),
        allergies.refresh(),
        procedures.refresh()
      ]);
    }
  };
}

// Utility function
function calculateAge(birthDate) {
  if (!birthDate) return null;
  
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}