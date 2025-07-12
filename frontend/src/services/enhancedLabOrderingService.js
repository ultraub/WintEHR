/**
 * Enhanced Lab Ordering Service
 * Comprehensive lab ordering system with clinical decision support and appropriateness checking
 */

import { fhirClient } from './fhirClient';
import { differenceInDays, parseISO, format, addDays } from 'date-fns';

class EnhancedLabOrderingService {
  constructor() {
    this.labPanelCache = new Map();
    this.appropriatenessRules = this.initializeAppropriatenessRules();
    this.commonLabPanels = this.initializeCommonLabPanels();
    this.conditionBasedSets = this.initializeConditionBasedSets();
    this.routineCareTemplates = this.initializeRoutineCareTemplates();
  }

  /**
   * Initialize comprehensive lab panel definitions
   */
  initializeCommonLabPanels() {
    return {
      // Basic Panels
      'cmp': {
        id: 'cmp',
        name: 'Comprehensive Metabolic Panel',
        code: '24323-8',
        system: 'http://loinc.org',
        category: 'laboratory',
        components: [
          { code: '2345-7', name: 'Glucose', system: 'http://loinc.org' },
          { code: '3094-0', name: 'BUN', system: 'http://loinc.org' },
          { code: '2160-0', name: 'Creatinine', system: 'http://loinc.org' },
          { code: '2823-3', name: 'Potassium', system: 'http://loinc.org' },
          { code: '2951-2', name: 'Sodium', system: 'http://loinc.org' },
          { code: '2075-0', name: 'Chloride', system: 'http://loinc.org' },
          { code: '2028-9', name: 'CO2', system: 'http://loinc.org' },
          { code: '1975-2', name: 'Bilirubin Total', system: 'http://loinc.org' },
          { code: '1742-6', name: 'ALT', system: 'http://loinc.org' },
          { code: '1920-8', name: 'AST', system: 'http://loinc.org' },
          { code: '1751-7', name: 'Albumin', system: 'http://loinc.org' },
          { code: '2885-2', name: 'Total Protein', system: 'http://loinc.org' }
        ],
        fastingRequired: false,
        estimatedTAT: '4-6 hours',
        clinicalUse: 'Comprehensive assessment of kidney function, liver function, electrolytes, and glucose'
      },

      'cbc-diff': {
        id: 'cbc-diff',
        name: 'Complete Blood Count with Differential',
        code: '58410-2',
        system: 'http://loinc.org',
        category: 'laboratory',
        components: [
          { code: '6690-2', name: 'WBC Count', system: 'http://loinc.org' },
          { code: '789-8', name: 'RBC Count', system: 'http://loinc.org' },
          { code: '718-7', name: 'Hemoglobin', system: 'http://loinc.org' },
          { code: '4544-3', name: 'Hematocrit', system: 'http://loinc.org' },
          { code: '777-3', name: 'Platelet Count', system: 'http://loinc.org' },
          { code: '770-8', name: 'Neutrophils %', system: 'http://loinc.org' },
          { code: '736-9', name: 'Lymphocytes %', system: 'http://loinc.org' },
          { code: '5905-5', name: 'Monocytes %', system: 'http://loinc.org' },
          { code: '713-8', name: 'Eosinophils %', system: 'http://loinc.org' },
          { code: '706-2', name: 'Basophils %', system: 'http://loinc.org' }
        ],
        fastingRequired: false,
        estimatedTAT: '2-4 hours',
        clinicalUse: 'Evaluation of blood disorders, infections, and general health assessment'
      },

      'lipid-panel': {
        id: 'lipid-panel',
        name: 'Lipid Panel',
        code: '57698-3',
        system: 'http://loinc.org',
        category: 'laboratory',
        components: [
          { code: '2093-3', name: 'Total Cholesterol', system: 'http://loinc.org' },
          { code: '2571-8', name: 'Triglycerides', system: 'http://loinc.org' },
          { code: '2085-9', name: 'HDL Cholesterol', system: 'http://loinc.org' },
          { code: '18262-6', name: 'LDL Cholesterol Direct', system: 'http://loinc.org' },
          { code: '13457-7', name: 'LDL Cholesterol Calculated', system: 'http://loinc.org' }
        ],
        fastingRequired: true,
        fastingHours: 12,
        estimatedTAT: '4-6 hours',
        clinicalUse: 'Cardiovascular risk assessment and monitoring of lipid-lowering therapy'
      },

      'thyroid-panel': {
        id: 'thyroid-panel',
        name: 'Thyroid Function Panel',
        code: '24576-1',
        system: 'http://loinc.org',
        category: 'laboratory',
        components: [
          { code: '3016-3', name: 'TSH', system: 'http://loinc.org' },
          { code: '3024-7', name: 'Free T4', system: 'http://loinc.org' },
          { code: '3051-0', name: 'Free T3', system: 'http://loinc.org' }
        ],
        fastingRequired: false,
        estimatedTAT: '6-8 hours',
        clinicalUse: 'Assessment of thyroid function and monitoring thyroid replacement therapy'
      },

      'hemoglobin-a1c': {
        id: 'hemoglobin-a1c',
        name: 'Hemoglobin A1C',
        code: '4548-4',
        system: 'http://loinc.org',
        category: 'laboratory',
        components: [
          { code: '4548-4', name: 'Hemoglobin A1c', system: 'http://loinc.org' }
        ],
        fastingRequired: false,
        estimatedTAT: '4-6 hours',
        clinicalUse: 'Diabetes monitoring and diagnosis, reflects average glucose over 2-3 months'
      },

      'liver-function': {
        id: 'liver-function',
        name: 'Liver Function Panel',
        code: '24325-3',
        system: 'http://loinc.org',
        category: 'laboratory',
        components: [
          { code: '1742-6', name: 'ALT', system: 'http://loinc.org' },
          { code: '1920-8', name: 'AST', system: 'http://loinc.org' },
          { code: '6768-6', name: 'Alkaline Phosphatase', system: 'http://loinc.org' },
          { code: '1975-2', name: 'Bilirubin Total', system: 'http://loinc.org' },
          { code: '1968-7', name: 'Bilirubin Direct', system: 'http://loinc.org' },
          { code: '1751-7', name: 'Albumin', system: 'http://loinc.org' },
          { code: '2885-2', name: 'Total Protein', system: 'http://loinc.org' }
        ],
        fastingRequired: false,
        estimatedTAT: '4-6 hours',
        clinicalUse: 'Assessment of liver function and hepatocellular injury'
      },

      'coagulation-panel': {
        id: 'coagulation-panel',
        name: 'Coagulation Panel',
        code: '34714-6',
        system: 'http://loinc.org',
        category: 'laboratory',
        components: [
          { code: '5902-2', name: 'PT', system: 'http://loinc.org' },
          { code: '6301-6', name: 'INR', system: 'http://loinc.org' },
          { code: '3173-2', name: 'aPTT', system: 'http://loinc.org' }
        ],
        fastingRequired: false,
        estimatedTAT: '2-4 hours',
        clinicalUse: 'Bleeding disorder evaluation and anticoagulation monitoring'
      }
    };
  }

