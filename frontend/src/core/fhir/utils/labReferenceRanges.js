/**
 * Lab Reference Ranges
 * Standard reference ranges for common laboratory tests
 * Based on LOINC codes
 */

export const REFERENCE_RANGES = {
  // Chemistry Panel
  '2339-0': { // Glucose
    low: 70,
    high: 100,
    unit: 'mg/dL',
    criticalLow: 40,
    criticalHigh: 500,
    name: 'Glucose'
  },
  '38483-4': { // Creatinine
    low: 0.6,
    high: 1.2,
    unit: 'mg/dL',
    criticalHigh: 4.0,
    name: 'Creatinine',
    ageAdjusted: true
  },
  '2947-0': { // Sodium
    low: 136,
    high: 145,
    unit: 'mmol/L',
    criticalLow: 120,
    criticalHigh: 160,
    name: 'Sodium'
  },
  '6298-4': { // Potassium
    low: 3.5,
    high: 5.0,
    unit: 'mmol/L',
    criticalLow: 2.5,
    criticalHigh: 6.5,
    name: 'Potassium'
  },
  '2069-3': { // Chloride
    low: 98,
    high: 107,
    unit: 'mmol/L',
    name: 'Chloride'
  },
  '20565-8': { // CO2
    low: 22,
    high: 29,
    unit: 'mmol/L',
    name: 'Carbon Dioxide'
  },
  '6299-2': { // BUN
    low: 7,
    high: 20,
    unit: 'mg/dL',
    name: 'Blood Urea Nitrogen'
  },
  '49765-1': { // Calcium
    low: 8.5,
    high: 10.5,
    unit: 'mg/dL',
    name: 'Calcium'
  },
  '17856-6': { // Calcium ionized
    low: 4.5,
    high: 5.3,
    unit: 'mg/dL',
    criticalLow: 3.5,
    criticalHigh: 6.5,
    name: 'Calcium, Ionized'
  },
  '2601-3': { // Magnesium
    low: 1.7,
    high: 2.2,
    unit: 'mg/dL',
    name: 'Magnesium'
  },
  '2777-1': { // Phosphorus
    low: 2.5,
    high: 4.5,
    unit: 'mg/dL',
    name: 'Phosphorus'
  },

  // Liver Function
  '1742-6': { // ALT
    low: 7,
    high: 40,
    unit: 'U/L',
    name: 'Alanine Aminotransferase (ALT)'
  },
  '1920-8': { // AST
    low: 10,
    high: 40,
    unit: 'U/L',
    name: 'Aspartate Aminotransferase (AST)'
  },
  '6768-6': { // Alkaline Phosphatase
    low: 45,
    high: 115,
    unit: 'U/L',
    name: 'Alkaline Phosphatase'
  },
  '1975-2': { // Total Bilirubin
    low: 0.1,
    high: 1.2,
    unit: 'mg/dL',
    criticalHigh: 15.0,
    name: 'Bilirubin, Total'
  },
  '1968-7': { // Direct Bilirubin
    low: 0.0,
    high: 0.3,
    unit: 'mg/dL',
    name: 'Bilirubin, Direct'
  },
  '2885-2': { // Total Protein
    low: 6.3,
    high: 8.2,
    unit: 'g/dL',
    name: 'Protein, Total'
  },
  '1751-7': { // Albumin
    low: 3.5,
    high: 5.0,
    unit: 'g/dL',
    name: 'Albumin'
  },

  // Lipid Panel
  '2093-3': { // Total Cholesterol
    low: 0,
    high: 200,
    unit: 'mg/dL',
    name: 'Cholesterol, Total',
    desirable: '<200',
    borderline: '200-239',
    highLevel: '≥240'
  },
  '2085-9': { // HDL Cholesterol
    low: 40,
    high: null,
    unit: 'mg/dL',
    name: 'HDL Cholesterol',
    genderSpecific: {
      male: { low: 40 },
      female: { low: 50 }
    }
  },
  '2089-1': { // LDL Cholesterol
    low: 0,
    high: 100,
    unit: 'mg/dL',
    name: 'LDL Cholesterol',
    optimal: '<100',
    nearOptimal: '100-129',
    borderline: '130-159',
    highLevel: '160-189',
    veryHigh: '≥190'
  },
  '2571-8': { // Triglycerides
    low: 0,
    high: 150,
    unit: 'mg/dL',
    name: 'Triglycerides'
  },

  // Hematology
  '718-7': { // Hemoglobin
    low: 12.0,
    high: 17.0,
    unit: 'g/dL',
    criticalLow: 7.0,
    criticalHigh: 20.0,
    name: 'Hemoglobin',
    genderSpecific: {
      male: { low: 13.5, high: 17.5 },
      female: { low: 12.0, high: 15.5 }
    }
  },
  '4544-3': { // Hematocrit
    low: 36,
    high: 50,
    unit: '%',
    name: 'Hematocrit',
    genderSpecific: {
      male: { low: 40, high: 52 },
      female: { low: 36, high: 48 }
    }
  },
  '787-2': { // MCV
    low: 80,
    high: 100,
    unit: 'fL',
    name: 'Mean Corpuscular Volume'
  },
  '785-6': { // MCH
    low: 27,
    high: 33,
    unit: 'pg',
    name: 'Mean Corpuscular Hemoglobin'
  },
  '786-4': { // MCHC
    low: 32,
    high: 36,
    unit: 'g/dL',
    name: 'Mean Corpuscular Hemoglobin Concentration'
  },
  '777-3': { // Platelets
    low: 150,
    high: 400,
    unit: '10^3/uL',
    criticalLow: 20,
    criticalHigh: 1000,
    name: 'Platelet Count'
  },
  '6690-2': { // WBC
    low: 4.5,
    high: 11.0,
    unit: '10^3/uL',
    criticalLow: 1.0,
    criticalHigh: 30.0,
    name: 'White Blood Cell Count'
  },

  // Coagulation
  '5902-2': { // PT
    low: 11.0,
    high: 13.5,
    unit: 's',
    criticalHigh: 30,
    name: 'Prothrombin Time'
  },
  '6301-6': { // INR
    low: 0.8,
    high: 1.2,
    unit: '',
    criticalHigh: 5.0,
    name: 'INR',
    therapeutic: {
      standard: { low: 2.0, high: 3.0 },
      highIntensity: { low: 2.5, high: 3.5 }
    }
  },
  '3173-2': { // aPTT
    low: 25,
    high: 35,
    unit: 's',
    name: 'Activated Partial Thromboplastin Time'
  },

  // Thyroid Function
  '3051-0': { // TSH
    low: 0.4,
    high: 4.0,
    unit: 'mIU/L',
    name: 'Thyroid Stimulating Hormone'
  },
  '3053-6': { // Free T4
    low: 0.8,
    high: 1.8,
    unit: 'ng/dL',
    name: 'Thyroxine, Free'
  },
  '3052-8': { // Free T3
    low: 2.3,
    high: 4.2,
    unit: 'pg/mL',
    name: 'Triiodothyronine, Free'
  },

  // Diabetes Monitoring
  '4548-4': { // HbA1c
    low: 4.0,
    high: 5.6,
    unit: '%',
    name: 'Hemoglobin A1c',
    targets: {
      nonDiabetic: '<5.7',
      prediabetic: '5.7-6.4',
      diabetic: '≥6.5',
      controlled: '<7.0'
    }
  },
  '14749-6': { // Glucose, fasting
    low: 70,
    high: 100,
    unit: 'mg/dL',
    name: 'Glucose, Fasting'
  },

  // Cardiac Markers
  '2157-6': { // Troponin I
    low: 0,
    high: 0.04,
    unit: 'ng/mL',
    criticalHigh: 0.04,
    name: 'Troponin I'
  },
  '33762-6': { // NT-proBNP
    low: 0,
    high: 125,
    unit: 'pg/mL',
    criticalHigh: 900,
    name: 'NT-proBNP',
    ageAdjusted: true
  },

  // Inflammatory Markers
  '1988-5': { // CRP
    low: 0,
    high: 3.0,
    unit: 'mg/L',
    name: 'C-Reactive Protein',
    riskCategories: {
      low: '<1.0',
      average: '1.0-3.0',
      high: '>3.0'
    }
  },
  '4537-7': { // ESR
    low: 0,
    high: 20,
    unit: 'mm/hr',
    name: 'Erythrocyte Sedimentation Rate',
    ageGenderAdjusted: true
  },

  // Vitamins
  '1649-3': { // Vitamin B12
    low: 200,
    high: 900,
    unit: 'pg/mL',
    name: 'Vitamin B12'
  },
  '2132-9': { // Folate
    low: 3.0,
    high: 17.0,
    unit: 'ng/mL',
    name: 'Folate'
  },
  '1648-5': { // Vitamin D
    low: 30,
    high: 100,
    unit: 'ng/mL',
    name: 'Vitamin D, 25-Hydroxy',
    categories: {
      deficient: '<20',
      insufficient: '20-29',
      sufficient: '30-100'
    }
  }
};

