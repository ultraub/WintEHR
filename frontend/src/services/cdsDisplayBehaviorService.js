/**
 * CDS Display Behavior Service
 * Manages display behavior configuration for CDS alerts
 */
import { PRESENTATION_MODES } from '../components/clinical/cds/CDSPresentation';
import { cdsLogger } from '../config/logging';

class CDSDisplayBehaviorService {
  constructor() {
    // Default display behavior mappings based on CDS Hooks best practices
    this.defaultBehaviors = {
      // Critical alerts should be prominently displayed
      critical: {
        presentationMode: PRESENTATION_MODES.MODAL,
        requiresAcknowledgment: true,
        canDismiss: false,
        canSnooze: false,
        autoHide: false,
        priority: 1
      },
      // Warnings should be noticeable but not blocking
      warning: {
        presentationMode: PRESENTATION_MODES.POPUP,
        requiresAcknowledgment: false,
        canDismiss: true,
        canSnooze: true,
        autoHide: false,
        priority: 2
      },
      // Info alerts should be subtle
      info: {
        presentationMode: PRESENTATION_MODES.INLINE,
        requiresAcknowledgment: false,
        canDismiss: true,
        canSnooze: true,
        autoHide: true,
        autoHideDelay: 30000, // 30 seconds
        priority: 3
      }
    };

    // Hook-specific overrides
    this.hookOverrides = {
      'medication-prescribe': {
        // Drug interactions should be more prominent
        warning: {
          presentationMode: PRESENTATION_MODES.POPUP,
          requiresAcknowledgment: true
        }
      },
      'order-sign': {
        // Order signing should show inline by default
        info: {
          presentationMode: PRESENTATION_MODES.INLINE
        }
      }
    };

    // Service-specific overrides (loaded from backend)
    this.serviceOverrides = new Map();
    
    // User preferences (loaded from localStorage)
    this.userPreferences = this.loadUserPreferences();
  }

  /**
   * Get display behavior for an alert
   * @param {Object} alert - CDS alert
   * @param {string} hookType - Hook type
   * @param {Object} options - Additional options
   * @returns {Object} Display behavior configuration
   */
  getDisplayBehavior(alert, hookType, options = {}) {
    const indicator = alert.indicator || 'info';
    const serviceId = alert.serviceId;

    // Start with default behavior for indicator
    let behavior = { ...this.defaultBehaviors[indicator] };

    // Apply hook-specific overrides
    if (this.hookOverrides[hookType]?.[indicator]) {
      behavior = { ...behavior, ...this.hookOverrides[hookType][indicator] };
    }

    // Apply service-specific overrides
    if (this.serviceOverrides.has(serviceId)) {
      const serviceConfig = this.serviceOverrides.get(serviceId);
      if (serviceConfig.indicatorOverrides?.[indicator]) {
        behavior = { ...behavior, ...serviceConfig.indicatorOverrides[indicator] };
      }
    }

    // Apply alert-specific display behavior from backend
    if (alert.displayBehavior) {
      behavior = { ...behavior, ...alert.displayBehavior };
    }

    // Apply user preferences
    if (this.userPreferences.overrides?.[serviceId]) {
      behavior = { ...behavior, ...this.userPreferences.overrides[serviceId] };
    }

    // Apply options overrides (highest priority)
    if (options.presentationMode) {
      behavior.presentationMode = options.presentationMode;
    }

    cdsLogger.debug('Resolved display behavior', {
      alertId: alert.uuid,
      indicator,
      hookType,
      behavior
    });

    return behavior;
  }

  /**
   * Update service-specific display behavior
   * @param {string} serviceId - Service ID
   * @param {Object} config - Display configuration
   */
  updateServiceBehavior(serviceId, config) {
    this.serviceOverrides.set(serviceId, config);
    cdsLogger.info('Updated service display behavior', { serviceId, config });
  }

  /**
   * Load service behaviors from backend configuration
   * @param {Array} services - CDS services with display configurations
   */
  loadServiceBehaviors(services) {
    for (const service of services) {
      if (service.displayBehavior) {
        this.serviceOverrides.set(service.id, service.displayBehavior);
      }
    }
    cdsLogger.info(`Loaded display behaviors for ${this.serviceOverrides.size} services`);
  }

  /**
   * Get user preferences from localStorage
   * @returns {Object} User preferences
   */
  loadUserPreferences() {
    try {
      const stored = localStorage.getItem('cds-display-preferences');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      cdsLogger.error('Failed to load user preferences', error);
      return {};
    }
  }

