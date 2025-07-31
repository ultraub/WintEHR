/**
 * FHIR Field Access Utilities
 * Provides resilient field access patterns for FHIR resources that work with both
 * original and preprocessed/normalized data structures from the backend.
 */

/**
 * Get condition clinical status with fallback patterns
 * @param {Object} condition - FHIR Condition resource
 * @returns {string} - Clinical status code or null
 */
export const getConditionStatus = (condition) => {
  if (!condition) return null;
  
  // Handle multiple possible structures for clinical status
  return condition.clinicalStatus?.coding?.[0]?.code || 
         condition.clinicalStatus?.code ||
         condition.clinicalStatus;
};

/**
 * Get condition verification status with fallback patterns
 * @param {Object} condition - FHIR Condition resource
 * @returns {string} - Verification status code or null
 */
export const getConditionVerificationStatus = (condition) => {
  if (!condition) return null;
  
  return condition.verificationStatus?.coding?.[0]?.code || 
         condition.verificationStatus?.code ||
         condition.verificationStatus;
};

/**
 * Get medication status with fallback patterns
 * @param {Object} medication - FHIR MedicationRequest resource
 * @returns {string} - Medication status or null
 */
export const getMedicationStatus = (medication) => {
  if (!medication) return null;
  
  // Medication status is typically a simple string, but check for nested structures
  return medication.status?.coding?.[0]?.code || 
         medication.status?.code ||
         medication.status;
};

/**
 * Get observation category with fallback patterns
 * @param {Object} observation - FHIR Observation resource
 * @returns {string} - Category code or null
 */
export const getObservationCategory = (observation) => {
  if (!observation || !observation.category) return null;
  
  // Category is typically an array of CodeableConcept
  const category = observation.category[0];
  if (!category) return null;
  
  return category.coding?.[0]?.code ||
         category.code ||
         category;
};

/**
 * Get observation status with fallback patterns
 * @param {Object} observation - FHIR Observation resource
 * @returns {string} - Status code or null
 */
export const getObservationStatus = (observation) => {
  if (!observation) return null;
  
  return observation.status?.coding?.[0]?.code || 
         observation.status?.code ||
         observation.status;
};

/**
 * Get observation interpretation with fallback patterns
 * @param {Object} observation - FHIR Observation resource
 * @returns {string} - Interpretation code or null
 */
export const getObservationInterpretation = (observation) => {
  if (!observation || !observation.interpretation) return null;
  
  const interpretation = observation.interpretation[0];
  if (!interpretation) return null;
  
  return interpretation.coding?.[0]?.code ||
         interpretation.code ||
         interpretation;
};

/**
 * Get encounter class with fallback patterns
 * @param {Object} encounter - FHIR Encounter resource
 * @returns {string} - Class code or null
 */
export const getEncounterClass = (encounter) => {
  if (!encounter || !encounter.class) return null;
  
  // Handle both array and single object formats
  if (Array.isArray(encounter.class)) {
    const classItem = encounter.class[0];
    return classItem?.coding?.[0]?.code || classItem?.code || classItem;
  }
  
  return encounter.class?.coding?.[0]?.code || 
         encounter.class?.code ||
         encounter.class;
};

/**
 * Get encounter status with fallback patterns
 * @param {Object} encounter - FHIR Encounter resource
 * @returns {string} - Status code or null
 */
export const getEncounterStatus = (encounter) => {
  if (!encounter) return null;
  
  return encounter.status?.coding?.[0]?.code || 
         encounter.status?.code ||
         encounter.status;
};

/**
 * Get resource display text with fallback patterns
 * @param {Object} resource - FHIR resource with code field
 * @returns {string} - Display text or 'Unknown'
 */
export const getResourceDisplayText = (resource) => {
  if (!resource || !resource.code) return 'Unknown';
  
  return resource.code?.text || 
         resource.code?.coding?.[0]?.display || 
         resource.code?.coding?.[0]?.code ||
         'Unknown';
};

/**
 * Get CodeableConcept display text with fallback patterns
 * @param {Object} codeableConcept - FHIR CodeableConcept
 * @returns {string} - Display text or 'Unknown'
 */
export const getCodeableConceptDisplay = (codeableConcept) => {
  if (!codeableConcept) return 'Unknown';
  
  return codeableConcept.text || 
         codeableConcept.coding?.[0]?.display || 
         codeableConcept.coding?.[0]?.code ||
         'Unknown';
};

