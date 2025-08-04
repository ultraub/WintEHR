/**
 * useChartReviewResources Hook
 * 
 * Custom hook for efficiently loading and managing resources for the Chart Review tab
 * with support for filtering, searching, and real-time updates
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { useClinicalWorkflow } from '../contexts/ClinicalWorkflowContext';
import { CLINICAL_EVENTS } from '../constants/clinicalEvents';

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
  
  // Ref to prevent multiple simultaneous loads
  const loadingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  
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

  // Store context functions in refs to prevent dependency changes
  const contextRefs = useRef({
    getPatientResources,
    fetchPatientBundle,
    searchFHIRResources,
    isCacheWarm
  });
  
  // Update refs when functions change
  useEffect(() => {
    contextRefs.current = {
      getPatientResources,
      fetchPatientBundle,
      searchFHIRResources,
      isCacheWarm
    };
  }, [getPatientResources, fetchPatientBundle, searchFHIRResources, isCacheWarm]);

  // Load all resources
  const loadResources = useCallback(async () => {
    if (!patientId || loadingRef.current) {
      console.log('[useChartReviewResources] Skipping load:', { patientId, loading: loadingRef.current });
      return;
    }

    console.log('[useChartReviewResources] Starting resource load for patient:', patientId);

    try {
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      // Enhanced data loading strategy to fix hard refresh and resource limit issues
      
      // Check cache warmth for all resource types we need
      const allResourceTypes = ['Condition', 'MedicationRequest', 'AllergyIntolerance', 'Immunization', 'Observation', 'Procedure', 'Encounter', 'CarePlan', 'DocumentReference'];
      const isWarm = contextRefs.current.isCacheWarm(patientId, allResourceTypes);
      
      // Force comprehensive data loading on hard refresh or when cache is cold
      if (!isWarm) {
        try {
          await contextRefs.current.fetchPatientBundle(patientId, false, 'all');
        } catch (bundleError) {
          // Silently fallback to individual resource fetches
        }
        
        // Direct search fallback for comprehensive coverage
        const directSearchPromises = allResourceTypes.map(async (type) => {
          try {
            const searchParams = { patient: patientId };
            
            if (type === 'Observation') {
              searchParams._count = '200';
              searchParams._sort = '-date';
            } else if (type === 'Encounter') {
              searchParams._count = '100';
              searchParams._sort = '-date';
            } else if (type === 'Condition') {
              searchParams._count = '100';
              searchParams._sort = '-recorded-date';
            } else if (type === 'MedicationRequest') {
              searchParams._count = '100';
              searchParams._sort = '-authored';
            } else {
              searchParams._count = '100';
            }
            
            return await contextRefs.current.searchFHIRResources(type, searchParams);
          } catch (err) {
            return [];
          }
        });
        
        await Promise.allSettled(directSearchPromises);
      }

      // Enhanced resource retrieval with fallback mechanism
      const getResourcesWithFallback = async (resourceType) => {
        let resources = contextRefs.current.getPatientResources(patientId, resourceType) || [];
        
        if (resources.length === 0) {
          try {
            const searchParams = { patient: patientId };
            
            if (resourceType === 'Observation') {
              searchParams._count = '200';
              searchParams._sort = '-date';
            } else if (resourceType === 'Encounter') {
              searchParams._count = '100';
              searchParams._sort = '-date';
            } else {
              searchParams._count = '100';
            }
            
            const searchResults = await contextRefs.current.searchFHIRResources(resourceType, searchParams);
            resources = searchResults || [];
          } catch (searchError) {
            // Silent fallback
          }
        }
        
        return resources;
      };

      // Load resources with enhanced fallback mechanism
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
        getResourcesWithFallback('Condition'),
        getResourcesWithFallback('MedicationRequest'),
        getResourcesWithFallback('AllergyIntolerance'),
        getResourcesWithFallback('Immunization'),
        getResourcesWithFallback('Observation'),
        getResourcesWithFallback('Procedure'),
        getResourcesWithFallback('Encounter'),
        getResourcesWithFallback('CarePlan'),
        getResourcesWithFallback('DocumentReference')
      ]);


      // Validate data before processing
      const validateResourceArray = (data, resourceType) => {
        if (!Array.isArray(data)) {
          return [];
        }
        return data.filter(item => item && typeof item === 'object');
      };

      const validConditions = validateResourceArray(conditionData, 'Conditions');
      const validMedications = validateResourceArray(medicationData, 'Medications');
      const validAllergies = validateResourceArray(allergyData, 'Allergies');
      const validImmunizations = validateResourceArray(immunizationData, 'Immunizations');
      const validObservations = validateResourceArray(observationData, 'Observations');
      const validProcedures = validateResourceArray(procedureData, 'Procedures');
      const validEncounters = validateResourceArray(encounterData, 'Encounters');
      const validCarePlans = validateResourceArray(carePlanData, 'CarePlans');
      const validDocumentReferences = validateResourceArray(documentReferenceData, 'DocumentReferences');

      // Store raw data - defer processing for performance
      setConditions(validConditions);
      setMedications(validMedications);
      setAllergies(validAllergies);
      setImmunizations(validImmunizations);
      setObservations(validObservations);
      setProcedures(validProcedures);
      setEncounters(validEncounters);
      setCarePlans(validCarePlans);
      setDocumentReferences(validDocumentReferences);

      setLastUpdated(new Date());
    } catch (err) {
      // Error loading chart review resources
      setError('Failed to load chart review data');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [patientId]); // Only depend on patientId since we use refs for context functions

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

    // Sort by onset date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.onsetDateTime || a.recordedDate;
      const dateB = b.onsetDateTime || b.recordedDate;
      if (!dateA || !dateB) return 0;
      // ISO date strings can be compared directly
      return sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
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

    // Sort by authored date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.authoredOn;
      const dateB = b.authoredOn;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
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

    // Sort by recorded date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.recordedDate || a.onsetDateTime;
      const dateB = b.recordedDate || b.onsetDateTime;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
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

    // Sort by occurrence date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.occurrenceDateTime || a.recorded;
      const dateB = b.occurrenceDateTime || b.recorded;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
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

    // Sort by effective date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.effectiveDateTime || a.issued;
      const dateB = b.effectiveDateTime || b.issued;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });

    return processed;
  };

  // Process procedures
  const processProcedures = (data, filters, sortOrder) => {
    let processed = data;

    // Debug logging (disabled)
    // console.log('[useChartReviewResources] Processing procedures:', {
    //   inputCount: data.length,
    //   filters,
    //   sortOrder
    // });

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

    // Sort by performed date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.performedDateTime || a.performedPeriod?.start;
      const dateB = b.performedDateTime || b.performedPeriod?.start;
      if (!dateA || !dateB) {
        // For stable sorting when dates are missing
        if (!dateA && !dateB) return a.id.localeCompare(b.id);
        if (!dateA) return 1;
        if (!dateB) return -1;
      }
      const dateComparison = sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
      // Add stable secondary sort by ID
      return dateComparison !== 0 ? dateComparison : a.id.localeCompare(b.id);
    });

    // console.log('[useChartReviewResources] Processed procedures:', {
    //   outputCount: processed.length,
    //   firstFewIds: processed.slice(0, 5).map(p => p.id)
    // });

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

    // Sort by period start - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.period?.start;
      const dateB = b.period?.start;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });

    return processed;
  };

  // Process care plans
  const processCarePlans = (data, filters, sortOrder) => {
    let processed = data;

    // Debug logging (disabled)
    // console.log('[useChartReviewResources] Processing care plans:', {
    //   inputCount: data.length,
    //   filters,
    //   sortOrder
    // });

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

    // Sort by created date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.created || a.period?.start;
      const dateB = b.created || b.period?.start;
      if (!dateA || !dateB) {
        // For stable sorting when dates are missing
        if (!dateA && !dateB) return a.id.localeCompare(b.id);
        if (!dateA) return 1;
        if (!dateB) return -1;
      }
      const dateComparison = sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
      // Add stable secondary sort by ID
      return dateComparison !== 0 ? dateComparison : a.id.localeCompare(b.id);
    });

    // console.log('[useChartReviewResources] Processed care plans:', {
    //   outputCount: processed.length,
    //   firstFewIds: processed.slice(0, 5).map(cp => cp.id)
    // });

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

    // Sort by created date - compare strings directly for performance
    processed.sort((a, b) => {
      const dateA = a.date || a.content?.[0]?.attachment?.creation;
      const dateB = b.date || b.content?.[0]?.attachment?.creation;
      if (!dateA || !dateB) return 0;
      return sortOrder === 'desc' 
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });

    return processed;
  };

  // Lazy process conditions - only when accessed
  const processedConditions = useMemo(() => {
    return processConditions(conditions, filters, sortOrder);
  }, [conditions, filters.status, filters.searchText, sortOrder]);

  // Lazy process medications
  const processedMedications = useMemo(() => {
    return processMedications(medications, filters, sortOrder);
  }, [medications, filters.status, filters.searchText, sortOrder]);

  // Lazy process allergies
  const processedAllergies = useMemo(() => {
    return processAllergies(allergies, filters, sortOrder);
  }, [allergies, filters.status, filters.searchText, sortOrder]);

  // Lazy process other resources
  const processedImmunizations = useMemo(() => {
    return processImmunizations(immunizations, filters, sortOrder);
  }, [immunizations, filters.status, filters.searchText, sortOrder]);

  const processedObservations = useMemo(() => {
    return processObservations(observations, filters, sortOrder);
  }, [observations, filters.searchText, sortOrder]);

  const processedProcedures = useMemo(() => {
    return processProcedures(procedures, filters, sortOrder);
  }, [procedures, filters.status, filters.searchText, sortOrder]);

  const processedEncounters = useMemo(() => {
    return processEncounters(encounters, filters, sortOrder);
  }, [encounters, filters.status, filters.searchText, sortOrder]);

  const processedCarePlans = useMemo(() => {
    return processCarePlans(carePlans, filters, sortOrder);
  }, [carePlans, filters.status, filters.searchText, sortOrder]);

  const processedDocumentReferences = useMemo(() => {
    return processDocumentReferences(documentReferences, filters, sortOrder);
  }, [documentReferences, filters.status, filters.searchText, sortOrder]);

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

  // Debounce timer ref for refresh
  const refreshTimerRef = useRef(null);

  // Refresh data - reset and reload with debounce
  const refresh = useCallback(() => {
    console.log('[useChartReviewResources] Refresh called');
    
    // Clear any pending refresh
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    
    // Debounce refresh to prevent rapid reloads
    refreshTimerRef.current = setTimeout(() => {
      console.log('[useChartReviewResources] Executing refresh after debounce');
      loadedPatientRef.current = null; // Clear the loaded patient to force reload
      loadResources();
    }, 500); // 500ms debounce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // No dependencies, loadResources is stable

  // Get summary statistics
  const getSummaryStats = useMemo(() => {
    return {
      conditions: {
        total: conditions.length,
        active: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'active').length,
        resolved: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'resolved').length,
        inactive: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'inactive').length,
        remission: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'remission').length,
        recurrence: conditions.filter(c => c.clinicalStatus?.coding?.[0]?.code === 'recurrence').length
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
          // Use ISO string comparison for dates within last 7 days
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return date >= sevenDaysAgo.toISOString();
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

    console.log('[useChartReviewResources] Setting up real-time subscriptions for patient:', patientId);

    const subscriptions = [];

    // Map of resource events to listen for
    const eventMappings = [
      // Conditions
      { events: [CLINICAL_EVENTS.CONDITION_ADDED, CLINICAL_EVENTS.CONDITION_UPDATED, CLINICAL_EVENTS.CONDITION_RESOLVED, CLINICAL_EVENTS.CONDITION_DELETED] },
      // Medications
      { events: [CLINICAL_EVENTS.MEDICATION_PRESCRIBED, CLINICAL_EVENTS.MEDICATION_UPDATED, CLINICAL_EVENTS.MEDICATION_DISCONTINUED] },
      // Allergies
      { events: [CLINICAL_EVENTS.ALLERGY_ADDED, CLINICAL_EVENTS.ALLERGY_UPDATED, CLINICAL_EVENTS.ALLERGY_RESOLVED, CLINICAL_EVENTS.ALLERGY_DELETED] },
      // Immunizations
      { events: [CLINICAL_EVENTS.IMMUNIZATION_ADMINISTERED, CLINICAL_EVENTS.IMMUNIZATION_UPDATED] },
      // Observations
      { events: [CLINICAL_EVENTS.OBSERVATION_RECORDED, CLINICAL_EVENTS.OBSERVATION_UPDATED, CLINICAL_EVENTS.VITAL_SIGNS_RECORDED] },
      // Procedures
      { events: [CLINICAL_EVENTS.PROCEDURE_SCHEDULED, CLINICAL_EVENTS.PROCEDURE_COMPLETED, CLINICAL_EVENTS.PROCEDURE_UPDATED] },
      // Encounters
      { events: [CLINICAL_EVENTS.ENCOUNTER_STARTED, CLINICAL_EVENTS.ENCOUNTER_UPDATED, CLINICAL_EVENTS.ENCOUNTER_FINISHED] },
      // Care Plans
      { events: [CLINICAL_EVENTS.CARE_PLAN_CREATED, CLINICAL_EVENTS.CARE_PLAN_UPDATED] },
      // Documents
      { events: [CLINICAL_EVENTS.DOCUMENT_CREATED, CLINICAL_EVENTS.DOCUMENT_UPDATED] },
      // Generic resource events
      { events: [CLINICAL_EVENTS.RESOURCE_CREATED, CLINICAL_EVENTS.RESOURCE_UPDATED, CLINICAL_EVENTS.RESOURCE_DELETED] }
    ];

    // Subscribe to all relevant events
    eventMappings.forEach(({ events }) => {
      events.forEach(eventType => {
        const unsubscribe = subscribe(
          eventType,
          (event) => {
            console.log('[useChartReviewResources] Clinical event received:', {
              eventType,
              eventPatientId: event.patientId,
              currentPatientId: patientId,
              willRefresh: event.patientId === patientId
            });
            // Refresh if the event is for the current patient
            if (event.patientId === patientId) {
              console.log('[useChartReviewResources] Refreshing data due to event:', eventType);
              refresh();
            }
          }
        );
        subscriptions.push(unsubscribe);
      });
    });

    return () => {
      console.log('[useChartReviewResources] Cleaning up subscriptions');
      subscriptions.forEach(unsub => unsub());
    };
  }, [patientId, realTimeUpdates, subscribe, refresh]);

  // Add debug logging for hook creation and cleanup refresh timer
  useEffect(() => {
    console.log('[useChartReviewResources] Hook initialized/re-created at:', new Date().toISOString());
    return () => {
      console.log('[useChartReviewResources] Hook cleanup at:', new Date().toISOString());
      // Clear refresh timer on unmount
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  // Track if we've loaded for this specific patient
  const loadedPatientRef = useRef(null);

  // Load data when patient changes
  useEffect(() => {
    console.log('[useChartReviewResources] Load effect triggered:', {
      patientId,
      loadedPatient: loadedPatientRef.current,
      hasLoaded: hasLoadedRef.current,
      loading: loadingRef.current,
      timestamp: new Date().toISOString()
    });

    if (!patientId) {
      hasLoadedRef.current = false;
      loadedPatientRef.current = null;
      return;
    }

    // Skip if already loaded for this specific patient
    if (loadingRef.current || loadedPatientRef.current === patientId) {
      console.log('[useChartReviewResources] Skipping - already loaded for patient:', patientId);
      return;
    }

    // Mark this patient as loaded
    loadedPatientRef.current = patientId;

    // Load resources directly without timeout
    console.log('[useChartReviewResources] Calling loadResources for patient:', patientId);
    loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]); // Only depend on patientId, loadResources is stable due to refs

  return {
    // Resources - return processed versions
    conditions: processedConditions,
    medications: processedMedications,
    allergies: processedAllergies,
    immunizations: processedImmunizations,
    observations: processedObservations,
    procedures: processedProcedures,
    encounters: processedEncounters,
    carePlans: processedCarePlans,
    documentReferences: processedDocumentReferences,
    
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