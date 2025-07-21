// Core FHIR Module - Barrel Exports
// Centralized exports for all FHIR-related functionality

// Services
export { fhirClient, default as FHIRClient } from './services/fhirClient';
// Note: fhirService is deprecated - use fhirClient instead

// Hooks
export { useFHIRResources } from './hooks/useFHIRResources';
export { useMedicationResolver } from './hooks/useMedicationResolver';
export { useFHIRValidation } from './hooks/useFHIRValidation';

// Contexts
export { FHIRResourceContext, FHIRResourceProvider } from './contexts/FHIRResourceContext';

// Validators
export { validateFHIRResource, validateResourceType } from './validators/fhirValidation';

// Utils
export * from './utils/fhirFormatters';
export * from './utils/fhirSearchParams';

// Components
export { default as DateTimeField } from './components/DateTimeField';
export { default as CodeableConceptField } from './components/CodeableConceptField';
export { default as ReferenceField } from './components/ReferenceField';
export { default as QuantityField } from './components/QuantityField';
export { default as PeriodField } from './components/PeriodField';
export { default as IdentifierField } from './components/IdentifierField';