/**
 * Comprehensive tests for MedicationWorkflowService
 * Tests consolidated medication reconciliation, refills, status tracking, and validation
 */

import { medicationWorkflowService } from '../MedicationWorkflowService';
import { fhirService } from '../fhirService';

// Mock dependencies
jest.mock('../fhirService');

describe('MedicationWorkflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock common FHIR responses
    fhirService.searchResources.mockResolvedValue({
      entry: [
        {
          resource: {
            resourceType: 'MedicationRequest',
            id: 'med-1',
            status: 'active',
            medicationCodeableConcept: {
              text: 'Lisinopril 10mg'
            },
            dispenseRequest: {
              numberOfRepeatsAllowed: 5,
              quantity: { value: 30 }
            }
          }
        }
      ]
    });
  });

  describe('getMedicationReconciliationData', () => {
    it('should retrieve reconciliation data for patient', async () => {
      // Mock multiple resource types
      fhirService.searchResources
        .mockResolvedValueOnce({ entry: [{ resource: { id: 'med-1', status: 'active' } }] })
        .mockResolvedValueOnce({ entry: [{ resource: { id: 'disp-1' } }] })
        .mockResolvedValueOnce({ entry: [{ resource: { id: 'admin-1' } }] });
      
      const result = await medicationWorkflowService.getMedicationReconciliationData('patient-1');
      
      expect(fhirService.searchResources).toHaveBeenCalledTimes(3);
      expect(result.currentMedications).toHaveLength(1);
      expect(result.reconciliationSummary).toBeDefined();
      expect(result.reconciliationSummary.totalActive).toBe(1);
    });

    it('should include encounter-specific medications when encounter provided', async () => {
      await medicationWorkflowService.getMedicationReconciliationData('patient-1', 'encounter-1');
      
      expect(fhirService.searchResources).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({
          encounter: 'Encounter/encounter-1'
        })
      );
    });

    it('should identify discrepancies in medication records', async () => {
      fhirService.searchResources
        .mockResolvedValueOnce({ 
          entry: [
            { resource: { id: 'med-1', status: 'active', medicationCodeableConcept: { text: 'Med A' } } },
            { resource: { id: 'med-2', status: 'active', medicationCodeableConcept: { text: 'Med B' } } }
          ] 
        })
        .mockResolvedValueOnce({ 
          entry: [
            { resource: { id: 'disp-1', medicationCodeableConcept: { text: 'Med A' } } }
          ] 
        })
        .mockResolvedValueOnce({ entry: [] });
      
      const result = await medicationWorkflowService.getMedicationReconciliationData('patient-1');
      
      expect(result.discrepancies).toHaveLength(1);
      expect(result.discrepancies[0].type).toBe('missing_dispense');
    });
  });

  describe('executeReconciliation', () => {
    it('should execute reconciliation with medication updates', async () => {
      const reconciliationData = {
        medicationsToStop: ['med-1'],
        medicationsToModify: [
          { id: 'med-2', dosage: 'Updated dosage' }
        ],
        medicationsToAdd: [
          { medicationCodeableConcept: { text: 'New medication' } }
        ]
      };
      
      fhirService.updateResource.mockResolvedValue({ id: 'med-1', status: 'stopped' });
      fhirService.createResource.mockResolvedValue({ id: 'med-new' });
      
      const result = await medicationWorkflowService.executeReconciliation('patient-1', reconciliationData);
      
      expect(result.success).toBe(true);
      expect(result.stopped).toHaveLength(1);
      expect(result.modified).toHaveLength(1);
      expect(result.added).toHaveLength(1);
    });

    it('should handle reconciliation errors gracefully', async () => {
      const reconciliationData = {
        medicationsToStop: ['invalid-id']
      };
      
      fhirService.updateResource.mockRejectedValue(new Error('Not found'));
      
      const result = await medicationWorkflowService.executeReconciliation('patient-1', reconciliationData);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('createRefillRequest', () => {
    it('should create refill request for valid medication', async () => {
      const requestData = {
        requestedQuantity: 30,
        requestedSupplyDuration: 30,
        reason: 'Regular refill'
      };
      
      fhirService.getResource.mockResolvedValue({
        id: 'med-1',
        status: 'active',
        dispenseRequest: { numberOfRepeatsAllowed: 5 }
      });
      fhirService.createResource.mockResolvedValue({ id: 'refill-1' });
      
      const result = await medicationWorkflowService.createRefillRequest('med-1', requestData);
      
      expect(result.success).toBe(true);
      expect(result.refillRequestId).toBe('refill-1');
      expect(fhirService.createResource).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({
          status: 'draft',
          intent: 'reflex-order'
        })
      );
    });

    it('should reject refill for medications with no repeats left', async () => {
      fhirService.getResource.mockResolvedValue({
        id: 'med-1',
        status: 'active',
        dispenseRequest: { numberOfRepeatsAllowed: 0 }
      });
      
      const result = await medicationWorkflowService.createRefillRequest('med-1', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No refills remaining');
    });

    it('should validate refill request data', async () => {
      const result = await medicationWorkflowService.createRefillRequest('med-1', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });
  });

  describe('getRefillHistory', () => {
    it('should retrieve refill history for medication', async () => {
      fhirService.searchResources.mockResolvedValue({
        entry: [
          { resource: { id: 'refill-1', status: 'completed', authoredOn: '2024-01-01' } },
          { resource: { id: 'refill-2', status: 'completed', authoredOn: '2024-02-01' } }
        ]
      });
      
      const history = await medicationWorkflowService.getRefillHistory('med-1');
      
      expect(history).toHaveLength(2);
      expect(history[0].status).toBe('completed');
      expect(fhirService.searchResources).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({
          'based-on': 'MedicationRequest/med-1'
        })
      );
    });
  });

  describe('calculateMedicationAdherence', () => {
    it('should calculate adherence from dispense records', async () => {
      const dispenseDates = [
        '2024-01-01', '2024-01-31', '2024-03-02'
      ];
      
      fhirService.searchResources.mockResolvedValue({
        entry: dispenseDates.map((date, i) => ({
          resource: {
            id: `disp-${i}`,
            whenHandedOver: date,
            quantity: { value: 30 }
          }
        }))
      });
      
      const adherence = await medicationWorkflowService.calculateMedicationAdherence('med-1');
      
      expect(adherence.adherencePercentage).toBeGreaterThan(0);
      expect(adherence.totalDispenses).toBe(3);
      expect(adherence.daysSupplied).toBe(90);
    });

    it('should handle medications with no dispense history', async () => {
      fhirService.searchResources.mockResolvedValue({ entry: [] });
      
      const adherence = await medicationWorkflowService.calculateMedicationAdherence('med-1');
      
      expect(adherence.adherencePercentage).toBe(0);
      expect(adherence.totalDispenses).toBe(0);
      expect(adherence.status).toBe('insufficient_data');
    });
  });

  describe('updatePrescriptionStatus', () => {
    it('should update prescription status with metadata', async () => {
      const metadata = {
        reason: 'Patient request',
        updatedBy: 'practitioner-1'
      };
      
      fhirService.updateResource.mockResolvedValue({
        id: 'med-1',
        status: 'stopped'
      });
      
      const result = await medicationWorkflowService.updatePrescriptionStatus('med-1', 'stopped', metadata);
      
      expect(result.success).toBe(true);
      expect(fhirService.updateResource).toHaveBeenCalledWith(
        'MedicationRequest',
        'med-1',
        expect.objectContaining({
          status: 'stopped',
          statusReason: expect.objectContaining({
            text: 'Patient request'
          })
        })
      );
    });

    it('should validate status transitions', async () => {
      const result = await medicationWorkflowService.updatePrescriptionStatus('med-1', 'invalid-status');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid status');
    });
  });

  describe('getPatientPrescriptionStatuses', () => {
    it('should retrieve all prescription statuses for patient', async () => {
      fhirService.searchResources.mockResolvedValue({
        entry: [
          { resource: { id: 'med-1', status: 'active' } },
          { resource: { id: 'med-2', status: 'stopped' } }
        ]
      });
      
      const statuses = await medicationWorkflowService.getPatientPrescriptionStatuses('patient-1');
      
      expect(statuses).toHaveLength(2);
      expect(statuses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'med-1', status: 'active' }),
          expect.objectContaining({ id: 'med-2', status: 'stopped' })
        ])
      );
    });
  });

  describe('validatePatientMedicationWorkflow', () => {
    it('should validate complete medication workflow', async () => {
      // Mock various resources for validation
      fhirService.searchResources
        .mockResolvedValueOnce({ entry: [{ resource: { id: 'med-1', status: 'active' } }] })
        .mockResolvedValueOnce({ entry: [{ resource: { id: 'allergy-1' } }] })
        .mockResolvedValueOnce({ entry: [{ resource: { id: 'condition-1' } }] });
      
      const validation = await medicationWorkflowService.validatePatientMedicationWorkflow('patient-1');
      
      expect(validation.isValid).toBeDefined();
      expect(validation.checks).toHaveProperty('duplicateMedications');
      expect(validation.checks).toHaveProperty('drugInteractions');
      expect(validation.checks).toHaveProperty('allergyConflicts');
    });

    it('should identify workflow issues', async () => {
      // Mock duplicate medications
      fhirService.searchResources.mockResolvedValue({
        entry: [
          { resource: { id: 'med-1', medicationCodeableConcept: { text: 'Lisinopril' } } },
          { resource: { id: 'med-2', medicationCodeableConcept: { text: 'Lisinopril' } } }
        ]
      });
      
      const validation = await medicationWorkflowService.validatePatientMedicationWorkflow('patient-1');
      
      expect(validation.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'duplicate_medication',
            severity: 'warning'
          })
        ])
      );
    });
  });

  describe('VALID_STATUSES', () => {
    it('should provide valid medication request statuses', () => {
      expect(medicationWorkflowService.VALID_STATUSES).toBeInstanceOf(Array);
      expect(medicationWorkflowService.VALID_STATUSES).toContain('active');
      expect(medicationWorkflowService.VALID_STATUSES).toContain('completed');
      expect(medicationWorkflowService.VALID_STATUSES).toContain('stopped');
    });
  });

  describe('Integration workflow tests', () => {
    it('should handle complete medication reconciliation workflow', async () => {
      // Step 1: Get reconciliation data
      fhirService.searchResources
        .mockResolvedValueOnce({ entry: [{ resource: { id: 'med-1', status: 'active' } }] })
        .mockResolvedValueOnce({ entry: [] })
        .mockResolvedValueOnce({ entry: [] });
      
      const reconciliationData = await medicationWorkflowService.getMedicationReconciliationData('patient-1');
      expect(reconciliationData.currentMedications).toHaveLength(1);
      
      // Step 2: Execute reconciliation
      fhirService.updateResource.mockResolvedValue({ id: 'med-1', status: 'stopped' });
      
      const reconciliationResult = await medicationWorkflowService.executeReconciliation('patient-1', {
        medicationsToStop: ['med-1']
      });
      expect(reconciliationResult.success).toBe(true);
      
      // Step 3: Validate workflow
      const validation = await medicationWorkflowService.validatePatientMedicationWorkflow('patient-1');
      expect(validation.isValid).toBeDefined();
    });

    it('should handle refill workflow with adherence tracking', async () => {
      // Mock medication with refills available
      fhirService.getResource.mockResolvedValue({
        id: 'med-1',
        status: 'active',
        dispenseRequest: { numberOfRepeatsAllowed: 3 }
      });
      fhirService.createResource.mockResolvedValue({ id: 'refill-1' });
      
      // Create refill request
      const refillResult = await medicationWorkflowService.createRefillRequest('med-1', {
        requestedQuantity: 30,
        requestedSupplyDuration: 30,
        reason: 'Regular refill'
      });
      expect(refillResult.success).toBe(true);
      
      // Check adherence
      fhirService.searchResources.mockResolvedValue({
        entry: [{ resource: { id: 'disp-1', quantity: { value: 30 } } }]
      });
      
      const adherence = await medicationWorkflowService.calculateMedicationAdherence('med-1');
      expect(adherence.totalDispenses).toBeGreaterThan(0);
    });
  });
});