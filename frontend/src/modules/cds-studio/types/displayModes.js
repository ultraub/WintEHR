/**
 * Display Modes and Behavior Configuration
 *
 * Defines the 9 presentation modes from CDSPresentation component
 * and configuration options for EMR-side display control.
 */

/**
 * Presentation modes matching CDSPresentation.js
 */
export const PRESENTATION_MODES = {
  BANNER: {
    id: 'banner',
    label: 'Top Banner',
    description: 'Critical alerts displayed as sticky banner at top of screen',
    icon: '📢',
    bestFor: ['critical', 'urgent'],
    characteristics: [
      'Always visible',
      'Persistent until acknowledged',
      'Recommended for critical alerts only',
      'Affects workflow (blocks view)'
    ],
    configOptions: {
      position: { type: 'select', options: ['top', 'bottom'], default: 'top' },
      dismissible: { type: 'boolean', default: true }
    },
    preview: {
      color: '#DC2626',
      layout: 'horizontal-full',
      position: 'top'
    }
  },

  SIDEBAR: {
    id: 'sidebar',
    label: 'Side Panel',
    description: 'Fixed side panel showing all alerts',
    icon: '📋',
    bestFor: ['info', 'warning', 'multiple-alerts'],
    characteristics: [
      'Always accessible',
      'Does not block workflow',
      'Can be minimized',
      'Good for multiple alerts'
    ],
    configOptions: {
      minimizable: { type: 'boolean', default: true },
      defaultMinimized: { type: 'boolean', default: false },
      width: { type: 'number', default: 350, min: 250, max: 500 }
    },
    preview: {
      color: '#F59E0B',
      layout: 'vertical-stack',
      position: 'right'
    }
  },

  INLINE: {
    id: 'inline',
    label: 'Inline Alert',
    description: 'Alert displayed inline with content',
    icon: '📝',
    bestFor: ['info', 'warning'],
    characteristics: [
      'Integrates with content flow',
      'Less intrusive',
      'Scrolls with page',
      'Good for contextual alerts'
    ],
    configOptions: {
      maxAlerts: { type: 'number', default: 5, min: 1, max: 10 },
      allowInteraction: { type: 'boolean', default: true }
    },
    preview: {
      color: '#3B82F6',
      layout: 'stacked',
      position: 'inline'
    }
  },

  POPUP: {
    id: 'popup',
    label: 'Modal Dialog',
    description: 'Modal dialog showing multiple alerts',
    icon: '🪟',
    bestFor: ['warning', 'review'],
    characteristics: [
      'Focused attention',
      'Can be dismissed',
      'Shows multiple alerts',
      'Good for review workflows'
    ],
    configOptions: {
      maxWidth: { type: 'select', options: ['sm', 'md', 'lg', 'xl'], default: 'md' },
      backdrop: { type: 'select', options: ['static', 'dismissible'], default: 'dismissible' }
    },
    preview: {
      color: '#F59E0B',
      layout: 'dialog',
      position: 'center'
    }
  },

  MODAL: {
    id: 'modal',
    label: 'Hard-Stop Modal',
    description: 'Blocking modal requiring acknowledgment',
    icon: '🛑',
    bestFor: ['critical'],
    characteristics: [
      'Blocks all actions',
      'Requires acknowledgment',
      'Cannot be dismissed easily',
      'Use ONLY for critical alerts'
    ],
    configOptions: {
      reasonRequired: { type: 'boolean', default: true },
      acknowledgmentText: { type: 'string', default: 'I understand' }
    },
    preview: {
      color: '#DC2626',
      layout: 'dialog-blocking',
      position: 'center'
    }
  },

  TOAST: {
    id: 'toast',
    label: 'Toast Notification',
    description: 'Auto-hiding notification in corner',
    icon: '🔔',
    bestFor: ['info', 'success'],
    characteristics: [
      'Non-intrusive',
      'Auto-hides',
      'Stackable',
      'Good for FYI alerts'
    ],
    configOptions: {
      autoHide: { type: 'boolean', default: true },
      hideDelay: { type: 'number', default: 5000, min: 2000, max: 10000 },
      position: { type: 'select', options: ['top-right', 'bottom-right', 'bottom-left', 'top-left'], default: 'bottom-right' }
    },
    preview: {
      color: '#10B981',
      layout: 'compact-stacked',
      position: 'bottom-right'
    }
  },

  CARD: {
    id: 'card',
    label: 'Card View',
    description: 'Rich card display with detailed information',
    icon: '🃏',
    bestFor: ['info', 'warning', 'detailed-info'],
    characteristics: [
      'Detailed presentation',
      'Rich formatting',
      'Supports images/links',
      'Good for complex alerts'
    ],
    configOptions: {
      elevation: { type: 'number', default: 3, min: 0, max: 24 },
      maxAlerts: { type: 'number', default: 5, min: 1, max: 10 }
    },
    preview: {
      color: '#3B82F6',
      layout: 'card-rich',
      position: 'inline'
    }
  },

  COMPACT: {
    id: 'compact',
    label: 'Compact Icon',
    description: 'Minimized icon with badge, expands to popover',
    icon: '🎯',
    bestFor: ['info', 'low-priority'],
    characteristics: [
      'Minimal space usage',
      'Expands on click',
      'Badge shows count',
      'Good for low-priority alerts'
    ],
    configOptions: {
      badgeColor: { type: 'select', options: ['error', 'warning', 'info', 'success'], default: 'info' },
      animateOnNew: { type: 'boolean', default: true }
    },
    preview: {
      color: '#6B7280',
      layout: 'icon-badge',
      position: 'fixed-icon'
    }
  },

  DRAWER: {
    id: 'drawer',
    label: 'Slide-out Drawer',
    description: 'Temporary drawer sliding from edge',
    icon: '📂',
    bestFor: ['info', 'warning', 'temporary-review'],
    characteristics: [
      'Slides over content',
      'Easy to dismiss',
      'Good for temporary review',
      'Does not persist'
    ],
    configOptions: {
      anchor: { type: 'select', options: ['right', 'left', 'top', 'bottom'], default: 'right' },
      width: { type: 'number', default: 400, min: 300, max: 600 }
    },
    preview: {
      color: '#8B5CF6',
      layout: 'drawer-panel',
      position: 'right'
    }
  }
};

