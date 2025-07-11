# Visual Testing Guide for CDS Hook Builder

## Overview
This guide explains how to use Cypress for visual testing while developing the CDS Hook Builder enhancements.

## Quick Start

### 1. Start the Application
```bash
# From project root
./start.sh
```

### 2. Open Cypress for Visual Testing
```bash
# From e2e-tests directory
cd e2e-tests
npm run test:visual
```

Or specifically for CDS Builder:
```bash
npm run test:cds-builder
```

### 3. Run Tests Interactively
- Cypress Test Runner will open
- Click on `cds-hook-builder.cy.js` to run the tests
- Watch the browser as tests execute
- Use the time-travel debugging to inspect each step

## Key Features for Visual Testing

### 1. Slow Motion Mode
The visual config adds delays between actions so you can see what's happening:
```javascript
env: {
  SLOW_MOTION: 500 // 500ms delay between actions
}
```

### 2. Large Viewport
Set to 1920x1080 for better visibility of the UI:
```javascript
viewportWidth: 1920,
viewportHeight: 1080
```

### 3. Interactive Debugging
- Click on any command in the Cypress sidebar to see the DOM state at that point
- Use browser DevTools while tests are paused
- Take screenshots manually during test execution

## Test Structure

### Lab Value Condition Builder Tests
- Verifies the new lab test autocomplete
- Checks range operators (>, <, between, etc.)
- Validates reference range display
- Tests timeframe selection

### Vital Signs Condition Builder Tests
- Tests vital sign type selection
- Verifies BP systolic/diastolic options
- Checks normal range displays

### Card Builder Enhancement Tests
- Validates tabbed interface
- Tests FHIR resource templates
- Checks display behavior options

### Live Preview Tests
- Ensures preview updates in real-time
- Validates hook visualization

## Development Workflow

1. **Make UI Changes**: Edit the component files
2. **Run Visual Test**: `npm run test:visual`
3. **Watch Test Execute**: See how the UI behaves
4. **Debug Issues**: Use Cypress time-travel and DevTools
5. **Update Tests**: Add new test cases for new features

## Writing New Visual Tests

### Basic Pattern
```javascript
it('should display new UI element', () => {
  // Navigate to the feature
  cy.visit('/cds-hooks');
  cy.contains('button', 'Create New Hook').click();
  
  // Interact with UI
  cy.get('[data-testid="my-element"]').click();
  
  // Visual assertions
  cy.contains('Expected Text').should('be.visible');
  cy.get('[data-testid="my-element"]').should('have.class', 'active');
});
```

### Best Practices for Visual Testing
1. Use `data-testid` attributes for reliable element selection
2. Add explicit waits for animations: `cy.wait(500)`
3. Take screenshots at key points: `cy.screenshot('step-name')`
4. Use descriptive test names that explain what you're visually verifying

## Troubleshooting

### Tests Running Too Fast
Increase SLOW_MOTION in cypress.visual.config.js:
```javascript
env: {
  SLOW_MOTION: 1000 // 1 second delay
}
```

### Can't See Element
Add explicit scroll:
```javascript
cy.get('[data-testid="my-element"]').scrollIntoView().click();
```

### Need to Pause Test
Add debugger:
```javascript
cy.get('[data-testid="my-element"]').then(() => {
  debugger; // Test will pause here
});
```

## Tips for CDS Builder Development

1. **Test Each Enhancement Separately**: Run individual test blocks using `.only`:
   ```javascript
   it.only('should test specific feature', () => {
     // Your test
   });
   ```

2. **Mock Data**: The tests use real UI but can mock backend responses:
   ```javascript
   cy.intercept('GET', '/api/lab-tests', { fixture: 'lab-tests.json' });
   ```

3. **Visual Regression**: Take screenshots before/after changes:
   ```javascript
   cy.screenshot('before-enhancement');
   // Make changes
   cy.screenshot('after-enhancement');
   ```

4. **Component States**: Test different states (empty, loading, error, success):
   ```javascript
   // Test loading state
   cy.get('[data-testid="loading"]').should('be.visible');
   
   // Test error state
   cy.contains('Error message').should('be.visible');
   ```

## Running in CI
For automated visual testing in CI:
```bash
npm run test:cds-builder -- --headless
```

This will still capture screenshots and videos for review.