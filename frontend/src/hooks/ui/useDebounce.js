import { useState, useEffect } from 'react';

/**
 * Debounce hook to delay expensive operations like search
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} Debounced value
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounced callback hook
 * @param {Function} callback - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {Array} deps - Dependencies array
 * @returns {Function} Debounced callback
 */
export function useDebouncedCallback(callback, delay, deps) {
  const [debounceTimer, setDebounceTimer] = useState();

  const debouncedCallback = (...args) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const newTimer = setTimeout(() => {
      callback(...args);
    }, delay);

    setDebounceTimer(newTimer);
  };

  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      setDebounceTimer(undefined);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  // deps is intentionally dynamic - it's the dependency array passed by the caller

  return debouncedCallback;
}

export default useDebounce;