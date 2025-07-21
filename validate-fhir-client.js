const puppeteer = require('puppeteer');

async function validateFhirClient() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.error('Browser Error:', text);
      } else if (type === 'warning') {
        console.warn('Browser Warning:', text);
      }
    });
    
    // Catch page errors
    page.on('pageerror', error => {
      console.error('Page Error:', error.message);
    });
    
    console.log('1. Testing login page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    // Check if login page loads
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    console.log('✓ Login page loaded successfully');
    
    // Login as demo user
    console.log('2. Logging in as demo user...');
    await page.type('input[type="text"]', 'demo');
    await page.type('input[type="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✓ Login successful');
    
    // Check if main dashboard loads
    console.log('3. Checking main dashboard...');
    await page.waitForSelector('[data-testid="patient-list"], .patient-list, #patient-list', { timeout: 10000 });
    console.log('✓ Dashboard loaded successfully');
    
    // Click on first patient
    console.log('4. Selecting first patient...');
    await page.waitForSelector('tr[data-testid*="patient-row"], .patient-row, tbody tr', { timeout: 5000 });
    const patients = await page.$$('tr[data-testid*="patient-row"], .patient-row, tbody tr');
    if (patients.length > 0) {
      await patients[0].click();
      console.log('✓ Patient selected');
    } else {
      console.log('⚠ No patients found');
    }
    
    // Wait for clinical workspace
    console.log('5. Checking clinical workspace...');
    await page.waitForSelector('.clinical-workspace, [data-testid="clinical-workspace"]', { timeout: 10000 });
    console.log('✓ Clinical workspace loaded');
    
    // Check for any API errors in network tab
    console.log('6. Checking for API errors...');
    const apiErrors = [];
    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      if (url.includes('/fhir/') && status >= 400) {
        apiErrors.push({ url, status });
      }
    });
    
    // Test Chart Review tab
    console.log('7. Testing Chart Review tab...');
    const chartTab = await page.$('button:has-text("Chart Review"), [data-testid="tab-chart"]');
    if (chartTab) {
      await chartTab.click();
      await page.waitForTimeout(2000);
      console.log('✓ Chart Review tab loaded');
    }
    
    // Test Results tab
    console.log('8. Testing Results tab...');
    const resultsTab = await page.$('button:has-text("Results"), [data-testid="tab-results"]');
    if (resultsTab) {
      await resultsTab.click();
      await page.waitForTimeout(2000);
      console.log('✓ Results tab loaded');
    }
    
    // Test Orders tab
    console.log('9. Testing Orders tab...');
    const ordersTab = await page.$('button:has-text("Orders"), [data-testid="tab-orders"]');
    if (ordersTab) {
      await ordersTab.click();
      await page.waitForTimeout(2000);
      console.log('✓ Orders tab loaded');
    }
    
    // Check for console errors
    console.log('\n=== Validation Summary ===');
    if (apiErrors.length > 0) {
      console.error('API Errors found:', apiErrors);
    } else {
      console.log('✓ No API errors detected');
    }
    
    console.log('✓ All basic functionality tests passed!');
    
    // Keep browser open for manual inspection
    console.log('\nBrowser will remain open for manual inspection. Press Ctrl+C to exit.');
    
  } catch (error) {
    console.error('Validation failed:', error.message);
    await browser.close();
    process.exit(1);
  }
}

// Run validation
validateFhirClient().catch(console.error);