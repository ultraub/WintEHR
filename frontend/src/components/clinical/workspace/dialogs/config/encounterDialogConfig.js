/**
 * Encounter Dialog Configuration
 * Configuration for BaseResourceDialog to handle encounter creation and management
 */

// FHIR Encounter Value Sets
export const ENCOUNTER_TYPES = [
  { value: 'AMB', display: 'Ambulatory', description: 'Outpatient visit' },
  { value: 'EMER', display: 'Emergency', description: 'Emergency department visit' },
  { value: 'HH', display: 'Home Health', description: 'Home healthcare visit' },
  { value: 'IMP', display: 'Inpatient', description: 'Inpatient stay' },
  { value: 'OBSENC', display: 'Observation', description: 'Observation stay' },
  { value: 'PRENC', display: 'Pre-admission', description: 'Pre-admission testing' },
  { value: 'SS', display: 'Short Stay', description: 'Short stay admission' },
  { value: 'VR', display: 'Virtual', description: 'Virtual/telehealth visit' }
];

export const ENCOUNTER_STATUS_OPTIONS = [
  { value: 'planned', display: 'Planned' },
  { value: 'arrived', display: 'Arrived' },
  { value: 'triaged', display: 'Triaged' },
  { value: 'in-progress', display: 'In Progress' },
  { value: 'onleave', display: 'On Leave' },
  { value: 'finished', display: 'Finished' },
  { value: 'cancelled', display: 'Cancelled' },
  { value: 'entered-in-error', display: 'Entered in Error' },
  { value: 'unknown', display: 'Unknown' }
];

export const PRIORITY_LEVELS = [
  { value: 'routine', display: 'Routine', description: 'Regular scheduled visit' },
  { value: 'urgent', display: 'Urgent', description: 'Needs prompt attention' },
  { value: 'asap', display: 'ASAP', description: 'As soon as possible' },
  { value: 'stat', display: 'STAT', description: 'Immediate attention required' }
];

export const ENCOUNTER_LOCATIONS = [
  { value: 'main-clinic', display: 'Main Clinic', address: '123 Healthcare Dr' },
  { value: 'urgent-care', display: 'Urgent Care', address: '456 Medical Blvd' },
  { value: 'cardiology', display: 'Cardiology Clinic', address: '789 Heart Ave' },
  { value: 'orthopedics', display: 'Orthopedics', address: '321 Bone St' },
  { value: 'women-health', display: 'Women\'s Health', address: '654 Care Lane' },
  { value: 'pediatrics', display: 'Pediatrics', address: '987 Kids Way' },
  { value: 'virtual', display: 'Virtual/Telehealth', address: 'Remote' }
];

// Encounter Templates
export const ENCOUNTER_TEMPLATES = {
  'annual-physical': {
    name: 'Annual Physical Exam',
    type: 'AMB',
    duration: 60,
    reasonForVisit: 'Annual preventive care examination',
    chiefComplaint: 'Routine annual physical examination',
    checklist: [
      'Review of systems',
      'Vital signs',
      'Physical examination',
      'Health maintenance screening',
      'Immunization review',
      'Medication reconciliation'
    ],
    expectedOrders: [
      'Complete Blood Count',
      'Comprehensive Metabolic Panel',
      'Lipid Panel',
      'Mammogram (if indicated)',
      'Colonoscopy screening (if due)'
    ]
  },
  'follow-up-diabetes': {
    name: 'Diabetes Follow-up',
    type: 'AMB',
    duration: 30,
    reasonForVisit: 'Diabetes mellitus follow-up',
    chiefComplaint: 'Routine diabetes management',
    checklist: [
      'Blood glucose log review',
      'Medication adherence',
      'Diabetic foot exam',
      'Blood pressure check',
      'Weight monitoring'
    ],
    expectedOrders: [
      'Hemoglobin A1C',
      'Urine microalbumin',
      'Diabetic eye exam referral'
    ]
  },
  'hypertension-followup': {
    name: 'Hypertension Follow-up',
    type: 'AMB',
    duration: 20,
    reasonForVisit: 'Hypertension management',
    chiefComplaint: 'Blood pressure follow-up',
    checklist: [
      'Blood pressure monitoring',
      'Medication compliance',
      'Side effects assessment',
      'Lifestyle counseling'
    ],
    expectedOrders: [
      'Basic Metabolic Panel',
      'Urine analysis'
    ]
  },
  'acute-visit': {
    name: 'Acute Care Visit',
    type: 'AMB',
    duration: 30,
    reasonForVisit: 'Acute illness',
    chiefComplaint: '',
    checklist: [
      'History of present illness',
      'Focused physical exam',
      'Assessment and plan',
      'Patient education'
    ],
    expectedOrders: []
  },
  'medication-review': {
    name: 'Medication Review',
    type: 'AMB',
    duration: 15,
    reasonForVisit: 'Medication management',
    chiefComplaint: 'Medication review and adjustment',
    checklist: [
      'Current medication list',
      'Side effects review',
      'Drug interactions check',
      'Adherence assessment'
    ],
    expectedOrders: []
  }
};

