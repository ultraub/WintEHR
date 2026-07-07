/**
 * Prescription Refill Service
 *
 * Thin client over the Task-based pharmacy refill endpoints in
 * backend/api/clinical/pharmacy/pharmacy_router.py. Refill requests are FHIR
 * Task resources (code 'fulfill', task-type extension 'refill') that the
 * backend creates and transitions — this service never creates or mutates
 * refill resources through FHIR directly.
 *
 * Backend endpoints:
 *   GET  /api/clinical/pharmacy/refills                     list (patient_id?, status)
 *   POST /api/clinical/pharmacy/refills/request             create refill request Task
 *   POST /api/clinical/pharmacy/refills/{taskId}/approve    complete Task + create new MedicationRequest
 *   POST /api/clinical/pharmacy/refills/{taskId}/reject     reject Task
 *
 * Read-only analytics (refill history, adherence, eligibility) query HAPI via
 * the canonical fhirClient using the same Task code/extension the backend writes.
 */

import api from './api';
import { fhirClient } from '../core/fhir/services/fhirClient';
import { parseISO, addDays, isAfter } from 'date-fns';
import { EXTENSION_URLS } from '../constants/fhirExtensions';

const REFILLS_URL = '/api/clinical/pharmacy/refills';

class PrescriptionRefillService {
  constructor() {
    this.adherenceThresholds = {
      excellent: 0.95,
      good: 0.85,
      fair: 0.70,
      poor: 0.50
    };
  }

  /**
   * Refill workflow statuses — FHIR Task.status values used by the backend.
   * A pending request is 'requested'; approval completes the Task (and creates
   * the new MedicationRequest); rejection sets the Task to 'rejected'.
   */
  REFILL_STATUSES = {
    REQUESTED: 'requested',
    APPROVED: 'completed',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled'
  };

  /**
   * Map the backend RefillResponse payload to a frontend-friendly shape.
   */
  mapRefillResponse(data) {
    return {
      id: data.refill_task_id,
      taskId: data.refill_task_id,
      medicationRequestId: data.medication_request_id,
      status: data.status,
      message: data.message,
      newMedicationRequestId: data.new_medication_request_id || null
    };
  }

  /**
   * Map a backend refill list entry (Task summary) to the shape consumers
   * render, enriched with the original prescription and patient resources.
   */
  async enrichRefill(refill) {
    const enriched = {
      id: refill.task_id,
      taskId: refill.task_id,
      resourceType: 'Task',
      medicationRequestId: refill.medication_request_id,
      patientId: refill.patient_id,
      status: refill.status,
      businessStatus: refill.business_status,
      priority: refill.priority || 'routine',
      authoredOn: refill.authored_on,
      description: refill.description,
      notes: refill.notes || [],
      refillInfo: {
        urgent: refill.priority === 'urgent' || refill.priority === 'stat'
      }
    };

    if (refill.medication_request_id) {
      try {
        const originalPrescription = await fhirClient.read(
          'MedicationRequest',
          refill.medication_request_id
        );
        enriched.originalPrescription = originalPrescription;
        // Expose medication fields so shared display utils (getMedicationName)
        // resolve the medication exactly as they do for a MedicationRequest.
        enriched.medicationCodeableConcept = originalPrescription?.medicationCodeableConcept;
        enriched.medicationReference = originalPrescription?.medicationReference;
      } catch (error) {
        // Enrichment is best-effort; the Task summary still renders
      }
    }

    if (refill.patient_id) {
      try {
        enriched.patient = await fhirClient.read('Patient', refill.patient_id);
      } catch (error) {
        // Enrichment is best-effort
      }
    }

    return enriched;
  }

  /**
   * Create a new refill request (backend creates the FHIR Task and enforces
   * the refills-remaining gate).
   */
  async createRefillRequest(medicationRequestId, requestData = {}) {
    let patientId = requestData.patientId || null;

    if (!patientId) {
      const originalRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      const subjectRef = originalRequest?.subject?.reference || '';
      patientId = subjectRef.replace('urn:uuid:', '').replace('Patient/', '') || null;
    }

    if (!patientId) {
      throw new Error('Unable to determine patient for refill request');
    }

    const response = await api.post(`${REFILLS_URL}/request`, {
      medication_request_id: medicationRequestId,
      patient_id: patientId,
      reason: requestData.reason || null,
      requested_quantity: requestData.requestedQuantity || null,
      notes: requestData.patientNotes || requestData.notes || null
    });

    return this.mapRefillResponse(response.data);
  }

  /**
   * Get refill requests for a patient. Defaults to pending ('requested')
   * Tasks; pass a Task status (or comma-separated list) to widen the search.
   */
  async getRefillRequests(patientId, status = 'requested') {
    const params = { status };
    if (patientId) {
      params.patient_id = patientId;
    }

    const response = await api.get(REFILLS_URL, { params });
    const refills = response.data || [];

    return Promise.all(refills.map(refill => this.enrichRefill(refill)));
  }

  /**
   * Get pending refill requests across all patients (pharmacy queue view).
   */
  async getPendingRefillRequests() {
    return this.getRefillRequests(null, 'requested');
  }

