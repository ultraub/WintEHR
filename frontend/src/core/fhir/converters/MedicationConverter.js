/**
 * MedicationConverter - FHIR MedicationRequest Resource Converter
 * Extends AbstractFHIRConverter to provide medication-specific conversion logic
 */
import { AbstractFHIRConverter } from './AbstractFHIRConverter';

// FHIR Value Sets for MedicationRequest (moved from config)
export const MEDICATION_STATUS_OPTIONS = [
  { value: 'active', display: 'Active' },
  { value: 'on-hold', display: 'On Hold' },
  { value: 'cancelled', display: 'Cancelled' },
  { value: 'completed', display: 'Completed' },
  { value: 'entered-in-error', display: 'Entered in Error' },
  { value: 'stopped', display: 'Stopped' },
  { value: 'draft', display: 'Draft' },
  { value: 'unknown', display: 'Unknown' }
];

export const MEDICATION_PRIORITY_OPTIONS = [
  { value: 'routine', display: 'Routine' },
  { value: 'urgent', display: 'Urgent' },
  { value: 'asap', display: 'ASAP' },
  { value: 'stat', display: 'STAT' }
];

export const DOSING_FREQUENCIES = [
  { value: 'once-daily', display: 'Once daily', timing: 'QD' },
  { value: 'twice-daily', display: 'Twice daily', timing: 'BID' },
  { value: 'three-times-daily', display: 'Three times daily', timing: 'TID' },
  { value: 'four-times-daily', display: 'Four times daily', timing: 'QID' },
  { value: 'every-other-day', display: 'Every other day', timing: 'QOD' },
  { value: 'weekly', display: 'Weekly', timing: 'Weekly' },
  { value: 'as-needed', display: 'As needed', timing: 'PRN' },
  { value: 'every-6-hours', display: 'Every 6 hours', timing: 'Q6H' },
  { value: 'every-8-hours', display: 'Every 8 hours', timing: 'Q8H' },
  { value: 'every-12-hours', display: 'Every 12 hours', timing: 'Q12H' }
];

export const ROUTES = [
  { value: 'oral', display: 'Oral', code: '26643006' },
  { value: 'topical', display: 'Topical', code: '6064005' },
  { value: 'injection', display: 'Injection', code: '129326001' },
  { value: 'inhalation', display: 'Inhalation', code: '26643006' },
  { value: 'sublingual', display: 'Sublingual', code: '37161004' },
  { value: 'rectal', display: 'Rectal', code: '12130007' },
  { value: 'nasal', display: 'Nasal', code: '46713006' },
  { value: 'ophthalmic', display: 'Ophthalmic', code: '54485002' },
  { value: 'otic', display: 'Otic', code: '10547007' },
  { value: 'transdermal', display: 'Transdermal', code: '62226000' }
];

export const INTENT_OPTIONS = [
  { value: 'proposal', display: 'Proposal' },
  { value: 'plan', display: 'Plan' },
  { value: 'order', display: 'Order' },
  { value: 'original-order', display: 'Original Order' },
  { value: 'reflex-order', display: 'Reflex Order' },
  { value: 'filler-order', display: 'Filler Order' },
  { value: 'instance-order', display: 'Instance Order' },
  { value: 'option', display: 'Option' }
];

export class MedicationConverter extends AbstractFHIRConverter {
  constructor() {
    super('MedicationRequest', {
      generateId: true,
      validateRequired: true,
      preserveMeta: true
    });
  }

  /**
   * Get initial form values for new medication request
   * @returns {Object} Initial form values
   */
  getInitialValues() {
    return {
      selectedMedication: null,
      customMedication: '',
      dosage: '',
      route: 'oral',
      frequency: 'once-daily',
      duration: '',
      quantity: '',
      refills: 0,
      startDate: new Date(),
      endDate: null,
      instructions: '',
      indication: '',
      priority: 'routine',
      status: 'active',
      intent: 'order',
      genericSubstitution: true,
      notes: ''
    };
  }

