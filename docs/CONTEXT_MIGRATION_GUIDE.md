# Context Migration Guide: Legacy API to FHIR

## Overview

This guide details the migration of React contexts from legacy API endpoints to FHIR resources, focusing on DocumentationContext, OrderContext, and TaskContext.

## 1. DocumentationContext Migration

### Current State (Legacy)
- **Endpoints**: `/api/clinical/notes/*`
- **Operations**: CRUD for clinical notes, templates, signing, addendums

### Target State (FHIR)
- **Resource**: `DocumentReference`
- **Endpoints**: `/fhir/R4/DocumentReference/*`

### Migration Steps

#### 1.1 Import Changes
```javascript
// Before
import api from '../services/api';

// After
import { fhirClient } from '../services/fhirClient';
```

#### 1.2 Data Transformation Functions
```javascript
// Transform legacy note to FHIR DocumentReference
const transformNoteToDocumentReference = (note) => {
  return {
    resourceType: 'DocumentReference',
    id: note.id,
    status: note.status === 'final' ? 'current' : 'preliminary',
    docStatus: note.status,
    type: {
      coding: [{
        system: 'http://loinc.org',
        code: getNoteTypeCode(note.noteType),
        display: getNoteTypeDisplay(note.noteType)
      }]
    },
    category: [{
      coding: [{
        system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
        code: 'clinical-note'
      }]
    }],
    subject: {
      reference: `Patient/${note.patientId}`
    },
    encounter: note.encounterId ? {
      reference: `Encounter/${note.encounterId}`
    } : undefined,
    date: note.createdAt,
    author: [{
      reference: `Practitioner/${note.createdBy}`
    }],
    content: [{
      attachment: {
        contentType: 'text/plain',
        data: btoa(JSON.stringify(note.content)), // Base64 encode
        title: note.title || `${note.noteType} Note`
      }
    }]
  };
};

// Transform FHIR DocumentReference to legacy format
const transformDocumentReferenceToNote = (docRef) => {
  const content = docRef.content?.[0]?.attachment?.data 
    ? JSON.parse(atob(docRef.content[0].attachment.data))
    : {};
    
  return {
    id: docRef.id,
    patientId: docRef.subject?.reference?.split('/')[1],
    encounterId: docRef.encounter?.reference?.split('/')[1],
    noteType: mapCodeToNoteType(docRef.type?.coding?.[0]?.code),
    content: content,
    createdBy: docRef.author?.[0]?.reference?.split('/')[1],
    createdAt: docRef.date,
    status: docRef.docStatus || 'draft',
    title: docRef.content?.[0]?.attachment?.title
  };
};
```

#### 1.3 API Call Updates
```javascript
// Load recent notes
const loadRecentNotes = async (patientId) => {
  try {
    const bundle = await fhirClient.search('DocumentReference', {
      patient: patientId,
      _sort: '-date',
      _count: 10
    });
    
    const notes = bundle.entry?.map(entry => 
      transformDocumentReferenceToNote(entry.resource)
    ) || [];
    
    setRecentNotes(notes);
  } catch (error) {
    console.error('Error loading recent notes:', error);
  }
};

// Save note
const saveNote = async () => {
  try {
    setIsSaving(true);
    const docRef = transformNoteToDocumentReference(currentNote);
    
    let result;
    if (currentNote.id) {
      result = await fhirClient.update('DocumentReference', currentNote.id, docRef);
    } else {
      result = await fhirClient.create('DocumentReference', docRef);
    }
    
    const savedNote = transformDocumentReferenceToNote(result);
    setCurrentNote(savedNote);
    setIsDirty(false);
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  } finally {
    setIsSaving(false);
  }
};
```

## 2. OrderContext Migration

### Current State (Legacy)
- **Endpoints**: `/api/clinical/orders/*`
- **Operations**: Create orders, manage active orders, order sets

### Target State (FHIR)
- **Resources**: `ServiceRequest` (labs/imaging), `MedicationRequest` (medications)
- **Endpoints**: `/fhir/R4/ServiceRequest/*`, `/fhir/R4/MedicationRequest/*`

