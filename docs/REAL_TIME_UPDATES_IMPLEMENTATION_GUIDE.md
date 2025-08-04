# Real-Time Updates Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing real-time updates across all clinical modules in WintEHR. It builds upon the successful Chart Review tab implementation.

**Created**: 2025-08-04

## Architecture Pattern

### Frontend Pattern
Each component that needs real-time updates should follow this pattern:

```javascript
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../contexts/ClinicalWorkflowContext';
import websocketService from '../services/websocket';

const useRealTimeComponent = (patientId) => {
  const { subscribe, publish } = useClinicalWorkflow();
  
  // 1. Subscribe to clinical events
  useEffect(() => {
    const subscriptions = [];
    
    // Subscribe to relevant events
    const events = [/* relevant CLINICAL_EVENTS */];
    events.forEach(event => {
      const unsubscribe = subscribe(event, (data) => {
        if (data.patientId === patientId) {
          handleUpdate(event, data);
        }
      });
      subscriptions.push(unsubscribe);
    });
    
    return () => subscriptions.forEach(unsub => unsub());
  }, [patientId]);
  
  // 2. Subscribe to WebSocket room (if multi-user sync needed)
  useEffect(() => {
    if (!websocketService.isConnected) return;
    
    let subscriptionId;
    const setupSubscription = async () => {
      subscriptionId = await websocketService.subscribeToPatient(
        patientId,
        ['ResourceType1', 'ResourceType2']
      );
    };
    
    setupSubscription();
    
    return () => {
      if (subscriptionId) {
        websocketService.unsubscribeFromPatient(subscriptionId);
      }
    };
  }, [patientId]);
  
  // 3. Handle incremental updates
  const handleUpdate = useCallback((event, data) => {
    // Update state incrementally without full refresh
    switch (event) {
      case CLINICAL_EVENTS.SOME_EVENT:
        setState(prev => updateLogic(prev, data));
        break;
    }
  }, []);
};
```

## Implementation by Component

### 1. Orders Tab (EnhancedOrdersTab.js)

**Events to Handle**:
- ORDER_PLACED
- ORDER_UPDATED
- ORDER_CANCELLED
- ORDER_COMPLETED
- ORDER_SIGNED

**Implementation Steps**:
```javascript
// Add to EnhancedOrdersTab.js
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import websocketService from '../../../../services/websocket';

// Inside component
const { subscribe, publish } = useClinicalWorkflow();

// Real-time subscription effect
useEffect(() => {
  if (!patientId) return;
  
  const subscriptions = [];
  
  // Subscribe to order events
  const orderEvents = [
    CLINICAL_EVENTS.ORDER_PLACED,
    CLINICAL_EVENTS.ORDER_UPDATED,
    CLINICAL_EVENTS.ORDER_CANCELLED,
    CLINICAL_EVENTS.ORDER_COMPLETED,
    CLINICAL_EVENTS.ORDER_SIGNED
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

// WebSocket subscription for multi-user sync
useEffect(() => {
  if (!patientId || !websocketService.isConnected) return;
  
  let subscriptionId;
  const setupSubscription = async () => {
    subscriptionId = await websocketService.subscribeToPatient(
      patientId,
      ['ServiceRequest', 'MedicationRequest', 'DiagnosticReport']
    );
  };
  
  setupSubscription();
  
  return () => {
    if (subscriptionId) {
      websocketService.unsubscribeFromPatient(subscriptionId);
    }
  };
}, [patientId]);

// Handle updates incrementally
const handleOrderUpdate = useCallback((eventType, eventData) => {
  const order = eventData.order || eventData.resource;
  
  switch (eventType) {
    case CLINICAL_EVENTS.ORDER_PLACED:
      setOrders(prev => [order, ...prev]);
      break;
      
    case CLINICAL_EVENTS.ORDER_UPDATED:
    case CLINICAL_EVENTS.ORDER_SIGNED:
      setOrders(prev => prev.map(o => 
        o.id === order.id ? order : o
      ));
      break;
      
    case CLINICAL_EVENTS.ORDER_CANCELLED:
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { ...o, status: 'cancelled' } : o
      ));
      break;
      
    case CLINICAL_EVENTS.ORDER_COMPLETED:
      setOrders(prev => prev.map(o => 
        o.id === order.id ? { ...o, status: 'completed' } : o
      ));
      // Also check if this creates a result
      if (eventData.resultId) {
        // Could trigger a result notification
      }
      break;
  }
}, []);

// When saving orders, publish events
const handleOrderSave = async (orderData) => {
  const savedOrder = await createOrder(orderData);
  
  // Publish event for real-time updates
  publish(CLINICAL_EVENTS.ORDER_PLACED, {
    orderId: savedOrder.id,
    order: savedOrder,
    patientId: savedOrder.subject.reference.replace('Patient/', ''),
    orderType: savedOrder.resourceType
  });
};
```

