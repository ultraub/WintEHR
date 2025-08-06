/**
 * Shared Layout Components Export
 */
export { default as CompactPatientHeader } from './CompactPatientHeader';
export { default as QuickActionsBar } from './QuickActionsBar';
export { default as DensityControl } from './DensityControl';
export { ContextualFAB } from './QuickActionFAB'; // Note: exported as ContextualFAB

// Export useDensity hook from DensityControl
export { useDensity } from './DensityControl';

// ViewControls is likely DensityControl, export it as an alias
export { default as ViewControls } from './DensityControl';