  /**
   * Initialize condition-based lab ordering sets
   */
  initializeConditionBasedSets() {
    return {
      'diabetes': {
        name: 'Diabetes Management',
        description: 'Comprehensive diabetes monitoring and management labs',
        conditions: ['diabetes', 'diabetes mellitus', 'type 2 diabetes', 'type 1 diabetes'],
        initialWorkup: [
          'hemoglobin-a1c',
          'cmp',
          'lipid-panel',
          { code: '14957-5', name: 'Microalbumin/Creatinine Ratio', system: 'http://loinc.org' }
        ],
        routine: [
          'hemoglobin-a1c',
          'cmp'
        ],
        frequency: {
          'hemoglobin-a1c': { months: 3, description: 'Every 3 months if A1C >7%, every 6 months if stable' },
          'cmp': { months: 6, description: 'Every 6 months for kidney function monitoring' },
          'lipid-panel': { months: 12, description: 'Annually unless abnormal' }
        }
      },

      'hypertension': {
        name: 'Hypertension Management',
        description: 'Essential labs for hypertension monitoring',
        conditions: ['hypertension', 'high blood pressure', 'essential hypertension'],
        initialWorkup: [
          'cmp',
          'lipid-panel',
          'thyroid-panel',
          { code: '14957-5', name: 'Microalbumin/Creatinine Ratio', system: 'http://loinc.org' }
        ],
        routine: [
          'cmp'
        ],
        frequency: {
          'cmp': { months: 6, description: 'Every 6 months for electrolytes and kidney function' },
          'lipid-panel': { months: 12, description: 'Annually for cardiovascular risk' }
        }
      },

      'ckd': {
        name: 'Chronic Kidney Disease',
        description: 'CKD staging and monitoring panel',
        conditions: ['chronic kidney disease', 'ckd', 'kidney disease'],
        initialWorkup: [
          'cmp',
          { code: '14957-5', name: 'Microalbumin/Creatinine Ratio', system: 'http://loinc.org' },
          { code: '24467-3', name: 'eGFR', system: 'http://loinc.org' },
          'cbc-diff',
          { code: '2777-1', name: 'Phosphorus', system: 'http://loinc.org' },
          { code: '17861-6', name: 'Calcium Total', system: 'http://loinc.org' },
          { code: '25087-8', name: 'PTH Intact', system: 'http://loinc.org' }
        ],
        routine: [
          'cmp',
          { code: '14957-5', name: 'Microalbumin/Creatinine Ratio', system: 'http://loinc.org' }
        ],
        frequency: {
          'cmp': { months: 3, description: 'Every 3 months for kidney function monitoring' },
          'cbc-diff': { months: 6, description: 'Every 6 months for anemia screening' }
        }
      },

      'cardiac': {
        name: 'Cardiac Risk Assessment',
        description: 'Cardiovascular disease prevention and monitoring',
        conditions: ['coronary artery disease', 'heart disease', 'cardiac', 'myocardial infarction'],
        initialWorkup: [
          'lipid-panel',
          'cmp',
          'hemoglobin-a1c',
          { code: '33747-0', name: 'High Sensitivity CRP', system: 'http://loinc.org' },
          { code: '10839-9', name: 'Troponin I', system: 'http://loinc.org' },
          { code: '42637-9', name: 'BNP', system: 'http://loinc.org' }
        ],
        routine: [
          'lipid-panel',
          'cmp'
        ],
        frequency: {
          'lipid-panel': { months: 3, description: 'Every 3 months while on statin therapy' },
          'cmp': { months: 6, description: 'Every 6 months for baseline function' }
        }
      }
    };
  }

