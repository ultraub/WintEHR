/**
 * Shared hook for accessing patient clinical data across multiple tabs
 * Prevents duplicate API calls by using cached data from FHIRResourceContext
 */
import { useEffect, useMemo } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

export function usePatientClinicalData(patientId, options = {}) {
  const {
    priority = 'critical', // 'critical', 'important', or 'all'
    autoLoad = true,
    resourceTypes = null // Specific resource types to load, null means use priority defaults
  } = options;

  const {
    resources,
    fetchPatientBundle,
    isResourceLoading,
    isCacheWarm,
    currentPatient
  } = useFHIRResource();

  // Load data if not already cached
  useEffect(() => {
    if (patientId && autoLoad && !isCacheWarm(patientId)) {
      fetchPatientBundle(patientId, false, priority);
    }
  }, [patientId, autoLoad, priority, isCacheWarm, fetchPatientBundle]);

  // Extract patient-specific resources from context
  const patientResources = useMemo(() => {
    const getResourcesForPatient = (resourceType) => {
      return Object.values(resources[resourceType] || {}).filter(r => {
        // Handle different reference formats
        const subjectRef = r.subject?.reference;
        const patientRef = r.patient?.reference;
        const ref = subjectRef || patientRef;
        
        return ref === `Patient/${patientId}` || 
               ref === `urn:uuid:${patientId}`;
      });
    };

    // Default resource types based on priority
    const defaultTypes = {
      critical: ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Encounter'],
      important: ['Observation', 'Procedure', 'DiagnosticReport', 'Coverage'],
      all: [
        'Condition', 'MedicationRequest', 'AllergyIntolerance', 'Encounter',
        'Observation', 'Procedure', 'DiagnosticReport', 'Coverage',
        'Immunization', 'CarePlan', 'CareTeam', 'DocumentReference', 
        'ImagingStudy', 'ServiceRequest'
      ]
    };

    const typesToLoad = resourceTypes || defaultTypes[priority] || defaultTypes.critical;
    const result = {};

    typesToLoad.forEach(type => {
      result[type.toLowerCase()] = getResourcesForPatient(type);
    });

    return result;
  }, [resources, patientId, resourceTypes, priority]);

  // Calculate loading states
  const loading = useMemo(() => {
    if (!patientId) return false;
    
    const typesToCheck = resourceTypes || ['Condition', 'MedicationRequest', 'AllergyIntolerance'];
    return typesToCheck.some(type => isResourceLoading(type));
  }, [patientId, resourceTypes, isResourceLoading]);

  // Helper function to refresh data
  const refresh = async (forceRefresh = true) => {
    if (patientId) {
      return fetchPatientBundle(patientId, forceRefresh, priority);
    }
  };

  return {
    // Individual resource arrays
    conditions: patientResources.condition || [],
    medications: patientResources.medicationrequest || [],
    allergies: patientResources.allergyintolerance || [],
    encounters: patientResources.encounter || [],
    observations: patientResources.observation || [],
    procedures: patientResources.procedure || [],
    diagnosticReports: patientResources.diagnosticreport || [],
    immunizations: patientResources.immunization || [],
    carePlans: patientResources.careplan || [],
    careTeams: patientResources.careteam || [],
    documents: patientResources.documentreference || [],
    imagingStudies: patientResources.imagingstudy || [],
    serviceRequests: patientResources.servicerequest || [],
    coverage: patientResources.coverage || [],
    
    // All resources as an object
    resources: patientResources,
    
    // Current patient
    patient: currentPatient,
    
    // Loading state
    isLoading: loading,
    
    // Helper functions
    refresh,
    isCacheWarm: () => isCacheWarm(patientId)
  };
}

// Hook variant for specific resource types
export function usePatientResource(patientId, resourceType, options = {}) {
  const data = usePatientClinicalData(patientId, {
    ...options,
    resourceTypes: [resourceType]
  });

  const resourceKey = resourceType.toLowerCase();
  
  return {
    resources: data.resources[resourceKey] || [],
    isLoading: data.isLoading,
    refresh: data.refresh
  };
}