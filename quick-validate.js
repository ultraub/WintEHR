const puppeteer = require('puppeteer');

async function quickValidate() {
  const browser = await puppeteer.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Capture console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        errors.push(text);
        console.log('Console Error:', text);
      }
    });
    
    console.log('Opening browser and navigating to http://localhost:3000...');
    
    // Try to load the page without waiting for full load
    page.goto('http://localhost:3000').catch(e => {
      console.log('Navigation error (continuing):', e.message);
    });
    
    // Wait 10 seconds to collect any errors
    console.log('Waiting 10 seconds to collect any errors...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check for fhirService errors
    const fhirServiceErrors = errors.filter(e => e.includes('fhirService'));
    const fhirClientErrors = errors.filter(e => e.includes('fhirClient') && e.includes('error'));
    
    console.log('\n=== VALIDATION RESULTS ===');
    console.log(`Total console errors: ${errors.length}`);
    console.log(`fhirService errors: ${fhirServiceErrors.length}`);
    console.log(`fhirClient errors: ${fhirClientErrors.length}`);
    
    if (fhirServiceErrors.length > 0) {
      console.log('\n❌ Found fhirService errors (migration incomplete):');
      fhirServiceErrors.forEach(e => console.log('  -', e));
    }
    
    if (errors.length === 0) {
      console.log('\n✅ No console errors detected!');
    }
    
    console.log('\nBrowser will remain open. Check the console for any issues.');
    console.log('Press Ctrl+C to exit.');
    
    await new Promise(() => {});
    
  } catch (error) {
    console.error('Error:', error.message);
    await browser.close();
  }
}

quickValidate();