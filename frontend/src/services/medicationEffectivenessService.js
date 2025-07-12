/**
 * Medication Effectiveness Monitoring Service
 * Handles tracking medication effectiveness and generating monitoring prompts
 */

import { fhirClient } from './fhirClient';
import { format, addDays, addWeeks, addMonths, parseISO, isAfter, differenceInDays } from 'date-fns';

class MedicationEffectivenessService {
  constructor() {
    this.effectivenessCache = new Map();
  }

  /**
   * Effectiveness monitoring parameters by medication class
   */
  MONITORING_PARAMETERS = {
    // Cardiovascular
    'antihypertensive': {
      targetConditions: ['hypertension', 'high blood pressure'],
      monitoringMetrics: ['blood_pressure', 'heart_rate'],
      followUpIntervals: { initial: 14, ongoing: 84 }, // 2 weeks, 12 weeks
      therapeuticGoals: {
        systolic_bp: { target: 130, range: [120, 140] },
        diastolic_bp: { target: 80, range: [70, 90] }
      },
      assessmentQuestions: [
        'Any dizziness or lightheadedness?',
        'Experiencing fatigue or weakness?',
        'Any swelling in legs or ankles?'
      ]
    },
    'statin': {
      targetConditions: ['hyperlipidemia', 'high cholesterol'],
      monitoringMetrics: ['cholesterol_total', 'ldl', 'hdl', 'alt', 'ast'],
      followUpIntervals: { initial: 42, ongoing: 182 }, // 6 weeks, 6 months
      therapeuticGoals: {
        ldl: { target: 100, range: [70, 130] },
        total_cholesterol: { target: 200, range: [150, 240] }
      },
      assessmentQuestions: [
        'Any muscle pain, tenderness, or weakness?',
        'Experiencing unusual fatigue?',
        'Any dark-colored urine?'
      ]
    },
    // Diabetes
    'antidiabetic': {
      targetConditions: ['diabetes', 'diabetes mellitus'],
      monitoringMetrics: ['glucose', 'hba1c', 'weight'],
      followUpIntervals: { initial: 14, ongoing: 91 }, // 2 weeks, 13 weeks
      therapeuticGoals: {
        hba1c: { target: 7.0, range: [6.5, 8.0] },
        fasting_glucose: { target: 100, range: [80, 130] }
      },
      assessmentQuestions: [
        'How is your blood sugar control?',
        'Any episodes of low blood sugar?',
        'Changes in appetite or weight?',
        'Increased thirst or urination?'
      ]
    },
    // Mental Health
    'antidepressant': {
      targetConditions: ['depression', 'anxiety', 'major depressive disorder'],
      monitoringMetrics: ['mood_assessment', 'phq9_score', 'gad7_score'],
      followUpIntervals: { initial: 7, ongoing: 28 }, // 1 week, 4 weeks
      therapeuticGoals: {
        phq9_score: { target: 5, range: [0, 9] },
        mood_improvement: { target: 'improved', range: ['stable', 'improved'] }
      },
      assessmentQuestions: [
        'How has your mood been?',
        'Any changes in sleep patterns?',
        'Energy levels compared to before treatment?',
        'Any thoughts of self-harm?',
        'Side effects affecting daily activities?'
      ]
    },
    // Pain Management
    'analgesic': {
      targetConditions: ['chronic pain', 'arthritis', 'back pain'],
      monitoringMetrics: ['pain_score', 'functional_status'],
      followUpIntervals: { initial: 7, ongoing: 28 }, // 1 week, 4 weeks
      therapeuticGoals: {
        pain_score: { target: 3, range: [0, 4] },
        functional_improvement: { target: 'improved', range: ['stable', 'improved'] }
      },
      assessmentQuestions: [
        'Current pain level (0-10 scale)?',
        'How well can you perform daily activities?',
        'Quality of sleep affected by pain?',
        'Any side effects from pain medication?'
      ]
    },
    // Antibiotics
    'antibiotic': {
      targetConditions: ['infection', 'bacterial infection'],
      monitoringMetrics: ['symptoms', 'temperature', 'wbc_count'],
      followUpIntervals: { initial: 3, ongoing: 7 }, // 3 days, 1 week
      therapeuticGoals: {
        symptom_resolution: { target: 'resolved', range: ['improving', 'resolved'] },
        temperature: { target: 98.6, range: [97.0, 99.5] }
      },
      assessmentQuestions: [
        'Are infection symptoms improving?',
        'Any fever or chills?',
        'Completing the full antibiotic course?',
        'Any digestive side effects?'
      ]
    }
  };

