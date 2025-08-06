/**
 * Medication Display Utilities
 * Shared functions for consistent medication information display across the application
 */

/**
 * Gets medication name from either R4 (medicationCodeableConcept) or R5 (medication.concept) format
 * @param {Object} medicationRequest - FHIR MedicationRequest object
 * @returns {string} - Medication name
 */
export const getMedicationName = (medicationRequest) => {
  if (!medicationRequest) return 'Unknown medication';
  
  // R5 format: medication.concept
  if (medicationRequest.medication?.concept) {
    const concept = medicationRequest.medication.concept;
    return concept.text || concept.coding?.[0]?.display || 'Unknown medication';
  }
  
  // R4 format: medicationCodeableConcept (legacy support)
  if (medicationRequest.medicationCodeableConcept) {
    const concept = medicationRequest.medicationCodeableConcept;
    return concept.text || concept.coding?.[0]?.display || 'Unknown medication';
  }
  
  // Reference format (fallback)
  if (medicationRequest.medicationReference) {
    return 'Medication (reference)';
  }
  
  return 'Unknown medication';
};

/**
 * Formats structured dosage information from FHIR dosageInstruction
 * @param {Object} dosageInstruction - FHIR dosageInstruction object
 * @returns {string|null} - Formatted dosage string or null if no structured data
 */
export const formatStructuredDosage = (dosageInstruction) => {
  if (!dosageInstruction) return null;
  
  const parts = [];
  
  // Extract dose amount
  const doseAndRate = dosageInstruction.doseAndRate?.[0];
  if (doseAndRate?.doseQuantity?.value) {
    const value = doseAndRate.doseQuantity.value;
    const unit = doseAndRate.doseQuantity.unit && doseAndRate.doseQuantity.unit !== 'dose' 
      ? doseAndRate.doseQuantity.unit 
      : '';
    parts.push(unit ? `${value} ${unit}` : value.toString());
  } else if (doseAndRate?.doseRange?.low?.value) {
    const lowValue = doseAndRate.doseRange.low.value;
    const highValue = doseAndRate.doseRange.high?.value;
    const unit = doseAndRate.doseRange.low.unit && doseAndRate.doseRange.low.unit !== 'dose'
      ? doseAndRate.doseRange.low.unit
      : '';
    if (highValue) {
      parts.push(unit ? `${lowValue}-${highValue} ${unit}` : `${lowValue}-${highValue}`);
    } else {
      parts.push(unit ? `${lowValue} ${unit}` : lowValue.toString());
    }
  }
  
  // Extract frequency from timing
  const timing = dosageInstruction.timing;
  if (timing?.repeat) {
    const repeat = timing.repeat;
    if (repeat.frequency && repeat.period && repeat.periodUnit) {
      if (repeat.frequency === 1 && repeat.period === 1) {
        switch (repeat.periodUnit) {
          case 'd': parts.push('once daily'); break;
          case 'h': parts.push(`every ${repeat.period} hours`); break;
          case 'wk': parts.push('weekly'); break;
          default: parts.push(`every ${repeat.period} ${repeat.periodUnit}`);
        }
      } else if (repeat.period === 1 && repeat.periodUnit === 'd') {
        switch (repeat.frequency) {
          case 2: parts.push('twice daily'); break;
          case 3: parts.push('three times daily'); break;
          case 4: parts.push('four times daily'); break;
          default: parts.push(`${repeat.frequency} times daily`);
        }
      } else {
        parts.push(`${repeat.frequency} times every ${repeat.period} ${repeat.periodUnit}`);
      }
    }
  }
  
  return parts.length > 0 ? parts.join(', ') : null;
};

/**
 * Gets the best available dosage display for a medication
 * Prioritizes structured dosage, falls back to text instructions
 * @param {Object} medication - FHIR MedicationRequest object
 * @returns {string} - Formatted dosage string
 */
export const getMedicationDosageDisplay = (medication) => {
  if (!medication?.dosageInstruction?.[0]) {
    return 'No dosage information';
  }
  
  const dosageInstruction = medication.dosageInstruction[0];
  const structuredDosage = formatStructuredDosage(dosageInstruction);
  
  if (structuredDosage) {
    return structuredDosage;
  }
  
  if (dosageInstruction.text) {
    return dosageInstruction.text;
  }
  
  return 'No dosage information';
};

/**
 * Gets route information for a medication
 * @param {Object} medication - FHIR MedicationRequest object
 * @returns {string|null} - Route display name or null if not available
 */
export const getMedicationRoute = (medication) => {
  const route = medication?.dosageInstruction?.[0]?.route;
  if (!route) return null;
  
  return route.text || route.coding?.[0]?.display || null;
};

/**
 * Gets formatted medication summary with dosage and route
 * @param {Object} medication - FHIR MedicationRequest object
 * @returns {string} - Complete medication summary
 */
export const getMedicationSummary = (medication) => {
  const parts = [];
  
  const dosage = getMedicationDosageDisplay(medication);
  if (dosage !== 'No dosage information') {
    parts.push(dosage);
  }
  
  const route = getMedicationRoute(medication);
  if (route) {
    parts.push(`Route: ${route}`);
  }
  
  return parts.length > 0 ? parts.join(' • ') : 'No dosage information';
};

/**
 * Gets medication priority information
 * @param {Object} medication - FHIR MedicationRequest object
 * @returns {Object|null} - Priority info with label and color, or null
 */
export const getMedicationPriority = (medication) => {
  const priority = medication?.priority;
  if (!priority || priority === 'routine') return null;
  
  switch (priority) {
    case 'stat':
      return { label: 'STAT', color: 'error' };
    case 'urgent':
    case 'asap':
      return { label: priority.toUpperCase(), color: 'warning' };
    default:
      return { label: priority.toUpperCase(), color: 'default' };
  }
};

/**
 * Checks if medication has special instructions different from structured dosage
 * @param {Object} medication - FHIR MedicationRequest object
 * @returns {string|null} - Special instructions text or null
 */
export const getMedicationSpecialInstructions = (medication) => {
  const dosageInstruction = medication?.dosageInstruction?.[0];
  if (!dosageInstruction?.text) return null;
  
  const structuredDosage = formatStructuredDosage(dosageInstruction);
  const textDosage = dosageInstruction.text;
  
  // Return text instructions if they're different from structured dosage
  if (structuredDosage && textDosage !== structuredDosage) {
    return textDosage;
  }
  
  return null;
};