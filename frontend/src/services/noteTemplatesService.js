/**
 * Note Templates Service
 * Manages core clinical note templates with auto-population from patient data
 */

import { fhirClient } from './fhirClient';

// Core note template definitions
export const NOTE_TEMPLATES = {
  'progress': {
    id: 'progress',
    label: 'Progress Note',
    code: '11506-3',
    system: 'http://loinc.org',
    display: 'Progress note',
    icon: 'ProgressIcon',
    color: 'primary',
    structure: 'freeform',
    defaultContent: `PROGRESS NOTE

Chief Complaint: 
[Auto-populated if available from encounter]

History of Present Illness:
[Patient's current symptoms and concerns]

Review of Systems:
[Systematic review by body systems]

Physical Examination:
[Physical findings and vital signs]

Assessment:
[Clinical assessment and working diagnosis]

Plan:
[Treatment plan and follow-up instructions]

Provider: [Auto-populated from current user]
Date: [Auto-populated with current date]`,
    autoPopulateFields: [
      'chiefComplaint',
      'allergies',
      'medications',
      'vitalSigns',
      'activeProblems'
    ]
  },

  'soap': {
    id: 'soap',
    label: 'SOAP Note',
    code: '11506-3',
    system: 'http://loinc.org',
    display: 'Progress note',
    icon: 'SOAPIcon',
    color: 'info',
    structure: 'sections',
    sections: {
      subjective: {
        label: 'Subjective',
        placeholder: 'Patient-reported symptoms, concerns, and history...',
        autoPopulate: ['chiefComplaint', 'allergies']
      },
      objective: {
        label: 'Objective',
        placeholder: 'Physical examination findings, vital signs, lab results...',
        autoPopulate: ['vitalSigns', 'recentLabResults']
      },
      assessment: {
        label: 'Assessment',
        placeholder: 'Clinical assessment, differential diagnosis...',
        autoPopulate: ['activeProblems']
      },
      plan: {
        label: 'Plan',
        placeholder: 'Treatment plan, medications, follow-up...',
        autoPopulate: ['medications', 'activePlan']
      }
    },
    autoPopulateFields: [
      'chiefComplaint',
      'allergies',
      'medications',
      'vitalSigns',
      'activeProblems',
      'recentLabResults'
    ]
  },

  'history-physical': {
    id: 'history-physical',
    label: 'History & Physical',
    code: '34117-2',
    system: 'http://loinc.org',
    display: 'History and physical note',
    icon: 'AssessmentIcon',
    color: 'primary',
    structure: 'sections',
    sections: {
      chiefComplaint: {
        label: 'Chief Complaint',
        placeholder: 'Primary reason for the visit...',
        autoPopulate: ['chiefComplaint']
      },
      historyOfPresentIllness: {
        label: 'History of Present Illness',
        placeholder: 'Detailed history of current condition...',
        autoPopulate: []
      },
      pastMedicalHistory: {
        label: 'Past Medical History',
        placeholder: 'Previous medical conditions and procedures...',
        autoPopulate: ['pastProblems', 'procedures']
      },
      medications: {
        label: 'Medications',
        placeholder: 'Current medications and dosages...',
        autoPopulate: ['medications']
      },
      allergies: {
        label: 'Allergies',
        placeholder: 'Known allergies and reactions...',
        autoPopulate: ['allergies']
      },
      socialHistory: {
        label: 'Social History',
        placeholder: 'Smoking, alcohol, drugs, occupation...',
        autoPopulate: []
      },
      familyHistory: {
        label: 'Family History',
        placeholder: 'Relevant family medical history...',
        autoPopulate: []
      },
      reviewOfSystems: {
        label: 'Review of Systems',
        placeholder: 'Systematic review by body systems...',
        autoPopulate: []
      },
      physicalExamination: {
        label: 'Physical Examination',
        placeholder: 'Physical findings and vital signs...',
        autoPopulate: ['vitalSigns']
      },
      assessment: {
        label: 'Assessment',
        placeholder: 'Clinical assessment and diagnosis...',
        autoPopulate: ['activeProblems']
      },
      plan: {
        label: 'Plan',
        placeholder: 'Treatment plan and follow-up...',
        autoPopulate: ['activePlan']
      }
    },
    autoPopulateFields: [
      'chiefComplaint',
      'allergies',
      'medications',
      'vitalSigns',
      'activeProblems',
      'pastProblems',
      'procedures'
    ]
  },

  'assessment': {
    id: 'assessment',
    label: 'Assessment Note',
    code: '51847-2',
    system: 'http://loinc.org',
    display: 'Evaluation and plan note',
    icon: 'AssessmentIcon',
    color: 'success',
    structure: 'sections',
    sections: {
      problemList: {
        label: 'Active Problems',
        placeholder: 'Current active diagnoses and conditions...',
        autoPopulate: ['activeProblems']
      },
      assessment: {
        label: 'Clinical Assessment',
        placeholder: 'Clinical reasoning and assessment...',
        autoPopulate: []
      },
      plan: {
        label: 'Treatment Plan',
        placeholder: 'Detailed treatment and management plan...',
        autoPopulate: ['medications', 'activePlan']
      },
      followUp: {
        label: 'Follow-up',
        placeholder: 'Follow-up instructions and timeline...',
        autoPopulate: []
      }
    },
    autoPopulateFields: [
      'activeProblems',
      'medications',
      'activePlan'
    ]
  },

  'plan-update': {
    id: 'plan-update',
    label: 'Plan Update',
    code: '18776-5',
    system: 'http://loinc.org',
    display: 'Plan of care note',
    icon: 'NotesIcon',
    color: 'secondary',
    structure: 'sections',
    sections: {
      currentStatus: {
        label: 'Current Status',
        placeholder: 'Patient\'s current condition and status...',
        autoPopulate: ['vitalSigns', 'recentLabResults']
      },
      planChanges: {
        label: 'Plan Changes',
        placeholder: 'Changes to current treatment plan...',
        autoPopulate: []
      },
      medications: {
        label: 'Medication Updates',
        placeholder: 'New, discontinued, or modified medications...',
        autoPopulate: ['recentMedicationChanges']
      },
      instructions: {
        label: 'Patient Instructions',
        placeholder: 'Updated instructions for patient...',
        autoPopulate: []
      },
      nextSteps: {
        label: 'Next Steps',
        placeholder: 'Upcoming appointments, tests, or actions...',
        autoPopulate: []
      }
    },
    autoPopulateFields: [
      'vitalSigns',
      'recentLabResults',
      'recentMedicationChanges'
    ]
  }
};

