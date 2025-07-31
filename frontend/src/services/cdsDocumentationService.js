/**
 * CDS Documentation Service
 * Integrates CDS Hooks alerts with documentation workflows
 */

import { noteTemplatesService } from './noteTemplatesService';
import { cdsHooksClient } from './cdsHooksClient';

export class CDSDocumentationService {
  constructor() {
    this.documentationPrompts = new Map();
    this.alertIntegrations = new Map();
  }

  /**
   * Initialize CDS-driven documentation prompts based on CDS alerts
   * @param {Array} cdsAlerts - Array of CDS alert cards
   * @param {Object} context - Clinical context (patient, encounter, etc.)
   * @returns {Array} Documentation prompts
   */
  async generateDocumentationPrompts(cdsAlerts, context) {
    const prompts = [];

    for (const alert of cdsAlerts) {
      const prompt = await this.createDocumentationPrompt(alert, context);
      if (prompt) {
        prompts.push(prompt);
      }
    }

    return prompts;
  }

  /**
   * Create a documentation prompt based on CDS alert content
   * @param {Object} alert - CDS alert card
   * @param {Object} context - Clinical context
   * @returns {Object} Documentation prompt
   */
  async createDocumentationPrompt(alert, context) {
    // Map CDS alert types to documentation requirements
    const alertType = this.categorizeAlert(alert);
    
    switch (alertType) {
      case 'abnormal_result':
        return this.createAbnormalResultPrompt(alert, context);
      
      case 'drug_interaction':
        return this.createDrugInteractionPrompt(alert, context);
      
      case 'preventive_care':
        return this.createPreventiveCarePrompt(alert, context);
      
      case 'chronic_care':
        return this.createChronicCarePrompt(alert, context);
      
      case 'quality_measure':
        return this.createQualityMeasurePrompt(alert, context);
      
      default:
        return this.createGenericPrompt(alert, context);
    }
  }

  /**
   * Create documentation prompt for abnormal results
   */
  async createAbnormalResultPrompt(alert, context) {
    const templateData = await noteTemplatesService.getAutoPopulatedTemplate(
      'progress',
      context.patientId,
      context.encounterId
    );

    // Enhance assessment section with abnormal result information
    const enhancedContent = this.enhanceTemplateWithAlert(templateData.content, alert, {
      section: 'Assessment',
      enhancement: `ABNORMAL RESULT ALERT: ${alert.summary}\n\n` +
                  `Recommendation: ${alert.detail}\n\n` +
                  `Clinical Significance: ${this.getResultSignificance(alert)}\n\n`
    });

    return {
      id: `cds-doc-${alert.uuid}`,
      type: 'abnormal_result',
      title: 'Document Abnormal Result',
      description: `CDS Alert: ${alert.summary}`,
      template: 'progress',
      content: enhancedContent,
      urgency: alert.indicator || 'warning',
      linkedAlerts: [alert.uuid],
      suggestedActions: this.extractSuggestedActions(alert),
      context: context
    };
  }

  /**
   * Create documentation prompt for drug interactions
   */
  async createDrugInteractionPrompt(alert, context) {
    const templateData = await noteTemplatesService.getAutoPopulatedTemplate(
      'assessment',
      context.patientId,
      context.encounterId
    );

    const enhancedContent = this.enhanceTemplateWithAlert(templateData.content, alert, {
      section: 'Assessment',
      enhancement: `DRUG INTERACTION ALERT: ${alert.summary}\n\n` +
                  `Details: ${alert.detail}\n\n` +
                  `Medications Involved: ${this.extractMedicationsFromAlert(alert)}\n\n` +
                  `Action Taken: [Document provider response]\n\n`
    });

    return {
      id: `cds-doc-${alert.uuid}`,
      type: 'drug_interaction',
      title: 'Document Drug Interaction Review',
      description: `Medication Safety Alert: ${alert.summary}`,
      template: 'assessment',
      content: enhancedContent,
      urgency: 'critical',
      linkedAlerts: [alert.uuid],
      suggestedActions: this.extractSuggestedActions(alert),
      context: context
    };
  }

