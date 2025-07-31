/**
 * Specialized hooks for clinical modules with optimized resource loading
 * Each hook loads only what's needed for its specific clinical view
 */
import { useCallback, useEffect, useState } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

/**
 * Hook for Summary Tab - loads only essential patient data
 */
export function useSummaryResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading } = useFHIRResource();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // Get cached resources
  const conditions = getPatientResources(patientId, 'Condition');
  const medications = getPatientResources(patientId, 'MedicationRequest');
  const allergies = getPatientResources(patientId, 'AllergyIntolerance');
  const vitals = getPatientResources(patientId, 'Observation').filter(obs => 
    obs.category?.[0]?.coding?.[0]?.code === 'vital-signs'
  );
  
  const loading = isResourceLoading('Condition') || 
                 isResourceLoading('MedicationRequest') || 
                 isResourceLoading('AllergyIntolerance') ||
                 isResourceLoading('Observation');
  
  const loadSummaryData = useCallback(async () => {
    if (!patientId) return;
    
    setIsInitialLoading(true);
    
    try {
      // Load in parallel with small counts
      await Promise.all([
        // Active conditions only
        searchResources('Condition', {
          patient: patientId,
          'clinical-status': 'active',
          _count: 10,
          _sort: '-recorded-date'
        }),
        
        // Active medications only
        searchResources('MedicationRequest', {
          patient: patientId,
          status: 'active,on-hold',
          _count: 10,
          _sort: '-authored'
        }),
        
        // All allergies (usually few)
        searchResources('AllergyIntolerance', {
          patient: patientId,
          _count: 10
        }),
        
        // Recent vital signs only (last 2 weeks)
        searchResources('Observation', {
          patient: patientId,
          category: 'vital-signs',
          _count: 20,
          _sort: '-date',
          date: `ge${new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
        })
      ]);
    } finally {
      setIsInitialLoading(false);
    }
  }, [patientId, searchResources]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && (conditions.length === 0 || medications.length === 0)) {
      loadSummaryData();
    }
  }, [patientId]);
  
  return {
    conditions,
    medications,
    allergies,
    vitals,
    loading: loading || isInitialLoading,
    refresh: loadSummaryData
  };
}

/**
 * Hook for Chart Review Tab - loads clinical documentation
 */
export function useChartReviewResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading } = useFHIRResource();
  
  const conditions = getPatientResources(patientId, 'Condition');
  const medications = getPatientResources(patientId, 'MedicationRequest');
  const allergies = getPatientResources(patientId, 'AllergyIntolerance');
  const immunizations = getPatientResources(patientId, 'Immunization');
  
  const loading = isResourceLoading('Condition') || 
                 isResourceLoading('MedicationRequest') || 
                 isResourceLoading('AllergyIntolerance') ||
                 isResourceLoading('Immunization');
  
  const loadChartData = useCallback(async () => {
    if (!patientId) return;
    
    await Promise.all([
      // All conditions for chart review
      searchResources('Condition', {
        patient: patientId,
        _count: 20,
        _sort: '-recorded-date'
      }),
      
      // All medications
      searchResources('MedicationRequest', {
        patient: patientId,
        _count: 20,
        _sort: '-authored'
      }),
      
      // All allergies
      searchResources('AllergyIntolerance', {
        patient: patientId,
        _count: 10
      }),
      
      // Recent immunizations (last 5 years)
      searchResources('Immunization', {
        patient: patientId,
        _count: 20,
        _sort: '-date',
        date: `ge${new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
      })
    ]);
  }, [patientId, searchResources]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && conditions.length === 0) {
      loadChartData();
    }
  }, [patientId]);
  
  return {
    conditions,
    medications,
    allergies,
    immunizations,
    loading,
    refresh: loadChartData
  };
}

/**
 * Hook for Results Tab - loads lab results and diagnostic reports
 */
export function useResultsResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading } = useFHIRResource();
  
  const observations = getPatientResources(patientId, 'Observation').filter(obs => 
    obs.category?.[0]?.coding?.[0]?.code === 'laboratory'
  );
  const diagnosticReports = getPatientResources(patientId, 'DiagnosticReport');
  
  const loading = isResourceLoading('Observation') || isResourceLoading('DiagnosticReport');
  
  const loadResultsData = useCallback(async () => {
    if (!patientId) return;
    
    await Promise.all([
      // Recent lab results (last 3 months)
      searchResources('Observation', {
        patient: patientId,
        category: 'laboratory',
        _count: 30,
        _sort: '-date',
        date: `ge${new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
      }),
      
      // Recent diagnostic reports (last 6 months)
      searchResources('DiagnosticReport', {
        patient: patientId,
        _count: 20,
        _sort: '-date',
        date: `ge${new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
      })
    ]);
  }, [patientId, searchResources]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && observations.length === 0) {
      loadResultsData();
    }
  }, [patientId]);
  
  return {
    observations,
    diagnosticReports,
    loading,
    refresh: loadResultsData
  };
}

/**
 * Hook for Orders Tab - loads service requests and medication orders
 */
