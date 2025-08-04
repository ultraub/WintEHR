# Real-Time Updates - Patient Header Implementation

## Overview
The Patient Header now supports real-time updates for patient allergies, conditions, medications, and clinical alerts. All changes to patient data are immediately reflected in the header across all connected users.

**Implementation Date**: 2025-08-04

## Features Implemented

### 1. Event Subscriptions
The Patient Header subscribes to the following clinical events:
- `ALLERGY_ADDED` - New allergies appear immediately
- `ALLERGY_UPDATED` - Allergy status updates in real-time
- `ALLERGY_REMOVED` - Removed allergies disappear from count
- `ALERT_ADDED` - New clinical alerts display instantly
- `ALERT_UPDATED` - Alert severity changes update
- `ALERT_REMOVED` - Resolved alerts are removed
- `CONDITION_DIAGNOSED` - New conditions added to count
- `CONDITION_UPDATED` - Condition status changes
- `MEDICATION_PRESCRIBED` - New medications increase count
- `MEDICATION_DISCONTINUED` - Stopped medications decrease count

### 2. WebSocket Room Subscription
- Subscribes to patient room for multi-user synchronization
- Resource types monitored: `AllergyIntolerance`, `Condition`, `MedicationRequest`, `Flag`
- Updates from other users viewing the same patient appear instantly
- Badge counts update in real-time

### 3. Visual Updates
- Allergy count badge (red) updates immediately
- Medication count badge (warning when ≥5) updates in real-time
- Condition count updates dynamically
- Critical alert banner appears/disappears as needed

## Implementation Details

### Code Changes in CollapsiblePatientHeaderOptimized.js

1. **Added real-time imports**:
```javascript
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../contexts/ClinicalWorkflowContext';
import websocketService from '../../../services/websocket';
```

2. **Event subscriptions**:
```javascript
useEffect(() => {
  const headerEvents = [
    CLINICAL_EVENTS.ALLERGY_ADDED,
    CLINICAL_EVENTS.ALLERGY_UPDATED,
    CLINICAL_EVENTS.ALLERGY_REMOVED,
    CLINICAL_EVENTS.ALERT_ADDED,
    CLINICAL_EVENTS.ALERT_UPDATED,
    CLINICAL_EVENTS.ALERT_REMOVED,
    CLINICAL_EVENTS.CONDITION_DIAGNOSED,
    CLINICAL_EVENTS.CONDITION_UPDATED,
    CLINICAL_EVENTS.MEDICATION_PRESCRIBED,
    CLINICAL_EVENTS.MEDICATION_DISCONTINUED
  ];

  headerEvents.forEach(eventType => {
    const unsubscribe = subscribe(eventType, (event) => {
      if (event.patientId === patientId) {
        handleHeaderUpdate(eventType, event);
      }
    });
    subscriptions.push(unsubscribe);
  });
}, [patientId, subscribe, handleHeaderUpdate]);
```

3. **WebSocket patient room subscription**:
```javascript
useEffect(() => {
  if (!patientId || !websocketService.isConnected) return;
  
  const setupPatientSubscription = async () => {
    const resourceTypes = [
      'AllergyIntolerance',
      'Condition', 
      'MedicationRequest',
      'Flag' // For clinical alerts
    ];
    
    subscriptionId = await websocketService.subscribeToPatient(patientId, resourceTypes);
  };
  
  setupPatientSubscription();
}, [patientId]);
```

4. **Update handler**:
```javascript
const handleHeaderUpdate = useCallback((eventType, eventData) => {
  switch (eventType) {
    case CLINICAL_EVENTS.ALLERGY_ADDED:
    case CLINICAL_EVENTS.ALLERGY_UPDATED:
    case CLINICAL_EVENTS.ALLERGY_REMOVED:
    case CLINICAL_EVENTS.CONDITION_DIAGNOSED:
    case CLINICAL_EVENTS.CONDITION_UPDATED:
    case CLINICAL_EVENTS.MEDICATION_PRESCRIBED:
    case CLINICAL_EVENTS.MEDICATION_DISCONTINUED:
    case CLINICAL_EVENTS.ALERT_ADDED:
    case CLINICAL_EVENTS.ALERT_UPDATED:
    case CLINICAL_EVENTS.ALERT_REMOVED:
      // Refresh patient data to get updated counts
      if (refreshPatientData) {
        refreshPatientData(patientId);
      }
      break;
  }
}, [patientId, refreshPatientData]);
```

## Key Features

### 1. Badge Count Updates
- Allergy badge shows red with count when allergies exist
- Medication badge turns warning color when ≥5 medications
- Condition count updates dynamically
- All counts update without page refresh

### 2. Progressive Collapse States
- Real-time updates work in all header states (expanded, compact, minimal)
- Critical information (allergies, high medication count) visible even in minimal state
- Smooth transitions between states preserved during updates

### 3. Multi-User Awareness
- Changes made by one user immediately visible to all users
- No conflicts when multiple users update different aspects
- Consistent state across all connected clients

## Testing Scenarios

### Manual Testing
1. Open patient chart in two browser windows
2. Add an allergy in one window
3. Verify allergy count updates in both windows immediately
4. Add medications until count reaches 5
5. Verify medication badge changes to warning color in both windows
6. Remove an allergy and verify count decreases

### Test Cases
- New allergy addition updates badge count
- Allergy removal decreases count
- Medication count threshold (≥5) triggers warning
- Condition updates reflect immediately
- Clinical alerts appear/disappear dynamically
- Header state (expanded/compact/minimal) preserves during updates

## Future Enhancements

1. **Enhanced Visual Feedback**:
```javascript
// Flash animation when counts change
const [allergyFlash, setAllergyFlash] = useState(false);

// In update handler
if (eventType === CLINICAL_EVENTS.ALLERGY_ADDED) {
  setAllergyFlash(true);
  setTimeout(() => setAllergyFlash(false), 1000);
}

// In render
<Badge 
  badgeContent={activeAllergies.length}
  sx={{ 
    animation: allergyFlash ? 'flash 1s' : 'none'
  }}
/>
```

2. **Notification Toasts**:
- Show toast notifications for critical changes
- "New allergy added: Penicillin"
- "Medication discontinued: Aspirin"

3. **User Attribution**:
- Show who made the change
- "Dr. Smith added allergy 2 seconds ago"

4. **Detailed Hover Information**:
- Hover over badges to see details
- List of allergies, medications, conditions

## Performance Considerations

1. **Memoization**: All counts are memoized to prevent unnecessary recalculations
2. **Selective Updates**: Only refresh data for affected resource types
3. **Debouncing**: Scroll-based collapse state changes are debounced
4. **Resource Cleanup**: Proper subscription cleanup on unmount

## Backend Requirements

The backend should broadcast events when:
1. Allergies are added, updated, or removed
2. Conditions are diagnosed or updated
3. Medications are prescribed or discontinued
4. Clinical alerts are created, updated, or resolved

Example backend broadcast:
```python
# When allergy is added
await manager.broadcast_to_room(
    f"patient:{patient_id}",
    {
        "type": "update",
        "data": {
            "event_type": "ALLERGY_ADDED",
            "resource": allergy_intolerance,
            "patient_id": patient_id
        }
    }
)
```

---

**Related Documentation**:
- [Real-Time Updates Architecture](./REAL_TIME_UPDATES_ARCHITECTURE.md)
- [Implementation Guide](./REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md)
- [Chart Review Implementation](./MULTI_USER_SYNC_IMPLEMENTATION.md)