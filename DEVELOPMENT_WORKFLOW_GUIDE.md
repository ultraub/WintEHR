# Development Workflow Guide

## 🔥 Hot Reload Setup

### Backend (Already Configured)
The backend automatically reloads when you save Python files thanks to the `--reload` flag in docker-compose.yml.

### Frontend Hot Reload

#### Option 1: Development Docker Compose (Recommended)
```bash
# Stop current containers
docker-compose down

# Start with development configuration
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Frontend will now be available at http://localhost:3000 with hot reload
```

#### Option 2: Run Frontend Locally
```bash
# Keep backend running in Docker
docker-compose up postgres backend

# Run frontend locally
cd frontend
npm install
npm start

# Access at http://localhost:3000
```

### Hot Reload Features
- **Instant Updates**: Save a React component and see changes immediately
- **State Preservation**: React Fast Refresh preserves component state
- **Error Overlay**: See errors directly in the browser
- **No Build Step**: Changes reflect without rebuilding

## 🧪 Cypress Workflow Testing

### 1. Visual Workflow Testing
```bash
cd e2e-tests

# Open Cypress in visual mode
npm run cypress:open

# Select workflow test
# Watch as it executes step-by-step
```

### 2. Workflow Validation Features

#### Screenshots at Each Step
The workflow tests automatically capture screenshots:
- `01-build-mode.png` - Initial state
- `02-basic-info-filled.png` - After form fill
- `03-conditions-section.png` - Conditions view
- etc.

#### Performance Metrics
```javascript
// Tests measure and log performance
cy.measureUIMetric('Add 5 conditions', () => {
  // Add conditions
});
// Logs: "Add 5 conditions: 2341.23ms"
```

#### UI Issue Detection
```javascript
// Tests check for UI problems
- Missing tooltips
- Disabled states
- Validation errors
- Responsive design issues
```

### 3. Workflow Test Patterns

#### Complete User Journey
```javascript
it('should complete full workflow', () => {
  // Step-by-step user journey
  cy.validateWorkflowStep('login', [
    () => cy.url().should('include', '/patients'),
    () => cy.contains('Welcome').should('be.visible')
  ]);
  
  cy.validateWorkflowStep('navigate-to-cds', [
    () => cy.visit('/cds-studio'),
    () => cy.contains('CDS Hooks Studio').should('be.visible')
  ]);
  
  // Continue through workflow...
});
```

#### Error Recovery Testing
```javascript
it('should handle errors gracefully', () => {
  // Test invalid inputs
  cy.get('input[type="number"]').type('abc');
  cy.contains('Invalid value').should('be.visible');
  
  // Test recovery
  cy.get('input[type="number"]').clear().type('100');
  cy.contains('Invalid value').should('not.exist');
});
```

#### Responsive Design Testing
```javascript
it('should work on mobile', () => {
  cy.viewport('iphone-x');
  cy.visit('/cds-studio');
  
  // Test mobile menu
  cy.get('[data-testid="mobile-menu"]').click();
  cy.contains('Build').should('be.visible');
});
```

## 🔄 Development Workflow

### 1. Make Changes with Hot Reload
```bash
# Terminal 1: Run development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Terminal 2: Run Cypress
cd e2e-tests
npm run cypress:open
```

### 2. Test Workflow While Developing
1. Make a UI change in your editor
2. Save the file
3. See change instantly in browser
4. Run Cypress test to validate
5. Take screenshots for documentation

### 3. Iterate Quickly
- **Change**: Edit component
- **See**: Hot reload updates browser
- **Test**: Cypress validates workflow
- **Measure**: Performance metrics logged
- **Document**: Screenshots captured

## 📊 Using Cypress for UI Improvement

### 1. Identify Pain Points
```javascript
// Track user actions that take too long
cy.measureUIMetric('Find lab test in dropdown', () => {
  cy.get('input[placeholder*="Search"]').type('glucose');
  cy.contains('Glucose').click();
});
```

### 2. A/B Testing UI Changes
```javascript
// Test current implementation
cy.screenshot('current-design');

// Apply new design via feature flag
cy.window().then(win => {
  win.localStorage.setItem('feature_new_ui', 'true');
});
cy.reload();

// Test new implementation
cy.screenshot('new-design');
```

### 3. Accessibility Testing
```javascript
// Check keyboard navigation
cy.get('body').tab();
cy.focused().should('have.attr', 'aria-label');

// Check color contrast
cy.checkA11y();
```

## 🚀 Quick Commands

### Start Development Environment
```bash
# With hot reload
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Rebuild if needed
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

### Run Workflow Tests
```bash
# Visual mode (recommended for development)
cd e2e-tests
npm run cypress:open

# Headless mode (for CI/CD)
npm run test:workflows

# Specific workflow
npx cypress run --spec 'cypress/e2e/workflows/cds-builder-workflow.cy.js'
```

### View Test Results
```bash
# Screenshots are saved in
e2e-tests/cypress/screenshots/

# Videos (if enabled) in
e2e-tests/cypress/videos/
```

## 💡 Tips for Effective Workflow Testing

### 1. Use Data Attributes
```jsx
// In React component
<Button data-testid="save-hook-button">Save Hook</Button>

// In Cypress test
cy.get('[data-testid="save-hook-button"]').click();
```

### 2. Add Waits for Animations
```javascript
// Wait for animation to complete
cy.contains('Conditions').click();
cy.wait(500); // Animation duration
cy.screenshot('after-animation');
```

### 3. Test Real User Behavior
```javascript
// Don't just test happy path
cy.get('input').type('wrong{backspace}{backspace}{backspace}right');
```

### 4. Use Custom Commands
```javascript
// Create reusable workflows
Cypress.Commands.add('createBasicCDSHook', (title) => {
  cy.visit('/cds-studio');
  cy.contains('Build').click();
  cy.get('input[label="Hook Title"]').type(title);
  // ... rest of workflow
});
```

## 🐛 Troubleshooting

### Hot Reload Not Working
1. Check `CHOKIDAR_USEPOLLING=true` is set
2. Ensure volumes are mounted correctly
3. Try `docker-compose restart frontend`

### Cypress Can't Connect
1. Ensure app is running: `docker-compose ps`
2. Check URL in cypress.config.js
3. Try direct URL: http://localhost:3000

### Tests Running Too Fast
1. Add `cy.wait()` between actions
2. Use `--slow` flag: `cypress run --slow 500`
3. Enable video recording for review

## 📈 Metrics to Track

- **Time to Complete Workflow**: How long for common tasks?
- **Error Rate**: How often do users encounter errors?
- **Recovery Time**: How long to recover from errors?
- **Click Count**: How many clicks for common tasks?
- **Load Time**: How fast do components render?

Use these metrics to guide UI improvements!