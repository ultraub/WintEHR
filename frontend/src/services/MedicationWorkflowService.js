/**
 * Medication Workflow Service
 *
 * Scope (deliberately narrow): the medication-reconciliation ANALYSIS
 * pipeline the UI runs — getMedicationReconciliation (raw data) →
 * categorizeMedicationsBySource → analyzeReconciliationNeeds. Real
 * consumers: MedicationListManager and useMedicationLists.
 *
 * History: this began as a consolidation of the reconciliation / refill /
 * status / validation services, but those paths were never adopted (zero
 * callers) and partly never worked. They were removed — the standalone
 * services (medicationReconciliationService, prescriptionRefillService,
 * prescriptionStatusService, medicationWorkflowValidator) remain canonical.
 * Do not re-grow this file toward them; extend the standalone services.
 */

import { fhirClient } from '../core/fhir/services/fhirClient';

class MedicationWorkflowService {
  constructor() {
    this.reconciliationCache = new Map();
    this.refillCache = new Map();
    this.statusCache = new Map();
    this.statusUpdateCallbacks = new Map();
    this.adherenceThresholds = {
      excellent: 0.95,
      good: 0.85,
      fair: 0.70,
      poor: 0.50
    };
  }

  // ====================================================================
  // MEDICATION RECONCILIATION FUNCTIONALITY
  // ====================================================================

  /**
   * Medication source types for reconciliation
   * From medicationReconciliationService
   */
  MEDICATION_SOURCES = {
    HOME: 'home',
    HOSPITAL: 'hospital',
    DISCHARGE: 'discharge',
    PHARMACY: 'pharmacy',
    EXTERNAL: 'external'
  };

  /**
   * Fetch the raw medication data the reconciliation pipeline consumes.
   *
   * This is THE entry point the UI uses (MedicationListManager and
   * useMedicationLists both run: getMedicationReconciliation →
   * categorizeMedicationsBySource → analyzeReconciliationNeeds). It returns
   * RAW resources — categorization is the caller's next step, so returning
   * anything pre-categorized double-processes into empty analyses.
   *
   * History: the UI always called this name, but the service only ever
   * defined getMedicationReconciliationData — which also returned an
   * already-categorized shape. Every reconciliation analysis threw
   * TypeError, was swallowed by the caller's catch, and rendered as null.
   */
  async getMedicationReconciliation(patientId, encounterId = null) {
    const [medicationRequests, medicationStatements, medicationDispenses] = await Promise.all([
      this.fetchMedicationRequests(patientId),
      this.fetchMedicationStatements(patientId),
      this.fetchMedicationDispenses(patientId)
    ]);

    return { medicationRequests, medicationStatements, medicationDispenses, encounterId };
  }

  /**
   * Two corrections vs the never-reached originals:
   * - fhirClient.search returns { resources, total, bundle, pagination } —
   *   the originals read `.entry`, which is never present, so they always
   *   produced [].
   * - HAPI sort params are resource-specific and hyphen-free here:
   *   MedicationRequest sorts by `authoredon`, MedicationDispense by
   *   `whenhandedover`. The originals used `-authored-on` /
   *   `-whenhanded-over`, which HAPI rejects with HTTP 400 (same bug family
   *   as PR #234).
   */
  async fetchMedicationRequests(patientId) {
    const result = await fhirClient.search('MedicationRequest', {
      patient: patientId,
      _sort: '-authoredon'
    });
    return result.resources || [];
  }

  async fetchMedicationStatements(patientId) {
    const result = await fhirClient.search('MedicationStatement', {
      patient: patientId
    });
    return result.resources || [];
  }

  async fetchMedicationDispenses(patientId) {
    const result = await fhirClient.search('MedicationDispense', {
      patient: patientId,
      _sort: '-whenhandedover'
    });
    return result.resources || [];
  }

  // ====================================================================
  // PRIVATE HELPER METHODS
  // ====================================================================

