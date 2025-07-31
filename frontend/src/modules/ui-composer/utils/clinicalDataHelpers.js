/**
 * Clinical Data Helpers for UI Composer
 * Utilities for transforming FHIR data for UI consumption
 */

import { formatFHIRDate as formatDateForDisplay } from '../../../core/fhir/utils/fhirFormatters';

/**
 * Extract patient demographics from FHIR Patient resource
 */
export const extractPatientDemographics = (patient) => {
  if (!patient) return null;
  
  const name = patient.name?.[0];
  const address = patient.address?.[0];
  
  return {
    id: patient.id,
    fullName: name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown',
    firstName: name?.given?.[0] || '',
    lastName: name?.family || '',
    gender: patient.gender || 'unknown',
    birthDate: patient.birthDate || null,
    age: patient.birthDate ? calculateAge(patient.birthDate) : null,
    address: address ? {
      line: address.line?.join(', ') || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || ''
    } : null,
    phone: patient.telecom?.find(t => t.system === 'phone')?.value || '',
    email: patient.telecom?.find(t => t.system === 'email')?.value || ''
  };
};

/**
 * Calculate age from birth date
 */
export const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Extract condition information from FHIR Condition resource
 */
export const extractConditionInfo = (condition) => {
  if (!condition) return null;
  
  const coding = condition.code?.coding?.[0];
  
  return {
    id: condition.id,
    code: coding?.code || '',
    system: coding?.system || '',
    display: condition.code?.text || coding?.display || 'Unknown condition',
    clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || 'unknown',
    verificationStatus: condition.verificationStatus?.coding?.[0]?.code || 'unknown',
    category: condition.category?.[0]?.coding?.[0]?.display || 'condition',
    severity: condition.severity?.coding?.[0]?.display || null,
    onsetDateTime: condition.onsetDateTime || null,
    recordedDate: condition.recordedDate || null,
    patientReference: condition.subject?.reference || null
  };
};

/**
 * Extract observation value and unit
 */
export const extractObservationValue = (observation) => {
  if (!observation) return null;
  
  const coding = observation.code?.coding?.[0];
  let value = null;
  let unit = null;
  
  if (observation.valueQuantity) {
    value = observation.valueQuantity.value;
    unit = observation.valueQuantity.unit || observation.valueQuantity.code;
  } else if (observation.valueString) {
    value = observation.valueString;
  } else if (observation.valueBoolean !== undefined) {
    value = observation.valueBoolean;
  } else if (observation.valueCodeableConcept) {
    value = observation.valueCodeableConcept.text || 
           observation.valueCodeableConcept.coding?.[0]?.display;
  }
  
  return {
    id: observation.id,
    code: coding?.code || '',
    system: coding?.system || '',
    display: observation.code?.text || coding?.display || 'Unknown test',
    value,
    unit,
    effectiveDateTime: observation.effectiveDateTime || null,
    issued: observation.issued || null,
    status: observation.status || 'unknown',
    category: observation.category?.[0]?.coding?.[0]?.display || 'observation',
    patientReference: observation.subject?.reference || null,
    interpretation: observation.interpretation?.[0]?.coding?.[0]?.display || null,
    referenceRange: observation.referenceRange?.[0] || null
  };
};

/**
 * Extract medication information from MedicationRequest
 */
export const extractMedicationInfo = (medicationRequest, medication = null) => {
  if (!medicationRequest) return null;
  
  const medCoding = medication?.code?.coding?.[0] || 
                    medicationRequest.medicationCodeableConcept?.coding?.[0];
  
  return {
    id: medicationRequest.id,
    code: medCoding?.code || '',
    system: medCoding?.system || '',
    display: medication?.code?.text || 
             medicationRequest.medicationCodeableConcept?.text || 
             medCoding?.display || 'Unknown medication',
    status: medicationRequest.status || 'unknown',
    intent: medicationRequest.intent || 'unknown',
    category: medicationRequest.category?.[0]?.coding?.[0]?.display || 'medication',
    authoredOn: medicationRequest.authoredOn || null,
    dosageInstruction: medicationRequest.dosageInstruction?.[0]?.text || null,
    dispenseRequest: medicationRequest.dispenseRequest || null,
    patientReference: medicationRequest.subject?.reference || null,
    requesterReference: medicationRequest.requester?.reference || null
  };
};

/**
 * Aggregate lab results by category
 */
export const aggregateLabResults = (observations) => {
  const categories = {
    chemistry: [],
    hematology: [],
    microbiology: [],
    immunology: [],
    other: []
  };
  
  observations.forEach(obs => {
    const obsData = extractObservationValue(obs);
    const category = categorizeLabTest(obsData.code, obsData.display);
    
    if (categories[category]) {
      categories[category].push(obsData);
    } else {
      categories.other.push(obsData);
    }
  });
  
  return categories;
};

/**
 * Categorize lab test by code/display
 */
