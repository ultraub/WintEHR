/**
 * Clinical Documentation Linking Service
 * Links documentation to active problems and medications with cross-referencing
 */

import { fhirClient } from './fhirClient';
import { noteTemplatesService } from './noteTemplatesService';

export class ClinicalDocumentationLinkingService {
  constructor() {
    this.linkCache = new Map();
    this.activeProblemsCache = new Map();
    this.activeMedicationsCache = new Map();
  }

  /**
   * Get active problems for a patient with documentation links
   * @param {string} patientId - Patient ID
   * @returns {Array} Active problems with documentation references
   */
  async getActiveProblemsWithDocumentation(patientId) {
    try {
      // Get active conditions
      const conditionsResponse = await fhirClient.search('Condition', {
        patient: patientId,
        'clinical-status': 'active',
        _sort: '-date',
        _include: 'Condition:subject'
      });

      const conditions = conditionsResponse?.entry?.map(e => e.resource) || [];
      
      // Get related documentation for each condition
      const problemsWithDocs = await Promise.all(
        conditions.map(async (condition) => {
          const documentation = await this.getDocumentationForProblem(patientId, condition.id);
          const relatedOrders = await this.getOrdersForProblem(patientId, condition.id);
          const relatedResults = await this.getResultsForProblem(patientId, condition.id);
          
          return {
            ...condition,
            documentation: documentation,
            relatedOrders: relatedOrders,
            relatedResults: relatedResults,
            hasDocumentation: documentation.length > 0,
            needsDocumentation: this.assessDocumentationNeed(condition, documentation),
            severity: this.assessProblemSeverity(condition),
            lastDocumented: this.getLastDocumentationDate(documentation)
          };
        })
      );

      // Cache the results
      this.activeProblemsCache.set(patientId, problemsWithDocs);
      return problemsWithDocs;

    } catch (error) {
      console.error('Error getting active problems with documentation:', error);
      return [];
    }
  }

  /**
   * Get active medications for a patient with documentation links
   * @param {string} patientId - Patient ID
   * @returns {Array} Active medications with documentation references
   */
  async getActiveMedicationsWithDocumentation(patientId) {
    try {
      // Get active medication requests
      const medicationsResponse = await fhirClient.search('MedicationRequest', {
        patient: patientId,
        status: 'active',
        _sort: '-authoredon',
        _include: 'MedicationRequest:subject'
      });

      const medications = medicationsResponse?.entry?.map(e => e.resource) || [];
      
      // Get related documentation for each medication
      const medicationsWithDocs = await Promise.all(
        medications.map(async (medication) => {
          const documentation = await this.getDocumentationForMedication(patientId, medication.id);
          const adherenceData = await this.getMedicationAdherence(patientId, medication.id);
          const monitoringResults = await this.getMedicationMonitoring(patientId, medication.id);
          
          return {
            ...medication,
            documentation: documentation,
            adherenceData: adherenceData,
            monitoringResults: monitoringResults,
            hasDocumentation: documentation.length > 0,
            needsDocumentation: this.assessMedicationDocumentationNeed(medication, documentation),
            riskLevel: this.assessMedicationRisk(medication),
            lastDocumented: this.getLastDocumentationDate(documentation)
          };
        })
      );

      // Cache the results
      this.activeMedicationsCache.set(patientId, medicationsWithDocs);
      return medicationsWithDocs;

    } catch (error) {
      console.error('Error getting active medications with documentation:', error);
      return [];
    }
  }

