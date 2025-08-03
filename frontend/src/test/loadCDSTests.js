/**
 * Load all CDS test utilities
 * This file is imported in development to make test functions available in the console
 */

// Import test modules
import('./testOverrideReasonSave').then(() => {
  console.log('[CDS Tests] Override reason test loaded');
}).catch(err => {
  console.error('[CDS Tests] Failed to load override reason test:', err);
});

import('./testModalDisplay').then(() => {
  console.log('[CDS Tests] Modal display test loaded');
}).catch(err => {
  console.error('[CDS Tests] Failed to load modal display test:', err);
});

import('./debugModalSave').then(() => {
  console.log('[CDS Tests] Debug modal save loaded');
}).catch(err => {
  console.error('[CDS Tests] Failed to load debug modal save:', err);
});

import('./debugDisplayBehaviorFlow').then(() => {
  console.log('[CDS Tests] Display behavior flow debug loaded');
}).catch(err => {
  console.error('[CDS Tests] Failed to load display behavior flow debug:', err);
});

// Log available functions
console.log('[CDS Tests] Available test functions:');
console.log('- window.testOverrideReasonSave()');
console.log('- window.cleanupOverrideTest()');
console.log('- window.testModalDisplay()');
console.log('- window.checkHookDisplay(hookId)');
console.log('- window.cleanupModalTest()');
console.log('- window.debugDisplayBehaviorFlow()');
console.log('- window.cleanupDisplayBehaviorTest()');

export default {};