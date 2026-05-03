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
 * Service type definitions.
 *
 * Only two distinct execution paths exist at runtime: the visual condition
 * tree (anything not `cql-based`) and the CQL bridge (`cql-based`). Earlier
 * cosmetic types (medication-based, lab-value-based, preventive-care,
 * risk-assessment, workflow-automation) all dispatched through the same
 * visual path, so they were collapsed into the single Visual entry. Old
 * services persisted with those legacy ids continue to load — the backend
 * treats anything that isn't `cql-based` as visual.
 */
export const SERVICE_TYPES = {
  CONDITION_BASED: {
    id: 'condition-based',
    label: 'Visual rule',
    description: 'Build the trigger logic with the visual condition tree',
    icon: '🔍',
    hookTypes: ['patient-view', 'encounter-start', 'medication-prescribe', 'order-select', 'order-sign'],
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
        'TAKES_MEDICATION',
        'LAB_VALUE',
        'LAST_VISIT_DATE'
      ]
    },

    examples: [
      'Alert if patient >65 with no recent wellness visit',
      'Flag patients overdue for cancer screening',
      'Warn on potassium > 5.5'
    ]
  },

  CQL_BASED: {
    id: 'cql-based',
    label: 'CQL rule',
    description: 'Author rules in Clinical Quality Language; HAPI evaluates via $apply',
    icon: '📝',
    hookTypes: ['patient-view', 'medication-prescribe', 'order-select', 'encounter-start'],
    defaultHook: 'patient-view',

    // CQL services don't use the visual condition tree — logic lives in the
    // CQL `Applicability` define (gates whether the card fires) plus optional
    // `CardSummary` / `CardDetail` defines (substituted into card text via
    // PlanDefinition.action.dynamicValue at runtime).
    schema: {
      cqlAuthoring: true,
      requiredDefines: ['Applicability'],
      optionalDefines: ['CardSummary', 'CardDetail'],
      recommendedDataSources: [] // CQL declares its own data needs
    },

    examples: [
      'Use student-composed ValueSets for screening logic',
      'Date arithmetic and temporal conditions',
      'Reusable defines shared across rules'
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
    'cql-based': {
      summary: 'CDS recommendation',
      detail: '(Personalized text comes from the `CardSummary` / `CardDetail` CQL defines if present)',
      indicator: 'info',
      source: { label: 'Custom CQL Rule' },
      suggestions: [],
      links: []
    }
  };

  return templates[typeId] || templates['condition-based'];
}

export default SERVICE_TYPES;
