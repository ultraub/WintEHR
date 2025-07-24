/**
 * Performance Tracking Hook
 * 
 * Custom React hook that integrates with the performance monitor
 * to automatically track component performance metrics
 */

import { useEffect, useRef, useCallback } from 'react';
import performanceMonitor from '../utils/performanceMonitor';

/**
 * Hook to track component performance automatically
 * 
 * @param {string} componentName - Name of the component being tracked
 * @param {Object} options - Configuration options
 * @param {boolean} options.trackRenders - Whether to track render times (default: true)
 * @param {boolean} options.trackMounts - Whether to track mount/unmount (default: true)
 * @param {boolean} options.logSlowRenders - Whether to log slow renders (default: true)
 * @param {number} options.slowRenderThreshold - Threshold for slow render warning in ms (default: 16)
 * 
 * @returns {Object} Performance tracking utilities
 */
export function usePerformanceTracking(componentName, options = {}) {
  const {
    trackRenders = true,
    trackMounts = true,
    logSlowRenders = true,
    slowRenderThreshold = 16 // One frame at 60fps
  } = options;

  const renderCount = useRef(0);
  const mountTime = useRef(null);
  const lastRenderTime = useRef(null);

  // Track component mount
  useEffect(() => {
    if (trackMounts) {
      mountTime.current = performance.now();
      performanceMonitor.recordMetric('componentMount', {
        component: componentName,
        timestamp: mountTime.current
      });

      // Track unmount
      return () => {
        const unmountTime = performance.now();
        const lifetimeDuration = unmountTime - mountTime.current;
        
        performanceMonitor.recordMetric('componentUnmount', {
          component: componentName,
          lifetimeDuration,
          renderCount: renderCount.current,
          avgRenderTime: renderCount.current > 0 ? 
            lifetimeDuration / renderCount.current : 0
        });
      };
    }
  }, [componentName, trackMounts]);

  // Track renders
  useEffect(() => {
    if (trackRenders) {
      const renderTime = performance.now();
      renderCount.current++;

      if (lastRenderTime.current) {
        const renderDuration = renderTime - lastRenderTime.current;
        
        performanceMonitor.trackComponentRender(componentName, renderDuration);

        if (logSlowRenders && renderDuration > slowRenderThreshold) {
          console.warn(
            `[Performance] Slow render in ${componentName}: ${renderDuration.toFixed(2)}ms`
          );
        }
      }

      lastRenderTime.current = renderTime;
    }
  });

  // Track user interactions
  const trackInteraction = useCallback((interactionName, callback) => {
    return async (...args) => {
      const startTime = performance.now();
      
      try {
        const result = await callback(...args);
        const duration = performance.now() - startTime;
        
        performanceMonitor.trackInteraction(
          `${componentName}:${interactionName}`,
          duration,
          { component: componentName }
        );
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        performanceMonitor.trackInteraction(
          `${componentName}:${interactionName}:error`,
          duration,
          { 
            component: componentName,
            error: error.message 
          }
        );
        
        throw error;
      }
    };
  }, [componentName]);

  // Track custom metrics
  const trackMetric = useCallback((metricName, value, metadata = {}) => {
    performanceMonitor.recordMetric(`component:${componentName}:${metricName}`, {
      value,
      component: componentName,
      ...metadata
    });
  }, [componentName]);

  // Mark performance timeline
  const mark = useCallback((markName) => {
    performanceMonitor.mark(`${componentName}:${markName}`);
  }, [componentName]);

  // Measure between marks
  const measure = useCallback((measureName, startMark, endMark) => {
    const startMarkName = startMark.includes(':') ? 
      startMark : `${componentName}:${startMark}`;
    const endMarkName = endMark.includes(':') ? 
      endMark : `${componentName}:${endMark}`;
    
    return performanceMonitor.measure(
      `${componentName}:${measureName}`,
      startMarkName,
      endMarkName
    );
  }, [componentName]);

  // Track API calls
  const trackAPICall = useCallback((endpoint, duration, status = 'success') => {
    performanceMonitor.recordMetric('componentAPICall', {
      component: componentName,
      endpoint,
      duration,
      status
    });
  }, [componentName]);

  return {
    // Wrap callbacks to track their performance
    trackInteraction,
    
    // Track custom metrics
    trackMetric,
    
    // Performance marks and measures
    mark,
    measure,
    
    // Track API calls
    trackAPICall,
    
    // Get current render count
    getRenderCount: () => renderCount.current,
    
    // Get component lifetime
    getLifetime: () => mountTime.current ? 
      performance.now() - mountTime.current : 0
  };
}

/**
 * Hook to track specific operation performance
 * 
 * @param {string} operationName - Name of the operation
 * @returns {Object} Operation tracking functions
 */
export function useOperationTracking(operationName) {
  const operationStarts = useRef(new Map());

  const startOperation = useCallback((operationId = 'default') => {
    const startTime = performance.now();
    operationStarts.current.set(operationId, startTime);
    
    performanceMonitor.mark(`${operationName}:${operationId}:start`);
  }, [operationName]);

  const endOperation = useCallback((operationId = 'default', metadata = {}) => {
    const startTime = operationStarts.current.get(operationId);
    
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationName}:${operationId}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    performanceMonitor.mark(`${operationName}:${operationId}:end`);
    performanceMonitor.measure(
      `${operationName}:${operationId}`,
      `${operationName}:${operationId}:start`,
      `${operationName}:${operationId}:end`
    );

    performanceMonitor.recordMetric('operation', {
      name: operationName,
      id: operationId,
      duration,
      ...metadata
    });

    operationStarts.current.delete(operationId);
    
    return duration;
  }, [operationName]);

  const cancelOperation = useCallback((operationId = 'default') => {
    operationStarts.current.delete(operationId);
  }, []);

  return {
    startOperation,
    endOperation,
    cancelOperation
  };
}

/**
 * Hook to track data fetching performance
 * 
 * @param {string} dataSource - Name of the data source
 * @returns {Function} Wrapped fetch function with performance tracking
 */
export function useDataFetchTracking(dataSource) {
  const { startOperation, endOperation } = useOperationTracking(`fetch:${dataSource}`);

  const trackedFetch = useCallback(async (fetchFn, fetchId = 'default') => {
    startOperation(fetchId);
    
    try {
      const result = await fetchFn();
      const duration = endOperation(fetchId, { status: 'success' });
      
      // Track slow fetches
      if (duration > 1000) {
        console.warn(`[Performance] Slow data fetch from ${dataSource}: ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      endOperation(fetchId, { 
        status: 'error',
        error: error.message 
      });
      throw error;
    }
  }, [dataSource, startOperation, endOperation]);

  return trackedFetch;
}