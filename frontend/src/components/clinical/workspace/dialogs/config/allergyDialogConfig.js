/**
 * AlleryIntolerance Dialog Configuration
 * Configuration for BaseResourceDialog to handle allergy/intolerance management
 */

// FHIR Value Sets
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

// Default initial values for new allergy
export const initialValues = {
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

// Validation rules for form fields
export const validationRules = {
  allergen: {
    required: true,
    label: 'Allergen',
    custom: (value, formData) => {
      if (!formData.selectedAllergen && !formData.customAllergen) {
        return 'Please specify an allergen or select from the list';
      }
      return null;
    }
  },
  allergyType: {
    required: true,
    label: 'Allergy Type'
  },
  criticality: {
    required: true,
    label: 'Criticality'
  },
  clinicalStatus: {
    required: true,
    label: 'Clinical Status'
  },
  verificationStatus: {
    required: true,
    label: 'Verification Status'
  }
};

// Helper functions for FHIR resource creation
export const createAllergyIntoleranceResource = (formData, patientId) => {
  return {
    resourceType: 'AllergyIntolerance',
    id: `allergy-${Date.now()}`,
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
        code: formData.clinicalStatus,
        display: formData.clinicalStatus
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
        code: formData.verificationStatus,
        display: formData.verificationStatus
      }]
    },
    type: {
      coding: [{
        system: 'http://hl7.org/fhir/allergy-intolerance-type',
        code: formData.allergyType,
        display: formData.allergyType === 'allergy' ? 'Allergy' : 'Intolerance'
      }]
    },
    criticality: formData.criticality,
    code: formData.selectedAllergen ? {
      coding: [{
        system: formData.selectedAllergen.code.startsWith('RXNORM') 
          ? 'http://www.nlm.nih.gov/research/umls/rxnorm'
          : 'http://snomed.info/sct',
        code: formData.selectedAllergen.code.replace(/^(RXNORM|SNOMED):/, ''),
        display: formData.selectedAllergen.display
      }],
      text: formData.selectedAllergen.display
    } : {
      text: formData.customAllergen
    },
    patient: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString(),
    ...(formData.onsetDate && {
      onsetDateTime: formData.onsetDate.toISOString()
    }),
    ...(formData.reactions.length > 0 && {
      reaction: [{
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
      }]
    }),
    ...(formData.notes && {
      note: [{
        text: formData.notes,
        time: new Date().toISOString()
      }]
    })
  };
};

// Helper function to get criticality color
export const getCriticalityColor = (criticality) => {
  switch (criticality) {
    case 'high': return 'error';
    case 'low': return 'warning';
    default: return 'default';
  }
};

// Helper function to get allergen display
export const getAllergenDisplay = (formData) => {
  if (formData.selectedAllergen) {
    return formData.selectedAllergen.display;
  }
  return formData.customAllergen || 'No allergen selected';
};

// Parse existing FHIR AllergyIntolerance resource into form data
export const parseAllergyIntoleranceResource = (allergyIntolerance) => {
  if (!allergyIntolerance) return initialValues;

  const clinicalStatus = allergyIntolerance.clinicalStatus?.coding?.[0]?.code || 'active';
  const verificationStatus = allergyIntolerance.verificationStatus?.coding?.[0]?.code || 'confirmed';
  const criticality = allergyIntolerance.criticality || 'unable-to-assess';
  const type = allergyIntolerance.type?.coding?.[0]?.code || allergyIntolerance.type || 'allergy';
  const onsetDate = allergyIntolerance.onsetDateTime ? new Date(allergyIntolerance.onsetDateTime) : null;
  
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
  
  const reactionSeverity = allergyIntolerance.reaction?.[0]?.severity || 'mild';
  
  // Extract notes
  const notes = allergyIntolerance.note?.[0]?.text || '';

  return {
    selectedAllergen,
    customAllergen,
    allergyType: typeof type === 'string' ? type : 'allergy',
    criticality: typeof criticality === 'string' ? criticality : 'unable-to-assess',
    clinicalStatus: typeof clinicalStatus === 'string' ? clinicalStatus : 'active',
    verificationStatus: typeof verificationStatus === 'string' ? verificationStatus : 'confirmed',
    onsetDate,
    reactions,
    reactionSeverity,
    notes
  };
};

// Create updated FHIR AllergyIntolerance resource for editing
export const updateAllergyIntoleranceResource = (formData, existingResource) => {
  if (!existingResource.id) {
    throw new Error('Cannot update allergy: missing resource ID');
  }

  return {
    ...existingResource, // Preserve existing fields like id, meta, etc.
    resourceType: 'AllergyIntolerance',
    id: existingResource.id, // Explicitly set ID
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
        code: formData.clinicalStatus,
        display: CLINICAL_STATUS_OPTIONS.find(s => s.value === formData.clinicalStatus)?.display
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
        code: formData.verificationStatus,
        display: VERIFICATION_STATUS_OPTIONS.find(s => s.value === formData.verificationStatus)?.display
      }]
    },
    type: {
      coding: [{
        system: 'http://hl7.org/fhir/allergy-intolerance-type',
        code: formData.allergyType,
        display: formData.allergyType === 'allergy' ? 'Allergy' : 'Intolerance'
      }]
    },
    criticality: formData.criticality,
    code: formData.selectedAllergen ? {
      coding: [{
        system: formData.selectedAllergen.code.startsWith('RXNORM') 
          ? 'http://www.nlm.nih.gov/research/umls/rxnorm'
          : 'http://snomed.info/sct',
        code: formData.selectedAllergen.code.replace(/^(RXNORM|SNOMED):/, ''),
        display: formData.selectedAllergen.display
      }],
      text: formData.selectedAllergen.display
    } : {
      text: formData.customAllergen
    },
    patient: existingResource.patient || {
      reference: `Patient/${existingResource.patient?.reference?.split('/')?.[1] || 'unknown'}`
    },
    recordedDate: existingResource.recordedDate || new Date().toISOString(),
    ...(formData.onsetDate && {
      onsetDateTime: formData.onsetDate.toISOString()
    }),
    ...(formData.reactions.length > 0 && {
      reaction: [{
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
      }]
    }),
    ...(formData.notes && {
      note: [{
        text: formData.notes,
        time: new Date().toISOString()
      }]
    })
  };
};