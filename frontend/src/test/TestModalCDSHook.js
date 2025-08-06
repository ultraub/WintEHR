/**
 * Test Modal CDS Hook
 * This file provides a test configuration for a CDS hook that displays as a modal
 */

export const testModalCDSHook = {
  id: 'test-modal-alert',
  title: 'Critical Medication Alert',
  description: 'Test hook to demonstrate modal CDS alerts',
  hook: 'patient-view',
  enabled: true,
  
  // Display behavior configuration for modal presentation
  displayBehavior: {
    defaultMode: 'popup',
    indicatorOverrides: {
      critical: 'modal',  // Critical alerts show as modal
      warning: 'popup',
      info: 'inline'
    },
    acknowledgment: {
      required: true,      // Requires acknowledgment
      reasonRequired: true // Requires override reason
    },
    snooze: {
      enabled: false  // Don't allow snoozing critical alerts
    }
  },
  
  // Simple age-based condition for testing
  conditions: [
    {
      id: 'age-condition',
      type: 'age',
      operator: 'greater_than',
      value: '65',
      enabled: true
    }
  ],
  
  // Critical alert card
  cards: [
    {
      id: 'critical-card',
      summary: 'Critical Drug Interaction Detected',
      detail: 'This patient has a critical drug interaction between Warfarin and Aspirin that requires immediate attention. Risk of severe bleeding.',
      indicator: 'critical',  // This will trigger modal presentation
      source: {
        label: 'Drug Interaction Database',
        url: 'https://example.com/drug-interactions'
      },
      suggestions: [
        {
          label: 'Discontinue Aspirin',
          uuid: 'suggestion-1',
          actions: [{
            type: 'delete',
            description: 'Cancel pending Aspirin prescription'
          }]
        },
        {
          label: 'Reduce Warfarin Dose',
          uuid: 'suggestion-2',
          actions: [{
            type: 'update',
            description: 'Adjust Warfarin dosage to 2.5mg daily'
          }]
        }
      ],
      links: [
        {
          label: 'Drug Interaction Details',
          url: 'https://example.com/warfarin-aspirin',
          type: 'absolute'
        }
      ]
    }
  ],
  
  prefetch: {
    patient: 'Patient/{{context.patientId}}',
    medications: 'MedicationRequest?patient={{context.patientId}}&status=active'
  }
};

/**
 * Instructions to test the modal CDS hook:
 * 
 * 1. Import this configuration in your CDS hooks service
 * 2. Create the hook using the CDS Studio or API:
 *    await cdsHooksService.createHook(testModalCDSHook)
 * 
 * 3. Navigate to a patient over 65 years old
 * 4. The critical alert should appear as a modal dialog
 * 5. The modal should require acknowledgment before closing
 * 
 * Expected behavior:
 * - Modal appears blocking the UI
 * - Cannot be closed without acknowledgment
 * - Requires override reason if configured
 * - No snooze option available
 */

export default testModalCDSHook;