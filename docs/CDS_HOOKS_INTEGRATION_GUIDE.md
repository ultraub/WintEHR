# CDS Hooks Integration Guide

**Document Created**: 2025-01-19  
**Purpose**: Comprehensive guide for CDS Hooks integration in WintEHR clinical workflows

## 🎯 Overview

WintEHR integrates CDS Hooks v1.0 specification to provide real-time clinical decision support at key workflow points. The system supports both built-in and custom CDS hooks with flexible presentation modes.

## 🏗️ Architecture

### Core Components

1. **CDSContext** (`contexts/CDSContext.js`)
   - Centralized CDS state management
   - Prevents duplicate hook firing
   - Manages alert lifecycle

2. **CDS Services**
   - `cdsHooksService.js` - CRUD operations for custom hooks
   - `cdsHooksClient.js` - Hook execution and service discovery
   - `clinicalCDSService.js` - Clinical workflow integration

3. **Alert Presentation**
   - `CDSAlertPresenter.js` - Unified alert display component
   - `CDSCardDisplay.js` - Card rendering with display behaviors
   - Multiple presentation modes (inline, popup, modal, sidebar, snackbar)

## 🔌 Integration Points

### 1. Patient View
Fires when opening a patient chart:
```javascript
// Automatic via CDSContext
const { alerts } = usePatientCDSAlerts(patientId);
```

### 2. Medication Prescribing
Fires during medication workflow:
```javascript
const result = await clinicalCDSService.fireMedicationHooks({
  patient,
  medications: [medicationRequest],
  operation: 'prescribe',
  user
});
```

### 3. Condition Entry
Fires when adding/editing diagnoses:
```javascript
const result = await clinicalCDSService.fireConditionHooks({
  patient,
  condition: conditionResource,
  operation: 'create', // or 'update'
  user
});
```

### 4. Order Entry
Fires when placing orders:
```javascript
const result = await clinicalCDSService.fireLabOrderHooks({
  patient,
  orders: [serviceRequest],
  user
});
```

### 5. Allergy Documentation
Fires when documenting allergies:
```javascript
const result = await clinicalCDSService.fireAllergyHooks({
  patient,
  allergy: allergyResource,
  operation: 'create',
  user
});
```

## 💡 Implementation Examples

### Basic Dialog Integration

```javascript
import CDSAlertPresenter, { ALERT_MODES } from '../cds/CDSAlertPresenter';
import { clinicalCDSService } from '../../../services/clinicalCDSService';

const MyDialog = ({ patient, onSave }) => {
  const [cdsAlerts, setCdsAlerts] = useState([]);
  
  // Fire hooks on relevant changes
  const checkCDS = async () => {
    const result = await clinicalCDSService.fireConditionHooks({
      patient,
      condition: formData,
      operation: 'create'
    });
    setCdsAlerts(result.alerts);
  };
  
  return (
    <Dialog>
      {/* Show alerts inline */}
      {cdsAlerts.length > 0 && (
        <CDSAlertPresenter
          alerts={cdsAlerts}
          mode={ALERT_MODES.INLINE}
          onAction={handleCDSAction}
          onDismiss={handleDismiss}
          requireAcknowledgment={cdsAlerts.some(a => a.indicator === 'critical')}
        />
      )}
      
      {/* Rest of dialog content */}
    </Dialog>
  );
};
```

### Alert Presentation Modes

```javascript
// 1. Inline - Shows alerts within the current view
<CDSAlertPresenter
  alerts={alerts}
  mode={ALERT_MODES.INLINE}
  maxVisible={3}
/>

// 2. Popup - Floating alerts in corner
<CDSAlertPresenter
  alerts={alerts}
  mode={ALERT_MODES.POPUP}
  position="top-right"
  autoHide={true}
  autoHideDelay={30000}
/>

// 3. Modal - Full modal dialog
<CDSAlertPresenter
  alerts={alerts}
  mode={ALERT_MODES.MODAL}
  groupByService={true}
/>

// 4. Sidebar - Slide-out panel
<CDSAlertPresenter
  alerts={alerts}
  mode={ALERT_MODES.SIDEBAR}
/>

// 5. Snackbar - Temporary notification
<CDSAlertPresenter
  alerts={alerts}
  mode={ALERT_MODES.SNACKBAR}
  autoHide={true}
/>
```

### Handling Alert Actions

```javascript
const handleCDSAction = async (action, alert) => {
  switch (action.uuid) {
    case 'adjust-dosage':
      // Navigate to dosage adjustment
      setActiveTab('dosage');
      break;
      
    case 'review-guidelines':
      // Open clinical guidelines
      window.open(action.resource?.url, '_blank');
      break;
      
    case 'find-alternative':
      // Open alternative search
      openAlternativeSearch(alert.context);
      break;
      
    default:
      // Handle custom actions
      if (action.type === 'create') {
        await createResource(action.resource);
      }
  }
};
```

