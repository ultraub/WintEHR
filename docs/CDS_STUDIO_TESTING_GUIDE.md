# CDS Studio End-to-End Testing Guide

**Date**: 2025-10-05
**Purpose**: Comprehensive testing guide for CDS Studio workflow
**Related Issues**: Deep review completion of CDS Studio functionality

## Overview

This guide provides a systematic approach to testing the complete CDS Studio workflow from hook creation through card display in the clinical workspace.

## Test Prerequisites

### System Requirements
- ✅ Frontend running on http://localhost:3000
- ✅ Backend running on http://localhost:8000
- ✅ User authenticated with appropriate permissions
- ✅ Test patient data loaded in system

### Browser Setup
1. Open Chrome DevTools (F12)
2. Navigate to Console tab to monitor errors
3. Navigate to Network tab to monitor API calls
4. Ensure no ad blockers or extensions interfering

## Test Workflow Phases

### Phase 1: Service Builder Access

#### Test 1.1: Navigate to CDS Studio
**Steps:**
1. Click on "CDS Studio" in main navigation
2. Verify URL changes to `/cds-studio`
3. Confirm CDS Studio page loads

**Expected Results:**
- ✅ Page loads without errors
- ✅ Three mode tabs visible: Learn, Build, Manage
- ✅ Build tab selected by default

#### Test 1.2: Builder Selection UI
**Steps:**
1. Click "New Service" or similar button to start building
2. Verify ServiceBuilderV2 selection UI appears

**Expected Results:**
- ✅ Builder selection card displays
- ✅ Two options shown: Standard Builder, Enhanced Builder
- ✅ Configuration options visible (Catalog Integration toggle, Complexity Level dropdown)
- ✅ "Start Building" button enabled

**Verification Points:**
```javascript
// Check console for ServiceBuilderV2 render
console.log('ServiceBuilderV2 showBuilderSelection:', showBuilderSelection);

// Verify state values
- builderType: 'enhanced' (default)
- complexityLevel: 'simple' (default)
- catalogIntegrationEnabled: true (default)
```

### Phase 2: Enhanced Builder Workflow

#### Test 2.1: Builder Selection
**Steps:**
1. Select "Enhanced Builder" card (should be selected by default)
2. Toggle "Enable Catalog Integration" ON
3. Select "Advanced" complexity level
4. Click "Start Building"

**Expected Results:**
- ✅ Selection UI hides
- ✅ EnhancedCDSBuilder renders with 6-step stepper
- ✅ Catalog integration controls visible
- ✅ Catalog statistics display (if available)

**Verification Points:**
```javascript
// Check console for EnhancedCDSBuilder render
console.log('EnhancedCDSBuilder props:', { catalogIntegrationEnabled, complexityLevel });

// Verify catalog stats
- Should display: Medications count
- Should display: Conditions count
- Should display: Lab Tests count
- Refresh button should work (shows spinner)
```

#### Test 2.2: Catalog Statistics Display
**Steps:**
1. Observe catalog statistics card
2. Click refresh button
3. Verify statistics update or loading indicator appears

**Expected Results:**
- ✅ Statistics card visible (not disabled with false &&)
- ✅ Three metrics displayed: Medications, Conditions, Lab Tests
- ✅ Refresh button shows spinner during load
- ✅ Fallback Alert if no statistics (graceful degradation)

**Verification Points:**
```javascript
// Check API call
GET /api/catalogs/stats
Response: {
  medications: number,
  conditions: number,
  lab_tests: number
}

// Check rendering
- All three Grid items render if data exists
- Alert shown if all values are undefined/null
- No console errors about undefined properties
```

#### Test 2.3: Step 1 - Basic Information
**Steps:**
1. Enter hook ID: `test-medication-alert`
2. Enter hook title: `Test Medication Alert`
3. Enter hook type: `medication-prescribe`
4. Enter description: `Test hook for medication alerts`
5. Click "Next"

**Expected Results:**
- ✅ All fields accept input
- ✅ Validation works (hook ID format, required fields)
- ✅ "Next" button enabled after valid input
- ✅ Advances to Step 2

#### Test 2.4: Step 2 - Hook Context
**Steps:**
1. Select "Medication Prescribe" from hook type dropdown
2. Verify prefill templates appear
3. Select "Drug Interaction Alert" template
4. Review pre-filled configuration
5. Click "Next"

**Expected Results:**
- ✅ Hook types populate from catalog
- ✅ Template dropdown shows relevant templates
- ✅ Template selection fills conditions and cards
- ✅ Advances to Step 3