/**
 * Parse FHIR Encounter resource to form data
 */
export const parseResource = (encounter) => {
  if (!encounter) {
    return {
      selectedTemplate: '',
      type: 'AMB',
      reasonForVisit: '',
      chiefComplaint: '',
      provider: '',
      location: 'main-clinic',
      scheduledDate: new Date().toISOString().split('T')[0],
      scheduledTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
      duration: 30,
      priority: 'routine',
      status: 'planned',
      checklist: [],
      expectedOrders: [],
      notes: ''
    };
  }

  return {
    selectedTemplate: '',
    type: encounter.type?.[0]?.code || 'AMB',
    reasonForVisit: encounter.reasonCode?.[0]?.text || '',
    chiefComplaint: encounter.reasonCode?.[0]?.coding?.[0]?.display || '',
    provider: encounter.participant?.find(p => p.type?.[0]?.coding?.[0]?.code === 'ATND')?.individual?.display || '',
    location: encounter.location?.[0]?.location?.display || 'main-clinic',
    scheduledDate: encounter.period?.start ? new Date(encounter.period.start).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    scheduledTime: encounter.period?.start ? new Date(encounter.period.start).toTimeString().split(' ')[0].slice(0, 5) : new Date().toTimeString().split(' ')[0].slice(0, 5),
    duration: encounter.period?.end && encounter.period?.start ? 
      Math.round((new Date(encounter.period.end) - new Date(encounter.period.start)) / (1000 * 60)) : 30,
    priority: encounter.priority?.code || 'routine',
    status: encounter.status || 'planned',
    checklist: encounter.extension?.find(ext => ext.url === 'http://medgenemr.com/fhir/StructureDefinition/encounter-checklist')?.valueString?.split(',') || [],
    expectedOrders: encounter.extension?.find(ext => ext.url === 'http://medgenemr.com/fhir/StructureDefinition/encounter-expected-orders')?.valueString?.split(',') || [],
    notes: encounter.extension?.find(ext => ext.url === 'http://medgenemr.com/fhir/StructureDefinition/encounter-notes')?.valueString || ''
  };
};

/**
 * Update FHIR Encounter resource with form data
 */
