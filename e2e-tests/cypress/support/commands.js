// WintEHR Custom Cypress Commands

// Authentication commands
Cypress.Commands.add('login', (providerId = 'dr-smith') => {
  // First, check if we're already authenticated
  cy.window().then(win => {
    const token = win.localStorage.getItem('auth_token');
    if (token) {
      cy.log('Already authenticated with token');
      return;
    }
    
    // If not authenticated, perform login via API
    cy.request({
      method: 'POST',
      url: `${Cypress.env('apiUrl')}/api/auth/login`,
      body: {
        provider_id: providerId
      }
    }).then(response => {
      expect(response.status).to.eq(200);
      
      const { session_token, provider } = response.body;
      
      // Store auth data in localStorage
      win.localStorage.setItem('auth_token', session_token);
      win.localStorage.setItem('auth_user', JSON.stringify(provider));
      
      cy.log(`Authenticated as ${provider.name}`);
    });
  });
});

Cypress.Commands.add('logout', () => {
  // Clear localStorage to log out
  cy.window().then(win => {
    win.localStorage.removeItem('auth_token');
    win.localStorage.removeItem('auth_user');
  });
  
  // Optionally call logout endpoint
  cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/auth/logout`,
    failOnStatusCode: false
  });
  
  cy.log('Logged out successfully');
});

// Patient navigation commands
Cypress.Commands.add('selectPatient', (patientName) => {
  cy.get('[data-testid="patient-search"]').type(patientName);
  cy.get(`[data-testid="patient-item"]:contains("${patientName}")`).first().click();
  cy.get('[data-testid="patient-header"]').should('contain', patientName);
});

Cypress.Commands.add('navigateToTab', (tabName) => {
  cy.get(`[data-testid="tab-${tabName.toLowerCase()}"]`).click();
  cy.get(`[data-testid="${tabName.toLowerCase()}-tab-content"]`).should('be.visible');
});

// FHIR resource commands
Cypress.Commands.add('createFHIRResource', (resourceType, resourceData) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('fhirUrl')}/${resourceType}`,
    headers: {
      'Content-Type': 'application/fhir+json'
    },
    body: resourceData
  });
});

Cypress.Commands.add('getFHIRResource', (resourceType, resourceId) => {
  return cy.request({
    method: 'GET',
    url: `${Cypress.env('fhirUrl')}/${resourceType}/${resourceId}`,
    headers: {
      'Accept': 'application/fhir+json'
    }
  });
});

Cypress.Commands.add('searchFHIRResources', (resourceType, searchParams = {}) => {
  const queryString = new URLSearchParams(searchParams).toString();
  return cy.request({
    method: 'GET',
    url: `${Cypress.env('fhirUrl')}/${resourceType}?${queryString}`,
    headers: {
      'Accept': 'application/fhir+json'
    }
  });
});

// Clinical workflow commands
Cypress.Commands.add('createMedicationOrder', (patientId, medicationCode, instructions) => {
  const medicationRequest = {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: medicationCode,
        display: 'Test Medication'
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    dosageInstruction: [{
      text: instructions
    }],
    authoredOn: new Date().toISOString()
  };
  
  return cy.createFHIRResource('MedicationRequest', medicationRequest);
});

Cypress.Commands.add('createCondition', (patientId, conditionCode, conditionText) => {
  const condition = {
    resourceType: 'Condition',
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: 'active'
      }]
    },
    code: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: conditionCode,
        display: conditionText
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString()
  };
  
  return cy.createFHIRResource('Condition', condition);
});

// UI interaction helpers
Cypress.Commands.add('waitForSpinner', () => {
  cy.get('[data-testid="loading-spinner"]').should('not.exist');
});

Cypress.Commands.add('expectToast', (message, type = 'success') => {
  cy.get(`[data-testid="toast-${type}"]`).should('contain', message);
});

Cypress.Commands.add('closeToast', () => {
  cy.get('[data-testid="toast-close"]').click();
});

// Form helpers
Cypress.Commands.add('fillForm', (formData) => {
  Object.keys(formData).forEach(field => {
    cy.get(`[data-testid="${field}-input"]`).clear().type(formData[field]);
  });
});

Cypress.Commands.add('submitForm', (formId) => {
  cy.get(`[data-testid="${formId}-submit"]`).click();
});

// Verification helpers
Cypress.Commands.add('verifyPatientData', (patientId) => {
  cy.searchFHIRResources('Patient', { _id: patientId }).then(response => {
    expect(response.status).to.eq(200);
    expect(response.body.total).to.be.greaterThan(0);
  });
});

Cypress.Commands.add('verifyNoConsoleErrors', () => {
  cy.window().then((win) => {
    const consoleErrors = win.console.error.toString();
    expect(consoleErrors).to.not.contain('Error');
  });
});

// Performance helpers
Cypress.Commands.add('measurePageLoad', (pageName) => {
  cy.window().its('performance').invoke('mark', `${pageName}-start`);
  cy.get('[data-testid="page-loaded"]').should('be.visible');
  cy.window().its('performance').invoke('mark', `${pageName}-end`);
  cy.window().its('performance').invoke('measure', pageName, `${pageName}-start`, `${pageName}-end`);
});

// Additional FHIR resource creation helpers
Cypress.Commands.add('createObservation', (patientId, observationData) => {
  const observation = {
    resourceType: 'Observation',
    status: 'final',
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: observationData.code,
        display: observationData.display
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    valueQuantity: {
      value: observationData.value,
      unit: observationData.unit,
      system: 'http://unitsofmeasure.org'
    },
    interpretation: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
        code: observationData.interpretation || 'N',
        display: observationData.interpretation === 'H' ? 'High' : observationData.interpretation === 'L' ? 'Low' : 'Normal'
      }]
    }],
    effectiveDateTime: new Date().toISOString()
  };
  
  return cy.createFHIRResource('Observation', observation);
});

