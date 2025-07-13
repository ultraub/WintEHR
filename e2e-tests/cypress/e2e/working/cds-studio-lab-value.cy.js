/**
 * CDS Studio - Lab Value Condition Builder Test
 * Tests for the enhanced lab value condition builder in CDS Studio
 */

describe('CDS Studio - Lab Value Condition Builder', () => {
  beforeEach(() => {
    // Login as admin
    cy.visit('/login');
    cy.get('input[name="username"]').type('admin');
    cy.get('input[name="password"]').type('password');
    cy.get('button[type="submit"]').click();
    
    // Wait for navigation
    cy.url().should('include', '/patients');
    
    // Navigate to CDS Studio
    cy.visit('/cds-studio');
    
    // Wait for CDS Studio to load
    cy.contains('CDS Hooks Studio', { timeout: 10000 }).should('be.visible');
  });

  it('should navigate to Build mode and show visual condition builder', () => {
    // Click on Build tab
    cy.contains('[role="tab"]', 'Build').click();
    
    // Should see the build interface
    cy.contains('Hook Information').should('be.visible');
    
    // Navigate to conditions section
    cy.contains('Conditions').click();
    
    // Should see visual condition builder
    cy.contains('Drag conditions from the palette').should('be.visible');
  });

  it('should allow adding a lab value condition', () => {
    // Go to Build mode
    cy.contains('[role="tab"]', 'Build').click();
    
    // Navigate to conditions
    cy.contains('Conditions').click();
    
    // Look for the Laboratory category
    cy.contains('Laboratory').should('be.visible');
    
    // Find and drag/click Lab Result
    cy.contains('Lab Result').click();
    
    // Should see the enhanced lab value builder
    cy.get('input[placeholder*="Search by name or LOINC code"]').should('be.visible');
  });

  it('should show lab test autocomplete with LOINC codes', () => {
    // Quick navigation to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Click on lab test search field
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    
    // Should see common lab tests with LOINC codes
    cy.contains('Hemoglobin A1c (4548-4)').should('be.visible');
    cy.contains('Creatinine (2160-0)').should('be.visible');
    cy.contains('Glucose (2345-7)').should('be.visible');
    
    // Should show categories
    cy.contains('Category: Diabetes').should('be.visible');
    cy.contains('Category: Renal').should('be.visible');
  });

  it('should display reference ranges when lab test is selected', () => {
    // Navigate to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Select Hemoglobin A1c
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Hemoglobin A1c').click();
    
    // Should see reference range info
    cy.contains('Normal range: 4.0 - 5.6 %').should('be.visible');
    cy.contains('Critical high: >9.0').should('be.visible');
  });

  it('should show enhanced operators for lab values', () => {
    // Navigate to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Select a lab test
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Glucose').click();
    
    // Check operator dropdown
    cy.get('[data-testid="operator-select"]').click();
    
    // Should see all enhanced operators
    cy.contains('Greater than (>)').should('be.visible');
    cy.contains('Less than (<)').should('be.visible');
    cy.contains('Greater than or equal (≥)').should('be.visible');
    cy.contains('Less than or equal (≤)').should('be.visible');
    cy.contains('Between').should('be.visible');
    cy.contains('Abnormal (any)').should('be.visible');
    cy.contains('Critical').should('be.visible');
    cy.contains('Trending up').should('be.visible');
    cy.contains('Trending down').should('be.visible');
    cy.contains('Missing/Not done').should('be.visible');
  });

  it('should show two value fields when Between operator is selected', () => {
    // Navigate to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Select lab and Between operator
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Glucose').click();
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('Between').click();
    
    // Should see From and To fields
    cy.get('input[label="From"]').should('be.visible');
    cy.get('input[label="To"]').should('be.visible');
    
    // Both should show units
    cy.contains('mg/dL').should('have.length.at.least', 2);
  });

  it('should allow timeframe selection', () => {
    // Navigate to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Select a lab test
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Creatinine').click();
    
    // Check timeframe dropdown
    cy.get('[data-testid="timeframe-select"]').click();
    
    // Verify timeframe options
    cy.contains('Last 7 days').should('be.visible');
    cy.contains('Last 30 days').should('be.visible');
    cy.contains('Last 90 days').should('be.visible');
    cy.contains('Last 6 months').should('be.visible');
    cy.contains('Last year').should('be.visible');
    cy.contains('Last 2 years').should('be.visible');
    cy.contains('Any time').should('be.visible');
  });

  it('should show trend configuration for trending operators', () => {
    // Navigate to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Select lab and trending operator
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Creatinine').click();
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('Trending up').click();
    
    // Should see trend configuration
    cy.contains('Minimum number of results for trend').should('be.visible');
    cy.get('input[label*="Minimum number"]').should('have.value', '3');
  });

  it('should hide value inputs for special operators', () => {
    // Navigate to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Select a lab test
    cy.get('input[placeholder*="Search by name or LOINC code"]').click();
    cy.contains('Glucose').click();
    
    // Select "Abnormal" operator
    cy.get('[data-testid="operator-select"]').click();
    cy.contains('Abnormal (any)').click();
    
    // Should NOT see value input fields
    cy.get('input[label="Value"]').should('not.exist');
    cy.get('input[label="From"]').should('not.exist');
    
    // But should still see timeframe
    cy.get('[data-testid="timeframe-select"]').should('be.visible');
  });

  it('should search for lab tests', () => {
    // Navigate to lab condition
    cy.contains('[role="tab"]', 'Build').click();
    cy.contains('Conditions').click();
    cy.contains('Lab Result').click();
    
    // Type in search
    cy.get('input[placeholder*="Search by name or LOINC code"]').type('cholesterol');
    
    // Should filter results
    cy.contains('HDL Cholesterol').should('be.visible');
    cy.contains('LDL Cholesterol').should('be.visible');
    cy.contains('Hemoglobin A1c').should('not.exist'); // Should be filtered out
  });
});