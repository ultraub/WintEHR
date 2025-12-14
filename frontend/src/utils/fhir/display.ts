/**
 * FHIR Display Utilities
 *
 * Functions for extracting display values from FHIR resources
 * in a consistent, type-safe manner.
 */

/**
 * FHIR CodeableConcept type
 */
interface CodeableConcept {
  text?: string;
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
}

/**
 * FHIR HumanName type
 */
interface HumanName {
  use?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  text?: string;
}

/**
 * FHIR Reference type
 */
interface Reference {
  reference?: string;
  display?: string;
}

/**
 * Get display text from a CodeableConcept
 * @param codeableConcept - FHIR CodeableConcept
 * @returns Display text or empty string
 */
export const getCodeDisplay = (codeableConcept: CodeableConcept | null | undefined): string => {
  if (!codeableConcept) return '';

  // Prefer text field
  if (codeableConcept.text) return codeableConcept.text;

  // Fall back to first coding display
  const coding = codeableConcept.coding?.[0];
  if (!coding) return '';

  return coding.display || coding.code || '';
};

/**
 * Get code value from a CodeableConcept
 * @param codeableConcept - FHIR CodeableConcept
 * @param system - Optional system to filter by
 * @returns Code value or empty string
 */
export const getCodeValue = (
  codeableConcept: CodeableConcept | null | undefined,
  system?: string
): string => {
  if (!codeableConcept?.coding) return '';

  const coding = system
    ? codeableConcept.coding.find(c => c.system === system)
    : codeableConcept.coding[0];

  return coding?.code || '';
};

/**
 * Format a FHIR HumanName for display
 * @param name - FHIR HumanName or array of names
 * @param format - Format type: 'full', 'short', 'family'
 * @returns Formatted name string
 */
export const getPatientName = (
  name: HumanName | HumanName[] | null | undefined,
  format: 'full' | 'short' | 'family' = 'full'
): string => {
  if (!name) return 'Unknown';

  // Handle array of names - prefer 'official' use, fall back to first
  const nameObj = Array.isArray(name)
    ? name.find(n => n.use === 'official') || name[0]
    : name;

  if (!nameObj) return 'Unknown';

  // If text is provided, use it for full format
  if (format === 'full' && nameObj.text) {
    return nameObj.text;
  }

  const given = nameObj.given?.join(' ') || '';
  const family = nameObj.family || '';

  switch (format) {
    case 'family':
      return family || 'Unknown';
    case 'short':
      return given ? `${given.split(' ')[0]} ${family}`.trim() : family;
    case 'full':
    default:
      return `${given} ${family}`.trim() || 'Unknown';
  }
};

/**
 * Get initials from a name
 * @param name - Name string or FHIR HumanName
 * @returns Initials (1-2 characters)
 */
export const getInitials = (name: string | HumanName | HumanName[] | null | undefined): string => {
  if (!name) return '?';

  // Convert FHIR name to string if needed
  const nameStr = typeof name === 'string' ? name : getPatientName(name);

  const parts = nameStr.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Get display value from a FHIR Reference
 * @param reference - FHIR Reference
 * @returns Display value or extracted ID
 */
export const getReferenceDisplay = (reference: Reference | string | null | undefined): string => {
  if (!reference) return '';

  if (typeof reference === 'string') {
    return reference.split('/').pop() || '';
  }

  return reference.display || reference.reference?.split('/').pop() || '';
};

/**
 * Format medication display from MedicationRequest or Medication
 * @param medication - MedicationRequest or Medication resource
 * @returns Formatted medication name
 */
export const getMedicationDisplay = (
  medication: {
    medicationCodeableConcept?: CodeableConcept;
    medicationReference?: Reference;
    code?: CodeableConcept;
  } | null | undefined
): string => {
  if (!medication) return 'Unknown Medication';

  // Check medicationCodeableConcept first (MedicationRequest)
  if (medication.medicationCodeableConcept) {
    return getCodeDisplay(medication.medicationCodeableConcept);
  }

  // Check medicationReference (MedicationRequest with reference)
  if (medication.medicationReference) {
    return getReferenceDisplay(medication.medicationReference);
  }

  // Check code (Medication resource)
  if (medication.code) {
    return getCodeDisplay(medication.code);
  }

  return 'Unknown Medication';
};

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default 50)
 * @returns Truncated text
 */
export const truncateText = (text: string | null | undefined, maxLength: number = 50): string => {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength - 3) + '...';
};