## 🎨 Alert Severity Indicators

- **Critical** (Red): Requires immediate attention, may block workflow
- **Warning** (Orange): Important but non-blocking
- **Info** (Blue): Informational, no action required
- **Success** (Green): Positive confirmation

## ✅ Acknowledgment Requirements

Critical alerts may require acknowledgment before proceeding:

```javascript
<CDSAlertPresenter
  alerts={alerts}
  requireAcknowledgment={alerts.some(a => a.indicator === 'critical')}
  onAcknowledge={(alert, acknowledgment) => {
    // Record acknowledgment
    console.log(`Alert ${alert.id} acknowledged with notes: ${acknowledgment.notes}`);
  }}
/>
```

## 🔄 Alert Lifecycle

1. **Fire Hook**: Triggered by clinical action
2. **Receive Cards**: CDS service returns decision support cards
3. **Present Alerts**: Display based on severity and configuration
4. **User Action**: View, acknowledge, snooze, or dismiss
5. **Track Response**: Record user actions for audit

## 🚀 Best Practices

### 1. Prevent Alert Fatigue
- Use appropriate severity levels
- Allow snoozing non-critical alerts
- Group related alerts
- Provide clear, actionable guidance

### 2. Performance Optimization
- Cache hook results (30s default)
- Deduplicate concurrent requests
- Use progressive disclosure for details

### 3. User Experience
- Show loading states during hook execution
- Provide clear error messages
- Allow bulk actions for multiple alerts
- Remember user preferences

### 4. Clinical Safety
- Never auto-dismiss critical alerts
- Require acknowledgment for high-risk scenarios
- Log all alert interactions
- Provide escape hatches for emergencies

## 🔧 Configuration

### Hook Display Behavior

Configure how alerts are displayed per hook:

```javascript
{
  displayBehavior: {
    defaultMode: 'popup', // or 'hard-stop', 'sidebar', 'inline'
    indicatorOverrides: {
      critical: 'hard-stop',
      warning: 'popup',
      info: 'inline'
    },
    acknowledgment: {
      required: true,
      requiredFields: ['reason', 'notes']
    },
    snooze: {
      enabled: true,
      options: [15, 60, 240] // minutes
    }
  }
}
```

### Global Settings

```javascript
// In CDSContext provider
<CDSProvider
  config={{
    cacheTimeout: 30000, // 30 seconds
    maxConcurrentHooks: 5,
    defaultPresentationMode: ALERT_MODES.POPUP,
    autoGroupByService: true
  }}
>
```

## 📊 Monitoring & Analytics

Track CDS effectiveness:

```javascript
clinicalCDSService.onAlertEvent('acknowledge', (data) => {
  analytics.track('cds_alert_acknowledged', {
    alertId: data.alertId,
    severity: data.alert.indicator,
    service: data.alert.serviceId,
    timeToAcknowledge: data.acknowledgment.timestamp - data.alert.timestamp
  });
});
```

## 🧪 Testing CDS Hooks

### Test Hook Execution
```javascript
// In development, test specific scenarios
const testContext = {
  patientId: 'test-patient-123',
  userId: 'test-user-456',
  medications: [/* test medications */]
};

const result = await cdsHooksService.testHook(hookData, testContext);
```

### Mock Alerts for UI Testing
```javascript
const mockAlerts = [
  {
    id: 'test-1',
    summary: 'Drug-Drug Interaction',
    detail: 'Potential interaction between Medication A and B',
    indicator: 'warning',
    suggestions: [
      { label: 'Review Alternatives', uuid: 'review-alt' },
      { label: 'Adjust Dosage', uuid: 'adjust-dose' }
    ]
  }
];
```

## 🔒 Security Considerations

1. **Authentication**: All CDS hook calls include user context
2. **Authorization**: Hooks respect user permissions
3. **Audit Trail**: All alert interactions are logged
4. **PHI Protection**: No PHI in external hook calls
5. **Validation**: All suggestions are validated before execution

## 🚨 Troubleshooting

### Common Issues

1. **Hooks not firing**
   - Check CDSContext is properly wrapped
   - Verify services are discovered
   - Check browser console for errors

2. **Duplicate alerts**
   - Ensure single CDSProvider instance
   - Check for multiple hook fires
   - Verify deduplication is working

3. **Performance issues**
   - Enable caching
   - Reduce concurrent hooks
   - Use lazy loading for details

### Debug Mode
```javascript
// Enable CDS debugging
localStorage.setItem('cds_debug', 'true');

// View in console
cdsLogger.setLevel('debug');
```

## 📚 Additional Resources

- [CDS Hooks Specification](https://cds-hooks.org/)
- [SMART on FHIR](https://docs.smarthealthit.org/)
- [Clinical Quality Language (CQL)](https://cql.hl7.org/)
- Internal: `/docs/modules/cds-hooks/`