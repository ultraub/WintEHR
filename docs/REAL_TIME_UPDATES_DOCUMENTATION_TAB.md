# Real-Time Updates - Documentation Tab Implementation

## Overview
The Documentation Tab now supports real-time updates for clinical notes and documents. When notes are created, updated, signed, or amended by any user, all other users viewing the same patient will see the changes immediately.

**Implementation Date**: 2025-08-04

## Features Implemented

### 1. Event Subscriptions
The Documentation Tab subscribes to the following clinical events:
- `NOTE_CREATED` - New notes appear immediately
- `NOTE_UPDATED` - Note content updates in real-time
- `NOTE_SIGNED` - Signed status updates instantly
- `NOTE_AMENDED` - Amendments appear immediately
- `NOTE_ADDENDUM` - Addendums show up in real-time
- `DOCUMENT_UPLOADED` - New documents appear instantly

### 2. WebSocket Room Subscription
- Subscribes to patient room for multi-user synchronization
- Resource types monitored: `DocumentReference`, `Composition`, `ClinicalImpression`
- Updates from other users viewing the same patient appear instantly

### 3. Visual Notifications
- Snackbar notifications for all document events
- Different severity levels based on event type
- Clear messages indicating what changed

## Implementation Details

### Code Changes in DocumentationTabEnhanced.js

1. **Added WebSocket import**:
```javascript
import websocketService from '../../../../services/websocket';
```

2. **Added subscribe to useClinicalWorkflow**:
```javascript
const { publish, subscribe } = useClinicalWorkflow();
```

3. **Document update handler**:
```javascript
const handleDocumentUpdate = useCallback((eventType, eventData) => {
  const document = eventData.document || eventData.note || eventData.resource;
  
  if (!document) {
    console.warn('[DocumentationTab] No document in event data');
    return;
  }

  // Refresh documents to get the update
  loadDocuments();

  // Show notification based on event type
  switch (eventType) {
    case CLINICAL_EVENTS.NOTE_CREATED:
      setSnackbar({
        open: true,
        message: `New note created: ${document.type?.text || 'Clinical Note'}`,
        severity: 'info'
      });
      break;
    // ... other cases
  }
}, [patientId, loadDocuments]);
```

4. **Event subscriptions**:
```javascript
useEffect(() => {
  const documentEvents = [
    CLINICAL_EVENTS.NOTE_CREATED,
    CLINICAL_EVENTS.NOTE_UPDATED,
    CLINICAL_EVENTS.NOTE_SIGNED,
    CLINICAL_EVENTS.NOTE_AMENDED,
    CLINICAL_EVENTS.NOTE_ADDENDUM,
    CLINICAL_EVENTS.DOCUMENT_UPLOADED
  ];

  documentEvents.forEach(eventType => {
    const unsubscribe = subscribe(eventType, (event) => {
      if (event.patientId === patientId) {
        handleDocumentUpdate(eventType, event);
      }
    });
    subscriptions.push(unsubscribe);
  });
}, [patientId, subscribe, handleDocumentUpdate]);
```

5. **WebSocket patient room subscription**:
```javascript
useEffect(() => {
  if (!patientId || !websocketService.isConnected) return;
  
  const setupPatientSubscription = async () => {
    const resourceTypes = [
      'DocumentReference',
      'Composition',
      'ClinicalImpression'
    ];
    
    subscriptionId = await websocketService.subscribeToPatient(patientId, resourceTypes);
  };
  
  setupPatientSubscription();
}, [patientId]);
```

## Key Features

### 1. Tree View Updates
- New documents appear in the appropriate category
- Document counts update in real-time
- Tree remains expanded/collapsed as user configured

### 2. Notification Types
- **Note Created**: Info notification with note type
- **Note Signed**: Success notification
- **Note Updated**: Info notification
- **Note Amended**: Warning notification (important change)
- **Note Addendum**: Info notification
- **Document Uploaded**: Info notification

### 3. Multi-User Awareness
- Changes made by one user immediately visible to all users
- No conflicts when multiple users create notes simultaneously
- Document list stays synchronized across all clients

## Testing Scenarios

### Manual Testing
1. Open Documentation tab in two browser windows
2. Create a new note in one window
3. Verify note appears in the other window immediately
4. Sign a note and verify status updates
5. Add an addendum and verify it appears
6. Upload a document and verify it shows up

### Test Cases
- New note creation appears in tree view
- Note signing changes icon from unsigned to signed
- Note amendments show warning notification
- Addendums appear under original note
- Document uploads appear in correct category
- Filter and search state preserved during updates

## Future Enhancements

1. **Incremental Updates**:
```javascript
// Instead of full refresh, update state incrementally
const handleDocumentUpdate = (eventType, document) => {
  switch (eventType) {
    case CLINICAL_EVENTS.NOTE_CREATED:
      setDocumentReferences(prev => [document, ...prev]);
      break;
    case CLINICAL_EVENTS.NOTE_UPDATED:
      setDocumentReferences(prev => 
        prev.map(doc => doc.id === document.id ? document : doc)
      );
      break;
  }
};
```

2. **User Attribution**:
- Show who created/modified the note
- "Dr. Smith is currently editing this note"
- Lock notes being edited by others

3. **Real-Time Collaboration**:
- Show cursor positions of other users
- Collaborative editing with conflict resolution
- Comments and annotations

4. **Version History**:
- Show real-time version updates
- Compare versions side-by-side
- Rollback capabilities

## Performance Considerations

1. **Current Implementation**: Uses `loadDocuments()` to refresh all documents
2. **Optimization Needed**: Implement incremental state updates
3. **Caching**: Cache document content to reduce API calls
4. **Pagination**: Handle large document lists efficiently

## Backend Requirements

The backend should broadcast events when:
1. Clinical notes are created
2. Notes are updated or edited
3. Notes are signed by providers
4. Amendments are made to notes
5. Addendums are added
6. Documents are uploaded

Example backend broadcast:
```python
# When note is created
await manager.broadcast_to_room(
    f"patient:{patient_id}",
    {
        "type": "update",
        "data": {
            "event_type": "NOTE_CREATED",
            "document": document_reference,
            "patient_id": patient_id
        }
    }
)

# When note is signed
await manager.broadcast_to_room(
    f"patient:{patient_id}",
    {
        "type": "update", 
        "data": {
            "event_type": "NOTE_SIGNED",
            "document": signed_document,
            "patient_id": patient_id,
            "signed_by": practitioner_id
        }
    }
)
```

## Integration Points

- **Note Editor**: Should publish events when saving/signing
- **Document Upload**: Should publish DOCUMENT_UPLOADED event
- **Amendment Dialog**: Should publish NOTE_AMENDED event
- **Addendum Feature**: Should publish NOTE_ADDENDUM event

---

**Related Documentation**:
- [Real-Time Updates Architecture](./REAL_TIME_UPDATES_ARCHITECTURE.md)
- [Implementation Guide](./REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md)
- [Chart Review Implementation](./MULTI_USER_SYNC_IMPLEMENTATION.md)