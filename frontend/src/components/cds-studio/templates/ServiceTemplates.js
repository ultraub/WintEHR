/**
 * CDS Service Templates
 * Common patterns for CDS Hooks 2.0 services
 */

export const SERVICE_CATEGORIES = {
  SCREENING: 'screening',
  MEDICATION_SAFETY: 'medication-safety',
  LAB_MONITORING: 'lab-monitoring',
  PREVENTIVE_CARE: 'preventive-care',
  CLINICAL_GUIDELINES: 'clinical-guidelines',
  QUALITY_MEASURES: 'quality-measures'
};

export const SERVICE_TEMPLATES = [
  {
    id: 'diabetes-screening',
    category: SERVICE_CATEGORIES.SCREENING,
    name: 'Diabetes Screening Reminder',
    description: 'Reminds providers to screen eligible patients for diabetes',
    hook: 'patient-view',
    template: {
      metadata: {
        id: 'diabetes-screening-reminder',
        title: 'Diabetes Screening Reminder',
        description: 'Reminds clinicians to screen eligible patients for diabetes based on age and risk factors',
        hook: 'patient-view',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          conditions: 'Condition?patient={{context.patientId}}&code=44054006',
          lastA1c: 'Observation?patient={{context.patientId}}&code=4548-4&_sort=-date&_count=1'
        }
      },
      code: `class DiabetesScreeningService {
  static metadata = {
    id: 'diabetes-screening-reminder',
    title: 'Diabetes Screening Reminder',
    description: 'Reminds clinicians to screen eligible patients for diabetes',
    hook: 'patient-view',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      conditions: 'Condition?patient={{context.patientId}}&code=44054006',
      lastA1c: 'Observation?patient={{context.patientId}}&code=4548-4&_sort=-date&_count=1'
    }
  };

  shouldExecute(context, prefetch) {
    const patient = prefetch.patient;
    if (!patient) return false;
    
    // Calculate age
    const age = this.calculateAge(patient.birthDate);
    
    // USPSTF recommends screening adults 35-70 who are overweight
    if (age < 35 || age > 70) return false;
    
    // Check if already diagnosed with diabetes
    const hasDiabetes = prefetch.conditions?.entry?.some(entry => 
      entry.resource?.code?.coding?.some(coding => 
        coding.code === '44054006' // Diabetes mellitus
      )
    );
    
    if (hasDiabetes) return false;
    
    // Check when last screened
    const lastA1c = prefetch.lastA1c?.entry?.[0]?.resource;
    if (lastA1c) {
      const daysSinceLastTest = this.daysSince(lastA1c.effectiveDateTime);
      if (daysSinceLastTest < 365) return false; // Screened within last year
    }
    
    return true;
  }

  execute(context, prefetch) {
    const patient = prefetch.patient;
    const age = this.calculateAge(patient.birthDate);
    
    return {
      cards: [{
        uuid: this.generateUUID(),
        summary: 'Diabetes screening recommended',
        indicator: 'warning',
        detail: \`Patient is \${age} years old and due for diabetes screening. Consider ordering A1C or fasting glucose test.\`,
        source: {
          label: 'USPSTF Diabetes Screening Guidelines',
          url: 'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/screening-for-prediabetes-and-type-2-diabetes'
        },
        suggestions: [{
          label: 'Order Hemoglobin A1c',
          uuid: this.generateUUID(),
          actions: [{
            type: 'create',
            resource: {
              resourceType: 'ServiceRequest',
              status: 'draft',
              intent: 'order',
              code: {
                coding: [{
                  system: 'http://loinc.org',
                  code: '4548-4',
                  display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
                }]
              },
              subject: {
                reference: \`Patient/\${context.patientId}\`
              },
              authoredOn: new Date().toISOString()
            }
          }]
        }]
      }]
    };
  }

  // Helper methods
  calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  daysSince(dateString) {
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - date);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}`
    }
  },
  {
    id: 'drug-interaction',
    category: SERVICE_CATEGORIES.MEDICATION_SAFETY,
    name: 'Drug-Drug Interaction Checker',
    description: 'Checks for potential drug-drug interactions',
    hook: 'medication-prescribe',
    template: {
      metadata: {
        id: 'drug-interaction-checker',
        title: 'Drug-Drug Interaction Checker',
        description: 'Alerts providers to potential drug-drug interactions',
        hook: 'medication-prescribe',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
        }
      },
      code: `class DrugInteractionService {
  static metadata = {
    id: 'drug-interaction-checker',
    title: 'Drug-Drug Interaction Checker',
    description: 'Checks for drug-drug interactions when prescribing',
    hook: 'medication-prescribe',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
    }
  };

  // Common drug interactions (simplified for demo)
  static INTERACTIONS = {
    'warfarin': {
      'aspirin': { severity: 'critical', effect: 'Increased bleeding risk' },
      'ibuprofen': { severity: 'critical', effect: 'Increased bleeding risk' },
      'amiodarone': { severity: 'warning', effect: 'Increased INR' }
    },
    'metformin': {
      'contrast': { severity: 'critical', effect: 'Risk of lactic acidosis' }
    },
    'digoxin': {
      'amiodarone': { severity: 'warning', effect: 'Increased digoxin levels' },
      'verapamil': { severity: 'warning', effect: 'Increased digoxin levels' }
    }
  };

  shouldExecute(context, prefetch) {
    // Always check for interactions when prescribing
    return context.medications && context.medications.length > 0;
  }

  execute(context, prefetch) {
    const cards = [];
    const newMeds = context.medications || [];
    const activeMeds = prefetch.medications?.entry?.map(e => e.resource) || [];
    
    // Check each new medication against active medications
    for (const newMed of newMeds) {
      const newDrugName = this.extractDrugName(newMed);
      if (!newDrugName) continue;
      
      for (const activeMed of activeMeds) {
        const activeDrugName = this.extractDrugName(activeMed);
        if (!activeDrugName) continue;
        
        const interaction = this.checkInteraction(newDrugName, activeDrugName);
        if (interaction) {
          cards.push(this.createInteractionCard(
            newDrugName, 
            activeDrugName, 
            interaction
          ));
        }
      }
    }
    
    return { cards };
  }

  checkInteraction(drug1, drug2) {
    const d1Lower = drug1.toLowerCase();
    const d2Lower = drug2.toLowerCase();
    
    // Check both directions
    if (DrugInteractionService.INTERACTIONS[d1Lower]?.[d2Lower]) {
      return DrugInteractionService.INTERACTIONS[d1Lower][d2Lower];
    }
    if (DrugInteractionService.INTERACTIONS[d2Lower]?.[d1Lower]) {
      return DrugInteractionService.INTERACTIONS[d2Lower][d1Lower];
    }
    
    return null;
  }

  createInteractionCard(newDrug, activeDrug, interaction) {
    return {
      uuid: this.generateUUID(),
      summary: \`Drug interaction: \${newDrug} + \${activeDrug}\`,
      indicator: interaction.severity,
      detail: \`\${interaction.effect}. Consider alternative therapy or monitor closely.\`,
      source: {
        label: 'Drug Interaction Database'
      },
      overrideReasons: [
        { code: 'benefit-outweighs-risk', display: 'Benefits outweigh risks' },
        { code: 'will-monitor', display: 'Will monitor closely' },
        { code: 'short-term-use', display: 'Short-term use only' },
        { code: 'no-alternative', display: 'No suitable alternative' }
      ]
    };
  }

  extractDrugName(medication) {
    // Try to extract drug name from various FHIR formats
    if (medication.medicationCodeableConcept?.text) {
      return medication.medicationCodeableConcept.text;
    }
    if (medication.medicationCodeableConcept?.coding?.[0]?.display) {
      return medication.medicationCodeableConcept.coding[0].display;
    }
    return null;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}`
    }
  },
  {
    id: 'renal-dosing',
    category: SERVICE_CATEGORIES.MEDICATION_SAFETY,
    name: 'Renal Dosing Adjustment',
    description: 'Suggests dose adjustments for patients with renal impairment',
    hook: 'medication-prescribe',
    template: {
      metadata: {
        id: 'renal-dosing-adjustment',
        title: 'Renal Dosing Adjustment',
        description: 'Suggests dose adjustments based on kidney function',
        hook: 'medication-prescribe',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          recentCreatinine: 'Observation?patient={{context.patientId}}&code=2160-0&_sort=-date&_count=1',
          recentGFR: 'Observation?patient={{context.patientId}}&code=48642-3,48643-1&_sort=-date&_count=1'
        }
      },
      code: `class RenalDosingService {
  static metadata = {
    id: 'renal-dosing-adjustment',
    title: 'Renal Dosing Adjustment',
    description: 'Adjusts medication dosing for renal function',
    hook: 'medication-prescribe',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      recentCreatinine: 'Observation?patient={{context.patientId}}&code=2160-0&_sort=-date&_count=1',
      recentGFR: 'Observation?patient={{context.patientId}}&code=48642-3,48643-1&_sort=-date&_count=1'
    }
  };

  // Medications requiring renal adjustment (simplified)
  static RENAL_MEDS = {
    'metformin': {
      contraindicated: 30, // GFR < 30
      adjustDose: 45, // GFR < 45
      maxDose: { 45: 1000, 60: 2000 }
    },
    'gabapentin': {
      adjustDose: 60,
      dosing: {
        60: '300-400mg TID',
        30: '200-300mg BID',
        15: '100-300mg daily'
      }
    },
    'atenolol': {
      adjustDose: 35,
      recommendation: 'Reduce dose by 50% if GFR < 35'
    }
  };

  shouldExecute(context, prefetch) {
    if (!context.medications || context.medications.length === 0) return false;
    
    // Check if we have renal function data
    const hasRenalData = prefetch.recentCreatinine?.entry?.length > 0 || 
                        prefetch.recentGFR?.entry?.length > 0;
    
    return hasRenalData;
  }

  execute(context, prefetch) {
    const cards = [];
    const gfr = this.getGFR(prefetch);
    
    if (!gfr) return { cards };
    
    for (const medication of context.medications) {
      const drugName = this.extractDrugName(medication);
      if (!drugName) continue;
      
      const renalInfo = this.getRenalAdjustment(drugName.toLowerCase(), gfr);
      if (renalInfo) {
        cards.push(this.createRenalCard(drugName, gfr, renalInfo));
      }
    }
    
    return { cards };
  }

  getGFR(prefetch) {
    // Try to get GFR directly
    const gfrObs = prefetch.recentGFR?.entry?.[0]?.resource;
    if (gfrObs?.valueQuantity?.value) {
      return gfrObs.valueQuantity.value;
    }
    
    // Calculate from creatinine if needed
    const creatinine = prefetch.recentCreatinine?.entry?.[0]?.resource;
    if (creatinine?.valueQuantity?.value) {
      // Simplified CKD-EPI calculation (would need more patient data)
      return this.estimateGFR(creatinine.valueQuantity.value);
    }
    
    return null;
  }

  getRenalAdjustment(drugName, gfr) {
    for (const [med, info] of Object.entries(RenalDosingService.RENAL_MEDS)) {
      if (drugName.includes(med)) {
        if (info.contraindicated && gfr < info.contraindicated) {
          return { type: 'contraindicated', info };
        }
        if (info.adjustDose && gfr < info.adjustDose) {
          return { type: 'adjust', info };
        }
      }
    }
    return null;
  }

  createRenalCard(drug, gfr, renalInfo) {
    const isContraindicated = renalInfo.type === 'contraindicated';
    
    return {
      uuid: this.generateUUID(),
      summary: isContraindicated ? 
        \`\${drug} contraindicated - GFR \${gfr}\` :
        \`\${drug} requires dose adjustment - GFR \${gfr}\`,
      indicator: isContraindicated ? 'critical' : 'warning',
      detail: this.getRenalRecommendation(drug, gfr, renalInfo),
      source: {
        label: 'Renal Dosing Guidelines'
      },
      overrideReasons: isContraindicated ? [
        { code: 'dialysis', display: 'Patient on dialysis' },
        { code: 'specialist-approved', display: 'Approved by nephrologist' },
        { code: 'risk-benefit', display: 'Benefits outweigh risks' }
      ] : []
    };
  }

  getRenalRecommendation(drug, gfr, renalInfo) {
    if (renalInfo.type === 'contraindicated') {
      return \`\${drug} is contraindicated with GFR < \${renalInfo.info.contraindicated}. Current GFR: \${gfr}. Consider alternative therapy.\`;
    }
    
    if (renalInfo.info.dosing) {
      for (const [threshold, dose] of Object.entries(renalInfo.info.dosing)) {
        if (gfr >= parseInt(threshold)) {
          return \`Recommended dose for GFR \${gfr}: \${dose}\`;
        }
      }
    }
    
    return renalInfo.info.recommendation || 'Consider dose reduction based on renal function';
  }

  estimateGFR(creatinine) {
    // Very simplified estimation - real calculation needs age, sex, race
    return Math.round(90 / creatinine);
  }

  extractDrugName(medication) {
    if (medication.medicationCodeableConcept?.text) {
      return medication.medicationCodeableConcept.text;
    }
    if (medication.medicationCodeableConcept?.coding?.[0]?.display) {
      return medication.medicationCodeableConcept.coding[0].display;
    }
    return null;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}`
    }
  },
  {
    id: 'allergy-alert',
    category: SERVICE_CATEGORIES.MEDICATION_SAFETY,
    name: 'Allergy Alert',
    description: 'Alerts when orders may conflict with patient allergies',
    hook: 'order-select',
    template: {
      metadata: {
        id: 'allergy-alert-service',
        title: 'Allergy Alert Service',
        description: 'Checks orders against patient allergies',
        hook: 'order-select',
        prefetch: {
          patient: 'Patient/{{context.patientId}}',
          allergies: 'AllergyIntolerance?patient={{context.patientId}}'
        }
      },
      code: `class AllergyAlertService {
  static metadata = {
    id: 'allergy-alert-service',
    title: 'Allergy Alert Service',
    description: 'Alerts when orders conflict with allergies',
    hook: 'order-select',
    prefetch: {
      patient: 'Patient/{{context.patientId}}',
      allergies: 'AllergyIntolerance?patient={{context.patientId}}'
    }
  };

  shouldExecute(context, prefetch) {
    return context.selections?.length > 0 && 
           prefetch.allergies?.entry?.length > 0;
  }

  execute(context, prefetch) {
    const cards = [];
    const allergies = prefetch.allergies.entry.map(e => e.resource);
    
    // Check each selected order
    for (const selection of context.selections) {
      const conflicts = this.checkAllergyConflicts(selection, allergies);
      
      for (const conflict of conflicts) {
        cards.push(this.createAllergyCard(selection, conflict));
      }
    }
    
    return { cards };
  }

  checkAllergyConflicts(order, allergies) {
    const conflicts = [];
    
    for (const allergy of allergies) {
      if (allergy.clinicalStatus?.coding?.[0]?.code !== 'active') continue;
      
      // Extract allergen
      const allergen = this.extractAllergen(allergy);
      if (!allergen) continue;
      
      // Check if order contains allergen
      if (this.orderContainsAllergen(order, allergen)) {
        conflicts.push({
          allergy,
          allergen,
          severity: allergy.criticality || 'low'
        });
      }
    }
    
    return conflicts;
  }

  createAllergyCard(order, conflict) {
    const severity = conflict.severity === 'high' ? 'critical' : 'warning';
    
    return {
      uuid: this.generateUUID(),
      summary: \`Allergy alert: \${conflict.allergen}\`,
      indicator: severity,
      detail: \`Patient has documented allergy to \${conflict.allergen}. \\n\\nReaction: \${this.getReactionDetails(conflict.allergy)}\`,
      source: {
        label: 'Allergy Checking System'
      },
      overrideReasons: [
        { code: 'not-applicable', display: 'Allergy not applicable to this order' },
        { code: 'will-premedicate', display: 'Will premedicate' },
        { code: 'emergency', display: 'Emergency override' },
        { code: 'desensitized', display: 'Patient has been desensitized' }
      ]
    };
  }

  extractAllergen(allergy) {
    if (allergy.code?.text) return allergy.code.text;
    if (allergy.code?.coding?.[0]?.display) return allergy.code.coding[0].display;
    return null;
  }

  orderContainsAllergen(order, allergen) {
    // Simplified check - in reality would need sophisticated matching
    const orderText = JSON.stringify(order).toLowerCase();
    return orderText.includes(allergen.toLowerCase());
  }

  getReactionDetails(allergy) {
    const reactions = allergy.reaction || [];
    return reactions.map(r => 
      r.manifestation?.map(m => m.text || m.coding?.[0]?.display).join(', ')
    ).filter(Boolean).join('; ') || 'No specific reaction documented';
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}`
    }
  }
];

export const getTemplatesByCategory = (category) => {
  return SERVICE_TEMPLATES.filter(t => t.category === category);
};

export const getTemplateById = (id) => {
  return SERVICE_TEMPLATES.find(t => t.id === id);
};