### Migration Steps

#### 2.1 Data Transformation Functions
```javascript
// Transform legacy order to FHIR ServiceRequest
const transformOrderToServiceRequest = (order) => {
  return {
    resourceType: 'ServiceRequest',
    id: order.id,
    status: order.status,
    intent: 'order',
    priority: order.priority || 'routine',
    category: [{
      coding: [{
        system: 'http://snomed.info/sct',
        code: order.orderType === 'laboratory' ? '108252007' : '363679005',
        display: order.orderType === 'laboratory' ? 'Laboratory procedure' : 'Imaging'
      }]
    }],
    code: {
      coding: [{
        system: order.codeSystem || 'http://loinc.org',
        code: order.code,
        display: order.display
      }]
    },
    subject: {
      reference: `Patient/${order.patientId}`
    },
    encounter: order.encounterId ? {
      reference: `Encounter/${order.encounterId}`
    } : undefined,
    requester: {
      reference: `Practitioner/${order.orderedBy}`
    },
    authoredOn: order.orderedAt,
    note: order.instructions ? [{
      text: order.instructions
    }] : undefined
  };
};

// Transform FHIR ServiceRequest to legacy format
const transformServiceRequestToOrder = (serviceRequest) => {
  const category = serviceRequest.category?.[0]?.coding?.[0];
  return {
    id: serviceRequest.id,
    patientId: serviceRequest.subject?.reference?.split('/')[1],
    encounterId: serviceRequest.encounter?.reference?.split('/')[1],
    orderType: category?.code === '108252007' ? 'laboratory' : 'imaging',
    code: serviceRequest.code?.coding?.[0]?.code,
    display: serviceRequest.code?.coding?.[0]?.display,
    status: serviceRequest.status,
    priority: serviceRequest.priority,
    orderedBy: serviceRequest.requester?.reference?.split('/')[1],
    orderedAt: serviceRequest.authoredOn,
    instructions: serviceRequest.note?.[0]?.text
  };
};
```

#### 2.2 API Call Updates
```javascript
// Load active orders
const loadActiveOrders = async (patientId) => {
  try {
    // Load ServiceRequests (labs/imaging)
    const serviceRequests = await fhirClient.search('ServiceRequest', {
      patient: patientId,
      status: 'active,on-hold'
    });
    
    // Load MedicationRequests
    const medicationRequests = await fhirClient.search('MedicationRequest', {
      patient: patientId,
      status: 'active,on-hold'
    });
    
    const labOrders = serviceRequests.entry?.filter(entry => 
      entry.resource.category?.[0]?.coding?.[0]?.code === '108252007'
    ).map(entry => transformServiceRequestToOrder(entry.resource)) || [];
    
    const imagingOrders = serviceRequests.entry?.filter(entry =>
      entry.resource.category?.[0]?.coding?.[0]?.code === '363679005'
    ).map(entry => transformServiceRequestToOrder(entry.resource)) || [];
    
    const medicationOrders = medicationRequests.entry?.map(entry =>
      transformMedicationRequestToOrder(entry.resource)
    ) || [];
    
    setActiveOrders({
      medications: medicationOrders,
      laboratory: labOrders,
      imaging: imagingOrders
    });
  } catch (error) {
    console.error('Error loading active orders:', error);
  }
};
```

## 3. TaskContext Migration

### Current State (Legacy)
- **Endpoints**: `/api/clinical/tasks/*`, `/api/clinical/inbox/*`
- **Operations**: Task management, inbox items, care team

### Target State (FHIR)
- **Resources**: `Task`, `Communication`, `CareTeam`
- **Endpoints**: `/fhir/R4/Task/*`, `/fhir/R4/Communication/*`

### Migration Steps