  /**
   * Create documentation linking a specific problem
   * @param {string} patientId - Patient ID
   * @param {string} conditionId - Condition ID to link
   * @param {Object} noteData - Note data
   * @returns {Object} Created DocumentReference
   */
  async createProblemLinkedDocumentation(patientId, conditionId, noteData) {
    try {
      const documentRef = {
        resourceType: 'DocumentReference',
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: noteData.loincCode || '11506-3',
            display: noteData.display || 'Progress note'
          }]
        },
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: 'Clinical Note'
          }]
        }],
        subject: {
          reference: `Patient/${patientId}`,
          display: 'Patient'
        },
        date: new Date().toISOString(),
        author: [{
          reference: 'Practitioner/current-user',
          display: noteData.author || 'Current User'
        }],
        description: noteData.title || 'Clinical Documentation',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(noteData.content) // Base64 encode content
          }
        }],
        context: {
          // Link to the specific condition
          related: [{
            reference: `Condition/${conditionId}`,
            display: 'Related Condition'
          }],
          encounter: noteData.encounterId ? [{
            reference: `Encounter/${noteData.encounterId}`
          }] : undefined
        },
        // Custom extension for problem linking
        extension: [{
          url: 'http://medgenemr.com/fhir/StructureDefinition/linked-condition',
          valueReference: {
            reference: `Condition/${conditionId}`,
            display: 'Linked Clinical Problem'
          }
        }]
      };

      const created = await fhirClient.create('DocumentReference', documentRef);
      
      // Update cache
      this.invalidateCache(patientId);
      
      return created;

    } catch (error) {
      console.error('Error creating problem-linked documentation:', error);
      throw error;
    }
  }

  /**
   * Create documentation linking a specific medication
   * @param {string} patientId - Patient ID
   * @param {string} medicationId - MedicationRequest ID to link
   * @param {Object} noteData - Note data
   * @returns {Object} Created DocumentReference
   */
  async createMedicationLinkedDocumentation(patientId, medicationId, noteData) {
    try {
      const documentRef = {
        resourceType: 'DocumentReference',
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'current',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: noteData.loincCode || '56445-0',
            display: noteData.display || 'Medication note'
          }]
        },
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: 'Clinical Note'
          }]
        }],
        subject: {
          reference: `Patient/${patientId}`,
          display: 'Patient'
        },
        date: new Date().toISOString(),
        author: [{
          reference: 'Practitioner/current-user',
          display: noteData.author || 'Current User'
        }],
        description: noteData.title || 'Medication Documentation',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(noteData.content) // Base64 encode content
          }
        }],
        context: {
          // Link to the specific medication
          related: [{
            reference: `MedicationRequest/${medicationId}`,
            display: 'Related Medication'
          }],
          encounter: noteData.encounterId ? [{
            reference: `Encounter/${noteData.encounterId}`
          }] : undefined
        },
        // Custom extension for medication linking
        extension: [{
          url: 'http://medgenemr.com/fhir/StructureDefinition/linked-medication',
          valueReference: {
            reference: `MedicationRequest/${medicationId}`,
            display: 'Linked Medication'
          }
        }]
      };

      const created = await fhirClient.create('DocumentReference', documentRef);
      
      // Update cache
      this.invalidateCache(patientId);
      
      return created;

    } catch (error) {
      console.error('Error creating medication-linked documentation:', error);
      throw error;
    }
  }

  /**
   * Get suggested documentation templates for a specific problem
   * @param {Object} condition - FHIR Condition resource
   * @returns {Array} Suggested templates
   */
  getSuggestedTemplatesForProblem(condition) {
    const suggestions = [];
    const conditionCode = condition.code?.coding?.[0]?.code;
    const conditionText = condition.code?.text?.toLowerCase() || '';

    // Diabetes-specific templates
    if (conditionCode?.startsWith('E1') || conditionText.includes('diabetes')) {
      suggestions.push({
        templateId: 'diabetes-management',
        title: 'Diabetes Management Note',
        description: 'Document diabetes control, monitoring, and treatment adjustments',
        priority: 'high'
      });
    }

    // Hypertension-specific templates
    if (conditionCode?.startsWith('I1') || conditionText.includes('hypertension')) {
      suggestions.push({
        templateId: 'hypertension-management',
        title: 'Hypertension Management Note',
        description: 'Document blood pressure control and medication management',
        priority: 'high'
      });
    }

    // Chronic disease management
    if (condition.clinicalStatus?.coding?.[0]?.code === 'active' && 
        this.isChronicCondition(condition)) {
      suggestions.push({
        templateId: 'chronic-care-management',
        title: 'Chronic Care Management Note',
        description: 'Document ongoing management of chronic condition',
        priority: 'medium'
      });
    }

    // Default progress note
    suggestions.push({
      templateId: 'progress',
      title: 'Progress Note',
      description: 'General progress note for this condition',
      priority: 'low'
    });

    return suggestions;
  }

  /**
   * Get suggested documentation templates for a specific medication
   * @param {Object} medication - FHIR MedicationRequest resource
   * @returns {Array} Suggested templates
   */
  getSuggestedTemplatesForMedication(medication) {
    const suggestions = [];
    const medicationCode = medication.medicationCodeableConcept?.coding?.[0]?.code;
    const medicationText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';

    // High-risk medications
    if (this.isHighRiskMedication(medication)) {
      suggestions.push({
        templateId: 'high-risk-medication-monitoring',
        title: 'High-Risk Medication Monitoring',
        description: 'Document monitoring for high-risk medication',
        priority: 'critical'
      });
    }

    // Controlled substances
    if (this.isControlledSubstance(medication)) {
      suggestions.push({
        templateId: 'controlled-substance-monitoring',
        title: 'Controlled Substance Monitoring',
        description: 'Document controlled substance use and monitoring',
        priority: 'high'
      });
    }

    // Medication reconciliation
    suggestions.push({
      templateId: 'medication-reconciliation',
      title: 'Medication Reconciliation Note',
      description: 'Document medication reconciliation and changes',
      priority: 'medium'
    });

    // Default medication note
    suggestions.push({
      templateId: 'progress',
      title: 'Medication Progress Note',
      description: 'General medication-related progress note',
      priority: 'low'
    });

    return suggestions;
  }

  // Helper methods
  
  async getDocumentationForProblem(patientId, conditionId) {
    try {
      const response = await fhirClient.search('DocumentReference', {
        patient: patientId,
        'context.related': `Condition/${conditionId}`,
        _sort: '-date'
      });
      
      return response?.entry?.map(e => e.resource) || [];
    } catch (error) {
      console.error('Error getting documentation for problem:', error);
      return [];
    }
  }

  async getDocumentationForMedication(patientId, medicationId) {
    try {
      const response = await fhirClient.search('DocumentReference', {
        patient: patientId,
        'context.related': `MedicationRequest/${medicationId}`,
        _sort: '-date'
      });
      
      return response?.entry?.map(e => e.resource) || [];
    } catch (error) {
      console.error('Error getting documentation for medication:', error);
      return [];
    }
  }

  async getOrdersForProblem(patientId, conditionId) {
    try {
      const response = await fhirClient.search('ServiceRequest', {
        patient: patientId,
        'reason-reference': `Condition/${conditionId}`,
        _sort: '-authored'
      });
      
      return response?.entry?.map(e => e.resource) || [];
    } catch (error) {
      console.error('Error getting orders for problem:', error);
      return [];
    }
  }

  async getResultsForProblem(patientId, conditionId) {
    try {
      const response = await fhirClient.search('Observation', {
        patient: patientId,
        'based-on.reason-reference': `Condition/${conditionId}`,
        _sort: '-date'
      });
      
      return response?.entry?.map(e => e.resource) || [];
    } catch (error) {
      console.error('Error getting results for problem:', error);
      return [];
    }
  }

  async getMedicationAdherence(patientId, medicationId) {
    // Simplified adherence check - in practice would query MedicationStatement
    try {
      const response = await fhirClient.search('MedicationStatement', {
        patient: patientId,
        'based-on': `MedicationRequest/${medicationId}`,
        _sort: '-effective'
      });
      
      return response?.entry?.map(e => e.resource) || [];
    } catch (error) {
      return [];
    }
  }

  async getMedicationMonitoring(patientId, medicationId) {
    // Get relevant monitoring observations for the medication
    try {
      const response = await fhirClient.search('Observation', {
        patient: patientId,
        'based-on.reason-reference': `MedicationRequest/${medicationId}`,
        category: 'laboratory',
        _sort: '-date'
      });
      
      return response?.entry?.map(e => e.resource) || [];
    } catch (error) {
      return [];
    }
  }

  assessDocumentationNeed(condition, documentation) {
    const lastDocDate = this.getLastDocumentationDate(documentation);
    const daysSinceLastDoc = lastDocDate ? 
      (Date.now() - new Date(lastDocDate).getTime()) / (1000 * 60 * 60 * 24) : 
      Infinity;

    // Chronic conditions need documentation every 90 days
    if (this.isChronicCondition(condition)) {
      return daysSinceLastDoc > 90;
    }

    // Acute conditions need documentation every 30 days
    return daysSinceLastDoc > 30;
  }

  assessMedicationDocumentationNeed(medication, documentation) {
    const lastDocDate = this.getLastDocumentationDate(documentation);
    const daysSinceLastDoc = lastDocDate ? 
      (Date.now() - new Date(lastDocDate).getTime()) / (1000 * 60 * 60 * 24) : 
      Infinity;

    // High-risk medications need more frequent documentation
    if (this.isHighRiskMedication(medication)) {
      return daysSinceLastDoc > 30;
    }

    // Regular medications need documentation every 90 days
    return daysSinceLastDoc > 90;
  }

  assessProblemSeverity(condition) {
    const severity = condition.severity?.coding?.[0]?.code;
    if (severity) return severity;

    // Assess based on condition type
    const conditionCode = condition.code?.coding?.[0]?.code;
    if (conditionCode?.startsWith('E1') || conditionCode?.startsWith('I1')) {
      return 'moderate'; // Diabetes and hypertension
    }

    return 'mild';
  }

  assessMedicationRisk(medication) {
    if (this.isHighRiskMedication(medication)) return 'high';
    if (this.isControlledSubstance(medication)) return 'moderate';
    return 'low';
  }

  isChronicCondition(condition) {
    const conditionCode = condition.code?.coding?.[0]?.code;
    const chronicCodes = ['E10', 'E11', 'I10', 'I11', 'I12', 'I13', 'I25', 'J44', 'N18'];
    return chronicCodes.some(code => conditionCode?.startsWith(code));
  }

  isHighRiskMedication(medication) {
    const medicationText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const highRiskMeds = ['warfarin', 'insulin', 'digoxin', 'lithium', 'methotrexate'];
    return highRiskMeds.some(med => medicationText.includes(med));
  }

  isControlledSubstance(medication) {
    const medicationText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    const controlledMeds = ['oxycodone', 'morphine', 'fentanyl', 'adderall', 'lorazepam'];
    return controlledMeds.some(med => medicationText.includes(med));
  }

  getLastDocumentationDate(documentation) {
    if (!documentation || documentation.length === 0) return null;
    
    const sortedDocs = documentation.sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    
    return sortedDocs[0]?.date;
  }

  invalidateCache(patientId) {
    this.activeProblemsCache.delete(patientId);
    this.activeMedicationsCache.delete(patientId);
    this.linkCache.clear();
  }

  /**
   * Get documentation requirements summary for a patient
   * @param {string} patientId - Patient ID
   * @returns {Object} Summary of documentation requirements
   */
  async getDocumentationRequirementsSummary(patientId) {
    const [problems, medications] = await Promise.all([
      this.getActiveProblemsWithDocumentation(patientId),
      this.getActiveMedicationsWithDocumentation(patientId)
    ]);

    const problemsNeedingDoc = problems.filter(p => p.needsDocumentation);
    const medicationsNeedingDoc = medications.filter(m => m.needsDocumentation);
    const highRiskMedications = medications.filter(m => m.riskLevel === 'high');

    return {
      totalProblems: problems.length,
      problemsNeedingDocumentation: problemsNeedingDoc.length,
      totalMedications: medications.length,
      medicationsNeedingDocumentation: medicationsNeedingDoc.length,
      highRiskMedications: highRiskMedications.length,
      urgentItems: [
        ...problemsNeedingDoc.filter(p => p.severity === 'severe'),
        ...highRiskMedications
      ],
      recommendations: this.generateDocumentationRecommendations(
        problemsNeedingDoc, 
        medicationsNeedingDoc, 
        highRiskMedications
      )
    };
  }

  generateDocumentationRecommendations(problemsNeedingDoc, medicationsNeedingDoc, highRiskMeds) {
    const recommendations = [];

    if (highRiskMeds.length > 0) {
      recommendations.push({
        type: 'critical',
        message: `${highRiskMeds.length} high-risk medication(s) require monitoring documentation`,
        action: 'Create high-risk medication monitoring notes'
      });
    }

    if (problemsNeedingDoc.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${problemsNeedingDoc.length} active problem(s) need documentation updates`,
        action: 'Review and document current status of active problems'
      });
    }

    if (medicationsNeedingDoc.length > 0) {
      recommendations.push({
        type: 'info',
        message: `${medicationsNeedingDoc.length} medication(s) need documentation updates`,
        action: 'Document medication effectiveness and any adjustments'
      });
    }

    return recommendations;
  }
}

// Create singleton instance
export const clinicalDocumentationLinkingService = new ClinicalDocumentationLinkingService();