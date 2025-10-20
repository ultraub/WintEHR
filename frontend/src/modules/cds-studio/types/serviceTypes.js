/**
 * CDS Service Type Definitions
 *
 * Defines the visual service builder schema for different clinical service types.
 * Each service type has a unique structure optimized for its clinical domain.
 */

/**
 * Condition block structure for visual rule builder
 */
export const CONDITION_OPERATORS = {
  // Comparison operators
  EQUALS: { value: '==', label: 'equals', types: ['string', 'number', 'code'] },
  NOT_EQUALS: { value: '!=', label: 'does not equal', types: ['string', 'number', 'code'] },
  GREATER_THAN: { value: '>', label: 'greater than', types: ['number', 'age', 'date'] },
  LESS_THAN: { value: '<', label: 'less than', types: ['number', 'age', 'date'] },
  GREATER_EQUAL: { value: '>=', label: 'greater than or equal to', types: ['number', 'age', 'date'] },
  LESS_EQUAL: { value: '<=', label: 'less than or equal to', types: ['number', 'age', 'date'] },

  // String operators
  CONTAINS: { value: 'contains', label: 'contains', types: ['string'] },
  STARTS_WITH: { value: 'startsWith', label: 'starts with', types: ['string'] },
  ENDS_WITH: { value: 'endsWith', label: 'ends with', types: ['string'] },

  // Existence operators
  EXISTS: { value: 'exists', label: 'exists', types: ['any'] },
  NOT_EXISTS: { value: 'notExists', label: 'does not exist', types: ['any'] },

  // Array operators
  IN: { value: 'in', label: 'is one of', types: ['code', 'string'] },
  NOT_IN: { value: 'notIn', label: 'is not one of', types: ['code', 'string'] },

  // Date operators
  WITHIN_DAYS: { value: 'withinDays', label: 'within last N days', types: ['date'] },
  OLDER_THAN_DAYS: { value: 'olderThanDays', label: 'older than N days', types: ['date'] }
};

/**
 * Logical operators for combining conditions
 */
export const LOGICAL_OPERATORS = {
  AND: { value: 'AND', label: 'AND' },
  OR: { value: 'OR', label: 'OR' },
  NOT: { value: 'NOT', label: 'NOT' }
};

/**
 * Data sources for condition building
 */
export const DATA_SOURCES = {
  PATIENT_AGE: {
    id: 'patient.age',
    label: 'Patient Age',
    description: 'Current patient age in years',
    dataType: 'age',
    fhirPath: 'Patient.birthDate'
  },
  PATIENT_GENDER: {
    id: 'patient.gender',
    label: 'Patient Gender',
    description: 'Patient administrative gender',
    dataType: 'code',
    fhirPath: 'Patient.gender'
  },
  HAS_CONDITION: {
    id: 'conditions',
    label: 'Has Condition',
    description: 'Patient has active condition',
    dataType: 'code',
    fhirPath: 'Condition',
    catalogType: 'conditions'
  },
  HAS_ALLERGY: {
    id: 'allergies',
    label: 'Has Allergy',
    description: 'Patient has documented allergy',
    dataType: 'code',
    fhirPath: 'AllergyIntolerance',
    catalogType: 'allergies'
  },
  TAKES_MEDICATION: {
    id: 'medications',
    label: 'Takes Medication',
    description: 'Patient is taking medication',
    dataType: 'code',
    fhirPath: 'MedicationRequest',
    catalogType: 'medications'
  },
  LAB_VALUE: {
    id: 'lab.value',
    label: 'Lab Value',
    description: 'Most recent lab result value',
    dataType: 'number',
    fhirPath: 'Observation',
    catalogType: 'labs'
  },
  VITAL_SIGN: {
    id: 'vital.value',
    label: 'Vital Sign',
    description: 'Most recent vital sign value',
    dataType: 'number',
    fhirPath: 'Observation',
    catalogType: 'vitals'
  },
  LAST_VISIT_DATE: {
    id: 'encounter.lastDate',
    label: 'Last Visit Date',
    description: 'Date of most recent encounter',
    dataType: 'date',
    fhirPath: 'Encounter.period.start'
  },
  NO_RECENT_SCREENING: {
    id: 'screening.gap',
    label: 'No Recent Screening',
    description: 'Screening not performed recently',
    dataType: 'date',
    fhirPath: 'Observation',
    catalogType: 'labs'
  }
};

