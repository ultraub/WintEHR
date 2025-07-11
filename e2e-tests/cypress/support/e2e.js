// MedGenEMR E2E Test Support
import './commands';

// Global configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Don't fail tests on uncaught exceptions in the app
  // We'll handle these through specific error testing
  return false;
});

// Set up test data before each test
beforeEach(() => {
  // Clear session storage and cookies
  cy.clearAllCookies();
  cy.clearAllSessionStorage();
  
  // Set viewport
  cy.viewport(1280, 720);
  
  // Intercept and handle API calls
  cy.intercept('GET', '/fhir/R4/**').as('fhirRequest');
  cy.intercept('POST', '/fhir/R4/**').as('fhirCreate');
  cy.intercept('PUT', '/fhir/R4/**').as('fhirUpdate');
  cy.intercept('DELETE', '/fhir/R4/**').as('fhirDelete');
  
  // Set common aliases for frequently used elements
  cy.visit('/');
});

// Global after hook for cleanup
afterEach(() => {
  // Take screenshot on failure
  if (cy.state('runnable').state === 'failed') {
    cy.screenshot();
  }
});