  /**
   * Parse FHIR MedicationRequest resource to form data
   * @param {Object} medicationRequest - FHIR MedicationRequest resource
   * @returns {Object} Form data
   */
  _parseResourceToForm(medicationRequest) {
    // Extract basic fields
    const status = this.safeString(medicationRequest.status, 'active');
    const priority = this.safeString(medicationRequest.priority, 'routine');
    const intent = this.safeString(medicationRequest.intent, 'order');
    
    // Extract dates
    const startDate = this.parseDate(medicationRequest.authoredOn) || new Date();
    const endDate = this.parseDate(medicationRequest.dispenseRequest?.validityPeriod?.end);

    // Extract medication information - handle both R4B and R5 formats
    let selectedMedication = null;
    let customMedication = '';
    
    // Try R4B format first (medicationCodeableConcept)
    const medication = medicationRequest.medicationCodeableConcept || 
                      medicationRequest.medication || 
                      medicationRequest.medicationReference;
                      
    if (medication) {
      // R5 format: medication.concept
      if (medication.concept?.coding?.[0]) {
        const coding = medication.concept.coding[0];
        selectedMedication = {
          code: coding.code,
          display: coding.display || medication.concept.text,
          system: coding.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          source: 'existing'
        };
      }
      // R4B format: direct coding
      else if (medication.coding?.[0]) {
        const coding = medication.coding[0];
        selectedMedication = {
          code: coding.code,
          display: coding.display || medication.text,
          system: coding.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          source: 'existing'
        };
      }
      // Reference format
      else if (medication.reference) {
        customMedication = medication.display || 'Referenced medication';
      }
      // Text only
      else if (medication.text || medication.concept?.text) {
        customMedication = medication.text || medication.concept.text;
      }
    }

    // Extract dosage information
    const dosageInstruction = medicationRequest.dosageInstruction?.[0];
    const doseAndRate = dosageInstruction?.doseAndRate?.[0];
    let dosage = '';
    
    if (doseAndRate?.doseQuantity?.value) {
      const value = doseAndRate.doseQuantity.value;
      const unit = doseAndRate.doseQuantity.unit && doseAndRate.doseQuantity.unit !== 'dose' 
        ? doseAndRate.doseQuantity.unit 
        : '';
      dosage = unit ? `${value} ${unit}` : value.toString();
    } else if (doseAndRate?.doseRange?.low?.value) {
      const value = doseAndRate.doseRange.low.value;
      const unit = doseAndRate.doseRange.low.unit && doseAndRate.doseRange.low.unit !== 'dose'
        ? doseAndRate.doseRange.low.unit
        : '';
      dosage = unit ? `${value} ${unit}` : value.toString();
    }
    
    // Extract route with whitespace trimming
    const route = this.safeString((dosageInstruction?.route?.coding?.[0]?.code || 'oral'), 'oral').trim();
    
    // Extract frequency - this is complex in FHIR, simplified for form
    const timing = dosageInstruction?.timing;
    let frequency = 'once-daily';
    if (timing?.repeat?.frequency) {
      const freq = timing.repeat.frequency;
      const period = timing.repeat.period;
      const periodUnit = timing.repeat.periodUnit;
      
      if (freq === 1 && period === 1 && periodUnit === 'd') frequency = 'once-daily';
      else if (freq === 2 && period === 1 && periodUnit === 'd') frequency = 'twice-daily';
      else if (freq === 3 && period === 1 && periodUnit === 'd') frequency = 'three-times-daily';
      else if (freq === 4 && period === 1 && periodUnit === 'd') frequency = 'four-times-daily';
    }

    // Extract other fields
    const instructions = this.safeString(dosageInstruction?.text, '');
    const indication = this.safeString(medicationRequest.reasonCode?.[0]?.text, '');
    const quantity = this.safeString(medicationRequest.dispenseRequest?.quantity?.value, '');
    const refills = this.safeNumber(medicationRequest.dispenseRequest?.numberOfRepeatsAllowed, 0);
    const duration = this.safeString(medicationRequest.dispenseRequest?.expectedSupplyDuration?.value, '');
    const genericSubstitution = medicationRequest.substitution?.allowedBoolean !== false;
    const notes = this.extractNotes(medicationRequest.note);

    return {
      selectedMedication,
      customMedication,
      dosage: dosage.toString(),
      route: this.safeString(route, 'oral'),
      frequency: this.safeString(frequency, 'once-daily'),
      duration: duration.toString(),
      quantity: quantity.toString(),
      refills: typeof refills === 'number' ? refills : 0,
      startDate,
      endDate,
      instructions,
      indication,
      priority: this.safeString(priority, 'routine'),
      status: this.safeString(status, 'active'),
      intent: this.safeString(intent, 'order'),
      genericSubstitution,
      notes
    };
  }

