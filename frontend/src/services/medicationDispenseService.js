/**
 * MedicationDispense Service
 * Enhanced service for MedicationDispense FHIR resource operations
 * Part of Phase 1 Implementation: MedicationDispense Integration
 * Updated Phase 2: Integration with backend pharmacy API
 */
import { fhirClient } from '../core/fhir/services/fhirClient';
import { pharmacyService } from './pharmacyService';

class MedicationDispenseService {
  /**
   * Create a new MedicationDispense resource
   * Now uses pharmacy API for better integration
   */
  async createMedicationDispense(dispenseData) {
    // Validate required fields
    this.validateDispenseData(dispenseData);
    
    // If we have a prescription ID, use the pharmacy API
    if (dispenseData.prescriptionId || dispenseData.medication_request_id) {
      try {
        const pharmacyDispenseData = {
          medication_request_id: dispenseData.prescriptionId || dispenseData.medication_request_id,
          quantity: dispenseData.quantity?.value || dispenseData.quantity,
          lot_number: dispenseData.lotNumber || '',
          expiration_date: dispenseData.expirationDate || '',
          pharmacist_notes: dispenseData.note?.[0]?.text || dispenseData.pharmacistNotes || '',
          pharmacist_id: dispenseData.performer?.[0]?.actor?.reference?.replace('Practitioner/', '') || dispenseData.pharmacistId
        };
        
        const result = await pharmacyService.dispenseMedication(pharmacyDispenseData);
        
        // Get the created dispense resource
        if (result.dispense_id) {
          return await fhirClient.read('MedicationDispense', result.dispense_id);
        }
      } catch (error) {
        console.error('Pharmacy API error, falling back to FHIR API:', error);
        // Fall through to FHIR API
      }
    }
    
    // Fallback to direct FHIR API
    const medicationDispense = this.prepareFHIRResource(dispenseData);
    const response = await fhirClient.create('MedicationDispense', medicationDispense);
    
    return response;
  }
  
  /**
   * Search MedicationDispense resources with enhanced parameters
   */
  async searchMedicationDispenses(searchParams = {}) {
    try {
      const response = await fhirClient.search('MedicationDispense', searchParams);
      return response;
    } catch (error) {
      // Handle case where MedicationDispense is not yet implemented
      if (error.response?.status === 404) {
        console.info('MedicationDispense resource not yet implemented');
        return {
          resources: [],
          total: 0,
          bundle: { resourceType: 'Bundle', entry: [] }
        };
      }
      throw error;
    }
  }
  
  /**
   * Get MedicationDispense by prescription ID
   */
  async getDispensesByPrescription(prescriptionId) {
    const searchParams = {
      prescription: prescriptionId,
      _sort: '-whenhandover'
    };
    
    const response = await this.searchMedicationDispenses(searchParams);
    return response.resources || [];
  }
  
  /**
   * Get MedicationDispense by patient ID
   */
  async getDispensesByPatient(patientId, options = {}) {
    const searchParams = {
      subject: patientId,
      _sort: options.sort || '-whenhandover',
      _count: options.limit || 50,
      ...options.additionalParams
    };
    
    // Add date range if specified
    if (options.startDate) {
      searchParams['whenhandover'] = `ge${options.startDate}`;
    }
    if (options.endDate) {
      searchParams['whenhandover'] = searchParams['whenhandover'] ? 
        `${searchParams['whenhandover']}&whenhandover=le${options.endDate}` :
        `le${options.endDate}`;
    }
    
    const response = await this.searchMedicationDispenses(searchParams);
    return response.resources || [];
  }
  
  /**
   * Get MedicationDispense by status
   */
  async getDispensesByStatus(status, patientId = null) {
    const searchParams = {
      status: status,
      _sort: '-whenhandover'
    };
    
    if (patientId) {
      searchParams.subject = patientId;
    }
    
    const response = await this.searchMedicationDispenses(searchParams);
    return response.resources || [];
  }
  
  /**
   * Update MedicationDispense status
   */
  async updateDispenseStatus(dispenseId, newStatus, additionalData = {}) {
    const existingDispense = await fhirClient.read('MedicationDispense', dispenseId);
    
    const updatedDispense = {
      ...existingDispense,
      status: newStatus,
      ...additionalData
    };
    
    // Add timestamp based on status
    if (newStatus === 'completed' && !updatedDispense.whenHandedOver) {
      updatedDispense.whenHandedOver = new Date().toISOString();
    }
    
    return await fhirClient.update('MedicationDispense', dispenseId, updatedDispense);
  }
  
