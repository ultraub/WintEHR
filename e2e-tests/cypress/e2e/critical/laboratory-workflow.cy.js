// Critical Tests - Laboratory Workflow End-to-End
describe('Comprehensive Laboratory Workflow', () => {
  
  let testPatientId;
  let testOrderId;
  
  beforeEach(() => {
    cy.login();
    cy.visit('/');
    
    // Get test patient
    cy.get('[data-testid="patient-list-item"]').first().then($el => {
      testPatientId = $el.attr('data-patient-id');
    });
    
    cy.get('[data-testid="patient-list-item"]').first().click();
  });

  describe('Laboratory Order Management', () => {
    it('should complete comprehensive lab ordering workflow', () => {
      cy.navigateToTab('orders');
      
      // Create new lab order
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-laboratory"]').click();
      
      // Select lab category
      cy.get('[data-testid="lab-category"]').select('Chemistry');
      
      // Select specific tests
      cy.get('[data-testid="lab-test-search"]').type('Comprehensive');
      cy.get('[data-testid="test-option"]').contains('Comprehensive Metabolic Panel').click();
      
      // Add additional tests
      cy.get('[data-testid="add-test"]').click();
      cy.get('[data-testid="lab-test-search"]').clear().type('Lipid');
      cy.get('[data-testid="test-option"]').contains('Lipid Panel').click();
      
      // Clinical information
      cy.get('[data-testid="clinical-indication"]').type('Annual physical examination');
      cy.get('[data-testid="ordering-provider"]').select('Dr. Johnson');
      
      // Priority and timing
      cy.get('[data-testid="order-priority"]').select('routine');
      cy.get('[data-testid="collection-date"]').type('2024-01-16');
      cy.get('[data-testid="collection-time"]').type('08:00');
      
      // Patient instructions
      cy.get('[data-testid="fasting-required"]').check();
      cy.get('[data-testid="patient-instructions"]').type('Fast 12 hours before collection. Water only.');
      
      // Submit order
      cy.get('[data-testid="submit-lab-order"]').click();
      
      // Verify success
      cy.expectToast('Laboratory order created successfully', 'success');
      
      // Verify order appears
      cy.get('[data-testid="lab-orders"]').should('contain', 'Comprehensive Metabolic Panel');
      cy.get('[data-testid="lab-orders"]').should('contain', 'Lipid Panel');
      cy.get('[data-testid="order-status"]').should('contain', 'Ordered');
      
      // Store order ID
      cy.get('[data-testid="lab-order-item"]').first().then($el => {
        testOrderId = $el.attr('data-order-id');
      });
    });

    it('should handle urgent lab orders with appropriate workflow', () => {
      cy.navigateToTab('orders');
      
      // Create urgent order
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-laboratory"]').click();
      
      // Critical care tests
      cy.get('[data-testid="lab-category"]').select('Point of Care');
      cy.get('[data-testid="lab-test-search"]').type('Arterial Blood Gas');
      cy.get('[data-testid="test-option"]').first().click();
      
      // Urgent priority
      cy.get('[data-testid="order-priority"]').select('urgent');
      cy.get('[data-testid="clinical-indication"]').type('Respiratory distress, suspected acidosis');
      
      // Should require additional fields for urgent orders
      cy.get('[data-testid="urgent-reason"]').should('be.visible');
      cy.get('[data-testid="urgent-reason"]').type('Patient experiencing acute respiratory symptoms');
      cy.get('[data-testid="notify-physician"]').check();
      cy.get('[data-testid="physician-to-notify"]').select('Dr. Emergency');
      
      cy.get('[data-testid="submit-lab-order"]').click();
      
      // Should show urgent order confirmation
      cy.get('[data-testid="urgent-order-confirmation"]').should('be.visible');
      cy.get('[data-testid="estimated-turnaround"]').should('contain', '30 minutes');
      cy.get('[data-testid="confirm-urgent-order"]').click();
      
      cy.expectToast('Urgent laboratory order submitted', 'warning');
      
      // Verify urgent status
      cy.get('[data-testid="order-priority-badge"]').should('contain', 'URGENT');
    });

    it('should validate clinical decision support for lab orders', () => {
      cy.navigateToTab('orders');
      
      // Order test that should trigger CDS
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-laboratory"]').click();
      
      cy.get('[data-testid="lab-test-search"]').type('PSA');
      cy.get('[data-testid="test-option"]').contains('Prostate Specific Antigen').click();
      
      // Should trigger age/gender appropriateness check
      cy.get('[data-testid="cds-recommendation"]').should('be.visible');
      cy.get('[data-testid="cds-message"]').should('contain', 'Consider patient age and gender');
      
      // Provider can override with reason
      cy.get('[data-testid="override-cds"]').click();
      cy.get('[data-testid="override-reason"]').type('Family history of prostate cancer');
      cy.get('[data-testid="confirm-override"]').click();
      
      cy.get('[data-testid="submit-lab-order"]').click();
      cy.expectToast('Laboratory order created with clinical override', 'info');
    });
  });

  describe('Specimen Collection and Processing', () => {
    beforeEach(() => {
      // Create a test lab order
      cy.request({
        method: 'POST',
        url: `${Cypress.env('fhirUrl')}/ServiceRequest`,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: {
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
              code: '24323-8',
              display: 'Comprehensive metabolic 2000 panel'
            }]
          },
          subject: { reference: `Patient/${testPatientId}` },
          authoredOn: new Date().toISOString()
        }
      }).then(response => {
        testOrderId = response.body.id;
      });
    });

    it('should manage specimen collection workflow', () => {
      // Navigate to laboratory section
      cy.visit('/laboratory');
      
      // Find pending collection
      cy.get('[data-testid="pending-collections"]').should('contain', 'Comprehensive metabolic');
      
      // Start collection process
      cy.get('[data-testid="collection-item"]').first().click();
      cy.get('[data-testid="begin-collection"]').click();
      
      // Verify patient identity
      cy.get('[data-testid="verify-patient-id"]').should('be.visible');
      cy.get('[data-testid="patient-name-confirm"]').should('be.visible');
      cy.get('[data-testid="patient-dob-confirm"]').should('be.visible');
      cy.get('[data-testid="confirm-patient-identity"]').click();
      
      // Collection details
      cy.get('[data-testid="collection-method"]').select('Venipuncture');
      cy.get('[data-testid="collection-site"]').select('Antecubital fossa - left arm');
      cy.get('[data-testid="collector-id"]').select('Tech Johnson');
      cy.get('[data-testid="collection-time"]').type('2024-01-16T08:15');
      
      // Specimen details
      cy.get('[data-testid="specimen-type"]').select('Serum');
      cy.get('[data-testid="collection-volume"]').type('10');
      cy.get('[data-testid="tube-type"]').select('SST (Gold top)');
      cy.get('[data-testid="specimen-id"]').type('SPEC20240116001');
      
      // Collection notes
      cy.get('[data-testid="collection-notes"]').type('Patient fasted 12 hours. No complications during collection.');
      
      // Quality checks
      cy.get('[data-testid="specimen-quality"]').select('Acceptable');
      cy.get('[data-testid="hemolysis-check"]').select('None');
      cy.get('[data-testid="volume-adequate"]').check();
      
      // Complete collection
      cy.get('[data-testid="complete-collection"]').click();
      
      // Verify Specimen resource created
      cy.expectToast('Specimen collection completed', 'success');
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.body.resourceType).to.equal('Specimen');
      });
    });

    it('should handle specimen rejection scenarios', () => {
      cy.visit('/laboratory');
      
      // Start collection
      cy.get('[data-testid="collection-item"]').first().click();
      cy.get('[data-testid="begin-collection"]').click();
      cy.get('[data-testid="confirm-patient-identity"]').click();
      
      // Identify quality issue
      cy.get('[data-testid="specimen-quality"]').select('Rejected');
      cy.get('[data-testid="rejection-reason"]').select('Hemolyzed');
      cy.get('[data-testid="rejection-notes"]').type('Specimen appears hemolyzed, likely due to difficult draw');
      
      // Document rejection
      cy.get('[data-testid="document-rejection"]').click();
      
      // Should offer recollection
      cy.get('[data-testid="recollection-needed"]').should('be.visible');
      cy.get('[data-testid="schedule-recollection"]').click();
      cy.get('[data-testid="recollection-date"]').type('2024-01-17');
      cy.get('[data-testid="recollection-time"]').type('08:00');
      cy.get('[data-testid="notify-patient"]').check();
      
      cy.get('[data-testid="schedule-recollection-submit"]').click();
      
      cy.expectToast('Specimen rejected, recollection scheduled', 'warning');
    });
  });

  describe('Laboratory Result Processing', () => {
    beforeEach(() => {
      // Create specimen and prepare for results
      cy.request({
        method: 'POST',
        url: `${Cypress.env('fhirUrl')}/Specimen`,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: {
          resourceType: 'Specimen',
          status: 'available',
          type: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: '119364003',
              display: 'Serum specimen'
            }]
          },
          subject: { reference: `Patient/${testPatientId}` },
          request: [{ reference: `ServiceRequest/${testOrderId}` }],
          collection: {
            collectedDateTime: new Date().toISOString()
          }
        }
      });
    });

    it('should process and validate laboratory results', () => {
      // Navigate to lab results processing
      cy.visit('/laboratory/results');
      
      // Find pending results
      cy.get('[data-testid="pending-results"]').should('be.visible');
      
      // Enter results
      cy.get('[data-testid="result-entry"]').first().click();
      
      // Glucose result
      cy.get('[data-testid="test-glucose"]').find('[data-testid="result-value"]').type('95');
      cy.get('[data-testid="test-glucose"]').find('[data-testid="result-unit"]').should('contain', 'mg/dL');
      cy.get('[data-testid="test-glucose"]').find('[data-testid="reference-range"]').should('contain', '70-99');
      
      // BUN
      cy.get('[data-testid="test-bun"]').find('[data-testid="result-value"]').type('18');
      
      // Creatinine
      cy.get('[data-testid="test-creatinine"]').find('[data-testid="result-value"]').type('1.1');
      
      // Abnormal result - high sodium
      cy.get('[data-testid="test-sodium"]').find('[data-testid="result-value"]').type('150');
      cy.get('[data-testid="abnormal-flag"]').should('be.visible');
      cy.get('[data-testid="abnormal-flag"]').should('contain', 'HIGH');
      
      // Critical result - very high potassium
      cy.get('[data-testid="test-potassium"]').find('[data-testid="result-value"]').type('6.5');
      cy.get('[data-testid="critical-alert"]').should('be.visible');
      cy.get('[data-testid="critical-value-warning"]').should('contain', 'CRITICAL');
      
      // Handle critical value
      cy.get('[data-testid="acknowledge-critical"]').click();
      cy.get('[data-testid="critical-action"]').select('Notify ordering physician immediately');
      cy.get('[data-testid="physician-notification-method"]').select('Phone call');
      cy.get('[data-testid="notification-time"]').type('2024-01-16T10:30');
      cy.get('[data-testid="physician-contacted"]').type('Dr. Johnson');
      cy.get('[data-testid="critical-value-notes"]').type('Physician notified of critical potassium level. Repeat ordered.');
      
      // Quality control
      cy.get('[data-testid="qc-reviewed"]').check();
      cy.get('[data-testid="reviewing-technologist"]').select('Tech Smith');
      cy.get('[data-testid="instrument-id"]').type('CHEM001');
      cy.get('[data-testid="calibration-status"]').select('Within range');
      
      // Final review
      cy.get('[data-testid="pathologist-review"]').check();
      cy.get('[data-testid="reviewing-pathologist"]').select('Dr. Pathologist');
      
      // Release results
      cy.get('[data-testid="release-results"]').click();
      
      // Verify Observation resources created
      cy.expectToast('Laboratory results released', 'success');
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.body.resourceType).to.equal('Observation');
      });
    });

    it('should handle reference range calculations and interpretations', () => {
      cy.visit('/laboratory/results');
      cy.get('[data-testid="result-entry"]').first().click();
      
      // Test age/gender specific reference ranges
      cy.get('[data-testid="test-hemoglobin"]').find('[data-testid="result-value"]').type('13.5');
      
      // Should auto-calculate reference range based on patient demographics
      cy.get('[data-testid="reference-range-calculated"]').should('be.visible');
      cy.get('[data-testid="age-specific-range"]').should('contain', 'Age-adjusted');
      
      // Interpretation
      cy.get('[data-testid="interpretation"]').should('contain', 'Normal');
      
      // Test with pediatric ranges (if patient is child)
      cy.get('[data-testid="test-alkaline-phosphatase"]').find('[data-testid="result-value"]').type('250');
      cy.get('[data-testid="pediatric-range-note"]').should('be.visible');
      
      // Custom interpretation
      cy.get('[data-testid="add-interpretation"]').click();
      cy.get('[data-testid="interpretation-text"]').type('Elevated but within expected range for patient age');
      cy.get('[data-testid="interpretation-category"]').select('Normal variant');
      
      cy.get('[data-testid="save-interpretation"]').click();
    });

    it('should generate diagnostic reports and trending', () => {
      cy.navigateToTab('results');
      
      // Verify results display
      cy.get('[data-testid="lab-results-section"]').should('be.visible');
      
      // Check for result categorization
      cy.get('[data-testid="chemistry-results"]').should('be.visible');
      cy.get('[data-testid="normal-results"]').should('be.visible');
      cy.get('[data-testid="abnormal-results"]').should('be.visible');
      cy.get('[data-testid="critical-results"]').should('be.visible');
      
      // Trending functionality
      cy.get('[data-testid="glucose-result"]').find('[data-testid="view-trend"]').click();
      cy.get('[data-testid="trend-chart"]').should('be.visible');
      cy.get('[data-testid="trend-period"]').select('6 months');
      
      // Should show historical values
      cy.get('[data-testid="historical-values"]').should('be.visible');
      cy.get('[data-testid="trend-direction"]').should('be.visible');
      
      // Export trending report
      cy.get('[data-testid="export-trend"]').click();
      cy.get('[data-testid="export-format"]').select('PDF');
      cy.get('[data-testid="include-reference-ranges"]').check();
      cy.get('[data-testid="generate-trend-report"]').click();
      
      cy.expectToast('Trend report generated', 'success');
    });
  });

  describe('Clinical Integration and Decision Support', () => {
    it('should provide clinical decision support based on results', () => {
      // Create results that should trigger CDS
      const abnormalResults = [
        { code: '2951-2', display: 'Sodium', value: 125, unit: 'mmol/L', status: 'Low' },
        { code: '6298-4', display: 'Potassium', value: 6.2, unit: 'mmol/L', status: 'High' },
        { code: '2160-0', display: 'Creatinine', value: 2.5, unit: 'mg/dL', status: 'High' }
      ];
      
      abnormalResults.forEach(result => {
        cy.request({
          method: 'POST',
          url: `${Cypress.env('fhirUrl')}/Observation`,
          headers: { 'Content-Type': 'application/fhir+json' },
          body: {
            resourceType: 'Observation',
            status: 'final',
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: result.code,
                display: result.display
              }]
            },
            subject: { reference: `Patient/${testPatientId}` },
            valueQuantity: {
              value: result.value,
              unit: result.unit
            },
            interpretation: [{
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                code: result.status === 'High' ? 'H' : 'L'
              }]
            }]
          }
        });
      });
      
      cy.navigateToTab('results');
      
      // Should trigger CDS cards
      cy.get('[data-testid="cds-recommendations"]').should('be.visible');
      
      // Electrolyte imbalance alert
      cy.get('[data-testid="cds-card"]').contains('Electrolyte Imbalance').should('be.visible');
      cy.get('[data-testid="cds-recommendation"]').should('contain', 'Consider cardiac monitoring');
      
      // Renal function alert
      cy.get('[data-testid="cds-card"]').contains('Renal Function').should('be.visible');
      cy.get('[data-testid="cds-recommendation"]').should('contain', 'Nephrology consultation');
      
      // Provider can act on recommendations
      cy.get('[data-testid="order-ekg"]').click();
      cy.get('[data-testid="schedule-nephrology"]').click();
      
      cy.expectToast('Orders placed based on CDS recommendations', 'info');
    });

    it('should integrate with medication management for drug monitoring', () => {
      // Create patient on medication requiring monitoring
      cy.createMedicationOrder(testPatientId, '11289', 'Warfarin 5mg daily');
      
      // Create relevant lab result (INR)
      cy.request({
        method: 'POST',
        url: `${Cypress.env('fhirUrl')}/Observation`,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: {
          resourceType: 'Observation',
          status: 'final',
          code: {
            coding: [{
              system: 'http://loinc.org',
              code: '34714-6',
              display: 'INR'
            }]
          },
          subject: { reference: `Patient/${testPatientId}` },
          valueQuantity: {
            value: 3.5,
            unit: 'ratio'
          },
          interpretation: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
              code: 'H',
              display: 'High'
            }]
          }]
        }
      });
      
      cy.navigateToTab('results');
      
      // Should show medication monitoring alert
      cy.get('[data-testid="drug-monitoring-alert"]').should('be.visible');
      cy.get('[data-testid="medication-name"]').should('contain', 'Warfarin');
      cy.get('[data-testid="monitoring-recommendation"]').should('contain', 'Consider dose reduction');
      
      // Link to medication management
      cy.get('[data-testid="review-medication"]').click();
      cy.url().should('include', 'chart-review');
      cy.get('[data-testid="medication-item"]').contains('Warfarin').should('be.visible');
      cy.get('[data-testid="monitoring-alert"]').should('be.visible');
    });
  });

  describe('Quality Assurance and Compliance', () => {
    it('should maintain audit trail for all laboratory activities', () => {
      // Perform various lab activities
      cy.navigateToTab('orders');
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-laboratory"]').click();
      cy.get('[data-testid="lab-test-search"]').type('CBC');
      cy.get('[data-testid="test-option"]').first().click();
      cy.get('[data-testid="submit-lab-order"]').click();
      
      // Check audit log
      cy.visit('/administration/audit');
      cy.get('[data-testid="audit-filter"]').select('Laboratory');
      
      // Should show audit entries
      cy.get('[data-testid="audit-entry"]').should('contain', 'Laboratory order created');
      cy.get('[data-testid="audit-user"]').should('contain', 'demo');
      cy.get('[data-testid="audit-timestamp"]').should('be.visible');
      cy.get('[data-testid="audit-details"]').should('contain', 'CBC');
    });

    it('should validate regulatory compliance requirements', () => {
      cy.visit('/laboratory/quality');
      
      // Quality control checks
      cy.get('[data-testid="daily-qc-status"]').should('be.visible');
      cy.get('[data-testid="instrument-calibration"]').should('be.visible');
      cy.get('[data-testid="proficiency-testing"]').should('be.visible');
      
      // CAP/CLIA compliance indicators
      cy.get('[data-testid="clia-compliance"]').should('contain', 'Compliant');
      cy.get('[data-testid="last-inspection"]').should('be.visible');
      
      // Personnel qualifications
      cy.get('[data-testid="qualified-personnel"]').should('be.visible');
      cy.get('[data-testid="certification-status"]').should('contain', 'Current');
    });
  });
});