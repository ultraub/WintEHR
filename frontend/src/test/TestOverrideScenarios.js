/**
 * Test Override Scenarios for CDS Hooks
 * Demonstrates all combinations of acknowledgment and reason requirements
 */

export const testOverrideScenarios = {
  // Scenario 1: Modal with acknowledgment + reason required
  modalWithReason: {
    id: 'test-modal-reason',
    title: 'Critical Alert - Reason Required',
    description: 'Modal alert requiring both acknowledgment and reason',
    hook: 'patient-view',
    enabled: true,
    displayBehavior: {
      defaultMode: 'popup',
      indicatorOverrides: {
        critical: 'modal'
      },
      acknowledgment: {
        required: true,
        reasonRequired: true
      },
      snooze: {
        enabled: false
      }
    },
    conditions: [{
      id: 'age-condition',
      type: 'age',
      operator: 'greater_than',
      value: '65',
      enabled: true
    }],
    cards: [{
      id: 'critical-card',
      summary: 'Critical Drug Interaction - Override Reason Required',
      detail: 'Severe interaction detected. You must provide a reason to continue.',
      indicator: 'critical',
      source: {
        label: 'Drug Safety Database'
      }
    }]
  },

  // Scenario 2: Modal with acknowledgment only (no reason)
  modalAckOnly: {
    id: 'test-modal-ack',
    title: 'Critical Alert - Acknowledgment Only',
    description: 'Modal alert requiring acknowledgment but no reason',
    hook: 'patient-view',
    enabled: true,
    displayBehavior: {
      defaultMode: 'popup',
      indicatorOverrides: {
        critical: 'modal'
      },
      acknowledgment: {
        required: true,
        reasonRequired: false
      },
      snooze: {
        enabled: false
      }
    },
    conditions: [{
      id: 'age-condition',
      type: 'age',
      operator: 'greater_than',
      value: '70',
      enabled: true
    }],
    cards: [{
      id: 'critical-card',
      summary: 'Critical Lab Value - Acknowledgment Required',
      detail: 'Potassium level critically low. Please acknowledge before proceeding.',
      indicator: 'critical',
      source: {
        label: 'Lab System'
      }
    }]
  },

  // Scenario 3: Popup with reason required
  popupWithReason: {
    id: 'test-popup-reason',
    title: 'Warning Alert - Reason Required',
    description: 'Popup alert requiring override reason',
    hook: 'medication-prescribe',
    enabled: true,
    displayBehavior: {
      defaultMode: 'popup',
      acknowledgment: {
        required: true,
        reasonRequired: true
      },
      snooze: {
        enabled: true,
        defaultDuration: 60
      }
    },
    conditions: [{
      id: 'med-condition',
      type: 'medication',
      enabled: true
    }],
    cards: [{
      id: 'warning-card',
      summary: 'Dosage Above Recommended Range',
      detail: 'The prescribed dosage exceeds standard recommendations. Override reason required.',
      indicator: 'warning',
      source: {
        label: 'Dosing Guidelines'
      }
    }]
  },

  // Scenario 4: Inline with acknowledgment only
  inlineAckOnly: {
    id: 'test-inline-ack',
    title: 'Info Alert - Acknowledgment Required',
    description: 'Inline alert requiring simple acknowledgment',
    hook: 'patient-view',
    enabled: true,
    displayBehavior: {
      defaultMode: 'inline',
      acknowledgment: {
        required: true,
        reasonRequired: false
      },
      snooze: {
        enabled: true,
        defaultDuration: 30
      }
    },
    conditions: [{
      id: 'gender-condition',
      type: 'gender',
      operator: 'equals',
      value: 'female',
      enabled: true
    }],
    cards: [{
      id: 'info-card',
      summary: 'Pregnancy Test Recommended',
      detail: 'Consider pregnancy test before prescribing this medication.',
      indicator: 'info',
      source: {
        label: 'Clinical Guidelines'
      }
    }]
  },

  // Scenario 5: Banner with no override required
  bannerNoOverride: {
    id: 'test-banner-no-override',
    title: 'Info Banner - No Override',
    description: 'Banner alert that can be dismissed without override',
    hook: 'patient-view',
    enabled: true,
    displayBehavior: {
      defaultMode: 'banner',
      acknowledgment: {
        required: false,
        reasonRequired: false
      },
      snooze: {
        enabled: true,
        defaultDuration: 1440 // 24 hours
      }
    },
    conditions: [{
      id: 'always-true',
      type: 'age',
      operator: 'greater_than',
      value: '0',
      enabled: true
    }],
    cards: [{
      id: 'info-card',
      summary: 'Annual Wellness Visit Due',
      detail: 'Patient is due for annual wellness visit.',
      indicator: 'info',
      source: {
        label: 'Care Management'
      }
    }]
  },

  // Scenario 6: Mixed severity with different requirements
  mixedSeverity: {
    id: 'test-mixed-severity',
    title: 'Mixed Severity Alerts',
    description: 'Different presentation modes based on severity',
    hook: 'patient-view',
    enabled: true,
    displayBehavior: {
      defaultMode: 'inline',
      indicatorOverrides: {
        critical: 'modal',
        warning: 'popup',
        info: 'inline'
      },
      acknowledgment: {
        required: true,
        reasonRequired: true // Only applies to critical
      },
      snooze: {
        enabled: true,
        defaultDuration: 60
      }
    },
    conditions: [{
      id: 'always-true',
      type: 'age',
      operator: 'greater_than',
      value: '0',
      enabled: true
    }],
    cards: [
      {
        id: 'critical-card',
        summary: 'Critical: Severe Allergy Risk',
        detail: 'Patient has documented severe allergy to prescribed medication.',
        indicator: 'critical',
        source: { label: 'Allergy System' }
      },
      {
        id: 'warning-card',
        summary: 'Warning: Drug Interaction',
        detail: 'Moderate interaction with current medications.',
        indicator: 'warning',
        source: { label: 'Drug Database' }
      },
      {
        id: 'info-card',
        summary: 'Info: Generic Available',
        detail: 'A generic alternative is available for this medication.',
        indicator: 'info',
        source: { label: 'Formulary' }
      }
    ]
  }
};