  /**
   * Create dispense from prescription
   */
  async createDispenseFromPrescription(prescriptionId, dispenseData) {
    // Get the original prescription
    const prescription = await fhirClient.read('MedicationRequest', prescriptionId);
    
    // Prepare dispense data with prescription context
    const enhancedDispenseData = {
      ...dispenseData,
      subject: prescription.subject,
      authorizingPrescription: [{
        reference: `MedicationRequest/${prescriptionId}`
      }],
      medicationCodeableConcept: prescription.medicationCodeableConcept || dispenseData.medicationCodeableConcept,
      medicationReference: prescription.medicationReference || dispenseData.medicationReference,
      // Copy dosage instructions if not provided
      dosageInstruction: dispenseData.dosageInstruction || prescription.dosageInstruction || []
    };
    
    return await this.createMedicationDispense(enhancedDispenseData);
  }
  
  /**
   * Get dispensing metrics for a patient or facility
   */
  async getDispensingMetrics(patientId = null, dateRange = null) {
    const searchParams = {
      _sort: '-whenhandover',
      _count: 100 // Reasonable limit for metrics
    };
    
    if (patientId) {
      searchParams.subject = patientId;
    }
    
    if (dateRange) {
      if (dateRange.start) {
        searchParams['whenhandover'] = `ge${dateRange.start}`;
      }
      if (dateRange.end) {
        searchParams['whenhandover'] = searchParams['whenhandover'] ? 
          `${searchParams['whenhandover']}&whenhandover=le${dateRange.end}` :
          `le${dateRange.end}`;
      }
    }
    
    const response = await this.searchMedicationDispenses(searchParams);
    const dispenses = response.resources || [];
    
    return this.calculateMetrics(dispenses);
  }
  
