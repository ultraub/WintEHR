/**
 * CDS (Clinical Decision Support) Services Module
 *
 * Provides a unified API for CDS operations through the CDSService facade,
 * as well as direct access to underlying services for advanced use cases.
 *
 * Recommended Usage:
 *   import { cdsService } from '@/services/cds';
 *   const cards = await cdsService.firePatientView(patientId, encounterId);
 *
 * Advanced Usage (direct service access):
 *   import { CDSHooksClient, cdsHooksService } from '@/services/cds';
 */

// Primary facade export
export { cdsService, CDSService } from './CDSService';

// Re-export underlying services for advanced usage
export { default as CDSHooksClient } from '../cdsHooksClient';
export { cdsHooksService, CDSHooksService } from '../cdsHooksService';
export { cdsClinicalDataService, CDSClinicalDataService } from '../cdsClinicalDataService';
export { cdsActionExecutor, CDSActionExecutor } from '../cdsActionExecutor';
export { cdsFeedbackService, CDSFeedbackService } from '../cdsFeedbackService';

// Default export is the unified service
export { cdsService as default } from './CDSService';
