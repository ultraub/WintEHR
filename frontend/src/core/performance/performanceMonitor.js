/**
 * Performance Monitoring Stub
 * No-op implementation - performance monitoring disabled
 */

class PerformanceMonitor {
  constructor() {
    this.enabled = false;
  }

  // No-op methods
  startTimer() {}
  endTimer() {}
  recordMetric() {}
  mark() {}
  measure() { return 0; }
  trackComponentRender() {}
  trackInteraction() {}
  getMetrics() { return {}; }
  getWebVitals() { return {}; }
  checkPerformanceBudgets() { return { passed: true, violations: [] }; }
  generateReport() { return 'Performance monitoring disabled'; }
  debug() {}
  monitorComponent() { return (Component) => Component; }
  monitor() { return Promise.resolve(); }
  getMemoryUsage() { return null; }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility function (no-op)
export function withPerformanceMonitoring(operationName, fn) {
  return fn();
}

export default performanceMonitor;