/**
 * Service type definitions with schemas
 */
export const SERVICE_TYPES = {
  CONDITION_BASED: {
    id: 'condition-based',
    label: 'Condition-Based Alert',
    description: 'Alert when patient has specific conditions or characteristics',
    icon: '🔍',
    hookTypes: ['patient-view', 'encounter-start'],
    defaultHook: 'patient-view',

    schema: {
      conditions: [
        {
          type: 'group',
          operator: 'AND',
          conditions: []
        }
      ],
      recommendedDataSources: [
        'PATIENT_AGE',
        'PATIENT_GENDER',
        'HAS_CONDITION',
        'LAST_VISIT_DATE'
      ]
    },

    examples: [
      'Alert if patient >65 with no recent wellness visit',
      'Identify patients with diabetes and hypertension',
      'Flag patients overdue for cancer screening'
    ]
  },

  MEDICATION_BASED: {
    id: 'medication-based',
    label: 'Medication Safety Check',
    description: 'Check for drug interactions, contraindications, and safety issues',
    icon: '💊',
    hookTypes: ['medication-prescribe', 'order-select'],
    defaultHook: 'medication-prescribe',

    schema: {
      checkTypes: [
        { id: 'interaction', label: 'Drug-Drug Interaction', enabled: true },
        { id: 'allergy', label: 'Allergy Check', enabled: true },
        { id: 'contraindication', label: 'Contraindication', enabled: true },
        { id: 'duplicate', label: 'Duplicate Therapy', enabled: true },
        { id: 'dose', label: 'Dose Range Check', enabled: false }
      ],
      medications: [], // Medication codes to check
      conditions: [], // Condition-based contraindications
      recommendedDataSources: [
        'TAKES_MEDICATION',
        'HAS_CONDITION',
        'HAS_ALLERGY',
        'PATIENT_AGE'
      ]
    },

    examples: [
      'Alert on warfarin + aspirin interaction',
      'Check for NSAIDs in patients with kidney disease',
      'Flag high-risk medications for elderly (Beers Criteria)'
    ]
  },

  LAB_VALUE_BASED: {
    id: 'lab-value-based',
    label: 'Lab Value Alert',
    description: 'Alert on abnormal or critical lab values',
    icon: '🔬',
    hookTypes: ['patient-view', 'order-sign'],
    defaultHook: 'patient-view',

    schema: {
      labTests: [], // Lab test codes
      thresholds: {
        critical: { enabled: true, min: null, max: null },
        abnormal: { enabled: true, min: null, max: null },
        trend: { enabled: false, direction: 'increasing', percentage: 20 }
      },
      timeframe: {
        mostRecent: true,
        withinDays: 7
      },
      recommendedDataSources: [
        'LAB_VALUE',
        'VITAL_SIGN'
      ]
    },

    examples: [
      'Alert on potassium < 3.0 or > 5.5',
      'Flag eGFR < 30 for medication adjustment',
      'Identify rising creatinine trend'
    ]
  },

  PREVENTIVE_CARE: {
    id: 'preventive-care',
    label: 'Preventive Care Reminder',
    description: 'Identify gaps in preventive care and screenings',
    icon: '🛡️',
    hookTypes: ['patient-view', 'encounter-start'],
    defaultHook: 'patient-view',

    schema: {
      screeningType: '', // mammography, colonoscopy, etc.
      ageRange: { min: null, max: null },
      frequency: { value: 1, unit: 'years' },
      conditions: [], // Risk factors
      recommendedDataSources: [
        'PATIENT_AGE',
        'PATIENT_GENDER',
        'NO_RECENT_SCREENING',
        'HAS_CONDITION'
      ]
    },

    examples: [
      'Mammography reminder for women 40-75',
      'Colonoscopy screening for patients 50+',
      'Diabetes screening for BMI >25'
    ]
  },

  RISK_ASSESSMENT: {
    id: 'risk-assessment',
    label: 'Risk Assessment',
    description: 'Calculate and display clinical risk scores',
    icon: '⚠️',
    hookTypes: ['patient-view', 'encounter-start'],
    defaultHook: 'patient-view',

    schema: {
      riskType: '', // cardiovascular, fall, readmission, etc.
      scoreComponents: [], // Factors contributing to risk score
      thresholds: {
        low: { max: 5, color: 'success' },
        moderate: { min: 5, max: 10, color: 'warning' },
        high: { min: 10, color: 'error' }
      },
      recommendedDataSources: [
        'PATIENT_AGE',
        'HAS_CONDITION',
        'LAB_VALUE',
        'VITAL_SIGN',
        'TAKES_MEDICATION'
      ]
    },

    examples: [
      'CHADS2-VASc stroke risk score',
      'Fall risk assessment for elderly',
      'Hospital readmission risk calculator'
    ]
  },

  WORKFLOW_AUTOMATION: {
    id: 'workflow-automation',
    label: 'Workflow Automation',
    description: 'Automate clinical workflows and task creation',
    icon: '🔄',
    hookTypes: ['order-sign', 'encounter-discharge'],
    defaultHook: 'order-sign',

    schema: {
      triggers: [], // Conditions that trigger automation
      actions: [], // Tasks to create, orders to place
      recommendedDataSources: [
        'HAS_CONDITION',
        'LAB_VALUE'
      ]
    },

    examples: [
      'Auto-order CBC with chemotherapy',
      'Create follow-up task for abnormal result',
      'Generate discharge instructions'
    ]
  }
};

