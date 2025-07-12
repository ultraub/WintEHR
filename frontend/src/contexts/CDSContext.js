/**
 * CDS Context Provider
 * Centralized management for Clinical Decision Support hooks and alerts
 * Prevents duplicate hook firing and provides a single source of truth
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { cdsHooksClient } from '../services/cdsHooksClient';
import { cdsLogger } from '../config/logging';

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
  
  // Track current patient to clear alerts on patient change
  const [currentPatientId, setCurrentPatientId] = useState(null);
  
  // Refs for managing state without causing re-renders
  const executingHooks = useRef(new Set());
  const lastExecutionTime = useRef({});
  const alertSubscribers = useRef(new Map());
  
  // Discover CDS services once on mount
  useEffect(() => {
    const loadServices = async () => {
      if (servicesLoaded) return;
      
      try {
        cdsLogger.info('CDSContext: Discovering CDS services');
        const discoveredServices = await cdsHooksClient.discoverServices();
        setServices(discoveredServices);
        setServicesLoaded(true);
        cdsLogger.info(`CDSContext: Discovered ${discoveredServices.length} CDS services`);
      } catch (err) {
        cdsLogger.error('CDSContext: Failed to discover services', err);
        setError(err.message);
      }
    };
    
    loadServices();
  }, [servicesLoaded]);
  
  // Execute CDS hooks with deduplication
  const executeCDSHooks = useCallback(async (hookType, context) => {
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
      cdsLogger.info(`CDSContext: Executing ${hookType} hooks`, context);
      
      // Get services for this hook type
      const matchingServices = services.filter(s => s.hook === hookType);
      cdsLogger.debug(`CDSContext: Found ${matchingServices.length} services for ${hookType}`);
      
      const allAlerts = [];
      
      // Execute each matching service
      for (const service of matchingServices) {
        try {
          const hookRequest = {
            hook: hookType,
            hookInstance: `${service.id}-${Date.now()}`,
            context
          };
          
          const response = await cdsHooksClient.callService(service.id, hookRequest);
          
          if (response.cards && response.cards.length > 0) {
            allAlerts.push(...response.cards.map(card => ({
              ...card,
              serviceId: service.id,
              serviceName: service.title || service.id,
              hookType,
              timestamp: new Date()
            })));
          }
        } catch (serviceError) {
          cdsLogger.warn(`CDSContext: Error calling service ${service.id}:`, serviceError);
        }
      }
      
      cdsLogger.info(`CDSContext: Received ${allAlerts.length} alerts for ${hookType}`);
      
      // Update alerts state
      setAlerts(prev => ({
        ...prev,
        [hookType]: allAlerts
      }));
      
      // Notify subscribers
      const subscribers = alertSubscribers.current.get(hookType) || [];
      subscribers.forEach(callback => callback(allAlerts));
      
    } catch (err) {
      cdsLogger.error(`CDSContext: Error executing ${hookType} hooks:`, err);
      setError(err.message);
    } finally {
      executingHooks.current.delete(executionKey);
      setLoading(prev => ({ ...prev, [hookType]: false }));
    }
  }, [services]);
  
  // Execute patient-view hooks when patient changes
  const executePatientViewHooks = useCallback(async (patientId) => {
    if (!patientId || patientId === currentPatientId) return;
    
    cdsLogger.info(`CDSContext: Patient changed to ${patientId}`);
    setCurrentPatientId(patientId);
    
    // Clear existing alerts when patient changes
    setAlerts({});
    
    // Execute patient-view hooks
    await executeCDSHooks(CDS_HOOK_TYPES.PATIENT_VIEW, {
      patientId,
      userId: 'current-user' // TODO: Get from auth context
    });
  }, [currentPatientId, executeCDSHooks]);
  
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
  const { executePatientViewHooks, getAlerts, loading } = useCDS();
  const [alerts, setAlerts] = useState([]);
  
  useEffect(() => {
    if (patientId) {
      executePatientViewHooks(patientId);
    }
  }, [patientId, executePatientViewHooks]);
  
  useEffect(() => {
    const patientAlerts = getAlerts(CDS_HOOK_TYPES.PATIENT_VIEW);
    setAlerts(patientAlerts);
  }, [getAlerts]);
  
  return {
    alerts,
    loading: loading[CDS_HOOK_TYPES.PATIENT_VIEW] || false
  };
};