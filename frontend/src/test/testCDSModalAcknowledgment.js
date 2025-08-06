/**
 * Test CDS Modal Acknowledgment Flow
 * Verifies that modal CDS alerts close properly after acknowledgment
 */

export async function testCDSModalAcknowledgment() {
  console.log('=== TEST CDS MODAL ACKNOWLEDGMENT ===');
  
  // Check if we're in clinical workspace
  const isClinicalWorkspace = window.location.pathname.includes('/clinical/');
  if (!isClinicalWorkspace) {
    console.warn('⚠️ This test should be run from the clinical workspace');
    console.log('Navigate to a patient in the clinical workspace first');
    return;
  }
  
  // Look for CDS modal dialogs
  const checkForModals = () => {
    const dialogs = document.querySelectorAll('[role="dialog"]');
    const cdsModals = Array.from(dialogs).filter(dialog => {
      const titleElement = dialog.querySelector('h2, h6');
      return titleElement && (
        titleElement.textContent.includes('Critical Alert') ||
        titleElement.textContent.includes('CDS Alert') ||
        titleElement.textContent.includes('Clinical Decision Support')
      );
    });
    
    return cdsModals;
  };
  
  const modals = checkForModals();
  console.log(`Found ${modals.length} CDS modal(s)`);
  
  if (modals.length === 0) {
    console.log('No CDS modals found. To test:');
    console.log('1. Create a CDS hook with modal display mode');
    console.log('2. Navigate to a patient that triggers the hook');
    console.log('3. Run this test again');
    return;
  }
  
  // Check for acknowledgment buttons
  const ackButtons = document.querySelectorAll('button');
  const acknowledgeButtons = Array.from(ackButtons).filter(btn => 
    btn.textContent.includes('Acknowledge') || 
    btn.textContent.includes('Continue')
  );
  
  console.log(`Found ${acknowledgeButtons.length} acknowledgment button(s)`);
  
  // Monitor modal close
  console.log('\nMonitoring modal state...');
  console.log('Click the acknowledgment button and enter a reason if prompted');
  
  // Set up observer to detect when modal closes
  const observer = new MutationObserver((mutations) => {
    const currentModals = checkForModals();
    if (currentModals.length === 0) {
      console.log('✅ SUCCESS: Modal closed after acknowledgment!');
      observer.disconnect();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Disconnect observer after 30 seconds
  setTimeout(() => {
    const finalModals = checkForModals();
    if (finalModals.length > 0) {
      console.log('❌ FAILED: Modal still open after 30 seconds');
    }
    observer.disconnect();
  }, 30000);
  
  return {
    modalsFound: modals.length,
    acknowledgeButtonsFound: acknowledgeButtons.length
  };
}

// Helper to trigger a test CDS alert
export async function triggerTestCDSAlert() {
  console.log('=== TRIGGER TEST CDS ALERT ===');
  
  try {
    // Import CDS context
    const CDSContext = window.CDSContext || window.useCDS?.();
    if (!CDSContext) {
      console.error('CDS Context not available');
      return;
    }
    
    // Create a test alert
    const testAlert = {
      uuid: `test-modal-${Date.now()}`,
      serviceId: 'test-service',
      serviceName: 'Test Modal Service',
      summary: 'Test Modal Alert',
      detail: 'This is a test alert to verify modal acknowledgment',
      indicator: 'critical',
      displayBehavior: {
        presentationMode: 'modal',
        acknowledgmentRequired: true,
        reasonRequired: true
      },
      source: {
        label: 'Test System',
        url: 'https://example.com'
      }
    };
    
    console.log('Test alert created:', testAlert);
    console.log('Note: Direct alert injection may require CDS hook execution');
    
    return testAlert;
  } catch (error) {
    console.error('Failed to trigger test alert:', error);
    return null;
  }
}

// Make available in console
if (typeof window !== 'undefined') {
  window.testCDSModalAcknowledgment = testCDSModalAcknowledgment;
  window.triggerTestCDSAlert = triggerTestCDSAlert;
  
  console.log('CDS Modal test functions available:');
  console.log('- window.testCDSModalAcknowledgment()');
  console.log('- window.triggerTestCDSAlert()');
}

export default { testCDSModalAcknowledgment, triggerTestCDSAlert };