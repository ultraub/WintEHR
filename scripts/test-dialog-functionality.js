/**
 * Test Dialog Functionality
 * 
 * This script tests that enhanced dialogs load without errors
 * and that search functionality is working properly.
 * 
 * Run from backend container:
 * docker exec emr-backend node scripts/test-dialog-functionality.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

async function testClinicalCatalogs() {
  console.log('🧪 Testing Clinical Catalog Endpoints\n');
  
  const catalogs = [
    'medications',
    'conditions',
    'procedures',
    'allergens',
    'immunizations',
    'lab-observations',
    'diagnostic-reports',
    'services'
  ];
  
  const results = [];
  
  for (const catalog of catalogs) {
    try {
      console.log(`Testing ${catalog} catalog...`);
      
      // Test 1: Check if catalog endpoint exists
      const response = await axios.get(`${BASE_URL}/api/clinical/catalogs/${catalog}`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.status === 200 && Array.isArray(response.data)) {
        console.log(`✅ ${catalog}: Found ${response.data.length} items`);
        
        // Test 2: Check catalog structure
        if (response.data.length > 0) {
          const firstItem = response.data[0];
          const hasRequiredFields = firstItem.code && firstItem.display;
          
          if (hasRequiredFields) {
            console.log(`   ✓ Correct structure: ${firstItem.display} (${firstItem.code})`);
          } else {
            console.log(`   ✗ Missing required fields`);
          }
        }
        
        results.push({
          catalog,
          success: true,
          count: response.data.length
        });
      } else {
        console.log(`❌ ${catalog}: Invalid response`);
        results.push({
          catalog,
          success: false,
          error: 'Invalid response format'
        });
      }
    } catch (error) {
      console.log(`❌ ${catalog}: ${error.message}`);
      results.push({
        catalog,
        success: false,
        error: error.message
      });
    }
    
    console.log('');
  }
  
  // Test dynamic search endpoints
  console.log('Testing dynamic search endpoints...\n');
  
  const searchTests = [
    { endpoint: '/api/clinical/medications/search?q=aspirin', name: 'Medication Search' },
    { endpoint: '/api/clinical/conditions/search?q=diabetes', name: 'Condition Search' },
    { endpoint: '/api/clinical/procedures/search?q=blood', name: 'Procedure Search' }
  ];
  
  for (const test of searchTests) {
    try {
      const response = await axios.get(`${BASE_URL}${test.endpoint}`);
      
      if (response.status === 200 && Array.isArray(response.data)) {
        console.log(`✅ ${test.name}: Found ${response.data.length} results`);
      } else {
        console.log(`❌ ${test.name}: Invalid response`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n📊 Summary');
  console.log('==========');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Total Catalogs Tested: ${results.length}`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\nFailed Catalogs:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.catalog}: ${r.error}`);
    });
  }
  
  return results;
}

// Test FHIR search parameters
async function testFHIRSearch() {
  console.log('\n\n🔍 Testing FHIR Search Functionality\n');
  
  const searchTests = [
    {
      name: 'Patient Search',
      url: '/fhir/R4/Patient?name=Smith',
      expectedType: 'Bundle'
    },
    {
      name: 'Medication Search',
      url: '/fhir/R4/MedicationRequest?status=active',
      expectedType: 'Bundle'
    },
    {
      name: 'Condition Search',
      url: '/fhir/R4/Condition?clinical-status=active',
      expectedType: 'Bundle'
    },
    {
      name: 'AllergyIntolerance Search',
      url: '/fhir/R4/AllergyIntolerance?clinical-status=active',
      expectedType: 'Bundle'
    }
  ];
  
  for (const test of searchTests) {
    try {
      console.log(`Testing ${test.name}...`);
      const response = await axios.get(`${BASE_URL}${test.url}`);
      
      if (response.data.resourceType === test.expectedType) {
        const entryCount = response.data.entry ? response.data.entry.length : 0;
        console.log(`✅ ${test.name}: Found ${entryCount} results`);
      } else {
        console.log(`❌ ${test.name}: Unexpected response type`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

// Run all tests
async function runTests() {
  console.log('=================================');
  console.log('Dialog & Search Functionality Test');
  console.log('=================================\n');
  
  try {
    await testClinicalCatalogs();
    await testFHIRSearch();
    
    console.log('\n✅ Tests completed!');
    console.log('\nIf catalogs are working, the dialogs should be able to:');
    console.log('1. Load catalog data for dropdowns');
    console.log('2. Search medications, conditions, etc.');
    console.log('3. Save FHIR resources properly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

runTests();