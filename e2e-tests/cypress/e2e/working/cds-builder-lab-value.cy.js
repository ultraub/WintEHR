/**
 * Lab Value Condition Builder Test
 * Focused test for the new lab value condition builder
 */

describe('Lab Value Condition Builder - Visual Test', () => {
  beforeEach(() => {
    // Login as admin
    cy.visit('/login');
    cy.get('input[name="username"]').type('admin');
    cy.get('input[name="password"]').type('password');
    cy.get('button[type="submit"]').click();
    
    // Wait for navigation
    cy.url().should('include', '/patients');
    
    // Navigate to CDS Hooks page
    cy.visit('/cds-hooks');
    
    // Wait for page to load
    cy.contains('CDS Hooks Management', { timeout: 10000 }).should('be.visible');
  });

  it('should open the CDS Hook Builder when Create New Hook is clicked', () => {
    // Look for the create button - it might be in a tab
    cy.contains('button', 'Create New Hook').should('be.visible').click();
    
    // Verify the builder opens
    cy.contains('CDS Hook Builder').should('be.visible');
    cy.contains('Basic Information').should('be.visible');
  });

  it('should show Lab Value condition builder when Lab Value is selected', () => {
    // Open builder
    cy.contains('button', 'Create New Hook').click();
    
    // Fill basic info
    cy.get('input[placeholder="my-custom-hook"]').type('test-lab-hook');
    cy.get('input[placeholder="My Custom CDS Hook"]').type('Test Lab Value Hook');
    cy.get('textarea[placeholder*="Describe what this hook does"]').type('Test hook for lab values');
    
    // Move to conditions step
    cy.contains('button', 'Continue').click();
    
    // Should see conditions section
    cy.contains('Triggering Conditions').should('be.visible');
    
    // Add a condition
    cy.contains('button', 'Add Condition').click();
    
    // Select Lab Value from dropdown
    cy.get('[data-testid="condition-type-select"]').click();
    cy.contains('Lab Value').click();
    
    // Verify the lab value builder appears
    cy.get('input[placeholder*="Search by name or LOINC code"]').should('be.visible');
    
    // Click on the lab test field to see dropdown
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    
    // Should see common lab tests
    cy.contains('Hemoglobin A1c').should('be.visible');
    cy.contains('Creatinine').should('be.visible');
    cy.contains('Glucose').should('be.visible');
  });

  it('should display reference ranges when a lab test is selected', () => {
    // Quick navigation to conditions
    cy.contains('button', 'Create New Hook').click();
    cy.get('input[placeholder="my-custom-hook"]').type('ref-range-test');
    cy.contains('button', 'Continue').click();
    cy.contains('button', 'Add Condition').click();
    cy.get('[data-testid="condition-type-select"]').click();
    cy.contains('Lab Value').click();
    
    // Select Hemoglobin A1c
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Hemoglobin A1c').click();
    
    // Should see reference range
    cy.contains('Normal range: 4.0 - 5.6 %').should('be.visible');
    cy.contains('Critical high: >9.0').should('be.visible');
  });

  it('should show enhanced operators for lab values', () => {
    // Quick navigation to conditions
    cy.contains('button', 'Create New Hook').click();
    cy.get('input[placeholder="my-custom-hook"]').type('operator-test');
    cy.contains('button', 'Continue').click();
    cy.contains('button', 'Add Condition').click();
    cy.get('[data-testid="condition-type-select"]').click();
    cy.contains('Lab Value').click();
    
    // Select a lab test first
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Glucose').click();
    
    // Check operator dropdown
    cy.contains('Operator').parent().find('select, [role="button"]').first().click();
    
    // Verify enhanced operators
    cy.contains('Greater than (>)').should('be.visible');
    cy.contains('Less than (<)').should('be.visible');
    cy.contains('Between').should('be.visible');
    cy.contains('Abnormal (any)').should('be.visible');
    cy.contains('Critical').should('be.visible');
    cy.contains('Trending up').should('be.visible');
    cy.contains('Missing/Not done').should('be.visible');
  });

  it('should show two value fields when Between operator is selected', () => {
    // Quick navigation
    cy.contains('button', 'Create New Hook').click();
    cy.get('input[placeholder="my-custom-hook"]').type('between-test');
    cy.contains('button', 'Continue').click();
    cy.contains('button', 'Add Condition').click();
    cy.get('[data-testid="condition-type-select"]').click();
    cy.contains('Lab Value').click();
    
    // Select lab and Between operator
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Glucose').click();
    cy.contains('Operator').parent().find('select, [role="button"]').first().click();
    cy.contains('Between').click();
    
    // Should see two value fields
    cy.get('input[label="From"]').should('be.visible');
    cy.get('input[label="To"]').should('be.visible');
    
    // Both should have units
    cy.contains('mg/dL').should('be.visible');
  });

  it('should allow timeframe selection', () => {
    // Quick navigation
    cy.contains('button', 'Create New Hook').click();
    cy.get('input[placeholder="my-custom-hook"]').type('timeframe-test');
    cy.contains('button', 'Continue').click();
    cy.contains('button', 'Add Condition').click();
    cy.get('[data-testid="condition-type-select"]').click();
    cy.contains('Lab Value').click();
    
    // Select a lab test
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Creatinine').click();
    
    // Check timeframe dropdown
    cy.contains('Timeframe').parent().find('select, [role="button"]').first().click();
    
    // Verify timeframe options
    cy.contains('Last 7 days').should('be.visible');
    cy.contains('Last 30 days').should('be.visible');
    cy.contains('Last 90 days').should('be.visible');
    cy.contains('Last 6 months').should('be.visible');
    cy.contains('Last year').should('be.visible');
  });

  it('should show trend options when trending operator is selected', () => {
    // Quick navigation
    cy.contains('button', 'Create New Hook').click();
    cy.get('input[placeholder="my-custom-hook"]').type('trend-test');
    cy.contains('button', 'Continue').click();
    cy.contains('button', 'Add Condition').click();
    cy.get('[data-testid="condition-type-select"]').click();
    cy.contains('Lab Value').click();
    
    // Select lab and trending operator
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Creatinine').click();
    cy.contains('Operator').parent().find('select, [role="button"]').first().click();
    cy.contains('Trending up').click();
    
    // Should see trend configuration
    cy.contains('Minimum number of results for trend').should('be.visible');
  });
});