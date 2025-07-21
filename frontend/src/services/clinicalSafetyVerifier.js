/**
 * Clinical Safety Verification Service
 * Comprehensive safety verification for medication management processes
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { differenceInDays, parseISO, addDays } from 'date-fns';

class ClinicalSafetyVerifier {
  constructor() {
    this.safetyRules = this.initializeSafetyRules();
    this.verificationCache = new Map();
  }

  /**
   * Initialize comprehensive clinical safety rules
   */
  initializeSafetyRules() {
    return {
      // Critical Safety Checks
      criticalSafety: {
        'duplicate_therapy_check': {
          description: 'Check for duplicate therapeutic classes',
          severity: 'critical',
          check: async (medications, patientData) => {
            const issues = [];
            const activeByClass = {};
            
            medications
              .filter(med => med.status === 'active')
              .forEach(med => {
                const className = this.getMedicationClass(med);
                if (!activeByClass[className]) {
                  activeByClass[className] = [];
                }
                activeByClass[className].push(med);
              });

            Object.entries(activeByClass).forEach(([className, meds]) => {
              if (meds.length > 1 && className !== 'unknown') {
                issues.push({
                  type: 'duplicate_therapy',
                  message: `Multiple active medications in class: ${className}`,
                  medications: meds.map(m => m.id),
                  risk: 'high'
                });
              }
            });

            return issues;
          }
        },

        'allergy_contraindication_check': {
          description: 'Verify no medications conflict with known allergies',
          severity: 'critical',
          check: async (medications, patientData) => {
            const issues = [];
            const activeAllergies = patientData.allergies?.filter(
              allergy => allergy.clinicalStatus?.coding?.[0]?.code === 'active'
            ) || [];

            medications
              .filter(med => med.status === 'active')
              .forEach(med => {
                activeAllergies.forEach(allergy => {
                  if (this.checkAllergyConflict(med, allergy)) {
                    issues.push({
                      type: 'allergy_conflict',
                      message: `Medication may conflict with known allergy: ${allergy.code?.text || 'Unknown allergen'}`,
                      medicationId: med.id,
                      allergyId: allergy.id,
                      risk: 'critical'
                    });
                  }
                });
              });

            return issues;
          }
        },

        'high_risk_medication_monitoring': {
          description: 'Ensure high-risk medications have proper monitoring',
          severity: 'critical',
          check: async (medications, patientData) => {
            const issues = [];
            const highRiskMeds = medications.filter(med => 
              med.status === 'active' && this.isHighRiskMedication(med)
            );

            for (const med of highRiskMeds) {
              const hasMonitoring = await this.hasRecentLabMonitoring(med, patientData);
              if (!hasMonitoring) {
                issues.push({
                  type: 'missing_monitoring',
                  message: `High-risk medication lacks required lab monitoring`,
                  medicationId: med.id,
                  medicationName: med.medicationCodeableConcept?.text,
                  risk: 'high'
                });
              }
            }

            return issues;
          }
        },

        'dosage_safety_limits': {
          description: 'Verify dosages are within safe limits',
          severity: 'critical',
          check: async (medications, patientData) => {
            const issues = [];
            
            medications
              .filter(med => med.status === 'active')
              .forEach(med => {
                const safetyIssue = this.checkDosageSafety(med, patientData.patient);
                if (safetyIssue) {
                  issues.push({
                    type: 'unsafe_dosage',
                    message: safetyIssue.message,
                    medicationId: med.id,
                    risk: safetyIssue.risk
                  });
                }
              });

            return issues;
          }
        }
      },

      // Workflow Safety Checks
      workflowSafety: {
        'discontinuation_safety': {
          description: 'Verify safe discontinuation practices',
          severity: 'high',
          check: async (medications, patientData) => {
            const issues = [];
            const stoppedMeds = medications.filter(med => med.status === 'stopped');

            for (const med of stoppedMeds) {
              const discontinuationData = await this.getDiscontinuationData(med.id);
              if (discontinuationData) {
                // Check for abrupt discontinuation of medications requiring tapering
                if (this.requiresTapering(med) && discontinuationData.type === 'immediate') {
                  issues.push({
                    type: 'abrupt_discontinuation',
                    message: 'Medication discontinued abruptly when tapering recommended',
                    medicationId: med.id,
                    risk: 'medium'
                  });
                }

                // Check for missing follow-up after discontinuation
                if (this.requiresFollowUpAfterDiscontinuation(med, discontinuationData)) {
                  const hasFollowUp = await this.hasPostDiscontinuationFollowUp(med.id);
                  if (!hasFollowUp) {
                    issues.push({
                      type: 'missing_followup',
                      message: 'Discontinued medication lacks required follow-up',
                      medicationId: med.id,
                      risk: 'medium'
                    });
                  }
                }
              }
            }

            return issues;
          }
        },

        'prescription_completeness': {
          description: 'Verify prescription completeness and clarity',
          severity: 'medium',
          check: async (medications, patientData) => {
            const issues = [];
            
            medications.forEach(med => {
              // Check for complete dosage instructions
              if (!med.dosageInstruction || med.dosageInstruction.length === 0) {
                issues.push({
                  type: 'missing_dosage',
                  message: 'Prescription lacks dosage instructions',
                  medicationId: med.id,
                  risk: 'medium'
                });
              } else {
                const dosage = med.dosageInstruction[0];
                if (!dosage.text && !dosage.doseAndRate) {
                  issues.push({
                    type: 'unclear_dosage',
                    message: 'Dosage instructions are unclear or incomplete',
                    medicationId: med.id,
                    risk: 'medium'
                  });
                }
              }

              // Check for duration specification for short-term medications
              if (this.requiresDuration(med) && !this.hasDurationSpecified(med)) {
                issues.push({
                  type: 'missing_duration',
                  message: 'Short-term medication lacks specified duration',
                  medicationId: med.id,
                  risk: 'low'
                });
              }
            });

            return issues;
          }
        },

        'refill_safety': {
          description: 'Verify safe refill practices',
          severity: 'medium',
          check: async (medications, patientData) => {
            const issues = [];
            
            const activeMeds = medications.filter(med => med.status === 'active');
            for (const med of activeMeds) {
              // Check for excessive refill authorizations
              const refillsAllowed = med.dispenseRequest?.numberOfRepeatsAllowed || 0;
              if (this.isControlledSubstance(med) && refillsAllowed > 5) {
                issues.push({
                  type: 'excessive_refills',
                  message: 'Controlled substance has excessive refill authorizations',
                  medicationId: med.id,
                  risk: 'medium'
                });
              }

              // Check for timely refill requests
              const refillHistory = await this.getRefillHistory(med.id);
              if (refillHistory && this.hasEarlyRefillPattern(refillHistory)) {
                issues.push({
                  type: 'early_refill_pattern',
                  message: 'Patient shows pattern of early refill requests',
                  medicationId: med.id,
                  risk: 'medium'
                });
              }
            }

            return issues;
          }
        }
      },

      // Clinical Process Safety
      processSafety: {
        'effectiveness_monitoring_compliance': {
          description: 'Verify effectiveness monitoring compliance',
          severity: 'medium',
          check: async (medications, patientData) => {
            const issues = [];
            
            const activeMeds = medications.filter(med => med.status === 'active');
            for (const med of activeMeds) {
              const daysSinceStart = differenceInDays(new Date(), parseISO(med.authoredOn));
              
              // Check for overdue effectiveness assessments
              if (daysSinceStart > 30) {
                const hasRecentAssessment = await this.hasRecentEffectivenessAssessment(med.id);
                if (!hasRecentAssessment) {
                  issues.push({
                    type: 'overdue_assessment',
                    message: 'Medication effectiveness assessment overdue',
                    medicationId: med.id,
                    risk: 'low'
                  });
                }
              }

              // Check for adverse effect monitoring
              if (this.requiresAdverseEffectMonitoring(med)) {
                const hasAdverseEffectTracking = await this.hasAdverseEffectTracking(med.id);
                if (!hasAdverseEffectTracking) {
                  issues.push({
                    type: 'missing_adverse_monitoring',
                    message: 'Medication lacks adverse effect monitoring',
                    medicationId: med.id,
                    risk: 'medium'
                  });
                }
              }
            }

            return issues;
          }
        },

        'patient_education_verification': {
          description: 'Verify patient education completeness',
          severity: 'low',
          check: async (medications, patientData) => {
            const issues = [];
            
            const newMeds = medications.filter(med => {
              const daysSinceStart = differenceInDays(new Date(), parseISO(med.authoredOn));
              return daysSinceStart <= 7 && med.status === 'active';
            });

            for (const med of newMeds) {
              const hasEducationRecord = await this.hasPatientEducationRecord(med.id);
              if (!hasEducationRecord && this.requiresPatientEducation(med)) {
                issues.push({
                  type: 'missing_education',
                  message: 'New medication lacks patient education documentation',
                  medicationId: med.id,
                  risk: 'low'
                });
              }
            }

            return issues;
          }
        }
      }
    };
  }

  /**
   * Perform comprehensive clinical safety verification
   */
  async performSafetyVerification(patientId) {
    try {
      const verificationReport = {
        patientId,
        timestamp: new Date().toISOString(),
        overall: { 
          safe: true, 
          riskLevel: 'low',
          score: 100,
          criticalIssues: 0,
          highRiskIssues: 0,
          mediumRiskIssues: 0,
          lowRiskIssues: 0
        },
        categories: {
          criticalSafety: { safe: true, issues: [] },
          workflowSafety: { safe: true, issues: [] },
          processSafety: { safe: true, issues: [] }
        },
        recommendations: [],
        actions: [],
        patientSpecific: {
          age: null,
          allergies: [],
          conditions: [],
          riskFactors: []
        }
      };

      // Gather patient data
      const patientData = await this.gatherPatientSafetyData(patientId);
      verificationReport.patientSpecific = this.analyzePatientRiskFactors(patientData);

      // Run all safety checks
      await this.runSafetyChecks(patientData, verificationReport);

      // Calculate overall safety assessment
      this.calculateOverallSafety(verificationReport);

      // Generate safety recommendations
      verificationReport.recommendations = this.generateSafetyRecommendations(verificationReport);

      // Generate required actions
      verificationReport.actions = this.generateRequiredActions(verificationReport);

      return verificationReport;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Gather all patient data needed for safety verification
   */
  async gatherPatientSafetyData(patientId) {
    try {
      const [
        patientResponse,
        medicationsResponse,
        allergiesResponse,
        conditionsResponse,
        observationsResponse,
        carePlansResponse
      ] = await Promise.all([
        fhirClient.read('Patient', patientId),
        fhirClient.search('MedicationRequest', { patient: patientId, _count: 100 }),
        fhirClient.search('AllergyIntolerance', { patient: patientId, _count: 50 }),
        fhirClient.search('Condition', { patient: patientId, _count: 100 }),
        fhirClient.search('Observation', { patient: patientId, _count: 200 }),
        fhirClient.search('CarePlan', { patient: patientId, _count: 50 })
      ]);

      return {
        patient: patientResponse,
        medications: medicationsResponse.resources || [],
        allergies: allergiesResponse.resources || [],
        conditions: conditionsResponse.resources || [],
        observations: observationsResponse.resources || [],
        carePlans: carePlansResponse.resources || []
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Run all safety checks across categories
   */
  async runSafetyChecks(patientData, verificationReport) {
    for (const [categoryName, categoryRules] of Object.entries(this.safetyRules)) {
      const categoryResult = { safe: true, issues: [] };

      for (const [, rule] of Object.entries(categoryRules)) {
        try {
          const issues = await rule.check(patientData.medications, patientData);
          categoryResult.issues.push(...issues);
          
          if (issues.length > 0) {
            categoryResult.safe = false;
          }
        } catch (error) {
          categoryResult.issues.push({
            type: 'verification_error',
            message: `Safety check failed: ${rule.description}`,
            risk: 'unknown'
          });
        }
      }

      verificationReport.categories[categoryName] = categoryResult;
    }
  }

  /**
   * Analyze patient-specific risk factors
   */
  analyzePatientRiskFactors(patientData) {
    const riskFactors = [];
    const patient = patientData.patient;
    
    // Age-related risks
    const birthDate = patient.birthDate ? parseISO(patient.birthDate) : null;
    const age = birthDate ? differenceInDays(new Date(), birthDate) / 365.25 : null;
    
    if (age) {
      if (age >= 65) {
        riskFactors.push({
          type: 'age_geriatric',
          description: 'Geriatric patient - increased medication sensitivity',
          risk: 'medium'
        });
      }
      if (age < 18) {
        riskFactors.push({
          type: 'age_pediatric',
          description: 'Pediatric patient - requires age-appropriate dosing',
          risk: 'medium'
        });
      }
    }

    // Condition-related risks
    const activeConditions = patientData.conditions.filter(
      condition => condition.clinicalStatus?.coding?.[0]?.code === 'active'
    );

    activeConditions.forEach(condition => {
      const conditionCode = condition.code?.coding?.[0]?.code;
      if (this.isHighRiskCondition(conditionCode)) {
        riskFactors.push({
          type: 'high_risk_condition',
          description: `High-risk condition: ${condition.code?.text || 'Unknown'}`,
          risk: 'high',
          conditionId: condition.id
        });
      }
    });

    // Allergy-related risks
    const activeAllergies = patientData.allergies.filter(
      allergy => allergy.clinicalStatus?.coding?.[0]?.code === 'active'
    );

    if (activeAllergies.length > 3) {
      riskFactors.push({
        type: 'multiple_allergies',
        description: 'Multiple drug allergies increase risk of adverse reactions',
        risk: 'medium'
      });
    }

    return {
      age: age ? Math.round(age) : null,
      allergies: activeAllergies.length,
      conditions: activeConditions.length,
      riskFactors
    };
  }

  /**
   * Calculate overall safety assessment
   */
  calculateOverallSafety(verificationReport) {
    let criticalCount = 0;
    let highRiskCount = 0;
    let mediumRiskCount = 0;
    let lowRiskCount = 0;

    Object.values(verificationReport.categories).forEach(category => {
      category.issues.forEach(issue => {
        switch (issue.risk) {
          case 'critical':
            criticalCount++;
            break;
          case 'high':
            highRiskCount++;
            break;
          case 'medium':
            mediumRiskCount++;
            break;
          case 'low':
            lowRiskCount++;
            break;
          default:
            // Handle unknown risk levels
            break;
        }
      });
    });

    // Update counts
    verificationReport.overall.criticalIssues = criticalCount;
    verificationReport.overall.highRiskIssues = highRiskCount;
    verificationReport.overall.mediumRiskIssues = mediumRiskCount;
    verificationReport.overall.lowRiskIssues = lowRiskCount;

    // Determine overall safety
    if (criticalCount > 0) {
      verificationReport.overall.safe = false;
      verificationReport.overall.riskLevel = 'critical';
    } else if (highRiskCount > 0) {
      verificationReport.overall.safe = false;
      verificationReport.overall.riskLevel = 'high';
    } else if (mediumRiskCount > 0) {
      verificationReport.overall.safe = false;
      verificationReport.overall.riskLevel = 'medium';
    } else if (lowRiskCount > 0) {
      verificationReport.overall.riskLevel = 'low';
    }

    // Calculate safety score
    let score = 100;
    score -= criticalCount * 25; // Critical issues heavily penalized
    score -= highRiskCount * 15;
    score -= mediumRiskCount * 10;
    score -= lowRiskCount * 5;

    verificationReport.overall.score = Math.max(0, score);
  }

  /**
   * Generate safety recommendations
   */
  generateSafetyRecommendations(verificationReport) {
    const recommendations = [];

    // Critical safety recommendations
    if (verificationReport.overall.criticalIssues > 0) {
      recommendations.push({
        priority: 'urgent',
        category: 'safety',
        message: 'Address critical medication safety issues immediately',
        action: 'Review and resolve all critical safety alerts before continuing patient care'
      });
    }

    // Patient-specific recommendations
    const riskFactors = verificationReport.patientSpecific.riskFactors;
    if (riskFactors.some(rf => rf.type === 'age_geriatric')) {
      recommendations.push({
        priority: 'medium',
        category: 'geriatric',
        message: 'Consider geriatric-specific medication guidelines',
        action: 'Review medications for geriatric appropriateness and consider dose adjustments'
      });
    }

    if (riskFactors.some(rf => rf.type === 'multiple_allergies')) {
      recommendations.push({
        priority: 'medium',
        category: 'allergy',
        message: 'Enhanced allergy monitoring recommended',
        action: 'Implement heightened allergy screening for new medications'
      });
    }

    // Workflow recommendations
    Object.entries(verificationReport.categories).forEach(([categoryName, category]) => {
      if (!category.safe) {
        const issueTypes = [...new Set(category.issues.map(issue => issue.type))];
        issueTypes.forEach(type => {
          const recommendation = this.getRecommendationForIssueType(type);
          if (recommendation) {
            recommendations.push(recommendation);
          }
        });
      }
    });

    return recommendations;
  }

  /**
   * Generate required actions
   */
  generateRequiredActions(verificationReport) {
    const actions = [];

    // Immediate actions for critical issues
    verificationReport.categories.criticalSafety.issues.forEach(issue => {
      switch (issue.type) {
        case 'allergy_conflict':
          actions.push({
            type: 'immediate',
            priority: 'critical',
            description: 'Review potential allergy conflict',
            medicationId: issue.medicationId,
            dueDate: new Date().toISOString()
          });
          break;
        case 'duplicate_therapy':
          actions.push({
            type: 'review',
            priority: 'high',
            description: 'Review duplicate therapy',
            medicationIds: issue.medications,
            dueDate: addDays(new Date(), 1).toISOString()
          });
          break;
        case 'missing_monitoring':
          actions.push({
            type: 'schedule',
            priority: 'high',
            description: 'Schedule required lab monitoring',
            medicationId: issue.medicationId,
            dueDate: addDays(new Date(), 3).toISOString()
          });
          break;
        default:
          // Handle unknown issue types
          break;
      }
    });

    // Workflow improvement actions
    verificationReport.categories.workflowSafety.issues.forEach(issue => {
      if (issue.type === 'missing_followup') {
        actions.push({
          type: 'schedule',
          priority: 'medium',
          description: 'Schedule post-discontinuation follow-up',
          medicationId: issue.medicationId,
          dueDate: addDays(new Date(), 7).toISOString()
        });
      }
    });

    return actions;
  }

  /**
   * Helper methods for safety checks
   */
  getMedicationClass(medication) {
    const medText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const medCoding = medication.medicationCodeableConcept?.coding?.[0]?.display?.toLowerCase() || '';
    const fullText = `${medText} ${medCoding}`;

    // Simple classification - in real implementation, use drug database
    if (fullText.includes('lisinopril') || fullText.includes('amlodipine')) return 'ace_inhibitor';
    if (fullText.includes('atorvastatin') || fullText.includes('statin')) return 'statin';
    if (fullText.includes('metformin') || fullText.includes('insulin')) return 'antidiabetic';
    if (fullText.includes('warfarin') || fullText.includes('anticoagulant')) return 'anticoagulant';
    return 'unknown';
  }

  checkAllergyConflict(medication, allergy) {
    // Simplified allergy checking - in real implementation, use comprehensive drug-allergy database
    const medText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const allergyText = allergy.code?.text?.toLowerCase() || '';
    
    return medText.includes(allergyText) || allergyText.includes(medText);
  }

  isHighRiskMedication(medication) {
    const medText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const highRiskMeds = ['warfarin', 'digoxin', 'lithium', 'phenytoin', 'theophylline'];
    return highRiskMeds.some(risk => medText.includes(risk));
  }

  isControlledSubstance(medication) {
    const medText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const controlled = ['oxycodone', 'morphine', 'fentanyl', 'adderall', 'ativan', 'xanax'];
    return controlled.some(substance => medText.includes(substance));
  }

  requiresTapering(medication) {
    const medText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const taperingMeds = ['prednisone', 'propranolol', 'sertraline', 'clonazepam'];
    return taperingMeds.some(med => medText.includes(med));
  }

  isHighRiskCondition(conditionCode) {
    const highRiskConditions = ['N18', 'I50', 'K72', 'J44']; // CKD, heart failure, liver failure, COPD
    return highRiskConditions.some(code => conditionCode?.includes(code));
  }

  getRecommendationForIssueType(issueType) {
    const recommendations = {
      'duplicate_therapy': {
        priority: 'high',
        category: 'prescribing',
        message: 'Review duplicate therapies for clinical appropriateness',
        action: 'Consider discontinuing redundant medications or adjusting therapy'
      },
      'missing_monitoring': {
        priority: 'high',
        category: 'monitoring',
        message: 'Implement required monitoring for high-risk medications',
        action: 'Schedule appropriate laboratory monitoring and follow-up'
      },
      'overdue_assessment': {
        priority: 'medium',
        category: 'effectiveness',
        message: 'Complete overdue medication effectiveness assessments',
        action: 'Schedule patient appointments for medication review'
      }
    };

    return recommendations[issueType] || null;
  }

  // Placeholder methods for external service calls
  async hasRecentLabMonitoring(medication, patientData) {
    // Implementation would check for recent relevant lab results
    return Math.random() > 0.3; // Placeholder
  }

  async getDiscontinuationData(medicationId) {
    // Implementation would fetch discontinuation record
    return null; // Placeholder
  }

  async hasRecentEffectivenessAssessment(medicationId) {
    // Implementation would check for recent assessments
    return Math.random() > 0.4; // Placeholder
  }

  async hasPatientEducationRecord(medicationId) {
    // Implementation would check for education documentation
    return Math.random() > 0.6; // Placeholder
  }

  /**
   * Check dosage safety for a medication and patient
   * @param {Object} medication - FHIR MedicationRequest
   * @param {Object} patient - FHIR Patient resource
   * @returns {Object|null} Safety issue if found, null if safe
   */
  checkDosageSafety(medication, patient) {
    if (!medication.dosageInstruction || medication.dosageInstruction.length === 0) {
      return null;
    }

    const dosage = medication.dosageInstruction[0];
    if (!dosage.doseAndRate || dosage.doseAndRate.length === 0) {
      return null;
    }

    const dose = dosage.doseAndRate[0];
    const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
    
    // Calculate patient age for age-based dosing
    const patientAge = patient.birthDate ? 
      Math.floor((new Date() - new Date(patient.birthDate)) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    // Define maximum safe doses for common medications (mg/kg/day or absolute max)
    const maxSafeDoses = {
      // Common pain medications
      '161': { maxDaily: 4000, unit: 'mg', name: 'Acetaminophen' }, // Acetaminophen
      '1191': { maxDaily: 3200, unit: 'mg', name: 'Aspirin' }, // Aspirin
      '5640': { maxDaily: 800, maxSingle: 200, unit: 'mg', name: 'Ibuprofen' }, // Ibuprofen
      
      // Common antibiotics
      '723': { maxDaily: 100, unit: 'mg/kg', name: 'Amoxicillin' }, // Amoxicillin
      '2670': { maxDaily: 40, unit: 'mg/kg', name: 'Cephalexin' }, // Cephalexin
      
      // Cardiovascular medications
      '18867': { maxDaily: 80, unit: 'mg', name: 'Atorvastatin' }, // Atorvastatin
      '29046': { maxDaily: 40, unit: 'mg', name: 'Lisinopril' }, // Lisinopril
      
      // Default safety thresholds for unknown medications
      'default': { maxDaily: 1000, unit: 'mg' }
    };

    const safetyProfile = maxSafeDoses[medicationCode] || maxSafeDoses['default'];
    
    // Extract dose quantity and frequency
    let dailyDose = 0;
    let singleDose = 0;
    
    if (dose.doseQuantity) {
      singleDose = dose.doseQuantity.value || 0;
      const frequency = dosage.timing?.repeat?.frequency || 1;
      const period = dosage.timing?.repeat?.period || 1;
      const periodUnit = dosage.timing?.repeat?.periodUnit || 'd';
      
      // Calculate daily dose
      let dailyFrequency = frequency / period;
      if (periodUnit === 'h') {
        dailyFrequency = frequency * (24 / period);
      } else if (periodUnit === 'wk') {
        dailyFrequency = frequency / (period * 7);
      }
      
      dailyDose = singleDose * dailyFrequency;
    }

    // Check maximum daily dose
    if (safetyProfile.maxDaily && dailyDose > safetyProfile.maxDaily) {
      return {
        message: `Daily dose ${dailyDose}${safetyProfile.unit} exceeds maximum safe dose ${safetyProfile.maxDaily}${safetyProfile.unit} for ${safetyProfile.name}`,
        risk: 'critical',
        currentDose: dailyDose,
        maxSafeDose: safetyProfile.maxDaily,
        unit: safetyProfile.unit
      };
    }

    // Check maximum single dose
    if (safetyProfile.maxSingle && singleDose > safetyProfile.maxSingle) {
      return {
        message: `Single dose ${singleDose}${safetyProfile.unit} exceeds maximum safe single dose ${safetyProfile.maxSingle}${safetyProfile.unit} for ${safetyProfile.name}`,
        risk: 'high',
        currentDose: singleDose,
        maxSafeDose: safetyProfile.maxSingle,
        unit: safetyProfile.unit
      };
    }

    // Age-specific dosing warnings
    if (patientAge) {
      if (patientAge >= 65 && ['5640', '1191'].includes(medicationCode)) {
        // NSAIDs in elderly
        return {
          message: `${safetyProfile.name} requires caution in patients ≥65 years due to increased GI and CV risks`,
          risk: 'medium',
          ageRelated: true
        };
      }
      
      if (patientAge < 18 && medicationCode === '1191') {
        // Aspirin in children (Reye's syndrome risk)
        return {
          message: 'Aspirin should be avoided in patients <18 years due to Reye\'s syndrome risk',
          risk: 'critical',
          ageRelated: true
        };
      }
    }

    return null; // Dose appears safe
  }

  /**
   * Check if medication requires duration specification
   * @param {Object} medication - FHIR MedicationRequest
   * @returns {boolean} True if duration is required
   */
  requiresDuration(medication) {
    const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
    
    // Medications that require duration specification
    const requiresDurationCodes = [
      // Antibiotics (must have defined treatment duration)
      '723', '2670', '7984', '18631', // Amoxicillin, Cephalexin, Azithromycin, Clindamycin
      
      // Corticosteroids (require tapering schedule)
      '5492', '6918', '202991', // Prednisone, Prednisolone, Methylprednisolone
      
      // Controlled substances (must have defined duration)
      '7052', '7804', '161', // Oxycodone, Tramadol, Acetaminophen w/ codeine
      
      // Anticoagulants (require monitoring duration)
      '11289', '32968', // Warfarin, Rivaroxaban
      
      // Proton pump inhibitors (should not be indefinite without indication)
      '7646', '40790', '54577' // Omeprazole, Pantoprazole, Esomeprazole
    ];

    return requiresDurationCodes.includes(medicationCode);
  }

  /**
   * Get refill history for a medication
   * @param {string} medicationId - FHIR MedicationRequest ID
   * @returns {Object} Refill history data
   */
  async getRefillHistory(medicationId) {
    try {
      // This would typically query MedicationDispense resources
      // Since MedicationDispense is not available, simulate based on MedicationRequest
      const medication = await fhirClient.read('MedicationRequest', medicationId);
      
      if (!medication) {
        return {
          refillsUsed: 0,
          refillsAllowed: medication?.dispenseRequest?.numberOfRepeatsAllowed || 0,
          lastRefillDate: null,
          adherenceEstimate: null
        };
      }

      const refillsAllowed = medication.dispenseRequest?.numberOfRepeatsAllowed || 0;
      const authoredDate = new Date(medication.authoredOn);
      const daysSinceAuthor = Math.floor((new Date() - authoredDate) / (24 * 60 * 60 * 1000));
      
      // Estimate refills used based on days supply and time elapsed
      const daysSupply = medication.dispenseRequest?.expectedSupplyDuration?.value || 30;
      const estimatedRefillsUsed = Math.max(0, Math.floor(daysSinceAuthor / daysSupply) - 1);
      
      // Calculate adherence estimate (simplified)
      const expectedRefills = Math.floor(daysSinceAuthor / daysSupply);
      const adherenceEstimate = expectedRefills > 0 ? 
        Math.min(1.0, estimatedRefillsUsed / expectedRefills) : 1.0;

      return {
        refillsUsed: Math.min(estimatedRefillsUsed, refillsAllowed),
        refillsAllowed,
        lastRefillDate: estimatedRefillsUsed > 0 ? 
          new Date(authoredDate.getTime() + (estimatedRefillsUsed * daysSupply * 24 * 60 * 60 * 1000)).toISOString() : 
          null,
        adherenceEstimate,
        daysSupply,
        daysSinceAuthor
      };
    } catch (error) {
      return {
        refillsUsed: 0,
        refillsAllowed: 0,
        lastRefillDate: null,
        adherenceEstimate: null
      };
    }
  }

  /**
   * Check if medication requires adverse effect monitoring
   * @param {Object} medication - FHIR MedicationRequest
   * @returns {boolean} True if monitoring is required
   */
  requiresAdverseEffectMonitoring(medication) {
    const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
    
    // Medications that require adverse effect monitoring
    const monitoringRequiredCodes = [
      // Cardiovascular medications
      '18867', '36567', '83367', // Atorvastatin, Simvastatin, Rosuvastatin (liver function)
      '29046', '50166', '18998', // Lisinopril, Enalapril, Captopril (kidney function, hyperkalemia)
      '11289', '32968', '110942', // Warfarin, Rivaroxaban, Apixaban (bleeding)
      
      // Diabetes medications
      '6809', '60548', '274783', // Metformin (lactic acidosis), Glyburide (hypoglycemia), Insulin
      
      // Psychiatric medications
      '115698', '2556', '6929', // Sertraline, Fluoxetine, Lithium (mood, suicidality)
      
      // Antibiotics with serious adverse effects
      '18631', '2551', '10395', // Clindamycin (C. diff), Fluoroquinolones (tendon rupture)
      
      // Chemotherapy and immunosuppressants
      '6851', '42316', // Methotrexate, Azathioprine (bone marrow suppression)
      
      // Anticonvulsants
      '28439', '25480', '2002', // Phenytoin, Carbamazepine, Valproic acid (hepatotoxicity)
      
      // Corticosteroids (long-term)
      '5492', '6918', // Prednisone, Prednisolone (bone density, glucose, infections)
      
      // NSAIDs (long-term)
      '5640', '3355', '4815' // Ibuprofen, Naproxen, Celecoxib (GI, renal, CV)
    ];

    return monitoringRequiredCodes.includes(medicationCode);
  }

  /**
   * Check if duration is specified for a medication
   * @param {Object} medication - FHIR MedicationRequest
   * @returns {boolean} True if duration is specified
   */
  hasDurationSpecified(medication) {
    return medication.dosageInstruction?.some(dosage => 
      dosage.timing?.repeat?.boundsDuration ||
      dosage.timing?.repeat?.boundsRange ||
      dosage.timing?.repeat?.boundsPeriod ||
      dosage.timing?.repeat?.count ||
      dosage.timing?.repeat?.countMax
    ) || false;
  }

  /**
   * Check if patient has early refill pattern
   */
  hasEarlyRefillPattern(refillHistory) {
    if (!refillHistory || !refillHistory.refills || refillHistory.refills.length < 3) {
      return false;
    }

    // Look for pattern of refills requested before 75% of days supply is reached
    let earlyRefillCount = 0;
    for (const refill of refillHistory.refills) {
      const daysSinceLastFill = refill.daysSinceLastFill || 0;
      const expectedDays = refill.daysSupply || 30;
      
      if (daysSinceLastFill < (expectedDays * 0.75)) {
        earlyRefillCount++;
      }
    }

    // Flag if more than 50% of refills are early
    return earlyRefillCount / refillHistory.refills.length > 0.5;
  }

  /**
   * Check if medication requires follow-up after discontinuation
   */
  requiresFollowUpAfterDiscontinuation(medication, discontinuationData) {
    const medicationName = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    
    // Medications that require post-discontinuation monitoring
    const followUpRequired = [
      'warfarin', 'coumadin', 'phenytoin', 'dilantin', 'lithium',
      'digoxin', 'amiodarone', 'methotrexate', 'carbamazepine',
      'valproic acid', 'tacrolimus', 'cyclosporine'
    ];

    const requiresFollowUp = followUpRequired.some(med => medicationName.includes(med));
    
    // Also check if discontinuation was due to adverse effects
    const adverseDiscontinuation = discontinuationData?.reason?.toLowerCase().includes('adverse') ||
                                 discontinuationData?.reason?.toLowerCase().includes('side effect');

    return requiresFollowUp || adverseDiscontinuation;
  }

  /**
   * Check if patient has post-discontinuation follow-up documented
   */
  async hasPostDiscontinuationFollowUp(medicationId) {
    // In a real implementation, this would check for follow-up appointments or lab orders
    // For now, return false to indicate follow-up may be needed
    return false;
  }

  /**
   * Check if adverse effect tracking is documented for medication
   */
  async hasAdverseEffectTracking(medicationId) {
    // In a real implementation, this would check for documented adverse effect monitoring
    // Check for Observation resources related to adverse effects
    return false; // Conservative approach - assume no tracking unless documented
  }

  /**
   * Check if medication requires patient education
   */
  requiresPatientEducation(medication) {
    const medicationName = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    
    // Medications that require specific patient education
    const educationRequired = [
      'warfarin', 'insulin', 'metformin', 'lithium', 'phenytoin',
      'carbamazepine', 'valproic acid', 'amiodarone', 'digoxin',
      'methotrexate', 'prednisone', 'prednisolone', 'inhaler',
      'nitroglycerin', 'epinephrine', 'epipen'
    ];

    // Check if this is a controlled substance (also requires education)
    const isControlled = this.isControlledSubstance(medication);
    
    // Check if medication name contains any education-required medications
    const requiresEducation = educationRequired.some(med => medicationName.includes(med));
    
    return requiresEducation || isControlled;
  }

  clearCache(patientId = null) {
    if (patientId) {
      this.verificationCache.delete(patientId);
    } else {
      this.verificationCache.clear();
    }
  }
}

// Export singleton instance
export const clinicalSafetyVerifier = new ClinicalSafetyVerifier();