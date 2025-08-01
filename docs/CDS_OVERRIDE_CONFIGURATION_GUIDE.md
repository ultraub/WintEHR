# CDS Override Configuration Guide

**Date**: 2025-08-01  
**Version**: 1.0

## Overview

This guide documents the standardized approach for configuring override requirements in CDS hooks. The system supports both simple acknowledgments and full override reasons across all presentation modes.

## Configuration Structure

Override requirements are configured at the hook level using the `displayBehavior.acknowledgment` object:

```javascript
displayBehavior: {
  defaultMode: 'popup',  // or 'modal', 'inline', 'banner', etc.
  acknowledgment: {
    required: boolean,      // Whether any acknowledgment is required
    reasonRequired: boolean // Whether a reason must be provided
  }
}
```

## Configuration Options

### 1. No Override Required (Default)
Users can dismiss alerts without any acknowledgment.

```javascript
displayBehavior: {
  acknowledgment: {
    required: false,
    reasonRequired: false  // Ignored when required is false
  }
}
```

### 2. Simple Acknowledgment
Users must acknowledge the alert but don't need to provide a reason.

```javascript
displayBehavior: {
  acknowledgment: {
    required: true,
    reasonRequired: false
  }
}
```

**User Experience:**
- Dialog shows "Acknowledge Alert" title
- No reason fields displayed
- Single "Acknowledge" button
- Alert dismissed with "Acknowledged" status

### 3. Acknowledgment with Reason
Users must provide a reason for overriding the alert.

```javascript
displayBehavior: {
  acknowledgment: {
    required: true,
    reasonRequired: true
  }
}
```

**User Experience:**
- Dialog shows "Override Clinical Alert" title
- Reason dropdown with predefined options
- Optional comment field (required for "Other")
- "Override Alert" button
- Alert dismissed with reason details

## Presentation Mode Support

All presentation modes support override configurations:

| Mode | Override Support | Notes |
|------|------------------|-------|
| `inline` | ✅ Full support | Shows within page content |
| `popup` | ✅ Full support | Non-blocking dialog |
| `modal` | ✅ Full support | Hard-stop, cannot close without action |
| `banner` | ✅ Full support | Top of page alerts |
| `toast` | ✅ Full support | Temporary notifications |
| `drawer` | ✅ Full support | Side panel |
| `compact` | ✅ Full support | Icon with badge |

## Severity-Based Configuration

You can vary override requirements based on alert severity using indicator overrides:

```javascript
displayBehavior: {
  defaultMode: 'inline',
  indicatorOverrides: {
    critical: 'modal',    // Critical alerts show as modal
    warning: 'popup',     // Warnings show as popup
    info: 'inline'        // Info shows inline
  },
  acknowledgment: {
    required: true,       // Applies to all severities
    reasonRequired: true  // Can be customized per indicator in future
  }
}
```

## Override Reasons

The system provides predefined override reasons:

| Code | Display | Description |
|------|---------|-------------|
| `patient-preference` | Patient preference or contraindication | Patient-specific reasons |
| `clinical-judgment` | Clinical judgment based on patient context | Provider discretion |
| `alternative-treatment` | Alternative treatment selected | Different approach chosen |
| `risk-benefit` | Risk-benefit analysis favors override | Calculated decision |
| `false-positive` | Alert appears to be false positive | Alert not applicable |
| `not-applicable` | Alert not applicable to this patient | Patient exception |
| `emergency` | Emergency situation requires override | Time-critical |
| `other` | Other reason (see comments) | Requires comment |

## Implementation Details

### Frontend Processing

1. **Alert Enhancement** (CDSContext.js):
   ```javascript
   displayBehavior: {
     presentationMode,
     acknowledgmentRequired,
     reasonRequired,
     snoozeEnabled
   }
   ```

2. **Override Checking** (CDSPresentation.js):
   ```javascript
   const requiresAcknowledgment = alert.displayBehavior?.acknowledgmentRequired || false;
   const requiresReason = alert.displayBehavior?.reasonRequired || false;
   ```

3. **UI Adaptation**:
   - Dialog title changes based on requirements
   - Reason fields shown/hidden conditionally
   - Button text adapts ("Acknowledge" vs "Override Alert")
   - Validation ensures required fields are filled

### Backend Storage

The display behavior configuration is stored as part of the hook configuration:

```python
class HookConfiguration(BaseModel):
    displayBehavior: Optional[Dict[str, Any]] = Field(None, description="Display behavior configuration")
```

## Testing Override Scenarios

Use the test configurations in `TestOverrideScenarios.js`:

```javascript
// Create all test scenarios
window.createAllTestOverrideHooks()

// Test each scenario:
// 1. Navigate to a patient matching the conditions
// 2. Observe the alert presentation
// 3. Try to dismiss without meeting requirements
// 4. Complete the required acknowledgment/reason
// 5. Verify proper dismissal and feedback

// Clean up
window.deleteAllTestOverrideHooks()
```

## Best Practices

1. **Match Severity to Requirements**:
   - Critical alerts → Require reason
   - Warnings → Simple acknowledgment
   - Info → No requirements

2. **Use Modal for Critical Alerts**:
   ```javascript
   indicatorOverrides: {
     critical: 'modal'  // Forces user attention
   }
   ```

3. **Provide Clear Messaging**:
   - Use descriptive alert summaries
   - Explain why override might be needed
   - Guide users to safe decisions

4. **Consider Workflow Impact**:
   - Too many overrides frustrate users
   - Balance safety with efficiency
   - Monitor override patterns

## Migration from Card-Level Configuration

If you have existing hooks using card-level `overrideReasonRequired`:

1. The system maintains backward compatibility
2. Card-level settings are checked as fallback
3. Migrate to hook-level configuration for consistency:

```javascript
// Old (card-level)
cards: [{
  overrideReasonRequired: true,
  // ...
}]

// New (hook-level)
displayBehavior: {
  acknowledgment: {
    required: true,
    reasonRequired: true
  }
}
```

## Feedback Integration

Override actions generate appropriate feedback:

- **Acknowledged**: Simple acknowledgment without reason
- **Overridden**: Acknowledgment with reason provided
- Feedback includes reason codes and user comments
- All feedback is sent to the CDS service for tracking

## Future Enhancements

Potential improvements for consideration:

1. Per-indicator reason requirements
2. Custom reason lists per hook
3. Role-based override permissions
4. Time-limited override validity
5. Audit trail visualization