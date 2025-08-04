# Multi-User Real-Time Synchronization Implementation

## Overview
This document describes the complete implementation of multi-user real-time synchronization for the Chart Review tab in WintEHR. When multiple users view the same patient simultaneously, changes made by one user appear instantly for all other users.

**Implementation Date**: 2025-08-04

## Architecture

### Backend Components

1. **WebSocket Connection Manager** (`backend/api/websocket/connection_manager.py`)
   - Manages WebSocket connections and patient room subscriptions
   - Broadcasts resource updates to all users in the same patient room
   - Room pattern: `patient:{patient_id}`

2. **Resource Update Broadcasting**
   - When a FHIR resource is created/updated/deleted, the backend:
     - Identifies the patient ID from the resource
     - Broadcasts the update to room `patient:{patient_id}`
     - Includes the full resource data in the broadcast

### Frontend Components

1. **WebSocket Service** (`frontend/src/services/websocket.js`)
   - Added `subscribeToPatient()` method for room subscriptions
   - Added `unsubscribeFromPatient()` method for cleanup
   - Enhanced message handler to process "update" messages from other users
   - Dispatches received updates as clinical events

2. **Clinical Workflow Context** (`frontend/src/contexts/ClinicalWorkflowContext.js`)
   - Fixed `publish()` function to include `patientId` for local listeners
   - Ensures events work for both local and remote updates

3. **Chart Review Resources Hook** (`frontend/src/hooks/useChartReviewResources.js`)
   - Subscribes to patient WebSocket room when component mounts
   - Handles incremental updates without full refresh
   - Unsubscribes from room on unmount or patient change

## How It Works

### Connection Flow
1. User opens Chart Review tab for a patient
2. Hook subscribes to patient room via WebSocket
3. Backend adds user to room `patient:{patient_id}`
4. User receives confirmation of subscription

### Update Flow
1. User A saves a condition in the dialog
2. Dialog publishes clinical event locally
3. Backend creates/updates the resource
4. Backend broadcasts update to patient room
5. All other users in the room receive the update
6. Frontend processes update and updates UI incrementally

### Message Format
```javascript
// WebSocket update message
{
  "type": "update",
  "data": {
    "action": "created|updated|deleted",
    "resource_type": "Condition",
    "resource_id": "123",
    "patient_id": "456",
    "resource": { /* Full FHIR resource */ }
  }
}
```

## Key Features

1. **Automatic Synchronization**: No manual refresh needed
2. **Incremental Updates**: Only changed resources update, no flickering
3. **Resource Type Filtering**: Only relevant resources are synchronized
4. **Connection Resilience**: Auto-reconnection on connection loss
5. **Clean Unsubscription**: Proper cleanup when leaving patient view

## Testing

### Manual Testing
1. Open two browser windows
2. Log in as different users (e.g., "nurse" and "demo")
3. Navigate to same patient's Chart Review
4. Make changes in one window
5. Verify changes appear instantly in other window

### Automated Testing
Use the test script:
```bash
docker exec emr-backend python scripts/testing/test_multi_user_sync.py [patient_id]
```

## Security Considerations

1. **Patient Privacy**: Users only receive updates for patients they're actively viewing
2. **Authentication**: WebSocket connections require valid JWT tokens (in production)
3. **Resource Filtering**: Only subscribed resource types are synchronized
4. **Room Isolation**: Updates are confined to patient-specific rooms

## Performance Considerations

1. **Incremental Updates**: No full data refresh, minimal UI impact
2. **Resource Type Filtering**: Reduces unnecessary network traffic
3. **Subscription Management**: Automatic cleanup prevents memory leaks
4. **Efficient Broadcasting**: Backend uses room-based broadcasting

## Limitations & Future Enhancements

### Current Limitations
1. No conflict resolution for simultaneous edits
2. No user presence indicators
3. No offline queue for updates
4. No versioning or optimistic locking

### Future Enhancements
1. **Conflict Resolution**: Handle simultaneous edits with FHIR versioning
2. **User Presence**: Show avatars of users viewing same patient
3. **Offline Support**: Queue updates when offline, sync on reconnect
4. **Optimistic Locking**: Prevent conflicting edits
5. **Update Animations**: Subtle animations for resource changes
6. **Audit Trail**: Track which user made which changes

## Troubleshooting

### Updates Not Syncing
1. Check WebSocket connection status in app bar
2. Verify both users are viewing same patient
3. Check browser console for WebSocket errors
4. Ensure backend is broadcasting to correct room

### Performance Issues
1. Check number of active subscriptions
2. Monitor WebSocket message frequency
3. Verify incremental updates working correctly
4. Check for duplicate event handlers

## Code References

- WebSocket Service: `frontend/src/services/websocket.js:165-214`
- Chart Review Hook: `frontend/src/hooks/useChartReviewResources.js:962-1005`
- Connection Manager: `backend/api/websocket/connection_manager.py:167-209`
- Clinical Workflow: `frontend/src/contexts/ClinicalWorkflowContext.js:135-181`

---

**Related Documentation**:
- [Real-Time Updates for Chart Review](./REAL_TIME_UPDATES_CHART_REVIEW.md)
- [WebSocket Architecture](./modules/integration/websocket-architecture.md)
- [Clinical Event System](./modules/integration/cross-module-integration.md)