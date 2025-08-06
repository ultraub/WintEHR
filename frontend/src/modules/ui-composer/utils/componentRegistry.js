/**
 * Component Registry for tracking dynamically generated components
 */

class ComponentRegistry {
  constructor() {
    this.registry = new Map();
    this.loadingStates = new Map();
    this.errors = new Map();
    this.listeners = new Set();
  }

  /**
   * Register a generated component
   */
  register(componentId, componentCode, metadata = {}) {
    const entry = {
      id: componentId,
      code: componentCode,
      metadata: {
        ...metadata,
        registeredAt: new Date().toISOString()
      },
      compiled: null,
      error: null
    };

    this.registry.set(componentId, entry);
    this.clearError(componentId);
    this.notifyListeners('register', componentId, entry);
    
    return entry;
  }

  /**
   * Get a registered component
   */
  get(componentId) {
    return this.registry.get(componentId);
  }

  /**
   * Check if component is registered
   */
  has(componentId) {
    return this.registry.has(componentId);
  }

  /**
   * Set component as loading
   */
  setLoading(componentId, isLoading = true) {
    if (isLoading) {
      this.loadingStates.set(componentId, {
        startTime: Date.now(),
        status: 'loading'
      });
    } else {
      this.loadingStates.delete(componentId);
    }
    
    this.notifyListeners('loading', componentId, isLoading);
  }

  /**
   * Check if component is loading
   */
  isLoading(componentId) {
    return this.loadingStates.has(componentId);
  }

  /**
   * Set component error
   */
  setError(componentId, error) {
    this.errors.set(componentId, {
      error,
      timestamp: Date.now()
    });
    
    this.setLoading(componentId, false);
    this.notifyListeners('error', componentId, error);
  }

  /**
   * Clear component error
   */
  clearError(componentId) {
    this.errors.delete(componentId);
    this.notifyListeners('error', componentId, null);
  }

  /**
   * Get component error
   */
  getError(componentId) {
    const errorEntry = this.errors.get(componentId);
    return errorEntry ? errorEntry.error : null;
  }

  /**
   * Update component code
   */
  updateCode(componentId, newCode) {
    const entry = this.registry.get(componentId);
    if (entry) {
      entry.code = newCode;
      entry.compiled = null; // Reset compiled version
      entry.metadata.updatedAt = new Date().toISOString();
      
      this.clearError(componentId);
      this.notifyListeners('update', componentId, entry);
    }
  }

  /**
   * Set compiled component
   */
  setCompiled(componentId, compiledComponent) {
    const entry = this.registry.get(componentId);
    if (entry) {
      entry.compiled = compiledComponent;
      entry.metadata.compiledAt = new Date().toISOString();
      
      this.setLoading(componentId, false);
      this.notifyListeners('compiled', componentId, compiledComponent);
    }
  }

  /**
   * Get compiled component
   */
  getCompiled(componentId) {
    const entry = this.registry.get(componentId);
    return entry ? entry.compiled : null;
  }

  /**
   * Remove component from registry
   */
  unregister(componentId) {
    const entry = this.registry.get(componentId);
    if (entry) {
      this.registry.delete(componentId);
      this.loadingStates.delete(componentId);
      this.errors.delete(componentId);
      
      this.notifyListeners('unregister', componentId, entry);
    }
  }

  /**
   * Clear all components
   */
  clear() {
    const componentIds = Array.from(this.registry.keys());
    
    this.registry.clear();
    this.loadingStates.clear();
    this.errors.clear();
    
    this.notifyListeners('clear', null, componentIds);
  }

  /**
   * Get all registered components
   */
  getAll() {
    return Array.from(this.registry.values());
  }

  /**
   * Get registry stats
   */
  getStats() {
    const components = this.getAll();
    const loading = this.loadingStates.size;
    const errors = this.errors.size;
    const compiled = components.filter(c => c.compiled).length;
    
    return {
      total: components.length,
      loading,
      errors,
      compiled,
      ready: compiled - errors
    };
  }

  /**
   * Add change listener
   */
  addListener(listener) {
    this.listeners.add(listener);
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event, componentId, data) {
    this.listeners.forEach(listener => {
      try {
        listener(event, componentId, data);
      } catch (error) {
        // Ignore listener errors
      }
    });
  }

  /**
   * Export registry state for debugging
   */
  exportState() {
    return {
      registry: Array.from(this.registry.entries()),
      loadingStates: Array.from(this.loadingStates.entries()),
      errors: Array.from(this.errors.entries()),
      stats: this.getStats()
    };
  }

  /**
   * Import registry state
   */
  importState(state) {
    this.clear();
    
    if (state.registry) {
      state.registry.forEach(([id, entry]) => {
        this.registry.set(id, entry);
      });
    }
    
    if (state.loadingStates) {
      state.loadingStates.forEach(([id, state]) => {
        this.loadingStates.set(id, state);
      });
    }
    
    if (state.errors) {
      state.errors.forEach(([id, error]) => {
        this.errors.set(id, error);
      });
    }
    
    this.notifyListeners('import', null, state);
  }
}

// Create singleton instance
const componentRegistry = new ComponentRegistry();

export default componentRegistry;