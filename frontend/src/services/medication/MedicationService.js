/**
 * MedicationService - Unified Facade for Medication Operations
 *
 * This service provides a clean, unified API for medication operations
 * by consolidating access to multiple underlying medication services:
 *
 * - MedicationCRUDService: Search, CRUD, interactions
 * - MedicationWorkflowService: Reconciliation, refills, adherence
 * - MedicationAdministrationService: MAR, administration records
 * - MedicationDispenseService: Pharmacy dispensing
 * - MedicationDiscontinuationService: Discontinuation workflows
 * - MedicationListManagementService: List management
 * - MedicationReconciliationService: Reconciliation analysis
 * - MedicationSearchService: Advanced search
 *
 * Usage:
 *   import { medicationService } from '@/services/medication';
 *   const results = await medicationService.search('aspirin');
 *   const interactions = await medicationService.checkInteractions(patientId, medicationId);
 */

import { medicationCRUDService } from '../MedicationCRUDService';
import { medicationWorkflowService } from '../MedicationWorkflowService';
import { medicationAdministrationService } from '../medicationAdministrationService';
import { medicationDispenseService } from '../medicationDispenseService';
import { medicationDiscontinuationService } from '../medicationDiscontinuationService';
import { medicationListManagementService } from '../medicationListManagementService';
import { medicationReconciliationService } from '../medicationReconciliationService';
import { medicationSearchService } from '../medicationSearchService';

/**
 * Unified Medication Service
 */
class MedicationService {
  constructor() {
    // Underlying services
    this.crud = medicationCRUDService;
    this.workflow = medicationWorkflowService;
    this.administration = medicationAdministrationService;
    this.dispense = medicationDispenseService;
    this.discontinuation = medicationDiscontinuationService;
    this.list = medicationListManagementService;
    this.reconciliation = medicationReconciliationService;
    this.searchService = medicationSearchService;
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search for medications
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    return this.searchService.searchMedications(query, options);
  }

  /**
   * Get medication by ID
   * @param {string} medicationId - Medication ID
   * @returns {Promise<Object>} Medication details
   */
  async getById(medicationId) {
    return this.crud.getMedicationById(medicationId);
  }

  /**
   * Get dosing recommendations for a medication
   * @param {string} medicationId - Medication ID
   * @param {Object} patientContext - Patient context (weight, age, etc.)
   * @returns {Promise<Object>} Dosing recommendations
   */
  async getDosingRecommendations(medicationId, patientContext = {}) {
    return this.crud.getDosingRecommendations(medicationId, patientContext);
  }

  // ============================================================================
  // Safety Checks
  // ============================================================================

  /**
   * Check for drug interactions
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - Medication ID to check
   * @returns {Promise<Array>} Interaction warnings
   */
  async checkInteractions(patientId, medicationId) {
    return this.crud.checkDrugInteractions(patientId, medicationId);
  }

  /**
   * Check for allergy conflicts
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - Medication ID to check
   * @returns {Promise<Array>} Allergy warnings
   */
  async checkAllergies(patientId, medicationId) {
    return this.crud.checkAllergies(patientId, medicationId);
  }

  /**
   * Perform comprehensive safety check (interactions + allergies)
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - Medication ID to check
   * @returns {Promise<Object>} Safety check results
   */
  async performSafetyCheck(patientId, medicationId) {
    const [interactions, allergies] = await Promise.all([
      this.checkInteractions(patientId, medicationId),
      this.checkAllergies(patientId, medicationId)
    ]);

    return {
      safe: interactions.length === 0 && allergies.length === 0,
      interactions,
      allergies,
      warnings: [...interactions, ...allergies]
    };
  }

  // ============================================================================
  // List Management
  // ============================================================================

  /**
   * Get patient medication lists
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Medication lists
   */
  async getPatientLists(patientId) {
    return this.crud.getPatientMedicationLists(patientId);
  }

  /**
   * Add medication to patient's current list
   * @param {string} patientId - Patient ID
   * @param {Object} medication - Medication to add
   * @returns {Promise<Object>} Updated list
   */
  async addToCurrentList(patientId, medication) {
    return this.list.addMedicationToCurrentList(patientId, medication);
  }

  /**
   * Remove medication from a list
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - Medication ID
   * @param {string} listType - List type (current, historical, etc.)
   * @returns {Promise<boolean>} Success status
   */
  async removeFromList(patientId, medicationId, listType = 'current') {
    return this.list.removeMedicationFromList(patientId, medicationId, listType);
  }

  /**
   * Get patient medication summary
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Medication summary
   */
  async getPatientSummary(patientId) {
    return this.list.getPatientMedicationSummary(patientId);
  }

  // ============================================================================
  // Reconciliation
  // ============================================================================

  /**
   * Get medication reconciliation data
   * @param {string} patientId - Patient ID
   * @param {string} encounterId - Encounter ID
   * @returns {Promise<Object>} Reconciliation data
   */
  async getReconciliationData(patientId, encounterId) {
    return this.reconciliation.getMedicationReconciliationData(patientId, encounterId);
  }

  /**
   * Analyze reconciliation needs
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Reconciliation needs analysis
   */
  async analyzeReconciliationNeeds(patientId) {
    return this.reconciliation.analyzeReconciliationNeeds(patientId);
  }

  /**
   * Execute reconciliation actions
   * @param {string} patientId - Patient ID
   * @param {Array} actions - Actions to execute
   * @returns {Promise<Object>} Reconciliation results
   */
  async executeReconciliation(patientId, actions) {
    return this.reconciliation.executeReconciliation(patientId, actions);
  }

