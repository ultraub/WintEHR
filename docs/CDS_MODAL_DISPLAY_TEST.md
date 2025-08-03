# CDS Modal Display Configuration Test

**Date**: 2025-08-01  
**Issue**: Modal display mode not being saved/displayed correctly
**Status**: Fixed - Added field filtering and format updates

## Problem Summary

When setting a CDS hook to use "Modal" presentation mode in the Display Behavior tab, the configuration may not be saving or displaying correctly.

## Solution Implemented

1. **Fixed DisplayBehavior Format**: Updated CDSHookBuilder to use the new displayBehavior format:
   - Changed from old format: `displayMode`, `position`, `maxCards`
   - To new format: `defaultMode`, `indicatorOverrides`, `acknowledgment`

2. **Test Utilities**: Created test functions to verify modal configuration

## How to Test

### Method 1: Console Test (After Page Refresh)

After refreshing the page, you should see in the console:
```
[CDS Tests] Available test functions:
- window.testModalDisplay()
- window.checkHookDisplay(hookId)
```

Then run:
```javascript
// Test modal configuration save
await window.testModalDisplay()

// Check your existing hook
await window.checkHookDisplay('test')
```

### Method 2: Manual Test in CDS Studio

1. Create or edit a hook
2. Go to **Display Behavior** tab
3. Set **Default Presentation Mode** to **"Modal"**
4. For **Severity-based Presentation**:
   - Set Critical to "Modal"
   - Set Warning to "Modal" or "Popup"
   - Set Info to "Inline" or "Popup"
5. Save the hook
6. Check console for: `[CDSHookBuilder] Saving hook with displayBehavior:`
7. The object should show:
   ```javascript
   {
     defaultMode: 'modal',
     indicatorOverrides: {
       critical: 'modal',
       warning: 'modal',
       info: 'inline'
     },
     ...
   }
   ```

### Method 3: Comprehensive Debug Test

Run the comprehensive debug test to check the entire save/load cycle:

```javascript
// Run the full debug flow
await window.debugDisplayBehaviorFlow()

// This will:
// 1. Create/update a test hook with modal settings
// 2. Retrieve it back from the server
// 3. Compare sent vs received data
// 4. Check raw API response
// 5. Show detailed results with ✅/❌ indicators

// Clean up after testing
await window.cleanupDisplayBehaviorTest()
```

### Method 4: Verify in Clinical Workspace

1. Navigate to a patient that matches your hook conditions
2. The CDS alert should appear as a modal dialog that:
   - Blocks interaction with the rest of the page
   - Requires acknowledgment before dismissing
   - Cannot be closed by clicking outside

## What Was Fixed

### Issue 1: Wrong DisplayBehavior Format
The CDSHookBuilder was using the old displayBehavior format instead of the new CDS Hooks v2.0 format.

**Before (Old Format):**
```javascript
displayBehavior: {
  displayMode: 'immediate',
  position: 'top',
  maxCards: 10,
  priority: 'critical-first'
}
```

**After (New Format):**
```javascript
displayBehavior: {
  defaultMode: 'modal',  // or 'popup', 'inline', etc.
  indicatorOverrides: {
    critical: 'modal',
    warning: 'popup',
    info: 'inline'
  },
  acknowledgment: {
    required: true,
    reasonRequired: false
  },
  snooze: {
    enabled: true,
    defaultDuration: 60
  }
}
```

### Issue 2: Field Contamination
The DisplayBehaviorConfiguration component was spreading the config object, which could mix old and new format fields.

**Fix Applied:**
- Added field filtering in DisplayBehaviorConfiguration to only pass valid fields
- Added cleaning logic in CDSHookBuilder.saveHook() to ensure only valid displayBehavior fields are sent
- Updated initial state and edit state initialization to use new format

### Issue 3: Override Reason Configuration
The override reason checkbox at the card level was deprecated. Configuration moved to hook level under `displayBehavior.acknowledgment.reasonRequired`.

## Troubleshooting

If the modal is still not displaying:

1. **Check the saved configuration**:
   ```javascript
   const { cdsHooksService } = await import('./services/cdsHooksService');
   const hook = await cdsHooksService.getHook('your-hook-id');
   console.log('Display behavior:', hook.displayBehavior);
   ```

2. **Verify the hook is enabled**:
   - Check that `enabled: true` in the hook configuration
   - Check that the conditions match the current patient

3. **Check CDSContext mapping**:
   - The system maps display modes to presentation modes
   - `modal` → `PRESENTATION_MODES.MODAL`
   - This happens in CDSContext.js when processing alerts

4. **Clear browser cache**:
   - Sometimes old configurations are cached
   - Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## Expected Behavior

When properly configured:
1. CDS alerts with `defaultMode: 'modal'` or critical severity will show as blocking modal dialogs
2. Users cannot interact with the page until they acknowledge the alert
3. If acknowledgment is required, they must click the acknowledge button
4. If reason is required, they must also provide a reason for override