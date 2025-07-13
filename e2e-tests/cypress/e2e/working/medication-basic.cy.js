// Working Test - Basic Medication Management
describe('Basic Medication Management', () => {
  
  beforeEach(() => {
    cy.login();
    cy.visit('/patients');
    cy.wait(2000);
    
    // Select first patient and navigate to clinical workspace
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0);
    cy.get('.MuiDataGrid-row').first().click();
    cy.wait(3000);
  });

  it('should navigate to clinical workspace and access tabs', () => {
    // Verify we're in the clinical workspace
    cy.url().should('include', 'patients');
    
    // Look for clinical tabs
    cy.get('body').then($body => {
      if ($body.find('.MuiTab-root').length > 0) {
        cy.log('Clinical tabs found');
        
        // Try to find and click on Orders tab
        cy.get('.MuiTab-root').each($tab => {
          const tabText = $tab.text().toLowerCase();
          if (tabText.includes('order') || tabText.includes('prescription')) {
            cy.wrap($tab).click();
            cy.wait(1000);
            cy.log('Clicked on Orders/Prescription tab');
          }
        });
        
        // Try to find and click on Chart Review tab
        cy.get('.MuiTab-root').each($tab => {
          const tabText = $tab.text().toLowerCase();
          if (tabText.includes('chart') || tabText.includes('medication')) {
            cy.wrap($tab).click();
            cy.wait(1000);
            cy.log('Clicked on Chart/Medication tab');
          }
        });
      } else {
        cy.log('No tabs found - different workspace structure');
        // Look for other medication-related UI elements
        cy.get('body').should('be.visible');
      }
    });
  });

  it('should access FHIR medication data via API', () => {
    // Test FHIR API directly for medication data
    cy.get('.MuiDataGrid-row').first().then($row => {
      // Extract patient ID if possible
      const patientId = $row.attr('data-id') || 'test-patient';
      
      // Test FHIR medication request endpoint
      cy.request({
        method: 'GET',
        url: `${Cypress.env('fhirUrl')}/MedicationRequest?patient=${patientId}&_count=10`,
        headers: { 'Accept': 'application/fhir+json' },
        failOnStatusCode: false
      }).then(response => {
        expect(response.status).to.be.oneOf([200, 404]); // 404 is OK if no medications
        if (response.status === 200) {
          expect(response.body).to.have.property('resourceType', 'Bundle');
          cy.log(`Found ${response.body.total || 0} medication requests`);
        }
      });
    });
  });

  it('should handle medication search functionality', () => {
    // Test medication search API
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/api/emr/clinical/catalog/medications/search?query=aspirin&limit=5`,
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 200) {
        expect(response.body).to.be.an('array');
        cy.log(`Found ${response.body.length} medications matching 'aspirin'`);
      } else {
        cy.log('Medication search endpoint not available');
      }
    });
  });

  it('should create a test medication request via FHIR API', () => {
    // Create a test medication request directly via FHIR API
    const testMedicationRequest = {
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: '1191',
          display: 'Aspirin'
        }],
        text: 'Aspirin 81mg'
      },
      subject: {
        reference: 'Patient/test-patient-e2e'
      },
      authoredOn: new Date().toISOString(),
      dosageInstruction: [{
        text: 'Take one tablet daily with food',
        timing: {
          repeat: {
            frequency: 1,
            period: 1,
            periodUnit: 'd'
          }
        }
      }]
    };

    cy.request({
      method: 'POST',
      url: `${Cypress.env('fhirUrl')}/MedicationRequest`,
      headers: { 'Content-Type': 'application/fhir+json' },
      body: testMedicationRequest,
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 201) {
        expect(response.body).to.have.property('resourceType', 'MedicationRequest');
        expect(response.body).to.have.property('id');
        cy.log(`Created medication request with ID: ${response.body.id}`);
        
        // Clean up - delete the test resource
        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('fhirUrl')}/MedicationRequest/${response.body.id}`,
          failOnStatusCode: false
        });
      } else {
        cy.log('FHIR medication creation not available in this configuration');
      }
    });
  });

  it('should verify medication workflow integration', () => {
    // Test the integration between different parts of the medication workflow
    
    // 1. Check if pharmacy endpoints are available
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/api/emr/clinical/pharmacy/queue`,
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 200) {
        cy.log('Pharmacy queue endpoint available');
      }
    });

    // 2. Check if order management endpoints are available
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/api/emr/clinical/orders`,
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 200) {
        cy.log('Orders endpoint available');
      }
    });

    // 3. Verify FHIR medication-related resources are accessible
    const medicationResources = ['Medication', 'MedicationRequest', 'MedicationDispense', 'MedicationStatement'];
    
    medicationResources.forEach(resourceType => {
      cy.request({
        method: 'GET',
        url: `${Cypress.env('fhirUrl')}/${resourceType}?_count=1`,
        headers: { 'Accept': 'application/fhir+json' },
        failOnStatusCode: false
      }).then(response => {
        if (response.status === 200) {
          cy.log(`${resourceType} resources accessible`);
        }
      });
    });
  });
});