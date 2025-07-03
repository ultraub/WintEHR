# Frontend FHIR Migration & Clinical Workspace Fix Plan

## Overview

This document outlines the plan to complete the FHIR migration for the frontend components, with a focus on making the Clinical Workspace fully functional.

## 1. FHIR API Implementation Status Review

Based on review of the backend implementation, the FHIR API includes:
- ✅ All basic CRUD operations (Create, Read, Update, Delete)
- ✅ Search with parameters, modifiers, includes
- ✅ Transaction/batch support
- ✅ History tracking
- ✅ Conditional operations support declared in CapabilityStatement
- ⚠️ Conditional operations implementation needs verification

### HL7 FHIR R4 Compliance Check:
- The implementation declares support for conditional operations in CapabilityStatement
- Need to verify actual implementation of conditional create/update/delete/patch

## 2. Frontend Pages Priority Fix List

### High Priority - Clinical Workspace Dependencies:
1. **DocumentationContext.js** - Migrate from `/api/clinical/notes/` to FHIR `DocumentReference`
2. **OrderContext.js** - Migrate from `/api/clinical/orders/` to FHIR `ServiceRequest`/`MedicationRequest`
3. **TaskContext.js** - Migrate from `/api/clinical/tasks/` to FHIR `Task` resource

### Medium Priority - Broken Pages:
1. **Dashboard.js** - Mixed implementation, needs full FHIR migration
2. **Analytics.js** - Complete legacy API usage, needs FHIR aggregation queries
3. **QualityMeasures.js** - Legacy API, needs FHIR-based calculations

### Low Priority - Already Working:
- PatientList ✅
- PatientDetail ✅
- FHIRExplorer ✅
- CDSDemo ✅

## 3. Clinical Workspace Fix Plan

### Step 1: Add Missing FHIR Resources to Backend
- Add `DocumentReference` resource support for clinical notes
- Add `ServiceRequest` resource support for lab/imaging orders
- Add `Task` resource support for clinical tasks
- Add `Communication` resource support for inbox items
- Add converters for legacy data migration

### Step 2: Update Frontend Contexts
- Migrate DocumentationContext to use FHIR DocumentReference
- Migrate OrderContext to use FHIR ServiceRequest/MedicationRequest
- Migrate TaskContext to use FHIR Task
- Create InboxContext using FHIR Communication/Task

### Step 3: Fix Data Transformations
- Create transformation functions for each FHIR resource type
- Handle FHIR bundle responses properly
- Map legacy UI field names to FHIR properties

### Step 4: Update Components
- Update DocumentationTab to handle FHIR DocumentReference format
- Update OrdersTab to handle FHIR ServiceRequest format
- Update TasksTab to handle FHIR Task format
- Fix any broken references in child components

## 4. Implementation Order

1. **Backend FHIR Resources** (Priority 1)
   - Add DocumentReference, ServiceRequest, Task resources
   - Add search parameter support
   - Test with sample data

2. **Context Migration** (Priority 2)
   - DocumentationContext → FHIR DocumentReference
   - OrderContext → FHIR ServiceRequest/MedicationRequest
   - TaskContext → FHIR Task
   - Add proper error handling

3. **Component Updates** (Priority 3)
   - Update all tabs in Clinical Workspace
   - Fix data display issues
   - Test all CRUD operations

4. **Dashboard & Analytics** (Priority 4)
   - Migrate Dashboard to full FHIR
   - Create FHIR-based analytics queries
   - Update quality measures calculations

## 5. FHIR Resource Mappings

### DocumentReference (Clinical Notes)
```javascript
// Legacy format
{
  id: "note-123",
  patientId: "patient-123",
  encounterId: "encounter-123",
  noteType: "progress",
  content: { subjective: "...", objective: "...", assessment: "...", plan: "..." },
  createdBy: "provider-123",
  createdAt: "2024-01-01T10:00:00Z",
  status: "final"
}

// FHIR DocumentReference format
{
  resourceType: "DocumentReference",
  id: "note-123",
  status: "current",
  type: {
    coding: [{
      system: "http://loinc.org",
      code: "11506-3",
      display: "Progress note"
    }]
  },
  subject: { reference: "Patient/patient-123" },
  encounter: { reference: "Encounter/encounter-123" },
  author: [{ reference: "Practitioner/provider-123" }],
  date: "2024-01-01T10:00:00Z",
  content: [{
    attachment: {
      contentType: "text/plain",
      data: "base64-encoded-content"
    }
  }]
}
```

### ServiceRequest (Lab/Imaging Orders)
```javascript
// Legacy format
{
  id: "order-123",
  patientId: "patient-123",
  orderType: "laboratory",
  code: "CBC",
  status: "active",
  orderedBy: "provider-123",
  orderedAt: "2024-01-01T10:00:00Z"
}

// FHIR ServiceRequest format
{
  resourceType: "ServiceRequest",
  id: "order-123",
  status: "active",
  intent: "order",
  category: [{
    coding: [{
      system: "http://snomed.info/sct",
      code: "108252007",
      display: "Laboratory procedure"
    }]
  }],
  code: {
    coding: [{
      system: "http://loinc.org",
      code: "58410-2",
      display: "Complete blood count"
    }]
  },
  subject: { reference: "Patient/patient-123" },
  requester: { reference: "Practitioner/provider-123" },
  authoredOn: "2024-01-01T10:00:00Z"
}
```

### Task (Clinical Tasks)
```javascript
// Legacy format
{
  id: "task-123",
  patientId: "patient-123",
  assignedTo: "provider-123",
  priority: "high",
  description: "Review lab results",
  status: "pending",
  dueDate: "2024-01-02"
}

// FHIR Task format
{
  resourceType: "Task",
  id: "task-123",
  status: "requested",
  intent: "order",
  priority: "urgent",
  for: { reference: "Patient/patient-123" },
  owner: { reference: "Practitioner/provider-123" },
  description: "Review lab results",
  restriction: {
    period: {
      end: "2024-01-02"
    }
  }
}
```

## 6. Testing Plan

### Unit Testing
- Test all FHIR resource transformations
- Test CRUD operations for each resource type
- Test search parameter construction

### Integration Testing
- Test Clinical Workspace with all tabs
- Verify data flow from backend to UI
- Test error scenarios

### User Acceptance Testing
- Clinical workflow scenarios
- Data entry and retrieval
- Search and filtering
- Performance testing

## 7. Success Criteria

- Clinical Workspace fully functional with all tabs working
- No legacy API calls remaining (only `/fhir/R4/*` calls)
- All data properly displayed and editable
- Search and filtering working correctly
- Error handling in place
- Performance acceptable (< 1s for most operations)

## 8. Timeline

- Week 1: Backend FHIR resources and context migration
- Week 2: Component updates and testing
- Week 3: Dashboard/Analytics migration and final testing

## 9. Risks and Mitigation

### Risk 1: Data Migration Complexity
- **Mitigation**: Create comprehensive transformation functions with unit tests

### Risk 2: Performance Issues with FHIR Bundles
- **Mitigation**: Implement pagination and optimize search parameters

### Risk 3: Breaking Changes for Users
- **Mitigation**: Maintain backward compatibility during transition

## 10. Next Steps

1. Implement backend FHIR resources (DocumentReference, ServiceRequest, Task)
2. Begin context migration starting with DocumentationContext
3. Update components to handle FHIR data formats
4. Comprehensive testing of Clinical Workspace
5. Deploy and monitor for issues