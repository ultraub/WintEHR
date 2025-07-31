/**
 * FHIR Search Parameters Utility
 * Provides helper functions for building FHIR search queries
 * Based on FHIR R4 search parameter specifications
 */

/**
 * FHIR Resource search parameters mapping
 * Defines available search parameters for each resource type
 */
export const FHIR_SEARCH_PARAMS = {
  Patient: {
    identifier: { type: 'token', description: 'A patient identifier' },
    name: { type: 'string', description: 'A portion of either family or given name of the patient' },
    family: { type: 'string', description: 'A portion of the family name of the patient' },
    given: { type: 'string', description: 'A portion of the given name of the patient' },
    birthdate: { type: 'date', description: 'The patient\'s date of birth' },
    gender: { type: 'token', description: 'Gender of the patient' },
    address: { type: 'string', description: 'An address in any kind of address/part of the patient' },
    'address-city': { type: 'string', description: 'A city specified in an address' },
    'address-state': { type: 'string', description: 'A state specified in an address' },
    'address-postalcode': { type: 'string', description: 'A postal code specified in an address' },
    telecom: { type: 'token', description: 'The value in any kind of telecom details of the patient' },
    active: { type: 'token', description: 'Whether the patient record is active' },
    deceased: { type: 'token', description: 'This patient has been marked as deceased' }
  },

  Encounter: {
    identifier: { type: 'token', description: 'Identifier(s) by which this encounter is known' },
    status: { type: 'token', description: 'planned | arrived | triaged | in-progress | onleave | finished | cancelled +' },
    class: { type: 'token', description: 'Classification of patient encounter' },
    type: { type: 'token', description: 'Specific type of encounter' },
    subject: { type: 'reference', description: 'The patient or group present at the encounter' },
    patient: { type: 'reference', description: 'The patient present at the encounter' },
    participant: { type: 'reference', description: 'Persons involved in the encounter other than the patient' },
    period: { type: 'date', description: 'Time period during which the encounter was in progress' },
    date: { type: 'date', description: 'A date within the period the Encounter lasted' },
    'reason-code': { type: 'token', description: 'Coded reason the encounter takes place' },
    'reason-reference': { type: 'reference', description: 'Reason the encounter takes place (reference)' },
    location: { type: 'reference', description: 'Location the encounter takes place' },
    'service-provider': { type: 'reference', description: 'The custodian organization of this Encounter record' }
  },

  Observation: {
    identifier: { type: 'token', description: 'The unique id for a particular observation' },
    status: { type: 'token', description: 'The status of the observation' },
    category: { type: 'token', description: 'The classification of the type of observation' },
    code: { type: 'token', description: 'The code of the observation type' },
    subject: { type: 'reference', description: 'The subject that the observation is about' },
    patient: { type: 'reference', description: 'The subject that the observation is about (if patient)' },
    encounter: { type: 'reference', description: 'Encounter related to the observation' },
    date: { type: 'date', description: 'Obtained date/time. If the obtained element is a period, a date that falls in the period' },
    effective: { type: 'date', description: 'Obtained date/time. If the obtained element is a period, a date that falls in the period' },
    performer: { type: 'reference', description: 'Who performed the observation' },
    'value-quantity': { type: 'quantity', description: 'The value of the observation, if the value is a Quantity, or a SampledData' },
    'value-string': { type: 'string', description: 'The value of the observation, if the value is a string, and also searches in CodeableConcept.text' },
    'value-concept': { type: 'token', description: 'The value of the observation, if the value is a CodeableConcept' },
    'component-code': { type: 'token', description: 'The component code of the observation type' },
    'component-value-quantity': { type: 'quantity', description: 'The value of the component observation, if the value is a Quantity, or a SampledData' }
  },

  Condition: {
    identifier: { type: 'token', description: 'A unique identifier of the condition record' },
    'clinical-status': { type: 'token', description: 'The clinical status of the condition' },
    'verification-status': { type: 'token', description: 'The verification status to support the clinical status of the condition' },
    category: { type: 'token', description: 'The category of the condition' },
    severity: { type: 'token', description: 'The severity of the condition' },
    code: { type: 'token', description: 'Code for the condition' },
    subject: { type: 'reference', description: 'Who has the condition?' },
    patient: { type: 'reference', description: 'Who has the condition?' },
    encounter: { type: 'reference', description: 'Encounter created as part of' },
    'onset-date': { type: 'date', description: 'Date related onsets (dateTime and Period)' },
    'onset-age': { type: 'quantity', description: 'Onsets as age or age range' },
    'recorded-date': { type: 'date', description: 'Date record was first recorded' },
    'abatement-date': { type: 'date', description: 'Date-related abatements (dateTime and period)' }
  },

  MedicationRequest: {
    identifier: { type: 'token', description: 'Return prescriptions with this external identifier' },
    status: { type: 'token', description: 'Status of the prescription' },
    intent: { type: 'token', description: 'Returns prescriptions with different intents' },
    category: { type: 'token', description: 'Returns prescriptions with different categories' },
    medication: { type: 'reference', description: 'Return prescriptions for this medication reference' },
    code: { type: 'token', description: 'Return prescriptions of this medication code' },
    subject: { type: 'reference', description: 'The identity of a patient to list orders for' },
    patient: { type: 'reference', description: 'Returns prescriptions for a specific patient' },
    encounter: { type: 'reference', description: 'Return prescriptions with this encounter identifier' },
    'authored-on': { type: 'date', description: 'Return prescriptions written on this date' },
    requester: { type: 'reference', description: 'Returns prescriptions prescribed by this prescriber' }
  },

  Procedure: {
    identifier: { type: 'token', description: 'A unique identifier for a procedure' },
    status: { type: 'token', description: 'preparation | in-progress | not-done | suspended | aborted | completed | entered-in-error | unknown' },
    category: { type: 'token', description: 'Classification of the procedure' },
    code: { type: 'token', description: 'A code to identify a procedure' },
    subject: { type: 'reference', description: 'Search by subject' },
    patient: { type: 'reference', description: 'Search by subject - a patient' },
    encounter: { type: 'reference', description: 'Encounter created as part of' },
    date: { type: 'date', description: 'When the procedure was performed' },
    'performed-date': { type: 'date', description: 'Date the procedure was performed' },
    performer: { type: 'reference', description: 'The reference to the practitioner' },
    'reason-code': { type: 'token', description: 'Coded reason procedure performed' },
    'reason-reference': { type: 'reference', description: 'The justification that the procedure was performed' },
    'body-site': { type: 'token', description: 'Target body site' },
    outcome: { type: 'token', description: 'The result of procedure' }
  },

  AllergyIntolerance: {
    identifier: { type: 'token', description: 'External ids for this item' },
    'clinical-status': { type: 'token', description: 'active | inactive | resolved' },
    'verification-status': { type: 'token', description: 'unconfirmed | confirmed | refuted | entered-in-error' },
    type: { type: 'token', description: 'allergy | intolerance - Underlying mechanism (if known)' },
    category: { type: 'token', description: 'food | medication | environment | biologic' },
    criticality: { type: 'token', description: 'low | high | unable-to-assess' },
    code: { type: 'token', description: 'Code that identifies the allergy or intolerance' },
    patient: { type: 'reference', description: 'Who the sensitivity is for' },
    encounter: { type: 'reference', description: 'Encounter where the allergy was asserted' },
    onset: { type: 'date', description: 'Date(/time) when manifestations showed' },
    date: { type: 'date', description: 'Date record was believed accurate' },
    recorder: { type: 'reference', description: 'Who recorded the sensitivity' },
    asserter: { type: 'reference', description: 'Source of the information about the allergy' }
  },

  Immunization: {
    identifier: { type: 'token', description: 'Business identifier' },
    status: { type: 'token', description: 'Immunization event status' },
    'vaccine-code': { type: 'token', description: 'Vaccine Product Administered' },
    patient: { type: 'reference', description: 'The patient for the vaccination record' },
    date: { type: 'date', description: 'Vaccination (non)-Administration Date' },
    'lot-number': { type: 'string', description: 'Vaccine Lot Number' },
    manufacturer: { type: 'reference', description: 'Vaccine Manufacturer' },
    performer: { type: 'reference', description: 'The practitioner or organization who played a role in the vaccination' },
    reaction: { type: 'reference', description: 'Additional information on reaction' },
    'reaction-date': { type: 'date', description: 'When reaction started' },
    'reason-code': { type: 'token', description: 'Reason why the vaccine was administered' },
    'reason-reference': { type: 'reference', description: 'Why immunization occurred' }
  },

  DiagnosticReport: {
    identifier: { type: 'token', description: 'An identifier for the report' },
    status: { type: 'token', description: 'The status of the report' },
    category: { type: 'token', description: 'Which diagnostic discipline/department created the report' },
    code: { type: 'token', description: 'The code for the report, as opposed to codes for the atomic results' },
    subject: { type: 'reference', description: 'The subject of the report' },
    patient: { type: 'reference', description: 'The subject of the report if a patient' },
    encounter: { type: 'reference', description: 'The Encounter when the order was made' },
    date: { type: 'date', description: 'The clinically relevant time of the report' },
    issued: { type: 'date', description: 'When the report was issued' },
    performer: { type: 'reference', description: 'Who is responsible for the report' },
    result: { type: 'reference', description: 'Link to an atomic result (observation resource)' }
  },

  DocumentReference: {
    identifier: { type: 'token', description: 'Master Version Specific Identifier' },
    status: { type: 'token', description: 'current | superseded | entered-in-error' },
    type: { type: 'token', description: 'Kind of document (LOINC if possible)' },
    category: { type: 'token', description: 'Categorization of document' },
    subject: { type: 'reference', description: 'Who/what is the subject of the document' },
    patient: { type: 'reference', description: 'Who/what is the subject of the document' },
    encounter: { type: 'reference', description: 'Context of the document content' },
    date: { type: 'date', description: 'When this document reference was created' },
    author: { type: 'reference', description: 'Who and/or what authored the document' },
    authenticator: { type: 'reference', description: 'Who/what authenticated the document' },
    custodian: { type: 'reference', description: 'Organization which maintains the document' },
    format: { type: 'token', description: 'Format/content rules for the document' },
    description: { type: 'string', description: 'Human-readable description' },
    'security-label': { type: 'token', description: 'Document security-tags' }
  },

  ImagingStudy: {
    identifier: { type: 'token', description: 'Identifiers for the Study, such as DICOM Study Instance UID and Accession number' },
    status: { type: 'token', description: 'The status of the study' },
    subject: { type: 'reference', description: 'Who the study is about' },
    patient: { type: 'reference', description: 'Who the study is about' },
    started: { type: 'date', description: 'When the study was started' },
    modality: { type: 'token', description: 'The modality of the study' },
    'body-site': { type: 'token', description: 'The body site studied' },
    instance: { type: 'token', description: 'SOP Instance UID for an instance' },
    series: { type: 'token', description: 'DICOM Series Instance UID for a series' },
    'dicom-class': { type: 'token', description: 'The type of the instance' }
  },

  CareTeam: {
    identifier: { type: 'token', description: 'External Ids for this team' },
    patient: { type: 'reference', description: 'Who care team is for' },
    subject: { type: 'reference', description: 'Who care team is for' },
    encounter: { type: 'reference', description: 'Encounter created as part of' },
    status: { type: 'token', description: 'proposed | active | suspended | inactive | entered-in-error' },
    category: { type: 'token', description: 'Type of team' },
    participant: { type: 'reference', description: 'Who is involved' },
    date: { type: 'date', description: 'Time period team covers' }
  },

  Coverage: {
    identifier: { type: 'token', description: 'The primary identifier of the insured and the coverage' },
    status: { type: 'token', description: 'The status of the Coverage' },
    type: { type: 'token', description: 'The kind of coverage (health plan, auto, Workers Compensation)' },
    'policy-holder': { type: 'reference', description: 'The party who \'owns\' the insurance policy' },
    subscriber: { type: 'reference', description: 'Reference to the subscriber' },
    beneficiary: { type: 'reference', description: 'Covered party' },
    patient: { type: 'reference', description: 'Retrieve coverages for a patient' },
    dependent: { type: 'string', description: 'Dependent number' },
    relationship: { type: 'token', description: 'The relationship of the beneficiary to the subscriber' },
    payor: { type: 'reference', description: 'The identity of the insurer or party paying for services' },
    'class-type': { type: 'token', description: 'Coverage class (eg. plan, group)' },
    'class-value': { type: 'string', description: 'Value of the class (eg. Plan number, group number)' },
    network: { type: 'string', description: 'Insurer network' }
  }
};