### 2. Results Tab (ResultsTabOptimized.js)

**Events to Handle**:
- RESULT_AVAILABLE
- CRITICAL_VALUE_ALERT
- RESULT_ACKNOWLEDGED
- OBSERVATION_RECORDED

**Implementation Steps**:
```javascript
// Similar pattern to Orders tab
const handleResultUpdate = useCallback((eventType, eventData) => {
  const result = eventData.result || eventData.observation || eventData.resource;
  
  switch (eventType) {
    case CLINICAL_EVENTS.RESULT_AVAILABLE:
      // Add new result to the appropriate category
      if (isLabResult(result)) {
        setLabResults(prev => [result, ...prev]);
      } else if (isDiagnosticResult(result)) {
        setDiagnosticResults(prev => [result, ...prev]);
      }
      break;
      
    case CLINICAL_EVENTS.CRITICAL_VALUE_ALERT:
      // Highlight critical result and show notification
      setCriticalAlerts(prev => [...prev, result]);
      showNotification('Critical value alert!', 'error');
      break;
      
    case CLINICAL_EVENTS.RESULT_ACKNOWLEDGED:
      // Update acknowledgment status
      setResults(prev => prev.map(r => 
        r.id === result.id ? { ...r, acknowledged: true } : r
      ));
      break;
  }
}, []);
```

### 3. Pharmacy Dashboard (PharmacyQueue.js)

**Events to Handle**:
- MEDICATION_PRESCRIBED
- PRESCRIPTION_VERIFIED
- MEDICATION_DISPENSED
- PRESCRIPTION_CANCELLED

**Implementation Steps**:
```javascript
// This component needs different room subscription
useEffect(() => {
  if (!websocketService.isConnected) return;
  
  // Subscribe to pharmacy queue room (not patient-specific)
  let subscriptionId;
  const setupSubscription = async () => {
    // Custom subscription for pharmacy-wide updates
    subscriptionId = await websocketService.send({
      type: 'subscription',
      data: {
        subscription_id: `pharmacy-queue-${Date.now()}`,
        room_type: 'pharmacy',
        resource_types: ['MedicationRequest', 'MedicationDispense']
      }
    });
  };
  
  setupSubscription();
  
  return () => {
    if (subscriptionId) {
      websocketService.send({
        type: 'unsubscribe',
        data: { subscription_id: subscriptionId }
      });
    }
  };
}, []);

// Handle queue updates
const handleQueueUpdate = useCallback((eventType, eventData) => {
  const prescription = eventData.prescription || eventData.resource;
  
  switch (eventType) {
    case CLINICAL_EVENTS.MEDICATION_PRESCRIBED:
      // Add to new orders column
      setQueueData(prev => ({
        ...prev,
        newOrders: [prescription, ...prev.newOrders]
      }));
      break;
      
    case CLINICAL_EVENTS.PRESCRIPTION_VERIFIED:
      // Move from new orders to dispensing
      setQueueData(prev => ({
        ...prev,
        newOrders: prev.newOrders.filter(p => p.id !== prescription.id),
        dispensing: [prescription, ...prev.dispensing]
      }));
      break;
      
    case CLINICAL_EVENTS.MEDICATION_DISPENSED:
      // Move to ready column
      setQueueData(prev => ({
        ...prev,
        dispensing: prev.dispensing.filter(p => p.id !== prescription.id),
        ready: [prescription, ...prev.ready]
      }));
      break;
  }
}, []);
```

### 4. Patient Header (CompactPatientHeader.js)

**Events to Handle**:
- ALLERGY_ADDED
- ALLERGY_UPDATED
- ALERT_ADDED
- CODE_STATUS_CHANGED

**Implementation Steps**:
```javascript
// Subscribe to critical patient updates
useEffect(() => {
  const criticalEvents = [
    CLINICAL_EVENTS.ALLERGY_ADDED,
    CLINICAL_EVENTS.ALLERGY_UPDATED,
    CLINICAL_EVENTS.ALLERGY_DELETED,
    CLINICAL_EVENTS.ALERT_ADDED,
    CLINICAL_EVENTS.CODE_STATUS_CHANGED,
    CLINICAL_EVENTS.ISOLATION_PRECAUTION_ADDED
  ];
  
  // Handle updates to patient header data
  const handleHeaderUpdate = (eventType, data) => {
    switch (eventType) {
      case CLINICAL_EVENTS.ALLERGY_ADDED:
      case CLINICAL_EVENTS.ALLERGY_UPDATED:
        // Refresh allergy display
        setAllergies(prev => updateAllergies(prev, data.allergy));
        break;
        
      case CLINICAL_EVENTS.ALERT_ADDED:
        // Show new alert flag
        setAlerts(prev => [...prev, data.alert]);
        break;
        
      case CLINICAL_EVENTS.CODE_STATUS_CHANGED:
        // Update code status display
        setCodeStatus(data.codeStatus);
        break;
    }
  };
  
  // Subscribe to events...
}, [patientId]);
```

