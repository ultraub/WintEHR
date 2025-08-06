/**
 * Natural Language Processor for FHIR Queries
 * 
 * Advanced natural language processing for medical queries
 */

// Medical terminology mappings
const MEDICAL_TERMS = {
  // Common conditions
  'diabetes': { codes: ['44054006', 'E11'], system: 'http://snomed.info/sct', display: 'Type 2 diabetes mellitus' },
  'hypertension': { codes: ['38341003', 'I10'], system: 'http://snomed.info/sct', display: 'Hypertension' },
  'asthma': { codes: ['195967001', 'J45'], system: 'http://snomed.info/sct', display: 'Asthma' },
  'copd': { codes: ['13645005', 'J44'], system: 'http://snomed.info/sct', display: 'Chronic obstructive pulmonary disease' },
  'heart failure': { codes: ['84114007', 'I50'], system: 'http://snomed.info/sct', display: 'Heart failure' },
  'depression': { codes: ['35489007', 'F32'], system: 'http://snomed.info/sct', display: 'Depression' },
  'anxiety': { codes: ['48694002', 'F41'], system: 'http://snomed.info/sct', display: 'Anxiety' },
  
  // Lab tests
  'glucose': { codes: ['2339-0', '2345-7'], system: 'http://loinc.org', display: 'Glucose' },
  'a1c': { codes: ['4548-4'], system: 'http://loinc.org', display: 'Hemoglobin A1c' },
  'hba1c': { codes: ['4548-4'], system: 'http://loinc.org', display: 'Hemoglobin A1c' },
  'blood pressure': { codes: ['85354-9'], system: 'http://loinc.org', display: 'Blood pressure panel' },
  'cholesterol': { codes: ['2093-3', '2085-9'], system: 'http://loinc.org', display: 'Cholesterol' },
  'creatinine': { codes: ['2160-0'], system: 'http://loinc.org', display: 'Creatinine' },
  'hemoglobin': { codes: ['718-7'], system: 'http://loinc.org', display: 'Hemoglobin' },
  
  // Medications
  'metformin': { codes: ['6809'], rxnorm: '6809', display: 'Metformin' },
  'insulin': { codes: ['5856'], rxnorm: '5856', display: 'Insulin' },
  'lisinopril': { codes: ['29046'], rxnorm: '29046', display: 'Lisinopril' },
  'atorvastatin': { codes: ['83367'], rxnorm: '83367', display: 'Atorvastatin' },
  'aspirin': { codes: ['1191'], rxnorm: '1191', display: 'Aspirin' },
  
  // Vital signs
  'temperature': { codes: ['8310-5'], system: 'http://loinc.org', display: 'Body temperature' },
  'heart rate': { codes: ['8867-4'], system: 'http://loinc.org', display: 'Heart rate' },
  'respiratory rate': { codes: ['9279-1'], system: 'http://loinc.org', display: 'Respiratory rate' },
  'oxygen saturation': { codes: ['2708-6'], system: 'http://loinc.org', display: 'Oxygen saturation' },
  'weight': { codes: ['29463-7'], system: 'http://loinc.org', display: 'Body weight' },
  'height': { codes: ['8302-2'], system: 'http://loinc.org', display: 'Body height' },
  'bmi': { codes: ['39156-5'], system: 'http://loinc.org', display: 'Body mass index' }
};

// Query intent classification
const QUERY_INTENTS = {
  FIND_PATIENTS: {
    keywords: ['find', 'show', 'list', 'get', 'search', 'patients', 'people'],
    resourceType: 'Patient'
  },
  FIND_CONDITIONS: {
    keywords: ['conditions', 'diagnoses', 'problems', 'diseases', 'with'],
    resourceType: 'Condition'
  },
  FIND_OBSERVATIONS: {
    keywords: ['labs', 'results', 'tests', 'observations', 'vitals', 'measurements'],
    resourceType: 'Observation'
  },
  FIND_MEDICATIONS: {
    keywords: ['medications', 'drugs', 'prescriptions', 'meds', 'prescribed'],
    resourceType: 'MedicationRequest'
  },
  FIND_ENCOUNTERS: {
    keywords: ['visits', 'encounters', 'appointments', 'admissions'],
    resourceType: 'Encounter'
  },
  FIND_PROCEDURES: {
    keywords: ['procedures', 'surgeries', 'operations'],
    resourceType: 'Procedure'
  },
  FIND_ALLERGIES: {
    keywords: ['allergies', 'allergic', 'intolerances'],
    resourceType: 'AllergyIntolerance'
  }
};

