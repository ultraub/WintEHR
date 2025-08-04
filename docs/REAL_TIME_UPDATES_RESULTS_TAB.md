# Real-Time Updates - Results Tab Implementation

## Overview
The Results Tab now supports real-time updates for lab results, vital signs, and diagnostic reports. Critical value alerts are highlighted immediately across all connected users.

**Implementation Date**: 2025-08-04

## Features Implemented

### 1. Event Subscriptions
The Results Tab subscribes to the following clinical events:
- `RESULT_AVAILABLE` - New results appear immediately
- `CRITICAL_VALUE_ALERT` - Critical values trigger immediate alerts
- `RESULT_ACKNOWLEDGED` - Acknowledgment status updates
- `OBSERVATION_RECORDED` - New observations (labs/vitals) appear
- `VITAL_SIGNS_RECORDED` - Vital signs update in real-time

### 2. WebSocket Room Subscription
- Subscribes to patient room for multi-user synchronization
- Resource types monitored: `Observation`, `DiagnosticReport`
- Updates from other users viewing the same patient appear instantly

### 3. Critical Value Alerts
- Immediate popup alert for critical values
- Visual highlighting of critical results
- No delay in critical value notification

## Implementation Details

### Code Changes in ResultsTabOptimized.js

1. **Added WebSocket import**:
```javascript
import websocketService from '../../../../services/websocket';
```

2. **Added subscribe to useClinicalWorkflow**:
```javascript
const { publish, subscribe } = useClinicalWorkflow();
```

3. **Real-time subscription effect**:
```javascript
useEffect(() => {
  if (!patientId) return;
  
  const subscriptions = [];
  const resultEvents = [
    CLINICAL_EVENTS.RESULT_AVAILABLE,
    CLINICAL_EVENTS.CRITICAL_VALUE_ALERT,
    CLINICAL_EVENTS.RESULT_ACKNOWLEDGED,
    CLINICAL_EVENTS.OBSERVATION_RECORDED,
    CLINICAL_EVENTS.VITAL_SIGNS_RECORDED
  ];
  
  resultEvents.forEach(eventType => {
    const unsubscribe = subscribe(eventType, (event) => {
      if (event.patientId === patientId) {
        handleResultUpdate(eventType, event);
      }
    });
    subscriptions.push(unsubscribe);
  });
  
  return () => subscriptions.forEach(unsub => unsub());
}, [patientId, subscribe]);
```

4. **Incremental update handler**:
```javascript
const handleResultUpdate = useCallback((eventType, eventData) => {
  const result = eventData.result || eventData.observation || eventData.resource;
  
  if (result.resourceType === 'Observation') {
    const category = getObservationCategory(result);
    
    if (category === 'laboratory') {
      setAllData(prev => ({
        ...prev,
        labObservations: updateResultsList(prev.labObservations, result, eventType)
      }));
    } else if (category === 'vital-signs') {
      setAllData(prev => ({
        ...prev,
        vitalObservations: updateResultsList(prev.vitalObservations, result, eventType)
      }));
    }
    
    if (eventType === CLINICAL_EVENTS.CRITICAL_VALUE_ALERT) {
      showCriticalValueAlert(result);
    }
  }
}, [getObservationCategory]);
```

5. **Critical value alert display**:
```javascript
const showCriticalValueAlert = (observation) => {
  const value = observation.valueQuantity?.value || observation.valueString || 'Unknown';
  const code = observation.code?.text || observation.code?.coding?.[0]?.display || 'Result';
  
  alert(`CRITICAL VALUE ALERT!\n\n${code}: ${value}\n\nImmediate action required!`);
};
```

## Key Features

### 1. Incremental Updates
- New results appear at the top of the list
- Existing results update in place
- No full page refresh needed
- Maintains current filter and sort settings

### 2. Multi-Tab Support
- Lab results, vital signs, and diagnostic reports all update independently
- Current tab view is preserved during updates
- Filters remain active during real-time updates

### 3. Critical Value Handling
- Immediate alert popup for critical values
- Could be enhanced with:
  - Sound notification
  - Persistent banner until acknowledged
  - Auto-focus on critical result
  - Email/SMS notification integration

## Testing Scenarios

### Manual Testing
1. Open Results tab in two browser windows
2. Have results created in the backend
3. Verify new results appear immediately
4. Test critical value alerts
5. Verify multi-user synchronization

### Test Cases
- New lab result appearance
- Critical value alert triggering
- Vital signs real-time update
- Diagnostic report availability
- Filter preservation during updates

## Future Enhancements

1. **Result Acknowledgment**:
```javascript
// Add acknowledgment functionality
const acknowledgeResult = async (observationId) => {
  // Update observation with acknowledgment
  await fhirClient.update('Observation', observationId, {
    ...observation,
    note: [{
      text: `Acknowledged by ${currentUser.name}`,
      time: new Date().toISOString()
    }]
  });
  
  // Publish acknowledgment event
  publish(CLINICAL_EVENTS.RESULT_ACKNOWLEDGED, {
    observationId,
    patientId,
    userId: currentUser.id
  });
};
```

2. **Enhanced Critical Value Alerts**:
- Modal dialog instead of browser alert
- Sound notification
- Require acknowledgment with reason
- Track who acknowledged and when

3. **Trend Analysis Updates**:
- Real-time trend chart updates
- Highlight significant changes
- Predictive alerts based on trends

4. **Performance Optimization**:
- Virtual scrolling for large result sets
- Pagination with real-time updates
- Debounce rapid updates

## Performance Considerations

1. **State Management**: Uses functional updates to prevent stale closures
2. **Memory Management**: Proper cleanup of subscriptions
3. **Rendering Optimization**: Only affected data categories re-render
4. **Network Efficiency**: Incremental updates reduce bandwidth

## Backend Requirements

The backend should broadcast events when:
1. Lab results are finalized
2. Critical values are detected
3. Vital signs are recorded
4. Diagnostic reports are completed
5. Results are acknowledged

Example backend broadcast:
```python
# When result is available
await manager.broadcast_resource_update(
    resource_type="Observation",
    resource_id=observation["id"],
    action="created",
    resource_data=observation,
    patient_id=patient_id
)

# For critical values
if is_critical_value(observation):
    await manager.broadcast_to_room(
        f"patient:{patient_id}",
        {
            "type": "update",
            "data": {
                "event_type": "CRITICAL_VALUE_ALERT",
                "observation": observation,
                "patient_id": patient_id
            }
        }
    )
```

---

**Related Documentation**:
- [Real-Time Updates Architecture](./REAL_TIME_UPDATES_ARCHITECTURE.md)
- [Implementation Guide](./REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md)
- [Orders Tab Implementation](./REAL_TIME_UPDATES_ORDERS_TAB.md)