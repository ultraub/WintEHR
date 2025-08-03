/**
 * Pharmacy Service
 * Enhanced service for pharmacy operations using backend pharmacy API
 * Integrates with medication dispensing, queue management, and pharmacy workflows
 */

import { api } from './api';
import { fhirClient } from '../core/fhir/services/fhirClient';

class PharmacyService {
  constructor() {
    this.baseUrl = '/api/clinical/pharmacy';
    this.cache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache for queue
  }

  /**
   * Get pharmacy queue with optional filtering
   */
  async getPharmacyQueue(filters = {}) {
    const { status, patientId, priority } = filters;
    
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (patientId) params.append('patient_id', patientId);
    if (priority) params.append('priority', priority);
    
    const cacheKey = `queue_${params.toString()}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }
    
    try {
      const response = await api.get(`${this.baseUrl}/queue?${params.toString()}`);
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching pharmacy queue:', error);
      throw error;
    }
  }

  /**
   * Dispense medication with pharmacy API
   */
  async dispenseMedication(dispenseData) {
    try {
      // Validate required fields
      if (!dispenseData.medication_request_id) {
        throw new Error('medication_request_id is required');
      }
      if (!dispenseData.quantity) {
        throw new Error('quantity is required');
      }
      
      const response = await api.post(`${this.baseUrl}/dispense`, dispenseData);
      
      // Clear cache after dispensing
      this.clearQueueCache();
      
      return response.data;
    } catch (error) {
      console.error('Error dispensing medication:', error);
      throw error;
    }
  }

  /**
   * Update pharmacy status for a medication request
   */
  async updatePharmacyStatus(medicationRequestId, statusUpdate) {
    try {
      const response = await api.put(
        `${this.baseUrl}/status/${medicationRequestId}`,
        statusUpdate
      );
      
      // Clear cache after status update
      this.clearQueueCache();
      
      return response.data;
    } catch (error) {
      console.error('Error updating pharmacy status:', error);
      throw error;
    }
  }

  /**
   * Get pharmacy metrics
   */
  async getPharmacyMetrics(dateRange = 7) {
    try {
      const response = await api.get(`${this.baseUrl}/metrics?date_range=${dateRange}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching pharmacy metrics:', error);
      throw error;
    }
  }

  /**
   * Check medication inventory
   */
  async checkMedicationInventory(medicationCode) {
    try {
      const response = await api.get(`${this.baseUrl}/inventory/check/${medicationCode}`);
      return response.data;
    } catch (error) {
      console.error('Error checking medication inventory:', error);
      throw error;
    }
  }

  /**
   * Get dispense history for a patient
   */
  async getPatientDispenseHistory(patientId, options = {}) {
    try {
      // Use FHIR API for dispense history
      const searchParams = {
        subject: `Patient/${patientId}`,
        _sort: '-whenhandedover',
        _count: options.limit || 50
      };
      
      if (options.startDate) {
        searchParams['whenhandedover'] = `ge${options.startDate}`;
      }
      if (options.endDate) {
        searchParams['whenhandedover'] = searchParams['whenhandedover'] ? 
          `${searchParams['whenhandedover']}&whenhandedover=le${options.endDate}` :
          `le${options.endDate}`;
      }
      
      const response = await fhirClient.search('MedicationDispense', searchParams);
      return response.resources || [];
    } catch (error) {
      console.error('Error fetching dispense history:', error);
      // Return empty array if MedicationDispense not implemented
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics() {
    try {
      const queue = await this.getPharmacyQueue();
      
      const stats = {
        total: queue.length,
        byStatus: {},
        byPriority: {},
        overdue: 0,
        avgWaitTime: 0
      };
      
      let totalWaitTime = 0;
      let waitTimeCount = 0;
      
      queue.forEach(item => {
        // Count by status
        stats.byStatus[item.status] = (stats.byStatus[item.status] || 0) + 1;
        
        // Count by priority
        stats.byPriority[item.priority] = (stats.byPriority[item.priority] || 0) + 1;
        
        // Check overdue
        if (item.due_date && new Date(item.due_date) < new Date()) {
          stats.overdue++;
        }
        
        // Calculate wait time
        if (item.prescribed_date) {
          const waitTime = Date.now() - new Date(item.prescribed_date).getTime();
          totalWaitTime += waitTime;
          waitTimeCount++;
        }
      });
      
      // Calculate average wait time in hours
      if (waitTimeCount > 0) {
        stats.avgWaitTime = Math.round(totalWaitTime / waitTimeCount / (1000 * 60 * 60));
      }
      
      return stats;
    } catch (error) {
      console.error('Error calculating queue statistics:', error);
      throw error;
    }
  }

  /**
   * Process prescription for dispensing
   */
  async processPrescription(prescriptionId, processingData = {}) {
    try {
      // First, update the pharmacy status to 'verified'
      await this.updatePharmacyStatus(prescriptionId, {
        status: 'verified',
        notes: processingData.notes || 'Prescription verified',
        updated_by: processingData.pharmacistId
      });
      
      // Check inventory if medication code provided
      if (processingData.medicationCode) {
        const inventory = await this.checkMedicationInventory(processingData.medicationCode);
        if (inventory.status !== 'in_stock') {
          throw new Error(`Medication not in stock: ${inventory.status}`);
        }
      }
      
      return {
        success: true,
        message: 'Prescription ready for dispensing'
      };
    } catch (error) {
      console.error('Error processing prescription:', error);
      throw error;
    }
  }

  /**
   * Complete dispensing workflow
   */
  async completeDispensing(prescriptionId, dispenseData) {
    try {
      // Create the dispense record
      const dispenseResult = await this.dispenseMedication({
        medication_request_id: prescriptionId,
        quantity: dispenseData.quantity,
        lot_number: dispenseData.lotNumber,
        expiration_date: dispenseData.expirationDate,
        pharmacist_notes: dispenseData.notes,
        pharmacist_id: dispenseData.pharmacistId
      });
      
      // Update pharmacy status to completed
      await this.updatePharmacyStatus(prescriptionId, {
        status: 'completed',
        notes: 'Medication dispensed',
        updated_by: dispenseData.pharmacistId
      });
      
      return {
        success: true,
        dispenseId: dispenseResult.dispense_id,
        message: 'Medication dispensed successfully'
      };
    } catch (error) {
      console.error('Error completing dispensing:', error);
      throw error;
    }
  }

  /**
   * Clear queue cache
   */
  clearQueueCache() {
    // Clear all queue-related cache entries
    for (const key of this.cache.keys()) {
      if (key.startsWith('queue_')) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Subscribe to pharmacy updates
   */
  subscribeToUpdates(callback) {
    // This would integrate with WebSocket for real-time updates
    // For now, return a mock unsubscribe function
    console.log('Pharmacy update subscription would be implemented here');
    return () => {
      console.log('Unsubscribed from pharmacy updates');
    };
  }

  /**
   * Get priority levels
   */
  getPriorityLevels() {
    return [
      { value: 1, label: 'Urgent', color: 'error' },
      { value: 2, label: 'High', color: 'warning' },
      { value: 3, label: 'Normal', color: 'info' },
      { value: 4, label: 'Low', color: 'default' },
      { value: 5, label: 'Scheduled', color: 'default' }
    ];
  }

  /**
   * Get status options
   */
  getStatusOptions() {
    return [
      { value: 'pending', label: 'Pending', color: 'default' },
      { value: 'verified', label: 'Verified', color: 'info' },
      { value: 'dispensed', label: 'Dispensed', color: 'warning' },
      { value: 'ready', label: 'Ready for Pickup', color: 'success' },
      { value: 'completed', label: 'Completed', color: 'success' }
    ];
  }
}

// Create singleton instance
export const pharmacyService = new PharmacyService();
export default pharmacyService;