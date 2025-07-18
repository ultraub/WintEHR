# Frontend Data Issues Summary & Solutions

**Date**: 2025-07-18  
**Purpose**: Document and resolve data fetching and display issues in the frontend

## Issues Identified and Resolved

### 1. ✅ Repeated Requests on Results Tab

**Problem**: ResultsTab was making multiple duplicate requests:
- Separate hooks for lab observations (table view)
- Separate hooks for vital observations (table view)
- Additional hooks for chart data
- Diagnostic reports hook

**Solution**: Created `ResultsTabOptimized.js` that:
- Consolidates all data fetching into a single `fetchAllData` function
- Uses Promise.all to fetch all data types in parallel once
- Stores all data in a single state object
- Applies filters on the client side to already-fetched data
- Eliminates duplicate requests completely

### 2. ✅ MedicationRequest Active Filter Not Working

**Problem**: The search `MedicationRequest?status=active` returned 0 results despite having active medications.

**Root Cause**: Search parameters were being stored in `value_string` instead of `value_token_code` in the database.

**Solution**: Created and ran `fix_search_params_tokens.py` script that:
- Moved all token values from value_string to value_token_code
- Fixed 114 MedicationRequest status parameters
- Fixed similar issues in 40+ other resource types

**Result**: `MedicationRequest?status=active` now returns 23 results correctly.

### 3. ✅ Condition Clinical-Status Filter Not Working

**Problem**: The search `Condition?clinical-status=active` returned 0 results.

**Root Cause**: 
1. Clinical-status search parameters weren't being extracted at all
2. The extraction code exists but wasn't being called for existing data

**Solution**: The same `fix_search_params_tokens.py` script:
- Extracted clinical-status for all 201 conditions missing this parameter
- Properly indexed them as token parameters

**Result**: `Condition?clinical-status=active` now returns 58 results correctly.

### 4. 🔧 Bundle Handling and Data Display Issues

**Problem**: Some components show data (allergies) while others don't (conditions, medications) despite retrieving it.

**Root Causes Identified**:

1. **Search Parameter Mismatch in FHIRResourceContext**:
   - Line 820: Using `'clinical-status'` with values `'active,recurrence,relapse'`
   - This doesn't match FHIR's actual parameter structure

2. **Reference Format Inconsistency**:
   - Data uses both `Patient/id` and `urn:uuid:id` formats
   - ChartReviewTab filters check both formats (lines 2081-2113)
   - This is working correctly

3. **Resource Loading Strategy**:
   - fetchPatientBundle loads resources individually
   - searchResources properly sets resources in state
   - Data IS being loaded into the context

**The Real Issue**: The search filters in fetchPatientBundle are preventing data from being loaded:
```javascript
// Line 820-822
if (resourceType === 'Condition') {
  params['clinical-status'] = 'active,recurrence,relapse';  // This filter excludes resolved conditions
} else if (resourceType === 'MedicationRequest') {
  params.status = 'active,completed';  // This works but might miss stopped medications
}
```

## Recommended Fix

Update the FHIRResourceContext.js fetchPatientBundle method:

```javascript
// Remove restrictive filters or make them more inclusive
if (resourceType === 'Condition') {
  // Either remove the filter entirely to get all conditions
  // Or use: params['clinical-status'] = 'active,resolved,inactive,remission';
} else if (resourceType === 'MedicationRequest') {
  // Get all statuses to show medication history
  // Remove the status filter or use: params.status = 'active,completed,stopped,on-hold';
}
```

## Testing After Fixes

1. **Search Parameter Tests**:
   ```bash
   # Test MedicationRequest active filter
   curl "http://localhost:8000/fhir/R4/MedicationRequest?status=active"
   # ✅ Returns 23 results

   # Test Condition clinical-status filter  
   curl "http://localhost:8000/fhir/R4/Condition?clinical-status=active"
   # ✅ Returns 58 results
   ```

2. **Frontend Data Loading**:
   - Check browser console for `[FHIRResourceContext]` logs
   - Verify resources are being set in state
   - Confirm ChartReviewTab displays all resource types

## Summary

All backend search issues have been resolved. The remaining issue is that the frontend is applying overly restrictive filters when fetching data, which excludes valid resources. Removing or adjusting these filters will allow all data to be displayed properly in the ChartReviewTab and other components.