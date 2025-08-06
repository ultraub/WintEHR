/**
 * AllergyConverter - FHIR AllergyIntolerance Resource Converter
 * Extends AbstractFHIRConverter to provide allergy-specific conversion logic
 */
import { AbstractFHIRConverter } from './AbstractFHIRConverter';

// FHIR Value Sets for AllergyIntolerance (moved from config)
export const ALLERGY_TYPES = [
  { value: 'allergy', display: 'Allergy' },
  { value: 'intolerance', display: 'Intolerance' }
];

export const CRITICALITY_LEVELS = [
  { value: 'low', display: 'Low', description: 'Unlikely to cause life-threatening reactions' },
  { value: 'high', display: 'High', description: 'May cause life-threatening reactions' },
  { value: 'unable-to-assess', display: 'Unable to assess', description: 'Unable to assess criticality' }
];

export const CLINICAL_STATUS_OPTIONS = [
  { value: 'active', display: 'Active' },
  { value: 'inactive', display: 'Inactive' },
  { value: 'resolved', display: 'Resolved' }
];

export const VERIFICATION_STATUS_OPTIONS = [
  { value: 'confirmed', display: 'Confirmed' },
  { value: 'unconfirmed', display: 'Unconfirmed' },
  { value: 'presumed', display: 'Presumed' },
  { value: 'refuted', display: 'Refuted' },
  { value: 'entered-in-error', display: 'Entered in Error' }
];

export const REACTION_SEVERITIES = [
  { value: 'mild', display: 'Mild' },
  { value: 'moderate', display: 'Moderate' },
  { value: 'severe', display: 'Severe' }
];

// Standard SNOMED CT codes for common allergy manifestations
export const COMMON_REACTIONS = [
  { code: '126485001', display: 'Urticaria', text: 'Hives' },
  { code: '418363000', display: 'Itching of skin', text: 'Itching' },
  { code: '271807003', display: 'Eruption of skin', text: 'Rash' },
  { code: '41291007', display: 'Angioedema', text: 'Swelling' },
  { code: '267036007', display: 'Dyspnea', text: 'Difficulty breathing' },
  { code: '4386001', display: 'Bronchospasm', text: 'Wheezing' },
  { code: '422587007', display: 'Nausea', text: 'Nausea' },
  { code: '422400008', display: 'Vomiting', text: 'Vomiting' },
  { code: '62315008', display: 'Diarrhea', text: 'Diarrhea' },
  { code: '39579001', display: 'Anaphylaxis', text: 'Anaphylaxis' },
  { code: '70076002', display: 'Rhinitis', text: 'Runny nose' },
  { code: '76067001', display: 'Sneezing', text: 'Sneezing' },
  { code: '9826008', display: 'Conjunctivitis', text: 'Watery eyes' },
  { code: '49727002', display: 'Cough', text: 'Cough' },
  { code: '24079001', display: 'Atopic dermatitis', text: 'Eczema' }
];

export class AllergyConverter extends AbstractFHIRConverter {
  constructor() {
    super('AllergyIntolerance', {
      generateId: true,
      validateRequired: true,
      preserveMeta: true
    });
  }

  /**
   * Get initial form values for new allergy
   * @returns {Object} Initial form values
   */
  getInitialValues() {
    return {
      selectedAllergen: null,
      customAllergen: '',
      allergyType: 'allergy',
      criticality: 'unable-to-assess',
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      onsetDate: null,
      reactions: [],
      reactionSeverity: 'mild',
      notes: ''
    };
  }

  /**
   * Parse FHIR AllergyIntolerance resource to form data
   * @param {Object} allergyIntolerance - FHIR AllergyIntolerance resource
   * @returns {Object} Form data
   */
  _parseResourceToForm(allergyIntolerance) {
    // Extract status fields
    const clinicalStatus = this.extractCoding(allergyIntolerance.clinicalStatus, 'active');
    const verificationStatus = this.extractCoding(allergyIntolerance.verificationStatus, 'confirmed');
    const criticality = this.safeString(allergyIntolerance.criticality, 'unable-to-assess');
    const type = this.extractCoding(allergyIntolerance.type, 'allergy');
    const onsetDate = this.parseDate(allergyIntolerance.onsetDateTime);
    
    // Extract allergen information
    let selectedAllergen = null;
    let customAllergen = '';
    
    if (allergyIntolerance.code) {
      const allergen = allergyIntolerance.code;
      if (allergen.coding && allergen.coding.length > 0) {
        const coding = allergen.coding[0];
        selectedAllergen = {
          code: coding.code,
          display: coding.display || allergen.text,
          system: coding.system || 'http://snomed.info/sct',
          source: 'existing'
        };
      } else if (allergen.text) {
        customAllergen = allergen.text;
      }
    }

    // Extract reactions - handle both R4 and R5 formats
    const reactions = allergyIntolerance.reaction?.map(r => {
      const manifestations = r.manifestation || [];
      return manifestations.map(manifestation => {
        // Handle R5 format: {concept: {text: ..., coding: [...]}}
        if (manifestation?.concept) {
          const concept = manifestation.concept;
          return concept.text || concept.coding?.[0]?.display || null;
        }
        // Handle R4 format: {text: ..., coding: [...]}
        else if (manifestation?.text) {
          return manifestation.text;
        }
        else if (manifestation?.coding?.[0]?.display) {
          return manifestation.coding[0].display;
        }
        return null;
      }).filter(Boolean);
    }).flat().filter(reaction => reaction && typeof reaction === 'string') || [];
    
    const reactionSeverity = this.safeString(allergyIntolerance.reaction?.[0]?.severity, 'mild');
    
    // Extract notes
    const notes = this.extractNotes(allergyIntolerance.note);

    return {
      selectedAllergen,
      customAllergen,
      allergyType: this.safeString(type, 'allergy'),
      criticality: this.safeString(criticality, 'unable-to-assess'),
      clinicalStatus: this.safeString(clinicalStatus, 'active'),
      verificationStatus: this.safeString(verificationStatus, 'confirmed'),
      onsetDate,
      reactions,
      reactionSeverity,
      notes
    };
  }