/**
 * Default override reasons matching CDSPresentation.js
 */
export const DEFAULT_OVERRIDE_REASONS = [
  {
    code: 'patient-preference',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Patient preference or contraindication',
    category: 'clinical'
  },
  {
    code: 'clinical-judgment',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Clinical judgment based on patient context',
    category: 'clinical'
  },
  {
    code: 'alternative-treatment',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Alternative treatment selected',
    category: 'clinical'
  },
  {
    code: 'risk-benefit',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Risk-benefit analysis favors override',
    category: 'clinical'
  },
  {
    code: 'false-positive',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Alert appears to be false positive',
    category: 'system'
  },
  {
    code: 'not-applicable',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Alert not applicable to this patient',
    category: 'system'
  },
  {
    code: 'emergency',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Emergency situation requires override',
    category: 'clinical'
  },
  {
    code: 'other',
    system: 'https://winterhr.com/cds-hooks/override-reasons',
    display: 'Other reason (see comments)',
    category: 'other'
  }
];

/**
 * Display behavior configuration schema
 */
export const DISPLAY_BEHAVIOR_SCHEMA = {
  // Presentation mode
  presentationMode: {
    type: 'select',
    label: 'Presentation Mode',
    description: 'How the alert is displayed to users',
    options: Object.keys(PRESENTATION_MODES),
    default: 'inline',
    required: true
  },

  // Acknowledgment requirements
  acknowledgmentRequired: {
    type: 'boolean',
    label: 'Require Acknowledgment',
    description: 'User must acknowledge before dismissing',
    default: false,
    appliesTo: ['banner', 'modal', 'popup']
  },

  reasonRequired: {
    type: 'boolean',
    label: 'Require Override Reason',
    description: 'User must provide reason for dismissing',
    default: false,
    appliesTo: ['banner', 'modal', 'popup', 'sidebar']
  },

  // Override reasons
  overrideReasons: {
    type: 'array',
    label: 'Override Reasons',
    description: 'Available reasons for dismissing alert',
    default: DEFAULT_OVERRIDE_REASONS,
    itemSchema: {
      code: { type: 'string', required: true },
      display: { type: 'string', required: true },
      category: { type: 'select', options: ['clinical', 'system', 'other'] }
    }
  },

  // Auto-hide configuration
  autoHide: {
    type: 'boolean',
    label: 'Auto-Hide',
    description: 'Automatically hide alert after delay',
    default: false,
    appliesTo: ['toast', 'inline']
  },

  hideDelay: {
    type: 'number',
    label: 'Hide Delay (ms)',
    description: 'Time before auto-hiding (milliseconds)',
    default: 5000,
    min: 2000,
    max: 30000,
    appliesTo: ['toast']
  },

  // Snooze functionality
  allowSnooze: {
    type: 'boolean',
    label: 'Allow Snooze',
    description: 'Allow users to temporarily dismiss',
    default: false,
    appliesTo: ['inline', 'card', 'sidebar', 'popup']
  },

  snoozeDurations: {
    type: 'array',
    label: 'Snooze Durations (minutes)',
    description: 'Available snooze duration options',
    default: [15, 30, 60, 120, 240, 480, 1440],
    itemType: 'number'
  },

  // Display limits
  maxAlerts: {
    type: 'number',
    label: 'Maximum Alerts',
    description: 'Maximum number of alerts to show',
    default: 5,
    min: 1,
    max: 20,
    appliesTo: ['inline', 'card', 'toast', 'sidebar']
  },

  // Position configuration
  position: {
    type: 'select',
    label: 'Position',
    description: 'Alert position on screen',
    options: {
      banner: ['top', 'bottom'],
      toast: ['top-right', 'top-left', 'bottom-right', 'bottom-left'],
      sidebar: ['right', 'left'],
      drawer: ['right', 'left', 'top', 'bottom']
    },
    default: {
      banner: 'top',
      toast: 'bottom-right',
      sidebar: 'right',
      drawer: 'right'
    }
  },

  // Interaction settings
  allowInteraction: {
    type: 'boolean',
    label: 'Allow Interaction',
    description: 'Allow user to interact with alert',
    default: true
  },

  backdrop: {
    type: 'select',
    label: 'Backdrop Behavior',
    description: 'Behavior when clicking outside modal',
    options: ['static', 'dismissible'],
    default: 'dismissible',
    appliesTo: ['modal', 'popup', 'drawer']
  }
};

