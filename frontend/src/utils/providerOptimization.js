/**
 * Provider Optimization Utilities
 * 
 * Helps optimize React Context Providers to prevent unnecessary re-renders
 * by properly memoizing provider values and separating static from dynamic state
 */
import React from 'react';

/**
 * Creates an optimized provider component with memoized value
 * 
 * @param {Object} options - Provider configuration
 * @param {React.Context} options.context - The React context
 * @param {Function} options.useProviderLogic - Hook that returns provider state and methods
 * @param {string} options.displayName - Display name for the provider
 * @returns {React.Component} Optimized provider component
 */
export function createOptimizedProvider({ context, useProviderLogic, displayName }) {
  const Provider = ({ children }) => {
    // Get all state and methods from the provider logic hook
    const providerData = useProviderLogic();
    
    // Memoize the entire provider value to prevent unnecessary re-renders
    const value = React.useMemo(() => providerData, Object.values(providerData));
    
    return (
      <context.Provider value={value}>
        {children}
      </context.Provider>
    );
  };
  
  Provider.displayName = displayName;
  return Provider;
}

/**
 * Splits provider state into static and dynamic parts for better optimization
 * 
 * @param {Object} state - The provider state
 * @param {Array<string>} staticKeys - Keys that rarely change
 * @returns {Object} Object with static and dynamic state separated
 */
export function splitProviderState(state, staticKeys = []) {
  const staticState = {};
  const dynamicState = {};
  
  Object.entries(state).forEach(([key, value]) => {
    if (staticKeys.includes(key)) {
      staticState[key] = value;
    } else {
      dynamicState[key] = value;
    }
  });
  
  return { staticState, dynamicState };
}

/**
 * Creates a compound provider that combines multiple providers efficiently
 * Reduces the provider pyramid by combining related providers
 * 
 * @param {Array<React.Component>} providers - Array of provider components
 * @returns {React.Component} Combined provider component
 */
export function createCompoundProvider(providers) {
  const CompoundProvider = ({ children }) => {
    return providers.reduceRight((acc, Provider) => {
      return <Provider>{acc}</Provider>;
    }, children);
  };
  
  CompoundProvider.displayName = 'CompoundProvider';
  return CompoundProvider;
}

/**
 * Hook for creating memoized callbacks that maintain stable references
 * Useful for provider methods that get passed down
 * 
 * @param {Object} callbacks - Object of callback functions
 * @param {Array} deps - Dependencies for the callbacks
 * @returns {Object} Memoized callbacks object
 */
export function useMemoizedCallbacks(callbacks, deps = []) {
  return React.useMemo(() => {
    const memoizedCallbacks = {};
    Object.entries(callbacks).forEach(([key, callback]) => {
      memoizedCallbacks[key] = callback;
    });
    return memoizedCallbacks;
  }, deps);
}

/**
 * Performance monitoring wrapper for providers
 * Logs render counts and helps identify performance issues
 * 
 * @param {React.Component} Provider - Provider component to monitor
 * @param {string} name - Name for logging
 * @returns {React.Component} Monitored provider component
 */
export function withProviderMonitoring(Provider, name) {
  if (process.env.NODE_ENV !== 'development') {
    return Provider;
  }
  
  let renderCount = 0;
  
  const MonitoredProvider = (props) => {
    renderCount++;
    
    React.useEffect(() => {
      console.log(`[Provider Performance] ${name} rendered ${renderCount} times`);
    });
    
    return <Provider {...props} />;
  };
  
  MonitoredProvider.displayName = `Monitored(${name})`;
  return MonitoredProvider;
}

/**
 * Creates a provider with selective subscription support
 * Allows consumers to subscribe to only specific parts of the state
 * 
 * @param {React.Context} context - The React context
 * @param {Function} useProviderLogic - Hook that returns provider state and methods
 * @param {Object} selectors - Object of selector functions
 * @returns {Object} Provider component and selector hooks
 */
export function createSelectiveProvider(context, useProviderLogic, selectors = {}) {
  // Create contexts outside of component to maintain stable references
  const subContexts = {};
  Object.keys(selectors).forEach(key => {
    subContexts[key] = React.createContext();
  });
  
  const Provider = ({ children }) => {
    const providerData = useProviderLogic();
    
    // Create hooks for memoizing selector values
    // We need to use hooks at the top level, not in forEach
    const selectorEntries = Object.entries(selectors);
    const selectorValues = {};
    
    // Use a single useMemo to compute all selector values
    const memoizedSelectorValues = React.useMemo(() => {
      const values = {};
      selectorEntries.forEach(([key, selector]) => {
        values[key] = selector(providerData);
      });
      return values;
    }, [providerData]); // selectorEntries is stable, only providerData changes
    
    // Assign the memoized values
    Object.assign(selectorValues, memoizedSelectorValues);
    
    // Nest all contexts
    let content = children;
    Object.entries(subContexts).forEach(([key, SubContext]) => {
      const prev = content;
      content = (
        <SubContext.Provider value={selectorValues[key]}>
          {prev}
        </SubContext.Provider>
      );
    });
    
    // Wrap with main context
    const mainValue = React.useMemo(() => providerData, [providerData]);
    
    return (
      <context.Provider value={mainValue}>
        {content}
      </context.Provider>
    );
  };
  
  // Create selector hooks as proper React hooks
  const selectorHooks = {};
  Object.keys(selectors).forEach((key) => {
    const hookName = `use${key.charAt(0).toUpperCase() + key.slice(1)}`;
    // Create a proper hook function
    selectorHooks[hookName] = function useSelector() {
      const contextValue = React.useContext(subContexts[key]);
      if (contextValue === undefined) {
        throw new Error(`${hookName} must be used within Provider`);
      }
      return contextValue;
    };
    // Set display name for debugging
    Object.defineProperty(selectorHooks[hookName], 'name', { value: hookName });
  });
  
  return { Provider, ...selectorHooks };
}