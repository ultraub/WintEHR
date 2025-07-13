/**
 * MedicationRequest Dialog Configuration
 * Configuration for BaseResourceDialog to handle medication request management
 */

// FHIR Value Sets for MedicationRequest
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

// Default initial values for new medication request
export const initialValues = {
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

// Validation rules for form fields
export const validationRules = {
  selectedMedication: {
    required: false,
    label: 'Medication',
    custom: (value, formData) => {
      if (!formData.selectedMedication && !formData.customMedication) {
        return 'Please specify a medication or select from the list';
      }
      return null;
    }
  },
  customMedication: {
    required: false,
    label: 'Custom Medication'
  },
  dosage: {
    required: true,
    label: 'Dosage',
    minLength: 1
  },
  route: {
    required: true,
    label: 'Route'
  },
  frequency: {
    required: true,
    label: 'Frequency'
  },
  quantity: {
    required: true,
    label: 'Quantity',
    pattern: /^\d+(\.\d+)?$/,
    patternMessage: 'Quantity must be a valid number'
  },
  priority: {
    required: true,
    label: 'Priority'
  },
  status: {
    required: true,
    label: 'Status'
  },
  intent: {
    required: true,
    label: 'Intent'
  }
};

// Helper function to get status color
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

// Helper function to get priority color
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

// Helper function to get medication display
export const getMedicationDisplay = (formData) => {
  if (formData.selectedMedication) {
    return formData.selectedMedication.display;
  }
  return formData.customMedication || 'No medication selected';
};

// Parse existing FHIR MedicationRequest resource into form data
export const parseMedicationRequestResource = (medicationRequest) => {
  if (!medicationRequest) return initialValues;

  const status = medicationRequest.status || 'active';
  const priority = medicationRequest.priority || 'routine';
  const intent = medicationRequest.intent || 'order';
  
  // Extract dates
  const startDate = medicationRequest.authoredOn ? new Date(medicationRequest.authoredOn) : new Date();
  const endDate = medicationRequest.dispenseRequest?.validityPeriod?.end ? 
    new Date(medicationRequest.dispenseRequest.validityPeriod.end) : null;

  // Extract medication information - handle both R4 and R5 formats
  let selectedMedication = null;
  let customMedication = '';
  
  const medication = medicationRequest.medication || medicationRequest.medicationCodeableConcept;
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
    // R4 format: medication.coding or direct coding
    else if (medication.coding?.[0]) {
      const coding = medication.coding[0];
      selectedMedication = {
        code: coding.code,
        display: coding.display || medication.text,
        system: coding.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
        source: 'existing'
      };
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
  const route = (dosageInstruction?.route?.coding?.[0]?.code || 'oral').trim();
  
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
  const instructions = dosageInstruction?.text || '';
  const indication = medicationRequest.reasonCode?.[0]?.text || '';
  const quantity = medicationRequest.dispenseRequest?.quantity?.value || '';
  const refills = medicationRequest.dispenseRequest?.numberOfRepeatsAllowed || 0;
  const duration = medicationRequest.dispenseRequest?.expectedSupplyDuration?.value || '';
  const genericSubstitution = medicationRequest.substitution?.allowedBoolean !== false;
  const notes = medicationRequest.note?.[0]?.text || '';

  return {
    selectedMedication,
    customMedication,
    dosage: dosage.toString(),
    route: typeof route === 'string' ? route : 'oral',
    frequency: typeof frequency === 'string' ? frequency : 'once-daily',
    duration: duration.toString(),
    quantity: quantity.toString(),
    refills: typeof refills === 'number' ? refills : 0,
    startDate,
    endDate,
    instructions,
    indication,
    priority: typeof priority === 'string' ? priority : 'routine',
    status: typeof status === 'string' ? status : 'active',
    intent: typeof intent === 'string' ? intent : 'order',
    genericSubstitution,
    notes
  };
};

// Helper functions for FHIR resource creation
export const createMedicationRequestResource = (formData, patientId) => {
  return {
    resourceType: 'MedicationRequest',
    id: `medication-request-${Date.now()}`,
    status: formData.status,
    intent: formData.intent,
    priority: formData.priority,
    // Use R5 format for medication
    medication: {
      concept: formData.selectedMedication ? {
        coding: [{
          system: formData.selectedMedication.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: formData.selectedMedication.code,
          display: formData.selectedMedication.display
        }],
        text: formData.selectedMedication.display
      } : {
        text: formData.customMedication
      }
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    authoredOn: formData.startDate.toISOString(),
    dosageInstruction: [{
      text: formData.instructions || `${formData.dosage} ${DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display || formData.frequency}`,
      timing: {
        repeat: getTimingFromFrequency(formData.frequency)
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
        doseQuantity: (() => {
          const dosageStr = String(formData.dosage || '');
          const match = dosageStr.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
          if (match) {
            const value = parseFloat(match[1]) || 0;
            const unit = match[2].trim() || 'dose';
            return { value, unit };
          }
          return { value: parseFloat(formData.dosage) || 0, unit: 'dose' };
        })()
      }]
    }],
    dispenseRequest: {
      ...(formData.quantity && {
        quantity: {
          value: parseFloat(formData.quantity) || 0,
          unit: 'dose'
        }
      }),
      ...(formData.refills && {
        numberOfRepeatsAllowed: parseInt(formData.refills) || 0
      }),
      ...(formData.duration && {
        expectedSupplyDuration: {
          value: parseFloat(formData.duration) || 0,
          unit: 'days'
        }
      }),
      ...(formData.endDate && {
        validityPeriod: {
          end: formData.endDate.toISOString()
        }
      })
    },
    substitution: {
      allowedBoolean: formData.genericSubstitution
    },
    ...(formData.indication && {
      reasonCode: [{
        text: formData.indication
      }]
    }),
    ...(formData.notes && {
      note: [{
        text: formData.notes,
        time: new Date().toISOString()
      }]
    })
  };
};

// Create updated FHIR MedicationRequest resource for editing
export const updateMedicationRequestResource = (formData, existingResource) => {
  if (!existingResource.id) {
    throw new Error('Cannot update medication request: missing resource ID');
  }

  return {
    ...existingResource, // Preserve existing fields
    resourceType: 'MedicationRequest',
    id: existingResource.id,
    status: formData.status,
    intent: formData.intent,
    priority: formData.priority,
    // Always use R5 format for consistency
    medication: {
      concept: formData.selectedMedication ? {
        coding: [{
          system: formData.selectedMedication.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: formData.selectedMedication.code,
          display: formData.selectedMedication.display
        }],
        text: formData.selectedMedication.display
      } : {
        text: formData.customMedication
      }
    },
    subject: existingResource.subject || {
      reference: `Patient/${existingResource.subject?.reference?.split('/')?.[1] || 'unknown'}`
    },
    authoredOn: formData.startDate.toISOString(),
    dosageInstruction: [{
      text: formData.instructions || `${formData.dosage} ${DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display || formData.frequency}`,
      timing: {
        repeat: getTimingFromFrequency(formData.frequency)
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
        doseQuantity: (() => {
          const dosageStr = String(formData.dosage || '');
          const match = dosageStr.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
          if (match) {
            const value = parseFloat(match[1]) || 0;
            const unit = match[2].trim() || 'dose';
            return { value, unit };
          }
          return { value: parseFloat(formData.dosage) || 0, unit: 'dose' };
        })()
      }]
    }],
    dispenseRequest: {
      ...(formData.quantity && {
        quantity: {
          value: parseFloat(formData.quantity) || 0,
          unit: 'dose'
        }
      }),
      ...(formData.refills && {
        numberOfRepeatsAllowed: parseInt(formData.refills) || 0
      }),
      ...(formData.duration && {
        expectedSupplyDuration: {
          value: parseFloat(formData.duration) || 0,
          unit: 'days'
        }
      }),
      ...(formData.endDate && {
        validityPeriod: {
          end: formData.endDate.toISOString()
        }
      })
    },
    substitution: {
      allowedBoolean: formData.genericSubstitution
    },
    ...(formData.indication && {
      reasonCode: [{
        text: formData.indication
      }]
    }),
    ...(formData.notes && {
      note: [{
        text: formData.notes,
        time: new Date().toISOString()
      }]
    })
  };
};

// Helper function to convert frequency to FHIR timing
function getTimingFromFrequency(frequency) {
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