const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    fixturesFolder: 'cypress/fixtures',
    video: true,
    screenshot: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    env: {
      apiUrl: 'http://localhost:8000',
      fhirUrl: 'http://localhost:8000/fhir/R4',
      username: 'demo',
      password: 'password'
    },
    setupNodeEvents(on, config) {
      // Task for database cleanup
      on('task', {
        cleanDatabase() {
          return null;
        },
        seedTestData() {
          return null;
        }
      });
    },
  },
});