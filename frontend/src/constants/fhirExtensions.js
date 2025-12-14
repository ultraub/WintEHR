/**
 * FHIR Extension and CodeSystem Constants
 *
 * Centralized FHIR extension URLs and code system identifiers for WintEHR.
 * Standardizes on http://wintehr.local/fhir/ for development.
 *
 * Educational Notes:
 *   - FHIR extensions allow custom data to be attached to resources
 *   - Extension URLs should be unique and resolvable (though not required)
 *   - WintEHR uses a local domain for educational/development purposes
 *   - These constants mirror backend/api/cds_hooks/constants.py
 *
 * @since 2025-11-26
 */

/**
 * Base URL for all WintEHR FHIR extensions and code systems
 */
export const FHIR_BASE_URL = 'http://wintehr.local/fhir';

/**
 * FHIR StructureDefinition extension URLs
 */
export const EXTENSION_URLS = {
  BASE: `${FHIR_BASE_URL}/StructureDefinition`,

  // Medication Extensions
  MEDICATION_DISCONTINUATION: `${FHIR_BASE_URL}/StructureDefinition/medication-discontinuation`,
  MEDICATION_MONITORING: `${FHIR_BASE_URL}/StructureDefinition/medication-monitoring`,
  MEDICATION_ASSESSMENT: `${FHIR_BASE_URL}/StructureDefinition/medication-assessment`,
  ASSESSMENT_TYPE: `${FHIR_BASE_URL}/StructureDefinition/assessment-type`,
  ORIGINAL_MEDICATION: `${FHIR_BASE_URL}/StructureDefinition/original-medication`,
  DISCONTINUATION_REASON: `${FHIR_BASE_URL}/StructureDefinition/discontinuation-reason`,
  DISCONTINUATION_TYPE: `${FHIR_BASE_URL}/StructureDefinition/discontinuation-type`,
  DISCONTINUATION_STATUS: `${FHIR_BASE_URL}/StructureDefinition/discontinuation-status`,
  CANCELLATION_REASON: `${FHIR_BASE_URL}/StructureDefinition/cancellation-reason`,
  CANCELLATION_DATE: `${FHIR_BASE_URL}/StructureDefinition/cancellation-date`,
  EFFECTIVE_DATE: `${FHIR_BASE_URL}/StructureDefinition/effective-date`,
  TAPERING_STEP: `${FHIR_BASE_URL}/StructureDefinition/tapering-step`,

  // Prescription Extensions
  PRESCRIPTION_REFILL: `${FHIR_BASE_URL}/StructureDefinition/prescription-refill`,
  PRESCRIPTION_STATUS: `${FHIR_BASE_URL}/StructureDefinition/prescription-status`,
  PRESCRIPTION_STATUS_HISTORY: `${FHIR_BASE_URL}/StructureDefinition/prescription-status-history`,
  PRESCRIPTION_STATUS_TRACKING: `${FHIR_BASE_URL}/StructureDefinition/prescription-status-tracking`,
  REFILL_REQUEST: `${FHIR_BASE_URL}/StructureDefinition/refill-request`,
  REFILL_APPROVAL: `${FHIR_BASE_URL}/StructureDefinition/refill-approval`,

  // Reconciliation Extensions
  RECONCILIATION_ACTION: `${FHIR_BASE_URL}/StructureDefinition/reconciliation-action`,

  // Pharmacy Extensions
  PHARMACY_STATUS: `${FHIR_BASE_URL}/StructureDefinition/pharmacy-status`,

  // Imaging Extensions
  DICOM_DIRECTORY: `${FHIR_BASE_URL}/StructureDefinition/dicom-directory`,

  // CDS Hooks Extensions
  SERVICE_ORIGIN: `${FHIR_BASE_URL}/StructureDefinition/service-origin`,
  CDS_HOOKS_SERVICE_ID: `${FHIR_BASE_URL}/StructureDefinition/cds-hooks-service-id`,
};

/**
 * FHIR CodeSystem URLs
 */
export const CODE_SYSTEM_URLS = {
  // Medication List Code Systems
  MEDICATION_LIST_TYPES: `${FHIR_BASE_URL}/medication-list-types`,
  MEDICATION_LIST_FLAGS: `${FHIR_BASE_URL}/medication-list-flags`,

  // Medication Assessment Code Systems
  MEDICATION_EFFECTIVENESS: `${FHIR_BASE_URL}/medication-effectiveness-codes`,
  EFFECTIVENESS_COMPONENTS: `${FHIR_BASE_URL}/effectiveness-components`,
  EFFECTIVENESS_SCALE: `${FHIR_BASE_URL}/effectiveness-scale`,
  ADHERENCE_SCALE: `${FHIR_BASE_URL}/adherence-scale`,

  // Medication Discontinuation Code Systems
  MEDICATION_DISCONTINUATION: `${FHIR_BASE_URL}/medication-discontinuation`,
  MEDICATION_DISCONTINUATION_CODES: `${FHIR_BASE_URL}/medication-discontinuation-codes`,
  MEDICATION_DISCONTINUATION_REASONS: `${FHIR_BASE_URL}/medication-discontinuation-reasons`,

  // Reconciliation Code Systems
  RECONCILIATION_STATUS: `${FHIR_BASE_URL}/reconciliation-status`,

  // Clinical Alert Code Systems
  ALERT_TYPE: `${FHIR_BASE_URL}/alert-type`,
  TASK_TYPE: `${FHIR_BASE_URL}/task-type`,

  // Audit Code Systems
  AUDIT_EVENT_SUBTYPE: `${FHIR_BASE_URL}/audit-event-subtype`,
  COMMUNICATION_CATEGORY: `${FHIR_BASE_URL}/communication-category`,
};

/**
 * FHIR Profile URLs for custom resource profiles
 */
export const PROFILE_URLS = {
  MEDICATION_MONITORING: `${FHIR_BASE_URL}/StructureDefinition/MedicationMonitoring`,
  MEDICATION_DISCONTINUATION: `${FHIR_BASE_URL}/StructureDefinition/MedicationDiscontinuation`,
};

export default {
  FHIR_BASE_URL,
  EXTENSION_URLS,
  CODE_SYSTEM_URLS,
  PROFILE_URLS,
};
