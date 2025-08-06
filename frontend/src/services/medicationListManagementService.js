/**
 * Medication List Management Service
 * Manages automatic medication list updates and synchronization
 */

import { fhirClient } from '../core/fhir/services/fhirClient';

class MedicationListManagementService {
  constructor() {
    this.updateCallbacks = new Map();
    this.medicationLists = new Map();
    this.autoUpdateEnabled = true;
  }


  /**
   * List types for medication management
   */
  LIST_TYPES = {
    CURRENT_MEDICATIONS: 'current-medications',
    ACTIVE_PRESCRIPTIONS: 'active-prescriptions',
    MEDICATION_HISTORY: 'medication-history',
    RECONCILIATION_LIST: 'reconciliation-list'
  };

  /**
   * Initialize medication list management for a patient
   */
  async initializePatientMedicationLists(patientId) {
    try {
      // Create or update current medications list
      const currentMedsList = await this.ensureMedicationList(
        patientId, 
        this.LIST_TYPES.CURRENT_MEDICATIONS,
        'Current Medications',
        'Current active medications for patient'
      );

      // Create or update active prescriptions list
      const activePrescriptionsList = await this.ensureMedicationList(
        patientId,
        this.LIST_TYPES.ACTIVE_PRESCRIPTIONS,
        'Active Prescriptions',
        'Currently active prescription orders'
      );

      // Cache the lists
      this.medicationLists.set(`${patientId}-current`, currentMedsList);
      this.medicationLists.set(`${patientId}-prescriptions`, activePrescriptionsList);

      return {
        currentMedications: currentMedsList,
        activePrescriptions: activePrescriptionsList
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Ensure a medication list exists, create if not found
   */
  async ensureMedicationList(patientId, listType, title, description) {
    try {
      // Search for existing list
      const existingLists = await fhirClient.search('List', {
        patient: patientId,
        code: `http://example.org/medication-list-types|${listType}`,
        status: 'current'
      });

      if (existingLists.resources && existingLists.resources.length > 0) {
        return existingLists.resources[0];
      }

      // Create new list if none exists
      const newList = {
        resourceType: 'List',
        status: 'current',
        mode: 'working',
        title,
        code: {
          coding: [{
            system: 'http://example.org/medication-list-types',
            code: listType,
            display: title
          }]
        },
        subject: { reference: `Patient/${patientId}` },
        date: new Date().toISOString(),
        source: {
          reference: 'Device/medication-management-system'
        },
        note: [{
          text: description
        }],
        entry: []
      };

      return await fhirClient.create('List', newList);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle new prescription created - update medication lists
   */
  async handleNewPrescription(medicationRequest) {
    if (!this.autoUpdateEnabled) return;

    try {
      const patientId = medicationRequest.subject?.reference?.split('/')[1];
      if (!patientId) return;

      // Initialize lists if not already done
      await this.initializePatientMedicationLists(patientId);

      // Add to active prescriptions list
      await this.addMedicationToList(
        patientId,
        this.LIST_TYPES.ACTIVE_PRESCRIPTIONS,
        medicationRequest,
        'prescription-created'
      );

      // If prescription is for ongoing therapy, add to current medications
      if (medicationRequest.intent === 'order' && medicationRequest.status === 'active') {
        await this.addMedicationToCurrentList(patientId, medicationRequest);
      }

      // Notify subscribers
      this.notifyListUpdated(patientId, this.LIST_TYPES.ACTIVE_PRESCRIPTIONS, 'add', medicationRequest);

    } catch (error) {
      // Error handling for prescription workflow
    }
  }

  /**
   * Handle prescription status update
   */
  async handlePrescriptionStatusUpdate(medicationRequestId, newStatus, oldStatus) {
    if (!this.autoUpdateEnabled) return;

    try {
      const medicationRequest = await fhirClient.read('MedicationRequest', medicationRequestId);
      const patientId = medicationRequest.subject?.reference?.split('/')[1];
      
      if (!patientId) return;

      // Handle status-specific updates
      switch (newStatus) {
        case 'completed':
          await this.handlePrescriptionCompleted(patientId, medicationRequest);
          break;
        case 'stopped':
        case 'cancelled':
          await this.handlePrescriptionStopped(patientId, medicationRequest);
          break;
        case 'on-hold':
          await this.handlePrescriptionOnHold(patientId, medicationRequest);
          break;
        default:
          // No specific handling required for other statuses (e.g., 'active', 'draft')
          break;
      }

    } catch (error) {
      // Error handling for status update
    }
  }

  /**
   * Handle prescription completion
   */
  async handlePrescriptionCompleted(patientId, medicationRequest) {
    // Remove from active prescriptions, add to history
    await this.removeMedicationFromList(
      patientId,
      this.LIST_TYPES.ACTIVE_PRESCRIPTIONS,
      medicationRequest.id
    );

    // Check if this should remain on current medications (ongoing therapy)
    const isOngoingTherapy = this.isOngoingTherapy(medicationRequest);
    if (!isOngoingTherapy) {
      await this.removeMedicationFromList(
        patientId,
        this.LIST_TYPES.CURRENT_MEDICATIONS,
        medicationRequest.id
      );
    }
  }

  /**
   * Handle prescription stopped/cancelled
   */
  async handlePrescriptionStopped(patientId, medicationRequest) {
    // Remove from both active prescriptions and current medications
    await this.removeMedicationFromList(
      patientId,
      this.LIST_TYPES.ACTIVE_PRESCRIPTIONS,
      medicationRequest.id
    );

    await this.removeMedicationFromList(
      patientId,
      this.LIST_TYPES.CURRENT_MEDICATIONS,
      medicationRequest.id
    );
  }

  /**
   * Handle prescription on hold
   */
  async handlePrescriptionOnHold(patientId, medicationRequest) {
    // Update list entries to reflect on-hold status
    await this.updateMedicationInList(
      patientId,
      this.LIST_TYPES.ACTIVE_PRESCRIPTIONS,
      medicationRequest.id,
      { status: 'on-hold', note: 'Prescription on hold' }
    );
  }

  /**
   * Add medication to current medications list
   */
  async addMedicationToCurrentList(patientId, medicationRequest) {
    // Check for duplicates first
    const isDuplicate = await this.checkForDuplicateMedication(
      patientId,
      medicationRequest,
      this.LIST_TYPES.CURRENT_MEDICATIONS
    );

    if (!isDuplicate) {
      await this.addMedicationToList(
        patientId,
        this.LIST_TYPES.CURRENT_MEDICATIONS,
        medicationRequest,
        'active-medication'
      );
    }
  }

  /**
   * Add medication to a specific list
   */
  async addMedicationToList(patientId, listType, medicationRequest, reasonCode) {
    try {
      const list = await this.getMedicationList(patientId, listType);
      
      const newEntry = {
        flag: {
          coding: [{
            system: 'http://example.org/medication-list-flags',
            code: reasonCode
          }]
        },
        deleted: false,
        date: new Date().toISOString(),
        item: {
          reference: `MedicationRequest/${medicationRequest.id}`
        }
      };

      // Add entry to list
      const updatedList = {
        ...list,
        entry: [...(list.entry || []), newEntry],
        date: new Date().toISOString()
      };

      await fhirClient.update('List', updatedList);
      
      // Update cache
      this.medicationLists.set(`${patientId}-${listType}`, updatedList);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove medication from a specific list
   */
  async removeMedicationFromList(patientId, listType, medicationRequestId) {
    try {
      const list = await this.getMedicationList(patientId, listType);
      
      const updatedEntries = (list.entry || []).map(entry => {
        if (entry.item?.reference === `MedicationRequest/${medicationRequestId}`) {
          return {
            ...entry,
            deleted: true,
            date: new Date().toISOString()
          };
        }
        return entry;
      });

      const updatedList = {
        ...list,
        entry: updatedEntries,
        date: new Date().toISOString()
      };

      await fhirClient.update('List', updatedList);
      
      // Update cache
      this.medicationLists.set(`${patientId}-${listType}`, updatedList);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update medication entry in list
   */
  async updateMedicationInList(patientId, listType, medicationRequestId, updates) {
    try {
      const list = await this.getMedicationList(patientId, listType);
      
      const updatedEntries = (list.entry || []).map(entry => {
        if (entry.item?.reference === `MedicationRequest/${medicationRequestId}`) {
          return {
            ...entry,
            ...updates,
            date: new Date().toISOString()
          };
        }
        return entry;
      });

      const updatedList = {
        ...list,
        entry: updatedEntries,
        date: new Date().toISOString()
      };

      await fhirClient.update('List', updatedList);
      
      // Update cache
      this.medicationLists.set(`${patientId}-${listType}`, updatedList);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get medication list from cache or fetch from server
   */
  async getMedicationList(patientId, listType) {
    const cacheKey = `${patientId}-${listType}`;
    
    if (this.medicationLists.has(cacheKey)) {
      return this.medicationLists.get(cacheKey);
    }

    // Fetch from server if not in cache
    const lists = await this.initializePatientMedicationLists(patientId);
    
    switch (listType) {
      case this.LIST_TYPES.CURRENT_MEDICATIONS:
        return lists.currentMedications;
      case this.LIST_TYPES.ACTIVE_PRESCRIPTIONS:
        return lists.activePrescriptions;
      default:
        throw new Error(`Unknown list type: ${listType}`);
    }
  }

  /**
   * Check for duplicate medication in list
   */
  async checkForDuplicateMedication(patientId, newMedication, listType) {
    try {
      const list = await this.getMedicationList(patientId, listType);
      const newMedicationName = this.normalizeMedicationName(
        newMedication.medicationCodeableConcept?.text || ''
      );

      // Check existing entries
      for (const entry of (list.entry || [])) {
        if (entry.deleted) continue;

        const existingMedRef = entry.item?.reference;
        if (!existingMedRef) continue;

        const existingMedId = existingMedRef.split('/')[1];
        const existingMed = await fhirClient.read('MedicationRequest', existingMedId);
        
        const existingMedicationName = this.normalizeMedicationName(
          existingMed.medicationCodeableConcept?.text || ''
        );

        if (newMedicationName === existingMedicationName) {
          return true;
        }
      }

      return false;

    } catch (error) {
      return false;
    }
  }

  /**
   * Normalize medication name for comparison
   */
  normalizeMedicationName(medicationName) {
    return medicationName
      .toLowerCase()
      .replace(/\s+\d+mg|\s+\d+mcg|\s+\d+g/gi, '') // Remove dosage
      .replace(/\s+tablet|\s+capsule|\s+liquid/gi, '') // Remove form
      .trim();
  }

  /**
   * Check if medication represents ongoing therapy
   */
  isOngoingTherapy(medicationRequest) {
    // Check if medication has refills or is for chronic condition
    const refills = medicationRequest.dispenseRequest?.numberOfRepeatsAllowed || 0;
    const isChronicMedication = this.isChronicMedication(medicationRequest);
    
    return refills > 0 || isChronicMedication;
  }

  /**
   * Check if medication is typically for chronic conditions
   */
  isChronicMedication(medicationRequest) {
    const medicationName = medicationRequest.medicationCodeableConcept?.text?.toLowerCase() || '';
    
    // Common chronic medications (simplified check)
    const chronicMedications = [
      'lisinopril', 'metformin', 'atorvastatin', 'levothyroxine',
      'amlodipine', 'omeprazole', 'simvastatin', 'losartan'
    ];

    return chronicMedications.some(chronic => medicationName.includes(chronic));
  }

  /**
   * Get comprehensive medication summary for patient
   */
  async getPatientMedicationSummary(patientId) {
    try {
      const lists = await this.initializePatientMedicationLists(patientId);
      
      // Get detailed medication data
      const currentMedications = await this.getDetailedMedicationsFromList(
        lists.currentMedications
      );
      
      const activePrescriptions = await this.getDetailedMedicationsFromList(
        lists.activePrescriptions
      );

      // Calculate summary statistics
      const summary = {
        totalCurrent: currentMedications.length,
        totalActive: activePrescriptions.length,
        duplicateCount: this.findDuplicatesInLists(currentMedications, activePrescriptions),
        lastUpdated: Math.max(
          new Date(lists.currentMedications.date).getTime(),
          new Date(lists.activePrescriptions.date).getTime()
        ),
        medications: {
          current: currentMedications,
          active: activePrescriptions
        }
      };

      return summary;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get detailed medication data from list entries
   */
  async getDetailedMedicationsFromList(list) {
    const medications = [];
    
    for (const entry of (list.entry || [])) {
      if (entry.deleted) continue;

      try {
        const medicationRef = entry.item?.reference;
        if (!medicationRef) continue;

        const [resourceType, resourceId] = medicationRef.split('/');
        const medication = await fhirClient.read(resourceType, resourceId);
        
        medications.push({
          ...medication,
          listEntry: entry,
          addedToList: entry.date
        });

      } catch (error) {
        // Skip invalid medication entry
      }
    }

    return medications;
  }

  /**
   * Find duplicates between medication lists
   */
  findDuplicatesInLists(list1, list2) {
    let duplicateCount = 0;
    const list1Names = new Set(
      list1.map(med => this.normalizeMedicationName(
        med.medicationCodeableConcept?.text || ''
      ))
    );

    list2.forEach(med => {
      const normalizedName = this.normalizeMedicationName(
        med.medicationCodeableConcept?.text || ''
      );
      if (list1Names.has(normalizedName)) {
        duplicateCount++;
      }
    });

    return duplicateCount;
  }

  /**
   * Subscribe to medication list updates
   */
  subscribeToListUpdates(patientId, callback) {
    const key = `${patientId}-updates`;
    if (!this.updateCallbacks.has(key)) {
      this.updateCallbacks.set(key, new Set());
    }
    this.updateCallbacks.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.updateCallbacks.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.updateCallbacks.delete(key);
        }
      }
    };
  }

  /**
   * Notify subscribers of list updates
   */
  notifyListUpdated(patientId, listType, action, medication) {
    const key = `${patientId}-updates`;
    const callbacks = this.updateCallbacks.get(key);
    
    if (callbacks) {
      const update = {
        patientId,
        listType,
        action,
        medication,
        timestamp: new Date().toISOString()
      };

      callbacks.forEach(callback => {
        try {
          callback(update);
        } catch (error) {
          // Skip failed callback
        }
      });
    }
  }

  /**
   * Enable/disable automatic updates
   */
  setAutoUpdateEnabled(enabled) {
    this.autoUpdateEnabled = enabled;
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.medicationLists.clear();
  }

  /**
   * Force refresh of patient medication lists
   */
  async refreshPatientLists(patientId) {
    // Clear cache
    this.medicationLists.delete(`${patientId}-current`);
    this.medicationLists.delete(`${patientId}-prescriptions`);
    
    // Reload lists
    return await this.initializePatientMedicationLists(patientId);
  }
}

// Export singleton instance
export const medicationListManagementService = new MedicationListManagementService();