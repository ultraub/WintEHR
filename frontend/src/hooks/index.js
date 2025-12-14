/**
 * Hooks Module - Domain-Organized Hook Exports
 *
 * This module provides organized access to all custom hooks grouped by domain:
 *
 * - clinical: Tab filters, search, expandable lists, data export
 * - fhir: FHIR resource operations, validation, search
 * - patient: Patient data, chart review, clinical resources
 * - medication: Medication management, safety, dispensing
 * - provider: Provider directory and resolution
 * - cds: Clinical decision support hooks and actions
 * - search: Advanced search for orders and imaging
 * - ui: UI utilities, performance, navigation
 * - queries: React Query hooks for FHIR operations
 *
 * @module hooks
 *
 * @example
 * // Import from specific domain
 * import { usePatientData } from '@/hooks/patient';
 * import { useMedicationLists } from '@/hooks/medication';
 *
 * // Import from root (all hooks available)
 * import { usePatientData, useMedicationLists } from '@/hooks';
 *
 * // Import React Query hooks
 * import { useConditions, useCreateMedication } from '@/hooks/queries';
 */

// ============================================================================
// Clinical Domain
// ============================================================================
export {
  useTabFilters,
  useTabSearch,
  useExpandableList,
  useExportData,
} from './clinical';

// ============================================================================
// FHIR Domain
// ============================================================================
export {
  useFHIR,
  useFHIRResources,
  useFHIRValidation,
  useResourceSearch,
  usePaginatedObservations,
} from './fhir';

// ============================================================================
// Patient Domain
// ============================================================================
export {
  usePatientData,
  usePatientSearch,
  usePatientClinicalData,
  useOptimizedPatientData,
  useChartReviewResources,
  useClinicalResources,
  useFinancialResources,
} from './patient';

// ============================================================================
// Medication Domain
// ============================================================================
export {
  useMedicationAdministration,
  useMedicationCatalog,
  useMedicationDispense,
  useMedicationLists,
  useMedicationResolver,
  useDrugSafety,
} from './medication';

// ============================================================================
// Provider Domain
// ============================================================================
export {
  useProviderDirectory,
  useProviderResolver,
} from './provider';

// ============================================================================
// CDS Domain
// ============================================================================
export {
  useCDSHooks,
  useCDSActions,
} from './cds';

// ============================================================================
// Search Domain
// ============================================================================
export {
  useAdvancedImagingSearch,
  useAdvancedOrderSearch,
} from './search';

// ============================================================================
// UI Domain
// ============================================================================
export {
  useDebounce,
  useTimeout,
  useResponsive,
  useClinicalSpacing,
  useThemeDensity,
  useKeyboardNavigation,
  usePageTransition,
  useNotifications,
  useProgressiveLoading,
  usePerformanceTracking,
  useStableReferences,
  useMigrations,
} from './ui';

// ============================================================================
// React Query Hooks (re-export for convenience)
// ============================================================================
export * from './queries';
