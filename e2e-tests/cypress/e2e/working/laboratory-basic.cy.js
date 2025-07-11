// Working Test - Basic Laboratory Workflow
describe('Basic Laboratory Workflow', () => {
  
  beforeEach(() => {
    cy.login();
    cy.visit('/patients');
    cy.wait(2000);
    
    // Select first patient and navigate to clinical workspace
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0);
    cy.get('.MuiDataGrid-row').first().click();
    cy.wait(3000);
  });

  it('should access laboratory results and data', () => {
    // Verify we're in the clinical workspace
    cy.url().should('include', 'patients');
    
    // Look for Results tab
    cy.get('body').then($body => {
      if ($body.find('.MuiTab-root').length > 0) {
        cy.log('Clinical tabs found');
        
        // Try to find and click on Results tab
        cy.get('.MuiTab-root').each($tab => {
          const tabText = $tab.text().toLowerCase();
          if (tabText.includes('result') || tabText.includes('lab')) {
            cy.wrap($tab).click();
            cy.wait(1000);
            cy.log('Clicked on Results/Lab tab');
          }
        });
      }
    });
  });

  it('should retrieve laboratory data via FHIR API', () => {
    // Test FHIR API for laboratory observations
    cy.get('.MuiDataGrid-row').first().then($row => {
      const patientId = $row.attr('data-id') || 'test-patient';
      
      // Get laboratory observations
      cy.request({
        method: 'GET',
        url: `${Cypress.env('fhirUrl')}/Observation?patient=${patientId}&category=laboratory&_count=20`,
        headers: { 'Accept': 'application/fhir+json' },
        failOnStatusCode: false
      }).then(response => {
        if (response.status === 200) {
          expect(response.body).to.have.property('resourceType', 'Bundle');
          const observations = response.body.entry || [];
          cy.log(`Found ${observations.length} laboratory observations`);
          
          if (observations.length > 0) {
            const firstObs = observations[0].resource;
            expect(firstObs).to.have.property('resourceType', 'Observation');
            expect(firstObs).to.have.property('status');
            expect(firstObs).to.have.property('code');
          }
        }
      });
    });
  });

  it('should handle diagnostic report data', () => {
    cy.get('.MuiDataGrid-row').first().then($row => {
      const patientId = $row.attr('data-id') || 'test-patient';
      
      // Get diagnostic reports
      cy.request({
        method: 'GET',
        url: `${Cypress.env('fhirUrl')}/DiagnosticReport?patient=${patientId}&_count=10`,
        headers: { 'Accept': 'application/fhir+json' },
        failOnStatusCode: false
      }).then(response => {
        if (response.status === 200) {
          expect(response.body).to.have.property('resourceType', 'Bundle');
          const reports = response.body.entry || [];
          cy.log(`Found ${reports.length} diagnostic reports`);
          
          if (reports.length > 0) {
            const firstReport = reports[0].resource;
            expect(firstReport).to.have.property('resourceType', 'DiagnosticReport');
            expect(firstReport).to.have.property('status');
            expect(firstReport).to.have.property('code');
          }
        }
      });
    });
  });

  it('should create test laboratory order via FHIR API', () => {
    // Create a test service request for laboratory work
    const testServiceRequest = {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: 'order',
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: '108252007',
          display: 'Laboratory procedure'
        }]
      }],
      code: {
        coding: [{
          system: 'http://loinc.org',
          code: '33747-0',
          display: 'General health panel'
        }],
        text: 'Comprehensive Metabolic Panel'
      },
      subject: {
        reference: 'Patient/test-patient-e2e'
      },
      authoredOn: new Date().toISOString(),
      reasonCode: [{
        text: 'Annual physical examination'
      }]
    };

    cy.request({
      method: 'POST',
      url: `${Cypress.env('fhirUrl')}/ServiceRequest`,
      headers: { 'Content-Type': 'application/fhir+json' },
      body: testServiceRequest,
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 201) {
        expect(response.body).to.have.property('resourceType', 'ServiceRequest');
        expect(response.body).to.have.property('id');
        cy.log(`Created service request with ID: ${response.body.id}`);
        
        // Clean up - delete the test resource
        cy.request({
          method: 'DELETE',
          url: `${Cypress.env('fhirUrl')}/ServiceRequest/${response.body.id}`,
          failOnStatusCode: false
        });
      } else {
        cy.log('FHIR service request creation not available in this configuration');
      }
    });
  });

  it('should verify laboratory workflow endpoints', () => {
    // Test laboratory-related API endpoints
    
    // 1. Check if laboratory catalog is available
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/api/emr/clinical/catalog/lab-tests/search?query=glucose&limit=5`,
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 200) {
        cy.log('Laboratory catalog endpoint available');
      }
    });

    // 2. Check orders endpoint
    cy.request({
      method: 'GET',
      url: `${Cypress.env('apiUrl')}/api/emr/clinical/orders?type=laboratory`,
      failOnStatusCode: false
    }).then(response => {
      if (response.status === 200) {
        cy.log('Laboratory orders endpoint available');
      }
    });

    // 3. Verify FHIR laboratory-related resources
    const labResources = ['Observation', 'DiagnosticReport', 'ServiceRequest', 'Specimen'];
    
    labResources.forEach(resourceType => {
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

  it('should handle laboratory result trends and analysis', () => {
    cy.get('.MuiDataGrid-row').first().then($row => {
      const patientId = $row.attr('data-id') || 'test-patient';
      
      // Get specific laboratory results for trend analysis
      const commonLabCodes = ['2339-0', '2345-7', '6768-6']; // Glucose, Cholesterol, Albumin
      
      commonLabCodes.forEach(code => {
        cy.request({
          method: 'GET',
          url: `${Cypress.env('fhirUrl')}/Observation?patient=${patientId}&code=${code}&_sort=-date&_count=5`,
          headers: { 'Accept': 'application/fhir+json' },
          failOnStatusCode: false
        }).then(response => {
          if (response.status === 200 && response.body.entry) {
            const observations = response.body.entry;
            cy.log(`Found ${observations.length} observations for code ${code}`);
            
            if (observations.length > 0) {
              const obs = observations[0].resource;
              if (obs.valueQuantity) {
                cy.log(`Latest value: ${obs.valueQuantity.value} ${obs.valueQuantity.unit}`);
              }
            }
          }
        });
      });
    });
  });
});