/**
 * Vital Signs Service
 * Centralized service for managing vital signs mapping and categorization using FHIR standards
 */

// Standard LOINC codes for vital signs
const VITAL_SIGNS_LOINC = {
  // Core vital signs
  'blood-pressure': {
    systolic: '8480-6',    // Systolic blood pressure
    diastolic: '8462-4',   // Diastolic blood pressure
    panel: '85354-9'       // Blood pressure panel
  },
  'heart-rate': '8867-4',        // Heart rate
  'respiratory-rate': '9279-1',   // Respiratory rate
  'body-temperature': '8310-5',   // Body temperature
  'body-weight': '29463-7',       // Body weight
  'body-height': '8302-2',        // Body height
  'bmi': '39156-5',              // Body mass index
  'oxygen-saturation': '2708-6',  // Oxygen saturation
  
  // Additional common vitals
  'head-circumference': '9843-4', // Head circumference
  'pain-scale': '72514-3',        // Pain severity scale
  'glasgow-coma': '9269-2'        // Glasgow coma scale
};

// Display names for vital signs
const VITAL_SIGNS_DISPLAY = {
  '8480-6': 'Systolic Blood Pressure',
  '8462-4': 'Diastolic Blood Pressure',
  '85354-9': 'Blood Pressure',
  '8867-4': 'Heart Rate',
  '9279-1': 'Respiratory Rate',
  '8310-5': 'Body Temperature',
  '29463-7': 'Body Weight',
  '8302-2': 'Body Height',
  '39156-5': 'Body Mass Index',
  '2708-6': 'Oxygen Saturation',
  '9843-4': 'Head Circumference',
  '72514-3': 'Pain Scale',
  '9269-2': 'Glasgow Coma Scale'
};

// Units for vital signs
const VITAL_SIGNS_UNITS = {
  '8480-6': 'mmHg',
  '8462-4': 'mmHg',
  '85354-9': 'mmHg',
  '8867-4': 'bpm',
  '9279-1': '/min',
  '8310-5': 'F',
  '29463-7': 'kg',
  '8302-2': 'cm',
  '39156-5': 'kg/m2',
  '2708-6': '%',
  '9843-4': 'cm',
  '72514-3': '{score}',
  '9269-2': '{score}'
};

// Categories for grouping vital signs
const VITAL_SIGNS_CATEGORIES = {
  'cardiovascular': ['8480-6', '8462-4', '85354-9', '8867-4'],
  'respiratory': ['9279-1', '2708-6'],
  'metabolic': ['8310-5', '29463-7', '8302-2', '39156-5'],
  'neurological': ['72514-3', '9269-2'],
  'pediatric': ['9843-4']
};

class VitalSignsService {
  constructor() {
    this.loincCodes = VITAL_SIGNS_LOINC;
    this.displayNames = VITAL_SIGNS_DISPLAY;
    this.units = VITAL_SIGNS_UNITS;
    this.categories = VITAL_SIGNS_CATEGORIES;
  }

  /**
   * Check if an observation is a vital sign
   */
  isVitalSign(observation) {
    if (!observation) return false;
    
    // Check by LOINC code
    const loincCode = this.extractLoincCode(observation);
    if (loincCode && this.displayNames[loincCode]) {
      return true;
    }
    
    // Check by category
    if (observation.category) {
      for (const cat of observation.category) {
        if (cat.coding) {
          for (const coding of cat.coding) {
            if (coding.code === 'vital-signs' || 
                coding.system === 'http://terminology.hl7.org/CodeSystem/observation-category') {
              return true;
            }
          }
        }
      }
    }
    
    // Check by observation type field (legacy support)
    if (observation.observation_type === 'vital-signs') {
      return true;
    }
    
    return false;
  }

  /**
   * Extract LOINC code from observation
   */
  extractLoincCode(observation) {
    if (!observation || !observation.code) return null;
    
    // Check coding array
    if (observation.code.coding) {
      for (const coding of observation.code.coding) {
        if (coding.system === 'http://loinc.org' || !coding.system) {
          return coding.code;
        }
      }
    }
    
    // Check legacy loinc_code field
    if (observation.loinc_code) {
      return observation.loinc_code;
    }
    
    return null;
  }

  /**
   * Get display name for a vital sign
   */
  getDisplayName(observation) {
    const loincCode = this.extractLoincCode(observation);
    
    // Use FHIR display name if available
    if (observation.code && observation.code.text) {
      return observation.code.text;
    }
    
    if (observation.code && observation.code.coding) {
      for (const coding of observation.code.coding) {
        if (coding.display) {
          return coding.display;
        }
      }
    }
    
    // Use our lookup table
    if (loincCode && this.displayNames[loincCode]) {
      return this.displayNames[loincCode];
    }
    
    // Legacy support
    if (observation.observation_name) {
      return observation.observation_name;
    }
    
    return 'Unknown Vital Sign';
  }