  /**
   * Get last reconciliation date
   * @param {string} patientId - Patient ID
   * @returns {Promise<string|null>} Last reconciliation date
   */
  async getLastReconciliationDate(patientId) {
    return this.reconciliation.getLastReconciliationDate(patientId);
  }

  // ============================================================================
  // Prescriptions & Workflow
  // ============================================================================

  /**
   * Get patient prescription statuses
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} Prescription statuses
   */
  async getPrescriptionStatuses(patientId) {
    return this.workflow.getPatientPrescriptionStatuses(patientId);
  }

  /**
   * Update prescription status
   * @param {string} prescriptionId - Prescription ID
   * @param {string} status - New status
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Updated prescription
   */
  async updatePrescriptionStatus(prescriptionId, status, options = {}) {
    return this.workflow.updatePrescriptionStatus(prescriptionId, status, options);
  }

  /**
   * Create refill request
   * @param {string} patientId - Patient ID
   * @param {string} prescriptionId - Prescription ID
   * @param {Object} refillData - Refill request data
   * @returns {Promise<Object>} Refill request result
   */
  async createRefillRequest(patientId, prescriptionId, refillData = {}) {
    return this.workflow.createRefillRequest(patientId, prescriptionId, refillData);
  }

  /**
   * Get refill history
   * @param {string} patientId - Patient ID
   * @param {string} prescriptionId - Prescription ID
   * @returns {Promise<Array>} Refill history
   */
  async getRefillHistory(patientId, prescriptionId) {
    return this.workflow.getRefillHistory(patientId, prescriptionId);
  }

  // ============================================================================
  // Adherence
  // ============================================================================

  /**
   * Calculate medication adherence
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - Medication ID
   * @param {Object} options - Calculation options
   * @returns {Promise<Object>} Adherence metrics
   */
  async calculateAdherence(patientId, medicationId, options = {}) {
    return this.workflow.calculateMedicationAdherence(patientId, medicationId, options);
  }

  // ============================================================================
  // Discontinuation
  // ============================================================================

  /**
   * Discontinue a medication
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - Medication ID
   * @param {Object} discontinuationData - Discontinuation details
   * @returns {Promise<Object>} Discontinuation result
   */
  async discontinue(patientId, medicationId, discontinuationData) {
    return this.discontinuation.discontinueMedication(patientId, medicationId, discontinuationData);
  }

  /**
   * Create tapering plan for discontinuation
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - Medication ID
   * @param {Object} taperingOptions - Tapering options
   * @returns {Promise<Object>} Tapering plan
   */
  async createTaperingPlan(patientId, medicationId, taperingOptions) {
    return this.discontinuation.createTaperingPlan(patientId, medicationId, taperingOptions);
  }

  /**
   * Get discontinuation history
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} Discontinuation history
   */
  async getDiscontinuationHistory(patientId) {
    return this.discontinuation.getDiscontinuationHistory(patientId);
  }

  // ============================================================================
  // Administration (MAR)
  // ============================================================================

  /**
   * Get Medication Administration Record (MAR)
   * @param {string} patientId - Patient ID
   * @param {Object} options - MAR options (dateRange, etc.)
   * @returns {Promise<Object>} MAR data
   */
  async getMAR(patientId, options = {}) {
    return this.administration.getMedicationAdministrationRecord(patientId, options);
  }

  /**
   * Record medication administration
   * @param {Object} administrationData - Administration details
   * @returns {Promise<Object>} Created administration record
   */
  async recordAdministration(administrationData) {
    return this.administration.createMedicationAdministration(administrationData);
  }

  /**
   * Get administration metrics
   * @param {string} patientId - Patient ID
   * @param {Object} options - Metrics options
   * @returns {Promise<Object>} Administration metrics
   */
  async getAdministrationMetrics(patientId, options = {}) {
    return this.administration.getAdministrationMetrics(patientId, options);
  }

  // ============================================================================
  // Dispensing
  // ============================================================================

  /**
   * Create medication dispense record
   * @param {Object} dispenseData - Dispense details
   * @returns {Promise<Object>} Created dispense record
   */
  async createDispense(dispenseData) {
    return this.dispense.createMedicationDispense(dispenseData);
  }

  /**
   * Get dispenses by patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Array>} Dispense records
   */
  async getPatientDispenses(patientId) {
    return this.dispense.getDispensesByPatient(patientId);
  }

  /**
   * Get dispensing metrics
   * @param {string} patientId - Patient ID
   * @param {Object} options - Metrics options
   * @returns {Promise<Object>} Dispensing metrics
   */
  async getDispensingMetrics(patientId, options = {}) {
    return this.dispense.getDispensingMetrics(patientId, options);
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate medication workflow for patient
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Validation results
   */
  async validatePatientWorkflow(patientId) {
    return this.workflow.validatePatientMedicationWorkflow(patientId);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all medication caches
   * @param {string} patientId - Optional patient ID for targeted clearing
   */
  clearCache(patientId = null) {
    if (patientId) {
      this.workflow.clearReconciliationCache(patientId);
      this.reconciliation.clearCache(patientId);
      this.list.clearCache(patientId);
      this.discontinuation.clearCache(patientId);
    } else {
      this.workflow.clearReconciliationCache();
      this.reconciliation.clearCache();
      this.list.clearCache();
      this.discontinuation.clearCache();
    }
  }
}

// Export singleton instance
export const medicationService = new MedicationService();

// Export class for testing
export { MedicationService };

export default medicationService;
