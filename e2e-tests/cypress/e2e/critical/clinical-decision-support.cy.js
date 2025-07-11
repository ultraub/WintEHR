// Critical Tests - Clinical Decision Support (CDS) Hooks
describe('Clinical Decision Support Workflows', () => {
  
  let testPatientId;
  
  beforeEach(() => {
    cy.login();
    cy.visit('/');
    
    // Get test patient
    cy.get('[data-testid="patient-list-item"]').first().then($el => {
      testPatientId = $el.attr('data-patient-id');
    });
    
    cy.get('[data-testid="patient-list-item"]').first().click();
  });

  describe('CDS Hooks Integration', () => {
    it('should trigger patient-view hooks on patient selection', () => {
      // Patient selection should trigger patient-view hooks
      cy.get('[data-testid="cds-cards"]').should('be.visible');
      
      // Verify hook execution
      cy.wait('@cdsHookCall').then(interception => {
        expect(interception.request.url).to.include('patient-view');
        expect(interception.request.body.context.patientId).to.equal(testPatientId);
      });
      
      // Check for typical patient-view cards
      cy.get('[data-testid="cds-card"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="preventive-care-card"]').should('be.visible');
    });

    it('should handle medication-prescribe hooks', () => {
      cy.navigateToTab('orders');
      
      // Start medication order to trigger hook
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      
      // Select medication that should trigger CDS
      cy.get('[data-testid="medication-search"]').type('Warfarin');
      cy.get('[data-testid="medication-option"]').first().click();
      
      // Should trigger medication-prescribe hook
      cy.wait('@cdsHookCall').then(interception => {
        expect(interception.request.url).to.include('medication-prescribe');
        expect(interception.request.body.context.medications).to.be.an('array');
      });
      
      // Verify CDS recommendations appear
      cy.get('[data-testid="cds-recommendations"]').should('be.visible');
      cy.get('[data-testid="drug-interaction-card"]').should('be.visible');
      cy.get('[data-testid="dosing-recommendation"]').should('be.visible');
    });

    it('should process order-review hooks', () => {
      // Create a medication order first
      cy.createMedicationOrder(testPatientId, '11289', 'Digoxin 0.25mg daily').then(() => {
        cy.navigateToTab('orders');
        
        // Review/modify order to trigger hook
        cy.get('[data-testid="medication-order"]').first().click();
        cy.get('[data-testid="modify-order"]').click();
        
        // Should trigger order-review hook
        cy.wait('@cdsHookCall').then(interception => {
          expect(interception.request.url).to.include('order-review');
          expect(interception.request.body.context.orders).to.be.an('array');
        });
        
        // Check for order-specific recommendations
        cy.get('[data-testid="renal-function-card"]').should('be.visible');
        cy.get('[data-testid="monitoring-recommendation"]').should('be.visible');
      });
    });
  });

  describe('CDS Card Display and Interaction', () => {
    beforeEach(() => {
      // Navigate to summary to see CDS cards
      cy.navigateToTab('summary');
    });

    it('should display CDS cards with proper formatting', () => {
      cy.get('[data-testid="cds-cards"]').should('be.visible');
      
      // Verify card structure
      cy.get('[data-testid="cds-card"]').first().within(() => {
        cy.get('[data-testid="card-summary"]').should('be.visible');
        cy.get('[data-testid="card-indicator"]').should('be.visible');
        cy.get('[data-testid="card-source"]').should('be.visible');
      });
      
      // Test card indicators
      const indicators = ['info', 'warning', 'critical'];
      indicators.forEach(indicator => {
        cy.get(`[data-testid="card-indicator-${indicator}"]`).should('exist');
      });
    });

    it('should handle card selection and details', () => {
      cy.get('[data-testid="cds-card"]').first().click();
      
      // Verify card details expand
      cy.get('[data-testid="card-details"]').should('be.visible');
      cy.get('[data-testid="card-detail-text"]').should('be.visible');
      
      // Check for card links
      cy.get('[data-testid="card-links"]').should('be.visible');
      cy.get('[data-testid="card-link"]').should('have.length.greaterThan', 0);
      
      // Test link interaction
      cy.get('[data-testid="card-link"]').first().click();
      cy.get('[data-testid="external-link-warning"]').should('be.visible');
    });

    it('should process card suggestions and actions', () => {
      // Find card with suggestions
      cy.get('[data-testid="cds-card"]').contains('suggestion').click();
      
      // Verify suggestions display
      cy.get('[data-testid="card-suggestions"]').should('be.visible');
      cy.get('[data-testid="suggestion-item"]').should('have.length.greaterThan', 0);
      
      // Test suggestion acceptance
      cy.get('[data-testid="suggestion-item"]').first().within(() => {
        cy.get('[data-testid="suggestion-label"]').should('be.visible');
        cy.get('[data-testid="accept-suggestion"]').click();
      });
      
      // Verify suggestion processed
      cy.expectToast('Suggestion accepted');
      
      // Test suggestion with create action
      cy.get('[data-testid="suggestion-create"]').click();
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.statusCode).to.equal(201);
      });
    });

    it('should handle smart app launch from CDS cards', () => {
      // Find card with smart app launch
      cy.get('[data-testid="cds-card"]').contains('app').click();
      
      // Verify smart app launch
      cy.get('[data-testid="smart-app-launch"]').should('be.visible');
      cy.get('[data-testid="app-name"]').should('be.visible');
      cy.get('[data-testid="launch-app"]').click();
      
      // Should open in new tab/window or iframe
      cy.get('[data-testid="smart-app-frame"]').should('be.visible');
    });
  });

  describe('Clinical Rule Configuration', () => {
    beforeEach(() => {
      // Navigate to CDS administration
      cy.visit('/administration/cds-hooks');
    });

    it('should display and manage CDS hook configurations', () => {
      cy.get('[data-testid="cds-hooks-admin"]').should('be.visible');
      
      // Verify hook list
      cy.get('[data-testid="hook-configurations"]').should('be.visible');
      cy.get('[data-testid="hook-item"]').should('have.length.greaterThan', 0);
      
      // Check hook details
      cy.get('[data-testid="hook-item"]').first().within(() => {
        cy.get('[data-testid="hook-id"]').should('be.visible');
        cy.get('[data-testid="hook-title"]').should('be.visible');
        cy.get('[data-testid="hook-type"]').should('be.visible');
        cy.get('[data-testid="hook-status"]').should('be.visible');
      });
    });

    it('should create new CDS hook configuration', () => {
      cy.get('[data-testid="add-hook"]').click();
      
      // Fill hook configuration
      cy.get('[data-testid="hook-id"]').type('test-diabetes-screening');
      cy.get('[data-testid="hook-title"]').type('Diabetes Screening Reminder');
      cy.get('[data-testid="hook-type"]').select('patient-view');
      cy.get('[data-testid="hook-description"]').type('Reminds providers to screen for diabetes');
      
      // Configure conditions
      cy.get('[data-testid="add-condition"]').click();
      cy.get('[data-testid="condition-type"]').select('age');
      cy.get('[data-testid="condition-operator"]').select('greater_than');
      cy.get('[data-testid="condition-value"]').type('45');
      
      // Configure card response
      cy.get('[data-testid="card-summary"]').type('Consider diabetes screening');
      cy.get('[data-testid="card-detail"]').type('Patient is over 45 and may benefit from diabetes screening');
      cy.get('[data-testid="card-indicator"]').select('info');
      
      // Add suggestion
      cy.get('[data-testid="add-suggestion"]').click();
      cy.get('[data-testid="suggestion-label"]').type('Order HbA1c');
      cy.get('[data-testid="suggestion-action"]').select('create');
      
      // Save configuration
      cy.get('[data-testid="save-hook"]').click();
      cy.expectToast('CDS hook created successfully');
      
      // Verify hook appears in list
      cy.get('[data-testid="hook-configurations"]').should('contain', 'test-diabetes-screening');
    });

    it('should test CDS hook with patient data', () => {
      // Select existing hook for testing
      cy.get('[data-testid="hook-item"]').first().click();
      cy.get('[data-testid="test-hook"]').click();
      
      // Configure test context
      cy.get('[data-testid="test-patient"]').select(testPatientId);
      cy.get('[data-testid="test-context"]').type('{}');
      
      // Execute test
      cy.get('[data-testid="execute-test"]').click();
      
      // Verify test results
      cy.get('[data-testid="test-results"]').should('be.visible');
      cy.get('[data-testid="hook-response"]').should('be.visible');
      cy.get('[data-testid="cards-generated"]').should('be.visible');
      
      // Check response details
      cy.get('[data-testid="response-cards"]').should('have.length.greaterThan', 0);
      cy.get('[data-testid="execution-time"]').should('be.visible');
    });

    it('should manage hook activation and deactivation', () => {
      // Toggle hook status
      cy.get('[data-testid="hook-item"]').first().within(() => {
        cy.get('[data-testid="hook-status-toggle"]').click();
      });
      
      // Verify status change
      cy.expectToast('Hook status updated');
      cy.get('[data-testid="hook-status"]').should('contain', 'Inactive');
      
      // Reactivate hook
      cy.get('[data-testid="hook-status-toggle"]').click();
      cy.expectToast('Hook status updated');
      cy.get('[data-testid="hook-status"]').should('contain', 'Active');
    });
  });

  describe('Preventive Care Recommendations', () => {
    it('should display age-appropriate screening recommendations', () => {
      cy.navigateToTab('summary');
      
      // Check for preventive care section
      cy.get('[data-testid="preventive-care"]').should('be.visible');
      
      // Verify screening recommendations based on patient age/gender
      cy.get('[data-testid="screening-recommendations"]').should('be.visible');
      cy.get('[data-testid="screening-item"]').should('have.length.greaterThan', 0);
      
      // Check specific screenings
      cy.get('[data-testid="screening-item"]').each($item => {
        cy.wrap($item).within(() => {
          cy.get('[data-testid="screening-name"]').should('be.visible');
          cy.get('[data-testid="screening-status"]').should('be.visible');
          cy.get('[data-testid="last-performed"]').should('be.visible');
          cy.get('[data-testid="next-due"]').should('be.visible');
        });
      });
    });

    it('should handle immunization recommendations', () => {
      cy.navigateToTab('summary');
      
      // Check immunization recommendations
      cy.get('[data-testid="immunization-recommendations"]').should('be.visible');
      cy.get('[data-testid="vaccine-recommendation"]').should('have.length.greaterThan', 0);
      
      // Verify vaccine details
      cy.get('[data-testid="vaccine-recommendation"]').first().within(() => {
        cy.get('[data-testid="vaccine-name"]').should('be.visible');
        cy.get('[data-testid="recommendation-reason"]').should('be.visible');
        cy.get('[data-testid="due-date"]').should('be.visible');
      });
      
      // Test vaccine ordering from recommendation
      cy.get('[data-testid="order-vaccine"]').first().click();
      cy.get('[data-testid="vaccine-order-dialog"]').should('be.visible');
      
      // Fill vaccination details
      cy.get('[data-testid="vaccine-dose"]').type('0.5 mL');
      cy.get('[data-testid="vaccine-route"]').select('intramuscular');
      cy.get('[data-testid="vaccine-site"]').select('left-deltoid');
      cy.get('[data-testid="administration-date"]').type('2024-01-15');
      
      // Submit vaccine order
      cy.get('[data-testid="submit-vaccine-order"]').click();
      cy.expectToast('Vaccine order created');
    });

    it('should provide medication adherence reminders', () => {
      // Ensure patient has medications
      cy.createMedicationOrder(testPatientId, '1191', 'Lisinopril 10mg daily').then(() => {
        cy.navigateToTab('summary');
        
        // Check adherence section
        cy.get('[data-testid="medication-adherence"]').should('be.visible');
        cy.get('[data-testid="adherence-item"]').should('have.length.greaterThan', 0);
        
        // Verify adherence details
        cy.get('[data-testid="adherence-item"]').first().within(() => {
          cy.get('[data-testid="medication-name"]').should('be.visible');
          cy.get('[data-testid="adherence-status"]').should('be.visible');
          cy.get('[data-testid="last-filled"]').should('be.visible');
          cy.get('[data-testid="refill-due"]').should('be.visible');
        });
        
        // Test adherence intervention
        cy.get('[data-testid="adherence-intervention"]').click();
        cy.get('[data-testid="intervention-options"]').should('be.visible');
        cy.get('[data-testid="patient-education"]').click();
        cy.expectToast('Patient education materials sent');
      });
    });
  });

  describe('Drug Interaction and Safety Alerts', () => {
    it('should detect and display drug-drug interactions', () => {
      // Create medications that interact
      cy.createMedicationOrder(testPatientId, '11289', 'Warfarin 5mg daily').then(() => {
        cy.createMedicationOrder(testPatientId, '1191', 'Aspirin 81mg daily').then(() => {
          cy.navigateToTab('chart-review');
          
          // Check for interaction alerts
          cy.get('[data-testid="drug-interactions"]').should('be.visible');
          cy.get('[data-testid="interaction-alert"]').should('have.length.greaterThan', 0);
          
          // Verify interaction details
          cy.get('[data-testid="interaction-alert"]').first().within(() => {
            cy.get('[data-testid="interaction-severity"]').should('be.visible');
            cy.get('[data-testid="interacting-drugs"]').should('contain', 'Warfarin');
            cy.get('[data-testid="interacting-drugs"]').should('contain', 'Aspirin');
            cy.get('[data-testid="interaction-mechanism"]').should('be.visible');
          });
          
          // Test interaction details
          cy.get('[data-testid="view-interaction-details"]').click();
          cy.get('[data-testid="interaction-description"]').should('be.visible');
          cy.get('[data-testid="clinical-management"]').should('be.visible');
          cy.get('[data-testid="monitoring-parameters"]').should('be.visible');
        });
      });
    });

    it('should check drug-allergy interactions', () => {
      // Add patient allergy
      cy.navigateToTab('chart-review');
      cy.get('[data-testid="add-allergy"]').click();
      cy.get('[data-testid="allergen-search"]').type('Penicillin');
      cy.get('[data-testid="allergen-option"]').first().click();
      cy.get('[data-testid="reaction-severity"]').select('severe');
      cy.get('[data-testid="reaction-type"]').select('anaphylaxis');
      cy.get('[data-testid="save-allergy"]').click();
      
      // Try to prescribe allergenic medication
      cy.navigateToTab('orders');
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      cy.get('[data-testid="medication-search"]').type('Amoxicillin');
      cy.get('[data-testid="medication-option"]').first().click();
      
      // Should trigger allergy alert
      cy.get('[data-testid="allergy-alert"]').should('be.visible');
      cy.get('[data-testid="allergy-severity"]').should('contain', 'Severe');
      cy.get('[data-testid="allergenic-substance"]').should('contain', 'Penicillin');
      
      // Test override process
      cy.get('[data-testid="override-allergy"]').click();
      cy.get('[data-testid="override-reason"]').type('Benefits outweigh risks, will monitor closely');
      cy.get('[data-testid="override-provider"]').select('Dr. Attending');
      cy.get('[data-testid="confirm-override"]').click();
      
      cy.expectToast('Allergy override documented');
    });

    it('should provide dosing recommendations based on patient factors', () => {
      // Create patient with renal impairment
      cy.createObservation(testPatientId, {
        code: '2160-0',
        display: 'Creatinine',
        value: 2.5,
        unit: 'mg/dL',
        interpretation: 'H'
      }).then(() => {
        // Try to prescribe renally-cleared medication
        cy.navigateToTab('orders');
        cy.get('[data-testid="new-order-button"]').click();
        cy.get('[data-testid="order-type-medication"]').click();
        cy.get('[data-testid="medication-search"]').type('Metformin');
        cy.get('[data-testid="medication-option"]').first().click();
        
        // Should trigger renal dosing alert
        cy.get('[data-testid="renal-dosing-alert"]').should('be.visible');
        cy.get('[data-testid="dosing-recommendation"]').should('be.visible');
        cy.get('[data-testid="contraindication-warning"]').should('contain', 'contraindicated');
        
        // Test alternative medication suggestion
        cy.get('[data-testid="alternative-medications"]').should('be.visible');
        cy.get('[data-testid="alternative-option"]').first().click();
        cy.expectToast('Alternative medication selected');
      });
    });
  });

  describe('Quality Measures and Performance Indicators', () => {
    it('should track and display quality measure compliance', () => {
      cy.visit('/administration/quality-measures');
      
      // Verify quality measures dashboard
      cy.get('[data-testid="quality-measures"]').should('be.visible');
      cy.get('[data-testid="measure-category"]').should('have.length.greaterThan', 0);
      
      // Check individual measures
      cy.get('[data-testid="quality-measure"]').first().within(() => {
        cy.get('[data-testid="measure-name"]').should('be.visible');
        cy.get('[data-testid="measure-description"]').should('be.visible');
        cy.get('[data-testid="compliance-rate"]').should('be.visible');
        cy.get('[data-testid="target-rate"]').should('be.visible');
      });
      
      // Test measure drill-down
      cy.get('[data-testid="quality-measure"]').first().click();
      cy.get('[data-testid="measure-details"]').should('be.visible');
      cy.get('[data-testid="numerator-patients"]').should('be.visible');
      cy.get('[data-testid="denominator-patients"]').should('be.visible');
    });

    it('should generate performance reports', () => {
      cy.visit('/administration/performance-reports');
      
      // Configure report parameters
      cy.get('[data-testid="report-type"]').select('quality-measures');
      cy.get('[data-testid="report-period"]').select('quarterly');
      cy.get('[data-testid="start-date"]').type('2024-01-01');
      cy.get('[data-testid="end-date"]').type('2024-03-31');
      
      // Select measures
      cy.get('[data-testid="measure-selection"]').should('be.visible');
      cy.get('[data-testid="measure-checkbox"]').first().check();
      cy.get('[data-testid="measure-checkbox"]').eq(1).check();
      
      // Generate report
      cy.get('[data-testid="generate-report"]').click();
      cy.get('[data-testid="report-generation"]').should('be.visible');
      
      // Verify report components
      cy.get('[data-testid="executive-summary"]').should('be.visible');
      cy.get('[data-testid="measure-results"]').should('be.visible');
      cy.get('[data-testid="trend-analysis"]').should('be.visible');
      cy.get('[data-testid="improvement-opportunities"]').should('be.visible');
      
      // Export report
      cy.get('[data-testid="export-report"]').click();
      cy.get('[data-testid="export-format"]').select('pdf');
      cy.get('[data-testid="download-report"]').click();
    });
  });

  describe('CDS Performance and Monitoring', () => {
    it('should monitor CDS hook performance metrics', () => {
      cy.visit('/administration/cds-performance');
      
      // Verify performance dashboard
      cy.get('[data-testid="cds-performance"]').should('be.visible');
      
      // Check key metrics
      cy.get('[data-testid="hook-execution-times"]').should('be.visible');
      cy.get('[data-testid="hook-success-rates"]').should('be.visible');
      cy.get('[data-testid="card-acceptance-rates"]').should('be.visible');
      cy.get('[data-testid="user-interaction-patterns"]').should('be.visible');
      
      // Test performance filtering
      cy.get('[data-testid="time-range"]').select('last-7-days');
      cy.get('[data-testid="hook-type-filter"]').select('medication-prescribe');
      cy.get('[data-testid="refresh-metrics"]').click();
      
      // Verify filtered results
      cy.get('[data-testid="performance-chart"]').should('be.visible');
      cy.get('[data-testid="metric-summary"]').should('be.visible');
    });

    it('should handle CDS system errors and troubleshooting', () => {
      // Simulate CDS hook failure
      cy.intercept('POST', '/cds-hooks/**', { statusCode: 500 }).as('cdsFailure');
      
      cy.navigateToTab('summary');
      
      // Verify graceful error handling
      cy.get('[data-testid="cds-error-message"]').should('be.visible');
      cy.get('[data-testid="cds-fallback-content"]').should('be.visible');
      
      // Test error reporting
      cy.get('[data-testid="report-cds-error"]').click();
      cy.get('[data-testid="error-report-dialog"]').should('be.visible');
      cy.get('[data-testid="error-description"]').type('CDS hooks not responding');
      cy.get('[data-testid="submit-error-report"]').click();
      
      cy.expectToast('Error report submitted');
    });
  });
});