// Time expression parsing
const parseTimeExpression = (text) => {
  const now = new Date();
  
  // Relative time expressions
  const relativePatterns = [
    { pattern: /last (\d+) (days?|weeks?|months?|years?)/, type: 'relative' },
    { pattern: /past (\d+) (days?|weeks?|months?|years?)/, type: 'relative' },
    { pattern: /recent(ly)?/, type: 'recent', days: 30 },
    { pattern: /today/, type: 'today', days: 0 },
    { pattern: /yesterday/, type: 'yesterday', days: 1 },
    { pattern: /this (week|month|year)/, type: 'this' },
    { pattern: /last (week|month|year)/, type: 'last' }
  ];
  
  for (const { pattern, type } of relativePatterns) {
    const match = text.match(pattern);
    if (match) {
      if (type === 'relative') {
        const amount = parseInt(match[1]);
        const unit = match[2].replace(/s$/, '');
        const days = unit === 'day' ? amount : 
                    unit === 'week' ? amount * 7 :
                    unit === 'month' ? amount * 30 :
                    unit === 'year' ? amount * 365 : amount;
        
        const startDate = new Date(now - days * 24 * 60 * 60 * 1000);
        return {
          operator: 'ge',
          value: startDate.toISOString().split('T')[0]
        };
      }
      // Handle other time patterns...
    }
  }
  
  // Absolute dates
  const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return {
      operator: 'eq',
      value: dateMatch[0]
    };
  }
  
  return null;
};

// Value range parsing
const parseValueRange = (text) => {
  const patterns = [
    { pattern: /between (\d+(?:\.\d+)?) and (\d+(?:\.\d+)?)/i, type: 'between' },
    { pattern: /(?:greater|more|above|over|>) (?:than )?(\d+(?:\.\d+)?)/i, type: 'gt' },
    { pattern: /(?:less|below|under|<) (?:than )?(\d+(?:\.\d+)?)/i, type: 'lt' },
    { pattern: /(?:at least|>=) (\d+(?:\.\d+)?)/i, type: 'ge' },
    { pattern: /(?:at most|<=) (\d+(?:\.\d+)?)/i, type: 'le' },
    { pattern: /(?:equals?|is) (\d+(?:\.\d+)?)/i, type: 'eq' },
    { pattern: /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i, type: 'range' }
  ];
  
  for (const { pattern, type } of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (type === 'between' || type === 'range') {
        return [
          { operator: 'ge', value: match[1] },
          { operator: 'le', value: match[2] }
        ];
      } else {
        return [{ operator: type, value: match[1] }];
      }
    }
  }
  
  return null;
};

