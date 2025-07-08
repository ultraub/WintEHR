/**
 * Migration wrapper to help transition from fhirService to fhirClient
 * This maps old fhirService methods to fhirClient equivalents
 */

import fhirClient from './fhirClient';

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
    return fhirClient.search(resourceType, params);
  },

  // Patient-specific methods
  async getPatient(patientId) {
    return fhirClient.getPatient(patientId);
  },

  async getPatientResources(patientId, resourceTypes = null) {
    // If no resource types specified, get all
    if (!resourceTypes) {
      return fhirClient.getPatientEverything(patientId);
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
    return fhirClient.getConditions(patientId);
  },

  async createCondition(conditionData) {
    return fhirClient.createCondition(conditionData);
  },

  async updateCondition(conditionId, conditionData) {
    return fhirClient.updateCondition(conditionId, conditionData);
  },

  async deleteCondition(conditionId) {
    return fhirClient.deleteCondition(conditionId);
  },

  // Medication methods
  async getMedicationRequests(patientId) {
    return fhirClient.getMedicationRequests(patientId);
  },

  async createMedicationRequest(medicationData) {
    return fhirClient.createMedicationRequest(medicationData);
  },

  async updateMedicationRequest(medicationId, medicationData) {
    return fhirClient.updateMedicationRequest(medicationId, medicationData);
  },

  async deleteMedicationRequest(medicationId) {
    return fhirClient.deleteMedicationRequest(medicationId);
  },

  // Allergy methods
  async getAllergyIntolerances(patientId) {
    return fhirClient.getAllergyIntolerances(patientId);
  },

  async createAllergyIntolerance(allergyData) {
    return fhirClient.createAllergyIntolerance(allergyData);
  },

  async updateAllergyIntolerance(allergyId, allergyData) {
    return fhirClient.updateAllergyIntolerance(allergyId, allergyData);
  },

  async deleteAllergyIntolerance(allergyId) {
    return fhirClient.deleteAllergyIntolerance(allergyId);
  },

  // Additional methods from fhirService
  async getActiveProblems(patientId) {
    const conditions = await fhirClient.getConditions(patientId);
    // Filter for active conditions
    return conditions.filter(condition => 
      condition.clinicalStatus?.coding?.[0]?.code === 'active'
    );
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
    return fhirClient.getImmunizations(patientId);
  },

  async createImmunization(immunizationData) {
    return fhirClient.createImmunization(immunizationData);
  },

  async updateImmunization(immunizationId, immunizationData) {
    return fhirClient.updateImmunization(immunizationId, immunizationData);
  },

  // Search helper
  async searchPatients(searchParams) {
    return fhirClient.searchPatients(searchParams);
  },

  // Reference helpers (static methods)
  buildReference: fhirClient.buildReference,
  extractId: fhirClient.extractId,
  buildIdentifier: fhirClient.buildIdentifier
};

export default fhirServiceCompat;