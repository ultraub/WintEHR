/**
 * useResponsive Hook
 * Provides responsive utilities and breakpoint detection for mobile-first design
 */
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { BREAKPOINTS } from '../../components/clinical/theme/clinicalThemeConstants';

export const useResponsive = () => {
  const theme = useTheme();
  
  // Breakpoint detection
  const isXs = useMediaQuery(theme.breakpoints.only('xs'));
  const isSm = useMediaQuery(theme.breakpoints.only('sm'));
  const isMd = useMediaQuery(theme.breakpoints.only('md'));
  const isLg = useMediaQuery(theme.breakpoints.only('lg'));
  const isXl = useMediaQuery(theme.breakpoints.only('xl'));
  
  // Common responsive patterns
  const isMobile = useMediaQuery(theme.breakpoints.down('sm')); // xs
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md')); // sm to md
  const isDesktop = useMediaQuery(theme.breakpoints.up('md')); // md and up
  const isLargeDesktop = useMediaQuery(theme.breakpoints.up('lg')); // lg and up
  
  // Orientation detection
  const isPortrait = useMediaQuery('(orientation: portrait)');
  const isLandscape = useMediaQuery('(orientation: landscape)');
  
  // High DPI detection
  const isRetina = useMediaQuery('(-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)');
  
  // Touch device detection
  const isTouchDevice = useMediaQuery('(hover: none) and (pointer: coarse)');
  
  // Responsive value helper
  const getResponsiveValue = (values) => {
    if (typeof values === 'object' && !Array.isArray(values)) {
      // Return the most specific value based on current breakpoint
      if (isXl && values.xl !== undefined) return values.xl;
      if (isLg && values.lg !== undefined) return values.lg;
      if (isMd && values.md !== undefined) return values.md;
      if (isSm && values.sm !== undefined) return values.sm;
      if (isXs && values.xs !== undefined) return values.xs;
      
      // Fallback to default or first available value
      return values.default || values.xs || Object.values(values)[0];
    }
    return values;
  };
  
  // Responsive styles helper
  const sx = (styles) => {
    if (typeof styles === 'function') {
      return styles({
        isXs,
        isSm,
        isMd,
        isLg,
        isXl,
        isMobile,
        isTablet,
        isDesktop,
        isLargeDesktop,
        isPortrait,
        isLandscape,
        isTouchDevice,
      });
    }
    return styles;
  };
  
  // Common responsive patterns
  const patterns = {
    // Container widths
    container: {
      width: '100%',
      maxWidth: {
        xs: '100%',
        sm: theme.breakpoints.values.sm,
        md: theme.breakpoints.values.md,
        lg: theme.breakpoints.values.lg,
        xl: theme.breakpoints.values.xl,
      },
      mx: 'auto',
      px: {
        xs: 2,
        sm: 3,
        md: 4,
      },
    },
    
    // Grid layouts
    gridColumns: {
      xs: 1,
      sm: 2,
      md: 3,
      lg: 4,
    },
    
    // Typography scaling
    responsiveText: {
      h1: {
        fontSize: {
          xs: '2rem',
          sm: '2.5rem',
          md: '3rem',
          lg: '3.5rem',
        },
      },
      h2: {
        fontSize: {
          xs: '1.5rem',
          sm: '1.75rem',
          md: '2rem',
          lg: '2.25rem',
        },
      },
      body1: {
        fontSize: {
          xs: '0.875rem',
          sm: '1rem',
        },
      },
    },
    
    // Spacing patterns
    responsiveSpacing: {
      section: {
        py: {
          xs: 4,
          sm: 6,
          md: 8,
          lg: 10,
        },
      },
      card: {
        p: {
          xs: 2,
          sm: 2.5,
          md: 3,
        },
      },
    },
    
    // Layout patterns
    stack: {
      flexDirection: {
        xs: 'column',
        sm: 'row',
      },
      gap: {
        xs: 2,
        sm: 3,
      },
    },
    
    // Hide/show patterns
    hideOnMobile: {
      display: {
        xs: 'none',
        sm: 'block',
      },
    },
    hideOnDesktop: {
      display: {
        xs: 'block',
        md: 'none',
      },
    },
    showOnlyOnMobile: {
      display: {
        xs: 'block',
        sm: 'none',
      },
    },
  };
  
  return {
    // Breakpoint booleans
    isXs,
    isSm,
    isMd,
    isLg,
    isXl,
    
    // Common patterns
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    
    // Device characteristics
    isPortrait,
    isLandscape,
    isRetina,
    isTouchDevice,
    
    // Utilities
    getResponsiveValue,
    sx,
    patterns,
    
    // Current breakpoint
    currentBreakpoint: isXl ? 'xl' : isLg ? 'lg' : isMd ? 'md' : isSm ? 'sm' : 'xs',
  };
};

export default useResponsive;