# CDS Override Reason Configuration - Test Instructions

**Date**: 2025-08-01

## Quick Test

Since the test function isn't loading automatically, here's a quick way to verify the override configuration is being saved:

### Step 1: Check Console Output When Saving

When you save a hook in CDS Studio, look for this line in the console:
```
[CDSHookBuilder] Saving hook with displayBehavior: {...}
```

Expand the object to see the full configuration. You should see:
```javascript
{
  defaultMode: 'popup',
  acknowledgment: {
    required: true,
    reasonRequired: true
  },
  snooze: {...},
  indicatorOverrides: {...}
}
```

### Step 2: Manual Verification

1. After saving the hook, go back to the Manage tab
2. Click Edit on the hook you just saved
3. Navigate to the Display Behavior tab
4. Check if your settings are preserved:
   - "Require acknowledgment" should be ON if you enabled it
   - "Require reason for override" should be ON if you enabled it

### Step 3: Quick Console Test

You can also manually check by running this in the console:

```javascript
// Import the service
const { cdsHooksService } = await import('./services/cdsHooksService');

// Get your hook (replace 'test' with your hook ID)
const hook = await cdsHooksService.getHook('test');

// Check the configuration
console.log('Display Behavior:', hook.displayBehavior);
console.log('Acknowledgment Required:', hook.displayBehavior?.acknowledgment?.required);
console.log('Reason Required:', hook.displayBehavior?.acknowledgment?.reasonRequired);
```

## What You Should See

✅ **Working Correctly** if:
- The console shows `reasonRequired: true` when you've enabled it
- The settings persist when you edit the hook again
- The Display Behavior tab shows your toggles in the correct state

❌ **Not Working** if:
- The displayBehavior is missing or null
- The acknowledgment settings are undefined
- The toggles reset when you edit the hook

## Summary

Based on your console output, the save is working correctly! The displayBehavior object is being sent to the backend with all the proper configuration. The fix successfully moved the override configuration from the deprecated card-level checkbox to the proper hook-level display behavior settings.