  /**
   * Categorize medications by source
   */
  categorizeMedicationsBySource(medicationData) {
    const categorized = {
      home: [],
      hospital: [],
      discharge: [],
      pharmacy: [],
      external: []
    };

    // Process medication requests
    (medicationData.medicationRequests || []).forEach(request => {
      const resource = request.resource || request;
      
      // Determine source based on extensions, encounter context, or other metadata
      const source = this.determineMedicationSource(resource);
      
      const medicationInfo = {
        id: resource.id,
        name: this.extractMedicationName(resource),
        status: resource.status,
        dosage: resource.dosageInstruction?.[0],
        source: source,
        authoredOn: resource.authoredOn,
        prescriber: resource.requester?.display || 'Unknown',
        resource: resource
      };

      // Categorize by source
      switch (source) {
        case 'home':
          categorized.home.push(medicationInfo);
          break;
        case 'hospital':
          categorized.hospital.push(medicationInfo);
          break;
        case 'discharge':
          categorized.discharge.push(medicationInfo);
          break;
        case 'pharmacy':
          categorized.pharmacy.push(medicationInfo);
          break;
        default:
          categorized.external.push(medicationInfo);
      }
    });

    // Process medication statements
    (medicationData.medicationStatements || []).forEach(statement => {
      const resource = statement.resource || statement;
      
      const medicationInfo = {
        id: resource.id,
        name: this.extractMedicationName(resource),
        status: resource.status,
        dosage: resource.dosage?.[0],
        source: 'statement',
        effectivePeriod: resource.effectivePeriod,
        informationSource: resource.informationSource?.display || 'Patient reported',
        resource: resource
      };

      // Medication statements usually represent home medications
      categorized.home.push(medicationInfo);
    });

    // Process medication dispenses
    (medicationData.medicationDispenses || []).forEach(dispense => {
      const resource = dispense.resource || dispense;
      
      // Find corresponding request in categorized lists
      const prescription = resource.authorizingPrescription?.[0]?.reference;
      if (prescription) {
        const prescriptionId = prescription.split('/').pop();
        
        // Update the corresponding medication with dispense info
        Object.keys(categorized).forEach(category => {
          const med = categorized[category].find(m => m.id === prescriptionId);
          if (med) {
            med.lastDispensed = resource.whenHandedOver;
            med.quantityDispensed = resource.quantity;
            med.daysSupply = resource.daysSupply;
          }
        });
      }
    });

    return categorized;
  }

  /**
   * Analyze reconciliation needs
   */
  analyzeReconciliationNeeds(categorizedMedications) {
    const analysis = {
      discrepancies: [],
      recommendations: [],
      riskLevel: 'low',
      summary: {
        newMedications: [],
        continuedMedications: [],
        discontinuedMedications: [],
        modifiedMedications: [],
        conflicts: []
      }
    };

    const { home, hospital, discharge, pharmacy } = categorizedMedications;

    // Create medication maps for comparison
    const homeMedMap = this.createMedicationMap(home);
    const hospitalMedMap = this.createMedicationMap(hospital);
    const dischargeMedMap = discharge.length > 0 ? this.createMedicationMap(discharge) : null;

    // If we have discharge medications, use those as the primary source
    const primarySource = dischargeMedMap || hospitalMedMap;
    const primaryMeds = discharge.length > 0 ? discharge : hospital;

    // Analyze each medication from primary source
    primaryMeds.forEach(med => {
      const homeEquivalent = this.findEquivalentMedication(med, homeMedMap);
      
      if (!homeEquivalent) {
        // New medication started in hospital/at discharge
        analysis.summary.newMedications.push(med);
        analysis.discrepancies.push({
          type: 'new_medication',
          medication: med,
          severity: 'high',
          message: `New medication: ${med.name}`
        });
      } else if (this.isDosageChanged(med, homeEquivalent)) {
        // Medication continued but dosage changed
        analysis.summary.modifiedMedications.push(med);
        analysis.discrepancies.push({
          type: 'dosage_change',
          medication: med,
          previousDosage: homeEquivalent.dosage,
          newDosage: med.dosage,
          severity: 'medium',
          message: `Dosage changed for ${med.name}`
        });
      } else {
        // Medication continued unchanged
        analysis.summary.continuedMedications.push(med);
      }
    });

    // Check for discontinued medications
    home.forEach(homeMed => {
      const stillActive = this.findEquivalentMedication(homeMed, primarySource);
      
      if (!stillActive && homeMed.status === 'active') {
        analysis.summary.discontinuedMedications.push(homeMed);
        analysis.discrepancies.push({
          type: 'discontinued',
          medication: homeMed,
          severity: 'high',
          message: `Discontinued: ${homeMed.name}`
        });
      }
    });

    // Check for conflicts
    analysis.summary.conflicts = this.identifyMedicationConflicts(categorizedMedications);
    analysis.summary.conflicts.forEach(conflict => {
      analysis.discrepancies.push({
        type: 'conflict',
        medications: conflict.medications,
        severity: conflict.severity,
        message: conflict.message
      });
    });

    // Generate recommendations
    analysis.recommendations = this.generateReconciliationRecommendations(analysis.summary);

    // Calculate risk level
    const highSeverityCount = analysis.discrepancies.filter(d => d.severity === 'high').length;
    const mediumSeverityCount = analysis.discrepancies.filter(d => d.severity === 'medium').length;
    
    if (highSeverityCount > 2 || (highSeverityCount > 0 && mediumSeverityCount > 3)) {
      analysis.riskLevel = 'high';
    } else if (highSeverityCount > 0 || mediumSeverityCount > 2) {
      analysis.riskLevel = 'medium';
    }

    return analysis;
  }

