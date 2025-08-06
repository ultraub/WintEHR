/**
 * Clinical Card Templates
 * Export all clinical card templates for FHIR resources
 */

export { default as ConditionCardTemplate } from './ConditionCardTemplate';
export { default as MedicationCardTemplate } from './MedicationCardTemplate';
export { default as AllergyCardTemplate } from './AllergyCardTemplate';
export { default as ObservationCardTemplate } from './ObservationCardTemplate';
export { default as ProcedureCardTemplate } from './ProcedureCardTemplate';
export { default as DocumentCardTemplate } from './DocumentCardTemplate';

// Convenience export for all templates
export const ClinicalCardTemplates = {
  Condition: require('./ConditionCardTemplate').default,
  MedicationRequest: require('./MedicationCardTemplate').default,
  AllergyIntolerance: require('./AllergyCardTemplate').default,
  Observation: require('./ObservationCardTemplate').default,
  Procedure: require('./ProcedureCardTemplate').default,
  DocumentReference: require('./DocumentCardTemplate').default
};