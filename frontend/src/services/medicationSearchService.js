/**
 * Medication Search Service
 * Comprehensive medication database and search functionality for prescribing
 */


class MedicationSearchService {
  constructor() {
    this.medicationCache = new Map();
    this.drugInteractionCache = new Map();
    this.dosingGuidelineCache = new Map();
  }

  /**
   * Common medications database with dosing guidelines
   */
  COMMON_MEDICATIONS = [
    // Cardiovascular
    {
      id: 'lisinopril-10mg',
      name: 'Lisinopril',
      genericName: 'Lisinopril',
      brandNames: ['Prinivil', 'Zestril'],
      strength: '10mg',
      form: 'tablet',
      category: 'ACE Inhibitor',
      indication: 'Hypertension, Heart Failure',
      dosing: {
        adult: {
          initial: '10mg once daily',
          maintenance: '10-40mg once daily',
          maximum: '80mg daily'
        },
        elderly: {
          initial: '5mg once daily',
          maintenance: '5-20mg once daily',
          maximum: '40mg daily'
        },
        renal: 'Adjust based on creatinine clearance'
      },
      contraindications: ['ACE inhibitor allergy', 'Angioedema history', 'Pregnancy'],
      warnings: ['Hyperkalemia risk', 'Renal function monitoring', 'Cough'],
      interactions: ['Potassium supplements', 'NSAIDs', 'Lithium']
    },
    {
      id: 'metoprolol-50mg',
      name: 'Metoprolol Tartrate',
      genericName: 'Metoprolol',
      brandNames: ['Lopressor'],
      strength: '50mg',
      form: 'tablet',
      category: 'Beta Blocker',
      indication: 'Hypertension, Angina, Heart Failure',
      dosing: {
        adult: {
          initial: '50mg twice daily',
          maintenance: '100-400mg daily in divided doses',
          maximum: '400mg daily'
        },
        elderly: {
          initial: '25mg twice daily',
          maintenance: '50-200mg daily in divided doses',
          maximum: '200mg daily'
        }
      },
      contraindications: ['Severe bradycardia', 'Heart block', 'Cardiogenic shock'],
      warnings: ['Sudden discontinuation risk', 'Bronchospasm in asthma'],
      interactions: ['Calcium channel blockers', 'Digoxin', 'Insulin']
    },
    // Diabetes
    {
      id: 'metformin-500mg',
      name: 'Metformin',
      genericName: 'Metformin',
      brandNames: ['Glucophage', 'Glumetza'],
      strength: '500mg',
      form: 'tablet',
      category: 'Biguanide',
      indication: 'Type 2 Diabetes',
      dosing: {
        adult: {
          initial: '500mg twice daily with meals',
          maintenance: '500-2000mg daily in divided doses',
          maximum: '2550mg daily'
        },
        elderly: {
          initial: '500mg once daily',
          maintenance: '500-1000mg daily',
          maximum: '2000mg daily'
        }
      },
      contraindications: ['Severe renal impairment', 'Diabetic ketoacidosis', 'Metabolic acidosis'],
      warnings: ['Lactic acidosis risk', 'Renal function monitoring', 'B12 deficiency'],
      interactions: ['Contrast dye', 'Alcohol', 'Cimetidine']
    },
    // Antibiotics
    {
      id: 'amoxicillin-500mg',
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      brandNames: ['Amoxil', 'Trimox'],
      strength: '500mg',
      form: 'capsule',
      category: 'Penicillin Antibiotic',
      indication: 'Bacterial infections',
      dosing: {
        adult: {
          initial: '500mg every 8 hours',
          maintenance: '250-500mg every 8 hours',
          maximum: '4000mg daily'
        },
        pediatric: {
          initial: '20-40mg/kg/day divided every 8 hours',
          maximum: '100mg/kg/day'
        }
      },
      contraindications: ['Penicillin allergy', 'Mononucleosis'],
      warnings: ['Allergic reactions', 'C. diff colitis', 'Resistance'],
      interactions: ['Warfarin', 'Methotrexate', 'Oral contraceptives']
    },
    {
      id: 'azithromycin-250mg',
      name: 'Azithromycin',
      genericName: 'Azithromycin',
      brandNames: ['Zithromax', 'Z-Pak'],
      strength: '250mg',
      form: 'tablet',
      category: 'Macrolide Antibiotic',
      indication: 'Bacterial infections',
      dosing: {
        adult: {
          initial: '500mg on day 1, then 250mg daily for 4 days',
          maintenance: 'As per indication',
          maximum: '500mg daily'
        },
        pediatric: {
          initial: '10mg/kg on day 1, then 5mg/kg daily for 4 days',
          maximum: '500mg daily'
        }
      },
      contraindications: ['Macrolide allergy', 'QT prolongation history'],
      warnings: ['QT prolongation', 'Liver toxicity', 'Ototoxicity'],
      interactions: ['Warfarin', 'Digoxin', 'Ergot alkaloids']
    },
    // Pain Management
    {
      id: 'ibuprofen-600mg',
      name: 'Ibuprofen',
      genericName: 'Ibuprofen',
      brandNames: ['Advil', 'Motrin'],
      strength: '600mg',
      form: 'tablet',
      category: 'NSAID',
      indication: 'Pain, inflammation, fever',
      dosing: {
        adult: {
          initial: '400-600mg every 6-8 hours',
          maintenance: '400-800mg every 6-8 hours',
          maximum: '3200mg daily'
        },
        elderly: {
          initial: '200-400mg every 8 hours',
          maximum: '1200mg daily'
        }
      },
      contraindications: ['NSAID allergy', 'Active GI bleeding', 'Severe heart failure'],
      warnings: ['GI bleeding risk', 'Cardiovascular risk', 'Renal toxicity'],
      interactions: ['Warfarin', 'ACE inhibitors', 'Lithium']
    },
    // Mental Health
    {
      id: 'sertraline-50mg',
      name: 'Sertraline',
      genericName: 'Sertraline',
      brandNames: ['Zoloft'],
      strength: '50mg',
      form: 'tablet',
      category: 'SSRI Antidepressant',
      indication: 'Depression, anxiety disorders',
      dosing: {
        adult: {
          initial: '50mg once daily',
          maintenance: '50-200mg once daily',
          maximum: '200mg daily'
        },
        elderly: {
          initial: '25mg once daily',
          maintenance: '25-100mg once daily',
          maximum: '150mg daily'
        }
      },
      contraindications: ['MAOI use within 14 days', 'Pimozide use'],
      warnings: ['Suicidal ideation', 'Serotonin syndrome', 'Withdrawal syndrome'],
      interactions: ['MAOIs', 'Warfarin', 'NSAIDs']
    }
  ];

