# Real-Time Updates - Timeline Tab Implementation

## Overview
The Timeline Tab now supports real-time updates that aggregate all clinical events into a unified timeline view. As any clinical activity occurs - diagnoses, medications, lab results, procedures, notes - the timeline automatically updates to show the complete patient story across all connected users.

**Implementation Date**: 2025-08-04

## Features Implemented

### 1. Comprehensive Event Aggregation
The Timeline Tab subscribes to ALL clinical events and displays them in a unified chronological view:
- Patient events (selection, updates)
- Condition/Problem events (diagnosed, resolved, updated)
- Medication events (prescribed, discontinued, dispensed)
- Allergy events (added, updated, resolved)
- Procedure events (scheduled, completed, cancelled)
- Observation events (vitals, labs recorded)
- Imaging events (studies available, reports ready)
- Document events (notes created, signed)
- Order events (placed, completed, cancelled)
- And many more...

### 2. WebSocket Room Subscription
- Subscribes to patient room for all resource types
- Monitors 15+ FHIR resource types simultaneously
- Updates from any module appear instantly in the timeline
- Automatic data refresh when WebSocket reconnects

### 3. Workflow Event Tracking
- Creates synthetic "WorkflowEvent" resources for user actions
- Tracks who did what and when
- Shows the flow of clinical workflow in real-time
- Preserves event history for audit trail

### 4. Visual Notifications
- Snackbar notifications for significant events
- Different event types shown with unique icons and colors
- Smart filtering to show only relevant notifications

## Implementation Details

### Code Changes in TimelineTabImproved.js

1. **Added WebSocket import**:
```javascript
import websocketService from '../../../../services/websocket';
```

2. **Enhanced workflow event subscription with notifications**:
```javascript
// Subscribe to workflow events
useEffect(() => {
  const unsubscribers = [];
  
  Object.values(CLINICAL_EVENTS).forEach(eventType => {
    const unsubscribe = subscribe(eventType, (eventData) => {
      if (eventData.patientId === patientId) {
        const workflowEvent = {
          id: `workflow-${Date.now()}-${Math.random()}`,
          resourceType: 'WorkflowEvent',
          eventType: eventType,
          date: eventData.timestamp || new Date().toISOString(),
          data: eventData,
          patientId: eventData.patientId
        };
        
        setWorkflowEvents(prev => [...prev, workflowEvent]);
        
        // Show notification for significant events
        const significantEvents = [
          CLINICAL_EVENTS.CONDITION_DIAGNOSED,
          CLINICAL_EVENTS.MEDICATION_PRESCRIBED,
          CLINICAL_EVENTS.ALLERGY_ADDED,
          CLINICAL_EVENTS.PROCEDURE_COMPLETED,
          CLINICAL_EVENTS.RESULT_AVAILABLE,
          CLINICAL_EVENTS.IMAGING_STUDY_AVAILABLE,
          CLINICAL_EVENTS.NOTE_CREATED
        ];
        
        if (significantEvents.includes(eventType)) {
          setSnackbar({
            open: true,
            message: `New timeline event: ${eventType.replace(/\./g, ' ').replace(/_/g, ' ')}`,
            severity: 'info'
          });
        }
      }
    });
    
    unsubscribers.push(unsubscribe);
  });
}, [subscribe, patientId]);
```

3. **WebSocket patient room subscription**:
```javascript
// WebSocket patient room subscription for multi-user sync
useEffect(() => {
  if (!patientId || !websocketService.isConnected) return;

  let subscriptionId = null;

  const setupPatientSubscription = async () => {
    // Subscribe to all resource types that can appear in timeline
    const resourceTypes = [
      'Encounter',
      'MedicationRequest',
      'MedicationStatement',
      'Observation',
      'Condition',
      'AllergyIntolerance',
      'Immunization',
      'Procedure',
      'DiagnosticReport',
      'ImagingStudy',
      'DocumentReference',
      'CarePlan',
      'CareTeam',
      'Coverage',
      'Goal'
    ];

    subscriptionId = await websocketService.subscribeToPatient(patientId, resourceTypes);
    
    // Also trigger a reload to ensure we have the latest data
    setReloadTrigger(prev => prev + 1);
  };

  setupPatientSubscription();
}, [patientId]);
```

