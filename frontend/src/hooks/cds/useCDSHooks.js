/**
 * CDS Hooks React Hook
 * Manages CDS Hooks 2.0 interactions and state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { cdsHooksClient } from '../../services/cdsHooksClient';
import { v4 as uuidv4 } from 'uuid';

export const useCDSHooks = () => {
  const [cards, setCards] = useState([]);
  const [systemActions, setSystemActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [services, setServices] = useState([]);
  
  // Track hook instances for feedback
  const hookInstancesRef = useRef(new Map());

  // Discover available services
  const discoverServices = useCallback(async () => {
    try {
      const discoveredServices = await cdsHooksClient.discoverServices();
      setServices(discoveredServices);
      return discoveredServices;
    } catch (err) {
      console.error('Failed to discover CDS services:', err);
      setError(err);
      return [];
    }
  }, []);

  // Execute a specific hook
  const executeHook = useCallback(async (hookType, context, prefetch = null) => {
    setLoading(true);
    setError(null);
    
    try {
      // Generate hook instance ID
      const hookInstance = uuidv4();
      
      // Discover services if not already done
      let availableServices = services;
      if (services.length === 0) {
        availableServices = await discoverServices();
      }
      
      // Filter services for this hook type
      const relevantServices = availableServices.filter(s => s.hook === hookType);
      
      if (relevantServices.length === 0) {
        console.log(`No services registered for hook: ${hookType}`);
        setCards([]);
        setSystemActions([]);
        return;
      }
      
      // Execute all relevant services
      const allCards = [];
      const allSystemActions = [];
      
      for (const service of relevantServices) {
        try {
          const request = {
            hook: hookType,
            hookInstance,
            context,
            fhirServer: window.location.origin + '/fhir/R4',
            prefetch: prefetch || {}
          };
          
          const response = await cdsHooksClient.executeHook(service.id, request);
          
          if (response.cards) {
            // Add service metadata to each card
            response.cards.forEach(card => {
              card.serviceId = service.id;
              card.hookInstance = hookInstance;
              if (!card.uuid) {
                card.uuid = uuidv4();
              }
            });
            allCards.push(...response.cards);
          }
          
          if (response.systemActions) {
            allSystemActions.push(...response.systemActions);
          }
          
          // Track hook instance for feedback
          hookInstancesRef.current.set(hookInstance, {
            serviceId: service.id,
            timestamp: new Date()
          });
        } catch (err) {
          console.error(`Failed to execute service ${service.id}:`, err);
          // Continue with other services
        }
      }
      
      // Update state with all results
      setCards(allCards);
      setSystemActions(allSystemActions);
      
    } catch (err) {
      console.error('Failed to execute CDS hook:', err);
      setError(err);
      setCards([]);
      setSystemActions([]);
    } finally {
      setLoading(false);
    }
  }, [services, discoverServices]);

  // Execute multiple hooks
  const executeHooks = useCallback(async (hookRequests) => {
    const results = [];
    
    for (const request of hookRequests) {
      await executeHook(request.hook, request.context, request.prefetch);
      results.push({
        hook: request.hook,
        cards: [...cards],
        systemActions: [...systemActions]
      });
    }
    
    return results;
  }, [executeHook, cards, systemActions]);

  // Send feedback for a card
  const sendCardFeedback = useCallback(async (card, outcome, overrideReason = null, acceptedSuggestions = null) => {
    try {
      const feedbackItem = {
        card: card.uuid,
        outcome,
        outcomeTimestamp: new Date().toISOString()
      };
      
      if (outcome === 'accepted' && acceptedSuggestions) {
        feedbackItem.acceptedSuggestions = acceptedSuggestions.map(s => ({
          id: s.uuid || s.id
        }));
      }
      
      if (outcome === 'overridden' && overrideReason) {
        feedbackItem.overrideReason = overrideReason;
      }
      
      await cdsHooksClient.sendFeedback(card.serviceId, {
        feedback: [feedbackItem]
      });
      
      return true;
    } catch (err) {
      console.error('Failed to send feedback:', err);
      return false;
    }
  }, []);

  // Apply system actions
  const applySystemActions = useCallback(async (actions, context) => {
    try {
      const response = await cdsHooksClient.applySystemActions(actions, context);
      return response;
    } catch (err) {
      console.error('Failed to apply system actions:', err);
      throw err;
    }
  }, []);

  // Clean up old hook instances
  useEffect(() => {
    const cleanup = () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      for (const [hookInstance, data] of hookInstancesRef.current.entries()) {
        if (data.timestamp < oneHourAgo) {
          hookInstancesRef.current.delete(hookInstance);
        }
      }
    };
    
    const interval = setInterval(cleanup, 5 * 60 * 1000); // Clean up every 5 minutes
    
    return () => clearInterval(interval);
  }, []);

  return {
    // State
    cards,
    systemActions,
    loading,
    error,
    services,
    
    // Actions
    discoverServices,
    executeHook,
    executeHooks,
    sendCardFeedback,
    applySystemActions,
    
    // Utilities
    clearCards: () => setCards([]),
    clearSystemActions: () => setSystemActions([]),
    clearError: () => setError(null)
  };
};

// Hook for specific hook types
export const usePatientViewHook = (patientId, userId) => {
  const cdsHooks = useCDSHooks();
  
  useEffect(() => {
    if (patientId && userId) {
      cdsHooks.executeHook('patient-view', {
        patientId,
        userId
      });
    }
  }, [patientId, userId]);
  
  return cdsHooks;
};

export const useOrderSelectHook = (patientId, userId, selections) => {
  const cdsHooks = useCDSHooks();
  
  useEffect(() => {
    if (patientId && userId && selections?.length > 0) {
      cdsHooks.executeHook('order-select', {
        patientId,
        userId,
        selections
      });
    }
  }, [patientId, userId, selections]);
  
  return cdsHooks;
};

export const useMedicationPrescribeHook = (patientId, userId, medications) => {
  const cdsHooks = useCDSHooks();
  
  useEffect(() => {
    if (patientId && userId && medications?.length > 0) {
      cdsHooks.executeHook('medication-prescribe', {
        patientId,
        userId,
        medications
      });
    }
  }, [patientId, userId, medications]);
  
  return cdsHooks;
};