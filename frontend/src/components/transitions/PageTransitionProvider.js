/**
 * PageTransitionProvider Component
 * Provides smooth page transitions for route changes with support for different animation types
 * 
 * @since 2025-01-21
 */
import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Fade, Slide, Zoom, Grow } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

// Create context for transition state
const PageTransitionContext = createContext();

export const usePageTransition = () => {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within PageTransitionProvider');
  }
  return context;
};

// Transition types
const TRANSITION_TYPES = {
  FADE: 'fade',
  SLIDE_LEFT: 'slide-left',
  SLIDE_RIGHT: 'slide-right',
  SLIDE_UP: 'slide-up',
  ZOOM: 'zoom',
  GROW: 'grow'
};

// Transition durations (ms)
const TRANSITION_DURATIONS = {
  FAST: 200,
  NORMAL: 300,
  SLOW: 500
};

// Route hierarchy for determining transition direction
const ROUTE_HIERARCHY = {
  '/patients': 1,
  '/patients/:id': 2,
  '/patients/:id/clinical': 3,
  '/dashboard': 1,
  '/analytics': 1,
  '/settings': 1,
};

const PageTransitionProvider = ({ 
  children, 
  defaultTransition = TRANSITION_TYPES.FADE,
  duration = TRANSITION_DURATIONS.NORMAL,
  enableReducedMotion = true 
}) => {
  const location = useLocation();
  const theme = useTheme();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState('enter');
  const [transitionType, setTransitionType] = useState(defaultTransition);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousLocation = useRef(location);

  // Check for reduced motion preference
  const prefersReducedMotion = enableReducedMotion && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Determine transition type based on route change
  const getTransitionType = (from, to) => {
    // If reduced motion is preferred, always use fade
    if (prefersReducedMotion) {
      return TRANSITION_TYPES.FADE;
    }

    // Extract base paths for comparison
    const fromBase = from.pathname.split('/')[1];
    const toBase = to.pathname.split('/')[1];

    // Same base route - use fade
    if (fromBase === toBase) {
      return TRANSITION_TYPES.FADE;
    }

    // Check hierarchy for slide direction
    const fromLevel = getRouteLevel(from.pathname);
    const toLevel = getRouteLevel(to.pathname);

    if (fromLevel < toLevel) {
      return TRANSITION_TYPES.SLIDE_LEFT;
    } else if (fromLevel > toLevel) {
      return TRANSITION_TYPES.SLIDE_RIGHT;
    }

    // Default to fade for same-level navigation
    return TRANSITION_TYPES.FADE;
  };

  // Get route hierarchy level
  const getRouteLevel = (pathname) => {
    for (const [pattern, level] of Object.entries(ROUTE_HIERARCHY)) {
      if (pathname.match(new RegExp(pattern.replace(/:id/g, '[^/]+')))) {
        return level;
      }
    }
    return 1; // Default level
  };

  // Handle location change
  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      const transition = getTransitionType(previousLocation.current, location);
      setTransitionType(transition);
      setIsTransitioning(true);
      setTransitionStage('exit');

      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setTransitionStage('enter');
        previousLocation.current = location;

        setTimeout(() => {
          setIsTransitioning(false);
        }, duration);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [location, displayLocation, duration]);

  // Render transition wrapper based on type
  const renderTransition = () => {
    const content = (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          position: transitionStage === 'exit' ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          zIndex: transitionStage === 'exit' ? 1 : 2,
        }}
      >
        {React.Children.map(children, child =>
          React.cloneElement(child, { location: displayLocation })
        )}
      </Box>
    );

    // Reduced motion - always use fade
    if (prefersReducedMotion || transitionType === TRANSITION_TYPES.FADE) {
      return (
        <Fade
          in={transitionStage === 'enter'}
          timeout={duration}
          style={{ width: '100%', height: '100%' }}
        >
          {content}
        </Fade>
      );
    }

    // Slide transitions
    if (transitionType.startsWith('slide-')) {
      const direction = transitionType.split('-')[1];
      return (
        <Slide
          direction={direction}
          in={transitionStage === 'enter'}
          timeout={duration}
          style={{ width: '100%', height: '100%' }}
        >
          {content}
        </Slide>
      );
    }

    // Zoom transition
    if (transitionType === TRANSITION_TYPES.ZOOM) {
      return (
        <Zoom
          in={transitionStage === 'enter'}
          timeout={duration}
          style={{ width: '100%', height: '100%' }}
        >
          {content}
        </Zoom>
      );
    }

    // Grow transition
    if (transitionType === TRANSITION_TYPES.GROW) {
      return (
        <Grow
          in={transitionStage === 'enter'}
          timeout={duration}
          style={{ width: '100%', height: '100%' }}
        >
          {content}
        </Grow>
      );
    }

    // Fallback to no transition
    return content;
  };

  // Loading overlay during transitions
  const loadingOverlay = isTransitioning && (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.dark, 0.05)} 100%)`,
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: transitionStage === 'exit' ? 1 : 0,
        transition: `opacity ${duration}ms ease-in-out`,
      }}
    />
  );

  const contextValue = {
    isTransitioning,
    transitionType,
    transitionStage,
    duration,
    setTransitionType,
  };

  return (
    <PageTransitionContext.Provider value={contextValue}>
      <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        {renderTransition()}
        {loadingOverlay}
      </Box>
    </PageTransitionContext.Provider>
  );
};

// HOC for wrapping individual routes with transitions
export const withPageTransition = (Component, options = {}) => {
  return (props) => (
    <PageTransitionProvider {...options}>
      <Component {...props} />
    </PageTransitionProvider>
  );
};

// Preset transition configurations
export const transitionPresets = {
  clinical: {
    defaultTransition: TRANSITION_TYPES.FADE,
    duration: TRANSITION_DURATIONS.FAST,
    enableReducedMotion: true
  },
  dashboard: {
    defaultTransition: TRANSITION_TYPES.SLIDE_LEFT,
    duration: TRANSITION_DURATIONS.NORMAL,
    enableReducedMotion: true
  },
  settings: {
    defaultTransition: TRANSITION_TYPES.ZOOM,
    duration: TRANSITION_DURATIONS.NORMAL,
    enableReducedMotion: true
  }
};

export { TRANSITION_TYPES, TRANSITION_DURATIONS };
export default PageTransitionProvider;