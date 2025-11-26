/**
 * Comprehensive Note Templates Service
 * Creates note templates that pull from Results and Chart Review tabs
 */

import { fhirClient } from '../core/fhir/services/fhirClient';
import { noteTemplatesService, NOTE_TEMPLATES } from './noteTemplatesService';

export class ComprehensiveNoteTemplatesService {
  constructor() {
    this.dataCache = new Map();
    this.templateCache = new Map();
  }

  /**
   * Get comprehensive patient data from Results and Chart Review
   * @param {string} patientId - Patient ID
   * @returns {Object} Comprehensive patient data
   */
  async getComprehensivePatientData(patientId) {
    if (this.dataCache.has(patientId)) {
      const cached = this.dataCache.get(patientId);
      // Return cached data if less than 5 minutes old
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }

    try {
      // Fetch all patient data in parallel
      const [
        patient,
        conditions,
        medications,
        allergies,
        immunizations,
        observations,
        diagnosticReports,
        procedures,
        encounters,
        carePlans,
        documentReferences
      ] = await Promise.all([
        fhirClient.read('Patient', patientId),
        fhirClient.search('Condition', { patient: patientId, _sort: '-date' }),
        fhirClient.search('MedicationRequest', { patient: patientId, _sort: '-dateWritten' }),
        fhirClient.search('AllergyIntolerance', { patient: patientId, _sort: '-date' }),
        fhirClient.search('Immunization', { patient: patientId, _sort: '-date' }),
        fhirClient.search('Observation', { patient: patientId, _sort: '-date', _count: 50 }),
        fhirClient.search('DiagnosticReport', { patient: patientId, _sort: '-date', _count: 20 }),
        fhirClient.search('Procedure', { patient: patientId, _sort: '-date' }),
        fhirClient.search('Encounter', { patient: patientId, _sort: '-date', _count: 10 }),
        fhirClient.search('CarePlan', { patient: patientId, status: 'active' }),
        fhirClient.search('DocumentReference', { patient: patientId, _sort: '-date', _count: 20 })
      ]);

      const comprehensiveData = {
        patient,
        // Chart Review Data
        conditions: conditions?.entry?.map(e => e.resource) || [],
        medications: medications?.entry?.map(e => e.resource) || [],
        allergies: allergies?.entry?.map(e => e.resource) || [],
        immunizations: immunizations?.entry?.map(e => e.resource) || [],
        procedures: procedures?.entry?.map(e => e.resource) || [],
        carePlans: carePlans?.entry?.map(e => e.resource) || [],
        
        // Results Data
        observations: observations?.entry?.map(e => e.resource) || [],
        diagnosticReports: diagnosticReports?.entry?.map(e => e.resource) || [],
        
        // Additional Data
        encounters: encounters?.entry?.map(e => e.resource) || [],
        documentReferences: documentReferences?.entry?.map(e => e.resource) || [],
        
        // Categorized Data
        labResults: [],
        vitalSigns: [],
        abnormalResults: [],
        criticalResults: [],
        activeProblems: [],
        activeMedications: [],
        recentResults: [],
        recentDocuments: []
      };

      // Categorize observations
      comprehensiveData.observations.forEach(obs => {
        const category = obs.category?.[0]?.coding?.[0]?.code;
        if (category === 'laboratory') {
          comprehensiveData.labResults.push(obs);
        } else if (category === 'vital-signs') {
          comprehensiveData.vitalSigns.push(obs);
        }

        // Check for abnormal/critical results
        if (this.isResultAbnormal(obs)) {
          comprehensiveData.abnormalResults.push(obs);
          if (this.isResultCritical(obs)) {
            comprehensiveData.criticalResults.push(obs);
          }
        }

        // Check for recent results (last 30 days)
        const obsDate = obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : null;
        if (obsDate && (Date.now() - obsDate.getTime()) < 30 * 24 * 60 * 60 * 1000) {
          comprehensiveData.recentResults.push(obs);
        }
      });

      // Filter active problems and medications
      comprehensiveData.activeProblems = comprehensiveData.conditions.filter(condition =>
        condition.clinicalStatus?.coding?.[0]?.code === 'active'
      );

      comprehensiveData.activeMedications = comprehensiveData.medications.filter(medication =>
        medication.status === 'active'
      );

      // Filter recent documents (last 30 days)
      comprehensiveData.recentDocuments = comprehensiveData.documentReferences.filter(doc => {
        const docDate = doc.date ? new Date(doc.date) : null;
        return docDate && (Date.now() - docDate.getTime()) < 30 * 24 * 60 * 60 * 1000;
      });

      // Cache the data
      this.dataCache.set(patientId, {
        data: comprehensiveData,
        timestamp: Date.now()
      });

      return comprehensiveData;

    } catch (error) {
      return null;
    }
  }

