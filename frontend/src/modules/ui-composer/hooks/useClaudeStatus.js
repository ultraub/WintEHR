/**
 * useClaudeStatus Hook
 * Monitor Claude availability for UI Composer
 */

import { useState, useEffect, useCallback } from 'react';

export const useClaudeStatus = () => {
  const [status, setStatus] = useState({
    available: false,
    checking: true,
    lastChecked: null,
    error: null
  });

  const checkClaude = useCallback(() => {
    try {
      if (window.claude && typeof window.claude.complete === 'function') {
        setStatus({
          available: true,
          checking: false,
          lastChecked: new Date().toISOString(),
          error: null
        });
        return true;
      } else {
        setStatus({
          available: false,
          checking: false,
          lastChecked: new Date().toISOString(),
          error: 'Claude API not found. Ensure Claude Code is running.'
        });
        return false;
      }
    } catch (error) {
      setStatus({
        available: false,
        checking: false,
        lastChecked: new Date().toISOString(),
        error: error.message
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