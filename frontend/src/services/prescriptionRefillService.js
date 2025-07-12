/**
 * Prescription Refill Service
 * Handles prescription refill requests, tracking, and workflow management
 */

import { fhirClient } from './fhirClient';
import { format, parseISO, addDays, isAfter, isBefore } from 'date-fns';

class PrescriptionRefillService {
  constructor() {
    this.refillCache = new Map();
    this.adherenceThresholds = {
      excellent: 0.95,
      good: 0.85,
      fair: 0.70,
      poor: 0.50
    };
  }

  /**
   * Refill request status definitions
   */
  REFILL_STATUSES = {
    REQUESTED: 'requested',
    PENDING_APPROVAL: 'pending-approval',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DISPENSED: 'dispensed',
    CANCELLED: 'cancelled'
  };

  /**
   * Create a new refill request
   */
  async createRefillRequest(medicationRequestId, requestData) {
    try {
      // Get the original medication request
      const originalRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      
      // Check if refills are available
      const refillsAllowed = originalRequest.dispenseRequest?.numberOfRepeatsAllowed || 0;
      const refillsUsed = await this.getRefillsUsed(medicationRequestId);
      
      if (refillsUsed >= refillsAllowed) {
        throw new Error('No refills remaining for this prescription');
      }

      // Create refill request as a new MedicationRequest with specific intent
      const refillRequest = {
        resourceType: 'MedicationRequest',
        status: 'draft',
        intent: 'reflex-order', // Indicates this is a refill request
        priority: requestData.urgent ? 'urgent' : 'routine',
        
        // Link to original prescription
        basedOn: [{
          reference: `MedicationRequest/${medicationRequestId}`
        }],
        
        // Copy medication and patient info from original
        medicationCodeableConcept: originalRequest.medicationCodeableConcept,
        medicationReference: originalRequest.medicationReference,
        subject: originalRequest.subject,
        
        // Refill-specific information
        authoredOn: new Date().toISOString(),
        requester: requestData.requester || originalRequest.requester,
        
        // Copy dosage and dispense information
        dosageInstruction: originalRequest.dosageInstruction,
        dispenseRequest: {
          ...originalRequest.dispenseRequest,
          validityPeriod: {
            start: new Date().toISOString(),
            end: addDays(new Date(), 30).toISOString() // 30-day validity for refill request
          }
        },
        
        // Add refill-specific notes
        note: [
          ...(originalRequest.note || []),
          {
            text: `Refill request #${refillsUsed + 1} of ${refillsAllowed} for original prescription`,
            time: new Date().toISOString()
          },
          ...(requestData.patientNotes ? [{
            text: `Patient notes: ${requestData.patientNotes}`,
            time: new Date().toISOString()
          }] : [])
        ],
        
        // Add refill tracking extension
        extension: [
          {
            url: 'http://example.org/fhir/refill-request',
            extension: [
              {
                url: 'originalPrescription',
                valueReference: { reference: `MedicationRequest/${medicationRequestId}` }
              },
              {
                url: 'refillNumber',
                valueInteger: refillsUsed + 1
              },
              {
                url: 'requestedBy',
                valueString: requestData.requestedBy || 'patient'
              },
              {
                url: 'requestMethod',
                valueString: requestData.requestMethod || 'portal'
              },
              {
                url: 'urgent',
                valueBoolean: requestData.urgent || false
              }
            ]
          }
        ]
      };

      // Create the refill request
      const createdRequest = await fhirClient.create('MedicationRequest', refillRequest);
      
      // Update cache
      this.clearCache(originalRequest.subject?.reference?.split('/')[1]);
      
      return createdRequest;

    } catch (error) {
      console.error('Error creating refill request:', error);
      throw error;
    }
  }

  /**
   * Get refill requests for a patient
   */
  async getRefillRequests(patientId, status = null) {
    try {
      const searchParams = {
        patient: patientId,
        intent: 'reflex-order',
        _sort: '-_lastUpdated',
        _count: 50
      };

      if (status) {
        searchParams.status = status;
      }

      const response = await fhirClient.search('MedicationRequest', searchParams);
      const refillRequests = response.resources || [];

      // Enrich with original prescription data
      const enrichedRequests = await Promise.all(
        refillRequests.map(async (request) => {
          try {
            const originalRef = request.basedOn?.[0]?.reference;
            if (originalRef) {
              const [resourceType, resourceId] = originalRef.split('/');
              const originalRequest = await fhirClient.read(resourceType, resourceId);
              return {
                ...request,
                originalPrescription: originalRequest,
                refillInfo: this.extractRefillInfo(request)
              };
            }
            return {
              ...request,
              refillInfo: this.extractRefillInfo(request)
            };
          } catch (error) {
            console.error('Error enriching refill request:', error);
            return request;
          }
        })
      );

      return enrichedRequests;

    } catch (error) {
      console.error('Error fetching refill requests:', error);
      throw error;
    }
  }

  /**
   * Approve a refill request
   */
  async approveRefillRequest(refillRequestId, approvalData) {
    try {
      const refillRequest = await fhirClient.read('MedicationRequest', refillRequestId);
      
      const updatedRequest = {
        ...refillRequest,
        status: 'active',
        note: [
          ...(refillRequest.note || []),
          {
            text: `Refill approved by ${approvalData.approvedBy}${approvalData.notes ? `: ${approvalData.notes}` : ''}`,
            time: new Date().toISOString()
          }
        ],
        extension: [
          ...(refillRequest.extension || []),
          {
            url: 'http://example.org/fhir/refill-approval',
            extension: [
              {
                url: 'approvedBy',
                valueString: approvalData.approvedBy
              },
              {
                url: 'approvalDate',
                valueDateTime: new Date().toISOString()
              },
              {
                url: 'approvalNotes',
                valueString: approvalData.notes || ''
              }
            ]
          }
        ]
      };

      const result = await fhirClient.update('MedicationRequest', updatedRequest);
      
      // Clear cache
      this.clearCache(refillRequest.subject?.reference?.split('/')[1]);
      
      return result;

    } catch (error) {
      console.error('Error approving refill request:', error);
      throw error;
    }
  }

