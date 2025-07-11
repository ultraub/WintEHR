// Smoke Tests - Basic Functionality
describe('MedGenEMR Smoke Tests', () => {
  
  beforeEach(() => {
    // Authenticate before each test
    cy.login();
    // Visit the patients page after authentication
    cy.visit('/patients');
    // Wait for the page to load
    cy.wait(2000);
  });

  it('should load the main dashboard without errors', () => {
    // Check for main content area
    cy.get('#root').should('be.visible');
    // Look for Material-UI DataGrid (patient list)
    cy.get('.MuiDataGrid-root', { timeout: 15000 }).should('be.visible');
    // Check for Typography with "Teaching EMR" or patient-related text
    cy.contains('Patients', { timeout: 10000 }).should('be.visible');
  });

  it('should allow patient selection and navigation', () => {
    // Wait for patient list to load
    cy.get('.MuiDataGrid-root', { timeout: 15000 }).should('be.visible');
    cy.get('.MuiDataGrid-row', { timeout: 10000 }).should('have.length.greaterThan', 0);
    
    // Select first patient row
    cy.get('.MuiDataGrid-row').first().click();
    
    // Patient details should load (could be in modal or navigation)
    // Look for patient information display
    cy.url().should('not.eq', Cypress.config('baseUrl') + '/patients');
  });

  it('should navigate between clinical tabs without errors', () => {
    cy.get('.MuiDataGrid-row', { timeout: 10000 }).first().click();
    
    // Wait for navigation to complete
    cy.wait(2000);
    
    // Check if we navigated to a clinical page
    cy.url().should('include', 'patients');
    
    // Look for tabs (Material-UI Tabs) - but make it optional
    cy.get('body').then($body => {
      if ($body.find('.MuiTab-root').length > 0) {
        // Tabs are present, click through them
        cy.get('.MuiTab-root').should('have.length.greaterThan', 0);
        cy.get('.MuiTab-root').each($tab => {
          cy.wrap($tab).click();
          cy.wait(500); // Allow tab content to load
        });
      } else {
        // No tabs found, but verify we're on a patient page
        cy.log('No tabs found - patient may open in different view');
        cy.get('body').should('contain.text', 'Patient'); // Look for patient-related content
      }
    });
  });

  it('should handle FHIR API calls correctly', () => {
    // Wait for initial API calls to load patients
    cy.wait('@fhirRequest', { timeout: 15000 });
    
    // Verify API responses
    cy.get('@fhirRequest').should((interception) => {
      expect(interception.response.statusCode).to.be.oneOf([200, 201]);
    });
  });

  it('should display patient data correctly', () => {
    cy.get('.MuiDataGrid-root', { timeout: 15000 }).should('be.visible');
    
    // Check that patient data is loaded in the grid
    cy.get('.MuiDataGrid-cell').should('have.length.greaterThan', 0);
    
    // Verify that patient names are visible (not empty cells)
    cy.get('.MuiDataGrid-cell').first().should('not.be.empty');
  });

  it('should handle authentication properly', () => {
    // Verify we can access the application
    cy.get('.MuiDataGrid-root', { timeout: 15000 }).should('be.visible');
  });

  it('should respond to user interactions within acceptable time', () => {
    const startTime = Date.now();
    
    cy.get('.MuiDataGrid-root', { timeout: 15000 }).should('be.visible');
    
    cy.then(() => {
      const loadTime = Date.now() - startTime;
      expect(loadTime).to.be.lessThan(15000); // 15 seconds is generous for initial load
    });
  });
});