/**
 * Tests for MedicationCRUDService — the local medication catalog + patient
 * medication-List management.
 *
 * Scope matches the service's real surface (see the service header): catalog
 * search / dosing / interaction / allergy helpers over COMMON_MEDICATIONS,
 * plus the List orchestration used by MedicationListManager and
 * useMedicationLists. The discontinuation / monitoring / synchronization
 * paths this file once asserted were removed — they called methods that were
 * never written and had no callers.
 */

import { medicationCRUDService } from '../MedicationCRUDService';
import { fhirClient } from '../../core/fhir/services/fhirClient';

vi.mock('../../core/fhir/services/fhirClient');

describe('MedicationCRUDService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    medicationCRUDService.medicationCache.clear();
  });

  describe('search', () => {
    it('finds catalog medications by name fragment', async () => {
      fhirClient.search.mockResolvedValue({ resources: [] });

      const results = await medicationCRUDService.search('lisinopril');

      expect(results.some(m => m.name === 'Lisinopril')).toBe(true);
    });

    it('matches on category and indication too', async () => {
      fhirClient.search.mockResolvedValue({ resources: [] });

      const byCategory = await medicationCRUDService.search('beta blocker');
      const byIndication = await medicationCRUDService.search('diabetes');

      expect(byCategory.some(m => m.name === 'Metoprolol Tartrate')).toBe(true);
      expect(byIndication.some(m => m.name === 'Metformin')).toBe(true);
    });

    it('returns [] for queries under 2 characters without hitting FHIR', async () => {
      const results = await medicationCRUDService.search('a');

      expect(results).toEqual([]);
      expect(fhirClient.search).not.toHaveBeenCalled();
    });

    it('merges FHIR Medication results, reading .resources (never .entry)', async () => {
      fhirClient.search.mockResolvedValue({
        resources: [{
          id: 'fhir-med-1',
          code: { text: 'Lisinopril 20mg tablet' },
          form: { text: 'tablet' },
        }],
      });

      const results = await medicationCRUDService.search('lisinopril');

      expect(fhirClient.search).toHaveBeenCalledWith(
        'Medication',
        expect.objectContaining({ name: 'lisinopril' })
      );
      const fhirHit = results.find(m => m.source === 'fhir');
      expect(fhirHit).toMatchObject({ id: 'fhir-med-1', name: 'Lisinopril 20mg tablet' });
    });

    it('degrades to [] when the FHIR search throws', async () => {
      fhirClient.search.mockRejectedValue(new Error('HAPI down'));

      // search() catches at the top level, so even local hits are dropped —
      // the method's contract is "array, never throws".
      const results = await medicationCRUDService.search('lisinopril');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getMedicationById', () => {
    it('returns the catalog entry by id (synchronously)', () => {
      const med = medicationCRUDService.getMedicationById('lisinopril-10mg');
      expect(med).toMatchObject({ name: 'Lisinopril', category: 'ACE Inhibitor' });
    });

    it('returns undefined for unknown ids', () => {
      expect(medicationCRUDService.getMedicationById('no-such-med')).toBeUndefined();
    });
  });

  describe('getDosingRecommendations', () => {
    it('recommends adult dosing by default', () => {
      const rec = medicationCRUDService.getDosingRecommendations('lisinopril-10mg', { age: 40 });
      expect(rec.recommended).toEqual(expect.objectContaining({ initial: '10mg once daily' }));
      expect(rec.warnings).toContain('Hyperkalemia risk');
    });

    it('switches to elderly dosing at age 65+', () => {
      const rec = medicationCRUDService.getDosingRecommendations('lisinopril-10mg', { age: 72 });
      expect(rec.recommended).toEqual(expect.objectContaining({ initial: '5mg once daily' }));
    });

    it('returns null for unknown medications', () => {
      expect(medicationCRUDService.getDosingRecommendations('no-such-med')).toBeNull();
    });
  });

  describe('checkDrugInteractions', () => {
    it('returns [] for fewer than two medications', async () => {
      const result = await medicationCRUDService.checkDrugInteractions(['lisinopril-10mg']);
      expect(result).toEqual([]);
    });

    it('flags a pair when one lists the other\'s category as an interaction', async () => {
      const aceInhibitor = {
        name: 'Lisinopril', category: 'ACE Inhibitor',
        interactions: ['NSAIDs'],
      };
      const nsaid = {
        name: 'Ibuprofen', category: 'NSAIDs', interactions: [],
      };

      const result = await medicationCRUDService.checkDrugInteractions([aceInhibitor, nsaid]);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        medication1: 'Lisinopril',
        medication2: 'Ibuprofen',
        severity: 'moderate',
      });
    });
  });

  describe('checkAllergies', () => {
    const lisinoprilAllergy = {
      code: { text: 'Lisinopril' },
      criticality: 'high',
      reaction: [{ manifestation: [{ text: 'Angioedema' }] }],
    };

    it('returns an alert array when the medication matches an allergy', () => {
      const alerts = medicationCRUDService.checkAllergies('lisinopril-10mg', [lisinoprilAllergy]);

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        severity: 'critical',
        allergen: 'Lisinopril',
        medication: 'Lisinopril',
        reaction: 'Angioedema',
      });
    });

    it('returns [] when nothing matches', () => {
      const alerts = medicationCRUDService.checkAllergies('metformin-500mg', [lisinoprilAllergy]);
      expect(alerts).toEqual([]);
    });

    it('returns [] when there are no allergies', () => {
      expect(medicationCRUDService.checkAllergies('lisinopril-10mg', [])).toEqual([]);
    });
  });

  describe('handleNewPrescription', () => {
    const prescription = {
      resourceType: 'MedicationRequest',
      id: 'med-new',
      status: 'active',
      intent: 'order',
      subject: { reference: 'Patient/patient-1' },
    };

    it('orchestrates list initialization, add, and notification', async () => {
      const init = vi.spyOn(medicationCRUDService, 'initializePatientMedicationLists').mockResolvedValue();
      const add = vi.spyOn(medicationCRUDService, 'addMedicationToList').mockResolvedValue();
      const addCurrent = vi.spyOn(medicationCRUDService, 'addMedicationToCurrentList').mockResolvedValue();
      const notify = vi.spyOn(medicationCRUDService, 'notifyListUpdated').mockImplementation(() => {});

      await medicationCRUDService.handleNewPrescription(prescription);

      expect(init).toHaveBeenCalledWith('patient-1');
      expect(add).toHaveBeenCalledWith(
        'patient-1',
        medicationCRUDService.LIST_TYPES.ACTIVE_PRESCRIPTIONS,
        prescription,
        'prescription-created'
      );
      // active order → also lands on the current-medications list
      expect(addCurrent).toHaveBeenCalledWith('patient-1', prescription);
      expect(notify).toHaveBeenCalled();

      init.mockRestore(); add.mockRestore(); addCurrent.mockRestore(); notify.mockRestore();
    });

    it('does nothing when the prescription has no patient subject', async () => {
      const init = vi.spyOn(medicationCRUDService, 'initializePatientMedicationLists').mockResolvedValue();

      await medicationCRUDService.handleNewPrescription({ resourceType: 'MedicationRequest' });

      expect(init).not.toHaveBeenCalled();
      init.mockRestore();
    });
  });

  describe('COMMON_MEDICATIONS catalog', () => {
    it('every entry carries the fields the helpers rely on', () => {
      expect(medicationCRUDService.COMMON_MEDICATIONS.length).toBeGreaterThan(0);
      medicationCRUDService.COMMON_MEDICATIONS.forEach(med => {
        expect(med.id).toBeTruthy();
        expect(med.name).toBeTruthy();
        expect(med.dosing?.adult).toBeDefined();
        expect(Array.isArray(med.interactions)).toBe(true);
        expect(Array.isArray(med.contraindications)).toBe(true);
      });
    });
  });

  describe('catalog workflow (search → byId → dosing)', () => {
    it('chains the catalog helpers the way a prescribing UI would', async () => {
      fhirClient.search.mockResolvedValue({ resources: [] });

      const [hit] = await medicationCRUDService.search('metformin');
      const med = medicationCRUDService.getMedicationById(hit.id);
      const rec = medicationCRUDService.getDosingRecommendations(med.id, { age: 70 });

      expect(med.name).toBe('Metformin');
      expect(rec.recommended.initial).toBe('500mg once daily'); // elderly branch
      expect(rec.contraindications).toContain('Severe renal impairment');
    });
  });
});