  /**
   * Initialize routine care templates
   */
  initializeRoutineCareTemplates() {
    return {
      'annual-physical': {
        name: 'Annual Physical Examination',
        description: 'Comprehensive annual health maintenance labs',
        ageGroups: {
          '18-39': [
            'cbc-diff',
            'cmp',
            'lipid-panel',
            'thyroid-panel'
          ],
          '40-64': [
            'cbc-diff',
            'cmp',
            'lipid-panel',
            'thyroid-panel',
            'hemoglobin-a1c',
            { code: '25006-8', name: 'Vitamin D 25-OH', system: 'http://loinc.org' }
          ],
          '65+': [
            'cbc-diff',
            'cmp',
            'lipid-panel',
            'thyroid-panel',
            'hemoglobin-a1c',
            { code: '25006-8', name: 'Vitamin D 25-OH', system: 'http://loinc.org' },
            { code: '25087-8', name: 'PTH Intact', system: 'http://loinc.org' }
          ]
        }
      },

      'pre-operative': {
        name: 'Pre-Operative Assessment',
        description: 'Standard pre-operative laboratory evaluation',
        riskLevels: {
          'low': [
            'cbc-diff',
            'cmp'
          ],
          'moderate': [
            'cbc-diff',
            'cmp',
            'coagulation-panel',
            { code: '33747-0', name: 'Type and Screen', system: 'http://loinc.org' }
          ],
          'high': [
            'cbc-diff',
            'cmp',
            'coagulation-panel',
            'liver-function',
            { code: '33747-0', name: 'Type and Crossmatch', system: 'http://loinc.org' },
            { code: '10839-9', name: 'Troponin I', system: 'http://loinc.org' }
          ]
        }
      },

      'wellness-screening': {
        name: 'Wellness Screening',
        description: 'Preventive health screening labs',
        genderSpecific: {
          'female': {
            '21-65': [
              { code: '14503-7', name: 'Cervical Cytology', system: 'http://loinc.org' },
              { code: '77353-1', name: 'HPV DNA', system: 'http://loinc.org' }
            ],
            '40+': [
              { code: '24108-3', name: 'Mammography', system: 'http://loinc.org' }
            ],
            'reproductive': [
              { code: '19080-1', name: 'Chlamydia/Gonorrhea', system: 'http://loinc.org' },
              { code: '5196-1', name: 'Hepatitis B Surface Antigen', system: 'http://loinc.org' }
            ]
          },
          'male': {
            '50+': [
              { code: '2857-1', name: 'PSA', system: 'http://loinc.org' }
            ]
          }
        }
      }
    };
  }