Cypress.Commands.add('createAllergy', (patientId, allergen, severity = 'moderate') => {
  const allergy = {
    resourceType: 'AllergyIntolerance',
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
        code: 'active'
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
        code: 'confirmed'
      }]
    },
    code: {
      coding: [{
        system: 'http://snomed.info/sct',
        code: '387517004',
        display: allergen
      }]
    },
    patient: {
      reference: `Patient/${patientId}`
    },
    criticality: severity,
    recordedDate: new Date().toISOString()
  };
  
  return cy.createFHIRResource('AllergyIntolerance', allergy);
});

Cypress.Commands.add('createServiceRequest', (patientId, serviceType, code, display) => {
  const serviceRequest = {
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    category: [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: serviceType,
        display: serviceType === '108252007' ? 'Laboratory procedure' : 'Imaging procedure'
      }]
    }],
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: code,
        display: display
      }]
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    authoredOn: new Date().toISOString()
  };
  
  return cy.createFHIRResource('ServiceRequest', serviceRequest);
});

// Imaging-specific commands
Cypress.Commands.add('createImagingStudy', (patientId, modality = 'CT', bodyPart = 'CHEST') => {
  const imagingStudy = {
    resourceType: 'ImagingStudy',
    status: 'available',
    modality: [{
      system: 'http://dicom.nema.org/resources/ontology/DCM',
      code: modality
    }],
    subject: {
      reference: `Patient/${patientId}`
    },
    started: new Date().toISOString(),
    numberOfSeries: 1,
    numberOfInstances: 10,
    series: [{
      uid: `1.2.3.4.5.${Date.now()}`,
      number: 1,
      modality: {
        system: 'http://dicom.nema.org/resources/ontology/DCM',
        code: modality
      },
      description: `${modality} ${bodyPart}`,
      numberOfInstances: 10,
      bodySite: {
        system: 'http://snomed.info/sct',
        code: '51185008',
        display: bodyPart
      }
    }]
  };
  
  return cy.createFHIRResource('ImagingStudy', imagingStudy);
});

// CDS Hooks testing commands
Cypress.Commands.add('mockCDSHookResponse', (hookType, cards = []) => {
  const defaultCard = {
    summary: 'Test CDS Card',
    indicator: 'info',
    detail: 'This is a test CDS hook response',
    source: {
      label: 'Test CDS Service'
    }
  };
  
  const response = {
    cards: cards.length > 0 ? cards : [defaultCard]
  };
  
  cy.intercept('POST', `/cds-hooks/${hookType}`, response).as('cdsHookCall');
});

// Advanced navigation helpers
Cypress.Commands.add('navigateToPatient', (patientId) => {
  cy.visit(`/patients/${patientId}/clinical`);
  cy.get('[data-testid="patient-workspace"]').should('be.visible');
});

Cypress.Commands.add('openPatientInNewTab', (patientId) => {
  cy.window().then(win => {
    win.open(`/patients/${patientId}/clinical`, '_blank');
  });
});

// Workflow-specific helpers
Cypress.Commands.add('completePharmacyWorkflow', (medicationOrderId) => {
  cy.visit('/pharmacy');
  cy.get(`[data-testid="order-${medicationOrderId}"]`).click();
  cy.get('[data-testid="verify-order"]').click();
  cy.get('[data-testid="dispense-medication"]').click();
  cy.get('[data-testid="lot-number"]').type('LOT123');
  cy.get('[data-testid="expiration-date"]').type('2025-12-31');
  cy.get('[data-testid="complete-dispensing"]').click();
});

Cypress.Commands.add('createRadiologyReport', (studyId, findings, impression) => {
  cy.visit('/radiology');
  cy.get(`[data-testid="study-${studyId}"]`).click();
  cy.get('[data-testid="create-report"]').click();
  cy.get('[data-testid="findings"]').type(findings);
  cy.get('[data-testid="impression"]').type(impression);
  cy.get('[data-testid="report-status"]').select('final');
  cy.get('[data-testid="submit-report"]').click();
});

// Error handling and debugging
Cypress.Commands.add('debugNetworkRequests', () => {
  cy.intercept('**', (req) => {
    console.log('Request:', req.method, req.url);
  });
});

Cypress.Commands.add('captureApplicationState', () => {
  cy.window().then(win => {
    const state = {
      url: win.location.href,
      timestamp: new Date().toISOString(),
      localStorage: { ...win.localStorage },
      sessionStorage: { ...win.sessionStorage }
    };
    console.log('Application State:', state);
  });
});

// Accessibility testing helpers
Cypress.Commands.add('checkA11y', (selector = null) => {
  cy.injectAxe();
  cy.checkA11y(selector, {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true }
    }
  });
});

// Data validation helpers
Cypress.Commands.add('validateFHIRResource', (resourceType, resource) => {
  // Basic FHIR resource validation
  expect(resource).to.have.property('resourceType', resourceType);
  expect(resource).to.have.property('id');
  expect(resource).to.have.property('meta');
  expect(resource.meta).to.have.property('lastUpdated');
});

// Test data cleanup
Cypress.Commands.add('cleanupTestData', () => {
  // Clean up any test data created during tests
  cy.window().then(win => {
    if (win.testDataCleanup) {
      win.testDataCleanup();
    }
  });
});