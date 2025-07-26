/**
 * Clinical Shared Components
 * Export all shared clinical UI components from a single location
 */

// Card Components
export * from './cards';

// Dialog Components
export * from './dialogs';

// Table Components
export * from './tables';

// Input Components
export * from './inputs';

// Display Components
export * from './display';

// Layout Components
export * from './layout';

// Core Components (remain in root for backward compatibility)
export { default as ClinicalSummaryCard } from './ClinicalSummaryCard';
export { default as ClinicalFilterPanel } from './ClinicalFilterPanel';
export { default as ClinicalDataGrid } from './ClinicalDataGrid';
export { default as ClinicalEmptyState } from './ClinicalEmptyState';
export { default as ClinicalLoadingState } from './ClinicalLoadingState';

// Export all templates
export * from './templates';

// Re-export component presets for convenience
export const EmptyStatePresets = {
  noData: {
    title: 'No data available',
    message: 'There are no records to display at this time.'
  },
  noSearchResults: {
    title: 'No results found',
    message: 'Try adjusting your search criteria or clearing filters.'
  },
  noFilterResults: {
    title: 'No matching records',
    message: 'No records match the current filter criteria.'
  },
  error: {
    title: 'Unable to load data',
    message: 'An error occurred while loading the data. Please try again.',
    severity: 'error'
  },
  noPermission: {
    title: 'Access restricted',
    message: 'You do not have permission to view this data.',
    severity: 'warning'
  }
};