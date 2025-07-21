/**
 * Comprehensive tests for MedicationCRUDService
 * Tests consolidated medication search, discontinuation, effectiveness monitoring, and list management
 */

import { medicationCRUDService } from '../MedicationCRUDService';
import { fhirClient } from '../../core/fhir/services/fhirClient';

// Mock dependencies
jest.mock('../../core/fhir/services/fhirClient');
jest.mock('../cdsHooksService');

describe('MedicationCRUDService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock common FHIR responses
    fhirClient.search.mockResolvedValue({
      resources: [
        {
          resourceType: 'MedicationRequest',
          id: 'med-1',
          status: 'active',
          medicationCodeableConcept: {
            coding: [{ display: 'Lisinopril 10mg' }],
            text: 'Lisinopril 10mg'
          },
          subject: { reference: 'Patient/patient-1' }
        }
      ],
      total: 1
    });
    
    fhirClient.read.mockResolvedValue({
      resourceType: 'MedicationRequest',
      id: 'med-1',
      status: 'active'
    });
  });

  describe('search', () => {
    it('should search medications with basic query', async () => {
      const result = await medicationCRUDService.search('insulin');
      
      expect(fhirClient.search).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({
          _elements: expect.any(String),
          _count: 20
        })
      );
      expect(result.medications).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should handle advanced search options', async () => {
      const options = {
        patientId: 'patient-1',
        status: 'active',
        includeObservations: true,
        count: 10
      };
      
      await medicationCRUDService.search('metformin', options);
      
      expect(fhirClient.search).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({
          subject: 'Patient/patient-1',
          status: 'active',
          _count: 10
        })
      );
    });

    it('should include effectiveness observations when requested', async () => {
      fhirClient.search
        .mockResolvedValueOnce({ resources: [{ id: 'med-1' }], total: 1 })
        .mockResolvedValueOnce({ resources: [{ id: 'obs-1' }], total: 1 });
      
      const result = await medicationCRUDService.search('insulin', { 
        includeObservations: true 
      });
      
      expect(fhirClient.search).toHaveBeenCalledTimes(2);
      expect(result.effectivenessData).toBeDefined();
    });

    it('should handle search errors gracefully', async () => {
      fhirClient.search.mockRejectedValue(new Error('Network error'));
      
      const result = await medicationCRUDService.search('test');
      
      expect(result).toEqual({
        medications: [],
        total: 0,
        error: 'Failed to search medications: Network error'
      });
    });
  });

  describe('getMedicationById', () => {
    it('should retrieve medication by ID', async () => {
      const medication = await medicationCRUDService.getMedicationById('med-1');
      
      expect(fhirClient.read).toHaveBeenCalledWith('MedicationRequest', 'med-1');
      expect(medication.id).toBe('med-1');
    });

    it('should handle not found errors', async () => {
      fhirClient.read.mockRejectedValue(new Error('Not found'));
      
      const medication = await medicationCRUDService.getMedicationById('invalid');
      
      expect(medication).toBeNull();
    });
  });

  describe('discontinue', () => {
    it('should discontinue medication with reason', async () => {
      const discontinuationData = {
        medicationRequestId: 'med-1',
        reason: 'Adverse reaction',
        statusDate: new Date().toISOString(),
        practitionerId: 'practitioner-1'
      };
      
      fhirClient.update.mockResolvedValue({ id: 'med-1', status: 'stopped' });
      
      const result = await medicationCRUDService.discontinue(discontinuationData);
      
      expect(fhirClient.update).toHaveBeenCalledWith(
        'MedicationRequest',
        'med-1',
        expect.objectContaining({
          status: 'stopped',
          statusReason: expect.objectContaining({
            text: 'Adverse reaction'
          })
        })
      );
      expect(result.success).toBe(true);
    });

    it('should validate required fields', async () => {
      const result = await medicationCRUDService.discontinue({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });

    it('should handle update errors', async () => {
      fhirClient.update.mockRejectedValue(new Error('Update failed'));
      
      const result = await medicationCRUDService.discontinue({
        medicationRequestId: 'med-1',
        reason: 'Test'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('createMonitoringPlan', () => {
    it('should create monitoring plan for new medication', async () => {
      const medicationRequest = {
        resourceType: 'MedicationRequest',
        id: 'med-1',
        medicationCodeableConcept: { text: 'Warfarin' }
      };
      
      fhirClient.create.mockResolvedValue({ id: 'careplan-1' });
      
      const result = await medicationCRUDService.createMonitoringPlan(medicationRequest);
      
      expect(fhirClient.create).toHaveBeenCalledWith(
        'CarePlan',
        expect.objectContaining({
          status: 'active',
          intent: 'plan',
          category: expect.arrayContaining([
            expect.objectContaining({
              coding: expect.arrayContaining([
                expect.objectContaining({
                  code: 'drug-therapy'
                })
              ])
            })
          ])
        })
      );
      expect(result.carePlanId).toBe('careplan-1');
    });

    it('should include lab monitoring for appropriate medications', async () => {
      const medicationRequest = {
        medicationCodeableConcept: { text: 'Warfarin' }
      };
      
      await medicationCRUDService.createMonitoringPlan(medicationRequest);
      
      expect(fhirClient.create).toHaveBeenCalledWith(
        'CarePlan',
        expect.objectContaining({
          activity: expect.arrayContaining([
            expect.objectContaining({
              detail: expect.objectContaining({
                code: expect.objectContaining({
                  text: expect.stringContaining('INR')
                })
              })
            })
          ])
        })
      );
    });
  });

  describe('handleNewPrescription', () => {
    it('should process new prescription with all steps', async () => {
      const prescriptionData = {
        patientId: 'patient-1',
        medicationCodeableConcept: { text: 'Lisinopril 10mg' },
        dosageInstruction: [{ text: 'Once daily' }]
      };
      
      fhirClient.create.mockResolvedValue({ id: 'med-new' });
      
      const result = await medicationCRUDService.handleNewPrescription(prescriptionData);
      
      expect(fhirClient.create).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({
          status: 'active',
          intent: 'order',
          subject: { reference: 'Patient/patient-1' }
        })
      );
      expect(result.medicationRequestId).toBe('med-new');
    });

    it('should validate prescription data', async () => {
      const result = await medicationCRUDService.handleNewPrescription({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
    });
  });

  describe('getDosingRecommendations', () => {
    it('should return dosing recommendations', async () => {
      const recommendations = await medicationCRUDService.getDosingRecommendations('med-1', {
        patientAge: 65,
        weight: 70,
        creatinine: 1.2
      });
      
      expect(recommendations).toHaveProperty('standardDose');
      expect(recommendations).toHaveProperty('adjustments');
      expect(recommendations.adjustments).toContain('Consider renal dose adjustment');
    });
  });

  describe('checkDrugInteractions', () => {
    it('should check for drug interactions', async () => {
      const medications = ['warfarin', 'aspirin'];
      
      const interactions = await medicationCRUDService.checkDrugInteractions(medications);
      
      expect(interactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            severity: 'major',
            description: expect.stringContaining('bleeding risk')
          })
        ])
      );
    });

    it('should handle empty medication list', async () => {
      const interactions = await medicationCRUDService.checkDrugInteractions([]);
      
      expect(interactions).toEqual([]);
    });
  });

  describe('checkAllergies', () => {
    it('should check for allergy conflicts', async () => {
      const allergies = [
        {
          code: { text: 'Penicillin' },
          criticality: 'high'
        }
      ];
      
      const result = await medicationCRUDService.checkAllergies('amoxicillin', allergies);
      
      expect(result.hasConflict).toBe(true);
      expect(result.conflictDetails.severity).toBe('high');
    });

    it('should return no conflict for safe medications', async () => {
      const allergies = [{ code: { text: 'Shellfish' } }];
      
      const result = await medicationCRUDService.checkAllergies('lisinopril', allergies);
      
      expect(result.hasConflict).toBe(false);
    });
  });

  describe('COMMON_MEDICATIONS', () => {
    it('should provide common medications list', () => {
      expect(medicationCRUDService.COMMON_MEDICATIONS).toBeInstanceOf(Array);
      expect(medicationCRUDService.COMMON_MEDICATIONS.length).toBeGreaterThan(0);
      expect(medicationCRUDService.COMMON_MEDICATIONS[0]).toHaveProperty('name');
      expect(medicationCRUDService.COMMON_MEDICATIONS[0]).toHaveProperty('category');
    });
  });

  describe('Integration tests', () => {
    it('should handle complete medication workflow', async () => {
      // Create new prescription
      const prescriptionData = {
        patientId: 'patient-1',
        medicationCodeableConcept: { text: 'Warfarin 5mg' },
        dosageInstruction: [{ text: 'Once daily' }]
      };
      
      fhirClient.create.mockResolvedValue({ id: 'med-new' });
      
      const newPrescription = await medicationCRUDService.handleNewPrescription(prescriptionData);
      expect(newPrescription.success).toBe(true);
      
      // Create monitoring plan
      const monitoringPlan = await medicationCRUDService.createMonitoringPlan({
        id: 'med-new',
        medicationCodeableConcept: { text: 'Warfarin 5mg' }
      });
      expect(monitoringPlan.carePlanId).toBeDefined();
      
      // Search for the medication
      const searchResult = await medicationCRUDService.search('warfarin', {
        patientId: 'patient-1'
      });
      expect(searchResult.medications.length).toBeGreaterThan(0);
    });
  });
});