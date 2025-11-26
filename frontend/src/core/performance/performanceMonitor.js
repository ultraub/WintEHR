/**
 * Performance Monitoring Utility
 * Tracks loading times, memory usage, Core Web Vitals, and other performance metrics
 */

import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.webVitals = new Map();
    this.observers = [];
    this.enabled = process.env.NODE_ENV === 'development' || 
                  localStorage.getItem('enablePerformanceMonitoring') === 'true';
    this.setupWebVitalsTracking();
    this.setupPerformanceObservers();
  }

  /**
   * Setup Core Web Vitals tracking
   */
  setupWebVitalsTracking() {
    if (!this.enabled) return;

    const onVital = (metric) => {
      this.webVitals.set(metric.name, {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        timestamp: Date.now()
      });
    };

    getCLS(onVital);
    getFID(onVital);
    getFCP(onVital);
    getLCP(onVital);
    getTTFB(onVital);
  }

  /**
   * Setup performance observers
   */
  setupPerformanceObservers() {
    if (!this.enabled || !('PerformanceObserver' in window)) return;

    // Long task observer
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('long-task', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name
          });
        }
      });
      longTaskObserver.observe({ entryTypes: ['longtask'] });
      this.observers.push(longTaskObserver);
    } catch (e) {
      // Long task observer not supported
    }

    // Resource timing observer
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('resource-timing', {
            name: entry.name,
            duration: entry.duration,
            transferSize: entry.transferSize || 0,
            encodedBodySize: entry.encodedBodySize || 0
          });
        }
      });
      resourceObserver.observe({ entryTypes: ['resource'] });
      this.observers.push(resourceObserver);
    } catch (e) {
      // Resource timing observer not supported
    }
  }

  /**
   * Start timing an operation
   */
  startTimer(operationName, metadata = {}) {
    if (!this.enabled) return;

    const startTime = performance.now();
    this.timers.set(operationName, {
      startTime,
      metadata,
      memory: this.getMemoryUsage()
    });
  }

  /**
   * End timing an operation and record metrics
   */
  endTimer(operationName, additionalData = {}) {
    if (!this.enabled) return;

    const timer = this.timers.get(operationName);
    if (!timer) {
      this.debug(`Timer '${operationName}' not found`);
      return;
    }

    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    const endMemory = this.getMemoryUsage();

    const metric = {
      operationName,
      duration,
      startTime: timer.startTime,
      endTime,
      metadata: timer.metadata,
      additionalData,
      memory: {
        start: timer.memory,
        end: endMemory,
        delta: endMemory ? endMemory - timer.memory : null
      },
      timestamp: new Date().toISOString()
    };

    // Store metric
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    this.metrics.get(operationName).push(metric);

    // Log result
    const memoryDelta = metric.memory.delta ?
      ` (${(metric.memory.delta / 1024 / 1024).toFixed(2)}MB)` : '';

    this.debug(`[${operationName}] ${metric.duration.toFixed(2)}ms${memoryDelta}`, additionalData);

    // Cleanup
    this.timers.delete(operationName);

    return metric;
  }

  /**
   * Get memory usage (if available)
   */
  getMemoryUsage() {
    if (performance.memory) {
      return performance.memory.usedJSHeapSize;
    }
    return null;
  }

  /**
   * Record a custom metric
   */
  recordMetric(name, value, metadata = {}) {
    if (!this.enabled) return;

    const metric = {
      name,
      value,
      metadata,
      timestamp: new Date().toISOString()
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name).push(metric);
  }

  /**
   * Get statistics for an operation
   */
  getStats(operationName) {
    const operations = this.metrics.get(operationName);
    if (!operations || operations.length === 0) {
      return null;
    }

    const durations = operations.map(op => op.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    // Calculate percentiles
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)];
    const p90 = sortedDurations[Math.floor(sortedDurations.length * 0.9)];
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)];

    return {
      operationName,
      count: operations.length,
      avgDuration: avgDuration.toFixed(2),
      minDuration: minDuration.toFixed(2),
      maxDuration: maxDuration.toFixed(2),
      p50: p50.toFixed(2),
      p90: p90.toFixed(2),
      p95: p95.toFixed(2),
      lastRun: operations[operations.length - 1].timestamp
    };
  }

  /**
   * Get all performance stats
   */
  getAllStats() {
    const stats = {};
    for (const operationName of this.metrics.keys()) {
      stats[operationName] = this.getStats(operationName);
    }
    return stats;
  }

  /**
   * Export metrics as JSON
   */
  exportMetrics() {
    const allMetrics = {};
    for (const [key, value] of this.metrics.entries()) {
      allMetrics[key] = value;
    }
    return JSON.stringify(allMetrics, null, 2);
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics.clear();
    this.timers.clear();
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    localStorage.setItem('enablePerformanceMonitoring', enabled.toString());
  }

  /**
   * Monitor a function execution
   */
  monitor(operationName, fn, metadata = {}) {
    return async (...args) => {
      this.startTimer(operationName, { ...metadata, args: args.length });
      
      try {
        const result = await fn(...args);
        this.endTimer(operationName, { 
          success: true, 
          resultSize: JSON.stringify(result || {}).length 
        });
        return result;
      } catch (error) {
        this.endTimer(operationName, { 
          success: false, 
          error: error.message 
        });
        throw error;
      }
    };
  }

  /**
   * Monitor React component render time
   */
  monitorComponent(componentName) {
    return (WrappedComponent) => {
      return function MonitoredComponent(props) {
        React.useEffect(() => {
          performanceMonitor.startTimer(`${componentName}.mount`);
          return () => {
            performanceMonitor.endTimer(`${componentName}.mount`);
          };
        }, []);

        React.useEffect(() => {
          performanceMonitor.recordMetric(`${componentName}.render`, 1);
        });

        return React.createElement(WrappedComponent, props);
      };
    };
  }

  /**
   * Get Core Web Vitals metrics
   */
  getWebVitals() {
    return Object.fromEntries(this.webVitals);
  }

  /**
   * Check performance budgets
   */
  checkPerformanceBudgets() {
    const budgets = {
      LCP: 2500, // ms
      FID: 100,  // ms
      CLS: 0.1,  // score
      FCP: 1800, // ms
      TTFB: 600  // ms
    };

    const violations = [];
    const webVitals = this.getWebVitals();

    for (const [metric, budget] of Object.entries(budgets)) {
      const vital = webVitals[metric];
      if (vital && vital.value > budget) {
        violations.push({
          metric,
          value: vital.value,
          budget,
          rating: vital.rating
        });
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      budgets,
      webVitals
    };
  }

  /**
   * Send metrics to analytics endpoint
   */
  sendMetrics(endpoint = '/api/analytics/performance') {
    if (!this.enabled) return;

    const report = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      webVitals: this.getWebVitals(),
      performanceStats: this.getAllStats(),
      budgetCheck: this.checkPerformanceBudgets()
    };

    // Use beacon API for reliable sending
    if ('sendBeacon' in navigator) {
      navigator.sendBeacon(endpoint, JSON.stringify(report));
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      }).catch(() => {
        // Ignore failures
      });
    }
  }

  /**
   * Cleanup observers
   */
  cleanup() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    this.observers = [];
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const stats = this.getAllStats();
    const webVitals = this.getWebVitals();
    const budgetCheck = this.checkPerformanceBudgets();
    const memoryInfo = this.getMemoryUsage();
    
    let report = '📊 Performance Report\n';
    report += '=====================\n\n';
    
    // Core Web Vitals
    report += 'Core Web Vitals:\n';
    report += '----------------\n';
    for (const [name, vital] of Object.entries(webVitals)) {
      const rating = vital.rating === 'good' ? '✅' : vital.rating === 'needs-improvement' ? '⚠️' : '❌';
      report += `${name}: ${vital.value}${name === 'CLS' ? '' : 'ms'} ${rating} (${vital.rating})\n`;
    }
    report += '\n';

    // Budget check
    if (!budgetCheck.passed) {
      report += '❌ Performance Budget Violations:\n';
      budgetCheck.violations.forEach(violation => {
        report += `  ${violation.metric}: ${violation.value} > ${violation.budget}\n`;
      });
      report += '\n';
    } else {
      report += '✅ All performance budgets met\n\n';
    }
    
    if (memoryInfo) {
      report += `Memory Usage: ${(memoryInfo / 1024 / 1024).toFixed(2)}MB\n\n`;
    }
    
    report += 'Operation Statistics:\n';
    report += '---------------------\n';
    
    for (const [operation, stat] of Object.entries(stats)) {
      if (stat) {
        report += `${operation}:\n`;
        report += `  Count: ${stat.count}\n`;
        report += `  Avg: ${stat.avgDuration}ms\n`;
        report += `  Min: ${stat.minDuration}ms\n`;
        report += `  Max: ${stat.maxDuration}ms\n`;
        report += `  P95: ${stat.p95}ms\n\n`;
      }
    }
    
    return report;
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Utility function to wrap async functions with monitoring
export function withPerformanceMonitoring(operationName, fn, metadata = {}) {
  return performanceMonitor.monitor(operationName, fn, metadata);
}

// React hook for performance monitoring
export function usePerformanceMonitoring(operationName, dependencies = []) {
  React.useEffect(() => {
    performanceMonitor.startTimer(operationName);
    return () => {
      performanceMonitor.endTimer(operationName);
    };
  }, dependencies);
}

// Higher-order component for monitoring component performance
export function withComponentMonitoring(componentName) {
  return performanceMonitor.monitorComponent(componentName);
}

export default performanceMonitor;