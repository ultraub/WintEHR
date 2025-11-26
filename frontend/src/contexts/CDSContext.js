/**
 * CDS Context Provider
 * Centralized management for Clinical Decision Support hooks and alerts
 * Prevents duplicate hook firing and provides a single source of truth
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { cdsHooksClient } from '../services/cdsHooksClient';
import { cdsHooksService } from '../services/cdsHooksService';
import { cdsLogger } from '../config/logging';
import { PRESENTATION_MODES } from '../components/clinical/cds/CDSPresentation';
import { useStableCallback } from '../hooks/ui/useStableReferences';
import { useAuth } from './AuthContext';
import { v4 as uuidv4 } from 'uuid';

// Context
const CDSContext = createContext();

// Hook types
export const CDS_HOOK_TYPES = {
  PATIENT_VIEW: 'patient-view',
  MEDICATION_PRESCRIBE: 'medication-prescribe',
  ORDER_SIGN: 'order-sign',
  ORDER_SELECT: 'order-select',
  ENCOUNTER_START: 'encounter-start',
  ENCOUNTER_DISCHARGE: 'encounter-discharge'
};

// Provider component
export const CDSProvider = ({ children }) => {
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [alerts, setAlerts] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [hookConfigurations, setHookConfigurations] = useState({});

  // Track current patient to clear alerts on patient change
  const [currentPatientId, setCurrentPatientId] = useState(null);
  
  // Refs for managing state without causing re-renders
  const executingHooks = useRef(new Set());
  const lastExecutionTime = useRef({});
  const alertSubscribers = useRef(new Map());
  
  // Initialization state to prevent multiple loads
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  
  const markInitialized = useCallback(() => {
    setIsInitialized(true);
    setIsInitializing(false);
  }, []);
  
  const markInitializing = useCallback(() => {
    setIsInitializing(true);
  }, []);
  
  // Load hook configurations with display behavior - using stable callback
  const loadHookConfigurations = useStableCallback(async () => {
    if (isInitializing) return; // Prevent duplicate calls
    
    try {
      markInitializing();
      const hookResponse = await cdsHooksService.listCustomServices();
      
      // Handle response format - could be {success: true, data: hooks} or direct array
      const hooks = hookResponse.data || hookResponse;
      
      if (!Array.isArray(hooks)) {
        cdsLogger.error('CDSContext: Hook response is not an array:', hooks);
        return;
      }
      
      const configMap = {};
      
      hooks.forEach(hook => {
        configMap[hook.id] = hook;
      });
      
      setHookConfigurations(configMap);
      cdsLogger.debug(`CDSContext: Loaded ${hooks.length} hook configurations:`, Object.keys(configMap));
      
      // Log each hook's display behavior for debugging
      hooks.forEach(hook => {
        if (hook.displayBehavior) {
          cdsLogger.debug(`Hook ${hook.id} has display behavior:`, hook.displayBehavior);
        } else {
          cdsLogger.debug(`Hook ${hook.id} has no display behavior configured`);
        }
      });
    } catch (error) {
      cdsLogger.error('CDSContext: Failed to load hook configurations:', error);
    } finally {
      markInitialized();
    }
  });

  // Discover CDS services once on mount
  useEffect(() => {
    const loadServices = async () => {
      if (servicesLoaded || isInitializing) {
        cdsLogger.debug('CDSContext: Skipping service discovery', { servicesLoaded, isInitializing });
        return;
      }
      
      try {
        cdsLogger.info('CDSContext: Discovering CDS services');
        const discoveredServices = await cdsHooksClient.discoverServices();
        // [CDS Debug] Discovered services:', discoveredServices);
        setServices(discoveredServices);
        setServicesLoaded(true);
        cdsLogger.info(`CDSContext: Discovered ${discoveredServices.length} CDS services`);
        // [CDS Debug] Set ${discoveredServices.length} services in state`);
        
        // Don't execute hooks here - let the separate effect handle it
      } catch (err) {
        cdsLogger.error('CDSContext: Failed to discover services', err);
        setError(err.message);
      }
    };
    
    const loadHookConfigsWrapper = async () => {
      if (isInitializing) {
        cdsLogger.debug('CDSContext: Skipping hook configuration loading - already initializing');
        return;
      }
      await loadHookConfigurations();
    };
    
    // Run initialization
    if (!isInitialized && !isInitializing) {
      loadServices();
      loadHookConfigsWrapper();
    }
  }, []); // Run once on mount
  
  // When services are loaded and we have a patient, execute patient-view hooks
  useEffect(() => {
    if (servicesLoaded && services.length > 0 && currentPatientId) {
      // [CDS Debug] Services loaded with patient ${currentPatientId}, triggering patient-view hooks`);
      // We'll execute hooks through the executePatientViewHooks function
      // which will be called by usePatientCDSAlerts hook
    }
  }, [servicesLoaded, services.length, currentPatientId]);
  
  // Execute CDS hooks with deduplication - using stable callback
  const executeCDSHooks = useStableCallback(async (hookType, context) => {
    // [CDS Debug] executeCDSHooks called - hookType: ${hookType}, context:`, context);
    // [CDS Debug] executeCDSHooks - servicesLoaded: ${servicesLoaded}, services.length: ${services.length}`);
    
    // Check if we're already executing this hook with the same context
    const executionKey = `${hookType}-${JSON.stringify(context)}`;
    const now = Date.now();
    
    // Prevent duplicate executions within 5 seconds
    if (lastExecutionTime.current[executionKey] && 
        now - lastExecutionTime.current[executionKey] < 5000) {
      cdsLogger.debug(`CDSContext: Skipping duplicate execution of ${hookType}`);
      // [CDS Debug] Skipping duplicate execution of ${hookType} - last execution was ${now - lastExecutionTime.current[executionKey]}ms ago`);
      return;
    }
    
    // Check if hook is currently executing
    if (executingHooks.current.has(executionKey)) {
      cdsLogger.debug(`CDSContext: Hook ${hookType} already executing`);
      return;
    }
    
    // If services haven't been loaded yet, wait for them
    if (!servicesLoaded || services.length === 0) {
      // [CDS Debug] Services not loaded yet - servicesLoaded: ${servicesLoaded}, services.length: ${services.length}`);
      // [CDS Debug] Skipping hook execution until services are loaded');
      return;
    }
    
    executingHooks.current.add(executionKey);
    lastExecutionTime.current[executionKey] = now;
    
    setLoading(prev => ({ ...prev, [hookType]: true }));
    setError(null);
    
    try {
      cdsLogger.info(`CDSContext: Executing ${hookType} hooks`, context);
      // [CDS Debug] Executing ${hookType} hooks with context:`, context);
      // [CDS Debug] Available services:', services);
      
      // Get services for this hook type
      const matchingServices = services.filter(s => s.hook === hookType);
      cdsLogger.debug(`CDSContext: Found ${matchingServices.length} services for ${hookType}`);
      // [CDS Debug] Found ${matchingServices.length} matching services for ${hookType}:`, matchingServices);
      
      const allAlerts = [];
      
      // Execute each matching service
      for (const service of matchingServices) {
        try {
          cdsLogger.debug(`CDSContext: Executing service ${service.id}`);
          // Create hook request with proper format matching backend expectations
          // CDS Hooks 2.0 requires hookInstance to be a valid UUID
          const hookRequest = {
            hook: hookType,  // This is required by the backend
            hookInstance: uuidv4(),  // Generate proper UUID for CDS Hooks 2.0
            context: context  // Just pass the context object directly
          };
          
          const response = await cdsHooksClient.callService(service.id, hookRequest);
          cdsLogger.debug(`CDSContext: Response from ${service.id}`, response);
          
          if (response.cards && response.cards.length > 0) {
            allAlerts.push(...response.cards.map(card => {
              // Enhance alert with display behavior metadata
              let presentationMode = null;
              let acknowledgmentRequired = false;
              let reasonRequired = false;
              let snoozeEnabled = false;
              
              // Check if this alert has a serviceId that matches a hook configuration
              if (service.id && hookConfigurations[service.id]) {
                const hookConfig = hookConfigurations[service.id];
                const displayBehavior = hookConfig.displayBehavior;
                cdsLogger.debug(`CDSContext: Display behavior for ${service.id}`, displayBehavior);
                
                if (displayBehavior) {
                  // Map display behavior to presentation modes
                  const modeMapping = {
                    'hard-stop': PRESENTATION_MODES.MODAL,
                    'modal': PRESENTATION_MODES.MODAL,
                    'popup': PRESENTATION_MODES.POPUP,
                    'sidebar': PRESENTATION_MODES.SIDEBAR,
                    'inline': PRESENTATION_MODES.INLINE,
                    'banner': PRESENTATION_MODES.BANNER,
                    'toast': PRESENTATION_MODES.TOAST
                  };
                  
                  // Check for indicator-based overrides
                  const cardIndicator = card.indicator || 'info';
                  const indicatorOverride = displayBehavior.indicatorOverrides?.[cardIndicator];
                  const configuredMode = indicatorOverride || displayBehavior.defaultMode || 'popup';
                  
                  presentationMode = modeMapping[configuredMode] || PRESENTATION_MODES.POPUP;
                  acknowledgmentRequired = displayBehavior.acknowledgment?.required || false;
                  reasonRequired = displayBehavior.acknowledgment?.reasonRequired || false;
                  snoozeEnabled = displayBehavior.snooze?.enabled || false;
                  
                  cdsLogger.debug(`CDSContext: Using configured display behavior for ${service.id}:`, {
                    configuredMode,
                    presentationMode,
                    acknowledgmentRequired,
                    snoozeEnabled,
                    cardIndicator
                  });
                } else {
                  cdsLogger.debug(`CDSContext: No display behavior found for ${service.id}, using popup default`);
                  presentationMode = PRESENTATION_MODES.POPUP;
                }
              } else {
                cdsLogger.debug(`CDSContext: No hook configuration found for ${service.id}, using popup default`);
                presentationMode = PRESENTATION_MODES.POPUP;
              }

              const enhancedAlert = {
                ...card,
                uuid: card.uuid || uuidv4(),  // Use proper UUID
                serviceId: service.id,
                serviceName: service.title || service.id,
                hookType,
                timestamp: new Date(),
                displayBehavior: {
                  presentationMode,
                  acknowledgmentRequired,
                  reasonRequired,
                  snoozeEnabled
                }
              };
              return enhancedAlert;
            }));
          }
        } catch (serviceError) {
          cdsLogger.warn(`CDSContext: Error calling service ${service.id}:`, serviceError);
        }
      }
      
      cdsLogger.info(`CDSContext: Received ${allAlerts.length} alerts for ${hookType}`);
      // [CDS Debug] All alerts for ${hookType}:`, allAlerts);
      
      // Update alerts state
      setAlerts(prev => {
        const newAlerts = {
          ...prev,
          [hookType]: allAlerts
        };
        // [CDS Debug] Setting alerts state:', newAlerts);
        return newAlerts;
      });
      
      // Notify subscribers
      const subscribers = alertSubscribers.current.get(hookType) || [];
      cdsLogger.debug(`CDSContext: Notifying ${subscribers.length} subscribers for ${hookType}`);
      subscribers.forEach(callback => callback(allAlerts));
      
    } catch (err) {
      cdsLogger.error(`CDSContext: Error executing ${hookType} hooks:`, err);
      setError(err.message);
    } finally {
      executingHooks.current.delete(executionKey);
      setLoading(prev => ({ ...prev, [hookType]: false }));
    }
  }); // Remove dependency array - using useStableCallback
  
  // Execute patient-view hooks when patient changes - using stable callback
  const executePatientViewHooks = useStableCallback(async (patientId) => {
    // [CDS Debug] executePatientViewHooks called with patientId:', patientId);
    // [CDS Debug] Current patientId:', currentPatientId);
    
    if (!patientId || patientId === currentPatientId) {
      cdsLogger.debug('CDSContext: executePatientViewHooks skipped', { patientId, currentPatientId });
      // [CDS Debug] Skipping execution - same patient or no patient');
      return;
    }
    
    cdsLogger.info(`CDSContext: Patient changed to ${patientId}`);
    // [CDS Debug] Patient changed from ${currentPatientId} to ${patientId}`);
    setCurrentPatientId(patientId);
    
    // Clear existing alerts when patient changes
    setAlerts({});

    // Execute patient-view hooks
    await executeCDSHooks(CDS_HOOK_TYPES.PATIENT_VIEW, {
      patientId,
      userId: user?.id || 'unknown'
    });
  });
  
  // Subscribe to alerts for a specific hook type
  const subscribeToAlerts = useCallback((hookType, callback) => {
    if (!alertSubscribers.current.has(hookType)) {
      alertSubscribers.current.set(hookType, []);
    }
    alertSubscribers.current.get(hookType).push(callback);
    
    // Return unsubscribe function
    return () => {
      const subscribers = alertSubscribers.current.get(hookType) || [];
      const index = subscribers.indexOf(callback);
      if (index > -1) {
        subscribers.splice(index, 1);
      }
    };
  }, []);
  
  // Get alerts for a specific hook type
  const getAlerts = useCallback((hookType) => {
    return alerts[hookType] || [];
  }, [alerts]);
  
  // Get all alerts
  const getAllAlerts = useCallback(() => {
    return Object.values(alerts).flat();
  }, [alerts]);
  
  // Clear alerts for a specific hook type
  const clearAlerts = useCallback((hookType) => {
    setAlerts(prev => ({
      ...prev,
      [hookType]: []
    }));
  }, []);
  
  // Context value
  const value = {
    services,
    servicesLoaded,
    alerts,
    loading,
    error,
    currentPatientId,
    
    // Methods
    executeCDSHooks,
    executePatientViewHooks,
    subscribeToAlerts,
    getAlerts,
    getAllAlerts,
    clearAlerts
  };
  
  return (
    <CDSContext.Provider value={value}>
      {children}
    </CDSContext.Provider>
  );
};

// Hook to use CDS context
export const useCDS = () => {
  const context = useContext(CDSContext);
  if (!context) {
    throw new Error('useCDS must be used within a CDSProvider');
  }
  return context;
};

// Hook for patient-view alerts
export const usePatientCDSAlerts = (patientId) => {
  const { executePatientViewHooks, loading, alerts: contextAlerts, servicesLoaded, services } = useCDS();
  const prevPatientIdRef = useRef(null);
  const hasExecutedRef = useRef(false);
  
  // [CDS Debug] usePatientCDSAlerts called with patientId:', patientId);
  // [CDS Debug] Context alerts:', contextAlerts);
  // [CDS Debug] Services loaded:', servicesLoaded, 'Services count:', services?.length);
  
  useEffect(() => {
    // [CDS Debug] usePatientCDSAlerts effect - patientId:', patientId, 'prev:', prevPatientIdRef.current);
    // [CDS Debug] usePatientCDSAlerts effect - servicesLoaded:', servicesLoaded, 'services:', services?.length);
    
    // Reset execution flag if patient changed
    if (patientId && patientId !== prevPatientIdRef.current) {
      hasExecutedRef.current = false;
      prevPatientIdRef.current = patientId;
    }
    
    // Execute if we have a patient, services are loaded, and we haven't executed yet
    const shouldExecute = patientId && servicesLoaded && services?.length > 0 && !hasExecutedRef.current;
    
    if (shouldExecute) {
      cdsLogger.debug(`usePatientCDSAlerts: Executing hooks for patient ${patientId}`);
      // [CDS Debug] Triggering executePatientViewHooks for patient ${patientId}`);
      hasExecutedRef.current = true;
      executePatientViewHooks(patientId);
    }
  }, [patientId, executePatientViewHooks, servicesLoaded, services]);
  
  // Get patient-view alerts directly from context state, only re-compute when they actually change
  const alerts = useMemo(() => {
    const patientAlerts = contextAlerts[CDS_HOOK_TYPES.PATIENT_VIEW] || [];
    return patientAlerts;
  }, [contextAlerts[CDS_HOOK_TYPES.PATIENT_VIEW]]);
  
  return {
    alerts,
    loading: loading[CDS_HOOK_TYPES.PATIENT_VIEW] || false
  };
};