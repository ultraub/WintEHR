/**
 * Lab-to-Care Integration Service
 * Links lab results to care recommendations and treatment adjustments
 */

import { fhirClient } from './fhirClient';
import { cdsHooksClient } from './cdsHooksClient';
import { resultsManagementService } from './resultsManagementService';
import { REFERENCE_RANGES, getAdjustedReferenceRange } from '../utils/labReferenceRanges';

class LabToCareIntegrationService {
  constructor() {
    // Lab monitoring protocols for chronic conditions
    this.monitoringProtocols = {
      diabetes: {
        name: 'Diabetes Monitoring Protocol',
        conditions: ['diabetes-mellitus', 'type-2-diabetes', 'type-1-diabetes'],
        labTests: [
          { code: '4548-4', name: 'HbA1c', frequency: 90, unit: 'days', target: '<7.0' },
          { code: '2339-0', name: 'Glucose', frequency: 7, unit: 'days', target: '70-130 mg/dL' },
          { code: '38483-4', name: 'Creatinine', frequency: 365, unit: 'days' },
          { code: '14749-6', name: 'Glucose, fasting', frequency: 90, unit: 'days' }
        ],
        treatmentThresholds: {
          '4548-4': { // HbA1c
            optimal: { max: 7.0, action: 'Continue current therapy' },
            suboptimal: { min: 7.0, max: 8.0, action: 'Consider therapy intensification' },
            poor: { min: 8.0, action: 'Intensify therapy, add medication' }
          }
        }
      },
      hypertension: {
        name: 'Hypertension Monitoring Protocol',
        conditions: ['hypertension', 'essential-hypertension'],
        labTests: [
          { code: '38483-4', name: 'Creatinine', frequency: 365, unit: 'days' },
          { code: '2947-0', name: 'Sodium', frequency: 365, unit: 'days' },
          { code: '6298-4', name: 'Potassium', frequency: 365, unit: 'days' },
          { code: '2089-1', name: 'LDL Cholesterol', frequency: 365, unit: 'days' }
        ],
        treatmentThresholds: {
          '6298-4': { // Potassium
            low: { max: 3.5, action: 'Consider potassium supplementation or medication adjustment' },
            high: { min: 5.5, action: 'Review ACE/ARB dosing, consider diuretic' }
          }
        }
      },
      'chronic-kidney-disease': {
        name: 'CKD Monitoring Protocol',
        conditions: ['chronic-kidney-disease', 'ckd'],
        labTests: [
          { code: '38483-4', name: 'Creatinine', frequency: 90, unit: 'days' },
          { code: '6299-2', name: 'BUN', frequency: 90, unit: 'days' },
          { code: '6298-4', name: 'Potassium', frequency: 90, unit: 'days' },
          { code: '2777-1', name: 'Phosphorus', frequency: 90, unit: 'days' },
          { code: '49765-1', name: 'Calcium', frequency: 90, unit: 'days' },
          { code: '718-7', name: 'Hemoglobin', frequency: 90, unit: 'days' }
        ],
        treatmentThresholds: {
          '718-7': { // Hemoglobin
            low: { max: 10.0, action: 'Consider erythropoiesis-stimulating agent' }
          },
          '2777-1': { // Phosphorus
            high: { min: 4.5, action: 'Start phosphate binder' }
          }
        }
      },
      'thyroid-disease': {
        name: 'Thyroid Disease Monitoring Protocol',
        conditions: ['hypothyroidism', 'hyperthyroidism', 'thyroid-disease'],
        labTests: [
          { code: '3051-0', name: 'TSH', frequency: 180, unit: 'days' },
          { code: '3053-6', name: 'Free T4', frequency: 180, unit: 'days' }
        ],
        treatmentThresholds: {
          '3051-0': { // TSH
            low: { max: 0.4, action: 'Reduce thyroid hormone dose' },
            high: { min: 4.0, action: 'Increase thyroid hormone dose' }
          }
        }
      },
      'liver-disease': {
        name: 'Liver Disease Monitoring Protocol',
        conditions: ['hepatitis', 'cirrhosis', 'liver-disease'],
        labTests: [
          { code: '1742-6', name: 'ALT', frequency: 90, unit: 'days' },
          { code: '1920-8', name: 'AST', frequency: 90, unit: 'days' },
          { code: '1975-2', name: 'Total Bilirubin', frequency: 90, unit: 'days' },
          { code: '1751-7', name: 'Albumin', frequency: 90, unit: 'days' },
          { code: '6301-6', name: 'INR', frequency: 90, unit: 'days' }
        ],
        treatmentThresholds: {
          '1751-7': { // Albumin
            low: { max: 3.5, action: 'Consider nutritional support, manage ascites' }
          }
        }
      }
    };

    // Diagnostic reasoning patterns
    this.diagnosticPatterns = {
      'anemia-workup': {
        trigger: { code: '718-7', condition: 'low', threshold: 12.0 },
        additionalTests: [
          { code: '2601-3', name: 'Magnesium' },
          { code: '1649-3', name: 'Vitamin B12' },
          { code: '2132-9', name: 'Folate' },
          { code: '14723-1', name: 'Ferritin' },
          { code: '2498-4', name: 'Iron' }
        ],
        reasoning: 'Low hemoglobin detected. Recommend anemia workup to determine etiology.'
      },
      'renal-function-decline': {
        trigger: { code: '38483-4', condition: 'trend-increase', percentChange: 25 },
        additionalTests: [
          { code: '2160-0', name: 'Creatinine clearance' },
          { code: '14682-9', name: 'Microalbumin' },
          { code: '5804-0', name: 'Protein, urine' }
        ],
        reasoning: 'Significant increase in creatinine. Recommend further renal function assessment.'
      },
      'thyroid-dysfunction': {
        trigger: { code: '3051-0', condition: 'abnormal' },
        additionalTests: [
          { code: '3053-6', name: 'Free T4' },
          { code: '3052-8', name: 'Free T3' },
          { code: '8086-1', name: 'Thyroid peroxidase antibody' }
        ],
        reasoning: 'Abnormal TSH detected. Recommend complete thyroid panel.'
      }
    };
  }

