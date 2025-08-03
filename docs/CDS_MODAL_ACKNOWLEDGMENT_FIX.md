# CDS Modal Acknowledgment Fix

**Date**: 2025-08-01  
**Issue**: CDS modal alerts not closing after acknowledgment with reason
**Status**: Fixed

## Problem Summary

When a user acknowledged a CDS alert in modal mode that required a reason (reasonRequired: true), the acknowledgment dialog would close but the main modal dialog remained open, blocking the user interface.

## Root Cause

1. **Property Mismatch**: CDSPresentation was checking for `alert.displayBehavior?.acknowledgmentRequired` but CDSContext was setting `reasonRequired`
2. **Missing Modal Close Logic**: After acknowledging an alert, the component didn't check if all alerts were handled and close the modal

## Solution Implemented

### 1. Fixed Property Check
Changed from:
```javascript
if (alert.displayBehavior?.acknowledgmentRequired)
```

To:
```javascript
if (alert.displayBehavior?.reasonRequired)
```

### 2. Added Modal Close Logic
Added logic to both acknowledgment paths to check if all alerts have been handled and close the modal:

```javascript
// Check if all alerts have been dismissed
const remainingAlerts = alerts.filter(alert => {
  const alertId = alert.uuid || alert.id || `${alert.serviceId}-${alert.summary}`;
  return !dismissedAlerts.has(alertId) && !isAlertSnoozed(alert);
});

// Close the modal if no alerts remain
if (remainingAlerts.length === 0) {
  setOpen(false);
}
```

## Files Modified

1. `/frontend/src/components/clinical/cds/CDSPresentation.js`
   - Fixed property check from `acknowledgmentRequired` to `reasonRequired`
   - Added modal close logic in `handleAcknowledge` function
   - Added modal close logic in `handleConfirmAcknowledgment` function

## Testing Instructions

1. Create a CDS hook with modal display and reason required:
   - Set Display Behavior → Default Mode to "Modal"
   - Enable "Require acknowledgment"
   - Enable "Require reason for override"

2. Trigger the alert in the clinical workspace

3. Click "Acknowledge & Continue" button

4. Enter a reason in the dialog

5. Click "Confirm Override"

6. Verify that both the acknowledgment dialog AND the main modal close

## Related Components

- **CDSContext**: Sets `displayBehavior` with `reasonRequired` property
- **CDSPresentation**: Handles modal display and acknowledgment flow
- **CDSAlertPresenter**: Alternative alert presenter (not used in main flow but updated for consistency)

## Notes

- The fix ensures modal alerts properly close after acknowledgment
- Works for both reason-required and non-reason-required acknowledgments
- Maintains persistence of dismissed alerts for the session