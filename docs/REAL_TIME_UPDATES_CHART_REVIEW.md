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

3. **Data Refresh**: When an event is received for the current patient, the hook automatically refreshes the resource data.

4. **Debouncing**: To prevent rapid consecutive refreshes, a 500ms debounce is applied to batch multiple updates together.

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

- Updates are patient-specific - only events for the currently viewed patient trigger refreshes
- Debouncing prevents excessive API calls when multiple resources are updated quickly
- The hook uses refs to prevent unnecessary re-renders
- Resource loading is optimized to fetch only what's needed

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

## Future Enhancements

1. **Optimistic Updates**: Show changes immediately before server confirmation
2. **Granular Updates**: Update only the changed resource instead of full refresh
3. **Conflict Resolution**: Handle simultaneous edits by multiple users
4. **Offline Support**: Queue updates when offline and sync when reconnected

---

**Last Updated**: 2025-08-04