/**
 * FHIR Context Barrel Export
 *
 * Centralized exports for all FHIR-related contexts.
 * This decomposition splits the original FHIRResourceContext into focused contexts:
 *
 * - FHIRCacheContext: Cache management and warm cache tracking
 * - FHIRDataContext: Resource storage and relationships
 * - FHIROperationsContext: FHIR API operations and request deduplication
 * - PatientContext: Patient-specific state management
 *
 * For backward compatibility, use FHIRCompositeProvider and useFHIRResourceComposite.
 */

// Cache Context
export {
  FHIRCacheProvider,
  useFHIRCache,
  default as FHIRCacheContext
} from './FHIRCacheContext';

// Data Context
export {
  FHIRDataProvider,
  useFHIRData,
  DATA_ACTIONS,
  default as FHIRDataContext
} from './FHIRDataContext';

// Operations Context
export {
  FHIROperationsProvider,
  useFHIROperations,
  default as FHIROperationsContext
} from './FHIROperationsContext';

// Patient Context
export {
  PatientProvider,
  usePatient,
  PATIENT_ACTIONS,
  default as PatientContext
} from './PatientContext';

// Composite Provider and Hook (backward compatibility)
export {
  FHIRCompositeProvider,
  useFHIRResourceComposite,
  useFHIRResource  // Alias for backward compatibility
} from './useFHIRResourceComposite';
