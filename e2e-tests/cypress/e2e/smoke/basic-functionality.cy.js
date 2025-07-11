// Smoke Tests - Basic Functionality
describe('MedGenEMR Smoke Tests', () => {
  
  beforeEach(() => {
    cy.login();
  });

  it('should load the main dashboard without errors', () => {
    cy.visit('/');
    cy.get('[data-testid="dashboard"]').should('be.visible');
    cy.get('[data-testid="patient-list"]').should('be.visible');
    cy.verifyNoConsoleErrors();
  });

  it('should allow patient selection and navigation', () => {
    cy.visit('/');
    
    // Wait for patient list to load
    cy.get('[data-testid="patient-list-item"]').should('have.length.greaterThan', 0);
    
    // Select first patient
    cy.get('[data-testid="patient-list-item"]').first().click();
    
    // Verify patient workspace loads
    cy.get('[data-testid="patient-workspace"]').should('be.visible');
    cy.get('[data-testid="patient-header"]').should('be.visible');
    
    // Verify tabs are present
    cy.get('[data-testid="tab-summary"]').should('be.visible');
    cy.get('[data-testid="tab-chart-review"]').should('be.visible');
    cy.get('[data-testid="tab-results"]').should('be.visible');
    cy.get('[data-testid="tab-orders"]').should('be.visible');
  });

  it('should navigate between clinical tabs without errors', () => {
    cy.visit('/');
    cy.get('[data-testid="patient-list-item"]').first().click();
    
    // Test each tab
    const tabs = ['summary', 'chart-review', 'results', 'orders', 'encounters', 'imaging'];
    
    tabs.forEach(tab => {
      cy.navigateToTab(tab);
      cy.waitForSpinner();
      cy.get(`[data-testid="${tab}-tab-content"]`).should('be.visible');
    });
  });

  it('should handle FHIR API calls correctly', () => {
    cy.visit('/');
    cy.get('[data-testid="patient-list-item"]').first().click();
    
    // Wait for FHIR calls to complete
    cy.wait('@fhirRequest');
    
    // Verify API responses
    cy.get('@fhirRequest').should((interception) => {
      expect(interception.response.statusCode).to.be.oneOf([200, 201]);
    });
  });

  it('should display patient data correctly', () => {
    cy.visit('/');
    cy.get('[data-testid="patient-list-item"]').first().click();
    
    // Check patient header information
    cy.get('[data-testid="patient-name"]').should('not.be.empty');
    cy.get('[data-testid="patient-demographics"]').should('be.visible');
    
    // Navigate to chart review and check for conditions
    cy.navigateToTab('chart-review');
    cy.get('[data-testid="conditions-section"]').should('be.visible');
    
    // Navigate to results and check for observations
    cy.navigateToTab('results');
    cy.get('[data-testid="results-section"]').should('be.visible');
  });

  it('should handle authentication properly', () => {
    cy.logout();
    cy.url().should('include', '/login');
    
    // Try to access protected page
    cy.visit('/');
    cy.url().should('include', '/login');
    
    // Login again
    cy.login();
    cy.url().should('not.include', '/login');
  });

  it('should respond to user interactions within acceptable time', () => {
    cy.visit('/');
    cy.measurePageLoad('dashboard');
    
    cy.get('[data-testid="patient-list-item"]').first().click();
    cy.measurePageLoad('patient-workspace');
    
    cy.navigateToTab('chart-review');
    cy.measurePageLoad('chart-review');
    
    // Verify performance marks exist
    cy.window().its('performance').invoke('getEntriesByType', 'measure').should('have.length.greaterThan', 0);
  });
});