  /**
   * Create comprehensive note templates with data from Results and Chart Review
   * @param {string} templateType - Type of comprehensive template
   * @param {string} patientId - Patient ID
   * @param {string} encounterId - Encounter ID (optional)
   * @returns {Object} Enhanced template with comprehensive data
   */
  async createComprehensiveTemplate(templateType, patientId, encounterId = null) {
    const data = await this.getComprehensivePatientData(patientId);
    if (!data) return null;

    switch (templateType) {
      case 'comprehensive-assessment':
        return this.createComprehensiveAssessmentTemplate(data, encounterId);
      
      case 'results-review':
        return this.createResultsReviewTemplate(data, encounterId);
      
      case 'chronic-care-management':
        return this.createChronicCareManagementTemplate(data, encounterId);
      
      case 'medication-reconciliation':
        return this.createMedicationReconciliationTemplate(data, encounterId);
      
      case 'problem-focused':
        return this.createProblemFocusedTemplate(data, encounterId);
      
      case 'visit-summary':
        return this.createVisitSummaryTemplate(data, encounterId);
      
      case 'care-plan-update':
        return this.createCarePlanUpdateTemplate(data, encounterId);
      
      default:
        return this.createGenericComprehensiveTemplate(data, encounterId);
    }
  }

  /**
   * Create comprehensive assessment template
   */
  async createComprehensiveAssessmentTemplate(data, encounterId) {
    const template = {
      id: 'comprehensive-assessment',
      title: 'Comprehensive Assessment Note',
      type: 'comprehensive',
      loincCode: '11506-3',
      sections: {
        chiefComplaint: await this.getChiefComplaintSection(data, encounterId),
        reviewOfSystems: await this.getReviewOfSystemsSection(data),
        physicalExam: await this.getPhysicalExamSection(data),
        activeProblems: await this.getActiveProblemsSection(data),
        medications: await this.getMedicationsSection(data),
        allergies: await this.getAllergiesSection(data),
        recentResults: await this.getRecentResultsSection(data),
        assessment: await this.getAssessmentSection(data),
        plan: await this.getPlanSection(data)
      }
    };

    return this.assembleTemplate(template);
  }

  /**
   * Create results review template
   */
  async createResultsReviewTemplate(data, encounterId) {
    const template = {
      id: 'results-review',
      title: 'Results Review Note',
      type: 'results-focused',
      loincCode: '11506-3',
      sections: {
        resultsSummary: await this.getResultsSummarySection(data),
        abnormalResults: await this.getAbnormalResultsSection(data),
        criticalResults: await this.getCriticalResultsSection(data),
        trends: await this.getResultsTrendsSection(data),
        clinicalCorrelation: await this.getClinicalCorrelationSection(data),
        followUpPlan: await this.getFollowUpPlanSection(data)
      }
    };

    return this.assembleTemplate(template);
  }

  /**
   * Create chronic care management template
   */
  async createChronicCareManagementTemplate(data, encounterId) {
    const template = {
      id: 'chronic-care-management',
      title: 'Chronic Care Management Note',
      type: 'chronic-care',
      loincCode: '18776-5',
      sections: {
        chronicConditions: await this.getChronicConditionsSection(data),
        medicationReview: await this.getMedicationReviewSection(data),
        monitoringResults: await this.getMonitoringResultsSection(data),
        goalAssessment: await this.getGoalAssessmentSection(data),
        careCoordination: await this.getCareCoordinationSection(data),
        planAdjustments: await this.getPlanAdjustmentsSection(data)
      }
    };

    return this.assembleTemplate(template);
  }

