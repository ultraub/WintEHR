/**
 * Script to create a test modal CDS hook
 * Run this in the browser console to create a test hook
 */

import { cdsHooksService } from '../services/cdsHooksService';
import testModalCDSHook from './TestModalCDSHook';

export async function createTestModalHook() {
  try {
    console.log('Creating test modal CDS hook...');
    
    // Check if hook already exists
    try {
      const existing = await cdsHooksService.getHook(testModalCDSHook.id);
      if (existing) {
        console.log('Hook already exists, updating...');
        const result = await cdsHooksService.updateHook(testModalCDSHook.id, testModalCDSHook);
        console.log('✅ Test modal hook updated successfully:', result);
        return result;
      }
    } catch (e) {
      // Hook doesn't exist, create it
    }
    
    // Create the hook
    const result = await cdsHooksService.createHook(testModalCDSHook);
    console.log('✅ Test modal hook created successfully:', result);
    
    console.log(`
To test the modal CDS alert:
1. Navigate to a patient over 65 years old
2. The critical alert should appear as a modal dialog
3. The modal should require acknowledgment before closing

Expected behavior:
- Modal appears blocking the UI
- Cannot be closed without acknowledgment  
- Requires override reason if configured
- No snooze option available
    `);
    
    return result;
  } catch (error) {
    console.error('❌ Failed to create test modal hook:', error);
    throw error;
  }
}

// Also export a function to clean up the test hook
export async function deleteTestModalHook() {
  try {
    console.log('Deleting test modal CDS hook...');
    const result = await cdsHooksService.deleteHook(testModalCDSHook.id);
    console.log('✅ Test modal hook deleted successfully:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to delete test modal hook:', error);
    throw error;
  }
}

// Make functions available globally for easy console access
if (typeof window !== 'undefined') {
  window.createTestModalHook = createTestModalHook;
  window.deleteTestModalHook = deleteTestModalHook;
}

export default { createTestModalHook, deleteTestModalHook };