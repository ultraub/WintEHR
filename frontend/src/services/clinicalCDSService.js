/**
 * Clinical CDS Service
 * Provides CDS integration at appropriate workflow points throughout the clinical interface
 * Manages alert presentation, acknowledgment, and suggestion actions
 */
import { cdsHooksClient } from './cdsHooksClient';
import { CDS_HOOK_TYPES } from '../contexts/CDSContext';
import { cdsLogger } from '../config/logging';

class ClinicalCDSService {
  constructor() {
    this.activeAlerts = new Map();
    this.acknowledgments = new Map();
    this.snoozedAlerts = new Map();
    this.alertCallbacks = new Map();
  }

  /**
   * Fire CDS hooks for condition entry/update
   * Triggers when adding/editing diagnoses
   */
  async fireConditionHooks(context) {
    const { patient, condition, operation = 'create', user } = context;
    
    try {
      // Build the hook context
      const hookContext = {
        hook: CDS_HOOK_TYPES.PATIENT_VIEW, // Using patient-view as a proxy
        hookInstance: `condition-${operation}-${Date.now()}`,
        context: {
          patientId: patient.id,
          userId: user?.id || 'current-user',
          // Custom extension for condition-specific context
          conditionContext: {
            operation,
            condition: {
              code: condition.code,
              clinicalStatus: condition.clinicalStatus,
              verificationStatus: condition.verificationStatus,
              severity: condition.severity,
              onsetDateTime: condition.onsetDateTime
            }
          }
        }
      };

      // Execute hooks
      const services = await cdsHooksClient.discoverServices();
      const relevantServices = services.filter(s => 
        s.hook === CDS_HOOK_TYPES.PATIENT_VIEW || 
        s.id.includes('condition') ||
        s.id.includes('diagnosis')
      );

      const alerts = [];
      for (const service of relevantServices) {
        const result = await cdsHooksClient.callService(service.id, hookContext);
        if (result.cards?.length > 0) {
          alerts.push(...this.enhanceAlerts(result.cards, service, 'condition'));
        }
      }

      return {
        alerts,
        hasWarnings: alerts.some(a => a.indicator === 'warning'),
        hasCritical: alerts.some(a => a.indicator === 'critical')
      };
    } catch (error) {
      cdsLogger.error('Failed to fire condition hooks:', error);
      return { alerts: [], hasWarnings: false, hasCritical: false };
    }
  }

  /**
   * Fire CDS hooks for medication prescribing
   * Triggers when prescribing or modifying medications
   */
  async fireMedicationHooks(context) {
    const { patient, medications, operation = 'prescribe', user } = context;
    
    try {
      // Format medications for CDS hook
      const formattedMeds = medications.map(med => ({
        resourceType: 'MedicationRequest',
        id: med.id,
        status: med.status || 'draft',
        intent: med.intent || 'order',
        medicationCodeableConcept: med.medicationCodeableConcept || med.code,
        subject: { reference: `Patient/${patient.id}` },
        dosageInstruction: med.dosageInstruction || [{
          text: med.dosageText,
          timing: med.timing,
          route: med.route,
          doseAndRate: med.doseAndRate
        }]
      }));

      const alerts = await cdsHooksClient.fireMedicationPrescribe(
        patient.id,
        user?.id || 'current-user',
        formattedMeds
      );

      // Enhance alerts with medication context
      const enhancedAlerts = alerts.map(alert => ({
        ...alert,
        context: 'medication',
        operation,
        medications: formattedMeds,
        actions: this.buildMedicationActions(alert, formattedMeds)
      }));

      return {
        alerts: enhancedAlerts,
        hasInteractions: alerts.some(a => a.summary?.toLowerCase().includes('interaction')),
        hasWarnings: alerts.some(a => a.indicator === 'warning'),
        hasCritical: alerts.some(a => a.indicator === 'critical')
      };
    } catch (error) {
      cdsLogger.error('Failed to fire medication hooks:', error);
      return { alerts: [], hasInteractions: false, hasWarnings: false, hasCritical: false };
    }
  }

