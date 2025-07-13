# Running Lab Value Condition Builder Tests

## Quick Start

1. **Open Terminal** and navigate to the e2e-tests directory:
```bash
cd "/Users/robertbarrett/Library/Mobile Documents/com~apple~CloudDocs/dev/MedGenEMR/e2e-tests"
```

2. **Run the visual test**:
```bash
npm run cypress:open
```

3. **In Cypress Test Runner**:
   - Click on `cds-builder-lab-value.cy.js` in the working folder
   - Watch the tests execute
   - Use the test selector to run individual tests

## Alternative: Run specific test file
```bash
npx cypress open --spec 'cypress/e2e/working/cds-builder-lab-value.cy.js'
```

## What to Look For

The test will:
1. Navigate to `/cds-hooks`
2. Click "Create New Hook"
3. Fill in basic information
4. Navigate to conditions
5. Add a Lab Value condition
6. Test various features:
   - Lab test autocomplete
   - Reference range display
   - Enhanced operators
   - Between value fields
   - Timeframe selection
   - Trending options

## Debugging Tips

If tests fail:
1. Check if the application is running at http://localhost:3000
2. Verify you can manually access http://localhost:3000/cds-hooks
3. Look for any console errors in the browser
4. Use Cypress's time-travel debugging to see what went wrong

## Manual Testing

You can also test manually:
1. Go to http://localhost:3000/login
2. Login as admin/password
3. Navigate to http://localhost:3000/cds-hooks
4. Click "Create New Hook"
5. Test the Lab Value condition builder features