#### Test 2.5: Step 3 - Conditions (Using Catalog)
**Steps:**
1. Click "Add Condition"
2. Select condition type "Medication"
3. Use catalog search to find "Warfarin"
4. Select "Warfarin" from catalog results
5. Add another condition for "Aspirin"
6. Click "Next"

**Expected Results:**
- ✅ Catalog integration service called
- ✅ Medications from catalog appear in dropdown
- ✅ Selected medication populates condition
- ✅ Multiple conditions can be added
- ✅ Advances to Step 4

**Verification Points:**
```javascript
// Check catalog service call
CatalogIntegrationService.getMedications('Warfarin')
// Should return normalized medication data

// Verify condition structure
{
  type: 'medication',
  data: { /* medication from catalog */ },
  operator: 'equals'
}
```

#### Test 2.6: Step 4 - Card Configuration
**Steps:**
1. Review default card
2. Edit card summary: `Drug Interaction: Warfarin + Aspirin`
3. Edit card detail: `Increased bleeding risk detected`
4. Select indicator: `critical`
5. Add suggestion: "Review medication regimen"
6. Add link: "Clinical Guidelines" → URL
7. Click "Next"

**Expected Results:**
- ✅ Card preview updates in real-time
- ✅ All card fields editable
- ✅ Suggestions can be added/removed
- ✅ Links can be added/removed
- ✅ Indicator affects card display color
- ✅ Advances to Step 5

#### Test 2.7: Step 5 - Review & Test
**Steps:**
1. Review complete hook configuration
2. Click "Test Hook"
3. Verify test execution
4. Review test results
5. Click "Next"

**Expected Results:**
- ✅ Full hook JSON displayed
- ✅ Test button triggers validation
- ✅ Test results show success/failure
- ✅ Can fix issues and re-test
- ✅ Advances to Step 6

#### Test 2.8: Step 6 - Save & Deploy
**Steps:**
1. Review deployment options
2. Select "Enable immediately"
3. Click "Save Service"
4. Verify success message
5. Return to Manage tab

**Expected Results:**
- ✅ Save operation succeeds
- ✅ Success notification appears
- ✅ Redirects to Manage tab
- ✅ New service visible in services list

**Verification Points:**
```javascript
// Check API call
POST /api/cds-hooks/services
Body: { /* complete hook definition */ }

// Verify hook saved
- Should have ID, title, hook type
- Should have conditions array
- Should have cards array
- Should be enabled
```

### Phase 3: Clinical Workspace Integration

#### Test 3.1: Navigate to Clinical Workspace
**Steps:**
1. Navigate to Clinical Workspace
2. Select test patient
3. Navigate to "CDS Hooks" tab

**Expected Results:**
- ✅ Patient loads successfully
- ✅ CDS Hooks tab visible
- ✅ Tab switches without errors

#### Test 3.2: Hook Execution
**Steps:**
1. Verify "Active Alerts" section
2. Check if test hook executed automatically
3. Review displayed cards

**Expected Results:**
- ✅ `patient-view` hooks execute on tab load
- ✅ Cards appear if conditions met
- ✅ No cards if conditions not met (normal behavior)

**Verification Points:**
```javascript
// Check hook execution
console.log('Executing patient-view hooks for patient:', patientId);

// Verify CDSHooksTab state
- services: array of enabled services
- cards: array of cards from hook responses
- loading: false after execution
```

#### Test 3.3: Card Display
**Steps:**
1. Locate card in Active Alerts
2. Verify card structure
3. Test card interactions

**Expected Results:**
- ✅ Card displays with correct indicator icon
- ✅ Summary text matches builder input
- ✅ Detail text matches builder input
- ✅ Service name displayed
- ✅ Timestamp displayed
- ✅ Links clickable (if added)
- ✅ Suggestions clickable (if added)

**Verification Points:**
```javascript
// Verify card structure in CDSCardDisplay
{
  summary: 'Drug Interaction: Warfarin + Aspirin',
  detail: 'Increased bleeding risk detected',
  indicator: 'critical',
  serviceName: 'Test Medication Alert',
  serviceId: 'test-medication-alert',
  timestamp: Date,
  links: [...],
  suggestions: [...]
}

// Check display behavior
- displayBehavior.position: 'top' (inline by default)
- displayBehavior.groupByService: true
- displayBehavior.allowDismiss: true
```

#### Test 3.4: Card Interactions
**Steps:**
1. Click suggestion button (if present)
2. Click link (if present)
3. Click dismiss button (X)
4. Verify card removed

**Expected Results:**
- ✅ Suggestion triggers action handler
- ✅ Link opens in new tab
- ✅ Dismiss removes card from view
- ✅ Dismissal persists during session (if configured)

