// Test script to verify Condition update works
const testConditionUpdate = async () => {
  try {
    // First, get the current condition
    const getResponse = await fetch('http://localhost:8000/fhir/R4/Condition/793e9890-a313-4bb2-b1fa-abf526b4bed3', {
      headers: {
        'Accept': 'application/fhir+json'
      }
    });
    
    if (!getResponse.ok) {
      console.error('Failed to get condition:', getResponse.status);
      return;
    }
    
    const condition = await getResponse.json();
    console.log('Original condition:', JSON.stringify(condition, null, 2));
    
    // Update the condition - just change the clinical status
    const updatedCondition = {
      ...condition,
      clinicalStatus: {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'inactive',
          display: 'Inactive'
        }]
      }
    };
    
    // Send the update
    const updateResponse = await fetch(`http://localhost:8000/fhir/R4/Condition/${condition.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      },
      body: JSON.stringify(updatedCondition)
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error('Update failed:', updateResponse.status, error);
    } else {
      console.log('Update successful!');
      const result = await updateResponse.json();
      console.log('Updated condition:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Run the test
testConditionUpdate();