  /**
   * Create FHIR MedicationRequest resource from form data
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context
   * @returns {Object} FHIR resource fields
   */
  _createResourceFromForm(formData, context = {}) {
    const resource = {
      status: formData.status,
      intent: formData.intent,
      priority: formData.priority,
      // Use R4B format (medicationCodeableConcept)
      medicationCodeableConcept: formData.selectedMedication ? {
        coding: [{
          system: formData.selectedMedication.system || 
                  formData.selectedMedication.code?.coding?.[0]?.system ||
                  'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: String(formData.selectedMedication.code?.coding?.[0]?.code || 
                       formData.selectedMedication.code || 
                       formData.selectedMedication.id || 
                       'unknown'),
          display: formData.selectedMedication.display || 
                   formData.selectedMedication.code?.text || 
                   'Unknown medication'
        }],
        text: formData.selectedMedication.display || 
              formData.selectedMedication.code?.text || 
              'Unknown medication'
      } : {
        text: formData.customMedication
      },
      authoredOn: this.createDateString(formData.startDate),
      dosageInstruction: [{
        text: formData.instructions || `${formData.dosage} ${DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display || formData.frequency}`,
        timing: {
          repeat: this._getTimingFromFrequency(formData.frequency)
        },
        route: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: (ROUTES.find(r => r.value === (formData.route || '').trim())?.code || '26643006').trim(),
            display: ROUTES.find(r => r.value === (formData.route || '').trim())?.display || (formData.route || '').trim() || 'Oral'
          }]
        },
        doseAndRate: [{
          type: {
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/dose-rate-type',
              code: 'ordered',
              display: 'Ordered'
            }]
          },
          doseQuantity: this._parseDosageQuantity(formData.dosage)
        }]
      }],
      dispenseRequest: this._createDispenseRequest(formData),
      substitution: {
        allowedBoolean: formData.genericSubstitution
      }
    };

    // Add indication if provided
    if (formData.indication) {
      resource.reasonCode = [{
        text: formData.indication
      }];
    }

    // Add notes if provided
    if (formData.notes) {
      resource.note = this.createNotes(formData.notes);
    }

    return resource;
  }

  /**
   * Validate required fields for medication request
   * @param {Object} formData - Form data to validate
   * @throws {Error} If validation fails
   */
  _validateRequiredFields(formData) {
    if (!formData.selectedMedication && !formData.customMedication) {
      throw new Error('Please specify a medication or select from the list');
    }

    if (!formData.dosage || formData.dosage.trim() === '') {
      throw new Error('Dosage is required');
    }

    if (!formData.route) {
      throw new Error('Route is required');
    }

    if (!formData.frequency) {
      throw new Error('Frequency is required');
    }

    if (!formData.quantity || formData.quantity.trim() === '') {
      throw new Error('Quantity is required');
    }

    // Validate quantity is a number
    const quantityNum = parseFloat(formData.quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      throw new Error('Quantity must be a valid positive number');
    }

    if (!formData.priority) {
      throw new Error('Priority is required');
    }

    if (!formData.status) {
      throw new Error('Status is required');
    }

    if (!formData.intent) {
      throw new Error('Intent is required');
    }
  }

  /**
   * Post-process the medication request resource
   * @param {Object} resource - The resource
   * @param {string} operation - 'create' or 'update'
   * @param {Object} formData - Original form data
   * @param {Object} context - Additional context
   * @returns {Object} Processed resource
   */
  _postProcessResource(resource, operation, formData, context) {
    // Ensure dates are properly formatted
    if (resource.authoredOn && typeof resource.authoredOn !== 'string') {
      resource.authoredOn = new Date(resource.authoredOn).toISOString();
    }

    // Ensure dispenseRequest exists
    if (!resource.dispenseRequest) {
      resource.dispenseRequest = this._createDispenseRequest(formData);
    }

    return resource;
  }

  // Helper methods

  /**
   * Convert frequency to FHIR timing
   * @param {string} frequency - Form frequency value
   * @returns {Object} FHIR timing repeat
   */
  _getTimingFromFrequency(frequency) {
    switch (frequency) {
      case 'once-daily':
        return { frequency: 1, period: 1, periodUnit: 'd' };
      case 'twice-daily':
        return { frequency: 2, period: 1, periodUnit: 'd' };
      case 'three-times-daily':
        return { frequency: 3, period: 1, periodUnit: 'd' };
      case 'four-times-daily':
        return { frequency: 4, period: 1, periodUnit: 'd' };
      case 'every-other-day':
        return { frequency: 1, period: 2, periodUnit: 'd' };
      case 'weekly':
        return { frequency: 1, period: 1, periodUnit: 'wk' };
      case 'every-6-hours':
        return { frequency: 1, period: 6, periodUnit: 'h' };
      case 'every-8-hours':
        return { frequency: 1, period: 8, periodUnit: 'h' };
      case 'every-12-hours':
        return { frequency: 1, period: 12, periodUnit: 'h' };
      default:
        return { frequency: 1, period: 1, periodUnit: 'd' };
    }
  }

  /**
   * Parse dosage string into FHIR quantity
   * @param {string} dosageStr - Dosage string
   * @returns {Object} FHIR Quantity
   */
  _parseDosageQuantity(dosageStr) {
    const dosageString = String(dosageStr || '');
    const match = dosageString.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
    if (match) {
      const value = parseFloat(match[1]) || 0;
      const unit = match[2].trim() || 'dose';
      return { value, unit };
    }
    return { value: parseFloat(dosageStr) || 0, unit: 'dose' };
  }

  /**
   * Create dispense request from form data
   * @param {Object} formData - Form data
   * @returns {Object} FHIR dispenseRequest
   */
  _createDispenseRequest(formData) {
    const dispenseRequest = {};

    if (formData.quantity) {
      dispenseRequest.quantity = {
        value: parseFloat(formData.quantity) || 0,
        unit: 'dose'
      };
    }

    if (formData.refills) {
      dispenseRequest.numberOfRepeatsAllowed = parseInt(formData.refills) || 0;
    }

    if (formData.duration) {
      dispenseRequest.expectedSupplyDuration = {
        value: parseFloat(formData.duration) || 0,
        unit: 'days'
      };
    }

    if (formData.endDate) {
      dispenseRequest.validityPeriod = {
        end: this.createDateString(formData.endDate)
      };
    }

    return dispenseRequest;
  }
}

// Helper functions that can be used by the dialog config
export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active': 
      return 'success';
    case 'on-hold': 
    case 'draft':
      return 'warning';
    case 'cancelled':
    case 'stopped':
    case 'entered-in-error': 
      return 'error';
    case 'completed':
      return 'info';
    default: 
      return 'default';
  }
};

export const getPriorityColor = (priority) => {
  switch (priority?.toLowerCase()) {
    case 'stat':
      return 'error';
    case 'urgent':
    case 'asap': 
      return 'warning';
    case 'routine': 
      return 'success';
    default: 
      return 'default';
  }
};

export const getMedicationDisplay = (formData) => {
  if (formData.selectedMedication) {
    return formData.selectedMedication.display;
  }
  return formData.customMedication || 'No medication selected';
};

// Export singleton instance for use in dialog configs
export const medicationConverter = new MedicationConverter();