/**
 * Get age and gender adjusted reference range
 */
export const getAdjustedReferenceRange = (loincCode, age, gender) => {
  const baseRange = REFERENCE_RANGES[loincCode];
  if (!baseRange) return null;

  // Gender-specific adjustments
  if (baseRange.genderSpecific && gender) {
    const genderRange = baseRange.genderSpecific[gender.toLowerCase()];
    if (genderRange) {
      return {
        ...baseRange,
        low: genderRange.low || baseRange.low,
        high: genderRange.high || baseRange.high
      };
    }
  }

  // Age-specific adjustments (simplified - in production would have detailed age ranges)
  if (baseRange.ageAdjusted && age) {
    // Example: Creatinine increases with age
    if (loincCode === '38483-4' && age > 60) {
      return {
        ...baseRange,
        high: baseRange.high * 1.2
      };
    }
  }

  return baseRange;
};

/**
 * Check if a value is within reference range
 */
export const isWithinReferenceRange = (value, loincCode, age, gender) => {
  const range = getAdjustedReferenceRange(loincCode, age, gender);
  if (!range) return null;

  const isLow = range.low !== null && value < range.low;
  const isHigh = range.high !== null && value > range.high;

  return {
    inRange: !isLow && !isHigh,
    isLow,
    isHigh,
    range
  };
};