/**
 * Common search parameter modifiers
 */
export const SEARCH_MODIFIERS = {
  // String modifiers
  exact: 'exact',
  contains: 'contains',
  
  // Token modifiers
  text: 'text',
  not: 'not',
  above: 'above',
  below: 'below',
  in: 'in',
  'not-in': 'not-in',
  
  // Date modifiers
  missing: 'missing',
  
  // Reference modifiers
  identifier: 'identifier',
  type: 'type'
};

/**
 * Common control parameters
 */
export const CONTROL_PARAMS = {
  _count: { description: 'Number of results to return' },
  _offset: { description: 'Starting index for results' },
  _sort: { description: 'Sort order for results' },
  _include: { description: 'Include related resources' },
  _revinclude: { description: 'Reverse include related resources' },
  _summary: { description: 'Return summary information only' },
  _total: { description: 'Include total count in results' },
  _format: { description: 'Response format' }
};

/**
 * Build a FHIR search URL with parameters
 * @param {string} resourceType - FHIR resource type
 * @param {Object} params - Search parameters
 * @returns {string} Complete search URL
 */
export function buildSearchUrl(resourceType, params = {}) {
  const baseUrl = `/fhir/R4/${resourceType}`;
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, v));
      } else {
        searchParams.append(key, value);
      }
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Validate search parameters for a resource type
 * @param {string} resourceType - FHIR resource type
 * @param {Object} params - Search parameters to validate
 * @returns {Object} Validation result with valid params and errors
 */
