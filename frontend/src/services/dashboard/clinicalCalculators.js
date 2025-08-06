/**
 * Clinical Calculators Service
 * Common medical calculators and scoring tools
 */

export const ClinicalCalculators = {
  /**
   * CHA₂DS₂-VASc Score for Atrial Fibrillation Stroke Risk
   */
  chadsVasc: {
    name: 'CHA₂DS₂-VASc Score',
    description: 'Stroke risk assessment in atrial fibrillation',
    category: 'Cardiovascular',
    inputs: [
      { id: 'chf', label: 'Congestive Heart Failure', type: 'boolean', points: 1 },
      { id: 'hypertension', label: 'Hypertension', type: 'boolean', points: 1 },
      { id: 'age75', label: 'Age ≥75 years', type: 'boolean', points: 2 },
      { id: 'diabetes', label: 'Diabetes Mellitus', type: 'boolean', points: 1 },
      { id: 'stroke', label: 'Stroke/TIA/Thromboembolism', type: 'boolean', points: 2 },
      { id: 'vascular', label: 'Vascular Disease', type: 'boolean', points: 1 },
      { id: 'age65', label: 'Age 65-74 years', type: 'boolean', points: 1 },
      { id: 'female', label: 'Female Sex', type: 'boolean', points: 1 }
    ],
    calculate: (inputs) => {
      const score = Object.entries(inputs)
        .filter(([_, value]) => value)
        .reduce((sum, [key]) => {
          const input = ClinicalCalculators.chadsVasc.inputs.find(i => i.id === key);
          return sum + (input?.points || 0);
        }, 0);

      let risk = '';
      let recommendation = '';
      
      if (score === 0) {
        risk = 'Low (0.2% annual risk)';
        recommendation = 'No anticoagulation recommended';
      } else if (score === 1) {
        risk = 'Low-Moderate (0.6% annual risk)';
        recommendation = 'Consider anticoagulation';
      } else if (score === 2) {
        risk = 'Moderate (2.2% annual risk)';
        recommendation = 'Anticoagulation recommended';
      } else if (score === 3) {
        risk = 'High (3.2% annual risk)';
        recommendation = 'Anticoagulation recommended';
      } else if (score === 4) {
        risk = 'High (4.8% annual risk)';
        recommendation = 'Anticoagulation recommended';
      } else if (score === 5) {
        risk = 'Very High (7.2% annual risk)';
        recommendation = 'Anticoagulation strongly recommended';
      } else {
        risk = 'Very High (>10% annual risk)';
        recommendation = 'Anticoagulation strongly recommended';
      }

      return { score, risk, recommendation };
    }
  },

  /**
   * Wells Score for DVT
   */
  wellsDVT: {
    name: 'Wells Score for DVT',
    description: 'Deep vein thrombosis probability assessment',
    category: 'Cardiovascular',
    inputs: [
      { id: 'cancer', label: 'Active cancer', type: 'boolean', points: 1 },
      { id: 'paralysis', label: 'Paralysis or recent cast', type: 'boolean', points: 1 },
      { id: 'bedridden', label: 'Bedridden >3 days or surgery', type: 'boolean', points: 1 },
      { id: 'tenderness', label: 'Localized tenderness', type: 'boolean', points: 1 },
      { id: 'swelling', label: 'Entire leg swollen', type: 'boolean', points: 1 },
      { id: 'calf', label: 'Calf swelling >3cm', type: 'boolean', points: 1 },
      { id: 'pitting', label: 'Pitting edema', type: 'boolean', points: 1 },
      { id: 'veins', label: 'Collateral superficial veins', type: 'boolean', points: 1 },
      { id: 'previous', label: 'Previous DVT', type: 'boolean', points: 1 },
      { id: 'alternative', label: 'Alternative diagnosis likely', type: 'boolean', points: -2 }
    ],
    calculate: (inputs) => {
      const score = Object.entries(inputs)
        .filter(([_, value]) => value)
        .reduce((sum, [key]) => {
          const input = ClinicalCalculators.wellsDVT.inputs.find(i => i.id === key);
          return sum + (input?.points || 0);
        }, 0);

      let risk = '';
      let recommendation = '';
      
      if (score < 0) {
        risk = 'Low probability';
        recommendation = 'D-dimer testing recommended';
      } else if (score <= 2) {
        risk = 'Moderate probability';
        recommendation = 'D-dimer or ultrasound';
      } else {
        risk = 'High probability';
        recommendation = 'Ultrasound recommended';
      }

      return { score, risk, recommendation };
    }
  },

  /**
   * GFR Calculator (CKD-EPI)
   */
  gfr: {
    name: 'GFR Calculator (CKD-EPI)',
    description: 'Glomerular filtration rate estimation',
    category: 'Renal',
    inputs: [
      { id: 'creatinine', label: 'Serum Creatinine (mg/dL)', type: 'number', min: 0.1, max: 20, step: 0.1 },
      { id: 'age', label: 'Age (years)', type: 'number', min: 18, max: 120 },
      { id: 'female', label: 'Female', type: 'boolean' },
      { id: 'black', label: 'Black/African American', type: 'boolean' }
    ],
    calculate: (inputs) => {
      const { creatinine, age, female, black } = inputs;
      
      if (!creatinine || !age) {
        return { error: 'Please enter all required values' };
      }

      let gfr;
      const k = female ? 0.7 : 0.9;
      const a = female ? -0.329 : -0.411;
      const min = Math.min(creatinine / k, 1);
      const max = Math.max(creatinine / k, 1);

      gfr = 141 * Math.pow(min, a) * Math.pow(max, -1.209) * Math.pow(0.993, age);
      
      if (female) gfr *= 1.018;
      if (black) gfr *= 1.159;

      gfr = Math.round(gfr);

      let stage = '';
      let description = '';
      
      if (gfr >= 90) {
        stage = 'G1';
        description = 'Normal kidney function';
      } else if (gfr >= 60) {
        stage = 'G2';
        description = 'Mildly decreased';
      } else if (gfr >= 45) {
        stage = 'G3a';
        description = 'Mild to moderate decrease';
      } else if (gfr >= 30) {
        stage = 'G3b';
        description = 'Moderate to severe decrease';
      } else if (gfr >= 15) {
        stage = 'G4';
        description = 'Severely decreased';
      } else {
        stage = 'G5';
        description = 'Kidney failure';
      }

      return { 
        gfr, 
        stage, 
        description,
        units: 'mL/min/1.73 m²'
      };
    }
  },

  /**
   * BMI Calculator
   */
  bmi: {
    name: 'BMI Calculator',
    description: 'Body Mass Index calculation',
    category: 'General',
    inputs: [
      { id: 'weight', label: 'Weight', type: 'number', min: 20, max: 500, step: 0.1 },
      { id: 'weightUnit', label: 'Weight Unit', type: 'select', options: ['kg', 'lbs'] },
      { id: 'height', label: 'Height', type: 'number', min: 50, max: 300, step: 0.1 },
      { id: 'heightUnit', label: 'Height Unit', type: 'select', options: ['cm', 'inches'] }
    ],
    calculate: (inputs) => {
      let { weight, weightUnit, height, heightUnit } = inputs;
      
      if (!weight || !height) {
        return { error: 'Please enter all required values' };
      }

      // Convert to metric
      if (weightUnit === 'lbs') {
        weight = weight * 0.453592;
      }
      if (heightUnit === 'inches') {
        height = height * 2.54;
      }

      // Convert height to meters
      height = height / 100;

      const bmi = weight / (height * height);
      const rounded = Math.round(bmi * 10) / 10;

      let category = '';
      let risk = '';
      
      if (bmi < 18.5) {
        category = 'Underweight';
        risk = 'Increased risk of malnutrition';
      } else if (bmi < 25) {
        category = 'Normal weight';
        risk = 'Lowest health risk';
      } else if (bmi < 30) {
        category = 'Overweight';
        risk = 'Increased health risk';
      } else if (bmi < 35) {
        category = 'Obese Class I';
        risk = 'High health risk';
      } else if (bmi < 40) {
        category = 'Obese Class II';
        risk = 'Very high health risk';
      } else {
        category = 'Obese Class III';
        risk = 'Extremely high health risk';
      }

      return { 
        bmi: rounded, 
        category, 
        risk,
        units: 'kg/m²'
      };
    }
  },

  /**
   * MELD Score
   */
  meld: {
    name: 'MELD Score',
    description: 'Model for End-Stage Liver Disease',
    category: 'Hepatic',
    inputs: [
      { id: 'creatinine', label: 'Creatinine (mg/dL)', type: 'number', min: 0.1, max: 20, step: 0.1 },
      { id: 'bilirubin', label: 'Bilirubin (mg/dL)', type: 'number', min: 0.1, max: 50, step: 0.1 },
      { id: 'inr', label: 'INR', type: 'number', min: 0.8, max: 10, step: 0.1 },
      { id: 'dialysis', label: 'Dialysis ≥2x/week', type: 'boolean' }
    ],
    calculate: (inputs) => {
      let { creatinine, bilirubin, inr, dialysis } = inputs;
      
      if (!creatinine || !bilirubin || !inr) {
        return { error: 'Please enter all required values' };
      }

      // Apply minimum values
      creatinine = Math.max(1, creatinine);
      bilirubin = Math.max(1, bilirubin);
      inr = Math.max(1, inr);

      // Max creatinine at 4 if on dialysis
      if (dialysis) {
        creatinine = 4;
      }

      const meld = 9.57 * Math.log(creatinine) + 
                   3.78 * Math.log(bilirubin) + 
                   11.2 * Math.log(inr) + 
                   6.43;

      const score = Math.round(Math.min(40, Math.max(6, meld)));

      let mortality = '';
      if (score < 10) {
        mortality = '1.9% (3-month mortality)';
      } else if (score < 20) {
        mortality = '6-19% (3-month mortality)';
      } else if (score < 30) {
        mortality = '20-52% (3-month mortality)';
      } else {
        mortality = '53-71% (3-month mortality)';
      }

      return { 
        score, 
        mortality,
        priority: score >= 25 ? 'High priority for transplant' : 'Standard priority'
      };
    }
  },

  /**
   * CURB-65 Score
   */
  curb65: {
    name: 'CURB-65 Score',
    description: 'Pneumonia severity assessment',
    category: 'Respiratory',
    inputs: [
      { id: 'confusion', label: 'Confusion', type: 'boolean', points: 1 },
      { id: 'urea', label: 'Urea >7 mmol/L (BUN >19 mg/dL)', type: 'boolean', points: 1 },
      { id: 'respiratory', label: 'Respiratory rate ≥30', type: 'boolean', points: 1 },
      { id: 'bp', label: 'BP: Systolic <90 or Diastolic ≤60', type: 'boolean', points: 1 },
      { id: 'age65', label: 'Age ≥65 years', type: 'boolean', points: 1 }
    ],
    calculate: (inputs) => {
      const score = Object.entries(inputs)
        .filter(([_, value]) => value)
        .reduce((sum, [key]) => {
          const input = ClinicalCalculators.curb65.inputs.find(i => i.id === key);
          return sum + (input?.points || 0);
        }, 0);

      let severity = '';
      let recommendation = '';
      let mortality = '';
      
      if (score === 0 || score === 1) {
        severity = 'Low';
        recommendation = 'Consider outpatient treatment';
        mortality = '0.6-2.7%';
      } else if (score === 2) {
        severity = 'Moderate';
        recommendation = 'Consider hospital admission';
        mortality = '6.8%';
      } else if (score === 3) {
        severity = 'Severe';
        recommendation = 'Urgent hospital admission';
        mortality = '14%';
      } else {
        severity = 'Very severe';
        recommendation = 'Consider ICU admission';
        mortality = '27.8-31.2%';
      }

      return { score, severity, recommendation, mortality };
    }
  }
};

/**
 * Get calculator by ID
 */
export const getCalculator = (id) => {
  return ClinicalCalculators[id];
};

/**
 * Get all calculators grouped by category
 */
export const getCalculatorsByCategory = () => {
  const categories = {};
  
  Object.entries(ClinicalCalculators).forEach(([id, calc]) => {
    const category = calc.category || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({ id, ...calc });
  });
  
  return categories;
};