/**
 * Medication Reconciliation Service
 * Comprehensive service for managing medication reconciliation workflows
 */

import { fhirClient } from './fhirClient';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';

class MedicationReconciliationService {
  constructor() {
    this.reconciliationCache = new Map();
  }


  /**
   * Medication source types for reconciliation
   */
  MEDICATION_SOURCES = {
    HOME: 'home',
    HOSPITAL: 'hospital',
    DISCHARGE: 'discharge',
    PHARMACY: 'pharmacy',
    EXTERNAL: 'external'
  };

  /**
   * Reconciliation action types
   */
  RECONCILIATION_ACTIONS = {
    ADD: 'add',
    DISCONTINUE: 'discontinue',
    MODIFY: 'modify',
    CONTINUE: 'continue',
    HOLD: 'hold'
  };

  /**
   * Get comprehensive medication data for reconciliation
   */
  async getMedicationReconciliationData(patientId, encounterId = null) {
    try {
      const [
        medicationRequests,
        medicationStatements,
        medicationDispenses,
        encounterData
      ] = await Promise.all([
        this.fetchMedicationRequests(patientId),
        this.fetchMedicationStatements(patientId),
        this.fetchMedicationDispenses(patientId),
        encounterId ? this.fetchEncounterData(encounterId) : Promise.resolve(null)
      ]);

      // Categorize medications by source
      const categorizedMedications = this.categorizeMedicationsBySource({
        medicationRequests,
        medicationStatements,
        medicationDispenses,
        encounterId
      });

      // Analyze discrepancies and generate reconciliation recommendations
      const reconciliationAnalysis = this.analyzeReconciliationNeeds(categorizedMedications);

      return {
        medications: categorizedMedications,
        analysis: reconciliationAnalysis,
        encounter: encounterData,
        lastReconciled: await this.getLastReconciliationDate(patientId)
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch all medication requests for patient
   */
  async fetchMedicationRequests(patientId) {
    const response = await fhirClient.search('MedicationRequest', {
      patient: patientId,
      _sort: '-_lastUpdated',
      _count: 100,
      _include: 'MedicationRequest:medication'
    });

    return response.resources || [];
  }

  /**
   * Fetch medication statements (patient-reported medications)
   */
  async fetchMedicationStatements(patientId) {
    const response = await fhirClient.search('MedicationStatement', {
      subject: patientId,
      _sort: '-_lastUpdated',
      _count: 100,
      _include: 'MedicationStatement:medication'
    });

    return response.resources || [];
  }

  /**
   * Fetch medication dispenses (pharmacy records)
   */
  async fetchMedicationDispenses(patientId) {
    const response = await fhirClient.search('MedicationDispense', {
      patient: patientId,
      _sort: '-whenHandedOver',
      _count: 100
    });

    return response.resources || [];
  }

  /**
   * Fetch encounter data if provided
   */
  async fetchEncounterData(encounterId) {
    return await fhirClient.read('Encounter', encounterId);
  }

  /**
   * Categorize medications by their source/context
   */
  categorizeMedicationsBySource({ medicationRequests, medicationStatements, medicationDispenses, encounterId }) {
    const categorized = {
      [this.MEDICATION_SOURCES.HOME]: [],
      [this.MEDICATION_SOURCES.HOSPITAL]: [],
      [this.MEDICATION_SOURCES.DISCHARGE]: [],
      [this.MEDICATION_SOURCES.PHARMACY]: [],
      [this.MEDICATION_SOURCES.EXTERNAL]: []
    };

    // Process MedicationRequests
    medicationRequests.forEach(request => {
      const source = this.determineMedicationSource(request, 'MedicationRequest', encounterId);
      categorized[source].push({
        ...request,
        sourceType: 'MedicationRequest',
        source,
        medicationDisplay: this.extractMedicationDisplay(request),
        dosageDisplay: this.extractDosageDisplay(request)
      });
    });

    // Process MedicationStatements (typically home medications)
    medicationStatements.forEach(statement => {
      const source = this.determineMedicationSource(statement, 'MedicationStatement', encounterId);
      categorized[source].push({
        ...statement,
        sourceType: 'MedicationStatement',
        source,
        medicationDisplay: this.extractMedicationDisplay(statement),
        dosageDisplay: this.extractDosageDisplay(statement)
      });
    });

    // Process MedicationDispenses (pharmacy records)
    medicationDispenses.forEach(dispense => {
      categorized[this.MEDICATION_SOURCES.PHARMACY].push({
        ...dispense,
        sourceType: 'MedicationDispense',
        source: this.MEDICATION_SOURCES.PHARMACY,
        medicationDisplay: this.extractMedicationDisplay(dispense),
        dosageDisplay: this.extractDosageDisplay(dispense)
      });
    });

    return categorized;
  }

  /**
   * Determine the source of a medication based on context
   */
  determineMedicationSource(medication, resourceType, encounterId) {
    // Check for explicit category coding
    const category = medication.category?.[0]?.coding?.[0]?.code;
    if (category === 'discharge') return this.MEDICATION_SOURCES.DISCHARGE;
    if (category === 'inpatient') return this.MEDICATION_SOURCES.HOSPITAL;
    if (category === 'outpatient') return this.MEDICATION_SOURCES.HOME;

    // Check encounter context
    if (medication.encounter?.reference === `Encounter/${encounterId}`) {
      return this.MEDICATION_SOURCES.HOSPITAL;
    }

    // Check intent for MedicationRequests
    if (resourceType === 'MedicationRequest') {
      if (medication.intent === 'plan' && category === 'discharge') {
        return this.MEDICATION_SOURCES.DISCHARGE;
      }
      if (medication.intent === 'order' && encounterId) {
        return this.MEDICATION_SOURCES.HOSPITAL;
      }
    }

    // MedicationStatements are typically home medications
    if (resourceType === 'MedicationStatement') {
      return this.MEDICATION_SOURCES.HOME;
    }

    // Default to home medications for active prescriptions without context
    if (medication.status === 'active' && !medication.encounter) {
      return this.MEDICATION_SOURCES.HOME;
    }

    return this.MEDICATION_SOURCES.EXTERNAL;
  }

  /**
   * Extract medication display name from various resource types
   */
  extractMedicationDisplay(medication) {
    return medication.medicationCodeableConcept?.text ||
           medication.medicationCodeableConcept?.coding?.[0]?.display ||
           medication.medicationReference?.display ||
           'Unknown Medication';
  }

  /**
   * Extract dosage display from various resource types
   */
  extractDosageDisplay(medication) {
    if (medication.dosageInstruction?.[0]) {
      const dosage = medication.dosageInstruction[0];
      return dosage.text || this.buildDosageText(dosage);
    }
    return 'No dosage specified';
  }

  /**
   * Build dosage text from structured dosage instruction
   */
  buildDosageText(dosageInstruction) {
    const parts = [];
    
    const dose = dosageInstruction.doseAndRate?.[0]?.doseQuantity;
    if (dose) {
      parts.push(`${dose.value} ${dose.unit || dose.code}`);
    }

    const route = dosageInstruction.route?.text || dosageInstruction.route?.coding?.[0]?.display;
    if (route) {
      parts.push(route);
    }

    const timing = dosageInstruction.timing;
    if (timing?.code?.text) {
      parts.push(timing.code.text);
    } else if (timing?.repeat) {
      const repeat = timing.repeat;
      if (repeat.frequency && repeat.period && repeat.periodUnit) {
        parts.push(`${repeat.frequency} times per ${repeat.period} ${repeat.periodUnit}`);
      }
    }

    return parts.join(' ') || 'See instructions';
  }

  /**
   * Analyze medications for reconciliation needs
   */
  analyzeReconciliationNeeds(categorizedMedications) {
    const recommendations = [];
    const duplicates = [];
    const conflicts = [];

    // Create medication maps for comparison
    const homeMap = this.createMedicationMap(categorizedMedications[this.MEDICATION_SOURCES.HOME]);
    const hospitalMap = this.createMedicationMap(categorizedMedications[this.MEDICATION_SOURCES.HOSPITAL]);
    const dischargeMap = this.createMedicationMap(categorizedMedications[this.MEDICATION_SOURCES.DISCHARGE]);
    const pharmacyMap = this.createMedicationMap(categorizedMedications[this.MEDICATION_SOURCES.PHARMACY]);

    // Find medications to add (in hospital/discharge but not in home)
    this.findMedicationsToAdd(hospitalMap, homeMap, recommendations);
    this.findMedicationsToAdd(dischargeMap, homeMap, recommendations);

    // Find medications to discontinue
    this.findMedicationsToDiscontinue(homeMap, hospitalMap, dischargeMap, recommendations);

    // Find dosage modifications
    this.findDosageModifications(homeMap, hospitalMap, dischargeMap, recommendations);

    // Find duplicates across sources
    this.findDuplicateMedications(categorizedMedications, duplicates);

    // Find conflicts (same medication, different instructions)
    this.findMedicationConflicts(categorizedMedications, conflicts);

    return {
      recommendations,
      duplicates,
      conflicts,
      totalDiscrepancies: recommendations.length + duplicates.length + conflicts.length,
      lastAnalyzed: new Date().toISOString()
    };
  }

  /**
   * Create medication map for comparison (normalized medication names)
   */
  createMedicationMap(medications) {
    const map = new Map();
    medications.forEach(med => {
      const normalizedName = this.normalizeMedicationName(med.medicationDisplay);
      if (!map.has(normalizedName)) {
        map.set(normalizedName, []);
      }
      map.get(normalizedName).push(med);
    });
    return map;
  }

  /**
   * Normalize medication names for comparison
   */
  normalizeMedicationName(medicationName) {
    return medicationName
      .toLowerCase()
      .replace(/\s+\d+mg|\s+\d+mcg|\s+\d+g/gi, '') // Remove dosage
      .replace(/\s+tablet|\s+capsule|\s+liquid/gi, '') // Remove form
      .trim();
  }

  /**
   * Find medications that should be added
   */
  findMedicationsToAdd(sourceMap, targetMap, recommendations) {
    sourceMap.forEach((medications, normalizedName) => {
      if (!targetMap.has(normalizedName)) {
        medications.forEach(med => {
          if (med.status === 'active') {
            recommendations.push({
              id: `add-${med.id}`,
              action: this.RECONCILIATION_ACTIONS.ADD,
              medication: med,
              reason: `Active medication found in ${med.source} but not in current list`,
              priority: 'high',
              source: med.source
            });
          }
        });
      }
    });
  }

  /**
   * Find medications that should be discontinued
   */
  findMedicationsToDiscontinue(homeMap, hospitalMap, dischargeMap, recommendations) {
    homeMap.forEach((medications, normalizedName) => {
      medications.forEach(homeMed => {
        if (homeMed.status === 'active') {
          // Check if medication was stopped in hospital or discharge
          const hospitalMeds = hospitalMap.get(normalizedName) || [];
          const dischargeMeds = dischargeMap.get(normalizedName) || [];
          
          const wasDiscontinued = [...hospitalMeds, ...dischargeMeds].some(med => 
            ['stopped', 'cancelled', 'completed'].includes(med.status)
          );

          if (wasDiscontinued) {
            recommendations.push({
              id: `discontinue-${homeMed.id}`,
              action: this.RECONCILIATION_ACTIONS.DISCONTINUE,
              medication: homeMed,
              reason: 'Medication was discontinued during hospital stay or discharge',
              priority: 'high',
              source: homeMed.source
            });
          }
        }
      });
    });
  }

  /**
   * Find dosage modifications needed
   */
  findDosageModifications(homeMap, hospitalMap, dischargeMap, recommendations) {
    homeMap.forEach((medications, normalizedName) => {
      medications.forEach(homeMed => {
        if (homeMed.status === 'active') {
          // Check for dosage changes in hospital or discharge
          const allOtherMeds = [
            ...(hospitalMap.get(normalizedName) || []),
            ...(dischargeMap.get(normalizedName) || [])
          ];

          allOtherMeds.forEach(otherMed => {
            if (otherMed.status === 'active' && 
                homeMed.dosageDisplay !== otherMed.dosageDisplay) {
              recommendations.push({
                id: `modify-${homeMed.id}`,
                action: this.RECONCILIATION_ACTIONS.MODIFY,
                medication: homeMed,
                newDosage: otherMed.dosageDisplay,
                reason: `Dosage change recommended based on ${otherMed.source}`,
                priority: 'medium',
                source: otherMed.source
              });
            }
          });
        }
      });
    });
  }

  /**
   * Find duplicate medications across sources
   */
  findDuplicateMedications(categorizedMedications, duplicates) {
    const allMedications = Object.values(categorizedMedications).flat();
    const medicationGroups = new Map();

    // Group by normalized name
    allMedications.forEach(med => {
      const normalizedName = this.normalizeMedicationName(med.medicationDisplay);
      if (!medicationGroups.has(normalizedName)) {
        medicationGroups.set(normalizedName, []);
      }
      medicationGroups.get(normalizedName).push(med);
    });

    // Find groups with multiple active medications
    medicationGroups.forEach((medications, normalizedName) => {
      const activeMeds = medications.filter(med => med.status === 'active');
      if (activeMeds.length > 1) {
        duplicates.push({
          medicationName: normalizedName,
          medications: activeMeds,
          count: activeMeds.length,
          sources: [...new Set(activeMeds.map(med => med.source))]
        });
      }
    });
  }

  /**
   * Find medication conflicts
   */
  findMedicationConflicts(categorizedMedications, conflicts) {
    // Implementation for finding conflicts (same medication, different dosages, etc.)
    // This would involve more complex analysis of drug interactions, contraindications, etc.
  }

  /**
   * Execute reconciliation changes
   */
  async executeReconciliation(patientId, changes, encounterId = null) {
    const results = [];

    for (const change of changes) {
      try {
        let result;
        switch (change.action) {
          case this.RECONCILIATION_ACTIONS.ADD:
            result = await this.addMedication(patientId, change, encounterId);
            break;
          case this.RECONCILIATION_ACTIONS.DISCONTINUE:
            result = await this.discontinueMedication(change.medication);
            break;
          case this.RECONCILIATION_ACTIONS.MODIFY:
            result = await this.modifyMedication(change.medication, change.newDosage);
            break;
          default:
            result = { success: false, error: 'Unknown action type' };
        }
        
        results.push({ change, result });
      } catch (error) {
        results.push({ change, result: { success: false, error: error.message } });
      }
    }

    // Create reconciliation documentation
    await this.documentReconciliation(patientId, changes, results, encounterId);

    return results;
  }

  /**
   * Add a new medication to the patient's list
   */
  async addMedication(patientId, change, encounterId) {
    const medicationRequest = {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      subject: { reference: `Patient/${patientId}` },
      encounter: encounterId ? { reference: `Encounter/${encounterId}` } : undefined,
      medicationCodeableConcept: change.medication.medicationCodeableConcept,
      dosageInstruction: change.medication.dosageInstruction,
      authoredOn: new Date().toISOString(),
      note: [{
        text: `Added during medication reconciliation: ${change.reason}`
      }],
      extension: [{
        url: 'http://example.org/fhir/reconciliation-action',
        valueCode: 'reconciliation-add'
      }]
    };

    return await fhirClient.create('MedicationRequest', medicationRequest);
  }

  /**
   * Discontinue a medication
   */
  async discontinueMedication(medication) {
    const updatedMedication = {
      ...medication,
      status: 'stopped',
      statusReason: [{
        text: 'Discontinued during medication reconciliation'
      }]
    };

    return await fhirClient.update(medication.sourceType, updatedMedication);
  }

  /**
   * Modify medication dosage
   */
  async modifyMedication(medication, newDosage) {
    // In practice, this would create a new MedicationRequest and stop the old one
    const updatedMedication = {
      ...medication,
      dosageInstruction: [{
        text: newDosage
      }],
      note: [
        ...(medication.note || []),
        {
          text: `Dosage modified during reconciliation to: ${newDosage}`
        }
      ]
    };

    return await fhirClient.update(medication.sourceType, updatedMedication);
  }

  /**
   * Document the reconciliation process
   */
  async documentReconciliation(patientId, changes, results, encounterId) {
    const documentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '56445-0',
          display: 'Medication reconciliation document'
        }]
      },
      subject: { reference: `Patient/${patientId}` },
      context: encounterId ? {
        encounter: [{ reference: `Encounter/${encounterId}` }]
      } : undefined,
      date: new Date().toISOString(),
      content: [{
        attachment: {
          contentType: 'application/json',
          data: Buffer.from(JSON.stringify({
            reconciliationDate: new Date().toISOString(),
            changesRequested: changes.length,
            changesApplied: results.filter(r => r.result.success).length,
            changesFailed: results.filter(r => !r.result.success).length,
            details: results
          })).toString('base64')
        }
      }]
    };

    return await fhirClient.create('DocumentReference', documentReference);
  }

  /**
   * Get last reconciliation date for patient
   */
  async getLastReconciliationDate(patientId) {
    try {
      const response = await fhirClient.search('DocumentReference', {
        patient: patientId,
        type: 'http://loinc.org|56445-0', // Medication reconciliation document
        _sort: '-date',
        _count: 1
      });

      if (response.resources && response.resources.length > 0) {
        return response.resources[0].date;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear reconciliation cache
   */
  clearCache(patientId = null) {
    if (patientId) {
      this.reconciliationCache.delete(patientId);
    } else {
      this.reconciliationCache.clear();
    }
  }
}

// Export singleton instance
export const medicationReconciliationService = new MedicationReconciliationService();