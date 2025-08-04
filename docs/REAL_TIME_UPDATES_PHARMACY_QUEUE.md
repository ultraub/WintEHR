# Real-Time Updates - Pharmacy Queue Implementation

## Overview
The Pharmacy Queue now supports real-time updates for medication workflows, enabling all pharmacy staff to see prescription changes instantly across all connected clients.

**Implementation Date**: 2025-08-04

## Features Implemented

### 1. Event Subscriptions
The Pharmacy Queue subscribes to the following clinical events:
- `MEDICATION_PRESCRIBED` - New prescriptions appear immediately
- `PRESCRIPTION_VERIFIED` - Verification status updates in real-time
- `MEDICATION_DISPENSED` - Dispensed medications update status
- `ORDER_PLACED` - New medication orders (filtered for medication category)

### 2. WebSocket Room Subscription
- **Pharmacy Room**: `pharmacy:queue` - All pharmacy staff subscribe to this room
- Unlike patient rooms, pharmacy room broadcasts to ALL pharmacy users
- Updates appear regardless of which patient the pharmacist is viewing
- Enables true multi-user collaboration in the pharmacy

### 3. Incremental State Updates
- New prescriptions appear at the top of the queue
- Status updates move prescriptions between columns instantly
- No full page refresh needed
- Notifications appear for important events

## Implementation Details

### Code Changes in PharmacyPage.js

1. **Added WebSocket and event imports**:
```javascript
import websocketService from '../services/websocket';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';
```

2. **Added snackbar state for notifications**:
```javascript
const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
```

3. **Pharmacy event subscriptions**:
```javascript
useEffect(() => {
  const pharmacyEvents = [
    CLINICAL_EVENTS.MEDICATION_PRESCRIBED,
    CLINICAL_EVENTS.PRESCRIPTION_VERIFIED,
    CLINICAL_EVENTS.MEDICATION_DISPENSED,
    CLINICAL_EVENTS.ORDER_PLACED
  ];

  pharmacyEvents.forEach(eventType => {
    const unsubscribe = subscribe(eventType, (event) => {
      if (eventType === CLINICAL_EVENTS.ORDER_PLACED && event.category !== 'medication') {
        return;
      }
      handlePharmacyUpdate(eventType, event);
    });
    subscriptions.push(unsubscribe);
  });
}, [subscribe, handleRefresh, handlePharmacyUpdate]);
```

4. **Pharmacy room WebSocket subscription**:
```javascript
useEffect(() => {
  if (!websocketService.isConnected) return;
  
  let subscriptionId = null;
  const setupPharmacySubscription = async () => {
    subscriptionId = await websocketService.subscribeToRoom('pharmacy:queue');
  };
  
  setupPharmacySubscription();
  
  return () => {
    if (subscriptionId) {
      websocketService.unsubscribeFromRoom(subscriptionId);
    }
  };
}, []);
```

5. **Incremental update handler**:
```javascript
const handlePharmacyUpdate = useCallback((eventType, eventData) => {
  const medicationRequest = eventData.medication || eventData.prescription || eventData.resource;
  
  switch (eventType) {
    case CLINICAL_EVENTS.MEDICATION_PRESCRIBED:
      // Add new prescription to queue
      setMedicationRequests(prev => {
        const exists = prev.some(req => req.id === medicationRequest.id);
        if (!exists) {
          setSnackbar({
            open: true,
            message: `New prescription: ${medicationRequest.medicationCodeableConcept?.text}`,
            severity: 'info'
          });
          return [medicationRequest, ...prev];
        }
        return prev;
      });
      break;
      
    case CLINICAL_EVENTS.PRESCRIPTION_VERIFIED:
      // Update status
      setMedicationRequests(prev => 
        prev.map(req => req.id === medicationRequest.id ? medicationRequest : req)
      );
      break;
  }
}, [handleRefresh]);
```

### Code Changes in websocket.js

Added room subscription methods:
```javascript
async subscribeToRoom(roomName) {
  const subscriptionId = `room-${roomName}-${Date.now()}`;
  const message = {
    type: 'subscription',
    data: {
      subscription_id: subscriptionId,
      room: roomName
    }
  };
  
  this.send(message);
  this.activeSubscriptions.set(subscriptionId, { room: roomName });
  return subscriptionId;
}

async unsubscribeFromRoom(subscriptionId) {
  const message = {
    type: 'unsubscribe',
    data: { subscription_id: subscriptionId }
  };
  
  this.send(message);
  this.activeSubscriptions.delete(subscriptionId);
}
```

## Key Features

### 1. Multi-User Collaboration
- All pharmacy staff see the same queue in real-time
- Status changes propagate instantly to all users
- No conflicts when multiple pharmacists work on different prescriptions
- Visual notifications for new prescriptions

### 2. Queue Column Transitions
- Prescriptions automatically move between columns based on status
- Visual feedback when prescriptions move
- Column counts update in real-time

### 3. Notification System
- Snackbar notifications for important events
- Different severity levels (info, success, warning, error)
- Auto-dismiss after 4 seconds
- Non-intrusive placement

## Testing Scenarios

### Manual Testing
1. Open Pharmacy Queue in multiple browser windows
2. Create a prescription from the Orders tab
3. Verify it appears in all pharmacy windows immediately
4. Change prescription status in one window
5. Verify status updates in all windows

### Test Cases
- New prescription notification across all pharmacy clients
- Status transitions between queue columns
- Multiple pharmacists working simultaneously
- Queue statistics updating in real-time
- Filter preservation during updates

## Future Enhancements

1. **Enhanced Notifications**:
```javascript
// Add sound notifications for STAT orders
if (priority === 'STAT') {
  playNotificationSound();
  setSnackbar({
    severity: 'error',
    message: 'STAT prescription received!'
  });
}
```

2. **User Presence**:
- Show which pharmacist is working on each prescription
- Lock prescriptions being actively worked on
- Show "typing" indicators

3. **Queue Analytics Real-Time Updates**:
- Live metrics dashboard
- Performance tracking
- Workload distribution

4. **Advanced Filtering**:
- Maintain filters during real-time updates
- Personal work queues
- Priority-based auto-assignment

## Backend Requirements

The backend should broadcast events to the pharmacy room when:
1. New prescriptions are created
2. Prescription status changes
3. Medications are dispensed
4. Prescriptions are verified

Example backend broadcast:
```python
# When prescription is created
await manager.broadcast_to_room(
    "pharmacy:queue",
    {
        "type": "update",
        "data": {
            "event_type": "MEDICATION_PRESCRIBED",
            "medication": medication_request,
            "patient_id": patient_id
        }
    }
)
```

## Performance Considerations

1. **Incremental Updates**: Only update changed prescriptions
2. **Debouncing**: Prevent rapid successive updates
3. **Virtual Scrolling**: Already implemented for large queues
4. **Resource Cleanup**: Proper subscription management

## Integration Points

- **Orders Tab**: Publishes MEDICATION_PRESCRIBED when sending to pharmacy
- **Pharmacy Queue**: Updates queue columns based on status
- **Provider Dashboard**: Could show prescription status
- **Patient Portal**: Could show prescription ready notifications

---

**Related Documentation**:
- [Real-Time Updates Architecture](./REAL_TIME_UPDATES_ARCHITECTURE.md)
- [Implementation Guide](./REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md)
- [Orders Tab Implementation](./REAL_TIME_UPDATES_ORDERS_TAB.md)