  /**
   * Initialize lab appropriateness checking rules
   */
  initializeAppropriatenessRules() {
    return {
      // Duplicate order checking
      duplicate_order_check: {
        description: 'Check for duplicate orders within timeframe',
        severity: 'warning',
        check: async (labCode, patientId, timeframeDays = 30) => {
          try {
            const cutoffDate = addDays(new Date(), -timeframeDays);
            const recentOrders = await fhirClient.search('ServiceRequest', {
              patient: patientId,
              category: 'laboratory',
              authored: `ge${format(cutoffDate, 'yyyy-MM-dd')}`,
              _count: 100
            });

            const duplicates = (recentOrders.resources || []).filter(order => 
              order.code?.coding?.some(coding => coding.code === labCode)
            );

            if (duplicates.length > 0) {
              const lastOrder = duplicates[0];
              const daysSince = differenceInDays(new Date(), parseISO(lastOrder.authoredOn));
              
              return {
                appropriate: false,
                message: `Similar lab ordered ${daysSince} days ago`,
                suggestion: `Consider reviewing recent result before reordering`,
                lastOrderDate: lastOrder.authoredOn,
                severity: daysSince < 7 ? 'warning' : 'info'
              };
            }
            
            return { appropriate: true };
          } catch (error) {
            console.error('Error checking duplicate orders:', error);
            return { appropriate: true, error: true };
          }
        }
      },

      // Condition-specific appropriateness
      condition_based_appropriateness: {
        description: 'Check lab appropriateness based on patient conditions',
        severity: 'info',
        check: async (labCode, patientId, patientConditions) => {
          const recommendations = [];
          
          // A1C appropriateness for diabetes
          if (labCode === '4548-4') { // Hemoglobin A1C
            const hasDiabetes = patientConditions.some(condition =>
              condition.code?.text?.toLowerCase().includes('diabetes')
            );
            
            if (!hasDiabetes) {
              recommendations.push({
                appropriate: true,
                message: 'A1C ordered for non-diabetic patient',
                suggestion: 'Consider fasting glucose or OGTT for diabetes screening',
                severity: 'info'
              });
            }
          }

          // TSH appropriateness
          if (labCode === '3016-3') { // TSH
            const hasThyroidDisorder = patientConditions.some(condition =>
              condition.code?.text?.toLowerCase().includes('thyroid')
            );
            
            if (!hasThyroidDisorder) {
              recommendations.push({
                appropriate: true,
                message: 'TSH screening in asymptomatic patient',
                suggestion: 'Consider symptom assessment and clinical indication',
                severity: 'info'
              });
            }
          }

          return recommendations.length > 0 ? recommendations[0] : { appropriate: true };
        }
      },

      // Medication-based appropriateness
      medication_monitoring: {
        description: 'Check for medication-specific monitoring requirements',
        severity: 'warning',
        check: async (labCode, patientId, patientMedications) => {
          const monitoringRequirements = [];

          // Statin monitoring
          const onStatins = patientMedications.some(med =>
            med.medicationCodeableConcept?.text?.toLowerCase().includes('statin') ||
            med.medicationCodeableConcept?.text?.toLowerCase().includes('atorvastatin') ||
            med.medicationCodeableConcept?.text?.toLowerCase().includes('simvastatin')
          );

          if (onStatins && ['1742-6', '1920-8'].includes(labCode)) { // ALT, AST
            monitoringRequirements.push({
              appropriate: true,
              message: 'Liver function monitoring for statin therapy',
              suggestion: 'Appropriate monitoring for hepatotoxicity',
              severity: 'info'
            });
          }

          // ACE inhibitor monitoring
          const onACEInhibitors = patientMedications.some(med =>
            med.medicationCodeableConcept?.text?.toLowerCase().includes('lisinopril') ||
            med.medicationCodeableConcept?.text?.toLowerCase().includes('enalapril')
          );

          if (onACEInhibitors && ['2160-0', '2823-3'].includes(labCode)) { // Creatinine, Potassium
            monitoringRequirements.push({
              appropriate: true,
              message: 'Kidney function monitoring for ACE inhibitor therapy',
              suggestion: 'Appropriate monitoring for hyperkalemia and kidney function',
              severity: 'info'
            });
          }

          return monitoringRequirements.length > 0 ? monitoringRequirements[0] : { appropriate: true };
        }
      },

      // Age-based appropriateness
      age_based_screening: {
        description: 'Age-appropriate screening recommendations',
        severity: 'info',
        check: (labCode, patientBirthDate) => {
          if (!patientBirthDate) return { appropriate: true };
          
          const age = differenceInDays(new Date(), parseISO(patientBirthDate)) / 365.25;
          
          // PSA screening
          if (labCode === '2857-1') { // PSA
            if (age < 50) {
              return {
                appropriate: false,
                message: 'PSA screening generally not recommended under age 50',
                suggestion: 'Consider risk factors and shared decision making',
                severity: 'warning'
              };
            }
            if (age > 70) {
              return {
                appropriate: false,
                message: 'PSA screening benefit unclear over age 70',
                suggestion: 'Consider life expectancy and patient preferences',
                severity: 'info'
              };
            }
          }

          // Lipid screening frequency
          if (labCode === '57698-3') { // Lipid panel
            if (age < 20) {
              return {
                appropriate: false,
                message: 'Lipid screening not routinely recommended under age 20',
                suggestion: 'Consider family history and risk factors',
                severity: 'info'
              };
            }
          }

          return { appropriate: true };
        }
      }
    };
  }

