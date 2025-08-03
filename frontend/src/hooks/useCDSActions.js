/**
 * CDS Actions Hook
 * React hook for executing CDS Hook suggested actions
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../services/api';

export const useCDSActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [executionHistory, setExecutionHistory] = useState([]);

  // Execute a single CDS action
  const executeAction = useCallback(async (actionRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/cds-hooks/actions/execute', actionRequest);
      const result = response.data;

      if (result.success) {
        // Add to execution history
        setExecutionHistory(prev => [
          {
            ...result,
            timestamp: new Date().toISOString(),
            request: actionRequest
          },
          ...prev.slice(0, 9) // Keep last 10 executions
        ]);
      }

      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to execute action';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Execute multiple actions in batch
  const executeBatchActions = useCallback(async (actionRequests) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post('/cds-hooks/actions/batch-execute', actionRequests);
      const result = response.data;

      // Add successful executions to history
      const successfulResults = result.results?.filter(r => r.success) || [];
      if (successfulResults.length > 0) {
        setExecutionHistory(prev => [
          ...successfulResults.map((r, index) => ({
            ...r,
            timestamp: new Date().toISOString(),
            request: actionRequests[index]
          })),
          ...prev.slice(0, 10 - successfulResults.length)
        ]);
      }

      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to execute batch actions';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate an action before execution
  const validateAction = useCallback(async (serviceId, cardUuid, suggestionUuid, actionUuid, patientId) => {
    try {
      const response = await apiClient.get('/cds-hooks/actions/validate', {
        params: {
          service_id: serviceId,
          card_uuid: cardUuid,
          suggestion_uuid: suggestionUuid,
          action_uuid: actionUuid,
          patient_id: patientId
        }
      });
      return response.data;
    } catch (err) {
      console.error('Action validation failed:', err);
      return {
        valid: false,
        message: err.response?.data?.detail || 'Validation failed',
        errors: [err.message]
      };
    }
  }, []);

  // Get execution history for a patient
  const getExecutionHistory = useCallback(async (patientId, limit = 50) => {
    try {
      const response = await apiClient.get(`/cds-hooks/actions/history/${patientId}`, {
        params: { limit }
      });
      return response.data;
    } catch (err) {
      console.error('Failed to get execution history:', err);
      return {
        patient_id: patientId,
        total_events: 0,
        events: [],
        error: err.message
      };
    }
  }, []);

  // Get execution statistics
  const getExecutionStats = useCallback(async (days = 30) => {
    try {
      const response = await apiClient.get('/cds-hooks/actions/stats/execution-summary', {
        params: { days }
      });
      return response.data;
    } catch (err) {
      console.error('Failed to get execution stats:', err);
      return {
        period_days: days,
        total_executions: 0,
        successful_executions: 0,
        failed_executions: 0,
        success_rate: 0,
        error: err.message
      };
    }
  }, []);

  // Create action request from CDS card/suggestion
  const createActionRequest = useCallback((
    hookInstance,
    serviceId,
    card,
    suggestion,
    action,
    patientId,
    userId,
    encounterId = null,
    additionalContext = {}
  ) => {
    return {
      hook_instance: hookInstance,
      service_id: serviceId,
      card_uuid: card.uuid,
      suggestion_uuid: suggestion.uuid,
      action_uuid: action.uuid || `action-${Date.now()}`,
      patient_id: patientId,
      user_id: userId,
      encounter_id: encounterId,
      context: {
        action_data: {
          type: action.type,
          description: action.description,
          resource: action.resource,
          ...additionalContext
        }
      }
    };
  }, []);

  // Helper to determine if an action is executable
  const isActionExecutable = useCallback((action) => {
    const executableTypes = ['create', 'update', 'delete', 'order', 'prescribe', 'schedule'];
    return executableTypes.includes(action.type) && action.resource;
  }, []);

  // Clear execution history
  const clearHistory = useCallback(() => {
    setExecutionHistory([]);
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    loading,
    error,
    executionHistory,

    // Actions
    executeAction,
    executeBatchActions,
    validateAction,
    getExecutionHistory,
    getExecutionStats,
    createActionRequest,
    isActionExecutable,
    clearHistory,
    clearError
  };
};