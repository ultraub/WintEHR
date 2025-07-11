// MedGenEMR Custom Cypress Commands

// Authentication commands
Cypress.Commands.add('login', (username = 'demo', password = 'password') => {
  cy.visit('/login');
  cy.get('[data-testid="username-input"]').type(username);
  cy.get('[data-testid="password-input"]').type(password);
  cy.get('[data-testid="login-button"]').click();
  cy.url().should('not.include', '/login');
  cy.get('[data-testid="user-avatar"]').should('be.visible');
});

Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click();
  cy.get('[data-testid="logout-button"]').click();
  cy.url().should('include', '/login');
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