  /**
   * Create medication reconciliation template
   */
  async createMedicationReconciliationTemplate(data, encounterId) {
    const template = {
      id: 'medication-reconciliation',
      title: 'Medication Reconciliation Note',
      type: 'medication-focused',
      loincCode: '56445-0',
      sections: {
        currentMedications: await this.getCurrentMedicationsSection(data),
        medicationChanges: await this.getMedicationChangesSection(data),
        adherenceAssessment: await this.getAdherenceAssessmentSection(data),
        sideEffectsReview: await this.getSideEffectsReviewSection(data),
        drugInteractions: await this.getDrugInteractionsSection(data),
        medicationPlan: await this.getMedicationPlanSection(data)
      }
    };

    return this.assembleTemplate(template);
  }

  /**
   * Create problem-focused template
   */
  async createProblemFocusedTemplate(data, encounterId) {
    const template = {
      id: 'problem-focused',
      title: 'Problem-Focused Note',
      type: 'problem-focused',
      loincCode: '11506-3',
      sections: {
        primaryProblem: await this.getPrimaryProblemSection(data),
        relatedResults: await this.getRelatedResultsSection(data),
        problemAssessment: await this.getProblemAssessmentSection(data),
        treatmentResponse: await this.getTreatmentResponseSection(data),
        problemPlan: await this.getProblemPlanSection(data)
      }
    };

    return this.assembleTemplate(template);
  }

  // Section generation methods

  async getChiefComplaintSection(data, encounterId) {
    const recentEncounter = data.encounters.find(e => e.id === encounterId) || data.encounters[0];
    if (recentEncounter?.reasonCode?.length > 0) {
      return `CHIEF COMPLAINT:\n${recentEncounter.reasonCode[0].text || recentEncounter.reasonCode[0].coding?.[0]?.display || 'Patient visit'}`;
    }
    return 'CHIEF COMPLAINT:\n[Patient\'s primary concern for this visit]';
  }

  async getReviewOfSystemsSection(data) {
    let content = 'REVIEW OF SYSTEMS:\n';
    
    // Use recent results to populate ROS
    if (data.recentResults.length > 0) {
      content += 'Based on recent clinical data:\n';
      
      const vitalSigns = data.vitalSigns.slice(0, 3);
      if (vitalSigns.length > 0) {
        content += '\nVital Signs:\n';
        vitalSigns.forEach(vital => {
          const name = vital.code?.text || 'Vital sign';
          const value = vital.valueQuantity ? 
            `${vital.valueQuantity.value} ${vital.valueQuantity.unit || ''}` : 'See report';
          content += `- ${name}: ${value}\n`;
        });
      }
    }
    
    content += '\nConstitutional: [Review weight, appetite, fatigue]\n';
    content += 'Cardiovascular: [Review chest pain, palpitations, edema]\n';
    content += 'Pulmonary: [Review shortness of breath, cough]\n';
    content += 'Gastrointestinal: [Review nausea, abdominal pain]\n';
    content += 'Genitourinary: [Review urinary symptoms]\n';
    content += 'Neurological: [Review headache, dizziness]\n';
    content += 'Musculoskeletal: [Review joint pain, mobility]\n';
    content += 'Skin: [Review rashes, lesions]\n';
    content += 'Psychiatric: [Review mood, anxiety, sleep]';
    
    return content;
  }