  /**
   * Extract medication name from request
   */
  extractMedicationName(medicationRequest) {
    return medicationRequest.medicationCodeableConcept?.text ||
           medicationRequest.medicationCodeableConcept?.coding?.[0]?.display ||
           'Unknown medication';
  }

  /**
   * Determine medication source from resource metadata
   */
  determineMedicationSource(medicationRequest) {
    // Check extensions for source information
    const sourceExtension = medicationRequest.extension?.find(
      ext => ext.url === 'http://wintehr.local/fhir/fhir/medication-source'
    );
    if (sourceExtension) {
      return sourceExtension.valueString;
    }

    // Check category
    const category = medicationRequest.category?.[0]?.coding?.[0]?.code;
    if (category === 'discharge') return 'discharge';
    if (category === 'inpatient') return 'hospital';
    if (category === 'outpatient') return 'home';
    if (category === 'community') return 'pharmacy';

    // Check encounter type
    if (medicationRequest.encounter) {
      // Would need to fetch encounter to determine type
      // For now, assume hospital if has encounter
      return 'hospital';
    }

    // Default to home
    return 'home';
  }

  /**
   * Create a map of medications by their identifying characteristics
   */
  createMedicationMap(medications) {
    const map = new Map();
    
    medications.forEach(med => {
      // Use RxNorm code if available, otherwise use name
      const code = med.resource?.medicationCodeableConcept?.coding?.[0]?.code;
      const key = code || med.name.toLowerCase();
      
      map.set(key, med);
    });

    return map;
  }

  /**
   * Find equivalent medication in a map
   */
  findEquivalentMedication(medication, medicationMap) {
    const code = medication.resource?.medicationCodeableConcept?.coding?.[0]?.code;
    const key = code || medication.name.toLowerCase();
    
    return medicationMap.get(key) || null;
  }

  /**
   * Check if dosage has changed between two medications
   */
  isDosageChanged(med1, med2) {
    const dosage1 = med1.dosage;
    const dosage2 = med2.dosage;

    if (!dosage1 || !dosage2) return false;

    // Compare dose amounts
    const dose1 = dosage1.doseAndRate?.[0]?.doseQuantity;
    const dose2 = dosage2.doseAndRate?.[0]?.doseQuantity;

    if (dose1?.value !== dose2?.value || dose1?.unit !== dose2?.unit) {
      return true;
    }

    // Compare timing
    const timing1 = dosage1.timing?.repeat;
    const timing2 = dosage2.timing?.repeat;

    if (timing1?.frequency !== timing2?.frequency || 
        timing1?.period !== timing2?.period ||
        timing1?.periodUnit !== timing2?.periodUnit) {
      return true;
    }

    return false;
  }