  /**
   * Validate dispense data before creation
   */
  validateDispenseData(dispenseData) {
    const required = ['status', 'subject'];
    const missing = required.filter(field => !dispenseData[field]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    // Validate medication reference or codeable concept
    if (!dispenseData.medicationCodeableConcept && !dispenseData.medicationReference) {
      throw new Error('Either medicationCodeableConcept or medicationReference is required');
    }
    
    // Validate status
    const validStatuses = ['preparation', 'in-progress', 'cancelled', 'on-hold', 
                          'completed', 'entered-in-error', 'stopped', 'declined', 'unknown'];
    if (!validStatuses.includes(dispenseData.status)) {
      throw new Error(`Invalid status: ${dispenseData.status}`);
    }
    
    return true;
  }
  
  /**
   * Prepare FHIR resource from dispense data
   */
  prepareFHIRResource(dispenseData) {
    return {
      resourceType: 'MedicationDispense',
      status: dispenseData.status,
      medicationCodeableConcept: dispenseData.medicationCodeableConcept,
      medicationReference: dispenseData.medicationReference,
      subject: dispenseData.subject,
      context: dispenseData.context,
      authorizingPrescription: dispenseData.authorizingPrescription || [],
      quantity: dispenseData.quantity,
      daysSupply: dispenseData.daysSupply,
      whenPrepared: dispenseData.whenPrepared,
      whenHandedOver: dispenseData.whenHandedOver,
      destination: dispenseData.destination,
      receiver: dispenseData.receiver,
      note: dispenseData.note || [],
      dosageInstruction: dispenseData.dosageInstruction || [],
      substitution: dispenseData.substitution,
      performer: dispenseData.performer || [],
      location: dispenseData.location,
      type: dispenseData.type,
      partOf: dispenseData.partOf
    };
  }
  
  /**
   * Calculate metrics from dispense list
   */
  calculateMetrics(dispenses) {
    const metrics = {
      total: dispenses.length,
      byStatus: {},
      byMedication: {},
      byPerformer: {},
      byTimeOfDay: {},
      totalQuantity: 0,
      averageQuantity: 0,
      timeMetrics: {
        averagePreparationTime: 0,
        averageHandoverTime: 0
      }
    };
    
    let totalQuantity = 0;
    let handoverTimes = [];
    
    dispenses.forEach(dispense => {
      // By status
      const status = dispense.status || 'unknown';
      metrics.byStatus[status] = (metrics.byStatus[status] || 0) + 1;
      
      // By medication
      const medicationName = this.getMedicationName(dispense);
      metrics.byMedication[medicationName] = (metrics.byMedication[medicationName] || 0) + 1;
      
      // By performer
      const performer = dispense.performer?.[0]?.actor?.display || 'Unknown';
      metrics.byPerformer[performer] = (metrics.byPerformer[performer] || 0) + 1;
      
      // By time of day
      if (dispense.whenHandedOver) {
        const hour = new Date(dispense.whenHandedOver).getHours();
        const timeSlot = this.getTimeSlot(hour);
        metrics.byTimeOfDay[timeSlot] = (metrics.byTimeOfDay[timeSlot] || 0) + 1;
      }
      
      // Quantity metrics
      if (dispense.quantity?.value) {
        totalQuantity += dispense.quantity.value;
      }
      
      // Time metrics
      if (dispense.whenPrepared && dispense.whenHandedOver) {
        const prepTime = new Date(dispense.whenPrepared);
        const handoverTime = new Date(dispense.whenHandedOver);
        const diffMinutes = (handoverTime - prepTime) / (1000 * 60);
        if (diffMinutes > 0) {
          handoverTimes.push(diffMinutes);
        }
      }
    });
    
    metrics.totalQuantity = totalQuantity;
    metrics.averageQuantity = dispenses.length > 0 ? totalQuantity / dispenses.length : 0;
    
    if (handoverTimes.length > 0) {
      metrics.timeMetrics.averageHandoverTime = 
        handoverTimes.reduce((sum, time) => sum + time, 0) / handoverTimes.length;
    }
    
    return metrics;
  }
  
  /**
   * Get medication name from dispense
   */
  getMedicationName(dispense) {
    if (dispense.medicationCodeableConcept?.text) {
      return dispense.medicationCodeableConcept.text;
    }
    if (dispense.medicationCodeableConcept?.coding?.[0]?.display) {
      return dispense.medicationCodeableConcept.coding[0].display;
    }
    if (dispense.medicationReference?.display) {
      return dispense.medicationReference.display;
    }
    return 'Unknown Medication';
  }
  
  /**
   * Get time slot for hour
   */
  getTimeSlot(hour) {
    if (hour >= 6 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 18) return 'Afternoon';
    if (hour >= 18 && hour < 22) return 'Evening';
    return 'Night';
  }
  
  /**
   * Validate dispensing workflow prerequisites
   */
  async validateDispensingPrerequisites(prescriptionId, patientId) {
    const validation = {
      valid: true,
      issues: [],
      warnings: []
    };
    
    try {
      // Check prescription exists and is active
      const prescription = await fhirClient.read('MedicationRequest', prescriptionId);
      if (prescription.status !== 'active') {
        validation.issues.push(`Prescription status is ${prescription.status}, not active`);
        validation.valid = false;
      }
      
      // Check for existing dispenses
      const existingDispenses = await this.getDispensesByPrescription(prescriptionId);
      if (existingDispenses.length > 0) {
        const completedDispenses = existingDispenses.filter(d => d.status === 'completed');
        if (completedDispenses.length > 0) {
          validation.warnings.push(`${completedDispenses.length} completed dispenses already exist`);
        }
      }
      
      // Check medication inventory if code available
      if (prescription.medicationCodeableConcept?.coding?.[0]?.code) {
        try {
          const inventory = await pharmacyService.checkMedicationInventory(
            prescription.medicationCodeableConcept.coding[0].code
          );
          if (inventory.status !== 'in_stock') {
            validation.warnings.push(`Medication inventory status: ${inventory.status}`);
          }
        } catch (error) {
          validation.warnings.push('Unable to check medication inventory');
        }
      }
      
      // Check patient allergies (would integrate with allergy checking service)
      validation.warnings.push('Allergy checking not yet implemented');
      
      // Check drug interactions (would integrate with interaction checking service)
      validation.warnings.push('Drug interaction checking not yet implemented');
      
    } catch (error) {
      validation.issues.push(`Error validating prerequisites: ${error.message}`);
      validation.valid = false;
    }
    
    return validation;
  }
  
  /**
   * Get pharmacy queue for patient
   */
  async getPatientPharmacyQueue(patientId) {
    try {
      return await pharmacyService.getPharmacyQueue({ patientId });
    } catch (error) {
      console.error('Error fetching patient pharmacy queue:', error);
      return [];
    }
  }
  
  /**
   * Update pharmacy workflow status
   */
  async updatePharmacyStatus(medicationRequestId, status, notes, updatedBy) {
    try {
      return await pharmacyService.updatePharmacyStatus(medicationRequestId, {
        status,
        notes,
        updated_by: updatedBy
      });
    } catch (error) {
      console.error('Error updating pharmacy status:', error);
      throw error;
    }
  }
  
  /**
   * Complete pharmacy dispensing workflow
   */
  async completePharmacyDispensing(prescriptionId, dispenseData) {
    try {
      // Validate prerequisites first
      const validation = await this.validateDispensingPrerequisites(
        prescriptionId,
        dispenseData.patientId
      );
      
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.issues.join(', ')}`);
      }
      
      // Use pharmacy service for complete workflow
      const result = await pharmacyService.completeDispensing(prescriptionId, {
        quantity: dispenseData.quantity,
        lotNumber: dispenseData.lotNumber,
        expirationDate: dispenseData.expirationDate,
        notes: dispenseData.notes,
        pharmacistId: dispenseData.pharmacistId
      });
      
      return result;
    } catch (error) {
      console.error('Error completing pharmacy dispensing:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const medicationDispenseService = new MedicationDispenseService();
export default medicationDispenseService;