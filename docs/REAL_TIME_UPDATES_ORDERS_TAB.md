# Real-Time Updates - Orders Tab Implementation

## Overview
The Orders Tab now supports real-time updates for order management, enabling multiple users to see order changes instantly without manual refresh.

**Implementation Date**: 2025-08-04

## Features Implemented

### 1. Event Subscriptions
The Orders Tab subscribes to the following clinical events:
- `ORDER_PLACED` - New orders appear immediately
- `ORDER_UPDATED` - Order status/details update in real-time
- `ORDER_CANCELLED` - Cancelled orders update status instantly
- `ORDER_COMPLETED` - Completed orders show new status
- `ORDER_SIGNED` - Signed orders update immediately
- `MEDICATION_PRESCRIBED` - New medication orders appear

### 2. WebSocket Room Subscription
- Subscribes to patient room for multi-user synchronization
- Resource types monitored: `ServiceRequest`, `MedicationRequest`, `DiagnosticReport`
- Updates from other users viewing the same patient appear instantly

### 3. Event Publishing
Order actions now publish appropriate events:
- Creating orders publishes `ORDER_PLACED` or `MEDICATION_PRESCRIBED`
- Cancelling orders publishes `ORDER_CANCELLED`
- Sending to pharmacy publishes `MEDICATION_PRESCRIBED`

## Implementation Details

### Code Changes in EnhancedOrdersTab.js

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
  const orderEvents = [
    CLINICAL_EVENTS.ORDER_PLACED,
    CLINICAL_EVENTS.ORDER_UPDATED,
    CLINICAL_EVENTS.ORDER_CANCELLED,
    CLINICAL_EVENTS.ORDER_COMPLETED,
    CLINICAL_EVENTS.ORDER_SIGNED,
    CLINICAL_EVENTS.MEDICATION_PRESCRIBED
  ];
  
  orderEvents.forEach(eventType => {
    const unsubscribe = subscribe(eventType, (event) => {
      if (event.patientId === patientId) {
        handleOrderUpdate(eventType, event);
      }
    });
    subscriptions.push(unsubscribe);
  });
  
  return () => subscriptions.forEach(unsub => unsub());
}, [patientId, subscribe]);
```

4. **WebSocket room subscription**:
```javascript
useEffect(() => {
  if (!patientId || !websocketService.isConnected) return;
  
  let subscriptionId = null;
  const setupPatientSubscription = async () => {
    subscriptionId = await websocketService.subscribeToPatient(patientId, [
      'ServiceRequest',
      'MedicationRequest',
      'DiagnosticReport'
    ]);
  };
  
  setupPatientSubscription();
  
  return () => {
    if (subscriptionId) {
      websocketService.unsubscribeFromPatient(subscriptionId);
    }
  };
}, [patientId]);
```

5. **Update handler with notifications**:
```javascript
const handleOrderUpdate = useCallback((eventType, eventData) => {
  const order = eventData.order || eventData.medication || eventData.resource;
  
  // Refresh search to get updated data
  refreshSearch();
  
  // Show notification based on event type
  switch (eventType) {
    case CLINICAL_EVENTS.ORDER_PLACED:
      setSnackbar({
        open: true,
        message: `New order placed: ${order.code?.text || 'Order'}`,
        severity: 'info'
      });
      break;
    // ... other cases
  }
}, [refreshSearch]);
```

## Current Limitations

1. **Incremental Updates**: Currently using `refreshSearch()` instead of true incremental state updates
2. **Order Details**: Detailed order view doesn't update in real-time if already open
3. **Batch Operations**: Batch signing/cancellation doesn't publish individual events

## Future Enhancements

1. **True Incremental Updates**:
```javascript
// Instead of refreshSearch(), update state directly
setOrders(prev => {
  switch (eventType) {
    case CLINICAL_EVENTS.ORDER_PLACED:
      return [order, ...prev];
    case CLINICAL_EVENTS.ORDER_UPDATED:
      return prev.map(o => o.id === order.id ? order : o);
    case CLINICAL_EVENTS.ORDER_CANCELLED:
      return prev.map(o => o.id === order.id ? {...o, status: 'cancelled'} : o);
  }
});
```

2. **Order Statistics Updates**: Update statistics in real-time without refresh
3. **Filter Preservation**: Maintain current filters when updating
4. **Optimistic Updates**: Show changes immediately, rollback on error

## Testing

### Manual Testing
1. Open Orders tab in two browser windows
2. Create an order in one window
3. Verify it appears in the other window immediately
4. Cancel an order and verify status updates
5. Send medication to pharmacy and verify notification

### Test Scenarios
- Multiple users creating orders simultaneously
- Order status changes propagating to all viewers
- Filter and sort preservation during updates
- Performance with high-frequency updates

## Performance Considerations

1. **Debouncing**: Consider debouncing rapid updates
2. **Virtual Scrolling**: Already implemented for large order lists
3. **Selective Updates**: Only update visible orders
4. **Resource Cleanup**: Proper subscription cleanup on unmount

## Related Components

- **CPOEDialog**: Publishes events when orders are created
- **OrderSigningDialog**: Should publish ORDER_SIGNED events
- **QuickOrderDialog**: Should publish appropriate events
- **useAdvancedOrderSearch**: Hook that manages order data

---

**Next Steps**:
1. Implement true incremental state updates
2. Add event publishing to OrderSigningDialog
3. Update order statistics in real-time
4. Add user presence indicators