export function useOrdersResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading } = useFHIRResource();
  
  const serviceRequests = getPatientResources(patientId, 'ServiceRequest');
  const medicationRequests = getPatientResources(patientId, 'MedicationRequest').filter(
    med => med.status === 'draft' || med.status === 'on-hold'
  );
  
  const loading = isResourceLoading('ServiceRequest') || isResourceLoading('MedicationRequest');
  
  const loadOrdersData = useCallback(async () => {
    if (!patientId) return;
    
    await Promise.all([
      // Active service requests
      searchResources('ServiceRequest', {
        patient: patientId,
        status: 'draft,active,on-hold',
        _count: 20,
        _sort: '-authored'
      }),
      
      // Pending medication orders
      searchResources('MedicationRequest', {
        patient: patientId,
        status: 'draft,on-hold',
        _count: 10,
        _sort: '-authored'
      })
    ]);
  }, [patientId, searchResources]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && serviceRequests.length === 0) {
      loadOrdersData();
    }
  }, [patientId]);
  
  return {
    serviceRequests,
    medicationRequests,
    loading,
    refresh: loadOrdersData
  };
}

/**
 * Hook for Medications Tab - loads detailed medication data
 */
export function useMedicationsResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading, searchWithInclude } = useFHIRResource();
  
  const medications = getPatientResources(patientId, 'MedicationRequest');
  const statements = getPatientResources(patientId, 'MedicationStatement');
  
  const loading = isResourceLoading('MedicationRequest') || isResourceLoading('MedicationStatement');
  
  const loadMedicationData = useCallback(async () => {
    if (!patientId) return;
    
    await Promise.all([
      // All medication requests with medication resource included
      searchWithInclude('MedicationRequest', {
        patient: patientId,
        _count: 30,
        _sort: '-authored'
      }, ['MedicationRequest:medication']),
      
      // Medication statements (patient reported)
      searchResources('MedicationStatement', {
        patient: patientId,
        _count: 20,
        _sort: '-effective'
      })
    ]);
  }, [patientId, searchResources, searchWithInclude]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && medications.length === 0) {
      loadMedicationData();
    }
  }, [patientId]);
  
  return {
    medications,
    statements,
    loading,
    refresh: loadMedicationData
  };
}

/**
 * Hook for Encounters Tab - loads encounter history
 */
export function useEncountersResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading } = useFHIRResource();
  
  const encounters = getPatientResources(patientId, 'Encounter');
  const loading = isResourceLoading('Encounter');
  
  const loadEncounterData = useCallback(async () => {
    if (!patientId) return;
    
    // Recent encounters (last year)
    await searchResources('Encounter', {
      patient: patientId,
      _count: 20,
      _sort: '-date',
      date: `ge${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
    });
  }, [patientId, searchResources]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && encounters.length === 0) {
      loadEncounterData();
    }
  }, [patientId]);
  
  return {
    encounters,
    loading,
    refresh: loadEncounterData
  };
}

/**
 * Hook for Imaging Tab - loads imaging studies
 */
export function useImagingResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading } = useFHIRResource();
  
  const imagingStudies = getPatientResources(patientId, 'ImagingStudy');
  const diagnosticReports = getPatientResources(patientId, 'DiagnosticReport').filter(
    report => report.category?.[0]?.coding?.[0]?.code === 'imaging'
  );
  
  const loading = isResourceLoading('ImagingStudy') || isResourceLoading('DiagnosticReport');
  
  const loadImagingData = useCallback(async () => {
    if (!patientId) return;
    
    await Promise.all([
      // Recent imaging studies (last year)
      searchResources('ImagingStudy', {
        patient: patientId,
        _count: 10,
        _sort: '-started',
        started: `ge${new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
      }),
      
      // Imaging reports
      searchResources('DiagnosticReport', {
        patient: patientId,
        category: 'imaging',
        _count: 10,
        _sort: '-date'
      })
    ]);
  }, [patientId, searchResources]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && imagingStudies.length === 0) {
      loadImagingData();
    }
  }, [patientId]);
  
  return {
    imagingStudies,
    diagnosticReports,
    loading,
    refresh: loadImagingData
  };
}

/**
 * Hook for Documents Tab - loads clinical documents
 */
export function useDocumentsResources(patientId) {
  const { searchResources, getPatientResources, isResourceLoading } = useFHIRResource();
  
  const documents = getPatientResources(patientId, 'DocumentReference');
  const loading = isResourceLoading('DocumentReference');
  
  const loadDocumentData = useCallback(async () => {
    if (!patientId) return;
    
    // Recent documents (last 2 years)
    await searchResources('DocumentReference', {
      patient: patientId,
      _count: 20,
      _sort: '-date',
      date: `ge${new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`
    });
  }, [patientId, searchResources]);
  
  // Auto-load on mount
  useEffect(() => {
    if (patientId && documents.length === 0) {
      loadDocumentData();
    }
  }, [patientId]);
  
  return {
    documents,
    loading,
    refresh: loadDocumentData
  };
}