  /**
   * Create documentation prompt for preventive care
   */
  async createPreventiveCarePrompt(alert, context) {
    const templateData = await noteTemplatesService.getAutoPopulatedTemplate(
      'progress',
      context.patientId,
      context.encounterId
    );

    const enhancedContent = this.enhanceTemplateWithAlert(templateData.content, alert, {
      section: 'Plan',
      enhancement: `PREVENTIVE CARE REMINDER: ${alert.summary}\n\n` +
                  `Recommendation: ${alert.detail}\n\n` +
                  `Patient Discussion: [Document counseling provided]\n\n` +
                  `Next Steps: [Document screening ordered or patient declined]\n\n`
    });

    return {
      id: `cds-doc-${alert.uuid}`,
      type: 'preventive_care',
      title: 'Document Preventive Care Discussion',
      description: `Preventive Care: ${alert.summary}`,
      template: 'progress',
      content: enhancedContent,
      urgency: 'info',
      linkedAlerts: [alert.uuid],
      suggestedActions: this.extractSuggestedActions(alert),
      context: context
    };
  }

  /**
   * Create documentation prompt for chronic care management
   */
  async createChronicCarePrompt(alert, context) {
    const templateData = await noteTemplatesService.getAutoPopulatedTemplate(
      'soap',
      context.patientId,
      context.encounterId
    );

    const enhancedContent = this.enhanceTemplateWithAlert(templateData.content, alert, {
      section: 'Assessment and Plan',
      enhancement: `CHRONIC CARE MANAGEMENT: ${alert.summary}\n\n` +
                  `Current Status: ${this.getChronicCareStatus(alert, context)}\n\n` +
                  `Recommendations: ${alert.detail}\n\n` +
                  `Care Plan Updates: [Document any changes to care plan]\n\n`
    });

    return {
      id: `cds-doc-${alert.uuid}`,
      type: 'chronic_care',
      title: 'Document Chronic Care Management',
      description: `Care Management: ${alert.summary}`,
      template: 'soap',
      content: enhancedContent,
      urgency: alert.indicator || 'warning',
      linkedAlerts: [alert.uuid],
      suggestedActions: this.extractSuggestedActions(alert),
      context: context
    };
  }

  /**
   * Create documentation prompt for quality measures
   */
  async createQualityMeasurePrompt(alert, context) {
    const templateData = await noteTemplatesService.getAutoPopulatedTemplate(
      'progress',
      context.patientId,
      context.encounterId
    );

    const enhancedContent = this.enhanceTemplateWithAlert(templateData.content, alert, {
      section: 'Plan',
      enhancement: `QUALITY MEASURE DOCUMENTATION: ${alert.summary}\n\n` +
                  `Measure Requirements: ${alert.detail}\n\n` +
                  `Patient Discussion: [Document counseling/education provided]\n\n` +
                  `Actions Taken: [Document orders placed or interventions]\n\n` +
                  `Next Steps: [Document follow-up plan]\n\n`
    });

    return {
      id: `cds-doc-${alert.uuid}`,
      type: 'quality_measure',
      title: 'Document Quality Measure Compliance',
      description: `Quality Measure: ${alert.summary}`,
      template: 'progress',
      content: enhancedContent,
      urgency: 'info',
      linkedAlerts: [alert.uuid],
      suggestedActions: this.extractSuggestedActions(alert),
      context: context
    };
  }

  /**
   * Create generic documentation prompt
   */
  async createGenericPrompt(alert, context) {
    const templateData = await noteTemplatesService.getAutoPopulatedTemplate(
      'progress',
      context.patientId,
      context.encounterId
    );

    const enhancedContent = this.enhanceTemplateWithAlert(templateData.content, alert, {
      section: 'Assessment',
      enhancement: `CLINICAL DECISION SUPPORT ALERT: ${alert.summary}\n\n` +
                  `Details: ${alert.detail}\n\n` +
                  `Provider Response: [Document clinical decision]\n\n`
    });

    return {
      id: `cds-doc-${alert.uuid}`,
      type: 'generic',
      title: 'Document CDS Alert Response',
      description: `CDS Alert: ${alert.summary}`,
      template: 'progress',
      content: enhancedContent,
      urgency: alert.indicator || 'info',
      linkedAlerts: [alert.uuid],
      suggestedActions: this.extractSuggestedActions(alert),
      context: context
    };
  }

