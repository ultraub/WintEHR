/**
 * E2E Test: Navigate all pages and check for errors
 * 
 * This script uses Playwright to navigate through all pages in the WintEHR application
 * and checks for JavaScript errors, console errors, and failed network requests.
 * 
 * @since 2025-01-20
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOT_DIR = './screenshots';
const REPORT_FILE = './error-report.json';

// Pages to test
const PAGES_TO_TEST = [
  // Public pages
  { path: '/', name: 'Home Page' },
  { path: '/login', name: 'Login Page' },
  
  // Clinical pages (require authentication)
  { path: '/clinical', name: 'Clinical Dashboard' },
  { path: '/clinical/patients', name: 'Patient List' },
  { path: '/clinical/workspace', name: 'Clinical Workspace' },
  
  // Pharmacy pages
  { path: '/pharmacy', name: 'Pharmacy Dashboard' },
  { path: '/pharmacy/queue', name: 'Pharmacy Queue' },
  { path: '/pharmacy/dispensing', name: 'Dispensing' },
  
  // Lab pages
  { path: '/lab', name: 'Lab Dashboard' },
  { path: '/lab/orders', name: 'Lab Orders' },
  { path: '/lab/results', name: 'Lab Results' },
  
  // Admin pages
  { path: '/admin', name: 'Admin Dashboard' },
  { path: '/admin/users', name: 'User Management' },
  { path: '/admin/settings', name: 'Settings' },
  
  // CDS pages
  { path: '/cds', name: 'CDS Dashboard' },
  { path: '/cds/builder', name: 'CDS Builder' },
  { path: '/cds/hooks', name: 'CDS Hooks' }
];

// Patient-specific pages (will be populated after getting patient list)
const PATIENT_TABS = [
  'summary',
  'chart-review',
  'encounters',
  'results',
  'orders',
  'pharmacy',
  'imaging',
  'documentation',
  'care-plan',
  'timeline'
];

class PageErrorChecker {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.errors = [];
    this.consoleMessages = [];
    this.networkFailures = [];
  }

  async init() {
    // Create screenshot directory
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

    // Launch browser
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true
    });

    this.page = await this.context.newPage();

    // Set up error monitoring
    this.setupErrorMonitoring();
  }

  setupErrorMonitoring() {
    // Monitor JavaScript errors
    this.page.on('pageerror', error => {
      this.errors.push({
        type: 'JavaScript Error',
        message: error.message,
        stack: error.stack,
        url: this.page.url(),
        timestamp: new Date().toISOString()
      });
    });

    // Monitor console messages
    this.page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          url: this.page.url(),
          timestamp: new Date().toISOString()
        });
      }
    });

    // Monitor network failures
    this.page.on('requestfailed', request => {
      this.networkFailures.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure(),
        pageUrl: this.page.url(),
        timestamp: new Date().toISOString()
      });
    });

    // Monitor response errors
    this.page.on('response', response => {
      if (response.status() >= 400 && !response.url().includes('favicon')) {
        this.networkFailures.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          pageUrl: this.page.url(),
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  async login() {
    console.log('🔐 Logging in...');
    
    // Navigate to login page
    await this.page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    // Fill in demo credentials
    await this.page.fill('input[name="username"]', 'demo');
    await this.page.fill('input[name="password"]', 'password');
    
    // Click login button
    await this.page.click('button[type="submit"]');
    
    // Wait for navigation
    await this.page.waitForURL('**/clinical/**', { timeout: 10000 });
    
    console.log('✅ Logged in successfully');
  }

  async checkPage(pageInfo) {
    const startTime = Date.now();
    const result = {
      ...pageInfo,
      errors: [],
      warnings: [],
      networkErrors: [],
      screenshot: null,
      loadTime: 0,
      success: false
    };

    try {
      console.log(`📄 Checking ${pageInfo.name} (${pageInfo.path})...`);
      
      // Clear previous errors
      const errorCountBefore = this.errors.length;
      const consoleCountBefore = this.consoleMessages.length;
      const networkCountBefore = this.networkFailures.length;

      // Navigate to page
      const response = await this.page.goto(`${BASE_URL}${pageInfo.path}`, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Wait a bit for any async operations
      await this.page.waitForTimeout(2000);

      // Check if page loaded successfully
      if (!response || response.status() >= 400) {
        result.errors.push({
          type: 'Page Load Error',
          message: `Page returned status ${response?.status() || 'unknown'}`
        });
      }

      // Collect errors that occurred during this page load
      result.errors = this.errors.slice(errorCountBefore);
      result.warnings = this.consoleMessages.slice(consoleCountBefore);
      result.networkErrors = this.networkFailures.slice(networkCountBefore);

      // Take screenshot if there are errors
      if (result.errors.length > 0 || result.warnings.length > 0 || result.networkErrors.length > 0) {
        const screenshotName = `${pageInfo.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotName;
      }

      result.loadTime = Date.now() - startTime;
      result.success = result.errors.length === 0 && result.networkErrors.filter(e => e.status >= 500).length === 0;

      console.log(`  ${result.success ? '✅' : '❌'} ${pageInfo.name} - ${result.loadTime}ms`);
      if (result.errors.length > 0) {
        console.log(`  ⚠️  ${result.errors.length} JS errors`);
      }
      if (result.warnings.length > 0) {
        console.log(`  ⚠️  ${result.warnings.length} console warnings`);
      }
      if (result.networkErrors.length > 0) {
        console.log(`  ⚠️  ${result.networkErrors.length} network errors`);
      }

    } catch (error) {
      console.error(`  ❌ Failed to check ${pageInfo.name}: ${error.message}`);
      result.errors.push({
        type: 'Navigation Error',
        message: error.message,
        stack: error.stack
      });
      
      // Take error screenshot
      try {
        const screenshotName = `error-${pageInfo.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
        const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
        await this.page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = screenshotName;
      } catch (screenshotError) {
        console.error('  Failed to take screenshot:', screenshotError.message);
      }
    }

    return result;
  }

  async getPatientList() {
    console.log('🔍 Getting patient list...');
    
    try {
      // Navigate to patient list
      await this.page.goto(`${BASE_URL}/clinical/patients`, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      // Try to find patient links
      const patientLinks = await this.page.$$eval('a[href*="/clinical/workspace/"]', links => 
        links.slice(0, 3).map(link => ({
          href: link.href,
          text: link.textContent.trim()
        }))
      );

      console.log(`✅ Found ${patientLinks.length} patients`);
      return patientLinks;
    } catch (error) {
      console.error('❌ Failed to get patient list:', error.message);
      return [];
    }
  }

  async checkPatientTabs(patientInfo) {
    const results = [];
    
    for (const tab of PATIENT_TABS) {
      const tabUrl = `${patientInfo.href}?tab=${tab}`;
      const result = await this.checkPage({
        path: tabUrl.replace(BASE_URL, ''),
        name: `Patient ${patientInfo.text} - ${tab} tab`
      });
      results.push(result);
    }
    
    return results;
  }

  async checkDialogs() {
    console.log('🎭 Checking enhanced dialogs...');
    
    try {
      // Navigate to a patient workspace
      await this.page.goto(`${BASE_URL}/clinical/workspace/patient123?tab=chart-review`, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      // Try to open different dialogs
      const dialogButtons = [
        { selector: 'button:has-text("Add Condition")', name: 'Condition Dialog' },
        { selector: 'button:has-text("Add Medication")', name: 'Medication Dialog' },
        { selector: 'button:has-text("Add Allergy")', name: 'Allergy Dialog' },
        { selector: 'button:has-text("Add Immunization")', name: 'Immunization Dialog' },
        { selector: 'button:has-text("Add Procedure")', name: 'Procedure Dialog' },
        { selector: 'button:has-text("Add Observation")', name: 'Observation Dialog' },
        { selector: 'button:has-text("Create Report")', name: 'Diagnostic Report Dialog' },
        { selector: 'button:has-text("Order Service")', name: 'Service Request Dialog' }
      ];

      for (const dialogButton of dialogButtons) {
        try {
          const button = await this.page.$(dialogButton.selector);
          if (button) {
            console.log(`  🎭 Opening ${dialogButton.name}...`);
            await button.click();
            await this.page.waitForTimeout(1000);
            
            // Check for dialog errors
            const dialogErrors = await this.page.$$eval('.MuiDialog-root .MuiAlert-standardError', 
              alerts => alerts.map(alert => alert.textContent)
            );
            
            if (dialogErrors.length > 0) {
              console.log(`  ❌ ${dialogButton.name} has errors:`, dialogErrors);
            } else {
              console.log(`  ✅ ${dialogButton.name} opened successfully`);
            }
            
            // Close dialog
            const closeButton = await this.page.$('.MuiDialog-root button[aria-label="close"]');
            if (closeButton) {
              await closeButton.click();
              await this.page.waitForTimeout(500);
            }
          }
        } catch (error) {
          console.log(`  ⚠️  Could not test ${dialogButton.name}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to check dialogs:', error.message);
    }
  }

  async generateReport(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      totalPages: results.length,
      successfulPages: results.filter(r => r.success).length,
      failedPages: results.filter(r => !r.success).length,
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      totalWarnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
      totalNetworkErrors: results.reduce((sum, r) => sum + r.networkErrors.length, 0),
      averageLoadTime: results.reduce((sum, r) => sum + r.loadTime, 0) / results.length
    };

    const report = {
      summary,
      results,
      allErrors: this.errors,
      allConsoleMessages: this.consoleMessages,
      allNetworkFailures: this.networkFailures
    };

    // Save JSON report
    await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));

    // Generate console summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    console.log(`Total Pages Tested: ${summary.totalPages}`);
    console.log(`✅ Successful: ${summary.successfulPages}`);
    console.log(`❌ Failed: ${summary.failedPages}`);
    console.log(`⚠️  Total Errors: ${summary.totalErrors}`);
    console.log(`⚠️  Total Warnings: ${summary.totalWarnings}`);
    console.log(`🌐 Network Errors: ${summary.totalNetworkErrors}`);
    console.log(`⏱️  Average Load Time: ${Math.round(summary.averageLoadTime)}ms`);
    console.log(`\n📄 Full report saved to: ${REPORT_FILE}`);
    console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}/`);

    // List pages with errors
    if (summary.failedPages > 0) {
      console.log('\n❌ Pages with errors:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.name} (${r.errors.length} errors, ${r.networkErrors.length} network errors)`);
      });
    }

    return report;
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async run() {
    try {
      await this.init();
      await this.login();

      const results = [];

      // Check all main pages
      for (const pageInfo of PAGES_TO_TEST) {
        const result = await this.checkPage(pageInfo);
        results.push(result);
      }

      // Get patient list and check patient-specific pages
      const patients = await this.getPatientList();
      if (patients.length > 0) {
        console.log(`\n📋 Checking patient workspaces...`);
        for (const patient of patients) {
          const patientResults = await this.checkPatientTabs(patient);
          results.push(...patientResults);
        }
      }

      // Check dialogs
      await this.checkDialogs();

      // Generate report
      await this.generateReport(results);

    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      await this.cleanup();
    }
  }
}

// Run the test
if (require.main === module) {
  const checker = new PageErrorChecker();
  checker.run().catch(console.error);
}

module.exports = PageErrorChecker;