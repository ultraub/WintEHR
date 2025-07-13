# CDS Studio Testing Guide

## Overview
This guide helps you test the enhanced Lab Value condition builder in the CDS Studio Developer Tools.

## Access CDS Studio

### Option 1: Direct URL
1. Navigate to: http://localhost:3000/cds-studio
2. Login with admin/password if not already logged in

### Option 2: Via Developer Tools (if available)
1. Go to Training Center or Developer Tools section
2. Look for "CDS Hooks Studio" option

## Manual Testing Steps

### 1. Navigate to Build Mode
- Click the "Build" tab in CDS Studio
- You should see the visual builder interface

### 2. Access Conditions Section
- Click on "Conditions" in the left sidebar or section list
- You'll see a visual condition builder with categories

### 3. Add Lab Value Condition
- Look for the "Laboratory" category (orange color)
- Click on "Lab Result" 
- The enhanced Lab Value condition builder should appear

### 4. Test Lab Selection
- Click the lab test search field
- Verify you see common labs with LOINC codes:
  - Hemoglobin A1c (4548-4)
  - Creatinine (2160-0)
  - Glucose (2345-7)
- Try searching for "cholesterol" - should filter results

### 5. Test Reference Ranges
- Select "Hemoglobin A1c"
- Should see: "Normal range: 4.0 - 5.6 %"
- Should see: "Critical high: >9.0"

### 6. Test Enhanced Operators
- Click the Operator dropdown
- Verify all operators are present:
  - Greater than (>)
  - Less than (<)
  - Greater than or equal (≥)
  - Less than or equal (≤)
  - Between
  - Abnormal (any)
  - Critical
  - Trending up/down
  - Missing/Not done

### 7. Test Between Operator
- Select "Between" operator
- Should see two fields: "From" and "To"
- Both should show units (e.g., mg/dL for glucose)

### 8. Test Special Operators
- Select "Abnormal (any)" operator
- Value fields should disappear
- Only timeframe selection should remain

### 9. Test Timeframe Selection
- Check the Timeframe dropdown
- Should have options from "Last 7 days" to "Any time"

### 10. Test Trending Configuration
- Select "Trending up" operator
- Should see "Minimum number of results for trend" field
- Default should be 3

## Running Cypress Tests

### Visual Testing Mode
```bash
cd e2e-tests
npm run cypress:open
```
Then select `cds-studio-lab-value.cy.js`

### Headless Testing
```bash
cd e2e-tests
npx cypress run --spec 'cypress/e2e/working/cds-studio-lab-value.cy.js'
```

## What's Working
✅ Lab test autocomplete with LOINC codes
✅ Reference range display
✅ Enhanced operators (>, <, between, abnormal, etc.)
✅ Dynamic UI based on operator selection
✅ Timeframe selection
✅ Unit display
✅ Search functionality

## Known Issues / TODO
- Visual drag-and-drop may not be fully implemented
- Integration with actual patient data for testing
- Saving and loading conditions
- Integration with the rest of CDS Studio workflow

## Troubleshooting

### CDS Studio Not Loading
1. Check if app is running: `docker-compose ps`
2. Try direct URL: http://localhost:3000/cds-studio
3. Check browser console for errors

### Lab Value Builder Not Appearing
1. Make sure you're in Build mode
2. Click on Conditions section
3. Click on "Lab Result" in Laboratory category

### Autocomplete Not Working
1. Click directly on the search field
2. Wait a moment for options to load
3. Try typing to filter results

## Next Steps
After testing Lab Values, the next enhancements to test will be:
1. Vital Signs condition builder
2. Medical Condition builder with SNOMED/ICD codes
3. Enhanced card builder with FHIR templates
4. Display behavior configuration