  /**
   * Get unit for a vital sign
   */
  getUnit(observation) {
    // Check FHIR valueQuantity
    if (observation.valueQuantity && observation.valueQuantity.unit) {
      return observation.valueQuantity.unit;
    }
    
    // Check component values (for multi-component observations)
    if (observation.component && observation.component.length > 0) {
      const comp = observation.component[0];
      if (comp.valueQuantity && comp.valueQuantity.unit) {
        return comp.valueQuantity.unit;
      }
    }
    
    // Use lookup table
    const loincCode = this.extractLoincCode(observation);
    if (loincCode && this.units[loincCode]) {
      return this.units[loincCode];
    }
    
    // Legacy support
    if (observation.unit) {
      return observation.unit;
    }
    
    return '';
  }

  /**
   * Get value from observation
   */
  getValue(observation, component = null) {
    // Handle multi-component observations (like blood pressure)
    if (component && observation.component) {
      const comp = observation.component.find(c => {
        const compCode = this.extractLoincCode(c);
        return compCode === component || 
               (component === 'systolic' && compCode === '8480-6') ||
               (component === 'diastolic' && compCode === '8462-4');
      });
      
      if (comp) {
        if (comp.valueQuantity) return comp.valueQuantity.value;
        if (comp.valueString) return comp.valueString;
        if (comp.valueInteger) return comp.valueInteger;
      }
    }
    
    // Check FHIR value fields
    if (observation.valueQuantity) return observation.valueQuantity.value;
    if (observation.valueString) return observation.valueString;
    if (observation.valueInteger) return observation.valueInteger;
    if (observation.valueBoolean !== undefined) return observation.valueBoolean;
    
    // Legacy support
    if (observation.value_quantity) return observation.value_quantity;
    if (observation.value) return observation.value;
    
    return null;
  }

  /**
   * Format vital sign value for display
   */
  formatValue(observation, component = null) {
    const value = this.getValue(observation, component);
    const unit = this.getUnit(observation);
    
    if (value === null || value === undefined) return '';
    
    // Special formatting for blood pressure
    const loincCode = this.extractLoincCode(observation);
    if (loincCode === '85354-9' && !component) {
      const systolic = this.getValue(observation, 'systolic');
      const diastolic = this.getValue(observation, 'diastolic');
      if (systolic && diastolic) {
        return `${systolic}/${diastolic} ${unit || 'mmHg'}`;
      }
    }
    
    // Regular formatting
    return `${value}${unit ? ' ' + unit : ''}`;
  }

  /**
   * Categorize vital signs
   */
  categorizeVitalSigns(observations) {
    const categorized = {
      cardiovascular: [],
      respiratory: [],
      metabolic: [],
      neurological: [],
      pediatric: [],
      other: []
    };
    
    observations.forEach(obs => {
      if (!this.isVitalSign(obs)) return;
      
      const loincCode = this.extractLoincCode(obs);
      let categorized_flag = false;
      
      for (const [category, codes] of Object.entries(this.categories)) {
        if (codes.includes(loincCode)) {
          categorized[category].push(obs);
          categorized_flag = true;
          break;
        }
      }
      
      if (!categorized_flag) {
        categorized.other.push(obs);
      }
    });
    
    return categorized;
  }

  /**
   * Filter observations to only vital signs
   */
  filterVitalSigns(observations) {
    return observations.filter(obs => this.isVitalSign(obs));
  }

  /**
   * Get latest vital signs grouped by type
   */
  getLatestVitalSigns(observations) {
    const vitalSigns = this.filterVitalSigns(observations);
    const latest = {};
    
    vitalSigns.forEach(obs => {
      const loincCode = this.extractLoincCode(obs);
      const key = loincCode || this.getDisplayName(obs);
      const date = obs.effectiveDateTime || obs.observation_date || obs.date;
      
      if (!latest[key] || new Date(date) > new Date(latest[key].effectiveDateTime || latest[key].observation_date || latest[key].date)) {
        latest[key] = obs;
      }
    });
    
    return Object.values(latest);
  }

  /**
   * Check if vital sign is abnormal
   */
  isAbnormal(observation, patientAge = null, patientGender = null) {
    const loincCode = this.extractLoincCode(observation);
    const value = this.getValue(observation);
    
    if (!value || isNaN(value)) return false;
    
    // Basic abnormal ranges (would need more sophisticated logic for age/gender)
    const abnormalRanges = {
      '8480-6': { min: 90, max: 140 },  // Systolic BP
      '8462-4': { min: 60, max: 90 },   // Diastolic BP
      '8867-4': { min: 60, max: 100 },  // Heart rate
      '9279-1': { min: 12, max: 20 },   // Respiratory rate
      '8310-5': { min: 97, max: 99.5 }, // Temperature (F)
      '2708-6': { min: 95, max: 100 }   // Oxygen saturation
    };
    
    const range = abnormalRanges[loincCode];
    if (range) {
      return value < range.min || value > range.max;
    }
    
    return false;
  }

  /**
   * Get LOINC code for a vital sign type
   */
  getLoincCode(vitalType) {
    return this.loincCodes[vitalType] || null;
  }

  /**
   * Get all supported vital sign types
   */
  getSupportedVitalTypes() {
    return Object.keys(this.loincCodes);
  }
}

// Export singleton instance
export const vitalSignsService = new VitalSignsService();

// Also export class for custom instances
export default VitalSignsService;