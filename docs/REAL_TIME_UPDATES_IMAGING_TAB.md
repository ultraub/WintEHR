# Real-Time Updates - Imaging Tab Implementation

## Overview
The Imaging Tab now supports real-time updates for medical imaging studies and reports. When imaging studies are completed, reports are generated, or study status changes, all users viewing the same patient will see the updates immediately.

**Implementation Date**: 2025-08-04

## Features Implemented

### 1. Event Subscriptions
The Imaging Tab subscribes to the following clinical events:
- `IMAGING_STUDY_AVAILABLE` - New imaging study is ready for viewing
- `IMAGING_STUDY_UPDATED` - Study metadata or status updated
- `IMAGING_REPORT_READY` - Radiologist report is available
- `ORDER_PLACED` (type: imaging) - New imaging order placed
- `RESULT_RECEIVED` (type: imaging) - Imaging results available

### 2. WebSocket Room Subscription
- Subscribes to patient room for multi-user synchronization
- Resource types monitored: `ImagingStudy`, `DiagnosticReport`, `ServiceRequest`
- Updates from other users viewing the same patient appear instantly

### 3. Visual Notifications
- Snackbar notifications for all imaging events
- Different severity levels based on event type
- Clear messages indicating what changed

## Implementation Details

### Code Changes in ImagingTab.js

1. **Added WebSocket import**:
```javascript
import websocketService from '../../../../services/websocket';
```

2. **Added imaging event constants**:
```javascript
// In clinicalEvents.js
IMAGING_STUDY_AVAILABLE: 'imaging.study.available',
IMAGING_STUDY_UPDATED: 'imaging.study.updated',
IMAGING_REPORT_READY: 'imaging.report.ready',
IMAGING_STUDY_VIEWED: 'imaging.study.viewed',
```

3. **Imaging update handler**:
```javascript
const handleImagingUpdate = useCallback((eventType, eventData) => {
  const study = eventData.study || eventData.imagingStudy || eventData.resource;
  
  if (!study) {
    console.warn('[ImagingTab] No study in event data');
    return;
  }

  // Refresh studies to get the update
  loadImagingStudies();

  // Show notification based on event type
  switch (eventType) {
    case CLINICAL_EVENTS.IMAGING_STUDY_AVAILABLE:
      setSnackbar({
        open: true,
        message: `New imaging study available: ${study.description || 'Imaging Study'}`,
        severity: 'success'
      });
      break;
    // ... other cases
  }
}, [loadImagingStudies]);
```

4. **Event subscriptions**:
```javascript
useEffect(() => {
  const imagingEvents = [
    CLINICAL_EVENTS.IMAGING_STUDY_AVAILABLE,
    CLINICAL_EVENTS.IMAGING_STUDY_UPDATED,
    CLINICAL_EVENTS.IMAGING_REPORT_READY,
    CLINICAL_EVENTS.ORDER_PLACED,
    CLINICAL_EVENTS.RESULT_RECEIVED
  ];

  imagingEvents.forEach(eventType => {
    const unsubscribe = subscribe(eventType, (event) => {
      if (event.patientId === patientId) {
        handleImagingUpdate(eventType, event);
      }
    });
    subscriptions.push(unsubscribe);
  });
}, [patientId, subscribe, handleImagingUpdate]);
```

5. **WebSocket patient room subscription**:
```javascript
useEffect(() => {
  if (!patientId || !websocketService.isConnected) return;
  
  const setupPatientSubscription = async () => {
    const resourceTypes = [
      'ImagingStudy',
      'DiagnosticReport', // For imaging reports
      'ServiceRequest'    // For imaging orders
    ];
    
    subscriptionId = await websocketService.subscribeToPatient(patientId, resourceTypes);
  };
  
  setupPatientSubscription();
}, [patientId]);
```

## Key Features

### 1. Gallery View Updates
- New studies appear in the gallery automatically
- Study counts update in real-time
- Filter and view mode preserved during updates

### 2. Body Map Integration
- Region study counts update automatically
- Visual indicators for new studies per body region
- Smooth transitions when new studies arrive

### 3. Notification Types
- **Study Available**: Success notification with study description
- **Report Ready**: Info notification when report is completed
- **Study Updated**: Info notification for metadata changes
- **Order Placed**: Info notification for new imaging orders
- **Results Available**: Success notification when results ready

### 4. Multi-User Awareness
- Changes made by radiologists immediately visible to clinicians
- Study completion updates across all viewers
- Report availability synchronized instantly

## Testing Scenarios

### Manual Testing
1. Open Imaging tab in two browser windows
2. Complete an imaging study in PACS/RIS
3. Verify study appears in both windows
4. Generate a radiology report
5. Verify report ready notification appears
6. Update study metadata
7. Verify changes appear in all windows

### Test Cases
- New study appears in gallery view
- Body map region counts update
- Report ready indicator appears on study card
- Status changes reflect immediately
- Filter state preserved during updates
- DICOM viewer can open new studies

## Future Enhancements

1. **Incremental Updates**:
```javascript
// Instead of full refresh, update state incrementally
const handleImagingUpdate = (eventType, study) => {
  switch (eventType) {
    case CLINICAL_EVENTS.IMAGING_STUDY_AVAILABLE:
      setStudies(prev => [study, ...prev]);
      break;
    case CLINICAL_EVENTS.IMAGING_STUDY_UPDATED:
      setStudies(prev => 
        prev.map(s => s.id === study.id ? study : s)
      );
      break;
  }
};
```

2. **Real-Time Progress**:
- Show study processing progress
- "Images being processed: 45/120"
- Live updates during acquisition

3. **Collaborative Features**:
- Show who's viewing the study
- "Dr. Smith is reviewing this study"
- Shared annotations and measurements

4. **Priority Notifications**:
- Critical findings alert all team members
- STAT study completion notifications
- Abnormal findings broadcast

## Performance Considerations

1. **Current Implementation**: Uses `loadImagingStudies()` to refresh all studies
2. **Optimization Needed**: Implement incremental state updates
3. **Caching**: Cache study metadata and thumbnails
4. **Pagination**: Handle large study lists efficiently

## Backend Requirements

The backend should broadcast events when:
1. Imaging study is marked complete in PACS
2. DICOM images are available for viewing
3. Radiology report is finalized
4. Study metadata is updated
5. Study is cancelled or rescheduled

Example backend broadcast:
```python
# When study is available
await manager.broadcast_to_room(
    f"patient:{patient_id}",
    {
        "type": "update",
        "data": {
            "event_type": "IMAGING_STUDY_AVAILABLE",
            "study": imaging_study,
            "patient_id": patient_id
        }
    }
)

# When report is ready
await manager.broadcast_to_room(
    f"patient:{patient_id}",
    {
        "type": "update", 
        "data": {
            "event_type": "IMAGING_REPORT_READY",
            "study": imaging_study,
            "report": diagnostic_report,
            "patient_id": patient_id
        }
    }
)
```

## Integration Points

- **PACS Integration**: Should trigger IMAGING_STUDY_AVAILABLE when images ready
- **RIS Integration**: Should trigger IMAGING_REPORT_READY when report finalized
- **Order System**: Should trigger ORDER_PLACED for new imaging orders
- **DICOM Viewer**: Should publish IMAGING_STUDY_VIEWED when opened

---

**Related Documentation**:
- [Real-Time Updates Architecture](./REAL_TIME_UPDATES_ARCHITECTURE.md)
- [Implementation Guide](./REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md)
- [Implementation Summary](./REAL_TIME_UPDATES_IMPLEMENTATION_SUMMARY.md)