  /**
   * Identify medication conflicts
   */
  identifyMedicationConflicts(categorizedMedications) {
    const conflicts = [];
    const allActiveMeds = [
      ...categorizedMedications.home.filter(m => m.status === 'active'),
      ...categorizedMedications.hospital.filter(m => m.status === 'active'),
      ...categorizedMedications.discharge.filter(m => m.status === 'active')
    ];

    // Check for duplicates
    const medsByName = new Map();
    allActiveMeds.forEach(med => {
      const name = med.name.toLowerCase();
      if (medsByName.has(name)) {
        const existing = medsByName.get(name);
        if (existing.source !== med.source) {
          conflicts.push({
            type: 'duplicate',
            medications: [existing, med],
            severity: 'high',
            message: `${med.name} appears in multiple sources with potentially different instructions`
          });
        }
      } else {
        medsByName.set(name, med);
      }
    });

    // Check for therapeutic duplications
    const therapeuticClasses = new Map();
    allActiveMeds.forEach(med => {
      const therapeuticClass = this.getTherapeuticClass(med);
      if (therapeuticClass) {
        if (therapeuticClasses.has(therapeuticClass)) {
          const existing = therapeuticClasses.get(therapeuticClass);
          conflicts.push({
            type: 'therapeutic_duplication',
            medications: [existing, med],
            severity: 'medium',
            message: `Multiple medications from same therapeutic class: ${therapeuticClass}`
          });
        } else {
          therapeuticClasses.set(therapeuticClass, med);
        }
      }
    });

    return conflicts;
  }

  /**
   * Get therapeutic class for a medication
   */
  getTherapeuticClass(medication) {
    // This would typically look up the medication's therapeutic class
    // For now, return a simplified mapping
    const name = medication.name.toLowerCase();
    
    if (name.includes('pril') || name.includes('sartan')) return 'antihypertensive';
    if (name.includes('statin')) return 'lipid-lowering';
    if (name.includes('metformin') || name.includes('glipizide')) return 'antidiabetic';
    if (name.includes('aspirin') || name.includes('plavix')) return 'antiplatelet';
    
    return null;
  }

  /**
   * Generate reconciliation recommendations
   */
  generateReconciliationRecommendations(summary) {
    const recommendations = [];

    // High priority: new medications
    if (summary.newMedications.length > 0) {
      recommendations.push({
        type: 'action_required',
        priority: 'high',
        message: `Start ${summary.newMedications.length} new medication(s)`,
        medications: summary.newMedications
      });
    }

    // High priority: discontinued medications
    if (summary.discontinuedMedications.length > 0) {
      recommendations.push({
        type: 'action_required',
        priority: 'high',
        message: `Discontinue ${summary.discontinuedMedications.length} medication(s)`,
        medications: summary.discontinuedMedications
      });
    }

    // High priority: modified medications
    if (summary.modifiedMedications.length > 0) {
      recommendations.push({
        type: 'action_required',
        priority: 'high',
        message: `Update dosage for ${summary.modifiedMedications.length} medication(s)`,
        medications: summary.modifiedMedications
      });
    }

    // Medium priority: conflicts
    if (summary.conflicts.length > 0) {
      recommendations.push({
        type: 'review_required',
        priority: 'medium',
        message: `Review ${summary.conflicts.length} potential conflict(s)`,
        conflicts: summary.conflicts
      });
    }

    // Information: continued medications
    if (summary.continuedMedications.length > 0) {
      recommendations.push({
        type: 'information',
        priority: 'low',
        message: `Continue ${summary.continuedMedications.length} medication(s) unchanged`,
        medications: summary.continuedMedications
      });
    }

    return recommendations;
  }
}

// Export singleton instance
export const medicationWorkflowService = new MedicationWorkflowService();

// Export class for testing
export { MedicationWorkflowService };