## Backend Requirements

### Event Broadcasting
Ensure backend broadcasts events to appropriate rooms:

```python
# When creating/updating resources
async def create_order(order_data):
    # Save order
    saved_order = await storage.create_resource("ServiceRequest", order_data)
    
    # Broadcast to patient room
    await manager.broadcast_resource_update(
        resource_type="ServiceRequest",
        resource_id=saved_order["id"],
        action="created",
        resource_data=saved_order,
        patient_id=extract_patient_id(saved_order)
    )
    
    # For pharmacy orders, also broadcast to pharmacy room
    if is_medication_order(saved_order):
        await manager.broadcast_to_room(
            "pharmacy:queue",
            {
                "type": "update",
                "data": {
                    "event_type": "MEDICATION_PRESCRIBED",
                    "prescription": saved_order
                }
            }
        )
```

## Testing Strategy

### Unit Tests
```javascript
describe('Real-time Updates', () => {
  it('should update orders list when ORDER_PLACED event received', async () => {
    const { result } = renderHook(() => useOrdersWithRealTime(patientId));
    
    // Simulate event
    act(() => {
      mockPublish(CLINICAL_EVENTS.ORDER_PLACED, {
        order: mockOrder,
        patientId
      });
    });
    
    // Verify update
    expect(result.current.orders).toContainEqual(mockOrder);
  });
});
```

### Integration Tests
1. Open multiple browser sessions
2. Make changes in one session
3. Verify updates appear in other sessions
4. Test network disconnection/reconnection
5. Test high-frequency updates

## Performance Considerations

### Debouncing High-Frequency Updates
```javascript
// For components that might receive many updates
const debouncedUpdate = useMemo(
  () => debounce((updates) => {
    setBatchedData(prev => applyBatchedUpdates(prev, updates));
  }, 100),
  []
);
```

### Subscription Management
```javascript
// Unsubscribe from rooms when not needed
useEffect(() => {
  // Only subscribe when tab is active
  if (!isTabActive) return;
  
  // Subscribe logic...
  
  return () => {
    // Clean up subscriptions
  };
}, [isTabActive]);
```

## Common Patterns

### 1. Incremental State Updates
Always update state incrementally to avoid UI flicker:
```javascript
// Good
setState(prev => prev.map(item => 
  item.id === updated.id ? updated : item
));

// Bad
setState(await fetchAllData());
```

### 2. Event Publishing
When creating/updating resources, always publish events:
```javascript
const saved = await api.create(resource);
publish(CLINICAL_EVENTS.RESOURCE_CREATED, {
  resource: saved,
  patientId: saved.subject.reference.replace('Patient/', '')
});
```

### 3. Multi-User Awareness
Consider showing who else is viewing:
```javascript
// Future enhancement
const ActiveUsers = () => (
  <Stack direction="row" spacing={1}>
    {activeUsers.map(user => (
      <Tooltip title={`${user.name} is viewing`}>
        <Avatar src={user.avatar} />
      </Tooltip>
    ))}
  </Stack>
);
```

## Rollout Checklist

For each component:
- [ ] Add ClinicalWorkflow imports
- [ ] Add WebSocket imports (if needed)
- [ ] Implement event subscriptions
- [ ] Implement incremental update handlers
- [ ] Add event publishing on save/update
- [ ] Test single-user updates
- [ ] Test multi-user synchronization
- [ ] Add error handling
- [ ] Update documentation
- [ ] Add performance monitoring

## Monitoring and Debugging

### Console Logging
```javascript
// Add debug logging during development
const handleUpdate = (event, data) => {
  console.log(`[${componentName}] Real-time update:`, {
    event,
    data,
    timestamp: new Date().toISOString()
  });
  // Handle update...
};
```

### Performance Monitoring
```javascript
// Track update frequency
const updateCounter = useRef(0);
const lastUpdateTime = useRef(Date.now());

const trackUpdatePerformance = () => {
  updateCounter.current++;
  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime.current;
  
  if (timeSinceLastUpdate < 100) {
    console.warn('High-frequency updates detected');
  }
  
  lastUpdateTime.current = now;
};
```

---

**Next Steps**:
1. Start with high-priority components (Orders, Results, Pharmacy)
2. Implement one component at a time
3. Test thoroughly before moving to next component
4. Update this guide with lessons learned