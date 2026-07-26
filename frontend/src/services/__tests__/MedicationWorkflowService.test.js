/**
 * Tests for MedicationWorkflowService — the reconciliation ANALYSIS pipeline.
 *
 * Scope matches the service's real surface: MedicationListManager and
 * useMedicationLists both run getMedicationReconciliation →
 * categorizeMedicationsBySource → analyzeReconciliationNeeds. That pipeline
 * was broken in three stacked ways until it was repaired:
 *   1. the UI called getMedicationReconciliation, which did not exist;
 *   2. the fetch helpers read `.entry` off fhirClient results, which expose
 *      `.resources`, so they always produced [];
 *   3. the sort params used `-authored-on` / `-whenhanded-over`, which HAPI
 *      rejects (real names: `authoredon`, `whenhandedover` — PR #234 family).
 * The tests below pin all three so none of them can quietly come back.
 */

import { medicationWorkflowService } from '../MedicationWorkflowService';
import { fhirClient } from '../../core/fhir/services/fhirClient';

vi.mock('../../core/fhir/services/fhirClient');

// Bare MedicationRequest fixtures. categorizeMedicationsBySource reads the
// category coding to place each med: outpatient→home, inpatient→hospital.
const homeMed = (id, text) => ({
  resourceType: 'MedicationRequest',
  id,
  status: 'active',
  intent: 'order',
  medicationCodeableConcept: { text },
  category: [{ coding: [{ code: 'outpatient' }] }],
  dosageInstruction: [{ text: 'once daily' }],
});
const hospitalMed = (id, text) => ({
  ...homeMed(id, text),
  category: [{ coding: [{ code: 'inpatient' }] }],
});

