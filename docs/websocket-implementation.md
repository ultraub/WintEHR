# WebSocket Implementation for Real-Time FHIR Updates

## Overview

This implementation provides real-time notifications for FHIR resource updates in the MedGenEMR system. It supports subscribing to specific resource types and patients, with automatic reconnection and message queuing.

## Architecture

### Backend Components

1. **WebSocket Connection Manager** (`backend/api/websocket/connection_manager.py`)
   - Manages WebSocket connections and subscriptions
   - Handles message routing and queuing
   - Implements heartbeat/ping-pong for connection health
   - Supports reconnection with message replay

2. **WebSocket Router** (`backend/api/websocket/websocket_router.py`)
   - FastAPI WebSocket endpoints
   - Optional authentication support
   - Client ID management for reconnection

3. **FHIR Notification Service** (`backend/api/websocket/fhir_notifications.py`)
   - Integrates with FHIR storage engine
   - Sends notifications for resource CRUD operations
   - Supports clinical event notifications

4. **Storage Integration**
   - Modified `FHIRStorageEngine` to send notifications on create/update/delete
   - Automatic patient ID extraction from resources

### Frontend Components

1. **WebSocket Client** (`frontend/src/services/websocket.js`)
   - Singleton WebSocket client with reconnection logic
   - Message queuing when disconnected
   - Subscription management
   - Heartbeat handling

2. **React Hooks** (`frontend/src/hooks/useWebSocket.js`)
   - `useWebSocket` - General purpose WebSocket subscription hook
   - `usePatientUpdates` - Patient-specific updates
   - `useClinicalEvents` - Clinical event subscriptions

3. **UI Components**
   - `RealTimeNotifications` - Notification center with badge
   - `RealTimeResultsIndicator` - Lab result notifications
   - `RealTimeOrderStatus` - Live order status updates

## Usage

### Backend Setup

1. Install WebSocket dependencies:
```bash
pip install -r requirements.txt
```

2. The WebSocket router is automatically included in main.py

### Frontend Setup

1. The WebSocket client connects automatically when a user logs in
2. Connection URL is determined from the current host or REACT_APP_API_URL

### Creating Subscriptions

```javascript
// Subscribe to all Observation updates for a patient
const { connected, lastUpdate } = useWebSocket({
  resourceTypes: ['Observation'],
  patientIds: ['patient-123'],
  enabled: true
});

// Subscribe to multiple resource types
const { connected, lastUpdate } = useWebSocket({
  resourceTypes: ['Observation', 'DiagnosticReport', 'ServiceRequest'],
  patientIds: ['patient-123']
});

// Subscribe to all updates for all patients
const { connected, lastUpdate } = useWebSocket({
  resourceTypes: ['*'],
  patientIds: []
});
```

### Handling Updates

```javascript
useEffect(() => {
  if (lastUpdate) {
    console.log('Resource updated:', {
      action: lastUpdate.action, // 'created', 'updated', 'deleted'
      resourceType: lastUpdate.resourceType,
      resourceId: lastUpdate.resourceId,
      resource: lastUpdate.resource // Full FHIR resource (null for deletions)
    });
  }
}, [lastUpdate]);
```

### Clinical Events

```javascript
// Subscribe to critical lab results
useClinicalEvents('critical_result', (event) => {
  console.log('Critical result:', event.details);
  // Show alert to user
});
```

## WebSocket Message Format

### Client to Server

```json
{
  "type": "subscribe",
  "data": {
    "subscription_id": "sub_123",
    "resource_types": ["Observation", "DiagnosticReport"],
    "patient_ids": ["patient-123"]
  }
}
```

### Server to Client

```json
{
  "type": "update",
  "data": {
    "action": "created",
    "resource_type": "Observation",
    "resource_id": "obs-123",
    "patient_id": "patient-123",
    "resource": { /* Full FHIR resource */ }
  },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Testing

Run the test script to generate sample notifications:

```bash
cd backend
python scripts/test_websocket_notifications.py
```

This will create test observations and diagnostic reports that trigger real-time updates.

## Security Considerations

1. **Authentication**: WebSocket connections can be authenticated using JWT tokens
2. **Authorization**: Subscriptions should be filtered based on user permissions
3. **Rate Limiting**: Consider implementing rate limits for subscriptions
4. **Message Size**: Large resources are included in full - consider pagination

## Performance Considerations

1. **Connection Pooling**: Each client maintains one WebSocket connection
2. **Message Queuing**: Up to 100 messages queued per disconnected client
3. **Subscription Limits**: Consider limiting subscriptions per client
4. **Database Load**: Notifications are sent asynchronously after commits

## Clinical Use Cases

1. **Critical Lab Results**: Immediate notification of critical values
2. **New Orders**: Real-time updates when orders are placed
3. **Result Availability**: Instant notification when lab results are ready
4. **Status Changes**: Live updates for order and procedure status
5. **Team Communication**: Real-time task and message updates

## Future Enhancements

1. **FHIR Subscriptions**: Implement full FHIR R4 Subscription resource
2. **Topic-Based Subscriptions**: Support for FHIR SubscriptionTopic
3. **Filtering**: Advanced filtering based on resource content
4. **Batching**: Combine multiple updates into single messages
5. **Persistence**: Store subscriptions in database for durability