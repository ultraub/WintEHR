/**
 * Critical Value Detection Service
 *
 * Provides automated critical value monitoring and alerting capabilities
 * for laboratory results using FHIR R4 value-quantity search parameters.
 *
 * Thresholds come from the ONE backend-served table (R33) via
 * criticalValueService — this service adds monitoring, alert deduplication,
 * and UI filter presets on top; it holds no thresholds of its own.
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';
import {
  classifyValueSync,
  getCriticalValueEntrySync,
  getCriticalValueTable,
  getCriticalValueTableSync
} from './criticalValueService';

// Map the shared service's classification onto this service's
// severity/priority vocabulary (kept for existing consumers).
const CLASSIFICATION_SEVERITY = {
  'critical-low': { severity: 'critical', priority: 'immediate' },
  'critical-high': { severity: 'critical', priority: 'immediate' },
  low: { severity: 'high', priority: 'urgent' },
  high: { severity: 'high', priority: 'urgent' }
};

class CriticalValueDetectionService {
  constructor() {
    // Cache for recent assessments to prevent duplicate alerts
    this.recentAssessments = new Map();
    this.alertCooldownPeriod = 60 * 60 * 1000; // 1 hour in milliseconds
  }

  /**
   * Check if an observation represents a critical value.
   * Synchronous — classification is null (treated as not critical) until the
   * shared table has loaded; call getCriticalValueTable() first in async flows.
   */
  isCriticalValue(observation) {
    if (!observation.valueQuantity?.value || !observation.code?.coding) {
      return { isCritical: false };
    }

    const loincCode = observation.code.coding.find(c => c.system === 'http://loinc.org')?.code;
    if (!loincCode) {
      return { isCritical: false };
    }

    const value = observation.valueQuantity.value;
    const unit = observation.valueQuantity.unit;

    const classification = classifyValueSync(loincCode, value, unit);
    const mapped = CLASSIFICATION_SEVERITY[classification];
    if (!mapped) {
      // 'normal', unknown code, unit mismatch, or table not loaded — fail safe
      return { isCritical: false };
    }

    const entry = getCriticalValueEntrySync(loincCode);
    const testName = entry?.label ||
                     observation.code.coding.find(c => c.system === 'http://loinc.org')?.display ||
                     observation.code.text || 'Unknown Test';

    return {
      isCritical: true,
      severity: mapped.severity,
      priority: mapped.priority,
      description: this.describeClassification(entry, classification),
      threshold: this.describeThreshold(entry, classification),
      actualValue: `${value} ${unit}`,
      testName,
      loincCode,
      evaluationTime: new Date().toISOString()
    };
  }

  /**
   * Build a threshold descriptor for a classification (for alert payloads).
   */
  describeThreshold(entry, classification) {
    if (!entry) return null;
    switch (classification) {
      case 'critical-low':
        return { operator: 'lt', value: entry.criticalLow, unit: entry.unit, severity: 'critical' };
      case 'critical-high':
        return { operator: 'gt', value: entry.criticalHigh, unit: entry.unit, severity: 'critical' };
      case 'low':
        return { operator: 'lt', value: entry.low, unit: entry.unit, severity: 'high' };
      case 'high':
        return { operator: 'gt', value: entry.high, unit: entry.unit, severity: 'high' };
      default:
        return null;
    }
  }

  /**
   * Human-readable description of a classification.
   */
  describeClassification(entry, classification) {
    const label = entry?.label || 'Lab value';
    switch (classification) {
      case 'critical-low':
        return `Critically low ${label}`;
      case 'critical-high':
        return `Critically high ${label}`;
      case 'low':
        return `Low ${label}`;
      case 'high':
        return `Elevated ${label}`;
      default:
        return label;
    }
  }

  /**
   * Monitor patient for new critical values
   */
  async monitorPatientCriticalValues(patientId, timeframe = '24h') {
    try {
      // Ensure the shared threshold table is loaded before sync assessments
      await getCriticalValueTable();

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
    const table = await getCriticalValueTable();

    const cutoffDate = new Date();
    if (timeframe === '24h') {
      cutoffDate.setHours(cutoffDate.getHours() - 24);
    } else if (timeframe === '7d') {
      cutoffDate.setDate(cutoffDate.getDate() - 7);
    } else if (timeframe === '30d') {
      cutoffDate.setDate(cutoffDate.getDate() - 30);
    }

    const criticalResults = [];

    // Search each code's critical bounds (only critical thresholds)
    for (const entry of table.values()) {
      const criticalBounds = [];
      if (entry.criticalHigh !== undefined && entry.criticalHigh !== null) {
        criticalBounds.push({ operator: 'gt', value: entry.criticalHigh, classification: 'critical-high' });
      }
      if (entry.criticalLow !== undefined && entry.criticalLow !== null) {
        criticalBounds.push({ operator: 'lt', value: entry.criticalLow, classification: 'critical-low' });
      }

      for (const bound of criticalBounds) {
        try {
          const results = await fhirClient.searchObservationsWithValueFilter(patientId, {
            code: entry.loinc,
            valueFilter: {
              operator: bound.operator,
              value: bound.value,
              unit: entry.unit
            },
            dateFrom: cutoffDate.toISOString()
          });

          if (results.resources && results.resources.length > 0) {
            criticalResults.push({
              threshold: {
                operator: bound.operator,
                value: bound.value,
                unit: entry.unit,
                severity: 'critical',
                description: this.describeClassification(entry, bound.classification)
              },
              results: results.resources,
              count: results.resources.length,
              loincCode: entry.loinc
            });
          }
        } catch (error) {
          // Continue searching other values despite individual errors
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
   * Get all available critical value filters for UI.
   * Async: resolves once the shared threshold table has loaded.
   */
  async getCriticalValueFilters() {
    let table;
    try {
      table = await getCriticalValueTable();
    } catch (error) {
      return [];
    }

    const filters = [];

    for (const entry of table.values()) {
      const bounds = [
        ['critical-low', 'lt', entry.criticalLow, 'critical', 'immediate'],
        ['critical-high', 'gt', entry.criticalHigh, 'critical', 'immediate'],
        ['low', 'lt', entry.low, 'high', 'urgent'],
        ['high', 'gt', entry.high, 'high', 'urgent']
      ];

      for (const [classification, operator, value, severity, priority] of bounds) {
        if (value === undefined || value === null) continue;
        filters.push({
          id: `${entry.loinc}-${operator}-${value}`,
          label: `${entry.label} ${this.getOperatorSymbol(operator)} ${value} ${entry.unit}`.trim(),
          description: this.describeClassification(entry, classification),
          code: entry.loinc,
          codeName: entry.label,
          operator,
          value,
          unit: entry.unit,
          severity,
          priority
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
   * Get test name for LOINC code (from the shared table)
   */
  getTestNameForLoinc(loincCode) {
    return getCriticalValueEntrySync(loincCode)?.label || 'Unknown Test';
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
    const table = getCriticalValueTableSync();
    const entries = table ? Array.from(table.values()) : [];
    const countBounds = (entry) =>
      ['criticalLow', 'criticalHigh', 'low', 'high'].filter(
        key => entry[key] !== undefined && entry[key] !== null
      ).length;
    const countCriticalBounds = (entry) =>
      ['criticalLow', 'criticalHigh'].filter(
        key => entry[key] !== undefined && entry[key] !== null
      ).length;

    return {
      totalThresholds: entries.reduce((sum, entry) => sum + countBounds(entry), 0),
      criticalThresholds: entries.reduce((sum, entry) => sum + countCriticalBounds(entry), 0),
      monitoredTests: entries.length,
      recentAlerts: this.recentAssessments.size,
      alertCooldownMinutes: this.alertCooldownPeriod / (60 * 1000)
    };
  }
}

// Export singleton instance
export const criticalValueDetectionService = new CriticalValueDetectionService();

// Also export class for testing
export default CriticalValueDetectionService;