describe('MedicationWorkflowService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMedicationReconciliation', () => {
    it('fetches the three raw sources the pipeline consumes', async () => {
      fhirClient.search.mockResolvedValue({ resources: [], total: 0 });

      const data = await medicationWorkflowService.getMedicationReconciliation('patient-1');

      expect(fhirClient.search).toHaveBeenCalledTimes(3);
      expect(data).toEqual({
        medicationRequests: [],
        medicationStatements: [],
        medicationDispenses: [],
        encounterId: null,
      });
    });

    it("uses HAPI's real sort parameter names", async () => {
      fhirClient.search.mockResolvedValue({ resources: [] });

      await medicationWorkflowService.getMedicationReconciliation('patient-1');

      // Regression pins: '-authored-on' and '-whenhanded-over' are HAPI 400s.
      expect(fhirClient.search).toHaveBeenCalledWith(
        'MedicationRequest',
        expect.objectContaining({ patient: 'patient-1', _sort: '-authoredon' })
      );
      expect(fhirClient.search).toHaveBeenCalledWith(
        'MedicationDispense',
        expect.objectContaining({ patient: 'patient-1', _sort: '-whenhandedover' })
      );
    });

    it('reads .resources from fhirClient results (there is no .entry)', async () => {
      const meds = [homeMed('m1', 'Lisinopril 10mg')];
      fhirClient.search
        .mockResolvedValueOnce({ resources: meds })
        .mockResolvedValueOnce({ resources: [] })
        .mockResolvedValueOnce({ resources: [] });

      const data = await medicationWorkflowService.getMedicationReconciliation('p1');

      expect(data.medicationRequests).toEqual(meds);
    });
  });

  describe('categorizeMedicationsBySource', () => {
    it('routes requests into buckets by category coding', () => {
      const categorized = medicationWorkflowService.categorizeMedicationsBySource({
        medicationRequests: [
          homeMed('m1', 'Lisinopril 10mg'),
          hospitalMed('m2', 'Warfarin 5mg'),
        ],
        medicationStatements: [],
        medicationDispenses: [],
      });

      expect(categorized.home).toHaveLength(1);
      expect(categorized.home[0].name).toBe('Lisinopril 10mg');
      expect(categorized.hospital).toHaveLength(1);
      expect(categorized.hospital[0].name).toBe('Warfarin 5mg');
      expect(categorized.discharge).toEqual([]);
    });

    it('tolerates missing inputs', () => {
      const categorized = medicationWorkflowService.categorizeMedicationsBySource({});
      expect(categorized).toEqual({
        home: [], hospital: [], discharge: [], pharmacy: [], external: [],
      });
    });
  });

  describe('analyzeReconciliationNeeds', () => {
    it('flags hospital-only meds as new and home-only actives as discontinued', () => {
      const categorized = medicationWorkflowService.categorizeMedicationsBySource({
        medicationRequests: [
          homeMed('m1', 'Metformin 500mg'),      // active at home, absent in hospital
          hospitalMed('m2', 'Warfarin 5mg'),      // started in hospital, not at home
        ],
        medicationStatements: [],
        medicationDispenses: [],
      });

      const analysis = medicationWorkflowService.analyzeReconciliationNeeds(categorized);

      expect(analysis.summary.newMedications.map(m => m.name)).toEqual(['Warfarin 5mg']);
      expect(analysis.summary.discontinuedMedications.map(m => m.name)).toEqual(['Metformin 500mg']);
      const types = analysis.discrepancies.map(d => d.type).sort();
      expect(types).toEqual(['discontinued', 'new_medication']);
      // two high-severity discrepancies → medium risk per the service's scale
      expect(analysis.riskLevel).toBe('medium');
    });

    it('marks agreeing sources as continued — but still flags the cross-source duplicate', () => {
      const categorized = medicationWorkflowService.categorizeMedicationsBySource({
        medicationRequests: [
          homeMed('m1', 'Lisinopril 10mg'),
          hospitalMed('m2', 'Lisinopril 10mg'),
        ],
        medicationStatements: [],
        medicationDispenses: [],
      });

      const analysis = medicationWorkflowService.analyzeReconciliationNeeds(categorized);

      expect(analysis.summary.continuedMedications).toHaveLength(1);
      expect(analysis.summary.newMedications).toEqual([]);
      // Deliberate rule: the SAME med active in two sources is a duplicate
      // conflict (high severity) — the patient may be double-dosed if both
      // orders survive reconciliation. So "sources agree" is NOT low risk.
      expect(analysis.summary.conflicts.map(c => c.type)).toContain('duplicate');
      expect(analysis.riskLevel).toBe('medium');
    });

    it('is low risk when there is nothing to reconcile against', () => {
      const categorized = medicationWorkflowService.categorizeMedicationsBySource({
        medicationRequests: [hospitalMed('m2', 'Warfarin 5mg')],
        medicationStatements: [],
        medicationDispenses: [],
      });
      // one new med → one high-severity discrepancy → medium; empty → low
      const emptyAnalysis = medicationWorkflowService.analyzeReconciliationNeeds(
        medicationWorkflowService.categorizeMedicationsBySource({})
      );
      expect(emptyAnalysis.riskLevel).toBe('low');
      expect(emptyAnalysis.discrepancies).toEqual([]);
    });
  });

  describe('full UI pipeline', () => {
    it('runs fetch → categorize → analyze exactly as useMedicationLists does', async () => {
      fhirClient.search
        .mockResolvedValueOnce({ resources: [homeMed('m1', 'Metformin 500mg'), hospitalMed('m2', 'Warfarin 5mg')] })
        .mockResolvedValueOnce({ resources: [] })
        .mockResolvedValueOnce({ resources: [] });

      const medicationData = await medicationWorkflowService.getMedicationReconciliation('p1');
      const categorized = medicationWorkflowService.categorizeMedicationsBySource(medicationData);
      const analysis = medicationWorkflowService.analyzeReconciliationNeeds(categorized);

      expect(analysis.discrepancies.length).toBeGreaterThan(0);
      expect(analysis.recommendations).toBeInstanceOf(Array);
    });
  });
});