export const categorizeLabTest = (code, display) => {
  const displayLower = display.toLowerCase();
  
  if (displayLower.includes('glucose') || displayLower.includes('sodium') || 
      displayLower.includes('potassium') || displayLower.includes('creatinine')) {
    return 'chemistry';
  }
  
  if (displayLower.includes('hemoglobin') || displayLower.includes('hematocrit') || 
      displayLower.includes('platelet') || displayLower.includes('wbc')) {
    return 'hematology';
  }
  
  if (displayLower.includes('culture') || displayLower.includes('sensitivity') || 
      displayLower.includes('bacterial')) {
    return 'microbiology';
  }
  
  if (displayLower.includes('antibody') || displayLower.includes('antigen') || 
      displayLower.includes('immunoglobulin')) {
    return 'immunology';
  }
  
  return 'other';
};

/**
 * Calculate medication adherence metrics
 */
export const calculateMedicationAdherence = (medicationRequests, medicationDispenses) => {
  const adherenceMap = new Map();
  
  medicationRequests.forEach(request => {
    const medInfo = extractMedicationInfo(request);
    const dispenses = medicationDispenses.filter(d => 
      d.medicationRequest?.reference === `MedicationRequest/${request.id}`
    );
    
    const totalDaysSupplied = dispenses.reduce((total, dispense) => {
      const daysSupplied = dispense.daysSupply?.value || 30; // Default to 30 days
      return total + daysSupplied;
    }, 0);
    
    const daysSinceFirst = request.authoredOn ? 
      Math.floor((Date.now() - new Date(request.authoredOn).getTime()) / (1000 * 60 * 60 * 24)) : 0;
    
    const adherenceRate = daysSinceFirst > 0 ? 
      Math.min((totalDaysSupplied / daysSinceFirst) * 100, 100) : 0;
    
    adherenceMap.set(request.id, {
      medication: medInfo,
      dispenseCount: dispenses.length,
      totalDaysSupplied,
      daysSinceFirst,
      adherenceRate: Math.round(adherenceRate)
    });
  });
  
  return adherenceMap;
};

/**
 * Extract vital signs from observations
 */
export const extractVitalSigns = (observations) => {
  const vitalSigns = {};
  
  observations.forEach(obs => {
    const obsData = extractObservationValue(obs);
    const vitalType = categorizeVitalSign(obsData.code, obsData.display);
    
    if (vitalType) {
      if (!vitalSigns[vitalType]) {
        vitalSigns[vitalType] = [];
      }
      vitalSigns[vitalType].push(obsData);
    }
  });
  
  // Sort by date
  Object.keys(vitalSigns).forEach(type => {
    vitalSigns[type].sort((a, b) => 
      new Date(b.effectiveDateTime || 0) - new Date(a.effectiveDateTime || 0)
    );
  });
  
  return vitalSigns;
};

/**
 * Categorize vital sign by code/display
 */
export const categorizeVitalSign = (code, display) => {
  const displayLower = display.toLowerCase();
  
  if (displayLower.includes('blood pressure') || code === '85354-9') {
    return 'bloodPressure';
  }
  if (displayLower.includes('heart rate') || displayLower.includes('pulse') || code === '8867-4') {
    return 'heartRate';
  }
  if (displayLower.includes('temperature') || code === '8310-5') {
    return 'temperature';
  }
  if (displayLower.includes('respiratory rate') || code === '9279-1') {
    return 'respiratoryRate';
  }
  if (displayLower.includes('oxygen saturation') || code === '2708-6') {
    return 'oxygenSaturation';
  }
  if (displayLower.includes('weight') || code === '29463-7') {
    return 'weight';
  }
  if (displayLower.includes('height') || code === '8302-2') {
    return 'height';
  }
  if (displayLower.includes('bmi') || code === '39156-5') {
    return 'bmi';
  }
  
  return null;
};

/**
 * Create time series data for charts
 */
export const createTimeSeriesData = (observations, valueKey = 'value') => {
  return observations
    .filter(obs => obs.effectiveDateTime && obs[valueKey] !== null)
    .map(obs => ({
      date: obs.effectiveDateTime,
      value: obs[valueKey],
      unit: obs.unit,
      display: obs.display
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

/**
 * Calculate summary statistics
 */
export const calculateSummaryStats = (values) => {
  if (!values || values.length === 0) return null;
  
  const numericValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (numericValues.length === 0) return null;
  
  const sorted = [...numericValues].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / sorted.length;
  
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean * 100) / 100,
    median: sorted.length % 2 === 0 ? 
      (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2 : 
      sorted[Math.floor(sorted.length / 2)]
  };
};

/**
 * Format clinical value for display
 */
export const formatClinicalValue = (value, unit, precision = 2) => {
  if (value === null || value === undefined) return 'N/A';
  
  if (typeof value === 'number') {
    const formatted = precision > 0 ? value.toFixed(precision) : value.toString();
    return unit ? `${formatted} ${unit}` : formatted;
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  return value.toString();
};

export default {
  extractPatientDemographics,
  calculateAge,
  extractConditionInfo,
  extractObservationValue,
  extractMedicationInfo,
  aggregateLabResults,
  categorizeLabTest,
  calculateMedicationAdherence,
  extractVitalSigns,
  categorizeVitalSign,
  createTimeSeriesData,
  calculateSummaryStats,
  formatClinicalValue
};