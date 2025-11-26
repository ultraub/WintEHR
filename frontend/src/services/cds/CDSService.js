/**
 * CDSService - Unified Facade for Clinical Decision Support Operations
 *
 * This service provides a clean, unified API for CDS operations
 * by consolidating access to multiple underlying CDS services:
 *
 * - CDSHooksClient: Hook execution, service discovery
 * - CDSHooksService: Service management, CRUD operations
 * - CDSClinicalDataService: Clinical data catalogs
 * - CDSActionExecutor: Action and suggestion execution
 * - CDSFeedbackService: Feedback handling
 * - CDSAlertPersistenceService: Alert persistence
 * - CDSDisplayBehaviorService: Display configuration
 *
 * Usage:
 *   import { cdsService } from '@/services/cds';
 *   const cards = await cdsService.firePatientView(patientId, encounterId);
 */

import CDSHooksClient from '../cdsHooksClient';
import { cdsHooksService } from '../cdsHooksService';
import { cdsClinicalDataService } from '../cdsClinicalDataService';
import { cdsActionExecutor } from '../cdsActionExecutor';
import { cdsFeedbackService } from '../cdsFeedbackService';

/**
 * Unified CDS Service
 */
class CDSService {
  constructor() {
    // Underlying services
    this.client = new CDSHooksClient();
    this.hooksService = cdsHooksService;
    this.clinicalData = cdsClinicalDataService;
    this.actionExecutor = cdsActionExecutor;
    this.feedback = cdsFeedbackService;
  }

  // ============================================================================
  // Service Discovery
  // ============================================================================

  /**
   * Discover available CDS services
   * @returns {Promise<Array>} Available services
   */
  async discoverServices() {
    return this.client.discoverServices();
  }

  /**
   * Get a specific CDS service by ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<Object>} Service details
   */
  async getService(serviceId) {
    return this.hooksService.getService(serviceId);
  }

  /**
   * List all custom services
   * @returns {Promise<Array>} Custom services
   */
  async listCustomServices() {
    return this.hooksService.listCustomServices();
  }

  // ============================================================================
  // Hook Execution
  // ============================================================================

  /**
   * Execute a CDS hook
   * @param {string} hookType - Hook type (patient-view, medication-prescribe, etc.)
   * @param {Object} context - Hook context
   * @param {Object} prefetch - Prefetch data
   * @returns {Promise<Object>} Hook response with cards
   */
  async executeHook(hookType, context, prefetch = {}) {
    return this.client.executeHook(hookType, context, prefetch);
  }

  /**
   * Fire patient-view hook
   * @param {string} patientId - Patient ID
   * @param {string} encounterId - Encounter ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response with cards
   */
  async firePatientView(patientId, encounterId, options = {}) {
    return this.client.firePatientView(patientId, encounterId, options);
  }

  /**
   * Fire medication-prescribe hook
   * @param {string} patientId - Patient ID
   * @param {string} encounterId - Encounter ID
   * @param {Object} medications - Medication context
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response with cards
   */
  async fireMedicationPrescribe(patientId, encounterId, medications, options = {}) {
    return this.client.fireMedicationPrescribe(patientId, encounterId, medications, options);
  }

  /**
   * Fire order-sign hook
   * @param {string} patientId - Patient ID
   * @param {string} encounterId - Encounter ID
   * @param {Array} orders - Orders to sign
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Response with cards
   */
  async fireOrderSign(patientId, encounterId, orders, options = {}) {
    return this.client.fireOrderSign(patientId, encounterId, orders, options);
  }

  /**
   * Fire order-dispatch hook
   * @param {string} patientId - Patient ID
   * @param {Object} order - Order to dispatch
   * @returns {Promise<Object>} Response with cards
   */
  async fireOrderDispatch(patientId, order) {
    return this.client.fireOrderDispatch(patientId, order);
  }

