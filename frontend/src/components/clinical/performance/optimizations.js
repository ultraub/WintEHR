/**
 * Performance Optimizations for Clinical Workspace
 * Part of the Clinical UI Improvements Initiative
 * 
 * This file contains performance optimization utilities and configurations
 * to ensure smooth operation of the clinical workspace
 */

import React, { lazy } from 'react';

// Lazy loading configuration for tab components
export const lazyLoadTabs = {
  SummaryTab: lazy(() => import(
    /* webpackChunkName: "summary-tab" */
    /* webpackPreload: true */
    '../workspace/tabs/SummaryTab'
  )),
  
  ChartReviewTab: lazy(() => import(
    /* webpackChunkName: "chart-review-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/ChartReviewTabOptimized'
  )),
  
  EncountersTab: lazy(() => import(
    /* webpackChunkName: "encounters-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/EncountersTab'
  )),
  
  ResultsTab: lazy(() => import(
    /* webpackChunkName: "results-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/ResultsTabOptimized'
  )),
  
  OrdersTab: lazy(() => import(
    /* webpackChunkName: "orders-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/EnhancedOrdersTab'
  )),
  
  PharmacyTab: lazy(() => import(
    /* webpackChunkName: "pharmacy-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/PharmacyTab'
  )),
  
  ImagingTab: lazy(() => import(
    /* webpackChunkName: "imaging-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/ImagingTab'
  )),
  
  DocumentationTab: lazy(() => import(
    /* webpackChunkName: "documentation-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/DocumentationTabEnhanced'
  )),
  
  CarePlanTab: lazy(() => import(
    /* webpackChunkName: "care-plan-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/CarePlanTabEnhanced'
  )),
  
  TimelineTab: lazy(() => import(
    /* webpackChunkName: "timeline-tab" */
    /* webpackPrefetch: true */
    '../workspace/tabs/TimelineTabRedesigned'
  ))
};

// Resource loading priorities
export const RESOURCE_PRIORITIES = {
  critical: ['Patient', 'Encounter', 'Condition', 'MedicationRequest'],
  important: ['Observation', 'DiagnosticReport', 'AllergyIntolerance', 'Immunization'],
  optional: ['DocumentReference', 'CarePlan', 'CareTeam', 'Coverage', 'Goal']
};

// Performance monitoring utilities
export const performanceMonitor = {
  // Mark the start of a performance measurement
  mark: (name) => {
    if (window.performance && window.performance.mark) {
      window.performance.mark(name);
    }
  },
  
  // Measure time between two marks
  measure: (name, startMark, endMark) => {
    if (window.performance && window.performance.measure) {
      try {
        window.performance.measure(name, startMark, endMark);
        const measure = window.performance.getEntriesByName(name)[0];
        console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
        return measure.duration;
      } catch (e) {
        console.error('[Performance] Measurement error:', e);
      }
    }
    return null;
  },
  
  // Clear performance entries
  clear: () => {
    if (window.performance && window.performance.clearMarks) {
      window.performance.clearMarks();
      window.performance.clearMeasures();
    }
  }
};

// Debounce utility for search and filter operations
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle utility for scroll and resize events
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Virtual scrolling configuration
export const virtualScrollConfig = {
  itemHeight: 64, // Height of each item in pixels
  overscan: 3, // Number of items to render outside viewport
  scrollDebounceMs: 50, // Debounce scroll events
  
  // Calculate visible items
  calculateVisibleItems: (scrollTop, containerHeight, items) => {
    const startIndex = Math.floor(scrollTop / virtualScrollConfig.itemHeight);
    const endIndex = Math.ceil((scrollTop + containerHeight) / virtualScrollConfig.itemHeight);
    
    const visibleStartIndex = Math.max(0, startIndex - virtualScrollConfig.overscan);
    const visibleEndIndex = Math.min(items.length - 1, endIndex + virtualScrollConfig.overscan);
    
    return {
      startIndex: visibleStartIndex,
      endIndex: visibleEndIndex,
      offsetY: visibleStartIndex * virtualScrollConfig.itemHeight
    };
  }
};

