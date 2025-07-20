/**
 * Enhanced Performance Optimizations for Clinical Workspace
 * Part of the Clinical UI Improvements Initiative
 * 
 * This file contains advanced performance optimization utilities and configurations
 * to ensure optimal performance across all clinical components
 */

import React, { lazy, memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

// Enhanced lazy loading with error boundaries and retry logic
export const createLazyComponent = (importFn, options = {}) => {
  const {
    fallback = null,
    maxRetries = 3,
    retryDelay = 1000,
    preload = false,
    chunkName = null
  } = options;

  let retryCount = 0;
  
  const LazyComponent = lazy(() => {
    return importFn().catch(err => {
      if (retryCount < maxRetries) {
        retryCount++;
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(importFn());
          }, retryDelay * retryCount);
        });
      }
      throw err;
    });
  });

  // Preload component if specified
  if (preload) {
    importFn();
  }

  return LazyComponent;
};

// Virtual scrolling hook for large lists
export const useVirtualScrolling = (items, options = {}) => {
  const {
    itemHeight = 64,
    containerHeight = 600,
    overscan = 3,
    scrollDebounce = 50
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const scrollTimeout = useRef(null);

  const handleScroll = useCallback((e) => {
    if (scrollTimeout.current) {
      clearTimeout(scrollTimeout.current);
    }
    
    scrollTimeout.current = setTimeout(() => {
      setScrollTop(e.target.scrollTop);
    }, scrollDebounce);
  }, [scrollDebounce]);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
    
    const visibleStartIndex = Math.max(0, startIndex - overscan);
    const visibleEndIndex = Math.min(items.length - 1, endIndex + overscan);
    
    return {
      items: items.slice(visibleStartIndex, visibleEndIndex + 1),
      offsetY: visibleStartIndex * itemHeight,
      totalHeight: items.length * itemHeight,
      startIndex: visibleStartIndex,
      endIndex: visibleEndIndex
    };
  }, [items, scrollTop, itemHeight, containerHeight, overscan]);

  return {
    visibleItems,
    handleScroll
  };
};

// Advanced memoization with size limits and TTL
export const createMemoizedSelector = (fn, options = {}) => {
  const {
    maxSize = 100,
    ttl = 5 * 60 * 1000, // 5 minutes default
    keyFn = JSON.stringify
  } = options;

  const cache = new Map();
  const timestamps = new Map();

  return (...args) => {
    const key = keyFn(args);
    const now = Date.now();
    
    // Check if cached value exists and is still valid
    if (cache.has(key)) {
      const timestamp = timestamps.get(key);
      if (now - timestamp < ttl) {
        return cache.get(key);
      }
    }
    
    // Calculate new value
    const result = fn.apply(this, args);
    
    // Manage cache size
    if (cache.size >= maxSize) {
      const oldestKey = [...timestamps.entries()].sort((a, b) => a[1] - b[1])[0][0];
      cache.delete(oldestKey);
      timestamps.delete(oldestKey);
    }
    
    cache.set(key, result);
    timestamps.set(key, now);
    
    return result;
  };
};

// Intersection Observer hook for lazy loading
export const useIntersectionObserver = (options = {}) => {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true
  } = options;

  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const targetRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsIntersecting(true);
            setHasIntersected(true);
            
            if (triggerOnce && targetRef.current) {
              observer.unobserve(targetRef.current);
            }
          } else if (!triggerOnce) {
            setIsIntersecting(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    if (targetRef.current) {
      observer.observe(targetRef.current);
    }

    return () => {
      if (targetRef.current) {
        observer.unobserve(targetRef.current);
      }
    };
  }, [threshold, rootMargin, triggerOnce]);

  return {
    targetRef,
    isIntersecting: triggerOnce ? hasIntersected : isIntersecting
  };
};

// Request Animation Frame hook for smooth animations
export const useAnimationFrame = (callback, deps = []) => {
  const requestRef = useRef();
  const previousTimeRef = useRef();

  const animate = useCallback((time) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [...deps, animate]);
};

// Batch state updates for better performance
export const batchedUpdates = (callback) => {
  unstable_batchedUpdates(callback);
};

// Web Worker manager for heavy computations
export class WorkerManager {
  constructor(workerScript) {
    this.worker = null;
    this.workerScript = workerScript;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  initialize() {
    if (!this.worker && typeof Worker !== 'undefined') {
      this.worker = new Worker(this.workerScript);
      this.worker.onmessage = this.handleMessage.bind(this);
      this.worker.onerror = this.handleError.bind(this);
    }
  }

  handleMessage(event) {
    const { id, result, error } = event.data;
    const pending = this.pendingMessages.get(id);
    
    if (pending) {
      if (error) {
        pending.reject(error);
      } else {
        pending.resolve(result);
      }
      this.pendingMessages.delete(id);
    }
  }

  handleError(error) {
    console.error('Worker error:', error);
    this.pendingMessages.forEach(pending => pending.reject(error));
    this.pendingMessages.clear();
  }

  postMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        this.initialize();
      }
      