  /**
   * Categorize CDS alert to determine documentation type
   */
  categorizeAlert(alert) {
    const summary = alert.summary?.toLowerCase() || '';
    const detail = alert.detail?.toLowerCase() || '';
    const source = alert.source?.label?.toLowerCase() || '';

    // Check for specific alert patterns
    if (summary.includes('abnormal') || summary.includes('critical') || summary.includes('result')) {
      return 'abnormal_result';
    }
    
    if (summary.includes('interaction') || summary.includes('allergy') || source.includes('medication')) {
      return 'drug_interaction';
    }
    
    if (summary.includes('screening') || summary.includes('immunization') || summary.includes('preventive')) {
      return 'preventive_care';
    }
    
    if (summary.includes('diabetes') || summary.includes('hypertension') || summary.includes('chronic')) {
      return 'chronic_care';
    }
    
    if (summary.includes('quality') || summary.includes('measure') || summary.includes('hedis')) {
      return 'quality_measure';
    }

    return 'generic';
  }

  /**
   * Enhance template content with CDS alert information
   */
  enhanceTemplateWithAlert(originalContent, alert, enhancement) {
    const lines = originalContent.split('\n');
    const sectionIndex = lines.findIndex(line => 
      line.toLowerCase().includes(enhancement.section.toLowerCase())
    );

    if (sectionIndex !== -1) {
      // Insert enhancement after the section header
      lines.splice(sectionIndex + 1, 0, '', enhancement.enhancement);
    } else {
      // If section not found, append to end
      lines.push('', `${enhancement.section}:`, enhancement.enhancement);
    }

    return lines.join('\n');
  }

  /**
   * Extract suggested actions from CDS alert
   */
  extractSuggestedActions(alert) {
    const actions = [];
    
    if (alert.suggestions && alert.suggestions.length > 0) {
      alert.suggestions.forEach(suggestion => {
        actions.push({
          type: 'suggestion',
          description: suggestion.label,
          action: suggestion
        });
      });
    }

    if (alert.links && alert.links.length > 0) {
      alert.links.forEach(link => {
        actions.push({
          type: 'link',
          description: link.label,
          url: link.url
        });
      });
    }

    return actions;
  }

  /**
   * Get clinical significance of abnormal result
   */
  getResultSignificance(alert) {
    // This would integrate with the clinical decision support engine
    // to provide context-specific significance
    return 'Review clinical context and patient history to determine significance';
  }

  /**
   * Extract medication information from drug interaction alert
   */
  extractMedicationsFromAlert(alert) {
    // Parse alert content to extract medication names
    const medications = [];
    const content = `${alert.summary} ${alert.detail}`;
    
    // This is a simplified extraction - in practice, this would use
    // more sophisticated parsing or structured data from the CDS service
    const medRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
    let match;
    while ((match = medRegex.exec(content)) !== null) {
      if (match[1].length > 3) { // Filter out short words
        medications.push(match[1]);
      }
    }
    
    return medications.join(', ') || 'See alert details';
  }

  /**
   * Get chronic care status from patient context
   */
  getChronicCareStatus(alert, context) {
    // This would analyze current patient conditions and medications
    // to provide status summary
    return 'Current management status - review patient chart for details';
  }

  /**
   * Get all documentation prompts for display
   */
  getAllPrompts() {
    return Array.from(this.documentationPrompts.values());
  }

  /**
   * Clear resolved prompts
   */
  clearPrompt(promptId) {
    this.documentationPrompts.delete(promptId);
  }

  /**
   * Store prompt for later access
   */
  storePrompt(prompt) {
    this.documentationPrompts.set(prompt.id, prompt);
  }
}

// Create singleton instance
export const cdsDocumentationService = new CDSDocumentationService();