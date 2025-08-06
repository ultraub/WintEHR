/**
 * Clinical Theme Constants
 * Centralized design tokens for consistent UI across the clinical workspace
 */

// Layout Heights
export const LAYOUT_HEIGHTS = {
  appBar: 64,
  tabs: 48,
  patientHeader: 'auto', // Flexible based on content
  breadcrumbs: 40,
  footer: 56,
};

// Spacing Scale (based on 8px grid system)
export const SPACING = {
  // Base unit
  unit: 8,
  
  // Numeric scale (multiplier of base unit)
  0: 0,           // 0px
  0.5: 4,         // 4px
  1: 8,           // 8px
  1.5: 12,        // 12px
  2: 16,          // 16px
  2.5: 20,        // 20px
  3: 24,          // 24px
  4: 32,          // 32px
  5: 40,          // 40px
  6: 48,          // 48px
  8: 64,          // 64px
  10: 80,         // 80px
  12: 96,         // 96px
  16: 128,        // 128px
  
  // Semantic aliases
  none: 0,
  xs: 4,          // Extra small
  sm: 8,          // Small  
  md: 16,         // Medium
  lg: 24,         // Large
  xl: 32,         // Extra large
  xxl: 48,        // Extra extra large
  
  // Component-specific spacing
  card: {
    padding: 16,
    gap: 12,
  },
  section: {
    padding: 24,
    gap: 16,
  },
  page: {
    padding: 24,
    mobilePadding: 16,
  },
  form: {
    fieldGap: 16,
    sectionGap: 24,
  },
  table: {
    cellPadding: 16,
    compactCellPadding: 8,
  },
  dialog: {
    padding: 24,
    actionsGap: 8,
  },
  list: {
    itemPadding: 12,
    itemGap: 8,
  },
};

// Z-index Scale
export const Z_INDEX = {
  mobileStepper: 1000,
  fab: 1050,
  speedDial: 1050,
  appBar: 1100,
  drawer: 1200,
  modal: 1300,
  snackbar: 1400,
  tooltip: 1500,
  // Custom clinical components
  clinicalOverlay: 1250,
  clinicalDialog: 1350,
  clinicalNotification: 1450,
};

// Breakpoints (matching MUI defaults but explicit for clarity)
export const BREAKPOINTS = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536,
};

// Responsive Values Helper
export const responsive = (xs, sm, md, lg, xl) => ({
  xs,
  sm: sm ?? xs,
  md: md ?? sm ?? xs,
  lg: lg ?? md ?? sm ?? xs,
  xl: xl ?? lg ?? md ?? sm ?? xs,
});

// Common Border Radius
export const BORDER_RADIUS = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 9999,
};

// Shadow Depths
export const SHADOWS = {
  xs: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
  sm: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)',
  md: '0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)',
  lg: '0 14px 28px rgba(0,0,0,0.25), 0 10px 10px rgba(0,0,0,0.22)',
  xl: '0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22)',
};

// Animation Durations
export const TRANSITIONS = {
  shortest: 150,
  shorter: 200,
  short: 250,
  standard: 300,
  complex: 375,
  enteringScreen: 225,
  leavingScreen: 195,
};

// Touch Target Sizes (for accessibility)
export const TOUCH_TARGET = {
  minimum: 44, // iOS Human Interface Guidelines
  recommended: 48, // Material Design Guidelines
};

// Clinical-specific Constants
export const CLINICAL_CONSTANTS = {
  // Status Colors (to be used with theme palette)
  statusColors: {
    active: 'success',
    inactive: 'default',
    pending: 'warning',
    critical: 'error',
    completed: 'success',
  },
  
  // Severity Levels
  severityLevels: {
    low: 'info',
    medium: 'warning',
    high: 'error',
    critical: 'error',
  },
  
  // Common Widths
  sidebarWidth: {
    collapsed: 64,
    expanded: 240,
  },
  
  // Table Densities
  tableDensity: {
    compact: {
      rowHeight: 36,
      headerHeight: 40,
    },
    comfortable: {
      rowHeight: 52,
      headerHeight: 56,
    },
    spacious: {
      rowHeight: 68,
      headerHeight: 72,
    },
  },
};

// Responsive Helpers
export const isSmallScreen = (width) => width < BREAKPOINTS.md;
export const isMediumScreen = (width) => width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
export const isLargeScreen = (width) => width >= BREAKPOINTS.lg;

// Spacing Helpers
export const spacing = (value) => {
  // If numeric, use as multiplier of base unit
  if (typeof value === 'number') {
    return value * SPACING.unit;
  }
  // If string, look up in SPACING object
  if (typeof value === 'string') {
    // Check component-specific spacing first
    if (value.includes('.')) {
      const [component, property] = value.split('.');
      return SPACING[component]?.[property] || 0;
    }
    // Then check main spacing scale
    return SPACING[value] || 0;
  }
  return 0;
};

// Convert to pixels with unit
export const px = (value) => `${value}px`;

// Get spacing with px unit
export const spacingPx = (value) => px(spacing(value));

// Media Query Helpers
export const mediaQuery = {
  up: (breakpoint) => `@media (min-width: ${BREAKPOINTS[breakpoint]}px)`,
  down: (breakpoint) => `@media (max-width: ${BREAKPOINTS[breakpoint] - 1}px)`,
  between: (start, end) => `@media (min-width: ${BREAKPOINTS[start]}px) and (max-width: ${BREAKPOINTS[end] - 1}px)`,
  only: (breakpoint) => {
    const keys = Object.keys(BREAKPOINTS);
    const index = keys.indexOf(breakpoint);
    const nextBreakpoint = keys[index + 1];
    
    if (index === keys.length - 1) {
      return mediaQuery.up(breakpoint);
    }
    
    return mediaQuery.between(breakpoint, nextBreakpoint);
  },
};

// Export all constants as default for easy importing
export default {
  LAYOUT_HEIGHTS,
  SPACING,
  Z_INDEX,
  BREAKPOINTS,
  BORDER_RADIUS,
  SHADOWS,
  TRANSITIONS,
  TOUCH_TARGET,
  CLINICAL_CONSTANTS,
  responsive,
  isSmallScreen,
  isMediumScreen,
  isLargeScreen,
  spacing,
  px,
  mediaQuery,
};