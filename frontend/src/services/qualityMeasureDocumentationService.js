/**
 * Quality Measure Documentation Service
 * Creates documentation prompts for quality measure compliance
 */

import { fhirClient } from './fhirClient';
import { noteTemplatesService } from './noteTemplatesService';

export class QualityMeasureDocumentationService {
  constructor() {
    this.qualityMeasures = [];
    this.patientQualityStatus = new Map();
    this.documentationPrompts = new Map();
  }

  /**
   * Initialize quality measures from backend
   */
  async initializeQualityMeasures() {
    try {
      const response = await fetch('/api/quality/measures');
      if (response.ok) {
        this.qualityMeasures = await response.json();
      }
    } catch (error) {
      // Fallback to built-in measures
      this.qualityMeasures = this.getBuiltInQualityMeasures();
    }
  }

  /**
   * Get built-in quality measures as fallback
   */
  getBuiltInQualityMeasures() {
    return [
      {
        id: 'diabetes-hba1c',
        name: 'Diabetes HbA1c Control',
        description: 'Percentage of patients 18-75 years of age with diabetes who had HbA1c < 8.0%',
        category: 'clinical',
        type: 'proportion',
        numerator: 'Patients with diabetes and HbA1c < 8.0%',
        denominator: 'Patients with diabetes aged 18-75',
        target: 80.0,
        documentation: {
          required: ['diabetes-diagnosis', 'hba1c-result', 'medication-management', 'patient-education'],
          optional: ['lifestyle-counseling', 'specialist-referral', 'complications-screening']
        }
      },
      {
        id: 'hypertension-control',
        name: 'Hypertension Blood Pressure Control',
        description: 'Percentage of patients 18-85 years of age with hypertension whose BP was adequately controlled',
        category: 'clinical',
        type: 'proportion',
        numerator: 'Patients with controlled BP (<140/90)',
        denominator: 'Patients with hypertension aged 18-85',
        target: 85.0,
        documentation: {
          required: ['hypertension-diagnosis', 'bp-measurement', 'medication-management'],
          optional: ['lifestyle-modifications', 'patient-education', 'adherence-assessment']
        }
      },
      {
        id: 'breast-cancer-screening',
        name: 'Breast Cancer Screening',
        description: 'Percentage of women 50-74 years of age who had a mammogram to screen for breast cancer',
        category: 'preventive',
        type: 'proportion',
        numerator: 'Women with mammogram in past 2 years',
        denominator: 'Women aged 50-74',
        target: 75.0,
        documentation: {
          required: ['screening-discussion', 'mammogram-order-or-results', 'patient-preference'],
          optional: ['risk-assessment', 'family-history', 'follow-up-plan']
        }
      },
      {
        id: 'medication-reconciliation',
        name: 'Medication Reconciliation',
        description: 'Percentage of discharges with medication reconciliation completed',
        category: 'safety',
        type: 'proportion',
        numerator: 'Discharges with completed med rec',
        denominator: 'All hospital discharges',
        target: 90.0,
        documentation: {
          required: ['medication-list-review', 'changes-documented', 'patient-counseling'],
          optional: ['pharmacy-consultation', 'follow-up-appointment', 'medication-adherence']
        }
      },
      {
        id: 'colorectal-screening',
        name: 'Colorectal Cancer Screening',
        description: 'Percentage of adults 50-75 years of age who had appropriate screening for colorectal cancer',
        category: 'preventive',
        type: 'proportion',
        numerator: 'Adults with appropriate colorectal screening',
        denominator: 'Adults aged 50-75',
        target: 75.0,
        documentation: {
          required: ['screening-discussion', 'screening-method-selected', 'patient-preference'],
          optional: ['risk-factors', 'family-history', 'shared-decision-making']
        }
      },
      {
        id: 'depression-screening',
        name: 'Depression Screening',
        description: 'Percentage of patients screened for depression and follow-up plan documented',
        category: 'behavioral-health',
        type: 'proportion',
        numerator: 'Patients screened with documented follow-up plan',
        denominator: 'Patients aged 12 and older',
        target: 85.0,
        documentation: {
          required: ['screening-tool-used', 'screening-results', 'follow-up-plan'],
          optional: ['referral-made', 'patient-education', 'safety-assessment']
        }
      }
    ];
  }

