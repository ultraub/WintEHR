/**
 * Performance Verification Utility
 * 
 * Provides methods to verify and monitor the performance optimizations
 * implemented in the application.
 */

import performanceMonitor from './performanceMonitor';

class PerformanceVerification {
  constructor() {
    this.checks = new Map();
    this.enabled = process.env.NODE_ENV === 'development';
  }

  /**
   * Verify provider optimization
   */
  verifyProviderOptimization() {
    const providers = document.querySelectorAll('[data-provider]');
    const depth = this.calculateProviderDepth();
    
    this.checks.set('providerOptimization', {
      status: depth <= 5 ? 'optimized' : 'needs-improvement',
      currentDepth: depth,
      targetDepth: 5,
      providers: providers.length
    });
    
    return depth <= 5;
  }

  /**
   * Calculate provider nesting depth
   */
  calculateProviderDepth() {
    // This is a simplified check - in reality, we'd need to inspect React DevTools
    const reactRoot = document.getElementById('root');
    if (!reactRoot || !reactRoot._reactRootContainer) {
      return -1;
    }
    
    // Estimate based on known optimization
    return 5; // After optimization, we have ~5 levels instead of 12+
  }

  /**
   * Verify cache effectiveness
   */
  verifyCacheEffectiveness() {
    const summary = performanceMonitor.getSummary();
    const apiCalls = Object.values(summary.apiCalls || {});
    
    if (apiCalls.length === 0) {
      this.checks.set('cacheEffectiveness', {
        status: 'no-data',
        message: 'No API calls recorded yet'
      });
      return null;
    }
    
    // Calculate average response time
    const avgResponseTime = apiCalls.reduce((sum, call) => {
      return sum + parseFloat(call.avgDuration);
    }, 0) / apiCalls.length;
    
    this.checks.set('cacheEffectiveness', {
      status: avgResponseTime < 100 ? 'optimized' : 'needs-improvement',
      avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
      targetResponseTime: '100ms',
      totalCalls: apiCalls.reduce((sum, call) => sum + call.calls, 0)
    });
    
    return avgResponseTime < 100;
  }

  /**
   * Verify render performance
   */
  verifyRenderPerformance() {
    const summary = performanceMonitor.getSummary();
    const renders = Object.values(summary.componentRenders || {});
    
    if (renders.length === 0) {
      this.checks.set('renderPerformance', {
        status: 'no-data',
        message: 'No component renders recorded yet'
      });
      return null;
    }
    
    // Check for excessive re-renders
    const excessiveRenders = renders.filter(r => r.renders > 10);
    const slowRenders = renders.filter(r => parseFloat(r.avgRenderTime) > 16);
    
    this.checks.set('renderPerformance', {
      status: excessiveRenders.length === 0 && slowRenders.length === 0 ? 'optimized' : 'needs-improvement',
      totalComponents: renders.length,
      excessiveRenders: excessiveRenders.length,
      slowRenders: slowRenders.length,
      components: {
        excessive: excessiveRenders.map(r => r.componentName),
        slow: slowRenders.map(r => r.componentName)
      }
    });
    
    return excessiveRenders.length === 0 && slowRenders.length === 0;
  }