  async getActiveProblemsSection(data) {
    let content = 'ACTIVE PROBLEMS:\n';
    
    if (data.activeProblems.length === 0) {
      content += 'No active problems documented';
    } else {
      data.activeProblems.forEach((problem, index) => {
        const name = problem.code?.text || 
                    problem.code?.coding?.[0]?.display || 
                    'Unknown condition';
        const onset = problem.onsetDateTime ? 
                     ` (since ${new Date(problem.onsetDateTime).toLocaleDateString()})` : '';
        const severity = problem.severity?.coding?.[0]?.display || '';
        
        content += `${index + 1}. ${name}${onset}${severity ? ` - ${severity}` : ''}\n`;
        
        // Add related medications for this problem
        const relatedMeds = this.findRelatedMedications(problem, data.activeMedications);
        if (relatedMeds.length > 0) {
          content += `   Current medications: ${relatedMeds.map(med => 
            med.medicationCodeableConcept?.text || 'Unknown medication'
          ).join(', ')}\n`;
        }
        
        // Add recent results for this problem
        const relatedResults = this.findRelatedResults(problem, data.recentResults);
        if (relatedResults.length > 0) {
          content += `   Recent monitoring: ${relatedResults.length} result(s) available\n`;
        }
      });
    }
    
    return content;
  }

  async getMedicationsSection(data) {
    let content = 'CURRENT MEDICATIONS:\n';
    
    if (data.activeMedications.length === 0) {
      content += 'No current medications documented';
    } else {
      data.activeMedications.forEach((medication, index) => {
        const name = medication.medicationCodeableConcept?.text ||
                    medication.medicationCodeableConcept?.coding?.[0]?.display ||
                    'Unknown medication';
        const dosage = medication.dosageInstruction?.[0]?.text || 'See instructions';
        const status = medication.status || 'active';
        
        content += `${index + 1}. ${name}\n`;
        content += `   Dosage: ${dosage}\n`;
        content += `   Status: ${status}\n`;
        
        // Add recent monitoring if available
        const relatedResults = this.findMedicationMonitoring(medication, data.recentResults);
        if (relatedResults.length > 0) {
          content += `   Recent monitoring: ${relatedResults.length} result(s)\n`;
        }
        content += '\n';
      });
    }
    
    return content;
  }

  async getAllergiesSection(data) {
    let content = 'ALLERGIES:\n';
    
    if (data.allergies.length === 0) {
      content += 'NKDA (No Known Drug Allergies)';
    } else {
      data.allergies.forEach((allergy, index) => {
        const substance = allergy.code?.text || 
                         allergy.code?.coding?.[0]?.display || 
                         'Unknown allergen';
        const reaction = allergy.reaction?.[0]?.manifestation?.[0]?.text ||
                        allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ||
                        '';
        const severity = allergy.reaction?.[0]?.severity || '';
        
        content += `${index + 1}. ${substance}`;
        if (reaction) content += ` - ${reaction}`;
        if (severity) content += ` (${severity})`;
        content += '\n';
      });
    }
    
    return content;
  }

  async getRecentResultsSection(data) {
    let content = 'RECENT RESULTS:\n';
    
    if (data.recentResults.length === 0) {
      content += 'No recent results available';
    } else {
      // Group by type
      const labResults = data.recentResults.filter(r => 
        r.category?.[0]?.coding?.[0]?.code === 'laboratory'
      ).slice(0, 10);
      
      const vitalSigns = data.recentResults.filter(r => 
        r.category?.[0]?.coding?.[0]?.code === 'vital-signs'
      ).slice(0, 5);

      if (labResults.length > 0) {
        content += '\nLaboratory Results:\n';
        labResults.forEach(result => {
          const name = result.code?.text || 'Lab test';
          const value = result.valueQuantity ? 
            `${result.valueQuantity.value} ${result.valueQuantity.unit || ''}` : 
            result.valueString || 'See report';
          const date = result.effectiveDateTime ? 
            new Date(result.effectiveDateTime).toLocaleDateString() : 'No date';
          const status = this.getResultStatus(result);
          
          content += `- ${name}: ${value} (${date})`;
          if (status !== 'Normal') content += ` [${status}]`;
          content += '\n';
        });
      }

      if (vitalSigns.length > 0) {
        content += '\nVital Signs:\n';
        vitalSigns.forEach(vital => {
          const name = vital.code?.text || 'Vital sign';
          const value = vital.valueQuantity ? 
            `${vital.valueQuantity.value} ${vital.valueQuantity.unit || ''}` : 'See report';
          const date = vital.effectiveDateTime ? 
            new Date(vital.effectiveDateTime).toLocaleDateString() : 'No date';
          
          content += `- ${name}: ${value} (${date})\n`;
        });
      }

      // Highlight abnormal results
      if (data.abnormalResults.length > 0) {
        content += `\nABNORMAL RESULTS (${data.abnormalResults.length}):\n`;
        data.abnormalResults.slice(0, 5).forEach(result => {
          const name = result.code?.text || 'Test';
          const value = result.valueQuantity ? 
            `${result.valueQuantity.value} ${result.valueQuantity.unit || ''}` : 'See report';
          content += `⚠️ ${name}: ${value}\n`;
        });
      }

      // Highlight critical results
      if (data.criticalResults.length > 0) {
        content += `\nCRITICAL RESULTS (${data.criticalResults.length}):\n`;
        data.criticalResults.forEach(result => {
          const name = result.code?.text || 'Test';
          const value = result.valueQuantity ? 
            `${result.valueQuantity.value} ${result.valueQuantity.unit || ''}` : 'See report';
          content += `🚨 ${name}: ${value}\n`;
        });
      }
    }
    
    return content;
  }

