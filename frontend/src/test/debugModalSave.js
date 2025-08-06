/**
 * Debug Modal Save Issue
 * Check what's actually being saved and retrieved
 */

export async function debugModalSave() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  console.log('=== DEBUG MODAL SAVE ===');
  
  try {
    // Get the test hook
    const hookResponse = await cdsHooksService.getHook('test');
    const hook = hookResponse.data; // Extract the hook from the response
    console.log('1. Retrieved hook:', hook);
    console.log('2. Display behavior:', hook.displayBehavior);
    
    // Check specific fields
    console.log('3. Checking fields:');
    console.log('   - defaultMode:', hook.displayBehavior?.defaultMode);
    console.log('   - displayMode (old):', hook.displayBehavior?.displayMode);
    console.log('   - position (old):', hook.displayBehavior?.position);
    console.log('   - maxCards:', hook.displayBehavior?.maxCards);
    console.log('   - indicatorOverrides:', hook.displayBehavior?.indicatorOverrides);
    
    // Check if old format is mixed with new
    const hasOldFormat = hook.displayBehavior && (
      'displayMode' in hook.displayBehavior ||
      'position' in hook.displayBehavior ||
      'priority' in hook.displayBehavior
    );
    
    const hasNewFormat = hook.displayBehavior && (
      'defaultMode' in hook.displayBehavior ||
      'indicatorOverrides' in hook.displayBehavior
    );
    
    console.log('4. Format detection:');
    console.log('   - Has old format fields:', hasOldFormat);
    console.log('   - Has new format fields:', hasNewFormat);
    
    // Check raw response
    console.log('5. Full hook object:', JSON.stringify(hook, null, 2));
    
    return hook;
  } catch (error) {
    console.error('Debug error:', error);
    return null;
  }
}

// Test save with explicit modal configuration
export async function testExplicitModalSave() {
  const { cdsHooksService } = await import('../services/cdsHooksService');
  
  console.log('=== TEST EXPLICIT MODAL SAVE ===');
  
  // Create minimal hook with only new format
  const modalHook = {
    id: 'test-explicit-modal',
    title: 'Explicit Modal Test',
    description: 'Testing explicit modal configuration',
    hook: 'patient-view',
    enabled: true,
    conditions: [{
      id: 'age-condition',
      type: 'age',
      operator: 'greater_than',
      value: '0',
      enabled: true
    }],
    cards: [{
      id: 'modal-card',
      summary: 'This should be modal',
      detail: 'Testing modal display',
      indicator: 'critical',
      source: { label: 'Test' }
    }],
    displayBehavior: {
      defaultMode: 'modal',
      indicatorOverrides: {
        critical: 'modal',
        warning: 'modal',
        info: 'popup'
      },
      acknowledgment: {
        required: true,
        reasonRequired: false
      },
      snooze: {
        enabled: false
      }
    }
  };
  
  console.log('1. Sending hook with displayBehavior:', modalHook.displayBehavior);
  
  try {
    // Try to create
    let result;
    try {
      result = await cdsHooksService.createHook(modalHook);
      console.log('2. Created new hook');
    } catch (error) {
      if (error.message?.includes('already exists')) {
        console.log('2. Hook exists, updating...');
        result = await cdsHooksService.updateHook(modalHook.id, modalHook);
      } else {
        throw error;
      }
    }
    
    // Retrieve to verify
    const savedResponse = await cdsHooksService.getHook(modalHook.id);
    const saved = savedResponse.data; // Extract the hook from the response
    console.log('3. Retrieved saved hook');
    console.log('4. Saved displayBehavior:', saved.displayBehavior);
    console.log('5. defaultMode is:', saved.displayBehavior?.defaultMode);
    
    // Check if modal was saved
    if (saved.displayBehavior?.defaultMode === 'modal') {
      console.log('✅ SUCCESS: Modal configuration saved correctly!');
    } else {
      console.log('❌ FAILED: Modal configuration not saved');
      console.log('Full saved object:', JSON.stringify(saved, null, 2));
    }
    
    return saved;
  } catch (error) {
    console.error('Test error:', error);
    return null;
  }
}

// Check DisplayBehaviorConfig component
export function checkDisplayBehaviorMerge() {
  console.log('=== CHECK DISPLAY BEHAVIOR MERGE ===');
  
  // Test the merge logic
  const oldFormat = {
    displayMode: 'immediate',
    position: 'top',
    maxCards: 10,
    priority: 'critical-first'
  };
  
  const newFormat = {
    defaultMode: 'modal',
    indicatorOverrides: {
      critical: 'modal',
      warning: 'popup',
      info: 'inline'
    }
  };
  
  // Test spread operator merge
  const merged1 = { ...oldFormat, ...newFormat };
  console.log('1. Old + New merge:', merged1);
  
  const merged2 = { ...newFormat, ...oldFormat };
  console.log('2. New + Old merge:', merged2);
  
  // What DisplayBehaviorConfiguration does
  const configDefault = {
    defaultMode: 'popup',
    acknowledgment: {
      required: false,
      reasonRequired: false
    },
    snooze: {
      enabled: true,
      defaultDuration: 60,
      maxDuration: 1440
    },
    indicatorOverrides: {
      critical: 'modal',
      warning: 'popup',
      info: 'inline'
    }
  };
  
  const merged3 = { ...configDefault, ...oldFormat };
  console.log('3. Config defaults + old format:', merged3);
  
  const merged4 = { ...configDefault, ...newFormat };
  console.log('4. Config defaults + new format:', merged4);
}

// Make available in console
if (typeof window !== 'undefined') {
  window.debugModalSave = debugModalSave;
  window.testExplicitModalSave = testExplicitModalSave;
  window.checkDisplayBehaviorMerge = checkDisplayBehaviorMerge;
  
  console.log('Debug functions available:');
  console.log('- window.debugModalSave()');
  console.log('- window.testExplicitModalSave()');
  console.log('- window.checkDisplayBehaviorMerge()');
}

export default { debugModalSave, testExplicitModalSave, checkDisplayBehaviorMerge };