  /**
   * Approve a refill request. The backend completes the Task and creates the
   * new MedicationRequest (linked via priorPrescription).
   */
  async approveRefillRequest(refillTaskId, approvalData = {}) {
    const response = await api.post(`${REFILLS_URL}/${refillTaskId}/approve`, {
      pharmacist_id: approvalData.pharmacistId || approvalData.approvedBy || 'unknown',
      decision_notes: approvalData.notes || approvalData.decisionNotes || null,
      modified_quantity: approvalData.modifiedQuantity || null
    });

    return this.mapRefillResponse(response.data);
  }

  /**
   * Reject a refill request. The backend sets the Task to 'rejected' and
   * records the reason in Task.statusReason.
   */
  async rejectRefillRequest(refillTaskId, rejectionData = {}) {
    const response = await api.post(`${REFILLS_URL}/${refillTaskId}/reject`, {
      pharmacist_id: rejectionData.pharmacistId || rejectionData.rejectedBy || 'unknown',
      decision_notes: rejectionData.reason || rejectionData.notes || null
    });

    return this.mapRefillResponse(response.data);
  }

  /**
   * True when a Task is a refill request written by the backend (matches the
   * backend's own filter: description or task-type extension).
   */
  isRefillTask(task) {
    if ((task.description || '').toLowerCase().includes('refill')) {
      return true;
    }
    return (task.extension || []).some(
      ext => ext.url === `${EXTENSION_URLS.BASE}/task-type` && ext.valueString === 'refill'
    );
  }