  async getAssessmentSection(data) {
    let content = 'ASSESSMENT:\n';
    
    if (data.activeProblems.length > 0) {
      content += 'Active Issues:\n';
      data.activeProblems.forEach((problem, index) => {
        const name = problem.code?.text || 'Unknown condition';
        content += `${index + 1}. ${name}\n`;
        
        // Add assessment based on recent results
        const relatedResults = this.findRelatedResults(problem, data.recentResults);
        if (relatedResults.length > 0) {
          const abnormalCount = relatedResults.filter(r => this.isResultAbnormal(r)).length;
          if (abnormalCount > 0) {
            content += `   - ${abnormalCount} abnormal result(s) require attention\n`;
          } else {
            content += `   - Recent monitoring results within acceptable range\n`;
          }
        }
        
        content += '   - [Clinical assessment and current status]\n\n';
      });
    }
    
    if (data.criticalResults.length > 0) {
      content += `CRITICAL FINDINGS:\n`;
      content += `${data.criticalResults.length} critical result(s) requiring immediate attention.\n`;
      content += 'Reviewed and appropriate action initiated.\n\n';
    }
    
    if (data.abnormalResults.length > 0) {
      content += `ABNORMAL FINDINGS:\n`;
      content += `${data.abnormalResults.length} abnormal result(s) noted and reviewed.\n`;
      content += 'Clinical significance assessed in context of patient presentation.\n\n';
    }
    
    content += 'Overall Assessment:\n';
    content += '[Provider assessment of patient\'s current clinical status]';
    
    return content;
  }

  async getPlanSection(data) {
    let content = 'PLAN:\n';
    
    if (data.activeProblems.length > 0) {
      data.activeProblems.forEach((problem, index) => {
        const name = problem.code?.text || 'Unknown condition';
        content += `${index + 1}. ${name}:\n`;
        
        // Plan based on problem type and recent results
        const relatedResults = this.findRelatedResults(problem, data.recentResults);
        const abnormalResults = relatedResults.filter(r => this.isResultAbnormal(r));
        
        if (abnormalResults.length > 0) {
          content += '   - Review abnormal results and adjust treatment as needed\n';
          content += '   - Consider additional workup if clinically indicated\n';
        }
        
        content += '   - Continue current management\n';
        content += '   - Monitor for effectiveness and side effects\n';
        content += '   - Follow-up as scheduled\n\n';
      });
    }
    
    if (data.criticalResults.length > 0) {
      content += 'Critical Results Follow-up:\n';
      content += '- Patient notified of critical results\n';
      content += '- Immediate intervention initiated as appropriate\n';
      content += '- Close monitoring planned\n\n';
    }
    
    content += 'General Plan:\n';
    content += '- Continue current medications unless noted otherwise\n';
    content += '- Lifestyle counseling as appropriate\n';
    content += '- Routine preventive care up to date\n';
    content += '- Return to clinic as scheduled or PRN\n';
    content += '- Patient instructed to call with concerns';
    
    return content;
  }

