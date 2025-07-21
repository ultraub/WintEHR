/**
 * WorkflowContext - Comprehensive clinical workflow state management
 * Manages workflow modes, active resources, and clinical context
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useFHIRResource } from '../contexts/FHIRResourceContext';
import { fhirClient } from '../core/fhir/services/fhirClient';

// Workflow modes that simulate real EMR workflows
const WORKFLOW_MODES = {
  CHART_REVIEW: {
    id: 'chart-review',
    name: 'Chart Review',
    description: 'Review patient history, problems, medications, and recent encounters',
    requiredResources: ['Patient', 'Condition', 'MedicationRequest', 'Encounter', 'AllergyIntolerance'],
    layout: 'sidebar',
    panels: {
      sidebar: 'problem-list',
      main: 'clinical-timeline'
    }
  },
  ENCOUNTER_DOCUMENTATION: {
    id: 'encounter-documentation',
    name: 'Documentation',
    description: 'Document patient encounter with clinical notes',
    requiredResources: ['Patient', 'Encounter', 'Condition', 'Observation'],
    layout: 'split-vertical',
    panels: {
      left: 'note-editor',
      right: 'relevant-data'
    }
  },
  ORDERS_MANAGEMENT: {
    id: 'orders-management',
    name: 'Orders & Prescriptions',
    description: 'Create and manage clinical orders and prescriptions',
    requiredResources: ['Patient', 'MedicationRequest', 'ServiceRequest', 'DiagnosticReport'],
    layout: 'three-column',
    panels: {
      left: 'order-catalog',
      center: 'active-orders',
      right: 'decision-support'
    }
  },
  RESULTS_REVIEW: {
    id: 'results-review',
    name: 'Results Review',
    description: 'Review lab results, imaging, and diagnostic reports',
    requiredResources: ['Patient', 'Observation', 'DiagnosticReport', 'ImagingStudy'],
    layout: 'split-horizontal',
    panels: {
      top: 'results-summary',
      bottom: 'detailed-results'
    }
  },
  CARE_PLANNING: {
    id: 'care-planning',
    name: 'Care Planning',
    description: 'Manage care plans, goals, and care team coordination',
    requiredResources: ['Patient', 'CarePlan', 'Goal', 'CareTeam', 'Task'],
    layout: 'split-vertical',
    panels: {
      left: 'care-plans',
      right: 'care-team'
    }
  },
  POPULATION_HEALTH: {
    id: 'population-health',
    name: 'Population Health',
    description: 'Analyze patient populations and quality measures',
    requiredResources: ['Patient', 'Measure', 'MeasureReport', 'Group'],
    layout: 'single',
    panels: {
      main: 'population-analytics'
    }
  }
};

// Clinical context that persists across workflow modes
const createInitialClinicalContext = () => ({
  activeEncounter: null,
  selectedConditions: [],
  selectedMedications: [],
  activeCarePlan: null,
  focusedTimeRange: 'all', // all, 1y, 6m, 3m, 1m
  resourceFilters: {
    status: 'active',
    category: null,
    priority: null
  }
});

const WorkflowContext = createContext();

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
};

export const WorkflowProvider = ({ children }) => {
  const [currentMode, setCurrentMode] = useState(WORKFLOW_MODES.CHART_REVIEW);
  const [clinicalContext, setClinicalContext] = useState(createInitialClinicalContext());
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [activeResources, setActiveResources] = useState({});
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [resourceErrors, setResourceErrors] = useState({});

  // Get patient ID from FHIR context
  const { currentPatient } = useFHIRResource();

  // Load required resources when workflow mode changes
  useEffect(() => {
    const loadWorkflowResources = async () => {
      if (!currentPatient?.id || !currentMode) return;

      setIsLoadingResources(true);
      setResourceErrors({});
      const newActiveResources = {};

      for (const resourceType of currentMode.requiredResources) {
        try {
          let searchParams = { patient: currentPatient.id };

          // Add specific search parameters based on resource type
          switch (resourceType) {
            case 'Condition':
              searchParams['clinical-status'] = clinicalContext.resourceFilters.status || 'active';
              break;
            case 'MedicationRequest':
              searchParams.status = clinicalContext.resourceFilters.status || 'active';
              break;
            case 'Encounter':
              searchParams._sort = '-date';
              searchParams._count = 20;
              break;
            case 'Observation':
              if (clinicalContext.resourceFilters.category) {
                searchParams.category = clinicalContext.resourceFilters.category;
              }
              searchParams._sort = '-date';
              searchParams._count = 100;
              break;
            case 'DiagnosticReport':
              searchParams.status = 'final';
              searchParams._sort = '-date';
              break;
            case 'Task':
              searchParams.status = 'requested,accepted,in-progress';
              break;
            default:
              break;
          }

          // Apply time range filter if set
          if (clinicalContext.focusedTimeRange !== 'all') {
            const dateRange = getDateRangeForFilter(clinicalContext.focusedTimeRange);
            searchParams.date = `ge${dateRange}`;
          }

          const result = await fhirClient.search(resourceType, searchParams);
          newActiveResources[resourceType] = result.resources || [];
        } catch (error) {
          
          setResourceErrors(prev => ({
            ...prev,
            [resourceType]: error.message
          }));
          newActiveResources[resourceType] = [];
        }
      }

      setActiveResources(newActiveResources);
      setIsLoadingResources(false);
    };

    loadWorkflowResources();
  }, [currentMode, currentPatient, clinicalContext.resourceFilters, clinicalContext.focusedTimeRange]);

  // Change workflow mode
  const changeWorkflowMode = useCallback((modeId) => {
    const newMode = Object.values(WORKFLOW_MODES).find(m => m.id === modeId);
    if (newMode) {
      setCurrentMode(newMode);
      setWorkflowHistory(prev => [...prev, { mode: newMode, timestamp: new Date() }]);
    }
  }, []);

  // Update clinical context
  const updateClinicalContext = useCallback((updates) => {
    setClinicalContext(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Set active encounter
  const setActiveEncounter = useCallback((encounter) => {
    updateClinicalContext({ activeEncounter: encounter });
  }, [updateClinicalContext]);

  // Set time range filter
  const setTimeRangeFilter = useCallback((range) => {
    updateClinicalContext({ focusedTimeRange: range });
  }, [updateClinicalContext]);

  // Set resource filters
  const setResourceFilter = useCallback((filterType, value) => {
    updateClinicalContext({
      resourceFilters: {
        ...clinicalContext.resourceFilters,
        [filterType]: value
      }
    });
  }, [clinicalContext.resourceFilters, updateClinicalContext]);

  // Get filtered resources based on current context
  const getFilteredResources = useCallback((resourceType) => {
    const resources = activeResources[resourceType] || [];
    
    // Apply additional filtering based on clinical context
    if (clinicalContext.activeEncounter && resourceType !== 'Patient') {
      // Filter resources related to active encounter if applicable
      return resources.filter(resource => {
        if (resource.encounter?.reference) {
          return resource.encounter.reference.includes(clinicalContext.activeEncounter.id);
        }
        return true;
      });
    }

    return resources;
  }, [activeResources, clinicalContext.activeEncounter]);

  // Quick workflow actions
  const quickActions = {
    reviewRecentResults: () => {
      changeWorkflowMode('results-review');
      setTimeRangeFilter('1m');
    },
    startDocumentation: (encounterId) => {
      changeWorkflowMode('encounter-documentation');
      if (encounterId) {
        const encounter = activeResources.Encounter?.find(e => e.id === encounterId);
        if (encounter) setActiveEncounter(encounter);
      }
    },
    reviewMedications: () => {
      changeWorkflowMode('chart-review');
      updateClinicalContext({ selectedMedications: activeResources.MedicationRequest || [] });
    },
    createOrders: () => {
      changeWorkflowMode('orders-management');
    }
  };

  const value = {
    // Current state
    currentMode,
    clinicalContext,
    activeResources,
    isLoadingResources,
    resourceErrors,
    workflowHistory,

    // Actions
    changeWorkflowMode,
    updateClinicalContext,
    setActiveEncounter,
    setTimeRangeFilter,
    setResourceFilter,
    getFilteredResources,
    quickActions,

    // Constants
    WORKFLOW_MODES
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

// Helper function to get date range
const getDateRangeForFilter = (filter) => {
  const now = new Date();
  switch (filter) {
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
    case '6m':
      return new Date(now.setMonth(now.getMonth() - 6)).toISOString().split('T')[0];
    case '3m':
      return new Date(now.setMonth(now.getMonth() - 3)).toISOString().split('T')[0];
    case '1m':
      return new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
    default:
      return null;
  }
};

export default WorkflowProvider;