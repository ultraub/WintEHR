const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1920,
    viewportHeight: 1080,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    
    // Visual testing specific settings
    env: {
      VISUAL_MODE: true,
      SLOW_MOTION: 500 // Add delay between actions for visual testing
    },
    
    setupNodeEvents(on, config) {
      // Add visual testing plugins if needed
      on('task', {
        log(message) {
          console.log(message);
          return null;
        }
      });
    },
    
    // Only run the CDS builder test in visual mode
    specPattern: 'cypress/e2e/working/cds-hook-builder.cy.js'
  }
});