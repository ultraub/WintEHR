/**
 * CDS Hook Manager V2
 * Simplified, stable implementation without circular dependencies
 * Based on the working pattern from PrescribeMedicationDialog
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Alert, CircularProgress, Typography, Button, Stack } from '@mui/material';
import { cdsHooksClient } from '../../../services/cdsHooksClient';
import { cdsLogger } from '../../../config/logging';

// Hook types and their workflow triggers
export const WORKFLOW_TRIGGERS = {
  PATIENT_OPENED: 'patient-view',
  MEDICATION_PRESCRIBING: 'medication-prescribe', 
  ORDER_SIGNING: 'order-sign',
  ORDER_SELECTING: 'order-select',
  ENCOUNTER_STARTING: 'encounter-start',
  ENCOUNTER_DISCHARGE: 'encounter-discharge',
  LAB_REVIEW: 'patient-view',
  VITAL_ENTRY: 'patient-view'
};

// Alert severity mapping
const getSeverity = (indicator) => {
  switch (indicator) {
    case 'critical':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
};

const CDSHookManagerV2 = ({ 
  patientId,
  userId = 'current-user',
  encounterId = null,
  hookType = 'patient-view',
  context = {},
  onAlertsChange = null,
  trigger = 0, // Simple trigger prop - increment to trigger CDS
  disabled = false,
  debugMode = false
}) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Stable context object using useMemo to prevent infinite re-renders
  const stableContext = useMemo(() => ({
    patientId,
    userId,
    encounterId,
    hookType,
    ...context
  }), [patientId, userId, encounterId, hookType, context]);

  // Simple CDS execution function based on PrescribeMedicationDialog pattern
  const executeCDSHooks = useCallback(async () => {
    if (disabled || !patientId) {
      cdsLogger.debug('CDS hooks disabled or no patient ID');
      setAlerts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      cdsLogger.info(`Executing CDS hooks for: ${hookType}`, stableContext);

      // Get available services for this hook type
      const services = await cdsHooksClient.discoverServices();
      const matchingServices = services.filter(s => s.hook === hookType);
      
      cdsLogger.debug(`Found ${matchingServices.length} services for ${hookType}`);

      const allAlerts = [];
      
      for (const service of matchingServices) {
        try {
          const hookRequest = {
            hook: hookType,
            hookInstance: `${service.id}-${Date.now()}`,
            context: stableContext
          };

          const response = await cdsHooksClient.callService(service.id, hookRequest);
          
          if (response.cards && response.cards.length > 0) {
            allAlerts.push(...response.cards.map(card => ({
              ...card,
              serviceId: service.id,
              serviceName: service.title || service.id,
              timestamp: new Date()
            })));
          }
        } catch (serviceError) {
          cdsLogger.warn(`Error calling CDS service ${service.id}:`, serviceError);
          // Continue with other services
        }
      }

      cdsLogger.info(`Received ${allAlerts.length} CDS alerts for ${hookType}`);
      
      setAlerts(allAlerts);
      
      // Notify parent component
      if (onAlertsChange) {
        onAlertsChange(hookType, allAlerts);
      }

    } catch (err) {
      cdsLogger.error(`Error executing CDS hooks for ${hookType}:`, err);
      setError(err.message);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [disabled, patientId, hookType, stableContext, onAlertsChange]);

  // Execute CDS hooks when trigger changes
  useEffect(() => {
    if (trigger > 0) {
      executeCDSHooks();
    }
  }, [trigger, executeCDSHooks]);

  // Handle alert actions (accept, reject, etc.)
  const handleAlertAction = useCallback((alert, action, suggestion = null) => {
    cdsLogger.info('CDS Alert Action:', { 
      alertId: alert.uuid, 
      action, 
      suggestionId: suggestion?.uuid 
    });

    // Remove the alert from display
    setAlerts(prev => prev.filter(a => a.uuid !== alert.uuid));

    // Send feedback to CDS service if supported
    if (alert.serviceId && alert.serviceId !== 'unknown-service') {
      const sendFeedback = async () => {
        try {
          const feedback = {
            feedback: [{
              card: alert.uuid,
              outcome: action === 'accept' ? 'accepted' : 
                      action === 'reject' ? 'overridden' : 'ignored',
              ...(action === 'accept' && suggestion ? {
                acceptedSuggestions: [{ id: suggestion.uuid }]
              } : {}),
              ...(action === 'reject' ? {
                overrideReasons: [{ 
                  reason: { 
                    code: 'user-preference', 
                    display: 'User preference' 
                  } 
                }]
              } : {})
            }]
          };

          await cdsHooksClient.httpClient.post(
            `/cds-services/${alert.serviceId}/feedback`, 
            feedback
          );
          
          cdsLogger.debug('Feedback sent to CDS service:', feedback);
        } catch (err) {
          cdsLogger.warn('Failed to send CDS feedback:', err);
        }
      };

      sendFeedback();
    }
  }, []);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
    setError(null);
  }, []);

  // Public API for external access (simpler than imperative handle)
  const api = useMemo(() => ({
    clearAlerts,
    getAlerts: () => alerts,
    isLoading: loading,
    error: error,
    executeHooks: executeCDSHooks
  }), [clearAlerts, alerts, loading, error, executeCDSHooks]);

  // Attach API to window for debugging
  useEffect(() => {
    if (debugMode && typeof window !== 'undefined') {
      window.cdsHookManagerV2 = api;
    }
  }, [debugMode, api]);

  // Render alerts
  const renderAlerts = () => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Checking clinical decision support...
          </Typography>
        </Box>
      );
    }

    if (error && debugMode) {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          CDS Error: {error}
        </Alert>
      );
    }

    if (alerts.length === 0) {
      return null;
    }

    return (
      <Stack spacing={1} sx={{ mb: 2 }}>
        {alerts.map((alert, index) => (
          <Alert 
            key={alert.uuid || index}
            severity={getSeverity(alert.indicator)}
            action={
              alert.suggestions && alert.suggestions.length > 0 && (
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => handleAlertAction(alert, 'view-suggestions')}
                >
                  View Actions
                </Button>
              )
            }
            onClose={() => handleAlertAction(alert, 'dismiss')}
          >
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {alert.summary}
              </Typography>
              {alert.detail && (
                <Typography variant="body2">
                  {alert.detail}
                </Typography>
              )}
              {alert.serviceName && debugMode && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Source: {alert.serviceName}
                </Typography>
              )}
            </Box>
          </Alert>
        ))}
      </Stack>
    );
  };

  return (
    <Box>
      {renderAlerts()}
    </Box>
  );
};

export default CDSHookManagerV2;