// Image optimization utilities
export const imageOptimization = {
  // Generate srcset for responsive images
  generateSrcSet: (baseUrl, sizes = [320, 640, 1024]) => {
    return sizes.map(size => `${baseUrl}?w=${size} ${size}w`).join(', ');
  },
  
  // Lazy load images using Intersection Observer
  lazyLoadImages: (selector = 'img[data-lazy]') => {
    if ('IntersectionObserver' in window) {
      const images = document.querySelectorAll(selector);
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.add('loaded');
            imageObserver.unobserve(img);
          }
        });
      });
      
      images.forEach(img => imageObserver.observe(img));
      
      return () => {
        images.forEach(img => imageObserver.unobserve(img));
      };
    }
  }
};

// Memoization utilities
export const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
};

// Batch updates for React
export const batchUpdates = (updates) => {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    window.requestIdleCallback(() => {
      updates();
    });
  } else {
    setTimeout(updates, 0);
  }
};

// Preload critical resources
export const preloadResources = () => {
  // Preload critical fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.href = '/fonts/roboto-regular.woff2';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);
  
  // Preload critical CSS
  const cssLink = document.createElement('link');
  cssLink.rel = 'preload';
  cssLink.as = 'style';
  cssLink.href = '/css/clinical-critical.css';
  document.head.appendChild(cssLink);
};

// Service Worker registration for offline support
export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        registration => {
          console.log('ServiceWorker registered:', registration);
        },
        error => {
          console.log('ServiceWorker registration failed:', error);
        }
      );
    });
  }
};

// Memory leak prevention utilities
export const memoryCleanup = {
  // Clear unused references
  clearReferences: (refs) => {
    Object.keys(refs).forEach(key => {
      refs[key] = null;
    });
  },
  
  // Remove event listeners
  removeListeners: (element, events) => {
    events.forEach(({ event, handler }) => {
      element.removeEventListener(event, handler);
    });
  },
  
  // Cancel pending requests
  cancelRequests: (controllers) => {
    controllers.forEach(controller => {
      if (controller && typeof controller.abort === 'function') {
        controller.abort();
      }
    });
  }
};

// Render optimization hooks
export const useRenderOptimization = () => {
  const renderCount = React.useRef(0);
  
  React.useEffect(() => {
    renderCount.current += 1;
    if (renderCount.current > 50) {
      console.warn('[Performance] Component rendered more than 50 times. Consider optimization.');
    }
  });
  
  return {
    renderCount: renderCount.current
  };
};

// Export performance best practices
export const performanceBestPractices = {
  // Use React.memo for component memoization
  memoizeComponents: true,
  
  // Use useMemo for expensive computations
  memoizeComputations: true,
  
  // Use useCallback for event handlers
  memoizeCallbacks: true,
  
  // Lazy load non-critical components
  lazyLoadNonCritical: true,
  
  // Virtualize long lists
  virtualizeLongLists: true,
  
  // Debounce search inputs
  debounceSearchInputs: 300, // ms
  
  // Throttle scroll events
  throttleScrollEvents: 100, // ms
  
  // Batch DOM updates
  batchDOMUpdates: true,
  
  // Use CSS containment
  useCSSContainment: true,
  
  // Optimize images
  optimizeImages: true,
  
  // Use web workers for heavy computations
  useWebWorkers: true,
  
  // Enable production build optimizations
  productionOptimizations: {
    minify: true,
    treeshake: true,
    splitChunks: true,
    compression: true
  }
};

export default {
  lazyLoadTabs,
  RESOURCE_PRIORITIES,
  performanceMonitor,
  debounce,
  throttle,
  virtualScrollConfig,
  imageOptimization,
  memoize,
  batchUpdates,
  preloadResources,
  registerServiceWorker,
  memoryCleanup,
  useRenderOptimization,
  performanceBestPractices
};