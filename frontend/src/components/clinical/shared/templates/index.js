/**
 * Clinical Card Templates
 * Export all clinical card templates for FHIR resources
 */

import ConditionCardTemplate from './ConditionCardTemplate';
import MedicationCardTemplate from './MedicationCardTemplate';
import AllergyCardTemplate from './AllergyCardTemplate';
import ObservationCardTemplate from './ObservationCardTemplate';
import ProcedureCardTemplate from './ProcedureCardTemplate';
import DocumentCardTemplate from './DocumentCardTemplate';

// Named exports for individual templates
export {
  ConditionCardTemplate,
  MedicationCardTemplate,
  AllergyCardTemplate,
  ObservationCardTemplate,
  ProcedureCardTemplate,
  DocumentCardTemplate
};

// Convenience export for all templates (using ES module imports)
export const ClinicalCardTemplates = {
  Condition: ConditionCardTemplate,
  MedicationRequest: MedicationCardTemplate,
  AllergyIntolerance: AllergyCardTemplate,
  Observation: ObservationCardTemplate,
  Procedure: ProcedureCardTemplate,
  DocumentReference: DocumentCardTemplate
};