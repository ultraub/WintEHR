const puppeteer = require('puppeteer');

async function validateFhirMigration() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true
  });
  
  const errors = [];
  const warnings = [];
  
  try {
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Capture console messages
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      // Check for fhirService references (should not exist)
      if (text.includes('fhirService')) {
        errors.push(`Found fhirService reference: ${text}`);
      }
      
      // Check for import errors
      if (text.includes("Cannot resolve 'fhirService'") || 
          text.includes("Module not found") && text.includes('fhirService')) {
        errors.push(`Import error: ${text}`);
      }
      
      // Check for fhirClient errors
      if (text.includes('fhirClient') && type === 'error') {
        errors.push(`fhirClient error: ${text}`);
      }
      
      // Log all errors
      if (type === 'error') {
        console.error('Console Error:', text);
      }
    });
    
    // Catch page errors
    page.on('pageerror', error => {
      console.error('Page Error:', error.message);
      errors.push(`Page error: ${error.message}`);
    });
    
    // Monitor network requests
    page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('/fhir/') || url.includes('fhirService') || url.includes('fhirClient')) {
        errors.push(`Failed request: ${url} - ${request.failure().errorText}`);
      }
    });
    
    console.log('Starting validation of fhirClient migration...\n');
    
    // Navigate to the app
    console.log('1. Loading application...');
    try {
      await page.goto('http://localhost:3000', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      console.log('✓ Application loaded');
    } catch (e) {
      console.log('⚠ Application load timeout - continuing...');
    }
    
    // Wait a bit for any errors to appear
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check page source for fhirService references
    console.log('\n2. Checking for fhirService references in loaded code...');
    const pageContent = await page.content();
    const fhirServiceMatches = pageContent.match(/fhirService/g) || [];
    if (fhirServiceMatches.length > 0) {
      warnings.push(`Found ${fhirServiceMatches.length} 'fhirService' references in page content`);
    } else {
      console.log('✓ No fhirService references found in page content');
    }
    
    // Try to evaluate if fhirClient is available
    console.log('\n3. Checking fhirClient availability...');
    try {
      const hasFhirClient = await page.evaluate(() => {
        // Check if fhirClient is defined in window or any modules
        return typeof window.fhirClient !== 'undefined' || 
               document.documentElement.innerHTML.includes('fhirClient');
      });
      
      if (hasFhirClient) {
        console.log('✓ fhirClient references found');
      } else {
        warnings.push('No fhirClient references found in loaded application');
      }
    } catch (e) {
      console.log('Could not evaluate fhirClient availability');
    }
    
    // Check for specific error patterns
    console.log('\n4. Checking for migration-related errors...');
    const errorPatterns = [
      'Cannot find module.*fhirService',
      'fhirService is not defined',
      'Cannot resolve.*fhirService',
      'Module not found.*fhirService'
    ];
    
    for (const pattern of errorPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (pageContent.match(regex)) {
        errors.push(`Found error pattern: ${pattern}`);
      }
    }
    
    // Summary
    console.log('\n=== VALIDATION SUMMARY ===\n');
    
    if (errors.length === 0) {
      console.log('✅ No critical errors found!');
    } else {
      console.log(`❌ Found ${errors.length} errors:`);
      errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\n⚠️  Found ${warnings.length} warnings:`);
      warnings.forEach((warning, i) => {
        console.log(`  ${i + 1}. ${warning}`);
      });
    }
    
    console.log('\n✓ Validation complete. Browser will remain open for inspection.');
    console.log('Press Ctrl+C to exit.');
    
    // Keep browser open
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Validation error:', error.message);
    await browser.close();
    process.exit(1);
  }
}

// Run validation
validateFhirMigration().catch(console.error);