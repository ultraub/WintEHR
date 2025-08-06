/**
 * Performance Monitoring Service for Clinical Workspace
 * Tracks, analyzes, and reports on component performance metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.slowRenders = [];
    this.navigationTimings = [];
    this.resourceTimings = [];
    this.enabled = process.env.NODE_ENV === 'development';
    this.reportingThreshold = {
      render: 16, // ms
      navigation: 1000, // ms
      resource: 500 // ms
    };
    
    this.initialize();
  }

  initialize() {
    if (!this.enabled) return;
    
    // Set up Performance Observer for various metrics
    if ('PerformanceObserver' in window) {
      // Navigation timing
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordNavigationTiming(entry);
        }
      });
      
      try {
        navigationObserver.observe({ entryTypes: ['navigation'] });
      } catch (e) {
        console.warn('Navigation timing not supported');
      }
      
      // Resource timing
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordResourceTiming(entry);
        }
      });
      
      try {
        resourceObserver.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('Resource timing not supported');
      }
      
      // Long tasks
      const taskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordLongTask(entry);
        }
      });
      
      try {
        taskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('Long task timing not supported');
      }
    }
    
    // Set up reporting interval
    this.startReporting();
  }

  // Record component render performance
  recordRender(componentName, phase, duration, timestamp = Date.now()) {
    if (!this.enabled) return;
    
    const key = `${componentName}-${phase}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        component: componentName,
        phase,
        count: 0,
        totalDuration: 0,
        maxDuration: 0,
        minDuration: Infinity,
        avgDuration: 0,
        slowRenders: 0
      });
    }
    
    const metric = this.metrics.get(key);
    metric.count++;
    metric.totalDuration += duration;
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.avgDuration = metric.totalDuration / metric.count;
    
    if (duration > this.reportingThreshold.render) {
      metric.slowRenders++;
      this.logSlowRender(componentName, phase, duration, timestamp);
    }
  }

  // Log slow renders for analysis
  logSlowRender(componentName, phase, duration, timestamp = Date.now()) {
    const slowRender = {
      component: componentName,
      phase,
      duration,
      timestamp,
      stack: new Error().stack
    };
    
    this.slowRenders.push(slowRender);
    
    // Keep only last 100 slow renders
    if (this.slowRenders.length > 100) {
      this.slowRenders.shift();
    }
    
    console.warn(`[Performance] Slow render detected: ${componentName} (${phase}) - ${duration.toFixed(2)}ms`);
  }

  // Record navigation timing
  recordNavigationTiming(entry) {
    const timing = {
      url: entry.name,
      duration: entry.duration,
      dns: entry.domainLookupEnd - entry.domainLookupStart,
      tcp: entry.connectEnd - entry.connectStart,
      request: entry.responseStart - entry.requestStart,
      response: entry.responseEnd - entry.responseStart,
      dom: entry.domInteractive - entry.responseEnd,
      load: entry.loadEventEnd - entry.loadEventStart,
      timestamp: Date.now()
    };
    
    this.navigationTimings.push(timing);
    
    if (timing.duration > this.reportingThreshold.navigation) {
      console.warn(`[Performance] Slow navigation: ${timing.url} - ${timing.duration.toFixed(2)}ms`);
    }
  }

  // Record resource timing
  recordResourceTiming(entry) {
    const timing = {
      url: entry.name,
      type: entry.initiatorType,
      duration: entry.duration,
      size: entry.transferSize || 0,
      cached: entry.transferSize === 0,
      timestamp: Date.now()
    };
    
    this.resourceTimings.push(timing);
    
    // Keep only last 500 resource timings
    if (this.resourceTimings.length > 500) {
      this.resourceTimings.shift();
    }
    
    if (timing.duration > this.reportingThreshold.resource && !timing.cached) {
      console.warn(`[Performance] Slow resource: ${timing.type} - ${timing.url} - ${timing.duration.toFixed(2)}ms`);
    }
  }

  // Record long tasks
  recordLongTask(entry) {
    console.warn(`[Performance] Long task detected: ${entry.duration.toFixed(2)}ms`);
  }

  // Get performance report
  getReport() {
    const report = {
      timestamp: Date.now(),
      components: {},
      navigation: this.getNavigationStats(),
      resources: this.getResourceStats(),
      memory: this.getMemoryStats(),
      slowRenders: this.slowRenders.slice(-10) // Last 10 slow renders
    };
    
    // Component metrics
    for (const [key, metric] of this.metrics) {
      report.components[key] = { ...metric };
    }
    
    return report;
  }

  // Get navigation statistics
  getNavigationStats() {
    if (this.navigationTimings.length === 0) return null;
    
    const latest = this.navigationTimings[this.navigationTimings.length - 1];
    const durations = this.navigationTimings.map(t => t.duration);
    
    return {
      latest,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      max: Math.max(...durations),
      min: Math.min(...durations),
      count: this.navigationTimings.length
    };
  }

  // Get resource loading statistics
  getResourceStats() {
    if (this.resourceTimings.length === 0) return null;
    
    const byType = {};
    const durations = [];
    let totalSize = 0;
    let cachedCount = 0;
    
    for (const timing of this.resourceTimings) {
      if (!byType[timing.type]) {
        byType[timing.type] = { count: 0, totalDuration: 0, totalSize: 0 };
      }
      
      byType[timing.type].count++;
      byType[timing.type].totalDuration += timing.duration;
      byType[timing.type].totalSize += timing.size;
      
      durations.push(timing.duration);
      totalSize += timing.size;
      if (timing.cached) cachedCount++;
    }
    
    return {
      byType,
      totalSize,
      cachedCount,
      cacheHitRate: (cachedCount / this.resourceTimings.length) * 100,
      average: durations.reduce((a, b) => a + b, 0) / durations.length,
      count: this.resourceTimings.length
    };
  }

  // Get memory statistics
  getMemoryStats() {
    if (!window.performance || !window.performance.memory) return null;
    
    const memory = window.performance.memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }

  // Start periodic reporting
  startReporting(interval = 60000) { // Report every minute
    if (!this.enabled) return;
    
    this.reportingInterval = setInterval(() => {
      const report = this.getReport();
      console.log('[Performance Report]', report);
      
      // Send to analytics if configured
      if (window.gtag) {
        window.gtag('event', 'performance_report', {
          event_category: 'Performance',
          event_label: 'Clinical Workspace',
          value: report.navigation?.average || 0
        });
      }
    }, interval);
  }

  // Stop reporting
  stopReporting() {
    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = null;
    }
  }

  // Clear all metrics
  clear() {
    this.metrics.clear();
    this.slowRenders = [];
    this.navigationTimings = [];
    this.resourceTimings = [];
  }

  // Export metrics for analysis
  exportMetrics() {
    const report = this.getReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export for use in components
export default performanceMonitor;

// React hook for performance monitoring
export const usePerformanceMonitor = (componentName) => {
  const renderStart = React.useRef(Date.now());
  
  React.useEffect(() => {
    const renderTime = Date.now() - renderStart.current;
    performanceMonitor.recordRender(componentName, 'mount', renderTime);
    
    return () => {
      const unmountTime = Date.now() - renderStart.current;
      performanceMonitor.recordRender(componentName, 'unmount', unmountTime);
    };
  }, [componentName]);
  
  React.useEffect(() => {
    const renderTime = Date.now() - renderStart.current;
    performanceMonitor.recordRender(componentName, 'update', renderTime);
    renderStart.current = Date.now();
  });
  
  return performanceMonitor;
};