/**
 * Get service type by ID
 */
export function getServiceType(typeId) {
  return SERVICE_TYPES[Object.keys(SERVICE_TYPES).find(key =>
    SERVICE_TYPES[key].id === typeId
  )];
}

/**
 * Get recommended data sources for a service type
 */
export function getRecommendedDataSources(typeId) {
  const serviceType = getServiceType(typeId);
  if (!serviceType) return [];

  return serviceType.schema.recommendedDataSources.map(sourceKey =>
    DATA_SOURCES[sourceKey]
  ).filter(Boolean);
}

/**
 * Get available operators for a data type
 */
export function getOperatorsForDataType(dataType) {
  return Object.values(CONDITION_OPERATORS).filter(op =>
    op.types.includes(dataType) || op.types.includes('any')
  );
}

/**
 * Default card template based on service type
 */
export function getDefaultCardTemplate(typeId) {
  const templates = {
    'condition-based': {
      summary: 'Patient meets condition criteria',
      detail: '',
      indicator: 'info',
      suggestions: [],
      links: []
    },
    'medication-based': {
      summary: 'Medication safety alert',
      detail: '',
      indicator: 'warning',
      suggestions: [
        { label: 'Review medication', actions: [] }
      ],
      links: []
    },
    'lab-value-based': {
      summary: 'Abnormal lab value detected',
      detail: '',
      indicator: 'warning',
      suggestions: [
        { label: 'Acknowledge result', actions: [] }
      ],
      links: []
    },
    'preventive-care': {
      summary: 'Preventive care reminder',
      detail: '',
      indicator: 'info',
      suggestions: [
        { label: 'Order screening', actions: [] },
        { label: 'Schedule appointment', actions: [] }
      ],
      links: []
    },
    'risk-assessment': {
      summary: 'Risk assessment result',
      detail: '',
      indicator: 'info',
      suggestions: [],
      links: []
    },
    'workflow-automation': {
      summary: 'Workflow action recommended',
      detail: '',
      indicator: 'info',
      suggestions: [],
      links: []
    }
  };

  return templates[typeId] || templates['condition-based'];
}

export default SERVICE_TYPES;
