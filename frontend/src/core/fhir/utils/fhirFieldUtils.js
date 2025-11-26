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
  
  // Return the full interpretation object so the caller can access coding
  return interpretation;
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
 * @param {string} defaultValue - Default value if no display found (default: 'Unknown')
 * @returns {string} - Display text or default value
 */
export const getCodeableConceptDisplay = (codeableConcept, defaultValue = 'Unknown') => {
  if (!codeableConcept) return defaultValue;

  return codeableConcept.text ||
         codeableConcept.coding?.[0]?.display ||
         codeableConcept.coding?.[0]?.code ||
         defaultValue;
};

/**
 * Safely extract the first coding code from a CodeableConcept
 *
 * Educational note: FHIR CodeableConcept can have multiple codings
 * from different code systems. This function safely returns the first
 * coding's code value, or null if none exists.
 *
 * @param {Object} codeableConcept - FHIR CodeableConcept
 * @returns {string|null} - First coding code or null
 */
export const getCodeableConceptCode = (codeableConcept) => {
  if (!codeableConcept) return null;
  if (!Array.isArray(codeableConcept.coding) || codeableConcept.coding.length === 0) {
    return null;
  }
  return codeableConcept.coding[0]?.code ?? null;
};

/**
 * Safely extract the first coding system from a CodeableConcept
 *
 * @param {Object} codeableConcept - FHIR CodeableConcept
 * @returns {string|null} - First coding system URI or null
 */
export const getCodeableConceptSystem = (codeableConcept) => {
  if (!codeableConcept) return null;
  if (!Array.isArray(codeableConcept.coding) || codeableConcept.coding.length === 0) {
    return null;
  }
  return codeableConcept.coding[0]?.system ?? null;
};

/**
 * Safely extract a coding from a specific system
 *
 * Educational note: When working with FHIR data, you often need to find
 * a code from a specific code system (e.g., LOINC, SNOMED CT, RxNorm).
 * This function finds the first coding matching the specified system.
 *
 * @param {Object} codeableConcept - FHIR CodeableConcept
 * @param {string} system - The code system URI to find (e.g., 'http://loinc.org')
 * @returns {Object|null} - The matching Coding object or null
 */
export const getCodingBySystem = (codeableConcept, system) => {
  if (!codeableConcept || !system) return null;
  if (!Array.isArray(codeableConcept.coding) || codeableConcept.coding.length === 0) {
    return null;
  }
  return codeableConcept.coding.find(coding => coding?.system === system) ?? null;
};

/**
 * Safely extract all codings from a CodeableConcept
 *
 * @param {Object} codeableConcept - FHIR CodeableConcept
 * @returns {Array} - Array of Coding objects (empty array if none)
 */
export const getAllCodings = (codeableConcept) => {
  if (!codeableConcept) return [];
  if (!Array.isArray(codeableConcept.coding)) return [];
  return codeableConcept.coding.filter(Boolean);
};

/**
 * Check if a CodeableConcept contains a specific code
 *
 * @param {Object} codeableConcept - FHIR CodeableConcept
 * @param {string} code - The code to search for
 * @param {string} system - Optional: restrict search to specific system
 * @returns {boolean} - True if the code is found
 */
export const hasCode = (codeableConcept, code, system = null) => {
  if (!codeableConcept || !code) return false;
  if (!Array.isArray(codeableConcept.coding) || codeableConcept.coding.length === 0) {
    return false;
  }

  return codeableConcept.coding.some(coding => {
    if (!coding) return false;
    const codeMatch = coding.code === code;
    const systemMatch = system === null || coding.system === system;
    return codeMatch && systemMatch;
  });
};

/**
 * Safely extract display text from the first element of a CodeableConcept array
 *
 * Educational note: Many FHIR fields are arrays of CodeableConcept (e.g., category,
 * reasonCode). This function safely handles array access.
 *
 * @param {Array} codeableConceptArray - Array of CodeableConcept
 * @param {number} index - Index to access (default: 0)
 * @param {string} defaultValue - Default if not found
 * @returns {string} - Display text or default
 */
export const getCodeableConceptArrayDisplay = (codeableConceptArray, index = 0, defaultValue = 'Unknown') => {
  if (!Array.isArray(codeableConceptArray) || codeableConceptArray.length === 0) {
    return defaultValue;
  }
  if (index < 0 || index >= codeableConceptArray.length) {
    return defaultValue;
  }
  return getCodeableConceptDisplay(codeableConceptArray[index], defaultValue);
};

/**
 * Safely extract code from the first element of a CodeableConcept array
 *
 * @param {Array} codeableConceptArray - Array of CodeableConcept
 * @param {number} index - Index to access (default: 0)
 * @returns {string|null} - Code or null
 */
export const getCodeableConceptArrayCode = (codeableConceptArray, index = 0) => {
  if (!Array.isArray(codeableConceptArray) || codeableConceptArray.length === 0) {
    return null;
  }
  if (index < 0 || index >= codeableConceptArray.length) {
    return null;
  }
  return getCodeableConceptCode(codeableConceptArray[index]);
};

/**
 * Extract all display texts from a CodeableConcept array
 *
 * @param {Array} codeableConceptArray - Array of CodeableConcept
 * @returns {Array<string>} - Array of display texts
 */
export const getAllCodeableConceptDisplays = (codeableConceptArray) => {
  if (!Array.isArray(codeableConceptArray)) return [];
  return codeableConceptArray
    .filter(Boolean)
    .map(cc => getCodeableConceptDisplay(cc, null))
    .filter(Boolean);
};

/**
 * Create a CodeableConcept from simple values
 *
 * Educational note: This helper creates a properly structured FHIR
 * CodeableConcept from individual values, useful for creating new
 * resources or search parameters.
 *
 * @param {string} code - The code value
 * @param {string} display - Human-readable display (optional)
 * @param {string} system - The code system URI (optional)
 * @param {string} text - The text representation (optional)
 * @returns {Object} - A properly structured CodeableConcept
 */
export const createCodeableConcept = (code, display = null, system = null, text = null) => {
  const coding = { code };
  if (display) coding.display = display;
  if (system) coding.system = system;

  const result = { coding: [coding] };
  if (text) result.text = text;
  else if (display) result.text = display;

  return result;
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