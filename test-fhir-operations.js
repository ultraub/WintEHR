const puppeteer = require('puppeteer');

async function testFhirOperations() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Track API calls
    const apiCalls = [];
    
    page.on('response', response => {
      const url = response.url();
      const status = response.status();
      
      if (url.includes('/fhir/') || url.includes('/api/')) {
        apiCalls.push({
          url: url.replace('http://localhost:8000', ''),
          status,
          method: response.request().method()
        });
      }
    });
    
    console.log('Testing FHIR Operations...\n');
    
    // Navigate to app
    console.log('1. Loading application...');
    await page.goto('http://localhost:3000/login', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Login
    console.log('2. Logging in...');
    await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 5000 });
    await page.type('input[name="username"], input[type="text"]', 'demo');
    await page.type('input[name="password"], input[type="password"]', 'password');
    
    // Click login button
    await page.click('button[type="submit"]');
    
    // Wait for navigation
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
      console.log('Navigation timeout - continuing...');
    }
    
    // Wait for patient list or dashboard
    console.log('3. Waiting for dashboard...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check API calls
    console.log('\n=== FHIR API CALLS ===\n');
    
    const fhirCalls = apiCalls.filter(call => call.url.includes('/fhir/'));
    const successfulCalls = fhirCalls.filter(call => call.status >= 200 && call.status < 300);
    const failedCalls = fhirCalls.filter(call => call.status >= 400);
    
    console.log(`Total FHIR API calls: ${fhirCalls.length}`);
    console.log(`Successful calls: ${successfulCalls.length}`);
    console.log(`Failed calls: ${failedCalls.length}`);
    
    if (fhirCalls.length > 0) {
      console.log('\nRecent FHIR calls:');
      fhirCalls.slice(-10).forEach(call => {
        const status = call.status < 300 ? '✓' : '✗';
        console.log(`  ${status} ${call.method} ${call.url} (${call.status})`);
      });
    }
    
    if (failedCalls.length > 0) {
      console.log('\n❌ Failed FHIR calls:');
      failedCalls.forEach(call => {
        console.log(`  ${call.method} ${call.url} (${call.status})`);
      });
    }
    
    // Test specific FHIR operation
    console.log('\n4. Testing direct FHIR search...');
    const searchResult = await page.evaluate(async () => {
      try {
        // Try to access fhirClient from the page context
        const response = await fetch('/api/fhir/R4/Patient?_count=5', {
          headers: {
            'Accept': 'application/fhir+json',
            'Content-Type': 'application/fhir+json'
          }
        });
        
        if (!response.ok) {
          return { error: `HTTP ${response.status}: ${response.statusText}` };
        }
        
        const data = await response.json();
        return { 
          success: true, 
          total: data.total || 0,
          hasEntries: !!(data.entry && data.entry.length > 0)
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    if (searchResult.success) {
      console.log(`✓ FHIR search successful - found ${searchResult.total} patients`);
    } else {
      console.log(`✗ FHIR search failed: ${searchResult.error}`);
    }
    
    console.log('\n✓ Test complete. Browser will remain open.');
    console.log('Press Ctrl+C to exit.');
    
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Test error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

testFhirOperations().catch(console.error);