  /**
   * Get appropriate lab panels for a condition
   */
  async getConditionBasedLabSets(conditions, isInitialWorkup = false) {
    const recommendedSets = [];
    
    conditions.forEach(condition => {
      const conditionText = condition.code?.text?.toLowerCase() || '';
      
      Object.entries(this.conditionBasedSets).forEach(([setId, setConfig]) => {
        if (setConfig.conditions.some(condText => conditionText.includes(condText))) {
          const labSet = {
            setId,
            name: setConfig.name,
            description: setConfig.description,
            condition: condition.code?.text,
            labs: isInitialWorkup ? setConfig.initialWorkup : setConfig.routine,
            frequency: setConfig.frequency
          };
          recommendedSets.push(labSet);
        }
      });
    });

    return recommendedSets;
  }

  /**
   * Get routine care templates based on patient demographics
   */
  getRoutineCareTemplate(patient, templateType = 'annual-physical') {
    const template = this.routineCareTemplates[templateType];
    if (!template) return null;

    const age = patient.birthDate ? 
      differenceInDays(new Date(), parseISO(patient.birthDate)) / 365.25 : null;
    const gender = patient.gender;

    let recommendedLabs = [];

    // Age-based recommendations
    if (template.ageGroups && age) {
      if (age >= 65) {
        recommendedLabs = [...template.ageGroups['65+']];
      } else if (age >= 40) {
        recommendedLabs = [...template.ageGroups['40-64']];
      } else if (age >= 18) {
        recommendedLabs = [...template.ageGroups['18-39']];
      }
    }

    // Gender-specific recommendations
    if (template.genderSpecific && gender) {
      const genderRecs = template.genderSpecific[gender];
      if (genderRecs) {
        Object.entries(genderRecs).forEach(([ageGroup, labs]) => {
          if (this.isAgeInGroup(age, ageGroup)) {
            recommendedLabs.push(...labs);
          }
        });
      }
    }

    return {
      templateType,
      name: template.name,
      description: template.description,
      recommendedLabs: this.expandLabReferences(recommendedLabs),
      patientAge: age ? Math.round(age) : null,
      patientGender: gender
    };
  }

