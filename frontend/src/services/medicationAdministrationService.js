/**
 * Medication Administration Service
 * FHIR R4 MedicationAdministration resource management
 * Part of Phase 2 Implementation: MedicationAdministration Integration
 *
 * Updated to use backend APIs for core operations while maintaining
 * FHIR client fallback for direct operations when needed.
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { apiClient } from './api';
import { v4 as uuidv4 } from 'uuid';

class MedicationAdministrationService {
  constructor() {
    this.resourceType = 'MedicationAdministration';
  }

  /**
   * Create a new MedicationAdministration resource via backend API
   * @param {Object} administrationData - Administration data
   * @returns {Promise<Object>} Created MedicationAdministration resource
   */
  async createMedicationAdministration(administrationData) {
    try {
      // Use backend API for medication administration (preferred)
      // This ensures consistent business logic, audit logging, and CDS integration
      const backendRequest = {
        medication_request_id: administrationData.medicationRequestId ||
          administrationData.request?.reference?.replace('MedicationRequest/', ''),
        patient_id: administrationData.patientId ||
          administrationData.subject?.reference?.replace('Patient/', ''),
        administered_by: administrationData.administeredBy ||
          administrationData.performer?.[0]?.actor?.reference?.replace('Practitioner/', ''),
        administered_at: administrationData.effectiveDateTime || new Date().toISOString(),
        dose_given: administrationData.doseGiven ||
          administrationData.dosage?.dose?.value || 1,
        dose_unit: administrationData.doseUnit ||
          administrationData.dosage?.dose?.unit || 'dose',
        route: administrationData.route ||
          administrationData.dosage?.route?.coding?.[0]?.code || 'oral',
        status: administrationData.status || 'completed',
        notes: administrationData.notes || administrationData.note?.[0]?.text
      };

      // Add optional reason if status is not-done
      if (administrationData.status === 'not-done') {
        backendRequest.reason_not_given = administrationData.statusReason?.[0]?.coding?.[0]?.code ||
          administrationData.reasonNotGiven || 'other';
      }

      const response = await apiClient.post('/api/clinical/pharmacy/mar/administer', backendRequest);
      return response.data;
    } catch (error) {
      // Fallback to direct FHIR client if backend fails
      console.warn('Backend MAR API failed, falling back to FHIR client:', error.message);

      this.validateAdministrationData(administrationData);
      const medicationAdministration = this.prepareFHIRResource(administrationData);

      try {
        const response = await fhirClient.create(this.resourceType, medicationAdministration);
        return response;
      } catch (fhirError) {
        throw new Error(`Failed to create MedicationAdministration: ${fhirError.message}`);
      }
    }
  }

  /**
   * Get medication administrations for a patient via backend API
   * @param {string} patientId - Patient ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Array of MedicationAdministration resources
   */
  async getPatientAdministrations(patientId, filters = {}) {
    try {
      // Build query params for backend API
      const queryParams = new URLSearchParams();

      if (filters.dateRange?.start) {
        // Extract date from ISO string if provided
        const date = filters.dateRange.start.split('T')[0];
        queryParams.append('date', date);
      }

      if (filters.medicationRequest) {
        queryParams.append('medication_request_id', filters.medicationRequest.replace('MedicationRequest/', ''));
      }

      if (filters.status) {
        queryParams.append('status', filters.status);
      }

      const queryString = queryParams.toString();
      const url = `/api/clinical/pharmacy/mar/${patientId}${queryString ? `?${queryString}` : ''}`;

      const response = await apiClient.get(url);

      // Transform backend MAR entries to FHIR-like format for compatibility
      return response.data.map(entry => this.transformMAREntryToFHIR(entry));
    } catch (error) {
      // Fallback to direct FHIR search if backend fails
      console.warn('Backend MAR API failed, falling back to FHIR client:', error.message);

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

        const fhirResponse = await fhirClient.search(this.resourceType, searchParams);
        return fhirResponse.entry?.map(entry => entry.resource) || [];
      } catch (fhirError) {
        throw new Error(`Failed to fetch patient administrations: ${fhirError.message}`);
      }
    }
  }

  /**
   * Transform backend MAR entry to FHIR-like structure for compatibility
   * @param {Object} marEntry - Backend MAR entry
   * @returns {Object} FHIR-like MedicationAdministration
   */
  transformMAREntryToFHIR(marEntry) {
    return {
      resourceType: 'MedicationAdministration',
      id: marEntry.administration_id,
      status: marEntry.status,
      medicationCodeableConcept: {
        text: marEntry.medication_name,
        coding: marEntry.medication_code ? [{
          display: marEntry.medication_name,
          code: marEntry.medication_code
        }] : []
      },
      subject: {
        reference: `Patient/${marEntry.patient_id}`
      },
      effectiveDateTime: marEntry.administered_at,
      performer: marEntry.administered_by ? [{
        actor: {
          reference: `Practitioner/${marEntry.administered_by}`,
          display: marEntry.administered_by_name
        }
      }] : [],
      dosage: {
        dose: {
          value: marEntry.dose_given,
          unit: marEntry.dose_unit
        },
        route: marEntry.route ? {
          coding: [{ code: marEntry.route, display: marEntry.route }]
        } : undefined
      },
      request: marEntry.medication_request_id ? {
        reference: `MedicationRequest/${marEntry.medication_request_id}`
      } : undefined,
      statusReason: marEntry.reason_not_given ? [{
        coding: [{
          code: marEntry.reason_not_given,
          display: this.getStatusReasonDisplay(marEntry.reason_not_given)
        }]
      }] : undefined,
      note: marEntry.notes ? [{ text: marEntry.notes }] : []
    };
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
   * Get medication administration schedule for a patient via backend API
   * Shows what medications are due, given, or missed
   * @param {string} patientId - Patient ID
   * @param {string} date - Date for schedule (YYYY-MM-DD), defaults to today
   * @returns {Promise<Object>} Medication schedule with due/given status
   */
  async getMedicationSchedule(patientId, date = null) {
    try {
      const dateParam = date || new Date().toISOString().split('T')[0];
      const url = `/api/clinical/pharmacy/mar/schedule/${patientId}?date=${dateParam}`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      console.warn('Backend schedule API failed:', error.message);
      // Return empty schedule on error
      return {
        date: date || new Date().toISOString().split('T')[0],
        medications: [],
        error: error.message
      };
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