  /**
   * Create effectiveness monitoring plan for a medication
   */
  async createMonitoringPlan(medicationRequest) {
    try {
      const medicationClass = this.identifyMedicationClass(medicationRequest);
      const parameters = this.MONITORING_PARAMETERS[medicationClass];
      
      if (!parameters) {
        // Create basic monitoring plan for unclassified medications
        return this.createBasicMonitoringPlan(medicationRequest);
      }

      const monitoringPlan = {
        resourceType: 'CarePlan',
        status: 'active',
        intent: 'plan',
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/careplan-category',
            code: 'assess-plan',
            display: 'Assessment and Plan of Treatment'
          }]
        }],
        title: `Medication Effectiveness Monitoring - ${medicationRequest.medicationCodeableConcept?.text || 'Unknown Medication'}`,
        description: `Monitoring plan to assess therapeutic effectiveness and safety`,
        subject: medicationRequest.subject,
        created: new Date().toISOString(),
        period: {
          start: new Date().toISOString(),
          // Default 6-month monitoring period
          end: addMonths(new Date(), 6).toISOString()
        },
        activity: this.buildMonitoringActivities(medicationRequest, parameters),
        extension: [{
          url: 'http://example.org/fhir/medication-monitoring',
          extension: [
            {
              url: 'originalMedication',
              valueReference: { reference: `MedicationRequest/${medicationRequest.id}` }
            },
            {
              url: 'medicationClass',
              valueString: medicationClass
            },
            {
              url: 'monitoringParameters',
              valueString: JSON.stringify(parameters)
            }
          ]
        }]
      };

      return await fhirClient.create('CarePlan', monitoringPlan);

    } catch (error) {
      console.error('Error creating monitoring plan:', error);
      throw error;
    }
  }

  /**
   * Build monitoring activities based on medication parameters
   */
  buildMonitoringActivities(medicationRequest, parameters) {
    const activities = [];
    const now = new Date();

    // Initial assessment activity
    activities.push({
      detail: {
        kind: 'Task',
        code: {
          coding: [{
            system: 'http://snomed.info/sct',
            code: '182836005',
            display: 'Review of medication'
          }]
        },
        status: 'not-started',
        description: 'Initial effectiveness assessment',
        scheduledTiming: {
          event: [addDays(now, parameters.followUpIntervals.initial).toISOString()]
        },
        extension: [{
          url: 'http://example.org/fhir/assessment-type',
          valueString: 'initial'
        }]
      }
    });

    // Ongoing assessment activities (quarterly for first year)
    for (let i = 1; i <= 4; i++) {
      const assessmentDate = addDays(now, parameters.followUpIntervals.ongoing * i);
      activities.push({
        detail: {
          kind: 'Task',
          code: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: '182836005',
              display: 'Review of medication'
            }]
          },
          status: 'not-started',
          description: `Ongoing effectiveness assessment #${i}`,
          scheduledTiming: {
            event: [assessmentDate.toISOString()]
          },
          extension: [{
            url: 'http://example.org/fhir/assessment-type',
            valueString: 'ongoing'
          }]
        }
      });
    }

    // Lab monitoring activities if required
    if (parameters.monitoringMetrics.some(metric => 
      ['cholesterol_total', 'ldl', 'hdl', 'hba1c', 'glucose', 'alt', 'ast', 'wbc_count'].includes(metric)
    )) {
      activities.push({
        detail: {
          kind: 'ServiceRequest',
          code: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: '108252007',
              display: 'Laboratory procedure'
            }]
          },
          status: 'not-started',
          description: 'Laboratory monitoring for medication effectiveness',
          scheduledTiming: {
            repeat: {
              frequency: 1,
              period: parameters.followUpIntervals.ongoing,
              periodUnit: 'd'
            }
          }
        }
      });
    }

    return activities;
  }

  /**
   * Generate effectiveness assessment prompts for a medication
   */
  async generateAssessmentPrompts(medicationRequestId) {
    try {
      const medicationRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      const medicationClass = this.identifyMedicationClass(medicationRequest);
      const parameters = this.MONITORING_PARAMETERS[medicationClass];

      if (!parameters) {
        return this.generateBasicAssessmentPrompts(medicationRequest);
      }

      // Get monitoring plan for this medication
      const monitoringPlan = await this.getMonitoringPlan(medicationRequestId);
      
      // Determine current assessment phase
      const daysSinceStart = differenceInDays(new Date(), parseISO(medicationRequest.authoredOn));
      const isInitialPhase = daysSinceStart <= parameters.followUpIntervals.initial;

      const prompts = {
        medicationId: medicationRequestId,
        medicationName: medicationRequest.medicationCodeableConcept?.text || 'Unknown Medication',
        assessmentPhase: isInitialPhase ? 'initial' : 'ongoing',
        daysSinceStart,
        nextAssessmentDue: this.calculateNextAssessmentDate(medicationRequest, parameters),
        therapeuticGoals: parameters.therapeuticGoals,
        assessmentQuestions: parameters.assessmentQuestions,
        monitoringMetrics: parameters.monitoringMetrics,
        targetConditions: parameters.targetConditions,
        urgencyLevel: this.determineUrgencyLevel(medicationRequest, parameters),
        recommendations: this.generateRecommendations(medicationRequest, parameters, daysSinceStart)
      };

      return prompts;

    } catch (error) {
      console.error('Error generating assessment prompts:', error);
      throw error;
    }
  }

  /**
   * Record effectiveness assessment results
   */
  async recordAssessmentResults(assessmentData) {
    try {
      const { medicationRequestId, responses, metrics, clinicalNotes, nextReviewDate } = assessmentData;

      // Create an Observation for the effectiveness assessment
      const effectivenessObservation = {
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'therapy',
            display: 'Therapy'
          }]
        }],
        code: {
          coding: [{
            system: 'http://example.org/medication-effectiveness-codes',
            code: 'medication-effectiveness-assessment',
            display: 'Medication Effectiveness Assessment'
          }]
        },
        subject: assessmentData.patientReference,
        effectiveDateTime: new Date().toISOString(),
        component: [
          {
            code: {
              coding: [{
                system: 'http://example.org/effectiveness-components',
                code: 'overall-effectiveness',
                display: 'Overall Effectiveness'
              }]
            },
            valueCodeableConcept: {
              coding: [{
                system: 'http://example.org/effectiveness-scale',
                code: assessmentData.overallEffectiveness,
                display: this.getEffectivenessDisplayName(assessmentData.overallEffectiveness)
              }]
            }
          },
          {
            code: {
              coding: [{
                system: 'http://example.org/effectiveness-components',
                code: 'side-effects',
                display: 'Side Effects Experienced'
              }]
            },
            valueBoolean: assessmentData.sideEffectsExperienced
          },
          {
            code: {
              coding: [{
                system: 'http://example.org/effectiveness-components',
                code: 'adherence-level',
                display: 'Medication Adherence'
              }]
            },
            valueCodeableConcept: {
              coding: [{
                system: 'http://example.org/adherence-scale',
                code: assessmentData.adherenceLevel,
                display: this.getAdherenceDisplayName(assessmentData.adherenceLevel)
              }]
            }
          }
        ],
        note: [{
          text: clinicalNotes || 'Medication effectiveness assessment completed',
          time: new Date().toISOString()
        }],
        extension: [{
          url: 'http://example.org/fhir/medication-assessment',
          extension: [
            {
              url: 'medicationReference',
              valueReference: { reference: `MedicationRequest/${medicationRequestId}` }
            },
            {
              url: 'assessmentResponses',
              valueString: JSON.stringify(responses)
            },
            {
              url: 'nextReviewDate',
              valueDateTime: nextReviewDate
            }
          ]
        }]
      };

      const savedObservation = await fhirClient.create('Observation', effectivenessObservation);

      // Update monitoring plan if needed
      await this.updateMonitoringPlan(medicationRequestId, assessmentData);

      return savedObservation;

    } catch (error) {
      console.error('Error recording assessment results:', error);
      throw error;
    }
  }

  /**
   * Get effectiveness monitoring alerts for a patient
   */
  async getEffectivenessAlerts(patientId) {
    try {
      // Search for active monitoring plans
      const carePlansResponse = await fhirClient.search('CarePlan', {
        patient: patientId,
        status: 'active',
        category: 'assess-plan',
        _count: 50
      });

      const monitoringPlans = carePlansResponse.resources || [];
      const alerts = [];

      for (const plan of monitoringPlans) {
        // Check if this is a medication monitoring plan
        const medicationExtension = plan.extension?.find(
          ext => ext.url === 'http://example.org/fhir/medication-monitoring'
        );

        if (!medicationExtension) continue;

        // Check for overdue assessments
        const overdueActivities = plan.activity?.filter(activity => {
          const scheduledDate = activity.detail?.scheduledTiming?.event?.[0];
          return scheduledDate && isAfter(new Date(), parseISO(scheduledDate)) &&
                 activity.detail?.status === 'not-started';
        });

        if (overdueActivities?.length > 0) {
          const medicationRef = medicationExtension.extension?.find(
            ext => ext.url === 'originalMedication'
          )?.valueReference?.reference;

          alerts.push({
            type: 'effectiveness-assessment-overdue',
            severity: 'medium',
            medicationReference: medicationRef,
            message: `Medication effectiveness assessment overdue`,
            daysOverdue: Math.max(...overdueActivities.map(activity => 
              differenceInDays(new Date(), parseISO(activity.detail.scheduledTiming.event[0]))
            )),
            carePlanId: plan.id,
            overdueActivities: overdueActivities.length
          });
        }

        // Check for medications without recent assessments
        const lastAssessment = await this.getLastAssessment(medicationRef?.split('/')[1]);
        if (lastAssessment && differenceInDays(new Date(), parseISO(lastAssessment.effectiveDateTime)) > 90) {
          alerts.push({
            type: 'effectiveness-assessment-stale',
            severity: 'low',
            medicationReference: medicationRef,
            message: `No recent effectiveness assessment`,
            daysSinceLastAssessment: differenceInDays(new Date(), parseISO(lastAssessment.effectiveDateTime)),
            carePlanId: plan.id
          });
        }
      }

      return alerts;

    } catch (error) {
      console.error('Error getting effectiveness alerts:', error);
      throw error;
    }
  }

  /**
   * Helper methods
   */
  identifyMedicationClass(medicationRequest) {
    const medicationText = medicationRequest.medicationCodeableConcept?.text?.toLowerCase() || '';
    const medicationCoding = medicationRequest.medicationCodeableConcept?.coding?.[0]?.display?.toLowerCase() || '';
    const fullText = `${medicationText} ${medicationCoding}`;

    // Simple classification based on medication name/description
    if (fullText.includes('lisinopril') || fullText.includes('amlodipine') || fullText.includes('losartan')) {
      return 'antihypertensive';
    }
    if (fullText.includes('atorvastatin') || fullText.includes('simvastatin') || fullText.includes('statin')) {
      return 'statin';
    }
    if (fullText.includes('metformin') || fullText.includes('insulin') || fullText.includes('glipizide')) {
      return 'antidiabetic';
    }
    if (fullText.includes('sertraline') || fullText.includes('fluoxetine') || fullText.includes('citalopram')) {
      return 'antidepressant';
    }
    if (fullText.includes('ibuprofen') || fullText.includes('acetaminophen') || fullText.includes('oxycodone')) {
      return 'analgesic';
    }
    if (fullText.includes('amoxicillin') || fullText.includes('azithromycin') || fullText.includes('antibiotic')) {
      return 'antibiotic';
    }

    return 'general'; // Default classification
  }

  createBasicMonitoringPlan(medicationRequest) {
    // Return a basic monitoring plan for unclassified medications
    return {
      medicationId: medicationRequest.id,
      monitoringType: 'basic',
      followUpIntervals: { initial: 30, ongoing: 90 },
      assessmentQuestions: [
        'How is the medication working for you?',
        'Are you experiencing any side effects?',
        'Are you taking the medication as prescribed?',
        'Any concerns about the medication?'
      ]
    };
  }

  generateBasicAssessmentPrompts(medicationRequest) {
    const daysSinceStart = differenceInDays(new Date(), parseISO(medicationRequest.authoredOn));
    
    return {
      medicationId: medicationRequest.id,
      medicationName: medicationRequest.medicationCodeableConcept?.text || 'Unknown Medication',
      assessmentPhase: daysSinceStart <= 30 ? 'initial' : 'ongoing',
      daysSinceStart,
      assessmentQuestions: [
        'How is the medication working for you?',
        'Are you experiencing any side effects?',
        'Are you taking the medication as prescribed?',
        'Any concerns about the medication?'
      ],
      urgencyLevel: 'routine',
      recommendations: ['Schedule follow-up in 4-6 weeks', 'Monitor for side effects']
    };
  }

  calculateNextAssessmentDate(medicationRequest, parameters) {
    const startDate = parseISO(medicationRequest.authoredOn);
    const daysSinceStart = differenceInDays(new Date(), startDate);
    
    if (daysSinceStart <= parameters.followUpIntervals.initial) {
      return addDays(startDate, parameters.followUpIntervals.initial).toISOString();
    } else {
      // Calculate next ongoing assessment
      const assessmentNumber = Math.ceil(daysSinceStart / parameters.followUpIntervals.ongoing);
      return addDays(startDate, parameters.followUpIntervals.ongoing * assessmentNumber).toISOString();
    }
  }

  determineUrgencyLevel(medicationRequest, parameters) {
    const daysSinceStart = differenceInDays(new Date(), parseISO(medicationRequest.authoredOn));
    const nextAssessment = parseISO(this.calculateNextAssessmentDate(medicationRequest, parameters));
    const daysUntilAssessment = differenceInDays(nextAssessment, new Date());

    if (daysUntilAssessment < 0) return 'overdue';
    if (daysUntilAssessment <= 3) return 'urgent';
    if (daysUntilAssessment <= 7) return 'soon';
    return 'routine';
  }

  generateRecommendations(medicationRequest, parameters, daysSinceStart) {
    const recommendations = [];
    
    if (daysSinceStart <= parameters.followUpIntervals.initial) {
      recommendations.push('Monitor for initial therapeutic response');
      recommendations.push('Assess for early side effects');
    } else {
      recommendations.push('Evaluate therapeutic goals achievement');
      recommendations.push('Consider dose optimization if needed');
    }

    if (parameters.monitoringMetrics.includes('blood_pressure')) {
      recommendations.push('Check blood pressure regularly');
    }
    if (parameters.monitoringMetrics.includes('cholesterol_total')) {
      recommendations.push('Schedule lipid panel');
    }
    if (parameters.monitoringMetrics.includes('hba1c')) {
      recommendations.push('Monitor HbA1c levels');
    }

    return recommendations;
  }

  async getMonitoringPlan(medicationRequestId) {
    try {
      const response = await fhirClient.search('CarePlan', {
        _profile: 'http://example.org/fhir/StructureDefinition/MedicationMonitoring',
        _count: 10
      });

      return (response.resources || []).find(plan => {
        const medicationExtension = plan.extension?.find(
          ext => ext.url === 'http://example.org/fhir/medication-monitoring'
        );
        const medicationRef = medicationExtension?.extension?.find(
          ext => ext.url === 'originalMedication'
        )?.valueReference?.reference;
        
        return medicationRef === `MedicationRequest/${medicationRequestId}`;
      });
    } catch (error) {
      console.error('Error getting monitoring plan:', error);
      return null;
    }
  }

  async getLastAssessment(medicationRequestId) {
    try {
      const response = await fhirClient.search('Observation', {
        code: 'medication-effectiveness-assessment',
        _count: 1,
        _sort: '-date'
      });

      return (response.resources || []).find(obs => {
        const medicationExtension = obs.extension?.find(
          ext => ext.url === 'http://example.org/fhir/medication-assessment'
        );
        const medicationRef = medicationExtension?.extension?.find(
          ext => ext.url === 'medicationReference'
        )?.valueReference?.reference;
        
        return medicationRef === `MedicationRequest/${medicationRequestId}`;
      });
    } catch (error) {
      console.error('Error getting last assessment:', error);
      return null;
    }
  }

  async updateMonitoringPlan(medicationRequestId, assessmentData) {
    try {
      const monitoringPlan = await this.getMonitoringPlan(medicationRequestId);
      if (!monitoringPlan) return;

      // Update plan based on assessment results
      const updatedPlan = {
        ...monitoringPlan,
        note: [
          ...(monitoringPlan.note || []),
          {
            text: `Assessment completed: ${assessmentData.overallEffectiveness}. Next review: ${format(parseISO(assessmentData.nextReviewDate), 'MMM d, yyyy')}`,
            time: new Date().toISOString()
          }
        ]
      };

      return await fhirClient.update('CarePlan', updatedPlan);
    } catch (error) {
      console.error('Error updating monitoring plan:', error);
    }
  }

  getEffectivenessDisplayName(code) {
    const map = {
      'excellent': 'Excellent Response',
      'good': 'Good Response', 
      'fair': 'Fair Response',
      'poor': 'Poor Response',
      'no-response': 'No Response',
      'worsened': 'Condition Worsened'
    };
    return map[code] || 'Unknown';
  }

  getAdherenceDisplayName(code) {
    const map = {
      'excellent': 'Taking as Prescribed',
      'good': 'Mostly Compliant',
      'fair': 'Occasionally Missing Doses',
      'poor': 'Frequently Missing Doses',
      'non-adherent': 'Not Taking Medication'
    };
    return map[code] || 'Unknown';
  }

  clearCache(patientId = null) {
    if (patientId) {
      this.effectivenessCache.delete(patientId);
    } else {
      this.effectivenessCache.clear();
    }
  }
}

// Export singleton instance
export const medicationEffectivenessService = new MedicationEffectivenessService();