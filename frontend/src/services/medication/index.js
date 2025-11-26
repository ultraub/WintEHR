/**
 * Medication Services Module
 *
 * Provides a unified API for medication operations through the MedicationService facade,
 * as well as direct access to underlying services for advanced use cases.
 *
 * Recommended Usage:
 *   import { medicationService } from '@/services/medication';
 *   const results = await medicationService.search('aspirin');
 *
 * Advanced Usage (direct service access):
 *   import { medicationCRUDService, medicationWorkflowService } from '@/services/medication';
 */

// Primary facade export
export { medicationService, MedicationService } from './MedicationService';

// Re-export underlying services for advanced usage
export { medicationCRUDService, MedicationCRUDService } from '../MedicationCRUDService';
export { medicationWorkflowService, MedicationWorkflowService } from '../MedicationWorkflowService';
export { medicationAdministrationService, MedicationAdministrationService } from '../medicationAdministrationService';
export { medicationDispenseService, MedicationDispenseService } from '../medicationDispenseService';
export { medicationDiscontinuationService, MedicationDiscontinuationService } from '../medicationDiscontinuationService';
export { medicationListManagementService, MedicationListManagementService } from '../medicationListManagementService';
export { medicationReconciliationService, MedicationReconciliationService } from '../medicationReconciliationService';
export { medicationSearchService, MedicationSearchService } from '../medicationSearchService';

// Default export is the unified service
export { medicationService as default } from './MedicationService';