  /**
   * Generate care recommendations based on lab results
   */
  async generateCareRecommendations(patientId, observations) {
    try {
      const recommendations = [];
      
      // Get patient conditions for context
      const conditions = await this.getPatientConditions(patientId);
      
      // Check each observation for care implications
      for (const observation of observations) {
        // Check critical values
        const criticalCheck = resultsManagementService.checkCriticalValue(observation);
        if (criticalCheck.isCritical) {
          recommendations.push(this.generateCriticalValueRecommendation(observation, criticalCheck));
        }
        
        // Check monitoring protocols
        const protocolRecommendations = await this.checkMonitoringProtocols(
          observation,
          conditions,
          patientId
        );
        recommendations.push(...protocolRecommendations);
        
        // Check diagnostic patterns
        const diagnosticRecommendations = await this.checkDiagnosticPatterns(
          observation,
          observations,
          patientId
        );
        recommendations.push(...diagnosticRecommendations);
      }
      
      // Deduplicate recommendations
      return this.deduplicateRecommendations(recommendations);
      
    } catch (error) {
      console.error('Error generating care recommendations:', error);
      return [];
    }
  }

  /**
   * Check if lab results trigger any monitoring protocol actions
   */
  async checkMonitoringProtocols(observation, patientConditions, patientId) {
    const recommendations = [];
    const loincCode = observation.code?.coding?.find(c => c.system === 'http://loinc.org')?.code;
    
    if (!loincCode || !observation.valueQuantity?.value) return recommendations;
    
    // Check each monitoring protocol
    for (const [protocolId, protocol] of Object.entries(this.monitoringProtocols)) {
      // Check if patient has relevant condition
      const hasCondition = patientConditions.some(condition => 
        protocol.conditions.some(pc => 
          condition.code?.coding?.some(coding => 
            coding.code?.toLowerCase().includes(pc) ||
            coding.display?.toLowerCase().includes(pc)
          )
        )
      );
      
      if (!hasCondition) continue;
      
      // Check if this lab test has treatment thresholds
      const thresholds = protocol.treatmentThresholds[loincCode];
      if (!thresholds) continue;
      
      const value = observation.valueQuantity.value;
      
      // Check each threshold
      for (const [level, threshold] of Object.entries(thresholds)) {
        let triggered = false;
        
        if (threshold.min !== undefined && threshold.max !== undefined) {
          triggered = value >= threshold.min && value <= threshold.max;
        } else if (threshold.min !== undefined) {
          triggered = value >= threshold.min;
        } else if (threshold.max !== undefined) {
          triggered = value <= threshold.max;
        }
        
        if (triggered) {
          recommendations.push({
            type: 'treatment-adjustment',
            priority: level === 'poor' || level === 'low' || level === 'high' ? 'high' : 'medium',
            protocol: protocol.name,
            test: observation.code?.text || observation.code?.coding?.[0]?.display,
            value: `${value} ${observation.valueQuantity.unit}`,
            action: threshold.action,
            reasoning: `Lab value in ${level} range for ${protocol.name}`,
            relatedObservationId: observation.id
          });
        }
      }
      
      // Check if other tests in protocol are due
      const monitoringRecommendations = await this.checkMonitoringSchedule(
        protocol,
        patientId,
        protocolId
      );
      recommendations.push(...monitoringRecommendations);
    }
    
    return recommendations;
  }