  /**
   * Assess patient's quality measure status
   * @param {string} patientId - Patient ID
   * @returns {Object} Quality measure assessment
   */
  async assessPatientQualityStatus(patientId) {
    try {
      const cacheKey = `quality-status-${patientId}`;
      
      if (this.patientQualityStatus.has(cacheKey)) {
        const cached = this.patientQualityStatus.get(cacheKey);
        if (Date.now() - cached.timestamp < 10 * 60 * 1000) { // 10 minute cache
          return cached.data;
        }
      }

      // Get patient data
      const [patient, conditions, observations, procedures, encounters] = await Promise.all([
        fhirClient.read('Patient', patientId),
        fhirClient.search('Condition', { patient: patientId, _sort: '-date' }),
        fhirClient.search('Observation', { patient: patientId, _sort: '-date', _count: 50 }),
        fhirClient.search('Procedure', { patient: patientId, _sort: '-date' }),
        fhirClient.search('Encounter', { patient: patientId, _sort: '-date', _count: 10 })
      ]);

      const patientData = {
        patient,
        conditions: conditions?.entry?.map(e => e.resource) || [],
        observations: observations?.entry?.map(e => e.resource) || [],
        procedures: procedures?.entry?.map(e => e.resource) || [],
        encounters: encounters?.entry?.map(e => e.resource) || []
      };

      // Assess each quality measure
      const qualityStatus = {
        eligibleMeasures: [],
        documentationNeeded: [],
        complianceStatus: {},
        recommendations: []
      };

      for (const measure of this.qualityMeasures) {
        const assessment = await this.assessMeasureForPatient(measure, patientData);
        if (assessment.eligible) {
          qualityStatus.eligibleMeasures.push(measure.id);
          qualityStatus.complianceStatus[measure.id] = assessment;
          
          if (assessment.needsDocumentation) {
            qualityStatus.documentationNeeded.push({
              measureId: measure.id,
              measureName: measure.name,
              priority: assessment.priority,
              missingDocumentation: assessment.missingDocumentation,
              suggestedActions: assessment.suggestedActions
            });
          }
        }
      }

      // Generate overall recommendations
      qualityStatus.recommendations = this.generateQualityRecommendations(qualityStatus);

      // Cache the result
      this.patientQualityStatus.set(cacheKey, {
        data: qualityStatus,
        timestamp: Date.now()
      });

      return qualityStatus;

    } catch (error) {
      return {
        eligibleMeasures: [],
        documentationNeeded: [],
        complianceStatus: {},
        recommendations: []
      };
    }
  }

  /**
   * Assess a specific quality measure for a patient
   */
  async assessMeasureForPatient(measure, patientData) {
    const assessment = {
      eligible: false,
      compliant: false,
      needsDocumentation: false,
      priority: 'low',
      missingDocumentation: [],
      suggestedActions: [],
      lastDocumented: null
    };

    switch (measure.id) {
      case 'diabetes-hba1c':
        return this.assessDiabetesHbA1c(measure, patientData);
      case 'hypertension-control':
        return this.assessHypertensionControl(measure, patientData);
      case 'breast-cancer-screening':
        return this.assessBreastCancerScreening(measure, patientData);
      case 'medication-reconciliation':
        return this.assessMedicationReconciliation(measure, patientData);
      case 'colorectal-screening':
        return this.assessColorectalScreening(measure, patientData);
      case 'depression-screening':
        return this.assessDepressionScreening(measure, patientData);
      default:
        return assessment;
    }
  }