// Auto-population service
export class NoteAutoPopulationService {
  constructor() {
    this.patientData = null;
  }

  // Initialize with current patient data
  async initializePatientData(patientId) {
    try {
      // Get all relevant patient resources for auto-population
      const [
        patient,
        conditions,
        medications,
        allergies,
        observations,
        procedures,
        encounters,
        carePlans
      ] = await Promise.all([
        fhirClient.read('Patient', patientId),
        fhirClient.search('Condition', { patient: patientId, _sort: '-date' }),
        fhirClient.search('MedicationRequest', { patient: patientId, status: 'active', _sort: '-dateWritten' }),
        fhirClient.search('AllergyIntolerance', { patient: patientId, _sort: '-date' }),
        fhirClient.search('Observation', { patient: patientId, _sort: '-date', _count: 20 }),
        fhirClient.search('Procedure', { patient: patientId, _sort: '-date' }),
        fhirClient.search('Encounter', { patient: patientId, _sort: '-date', _count: 5 }),
        fhirClient.search('CarePlan', { patient: patientId, status: 'active' })
      ]);

      this.patientData = {
        patient,
        conditions: conditions?.entry?.map(e => e.resource) || [],
        medications: medications?.entry?.map(e => e.resource) || [],
        allergies: allergies?.entry?.map(e => e.resource) || [],
        observations: observations?.entry?.map(e => e.resource) || [],
        procedures: procedures?.entry?.map(e => e.resource) || [],
        encounters: encounters?.entry?.map(e => e.resource) || [],
        carePlans: carePlans?.entry?.map(e => e.resource) || []
      };

      return this.patientData;
    } catch (error) {
      this.patientData = null;
      return null;
    }
  }