  /**
   * Save user preference
   * @param {string} serviceId - Service ID
   * @param {Object} preference - Display preference
   */
  saveUserPreference(serviceId, preference) {
    if (!this.userPreferences.overrides) {
      this.userPreferences.overrides = {};
    }
    
    this.userPreferences.overrides[serviceId] = preference;
    
    try {
      localStorage.setItem('cds-display-preferences', JSON.stringify(this.userPreferences));
      cdsLogger.info('Saved user preference', { serviceId, preference });
    } catch (error) {
      cdsLogger.error('Failed to save user preference', error);
    }
  }

  /**
   * Get recommended presentation mode based on context
   * @param {string} indicator - Alert indicator
   * @param {Object} context - Current context
   * @returns {string} Recommended presentation mode
   */
  getRecommendedMode(indicator, context = {}) {
    // If user is in a critical workflow, use less intrusive modes
    if (context.inCriticalWorkflow) {
      return indicator === 'critical' 
        ? PRESENTATION_MODES.BANNER 
        : PRESENTATION_MODES.COMPACT;
    }

    // If multiple alerts, use sidebar to avoid overwhelming
    if (context.alertCount > 3) {
      return PRESENTATION_MODES.SIDEBAR;
    }

    // Mobile devices should use more compact modes
    if (context.isMobile) {
      return indicator === 'critical'
        ? PRESENTATION_MODES.MODAL
        : PRESENTATION_MODES.TOAST;
    }

    // Default to configured behavior
    return this.defaultBehaviors[indicator].presentationMode;
  }

  /**
   * Group alerts by display behavior for efficient rendering
   * @param {Array} alerts - CDS alerts
   * @param {string} hookType - Hook type
   * @returns {Object} Grouped alerts
   */
  groupAlertsByBehavior(alerts, hookType) {
    const groups = {};

    for (const alert of alerts) {
      const behavior = this.getDisplayBehavior(alert, hookType);
      const mode = behavior.presentationMode;
      
      if (!groups[mode]) {
        groups[mode] = {
          alerts: [],
          behavior
        };
      }
      
      groups[mode].alerts.push(alert);
    }

    // Sort alerts within each group by priority
    for (const group of Object.values(groups)) {
      group.alerts.sort((a, b) => {
        const aPriority = this.getAlertPriority(a);
        const bPriority = this.getAlertPriority(b);
        return aPriority - bPriority;
      });
    }

    return groups;
  }

  /**
   * Get alert priority for sorting
   * @param {Object} alert - CDS alert
   * @returns {number} Priority (lower is higher priority)
   */
  getAlertPriority(alert) {
    const indicatorPriority = {
      critical: 1,
      warning: 2,
      info: 3
    };
    
    return indicatorPriority[alert.indicator] || 4;
  }

  /**
   * Check if an alert requires user action
   * @param {Object} alert - CDS alert
   * @param {string} hookType - Hook type
   * @returns {boolean} True if action required
   */
  requiresUserAction(alert, hookType) {
    const behavior = this.getDisplayBehavior(alert, hookType);
    return behavior.requiresAcknowledgment || 
           (alert.suggestions && alert.suggestions.length > 0);
  }

  /**
   * Get display configuration for a specific workflow
   * @param {string} workflow - Workflow identifier
   * @returns {Object} Workflow-specific display configuration
   */
  getWorkflowConfiguration(workflow) {
    const workflowConfigs = {
      'medication-ordering': {
        maxVisibleAlerts: 3,
        groupByService: true,
        defaultMode: PRESENTATION_MODES.SIDEBAR,
        criticalOverride: PRESENTATION_MODES.MODAL
      },
      'patient-chart-review': {
        maxVisibleAlerts: 5,
        groupByService: false,
        defaultMode: PRESENTATION_MODES.INLINE,
        criticalOverride: PRESENTATION_MODES.POPUP
      },
      'encounter-documentation': {
        maxVisibleAlerts: 2,
        groupByService: true,
        defaultMode: PRESENTATION_MODES.COMPACT,
        criticalOverride: PRESENTATION_MODES.BANNER
      }
    };

    return workflowConfigs[workflow] || {
      maxVisibleAlerts: 5,
      groupByService: false,
      defaultMode: PRESENTATION_MODES.INLINE,
      criticalOverride: PRESENTATION_MODES.MODAL
    };
  }
}

// Export singleton instance
export const cdsDisplayBehaviorService = new CDSDisplayBehaviorService();

// Also export class for testing
export default CDSDisplayBehaviorService;