  /**
   * Assess diabetes HbA1c measure
   */
  assessDiabetesHbA1c(measure, patientData) {
    const assessment = {
      eligible: false,
      compliant: false,
      needsDocumentation: false,
      priority: 'medium',
      missingDocumentation: [],
      suggestedActions: []
    };

    // Check eligibility (age 18-75 with diabetes)
    const age = this.calculateAge(patientData.patient.birthDate);
    const hasDiabetes = patientData.conditions.some(condition => 
      condition.code?.coding?.some(coding => 
        coding.code?.startsWith('E10') || coding.code?.startsWith('E11')
      )
    );

    if (age >= 18 && age <= 75 && hasDiabetes) {
      assessment.eligible = true;

      // Check for recent HbA1c (within 12 months)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const recentHbA1c = patientData.observations.find(obs => 
        obs.code?.coding?.some(coding => coding.code === '4548-4') && // LOINC code for HbA1c
        obs.effectiveDateTime && 
        new Date(obs.effectiveDateTime) > oneYearAgo
      );

      if (recentHbA1c) {
        const value = recentHbA1c.valueQuantity?.value;
        assessment.compliant = value && value < 8.0;
        assessment.lastDocumented = recentHbA1c.effectiveDateTime;
        
        if (!assessment.compliant && value >= 8.0) {
          assessment.needsDocumentation = true;
          assessment.priority = 'high';
          assessment.missingDocumentation = [
            'diabetes-management-review',
            'medication-adjustment-consideration',
            'patient-education-reinforcement'
          ];
          assessment.suggestedActions = [
            'Document diabetes management review',
            'Consider medication adjustment',
            'Reinforce lifestyle modifications',
            'Schedule follow-up for HbA1c recheck'
          ];
        }
      } else {
        assessment.needsDocumentation = true;
        assessment.priority = 'high';
        assessment.missingDocumentation = [
          'hba1c-order',
          'diabetes-monitoring-discussion'
        ];
        assessment.suggestedActions = [
          'Order HbA1c test',
          'Document diabetes monitoring discussion',
          'Review current diabetes management'
        ];
      }
    }

