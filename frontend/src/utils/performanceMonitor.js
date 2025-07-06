/**
 * Performance Monitoring Utility
 * Tracks loading times, memory usage, and other performance metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
    this.enabled = process.env.NODE_ENV === 'development' || 
                  localStorage.getItem('enablePerformanceMonitoring') === 'true';
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

    console.log(`🚀 Starting: ${operationName}`, metadata);
  }

  /**
   * End timing an operation and record metrics
   */
  endTimer(operationName, additionalData = {}) {
    if (!this.enabled) return;

    const timer = this.timers.get(operationName);
    if (!timer) {
      console.warn(`⚠️ No timer found for operation: ${operationName}`);
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
    
    console.log(
      `✅ Completed: ${operationName} in ${duration.toFixed(2)}ms${memoryDelta}`,
      additionalData
    );

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
   * Generate performance report
   */
  generateReport() {
    const stats = this.getAllStats();
    const memoryInfo = this.getMemoryUsage();
    
    let report = '📊 Performance Report\n';
    report += '=====================\n\n';
    
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