export const updateResource = (encounter = {}, formData, patientId) => {
  const now = new Date().toISOString();
  const scheduledDateTime = `${formData.scheduledDate}T${formData.scheduledTime}:00Z`;
  const endDateTime = new Date(new Date(scheduledDateTime).getTime() + (formData.duration * 60000)).toISOString();

  const resource = {
    resourceType: 'Encounter',
    meta: {
      lastUpdated: now,
      versionId: encounter.meta?.versionId ? String(parseInt(encounter.meta.versionId) + 1) : '1'
    },
    status: formData.status || 'planned',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: formData.type,
      display: ENCOUNTER_TYPES.find(t => t.value === formData.type)?.display || 'Ambulatory'
    },
    type: [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: getEncounterTypeCode(formData.type),
        display: ENCOUNTER_TYPES.find(t => t.value === formData.type)?.display || 'Ambulatory'
      }],
      text: ENCOUNTER_TYPES.find(t => t.value === formData.type)?.display || 'Ambulatory'
    }],
    subject: {
      reference: `Patient/${patientId}`
    },
    period: {
      start: scheduledDateTime,
      end: endDateTime
    }
  };

  // Add optional fields only if they have values
  if (formData.priority && formData.priority !== 'routine') {
    resource.priority = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
        code: formData.priority,
        display: PRIORITY_LEVELS.find(p => p.value === formData.priority)?.display || 'Routine'
      }]
    };
  }

  if (formData.provider) {
    resource.participant = [{
      type: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          code: 'ATND',
          display: 'Attending'
        }]
      }],
      individual: {
        reference: 'Practitioner/current-provider',
        display: formData.provider
      }
    }];
  }

  if (formData.reasonForVisit) {
    resource.reasonCode = [{
      text: formData.reasonForVisit
    }];
  }

  if (formData.location) {
    resource.location = [{
      location: {
        display: ENCOUNTER_LOCATIONS.find(l => l.value === formData.location)?.display || 'Main Clinic',
        reference: `Location/${formData.location}`
      }
    }];
  }

  // Add extensions only if we have content
  const extensions = [];
  if (formData.checklist && formData.checklist.length > 0) {
    extensions.push({
      url: 'http://medgenemr.com/fhir/StructureDefinition/encounter-checklist',
      valueString: formData.checklist.join(',')
    });
  }
  if (formData.expectedOrders && formData.expectedOrders.length > 0) {
    extensions.push({
      url: 'http://medgenemr.com/fhir/StructureDefinition/encounter-expected-orders',
      valueString: formData.expectedOrders.join(',')
    });
  }
  if (formData.notes) {
    extensions.push({
      url: 'http://medgenemr.com/fhir/StructureDefinition/encounter-notes',
      valueString: formData.notes
    });
  }
  if (extensions.length > 0) {
    resource.extension = extensions;
  }

  // Add id only for existing encounters (edit mode)
  if (encounter.id) {
    resource.id = encounter.id;
  }

  return resource;
};

/**
 * Create new FHIR Encounter resource from form data
 */
export const createEncounterResource = (formData, patientId) => {
  return updateResource({}, formData, patientId);
};

/**
 * Validation rules for encounter data
 */
export const validationRules = {
  type: {
    required: true,
    label: 'Encounter type'
  },
  reasonForVisit: {
    required: true,
    label: 'Reason for visit'
  },
  provider: {
    required: true,
    label: 'Provider'
  },
  scheduledDate: {
    required: true,
    label: 'Scheduled date'
  },
  scheduledTime: {
    required: true,
    label: 'Scheduled time'
  },
  duration: {
    required: true,
    label: 'Duration',
    custom: (value) => {
      const duration = parseInt(value);
      if (isNaN(duration) || duration < 5 || duration > 480) {
        return 'Duration must be between 5 and 480 minutes';
      }
      return null;
    }
  }
};

/**
 * Form steps configuration for stepper
 */
export const formSteps = [
  { 
    id: 'basic', 
    label: 'Basic Information', 
    description: 'Set encounter type and timing',
    fields: ['selectedTemplate', 'type', 'scheduledDate', 'scheduledTime', 'duration', 'priority']
  },
  { 
    id: 'clinical', 
    label: 'Clinical Details', 
    description: 'Chief complaint and reason for visit',
    fields: ['reasonForVisit', 'chiefComplaint', 'checklist', 'expectedOrders']
  },
  { 
    id: 'provider', 
    label: 'Provider & Location', 
    description: 'Assign provider and location',
    fields: ['provider', 'location', 'notes']
  },
  { 
    id: 'review', 
    label: 'Review & Create', 
    description: 'Review all details before creation',
    fields: []
  }
];

/**
 * Default form values
 */
export const initialValues = {
  selectedTemplate: '',
  type: 'AMB',
  reasonForVisit: '',
  chiefComplaint: '',
  provider: '',
  location: 'main-clinic',
  scheduledDate: new Date().toISOString().split('T')[0],
  scheduledTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
  duration: 30,
  priority: 'routine',
  status: 'planned',
  checklist: [],
  expectedOrders: [],
  notes: ''
};

// Helper function to get SNOMED CT codes for encounter types
function getEncounterTypeCode(type) {
  const codes = {
    'AMB': '185347001',     // Encounter for check up
    'EMER': '50849002',     // Emergency room visit
    'HH': '185460008',      // Home visit
    'IMP': '32485007',      // Hospital admission
    'OBSENC': '448951000124107', // Observation encounter
    'PRENC': '185349003',   // Encounter for pre-admission
    'SS': '183807002',      // Inpatient stay
    'VR': '185317003'       // Telephone encounter
  };
  return codes[type] || codes['AMB'];
}