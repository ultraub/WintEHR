/**
 * MedicationDispense Service
 * Enhanced service for MedicationDispense FHIR resource operations
 * Part of Phase 1 Implementation: MedicationDispense Integration
 */
import { fhirClient } from '../core/fhir/services/fhirClient';

class MedicationDispenseService {
  /**
   * Create a new MedicationDispense resource
   */
  async createMedicationDispense(dispenseData) {
    // Validate required fields
    this.validateDispenseData(dispenseData);
    
    // Prepare the FHIR resource
    const medicationDispense = this.prepareFHIRResource(dispenseData);
    
    // Create the resource
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
}

// Create singleton instance
export const medicationDispenseService = new MedicationDispenseService();
export default medicationDispenseService;