  /**
   * Check lab appropriateness using all rules
   */
  async checkLabAppropriateness(labOrder, patientData) {
    const results = {
      overall: { appropriate: true, severity: 'info' },
      checks: [],
      recommendations: []
    };

    const { patient, conditions = [], medications = [] } = patientData;
    const labCode = labOrder.code?.coding?.[0]?.code;

    if (!labCode) {
      results.overall.appropriate = false;
      results.overall.severity = 'error';
      results.checks.push({
        rule: 'missing_code',
        appropriate: false,
        message: 'Lab order missing LOINC code',
        severity: 'error'
      });
      return results;
    }

    // Run all appropriateness checks
    for (const [ruleName, rule] of Object.entries(this.appropriatenessRules)) {
      try {
        let checkResult;
        
        switch (ruleName) {
          case 'duplicate_order_check':
            checkResult = await rule.check(labCode, patient.id);
            break;
          case 'condition_based_appropriateness':
            checkResult = await rule.check(labCode, patient.id, conditions);
            break;
          case 'medication_monitoring':
            checkResult = await rule.check(labCode, patient.id, medications);
            break;
          case 'age_based_screening':
            checkResult = rule.check(labCode, patient.birthDate);
            break;
          default:
            continue;
        }

        if (checkResult) {
          results.checks.push({
            rule: ruleName,
            ...checkResult
          });

          // Update overall appropriateness
          if (!checkResult.appropriate) {
            results.overall.appropriate = false;
            if (checkResult.severity === 'warning' && results.overall.severity === 'info') {
              results.overall.severity = 'warning';
            } else if (checkResult.severity === 'error') {
              results.overall.severity = 'error';
            }
          }

          // Add to recommendations if suggestion provided
          if (checkResult.suggestion) {
            results.recommendations.push({
              message: checkResult.message,
              suggestion: checkResult.suggestion,
              severity: checkResult.severity
            });
          }
        }
      } catch (error) {
        console.error(`Error running appropriateness rule ${ruleName}:`, error);
      }
    }

    return results;
  }