  // Get auto-populated content for specific fields
  getAutoPopulatedContent(fieldName) {
    if (!this.patientData) return '';

    switch (fieldName) {
      case 'chiefComplaint':
        return this.getChiefComplaint();
      case 'allergies':
        return this.getAllergies();
      case 'medications':
        return this.getMedications();
      case 'vitalSigns':
        return this.getVitalSigns();
      case 'activeProblems':
        return this.getActiveProblems();
      case 'pastProblems':
        return this.getPastProblems();
      case 'procedures':
        return this.getProcedures();
      case 'recentLabResults':
        return this.getRecentLabResults();
      case 'activePlan':
        return this.getActivePlan();
      case 'recentMedicationChanges':
        return this.getRecentMedicationChanges();
      default:
        return '';
    }
  }

  getChiefComplaint() {
    // Get from most recent encounter
    const recentEncounter = this.patientData.encounters[0];
    if (recentEncounter?.reasonCode?.length > 0) {
      return recentEncounter.reasonCode[0].text || 
             recentEncounter.reasonCode[0].coding?.[0]?.display || '';
    }
    return '';
  }

  getAllergies() {
    if (this.patientData.allergies.length === 0) {
      return 'NKDA (No Known Drug Allergies)';
    }

    return this.patientData.allergies.map(allergy => {
      const substance = allergy.code?.text || 
                      allergy.code?.coding?.[0]?.display || 
                      'Unknown allergen';
      const reaction = allergy.reaction?.[0]?.manifestation?.[0]?.text ||
                      allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ||
                      '';
      const severity = allergy.reaction?.[0]?.severity || '';
      
      return `• ${substance}${reaction ? ` - ${reaction}` : ''}${severity ? ` (${severity})` : ''}`;
    }).join('\n');
  }

  getMedications() {
    if (this.patientData.medications.length === 0) {
      return 'No current medications';
    }

    return this.patientData.medications.map(med => {
      const name = med.medicationCodeableConcept?.text ||
                  med.medicationCodeableConcept?.coding?.[0]?.display ||
                  'Unknown medication';
      const dosage = med.dosageInstruction?.[0]?.text || '';
      
      return `• ${name}${dosage ? ` - ${dosage}` : ''}`;
    }).join('\n');
  }

  getVitalSigns() {
    const vitalObs = this.patientData.observations.filter(obs => 
      obs.category?.some(cat => 
        cat.coding?.some(code => code.code === 'vital-signs')
      )
    );

    if (vitalObs.length === 0) return '';

    const latestVitals = {};
    vitalObs.forEach(obs => {
      const code = obs.code?.coding?.[0]?.code;
      const display = obs.code?.coding?.[0]?.display || obs.code?.text;
      const value = obs.valueQuantity?.value;
      const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code;
      
      if (code && value && !latestVitals[code]) {
        latestVitals[code] = `${display}: ${value}${unit ? ` ${unit}` : ''}`;
      }
    });

    return Object.values(latestVitals).join('\n');
  }

  getActiveProblems() {
    const activeConditions = this.patientData.conditions.filter(cond => 
      cond.clinicalStatus?.coding?.[0]?.code === 'active'
    );

    if (activeConditions.length === 0) return '';

    return activeConditions.map(condition => {
      const name = condition.code?.text || 
                  condition.code?.coding?.[0]?.display || 
                  'Unknown condition';
      const onset = condition.onsetDateTime ? 
                   ` (since ${new Date(condition.onsetDateTime).toLocaleDateString()})` : '';
      
      return `• ${name}${onset}`;
    }).join('\n');
  }

  getPastProblems() {
    const pastConditions = this.patientData.conditions.filter(cond => 
      cond.clinicalStatus?.coding?.[0]?.code === 'resolved' ||
      cond.clinicalStatus?.coding?.[0]?.code === 'remission'
    );

    if (pastConditions.length === 0) return '';

    return pastConditions.map(condition => {
      const name = condition.code?.text || 
                  condition.code?.coding?.[0]?.display || 
                  'Unknown condition';
      const resolved = condition.abatementDateTime ? 
                      ` (resolved ${new Date(condition.abatementDateTime).toLocaleDateString()})` : '';
      
      return `• ${name}${resolved}`;
    }).join('\n');
  }

