const puppeteer = require('puppeteer');
const path = require('path');

async function captureUIState() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport to standard desktop size
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('Navigating to clinical demo page...');
    
    // Add console logging
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
        consoleMessages.push(msg.text());
      }
    });
    
    // Add response monitoring
    page.on('response', response => {
      if (!response.ok() && !response.url().includes('favicon')) {
        console.log(`Failed request: ${response.status()} ${response.url()}`);
      }
    });
    
    try {
      await page.goto('http://localhost:3000/clinical-demo/8c2d5e9b-0717-9616-beb9-21296a5b547d', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
    } catch (navError) {
      console.log('Navigation error, trying alternate approach...');
      // Try navigating to home first
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 1000));
      await page.goto('http://localhost:3000/clinical-demo/8c2d5e9b-0717-9616-beb9-21296a5b547d', {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });
    }
    
    // Wait a bit for any animations/transitions
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take initial screenshot
    console.log('Taking initial screenshot...');
    await page.screenshot({ 
      path: path.join(__dirname, 'screenshots', 'clinical-demo-initial.png'),
      fullPage: true 
    });
    
    // Look for and describe visible elements
    console.log('\nChecking for UI elements...');
    
    // Check for demo warning banner
    const warningBanner = await page.$('div[role="alert"]');
    if (warningBanner) {
      const warningText = await page.evaluate(el => el.textContent, warningBanner);
      console.log('✓ Demo warning banner found:', warningText);
    } else {
      console.log('✗ Demo warning banner not found');
    }
    
    // Check for sidebar
    const sidebar = await page.$('[data-testid="sidebar"], nav, aside');
    if (sidebar) {
      console.log('✓ Sidebar found');
      
      // Try to find and click menu button
      const menuButton = await page.$('[aria-label*="menu"], [data-testid*="menu"], button[class*="menu"]');
      if (menuButton) {
        console.log('  - Found menu button, clicking...');
        await menuButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await page.screenshot({ 
          path: path.join(__dirname, 'screenshots', 'clinical-demo-menu-clicked.png'),
          fullPage: true 
        });
      }
    } else {
      console.log('✗ Sidebar not found');
    }
    
    // Check for patient header
    const patientHeader = await page.$('[data-testid*="patient"], [class*="patient-header"], [class*="PatientHeader"]');
    if (patientHeader) {
      console.log('✓ Patient header found');
    } else {
      console.log('✗ Patient header not found');
    }
    
    // Check for tabs
    const tabs = await page.$$('[role="tab"], [data-testid*="tab"]');
    console.log(`✓ Found ${tabs.length} tabs`);
    
    // Check for main content area
    const mainContent = await page.$('main, [role="main"], [data-testid*="content"]');
    if (mainContent) {
      console.log('✓ Main content area found');
    } else {
      console.log('✗ Main content area not found');
    }
    
    // Console messages are already being collected above
    
    // Try clicking on different tabs if they exist
    if (tabs.length > 0) {
      console.log('\nTrying to click on tabs...');
      for (let i = 0; i < Math.min(3, tabs.length); i++) {
        try {
          await tabs[i].click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          const tabText = await page.evaluate(el => el.textContent, tabs[i]);
          console.log(`  - Clicked tab ${i + 1}: ${tabText}`);
          await page.screenshot({ 
            path: path.join(__dirname, 'screenshots', `clinical-demo-tab-${i + 1}.png`),
            fullPage: true 
          });
        } catch (err) {
          console.log(`  - Failed to click tab ${i + 1}:`, err.message);
        }
      }
    }
    
    // Final summary
    console.log('\n=== UI State Summary ===');
    console.log('Screenshots saved to scripts/screenshots/');
    if (consoleMessages.length > 0) {
      console.log('\nConsole errors detected:');
      consoleMessages.forEach(msg => console.log('  -', msg));
    }
    
  } catch (error) {
    console.error('Error capturing UI state:', error);
  } finally {
    await browser.close();
  }
}

// Create screenshots directory if it doesn't exist
const fs = require('fs');
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Run the capture
captureUIState().catch(console.error);