/**
 * Get presentation mode by ID
 */
export function getPresentationMode(modeId) {
  return PRESENTATION_MODES[Object.keys(PRESENTATION_MODES).find(key =>
    PRESENTATION_MODES[key].id === modeId.toLowerCase()
  )];
}

/**
 * Get recommended presentation mode based on card indicator
 */
export function getRecommendedMode(indicator) {
  const recommendations = {
    critical: ['MODAL', 'BANNER'],
    warning: ['POPUP', 'SIDEBAR', 'INLINE'],
    info: ['INLINE', 'TOAST', 'CARD', 'COMPACT']
  };

  return recommendations[indicator] || recommendations.info;
}

/**
 * Get display behavior defaults for a presentation mode
 */
export function getDisplayBehaviorDefaults(modeId) {
  const mode = getPresentationMode(modeId);
  if (!mode) return {};

  const defaults = {};

  // Extract defaults from mode config options
  Object.entries(mode.configOptions || {}).forEach(([key, config]) => {
    defaults[key] = config.default;
  });

  // Add mode-specific recommendations
  if (mode.id === 'modal') {
    defaults.acknowledgmentRequired = true;
    defaults.reasonRequired = true;
    defaults.backdrop = 'static';
  } else if (mode.id === 'banner') {
    defaults.acknowledgmentRequired = true;
  } else if (mode.id === 'toast') {
    defaults.autoHide = true;
    defaults.hideDelay = 5000;
  }

  return defaults;
}

/**
 * Validate display behavior configuration
 */
export function validateDisplayBehavior(config) {
  const errors = [];

  if (!config.presentationMode) {
    errors.push('Presentation mode is required');
  }

  const mode = getPresentationMode(config.presentationMode);
  if (!mode) {
    errors.push(`Invalid presentation mode: ${config.presentationMode}`);
  }

  // Validate mode-specific options
  if (mode) {
    Object.entries(config).forEach(([key, value]) => {
      const schema = DISPLAY_BEHAVIOR_SCHEMA[key];
      if (!schema) return;

      // Check if option applies to this mode
      if (schema.appliesTo && !schema.appliesTo.includes(mode.id)) {
        // Warn but don't error - option will be ignored
        return;
      }

      // Type validation
      if (schema.type === 'number') {
        if (typeof value !== 'number') {
          errors.push(`${key} must be a number`);
        } else if (schema.min !== undefined && value < schema.min) {
          errors.push(`${key} must be at least ${schema.min}`);
        } else if (schema.max !== undefined && value > schema.max) {
          errors.push(`${key} must be at most ${schema.max}`);
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create default display behavior for a service
 */
export function createDefaultDisplayBehavior(indicator = 'info') {
  const recommendedModes = getRecommendedMode(indicator);
  const defaultMode = recommendedModes[0].toLowerCase();

  return {
    presentationMode: defaultMode,
    ...getDisplayBehaviorDefaults(defaultMode),
    acknowledgmentRequired: indicator === 'critical',
    reasonRequired: indicator === 'critical',
    overrideReasons: DEFAULT_OVERRIDE_REASONS,
    allowSnooze: indicator !== 'critical',
    autoHide: indicator === 'info',
    hideDelay: 5000,
    maxAlerts: 5,
    allowInteraction: true
  };
}

export default PRESENTATION_MODES;