#### 3.1 Data Transformation Functions
```javascript
// Transform legacy task to FHIR Task
const transformTaskToFHIRTask = (task) => {
  return {
    resourceType: 'Task',
    id: task.id,
    status: mapTaskStatus(task.status),
    intent: 'order',
    priority: task.priority === 'high' ? 'urgent' : task.priority,
    code: {
      coding: [{
        system: 'http://medgenemr.com/task-types',
        code: task.taskType,
        display: task.taskTypeDisplay
      }]
    },
    description: task.description,
    for: task.patientId ? {
      reference: `Patient/${task.patientId}`
    } : undefined,
    owner: task.assignedTo ? {
      reference: `Practitioner/${task.assignedTo}`
    } : undefined,
    requester: task.createdBy ? {
      reference: `Practitioner/${task.createdBy}`
    } : undefined,
    restriction: {
      period: {
        end: task.dueDate
      }
    },
    note: task.notes?.map(note => ({
      text: note.text,
      time: note.createdAt,
      authorReference: {
        reference: `Practitioner/${note.createdBy}`
      }
    }))
  };
};

// Transform FHIR Task to legacy format
const transformFHIRTaskToTask = (fhirTask) => {
  return {
    id: fhirTask.id,
    status: mapFHIRTaskStatus(fhirTask.status),
    priority: fhirTask.priority === 'urgent' ? 'high' : fhirTask.priority,
    taskType: fhirTask.code?.coding?.[0]?.code,
    taskTypeDisplay: fhirTask.code?.coding?.[0]?.display,
    description: fhirTask.description,
    patientId: fhirTask.for?.reference?.split('/')[1],
    assignedTo: fhirTask.owner?.reference?.split('/')[1],
    createdBy: fhirTask.requester?.reference?.split('/')[1],
    dueDate: fhirTask.restriction?.period?.end,
    notes: fhirTask.note?.map(note => ({
      text: note.text,
      createdAt: note.time,
      createdBy: note.authorReference?.reference?.split('/')[1]
    }))
  };
};
```

## 4. Common Patterns and Best Practices

### 4.1 Error Handling
```javascript
const handleFHIRError = (error) => {
  if (error.response?.data?.issue) {
    // FHIR OperationOutcome
    const issue = error.response.data.issue[0];
    return {
      severity: issue.severity,
      code: issue.code,
      details: issue.diagnostics || issue.details?.text
    };
  }
  return {
    severity: 'error',
    code: 'unknown',
    details: error.message
  };
};
```

### 4.2 Bundle Response Handling
```javascript
const extractResourcesFromBundle = (bundle) => {
  if (!bundle || bundle.resourceType !== 'Bundle') {
    return [];
  }
  return bundle.entry?.map(entry => entry.resource) || [];
};
```

### 4.3 Reference Resolution
```javascript
const resolveReference = (reference) => {
  if (!reference) return null;
  const parts = reference.split('/');
  return {
    resourceType: parts[0],
    id: parts[1]
  };
};
```

## 5. Testing Checklist

- [ ] All CRUD operations work correctly
- [ ] Search functionality returns expected results
- [ ] Data transformations preserve all required fields
- [ ] Error handling provides meaningful feedback
- [ ] Performance is acceptable
- [ ] No legacy API calls remain
- [ ] UI displays data correctly
- [ ] Offline functionality (if applicable) still works

## 6. Rollback Plan

If issues arise during migration:
1. Keep legacy context files backed up
2. Use feature flags to toggle between implementations
3. Maintain data transformation functions for backward compatibility
4. Have database rollback scripts ready

## 7. Performance Considerations

### Optimization Strategies:
1. **Batch Operations**: Use FHIR transaction bundles for multiple operations
2. **Selective Fields**: Use `_elements` parameter to fetch only needed fields
3. **Pagination**: Implement proper pagination for large result sets
4. **Caching**: Cache frequently accessed resources (e.g., templates, providers)
5. **Includes**: Use `_include` to reduce number of API calls

### Example Optimized Query:
```javascript
const bundle = await fhirClient.search('DocumentReference', {
  patient: patientId,
  _sort: '-date',
  _count: 20,
  _elements: 'id,status,type,date,author',
  _include: 'DocumentReference:author'
});
```