#### Test 3.5: Display Behavior Settings
**Steps:**
1. Scroll to "Display Settings" section
2. Change display position to "Modal Dialog"
3. Refresh alerts
4. Verify cards display in modal

**Expected Results:**
- ✅ Settings update immediately
- ✅ Modal opens with cards
- ✅ Modal dismissible
- ✅ Other positions work (Right Sidebar, Bottom Panel)

### Phase 4: Edge Cases & Error Handling

#### Test 4.1: Empty Catalog Statistics
**Steps:**
1. Simulate empty catalog response (if possible)
2. Verify fallback Alert displays

**Expected Results:**
- ✅ No crashes or undefined errors
- ✅ Fallback Alert shows: "Catalog statistics are loading or unavailable"
- ✅ Integration still functional

#### Test 4.2: Invalid Hook Configuration
**Steps:**
1. Create hook with invalid condition
2. Attempt to save
3. Verify validation error

**Expected Results:**
- ✅ Validation prevents save
- ✅ Error message displayed
- ✅ Can fix and retry

#### Test 4.3: Service Execution Error
**Steps:**
1. Create hook that will fail (bad endpoint, etc.)
2. Execute hook in clinical workspace
3. Verify error handling

**Expected Results:**
- ✅ No application crash
- ✅ Error logged to console
- ✅ User-friendly error message
- ✅ Other services continue working

## Test Checklist Summary

### ✅ Builder Selection
- [ ] ServiceBuilderV2 selection UI displays
- [ ] Builder type selection works
- [ ] Catalog integration toggle works
- [ ] Complexity level selection works
- [ ] "Start Building" transitions to builder

### ✅ Enhanced Builder
- [ ] All 6 steps accessible
- [ ] Catalog statistics display correctly
- [ ] Catalog integration works in conditions
- [ ] Card configuration saves properly
- [ ] Hook validation works
- [ ] Save completes successfully

### ✅ Clinical Workspace
- [ ] CDS Hooks tab loads
- [ ] Hooks execute on patient-view
- [ ] Cards display correctly
- [ ] Card fields all render
- [ ] Card interactions work
- [ ] Display behavior settings work
- [ ] Dismissal works

### ✅ Error Handling
- [ ] Empty catalog gracefully handled
- [ ] Invalid hooks prevented from saving
- [ ] Service errors don't crash app
- [ ] User feedback on errors

## Known Issues & Resolutions

### Issue 1: Builder Selection Not Functional ✅ FIXED
**Resolution**: Modified ServiceBuilderV2.js to respect showBuilderSelection state

### Issue 2: Catalog Statistics Disabled ✅ FIXED
**Resolution**: Re-enabled with proper null checks in EnhancedCDSBuilder.js

### Issue 3: Card Display Issues ✅ VERIFIED
**Resolution**: Card structure matches CDSCardDisplay expectations, integration verified

## Automated Test Script

For automated testing, use this Jest/React Testing Library script:

```javascript
// tests/cds-studio-workflow.test.js
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '@/test-utils/test-utils';
import CDSHooksStudio from '@/pages/CDSHooksStudio';

describe('CDS Studio End-to-End Workflow', () => {
  it('should complete full hook creation and display workflow', async () => {
    // Render CDS Studio
    render(
      <TestProviders>
        <CDSHooksStudio />
      </TestProviders>
    );

    // Step 1: Click New Service
    const newServiceBtn = await screen.findByText(/new service/i);
    fireEvent.click(newServiceBtn);

    // Step 2: Verify builder selection
    expect(screen.getByText('Enhanced Builder')).toBeInTheDocument();
    expect(screen.getByText('Enable Catalog Integration')).toBeInTheDocument();

    // Step 3: Start building
    fireEvent.click(screen.getByText('Start Building'));

    // Step 4: Verify catalog statistics
    await waitFor(() => {
      expect(screen.getByText('Available Catalog Data')).toBeInTheDocument();
    });

    // Step 5: Fill basic info
    fireEvent.change(screen.getByLabelText(/hook id/i), {
      target: { value: 'test-hook' }
    });

    // ... continue test steps ...
  });
});
```

## Manual Testing Completion

### Tester Information
- **Tester Name**: _________________
- **Test Date**: _________________
- **Browser**: _________________
- **Test Environment**: _________________

### Test Results
- [ ] All tests passed
- [ ] Issues found (document below)
- [ ] Requires re-test

### Issues Found
| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| 1       |             |          |        |
| 2       |             |          |        |

---

**Testing Complete**: This comprehensive test plan covers the entire CDS Studio workflow from hook creation through clinical workspace card display. All code integration points have been verified and documented.