  // Helper methods for template generation

  assembleTemplate(template) {
    let content = `${template.title}\n`;
    content += `Date: ${new Date().toLocaleDateString()}\n`;
    content += `Time: ${new Date().toLocaleTimeString()}\n\n`;

    Object.entries(template.sections).forEach(([sectionKey, sectionContent]) => {
      if (sectionContent) {
        content += sectionContent + '\n\n';
      }
    });

    content += '\n---\n';
    content += 'Electronically generated clinical note\n';
    content += 'Provider review and signature required\n';

    return {
      template: template,
      content: content,
      metadata: {
        templateId: template.id,
        templateType: template.type,
        loincCode: template.loincCode,
        generatedAt: new Date().toISOString(),
        dataSourced: true,
        sections: Object.keys(template.sections)
      }
    };
  }

  findRelatedMedications(problem, medications) {
    // Simple matching based on condition codes
    // In practice, this would use more sophisticated clinical knowledge
    const problemCode = problem.code?.coding?.[0]?.code;
    const problemText = problem.code?.text?.toLowerCase() || '';
    
    return medications.filter(medication => {
      const medText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
      
      // Basic matching for common conditions
      if (problemText.includes('diabetes') && 
          (medText.includes('metformin') || medText.includes('insulin'))) {
        return true;
      }
      if (problemText.includes('hypertension') && 
          (medText.includes('lisinopril') || medText.includes('amlodipine'))) {
        return true;
      }
      
      return false;
    });
  }

  findRelatedResults(problem, results) {
    // Simple matching based on condition and result types
    const problemText = problem.code?.text?.toLowerCase() || '';
    
    return results.filter(result => {
      const resultText = result.code?.text?.toLowerCase() || '';
      
      // Basic matching for common monitoring
      if (problemText.includes('diabetes') && 
          (resultText.includes('glucose') || resultText.includes('hba1c'))) {
        return true;
      }
      if (problemText.includes('hypertension') && 
          resultText.includes('blood pressure')) {
        return true;
      }
      
      return false;
    });
  }

  findMedicationMonitoring(medication, results) {
    // Find monitoring results for specific medications
    const medText = medication.medicationCodeableConcept?.text?.toLowerCase() || '';
    
    return results.filter(result => {
      const resultText = result.code?.text?.toLowerCase() || '';
      
      // Common medication monitoring
      if (medText.includes('warfarin') && resultText.includes('inr')) return true;
      if (medText.includes('lithium') && resultText.includes('lithium')) return true;
      if (medText.includes('metformin') && resultText.includes('glucose')) return true;
      
      return false;
    });
  }

  isResultAbnormal(result) {
    if (result.interpretation) {
      const interpretation = result.interpretation[0]?.coding?.[0]?.code;
      return ['A', 'AA', 'HH', 'LL', 'H', 'L'].includes(interpretation);
    }
    return false;
  }

  isResultCritical(result) {
    if (result.interpretation) {
      const interpretation = result.interpretation[0]?.coding?.[0]?.code;
      return ['AA', 'HH', 'LL'].includes(interpretation);
    }
    return false;
  }

  getResultStatus(result) {
    if (this.isResultCritical(result)) return 'CRITICAL';
    if (this.isResultAbnormal(result)) return 'ABNORMAL';
    return 'Normal';
  }

  // Additional sections for other template types (implementation would continue...)
  
  async getResultsSummarySection(data) {
    return 'RESULTS SUMMARY:\n[Comprehensive results review section]';
  }

  async getAbnormalResultsSection(data) {
    return 'ABNORMAL RESULTS:\n[Detailed abnormal results analysis]';
  }

  async getCriticalResultsSection(data) {
    return 'CRITICAL RESULTS:\n[Critical results requiring immediate attention]';
  }
}

// Export singleton instance
export const comprehensiveNoteTemplatesService = new ComprehensiveNoteTemplatesService();