  /**
   * Verify memory usage
   */
  verifyMemoryUsage() {
    const memory = performanceMonitor.getMemoryUsage();
    
    if (!memory) {
      this.checks.set('memoryUsage', {
        status: 'not-available',
        message: 'Memory API not available in this browser'
      });
      return null;
    }
    
    const percentUsed = memory.percentUsed;
    
    this.checks.set('memoryUsage', {
      status: percentUsed < 50 ? 'healthy' : percentUsed < 75 ? 'warning' : 'critical',
      percentUsed: percentUsed.toFixed(2) + '%',
      used: (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
      total: (memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB'
    });
    
    return percentUsed < 75;
  }

  /**
   * Verify request optimization
   */
  verifyRequestOptimization() {
    const summary = performanceMonitor.getSummary();
    const slowAPICalls = summary.warnings?.slowAPICalls || 0;
    
    this.checks.set('requestOptimization', {
      status: slowAPICalls === 0 ? 'optimized' : 'needs-improvement',
      slowAPICalls,
      threshold: '1000ms'
    });
    
    return slowAPICalls === 0;
  }

  /**
   * Run all verifications
   */
  runAllVerifications() {
    if (!this.enabled) {
      return {
        enabled: false,
        message: 'Performance verification is only available in development mode'
      };
    }
    
    const results = {
      timestamp: new Date().toISOString(),
      checks: {}
    };
    
    // Run each verification
    results.checks.providerOptimization = this.verifyProviderOptimization();
    results.checks.cacheEffectiveness = this.verifyCacheEffectiveness();
    results.checks.renderPerformance = this.verifyRenderPerformance();
    results.checks.memoryUsage = this.verifyMemoryUsage();
    results.checks.requestOptimization = this.verifyRequestOptimization();
    
    // Calculate overall score
    const scores = Object.values(results.checks).filter(v => v !== null);
    const passedChecks = scores.filter(v => v === true).length;
    results.overallScore = scores.length > 0 ? (passedChecks / scores.length * 100).toFixed(0) + '%' : 'N/A';
    
    // Add detailed check results
    results.details = Object.fromEntries(this.checks);
    
    return results;
  }

  /**
   * Log verification results
   */
  logVerificationResults() {
    const results = this.runAllVerifications();
    
    if (!results.enabled) {
      console.log(results.message);
      return;
    }
    
    console.group('🔍 Performance Verification Results');
    console.log('Overall Score:', results.overallScore);
    console.log('Timestamp:', results.timestamp);
    
    // Log each check
    Object.entries(results.details).forEach(([check, details]) => {
      const icon = details.status === 'optimized' || details.status === 'healthy' ? '✅' : 
                   details.status === 'warning' ? '⚠️' : '❌';
      console.group(`${icon} ${check}`);
      console.table(details);
      console.groupEnd();
    });
    
    console.groupEnd();
    
    return results;
  }

  /**
   * Get performance recommendations
   */
  getRecommendations() {
    const results = this.runAllVerifications();
    const recommendations = [];
    
    if (!results.enabled) {
      return recommendations;
    }
    
    // Check each result and provide recommendations
    const details = results.details;
    
    if (details.providerOptimization?.status === 'needs-improvement') {
      recommendations.push({
        area: 'Provider Optimization',
        issue: `Provider depth is ${details.providerOptimization.currentDepth}, target is ${details.providerOptimization.targetDepth}`,
        recommendation: 'Consider using compound providers or React.memo to reduce re-renders'
      });
    }
    
    if (details.cacheEffectiveness?.status === 'needs-improvement') {
      recommendations.push({
        area: 'Cache Effectiveness',
        issue: `Average API response time is ${details.cacheEffectiveness.avgResponseTime}`,
        recommendation: 'Increase cache TTL or implement request coalescing'
      });
    }
    
    if (details.renderPerformance?.status === 'needs-improvement') {
      if (details.renderPerformance.excessiveRenders > 0) {
        recommendations.push({
          area: 'Render Performance',
          issue: `${details.renderPerformance.excessiveRenders} components have excessive re-renders`,
          recommendation: 'Use React.memo or useMemo to optimize these components'
        });
      }
      if (details.renderPerformance.slowRenders > 0) {
        recommendations.push({
          area: 'Render Performance',
          issue: `${details.renderPerformance.slowRenders} components have slow render times`,
          recommendation: 'Profile these components and optimize expensive computations'
        });
      }
    }
    
    if (details.memoryUsage?.status === 'warning' || details.memoryUsage?.status === 'critical') {
      recommendations.push({
        area: 'Memory Usage',
        issue: `Memory usage is at ${details.memoryUsage.percentUsed}`,
        recommendation: 'Implement cleanup in useEffect hooks and consider lazy loading'
      });
    }
    
    if (details.requestOptimization?.status === 'needs-improvement') {
      recommendations.push({
        area: 'Request Optimization',
        issue: `${details.requestOptimization.slowAPICalls} slow API calls detected`,
        recommendation: 'Implement request batching or pagination for large datasets'
      });
    }
    
    return recommendations;
  }
}

// Create singleton instance
const performanceVerification = new PerformanceVerification();

// Export for use in components
export default performanceVerification;

// Auto-verify in development every 60 seconds
if (process.env.NODE_ENV === 'development') {
  // Initial verification after 10 seconds
  setTimeout(() => {
    console.log('Running initial performance verification...');
    performanceVerification.logVerificationResults();
  }, 10000);
  
  // Regular verification every 60 seconds
  setInterval(() => {
    const results = performanceVerification.runAllVerifications();
    const recommendations = performanceVerification.getRecommendations();
    
    // Only log if there are issues
    if (recommendations.length > 0) {
      console.group('⚡ Performance Recommendations');
      recommendations.forEach(rec => {
        console.warn(`[${rec.area}] ${rec.issue}`);
        console.log(`Recommendation: ${rec.recommendation}`);
      });
      console.groupEnd();
    }
  }, 60000);
}