    return assessment;
  }

  /**
   * Assess hypertension control measure
   */
  assessHypertensionControl(measure, patientData) {
    const assessment = {
      eligible: false,
      compliant: false,
      needsDocumentation: false,
      priority: 'medium',
      missingDocumentation: [],
      suggestedActions: []
    };

    // Check eligibility (age 18-85 with hypertension)
    const age = this.calculateAge(patientData.patient.birthDate);
    const hasHypertension = patientData.conditions.some(condition => 
      condition.code?.coding?.some(coding => 
        coding.code?.startsWith('I10') || coding.code?.startsWith('I11') ||
        coding.code?.startsWith('I12') || coding.code?.startsWith('I13')
      )
    );

    if (age >= 18 && age <= 85 && hasHypertension) {
      assessment.eligible = true;

      // Check for recent BP reading (within 12 months)
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const recentBP = patientData.observations.find(obs => 
        obs.code?.coding?.some(coding => 
          coding.code === '85354-9' || // Blood pressure panel
          obs.code?.text?.toLowerCase().includes('blood pressure')
        ) &&
        obs.effectiveDateTime && 
        new Date(obs.effectiveDateTime) > oneYearAgo
      );

      if (recentBP) {
        // Simplified check - in practice would check actual systolic/diastolic values
        assessment.compliant = true;
        assessment.lastDocumented = recentBP.effectiveDateTime;
      } else {
        assessment.needsDocumentation = true;
        assessment.priority = 'high';
        assessment.missingDocumentation = [
          'blood-pressure-measurement',
          'hypertension-management-review'
        ];
        assessment.suggestedActions = [
          'Document blood pressure measurement',
          'Review hypertension management',
          'Assess medication adherence',
          'Consider medication adjustment if needed'
        ];
      }
    }

    return assessment;
  }

  /**
   * Assess breast cancer screening measure
   */
  assessBreastCancerScreening(measure, patientData) {
    const assessment = {
      eligible: false,
      compliant: false,
      needsDocumentation: false,
      priority: 'medium',
      missingDocumentation: [],
      suggestedActions: []
    };

    // Check eligibility (women age 50-74)
    const age = this.calculateAge(patientData.patient.birthDate);
    const isFemale = patientData.patient.gender?.toLowerCase() === 'female';

    if (age >= 50 && age <= 74 && isFemale) {
      assessment.eligible = true;

      // Check for recent mammogram (within 2 years)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      const recentMammogram = patientData.observations.find(obs => 
        (obs.code?.text?.toLowerCase().includes('mammogram') ||
         obs.code?.text?.toLowerCase().includes('mammography')) &&
        obs.effectiveDateTime && 
        new Date(obs.effectiveDateTime) > twoYearsAgo
      );

      if (recentMammogram) {
        assessment.compliant = true;
        assessment.lastDocumented = recentMammogram.effectiveDateTime;
      } else {
        assessment.needsDocumentation = true;
        assessment.priority = 'medium';
        assessment.missingDocumentation = [
          'screening-discussion',
          'mammogram-order-or-decline'
        ];
        assessment.suggestedActions = [
          'Discuss breast cancer screening',
          'Order mammogram or document patient preference',
          'Review family history and risk factors',
          'Schedule follow-up as appropriate'
        ];
      }
    }

    return assessment;
  }

  /**
   * Generate documentation prompts for quality measures
   */
  async generateQualityDocumentationPrompts(patientId, encounterId = null) {
    try {
      // Ensure quality measures are loaded
      if (this.qualityMeasures.length === 0) {
        await this.initializeQualityMeasures();
      }

      const qualityStatus = await this.assessPatientQualityStatus(patientId);
      const prompts = [];

      for (const item of qualityStatus.documentationNeeded) {
        const measure = this.qualityMeasures.find(m => m.id === item.measureId);
        if (measure) {
          const prompt = await this.createQualityMeasurePrompt(measure, item, patientId, encounterId);
          if (prompt) {
            prompts.push(prompt);
          }
        }
      }

      return prompts;

    } catch (error) {
      return [];
    }
  }

  /**
   * Create a documentation prompt for a specific quality measure
   */
  async createQualityMeasurePrompt(measure, assessmentItem, patientId, encounterId) {
    const template = await this.getQualityMeasureTemplate(measure);
    const content = await this.generateQualityMeasureContent(measure, assessmentItem, patientId);

    return {
      id: `quality-${measure.id}-${patientId}-${Date.now()}`,
      type: 'quality-measure',
      measureId: measure.id,
      measureName: measure.name,
      category: measure.category,
      title: `${measure.name} Documentation`,
      description: `Document care for ${measure.name} quality measure compliance`,
      template: template,
      content: content,
      priority: assessmentItem.priority,
      urgency: this.getUrgencyFromPriority(assessmentItem.priority),
      suggestedActions: assessmentItem.suggestedActions,
      missingDocumentation: assessmentItem.missingDocumentation,
      context: {
        patientId,
        encounterId,
        measureId: measure.id,
        target: measure.target
      },
      metadata: {
        qualityMeasure: true,
        measureCategory: measure.category,
        measureType: measure.type,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Get template for quality measure documentation
   */
  async getQualityMeasureTemplate(measure) {
    return {
      id: `quality-${measure.id}`,
      name: `${measure.name} Quality Documentation`,
      sections: [
        'measure-overview',
        'patient-eligibility',
        'current-status',
        'documentation-requirements',
        'action-plan'
      ]
    };
  }

  /**
   * Generate content for quality measure documentation
   */
  async generateQualityMeasureContent(measure, assessmentItem, patientId) {
    let content = `QUALITY MEASURE DOCUMENTATION: ${measure.name}\n`;
    content += `Date: ${new Date().toLocaleDateString()}\n`;
    content += `Patient ID: ${patientId}\n\n`;

    content += `MEASURE OVERVIEW:\n`;
    content += `Description: ${measure.description}\n`;
    content += `Category: ${measure.category}\n`;
    content += `Target: ${measure.target}%\n\n`;

    content += `PATIENT ELIGIBILITY:\n`;
    content += `Patient meets eligibility criteria for this quality measure.\n\n`;

    content += `CURRENT STATUS:\n`;
    content += `Priority: ${assessmentItem.priority}\n`;
    if (assessmentItem.missingDocumentation.length > 0) {
      content += `Missing Documentation:\n`;
      assessmentItem.missingDocumentation.forEach((item, index) => {
        content += `${index + 1}. ${item.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
      });
    }
    content += '\n';

    content += `DOCUMENTATION REQUIREMENTS:\n`;
    if (measure.documentation?.required) {
      content += `Required:\n`;
      measure.documentation.required.forEach((req, index) => {
        content += `${index + 1}. ${req.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
      });
    }
    if (measure.documentation?.optional) {
      content += `Optional:\n`;
      measure.documentation.optional.forEach((opt, index) => {
        content += `${index + 1}. ${opt.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`;
      });
    }
    content += '\n';

    content += `ACTION PLAN:\n`;
    assessmentItem.suggestedActions.forEach((action, index) => {
      content += `${index + 1}. ${action}\n`;
    });
    content += '\n';

    content += `PROVIDER DOCUMENTATION:\n`;
    content += `[Document specific actions taken for quality measure compliance]\n\n`;

    content += `PATIENT EDUCATION:\n`;
    content += `[Document patient education provided related to this measure]\n\n`;

    content += `FOLLOW-UP PLAN:\n`;
    content += `[Document follow-up plan for ongoing quality measure compliance]\n\n`;

    content += `---\n`;
    content += `Quality Measure ID: ${measure.id}\n`;
    content += `Generated for quality reporting compliance\n`;

    return content;
  }

  // Helper methods

  calculateAge(birthDate) {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  getUrgencyFromPriority(priority) {
    switch (priority) {
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'routine';
      default:
        return 'routine';
    }
  }

  generateQualityRecommendations(qualityStatus) {
    const recommendations = [];

    if (qualityStatus.documentationNeeded.length > 0) {
      const highPriority = qualityStatus.documentationNeeded.filter(item => item.priority === 'high');
      if (highPriority.length > 0) {
        recommendations.push({
          type: 'urgent',
          message: `${highPriority.length} high-priority quality measure(s) need documentation`,
          action: 'Address high-priority quality measures immediately'
        });
      }

      const preventive = qualityStatus.documentationNeeded.filter(item => 
        item.measureId.includes('screening') || item.measureId.includes('prevention')
      );
      if (preventive.length > 0) {
        recommendations.push({
          type: 'preventive',
          message: `${preventive.length} preventive care measure(s) need attention`,
          action: 'Schedule or discuss preventive care services'
        });
      }
    }

    return recommendations;
  }

  // Additional assessment methods would be implemented here...
  assessMedicationReconciliation(measure, patientData) {
    // Implementation for medication reconciliation assessment
    return { eligible: false, compliant: false, needsDocumentation: false, priority: 'low', missingDocumentation: [], suggestedActions: [] };
  }

  assessColorectalScreening(measure, patientData) {
    // Implementation for colorectal screening assessment
    return { eligible: false, compliant: false, needsDocumentation: false, priority: 'low', missingDocumentation: [], suggestedActions: [] };
  }

  assessDepressionScreening(measure, patientData) {
    // Implementation for depression screening assessment
    return { eligible: false, compliant: false, needsDocumentation: false, priority: 'low', missingDocumentation: [], suggestedActions: [] };
  }
}

// Export singleton instance
export const qualityMeasureDocumentationService = new QualityMeasureDocumentationService();