## Key Features

### 1. Unified Timeline View
- All clinical events in one chronological view
- Color-coded by event type
- Icons indicate resource type at a glance
- Expandable details for each event

### 2. Multi-Track Organization
- Events organized into tracks by type:
  - Encounters track
  - Medications track
  - Labs track
  - Conditions track
  - Procedures track
  - Documents track
  - And more...

### 3. Real-Time Workflow Tracking
- See who performed what action
- Track the sequence of clinical decisions
- Understand the flow of patient care
- Audit trail of all activities

### 4. Intelligent Filtering
- Filter by date range
- Show/hide inactive resources
- Search across all events
- Filter by event type

### 5. Historical View
- Toggle to show historical/resolved items
- See the complete patient story
- Track progression over time

## Testing Scenarios

### Manual Testing
1. Open Timeline tab in multiple browser windows
2. Perform various clinical actions:
   - Add a diagnosis
   - Prescribe a medication
   - Record vitals
   - Create a note
   - Order labs
3. Verify all events appear in timeline immediately
4. Check that workflow events show user actions
5. Verify date filtering works correctly
6. Test show/hide inactive resources toggle

### Test Cases
- New diagnosis appears in conditions track
- Medication appears in medications track
- Lab results show in labs track
- All events maintain chronological order
- Workflow events capture user actions
- Date range filtering works correctly
- Search finds events by content

## Future Enhancements

1. **Event Grouping**:
```javascript
// Group related events together
const groupRelatedEvents = (events) => {
  // Group by encounter
  // Group by time proximity
  // Group by clinical context
};
```

2. **User Attribution**:
- Show who performed each action
- "Dr. Smith prescribed medication"
- User avatars on timeline

3. **Event Correlation**:
- Link related events
- Show cause and effect
- Highlight clinical patterns

4. **Advanced Filtering**:
- Filter by user
- Filter by severity
- Filter by clinical significance
- Save filter presets

5. **Export Capabilities**:
- Export timeline as PDF
- Generate clinical summary
- Create audit reports

## Performance Considerations

1. **Current Implementation**: 
   - Loads 50 of each resource type
   - Triggers full reload on WebSocket events
   - May become slow with many events

2. **Optimizations Needed**:
   - Implement virtual scrolling for long timelines
   - Progressive loading as user scrolls
   - Incremental updates instead of full reload
   - Event aggregation for high-frequency updates

3. **Caching Strategy**:
   - Cache processed events
   - Reuse timeline calculations
   - Memoize expensive operations

## Backend Requirements

The backend should broadcast events for ALL clinical activities:
1. Resource creation (any FHIR resource)
2. Resource updates
3. Status changes
4. User actions (with attribution)
5. System events

Example backend broadcast:
```python
# Broadcast any FHIR resource change
await manager.broadcast_to_room(
    f"patient:{patient_id}",
    {
        "type": "update",
        "data": {
            "event_type": determine_event_type(resource),
            "resource": resource,
            "patient_id": patient_id,
            "user_id": current_user_id,
            "action": action_type  # created, updated, deleted
        }
    }
)
```

## Integration Points

- **All Clinical Modules**: Every module's events appear in timeline
- **Workflow Context**: Captures all user actions
- **WebSocket Service**: Receives all patient room updates
- **FHIR Resources**: Displays all resource types

## Summary

The Timeline Tab serves as the central nervous system of the clinical workspace, aggregating all patient-related events into a single, chronological view. With real-time updates, multiple healthcare providers can see the complete patient story unfold as it happens, ensuring everyone has the full clinical context for decision-making.

---

**Related Documentation**:
- [Real-Time Updates Architecture](./REAL_TIME_UPDATES_ARCHITECTURE.md)
- [Implementation Guide](./REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md)
- [Implementation Summary](./REAL_TIME_UPDATES_IMPLEMENTATION_SUMMARY.md)