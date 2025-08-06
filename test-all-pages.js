/**
 * Comprehensive Page and Dialog Test Script
 * 
 * This script tests all pages and dialogs in the WintEHR application
 * to ensure they load without errors.
 * 
 * @since 2025-01-20
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;

const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = './test-screenshots';

// All pages to test
const PAGES = [
  { path: '/', name: 'Home' },
  { path: '/login', name: 'Login' },
  { path: '/clinical', name: 'Clinical Dashboard' },
  { path: '/clinical/patients', name: 'Patient List' },
  { path: '/clinical/workspace', name: 'Clinical Workspace' },
  { path: '/pharmacy', name: 'Pharmacy Dashboard' },
  { path: '/lab', name: 'Lab Dashboard' },
  { path: '/admin', name: 'Admin Dashboard' },
  { path: '/cds', name: 'CDS Dashboard' }
];

// Patient workspace tabs
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

// Dialog buttons to test
const DIALOG_BUTTONS = [
  { selector: 'button:contains("Add Condition")', name: 'Condition Dialog' },
  { selector: 'button:contains("Add Medication")', name: 'Medication Dialog' },
  { selector: 'button:contains("Add Allergy")', name: 'Allergy Dialog' },
  { selector: 'button:contains("Add Immunization")', name: 'Immunization Dialog' },
  { selector: 'button:contains("Add Procedure")', name: 'Procedure Dialog' },
  { selector: 'button:contains("Add Observation")', name: 'Observation Dialog' },
  { selector: 'button:contains("Add Lab Result")', name: 'Lab Result Dialog' },
  { selector: 'button:contains("Create Report")', name: 'Diagnostic Report Dialog' },
  { selector: 'button:contains("Order Service")', name: 'Service Request Dialog' },
  { selector: 'button:contains("New Order")', name: 'Order Dialog' }
];

async function testAllPages() {
  console.log('🧪 Starting comprehensive page and dialog tests...\n');
  
  // Create screenshot directory
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Track errors
  const errors = [];
  const results = [];
  
  // Monitor console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        page: page.url(),
        message: msg.text(),
        type: 'console'
      });
    }
  });
  
  // Monitor page errors
  page.on('pageerror', error => {
    errors.push({
      page: page.url(),
      message: error.message,
      type: 'javascript'
    });
  });
  
  try {
    // 1. Test login
    console.log('1️⃣  Testing login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    
    // Try to login with demo credentials
    await page.type('input[name="username"]', 'demo');
    await page.type('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('✅ Login successful\n');
    
    // 2. Test all main pages
    console.log('2️⃣  Testing main pages...');
    for (const pageInfo of PAGES) {
      const startErrors = errors.length;
      
      try {
        await page.goto(`${BASE_URL}${pageInfo.path}`, { 
          waitUntil: 'networkidle0',
          timeout: 30000 
        });
        await page.waitForTimeout(2000);
        
        // Take screenshot
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`
        });
        
        const pageErrors = errors.length - startErrors;
        const status = pageErrors === 0 ? '✅' : '❌';
        console.log(`${status} ${pageInfo.name} - ${pageErrors} errors`);
        
        results.push({
          page: pageInfo.name,
          path: pageInfo.path,
          errors: pageErrors,
          success: pageErrors === 0
        });
      } catch (error) {
        console.log(`❌ ${pageInfo.name} - Failed to load: ${error.message}`);
        results.push({
          page: pageInfo.name,
          path: pageInfo.path,
          errors: 1,
          success: false,
          error: error.message
        });
      }
    }
    
    // 3. Test patient workspace tabs
    console.log('\n3️⃣  Testing patient workspace tabs...');
    
    // First, get a patient ID
    await page.goto(`${BASE_URL}/clinical/patients`, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(2000);
    
    // Click on first patient
    const patientLink = await page.$('a[href*="/clinical/workspace/"]');
    if (patientLink) {
      await patientLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      
      // Test each tab
      for (const tab of PATIENT_TABS) {
        const startErrors = errors.length;
        
        try {
          // Click on tab
          const tabButton = await page.$(`button:contains("${tab}")`);
          if (tabButton) {
            await tabButton.click();
            await page.waitForTimeout(2000);
            
            // Take screenshot
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/patient-${tab}.png`
            });
          }
          
          const tabErrors = errors.length - startErrors;
          const status = tabErrors === 0 ? '✅' : '❌';
          console.log(`${status} ${tab} tab - ${tabErrors} errors`);
          
          results.push({
            page: `Patient ${tab} tab`,
            errors: tabErrors,
            success: tabErrors === 0
          });
        } catch (error) {
          console.log(`❌ ${tab} tab - Failed: ${error.message}`);
        }
      }
    } else {
      console.log('⚠️  No patients found to test tabs');
    }
    
    // 4. Test dialogs
    console.log('\n4️⃣  Testing dialogs...');
    
    // Navigate to chart review tab where most buttons are
    const chartReviewTab = await page.$('button:contains("chart-review")');
    if (chartReviewTab) {
      await chartReviewTab.click();
      await page.waitForTimeout(2000);
    }
    
    for (const dialog of DIALOG_BUTTONS) {
      const startErrors = errors.length;
      
      try {
        // Try to find and click the button
        const button = await page.$(dialog.selector);
        if (button) {
          await button.click();
          await page.waitForTimeout(2000);
          
          // Check if dialog opened
          const dialogElement = await page.$('.MuiDialog-root');
          if (dialogElement) {
            // Take screenshot
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/dialog-${dialog.name.toLowerCase().replace(/\s+/g, '-')}.png`
            });
            
            // Close dialog
            const closeButton = await page.$('.MuiDialog-root button[aria-label="close"], .MuiDialog-root button:contains("Cancel")');
            if (closeButton) {
              await closeButton.click();
              await page.waitForTimeout(1000);
            }
          }
          
          const dialogErrors = errors.length - startErrors;
          const status = dialogErrors === 0 ? '✅' : '❌';
          console.log(`${status} ${dialog.name} - ${dialogErrors} errors`);
          
          results.push({
            page: dialog.name,
            errors: dialogErrors,
            success: dialogErrors === 0
          });
        } else {
          console.log(`⚠️  ${dialog.name} - Button not found`);
        }
      } catch (error) {
        console.log(`❌ ${dialog.name} - Failed: ${error.message}`);
      }
    }
    
    // 5. Generate report
    console.log('\n📊 Test Summary');
    console.log('================');
    
    const totalTests = results.length;
    const successfulTests = results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;
    const totalErrors = errors.length;
    
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Successful: ${successfulTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`⚠️  Total Errors: ${totalErrors}`);
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        successful: successfulTests,
        failed: failedTests,
        totalErrors
      },
      results,
      errors
    };
    
    await fs.writeFile(
      './test-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to test-report.json');
    console.log(`📸 Screenshots saved to ${SCREENSHOT_DIR}/`);
    
    // List failed pages
    if (failedTests > 0) {
      console.log('\n❌ Failed Pages:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.page} (${r.errors} errors)`);
      });
    }
    
    // List top errors
    if (errors.length > 0) {
      console.log('\n⚠️  Top Errors:');
      const errorCounts = {};
      errors.forEach(e => {
        const key = e.message.substring(0, 100);
        errorCounts[key] = (errorCounts[key] || 0) + 1;
      });
      
      Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  - ${error}... (${count} times)`);
        });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the tests
testAllPages().catch(console.error);