/**
 * Helper function to create all test hooks
 */
export async function createAllTestOverrideHooks(cdsHooksService) {
  const results = [];
  
  for (const [key, hookConfig] of Object.entries(testOverrideScenarios)) {
    try {
      console.log(`Creating test hook: ${hookConfig.id}`);
      
      // Check if exists and update or create
      try {
        await cdsHooksService.getHook(hookConfig.id);
        const result = await cdsHooksService.updateHook(hookConfig.id, hookConfig);
        results.push({ id: hookConfig.id, status: 'updated', result });
      } catch (e) {
        const result = await cdsHooksService.createHook(hookConfig);
        results.push({ id: hookConfig.id, status: 'created', result });
      }
      
    } catch (error) {
      console.error(`Failed to create hook ${hookConfig.id}:`, error);
      results.push({ id: hookConfig.id, status: 'error', error });
    }
  }
  
  return results;
}

/**
 * Helper function to delete all test hooks
 */
export async function deleteAllTestOverrideHooks(cdsHooksService) {
  const results = [];
  
  for (const [key, hookConfig] of Object.entries(testOverrideScenarios)) {
    try {
      console.log(`Deleting test hook: ${hookConfig.id}`);
      const result = await cdsHooksService.deleteHook(hookConfig.id);
      results.push({ id: hookConfig.id, status: 'deleted', result });
    } catch (error) {
      console.error(`Failed to delete hook ${hookConfig.id}:`, error);
      results.push({ id: hookConfig.id, status: 'error', error });
    }
  }
  
  return results;
}

// Make available in browser console
if (typeof window !== 'undefined') {
  window.testOverrideScenarios = testOverrideScenarios;
  window.createAllTestOverrideHooks = async () => {
    const { cdsHooksService } = await import('../services/cdsHooksService');
    return createAllTestOverrideHooks(cdsHooksService);
  };
  window.deleteAllTestOverrideHooks = async () => {
    const { cdsHooksService } = await import('../services/cdsHooksService');
    return deleteAllTestOverrideHooks(cdsHooksService);
  };
}

export default testOverrideScenarios;