  /**
   * Generate lab result prediction timeline
   */
  generateLabResultTimeline(labOrders) {
    const timeline = labOrders.map(order => {
      const labPanel = this.getLabPanelInfo(order.code?.coding?.[0]?.code);
      const orderDate = new Date();
      
      return {
        orderId: order.id || `temp-${Date.now()}`,
        labName: order.code?.text || labPanel?.name || 'Unknown Lab',
        orderDate: orderDate.toISOString(),
        expectedResults: this.calculateExpectedResultTime(labPanel, orderDate),
        fastingRequired: labPanel?.fastingRequired || false,
        fastingHours: labPanel?.fastingHours,
        collectionInstructions: this.getCollectionInstructions(labPanel),
        estimatedTAT: labPanel?.estimatedTAT || '4-6 hours',
        priority: order.priority || 'routine'
      };
    });

    return timeline.sort((a, b) => 
      new Date(a.expectedResults) - new Date(b.expectedResults)
    );
  }

  /**
   * Get fasting requirements and preparation instructions
   */
  getFastingRequirements(labCodes) {
    const requirements = {
      fastingRequired: false,
      fastingHours: 0,
      instructions: [],
      restrictions: []
    };

    labCodes.forEach(code => {
      const labPanel = this.getLabPanelInfo(code);
      if (labPanel?.fastingRequired) {
        requirements.fastingRequired = true;
        requirements.fastingHours = Math.max(
          requirements.fastingHours, 
          labPanel.fastingHours || 12
        );
      }
    });

    if (requirements.fastingRequired) {
      requirements.instructions = [
        `Fast for ${requirements.fastingHours} hours before blood draw`,
        'Only water is allowed during fasting period',
        'Take regular medications unless instructed otherwise',
        'Schedule morning appointment when possible'
      ];

      requirements.restrictions = [
        'No food or beverages except water',
        'No gum, candy, or mints',
        'No smoking during fasting period',
        'Avoid strenuous exercise before test'
      ];
    }

    return requirements;
  }

  /**
   * Helper methods
   */
  getLabPanelInfo(labCode) {
    return Object.values(this.commonLabPanels).find(panel =>
      panel.code === labCode || 
      panel.components?.some(comp => comp.code === labCode)
    );
  }

  calculateExpectedResultTime(labPanel, orderDate) {
    const baseHours = labPanel?.estimatedTAT?.includes('2-4') ? 3 :
                     labPanel?.estimatedTAT?.includes('4-6') ? 5 :
                     labPanel?.estimatedTAT?.includes('6-8') ? 7 : 4;
    
    return addDays(orderDate, 0).setHours(
      orderDate.getHours() + baseHours
    );
  }

  getCollectionInstructions(labPanel) {
    const instructions = ['Standard venipuncture collection'];
    
    if (labPanel?.fastingRequired) {
      instructions.push(`Fasting required: ${labPanel.fastingHours || 12} hours`);
    }
    
    if (labPanel?.id === 'coagulation-panel') {
      instructions.push('Blue top tube (sodium citrate)');
    } else if (labPanel?.id === 'cbc-diff') {
      instructions.push('Purple top tube (EDTA)');
    } else {
      instructions.push('Gold/Red top tube (serum separator)');
    }
    
    return instructions;
  }

  isAgeInGroup(age, ageGroup) {
    if (!age) return false;
    
    if (ageGroup.includes('+')) {
      const minAge = parseInt(ageGroup.replace('+', ''));
      return age >= minAge;
    }
    
    if (ageGroup.includes('-')) {
      const [min, max] = ageGroup.split('-').map(Number);
      return age >= min && age <= max;
    }
    
    return false;
  }

  expandLabReferences(labRefs) {
    return labRefs.map(labRef => {
      if (typeof labRef === 'string') {
        return this.commonLabPanels[labRef] || { name: labRef, id: labRef };
      }
      return labRef;
    });
  }

  clearCache() {
    this.labPanelCache.clear();
  }
}

// Export singleton instance
export const enhancedLabOrderingService = new EnhancedLabOrderingService();