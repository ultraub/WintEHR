/**
 * Custom hook for managing timeouts with automatic cleanup
 * Prevents memory leaks from setTimeout calls in components
 */
import { useEffect, useRef, useCallback, useState } from 'react';

export function useTimeout(callback, delay) {
  const savedCallback = useRef(callback);
  const timeoutRef = useRef(null);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  const set = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (delay !== null) {
      timeoutRef.current = setTimeout(() => {
        savedCallback.current();
      }, delay);
    }
  }, [delay]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Return control functions
  return {
    set,
    clear: useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, [])
  };
}

/**
 * Hook for temporary state changes (like success messages)
 * Automatically resets state after specified delay
 */
export function useTemporaryState(initialValue, resetDelay = 3000) {
  const [value, setValue] = useState(initialValue);
  const timeout = useTimeout(() => setValue(initialValue), resetDelay);

  const setTemporary = useCallback((newValue) => {
    setValue(newValue);
    if (newValue !== initialValue) {
      timeout.set();
    }
  }, [initialValue, timeout]);

  return [value, setTemporary];
}