  /**
   * Create FHIR AllergyIntolerance resource from form data
   * @param {Object} formData - Form data
   * @param {Object} context - Additional context
   * @returns {Object} FHIR resource fields
   */
  _createResourceFromForm(formData, context = {}) {
    const resource = {
      clinicalStatus: this.createStatusCoding(
        formData.clinicalStatus,
        'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
        CLINICAL_STATUS_OPTIONS
      ),
      verificationStatus: this.createStatusCoding(
        formData.verificationStatus,
        'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
        VERIFICATION_STATUS_OPTIONS
      ),
      type: this.createStatusCoding(
        formData.allergyType,
        'http://hl7.org/fhir/allergy-intolerance-type',
        ALLERGY_TYPES
      ),
      criticality: formData.criticality,
      recordedDate: new Date().toISOString()
    };

    // Add allergen code or text
    if (formData.selectedAllergen) {
      resource.code = this.createCodeableConcept(formData.selectedAllergen);
    } else if (formData.customAllergen) {
      resource.code = { text: formData.customAllergen };
    }

    // Add onset date if provided
    if (formData.onsetDate) {
      resource.onsetDateTime = this.createDateString(formData.onsetDate);
    }

    // Add reactions if provided
    if (formData.reactions && formData.reactions.length > 0) {
      resource.reaction = [{
        manifestation: formData.reactions.map(reaction => {
          // Check if reaction is a SNOMED code object or just text
          const reactionText = typeof reaction === 'string' ? reaction : reaction.text || reaction.display;
          const reactionObj = typeof reaction === 'object' ? reaction : 
            COMMON_REACTIONS.find(r => r.text === reaction || r.display === reaction);
          
          // Build manifestation in R4 format (backend will convert to R5)
          const manifestation = {
            text: reactionText
          };
          
          // Add SNOMED coding if available
          if (reactionObj && reactionObj.code) {
            manifestation.coding = [{
              system: 'http://snomed.info/sct',
              code: reactionObj.code,
              display: reactionObj.display
            }];
          }
          
          return manifestation;
        }),
        severity: formData.reactionSeverity
      }];
    }

    // Add notes if provided
    if (formData.notes) {
      resource.note = this.createNotes(formData.notes);
    }

    return resource;
  }

  /**
   * Validate required fields for allergy
   * @param {Object} formData - Form data to validate
   * @throws {Error} If validation fails
   */
  _validateRequiredFields(formData) {
    if (!formData.selectedAllergen && !formData.customAllergen) {
      throw new Error('Please specify an allergen or select from the list');
    }

    if (!formData.allergyType) {
      throw new Error('Allergy type is required');
    }

    if (!formData.criticality) {
      throw new Error('Criticality is required');
    }

    if (!formData.clinicalStatus) {
      throw new Error('Clinical status is required');
    }

    if (!formData.verificationStatus) {
      throw new Error('Verification status is required');
    }
  }

  /**
   * Post-process the allergy resource
   * @param {Object} resource - The resource
   * @param {string} operation - 'create' or 'update'
   * @param {Object} formData - Original form data
   * @param {Object} context - Additional context
   * @returns {Object} Processed resource
   */
  _postProcessResource(resource, operation, formData, context) {
    // Ensure we have valid onset date format
    if (resource.onsetDateTime && typeof resource.onsetDateTime !== 'string') {
      resource.onsetDateTime = new Date(resource.onsetDateTime).toISOString();
    }

    // Ensure proper allergen system for RXNORM codes
    if (resource.code?.coding?.[0]) {
      const coding = resource.code.coding[0];
      if (coding.code && coding.code.startsWith('RXNORM')) {
        coding.system = 'http://www.nlm.nih.gov/research/umls/rxnorm';
        coding.code = coding.code.replace(/^RXNORM:/, '');
      } else if (!coding.system) {
        coding.system = 'http://snomed.info/sct';
      }
    }

    return resource;
  }
}

// Helper functions that can be used by the dialog config
export const getCriticalityColor = (criticality) => {
  switch (criticality) {
    case 'high': return 'error';
    case 'low': return 'warning';
    default: return 'default';
  }
};

export const getAllergenDisplay = (formData) => {
  if (formData.selectedAllergen) {
    return formData.selectedAllergen.display;
  }
  return formData.customAllergen || 'No allergen selected';
};

export const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active': 
      return 'error';
    case 'inactive':
      return 'warning';
    case 'resolved': 
      return 'success';
    default: 
      return 'default';
  }
};

// Export singleton instance for use in dialog configs
export const allergyConverter = new AllergyConverter();