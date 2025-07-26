# CDS Hooks Implementation Guide

**Last Updated**: 2025-01-25  
**Status**: Complete with all presentation modes supported

## Overview

WintEHR implements a comprehensive CDS Hooks v2.0 system with support for multiple presentation modes, feedback tracking, and clinical decision support integration.

## Key Features

### 1. Multiple Presentation Modes

The system supports 9 different presentation modes for CDS alerts:

| Mode | Description | Use Case |
|------|-------------|----------|
| **BANNER** | Fixed top banner | Critical system-wide alerts |
| **MODAL** | Hard-stop blocking modal | Critical alerts requiring acknowledgment |
| **POPUP** | Standard modal dialog | Important alerts needing attention |
| **TOAST** | Auto-hiding notifications | Informational alerts |
| **DRAWER** | Slide-out side panel | Multiple alerts or detailed information |
| **INLINE** | Integrated with content | Context-specific alerts |
| **CARD** | Card format display | Grouped or categorical alerts |
| **COMPACT** | Icon with badge count | Space-constrained UI areas |
| **SIDEBAR** | Side panel integration | Persistent alert monitoring |

### 2. Alert Management Features

- **Dismissal**: Users can dismiss alerts with optional reason tracking
- **Snoozing**: Temporarily hide alerts for configurable durations (15 min to 24 hours)
- **Override Reasons**: Required for critical alerts with predefined reason codes
- **Persistence**: Alert states persist across sessions per patient
- **Feedback**: All interactions are tracked and sent to CDS service

### 3. Severity Levels

- **Critical** (Red): Requires immediate attention, may require override reason
- **Warning** (Orange): Important but not blocking
- **Info** (Blue): Informational alerts
- **Suggestion** (Primary): Recommendations and best practices

### 4. CDS Hook Integration

The system integrates with multiple CDS hook points:
- `patient-view`: Triggered when viewing patient records
- `medication-prescribe`: During medication ordering
- `order-sign`: When signing clinical orders
- Custom hooks supported via configuration

## Implementation Details

### Frontend Components

**CDSPresentation.js** (`/frontend/src/components/clinical/cds/CDSPresentation.js`)
- Main component for rendering CDS alerts
- Handles all presentation modes
- Manages alert state and user interactions

**CDSContext.js** (`/frontend/src/contexts/CDSContext.js`)
- Global CDS state management
- Hook execution and result caching
- Display behavior mapping

**cdsFeedbackService.js** (`/frontend/src/services/cdsFeedbackService.js`)
- Sends feedback to CDS service
- Handles acceptance/override tracking
- Bulk feedback support

### Backend Implementation

**cds_hooks_router.py** (`/backend/api/cds_hooks/cds_hooks_router.py`)
- CDS Hooks v2.0 compliant endpoints
- Feedback processing (fixed to handle array structure)
- Hook discovery and execution

## Usage Examples

### Basic Alert Display
```javascript
import CDSPresentation from './CDSPresentation';

// Inline alerts (default)
<CDSPresentation 
  alerts={cdsAlerts}
  patientId={patientId}
  onAlertAction={handleAlertAction}
/>

// Modal presentation for critical alerts
<CDSPresentation 
  alerts={criticalAlerts}
  mode="modal"
  patientId={patientId}
/>

// Toast notifications
<CDSPresentation 
  alerts={infoAlerts}
  mode="toast"
  autoHide={true}
  hideDelay={5000}
/>
```

### Alert Structure
```javascript
const alert = {
  uuid: "unique-alert-id",
  serviceId: "medication-interaction-checker",
  summary: "Drug-Drug Interaction Warning",
  detail: "Potential interaction between medications",
  indicator: "warning", // critical, warning, info
  source: {
    label: "Medication Safety Service",
    url: "https://example.com/service"
  },
  suggestions: [{
    uuid: "suggestion-1",
    label: "Use alternative medication",
    actions: [/* FHIR actions */]
  }],
  links: [{
    label: "View Details",
    url: "https://example.com/details",
    type: "absolute"
  }]
};
```

### Override Reasons

When dismissing critical alerts, users must select from predefined reasons:
- `patient-preference`: Patient preference or contraindication
- `clinical-judgment`: Clinical judgment based on patient context
- `alternative-treatment`: Alternative treatment selected
- `risk-benefit`: Risk-benefit analysis favors override
- `false-positive`: Alert appears to be false positive
- `not-applicable`: Alert not applicable to this patient
- `emergency`: Emergency situation requires override
- `other`: Other reason (requires comment)

## Configuration

### Setting Presentation Mode
```javascript
// In parent component
const [cdsMode, setCDSMode] = useState('inline');

// Change based on context
if (criticalAlert) {
  setCDSMode('modal');
} else if (multipleAlerts) {
  setCDSMode('drawer');
}
```

### Persistence Configuration
```javascript
// Alerts are automatically persisted per patient
// Dismissed alerts stored in sessionStorage
// Snoozed alerts tracked with expiration times
```

## Testing & Validation

### Test CDS Hooks
1. Navigate to a patient record
2. CDS hooks fire automatically on patient-view
3. Try different actions:
   - Dismiss an alert
   - Snooze for various durations
   - Override a critical alert
   - Accept/reject suggestions

### Verify Feedback
Check backend logs for feedback processing:
```
docker logs emr-backend | grep "CDS feedback"
```

## Troubleshooting

### 500 Error on Feedback
**Fixed**: Backend now correctly handles feedback array structure. The endpoint expects:
```json
{
  "feedback": [{
    "card": "alert-uuid",
    "outcome": "overridden",
    "overrideReason": { /* reason object */ }
  }]
}
```

### Alerts Not Showing
1. Check if alerts are dismissed (clear sessionStorage)
2. Verify CDS service is returning alerts
3. Check presentation mode configuration

### Persistence Issues
- Clear patient-specific sessionStorage keys
- Check if patientId is provided to CDSPresentation

## Best Practices

1. **Use appropriate presentation modes**:
   - Critical alerts → Modal or Banner
   - Multiple alerts → Drawer
   - Quick notifications → Toast
   - Contextual alerts → Inline

2. **Always provide patientId** for persistence to work correctly

3. **Handle alert actions** to track user behavior and improve CDS

4. **Test with real scenarios** including edge cases like network failures

## Future Enhancements

- Analytics dashboard for CDS effectiveness
- Configurable snooze durations per alert type
- Custom presentation mode templates
- Alert grouping and prioritization
- Machine learning for alert fatigue reduction