const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false // Set to true if you don't want to see the browser
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Navigating to clinical workspace...');
    await page.goto('http://localhost:3000/patients/8c2d5e9b-0717-9616-beb9-21296a5b547d/clinical', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    
    // Wait for the page to fully load
    await page.waitForTimeout(5000);
    
    // Take full page screenshot
    console.log('Taking full page screenshot...');
    await page.screenshot({ 
      path: 'clinical-workspace-full.png',
      fullPage: true 
    });
    
    // Take viewport screenshot
    console.log('Taking viewport screenshot...');
    await page.screenshot({ 
      path: 'clinical-workspace-viewport.png'
    });
    
    // Check for elements
    console.log('Checking for UI elements...');
    
    // Check for sidebar
    const sidebar = await page.locator('[data-testid="clinical-sidebar"], .clinical-sidebar, aside, nav').first();
    if (await sidebar.isVisible()) {
      console.log('✓ Sidebar found');
      await sidebar.screenshot({ path: 'sidebar.png' });
    } else {
      console.log('✗ Sidebar not found');
    }
    
    // Check for patient header
    const patientHeader = await page.locator('[data-testid="patient-header"], .patient-header, header').first();
    if (await patientHeader.isVisible()) {
      console.log('✓ Patient header found');
      await patientHeader.screenshot({ path: 'patient-header.png' });
    } else {
      console.log('✗ Patient header not found');
    }
    
    // Check for main content area
    const mainContent = await page.locator('main, [role="main"], .main-content').first();
    if (await mainContent.isVisible()) {
      console.log('✓ Main content area found');
    } else {
      console.log('✗ Main content area not found');
    }
    
    // Check for overlapping elements
    console.log('Checking for overlapping elements...');
    
    // Look for diagnostic panel or any overlapping elements
    const diagnosticPanel = await page.locator('.diagnostic-panel, [data-testid="diagnostic-panel"]').first();
    if (await diagnosticPanel.count() > 0) {
      const isVisible = await diagnosticPanel.isVisible();
      console.log(`Diagnostic panel found: ${isVisible ? 'visible' : 'hidden'}`);
      if (isVisible) {
        await diagnosticPanel.screenshot({ path: 'diagnostic-panel.png' });
        
        // Check position
        const box = await diagnosticPanel.boundingBox();
        console.log('Diagnostic panel position:', box);
      }
    }
    
    // Check for any error messages
    const errors = await page.locator('.error, .error-message, [role="alert"]').all();
    if (errors.length > 0) {
      console.log(`Found ${errors.length} error message(s)`);
      for (let i = 0; i < errors.length; i++) {
        const text = await errors[i].textContent();
        console.log(`Error ${i + 1}: ${text}`);
      }
    }
    
    // Check z-index issues
    await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const highZIndexElements = [];
      
      elements.forEach(el => {
        const zIndex = window.getComputedStyle(el).zIndex;
        if (zIndex !== 'auto' && parseInt(zIndex) > 100) {
          highZIndexElements.push({
            tagName: el.tagName,
            className: el.className,
            zIndex: zIndex,
            text: el.textContent?.substring(0, 50)
          });
        }
      });
      
      console.log('Elements with high z-index:', highZIndexElements);
    });
    
    console.log('Screenshot capture complete!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();