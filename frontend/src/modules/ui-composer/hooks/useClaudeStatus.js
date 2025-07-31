/**
 * useClaudeStatus Hook
 * Monitor Claude availability for UI Composer
 */

import { useState, useEffect, useCallback } from 'react';
import { uiComposerService } from '../../../services/uiComposerService';

export const useClaudeStatus = () => {
  const [status, setStatus] = useState({
    available: false,
    checking: true,
    lastChecked: null,
    error: null,
    methodStatus: null
  });

  const checkClaude = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, checking: true }));
      
      // Check backend service status
      const serviceStatus = await uiComposerService.getStatus();
      
      // Check if any method is available
      const anyAvailable = serviceStatus.method_status && 
        Object.values(serviceStatus.method_status).some(s => s.available);
      
      setStatus({
        available: anyAvailable,
        checking: false,
        lastChecked: new Date().toISOString(),
        error: anyAvailable ? null : 'No authentication methods available',
        methodStatus: serviceStatus.method_status || {}
      });
      
      return anyAvailable;
    } catch (error) {
      setStatus({
        available: false,
        checking: false,
        lastChecked: new Date().toISOString(),
        error: error.message || 'Failed to check Claude status',
        methodStatus: {}
      });
      return false;
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkClaude();

    // Set up periodic checks (every 5 seconds) if not available
    const interval = setInterval(() => {
      if (!status.available) {
        checkClaude();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [checkClaude, status.available]);

  return {
    ...status,
    checkClaude
  };
};

export default useClaudeStatus;