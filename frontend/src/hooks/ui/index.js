/**
 * UI Utility Hooks Module
 *
 * Hooks for UI utilities, performance, and user experience.
 *
 * @module hooks/ui
 */

// Timing and debouncing
export { default as useDebounce } from './useDebounce';
export { default as useTimeout } from './useTimeout';

// Responsive and layout
export { default as useResponsive } from './useResponsive';
export { default as useClinicalSpacing } from './useClinicalSpacing';
export { default as useThemeDensity } from './useThemeDensity';

// Navigation and interaction
export { default as useKeyboardNavigation } from './useKeyboardNavigation';
export { default as usePageTransition } from './usePageTransition';

// Notifications and feedback
export { default as useNotifications } from './useNotifications';

// Performance and loading
export { default as useProgressiveLoading } from './useProgressiveLoading';
export { default as usePerformanceTracking } from './usePerformanceTracking';

// Utilities
export { default as useStableReferences } from './useStableReferences';
export { default as useMigrations } from './useMigrations';
