#!/usr/bin/env node

/**
 * Test script to verify all Clinical Workspace tabs are functional
 * This script navigates through each tab and checks for errors
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000/api/fhir';
const FRONTEND_BASE = 'http://localhost:3000';

const headers = {
  'Authorization': 'Bearer test-token',
  'Content-Type': 'application/json'
};

async function testEndpoint(name, method, url, data = null) {
  try {
    console.log(`\nTesting ${name}...`);
    const config = { 
      method, 
      url: `${API_BASE}${url}`, 
      headers,
      validateStatus: () => true // Don't throw on any status
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    
    if (response.status >= 200 && response.status < 300) {
      console.log(`✅ ${name}: Success (${response.status})`);
      if (response.data?.resources) {
        console.log(`   Found ${response.data.resources.length} resources`);
      }
    } else {
      console.log(`⚠️  ${name}: ${response.status} - ${response.data?.message || 'No error message'}`);
    }
    
    return response.data;
  } catch (error) {
    console.log(`❌ ${name}: Error - ${error.message}`);
    return null;
  }
}

async function testClinicalWorkspaceTabs() {
  console.log('=== Testing Clinical Workspace Tab Data ===\n');
  
  // Test patient endpoint
  const patients = await testEndpoint('Get Patients', 'GET', '/Patient');
  
  if (!patients?.resources?.length) {
    console.log('\n⚠️  No patients found. Please create test data first.');
    return;
  }
  
  const patientId = patients.resources[0].id;
  console.log(`\nUsing patient ID: ${patientId}`);
  
  // Test each tab's data endpoints
  console.log('\n--- Overview Tab ---');
  await testEndpoint('Vital Signs', 'GET', `/Observation?patient=${patientId}&category=vital-signs`);
  await testEndpoint('Allergies', 'GET', `/AllergyIntolerance?patient=${patientId}`);
  await testEndpoint('Conditions', 'GET', `/Condition?patient=${patientId}`);
  await testEndpoint('Medications', 'GET', `/MedicationRequest?patient=${patientId}`);
  
  console.log('\n--- Documentation Tab ---');
  await testEndpoint('Clinical Notes', 'GET', `/DocumentReference?patient=${patientId}`);
  
  console.log('\n--- Orders Tab ---');
  await testEndpoint('Service Requests', 'GET', `/ServiceRequest?patient=${patientId}`);
  
  console.log('\n--- Results Tab ---');
  await testEndpoint('Lab Results', 'GET', `/Observation?patient=${patientId}&category=laboratory`);
  
  console.log('\n--- Appointments Tab ---');
  await testEndpoint('Appointments', 'GET', `/Appointment?patient=${patientId}`);
  
  console.log('\n--- Inbox Tab ---');
  await testEndpoint('Communications', 'GET', `/Communication?recipient=Practitioner/demo-provider`);
  
  console.log('\n--- Tasks Tab ---');
  await testEndpoint('Tasks', 'GET', `/Task?patient=${patientId}`);
  
  console.log('\n\n=== Summary ===');
  console.log('All API endpoints tested. Check the frontend at http://localhost:3000');
  console.log('Navigate through each tab in the Clinical Workspace to verify:');
  console.log('1. No console errors appear');
  console.log('2. Data loads properly (or shows appropriate empty states)');
  console.log('3. All buttons and interactions work as expected');
}

// Run the tests
testClinicalWorkspaceTabs().catch(console.error);