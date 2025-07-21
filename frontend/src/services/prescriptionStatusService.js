/**
 * Prescription Status Tracking Service
 * Monitors and tracks the status of prescriptions from order to fulfillment
 */

import { fhirClient } from '../core/fhir/services/fhirClient';

class PrescriptionStatusService {
  constructor() {
    this.statusCache = new Map();
    this.statusUpdateCallbacks = new Map();
  }

  /**
   * Prescription status workflow stages
   */
  PRESCRIPTION_STATUSES = {
    ORDERED: {
      code: 'active',
      display: 'Ordered',
      description: 'Prescription has been ordered and sent to pharmacy',
      color: 'info',
      nextSteps: ['TRANSMITTED', 'CANCELLED']
    },
    TRANSMITTED: {
      code: 'active',
      display: 'Transmitted to Pharmacy',
      description: 'Prescription has been electronically transmitted',
      color: 'primary',
      nextSteps: ['RECEIVED', 'REJECTED']
    },
    RECEIVED: {
      code: 'active',
      display: 'Received by Pharmacy',
      description: 'Pharmacy has received and acknowledged the prescription',
      color: 'primary',
      nextSteps: ['IN_PROGRESS', 'ON_HOLD']
    },
    IN_PROGRESS: {
      code: 'active',
      display: 'Being Prepared',
      description: 'Pharmacy is preparing the medication',
      color: 'warning',
      nextSteps: ['READY', 'ON_HOLD']
    },
    READY: {
      code: 'active',
      display: 'Ready for Pickup',
      description: 'Medication is ready for patient pickup',
      color: 'success',
      nextSteps: ['DISPENSED', 'RETURNED']
    },
    DISPENSED: {
      code: 'completed',
      display: 'Dispensed',
      description: 'Medication has been dispensed to patient',
      color: 'success',
      nextSteps: []
    },
    ON_HOLD: {
      code: 'on-hold',
      display: 'On Hold',
      description: 'Prescription is on hold (insurance, stock, etc.)',
      color: 'warning',
      nextSteps: ['IN_PROGRESS', 'CANCELLED']
    },
    CANCELLED: {
      code: 'cancelled',
      display: 'Cancelled',
      description: 'Prescription has been cancelled',
      color: 'error',
      nextSteps: []
    },
    REJECTED: {
      code: 'entered-in-error',
      display: 'Rejected',
      description: 'Pharmacy rejected the prescription',
      color: 'error',
      nextSteps: []
    },
    RETURNED: {
      code: 'stopped',
      display: 'Returned to Stock',
      description: 'Medication was returned to stock',
      color: 'default',
      nextSteps: []
    }
  };

