// Debug Test - Check what UI elements are actually available
describe('Debug UI Elements', () => {
  
  it('should inspect the actual UI structure', () => {
    cy.visit('/');
    
    // Wait for the page to load
    cy.wait(3000);
    
    // Check current URL
    cy.url().then(url => {
      cy.log(`Current URL: ${url}`);
    });
    
    // Get the page title
    cy.title().then(title => {
      cy.log(`Page title: ${title}`);
    });
    
    // Check for any data-testid attributes
    cy.get('[data-testid]').then($elements => {
      cy.log(`Found ${$elements.length} elements with data-testid attributes`);
      
      $elements.each((index, el) => {
        cy.log(`Element ${index}: ${el.getAttribute('data-testid')}`);
      });
    });
    
    // Check for common selectors
    cy.get('body').then($body => {
      const selectors = [
        '.patient-list',
        '.dashboard',
        '[class*="patient"]',
        '[class*="dashboard"]',
        '[class*="login"]',
        'button',
        'input',
        'h1, h2, h3',
        '.MuiButton-root',
        '.MuiCard-root',
        '.MuiList-root'
      ];
      
      selectors.forEach(selector => {
        const elements = $body.find(selector);
        if (elements.length > 0) {
          cy.log(`Found ${elements.length} elements with selector: ${selector}`);
        }
      });
    });
    
    // Log the HTML structure
    cy.get('body').invoke('html').then(html => {
      // Log just the first 2000 characters to see the structure
      cy.log(`Body HTML (first 2000 chars): ${html.substring(0, 2000)}`);
    });
    
    // Check specifically for DataGrid and other Material-UI components
    cy.get('body').then($body => {
      const muiComponents = [
        '.MuiDataGrid-root',
        '.MuiButton-root',
        '.MuiTypography-root',
        '.MuiCard-root',
        '.MuiPaper-root',
        '.MuiTab-root',
        '.MuiTextField-root'
      ];
      
      muiComponents.forEach(selector => {
        const elements = $body.find(selector);
        cy.log(`Found ${elements.length} elements with selector: ${selector}`);
      });
    });
    
    // Check for React app mount point
    cy.get('#root').should('exist').then($root => {
      cy.log(`React app mounted. Inner HTML length: ${$root.html().length}`);
    });
  });
});