// Critical Tests - Comprehensive Medication Management Workflow
describe('Comprehensive Medication Management', () => {
  
  let testPatientId;
  let testMedicationId;
  
  beforeEach(() => {
    cy.login();
    cy.visit('/patients');
    cy.wait(2000);
    
    // Get the first patient for testing
    cy.get('.MuiDataGrid-row', { timeout: 15000 }).should('have.length.greaterThan', 0);
    cy.get('.MuiDataGrid-row').first().then($el => {
      // Try to extract patient ID from the row data
      testPatientId = $el.attr('data-id') || 'test-patient-id';
    });
    
    cy.get('.MuiDataGrid-row').first().click();
    cy.wait(2000);
  });

  describe('Medication Ordering Workflow', () => {
    it('should complete end-to-end medication ordering process', () => {
      // Navigate to orders tab
      cy.navigateToTab('orders');
      cy.waitForSpinner();
      
      // Initiate new medication order
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      
      // Search and select medication
      cy.get('[data-testid="medication-search"]').type('Lisinopril');
      cy.get('[data-testid="medication-dropdown"]').should('be.visible');
      cy.get('[data-testid="medication-option"]').first().click();
      
      // Fill in prescription details
      cy.get('[data-testid="strength-input"]').type('10');
      cy.get('[data-testid="strength-unit"]').select('mg');
      cy.get('[data-testid="dosage-form"]').select('tablet');
      cy.get('[data-testid="route"]').select('oral');
      
      // Dosage instructions
      cy.get('[data-testid="frequency"]').select('daily');
      cy.get('[data-testid="quantity"]').type('30');
      cy.get('[data-testid="refills"]').type('2');
      cy.get('[data-testid="instructions"]').type('Take once daily with or without food');
      
      // Provider and indication
      cy.get('[data-testid="prescribing-provider"]').select('Dr. Smith');
      cy.get('[data-testid="indication"]').type('Hypertension');
      
      // Submit order
      cy.get('[data-testid="submit-order"]').click();
      
      // Verify success
      cy.expectToast('Medication order created successfully', 'success');
      
      // Verify order appears in list
      cy.get('[data-testid="medication-orders"]').should('contain', 'Lisinopril');
      cy.get('[data-testid="order-status"]').should('contain', 'Active');
      
      // Store medication ID for later tests
      cy.get('[data-testid="medication-order-item"]').first().then($el => {
        testMedicationId = $el.attr('data-medication-id');
      });
    });

    it('should validate medication interactions and allergies', () => {
      // Add known allergy first
      cy.navigateToTab('chart-review');
      cy.get('[data-testid="add-allergy"]').click();
      cy.get('[data-testid="allergen-search"]').type('Penicillin');
      cy.get('[data-testid="allergen-option"]').first().click();
      cy.get('[data-testid="reaction-severity"]').select('severe');
      cy.get('[data-testid="save-allergy"]').click();
      
      // Try to order conflicting medication
      cy.navigateToTab('orders');
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      cy.get('[data-testid="medication-search"]').type('Amoxicillin');
      cy.get('[data-testid="medication-option"]').first().click();
      
      // Should trigger allergy alert
      cy.get('[data-testid="allergy-alert"]').should('be.visible');
      cy.get('[data-testid="allergy-alert"]').should('contain', 'Penicillin allergy');
      cy.get('[data-testid="allergy-severity"]').should('contain', 'severe');
      
      // Provider should be able to override with justification
      cy.get('[data-testid="override-allergy"]').click();
      cy.get('[data-testid="override-reason"]').type('Patient requires antibiotic, will monitor closely');
      cy.get('[data-testid="confirm-override"]').click();
      
      cy.expectToast('Allergy override documented', 'warning');
    });

    it('should handle drug-drug interactions', () => {
      // First create baseline medication (Warfarin)
      cy.createMedicationOrder(testPatientId, '11289', 'Warfarin 5mg daily').then(() => {
        
        // Try to add interacting medication (Aspirin)
        cy.navigateToTab('orders');
        cy.get('[data-testid="new-order-button"]').click();
        cy.get('[data-testid="order-type-medication"]').click();
        
        cy.get('[data-testid="medication-search"]').type('Aspirin');
        cy.get('[data-testid="medication-option"]').first().click();
        
        // Should trigger interaction alert
        cy.get('[data-testid="interaction-alert"]').should('be.visible');
        cy.get('[data-testid="interaction-severity"]').should('contain', 'Major');
        cy.get('[data-testid="interaction-description"]').should('contain', 'bleeding risk');
        
        // Provider can review and decide
        cy.get('[data-testid="view-interaction-details"]').click();
        cy.get('[data-testid="interaction-mechanism"]').should('be.visible');
        cy.get('[data-testid="monitoring-recommendations"]').should('be.visible');
        
        // Continue with monitoring plan
        cy.get('[data-testid="accept-with-monitoring"]').click();
        cy.get('[data-testid="monitoring-plan"]').type('Monitor INR weekly, watch for signs of bleeding');
        cy.get('[data-testid="confirm-order"]').click();
        
        cy.expectToast('Order placed with monitoring plan', 'warning');
      });
    });
  });

  describe('Medication Verification and Dispensing', () => {
    beforeEach(() => {
      // Create a test medication order
      cy.createMedicationOrder(testPatientId, '1191', 'Aspirin 81mg daily');
    });

    it('should complete pharmacy verification workflow', () => {
      // Navigate to pharmacy
      cy.visit('/pharmacy');
      
      // Verify order appears in new orders queue
      cy.get('[data-testid="new-orders-queue"]').should('contain', 'Aspirin');
      
      // Select order for verification
      cy.get('[data-testid="order-item"]').first().click();
      
      // Verify prescription details
      cy.get('[data-testid="medication-name"]').should('contain', 'Aspirin');
      cy.get('[data-testid="strength"]').should('contain', '81mg');
      cy.get('[data-testid="patient-info"]').should('be.visible');
      cy.get('[data-testid="prescriber-info"]').should('be.visible');
      
      // Check for contraindications
      cy.get('[data-testid="contraindication-check"]').click();
      cy.get('[data-testid="contraindication-results"]').should('contain', 'No contraindications found');
      
      // Verify insurance coverage
      cy.get('[data-testid="insurance-check"]').click();
      cy.get('[data-testid="coverage-status"]').should('be.visible');
      
      // Move to verification queue
      cy.get('[data-testid="verify-order"]').click();
      cy.expectToast('Order moved to verification', 'info');
      
      // Verify it appears in verification queue
      cy.get('[data-testid="verification-queue"]').should('contain', 'Aspirin');
    });

    it('should complete medication dispensing workflow', () => {
      cy.visit('/pharmacy');
      
      // Move order through verification first
      cy.get('[data-testid="order-item"]').first().click();
      cy.get('[data-testid="verify-order"]').click();
      
      // Select from verification queue
      cy.get('[data-testid="verification-queue"] [data-testid="order-item"]').first().click();
      
      // Final verification
      cy.get('[data-testid="final-verification"]').click();
      cy.get('[data-testid="pharmacist-check"]').check();
      cy.get('[data-testid="label-check"]').check();
      cy.get('[data-testid="quantity-check"]').check();
      
      // Proceed to dispensing
      cy.get('[data-testid="proceed-to-dispensing"]').click();
      
      // Dispensing details
      cy.get('[data-testid="lot-number"]').type('LOT123456');
      cy.get('[data-testid="expiration-date"]').type('2025-12-31');
      cy.get('[data-testid="dispensed-quantity"]').clear().type('30');
      cy.get('[data-testid="dispensing-pharmacist"]').select('PharmD Smith');
      
      // Patient counseling notes
      cy.get('[data-testid="counseling-notes"]').type('Advised patient to take with food, monitor for stomach upset');
      
      // Complete dispensing
      cy.get('[data-testid="complete-dispensing"]').click();
      
      // Verify completion
      cy.expectToast('Medication dispensed successfully', 'success');
      cy.get('[data-testid="ready-queue"]').should('contain', 'Aspirin');
      
      // Verify MedicationDispense resource created
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.statusCode).to.equal(201);
        expect(interception.response.body.resourceType).to.equal('MedicationDispense');
      });
    });

    it('should handle partial dispensing scenarios', () => {
      cy.visit('/pharmacy');
      
      // Process order to dispensing stage
      cy.get('[data-testid="order-item"]').first().click();
      cy.get('[data-testid="verify-order"]').click();
      cy.get('[data-testid="verification-queue"] [data-testid="order-item"]').first().click();
      cy.get('[data-testid="final-verification"]').click();
      cy.get('[data-testid="proceed-to-dispensing"]').click();
      
      // Partial dispensing scenario
      cy.get('[data-testid="dispensed-quantity"]').clear().type('15'); // Half of ordered quantity
      cy.get('[data-testid="partial-dispensing-reason"]').select('Insufficient stock');
      cy.get('[data-testid="remaining-quantity-note"]').type('Remaining 15 tablets to be dispensed when stock arrives');
      
      // Complete partial dispensing
      cy.get('[data-testid="complete-partial-dispensing"]').click();
      
      // Verify partial completion
      cy.expectToast('Partial dispensing completed', 'warning');
      cy.get('[data-testid="partial-orders-queue"]').should('contain', 'Aspirin');
      cy.get('[data-testid="remaining-quantity"]').should('contain', '15');
    });
  });

  describe('Medication Administration and Monitoring', () => {
    beforeEach(() => {
      // Create dispensed medication
      cy.createMedicationOrder(testPatientId, '1191', 'Aspirin 81mg daily').then(() => {
        // Mock dispensing completion
        cy.request({
          method: 'POST',
          url: `${Cypress.env('fhirUrl')}/MedicationDispense`,
          headers: { 'Content-Type': 'application/fhir+json' },
          body: {
            resourceType: 'MedicationDispense',
            status: 'completed',
            medicationCodeableConcept: {
              coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '1191', display: 'Aspirin' }]
            },
            subject: { reference: `Patient/${testPatientId}` },
            quantity: { value: 30, unit: 'tablet' },
            whenHandedOver: new Date().toISOString()
          }
        });
      });
    });

    it('should record medication administration', () => {
      cy.navigateToTab('chart-review');
      
      // Find medication in active medications
      cy.get('[data-testid="active-medications"]').should('contain', 'Aspirin');
      
      // Record administration
      cy.get('[data-testid="medication-item"]').first().find('[data-testid="record-administration"]').click();
      
      // Administration details
      cy.get('[data-testid="administration-time"]').type('2024-01-15T08:00');
      cy.get('[data-testid="administered-dose"]').type('81mg');
      cy.get('[data-testid="administration-route"]').select('oral');
      cy.get('[data-testid="administering-nurse"]').select('Nurse Johnson');
      
      // Patient response
      cy.get('[data-testid="patient-response"]').select('No adverse effects');
      cy.get('[data-testid="administration-notes"]').type('Patient tolerated medication well');
      
      // Submit administration record
      cy.get('[data-testid="record-administration-submit"]').click();
      
      // Verify MedicationAdministration resource created
      cy.expectToast('Administration recorded', 'success');
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.body.resourceType).to.equal('MedicationAdministration');
      });
    });

    it('should monitor for adverse effects', () => {
      cy.navigateToTab('chart-review');
      
      // Record adverse effect
      cy.get('[data-testid="medication-item"]').first().find('[data-testid="report-adverse-effect"]').click();
      
      // Adverse effect details
      cy.get('[data-testid="effect-type"]').select('Gastrointestinal');
      cy.get('[data-testid="effect-severity"]').select('mild');
      cy.get('[data-testid="effect-description"]').type('Mild stomach upset after taking medication');
      cy.get('[data-testid="onset-time"]').type('30 minutes after administration');
      
      // Clinical assessment
      cy.get('[data-testid="causality-assessment"]').select('probable');
      cy.get('[data-testid="action-taken"]').select('dose-continued');
      cy.get('[data-testid="outcome"]').select('recovered');
      
      // Submit adverse effect report
      cy.get('[data-testid="submit-adverse-effect"]').click();
      
      // Verify AdverseEvent resource created
      cy.expectToast('Adverse effect reported', 'warning');
      cy.wait('@fhirCreate').then(interception => {
        expect(interception.response.body.resourceType).to.equal('AdverseEvent');
      });
      
      // Verify alert shows in medication list
      cy.get('[data-testid="medication-item"]').first().should('contain', 'Adverse Effect Reported');
    });
  });

  describe('Medication History and Reconciliation', () => {
    it('should perform comprehensive medication reconciliation', () => {
      cy.navigateToTab('chart-review');
      
      // Initiate medication reconciliation
      cy.get('[data-testid="medication-reconciliation"]').click();
      
      // Current EMR medications
      cy.get('[data-testid="current-emr-medications"]').should('be.visible');
      
      // Patient-reported medications
      cy.get('[data-testid="add-patient-reported"]').click();
      cy.get('[data-testid="patient-medication-name"]').type('Ibuprofen');
      cy.get('[data-testid="patient-medication-dose"]').type('200mg');
      cy.get('[data-testid="patient-medication-frequency"]').type('as needed');
      cy.get('[data-testid="patient-medication-source"]').select('Over-the-counter');
      cy.get('[data-testid="add-patient-medication"]').click();
      
      // Reconciliation decisions
      cy.get('[data-testid="reconciliation-item"]').each(($el) => {
        cy.wrap($el).find('[data-testid="reconciliation-action"]').select('continue');
        cy.wrap($el).find('[data-testid="reconciliation-notes"]').type('Verified with patient');
      });
      
      // Complete reconciliation
      cy.get('[data-testid="complete-reconciliation"]').click();
      cy.get('[data-testid="reconciling-provider"]').select('Dr. Smith');
      cy.get('[data-testid="reconciliation-date"]').type('2024-01-15');
      cy.get('[data-testid="submit-reconciliation"]').click();
      
      // Verify completion
      cy.expectToast('Medication reconciliation completed', 'success');
      cy.get('[data-testid="reconciliation-status"]').should('contain', 'Completed');
    });

    it('should display comprehensive medication history', () => {
      cy.navigateToTab('chart-review');
      
      // Open medication history
      cy.get('[data-testid="medication-history"]').click();
      
      // Verify history sections
      cy.get('[data-testid="current-medications"]').should('be.visible');
      cy.get('[data-testid="discontinued-medications"]').should('be.visible');
      cy.get('[data-testid="allergies-intolerances"]').should('be.visible');
      
      // Filter by time period
      cy.get('[data-testid="history-filter"]').select('last-year');
      cy.get('[data-testid="medication-timeline"]').should('be.visible');
      
      // Export medication list
      cy.get('[data-testid="export-medications"]').click();
      cy.get('[data-testid="export-format"]').select('pdf');
      cy.get('[data-testid="include-allergies"]').check();
      cy.get('[data-testid="include-administration-history"]').check();
      cy.get('[data-testid="generate-export"]').click();
      
      cy.expectToast('Medication list exported', 'success');
    });
  });

  describe('Clinical Decision Support Integration', () => {
    it('should trigger appropriate medication-related CDS hooks', () => {
      cy.navigateToTab('orders');
      
      // Order medication that should trigger CDS hooks
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      cy.get('[data-testid="medication-search"]').type('Digoxin');
      cy.get('[data-testid="medication-option"]').first().click();
      
      // Should trigger renal function CDS hook
      cy.get('[data-testid="cds-card"]').should('be.visible');
      cy.get('[data-testid="cds-card-title"]').should('contain', 'Renal Function Check');
      cy.get('[data-testid="cds-recommendation"]').should('contain', 'Consider renal function');
      
      // Provider can view details
      cy.get('[data-testid="cds-card-details"]').click();
      cy.get('[data-testid="cds-rationale"]').should('be.visible');
      cy.get('[data-testid="cds-references"]').should('be.visible');
      
      // Provider can accept recommendation
      cy.get('[data-testid="accept-cds-recommendation"]').click();
      cy.get('[data-testid="order-lab-creatinine"]').click();
      
      // Verify lab order created
      cy.expectToast('Laboratory order created', 'info');
      cy.get('[data-testid="pending-lab-orders"]').should('contain', 'Creatinine');
    });

    it('should handle medication dosing recommendations', () => {
      // Create patient with specific characteristics (elderly, renal impairment)
      cy.request({
        method: 'PUT',
        url: `${Cypress.env('fhirUrl')}/Patient/${testPatientId}`,
        headers: { 'Content-Type': 'application/fhir+json' },
        body: {
          resourceType: 'Patient',
          id: testPatientId,
          birthDate: '1940-01-01', // 84 years old
          extension: [{
            url: 'http://wintehr.com/fhir/StructureDefinition/renal-function',
            valueQuantity: { value: 45, unit: 'mL/min/1.73m2' }
          }]
        }
      });
      
      cy.navigateToTab('orders');
      cy.get('[data-testid="new-order-button"]').click();
      cy.get('[data-testid="order-type-medication"]').click();
      
      // Order medication requiring dose adjustment
      cy.get('[data-testid="medication-search"]').type('Metformin');
      cy.get('[data-testid="medication-option"]').first().click();
      cy.get('[data-testid="strength-input"]').type('1000');
      
      // Should trigger dosing recommendation
      cy.get('[data-testid="dosing-cds-card"]').should('be.visible');
      cy.get('[data-testid="dosing-recommendation"]').should('contain', 'Reduce dose');
      cy.get('[data-testid="recommended-dose"]').should('contain', '500mg');
      
      // Provider can accept recommendation
      cy.get('[data-testid="accept-dosing-recommendation"]').click();
      cy.get('[data-testid="strength-input"]').should('have.value', '500');
      
      cy.expectToast('Dose adjusted based on clinical guidelines', 'info');
    });
  });
});