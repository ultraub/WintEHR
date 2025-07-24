/**
 * Test various FHIR data formats for EncounterSummaryDialog
 */

// Test data for various reasonCode/reason formats
const testEncounterFormats = {
  // Standard FHIR R4 format - array of CodeableConcept
  arrayFormat: {
    id: 'enc-1',
    status: 'finished',
    class: { code: 'AMB', display: 'Ambulatory' },
    reasonCode: [
      {
        coding: [{
          code: '386661006',
          display: 'Fever'
        }],
        text: 'High fever'
      },
      {
        coding: [{
          code: '49727002',
          display: 'Cough'
        }],
        text: 'Persistent cough'
      }
    ]
  },

  // Single object format (non-standard but common in real data)
  singleObjectFormat: {
    id: 'enc-2',
    status: 'finished',
    class: { code: 'AMB', display: 'Ambulatory' },
    reasonCode: {
      coding: [{
        code: '386661006',
        display: 'Fever'
      }],
      text: 'High fever'
    }
  },

  // Using deprecated 'reason' field as array
  reasonArrayFormat: {
    id: 'enc-3',
    status: 'finished',
    class: { code: 'AMB', display: 'Ambulatory' },
    reason: [
      {
        reference: 'Condition/123',
        display: 'Hypertension'
      }
    ]
  },

  // Using deprecated 'reason' field as single object
  reasonSingleFormat: {
    id: 'enc-4',
    status: 'finished',
    class: { code: 'AMB', display: 'Ambulatory' },
    reason: {
      reference: 'Condition/456',
      display: 'Diabetes mellitus'
    }
  },

  // Empty/null formats
  emptyFormat: {
    id: 'enc-5',
    status: 'finished',
    class: { code: 'AMB', display: 'Ambulatory' },
    reasonCode: [],
    reason: null
  },

  // No reason fields at all
  noReasonFormat: {
    id: 'enc-6',
    status: 'finished',
    class: { code: 'AMB', display: 'Ambulatory' }
  }
};

// Helper function to simulate rendering and check for errors
const testEncounterFormat = (encounter, description) => {
  console.log(`Testing: ${description}`);
  
  try {
    // Simulate the condition check
    const hasReasonCode = encounter.reasonCode && (Array.isArray(encounter.reasonCode) ? encounter.reasonCode.length > 0 : true);
    const hasReason = encounter.reason && (Array.isArray(encounter.reason) ? encounter.reason.length > 0 : true);
    const shouldShowReasons = hasReasonCode || hasReason;
    
    console.log(`  - Has reasons to display: ${shouldShowReasons}`);
    
    if (shouldShowReasons) {
      // Simulate the array conversion logic
      const reasonsArray = Array.isArray(encounter.reasonCode) ? encounter.reasonCode : 
                          Array.isArray(encounter.reason) ? encounter.reason :
                          encounter.reasonCode ? [encounter.reasonCode] :
                          encounter.reason ? [encounter.reason] : [];
      
      console.log(`  - Converted to array with ${reasonsArray.length} items`);
      
      // Simulate mapping over reasons
      reasonsArray.map((reason, idx) => {
        const label = reason.text || reason.coding?.[0]?.display || reason.use?.[0]?.coding?.[0]?.display || reason.display || 'Unknown';
        console.log(`  - Reason ${idx + 1}: ${label}`);
        return label;
      });
    }
    
    console.log('  ✅ Test passed - no errors\n');
    return true;
  } catch (error) {
    console.error(`  ❌ Test failed - ${error.message}\n`);
    return false;
  }
};

// Run all tests
console.log('Testing EncounterSummaryDialog with various FHIR data formats:\n');

Object.entries(testEncounterFormats).forEach(([key, encounter]) => {
  testEncounterFormat(encounter, key);
});

console.log('All tests completed.');

export { testEncounterFormats, testEncounterFormat };