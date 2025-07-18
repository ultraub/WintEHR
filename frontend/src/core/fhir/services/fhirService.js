/**
 * Migration wrapper to help transition from fhirService to fhirClient
 * This maps old fhirService methods to fhirClient equivalents
 */

import { fhirClient } from './fhirClient';

// Create a compatibility layer that matches fhirService API
const fhirServiceCompat = {
  // Basic CRUD operations
  async getResource(resourceType, id) {
    return fhirClient.read(resourceType, id);
  },

  async createResource(resourceType, data) {
    return fhirClient.create(resourceType, data);
  },

  async updateResource(resourceType, id, data) {
    return fhirClient.update(resourceType, id, data);
  },

  async deleteResource(resourceType, id) {
    return fhirClient.delete(resourceType, id);
  },

  async searchResources(resourceType, params) {
    const result = await fhirClient.search(resourceType, params);
    // Return the bundle directly for compatibility
    return result.bundle || result;
  },

  // Patient-specific methods
  async getPatient(patientId) {
    return fhirClient.read('Patient', patientId);
  },

  async getPatientResources(patientId, resourceTypes = null) {
    // If no resource types specified, get all
    if (!resourceTypes) {
      // Use the $everything operation
      const response = await fhirClient.operation({
        resourceType: 'Patient',
        id: patientId,
        $operation: '$everything'
      });
      return response;
    }
    
    // Otherwise, batch get specific resource types
    const requests = resourceTypes.map(type => ({
      method: 'GET',
      url: `${type}?patient=${patientId}`
    }));
    
    const bundle = await fhirClient.batch(requests);
    return bundle;
  },

  async refreshPatientResources(patientId) {
    // This is essentially the same as getPatientResources
    // but we could add cache busting if needed
    return this.getPatientResources(patientId);
  },

  // Condition methods
  async getConditions(patientId) {
    const result = await fhirClient.search('Condition', { patient: patientId });
    return result.entry ? result.entry.map(e => e.resource) : [];
  },

  async createCondition(conditionData) {
    return fhirClient.create('Condition', conditionData);
  },

  async updateCondition(conditionId, conditionData) {
    return fhirClient.update('Condition', conditionId, conditionData);
  },

  async deleteCondition(conditionId) {
    return fhirClient.delete('Condition', conditionId);
  },

  // Medication methods
  async getMedicationRequests(patientId) {
    const result = await fhirClient.search('MedicationRequest', { patient: patientId });
    return result.entry ? result.entry.map(e => e.resource) : [];
  },

  async createMedicationRequest(medicationData) {
    return fhirClient.create('MedicationRequest', medicationData);
  },

  async updateMedicationRequest(medicationId, medicationData) {
    return fhirClient.update('MedicationRequest', medicationId, medicationData);
  },

  async deleteMedicationRequest(medicationId) {
    return fhirClient.delete('MedicationRequest', medicationId);
  },

  // Allergy methods
  async getAllergyIntolerances(patientId) {
    const result = await fhirClient.search('AllergyIntolerance', { patient: patientId });
    return result.entry ? result.entry.map(e => e.resource) : [];
  },

  async createAllergyIntolerance(allergyData) {
    return fhirClient.create('AllergyIntolerance', allergyData);
  },

  async updateAllergyIntolerance(allergyId, allergyData) {
    return fhirClient.update('AllergyIntolerance', allergyId, allergyData);
  },

  async deleteAllergyIntolerance(allergyId) {
    return fhirClient.delete('AllergyIntolerance', allergyId);
  },

  // Additional methods from fhirService
  async getActiveProblems(patientId) {
    const result = await fhirClient.search('Condition', { 
      patient: patientId,
      'clinical-status': 'active'
    });
    return result.entry ? result.entry.map(e => e.resource) : [];
  },

  async getMedicationHistory(patientId) {
    // Get both active and inactive medication requests
    return fhirClient.search('MedicationRequest', {
      patient: patientId,
      _sort: '-authoredon'
    });
  },

  async getRecentEncounters(patientId, limit = 5) {
    return fhirClient.search('Encounter', {
      patient: patientId,
      _sort: '-date',
      _count: limit
    });
  },

  // Immunization methods
  async getImmunizations(patientId) {
    const result = await fhirClient.search('Immunization', { patient: patientId });
    return result.entry ? result.entry.map(e => e.resource) : [];
  },

  async createImmunization(immunizationData) {
    return fhirClient.create('Immunization', immunizationData);
  },

  async updateImmunization(immunizationId, immunizationData) {
    return fhirClient.update('Immunization', immunizationId, immunizationData);
  },

  // Search helper
  async searchPatients(searchParams) {
    return fhirClient.search('Patient', searchParams);
  },

  // Reference helpers (static methods)
  buildReference: fhirClient.buildReference,
  extractId: fhirClient.extractId,
  buildIdentifier: fhirClient.buildIdentifier
};

export default fhirServiceCompat;