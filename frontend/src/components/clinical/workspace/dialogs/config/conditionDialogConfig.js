/**
 * Condition Dialog Configuration
 * Configuration for BaseResourceDialog to handle condition/problem management
 */

// FHIR Value Sets for Condition
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

// Default initial values for new condition
export const initialValues = {
  selectedProblem: null,
  problemText: '',
  clinicalStatus: 'active',
  verificationStatus: 'confirmed',
  severity: '',
  onsetDate: null,
  category: 'problem-list-item',
  notes: ''
};

// Validation rules for form fields
export const validationRules = {
  selectedProblem: {
    required: false,
    label: 'Problem',
    custom: (value, formData) => {
      if (!formData.selectedProblem && !formData.problemText) {
        return 'Please specify a problem description or select from the list';
      }
      return null;
    }
  },
  problemText: {
    required: false,
    label: 'Problem Description'
  },
  clinicalStatus: {
    required: true,
    label: 'Clinical Status'
  },
  verificationStatus: {
    required: true,
    label: 'Verification Status'
  },
  category: {
    required: true,
    label: 'Category'
  }
};

// Helper function to get status color
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

// Helper function to get problem display
export const getProblemDisplay = (formData) => {
  if (formData.selectedProblem) {
    return formData.selectedProblem.display;
  }
  return formData.problemText || 'No problem selected';
};

// Parse existing FHIR Condition resource into form data
export const parseConditionResource = (condition) => {
  if (!condition) return initialValues;

  // Extract clinical status - handle both coding array and direct code
  const clinicalStatus = condition.clinicalStatus?.coding?.[0]?.code || 
                        condition.clinicalStatus?.code || 
                        'active';
  
  // Extract verification status - handle both coding array and direct code
  const verificationStatus = condition.verificationStatus?.coding?.[0]?.code || 
                           condition.verificationStatus?.code || 
                           'confirmed';

  // Extract category
  const category = condition.category?.[0]?.coding?.[0]?.code || 'problem-list-item';

  // Extract onset date - check multiple possible fields
  let onsetDate = null;
  if (condition.onsetDateTime) {
    onsetDate = new Date(condition.onsetDateTime);
  } else if (condition.onsetPeriod?.start) {
    onsetDate = new Date(condition.onsetPeriod.start);
  }

  // Extract severity
  const severity = condition.severity?.coding?.[0]?.code || '';

  // Extract problem information
  let selectedProblem = null;
  let problemText = '';
  
  if (condition.code) {
    const code = condition.code;
    if (code.coding && code.coding.length > 0) {
      const coding = code.coding[0];
      selectedProblem = {
        code: coding.code,
        display: coding.display || code.text,
        system: coding.system || 'http://snomed.info/sct',
        source: 'existing'
      };
    } else if (code.text) {
      problemText = code.text;
    }
  }

  // Extract notes
  const notes = condition.note?.[0]?.text || '';

  return {
    selectedProblem,
    problemText,
    clinicalStatus: typeof clinicalStatus === 'string' ? clinicalStatus : 'active',
    verificationStatus: typeof verificationStatus === 'string' ? verificationStatus : 'confirmed',
    severity: typeof severity === 'string' ? severity : '',
    onsetDate,
    category: typeof category === 'string' ? category : 'problem-list-item',
    notes
  };
};

// Helper functions for FHIR resource creation
export const createConditionResource = (formData, patientId) => {
  return {
    resourceType: 'Condition',
    id: `condition-${Date.now()}`,
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: formData.clinicalStatus,
        display: CLINICAL_STATUS_OPTIONS.find(s => s.value === formData.clinicalStatus)?.display
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: formData.verificationStatus,
        display: VERIFICATION_STATUS_OPTIONS.find(s => s.value === formData.verificationStatus)?.display
      }]
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-category',
        code: formData.category,
        display: CONDITION_CATEGORIES.find(c => c.value === formData.category)?.display
      }]
    }],
    code: formData.selectedProblem ? {
      coding: [{
        system: formData.selectedProblem.system || 'http://snomed.info/sct',
        code: formData.selectedProblem.code,
        display: formData.selectedProblem.display
      }],
      text: formData.selectedProblem.display
    } : {
      text: formData.problemText
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString(),
    ...(formData.onsetDate && {
      onsetDateTime: formData.onsetDate.toISOString()
    }),
    ...(formData.severity && {
      severity: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.severity,
          display: SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.display
        }]
      }
    }),
    ...(formData.notes && {
      note: [{
        text: formData.notes,
        time: new Date().toISOString()
      }]
    })
  };
};

// Create updated FHIR Condition resource for editing
export const updateConditionResource = (formData, existingResource) => {
  if (!existingResource.id) {
    throw new Error('Cannot update condition: missing resource ID');
  }

  return {
    ...existingResource, // Preserve existing fields like id, meta, etc.
    resourceType: 'Condition',
    id: existingResource.id, // Explicitly set ID
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: formData.clinicalStatus,
        display: CLINICAL_STATUS_OPTIONS.find(s => s.value === formData.clinicalStatus)?.display
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: formData.verificationStatus,
        display: VERIFICATION_STATUS_OPTIONS.find(s => s.value === formData.verificationStatus)?.display
      }]
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-category',
        code: formData.category,
        display: CONDITION_CATEGORIES.find(c => c.value === formData.category)?.display
      }]
    }],
    code: formData.selectedProblem ? {
      coding: [{
        system: formData.selectedProblem.system || 'http://snomed.info/sct',
        code: formData.selectedProblem.code,
        display: formData.selectedProblem.display
      }],
      text: formData.selectedProblem.display
    } : {
      text: formData.problemText
    },
    subject: existingResource.subject || {
      reference: `Patient/${existingResource.subject?.reference?.split('/')?.[1] || 'unknown'}`
    },
    recordedDate: existingResource.recordedDate || new Date().toISOString(),
    ...(formData.onsetDate && {
      onsetDateTime: formData.onsetDate.toISOString()
    }),
    ...(formData.severity && {
      severity: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.severity,
          display: SEVERITY_OPTIONS.find(s => s.value === formData.severity)?.display
        }]
      }
    }),
    ...(formData.notes && {
      note: [{
        text: formData.notes,
        time: new Date().toISOString()
      }]
    })
  };
};