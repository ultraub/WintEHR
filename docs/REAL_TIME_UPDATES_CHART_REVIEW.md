# Real-Time Updates for Chart Review Tab

## Overview
The Chart Review tab now supports real-time updates when resources are created, updated, or deleted. This ensures that clinicians always see the most up-to-date patient information without needing to manually refresh the page.

## Implementation Details

### Event System
Real-time updates are powered by the Clinical Workflow Context event system, which uses WebSocket connections to broadcast clinical events across the application.

### Supported Resource Types and Events

1. **Conditions**
   - `CONDITION_ADDED` - When a new condition is added
   - `CONDITION_UPDATED` - When a condition is modified
   - `CONDITION_RESOLVED` - When a condition is marked as resolved
   - `CONDITION_DELETED` - When a condition is removed

2. **Medications**
   - `MEDICATION_PRESCRIBED` - When a new medication is prescribed
   - `MEDICATION_UPDATED` - When medication details are changed
   - `MEDICATION_DISCONTINUED` - When a medication is stopped

3. **Allergies**
   - `ALLERGY_ADDED` - When a new allergy is recorded
   - `ALLERGY_UPDATED` - When allergy details are modified
   - `ALLERGY_RESOLVED` - When an allergy is marked as resolved
   - `ALLERGY_DELETED` - When an allergy is removed

4. **Immunizations**
   - `IMMUNIZATION_ADMINISTERED` - When a vaccine is given
   - `IMMUNIZATION_UPDATED` - When immunization details are changed

5. **Observations/Vitals**
   - `OBSERVATION_RECORDED` - When a new observation is recorded
   - `OBSERVATION_UPDATED` - When observation data is modified
   - `VITAL_SIGNS_RECORDED` - When vital signs are captured

6. **Procedures**
   - `PROCEDURE_SCHEDULED` - When a procedure is scheduled
   - `PROCEDURE_COMPLETED` - When a procedure is completed
   - `PROCEDURE_UPDATED` - When procedure details are changed

7. **Encounters**
   - `ENCOUNTER_STARTED` - When a new encounter begins
   - `ENCOUNTER_UPDATED` - When encounter details are modified
   - `ENCOUNTER_FINISHED` - When an encounter is completed

8. **Care Plans**
   - `CARE_PLAN_CREATED` - When a new care plan is created
   - `CARE_PLAN_UPDATED` - When care plan details are modified

9. **Documents**
   - `DOCUMENT_CREATED` - When a new document is created
   - `DOCUMENT_UPDATED` - When document details are modified

### How It Works

1. **Event Publishing**: When a resource is saved through any dialog (e.g., Condition Dialog, Medication Dialog), the save handler publishes a clinical event with the resource details.

2. **Event Subscription**: The `useChartReviewResources` hook subscribes to all relevant clinical events for the current patient.

3. **Incremental Updates**: When an event is received for the current patient, the hook updates only the specific resource in the state:
   - For new resources: Adds them to the beginning of the list
   - For updated resources: Replaces the existing resource in-place
   - For deleted resources: Removes them from the list
   - No full refresh needed - instant UI updates

4. **No Debouncing Needed**: Since updates are incremental and efficient, there's no need for debouncing.

### Configuration

Real-time updates can be enabled or disabled when using the `useChartReviewResources` hook:

```javascript
const { resources, loading, error } = useChartReviewResources(patientId, {
  realTimeUpdates: true  // Enable real-time updates (default: true)
});
```

### WebSocket Connection

Real-time updates require an active WebSocket connection. The connection is automatically established when a user logs in and includes:
- Auto-reconnection with exponential backoff
- Message queuing during disconnection
- Heartbeat mechanism to maintain connection

### Performance Considerations

- Updates are patient-specific - only events for the currently viewed patient trigger updates
- Incremental updates mean no API calls are needed - the updated resource is already in the event
- The hook uses functional state updates to prevent unnecessary re-renders
- No full data refresh means instant UI updates with no loading states
- Maintains list ordering with new resources appearing at the top

## Troubleshooting

### Updates Not Appearing
1. Check WebSocket connection status in the app bar
2. Verify the event is being published in the dialog save handler
3. Check browser console for event subscription logs
4. Ensure the patient ID matches between the event and current view

### Performance Issues
1. Disable real-time updates temporarily: `realTimeUpdates: false`
2. Check for excessive event publishing
3. Monitor WebSocket message frequency
4. Review debounce timing configuration

## Implementation Details

### Incremental Update Logic

The `handleResourceUpdate` function in `useChartReviewResources` implements smart resource updates:

```javascript
// For updates: Find and replace the existing resource
const index = prev.findIndex(c => c.id === resource.id);
if (index >= 0) {
  const updated = [...prev];
  updated[index] = resource;
  return updated;
} else {
  // For new resources: Add to the beginning of the list
  return [resource, ...prev];
}
```

This approach ensures:
- No flickering or loading states
- Instant visual feedback
- Maintains scroll position
- Preserves user context

## Multi-User Synchronization

Real-time updates now support multi-user synchronization. When multiple users are viewing the same patient simultaneously:

1. **Patient Room Subscription**: Each Chart Review tab subscribes to a WebSocket "room" specific to the patient
2. **Automatic Broadcasting**: Updates made by one user are automatically broadcast to all other users viewing that patient
3. **Instant Updates**: Changes appear instantly across all connected clients without requiring manual refresh
4. **Resource Type Filtering**: Only relevant resource types are synchronized to minimize network traffic

### How Multi-User Sync Works

1. **Room-Based Architecture**: Backend creates rooms using pattern `patient:{patientId}`
2. **WebSocket Subscription**: Frontend subscribes to patient room when Chart Review loads
3. **Event Broadcasting**: When a user saves a resource, the backend broadcasts to all room subscribers
4. **Client-Side Updates**: Each client receives the update and applies it incrementally to their UI

### Testing Multi-User Updates

To test multi-user synchronization:
1. Open two browser windows (or use different browsers)
2. Log in as different users in each window
3. Navigate to the same patient's Chart Review tab in both windows
4. Make changes in one window - they should appear instantly in the other

## Future Enhancements

1. **Conflict Resolution**: Handle simultaneous edits by multiple users with version checking
2. **Offline Support**: Queue updates when offline and sync when reconnected
3. **Batch Updates**: Handle multiple simultaneous updates more efficiently
4. **Animation**: Add subtle animations when resources are added/updated/removed
5. **User Presence**: Show which users are currently viewing the same patient
6. **Optimistic Locking**: Prevent conflicting edits with resource versioning

---

**Last Updated**: 2025-08-04