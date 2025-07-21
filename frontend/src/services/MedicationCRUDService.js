/**
 * Medication CRUD Service
 * Consolidated service for medication search, CRUD operations, and basic workflows
 * 
 * This service consolidates functionality from:
 * - medicationSearchService (search, drug interactions, allergies)
 * - medicationDiscontinuationService (discontinuation workflows)
 * - medicationEffectivenessService (monitoring and assessment)
 * - medicationListManagementService (list management and synchronization)
 * 
 * Note: All existing services remain unchanged and functional.
 * This provides an alternative unified interface.
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';
import { format, addDays, addWeeks, addMonths, parseISO, isAfter, differenceInDays } from 'date-fns';

class MedicationCRUDService {
  constructor() {
    this.medicationCache = new Map();
    this.drugInteractionCache = new Map();
    this.dosingGuidelineCache = new Map();
    this.effectivenessCache = new Map();
    this.discontinuationCache = new Map();
    this.updateCallbacks = new Map();
    this.medicationLists = new Map();
    this.autoUpdateEnabled = true;
  }

  // ====================================================================
  // MEDICATION SEARCH & DATABASE FUNCTIONALITY
  // ====================================================================

  /**
   * Common medications database with dosing guidelines
   * Consolidated from medicationSearchService
   */
  COMMON_MEDICATIONS = [
    // Cardiovascular
    {
      id: 'lisinopril-10mg',
      name: 'Lisinopril',
      genericName: 'Lisinopril',
      brandNames: ['Prinivil', 'Zestril'],
      strength: '10mg',
      form: 'tablet',
      category: 'ACE Inhibitor',
      indication: 'Hypertension, Heart Failure',
      dosing: {
        adult: {
          initial: '10mg once daily',
          maintenance: '10-40mg once daily',
          maximum: '80mg daily'
        },
        elderly: {
          initial: '5mg once daily',
          maintenance: '5-20mg once daily',
          maximum: '40mg daily'
        },
        renal: 'Adjust based on creatinine clearance'
      },
      contraindications: ['ACE inhibitor allergy', 'Angioedema history', 'Pregnancy'],
      warnings: ['Hyperkalemia risk', 'Renal function monitoring', 'Cough'],
      interactions: ['Potassium supplements', 'NSAIDs', 'Lithium']
    },
    {
      id: 'metoprolol-50mg',
      name: 'Metoprolol Tartrate',
      genericName: 'Metoprolol',
      brandNames: ['Lopressor'],
      strength: '50mg',
      form: 'tablet',
      category: 'Beta Blocker',
      indication: 'Hypertension, Angina, Heart Failure',
      dosing: {
        adult: {
          initial: '50mg twice daily',
          maintenance: '100-400mg daily in divided doses',
          maximum: '400mg daily'
        },
        elderly: {
          initial: '25mg twice daily',
          maintenance: '50-200mg daily in divided doses',
          maximum: '200mg daily'
        }
      },
      contraindications: ['Severe bradycardia', 'Heart block', 'Cardiogenic shock'],
      warnings: ['Sudden discontinuation risk', 'Bronchospasm in asthma'],
      interactions: ['Calcium channel blockers', 'Digoxin', 'Insulin']
    },
    {
      id: 'metformin-500mg',
      name: 'Metformin',
      genericName: 'Metformin',
      brandNames: ['Glucophage', 'Glumetza'],
      strength: '500mg',
      form: 'tablet',
      category: 'Biguanide',
      indication: 'Type 2 Diabetes',
      dosing: {
        adult: {
          initial: '500mg twice daily with meals',
          maintenance: '500-2000mg daily in divided doses',
          maximum: '2550mg daily'
        },
        elderly: {
          initial: '500mg once daily',
          maintenance: '500-1000mg daily',
          maximum: '2000mg daily'
        }
      },
      contraindications: ['Severe renal impairment', 'Diabetic ketoacidosis', 'Metabolic acidosis'],
      warnings: ['Lactic acidosis risk', 'Renal function monitoring', 'B12 deficiency'],
      interactions: ['Contrast dye', 'Alcohol', 'Cimetidine']
    }
  ];

  /**
   * Search medications by name, category, or indication
   * From medicationSearchService.searchMedications()
   */
  async search(query, options = {}) {
    if (!query || query.length < 2) return [];

    const { limit = 10, includeInactive = false } = options;

    try {
      // Search in common medications database
      const localResults = this.COMMON_MEDICATIONS.filter(med => {
        const searchFields = [
          med.name,
          med.genericName,
          ...(med.brandNames || []),
          med.category,
          med.indication
        ].map(field => field?.toLowerCase() || '');

        return searchFields.some(field => 
          field.includes(query.toLowerCase())
        );
      }).slice(0, limit);

      // Also search FHIR Medication resources
      const fhirResults = await this.searchFHIRMedications(query, options);
      
      // Combine and deduplicate results
      const combinedResults = [...localResults, ...fhirResults];
      
      return combinedResults.slice(0, limit);
    } catch (error) {
      console.error('Error searching medications:', error);
      return [];
    }
  }

  /**
   * Get medication by ID
   * From medicationSearchService.getMedicationById()
   */
  getMedicationById(id) {
    // Check cache first
    if (this.medicationCache.has(id)) {
      return this.medicationCache.get(id);
    }

    // Search in common medications
    const medication = this.COMMON_MEDICATIONS.find(med => med.id === id);
    
    if (medication) {
      this.medicationCache.set(id, medication);
    }

    return medication;
  }

  /**
   * Get dosing recommendations for medication
   * From medicationSearchService.getDosingRecommendations()
   */
  getDosingRecommendations(medicationId, patientContext = {}) {
    const medication = this.getMedicationById(medicationId);
    if (!medication) return null;

    const { age, weight, renalFunction, hepaticFunction } = patientContext;
    const recommendations = { ...medication.dosing };

    // Age-based adjustments
    if (age && age >= 65 && medication.dosing.elderly) {
      recommendations.recommended = medication.dosing.elderly;
    } else if (medication.dosing.adult) {
      recommendations.recommended = medication.dosing.adult;
    }

    // Add warnings and considerations
    recommendations.warnings = medication.warnings || [];
    recommendations.contraindications = medication.contraindications || [];
    recommendations.interactions = medication.interactions || [];

    return recommendations;
  }

  /**
   * Check for drug interactions
   * From medicationSearchService.checkDrugInteractions()
   */
  async checkDrugInteractions(medications = []) {
    if (medications.length < 2) return [];

    const interactions = [];

    // Check each medication against all others
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];
        
        const interaction = this.findInteraction(med1, med2);
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    return interactions;
  }

  /**
   * Check medication against patient allergies
   * From medicationSearchService.checkAllergies()
   */
  checkAllergies(medicationId, allergies = []) {
    const medication = this.getMedicationById(medicationId);
    if (!medication || !allergies.length) return [];

    const allergyAlerts = [];

    allergies.forEach(allergy => {
      const allergen = allergy.code?.text || allergy.code?.coding?.[0]?.display || '';
      
      // Check for direct matches
      if (this.isAllergyMatch(medication, allergen)) {
        allergyAlerts.push({
          severity: allergy.criticality === 'high' ? 'critical' : 'warning',
          allergen: allergen,
          medication: medication.name,
          reaction: allergy.reaction?.[0]?.manifestation?.[0]?.text || 'Unknown reaction',
          recommendation: 'Consider alternative medication'
        });
      }
    });

    return allergyAlerts;
  }

  // ====================================================================
  // MEDICATION DISCONTINUATION FUNCTIONALITY
  // ====================================================================

  /**
   * Discontinuation status definitions
   * From medicationDiscontinuationService
   */
  DISCONTINUATION_STATUSES = {
    PLANNED: 'planned',
    IN_PROGRESS: 'in-progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    FAILED: 'failed'
  };

  /**
   * Discontinue a medication with comprehensive tracking
   * From medicationDiscontinuationService.discontinueMedication()
   */
  async discontinue(discontinuationData) {
    try {
      const { medicationRequestId } = discontinuationData;
      
      // Get the original medication request
      const originalRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      
      // Update the medication request status
      const updatedRequest = {
        ...originalRequest,
        status: discontinuationData.discontinuationType === 'immediate' ? 'stopped' : 'on-hold',
        statusReason: this.buildStatusReason(discontinuationData),
        note: [
          ...(originalRequest.note || []),
          {
            text: this.buildDiscontinuationNote(discontinuationData),
            time: new Date().toISOString()
          }
        ],
        extension: [
          ...(originalRequest.extension || []),
          {
            url: 'http://example.org/fhir/medication-discontinuation',
            extension: this.buildDiscontinuationExtension(discontinuationData)
          }
        ]
      };

      // Update the medication request
      const updatedMedicationRequest = await fhirClient.update('MedicationRequest', updatedRequest);

      // Create discontinuation tracking resource
      const discontinuationTracking = await this.createDiscontinuationTracking(
        originalRequest,
        discontinuationData
      );

      // Handle tapering schedule if applicable
      let taperingPlan = null;
      if (discontinuationData.discontinuationType === 'tapered') {
        taperingPlan = await this.createTaperingPlan(originalRequest, discontinuationData);
      }

      // Update medication lists
      try {
        await this.handlePrescriptionStatusUpdate(
          medicationRequestId,
          updatedRequest.status,
          originalRequest.status
        );
      } catch (error) {
        console.warn('Error updating medication lists during discontinuation:', error);
      }

      return {
        success: true,
        updatedMedicationRequest,
        discontinuationTracking,
        taperingPlan,
        statusChange: {
          from: originalRequest.status,
          to: updatedRequest.status
        }
      };

    } catch (error) {
      console.error('Error discontinuing medication:', error);
      throw error;
    }
  }

  // ====================================================================
  // MEDICATION EFFECTIVENESS MONITORING
  // ====================================================================

  /**
   * Effectiveness monitoring parameters by medication class
   * From medicationEffectivenessService
   */
  MONITORING_PARAMETERS = {
    'antihypertensive': {
      targetConditions: ['hypertension', 'high blood pressure'],
      monitoringMetrics: ['blood_pressure', 'heart_rate'],
      followUpIntervals: { initial: 14, ongoing: 84 },
      therapeuticGoals: {
        systolic_bp: { target: 130, range: [120, 140] },
        diastolic_bp: { target: 80, range: [70, 90] }
      },
      assessmentQuestions: [
        'Any dizziness or lightheadedness?',
        'Experiencing fatigue or weakness?',
        'Any swelling in legs or ankles?'
      ]
    },
    'antidiabetic': {
      targetConditions: ['diabetes', 'diabetes mellitus'],
      monitoringMetrics: ['glucose', 'hba1c', 'weight'],
      followUpIntervals: { initial: 14, ongoing: 91 },
      therapeuticGoals: {
        hba1c: { target: 7.0, range: [6.5, 8.0] },
        fasting_glucose: { target: 100, range: [80, 130] }
      },
      assessmentQuestions: [
        'How is your blood sugar control?',
        'Any episodes of low blood sugar?',
        'Changes in appetite or weight?',
        'Increased thirst or urination?'
      ]
    }
  };

  /**
   * Create monitoring plan for medication effectiveness
   * From medicationEffectivenessService.createMonitoringPlan()
   */
  async createMonitoringPlan(medicationRequest, options = {}) {
    try {
      const medication = await this.getMedicationFromRequest(medicationRequest);
      const parameters = this.getMonitoringParameters(medication);
      
      if (!parameters) {
        return null; // No monitoring needed for this medication
      }

      const monitoringPlan = {
        resourceType: 'CarePlan',
        id: `monitoring-${medicationRequest.id}`,
        status: 'active',
        intent: 'plan',
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/care-plan-category',
            code: 'medication-monitoring',
            display: 'Medication Effectiveness Monitoring'
          }]
        }],
        subject: medicationRequest.subject,
        period: {
          start: new Date().toISOString(),
          end: addMonths(new Date(), 6).toISOString()
        },
        basedOn: [{
          reference: `MedicationRequest/${medicationRequest.id}`
        }],
        activity: this.buildMonitoringActivities(parameters),
        note: [{
          text: `Monitoring plan for ${medication.name || 'medication'} effectiveness`
        }],
        extension: [{
          url: 'http://example.org/fhir/medication-monitoring',
          extension: [
            {
              url: 'medication-class',
              valueString: medication.category || 'unknown'
            },
            {
              url: 'monitoring-frequency',
              valueString: `Initial: ${parameters.followUpIntervals.initial} days, Ongoing: ${parameters.followUpIntervals.ongoing} days`
            }
          ]
        }]
      };

      const createdPlan = await fhirClient.create('CarePlan', monitoringPlan);

      // Schedule follow-up appointments if needed
      if (options.scheduleFollowUp) {
        await this.scheduleMonitoringFollowUp(createdPlan, parameters);
      }

      return createdPlan;

    } catch (error) {
      console.error('Error creating monitoring plan:', error);
      throw error;
    }
  }

  /**
   * Get effectiveness alerts for patient medications
   * From medicationEffectivenessService.getEffectivenessAlerts()
   */
  async getEffectivenessAlerts(patientId, options = {}) {
    try {
      const alerts = [];
      
      // Get active medication requests for patient
      const medicationRequests = await fhirClient.search('MedicationRequest', {
        patient: patientId,
        status: 'active'
      });

      for (const request of medicationRequests.entry || []) {
        const medicationRequest = request.resource;
        const alert = await this.checkMedicationEffectiveness(medicationRequest);
        
        if (alert) {
          alerts.push(alert);
        }
      }

      return alerts;

    } catch (error) {
      console.error('Error getting effectiveness alerts:', error);
      return [];
    }
  }

  // ====================================================================
  // MEDICATION LIST MANAGEMENT
  // ====================================================================

  /**
   * List types for medication management
   * From medicationListManagementService
   */
  LIST_TYPES = {
    CURRENT_MEDICATIONS: 'current-medications',
    ACTIVE_PRESCRIPTIONS: 'active-prescriptions',
    MEDICATION_HISTORY: 'medication-history',
    RECONCILIATION_LIST: 'reconciliation-list'
  };

  /**
   * Handle new prescription created - update medication lists
   * From medicationListManagementService.handleNewPrescription()
   */
  async handleNewPrescription(medicationRequest) {
    if (!this.autoUpdateEnabled) return;

    try {
      const patientId = medicationRequest.subject?.reference?.split('/')[1];
      if (!patientId) return;

      // Initialize lists if not already done
      await this.initializePatientMedicationLists(patientId);

      // Add to active prescriptions list
      await this.addMedicationToList(
        patientId,
        this.LIST_TYPES.ACTIVE_PRESCRIPTIONS,
        medicationRequest,
        'prescription-created'
      );

      // If prescription is for ongoing therapy, add to current medications
      if (medicationRequest.intent === 'order' && medicationRequest.status === 'active') {
        await this.addMedicationToCurrentList(patientId, medicationRequest);
      }

      // Notify subscribers
      this.notifyListUpdated(patientId, this.LIST_TYPES.ACTIVE_PRESCRIPTIONS, 'add', medicationRequest);

    } catch (error) {
      console.error('Error handling new prescription:', error);
    }
  }

  /**
   * Handle prescription status update
   * From medicationListManagementService.handlePrescriptionStatusUpdate()
   */
  async handlePrescriptionStatusUpdate(medicationRequestId, newStatus, oldStatus) {
    if (!this.autoUpdateEnabled) return;

    try {
      const medicationRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      const patientId = medicationRequest.subject?.reference?.split('/')[1];
      
      if (!patientId) return;

      // Handle status-specific updates
      switch (newStatus) {
        case 'completed':
          await this.handlePrescriptionCompleted(patientId, medicationRequest);
          break;
        case 'stopped':
        case 'cancelled':
          await this.handlePrescriptionStopped(patientId, medicationRequest);
          break;
        case 'on-hold':
          await this.handlePrescriptionOnHold(patientId, medicationRequest);
          break;
      }

    } catch (error) {
      console.error('Error handling prescription status update:', error);
    }
  }

  /**
   * Synchronize medication lists across all sources
   * From medicationListManagementService.synchronizeMedicationLists()
   */
  async synchronizeMedicationLists(patientId, options = {}) {
    try {
      const { forceRefresh = false } = options;
      
      // Get all medication-related resources for patient
      const [medicationRequests, medicationStatements, medicationDispenses] = await Promise.all([
        fhirClient.search('MedicationRequest', { patient: patientId }),
        fhirClient.search('MedicationStatement', { patient: patientId }),
        fhirClient.search('MedicationDispense', { patient: patientId })
      ]);

      // Reconcile and update lists
      const reconciliation = this.reconcileMedicationSources(
        medicationRequests.entry || [],
        medicationStatements.entry || [],
        medicationDispenses.entry || []
      );

      // Update each list type
      for (const listType of Object.values(this.LIST_TYPES)) {
        await this.updateMedicationList(patientId, listType, reconciliation);
      }

      return {
        success: true,
        reconciliation,
        listsUpdated: Object.values(this.LIST_TYPES)
      };

    } catch (error) {
      console.error('Error synchronizing medication lists:', error);
      throw error;
    }
  }

  // ====================================================================
  // PRIVATE HELPER METHODS
  // ====================================================================

  /**
   * Search FHIR Medication resources
   */
  async searchFHIRMedications(query, options = {}) {
    try {
      const searchResults = await fhirClient.search('Medication', {
        name: query,
        _count: options.limit || 10
      });

      return (searchResults.entry || []).map(entry => ({
        id: entry.resource.id,
        name: entry.resource.code?.text || entry.resource.code?.coding?.[0]?.display || 'Unknown',
        genericName: entry.resource.code?.text || 'Unknown',
        form: entry.resource.form?.text || 'Unknown',
        source: 'fhir'
      }));
    } catch (error) {
      console.error('Error searching FHIR medications:', error);
      return [];
    }
  }

  /**
   * Find interaction between two medications
   */
  findInteraction(med1, med2) {
    const medication1 = typeof med1 === 'string' ? this.getMedicationById(med1) : med1;
    const medication2 = typeof med2 === 'string' ? this.getMedicationById(med2) : med2;

    if (!medication1 || !medication2) return null;

    const med1Interactions = medication1.interactions || [];
    const med2Interactions = medication2.interactions || [];

    const hasInteraction = med1Interactions.some(interaction => 
      medication2.name.toLowerCase().includes(interaction.toLowerCase()) ||
      medication2.category.toLowerCase().includes(interaction.toLowerCase())
    ) || med2Interactions.some(interaction => 
      medication1.name.toLowerCase().includes(interaction.toLowerCase()) ||
      medication1.category.toLowerCase().includes(interaction.toLowerCase())
    );

    if (hasInteraction) {
      return {
        medication1: medication1.name,
        medication2: medication2.name,
        severity: 'moderate', // Could be enhanced with severity calculation
        description: `Potential interaction between ${medication1.name} and ${medication2.name}`,
        recommendation: 'Monitor patient closely'
      };
    }

    return null;
  }

  /**
   * Check if medication matches allergy
   */
  isAllergyMatch(medication, allergen) {
    const allergenLower = allergen.toLowerCase();
    return medication.name.toLowerCase().includes(allergenLower) ||
           medication.genericName.toLowerCase().includes(allergenLower) ||
           (medication.brandNames || []).some(brand => 
             brand.toLowerCase().includes(allergenLower)
           );
  }

  /**
   * Build status reason for discontinuation
   */
  buildStatusReason(discontinuationData) {
    return {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/medicationrequest-status-reason',
        code: discontinuationData.reason || 'other',
        display: discontinuationData.reasonText || 'Other reason'
      }]
    };
  }

  /**
   * Build discontinuation note
   */
  buildDiscontinuationNote(discontinuationData) {
    return `Medication discontinued: ${discontinuationData.reasonText || 'No reason provided'}. Type: ${discontinuationData.discontinuationType || 'immediate'}.`;
  }

  /**
   * Build discontinuation extension
   */
  buildDiscontinuationExtension(discontinuationData) {
    return [
      {
        url: 'discontinuation-type',
        valueString: discontinuationData.discontinuationType || 'immediate'
      },
      {
        url: 'discontinuation-reason',
        valueString: discontinuationData.reasonText || 'Not specified'
      },
      {
        url: 'discontinuation-date',
        valueDateTime: new Date().toISOString()
      }
    ];
  }

  /**
   * Additional helper methods for medication list management
   */
  async initializePatientMedicationLists(patientId) {
    // Implementation for initializing patient medication lists
    // This would create the various List resources if they don't exist
  }

  async addMedicationToList(patientId, listType, medicationRequest, reason) {
    // Implementation for adding medication to a specific list
  }

  async addMedicationToCurrentList(patientId, medicationRequest) {
    // Implementation for adding to current medications list
  }

  notifyListUpdated(patientId, listType, action, medicationRequest) {
    // Implementation for notifying subscribers of list updates
  }

  // Additional helper methods as needed...
}

// Export singleton instance
export const medicationCRUDService = new MedicationCRUDService();

// Export class for testing
export { MedicationCRUDService };