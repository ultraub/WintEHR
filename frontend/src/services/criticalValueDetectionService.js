/**
 * Critical Value Detection Service
 * 
 * Provides automated critical value monitoring and alerting capabilities
 * for laboratory results using FHIR R4 value-quantity search parameters.
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';

class CriticalValueDetectionService {
  constructor() {
    this.criticalValueThresholds = new Map([
      // Glucose thresholds (LOINC: 2339-0)
      ['2339-0', [
        { operator: 'gt', value: 400, unit: 'mg/dL', severity: 'critical', description: 'Severe hyperglycemia', priority: 'immediate' },
        { operator: 'lt', value: 40, unit: 'mg/dL', severity: 'critical', description: 'Severe hypoglycemia', priority: 'immediate' },
        { operator: 'gt', value: 250, unit: 'mg/dL', severity: 'high', description: 'Hyperglycemia', priority: 'urgent' },
        { operator: 'lt', value: 70, unit: 'mg/dL', severity: 'high', description: 'Hypoglycemia', priority: 'urgent' }
      ]],
      
      // Hemoglobin thresholds (LOINC: 718-7)
      ['718-7', [
        { operator: 'lt', value: 6, unit: 'g/dL', severity: 'critical', description: 'Severe anemia', priority: 'immediate' },
        { operator: 'gt', value: 20, unit: 'g/dL', severity: 'critical', description: 'Severe polycythemia', priority: 'immediate' },
        { operator: 'lt', value: 8, unit: 'g/dL', severity: 'high', description: 'Moderate anemia', priority: 'urgent' },
        { operator: 'gt', value: 18, unit: 'g/dL', severity: 'high', description: 'Polycythemia', priority: 'urgent' }
      ]],
      
      // Creatinine thresholds (LOINC: 2160-0)
      ['2160-0', [
        { operator: 'gt', value: 4.0, unit: 'mg/dL', severity: 'critical', description: 'Severe renal dysfunction', priority: 'immediate' },
        { operator: 'gt', value: 2.0, unit: 'mg/dL', severity: 'high', description: 'Elevated creatinine', priority: 'urgent' },
        { operator: 'gt', value: 1.5, unit: 'mg/dL', severity: 'medium', description: 'Mild renal impairment', priority: 'routine' }
      ]],
      
      // Potassium thresholds (LOINC: 6298-4)
      ['6298-4', [
        { operator: 'gt', value: 6.5, unit: 'mEq/L', severity: 'critical', description: 'Severe hyperkalemia', priority: 'immediate' },
        { operator: 'lt', value: 2.5, unit: 'mEq/L', severity: 'critical', description: 'Severe hypokalemia', priority: 'immediate' },
        { operator: 'gt', value: 5.5, unit: 'mEq/L', severity: 'high', description: 'Hyperkalemia', priority: 'urgent' },
        { operator: 'lt', value: 3.0, unit: 'mEq/L', severity: 'high', description: 'Hypokalemia', priority: 'urgent' }
      ]],
      
      // Sodium thresholds (LOINC: 2947-0)
      ['2947-0', [
        { operator: 'gt', value: 155, unit: 'mEq/L', severity: 'critical', description: 'Severe hypernatremia', priority: 'immediate' },
        { operator: 'lt', value: 125, unit: 'mEq/L', severity: 'critical', description: 'Severe hyponatremia', priority: 'immediate' },
        { operator: 'gt', value: 150, unit: 'mEq/L', severity: 'high', description: 'Hypernatremia', priority: 'urgent' },
        { operator: 'lt', value: 130, unit: 'mEq/L', severity: 'high', description: 'Hyponatremia', priority: 'urgent' }
      ]],
      
      // Troponin thresholds (LOINC: 6598-7)
      ['6598-7', [
        { operator: 'gt', value: 0.04, unit: 'ng/mL', severity: 'critical', description: 'Elevated troponin - possible MI', priority: 'immediate' },
        { operator: 'gt', value: 0.01, unit: 'ng/mL', severity: 'high', description: 'Elevated troponin', priority: 'urgent' }
      ]],
      
      // White Blood Cell Count thresholds (LOINC: 6690-2)
      ['6690-2', [
        { operator: 'gt', value: 50, unit: '10*3/uL', severity: 'critical', description: 'Severe leukocytosis', priority: 'immediate' },
        { operator: 'lt', value: 1, unit: '10*3/uL', severity: 'critical', description: 'Severe leukopenia', priority: 'immediate' },
        { operator: 'gt', value: 20, unit: '10*3/uL', severity: 'high', description: 'Leukocytosis', priority: 'urgent' },
        { operator: 'lt', value: 3, unit: '10*3/uL', severity: 'high', description: 'Leukopenia', priority: 'urgent' }
      ]],
      
      // Platelet Count thresholds (LOINC: 777-3)
      ['777-3', [
        { operator: 'lt', value: 20, unit: '10*3/uL', severity: 'critical', description: 'Severe thrombocytopenia', priority: 'immediate' },
        { operator: 'gt', value: 1000, unit: '10*3/uL', severity: 'critical', description: 'Severe thrombocytosis', priority: 'immediate' },
        { operator: 'lt', value: 50, unit: '10*3/uL', severity: 'high', description: 'Thrombocytopenia', priority: 'urgent' },
        { operator: 'gt', value: 750, unit: '10*3/uL', severity: 'high', description: 'Thrombocytosis', priority: 'urgent' }
      ]]
    ]);

    // Cache for recent assessments to prevent duplicate alerts
    this.recentAssessments = new Map();
    this.alertCooldownPeriod = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  /**
   * Check if an observation represents a critical value
   */
  isCriticalValue(observation) {
    if (!observation.valueQuantity?.value || !observation.code?.coding) {
      return { isCritical: false };
    }

    const loincCode = observation.code.coding.find(c => c.system === 'http://loinc.org')?.code;
    if (!loincCode) {
      return { isCritical: false };
    }

    const thresholds = this.criticalValueThresholds.get(loincCode);
    if (!thresholds) {
      return { isCritical: false };
    }

    const value = observation.valueQuantity.value;
    const unit = observation.valueQuantity.unit;
    const testName = observation.code.coding.find(c => c.system === 'http://loinc.org')?.display || 
                     observation.code.text || 'Unknown Test';

    for (const threshold of thresholds) {
      if (this.evaluateThreshold(value, unit, threshold)) {
        return {
          isCritical: true,
          severity: threshold.severity,
          priority: threshold.priority,
          description: threshold.description,
          threshold: threshold,
          actualValue: `${value} ${unit}`,
          testName: testName,
          loincCode: loincCode,
          evaluationTime: new Date().toISOString()
        };
      }
    }

    return { isCritical: false };
  }

  /**
   * Evaluate if a value meets a critical threshold
   */
  evaluateThreshold(value, unit, threshold) {
    // Unit conversion logic would go here in production
    // For now, assume units match or handle common conversions
    const normalizedValue = this.normalizeValue(value, unit, threshold.unit);
    if (normalizedValue === null) {
      return false; // Unable to convert units
    }

    switch (threshold.operator) {
      case 'gt':
        return normalizedValue > threshold.value;
      case 'lt':
        return normalizedValue < threshold.value;
      case 'ge':
        return normalizedValue >= threshold.value;
      case 'le':
        return normalizedValue <= threshold.value;
      case 'eq':
        return Math.abs(normalizedValue - threshold.value) < 0.01;
      default:
        return false;
    }
  }

  /**
   * Basic unit normalization for common lab values
   */
  normalizeValue(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) {
      return value;
    }

    // Common conversions for lab values
    const conversions = {
      // Glucose: mg/dL <-> mmol/L
      'mg/dL->mmol/L': (v) => v / 18.0,
      'mmol/L->mg/dL': (v) => v * 18.0,
      
      // Creatinine: mg/dL <-> μmol/L
      'mg/dL->μmol/L': (v) => v * 88.4,
      'μmol/L->mg/dL': (v) => v / 88.4,
      
      // Hemoglobin: g/dL <-> g/L
      'g/dL->g/L': (v) => v * 10,
      'g/L->g/dL': (v) => v / 10
    };

    const conversionKey = `${fromUnit}->${toUnit}`;
    const converter = conversions[conversionKey];
    
    if (converter) {
      return converter(value);
    }

    // If no conversion available, return null to indicate incompatible units
    return null;
  }

  /**
   * Monitor patient for new critical values
   */
  async monitorPatientCriticalValues(patientId, timeframe = '24h') {
    try {
      const criticalResults = await this.searchCriticalLabValues(patientId, timeframe);
      
      // Process each critical result
      const processedResults = criticalResults.map(result => ({
        ...result,
        assessments: result.results.map(obs => this.isCriticalValue(obs)).filter(a => a.isCritical)
      }));

      return processedResults.filter(result => result.assessments.length > 0);
    } catch (error) {
      // Error handled - monitoring continues
      return [];
    }
  }

  /**
   * Search for critical lab values using value-quantity parameters
   */
  async searchCriticalLabValues(patientId, timeframe = '24h') {
    const cutoffDate = new Date();
    if (timeframe === '24h') {
      cutoffDate.setHours(cutoffDate.getHours() - 24);
    } else if (timeframe === '7d') {
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (timeframe === '30d') {
      cutoffDate.setDate(cutoffDate.getDate() - 30);
    }

    const criticalResults = [];

    // Search for each critical value definition
    for (const [loincCode, thresholds] of this.criticalValueThresholds.entries()) {
      for (const threshold of thresholds) {
        if (threshold.severity === 'critical') { // Only search for critical thresholds
          try {
            const results = await fhirClient.searchObservationsWithValueFilter(patientId, {
              code: loincCode,
              valueFilter: {
                operator: threshold.operator,
                value: threshold.value,
                unit: threshold.unit
              },
              dateFrom: cutoffDate.toISOString()
            });

            if (results.resources && results.resources.length > 0) {
              criticalResults.push({
                threshold,
                results: results.resources,
                count: results.resources.length,
                loincCode: loincCode
              });
            }
          } catch (error) {
            // Continue searching other values despite individual errors
          }
        }
      }
    }

    return criticalResults;
  }

  /**
   * Create critical value alert with deduplication
   */
  async createCriticalValueAlert(observation, assessment, patientId, publish) {
    // Check for recent alerts to prevent duplicates
    const alertKey = `${patientId}-${observation.code?.coding?.[0]?.code}-${assessment.severity}`;
    const lastAlert = this.recentAssessments.get(alertKey);
    
    if (lastAlert && (new Date() - new Date(lastAlert.timestamp)) < this.alertCooldownPeriod) {
      // Duplicate alert suppressed
      return null;
    }

    const alert = {
      type: 'critical-lab-value',
      severity: assessment.severity,
      priority: assessment.priority,
      patientId,
      observationId: observation.id,
      testName: assessment.testName,
      loincCode: assessment.loincCode,
      actualValue: assessment.actualValue,
      description: assessment.description,
      threshold: assessment.threshold,
      timestamp: new Date().toISOString(),
      requiresAcknowledgment: assessment.severity === 'critical',
      effectiveDateTime: observation.effectiveDateTime || observation.issued,
      performer: observation.performer?.[0]?.display || 'Unknown',
      metadata: {
        evaluationTime: assessment.evaluationTime,
        alertGenerated: new Date().toISOString()
      }
    };

    try {
      // Publish critical value event
      await publish(CLINICAL_EVENTS.CRITICAL_VALUE_DETECTED, alert);

      // Store alert to prevent duplicates
      this.recentAssessments.set(alertKey, {
        timestamp: alert.timestamp,
        severity: assessment.severity
      });

      // Critical value alert created successfully
      
      return alert;
    } catch (error) {
      // Alert creation failed - will retry on next check
      return null;
    }
  }

  /**
   * Get all available critical value filters for UI
   */
  getCriticalValueFilters() {
    const filters = [];
    
    for (const [loincCode, thresholds] of this.criticalValueThresholds.entries()) {
      const testName = this.getTestNameForLoinc(loincCode);
      
      for (const threshold of thresholds) {
        filters.push({
          id: `${loincCode}-${threshold.operator}-${threshold.value}`,
          label: `${testName} ${this.getOperatorSymbol(threshold.operator)} ${threshold.value} ${threshold.unit}`,
          description: threshold.description,
          code: loincCode,
          codeName: testName,
          operator: threshold.operator,
          value: threshold.value,
          unit: threshold.unit,
          severity: threshold.severity,
          priority: threshold.priority
        });
      }
    }
    
    return filters.sort((a, b) => {
      // Sort by severity (critical first), then by test name
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.codeName.localeCompare(b.codeName);
    });
  }

  /**
   * Get test name for LOINC code
   */
  getTestNameForLoinc(loincCode) {
    const testNames = {
      '2339-0': 'Glucose',
      '718-7': 'Hemoglobin',
      '2160-0': 'Creatinine',
      '6298-4': 'Potassium',
      '2947-0': 'Sodium',
      '6598-7': 'Troponin',
      '6690-2': 'WBC Count',
      '777-3': 'Platelet Count'
    };
    return testNames[loincCode] || 'Unknown Test';
  }

  /**
   * Get operator symbol for display
   */
  getOperatorSymbol(operator) {
    const symbols = {
      'gt': '>',
      'lt': '<',
      'ge': '≥',
      'le': '≤',
      'eq': '=',
      'ne': '≠'
    };
    return symbols[operator] || operator;
  }

  /**
   * Clear alert cooldown cache (for testing or manual reset)
   */
  clearAlertCache() {
    this.recentAssessments.clear();
  }

  /**
   * Get statistics about critical value detection
   */
  getDetectionStatistics() {
    return {
      totalThresholds: Array.from(this.criticalValueThresholds.values()).flat().length,
      criticalThresholds: Array.from(this.criticalValueThresholds.values()).flat().filter(t => t.severity === 'critical').length,
      monitoredTests: this.criticalValueThresholds.size,
      recentAlerts: this.recentAssessments.size,
      alertCooldownMinutes: this.alertCooldownPeriod / (60 * 1000)
    };
  }
}

// Export singleton instance
export const criticalValueDetectionService = new CriticalValueDetectionService();

// Also export class for testing
export default CriticalValueDetectionService;