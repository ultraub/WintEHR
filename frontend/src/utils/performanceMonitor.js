/**
 * Performance Monitoring Utility
 * 
 * Provides centralized performance monitoring and metrics collection
 * for the frontend application, including:
 * - Component render times
 * - API response times  
 * - Resource loading metrics
 * - Memory usage tracking
 * - User interaction latency
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.enabled = process.env.NODE_ENV === 'development' || 
                   process.env.REACT_APP_ENABLE_PERFORMANCE_MONITORING === 'true';
    this.renderCounts = new Map();
    this.apiCallMetrics = new Map();
    this.startTime = performance.now();
    
    // Initialize Performance Observer if available
    if (this.enabled && 'PerformanceObserver' in window) {
      this.initializeObservers();
    }
  }

  /**
   * Initialize Performance Observers for various metrics
   */
  initializeObservers() {
    // Observe navigation timing
    try {
      const navObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('navigation', {
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime,
            type: entry.entryType
          });
        }
      });
      navObserver.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.debug('Navigation observer not supported');
    }

    // Observe resource timing
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('/fhir/') || entry.name.includes('/api/')) {
            this.recordAPIMetric(entry);
          }
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.debug('Resource observer not supported');
    }

    // Observe long tasks (blocking main thread)
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) { // Tasks longer than 50ms
            this.recordMetric('longTask', {
              duration: entry.duration,
              startTime: entry.startTime,
              attribution: entry.attribution
            });
            console.warn(`Long task detected: ${entry.duration}ms`);
          }
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      console.debug('Long task observer not supported');
    }
  }

  /**
   * Record a general metric
   */
  recordMetric(category, data) {
    if (!this.enabled) return;
    
    if (!this.metrics.has(category)) {
      this.metrics.set(category, []);
    }
    
    const metric = {
      ...data,
      timestamp: performance.now(),
      memory: this.getMemoryUsage()
    };
    
    this.metrics.get(category).push(metric);
    
    // Limit stored metrics to prevent memory issues
    const categoryMetrics = this.metrics.get(category);
    if (categoryMetrics.length > 1000) {
      categoryMetrics.shift(); // Remove oldest
    }
  }

  /**
   * Record API call metrics
   */
  recordAPIMetric(entry) {
    const url = new URL(entry.name, window.location.origin);
    const endpoint = url.pathname;
    
    if (!this.apiCallMetrics.has(endpoint)) {
      this.apiCallMetrics.set(endpoint, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0
      });
    }
    
    const metrics = this.apiCallMetrics.get(endpoint);
    metrics.count++;
    metrics.totalDuration += entry.duration;
    metrics.minDuration = Math.min(metrics.minDuration, entry.duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, entry.duration);
    metrics.avgDuration = metrics.totalDuration / metrics.count;
    
    // Record if this was a slow API call
    if (entry.duration > 1000) { // Calls taking more than 1 second
      this.recordMetric('slowAPI', {
        endpoint,
        duration: entry.duration,
        method: entry.initiatorType
      });
    }
  }

  /**
   * Track component renders
   */
  trackComponentRender(componentName, renderTime) {
    if (!this.enabled) return;
    
    if (!this.renderCounts.has(componentName)) {
      this.renderCounts.set(componentName, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        maxTime: 0
      });
    }
    
    const stats = this.renderCounts.get(componentName);
    stats.count++;
    stats.totalTime += renderTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, renderTime);
    
    // Warn about slow renders
    if (renderTime > 16) { // More than one frame (16ms)
      console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Track user interactions
   */
  trackInteraction(interactionType, duration, metadata = {}) {
    if (!this.enabled) return;
    
    this.recordMetric('userInteraction', {
      type: interactionType,
      duration,
      ...metadata
    });
    
    // Warn about slow interactions
    if (duration > 100) { // Interactions taking more than 100ms feel sluggish
      console.warn(`Slow interaction detected (${interactionType}): ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (performance.memory) {
      return {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        percentUsed: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      };
    }
    return null;
  }

  /**
   * Mark the start of a performance measurement
   */
  mark(name) {
    if (!this.enabled) return;
    performance.mark(name);
  }

  /**
   * Measure between two marks
   */
  measure(name, startMark, endMark) {
    if (!this.enabled) return null;
    
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      
      this.recordMetric('customMeasure', {
        name,
        duration: measure.duration,
        startTime: measure.startTime
      });
      
      // Clean up marks and measures
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(name);
      
      return measure.duration;
    } catch (e) {
      console.error('Performance measurement failed:', e);
      return null;
    }
  }

  /**
   * Get performance summary
   */
  getSummary() {
    if (!this.enabled) return null;
    
    const uptime = performance.now() - this.startTime;
    const memory = this.getMemoryUsage();
    
    // Calculate API metrics summary
    const apiSummary = {};
    for (const [endpoint, metrics] of this.apiCallMetrics) {
      if (metrics.count > 0) {
        apiSummary[endpoint] = {
          calls: metrics.count,
          avgDuration: metrics.avgDuration.toFixed(2) + 'ms',
          minDuration: metrics.minDuration.toFixed(2) + 'ms',
          maxDuration: metrics.maxDuration.toFixed(2) + 'ms'
        };
      }
    }
    
    // Calculate render metrics summary
    const renderSummary = {};
    for (const [component, stats] of this.renderCounts) {
      if (stats.count > 0) {
        renderSummary[component] = {
          renders: stats.count,
          avgRenderTime: stats.avgTime.toFixed(2) + 'ms',
          maxRenderTime: stats.maxTime.toFixed(2) + 'ms',
          totalRenderTime: stats.totalTime.toFixed(2) + 'ms'
        };
      }
    }
    
    // Count slow operations
    const slowAPICalls = this.metrics.get('slowAPI')?.length || 0;
    const longTasks = this.metrics.get('longTask')?.length || 0;
    
    return {
      uptime: (uptime / 1000).toFixed(2) + 's',
      memory: memory ? {
        used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
        limit: (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB',
        percentUsed: memory.percentUsed.toFixed(2) + '%'
      } : 'N/A',
      apiCalls: apiSummary,
      componentRenders: renderSummary,
      warnings: {
        slowAPICalls,
        longTasks,
        totalWarnings: slowAPICalls + longTasks
      }
    };
  }

  /**
   * Log performance summary to console
   */
  logSummary() {
    if (!this.enabled) return;
    
    const summary = this.getSummary();
    console.group('🚀 Performance Summary');
    console.log('Uptime:', summary.uptime);
    console.log('Memory:', summary.memory);
    console.table(summary.apiCalls);
    console.table(summary.componentRenders);
    console.log('Warnings:', summary.warnings);
    console.groupEnd();
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    if (!this.enabled) return null;
    
    return {
      summary: this.getSummary(),
      rawMetrics: Object.fromEntries(this.metrics),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.renderCounts.clear();
    this.apiCallMetrics.clear();
  }

  /**
   * Get performance tracking utilities for a component
   * Note: This is not a React Hook - use the exported hook instead
   */
  getComponentTracker(componentName) {
    return {
      trackRender: (renderTime) => {
        this.trackComponentRender(componentName, renderTime);
      },
      trackInteraction: (type, startTime) => {
        const duration = performance.now() - startTime;
        this.trackInteraction(type, duration, { component: componentName });
      }
    };
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export for use in components
export default performanceMonitor;

// Export React hook for easy component integration
export const usePerformanceMonitor = (componentName) => {
  // This is a proper React Hook that can use React features
  const React = require('react');
  const renderStartTime = React.useRef(performance.now());
  
  React.useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    performanceMonitor.trackComponentRender(componentName, renderTime);
  });
  
  return performanceMonitor.getComponentTracker(componentName);
};

// Auto-log summary in development every 30 seconds
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    performanceMonitor.logSummary();
  }, 30000);
}