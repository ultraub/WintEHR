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
import { useStableCallback } from '../hooks/useStableReferences';

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
      console.log('🔧 CDSContext: Loading hook configurations with display behavior support');
      const hookResponse = await cdsHooksService.listCustomHooks();
      console.log('🔍 CDSContext: Raw hook response:', hookResponse);
      
      // Handle response format - could be {success: true, data: hooks} or direct array
      const hooks = hookResponse.data || hookResponse;
      console.log('🔍 CDSContext: Extracted hooks array:', hooks);
      
      if (!Array.isArray(hooks)) {
        console.error('❌ CDSContext: Hook response is not an array:', hooks);
        return;
      }
      
      const configMap = {};
      
      hooks.forEach(hook => {
        configMap[hook.id] = hook;
      });
      
      setHookConfigurations(configMap);
      console.log(`✅ CDSContext: Loaded ${hooks.length} hook configurations:`, Object.keys(configMap));
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
        console.log('🔍 CDSContext: Skipping service discovery:', { servicesLoaded, isInitializing });
        return;
      }
      
      try {
        console.log('🔍 CDSContext: Starting service discovery...');
        cdsLogger.info('CDSContext: Discovering CDS services');
        const discoveredServices = await cdsHooksClient.discoverServices();
        console.log('📡 CDSContext: Service discovery result:', discoveredServices);
        setServices(discoveredServices);
        setServicesLoaded(true);
        console.log(`✅ CDSContext: Successfully discovered ${discoveredServices.length} CDS services`);
        cdsLogger.info(`CDSContext: Discovered ${discoveredServices.length} CDS services`);
      } catch (err) {
        console.error('❌ CDSContext: Service discovery failed:', err);
        cdsLogger.error('CDSContext: Failed to discover services', err);
        setError(err.message);
      }
    };
    
    const loadHookConfigsWrapper = async () => {
      if (isInitializing) {
        console.log('🔍 CDSContext: Skipping hook configuration loading - already initializing');
        return;
      }
      await loadHookConfigurations();
    };
    
    // Run initialization
    console.log('🎛️ CDSContext: useEffect check:', { isInitialized, isInitializing, servicesLoaded });
    if (!isInitialized && !isInitializing) {
      console.log('🚀 CDSContext: Starting initialization...');
      loadServices();
      loadHookConfigsWrapper();
    }
  }, []); // Run once on mount
  
  // Execute CDS hooks with deduplication - using stable callback
  const executeCDSHooks = useStableCallback(async (hookType, context) => {
    // Check if we're already executing this hook with the same context
    const executionKey = `${hookType}-${JSON.stringify(context)}`;
    const now = Date.now();
    
    // Prevent duplicate executions within 5 seconds
    if (lastExecutionTime.current[executionKey] && 
        now - lastExecutionTime.current[executionKey] < 5000) {
      cdsLogger.debug(`CDSContext: Skipping duplicate execution of ${hookType}`);
      return;
    }
    
    // Check if hook is currently executing
    if (executingHooks.current.has(executionKey)) {
      cdsLogger.debug(`CDSContext: Hook ${hookType} already executing`);
      return;
    }
    
    executingHooks.current.add(executionKey);
    lastExecutionTime.current[executionKey] = now;
    
    setLoading(prev => ({ ...prev, [hookType]: true }));
    setError(null);
    
    try {
      console.log(`🎯 CDSContext: Executing ${hookType} hooks`, context);
      cdsLogger.info(`CDSContext: Executing ${hookType} hooks`, context);
      
      // Get services for this hook type
      const matchingServices = services.filter(s => s.hook === hookType);
      console.log(`🔍 CDSContext: Available services (${services.length}):`, services.map(s => ({id: s.id, hook: s.hook})));
      console.log(`✅ CDSContext: Found ${matchingServices.length} matching services for ${hookType}:`, matchingServices.map(s => s.id));
      cdsLogger.debug(`CDSContext: Found ${matchingServices.length} services for ${hookType}`);
      
      const allAlerts = [];
      
      // Execute each matching service
      for (const service of matchingServices) {
        try {
          console.log(`🔧 CDSContext: Executing service ${service.id}...`);
          const hookRequest = {
            hook: hookType,
            hookInstance: `${service.id}-${Date.now()}`,
            context
          };
          console.log(`📋 CDSContext: Hook request for ${service.id}:`, hookRequest);
          
          const response = await cdsHooksClient.callService(service.id, hookRequest);
          console.log(`📨 CDSContext: Response from ${service.id}:`, response);
          
          if (response.cards && response.cards.length > 0) {
            console.log(`🎯 CDSContext: Processing ${response.cards.length} cards from ${service.id}`);
            allAlerts.push(...response.cards.map(card => {
              console.log(`🎴 CDSContext: Processing card:`, card);
              // Enhance alert with display behavior metadata
              let presentationMode = null;
              let acknowledgmentRequired = false;
              let snoozeEnabled = false;
              
              // Check if this alert has a serviceId that matches a hook configuration
              if (service.id && hookConfigurations[service.id]) {
                console.log(`🔧 CDSContext: Found hook configuration for ${service.id}`);
                const hookConfig = hookConfigurations[service.id];
                const displayBehavior = hookConfig.displayBehavior;
                console.log(`🎨 CDSContext: Display behavior for ${service.id}:`, displayBehavior);
                
                if (displayBehavior) {
                  // Map display behavior to presentation modes
                  const modeMapping = {
                    'hard-stop': PRESENTATION_MODES.MODAL,
                    'popup': PRESENTATION_MODES.POPUP,
                    'sidebar': PRESENTATION_MODES.SIDEBAR,
                    'inline': PRESENTATION_MODES.INLINE
                  };
                  
                  // Check for indicator-based overrides
                  const cardIndicator = card.indicator || 'info';
                  const indicatorOverride = displayBehavior.indicatorOverrides?.[cardIndicator];
                  const configuredMode = indicatorOverride || displayBehavior.defaultMode || 'popup';
                  
                  presentationMode = modeMapping[configuredMode] || PRESENTATION_MODES.POPUP;
                  acknowledgmentRequired = displayBehavior.acknowledgment?.required || false;
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
                uuid: card.uuid || `${service.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                serviceId: service.id,
                serviceName: service.title || service.id,
                hookType,
                timestamp: new Date(),
                displayBehavior: {
                  presentationMode,
                  acknowledgmentRequired,
                  snoozeEnabled
                }
              };
              console.log(`🎉 CDSContext: Enhanced alert:`, enhancedAlert);
              return enhancedAlert;
            }));
          }
        } catch (serviceError) {
          console.error(`❌ CDSContext: Error calling service ${service.id}:`, serviceError);
          cdsLogger.warn(`CDSContext: Error calling service ${service.id}:`, serviceError);
        }
      }
      
      console.log(`📊 CDSContext: Generated ${allAlerts.length} total alerts for ${hookType}:`, allAlerts);
      cdsLogger.info(`CDSContext: Received ${allAlerts.length} alerts for ${hookType}`);
      
      // Update alerts state
      setAlerts(prev => ({
        ...prev,
        [hookType]: allAlerts
      }));
      console.log(`💾 CDSContext: Updated alerts state for ${hookType}`);
      
      // Notify subscribers
      const subscribers = alertSubscribers.current.get(hookType) || [];
      console.log(`📢 CDSContext: Notifying ${subscribers.length} subscribers for ${hookType}`);
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
    if (!patientId || patientId === currentPatientId) {
      console.log('🔍 CDSContext: executePatientViewHooks skipped:', { patientId, currentPatientId });
      return;
    }
    
    console.log(`🏥 CDSContext: Patient changed to ${patientId}`);
    cdsLogger.info(`CDSContext: Patient changed to ${patientId}`);
    setCurrentPatientId(patientId);
    
    // Clear existing alerts when patient changes
    setAlerts({});
    console.log('🧹 CDSContext: Cleared existing alerts for new patient');
    
    // Execute patient-view hooks
    console.log('🚀 CDSContext: Executing patient-view hooks for patient:', patientId);
    await executeCDSHooks(CDS_HOOK_TYPES.PATIENT_VIEW, {
      patientId,
      userId: 'current-user' // TODO: Get from auth context
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
  const { executePatientViewHooks, loading, alerts: contextAlerts } = useCDS();
  const prevPatientIdRef = useRef(null);
  
  useEffect(() => {
    if (patientId && patientId !== prevPatientIdRef.current) {
      console.log(`🎣 usePatientCDSAlerts: Executing hooks for patient ${patientId}`);
      prevPatientIdRef.current = patientId;
      executePatientViewHooks(patientId);
    }
  }, [patientId, executePatientViewHooks]);
  
  // Get patient-view alerts directly from context state, only re-compute when they actually change
  const alerts = useMemo(() => {
    const patientAlerts = contextAlerts[CDS_HOOK_TYPES.PATIENT_VIEW] || [];
    console.log(`🔔 usePatientCDSAlerts: Computed ${patientAlerts.length} alerts for patient-view`);
    return patientAlerts;
  }, [contextAlerts[CDS_HOOK_TYPES.PATIENT_VIEW]]);
  
  return {
    alerts,
    loading: loading[CDS_HOOK_TYPES.PATIENT_VIEW] || false
  };
};