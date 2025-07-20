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
  
  // Filters
  const [filters, setFilters] = useState({
    searchText: '',
    dateRange: null,
    status: includeInactive ? 'all' : 'active',
    category: 'all'
  });

  // Load all resources
  const loadResources = useCallback(async () => {
    if (!patientId) {
      console.log('useChartReviewResources: No patientId provided');
      return;
    }

    console.log('useChartReviewResources: Loading resources for patient:', patientId);

    try {
      setLoading(true);
      setError(null);

      // First ensure patient data is loaded
      const isWarm = isCacheWarm(patientId, ['Condition', 'MedicationRequest', 'AllergyIntolerance']);
      
      if (!isWarm) {
        console.log('useChartReviewResources: Cache not warm, fetching patient data');
        // Fetch critical data first
        try {
          await fetchPatientEverything(patientId, {
            types: ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Immunization', 'Observation', 'Procedure', 'Encounter'],
            count: 100,
            autoSince: true, // Last 3 months
            forceRefresh: false
          });
        } catch (everythingError) {
          console.warn('Patient $everything failed, trying batch bundle:', everythingError);
          await fetchPatientBundle(patientId, false, 'critical');
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
        encounterData
      ] = await Promise.all([
        getPatientResources(patientId, 'Condition') || [],
        getPatientResources(patientId, 'MedicationRequest') || [],
        getPatientResources(patientId, 'AllergyIntolerance') || [],
        getPatientResources(patientId, 'Immunization') || [],
        getPatientResources(patientId, 'Observation') || [],
        getPatientResources(patientId, 'Procedure') || [],
        getPatientResources(patientId, 'Encounter') || []
      ]);

      console.log('useChartReviewResources: Loaded data:', {
        conditions: conditionData.length,
        medications: medicationData.length,
        allergies: allergyData.length,
        immunizations: immunizationData.length,
        observations: observationData.length,
        procedures: procedureData.length,
        encounters: encounterData.length
      });

      // Apply filters and sorting
      setConditions(processConditions(conditionData, filters, sortOrder));
      setMedications(processMedications(medicationData, filters, sortOrder));
      setAllergies(processAllergies(allergyData, filters, sortOrder));
      setImmunizations(processImmunizations(immunizationData, filters, sortOrder));
      setObservations(processObservations(observationData, filters, sortOrder));
      setProcedures(processProcedures(procedureData, filters, sortOrder));
      setEncounters(processEncounters(encounterData, filters, sortOrder));

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error loading chart review resources:', err);
      setError('Failed to load chart review data');
    } finally {
      setLoading(false);
    }
  }, [patientId, filters, includeInactive, sortOrder, getPatientResources, fetchPatientBundle, fetchPatientEverything, isCacheWarm]);

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

    // Filter by status
    if (filters.status !== 'all' && filters.status !== 'active') {
      processed = processed.filter(i => 
        i.status === filters.status
      );
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

    // Filter by status
    if (filters.status !== 'all') {
      processed = processed.filter(p => 
        p.status === filters.status
      );
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
      }
    };
  }, [conditions, medications, allergies, immunizations, observations, procedures, encounters]);

  // Real-time updates subscription
  useEffect(() => {
    if (!realTimeUpdates || !patientId) return;

    const subscriptions = [];

    // Subscribe to resource update events
    const resourceTypes = [
      'Condition', 'MedicationRequest', 'AllergyIntolerance', 
      'Immunization', 'Observation', 'Procedure', 'Encounter'
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

  // Initial load
  useEffect(() => {
    loadResources();
  }, [loadResources]);

  return {
    // Resources
    conditions,
    medications,
    allergies,
    immunizations,
    observations,
    procedures,
    encounters,
    
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