  /**
   * Reject a refill request
   */
  async rejectRefillRequest(refillRequestId, rejectionData) {
    try {
      const refillRequest = await fhirClient.read('MedicationRequest', refillRequestId);
      
      const updatedRequest = {
        ...refillRequest,
        status: 'cancelled',
        statusReason: [{
          text: rejectionData.reason || 'Refill request rejected'
        }],
        note: [
          ...(refillRequest.note || []),
          {
            text: `Refill rejected by ${rejectionData.rejectedBy}: ${rejectionData.reason}`,
            time: new Date().toISOString()
          }
        ]
      };

      const result = await fhirClient.update('MedicationRequest', updatedRequest);
      
      // Clear cache
      this.clearCache(refillRequest.subject?.reference?.split('/')[1]);
      
      return result;

    } catch (error) {
      console.error('Error rejecting refill request:', error);
      throw error;
    }
  }

  /**
   * Get refill history for a medication
   */
  async getRefillHistory(medicationRequestId) {
    try {
      const originalRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      const patientId = originalRequest.subject?.reference?.split('/')[1];
      
      if (!patientId) {
        throw new Error('Patient ID not found in medication request');
      }

      // Get all refill requests for this medication
      const refillRequests = await this.getRefillRequests(patientId);
      const relatedRefills = refillRequests.filter(refill => 
        refill.basedOn?.[0]?.reference === `MedicationRequest/${medicationRequestId}`
      );

      // Get dispense records
      const dispenseResponse = await fhirClient.search('MedicationDispense', {
        authorizingPrescription: medicationRequestId,
        _sort: '-whenHandedOver',
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
        ...relatedRefills.map(refill => ({
          type: 'refill-request',
          date: refill.authoredOn,
          data: refill,
          status: refill.status,
          refillInfo: refill.refillInfo
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
        refillsUsed: relatedRefills.filter(r => r.status === 'completed' || r.status === 'active').length,
        lastRefillDate: history
          .filter(h => h.type === 'dispense')
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0]?.date
      };

    } catch (error) {
      console.error('Error getting refill history:', error);
      throw error;
    }
  }

  /**
   * Calculate medication adherence based on refill patterns
   */
  async calculateMedicationAdherence(medicationRequestId, days = 90) {
    try {
      const history = await this.getRefillHistory(medicationRequestId);
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
      console.error('Error calculating medication adherence:', error);
      throw error;
    }
  }

  /**
   * Check if a medication is due for refill
   */
  async checkRefillEligibility(medicationRequestId) {
    try {
      const history = await this.getRefillHistory(medicationRequestId);
      const { originalPrescription, totalRefillsAllowed, refillsUsed } = history;
      
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
      console.error('Error checking refill eligibility:', error);
      throw error;
    }
  }

  /**
   * Get pending refill requests for a provider/pharmacy
   */
  async getPendingRefillRequests(facilityId = null) {
    try {
      const searchParams = {
        intent: 'reflex-order',
        status: 'draft',
        _sort: '-_lastUpdated',
        _count: 100
      };

      const response = await fhirClient.search('MedicationRequest', searchParams);
      const pendingRequests = response.resources || [];

      // Enrich with patient and original prescription data
      const enrichedRequests = await Promise.all(
        pendingRequests.map(async (request) => {
          try {
            // Get patient data
            const patientRef = request.subject?.reference;
            const patient = patientRef ? await fhirClient.read(...patientRef.split('/')) : null;
            
            // Get original prescription
            const originalRef = request.basedOn?.[0]?.reference;
            const originalPrescription = originalRef ? await fhirClient.read(...originalRef.split('/')) : null;
            
            return {
              ...request,
              patient,
              originalPrescription,
              refillInfo: this.extractRefillInfo(request)
            };
          } catch (error) {
            console.error('Error enriching pending refill request:', error);
            return request;
          }
        })
      );

      return enrichedRequests;

    } catch (error) {
      console.error('Error getting pending refill requests:', error);
      throw error;
    }
  }

  /**
   * Extract refill information from extensions
   */
  extractRefillInfo(medicationRequest) {
    const refillExtension = medicationRequest.extension?.find(
      ext => ext.url === 'http://example.org/fhir/refill-request'
    );

    if (!refillExtension) {
      return null;
    }

    const info = {};
    refillExtension.extension?.forEach(ext => {
      switch (ext.url) {
        case 'refillNumber':
          info.refillNumber = ext.valueInteger;
          break;
        case 'requestedBy':
          info.requestedBy = ext.valueString;
          break;
        case 'requestMethod':
          info.requestMethod = ext.valueString;
          break;
        case 'urgent':
          info.urgent = ext.valueBoolean;
          break;
      }
    });

    return info;
  }

  /**
   * Get number of refills used for a medication
   */
  async getRefillsUsed(medicationRequestId) {
    try {
      const dispenseResponse = await fhirClient.search('MedicationDispense', {
        authorizingPrescription: medicationRequestId,
        status: 'completed',
        _count: 100
      });

      return (dispenseResponse.resources || []).length;

    } catch (error) {
      console.error('Error getting refills used:', error);
      return 0;
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

  /**
   * Clear cache for patient
   */
  clearCache(patientId = null) {
    if (patientId) {
      this.refillCache.delete(patientId);
    } else {
      this.refillCache.clear();
    }
  }
}

// Export singleton instance
export const prescriptionRefillService = new PrescriptionRefillService();