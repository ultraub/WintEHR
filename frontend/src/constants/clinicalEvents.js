/**
 * Clinical Event Constants
 * 
 * Defines all clinical workflow events used throughout the application
 * for cross-module communication via the ClinicalWorkflowContext
 * 
 * @since 2025-01-20
 */

export const CLINICAL_EVENTS = {
  // Patient events
  PATIENT_SELECTED: 'patient.selected',
  PATIENT_UPDATED: 'patient.updated',
  PATIENT_CONTEXT_CHANGED: 'patient.context.changed',

  // Condition/Problem events
  CONDITION_ADDED: 'condition.added',
  CONDITION_DIAGNOSED: 'condition.diagnosed', // Alias for CONDITION_ADDED
  CONDITION_UPDATED: 'condition.updated',
  CONDITION_RESOLVED: 'condition.resolved',
  CONDITION_DELETED: 'condition.deleted',

  // Medication events
  MEDICATION_PRESCRIBED: 'medication.prescribed',
  MEDICATION_UPDATED: 'medication.updated',
  MEDICATION_DISCONTINUED: 'medication.discontinued',
  MEDICATION_DISPENSED: 'medication.dispensed',
  MEDICATION_ADMINISTERED: 'medication.administered',
  MEDICATION_REFILLED: 'medication.refilled',

  // Allergy events
  ALLERGY_ADDED: 'allergy.added',
  ALLERGY_UPDATED: 'allergy.updated',
  ALLERGY_RESOLVED: 'allergy.resolved',
  ALLERGY_DELETED: 'allergy.deleted',

  // Immunization events
  IMMUNIZATION_ADMINISTERED: 'immunization.administered',
  IMMUNIZATION_UPDATED: 'immunization.updated',
  IMMUNIZATION_CONTRAINDICATED: 'immunization.contraindicated',

  // Procedure events
  PROCEDURE_SCHEDULED: 'procedure.scheduled',
  PROCEDURE_STARTED: 'procedure.started',
  PROCEDURE_COMPLETED: 'procedure.completed',
  PROCEDURE_CANCELLED: 'procedure.cancelled',
  PROCEDURE_UPDATED: 'procedure.updated',

  // Observation events
  OBSERVATION_RECORDED: 'observation.recorded',
  OBSERVATION_UPDATED: 'observation.updated',
  VITAL_SIGNS_RECORDED: 'vital.signs.recorded',
  LAB_RESULT_READY: 'lab.result.ready',

  // Diagnostic Report events
  DIAGNOSTIC_REPORT_CREATED: 'diagnostic.report.created',
  DIAGNOSTIC_REPORT_UPDATED: 'diagnostic.report.updated',
  DIAGNOSTIC_REPORT_FINALIZED: 'diagnostic.report.finalized',

  // Imaging events
  IMAGING_STUDY_AVAILABLE: 'imaging.study.available',
  IMAGING_STUDY_UPDATED: 'imaging.study.updated',
  IMAGING_REPORT_READY: 'imaging.report.ready',
  IMAGING_STUDY_VIEWED: 'imaging.study.viewed',

  // Service Request events
  SERVICE_REQUEST_PLACED: 'service.request.placed',
  SERVICE_REQUEST_UPDATED: 'service.request.updated',
  SERVICE_REQUEST_COMPLETED: 'service.request.completed',
  SERVICE_REQUEST_CANCELLED: 'service.request.cancelled',

  // Order events
  ORDER_PLACED: 'order.placed',
  ORDER_UPDATED: 'order.updated',
  ORDER_COMPLETED: 'order.completed',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_STATUS_CHANGED: 'order.status.changed',

  // Encounter events
  ENCOUNTER_STARTED: 'encounter.started',
  ENCOUNTER_UPDATED: 'encounter.updated',
  ENCOUNTER_FINISHED: 'encounter.finished',

  // Document events
  DOCUMENT_CREATED: 'document.created',
  DOCUMENT_UPDATED: 'document.updated',
  DOCUMENT_SIGNED: 'document.signed',
  NOTE_CREATED: 'note.created',

  // Care Plan events
  CARE_PLAN_CREATED: 'care.plan.created',
  CARE_PLAN_UPDATED: 'care.plan.updated',
  CARE_PLAN_GOAL_ACHIEVED: 'care.plan.goal.achieved',

  // Alert events
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_ACKNOWLEDGED: 'alert.acknowledged',
  CDS_ALERT_FIRED: 'cds.alert.fired',

  // Tab/View events
  TAB_CHANGED: 'tab.changed',
  VIEW_REFRESHED: 'view.refreshed',
  MODULE_SELECTED: 'module.selected',

  // Batch operation events
  BATCH_OPERATION_STARTED: 'batch.operation.started',
  BATCH_OPERATION_COMPLETED: 'batch.operation.completed',
  BATCH_OPERATION_FAILED: 'batch.operation.failed',

  // Workflow events
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',

  // Data synchronization events
  DATA_SYNCED: 'data.synced',
  RESOURCE_CREATED: 'resource.created',
  RESOURCE_UPDATED: 'resource.updated',
  RESOURCE_DELETED: 'resource.deleted',

  // Error events
  ERROR_OCCURRED: 'error.occurred',
  VALIDATION_FAILED: 'validation.failed',
  NETWORK_ERROR: 'network.error'
};

// Event payload type definitions for TypeScript support
export const EVENT_PAYLOADS = {
  [CLINICAL_EVENTS.PATIENT_SELECTED]: {
    patientId: 'string',
    patient: 'Patient resource',
    source: 'string (component that triggered the event)'
  },
  [CLINICAL_EVENTS.CONDITION_ADDED]: {
    patientId: 'string',
    conditionId: 'string',
    condition: 'Condition resource',
    encounterId: 'string (optional)'
  },
  [CLINICAL_EVENTS.MEDICATION_PRESCRIBED]: {
    patientId: 'string',
    medicationRequestId: 'string',
    medicationRequest: 'MedicationRequest resource',
    encounterId: 'string (optional)'
  },
  [CLINICAL_EVENTS.ORDER_PLACED]: {
    patientId: 'string',
    orderId: 'string',
    orderType: 'string (medication, lab, imaging, etc)',
    resource: 'FHIR resource'
  },
  [CLINICAL_EVENTS.ALERT_TRIGGERED]: {
    alertType: 'string',
    severity: 'info | warning | error | critical',
    message: 'string',
    context: 'object',
    actions: 'array (optional)'
  }
};