export function validateSearchParams(resourceType, params) {
  const resourceParams = FHIR_SEARCH_PARAMS[resourceType];
  const validParams = {};
  const errors = [];
  
  if (!resourceParams) {
    errors.push(`Unknown resource type: ${resourceType}`);
    return { validParams, errors };
  }
  
  Object.entries(params).forEach(([key, value]) => {
    // Handle modifiers (e.g., name:exact, code:text)
    const [baseParam, modifier] = key.split(':');
    
    // Check control parameters
    if (CONTROL_PARAMS[baseParam]) {
      validParams[key] = value;
      return;
    }
    
    // Check resource-specific parameters
    if (resourceParams[baseParam]) {
      validParams[key] = value;
      
      // Validate modifier if present
      if (modifier && !Object.values(SEARCH_MODIFIERS).includes(modifier)) {
        errors.push(`Invalid modifier '${modifier}' for parameter '${baseParam}'`);
      }
    } else {
      errors.push(`Invalid search parameter '${baseParam}' for resource type '${resourceType}'`);
    }
  });
  
  return { validParams, errors };
}

/**
 * Get available search parameters for a resource type
 * @param {string} resourceType - FHIR resource type
 * @returns {Object} Available search parameters with descriptions
 */
export function getAvailableParams(resourceType) {
  const resourceParams = FHIR_SEARCH_PARAMS[resourceType];
  if (!resourceParams) {
    return {};
  }
  
  return {
    ...resourceParams,
    ...CONTROL_PARAMS
  };
}

