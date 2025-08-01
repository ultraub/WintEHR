/**
 * Test Override Reason Save Functionality
 * Verifies that override reason requirements are properly saved at the hook level
 */

export async function testOverrideReasonSave() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  // Test hook configuration with override requirements
  const testHook = {
    id: 'test-override-save',
    title: 'Test Override Reason Save',
    description: 'Verifies override reason configuration is saved correctly',
    hook: 'patient-view',
    enabled: true,
    
    // Hook-level display behavior with acknowledgment configuration
    displayBehavior: {
      defaultMode: 'popup',
      indicatorOverrides: {
        critical: 'modal',
        warning: 'popup',
        info: 'inline'
      },
      acknowledgment: {
        required: true,         // Requires acknowledgment
        reasonRequired: true    // Requires override reason
      },
      snooze: {
        enabled: false
      }
    },
    
    conditions: [{
      id: 'test-condition',
      type: 'age',
      operator: 'greater_than',
      value: '50',
      enabled: true
    }],
    
    cards: [{
      id: 'test-card',
      summary: 'Test Alert - Override Reason Required',
      detail: 'This alert should require an override reason when dismissed',
      indicator: 'critical',
      source: {
        label: 'Test System'
      }
    }]
  };
  
  try {
    console.log('Creating test hook with override reason requirement...');
    
    // Try to create the hook
    const createResult = await cdsHooksService.createHook(testHook);
    console.log('Hook created successfully:', createResult);
    
    // Retrieve the hook to verify it was saved correctly
    const savedHook = await cdsHooksService.getHook(testHook.id);
    console.log('Retrieved saved hook:', savedHook);
    
    // Verify the acknowledgment configuration
    if (savedHook.displayBehavior?.acknowledgment?.reasonRequired === true) {
      console.log('✅ SUCCESS: Override reason requirement was saved correctly!');
      console.log('Display behavior:', savedHook.displayBehavior);
      return { success: true, hook: savedHook };
    } else {
      console.error('❌ FAILED: Override reason requirement was not saved');
      console.error('Expected reasonRequired: true');
      console.error('Actual:', savedHook.displayBehavior?.acknowledgment);
      return { success: false, hook: savedHook };
    }
    
  } catch (error) {
    console.error('Error during test:', error);
    
    // If hook already exists, try to delete and recreate
    if (error.message?.includes('already exists')) {
      console.log('Hook already exists, deleting and retrying...');
      try {
        await cdsHooksService.deleteHook(testHook.id);
        return testOverrideReasonSave(); // Retry
      } catch (deleteError) {
        console.error('Failed to delete existing hook:', deleteError);
      }
    }
    
    return { success: false, error };
  }
}

// Clean up test hook
export async function cleanupOverrideTest() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  try {
    await cdsHooksService.deleteHook('test-override-save');
    console.log('Test hook cleaned up successfully');
  } catch (error) {
    console.log('No test hook to clean up or error:', error.message);
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  window.testOverrideReasonSave = testOverrideReasonSave;
  window.cleanupOverrideTest = cleanupOverrideTest;
}

export default { testOverrideReasonSave, cleanupOverrideTest };