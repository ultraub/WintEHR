/**
 * ConditionConverter - FHIR Condition Resource Converter
 * Extends AbstractFHIRConverter to provide Condition-specific conversion logic
 */
import { AbstractFHIRConverter } from './AbstractFHIRConverter';

// FHIR Value Sets for Condition (moved from config)
export const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', display: 'Active' },
  { value: 'recurrence', display: 'Recurrence' },
  { value: 'relapse', display: 'Relapse' },
  { value: 'inactive', display: 'Inactive' },
  { value: 'remission', display: 'Remission' },
  { value: 'resolved', display: 'Resolved' }
];

export const VERIFICATION_STATUS_OPTIONS = [
  { value: 'unconfirmed', display: 'Unconfirmed' },
  { value: 'provisional', display: 'Provisional' },
  { value: 'differential', display: 'Differential' },
  { value: 'confirmed', display: 'Confirmed' },
  { value: 'refuted', display: 'Refuted' },
  { value: 'entered-in-error', display: 'Entered in Error' }
];

export const CONDITION_CATEGORIES = [
  { value: 'problem-list-item', display: 'Problem List Item' },
  { value: 'encounter-diagnosis', display: 'Encounter Diagnosis' },
  { value: 'health-concern', display: 'Health Concern' }
];

export const SEVERITY_OPTIONS = [
  { value: 'mild', display: 'Mild' },
  { value: 'moderate', display: 'Moderate' },
  { value: 'severe', display: 'Severe' }
];

export class ConditionConverter extends AbstractFHIRConverter {
  constructor() {
    super('Condition', {
      generateId: true,
      validateRequired: true,
      preserveMeta: true
    });
  }

  /**
   * Get initial form values for new condition
   * @returns {Object} Initial form values
   */
  getInitialValues() {
    return {
      selectedProblem: null,
      problemText: '',
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      severity: '',
      onsetDate: null,
      category: 'problem-list-item',
      notes: ''
    };
  }

  /**
   * Parse FHIR Condition resource to form data
   * @param {Object} condition - FHIR Condition resource
   * @returns {Object} Form data
   */
  _parseResourceToForm(condition) {
    // Extract clinical status
    const clinicalStatus = this.extractCoding(condition.clinicalStatus, 'active');
    
    // Extract verification status
    const verificationStatus = this.extractCoding(condition.verificationStatus, 'confirmed');

    // Extract category
    const category = this.extractCoding(condition.category?.[0], 'problem-list-item');

    // Extract onset date
    const onsetDate = this.parseDate(condition.onsetDateTime || condition.onsetPeriod);

    // Extract severity
    const severity = this.extractCoding(condition.severity, '');

    // Extract problem information
    let selectedProblem = null;
    let problemText = '';
    
    if (condition.code) {
      const coding = condition.code.coding?.[0];
      if (coding) {
        selectedProblem = {
          code: coding.code,
          display: coding.display || condition.code.text || 'Unknown',
          system: coding.system || 'http://snomed.info/sct',
          source: 'existing'
        };
      } else if (condition.code.text) {
        problemText = condition.code.text;
      }
    }

    // Extract notes
    const notes = this.extractNotes(condition.note);

    return {
      selectedProblem,
      problemText,
      clinicalStatus: this.safeString(clinicalStatus, 'active'),
      verificationStatus: this.safeString(verificationStatus, 'confirmed'),
      severity: this.safeString(severity, ''),
      onsetDate,
      category: this.safeString(category, 'problem-list-item'),
      notes
    };
  }

  /**
   * Create FHIR Condition resource from form data
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context
   * @returns {Object} FHIR resource fields
   */
  _createResourceFromForm(formData, context = {}) {
    const resource = {
      clinicalStatus: this.createStatusCoding(
        formData.clinicalStatus,
        'http://terminology.hl7.org/CodeSystem/condition-clinical',
        CLINICAL_STATUS_OPTIONS
      ),
      verificationStatus: this.createStatusCoding(
        formData.verificationStatus,
        'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        VERIFICATION_STATUS_OPTIONS
      ),
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-category',
          code: formData.category,
          display: CONDITION_CATEGORIES.find(c => c.value === formData.category)?.display || formData.category
        }]
      }],
      recordedDate: new Date().toISOString()
    };

    // Add problem code or text
    if (formData.selectedProblem) {
      resource.code = this.createCodeableConcept(formData.selectedProblem);
    } else if (formData.problemText) {
      resource.code = { text: formData.problemText };
    }

    // Add onset date if provided
    if (formData.onsetDate) {
      resource.onsetDateTime = this.createDateString(formData.onsetDate);
    }

    // Add severity if provided
    if (formData.severity) {
      resource.severity = this.createStatusCoding(
        formData.severity,
        'http://snomed.info/sct',
        SEVERITY_OPTIONS
      );
    }

    // Add notes if provided
    if (formData.notes) {
      resource.note = this.createNotes(formData.notes);
    }

    return resource;
  }

  /**
   * Validate required fields for condition
   * @param {Object} formData - Form data to validate
   * @throws {Error} If validation fails
   */
  _validateRequiredFields(formData) {
    if (!formData.selectedProblem && !formData.problemText) {
      throw new Error('Please specify a problem description or select from the list');
    }

    if (!formData.clinicalStatus) {
      throw new Error('Clinical status is required');
    }

    if (!formData.verificationStatus) {
      throw new Error('Verification status is required');
    }

    if (!formData.category) {
      throw new Error('Category is required');
    }
  }

  /**
   * Post-process the condition resource
   * @param {Object} resource - The resource
   * @param {string} operation - 'create' or 'update'
   * @param {Object} formData - Original form data
   * @param {Object} context - Additional context
   * @returns {Object} Processed resource
   */
  _postProcessResource(resource, operation, formData, context) {
    // Ensure we have valid onset date format
    if (resource.onsetDateTime && typeof resource.onsetDateTime !== 'string') {
      resource.onsetDateTime = new Date(resource.onsetDateTime).toISOString();
    }

    // Ensure category is an array
    if (resource.category && !Array.isArray(resource.category)) {
      resource.category = [resource.category];
    }

    return resource;
  }
}

// Helper functions that can be used by the dialog config
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active': 
    case 'recurrence':
    case 'relapse': 
      return 'error';
    case 'inactive':
    case 'remission': 
      return 'warning';
    case 'resolved': 
      return 'success';
    default: 
      return 'default';
  }
};

export const getProblemDisplay = (formData) => {
  if (formData.selectedProblem) {
    return formData.selectedProblem.display;
  }
  return formData.problemText || 'No problem selected';
};

// Export singleton instance for use in dialog configs
export const conditionConverter = new ConditionConverter();