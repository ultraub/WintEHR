// Simple test to verify FHIR client functionality
import { fhirClient } from './services/fhirClient';

async function testFhirClient() {
  try {
    console.log('Testing fhirClient...');
    
    // Test searchPatients
    const result = await fhirClient.searchPatients({
      _count: 5,
      _offset: 0,
      _sort: '-_lastUpdated',
      _total: 'accurate'
    });
    
    console.log('Search result:', result);
    console.log('Total patients:', result.total);
    console.log('Resources count:', result.resources.length);
    
    if (result.resources.length > 0) {
      const firstPatient = result.resources[0];
      console.log('First patient:', firstPatient);
      console.log('First patient name:', firstPatient.name?.[0]);
    }
    
  } catch (error) {
    console.error('FHIR client test failed:', error);
  }
}

// Run the test
testFhirClient();