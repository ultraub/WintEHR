/**
 * Medication Administration Service
 * FHIR R4 MedicationAdministration resource management
 * Part of Phase 2 Implementation: MedicationAdministration Integration
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { v4 as uuidv4 } from 'uuid';

class MedicationAdministrationService {
  constructor() {
    this.resourceType = 'MedicationAdministration';
  }

  /**
   * Create a new MedicationAdministration resource
   * @param {Object} administrationData - Administration data
   * @returns {Promise<Object>} Created MedicationAdministration resource
   */
  async createMedicationAdministration(administrationData) {
    this.validateAdministrationData(administrationData);
    
    const medicationAdministration = this.prepareFHIRResource(administrationData);
    
    try {
      const response = await fhirClient.create(this.resourceType, medicationAdministration);
      return response;
    } catch (error) {
      throw new Error(`Failed to create MedicationAdministration: ${error.message}`);
    }
  }

  /**
   * Get medication administrations for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of MedicationAdministration resources
   */
  async getPatientAdministrations(patientId, filters = {}) {
    try {
      const searchParams = {
        patient: patientId,
        _sort: '-effective-time',
        _count: filters.limit || 100,
        ...filters
      };

      if (filters.medicationRequest) {
        searchParams.request = filters.medicationRequest;
      }

      if (filters.status) {
        searchParams.status = filters.status;
      }

      if (filters.dateRange) {
        if (filters.dateRange.start) {
          searchParams['effective-time'] = `ge${filters.dateRange.start}`;
        }
        if (filters.dateRange.end) {
          searchParams['effective-time'] = `${searchParams['effective-time'] || ''}$le${filters.dateRange.end}`;
        }
      }

      const response = await fhirClient.search(this.resourceType, searchParams);
      return response.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      throw new Error(`Failed to fetch patient administrations: ${error.message}`);
    }
  }

  /**
   * Get administrations for a specific medication request
   * @param {string} medicationRequestId - MedicationRequest ID
   * @returns {Promise<Array>} Array of MedicationAdministration resources
   */
  async getAdministrationsByRequest(medicationRequestId) {
    try {
      const response = await fhirClient.search(this.resourceType, {
        request: medicationRequestId,
        _sort: '-effective-time'
      });
      return response.entry?.map(entry => entry.resource) || [];
    } catch (error) {
      throw new Error(`Failed to fetch administrations by request: ${error.message}`);
    }
  }

  /**
   * Update administration status
   * @param {string} administrationId - Administration ID
   * @param {string} status - New status
   * @param {string} reason - Reason for status change
   * @returns {Promise<Object>} Updated resource
   */
  async updateAdministrationStatus(administrationId, status, reason = null) {
    try {
      const existing = await fhirClient.read(this.resourceType, administrationId);
      
      existing.status = status;
      if (reason) {
        existing.statusReason = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/reason-medication-not-given',
            code: reason,
            display: this.getStatusReasonDisplay(reason)
          }]
        }];
      }

      existing.meta = {
        ...existing.meta,
        lastUpdated: new Date().toISOString()
      };

      const response = await fhirClient.update(this.resourceType, administrationId, existing);
      return response;
    } catch (error) {
      throw new Error(`Failed to update administration status: ${error.message}`);
    }
  }

  /**
   * Get MAR (Medication Administration Record) for a patient
   * @param {string} patientId - Patient ID
   * @param {string} encounterId - Encounter ID (optional)
   * @param {Date} date - Date for MAR (defaults to today)
   * @returns {Promise<Object>} MAR data structure
   */
  async getMedicationAdministrationRecord(patientId, encounterId = null, date = new Date()) {
    try {
      const dateStr = date.toISOString().split('T')[0];
      
      // Get active medication requests
      const medicationRequests = await fhirClient.search('MedicationRequest', {
        patient: patientId,
        status: 'active',
        intent: 'order',
        _include: 'MedicationRequest:medication'
      });

      // Get administrations for the date
      const administrations = await this.getPatientAdministrations(patientId, {
        dateRange: {
          start: `${dateStr}T00:00:00Z`,
          end: `${dateStr}T23:59:59Z`
        }
      });

      // Build MAR structure
      const marData = this.buildMARStructure(
        medicationRequests.entry?.map(e => e.resource) || [],
        administrations,
        date
      );

      return marData;
    } catch (error) {
      throw new Error(`Failed to generate MAR: ${error.message}`);
    }
  }

  /**
   * Validate administration prerequisites
   * @param {string} medicationRequestId - MedicationRequest ID
   * @param {string} patientId - Patient ID
   * @returns {Promise<Object>} Validation results
   */
  async validateAdministrationPrerequisites(medicationRequestId, patientId) {
    try {
      const validation = {
        valid: true,
        issues: [],
        warnings: []
      };

      // Check medication request exists and is active
      const medicationRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      if (medicationRequest.status !== 'active') {
        validation.issues.push(`Medication request status is ${medicationRequest.status}, expected 'active'`);
        validation.valid = false;
      }

      // Check if there's a dispense for this request
      const dispenses = await fhirClient.search('MedicationDispense', {
        prescription: medicationRequestId,
        status: 'completed'
      });

      if (!dispenses.entry || dispenses.entry.length === 0) {
        validation.warnings.push('No completed dispense found for this prescription');
      }

      // Check for contraindications
      const allergies = await fhirClient.search('AllergyIntolerance', {
        patient: patientId,
        'clinical-status': 'active'
      });

      if (allergies.entry && allergies.entry.length > 0) {
        validation.warnings.push(`Patient has ${allergies.entry.length} active allergies - verify compatibility`);
      }

      return validation;
    } catch (error) {
      return {
        valid: false,
        issues: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get administration metrics for a patient
   * @param {string} patientId - Patient ID
   * @param {number} days - Number of days to analyze (default 30)
   * @returns {Promise<Object>} Administration metrics
   */
  async getAdministrationMetrics(patientId, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const administrations = await this.getPatientAdministrations(patientId, {
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      });

      const metrics = {
        totalAdministrations: administrations.length,
        completedAdministrations: administrations.filter(a => a.status === 'completed').length,
        missedAdministrations: administrations.filter(a => a.status === 'not-done').length,
        adherenceRate: 0,
        byMedication: {},
        byDay: {},
        recentTrends: []
      };

      // Calculate adherence rate
      if (metrics.totalAdministrations > 0) {
        metrics.adherenceRate = (metrics.completedAdministrations / metrics.totalAdministrations) * 100;
      }

      // Group by medication
      administrations.forEach(admin => {
        const medKey = this.getMedicationKey(admin);
        if (!metrics.byMedication[medKey]) {
          metrics.byMedication[medKey] = {
            total: 0,
            completed: 0,
            missed: 0
          };
        }
        metrics.byMedication[medKey].total++;
        if (admin.status === 'completed') {
          metrics.byMedication[medKey].completed++;
        } else if (admin.status === 'not-done') {
          metrics.byMedication[medKey].missed++;
        }
      });

      // Group by day
      administrations.forEach(admin => {
        const day = admin.effectiveDateTime?.split('T')[0] || 'unknown';
        if (!metrics.byDay[day]) {
          metrics.byDay[day] = { total: 0, completed: 0, missed: 0 };
        }
        metrics.byDay[day].total++;
        if (admin.status === 'completed') {
          metrics.byDay[day].completed++;
        } else if (admin.status === 'not-done') {
          metrics.byDay[day].missed++;
        }
      });

      return metrics;
    } catch (error) {
      throw new Error(`Failed to calculate administration metrics: ${error.message}`);
    }
  }

  // Private helper methods

  validateAdministrationData(data) {
    const required = ['medicationCodeableConcept', 'subject', 'effectiveDateTime', 'status'];
    const missing = required.filter(field => !data[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    const validStatuses = ['in-progress', 'not-done', 'on-hold', 'completed', 'entered-in-error', 'stopped', 'unknown'];
    if (!validStatuses.includes(data.status)) {
      throw new Error(`Invalid status: ${data.status}. Must be one of: ${validStatuses.join(', ')}`);
    }
  }

  prepareFHIRResource(data) {
    const medicationAdministration = {
      resourceType: this.resourceType,
      id: uuidv4(),
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
        source: 'WintEHR-Pharmacy-System'
      },
      status: data.status,
      medicationCodeableConcept: data.medicationCodeableConcept,
      subject: data.subject,
      effectiveDateTime: data.effectiveDateTime,
      performer: data.performer || [],
      dosage: data.dosage,
      note: data.note || []
    };

    // Add optional fields
    if (data.request) {
      medicationAdministration.request = data.request;
    }

    if (data.context) {
      medicationAdministration.context = data.context;
    }

    if (data.statusReason) {
      medicationAdministration.statusReason = data.statusReason;
    }

    if (data.device) {
      medicationAdministration.device = data.device;
    }

    if (data.reasonCode) {
      medicationAdministration.reasonCode = data.reasonCode;
    }

    if (data.reasonReference) {
      medicationAdministration.reasonReference = data.reasonReference;
    }

    return medicationAdministration;
  }

  buildMARStructure(medicationRequests, administrations, date) {
    const marData = {
      date: date.toISOString().split('T')[0],
      medications: [],
      summary: {
        totalScheduled: 0,
        administered: 0,
        missed: 0,
        pending: 0
      }
    };

    medicationRequests.forEach(request => {
      const requestAdministrations = administrations.filter(admin => 
        admin.request?.reference === `MedicationRequest/${request.id}`
      );

      const scheduledDoses = this.calculateScheduledDoses(request, date);
      const administeredDoses = requestAdministrations.filter(admin => admin.status === 'completed');
      const missedDoses = requestAdministrations.filter(admin => admin.status === 'not-done');

      marData.medications.push({
        medicationRequest: request,
        scheduledDoses,
        administrations: requestAdministrations,
        summary: {
          scheduled: scheduledDoses.length,
          administered: administeredDoses.length,
          missed: missedDoses.length,
          pending: scheduledDoses.length - administeredDoses.length - missedDoses.length
        }
      });

      marData.summary.totalScheduled += scheduledDoses.length;
      marData.summary.administered += administeredDoses.length;
      marData.summary.missed += missedDoses.length;
    });

    marData.summary.pending = marData.summary.totalScheduled - marData.summary.administered - marData.summary.missed;

    return marData;
  }

  calculateScheduledDoses(medicationRequest, date) {
    // Simplified dose scheduling calculation
    // In a real implementation, this would parse dosageInstructions more thoroughly
    const dosageInstructions = medicationRequest.dosageInstruction || [];
    const scheduledDoses = [];

    dosageInstructions.forEach(instruction => {
      // Parse timing (simplified for common patterns)
      const timing = instruction.timing;
      if (timing?.repeat?.frequency) {
        const frequency = timing.repeat.frequency;
        for (let i = 0; i < frequency; i++) {
          scheduledDoses.push({
            time: this.calculateDoseTime(date, i, frequency),
            instruction: instruction
          });
        }
      } else {
        // Default to once daily if no timing specified
        scheduledDoses.push({
          time: new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString(), // 9 AM
          instruction: instruction
        });
      }
    });

    return scheduledDoses;
  }

  calculateDoseTime(date, doseIndex, totalDoses) {
    // Distribute doses evenly throughout the day
    const startHour = 8; // 8 AM
    const endHour = 20; // 8 PM
    const hoursSpan = endHour - startHour;
    const hoursBetweenDoses = hoursSpan / (totalDoses - 1 || 1);
    
    const doseHour = startHour + (doseIndex * hoursBetweenDoses);
    const doseTime = new Date(date);
    doseTime.setHours(Math.floor(doseHour), (doseHour % 1) * 60, 0, 0);
    
    return doseTime.toISOString();
  }

  getMedicationKey(administration) {
    return administration.medicationCodeableConcept?.text || 
           administration.medicationCodeableConcept?.coding?.[0]?.display || 
           administration.medicationReference?.display || 
           'Unknown Medication';
  }

  getStatusReasonDisplay(reason) {
    const reasons = {
      'patient-refusal': 'Patient Refusal',
      'medical-precaution': 'Medical Precaution',
      'patient-unavailable': 'Patient Unavailable',
      'medication-unavailable': 'Medication Unavailable',
      'contraindication': 'Contraindication',
      'other': 'Other'
    };
    return reasons[reason] || reason;
  }
}

export const medicationAdministrationService = new MedicationAdministrationService();