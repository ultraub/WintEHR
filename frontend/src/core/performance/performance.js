/**
 * Performance Optimization Utilities
 * Tools for improving React performance and user experience
 */
import { memo, useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { debounce, throttle } from 'lodash';

/**
 * Higher-order component for memoizing components with deep comparison
 */
export const withMemoization = (Component, compareProps = null) => {
  return memo(Component, compareProps);
};

/**
 * Custom hook for debounced values
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Custom hook for throttled callbacks
 */
export const useThrottle = (callback, delay) => {
  const throttledCallback = useMemo(
    () => throttle(callback, delay),
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      throttledCallback.cancel();
    };
  }, [throttledCallback]);

  return throttledCallback;
};

/**
 * Virtual scrolling hook for large lists
 */
export const useVirtualScroll = ({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef();

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    items.length - 1
  );

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length - 1, visibleEnd + overscan);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1).map((item, index) => ({
      ...item,
      index: startIndex + index
    }));
  }, [items, startIndex, endIndex]);

  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    scrollElementRef,
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll
  };
};

/**
 * Intersection Observer hook for lazy loading
 */
export const useIntersectionObserver = (options = {}) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef();

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isCurrentlyIntersecting = entry.isIntersecting;
        setIsIntersecting(isCurrentlyIntersecting);
        
        if (isCurrentlyIntersecting && !hasIntersected) {
          setHasIntersected(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px',
        ...options
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [hasIntersected, options]);

  return {
    elementRef,
    isIntersecting,
    hasIntersected
  };
};

/**
 * Performance monitoring hook
 */
export const usePerformanceMonitor = (componentName) => {
  const renderCount = useRef(0);
  const startTime = useRef(Date.now());
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    totalTime: 0
  });

  useEffect(() => {
    renderCount.current += 1;
    const currentTime = Date.now();
    const renderTime = currentTime - startTime.current;
    
    setMetrics(prev => {
      const newRenderCount = renderCount.current;
      const newTotalTime = prev.totalTime + renderTime;
      return {
        renderCount: newRenderCount,
        averageRenderTime: newTotalTime / newRenderCount,
        totalTime: newTotalTime
      };
    });

    startTime.current = currentTime;

    if (process.env.NODE_ENV === 'development') {
      
    }
  });

  return metrics;
};

/**
 * Image lazy loading hook with progressive enhancement
 */
export const useLazyImage = (src, placeholder = null) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const { elementRef, isIntersecting } = useIntersectionObserver();

  useEffect(() => {
    if (isIntersecting && src && !isLoaded && !isError) {
      const img = new Image();
      
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
      };
      
      img.onerror = () => {
        setIsError(true);
      };
      
      img.src = src;
    }
  }, [isIntersecting, src, isLoaded, isError]);

  return {
    elementRef,
    imageSrc,
    isLoaded,
    isError
  };
};

/**
 * Resource preloader for critical assets
 */
export const useResourcePreloader = (resources = []) => {
  const [loadedResources, setLoadedResources] = useState(new Set());
  const [failedResources, setFailedResources] = useState(new Set());

  useEffect(() => {
    const preloadResource = (resource) => {
      return new Promise((resolve, reject) => {
        if (resource.type === 'image') {
          const img = new Image();
          img.onload = () => resolve(resource.url);
          img.onerror = () => reject(resource.url);
          img.src = resource.url;
        } else if (resource.type === 'font') {
          const font = new FontFace(resource.family, `url(${resource.url})`);
          font.load()
            .then(() => {
              document.fonts.add(font);
              resolve(resource.url);
            })
            .catch(() => reject(resource.url));
        } else {
          // Generic resource loading
          fetch(resource.url)
            .then(() => resolve(resource.url))
            .catch(() => reject(resource.url));
        }
      });
    };

    const loadResources = async () => {
      for (const resource of resources) {
        try {
          await preloadResource(resource);
          setLoadedResources(prev => new Set([...prev, resource.url]));
        } catch (url) {
          setFailedResources(prev => new Set([...prev, url]));
        }
      }
    };

    if (resources.length > 0) {
      loadResources();
    }
  }, [resources]);

  return {
    loadedResources,
    failedResources,
    isResourceLoaded: (url) => loadedResources.has(url),
    isResourceFailed: (url) => failedResources.has(url)
  };
};

/**
 * Bundle splitting utility for code splitting
 */
export const createAsyncComponent = (importFunc, fallback = null) => {
  const LazyComponent = React.lazy(importFunc);
  
  return (props) => (
    <React.Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </React.Suspense>
  );
};

/**
 * Memory usage monitor (development only)
 */
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
      const updateMemoryInfo = () => {
        setMemoryInfo({
          usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
          totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
          jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
        });
      };

      updateMemoryInfo();
      const interval = setInterval(updateMemoryInfo, 5000);

      return () => clearInterval(interval);
    }
  }, []);

  return memoryInfo;
};

/**
 * Optimized data fetching hook with caching
 */
export const useOptimizedFetch = (url, options = {}) => {
  const cache = useRef(new Map());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    const cacheKey = `${url}_${JSON.stringify(options)}`;
    
    // Check cache first
    if (cache.current.has(cacheKey) && !options.forceRefresh) {
      const cachedData = cache.current.get(cacheKey);
      if (Date.now() - cachedData.timestamp < (options.cacheTime || 300000)) { // 5 min default
        setData(cachedData.data);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Cache the result
      cache.current.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};

/**
 * Performance timing utilities
 */
export const performanceTiming = {
  mark: (name) => {
    if ('performance' in window && 'mark' in performance) {
      performance.mark(name);
    }
  },

  measure: (name, startMark, endMark) => {
    if ('performance' in window && 'measure' in performance) {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name)[0];
      return measure ? measure.duration : 0;
    }
    return 0;
  },

  clearMarks: (name) => {
    if ('performance' in window && 'clearMarks' in performance) {
      performance.clearMarks(name);
    }
  },

  clearMeasures: (name) => {
    if ('performance' in window && 'clearMeasures' in performance) {
      performance.clearMeasures(name);
    }
  },

  getNavigationTiming: () => {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
        domInteractive: navigation?.domInteractive - navigation?.navigationStart,
        firstPaint: navigation?.responseEnd - navigation?.requestStart
      };
    }
    return null;
  }
};

/**
 * Component render optimization helpers
 */
export const optimizationHelpers = {
  // Shallow comparison for props
  shallowEqual: (obj1, obj2) => {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    for (let key of keys1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }

    return true;
  },

  // Deep comparison for complex objects (use sparingly)
  deepEqual: (obj1, obj2) => {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  },

  // Memoize expensive calculations
  memoize: (fn, getKey = (...args) => JSON.stringify(args)) => {
    const cache = new Map();
    
    return (...args) => {
      const key = getKey(...args);
      
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = fn(...args);
      cache.set(key, result);
      
      return result;
    };
  }
};

export default {
  useDebounce,
  useThrottle,
  useVirtualScroll,
  useIntersectionObserver,
  usePerformanceMonitor,
  useLazyImage,
  useResourcePreloader,
  useMemoryMonitor,
  useOptimizedFetch,
  performanceTiming,
  optimizationHelpers,
  withMemoization,
  createAsyncComponent
};