  getProcedures() {
    if (this.patientData.procedures.length === 0) return '';

    return this.patientData.procedures.slice(0, 10).map(procedure => {
      const name = procedure.code?.text || 
                  procedure.code?.coding?.[0]?.display || 
                  'Unknown procedure';
      const date = procedure.performedDateTime ? 
                  ` (${new Date(procedure.performedDateTime).toLocaleDateString()})` : '';
      
      return `• ${name}${date}`;
    }).join('\n');
  }

  getRecentLabResults() {
    const labObs = this.patientData.observations.filter(obs => 
      obs.category?.some(cat => 
        cat.coding?.some(code => code.code === 'laboratory')
      )
    );

    if (labObs.length === 0) return '';

    return labObs.slice(0, 5).map(obs => {
      const name = obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown test';
      const value = obs.valueQuantity?.value || obs.valueString || 'Unknown';
      const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';
      const date = obs.effectiveDateTime ? 
                  ` (${new Date(obs.effectiveDateTime).toLocaleDateString()})` : '';
      
      return `• ${name}: ${value}${unit ? ` ${unit}` : ''}${date}`;
    }).join('\n');
  }

  getActivePlan() {
    const activePlans = this.patientData.carePlans.filter(plan => 
      plan.status === 'active'
    );

    if (activePlans.length === 0) return '';

    return activePlans.map(plan => {
      const title = plan.title || 'Care Plan';
      const goals = plan.goal?.map(goal => 
        goal.description?.text || 'Goal'
      ).join(', ') || '';
      
      return `• ${title}${goals ? `: ${goals}` : ''}`;
    }).join('\n');
  }

  getRecentMedicationChanges() {
    // Get medications from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentMeds = this.patientData.medications.filter(med => {
      const authoredOn = med.authoredOn ? new Date(med.authoredOn) : null;
      return authoredOn && authoredOn > thirtyDaysAgo;
    });

    if (recentMeds.length === 0) return '';

    return recentMeds.map(med => {
      const name = med.medicationCodeableConcept?.text ||
                  med.medicationCodeableConcept?.coding?.[0]?.display ||
                  'Unknown medication';
      const status = med.status || '';
      const date = med.authoredOn ? 
                  ` (${new Date(med.authoredOn).toLocaleDateString()})` : '';
      
      return `• ${name} - ${status}${date}`;
    }).join('\n');
  }

  // Generate auto-populated template content
  async generateTemplateContent(templateId, patientId) {
    await this.initializePatientData(patientId);
    
    const template = NOTE_TEMPLATES[templateId];
    if (!template) return null;

    if (template.structure === 'freeform') {
      // For freeform templates, replace placeholders in defaultContent
      let content = template.defaultContent;
      
      // Replace auto-populate placeholders
      template.autoPopulateFields.forEach(field => {
        const autoContent = this.getAutoPopulatedContent(field);
        if (autoContent) {
          const placeholder = `[Auto-populated ${field}]`;
          content = content.replace(placeholder, autoContent);
        }
      });

      // Replace current date
      content = content.replace('[Auto-populated with current date]', new Date().toLocaleDateString());
      
      return { content };
    } else if (template.structure === 'sections') {
      // For sectioned templates, auto-populate each section
      const sections = {};
      
      Object.entries(template.sections).forEach(([sectionKey, section]) => {
        let sectionContent = '';
        
        if (section.autoPopulate) {
          section.autoPopulate.forEach(field => {
            const autoContent = this.getAutoPopulatedContent(field);
            if (autoContent) {
              sectionContent += (sectionContent ? '\n\n' : '') + autoContent;
            }
          });
        }
        
        sections[sectionKey] = sectionContent;
      });

      return { sections };
    }

    return null;
  }
}

// Export template service for external access
export const noteTemplatesService = {
  getTemplate: (templateId) => NOTE_TEMPLATES[templateId],
  getAllTemplates: () => NOTE_TEMPLATES,
  getAutoPopulatedTemplate: async (templateId, patientId, encounterId) => {
    return await noteAutoPopulationService.generateTemplateContent(templateId, patientId);
  }
};

// Export singleton instance
export const noteAutoPopulationService = new NoteAutoPopulationService();