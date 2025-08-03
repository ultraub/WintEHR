/**
 * Debug Display Behavior Flow
 * Comprehensive test to track displayBehavior through the entire save/load cycle
 */

export async function debugDisplayBehaviorFlow() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  console.log('=== DEBUG DISPLAY BEHAVIOR FLOW ===');
  
  const testHookId = 'test-display-behavior-flow';
  
  try {
    // 1. Create a test hook with specific displayBehavior
    const testHook = {
      id: testHookId,
      title: 'Display Behavior Flow Test',
      description: 'Testing displayBehavior save/load cycle',
      hook: 'patient-view',
      enabled: true,
      conditions: [{
        id: 'test-condition',
        type: 'age',
        operator: 'greater_than',
        value: '0',
        enabled: true
      }],
      cards: [{
        id: 'test-card',
        summary: 'Test Card',
        detail: 'Testing display behavior',
        indicator: 'critical',
        source: { label: 'Test' }
      }],
      displayBehavior: {
        defaultMode: 'modal',
        indicatorOverrides: {
          critical: 'modal',
          warning: 'popup',
          info: 'inline'
        },
        acknowledgment: {
          required: true,
          reasonRequired: true
        },
        snooze: {
          enabled: false
        }
      }
    };
    
    console.log('1. Creating hook with displayBehavior:', JSON.stringify(testHook.displayBehavior, null, 2));
    
    // Try to create or update
    try {
      const createResult = await cdsHooksService.createHook(testHook);
      console.log('2. Create result:', createResult);
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('2. Hook exists, updating...');
        const updateResult = await cdsHooksService.updateHook(testHookId, testHook);
        console.log('   Update result:', updateResult);
      } else {
        throw error;
      }
    }
    
    // 2. Retrieve the hook
    console.log('\n3. Retrieving hook...');
    const hookResponse = await cdsHooksService.getHook(testHookId);
    const retrievedHook = hookResponse.data; // Extract the hook from the response
    console.log('4. Retrieved hook displayBehavior:', JSON.stringify(retrievedHook.displayBehavior, null, 2));
    
    // 3. Check specific fields
    console.log('\n5. Field verification:');
    console.log('   - defaultMode:', retrievedHook.displayBehavior?.defaultMode);
    console.log('   - acknowledgment.required:', retrievedHook.displayBehavior?.acknowledgment?.required);
    console.log('   - acknowledgment.reasonRequired:', retrievedHook.displayBehavior?.acknowledgment?.reasonRequired);
    console.log('   - indicatorOverrides.critical:', retrievedHook.displayBehavior?.indicatorOverrides?.critical);
    
    // 4. Check for data transformation issues
    console.log('\n6. Data integrity checks:');
    const sentData = JSON.stringify(testHook.displayBehavior);
    const receivedData = JSON.stringify(retrievedHook.displayBehavior);
    console.log('   - Data matches:', sentData === receivedData);
    if (sentData !== receivedData) {
      console.log('   - Sent:', sentData);
      console.log('   - Received:', receivedData);
    }
    
    // 5. Check if modal setting is preserved
    const modalPreserved = retrievedHook.displayBehavior?.defaultMode === 'modal';
    const reasonRequiredPreserved = retrievedHook.displayBehavior?.acknowledgment?.reasonRequired === true;
    
    console.log('\n7. Test results:');
    console.log('   - Modal setting preserved:', modalPreserved ? '✅ YES' : '❌ NO');
    console.log('   - Reason required preserved:', reasonRequiredPreserved ? '✅ YES' : '❌ NO');
    
    // 6. Check raw API response
    console.log('\n8. Checking raw API response...');
    const axios = (await import('axios')).default;
    const rawResponse = await axios.get(`/api/cds-hooks/hooks/${testHookId}`);
    console.log('9. Raw API displayBehavior:', JSON.stringify(rawResponse.data.displayBehavior, null, 2));
    
    return {
      success: modalPreserved && reasonRequiredPreserved,
      hook: retrievedHook,
      rawData: rawResponse.data
    };
    
  } catch (error) {
    console.error('Test error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Also export a cleanup function
export async function cleanupDisplayBehaviorTest() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  try {
    await cdsHooksService.deleteHook('test-display-behavior-flow');
    console.log('Test hook cleaned up');
  } catch (error) {
    console.log('Cleanup error (may be normal if hook doesn\'t exist):', error.message);
  }
}

// Make available in console
if (typeof window !== 'undefined') {
  window.debugDisplayBehaviorFlow = debugDisplayBehaviorFlow;
  window.cleanupDisplayBehaviorTest = cleanupDisplayBehaviorTest;
  
  console.log('Display behavior debug functions available:');
  console.log('- window.debugDisplayBehaviorFlow()');
  console.log('- window.cleanupDisplayBehaviorTest()');
}

export default { debugDisplayBehaviorFlow, cleanupDisplayBehaviorTest };