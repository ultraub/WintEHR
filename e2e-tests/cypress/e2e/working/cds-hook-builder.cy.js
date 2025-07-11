/**
 * CDS Hook Builder Enhancement Tests
 * Tests for the enhanced CDS Hook Builder interface
 */

describe('CDS Hook Builder Enhancements', () => {
  beforeEach(() => {
    // Login as admin user who has access to CDS configuration
    cy.login('admin', 'password');
    
    // Navigate to CDS Hooks page
    cy.visit('/cds-hooks');
    
    // Wait for page to load
    cy.contains('CDS Hooks Management').should('be.visible');
  });

  describe('Lab Value Condition Builder', () => {
    beforeEach(() => {
      // Click on Create New Hook button
      cy.contains('button', 'Create New Hook').click();
      
      // Fill basic info
      cy.get('input[label="Hook ID"]').type('test-lab-hook');
      cy.get('input[label="Title"]').type('Test Lab Value Hook');
      
      // Navigate to Conditions step
      cy.contains('button', 'Continue').click();
    });

    it('should display lab value condition builder when Lab Value is selected', () => {
      // Add a new condition
      cy.contains('button', 'Add Condition').click();
      
      // Select Lab Value as condition type
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Lab Value').click();
      
      // Verify lab test autocomplete appears
      cy.get('input[placeholder*="Search by name or LOINC code"]').should('be.visible');
    });

    it('should show common lab tests in dropdown', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Lab Value').click();
      
      // Click on lab test field
      cy.get('input[placeholder*="Search by name or LOINC code"]').click();
      
      // Verify common tests appear
      cy.contains('Hemoglobin A1c').should('be.visible');
      cy.contains('Creatinine').should('be.visible');
      cy.contains('Glucose').should('be.visible');
    });

    it('should display range operators for lab values', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Lab Value').click();
      
      // Select a lab test
      cy.get('input[placeholder*="Search by name or LOINC code"]').click();
      cy.contains('Hemoglobin A1c').click();
      
      // Click on operator dropdown
      cy.get('[data-testid="operator-select"]').click();
      
      // Verify range operators are available
      cy.contains('Greater than (>)').should('be.visible');
      cy.contains('Less than (<)').should('be.visible');
      cy.contains('Between').should('be.visible');
      cy.contains('Abnormal (any)').should('be.visible');
      cy.contains('Critical').should('be.visible');
      cy.contains('Trending up').should('be.visible');
    });

    it('should show reference ranges when lab test is selected', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Lab Value').click();
      
      // Select A1c
      cy.get('input[placeholder*="Search by name or LOINC code"]').click();
      cy.contains('Hemoglobin A1c').click();
      
      // Verify reference range alert appears
      cy.contains('Normal range: 4.0 - 5.6 %').should('be.visible');
      cy.contains('Critical high: >9.0').should('be.visible');
    });

    it('should show between value fields when Between operator is selected', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Lab Value').click();
      
      // Select lab and operator
      cy.get('input[placeholder*="Search by name or LOINC code"]').click();
      cy.contains('Glucose').click();
      cy.get('[data-testid="operator-select"]').click();
      cy.contains('Between').click();
      
      // Verify two value fields appear
      cy.get('input[label="From"]').should('be.visible');
      cy.get('input[label="To"]').should('be.visible');
    });

    it('should allow timeframe selection', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Lab Value').click();
      
      // Click on timeframe dropdown
      cy.get('[data-testid="timeframe-select"]').click();
      
      // Verify timeframe options
      cy.contains('Last 7 days').should('be.visible');
      cy.contains('Last 30 days').should('be.visible');
      cy.contains('Last 90 days').should('be.visible');
      cy.contains('Last year').should('be.visible');
    });
  });

  describe('Vital Signs Condition Builder', () => {
    beforeEach(() => {
      cy.contains('button', 'Create New Hook').click();
      cy.get('input[label="Hook ID"]').type('test-vital-hook');
      cy.get('input[label="Title"]').type('Test Vital Signs Hook');
      cy.contains('button', 'Continue').click();
    });

    it('should display vital sign types when Vital Sign is selected', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Vital Sign').click();
      
      // Click on vital sign type dropdown
      cy.get('[data-testid="vital-sign-type-select"]').click();
      
      // Verify vital sign options
      cy.contains('Blood Pressure').should('be.visible');
      cy.contains('Heart Rate').should('be.visible');
      cy.contains('Temperature').should('be.visible');
      cy.contains('Oxygen Saturation').should('be.visible');
      cy.contains('Respiratory Rate').should('be.visible');
    });

    it('should show systolic/diastolic options for blood pressure', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Vital Sign').click();
      
      // Select Blood Pressure
      cy.get('[data-testid="vital-sign-type-select"]').click();
      cy.contains('Blood Pressure').click();
      
      // Verify component selection appears
      cy.contains('Component').should('be.visible');
      cy.contains('Systolic').should('be.visible');
      cy.contains('Diastolic').should('be.visible');
    });
  });

  describe('Medical Condition Autocomplete', () => {
    beforeEach(() => {
      cy.contains('button', 'Create New Hook').click();
      cy.get('input[label="Hook ID"]').type('test-condition-hook');
      cy.get('input[label="Title"]').type('Test Medical Condition Hook');
      cy.contains('button', 'Continue').click();
    });

    it('should show autocomplete with SNOMED codes', () => {
      cy.contains('button', 'Add Condition').click();
      cy.get('[data-testid="condition-type-select"]').click();
      cy.contains('Medical Condition').click();
      
      // Type in condition search
      cy.get('input[placeholder*="Search conditions"]').type('diabetes');
      
      // Verify results show code and description
      cy.contains('44054006 - Diabetes mellitus type 2').should('be.visible');
      cy.contains('46635009 - Diabetes mellitus type 1').should('be.visible');
    });
  });

  describe('Card Builder Enhancements', () => {
    beforeEach(() => {
      cy.contains('button', 'Create New Hook').click();
      cy.get('input[label="Hook ID"]').type('test-card-hook');
      cy.get('input[label="Title"]').type('Test Card Builder Hook');
      cy.contains('button', 'Continue').click();
      cy.contains('button', 'Continue').click(); // Skip conditions
    });

    it('should show tabbed interface for card types', () => {
      cy.contains('button', 'Add Card').click();
      
      // Verify tabs appear
      cy.contains('tab', 'Info Card').should('be.visible');
      cy.contains('tab', 'Suggestion Card').should('be.visible');
      cy.contains('tab', 'Action Card').should('be.visible');
    });

    it('should show FHIR resource templates for suggestions', () => {
      cy.contains('button', 'Add Card').click();
      cy.contains('tab', 'Suggestion Card').click();
      
      // Click on resource type dropdown
      cy.get('[data-testid="resource-type-select"]').click();
      
      // Verify FHIR resource options
      cy.contains('ServiceRequest (Lab Order)').should('be.visible');
      cy.contains('MedicationRequest').should('be.visible');
      cy.contains('Appointment').should('be.visible');
      cy.contains('Task').should('be.visible');
    });

    it('should show display behavior options', () => {
      cy.contains('button', 'Add Card').click();
      
      // Look for display behavior section
      cy.contains('Display Behavior').should('be.visible');
      cy.get('[data-testid="display-behavior-select"]').click();
      
      // Verify options
      cy.contains('Hard Stop (Must Address)').should('be.visible');
      cy.contains('Dismissible Popup').should('be.visible');
      cy.contains('Non-obtrusive (Side Panel)').should('be.visible');
    });
  });

  describe('Live Preview', () => {
    it('should show live preview of hook as configured', () => {
      cy.contains('button', 'Create New Hook').click();
      
      // Fill out basic info
      cy.get('input[label="Hook ID"]').type('preview-test');
      cy.get('input[label="Title"]').type('Preview Test Hook');
      
      // Look for preview panel
      cy.get('[data-testid="hook-preview-panel"]').should('be.visible');
      
      // Verify preview updates as we type
      cy.get('[data-testid="hook-preview-panel"]').should('contain', 'Preview Test Hook');
    });
  });

  describe('Visual Test Mode', () => {
    it('should allow running test with real patient data', () => {
      // Create a simple hook first
      cy.contains('button', 'Create New Hook').click();
      cy.get('input[label="Hook ID"]').type('visual-test');
      cy.get('input[label="Title"]').type('Visual Test Hook');
      
      // Skip to test step
      cy.contains('button', 'Continue').click();
      cy.contains('button', 'Continue').click();
      cy.contains('button', 'Continue').click();
      
      // Click test button
      cy.contains('button', 'Test Hook').click();
      
      // Verify patient search appears
      cy.get('input[placeholder*="Search patients"]').should('be.visible');
      
      // Search for a patient
      cy.get('input[placeholder*="Search patients"]').type('Smith');
      
      // Select a patient
      cy.get('[data-testid="patient-result"]').first().click();
      
      // Run test
      cy.contains('button', 'Run Test').click();
      
      // Verify results appear
      cy.get('[data-testid="test-results"]').should('be.visible');
    });
  });
});

// Helper command for navigation
Cypress.Commands.add('navigateToCDSBuilder', () => {
  cy.visit('/cds-hooks');
  cy.contains('button', 'Create New Hook').click();
});