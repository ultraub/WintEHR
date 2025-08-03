/**
 * Test Modal Display Configuration
 * Verifies that modal presentation mode is properly saved and retrieved
 */

export async function testModalDisplay() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  const TEST_HOOK_ID = 'test-modal-display';
  
  // Test hook with modal configuration
  const modalHook = {
    id: TEST_HOOK_ID,
    title: 'Modal Display Test',
    description: 'Tests modal presentation mode',
    hook: 'patient-view',
    enabled: true,
    
    // Display behavior with modal as default
    displayBehavior: {
      defaultMode: 'modal',  // This should make all alerts modal
      indicatorOverrides: {
        critical: 'modal',
        warning: 'modal',
        info: 'popup'
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
      id: 'test-condition',
      type: 'age',
      operator: 'greater_than',
      value: '0',  // Always triggers
      enabled: true
    }],
    
    cards: [{
      id: 'test-card',
      summary: 'Modal Test Alert',
      detail: 'This should display as a modal dialog',
      indicator: 'critical',
      source: {
        label: 'Test System'
      }
    }]
  };
  
  try {
    console.log('Creating modal test hook...');
    console.log('Display behavior being sent:', modalHook.displayBehavior);
    
    // Create or update the hook
    let result;
    try {
      result = await cdsHooksService.createHook(modalHook);
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('Hook exists, updating...');
        result = await cdsHooksService.updateHook(TEST_HOOK_ID, modalHook);
      } else {
        throw error;
      }
    }
    
    console.log('Hook saved, retrieving...');
    
    // Retrieve and verify
    const hookResponse = await cdsHooksService.getHook(TEST_HOOK_ID);
    const savedHook = hookResponse.data; // Extract the hook from the response
    console.log('Retrieved hook:', savedHook);
    console.log('Display behavior saved:', savedHook.displayBehavior);
    
    // Check if modal configuration was saved
    const isModalSaved = savedHook.displayBehavior?.defaultMode === 'modal';
    const isCriticalModal = savedHook.displayBehavior?.indicatorOverrides?.critical === 'modal';
    
    if (isModalSaved && isCriticalModal) {
      console.log('✅ SUCCESS: Modal configuration saved correctly!');
      console.log(`Default mode: ${savedHook.displayBehavior.defaultMode}`);
      console.log(`Critical override: ${savedHook.displayBehavior.indicatorOverrides.critical}`);
    } else {
      console.error('❌ FAILED: Modal configuration not saved correctly');
      console.error(`Expected defaultMode: 'modal', got: '${savedHook.displayBehavior?.defaultMode}'`);
      console.error(`Expected critical: 'modal', got: '${savedHook.displayBehavior?.indicatorOverrides?.critical}'`);
    }
    
    return {
      success: isModalSaved && isCriticalModal,
      savedHook,
      displayBehavior: savedHook.displayBehavior
    };
    
  } catch (error) {
    console.error('Test error:', error);
    return { success: false, error };
  }
}

// Check current hook configuration
export async function checkHookDisplay(hookId) {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  try {
    const hookResponse = await cdsHooksService.getHook(hookId);
    const hook = hookResponse.data; // Extract the hook from the response
    console.log(`Hook "${hookId}" display configuration:`, {
      defaultMode: hook.displayBehavior?.defaultMode,
      indicatorOverrides: hook.displayBehavior?.indicatorOverrides,
      acknowledgment: hook.displayBehavior?.acknowledgment
    });
    return hook.displayBehavior;
  } catch (error) {
    console.error(`Failed to get hook ${hookId}:`, error);
    return null;
  }
}

// Clean up test
export async function cleanupModalTest() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  try {
    await cdsHooksService.deleteHook('test-modal-display');
    console.log('Modal test hook cleaned up');
  } catch (error) {
    console.log('No test hook to clean up');
  }
}

// Make available in browser console
if (typeof window !== 'undefined') {
  window.testModalDisplay = testModalDisplay;
  window.checkHookDisplay = checkHookDisplay;
  window.cleanupModalTest = cleanupModalTest;
  
  console.log('Modal display test functions available:');
  console.log('- window.testModalDisplay()');
  console.log('- window.checkHookDisplay("hookId")');
  console.log('- window.cleanupModalTest()');
}

export default { testModalDisplay, checkHookDisplay, cleanupModalTest };