      const id = this.messageId++;
      this.pendingMessages.set(id, { resolve, reject });
      
      if (this.worker) {
        this.worker.postMessage({ id, ...message });
      } else {
        reject(new Error('Worker not available'));
      }
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingMessages.clear();
  }
}

// Performance monitoring with React Profiler integration
export const withPerformanceMonitoring = (Component, componentName) => {
  const MonitoredComponent = (props) => {
    const renderCount = useRef(0);
    const renderStart = useRef(Date.now());

    useEffect(() => {
      renderCount.current++;
      const renderTime = Date.now() - renderStart.current;
      
      if (renderCount.current > 50) {
        console.warn(`[Performance] ${componentName} rendered ${renderCount.current} times`);
      }
      
      if (renderTime > 16) { // More than one frame
        console.warn(`[Performance] ${componentName} slow render: ${renderTime}ms`);
      }
      
      renderStart.current = Date.now();
    });

    return (
      <React.Profiler
        id={componentName}
        onRender={(id, phase, actualDuration) => {
          if (actualDuration > 16) {
            performanceMonitor.logSlowRender(id, phase, actualDuration);
          }
        }}
      >
        <Component {...props} />
      </React.Profiler>
    );
  };

  MonitoredComponent.displayName = `withPerformanceMonitoring(${componentName})`;
  return memo(MonitoredComponent);
};

// Smart component update prevention
export const useSmartUpdate = (value, compareFn = Object.is) => {
  const ref = useRef(value);
  
  if (!compareFn(ref.current, value)) {
    ref.current = value;
  }
  
  return ref.current;
};

// Resource hint manager for preloading critical resources
export const resourceHintManager = {
  preloadScript: (url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = url;
    document.head.appendChild(link);
  },
  
  preloadStyle: (url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = url;
    document.head.appendChild(link);
  },
  
  preloadImage: (url) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  },
  
  prefetchResource: (url) => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  },
  
  preconnect: (origin) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
  }
};

// Performance budget checker
export const performanceBudget = {
  budgets: {
    bundleSize: 500 * 1024, // 500KB
    loadTime: 3000, // 3 seconds
    renderTime: 16, // 16ms (60fps)
    memoryUsage: 50 * 1024 * 1024 // 50MB
  },
  
  checkBudget: (metric, value) => {
    const budget = performanceBudget.budgets[metric];
    if (value > budget) {
      console.warn(`[Performance Budget] ${metric} exceeded: ${value} > ${budget}`);
      return false;
    }
    return true;
  },
  
  getMetrics: () => {
    const metrics = {};
    
    if (window.performance && window.performance.memory) {
      metrics.memoryUsage = window.performance.memory.usedJSHeapSize;
    }
    
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      metrics.loadTime = timing.loadEventEnd - timing.navigationStart;
    }
    
    return metrics;
  }
};

// Clinical-specific optimizations
export const clinicalOptimizations = {
  // FHIR resource caching strategy
  fhirCacheStrategy: {
    Patient: { ttl: 30 * 60 * 1000, maxSize: 50 }, // 30 minutes
    Encounter: { ttl: 15 * 60 * 1000, maxSize: 100 }, // 15 minutes
    Condition: { ttl: 10 * 60 * 1000, maxSize: 200 }, // 10 minutes
    MedicationRequest: { ttl: 5 * 60 * 1000, maxSize: 200 }, // 5 minutes
    Observation: { ttl: 5 * 60 * 1000, maxSize: 500 }, // 5 minutes
    DiagnosticReport: { ttl: 10 * 60 * 1000, maxSize: 100 }, // 10 minutes
  },
  
  // Resource loading priorities
  loadingPriorities: {
    critical: ['Patient', 'Encounter', 'AllergyIntolerance'],
    high: ['Condition', 'MedicationRequest', 'Observation'],
    medium: ['DiagnosticReport', 'Procedure', 'Immunization'],
    low: ['DocumentReference', 'CarePlan', 'Goal']
  },
  
  // Batch size configurations
  batchSizes: {
    initial: 20,
    scroll: 10,
    search: 50,
    export: 100
  }
};

// Export all optimizations
export default {
  createLazyComponent,
  useVirtualScrolling,
  createMemoizedSelector,
  useIntersectionObserver,
  useAnimationFrame,
  batchedUpdates,
  WorkerManager,
  withPerformanceMonitoring,
  useSmartUpdate,
  resourceHintManager,
  performanceBudget,
  clinicalOptimizations,
  
  // Re-export from base optimizations
  ...require('./optimizations').default
};