// Main natural language processor
export const processNaturalLanguage = (input) => {
  const text = input.toLowerCase().trim();
  const query = {
    resourceType: '',
    parameters: [],
    includes: [],
    sort: '',
    count: 20
  };
  
  // Detect query intent
  let detectedIntent = null;
  let maxScore = 0;
  
  for (const [intent, config] of Object.entries(QUERY_INTENTS)) {
    const score = config.keywords.filter(keyword => text.includes(keyword)).length;
    if (score > maxScore) {
      maxScore = score;
      detectedIntent = config;
    }
  }
  
  if (detectedIntent) {
    query.resourceType = detectedIntent.resourceType;
  }
  
  // Extract medical terms and convert to codes
  for (const [term, info] of Object.entries(MEDICAL_TERMS)) {
    if (text.includes(term)) {
      const code = info.codes[0];
      const system = info.system;
      
      // Determine parameter based on resource type and term type
      if (query.resourceType === 'Condition' && info.system.includes('snomed')) {
        query.parameters.push({
          name: 'code',
          value: `${system}|${code}`,
          display: info.display
        });
      } else if (query.resourceType === 'Observation' && info.system.includes('loinc')) {
        query.parameters.push({
          name: 'code',
          value: `${system}|${code}`,
          display: info.display
        });
      } else if (query.resourceType === 'MedicationRequest' && info.rxnorm) {
        query.parameters.push({
          name: 'code',
          value: info.rxnorm,
          display: info.display
        });
      }
    }
  }
  
  // Extract patient names
  const namePattern = /(?:for|of|named?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/;
  const nameMatch = input.match(namePattern);
  if (nameMatch) {
    if (query.resourceType === 'Patient') {
      query.parameters.push({
        name: 'name',
        value: nameMatch[1]
      });
    } else {
      query.parameters.push({
        name: 'patient.name',
        value: nameMatch[1]
      });
    }
  }
  
  // Extract time expressions
  const timeExpression = parseTimeExpression(text);
  if (timeExpression) {
    const dateParam = query.resourceType === 'Observation' ? 'date' :
                     query.resourceType === 'Condition' ? 'recorded-date' :
                     query.resourceType === 'MedicationRequest' ? 'authoredon' :
                     query.resourceType === 'Encounter' ? 'date' :
                     query.resourceType === 'Procedure' ? 'date' : 'date';
    
    query.parameters.push({
      name: dateParam,
      operator: timeExpression.operator,
      value: timeExpression.value
    });
  }
  
  // Extract value ranges
  const valueRange = parseValueRange(text);
  if (valueRange && query.resourceType === 'Observation') {
    valueRange.forEach(range => {
      query.parameters.push({
        name: 'value-quantity',
        operator: range.operator,
        value: range.value
      });
    });
  }
  
  // Add common includes based on resource type
  if (query.resourceType && query.resourceType !== 'Patient') {
    query.includes.push(`${query.resourceType}:patient`);
  }
  
  // Add sorting for time-based queries
  if (timeExpression) {
    query.sort = '-date';
  }
  
  // Calculate confidence based on matched elements
  const confidence = calculateConfidence(query, text);
  
  return {
    query,
    confidence,
    interpretation: generateInterpretation(query),
    suggestions: generateSuggestions(query, text)
  };
};

// Calculate confidence score
const calculateConfidence = (query, originalText) => {
  let score = 0;
  
  if (query.resourceType) score += 0.3;
  if (query.parameters.length > 0) score += 0.3;
  if (query.parameters.some(p => p.value.includes('|'))) score += 0.2; // Coded values
  if (query.includes.length > 0) score += 0.1;
  
  // Penalize if too much of the input wasn't understood
  const words = originalText.split(' ').length;
  const matchedElements = query.parameters.length + (query.resourceType ? 1 : 0);
  if (matchedElements < words / 3) score -= 0.2;
  
  return Math.max(0.1, Math.min(1.0, score));
};

// Generate human-readable interpretation
const generateInterpretation = (query) => {
  if (!query.resourceType) {
    return "I couldn't determine what type of resource you're looking for";
  }
  
  let interpretation = `Search for ${query.resourceType}`;
  
  if (query.parameters.length > 0) {
    const conditions = query.parameters.map(param => {
      if (param.display) {
        return param.display;
      }
      if (param.name.includes('date')) {
        return `from ${param.value}`;
      }
      if (param.name === 'patient.name') {
        return `for patient ${param.value}`;
      }
      return `where ${param.name} is ${param.value}`;
    });
    
    interpretation += ` ${conditions.join(' and ')}`;
  }
  
  return interpretation;
};

// Generate follow-up suggestions
const generateSuggestions = (query, originalText) => {
  const suggestions = [];
  
  // Suggest adding time filters if not present
  if (!query.parameters.some(p => p.name.includes('date'))) {
    suggestions.push({
      text: "Add time filter (e.g., 'in the last 30 days')",
      action: 'add-time-filter'
    });
  }
  
  // Suggest including patient details
  if (query.resourceType !== 'Patient' && !query.includes.includes(`${query.resourceType}:patient`)) {
    suggestions.push({
      text: "Include patient details",
      action: 'add-include',
      value: `${query.resourceType}:patient`
    });
  }
  
  // Suggest status filters for certain resources
  if (['Condition', 'MedicationRequest', 'Encounter'].includes(query.resourceType) && 
      !query.parameters.some(p => p.name === 'status')) {
    suggestions.push({
      text: "Filter by status (e.g., 'active' conditions)",
      action: 'add-status-filter'
    });
  }
  
  return suggestions;
};

// Export medical terms for autocomplete
export const getMedicalTerms = () => Object.keys(MEDICAL_TERMS);

// Export query intents for UI hints
export const getQueryIntents = () => QUERY_INTENTS;