  /**
   * Check if diagnostic patterns are triggered
   */
  async checkDiagnosticPatterns(observation, allObservations, patientId) {
    const recommendations = [];
    const loincCode = observation.code?.coding?.find(c => c.system === 'http://loinc.org')?.code;
    
    if (!loincCode || !observation.valueQuantity?.value) return recommendations;
    
    for (const [patternId, pattern] of Object.entries(this.diagnosticPatterns)) {
      if (pattern.trigger.code !== loincCode) continue;
      
      let triggered = false;
      const value = observation.valueQuantity.value;
      
      switch (pattern.trigger.condition) {
        case 'low':
          triggered = value < pattern.trigger.threshold;
          break;
        case 'high':
          triggered = value > pattern.trigger.threshold;
          break;
        case 'abnormal':
          const range = REFERENCE_RANGES[loincCode];
          if (range) {
            triggered = value < range.low || value > range.high;
          }
          break;
        case 'trend-increase':
          // Check trend over last 3 results
          const trends = await this.calculateTrend(patientId, loincCode, 3);
          if (trends.percentChange) {
            triggered = trends.percentChange >= pattern.trigger.percentChange;
          }
          break;
      }
      
      if (triggered) {
        recommendations.push({
          type: 'diagnostic-workup',
          priority: 'medium',
          pattern: patternId,
          test: observation.code?.text || observation.code?.coding?.[0]?.display,
          value: `${value} ${observation.valueQuantity.unit}`,
          additionalTests: pattern.additionalTests,
          reasoning: pattern.reasoning,
          relatedObservationId: observation.id
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Generate recommendation for critical value
   */
  generateCriticalValueRecommendation(observation, criticalCheck) {
    return {
      type: 'critical-value',
      priority: 'urgent',
      test: observation.code?.text || observation.code?.coding?.[0]?.display,
      value: observation.valueQuantity ? 
        `${observation.valueQuantity.value} ${observation.valueQuantity.unit}` : 
        'See result',
      message: criticalCheck.message,
      action: this.getCriticalValueAction(observation, criticalCheck),
      relatedObservationId: observation.id
    };
  }

  /**
   * Get recommended action for critical value
   */
  getCriticalValueAction(observation, criticalCheck) {
    const loincCode = observation.code?.coding?.find(c => c.system === 'http://loinc.org')?.code;
    
    // Specific critical value actions
    const criticalActions = {
      '6298-4': { // Potassium
        low: 'Consider IV potassium replacement, cardiac monitoring',
        high: 'Consider calcium gluconate, insulin/glucose, kayexalate'
      },
      '2947-0': { // Sodium
        low: 'Fluid restriction, consider hypertonic saline if severe',
        high: 'Gradual correction with hypotonic fluids'
      },
      '2339-0': { // Glucose
        low: 'Administer glucose (oral if conscious, IV if not)',
        high: 'Initiate insulin therapy, check for ketones'
      },
      '718-7': { // Hemoglobin
        low: 'Consider transfusion if symptomatic or Hgb <7'
      },
      '777-3': { // Platelets
        low: 'Bleeding precautions, consider platelet transfusion if <10k'
      }
    };
    
    const actions = criticalActions[loincCode];
    if (actions) {
      return actions[criticalCheck.type] || actions.low || 'Immediate clinical evaluation required';
    }
    
    return 'Immediate clinical evaluation and intervention required';
  }

  /**
   * Check monitoring schedule for a protocol
   */
  async checkMonitoringSchedule(protocol, patientId, protocolId) {
    const recommendations = [];
    
    for (const test of protocol.labTests) {
      // Get last result for this test
      const lastResult = await this.getLastLabResult(patientId, test.code);
      
      if (!lastResult) {
        // Never done - recommend ordering
        recommendations.push({
          type: 'monitoring-due',
          priority: 'medium',
          protocol: protocol.name,
          test: test.name,
          action: `Order ${test.name} - baseline for ${protocol.name}`,
          reasoning: 'No previous result found',
          loincCode: test.code
        });
      } else {
        // Check if due based on frequency
        const lastDate = new Date(lastResult.effectiveDateTime || lastResult.issued);
        const daysElapsed = Math.floor((Date.now() - lastDate) / (1000 * 60 * 60 * 24));
        
        if (daysElapsed >= test.frequency) {
          recommendations.push({
            type: 'monitoring-due',
            priority: daysElapsed > test.frequency * 1.5 ? 'high' : 'medium',
            protocol: protocol.name,
            test: test.name,
            action: `Order ${test.name} - due for ${protocol.name} monitoring`,
            reasoning: `Last done ${daysElapsed} days ago (due every ${test.frequency} days)`,
            loincCode: test.code,
            lastValue: lastResult.valueQuantity ? 
              `${lastResult.valueQuantity.value} ${lastResult.valueQuantity.unit}` : 
              'N/A'
          });
        }
      }
    }
    
    return recommendations;
  }

  /**
   * Get patient conditions
   */
  async getPatientConditions(patientId) {
    try {
      const response = await fhirClient.search('Condition', {
        patient: patientId,
        'clinical-status': 'active',
        _count: 100
      });
      
      return response.entry?.map(e => e.resource) || [];
    } catch (error) {
      console.error('Error fetching patient conditions:', error);
      return [];
    }
  }

  /**
   * Get last lab result for a specific test
   */
  async getLastLabResult(patientId, loincCode) {
    try {
      const response = await fhirClient.search('Observation', {
        patient: patientId,
        code: `http://loinc.org|${loincCode}`,
        _sort: '-date',
        _count: 1
      });
      
      return response.entry?.[0]?.resource;
    } catch (error) {
      console.error('Error fetching last lab result:', error);
      return null;
    }
  }

  /**
   * Calculate trend for a lab value
   */
  async calculateTrend(patientId, loincCode, count = 3) {
    try {
      const response = await fhirClient.search('Observation', {
        patient: patientId,
        code: `http://loinc.org|${loincCode}`,
        _sort: '-date',
        _count: count
      });
      
      const results = response.entry?.map(e => e.resource) || [];
      if (results.length < 2) return { percentChange: null };
      
      const latest = results[0].valueQuantity?.value;
      const previous = results[results.length - 1].valueQuantity?.value;
      
      if (!latest || !previous) return { percentChange: null };
      
      const percentChange = ((latest - previous) / previous) * 100;
      
      return {
        percentChange,
        trend: percentChange > 10 ? 'increasing' : percentChange < -10 ? 'decreasing' : 'stable',
        values: results.map(r => ({
          date: r.effectiveDateTime || r.issued,
          value: r.valueQuantity?.value
        }))
      };
    } catch (error) {
      console.error('Error calculating trend:', error);
      return { percentChange: null };
    }
  }

  /**
   * Create CDS rule for lab-based treatment adjustment
   */
  async createLabBasedCDSRule(ruleConfig) {
    try {
      const cdsRule = {
        id: `lab-rule-${Date.now()}`,
        hook: 'patient-view',
        title: ruleConfig.title,
        description: ruleConfig.description,
        conditions: [
          {
            type: 'lab_result',
            loincCode: ruleConfig.loincCode,
            operator: ruleConfig.operator,
            value: ruleConfig.value
          }
        ],
        cards: [
          {
            summary: ruleConfig.summary,
            detail: ruleConfig.detail,
            indicator: ruleConfig.priority === 'urgent' ? 'critical' : 'warning',
            suggestions: ruleConfig.suggestions || []
          }
        ]
      };
      
      // Use existing CDS hooks service to create the rule
      return await cdsHooksClient.createHook(cdsRule);
    } catch (error) {
      console.error('Error creating lab-based CDS rule:', error);
      throw error;
    }
  }

  /**
   * Update care plan based on lab results
   */
  async updateCarePlanWithLabResults(carePlanId, labRecommendations) {
    try {
      // Get existing care plan
      const carePlan = await fhirClient.read('CarePlan', carePlanId);
      
      // Add activities based on recommendations
      const newActivities = labRecommendations.map(rec => ({
        detail: {
          kind: 'Task',
          code: {
            text: rec.action
          },
          status: 'not-started',
          description: rec.reasoning,
          scheduledTiming: {
            repeat: {
              frequency: 1,
              period: 1,
              periodUnit: 'd'
            }
          }
        }
      }));
      
      // Update care plan
      carePlan.activity = [...(carePlan.activity || []), ...newActivities];
      carePlan.note = [
        ...(carePlan.note || []),
        {
          text: `Care plan updated based on lab results: ${new Date().toISOString()}`
        }
      ];
      
      return await fhirClient.update('CarePlan', carePlanId, carePlan);
    } catch (error) {
      console.error('Error updating care plan:', error);
      throw error;
    }
  }

  /**
   * Track medication effectiveness using lab values
   */
  async trackMedicationEffectiveness(patientId, medicationRequestId, targetLabs) {
    try {
      const effectiveness = {
        medicationRequestId,
        evaluationDate: new Date().toISOString(),
        targets: []
      };
      
      for (const target of targetLabs) {
        const result = await this.getLastLabResult(patientId, target.loincCode);
        
        if (result && result.valueQuantity) {
          const value = result.valueQuantity.value;
          const inRange = this.checkIfInTargetRange(value, target);
          
          effectiveness.targets.push({
            test: target.name,
            loincCode: target.loincCode,
            value: `${value} ${result.valueQuantity.unit}`,
            targetRange: target.targetRange,
            inRange,
            trend: await this.calculateTrend(patientId, target.loincCode, 3)
          });
        }
      }
      
      // Calculate overall effectiveness
      const targetsInRange = effectiveness.targets.filter(t => t.inRange).length;
      effectiveness.overallEffectiveness = targetsInRange / effectiveness.targets.length;
      effectiveness.recommendation = this.generateEffectivenessRecommendation(effectiveness);
      
      return effectiveness;
    } catch (error) {
      console.error('Error tracking medication effectiveness:', error);
      throw error;
    }
  }

  /**
   * Check if value is in target range
   */
  checkIfInTargetRange(value, target) {
    if (target.targetRange.includes('-')) {
      const [min, max] = target.targetRange.split('-').map(v => parseFloat(v));
      return value >= min && value <= max;
    } else if (target.targetRange.includes('<')) {
      const max = parseFloat(target.targetRange.replace('<', ''));
      return value < max;
    } else if (target.targetRange.includes('>')) {
      const min = parseFloat(target.targetRange.replace('>', ''));
      return value > min;
    }
    return false;
  }

  /**
   * Generate effectiveness recommendation
   */
  generateEffectivenessRecommendation(effectiveness) {
    if (effectiveness.overallEffectiveness >= 0.8) {
      return 'Medication is effective. Continue current therapy.';
    } else if (effectiveness.overallEffectiveness >= 0.5) {
      return 'Medication is partially effective. Consider dose adjustment or add-on therapy.';
    } else {
      return 'Medication is not achieving targets. Consider alternative therapy.';
    }
  }

  /**
   * Share lab results with care team
   */
  async shareLabResultsWithCareTeam(observationIds, careTeamId, notes) {
    try {
      // Create a Communication resource
      const communication = {
        resourceType: 'Communication',
        status: 'completed',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/communication-category',
            code: 'notification',
            display: 'Notification'
          }]
        }],
        priority: 'routine',
        subject: {
          reference: `CareTeam/${careTeamId}`
        },
        topic: {
          text: 'Lab Results Sharing'
        },
        sent: new Date().toISOString(),
        payload: observationIds.map(id => ({
          contentReference: {
            reference: `Observation/${id}`
          }
        }))
      };
      
      if (notes) {
        communication.note = [{
          text: notes,
          time: new Date().toISOString()
        }];
      }
      
      return await fhirClient.create('Communication', communication);
    } catch (error) {
      console.error('Error sharing lab results with care team:', error);
      throw error;
    }
  }

  /**
   * Deduplicate recommendations
   */
  deduplicateRecommendations(recommendations) {
    const seen = new Set();
    return recommendations.filter(rec => {
      const key = `${rec.type}-${rec.action}-${rec.loincCode || rec.test}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const labToCareIntegrationService = new LabToCareIntegrationService();