  /**
   * Search medications by name, category, or indication
   */
  async searchMedications(query, options = {}) {
    const { limit = 10, category = null, includeDosingInfo = true } = options;
    
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // First try backend search if available
      let backendResults = [];
      try {
        const response = await fetch(`/api/catalogs/medications?search=${encodeURIComponent(query)}&limit=${limit}`);
        if (response.ok) {
          backendResults = await response.json();
        }
      } catch (error) {
        // Backend medication search unavailable, using local database
      }

      // Search local database
      const localResults = this.searchLocalMedications(query, { limit, category });

      // Combine and deduplicate results
      const combinedResults = this.combineSearchResults(backendResults, localResults, limit);

      // Add dosing information if requested
      if (includeDosingInfo) {
        return combinedResults.map(med => this.enrichWithDosingInfo(med));
      }

      return combinedResults;

    } catch (error) {
      return this.searchLocalMedications(query, { limit, category });
    }
  }

  /**
   * Search local medication database
   */
  searchLocalMedications(query, options = {}) {
    const { limit = 10, category = null } = options;
    const queryLower = query.toLowerCase();

    let results = this.COMMON_MEDICATIONS.filter(med => {
      const nameMatch = med.name.toLowerCase().includes(queryLower) ||
                       med.genericName.toLowerCase().includes(queryLower) ||
                       med.brandNames.some(brand => brand.toLowerCase().includes(queryLower));
      
      const categoryMatch = !category || med.category.toLowerCase().includes(category.toLowerCase());
      const indicationMatch = med.indication.toLowerCase().includes(queryLower);

      return (nameMatch || indicationMatch) && categoryMatch;
    });

    // Sort by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === queryLower;
      const bExact = b.name.toLowerCase() === queryLower;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return a.name.localeCompare(b.name);
    });

    return results.slice(0, limit);
  }

  /**
   * Get medication by ID
   */
  getMedicationById(medicationId) {
    return this.COMMON_MEDICATIONS.find(med => med.id === medicationId);
  }

  /**
   * Get dosing recommendations for a medication
   */
  getDosingRecommendations(medicationId, patientContext = {}) {
    const medication = this.getMedicationById(medicationId);
    if (!medication) return null;

    const { age = null, weight = null, renalFunction = null } = patientContext;

    let recommendations = { ...medication.dosing };

    // Adjust for age
    if (age) {
      if (age >= 65 && medication.dosing.elderly) {
        recommendations.recommended = medication.dosing.elderly;
        recommendations.ageAdjustment = 'Elderly dosing recommended';
      } else if (age < 18 && medication.dosing.pediatric) {
        recommendations.recommended = medication.dosing.pediatric;
        recommendations.ageAdjustment = 'Pediatric dosing required';
      } else {
        recommendations.recommended = medication.dosing.adult;
      }
    }

    // Add warnings and considerations
    recommendations.warnings = medication.warnings || [];
    recommendations.contraindications = medication.contraindications || [];
    recommendations.interactions = medication.interactions || [];

    return recommendations;
  }

  /**
   * Check for drug interactions
   */
  async checkDrugInteractions(medications = []) {
    if (medications.length < 2) return [];

    const interactions = [];

    // Check each medication against all others
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const med1 = medications[i];
        const med2 = medications[j];
        
        const interaction = this.findInteraction(med1, med2);
        if (interaction) {
          interactions.push(interaction);
        }
      }
    }

    return interactions;
  }

  /**
   * Find specific drug interaction
   */
  findInteraction(med1, med2) {
    // Get medication details
    const medication1 = typeof med1 === 'string' ? this.getMedicationById(med1) : med1;
    const medication2 = typeof med2 === 'string' ? this.getMedicationById(med2) : med2;

    if (!medication1 || !medication2) return null;

    // Check for known interactions
    const med1Interactions = medication1.interactions || [];
    const med2Interactions = medication2.interactions || [];

    // Check if med2 is in med1's interaction list
    const med1HasInteraction = med1Interactions.some(interaction => 
      medication2.name.toLowerCase().includes(interaction.toLowerCase()) ||
      medication2.category.toLowerCase().includes(interaction.toLowerCase())
    );

    // Check if med1 is in med2's interaction list
    const med2HasInteraction = med2Interactions.some(interaction => 
      medication1.name.toLowerCase().includes(interaction.toLowerCase()) ||
      medication1.category.toLowerCase().includes(interaction.toLowerCase())
    );

    if (med1HasInteraction || med2HasInteraction) {
      return {
        medication1: medication1.name,
        medication2: medication2.name,
        severity: this.determineInteractionSeverity(medication1, medication2),
        description: this.getInteractionDescription(medication1, medication2),
        recommendation: this.getInteractionRecommendation(medication1, medication2)
      };
    }

    return null;
  }

  /**
   * Check medication against patient allergies
   */
  checkAllergies(medicationId, allergies = []) {
    const medication = this.getMedicationById(medicationId);
    if (!medication || !allergies.length) return [];

    const allergyAlerts = [];

    allergies.forEach(allergy => {
      const allergen = allergy.code?.text || allergy.code?.coding?.[0]?.display || '';
      
      // Check for direct matches
      if (this.isAllergyMatch(medication, allergen)) {
        allergyAlerts.push({
          severity: allergy.criticality === 'high' ? 'critical' : 'warning',
          allergen: allergen,
          medication: medication.name,
          reaction: allergy.reaction?.[0]?.manifestation?.[0]?.text || 'Unknown reaction',
          recommendation: 'Consider alternative medication'
        });
      }
    });

    return allergyAlerts;
  }

  /**
   * Check if medication matches patient allergy
   */
  isAllergyMatch(medication, allergen) {
    const allergenLower = allergen.toLowerCase();
    
    // Direct name matches
    if (medication.name.toLowerCase().includes(allergenLower)) return true;
    if (medication.genericName.toLowerCase().includes(allergenLower)) return true;
    if (medication.brandNames.some(brand => brand.toLowerCase().includes(allergenLower))) return true;
    
    // Category matches (e.g., "penicillin" allergy with "Penicillin Antibiotic")
    if (medication.category.toLowerCase().includes(allergenLower)) return true;
    
    // Known cross-reactions
    const crossReactions = {
      'penicillin': ['amoxicillin', 'ampicillin', 'penicillin'],
      'sulfa': ['sulfamethoxazole', 'trimethoprim', 'furosemide'],
      'nsaid': ['ibuprofen', 'naproxen', 'aspirin', 'diclofenac']
    };

    for (const [allergyClass, medications] of Object.entries(crossReactions)) {
      if (allergenLower.includes(allergyClass)) {
        if (medications.some(med => medication.name.toLowerCase().includes(med))) {
          return true;
        }
      }
    }

    return false;
  }

  // Helper methods

  combineSearchResults(backendResults, localResults, limit) {
    const seen = new Set();
    const combined = [];

    // Add backend results first
    backendResults.forEach(med => {
      if (!seen.has(med.id || med.name)) {
        seen.add(med.id || med.name);
        combined.push(med);
      }
    });

    // Add local results that aren't duplicates
    localResults.forEach(med => {
      if (!seen.has(med.id || med.name)) {
        seen.add(med.id || med.name);
        combined.push(med);
      }
    });

    return combined.slice(0, limit);
  }

  enrichWithDosingInfo(medication) {
    if (medication.dosing) return medication;

    // For backend results without dosing info, try to find in local database
    const localMed = this.COMMON_MEDICATIONS.find(med => 
      med.name.toLowerCase() === medication.name?.toLowerCase() ||
      med.genericName.toLowerCase() === medication.genericName?.toLowerCase()
    );

    if (localMed) {
      return { ...medication, ...localMed };
    }

    return medication;
  }

  determineInteractionSeverity(med1, med2) {
    // High-risk combinations
    const highRiskCategories = ['anticoagulant', 'antiarrhythmic', 'antiepileptic'];
    
    if (highRiskCategories.some(cat => 
      med1.category.toLowerCase().includes(cat) || med2.category.toLowerCase().includes(cat)
    )) {
      return 'major';
    }

    return 'moderate';
  }

  getInteractionDescription(med1, med2) {
    // Simplified interaction descriptions
    return `Potential interaction between ${med1.name} and ${med2.name}. Monitor for enhanced effects or reduced efficacy.`;
  }

  getInteractionRecommendation(med1, med2) {
    return 'Monitor patient closely. Consider dose adjustment or alternative therapy if necessary.';
  }

  /**
   * Get common prescription templates
   */
  getCommonPrescriptions(category = null) {
    const templates = {
      'hypertension': [
        {
          name: 'Hypertension Starter',
          medications: [
            { medicationId: 'lisinopril-10mg', dosing: '10mg once daily', duration: '30 days', refills: 5 }
          ]
        },
        {
          name: 'Hypertension Combination',
          medications: [
            { medicationId: 'lisinopril-10mg', dosing: '10mg once daily', duration: '30 days', refills: 5 },
            { medicationId: 'metoprolol-50mg', dosing: '25mg twice daily', duration: '30 days', refills: 5 }
          ]
        }
      ],
      'diabetes': [
        {
          name: 'Type 2 Diabetes Initial',
          medications: [
            { medicationId: 'metformin-500mg', dosing: '500mg twice daily with meals', duration: '30 days', refills: 5 }
          ]
        }
      ],
      'infection': [
        {
          name: 'Common Bacterial Infection',
          medications: [
            { medicationId: 'amoxicillin-500mg', dosing: '500mg every 8 hours', duration: '10 days', refills: 0 }
          ]
        },
        {
          name: 'Penicillin Alternative',
          medications: [
            { medicationId: 'azithromycin-250mg', dosing: '500mg day 1, then 250mg daily', duration: '5 days', refills: 0 }
          ]
        }
      ]
    };

    return category ? (templates[category] || []) : templates;
  }
}

// Export singleton instance
export const medicationSearchService = new MedicationSearchService();