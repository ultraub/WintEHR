/**
 * useChartReviewResources Hook
 * 
 * Custom hook for efficiently loading and managing resources for the Chart Review tab
 * with support for filtering, searching, and real-time updates
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { useClinicalWorkflow } from '../contexts/ClinicalWorkflowContext';

const useChartReviewResources = (patientId, options = {}) => {
  const {
    includeInactive = false,
    realTimeUpdates = true,
    groupByCategory = true,
    sortOrder = 'desc'
  } = options;

  const { 
    getPatientResources, 
    fetchPatientBundle,
    fetchPatientEverything,
    searchResources: searchFHIRResources,
    currentPatient,
    isCacheWarm
  } = useFHIRResource();
  const { subscribe } = useClinicalWorkflow();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  // Resource states
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [immunizations, setImmunizations] = useState([]);
  const [observations, setObservations] = useState([]);
  const [procedures, setProcedures] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [carePlans, setCarePlans] = useState([]);
  const [documentReferences, setDocumentReferences] = useState([]);
  
  // Filters - Default to showing all resources
  const [filters, setFilters] = useState({
    searchText: '',
    dateRange: null,
    status: 'all', // Always default to 'all' to show everything
    category: 'all'
  });

  // Load all resources
  const loadResources = useCallback(async () => {
    if (!patientId) {
      // No patientId provided - skip loading resources
      return;
    }

    // Loading resources for patient

    try {
      setLoading(true);
      setError(null);

      // First ensure patient data is loaded
      const isWarm = isCacheWarm(patientId, ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Immunization', 'Procedure', 'Encounter', 'CarePlan', 'DocumentReference']);
      
      if (!isWarm) {
        // Cache not warm - fetching patient data
        // Fetch critical data first
        try {
          // Use fetchPatientBundle instead of $everything due to backend limitations
          // The backend $everything doesn't return all resource types properly
          await fetchPatientBundle(patientId, false); // forceRefresh = false to use cache if available
        } catch (bundleError) {
          console.error('Failed to fetch patient bundle:', bundleError);
          // Try individual resource fetches as fallback
          const resourceTypes = ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Immunization', 'Observation', 'Procedure', 'Encounter', 'CarePlan', 'DocumentReference'];
          await Promise.all(resourceTypes.map(type => 
            searchFHIRResources(type, { patient: patientId }).catch(err => {
              console.error(`Failed to fetch ${type}:`, err);
              return [];
            })
          ));
        }
      }

      // Load resources from context or fetch if needed
      const [
        conditionData,
        medicationData,
        allergyData,
        immunizationData,
        observationData,
        procedureData,
        encounterData,
        carePlanData,
        documentReferenceData
      ] = await Promise.all([
        getPatientResources(patientId, 'Condition') || [],
        getPatientResources(patientId, 'MedicationRequest') || [],
        getPatientResources(patientId, 'AllergyIntolerance') || [],
        getPatientResources(patientId, 'Immunization') || [],
        getPatientResources(patientId, 'Observation') || [],
        getPatientResources(patientId, 'Procedure') || [],
        getPatientResources(patientId, 'Encounter') || [],
        getPatientResources(patientId, 'CarePlan') || [],
        getPatientResources(patientId, 'DocumentReference') || []
      ]);

      // Debug log the loaded data
      if (window.__FHIR_DEBUG__) {
        console.log('[useChartReviewResources] Loaded data:', {
          conditions: conditionData.length,
          medications: medicationData.length,
          allergies: allergyData.length,
          immunizations: immunizationData.length,
          observations: observationData.length,
          procedures: procedureData.length,
          encounters: encounterData.length,
          carePlans: carePlanData.length,
          documentReferences: documentReferenceData.length
        });
      }

      // Apply filters and sorting
      const processedConditions = processConditions(conditionData, filters, sortOrder);
      const processedMedications = processMedications(medicationData, filters, sortOrder);
      const processedAllergies = processAllergies(allergyData, filters, sortOrder);
      const processedImmunizations = processImmunizations(immunizationData, filters, sortOrder);
      const processedObservations = processObservations(observationData, filters, sortOrder);
      const processedProcedures = processProcedures(procedureData, filters, sortOrder);
      const processedEncounters = processEncounters(encounterData, filters, sortOrder);
      const processedCarePlans = processCarePlans(carePlanData, filters, sortOrder);
      const processedDocumentReferences = processDocumentReferences(documentReferenceData, filters, sortOrder);
      
      if (window.__FHIR_DEBUG__) {
        console.log('[useChartReviewResources] After processing:', {
          filters,
          processedConditions: processedConditions.length,
          processedMedications: processedMedications.length,
          processedAllergies: processedAllergies.length,
          processedImmunizations: processedImmunizations.length,
          processedObservations: processedObservations.length,
          processedProcedures: processedProcedures.length,
          processedEncounters: processedEncounters.length,
          processedCarePlans: processedCarePlans.length,
          processedDocumentReferences: processedDocumentReferences.length
        });
      }
      
      setConditions(processedConditions);
      setMedications(processedMedications);
      setAllergies(processedAllergies);
      setImmunizations(processedImmunizations);
      setObservations(processedObservations);
      setProcedures(processedProcedures);
      setEncounters(processedEncounters);
      setCarePlans(processedCarePlans);
      setDocumentReferences(processedDocumentReferences);

      setLastUpdated(new Date());
    } catch (err) {
      // Error loading chart review resources
      setError('Failed to load chart review data');
    } finally {
      setLoading(false);
    }
  }, [patientId, filters, includeInactive, sortOrder, getPatientResources, fetchPatientBundle, searchFHIRResources, isCacheWarm]);

  // Process conditions with filtering and grouping
  const processConditions = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by status
    if (filters.status !== 'all') {
      processed = processed.filter(c => 
        c.clinicalStatus?.coding?.[0]?.code === filters.status
      );
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(c => {
        const text = c.code?.text || c.code?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by onset date
    processed.sort((a, b) => {
      const dateA = a.onsetDateTime || a.recordedDate;
      const dateB = b.onsetDateTime || b.recordedDate;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process medications with grouping by status
  const processMedications = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by status
    if (filters.status !== 'all') {
      processed = processed.filter(m => 
        m.status === filters.status
      );
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(m => {
        const text = m.medicationCodeableConcept?.text || 
                    m.medicationCodeableConcept?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by authored date
    processed.sort((a, b) => {
      const dateA = a.authoredOn;
      const dateB = b.authoredOn;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process allergies
  const processAllergies = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by clinical status
    if (filters.status !== 'all') {
      processed = processed.filter(a => 
        a.clinicalStatus?.coding?.[0]?.code === filters.status
      );
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(a => {
        const text = a.code?.text || a.code?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by recorded date
    processed.sort((a, b) => {
      const dateA = a.recordedDate || a.onsetDateTime;
      const dateB = b.recordedDate || b.onsetDateTime;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process immunizations
  const processImmunizations = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by status - immunizations don't have 'active' status
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        // For immunizations, 'active' means completed
        processed = processed.filter(i => i.status === 'completed');
      } else {
        processed = processed.filter(i => 
          i.status === filters.status
        );
      }
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(i => {
        const text = i.vaccineCode?.text || 
                    i.vaccineCode?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by occurrence date
    processed.sort((a, b) => {
      const dateA = a.occurrenceDateTime || a.recorded;
      const dateB = b.occurrenceDateTime || b.recorded;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process observations (vital signs)
  const processObservations = (data, filters, sortOrder) => {
    let processed = data;

    // Filter vital signs category
    processed = processed.filter(o => 
      o.category?.some(cat => 
        cat.coding?.some(coding => 
          coding.code === 'vital-signs'
        )
      )
    );

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(o => {
        const text = o.code?.text || o.code?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by effective date
    processed.sort((a, b) => {
      const dateA = a.effectiveDateTime || a.issued;
      const dateB = b.effectiveDateTime || b.issued;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process procedures
  const processProcedures = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by status - procedures use 'completed', 'in-progress', etc.
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        // For procedures, 'active' means in-progress or preparation
        processed = processed.filter(p => 
          ['in-progress', 'preparation'].includes(p.status)
        );
      } else {
        processed = processed.filter(p => 
          p.status === filters.status
        );
      }
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(p => {
        const text = p.code?.text || p.code?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by performed date
    processed.sort((a, b) => {
      const dateA = a.performedDateTime || a.performedPeriod?.start;
      const dateB = b.performedDateTime || b.performedPeriod?.start;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process encounters
  const processEncounters = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by status
    if (filters.status !== 'all') {
      processed = processed.filter(e => 
        e.status === filters.status
      );
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(e => {
        const text = e.type?.[0]?.text || 
                    e.type?.[0]?.coding?.[0]?.display || 
                    e.reasonCode?.[0]?.text || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by period start
    processed.sort((a, b) => {
      const dateA = a.period?.start;
      const dateB = b.period?.start;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process care plans
  const processCarePlans = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by status - care plans use 'active', 'completed', 'draft', etc.
    if (filters.status !== 'all') {
      // CarePlan status values align well with 'active' filter
      processed = processed.filter(cp => 
        cp.status === filters.status
      );
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(cp => {
        const text = cp.title || 
                    cp.category?.[0]?.text || 
                    cp.category?.[0]?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by created date
    processed.sort((a, b) => {
      const dateA = a.created || a.period?.start;
      const dateB = b.created || b.period?.start;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Process document references
  const processDocumentReferences = (data, filters, sortOrder) => {
    let processed = data;

    // Filter by status - documents use 'current', 'superseded', 'entered-in-error'
    if (filters.status !== 'all') {
      if (filters.status === 'active') {
        // For documents, 'active' means current
        processed = processed.filter(doc => doc.status === 'current');
      } else {
        processed = processed.filter(doc => 
          doc.status === filters.status
        );
      }
    }

    // Filter by search text
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      processed = processed.filter(doc => {
        const text = doc.description || 
                    doc.type?.text || 
                    doc.type?.coding?.[0]?.display || '';
        return text.toLowerCase().includes(searchLower);
      });
    }

    // Sort by created date
    processed.sort((a, b) => {
      const dateA = a.date || a.content?.[0]?.attachment?.creation;
      const dateB = b.date || b.content?.[0]?.attachment?.creation;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? new Date(dateB) - new Date(dateA)
        : new Date(dateA) - new Date(dateB);
    });

    return processed;
  };

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  // Search function
  const searchResources = useCallback((searchText) => {
    updateFilters({ searchText });
  }, [updateFilters]);

  // Refresh data
  const refresh = useCallback(() => {
    loadResources();
  }, [loadResources]);

  // Get summary statistics
  const getSummaryStats = useMemo(() => {
    return {
      conditions: {
        total: conditions.length,
        active: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active').length,
        resolved: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'resolved').length
      },
      medications: {
        total: medications.length,
        active: medications.filter(m => m.status === 'active').length,
        stopped: medications.filter(m => m.status === 'stopped' || m.status === 'completed').length
      },
      allergies: {
        total: allergies.length,
        active: allergies.filter(a => a.clinicalStatus?.coding?.[0]?.code === 'active').length,
        highSeverity: allergies.filter(a => a.criticality === 'high').length
      },
      immunizations: {
        total: immunizations.length,
        completed: immunizations.filter(i => i.status === 'completed').length,
        due: immunizations.filter(i => i.status === 'not-done').length
      },
      vitals: {
        total: observations.length,
        recent: observations.filter(o => {
          const date = o.effectiveDateTime || o.issued;
          if (!date) return false;
          const daysDiff = (new Date() - new Date(date)) / (1000 * 60 * 60 * 24);
          return daysDiff <= 7;
        }).length
      },
      procedures: {
        total: procedures.length,
        completed: procedures.filter(p => p.status === 'completed').length,
        inProgress: procedures.filter(p => p.status === 'in-progress').length
      },
      encounters: {
        total: encounters.length,
        inProgress: encounters.filter(e => e.status === 'in-progress').length,
        finished: encounters.filter(e => e.status === 'finished').length
      },
      carePlans: {
        total: carePlans.length,
        active: carePlans.filter(cp => cp.status === 'active').length,
        completed: carePlans.filter(cp => cp.status === 'completed').length
      },
      documents: {
        total: documentReferences.length,
        current: documentReferences.filter(doc => doc.status === 'current').length,
        superseded: documentReferences.filter(doc => doc.status === 'superseded').length
      }
    };
  }, [conditions, medications, allergies, immunizations, observations, procedures, encounters, carePlans, documentReferences]);

  // Real-time updates subscription
  useEffect(() => {
    if (!realTimeUpdates || !patientId) return;

    const subscriptions = [];

    // Subscribe to resource update events
    const resourceTypes = [
      'Condition', 'MedicationRequest', 'AllergyIntolerance', 
      'Immunization', 'Observation', 'Procedure', 'Encounter',
      'CarePlan', 'DocumentReference'
    ];

    resourceTypes.forEach(resourceType => {
      const unsubscribe = subscribe(
        `RESOURCE_${resourceType.toUpperCase()}_UPDATED`,
        (event) => {
          if (event.patientId === patientId) {
            refresh();
          }
        }
      );
      subscriptions.push(unsubscribe);
    });

    return () => {
      subscriptions.forEach(unsub => unsub());
    };
  }, [patientId, realTimeUpdates, subscribe, refresh]);

  // Initial load - only when patientId changes
  useEffect(() => {
    if (patientId) {
      loadResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]); // Only depend on patientId to avoid repeated loads

  return {
    // Resources
    conditions,
    medications,
    allergies,
    immunizations,
    observations,
    procedures,
    encounters,
    carePlans,
    documentReferences,
    
    // State
    loading,
    error,
    lastUpdated,
    
    // Filters
    filters,
    updateFilters,
    searchResources,
    
    // Actions
    refresh,
    
    // Statistics
    stats: getSummaryStats
  };
};

export default useChartReviewResources;