/**
 * CDS Builder Complete Workflow Test
 * Tests the entire workflow of creating a CDS hook with enhanced features
 */

describe('CDS Builder Complete Workflow', () => {
  beforeEach(() => {
    cy.login('admin', 'password');
    cy.visit('/cds-studio');
    cy.contains('CDS Hooks Studio', { timeout: 10000 }).should('be.visible');
  });

  it('should complete full workflow: create diabetes A1C monitoring hook', () => {
    // Step 1: Navigate to Build mode
    cy.contains('[role="tab"]', 'Build').click();
    cy.screenshot('01-build-mode');
    
    // Step 2: Fill basic information
    cy.get('input[label="Hook Title"]').type('Diabetes A1C Monitoring');
    cy.get('textarea[label="Description"]').type(
      'Monitors A1C levels for diabetic patients and alerts when testing is overdue'
    );
    cy.screenshot('02-basic-info-filled');
    
    // Step 3: Add lab value condition
    cy.contains('Conditions').click();
    cy.wait(500); // Visual delay
    cy.screenshot('03-conditions-section');
    
    // Add first condition - Patient has diabetes
    cy.contains('Clinical').parent().find('button').contains('Has Condition').click();
    cy.wait(500);
    cy.get('input[placeholder*="Search conditions"]').type('diabetes');
    cy.contains('44054006 - Diabetes mellitus type 2').click();
    cy.screenshot('04-diabetes-condition-added');
    
    // Add second condition - A1C overdue
    cy.contains('Laboratory').parent().find('button').contains('Lab Result').click();
    cy.wait(500);
    
    // Select A1C test
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Hemoglobin A1c').click();
    cy.screenshot('05-a1c-selected');
    
    // Configure as "missing" in last 90 days
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('Missing/Not done').click();
    
    cy.get('[data-testid="timeframe-select"]').click();
    cy.contains('Last 90 days').click();
    cy.screenshot('06-a1c-condition-configured');
    
    // Step 4: Design the card
    cy.contains('Cards').click();
    cy.wait(500);
    cy.contains('Add Card').click();
    
    // Configure warning card
    cy.get('input[label="Card Summary"]').type('A1C Testing Overdue');
    cy.get('textarea[label="Card Details"]').type(
      'Patient with diabetes has not had A1C testing in the last 90 days. ' +
      'Current guidelines recommend A1C testing every 3 months for patients with diabetes.'
    );
    
    cy.get('select[label="Indicator"]').select('warning');
    cy.screenshot('07-card-configured');
    
    // Add suggestion
    cy.contains('Add Suggestion').click();
    cy.get('input[label="Suggestion Label"]').type('Order A1C Test');
    cy.get('select[label="Resource Type"]').select('ServiceRequest');
    cy.screenshot('08-suggestion-added');
    
    // Step 5: Preview the hook
    cy.contains('Preview').click();
    cy.wait(1000); // Let preview render
    cy.screenshot('09-hook-preview');
    
    // Step 6: Test the hook
    cy.contains('Test').click();
    cy.get('input[placeholder*="Search patients"]').type('diabetes');
    cy.wait(500);
    cy.get('[data-testid="patient-result"]').first().click();
    cy.contains('Run Test').click();
    cy.wait(1000);
    cy.screenshot('10-test-results');
    
    // Step 7: Save the hook
    cy.contains('Save Hook').click();
    cy.contains('Hook saved successfully').should('be.visible');
    cy.screenshot('11-hook-saved');
  });

  it('should validate UI improvements during workflow', () => {
    // Track UI pain points
    const uiIssues = [];
    
    cy.contains('[role="tab"]', 'Build').click();
    
    // Check if tooltips are present
    cy.get('[data-testid="help-icon"]').should('have.length.at.least', 1)
      .first().trigger('mouseover');
    cy.get('[role="tooltip"]').should('be.visible');
    
    // Check form validation
    cy.contains('Conditions').click();
    cy.contains('Laboratory').parent().find('button').contains('Lab Result').click();
    
    // Try to proceed without selecting a lab
    cy.get('[data-testid="operator-select"]').should('be.disabled')
      .then(() => {
        uiIssues.push('Operator should be disabled until lab is selected - GOOD');
      });
    
    // Check responsive design
    cy.viewport(768, 1024); // iPad
    cy.screenshot('responsive-ipad');
    
    cy.viewport(375, 667); // iPhone
    cy.screenshot('responsive-iphone');
    
    // Log UI findings
    cy.task('log', 'UI Validation Results:');
    uiIssues.forEach(issue => cy.task('log', issue));
  });

  it('should test error states and recovery', () => {
    cy.contains('[role="tab"]', 'Build').click();
    
    // Test empty form submission
    cy.contains('Save Hook').click();
    cy.contains('validation', { matchCase: false }).should('be.visible');
    cy.screenshot('validation-errors');
    
    // Test invalid lab value
    cy.contains('Conditions').click();
    cy.contains('Laboratory').parent().find('button').contains('Lab Result').click();
    
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Glucose').click();
    
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('Greater than (>)').click();
    
    // Enter invalid value
    cy.get('input[label="Value"]').type('abc');
    cy.screenshot('invalid-value-entered');
    
    // Should show error
    cy.get('input[label="Value"]').should('have.attr', 'aria-invalid', 'true');
  });

  it('should measure performance during complex operations', () => {
    cy.contains('[role="tab"]', 'Build').click();
    
    // Measure condition addition time
    cy.contains('Conditions').click();
    
    const startTime = Date.now();
    
    // Add multiple conditions rapidly
    for (let i = 0; i < 5; i++) {
      cy.contains('Laboratory').parent().find('button').contains('Lab Result').click();
      cy.wait(100);
    }
    
    cy.then(() => {
      const duration = Date.now() - startTime;
      cy.task('log', `Added 5 conditions in ${duration}ms`);
      expect(duration).to.be.lessThan(3000); // Should be fast
    });
  });
});

// Helper commands for workflow testing
Cypress.Commands.add('validateWorkflowStep', (stepName, validations) => {
  cy.task('log', `Validating step: ${stepName}`);
  validations.forEach(validation => {
    validation();
  });
  cy.screenshot(`workflow-${stepName}`);
});

Cypress.Commands.add('measureUIMetric', (metricName, measurement) => {
  cy.window().then(win => {
    const start = win.performance.now();
    measurement();
    cy.then(() => {
      const duration = win.performance.now() - start;
      cy.task('log', `${metricName}: ${duration.toFixed(2)}ms`);
    });
  });
});