/**
 * Get reference ID from various reference formats
 * @param {Object|string} reference - FHIR reference
 * @returns {string} - Reference ID or null
 */
export const getReferenceId = (reference) => {
  if (!reference) return null;
  
  if (typeof reference === 'string') {
    // Handle both "ResourceType/id" and "urn:uuid:id" formats
    if (reference.startsWith('urn:uuid:')) {
      return reference.replace('urn:uuid:', '');
    }
    return reference.split('/').pop();
  }
  
  if (typeof reference === 'object' && reference.reference) {
    return getReferenceId(reference.reference);
  }
  
  return null;
};

/**
 * Check if a condition is active
 * @param {Object} condition - FHIR Condition resource
 * @returns {boolean} - True if condition is active
 */
export const isConditionActive = (condition) => {
  const status = getConditionStatus(condition);
  return status === 'active';
};

/**
 * Check if a medication is active
 * @param {Object} medication - FHIR MedicationRequest resource
 * @returns {boolean} - True if medication is active
 */
export const isMedicationActive = (medication) => {
  const status = getMedicationStatus(medication);
  return status === 'active';
};

/**
 * Check if an observation is a laboratory result
 * @param {Object} observation - FHIR Observation resource
 * @returns {boolean} - True if observation is laboratory
 */
export const isObservationLaboratory = (observation) => {
  const category = getObservationCategory(observation);
  return category === 'laboratory';
};

/**
 * Check if an observation is final
 * @param {Object} observation - FHIR Observation resource
 * @returns {boolean} - True if observation is final
 */
export const isObservationFinal = (observation) => {
  const status = getObservationStatus(observation);
  return status === 'final';
};

/**
 * Check if an encounter is ambulatory
 * @param {Object} encounter - FHIR Encounter resource
 * @returns {boolean} - True if encounter is ambulatory
 */
export const isEncounterAmbulatory = (encounter) => {
  const classCode = getEncounterClass(encounter);
  return classCode === 'AMB';
};

/**
 * Check if an encounter is finished
 * @param {Object} encounter - FHIR Encounter resource
 * @returns {boolean} - True if encounter is finished
 */
export const isEncounterFinished = (encounter) => {
  const status = getEncounterStatus(encounter);
  return status === 'finished';
};

/**
 * Get observation interpretation display info
 * @param {Object} observation - FHIR Observation resource
 * @returns {Object} - Interpretation display info with icon, color, and label
 */
export const getObservationInterpretationDisplay = (observation) => {
  const interpretation = getObservationInterpretation(observation);
  
  switch (interpretation) {
    case 'H':
    case 'HH':
      return { color: 'error', label: 'High', severity: 'high' };
    case 'L':
    case 'LL':
      return { color: 'warning', label: 'Low', severity: 'low' };
    case 'A':
    case 'AA':
      return { color: 'error', label: 'Abnormal', severity: 'abnormal' };
    case 'N':
      return { color: 'success', label: 'Normal', severity: 'normal' };
    default:
      return { color: 'default', label: 'Unknown', severity: 'unknown' };
  }
};

/**
 * Standard FHIR status mappings for consistent filtering
 */
export const FHIR_STATUS_VALUES = {
  CONDITION: {
    ACTIVE: 'active',
    RESOLVED: 'resolved',
    INACTIVE: 'inactive',
    REMISSION: 'remission',
    ENTERED_IN_ERROR: 'entered-in-error'
  },
  MEDICATION: {
    ACTIVE: 'active',
    STOPPED: 'stopped',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    ENTERED_IN_ERROR: 'entered-in-error'
  },
  OBSERVATION: {
    FINAL: 'final',
    PRELIMINARY: 'preliminary',
    REGISTERED: 'registered',
    AMENDED: 'amended',
    CANCELLED: 'cancelled',
    ENTERED_IN_ERROR: 'entered-in-error'
  },
  ENCOUNTER: {
    PLANNED: 'planned',
    ARRIVED: 'arrived',
    IN_PROGRESS: 'in-progress',
    FINISHED: 'finished',
    CANCELLED: 'cancelled',
    ENTERED_IN_ERROR: 'entered-in-error'
  }
};