  /**
   * Get refill history for a medication: the original prescription, its
   * refill-request Tasks, and dispense records, sorted chronologically.
   */
  async getRefillHistory(medicationRequestId) {
    try {
      const originalRequest = await fhirClient.read('MedicationRequest', medicationRequestId);

      // Refill requests are Tasks focused on the original MedicationRequest
      const taskResponse = await fhirClient.search('Task', {
        focus: `MedicationRequest/${medicationRequestId}`,
        code: 'fulfill',
        _count: 100
      });
      const refillTasks = (taskResponse.resources || []).filter(task => this.isRefillTask(task));

      // Get dispense records
      const dispenseResponse = await fhirClient.search('MedicationDispense', {
        prescription: medicationRequestId,
        _sort: '-whenhandedover',
        _count: 50
      });
      const dispenseRecords = dispenseResponse.resources || [];

      // Combine and sort by date
      const history = [
        {
          type: 'original',
          date: originalRequest.authoredOn,
          data: originalRequest,
          status: originalRequest.status
        },
        ...refillTasks.map(task => ({
          type: 'refill-request',
          date: task.authoredOn,
          data: task,
          status: task.status
        })),
        ...dispenseRecords.map(dispense => ({
          type: 'dispense',
          date: dispense.whenHandedOver || dispense.whenPrepared,
          data: dispense,
          status: dispense.status
        }))
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      return {
        originalPrescription: originalRequest,
        history,
        totalRefillsAllowed: originalRequest.dispenseRequest?.numberOfRepeatsAllowed || 0,
        // Mirrors the backend gate: completed fulfill-Tasks are used refills
        refillsUsed: refillTasks.filter(task => task.status === 'completed').length,
        lastRefillDate: history
          .filter(h => h.type === 'dispense')
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date
      };

    } catch (error) {
      // Return empty history instead of throwing to prevent UI crashes
      return {
        originalPrescription: null,
        history: [],
        totalRefillsAllowed: 0,
        refillsUsed: 0,
        lastRefillDate: null
      };
    }
  }

  /**
   * Calculate medication adherence based on refill patterns
   */
  async calculateMedicationAdherence(medicationRequestId, days = 90) {
    try {
      const history = await this.getRefillHistory(medicationRequestId);

      // Handle case where history is null or empty
      if (!history || !history.history) {
        return {
          adherenceRate: 0,
          rating: 'insufficient-data',
          daysSupply: 0,
          daysCovered: 0,
          gaps: []
        };
      }

      const dispenseEvents = history.history.filter(h => h.type === 'dispense');

      if (dispenseEvents.length === 0) {
        return {
          adherenceRate: 0,
          rating: 'insufficient-data',
          daysSupply: 0,
          daysCovered: 0,
          gaps: []
        };
      }

      // Calculate days supply coverage
      let totalDaysSupply = 0;
      let daysCovered = 0;
      const gaps = [];

      for (let i = 0; i < dispenseEvents.length; i++) {
        const dispense = dispenseEvents[i].data;
        const daysSupply = dispense.daysSupply?.value || 30; // Default to 30 days
        const handedOverDate = parseISO(dispense.whenHandedOver || dispense.whenPrepared);

        totalDaysSupply += daysSupply;

        // Check for gaps between refills
        if (i > 0) {
          const previousDispense = dispenseEvents[i - 1].data;
          const previousDaysSupply = previousDispense.daysSupply?.value || 30;
          const previousDate = parseISO(previousDispense.whenHandedOver || previousDispense.whenPrepared);
          const expectedRefillDate = addDays(previousDate, previousDaysSupply);

          if (isAfter(handedOverDate, expectedRefillDate)) {
            const gapDays = Math.floor((handedOverDate - expectedRefillDate) / (1000 * 60 * 60 * 24));
            gaps.push({
              startDate: expectedRefillDate,
              endDate: handedOverDate,
              days: gapDays
            });
          }
        }
      }

      // Calculate adherence over specified time period
      const startDate = addDays(new Date(), -days);
      const relevantDispenses = dispenseEvents.filter(event =>
        isAfter(parseISO(event.date), startDate)
      );

      if (relevantDispenses.length === 0) {
        return {
          adherenceRate: 0,
          rating: 'insufficient-data',
          daysSupply: totalDaysSupply,
          daysCovered: 0,
          gaps: gaps
        };
      }

      // Calculate coverage in the time period
      const totalGapDays = gaps
        .filter(gap => isAfter(gap.startDate, startDate))
        .reduce((sum, gap) => sum + gap.days, 0);

      daysCovered = Math.min(days, totalDaysSupply - totalGapDays);
      const adherenceRate = daysCovered / days;

      // Determine rating
      let rating;
      if (adherenceRate >= this.adherenceThresholds.excellent) {
        rating = 'excellent';
      } else if (adherenceRate >= this.adherenceThresholds.good) {
        rating = 'good';
      } else if (adherenceRate >= this.adherenceThresholds.fair) {
        rating = 'fair';
      } else {
        rating = 'poor';
      }

      return {
        adherenceRate,
        rating,
        daysSupply: totalDaysSupply,
        daysCovered,
        gaps,
        analysisMetrics: {
          totalDispenses: dispenseEvents.length,
          averageDaysBetweenRefills: this.calculateAverageRefillInterval(dispenseEvents),
          lastRefillDate: dispenseEvents[dispenseEvents.length - 1]?.date,
          nextExpectedRefillDate: this.calculateNextExpectedRefill(dispenseEvents)
        }
      };

    } catch (error) {
      // Return default adherence data instead of throwing
      return {
        adherenceRate: 0,
        rating: 'insufficient-data',
        daysSupply: 0,
        daysCovered: 0,
        gaps: []
      };
    }
  }

  /**
   * Check if a medication is due for refill
   */
  async checkRefillEligibility(medicationRequestId) {
    try {
      const history = await this.getRefillHistory(medicationRequestId);

      // Handle case where history is null or empty
      if (!history) {
        return {
          eligible: false,
          reason: 'Unable to determine eligibility - missing prescription data',
          refillsRemaining: 0
        };
      }

      const { totalRefillsAllowed, refillsUsed } = history;

      // Check if any refills remain
      if (refillsUsed >= totalRefillsAllowed) {
        return {
          eligible: false,
          reason: 'No refills remaining',
          refillsRemaining: 0
        };
      }

      // Get last dispense
      const lastDispense = history.history
        .filter(h => h.type === 'dispense' && h.status === 'completed')
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

      if (!lastDispense) {
        return {
          eligible: true,
          reason: 'Initial fill needed',
          refillsRemaining: totalRefillsAllowed - refillsUsed
        };
      }

      // Calculate when next refill is due
      const daysSupply = lastDispense.data.daysSupply?.value || 30;
      const lastDispenseDate = parseISO(lastDispense.date);
      const refillDueDate = addDays(lastDispenseDate, Math.floor(daysSupply * 0.8)); // 80% rule
      const daysTillDue = Math.floor((refillDueDate - new Date()) / (1000 * 60 * 60 * 24));

      return {
        eligible: daysTillDue <= 0,
        reason: daysTillDue <= 0 ? 'Refill due' : `Refill due in ${daysTillDue} days`,
        refillsRemaining: totalRefillsAllowed - refillsUsed,
        daysTillDue,
        refillDueDate,
        lastDispenseDate
      };

    } catch (error) {
      // Return ineligible status instead of throwing
      return {
        eligible: false,
        reason: 'Unable to determine eligibility due to data error',
        refillsRemaining: 0
      };
    }
  }

  /**
   * Calculate average interval between refills
   */
  calculateAverageRefillInterval(dispenseEvents) {
    if (dispenseEvents.length < 2) return null;

    const intervals = [];
    for (let i = 1; i < dispenseEvents.length; i++) {
      const current = parseISO(dispenseEvents[i].date);
      const previous = parseISO(dispenseEvents[i - 1].date);
      intervals.push(Math.floor((current - previous) / (1000 * 60 * 60 * 24)));
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  /**
   * Calculate next expected refill date
   */
  calculateNextExpectedRefill(dispenseEvents) {
    if (dispenseEvents.length === 0) return null;

    const lastDispense = dispenseEvents[dispenseEvents.length - 1];
    const daysSupply = lastDispense.data.daysSupply?.value || 30;
    const lastDate = parseISO(lastDispense.date);

    return addDays(lastDate, daysSupply);
  }
}

// Export singleton instance
export const prescriptionRefillService = new PrescriptionRefillService();
