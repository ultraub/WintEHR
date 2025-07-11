// Critical Tests - Clinical Workflows
describe('Critical Clinical Workflows', () => {
  
  let testPatientId;
  
  beforeEach(() => {
    cy.login();
    cy.visit('/');
    
    // Get the first patient ID for testing
    cy.get('[data-testid="patient-list-item"]').first().then($el => {
      testPatientId = $el.attr('data-patient-id');
    });
    
    cy.get('[data-testid="patient-list-item"]').first().click();
  });

  describe('Medication Management Workflow', () => {
    it('should create, verify, and dispense medication orders', () => {
      // Navigate to orders tab
      cy.navigateToTab('orders');
      
      // Create new medication order
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      
      // Fill in medication details
      cy.get('[data-testid="medication-search"]').type('Aspirin');
      cy.get('[data-testid="medication-option"]').first().click();
      cy.get('[data-testid="dosage-input"]').type('81mg daily');
      cy.get('[data-testid="instructions-input"]').type('Take with food');
      
      // Submit order
      cy.get('[data-testid="submit-order"]').click();
      cy.expectToast('Medication order created successfully');
      
      // Verify order appears in list
      cy.get('[data-testid="medication-orders"]').should('contain', 'Aspirin');
      
      // Navigate to pharmacy workflow
      cy.visit('/pharmacy');
      
      // Verify order appears in pharmacy queue
      cy.get('[data-testid="pharmacy-queue"]').should('contain', 'Aspirin');
      
      // Process through pharmacy workflow
      cy.get('[data-testid="order-item"]').first().click();
      cy.get('[data-testid="verify-order"]').click();
      cy.get('[data-testid="dispense-medication"]').click();
      
      // Verify completion
      cy.expectToast('Medication dispensed successfully');
    });

    it('should handle medication interactions and alerts', () => {
      // Create first medication
      cy.createMedicationOrder(testPatientId, '1191', 'Aspirin 81mg daily').then(() => {
        // Create second medication that may interact
        cy.createMedicationOrder(testPatientId, '1191', 'Warfarin 5mg daily').then(() => {
          
          cy.navigateToTab('chart-review');
          
          // Check for interaction alerts
          cy.get('[data-testid="drug-interactions"]').should('be.visible');
          cy.get('[data-testid="interaction-alert"]').should('contain', 'interaction');
        });
      });
    });
  });

  describe('Laboratory Results Workflow', () => {
    it('should display and interpret lab results correctly', () => {
      cy.navigateToTab('results');
      
      // Check for lab results display
      cy.get('[data-testid="lab-results"]').should('be.visible');
      
      // Verify result categories
      cy.get('[data-testid="chemistry-results"]').should('be.visible');
      cy.get('[data-testid="hematology-results"]').should('be.visible');
      
      // Check for abnormal value highlighting
      cy.get('[data-testid="abnormal-result"]').should('have.class', 'abnormal');
      
      // Verify trending functionality
      cy.get('[data-testid="trend-button"]').first().click();
      cy.get('[data-testid="trend-chart"]').should('be.visible');
    });

    it('should handle critical values and alerts', () => {
      // Create a critical lab value
      const criticalObs = {
        resourceType: 'Observation',
        status: 'final',
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '33747-0',
            display: 'Hemoglobin'
          }]
        },
        subject: { reference: `Patient/${testPatientId}` },
        valueQuantity: {
          value: 5.0,
          unit: 'g/dL',
          system: 'http://unitsofmeasure.org'
        },
        interpretation: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: 'L',
            display: 'Low'
          }]
        }]
      };
      
      cy.createFHIRResource('Observation', criticalObs).then(() => {
        cy.reload();
        cy.navigateToTab('results');
        
        // Verify critical alert
        cy.get('[data-testid="critical-alert"]').should('be.visible');
        cy.get('[data-testid="critical-value"]').should('contain', '5.0');
      });
    });
  });

  describe('Condition Management Workflow', () => {
    it('should add, update, and manage patient conditions', () => {
      cy.navigateToTab('chart-review');
      
      // Add new condition
      cy.get('[data-testid="add-condition"]').click();
      cy.get('[data-testid="condition-search"]').type('Diabetes');
      cy.get('[data-testid="condition-option"]').first().click();
      cy.get('[data-testid="onset-date"]').type('2024-01-01');
      cy.get('[data-testid="save-condition"]').click();
      
      // Verify condition appears
      cy.expectToast('Condition added successfully');
      cy.get('[data-testid="conditions-list"]').should('contain', 'Diabetes');
      
      // Update condition status
      cy.get('[data-testid="condition-item"]').first().click();
      cy.get('[data-testid="condition-status"]').select('resolved');
      cy.get('[data-testid="update-condition"]').click();
      
      // Verify update
      cy.expectToast('Condition updated successfully');
      cy.get('[data-testid="condition-status-display"]').should('contain', 'Resolved');
    });
  });

  describe('Clinical Decision Support', () => {
    it('should trigger appropriate CDS hooks and display recommendations', () => {
      cy.navigateToTab('summary');
      
      // Check for CDS cards
      cy.get('[data-testid="cds-cards"]').should('be.visible');
      
      // Verify preventive care recommendations
      cy.get('[data-testid="preventive-care-card"]').should('be.visible');
      
      // Test hook interaction
      cy.get('[data-testid="cds-card"]').first().click();
      cy.get('[data-testid="cds-details"]').should('be.visible');
      
      // Accept recommendation
      cy.get('[data-testid="accept-recommendation"]').click();
      cy.expectToast('Recommendation accepted');
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should maintain data consistency across tabs and refreshes', () => {
      cy.navigateToTab('chart-review');
      
      // Get initial condition count
      cy.get('[data-testid="conditions-list"] [data-testid="condition-item"]').its('length').as('initialCount');
      
      // Navigate away and back
      cy.navigateToTab('results');
      cy.navigateToTab('chart-review');
      
      // Verify count remains same
      cy.get('@initialCount').then(count => {
        cy.get('[data-testid="conditions-list"] [data-testid="condition-item"]').should('have.length', count);
      });
      
      // Refresh page
      cy.reload();
      cy.get('[data-testid="patient-list-item"]').first().click();
      cy.navigateToTab('chart-review');
      
      // Verify data persists
      cy.get('@initialCount').then(count => {
        cy.get('[data-testid="conditions-list"] [data-testid="condition-item"]').should('have.length', count);
      });
    });

    it('should validate FHIR resource compliance', () => {
      // Test creating valid FHIR resources
      cy.navigateToTab('orders');
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      
      // Submit with minimal required fields
      cy.get('[data-testid="medication-search"]').type('Test Med');
      cy.get('[data-testid="submit-order"]').click();
      
      // Should create valid FHIR resource
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.statusCode).to.equal(201);
        expect(interception.response.body.resourceType).to.equal('MedicationRequest');
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', () => {
      // Simulate network failure
      cy.intercept('GET', '/fhir/R4/**', { forceNetworkError: true }).as('networkError');
      
      cy.navigateToTab('results');
      
      // Should show error message, not crash
      cy.get('[data-testid="error-message"]').should('be.visible');
      cy.get('[data-testid="retry-button"]').should('be.visible');
      
      // Restore network and retry
      cy.intercept('GET', '/fhir/R4/**').as('networkRestored');
      cy.get('[data-testid="retry-button"]').click();
      
      // Should recover and load data
      cy.wait('@networkRestored');
      cy.get('[data-testid="results-section"]').should('be.visible');
    });

    it('should handle invalid data gracefully', () => {
      // Create resource with invalid data
      const invalidResource = {
        resourceType: 'Patient',
        // Missing required fields
        name: []
      };
      
      cy.createFHIRResource('Patient', invalidResource).then(response => {
        // Should handle validation errors
        expect(response.status).to.be.oneOf([400, 422]);
      });
      
      // UI should remain functional
      cy.visit('/');
      cy.get('[data-testid="patient-list"]').should('be.visible');
    });
  });
});