  /**
   * Fire CDS hooks for lab order entry
   * Triggers when ordering labs
   */
  async fireLabOrderHooks(context) {
    const { patient, orders, user } = context;
    
    try {
      // Format orders for CDS hook
      const formattedOrders = orders.map(order => ({
        resourceType: 'ServiceRequest',
        id: order.id,
        status: order.status || 'draft',
        intent: order.intent || 'order',
        code: order.code,
        subject: { reference: `Patient/${patient.id}` },
        orderDetail: order.orderDetail,
        priority: order.priority || 'routine'
      }));

      const alerts = await cdsHooksClient.fireOrderSign(
        patient.id,
        user?.id || 'current-user',
        formattedOrders
      );

      return {
        alerts: this.enhanceAlerts(alerts, null, 'lab-order'),
        hasWarnings: alerts.some(a => a.indicator === 'warning'),
        hasCritical: alerts.some(a => a.indicator === 'critical')
      };
    } catch (error) {
      cdsLogger.error('Failed to fire lab order hooks:', error);
      return { alerts: [], hasWarnings: false, hasCritical: false };
    }
  }

  /**
   * Fire CDS hooks for allergy documentation
   * Triggers when adding/editing allergies
   */
  async fireAllergyHooks(context) {
    const { patient, allergy, operation = 'create', user } = context;
    
    try {
      const hookContext = {
        hook: CDS_HOOK_TYPES.PATIENT_VIEW,
        hookInstance: `allergy-${operation}-${Date.now()}`,
        context: {
          patientId: patient.id,
          userId: user?.id || 'current-user',
          allergyContext: {
            operation,
            allergy: {
              code: allergy.code,
              clinicalStatus: allergy.clinicalStatus,
              verificationStatus: allergy.verificationStatus,
              type: allergy.type,
              category: allergy.category,
              criticality: allergy.criticality,
              reaction: allergy.reaction
            }
          }
        }
      };

      const services = await cdsHooksClient.discoverServices();
      const relevantServices = services.filter(s => 
        s.hook === CDS_HOOK_TYPES.PATIENT_VIEW || 
        s.id.includes('allergy')
      );

      const alerts = [];
      for (const service of relevantServices) {
        const result = await cdsHooksClient.callService(service.id, hookContext);
        if (result.cards?.length > 0) {
          alerts.push(...this.enhanceAlerts(result.cards, service, 'allergy'));
        }
      }

      // Check for medication-allergy interactions
      if (patient.medications?.length > 0) {
        const interactionAlerts = await this.checkAllergyMedicationInteractions(
          allergy,
          patient.medications
        );
        alerts.push(...interactionAlerts);
      }

      return {
        alerts,
        hasWarnings: alerts.some(a => a.indicator === 'warning'),
        hasCritical: alerts.some(a => a.indicator === 'critical'),
        hasMedicationConflicts: alerts.some(a => 
          a.summary?.toLowerCase().includes('medication') ||
          a.context === 'allergy-medication-interaction'
        )
      };
    } catch (error) {
      cdsLogger.error('Failed to fire allergy hooks:', error);
      return { alerts: [], hasWarnings: false, hasCritical: false, hasMedicationConflicts: false };
    }
  }

  /**
   * Check for allergy-medication interactions
   */
  async checkAllergyMedicationInteractions(allergy, medications) {
    const alerts = [];
    
    // Simple check - in production, this would call a more sophisticated service
    medications.forEach(med => {
      const medName = med.medicationCodeableConcept?.text || 
                      med.medicationCodeableConcept?.coding?.[0]?.display || 
                      'Unknown medication';
      
      // Check for known interactions
      if (allergy.code?.text?.toLowerCase().includes('penicillin') &&
          medName.toLowerCase().includes('amoxicillin')) {
        alerts.push({
          summary: 'Potential Cross-Reactivity Alert',
          detail: `Patient has ${allergy.code.text} allergy. ${medName} may cause cross-reactivity.`,
          indicator: 'critical',
          source: {
            label: 'Allergy Checker'
          },
          suggestions: [{
            label: 'Review Alternative Antibiotics',
            uuid: 'review-alternatives'
          }],
          context: 'allergy-medication-interaction'
        });
      }
    });
    
    return alerts;
  }