  /**
   * Fire problem-list.item-create hook
   * @param {string} patientId - Patient ID
   * @param {Object} condition - Condition being added
   * @returns {Promise<Object>} Response with cards
   */
  async fireProblemListItemCreate(patientId, condition) {
    return this.client.fireProblemListItemCreate(patientId, condition);
  }

  /**
   * Fire allergy-intolerance.create hook
   * @param {string} patientId - Patient ID
   * @param {Object} allergy - Allergy being added
   * @returns {Promise<Object>} Response with cards
   */
  async fireAllergyIntoleranceCreate(patientId, allergy) {
    return this.client.fireAllergyIntoleranceCreate(patientId, allergy);
  }

  /**
   * Fire appointment-book hook
   * @param {string} patientId - Patient ID
   * @param {Object} appointment - Appointment being booked
   * @returns {Promise<Object>} Response with cards
   */
  async fireAppointmentBook(patientId, appointment) {
    return this.client.fireAppointmentBook(patientId, appointment);
  }

  /**
   * Fire medication-refill hook
   * @param {string} patientId - Patient ID
   * @param {Object} prescription - Prescription to refill
   * @returns {Promise<Object>} Response with cards
   */
  async fireMedicationRefill(patientId, prescription) {
    return this.client.fireMedicationRefill(patientId, prescription);
  }

  // ============================================================================
  // Action Execution
  // ============================================================================

  /**
   * Execute a CDS suggestion
   * @param {Object} suggestion - Suggestion to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async executeSuggestion(suggestion, context = {}) {
    return this.actionExecutor.executeSuggestion(suggestion, context);
  }

  /**
   * Execute a CDS action (create, update, delete)
   * @param {Object} action - Action to execute
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async executeAction(action, context = {}) {
    return this.actionExecutor.executeAction(action, context);
  }

  /**
   * Dry run a suggestion (preview without executing)
   * @param {Object} suggestion - Suggestion to preview
   * @returns {Promise<Object>} Preview result
   */
  async dryRunSuggestion(suggestion) {
    return this.actionExecutor.dryRunSuggestion(suggestion);
  }

  /**
   * Apply system actions from CDS response
   * @param {Object} response - CDS response containing systemActions
   * @returns {Promise<Array>} Applied actions results
   */
  async applySystemActions(response) {
    return this.client.applySystemActions(response);
  }

  // ============================================================================
  // Feedback
  // ============================================================================

  /**
   * Send feedback for a CDS card
   * @param {string} cardId - Card ID
   * @param {string} outcome - Outcome (accepted, overridden)
   * @param {Object} details - Feedback details
   * @returns {Promise<Object>} Feedback result
   */
  async sendFeedback(cardId, outcome, details = {}) {
    return this.client.sendFeedback(cardId, outcome, details);
  }

  /**
   * Record card acceptance
   * @param {string} cardId - Card ID
   * @param {Object} details - Details about acceptance
   */
  async recordAcceptance(cardId, details = {}) {
    return this.feedback.recordAcceptance(cardId, details);
  }

  /**
   * Record card override
   * @param {string} cardId - Card ID
   * @param {string} reason - Override reason
   * @param {Object} details - Additional details
   */
  async recordOverride(cardId, reason, details = {}) {
    return this.feedback.recordOverride(cardId, reason, details);
  }

  // ============================================================================
  // Service Management
  // ============================================================================

  /**
   * Create a new CDS service
   * @param {Object} serviceData - Service configuration
   * @returns {Promise<Object>} Created service
   */
  async createService(serviceData) {
    return this.hooksService.createService(serviceData);
  }

  /**
   * Update an existing CDS service
   * @param {string} serviceId - Service ID
   * @param {Object} serviceData - Updated configuration
   * @returns {Promise<Object>} Updated service
   */
  async updateService(serviceId, serviceData) {
    return this.hooksService.updateService(serviceId, serviceData);
  }

