/**
 * usePatientData Hook
 * Centralized patient data management for clinical workspace
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

export const usePatientData = (patientId) => {
  const {
    currentPatient,
    setCurrentPatient,
    getResourcesByType,
    isLoading: fhirLoading,
    error: fhirError,
    searchResources,
  } = useFHIRResource();

  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load patient if needed
  useEffect(() => {
    if (patientId && (!currentPatient || currentPatient.id !== patientId)) {
      setCurrentPatient(patientId);
    }
  }, [patientId, currentPatient, setCurrentPatient]);

  // Combine loading states
  useEffect(() => {
    setLocalLoading(fhirLoading);
  }, [fhirLoading]);

  // Set error state
  useEffect(() => {
    setError(fhirError);
  }, [fhirError]);

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

  // Refresh function
  const refreshPatientData = useCallback(async () => {
    if (!patientId) return;

    setLocalLoading(true);
    setError(null);

    try {
      // Trigger refresh through context
      await setCurrentPatient(patientId);
    } catch (err) {
      setError(err);
    } finally {
      setLocalLoading(false);
    }
  }, [patientId, setCurrentPatient]);

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
    
    // State
    loading: localLoading,
    error,
    
    // Actions
    refreshPatientData,
    loadResourceType,
  };
};