  /**
   * Get current status of a prescription
   */
  async getPrescriptionStatus(medicationRequestId) {
    try {
      // Check cache first
      if (this.statusCache.has(medicationRequestId)) {
        return this.statusCache.get(medicationRequestId);
      }

      // Fetch MedicationRequest
      const medicationRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      
      // Check for linked MedicationDispense records
      const dispenseSearch = await fhirClient.search('MedicationDispense', {
        prescription: `MedicationRequest/${medicationRequestId}`,
        _sort: '-whenHandedOver'
      });

      const dispenses = dispenseSearch?.entry?.map(e => e.resource) || [];
      
      // Determine status based on FHIR data
      const status = this.determinePrescriptionStatus(medicationRequest, dispenses);
      
      // Cache the status
      this.statusCache.set(medicationRequestId, status);
      
      return status;

    } catch (error) {
      return {
        status: 'UNKNOWN',
        statusCode: 'unknown',
        display: 'Status Unknown',
        description: 'Unable to determine prescription status',
        color: 'default',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Determine prescription status from FHIR resources
   */
  determinePrescriptionStatus(medicationRequest, dispenses) {
    const mrStatus = medicationRequest.status;
    const hasDispense = dispenses.length > 0;
    const latestDispense = dispenses[0];

    // Check extension for detailed status
    const statusExtension = medicationRequest.extension?.find(
      ext => ext.url === 'http://example.org/fhir/prescription-status'
    );
    const detailedStatus = statusExtension?.valueCode;

    // If we have a detailed status in extension, use it
    if (detailedStatus && this.PRESCRIPTION_STATUSES[detailedStatus]) {
      return {
        status: detailedStatus,
        ...this.PRESCRIPTION_STATUSES[detailedStatus],
        medicationRequestId: medicationRequest.id,
        lastUpdated: medicationRequest.meta?.lastUpdated || new Date().toISOString(),
        dispenseInfo: hasDispense ? {
          dispensedDate: latestDispense.whenHandedOver,
          quantity: latestDispense.quantity,
          daysSupply: latestDispense.daysSupply
        } : null
      };
    }

    // Otherwise, infer from standard FHIR status
    if (mrStatus === 'cancelled') {
      return {
        status: 'CANCELLED',
        ...this.PRESCRIPTION_STATUSES.CANCELLED,
        medicationRequestId: medicationRequest.id,
        lastUpdated: medicationRequest.meta?.lastUpdated || new Date().toISOString()
      };
    }

    if (mrStatus === 'on-hold') {
      return {
        status: 'ON_HOLD',
        ...this.PRESCRIPTION_STATUSES.ON_HOLD,
        medicationRequestId: medicationRequest.id,
        lastUpdated: medicationRequest.meta?.lastUpdated || new Date().toISOString()
      };
    }

    if (mrStatus === 'completed' || (hasDispense && latestDispense.status === 'completed')) {
      return {
        status: 'DISPENSED',
        ...this.PRESCRIPTION_STATUSES.DISPENSED,
        medicationRequestId: medicationRequest.id,
        lastUpdated: latestDispense?.meta?.lastUpdated || medicationRequest.meta?.lastUpdated,
        dispenseInfo: {
          dispensedDate: latestDispense.whenHandedOver,
          quantity: latestDispense.quantity,
          daysSupply: latestDispense.daysSupply
        }
      };
    }

    if (hasDispense && latestDispense.status === 'preparation') {
      return {
        status: 'IN_PROGRESS',
        ...this.PRESCRIPTION_STATUSES.IN_PROGRESS,
        medicationRequestId: medicationRequest.id,
        lastUpdated: latestDispense.meta?.lastUpdated || medicationRequest.meta?.lastUpdated
      };
    }

    // Default to ORDERED for active prescriptions
    if (mrStatus === 'active') {
      return {
        status: 'ORDERED',
        ...this.PRESCRIPTION_STATUSES.ORDERED,
        medicationRequestId: medicationRequest.id,
        lastUpdated: medicationRequest.meta?.lastUpdated || new Date().toISOString()
      };
    }

    return {
      status: 'UNKNOWN',
      statusCode: mrStatus,
      display: 'Unknown Status',
      description: `Prescription status: ${mrStatus}`,
      color: 'default',
      medicationRequestId: medicationRequest.id,
      lastUpdated: medicationRequest.meta?.lastUpdated || new Date().toISOString()
    };
  }

  /**
   * Update prescription status
   */
  async updatePrescriptionStatus(medicationRequestId, newStatus, notes = '') {
    try {
      // Validate status transition
      const currentStatus = await this.getPrescriptionStatus(medicationRequestId);
      const statusDef = this.PRESCRIPTION_STATUSES[newStatus];
      
      if (!statusDef) {
        throw new Error(`Invalid status: ${newStatus}`);
      }

      // Check if transition is allowed
      if (currentStatus.status !== 'UNKNOWN' && 
          statusDef.nextSteps && 
          !currentStatus.nextSteps?.includes(newStatus)) {
        throw new Error(
          `Invalid status transition from ${currentStatus.display} to ${statusDef.display}`
        );
      }

      // Update MedicationRequest with new status
      const medicationRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      
      // Update extension with detailed status
      if (!medicationRequest.extension) {
        medicationRequest.extension = [];
      }

      const statusExtIndex = medicationRequest.extension.findIndex(
        ext => ext.url === 'http://example.org/fhir/prescription-status'
      );

      const statusExtension = {
        url: 'http://example.org/fhir/prescription-status',
        valueCode: newStatus
      };

      if (statusExtIndex >= 0) {
        medicationRequest.extension[statusExtIndex] = statusExtension;
      } else {
        medicationRequest.extension.push(statusExtension);
      }

      // Add status history
      const historyExtension = {
        url: 'http://example.org/fhir/prescription-status-history',
        extension: [
          {
            url: 'status',
            valueCode: newStatus
          },
          {
            url: 'timestamp',
            valueDateTime: new Date().toISOString()
          },
          {
            url: 'notes',
            valueString: notes
          }
        ]
      };

      medicationRequest.extension.push(historyExtension);

      // Update base status if needed
      if (statusDef.code !== medicationRequest.status) {
        medicationRequest.status = statusDef.code;
      }

      // Save updated MedicationRequest
      const updated = await fhirClient.update('MedicationRequest', medicationRequest);

      // Clear cache
      this.statusCache.delete(medicationRequestId);

      // Notify callbacks
      this.notifyStatusUpdate(medicationRequestId, {
        status: newStatus,
        ...statusDef,
        medicationRequestId,
        lastUpdated: updated.meta?.lastUpdated || new Date().toISOString()
      });

      return updated;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get prescription status history
   */
  async getPrescriptionStatusHistory(medicationRequestId) {
    try {
      const medicationRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      
      const history = [];
      
      // Extract status history from extensions
      const historyExtensions = medicationRequest.extension?.filter(
        ext => ext.url === 'http://example.org/fhir/prescription-status-history'
      ) || [];

      historyExtensions.forEach(ext => {
        const status = ext.extension?.find(e => e.url === 'status')?.valueCode;
        const timestamp = ext.extension?.find(e => e.url === 'timestamp')?.valueDateTime;
        const notes = ext.extension?.find(e => e.url === 'notes')?.valueString;

        if (status && timestamp) {
          const statusDef = this.PRESCRIPTION_STATUSES[status] || {};
          history.push({
            status,
            display: statusDef.display || status,
            timestamp,
            notes,
            color: statusDef.color || 'default'
          });
        }
      });

      // Add creation as first history entry if no history
      if (history.length === 0 && medicationRequest.authoredOn) {
        history.push({
          status: 'ORDERED',
          display: 'Ordered',
          timestamp: medicationRequest.authoredOn,
          notes: 'Prescription created',
          color: 'info'
        });
      }

      // Sort by timestamp descending
      history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return history;

    } catch (error) {
      return [];
    }
  }

  /**
   * Track prescriptions for a patient
   */
  async getPatientPrescriptionStatuses(patientId, options = {}) {
    const { status = null, dateRange = null } = options;

    try {
      // Search for patient's medication requests
      const searchParams = {
        patient: patientId,
        _sort: '-date',
        _count: 100
      };

      if (status && status !== 'all') {
        searchParams.status = status;
      }

      const medicationRequests = await fhirClient.search('MedicationRequest', searchParams);
      const requests = medicationRequests?.entry?.map(e => e.resource) || [];

      // Get status for each prescription
      const statuses = await Promise.all(
        requests.map(async (request) => {
          const status = await this.getPrescriptionStatus(request.id);
          return {
            ...status,
            medication: request.medicationCodeableConcept?.text || 
                       request.medicationCodeableConcept?.coding?.[0]?.display ||
                       'Unknown medication',
            authoredOn: request.authoredOn,
            prescriber: request.requester?.display,
            dosageInstructions: request.dosageInstruction?.[0]?.text
          };
        })
      );

      // Filter by date range if provided
      if (dateRange) {
        return statuses.filter(s => {
          const date = new Date(s.authoredOn);
          return date >= dateRange.start && date <= dateRange.end;
        });
      }

      return statuses;

    } catch (error) {
      return [];
    }
  }

  /**
   * Subscribe to status updates for a prescription
   */
  subscribeToStatusUpdates(medicationRequestId, callback) {
    if (!this.statusUpdateCallbacks.has(medicationRequestId)) {
      this.statusUpdateCallbacks.set(medicationRequestId, new Set());
    }
    this.statusUpdateCallbacks.get(medicationRequestId).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.statusUpdateCallbacks.get(medicationRequestId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.statusUpdateCallbacks.delete(medicationRequestId);
        }
      }
    };
  }

  /**
   * Notify status update callbacks
   */
  notifyStatusUpdate(medicationRequestId, status) {
    const callbacks = this.statusUpdateCallbacks.get(medicationRequestId);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(status);
        } catch (error) {
          // Skip failed callback
        }
      });
    }
  }

  /**
   * Clear cache for a specific prescription or all
   */
  clearCache(medicationRequestId = null) {
    if (medicationRequestId) {
      this.statusCache.delete(medicationRequestId);
    } else {
      this.statusCache.clear();
    }
  }
}

// Export singleton instance
export const prescriptionStatusService = new PrescriptionStatusService();