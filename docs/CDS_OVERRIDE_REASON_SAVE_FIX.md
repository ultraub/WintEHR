# CDS Override Reason Save Fix

**Date**: 2025-08-01  
**Author**: AI Assistant

## Issue Summary

The user reported that checking the "Override reason required" checkbox in the CDS Studio Card Builder wasn't saving the value.

## Root Cause Analysis

1. **Two DisplayBehavior Components**: The system had two similar components:
   - `DisplayBehaviorConfig` - Used by CDSHookBuilder but lacked acknowledgment UI
   - `DisplayBehaviorConfiguration` - Had acknowledgment UI but wasn't being used

2. **Deprecated Card-Level Configuration**: The checkbox in CardBuilder sets `card.overrideReasonRequired`, which is the old approach. The system has moved to hook-level configuration.

3. **Missing Data Transformation**: The `transformToBackendFormat` function in cdsHooksService.js doesn't include card-level `overrideReasonRequired` when saving.

4. **Configuration Location Mismatch**: The system expects override requirements in `displayBehavior.acknowledgment.reasonRequired` at the hook level, not on individual cards.

## Solution Implemented

### 1. Replaced DisplayBehavior Component
```javascript
// Before
import DisplayBehaviorConfig from './DisplayBehaviorConfig';

// After  
import DisplayBehaviorConfiguration from './DisplayBehaviorConfiguration';
```

This gives users access to the acknowledgment configuration UI in the Display Behavior tab.

### 2. Deprecated Card-Level Checkbox
Updated CardBuilder to show the checkbox as deprecated with a note directing users to the Display Behavior tab:

```javascript
<FormControlLabel
  control={
    <Checkbox
      checked={card.overrideReasonRequired || false}
      onChange={(e) => handleChange('overrideReasonRequired', e.target.checked)}
      disabled
    />
  }
  label="Override reason required (Deprecated)"
/>
<Typography variant="caption" color="text.secondary" sx={{ ml: 3, display: 'block' }}>
  Note: Override requirements should now be configured at the hook level in the Display Behavior tab
</Typography>
```

## New Configuration Location

Override requirements are now configured in the Display Behavior tab:

```javascript
displayBehavior: {
  acknowledgment: {
    required: true,         // Requires acknowledgment
    reasonRequired: true    // Requires override reason
  }
}
```

## Testing

Created test script `/frontend/src/test/testOverrideReasonSave.js` to verify the fix:

```javascript
// Run in browser console
await window.testOverrideReasonSave()

// Expected output:
// ✅ SUCCESS: Override reason requirement was saved correctly!

// Clean up
await window.cleanupOverrideTest()
```

## Migration Guide

For existing hooks using card-level `overrideReasonRequired`:

1. Navigate to CDS Studio
2. Edit the hook
3. Go to Display Behavior tab
4. Enable "Require acknowledgment"
5. Enable "Require reason for override"
6. Save the hook

The system maintains backward compatibility - card-level settings are still checked as a fallback, but new configurations should use the hook-level approach.

## User Workflow

1. Create/Edit a CDS Hook in CDS Studio
2. Configure basic info, conditions, and cards
3. Navigate to **Display Behavior** tab
4. In the Acknowledgment section:
   - Toggle "Require acknowledgment" ON
   - Toggle "Require reason for override" ON
5. Save the hook

## Files Modified

1. `/frontend/src/components/clinical/workspace/cds/CDSHookBuilder.js`
   - Replaced DisplayBehaviorConfig with DisplayBehaviorConfiguration

2. `/frontend/src/components/clinical/workspace/cds/CardBuilder.js`
   - Marked card-level overrideReasonRequired as deprecated
   - Added helpful note directing to Display Behavior tab

3. `/frontend/src/test/testOverrideReasonSave.js` (New)
   - Test script to verify the fix

## Verification

The fix ensures that:
1. Users can find where to configure override requirements (Display Behavior tab)
2. The configuration is properly saved at the hook level
3. The saved configuration is correctly applied when hooks fire
4. Clear migration path from card-level to hook-level configuration

## How to Test the Fix

### Method 1: Browser Console Test
```javascript
// Run this in browser console
await window.testOverrideReasonSave()

// Expected output:
// ✅ SUCCESS: Override reason requirement was saved correctly!
// Display behavior: { acknowledgment: { required: true, reasonRequired: true }, ... }

// Clean up test hook
await window.cleanupOverrideTest()
```

### Method 2: Manual Test in CDS Studio
1. Go to CDS Studio
2. Create a new hook or edit existing one
3. Navigate to **Display Behavior** tab
4. In the Acknowledgment section:
   - Toggle **"Require acknowledgment"** ON
   - Toggle **"Require reason for override"** ON
5. Click **Save Hook**
6. Check browser console for: `[CDSHookBuilder] Saving hook with displayBehavior:`
7. The displayBehavior object should show:
   ```javascript
   {
     acknowledgment: {
       required: true,
       reasonRequired: true
     }
   }
   ```

### Method 3: Test Page (if needed)
Created a test page at `/frontend/src/test/CDSOverrideReasonTestPage.js` that provides an interactive UI to test the configuration saving.

## Backend Verification

The backend properly handles the displayBehavior field:
- Model includes `displayBehavior: Optional[Dict[str, Any]]`
- Database has `display_behavior JSONB` column
- Both INSERT and UPDATE operations save the field correctly
- Field is properly serialized/deserialized as JSON