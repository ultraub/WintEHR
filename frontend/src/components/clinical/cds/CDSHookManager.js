/**
 * CDS Hook Manager
 * Manages CDS hooks firing at different workflow points with appropriate presentation modes
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import CDSPresentation, { PRESENTATION_MODES } from './CDSPresentation';
import { cdsLogger } from '../../../config/logging';

// Hook types and their recommended presentation modes according to CDS Hooks best practices
const HOOK_PRESENTATION_CONFIG = {
  'patient-view': {
    mode: PRESENTATION_MODES.INLINE,
    position: 'top',
    autoHide: false,
    maxAlerts: 5,
    priority: 'medium'
  },
  'medication-prescribe': {
    mode: PRESENTATION_MODES.POPUP,
    position: 'center',
    autoHide: false,
    maxAlerts: 10,
    priority: 'high'
  },
  'order-sign': {
    mode: PRESENTATION_MODES.BANNER,
    position: 'top',
    autoHide: false,
    maxAlerts: 3,
    priority: 'critical'
  },
  'order-select': {
    mode: PRESENTATION_MODES.SIDEBAR,
    position: 'right',
    autoHide: false,
    maxAlerts: 5,
    priority: 'medium'
  },
  'encounter-start': {
    mode: PRESENTATION_MODES.DRAWER,
    position: 'right',
    autoHide: false,
    maxAlerts: 7,
    priority: 'medium'
  },
  'encounter-discharge': {
    mode: PRESENTATION_MODES.POPUP,
    position: 'center',
    autoHide: false,
    maxAlerts: 5,
    priority: 'high'
  }
};

// Workflow trigger points where hooks should fire
const WORKFLOW_TRIGGERS = {
  PATIENT_OPENED: 'patient-view',
  MEDICATION_PRESCRIBING: 'medication-prescribe', 
  ORDER_SIGNING: 'order-sign',
  ORDER_SELECTING: 'order-select',
  ENCOUNTER_STARTING: 'encounter-start',
  ENCOUNTER_DISCHARGE: 'encounter-discharge',
  LAB_REVIEW: 'patient-view', // Can reuse patient-view for lab review
  VITAL_ENTRY: 'patient-view'  // Can reuse patient-view for vital entry
};

const CDSHookManager = ({ 
  patientId,
  userId = 'current-user',
  encounterId = null,
  currentHook = 'patient-view',
  context = {},
  onHookFired = null,
  onAlertAction = null,
  disabled = false,
  debugMode = false
}) => {
  const [activeAlerts, setActiveAlerts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastContextRef = useRef(null);
  const hookTimeoutRef = useRef(null);

  // Debounced hook firing to prevent excessive calls
  const fireHooksDebounced = useCallback(async (hookType, hookContext, delay = 500) => {
    if (hookTimeoutRef.current) {
      clearTimeout(hookTimeoutRef.current);
    }

    hookTimeoutRef.current = setTimeout(async () => {
      await fireHooks(hookType, hookContext);
    }, delay);
  }, []);

  const fireHooks = useCallback(async (hookType, hookContext = {}) => {
    if (disabled || !patientId) {
      cdsLogger.debug('CDS hooks disabled or no patient ID');
      return;
    }

    const contextKey = JSON.stringify({ hookType, patientId, hookContext });
    if (lastContextRef.current === contextKey) {
      cdsLogger.debug('Same context, skipping hook fire');
      return;
    }
    lastContextRef.current = contextKey;

    setLoading(true);
    setError(null);

    try {
      cdsLogger.info(`Firing CDS hooks for: ${hookType}`, {
        patientId,
        userId,
        encounterId,
        context: hookContext
      });

      let alerts = [];
      
      switch (hookType) {
        case 'patient-view':
          alerts = await cdsHooksClient.firePatientView(patientId, userId, encounterId);
          break;
          
        case 'medication-prescribe':
          alerts = await cdsHooksClient.fireMedicationPrescribe(
            patientId, 
            userId, 
            hookContext.medications || []
          );
          break;
          
        case 'order-sign':
          alerts = await cdsHooksClient.fireOrderSign(
            patientId,
            userId,
            hookContext.orders || []
          );
          break;
          
        default:
          // For other hook types, use generic execution
          const services = await cdsHooksClient.discoverServices();
          const matchingServices = services.filter(s => s.hook === hookType);
          
          cdsLogger.debug(`Found ${matchingServices.length} services for ${hookType}`);
          
          const allCards = [];
          for (const service of matchingServices) {
            const hookRequest = {
              hook: hookType,
              hookInstance: `${service.id}-${Date.now()}`,
              context: {
                patientId,
                userId,
                encounterId,
                ...hookContext
              }
            };
            
            const result = await cdsHooksClient.executeHook(service.id, hookRequest);
            if (result.cards && result.cards.length > 0) {
              allCards.push(...result.cards.map(card => ({
                ...card,
                serviceId: service.id,
                serviceTitle: service.title
              })));
            }
          }
          alerts = allCards;
          break;
      }

      cdsLogger.info(`Received ${alerts.length} CDS alerts for ${hookType}`);
      cdsLogger.debug('CDS alerts details:', alerts);

      // Group alerts by presentation mode
      const alertsByMode = {};
      alerts.forEach(alert => {
        const config = HOOK_PRESENTATION_CONFIG[hookType] || HOOK_PRESENTATION_CONFIG['patient-view'];
        const mode = config.mode;
        
        if (!alertsByMode[mode]) {
          alertsByMode[mode] = [];
        }
        alertsByMode[mode].push(alert);
      });

      setActiveAlerts(prev => ({
        ...prev,
        [hookType]: alertsByMode
      }));

      if (onHookFired) {
        onHookFired(hookType, alerts);
      }

    } catch (err) {
      cdsLogger.error(`Error firing CDS hooks for ${hookType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [patientId, userId, encounterId, disabled, onHookFired, debugMode]);

  // Fire hooks when dependencies change
  useEffect(() => {
    if (currentHook && patientId) {
      fireHooksDebounced(currentHook, context);
    }
  }, [currentHook, patientId, userId, encounterId, context, fireHooksDebounced]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hookTimeoutRef.current) {
        clearTimeout(hookTimeoutRef.current);
      }
    };
  }, []);

  // API for external components to trigger specific hooks
  const triggerHook = useCallback(async (trigger, contextData = {}) => {
    const hookType = WORKFLOW_TRIGGERS[trigger];
    if (hookType) {
      await fireHooks(hookType, contextData);
    } else {
      
    }
  }, [fireHooks]);

  // Clear alerts for a specific hook
  const clearAlerts = useCallback((hookType) => {
    setActiveAlerts(prev => {
      const newAlerts = { ...prev };
      delete newAlerts[hookType];
      return newAlerts;
    });
  }, []);

  // Handle alert actions with feedback to CDS services
  const handleAlertAction = useCallback(async (alert, action, suggestion = null) => {
    cdsLogger.info('CDS Alert Action:', { alertId: alert.uuid, action, suggestionId: suggestion?.uuid });

    // Send feedback to CDS service if supported
    if (alert.serviceId && alert.serviceId !== 'unknown-service') {
      try {
        const feedback = {
          feedback: [{
            card: alert.uuid,
            outcome: action === 'accept' ? 'accepted' : action === 'reject' ? 'overridden' : 'ignored',
            ...(action === 'accept' && suggestion ? {
              acceptedSuggestions: [{ id: suggestion.uuid }]
            } : {}),
            ...(action === 'reject' ? {
              overrideReasons: [{ reason: { code: 'user-preference', display: 'User preference' } }]
            } : {})
          }]
        };

        await cdsHooksClient.httpClient.post(`/cds-services/${alert.serviceId}/feedback`, feedback);
        
        cdsLogger.debug('Feedback sent to CDS service:', feedback);
      } catch (err) {
        cdsLogger.warn('Failed to send CDS feedback:', err);
      }
    }

    if (onAlertAction) {
      onAlertAction(alert, action, suggestion);
    }
  }, [onAlertAction, debugMode]);

  // Render alerts for current hook
  const renderAlertsForHook = (hookType) => {
    const hookAlerts = activeAlerts[hookType];
    if (!hookAlerts) return null;

    const config = HOOK_PRESENTATION_CONFIG[hookType] || HOOK_PRESENTATION_CONFIG['patient-view'];

    return Object.entries(hookAlerts).map(([mode, alerts]) => (
      <CDSPresentation
        key={`${hookType}-${mode}`}
        alerts={alerts}
        mode={mode}
        position={config.position}
        autoHide={config.autoHide}
        maxAlerts={config.maxAlerts}
        onAlertAction={handleAlertAction}
        allowInteraction={true}
        patientId={patientId}
      />
    ));
  };

  // Public API for external components
  const api = {
    triggerHook,
    clearAlerts,
    fireHooks,
    getActiveAlerts: () => activeAlerts,
    isLoading: loading,
    error: error,
    WORKFLOW_TRIGGERS,
    PRESENTATION_MODES
  };

  // Attach API to window for debugging
  if (debugMode && typeof window !== 'undefined') {
    window.cdsHookManager = api;
  }

  return (
    <>
      {/* Render alerts for current hook */}
      {renderAlertsForHook(currentHook)}
      
      {/* Render alerts for other active hooks */}
      {Object.keys(activeAlerts)
        .filter(hookType => hookType !== currentHook)
        .map(hookType => renderAlertsForHook(hookType))
      }
      
      {/* Error display */}
      {error && debugMode && (
        <div style={{ 
          position: 'fixed', 
          bottom: 10, 
          right: 10, 
          background: 'red', 
          color: 'white', 
          padding: '10px',
          borderRadius: '4px',
          zIndex: 9999
        }}>
          CDS Error: {error}
        </div>
      )}
    </>
  );
};

export default CDSHookManager;
export { WORKFLOW_TRIGGERS, HOOK_PRESENTATION_CONFIG };