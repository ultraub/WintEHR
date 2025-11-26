/**
 * useProgressiveLoading Hook
 * Implements progressive loading strategy for patient data
 * Loads critical data first, then progressively loads additional data
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useFHIRResource } from '../../contexts/FHIRResourceContext';

// Priority levels for resource loading
const PRIORITY_LEVELS = {
  CRITICAL: 1,    // Must load immediately (patient, allergies, active meds)
  HIGH: 2,        // Load soon after critical (conditions, recent encounters)
  MEDIUM: 3,      // Load when idle (observations, procedures)
  LOW: 4          // Load last (historical data, documents)
};

// Resource priority mapping
const RESOURCE_PRIORITIES = {
  'Patient': PRIORITY_LEVELS.CRITICAL,
  'AllergyIntolerance': PRIORITY_LEVELS.CRITICAL,
  'MedicationRequest': PRIORITY_LEVELS.CRITICAL,
  'Condition': PRIORITY_LEVELS.HIGH,
  'Encounter': PRIORITY_LEVELS.HIGH,
  'Observation': PRIORITY_LEVELS.MEDIUM,
  'Procedure': PRIORITY_LEVELS.MEDIUM,
  'DiagnosticReport': PRIORITY_LEVELS.MEDIUM,
  'Immunization': PRIORITY_LEVELS.LOW,
  'DocumentReference': PRIORITY_LEVELS.LOW,
  'CarePlan': PRIORITY_LEVELS.LOW,
  'Goal': PRIORITY_LEVELS.LOW
};

export const useProgressiveLoading = (patientId, options = {}) => {
  const {
    priorityOverrides = {},
    loadDelay = 100, // Delay between priority levels
    maxConcurrent = 3, // Max concurrent requests
    onProgressUpdate = null // Callback for progress updates
  } = options;

  const { searchResources } = useFHIRResource();
  
  const [loadingState, setLoadingState] = useState({
    critical: { loading: false, loaded: false, error: null },
    high: { loading: false, loaded: false, error: null },
    medium: { loading: false, loaded: false, error: null },
    low: { loading: false, loaded: false, error: null },
    overall: { progress: 0, totalResources: 0, loadedResources: 0 }
  });

  const [resourcesLoaded, setResourcesLoaded] = useState(new Set());
  const loadingQueue = useRef([]);
  const activeLoads = useRef(0);
  const abortController = useRef(null);
  const isMounted = useRef(true);

  // Merge priority overrides with defaults
  const resourcePriorities = { ...RESOURCE_PRIORITIES, ...priorityOverrides };

  // Group resources by priority
  const getResourcesByPriority = useCallback(() => {
    const groups = {
      [PRIORITY_LEVELS.CRITICAL]: [],
      [PRIORITY_LEVELS.HIGH]: [],
      [PRIORITY_LEVELS.MEDIUM]: [],
      [PRIORITY_LEVELS.LOW]: []
    };

    Object.entries(resourcePriorities).forEach(([resource, priority]) => {
      if (groups[priority]) {
        groups[priority].push(resource);
      }
    });

    return groups;
  }, [resourcePriorities]);

  // Load a single resource type
  const loadResource = useCallback(async (resourceType) => {
    if (!patientId || !isMounted.current) return;
    
    try {
      activeLoads.current++;
      
      // Build search parameters based on resource type
      const searchParams = {
        patient: patientId,
        _count: resourceType === 'Encounter' ? 10 : 100, // Limit encounters
        _sort: '-_lastUpdated' // Get most recent first
      };

      // Add specific parameters for certain resources
      if (resourceType === 'MedicationRequest') {
        searchParams.status = 'active,completed';
      } else if (resourceType === 'Condition') {
        searchParams['clinical-status'] = 'active,recurrence,relapse';
      } else if (resourceType === 'Observation') {
        searchParams.category = 'vital-signs,laboratory';
        searchParams._count = 50; // Limit observations
      }

      await searchResources(resourceType, searchParams);
      
      if (isMounted.current) {
        setResourcesLoaded(prev => new Set([...prev, resourceType]));
        
        // Update progress
        setLoadingState(prev => ({
          ...prev,
          overall: {
            ...prev.overall,
            loadedResources: prev.overall.loadedResources + 1,
            progress: ((prev.overall.loadedResources + 1) / prev.overall.totalResources) * 100
          }
        }));

        // Notify progress
        if (onProgressUpdate) {
          onProgressUpdate({
            resourceType,
            loaded: true,
            progress: loadingState.overall.progress
          });
        }
      }
    } catch (error) {
      console.error(`Failed to load ${resourceType}:`, error);
      
      if (isMounted.current) {
        // Mark resource as failed but continue loading others
        setResourcesLoaded(prev => new Set([...prev, `${resourceType}_failed`]));
      }
    } finally {
      activeLoads.current--;
      processQueue();
    }
  }, [patientId, searchResources, onProgressUpdate, loadingState.overall.progress]);

  // Process loading queue
  const processQueue = useCallback(() => {
    if (!isMounted.current) return;
    
    while (activeLoads.current < maxConcurrent && loadingQueue.current.length > 0) {
      const nextResource = loadingQueue.current.shift();
      if (nextResource && !resourcesLoaded.has(nextResource)) {
        loadResource(nextResource);
      }
    }
  }, [maxConcurrent, resourcesLoaded, loadResource]);

  // Load resources by priority level
  const loadPriorityLevel = useCallback(async (priority, resources) => {
    if (!isMounted.current || resources.length === 0) return;

    const priorityName = Object.keys(PRIORITY_LEVELS).find(
      key => PRIORITY_LEVELS[key] === priority
    ).toLowerCase();

    // Update loading state
    setLoadingState(prev => ({
      ...prev,
      [priorityName]: { ...prev[priorityName], loading: true }
    }));

    // Add resources to queue
    resources.forEach(resource => {
      if (!resourcesLoaded.has(resource)) {
        loadingQueue.current.push(resource);
      }
    });

    // Start processing queue
    processQueue();

    // Wait for this priority level to complete
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        const allLoaded = resources.every(
          r => resourcesLoaded.has(r) || resourcesLoaded.has(`${r}_failed`)
        );
        
        if (allLoaded || !isMounted.current) {
          clearInterval(checkInterval);
          
          if (isMounted.current) {
            setLoadingState(prev => ({
              ...prev,
              [priorityName]: {
                loading: false,
                loaded: true,
                error: null
              }
            }));
          }
          
          resolve();
        }
      }, 100);
    });
  }, [resourcesLoaded, processQueue]);

  // Main loading orchestrator
  const startProgressiveLoad = useCallback(async () => {
    if (!patientId || !isMounted.current) return;

    // Cancel any existing loads
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    // Reset state
    setResourcesLoaded(new Set());
    loadingQueue.current = [];
    activeLoads.current = 0;

    const resourceGroups = getResourcesByPriority();
    const totalResources = Object.values(resourceGroups).flat().length;

    // Update initial state
    setLoadingState({
      critical: { loading: false, loaded: false, error: null },
      high: { loading: false, loaded: false, error: null },
      medium: { loading: false, loaded: false, error: null },
      low: { loading: false, loaded: false, error: null },
      overall: { progress: 0, totalResources, loadedResources: 0 }
    });

    // Load resources progressively by priority
    try {
      // Load critical resources immediately
      await loadPriorityLevel(PRIORITY_LEVELS.CRITICAL, resourceGroups[PRIORITY_LEVELS.CRITICAL]);
      
      // Small delay before high priority
      if (isMounted.current && loadDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, loadDelay));
      }
      
      // Load high priority resources
      await loadPriorityLevel(PRIORITY_LEVELS.HIGH, resourceGroups[PRIORITY_LEVELS.HIGH]);
      
      // Delay before medium priority
      if (isMounted.current && loadDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, loadDelay * 2));
      }
      
      // Load medium priority resources
      await loadPriorityLevel(PRIORITY_LEVELS.MEDIUM, resourceGroups[PRIORITY_LEVELS.MEDIUM]);
      
      // Delay before low priority
      if (isMounted.current && loadDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, loadDelay * 3));
      }
      
      // Load low priority resources
      await loadPriorityLevel(PRIORITY_LEVELS.LOW, resourceGroups[PRIORITY_LEVELS.LOW]);
      
    } catch (error) {
      console.error('Progressive loading error:', error);
    }
  }, [patientId, getResourcesByPriority, loadPriorityLevel, loadDelay]);

  // Start loading when patient changes
  useEffect(() => {
    if (patientId) {
      startProgressiveLoad();
    }

    return () => {
      isMounted.current = false;
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [patientId]); // Don't include startProgressiveLoad to avoid loops

  // Refresh function
  const refresh = useCallback(() => {
    startProgressiveLoad();
  }, [startProgressiveLoad]);

  // Check if critical data is loaded
  const isCriticalDataLoaded = loadingState.critical.loaded;
  
  // Check if enough data is loaded for basic functionality
  const isMinimalDataLoaded = loadingState.critical.loaded && loadingState.high.loaded;
  
  // Check if all data is loaded
  const isFullyLoaded = loadingState.low.loaded;

  return {
    loadingState,
    resourcesLoaded,
    isCriticalDataLoaded,
    isMinimalDataLoaded,
    isFullyLoaded,
    progress: loadingState.overall.progress,
    refresh,
    startProgressiveLoad
  };
};

export default useProgressiveLoading;