  /**
   * Enhance alerts with additional context
   */
  enhanceAlerts(cards, service, context) {
    return cards.map(card => ({
      ...card,
      id: card.uuid || `${service?.id || context}-${Date.now()}-${Math.random()}`,
      serviceId: service?.id,
      serviceName: service?.title,
      context,
      timestamp: new Date(),
      acknowledged: false,
      snoozed: false
    }));
  }

  /**
   * Build medication-specific actions
   */
  buildMedicationActions(alert, medications) {
    const actions = [...(alert.suggestions || [])];
    
    // Add medication-specific actions based on alert type
    if (alert.summary?.toLowerCase().includes('interaction')) {
      actions.push({
        label: 'Review Interaction Details',
        uuid: 'review-interaction',
        type: 'link',
        resource: alert.links?.[0]
      });
      
      actions.push({
        label: 'Adjust Dosage',
        uuid: 'adjust-dosage',
        type: 'action',
        action: 'modify-dosage'
      });
      
      actions.push({
        label: 'Find Alternative',
        uuid: 'find-alternative',
        type: 'action',
        action: 'suggest-alternative'
      });
    }
    
    return actions;
  }

  /**
   * Handle alert acknowledgment
   */
  acknowledgeAlert(alertId, acknowledgment) {
    this.acknowledgments.set(alertId, {
      timestamp: new Date(),
      ...acknowledgment
    });
    
    // Notify callbacks
    this.notifyCallbacks('acknowledge', { alertId, acknowledgment });
  }

  /**
   * Handle alert snooze
   */
  snoozeAlert(alertId, duration = 3600000) { // Default 1 hour
    const snoozeUntil = new Date(Date.now() + duration);
    this.snoozedAlerts.set(alertId, snoozeUntil);
    
    // Notify callbacks
    this.notifyCallbacks('snooze', { alertId, snoozeUntil });
    
    // Set timer to unsnooze
    setTimeout(() => {
      this.snoozedAlerts.delete(alertId);
      this.notifyCallbacks('unsnooze', { alertId });
    }, duration);
  }

  /**
   * Check if alert is snoozed
   */
  isAlertSnoozed(alertId) {
    const snoozeUntil = this.snoozedAlerts.get(alertId);
    if (!snoozeUntil) return false;
    
    if (new Date() > snoozeUntil) {
      this.snoozedAlerts.delete(alertId);
      return false;
    }
    
    return true;
  }

  /**
   * Register callback for alert events
   */
  onAlertEvent(event, callback) {
    if (!this.alertCallbacks.has(event)) {
      this.alertCallbacks.set(event, []);
    }
    this.alertCallbacks.get(event).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.alertCallbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify registered callbacks
   */
  notifyCallbacks(event, data) {
    const callbacks = this.alertCallbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        cdsLogger.error(`Error in alert callback for ${event}:`, error);
      }
    });
  }

  /**
   * Format alert for display
   */
  formatAlertForDisplay(alert) {
    return {
      ...alert,
      displaySummary: this.truncateText(alert.summary, 140),
      displayDetail: this.formatDetail(alert.detail),
      displayTime: this.formatTimestamp(alert.timestamp),
      isAcknowledged: this.acknowledgments.has(alert.id),
      isSnoozed: this.isAlertSnoozed(alert.id)
    };
  }

  /**
   * Utility: Truncate text
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Utility: Format detail text
   */
  formatDetail(detail) {
    if (!detail) return '';
    
    // Convert markdown-style formatting
    return detail
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  }

  /**
   * Utility: Format timestamp
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
}

// Export singleton instance
export const clinicalCDSService = new ClinicalCDSService();

// Also export class for testing
export default ClinicalCDSService;