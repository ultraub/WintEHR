/**
 * usePageTransition Hook
 * Custom hook for managing page transitions with loading states and animations
 * 
 * @since 2025-01-21
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const usePageTransition = (options = {}) => {
  const {
    onTransitionStart,
    onTransitionEnd,
    delay = 0,
    preloadData = null,
    minTransitionTime = 300
  } = options;

  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextRoute, setNextRoute] = useState(null);
  const transitionStartTime = useRef(null);
  const transitionTimeoutRef = useRef(null);

  // Navigate with transition
  const navigateWithTransition = useCallback(async (path, options = {}) => {
    const {
      state,
      replace = false,
      skipTransition = false,
      preload = preloadData
    } = options;

    // Skip transition for same route
    if (path === location.pathname) {
      return;
    }

    // Skip transition if requested
    if (skipTransition) {
      navigate(path, { state, replace });
      return;
    }

    // Start transition
    setIsTransitioning(true);
    setNextRoute(path);
    transitionStartTime.current = Date.now();

    // Call transition start callback
    if (onTransitionStart) {
      onTransitionStart(location.pathname, path);
    }

    // Preload data if provided
    if (preload) {
      try {
        await preload(path);
      } catch (error) {
        console.error('Error preloading data:', error);
      }
    }

    // Ensure minimum transition time
    const elapsedTime = Date.now() - transitionStartTime.current;
    const remainingTime = Math.max(0, minTransitionTime - elapsedTime);

    // Add delay if specified
    const totalDelay = remainingTime + delay;

    transitionTimeoutRef.current = setTimeout(() => {
      navigate(path, { state, replace });
      
      // End transition after navigation
      setTimeout(() => {
        setIsTransitioning(false);
        setNextRoute(null);
        
        if (onTransitionEnd) {
          onTransitionEnd(location.pathname, path);
        }
      }, 100);
    }, totalDelay);
  }, [navigate, location.pathname, delay, preloadData, onTransitionStart, onTransitionEnd, minTransitionTime]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  // Programmatic back navigation with transition
  const goBackWithTransition = useCallback(async (options = {}) => {
    const { skipTransition = false } = options;

    if (skipTransition) {
      navigate(-1);
      return;
    }

    setIsTransitioning(true);
    
    if (onTransitionStart) {
      onTransitionStart(location.pathname, 'back');
    }

    setTimeout(() => {
      navigate(-1);
      
      setTimeout(() => {
        setIsTransitioning(false);
        
        if (onTransitionEnd) {
          onTransitionEnd(location.pathname, 'back');
        }
      }, 100);
    }, minTransitionTime);
  }, [navigate, location.pathname, onTransitionStart, onTransitionEnd, minTransitionTime]);

  // Instant navigation (no transition)
  const navigateInstant = useCallback((path, options = {}) => {
    navigate(path, options);
  }, [navigate]);

  // Get transition style based on theme
  const getTransitionStyle = useCallback((isEntering = true) => {
    const duration = theme.transitions?.duration?.standard || 300;
    const easing = theme.transitions?.easing?.easeInOut || 'ease-in-out';

    return {
      opacity: isEntering ? 1 : 0,
      transform: isEntering ? 'translateX(0)' : 'translateX(-20px)',
      transition: `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`,
      willChange: 'opacity, transform'
    };
  }, [theme]);

  // Loading placeholder style
  const getLoadingStyle = useCallback(() => {
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: theme.palette.mode === 'dark' 
        ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)'
        : 'linear-gradient(135deg, rgba(21, 101, 192, 0.05) 0%, rgba(13, 71, 161, 0.05) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    };
  }, [theme]);

  return {
    isTransitioning,
    nextRoute,
    navigateWithTransition,
    goBackWithTransition,
    navigateInstant,
    getTransitionStyle,
    getLoadingStyle,
    // Utility functions
    isNavigatingTo: (path) => nextRoute === path,
    isNavigatingFrom: (path) => isTransitioning && location.pathname === path,
  };
};

// Hook for route-level loading states
export const useRouteLoading = (routePath) => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingRef = useRef(null);

  useEffect(() => {
    // Simulate progressive loading
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [routePath]);

  const completeLoading = useCallback(() => {
    setLoadingProgress(100);
    setTimeout(() => {
      setIsLoading(false);
    }, 200);
  }, []);

  return {
    isLoading,
    loadingProgress,
    completeLoading,
    setIsLoading
  };
};

export default usePageTransition;