/**
 * Format parameter value based on type
 * @param {string} paramType - Parameter type (string, token, date, etc.)
 * @param {any} value - Parameter value
 * @returns {string} Formatted parameter value
 */
export function formatParamValue(paramType, value) {
  switch (paramType) {
    case 'date':
      if (value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      return value;
      
    case 'token':
      if (typeof value === 'object' && value.system && value.code) {
        return `${value.system}|${value.code}`;
      }
      return value;
      
    case 'reference':
      if (typeof value === 'object' && value.resourceType && value.id) {
        return `${value.resourceType}/${value.id}`;
      }
      return value;
      
    case 'quantity':
      if (typeof value === 'object' && value.value && value.unit) {
        return `${value.value}|${value.system || ''}|${value.code || value.unit}`;
      }
      return value;
      
    default:
      return value;
  }
}

/**
 * Helper function to build patient-specific search params
 * @param {string} patientId - Patient ID
 * @param {Object} additionalParams - Additional search parameters
 * @returns {Object} Search parameters with patient filter
 */
export function buildPatientSearchParams(patientId, additionalParams = {}) {
  return {
    patient: patientId,
    _count: 1000,
    _sort: '-date',
    ...additionalParams
  };
}

/**
 * Helper function to build encounter-specific search params
 * @param {string} encounterId - Encounter ID
 * @param {Object} additionalParams - Additional search parameters
 * @returns {Object} Search parameters with encounter filter
 */
export function buildEncounterSearchParams(encounterId, additionalParams = {}) {
  return {
    encounter: encounterId,
    _count: 1000,
    _sort: '-date',
    ...additionalParams
  };
}

export default {
  FHIR_SEARCH_PARAMS,
  SEARCH_MODIFIERS,
  CONTROL_PARAMS,
  buildSearchUrl,
  validateSearchParams,
  getAvailableParams,
  formatParamValue,
  buildPatientSearchParams,
  buildEncounterSearchParams
};