  /**
   * Delete a CDS service
   * @param {string} serviceId - Service ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteService(serviceId) {
    return this.hooksService.deleteService(serviceId);
  }

  /**
   * Test a CDS service
   * @param {string} serviceId - Service ID
   * @param {Object} testContext - Test context
   * @returns {Promise<Object>} Test results
   */
  async testService(serviceId, testContext = {}) {
    return this.hooksService.testService(serviceId, testContext);
  }

  /**
   * Validate service configuration
   * @param {Object} serviceData - Service configuration to validate
   * @returns {Promise<Object>} Validation result
   */
  async validateService(serviceData) {
    return this.hooksService.validateServiceData(serviceData);
  }

  // ============================================================================
  // Clinical Data Catalogs
  // ============================================================================

  /**
   * Get lab catalog
   * @returns {Promise<Array>} Lab catalog items
   */
  async getLabCatalog() {
    return this.clinicalData.getLabCatalog();
  }

  /**
   * Get condition catalog
   * @returns {Promise<Array>} Condition catalog items
   */
  async getConditionCatalog() {
    return this.clinicalData.getConditionCatalog();
  }

  /**
   * Get dynamic medication catalog
   * @param {string} searchTerm - Optional search term
   * @returns {Promise<Array>} Medication catalog items
   */
  async getMedicationCatalog(searchTerm = '') {
    return this.clinicalData.getDynamicMedicationCatalog(searchTerm);
  }

  /**
   * Get dynamic condition catalog
   * @param {string} searchTerm - Optional search term
   * @returns {Promise<Array>} Condition catalog items
   */
  async getDynamicConditionCatalog(searchTerm = '') {
    return this.clinicalData.getDynamicConditionCatalog(searchTerm);
  }

  /**
   * Search across all catalogs
   * @param {string} searchTerm - Search term
   * @returns {Promise<Object>} Search results by category
   */
  async searchCatalogs(searchTerm) {
    return this.clinicalData.searchAllDynamicCatalogs(searchTerm);
  }

  /**
   * Get lab details
   * @param {string} labCode - Lab code
   * @returns {Promise<Object>} Lab details
   */
  async getLabDetails(labCode) {
    return this.clinicalData.getLabDetails(labCode);
  }

  /**
   * Get condition details
   * @param {string} conditionCode - Condition code
   * @returns {Promise<Object>} Condition details
   */
  async getConditionDetails(conditionCode) {
    return this.clinicalData.getConditionDetails(conditionCode);
  }

  /**
   * Check if a lab value is within normal range
   * @param {string} labCode - Lab code
   * @param {number} value - Lab value
   * @param {Object} patientContext - Patient context (age, sex)
   * @returns {Promise<Object>} Range check result
   */
  async checkLabValueRange(labCode, value, patientContext = {}) {
    return this.clinicalData.checkLabValueRange(labCode, value, patientContext);
  }

  /**
   * Check if a vital sign is within normal range
   * @param {string} vitalType - Vital sign type
   * @param {number} value - Vital sign value
   * @param {Object} patientContext - Patient context
   * @returns {Promise<Object>} Range check result
   */
  async checkVitalSignRange(vitalType, value, patientContext = {}) {
    return this.clinicalData.checkVitalSignRange(vitalType, value, patientContext);
  }

  // ============================================================================
  // Authentication
  // ============================================================================

  /**
   * Set authentication token for CDS calls
   * @param {string} token - Auth token
   */
  setAuthToken(token) {
    this.client.setAuthToken(token);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all CDS caches
   */
  clearCache() {
    this.clinicalData.clearCache();
    // Clear other caches as needed
  }

  /**
   * Refresh dynamic catalogs
   * @returns {Promise<Object>} Refresh results
   */
  async refreshCatalogs() {
    return this.clinicalData.refreshDynamicCatalogs();
  }
}

// Export singleton instance
export const cdsService = new CDSService();

// Export class for testing
export { CDSService };

export default cdsService;
