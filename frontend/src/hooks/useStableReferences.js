/**
 * Stable Reference Hooks
 * 
 * Collection of hooks to prevent infinite re-render loops by providing
 * stable references for functions, effects, and state management.
 */
import { useRef, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Creates a stable callback that doesn't change reference on re-renders
 * but always calls the latest version of the function.
 * 
 * Use this instead of useCallback when the callback is used in useEffect
 * dependencies to prevent infinite loops.
 */
export function useStableCallback(callback) {
  const callbackRef = useRef(callback);
  
  // Update the ref to the latest callback on every render
  callbackRef.current = callback;
  
  // Return a stable function that calls the latest callback
  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, []);
}

/**
 * Creates a stable reference that persists across re-renders.
 * Similar to useRef but with better TypeScript support and clarity.
 */
export function useStableRef(initialValue) {
  return useRef(initialValue);
}

/**
 * A guarded useEffect that prevents execution during initial render
 * or when dependencies haven't actually changed.
 */
export function useGuardedEffect(effect, dependencies, options = {}) {
  const { 
    skipInitialRender = false, 
    deep = false,
    debounceMs = 0 
  } = options;
  
  const isInitialRender = useRef(true);
  const prevDependencies = useRef(dependencies);
  const timeoutRef = useRef(null);
  
  // Deep comparison utility for complex dependencies
  const deepEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => deepEqual(a[key], b[key]));
  };
  
  const dependenciesChanged = deep 
    ? !deepEqual(prevDependencies.current, dependencies)
    : dependencies.some((dep, index) => dep !== prevDependencies.current[index]);
  
  useEffect(() => {
    // Skip initial render if requested
    if (skipInitialRender && isInitialRender.current) {
      isInitialRender.current = false;
      prevDependencies.current = dependencies;
      return;
    }
    
    // Skip if dependencies haven't changed
    if (!isInitialRender.current && !dependenciesChanged) {
      return;
    }
    
    // Clear any pending debounced execution
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    const executeEffect = () => {
      const cleanup = effect();
      prevDependencies.current = dependencies;
      isInitialRender.current = false;
      return cleanup;
    };
    
    // Apply debouncing if specified
    if (debounceMs > 0) {
      timeoutRef.current = setTimeout(executeEffect, debounceMs);
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      return executeEffect();
    }
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
  // dependencies is intentionally dynamic - it's the dependency array passed by the caller
}

/**
 * State guard utility to prevent redundant state updates
 */
export function useStateGuard(currentValue, newValue, compareFn = Object.is) {
  return useMemo(() => {
    return !compareFn(currentValue, newValue);
  }, [currentValue, newValue, compareFn]);
}

/**
 * Prevents function recreation by memoizing based on dependencies
 * but returns a stable reference that won't cause useEffect loops.
 */
export function useStableMemo(factory, dependencies) {
  const resultRef = useRef();
  const dependenciesRef = useRef();
  
  // Check if dependencies have changed
  const dependenciesChanged = !dependenciesRef.current || 
    dependencies.some((dep, index) => dep !== dependenciesRef.current[index]);
  
  if (dependenciesChanged) {
    resultRef.current = factory();
    dependenciesRef.current = dependencies;
  }
  
  return resultRef.current;
}

/**
 * Hook for managing loading states with guards to prevent infinite loops
 */
export function useLoadingGuard(initialState = false) {
  const [loading, setLoading] = useState(initialState);
  const loadingRef = useRef(loading);
  
  const setLoadingGuarded = useCallback((newLoading) => {
    if (loadingRef.current !== newLoading) {
      loadingRef.current = newLoading;
      setLoading(newLoading);
    }
  }, []);
  
  return [loading, setLoadingGuarded];
}

/**
 * Initialization guard to prevent effects from running multiple times
 */
export function useInitializationGuard() {
  const isInitialized = useRef(false);
  const isInitializing = useRef(false);
  
  const markInitialized = useCallback(() => {
    isInitialized.current = true;
    isInitializing.current = false;
  }, []);
  
  const markInitializing = useCallback(() => {
    isInitializing.current = true;
  }, []);
  
  const reset = useCallback(() => {
    isInitialized.current = false;
    isInitializing.current = false;
  }, []);
  
  return {
    isInitialized: isInitialized.current,
    isInitializing: isInitializing.current,
    markInitialized,
    markInitializing,
    reset
  };
}

/**
 * Debounced callback with stable reference
 */
export function useDebouncedCallback(callback, delay, dependencies = []) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);
  
  // Update callback ref
  callbackRef.current = callback;
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay, ...dependencies]);
}

/**
 * Comparison utilities for complex objects
 */
export const compareUtils = {
  shallowEqual: (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => a[key] === b[key]);
  },
  
  arrayEqual: (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    
    return a.every((item, index) => item === b[index]);
  },
  
  idEqual: (a, b) => {
    return a?.id === b?.id;
  }
};