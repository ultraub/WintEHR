/**
 * Results Management Service
 * Comprehensive lab result review, management, and notification system
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { format } from 'date-fns';
// Critical-value thresholds come from the backend-served table (R33) —
// single source: backend/api/clinical/critical_values.py.
import {
  classifyValueSync,
  getCriticalValueEntrySync,
  getCriticalValueTable,
  isCriticalClassification
} from './criticalValueService';

// Result status priorities for provider workflow
const RESULT_PRIORITIES = {
  critical: {
    level: 1,
    label: 'Critical',
    color: 'error',
    actionRequired: 'immediate',
    notificationMethod: ['system', 'sms', 'phone']
  },
  abnormal: {
    level: 2,
    label: 'Abnormal',
    color: 'warning',
    actionRequired: '24hours',
    notificationMethod: ['system', 'email']
  },
  borderline: {
    level: 3,
    label: 'Borderline',
    color: 'info',
    actionRequired: '48hours',
    notificationMethod: ['system']
  },
  normal: {
    level: 4,
    label: 'Normal',
    color: 'success',
    actionRequired: 'none',
    notificationMethod: []
  }
};

class ResultsManagementService {
  /**
   * Check if a result value is critical (via the shared backend-served table).
   * Fail-safe: unknown codes, missing values, or unit mismatches are NOT
   * critical — reference-range/interpretation handling elsewhere still flags
   * them as abnormal when applicable.
   */
  checkCriticalValue(observation) {
    const loincCode = observation.code?.coding?.find(c => c.system === 'http://loinc.org')?.code;
    const value = observation.valueQuantity?.value;

    if (!loincCode || value === undefined || value === null) {
      return { isCritical: false };
    }

    const classification = classifyValueSync(loincCode, value, observation.valueQuantity?.unit);
    if (!isCriticalClassification(classification)) {
      return { isCritical: false };
    }

    const criticalDef = getCriticalValueEntrySync(loincCode);
    const type = classification === 'critical-low' ? 'low' : 'high';

    return {
      isCritical: true,
      type,
      value,
      criticalRange: criticalDef,
      message: this.generateCriticalMessage(criticalDef.label, value, criticalDef, type)
    };
  }

  /**
   * Generate critical value message
   */
  generateCriticalMessage(testName, value, criticalDef, type) {
    const threshold = type === 'low' ? criticalDef.criticalLow : criticalDef.criticalHigh;
    const comparator = type === 'low' ? '<' : '>';
    return `CRITICAL ${type.toUpperCase()}: ${testName} is ${value} ${criticalDef.unit} (critical ${type} ${comparator} ${threshold})`.replace(/\s+/g, ' ');
  }

  /**
   * Determine result priority based on interpretation and critical values
   */
  determineResultPriority(observation) {
    // Check critical values first
    const criticalCheck = this.checkCriticalValue(observation);
    if (criticalCheck.isCritical) {
      return RESULT_PRIORITIES.critical;
    }

    // Check interpretation
    const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
    switch (interpretation) {
      case 'LL': // Critically low
      case 'HH': // Critically high
      case 'AA': // Critical abnormal
        return RESULT_PRIORITIES.critical;
      
      case 'L': // Low
      case 'H': // High
      case 'A': // Abnormal
        return RESULT_PRIORITIES.abnormal;
      
      case 'N': // Normal
        return RESULT_PRIORITIES.normal;
      
      default:
        // Check if value is outside reference range
        if (observation.referenceRange?.[0]) {
          const value = observation.valueQuantity?.value;
          const low = observation.referenceRange[0].low?.value;
          const high = observation.referenceRange[0].high?.value;
          
          if (value && ((low && value < low) || (high && value > high))) {
            return RESULT_PRIORITIES.abnormal;
          }
        }
        return RESULT_PRIORITIES.normal;
    }
  }

  /**
   * Create provider notification for critical result
   */
  async createCriticalValueNotification(observation, patient, provider) {
    await getCriticalValueTable().catch(() => {});
    const criticalCheck = this.checkCriticalValue(observation);
    const testName = observation.code?.text || observation.code?.coding?.[0]?.display;
    
    const notification = {
      resourceType: 'Communication',
      status: 'in-progress',
      priority: 'urgent',
      subject: {
        reference: `Patient/${patient.id}`,
        display: `${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
      },
      recipient: [{
        reference: `Practitioner/${provider.id}`,
        display: provider.name
      }],
      sender: {
        display: 'Laboratory System'
      },
      sent: new Date().toISOString(),
      category: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/communication-category',
          code: 'alert',
          display: 'Alert'
        }]
      }],
      payload: [{
        contentString: `CRITICAL LAB RESULT: ${testName}\n${criticalCheck.message}\nPatient: ${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}\nMRN: ${patient.identifier?.[0]?.value}\nResult Time: ${format(new Date(observation.effectiveDateTime), 'MM/dd/yyyy HH:mm')}`
      }],
      note: [{
        text: 'Immediate provider notification required per critical value protocol'
      }]
    };

    try {
      const response = await fhirClient.create('Communication', notification);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create result review task for provider
   */
  async createResultReviewTask(observation, patient, provider, priority) {
    const task = {
      resourceType: 'Task',
      status: 'ready',
      intent: 'order',
      priority: priority.label.toLowerCase(),
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '11488-4',
          display: 'Consult note'
        }],
        text: 'Review lab result'
      },
      description: `Review ${priority.label} lab result for patient`,
      for: {
        reference: `Patient/${patient.id}`,
        display: `${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
      },
      owner: {
        reference: `Practitioner/${provider.id}`,
        display: provider.name
      },
      authoredOn: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      requester: {
        display: 'Laboratory System'
      },
      input: [{
        type: {
          text: 'Observation'
        },
        valueReference: {
          reference: `Observation/${observation.id}`
        }
      }],
      restriction: {
        period: {
          end: this.calculateDueDate(priority.actionRequired)
        }
      }
    };

    try {
      const response = await fhirClient.create('Task', task);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate due date based on action required timeframe
   */
  calculateDueDate(actionRequired) {
    const now = new Date();
    switch (actionRequired) {
      case 'immediate':
        return new Date(now.getTime() + 30 * 60000).toISOString(); // 30 minutes
      case '24hours':
        return new Date(now.getTime() + 24 * 60 * 60000).toISOString();
      case '48hours':
        return new Date(now.getTime() + 48 * 60 * 60000).toISOString();
      default:
        return null;
    }
  }

  /**
   * Acknowledge result review
   */
  async acknowledgeResult(observationId, providerId, notes) {
    const acknowledgment = {
      resourceType: 'Provenance',
      target: [{
        reference: `Observation/${observationId}`
      }],
      recorded: new Date().toISOString(),
      agent: [{
        who: {
          reference: `Practitioner/${providerId}`
        }
      }],
      activity: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-DocumentCompletion',
          code: 'LA',
          display: 'Legally authenticated'
        }]
      },
      signature: [{
        type: [{
          system: 'urn:iso-astm:E1762-95:2013',
          code: '1.2.840.10065.1.12.1.5',
          display: 'Verification Signature'
        }],
        when: new Date().toISOString(),
        who: {
          reference: `Practitioner/${providerId}`
        }
      }]
    };

    if (notes) {
      acknowledgment.reason = [{
        text: notes
      }];
    }

    try {
      const response = await fhirClient.create('Provenance', acknowledgment);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get unacknowledged results for a provider
   */
  async getUnacknowledgedResults(providerId, patientId = null) {
    try {
      // Warm the shared threshold table so the synchronous critical checks
      // below have data (classification degrades fail-safe if this fails)
      await getCriticalValueTable().catch(() => {});

      // Get all results
      let searchParams = {
        status: 'final',
        _sort: '-date',
        _count: 100
      };

      if (patientId) {
        searchParams.patient = patientId;
      }

      const observations = await fhirClient.search('Observation', searchParams);

      // Get acknowledgments (Provenance)
      const provenanceSearch = await fhirClient.search('Provenance', {
        agent: `Practitioner/${providerId}`,
        _count: 1000
      });

      // Filter out acknowledged results
      const acknowledgedObsIds = new Set(
        provenanceSearch.resources
          .filter(p => p.activity?.coding?.[0]?.code === 'LA')
          .flatMap(p => p.target || [])
          .filter(t => t.reference?.startsWith('Observation/'))
          .map(t => t.reference.split('/')[1])
      );

      const unacknowledged = observations.resources.filter(
        obs => !acknowledgedObsIds.has(obs.id)
      );

      // Add priority to each result
      return unacknowledged.map(obs => ({
        ...obs,
        priority: this.determineResultPriority(obs),
        criticalCheck: this.checkCriticalValue(obs)
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create patient notification for results
   */
  async createPatientResultNotification(observation, patient, normalOnly = true) {
    // Only notify patients for normal results by default
    const priority = this.determineResultPriority(observation);
    if (normalOnly && priority.level < 4) {
      return null; // Don't notify patients for abnormal results automatically
    }

    const testName = observation.code?.text || observation.code?.coding?.[0]?.display;
    const value = observation.valueQuantity ? 
      `${observation.valueQuantity.value} ${observation.valueQuantity.unit}` : 
      observation.valueString || 'See details';

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
        reference: `Patient/${patient.id}`
      },
      sent: new Date().toISOString(),
      recipient: [{
        reference: `Patient/${patient.id}`,
        display: `${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`
      }],
      payload: [{
        contentString: `Your ${testName} result is available: ${value}. This result is within normal limits. Please contact your healthcare provider if you have any questions.`
      }],
      medium: [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
          code: 'EMAILWRIT',
          display: 'email'
        }]
      }]
    };

    try {
      const response = await fhirClient.create('Communication', communication);
      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get result trend data for graphing
   */
  async getResultTrends(patientId, loincCode, months = 12) {
    try {
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const observations = await fhirClient.search('Observation', {
        patient: patientId,
        code: `http://loinc.org|${loincCode}`,
        date: `ge${startDate.toISOString().split('T')[0]}`,
        _sort: 'date',
        _count: 100
      });

      return observations.resources
        .filter(obs => obs.valueQuantity?.value !== undefined)
        .map(obs => ({
          date: obs.effectiveDateTime,
          value: obs.valueQuantity.value,
          unit: obs.valueQuantity.unit,
          referenceRange: obs.referenceRange?.[0],
          interpretation: obs.interpretation?.[0]?.coding?.[0]?.code,
          id: obs.id
        }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get results requiring follow-up
   */
  async getResultsRequiringFollowup(patientId) {
    try {
      // Warm the shared threshold table for the synchronous priority checks
      await getCriticalValueTable().catch(() => {});

      const observations = await fhirClient.search('Observation', {
        patient: patientId,
        status: 'final',
        _sort: '-date',
        _count: 50
      });

      // Filter for abnormal results without follow-up orders
      const abnormalResults = observations.resources.filter(obs => {
        const priority = this.determineResultPriority(obs);
        return priority.level <= 2; // Critical or abnormal
      });

      // Check for follow-up orders (simplified - in production would check ServiceRequests)
      return abnormalResults.filter(obs => {
        // Check if result has been addressed
        return !obs.note?.some(note => 
          note.text?.toLowerCase().includes('follow-up ordered') ||
          note.text?.toLowerCase().includes('addressed')
        );
      });
    } catch (error) {
      throw error;
    }
  }
}

export const resultsManagementService = new ResultsManagementService();