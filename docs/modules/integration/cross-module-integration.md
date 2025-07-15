# Cross-Module Integration Guide

## Overview
This guide documents how WintEHR's modules work together to provide a cohesive electronic medical records system. It covers integration patterns, data flows, event orchestration, and best practices for module interaction.

## Module Dependency Map
```
Frontend Modules
├── Clinical Workspace Module
│   ├── depends on → Services Module
│   ├── depends on → Contexts Module
│   ├── depends on → Hooks Module
│   └── depends on → Common Components Module
├── Services Module
│   └── communicates with → Backend APIs
├── Contexts Module
│   ├── uses → Services Module
│   └── provides state to → All Frontend Modules
└── Hooks Module
    ├── uses → Contexts Module
    └── uses → Services Module

Backend Modules
├── FHIR API Module
│   ├── depends on → Core Infrastructure
│   ├── depends on → Authentication Module
│   └── stores data via → Database Layer
├── Clinical Services Module
│   ├── depends on → FHIR API Module
│   ├── depends on → Authentication Module
│   └── integrates with → External Systems
├── CDS Hooks Module
│   ├── depends on → FHIR API Module
│   ├── depends on → Clinical Services Module
│   ├── evaluates → Clinical Rules
│   └── integrates with → Clinical Workflows
├── Clinical Workflow Engine (NEW)
│   ├── orchestrates → Document-Communication-Task workflows
│   ├── depends on → FHIR API Module
│   ├── manages → Resource Relationships
│   └── synchronizes → Workflow Status
├── Data Management Module
│   ├── uses → FHIR API Module
│   └── manages → Database Operations
└── Core Infrastructure Module
    └── provides foundation for → All Backend Modules
```

## Key Integration Flows

### 1. Patient Data Loading Flow
**Scenario**: User selects a patient in the UI

```
1. PatientSearch Component
   ↓ (user selects patient)
2. PatientContext.setPatient()
   ↓ (context update)
3. FHIRResourceContext.loadPatientResources()
   ↓ (service call)
4. fhirService.getPatientResources()
   ↓ (HTTP request)
5. FHIR API Module (/fhir/R4/Patient/{id})
   ↓ (database query)
6. FHIRStorage.read()
   ↓ (returns data)
7. Response flows back up the chain
   ↓
8. All components re-render with new data
```

**Code Example**:
```javascript
// Frontend: Patient selection
const handlePatientSelect = async (patientId) => {
  // Update context
  await setCurrentPatient(patientId);
  
  // This triggers automatic resource loading via context
  // All child components receive updated data
};

// Context: Automatic resource loading
useEffect(() => {
  if (currentPatientId) {
    loadPatientResources(currentPatientId);
  }
}, [currentPatientId]);

// Backend: FHIR endpoint
@router.get("/Patient/{patient_id}")
async def get_patient(patient_id: str, db: AsyncSession = Depends(get_db)):
    storage = FHIRStorage(db)
    patient = await storage.read("Patient", patient_id)
    return patient
```

### 2. Clinical Order Workflow
**Scenario**: Physician places a lab order

```
1. OrdersTab Component
   ↓ (create order)
2. OrderDialog → fhirService.createServiceRequest()
   ↓ (HTTP POST)
3. FHIR API → Create ServiceRequest
   ↓ (validate & store)
4. Clinical Services → Process order
   ↓ (additional logic)
5. ClinicalWorkflowContext.publish(ORDER_PLACED)
   ↓ (event broadcast)
6. ResultsTab subscribes to event
   ↓ (prepares for results)
7. WebSocket notification sent
   ↓
8. Real-time UI updates across tabs
```

**Integration Code**:
```javascript
// Frontend: Place order
const placeOrder = async (orderData) => {
  // Create FHIR ServiceRequest
  const order = await fhirService.createServiceRequest({
    ...orderData,
    subject: { reference: `Patient/${patientId}` },
    status: "active"
  });
  
  // Publish workflow event
  publish(CLINICAL_EVENTS.ORDER_PLACED, {
    orderId: order.id,
    orderType: orderData.category,
    priority: orderData.priority
  });
  
  // UI will auto-update via context
};

// Backend: Order processing
async def create_order(order_data: dict, db: AsyncSession):
    # Create FHIR resource
    service_request = await fhir_storage.create("ServiceRequest", order_data)
    
    # Additional processing
    if order_data["category"][0]["coding"][0]["code"] == "laboratory":
        await lab_service.initialize_lab_order(service_request)
    
    # Send real-time notification
    await websocket_manager.notify_order_created(service_request)
    
    return service_request
```

### 3. Medication Dispensing Flow
**Scenario**: Pharmacist dispenses medication

```
1. PharmacyTab displays pending prescriptions
   ↓ (fetched via pharmacyService)
2. Pharmacist verifies prescription
   ↓ (UI interaction)
3. pharmacyService.dispenseMedication()
   ↓ (creates MedicationDispense)
4. FHIR API creates resource
   ↓ (links to MedicationRequest)
5. ClinicalWorkflowContext.publish(MEDICATION_DISPENSED)
   ↓ (event broadcast)
6. ChartReviewTab receives event
   ↓ (updates medication status)
7. MedicationsTab refreshes
   ↓ (shows dispensed status)
8. Patient notification sent
```

### 4. Lab Result Integration
**Scenario**: Lab result becomes available

```
1. External lab system sends result
   ↓ (HL7 or API)
2. Lab Integration Service processes
   ↓ (creates Observation)
3. FHIR API stores Observation
   ↓ (links to ServiceRequest)
4. Reference range checking
   ↓ (flag abnormals)
5. WebSocket notification
   ↓ (RESULT_RECEIVED event)
6. ResultsTab receives notification
   ↓ (auto-refreshes)
7. If abnormal, trigger alert
   ↓ (highlight in UI)
8. Update order status
```

### 5. CDS Hooks Integration Flow
**Scenario**: Clinical decision support triggers during workflow

```
1. Clinical Action (e.g., open patient, prescribe medication)
   ↓ (hook trigger)
2. CDS Hooks Client prepares context
   ↓ (patient, user, encounter data)
3. CDS Service evaluates rules
   ↓ (checks conditions)
4. Hook matches conditions
   ↓ (generates cards)
5. Response sent to UI
   ↓ (cards displayed)
6. User interacts with cards
   ↓ (dismiss/accept/override)
7. Action logged for analytics
   ↓ (audit trail)
8. Workflow continues with CDS input
```

**Integration Code**:
```javascript
// Frontend: CDS Hook trigger
const triggerCDSHooks = async (hookType, context) => {
  try {
    // Get CDS recommendations
    const cards = await cdsHooksClient.triggerHook(hookType, {
      patientId: patient.id,
      userId: user.id,
      ...context
    });
    
    // Display cards in UI
    if (cards.length > 0) {
      setCdsAlerts(cards);
      
      // Track card presentation
      cards.forEach(card => {
        analytics.track('cds_card_presented', {
          hookType,
          cardId: card.uuid,
          indicator: card.indicator
        });
      });
    }
  } catch (error) {
    console.error('CDS Hook error:', error);
  }
};

// Backend: CDS evaluation
async def evaluate_cds_hook(hook_type: str, context: dict):
    # Get applicable hooks
    hooks = await get_active_hooks(hook_type)
    
    # Prefetch required data
    prefetch_data = await prefetch_resources(hooks, context)
    
    # Evaluate each hook
    cards = []
    for hook in hooks:
        if await evaluate_conditions(hook, context, prefetch_data):
            hook_cards = generate_cards(hook, context)
            cards.extend(hook_cards)
    
    # Log execution
    await log_cds_execution(hook_type, context, cards)
    
    return {"cards": cards}
```

## Event-Driven Architecture

### Frontend Event Bus (ClinicalWorkflowContext)
```javascript
// Event definitions
const CLINICAL_EVENTS = {
  // Order events
  ORDER_PLACED: 'order.placed',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  
  // Result events
  RESULT_RECEIVED: 'result.received',
  RESULT_REVIEWED: 'result.reviewed',
  ABNORMAL_RESULT: 'result.abnormal',
  
  // Medication events
  PRESCRIPTION_CREATED: 'prescription.created',
  MEDICATION_DISPENSED: 'medication.dispensed',
  MEDICATION_DISCONTINUED: 'medication.discontinued',
  
  // CDS events
  CDS_HOOK_TRIGGERED: 'cds.hook.triggered',
  CDS_CARD_PRESENTED: 'cds.card.presented',
  CDS_CARD_ACCEPTED: 'cds.card.accepted',
  CDS_CARD_DISMISSED: 'cds.card.dismissed',
  CDS_HOOK_CREATED: 'cds.hook.created',
  CDS_HOOK_UPDATED: 'cds.hook.updated'
};

// Publishing events
const handleOrderCreated = async (order) => {
  await publish(CLINICAL_EVENTS.ORDER_PLACED, {
    orderId: order.id,
    patientId: order.subject.reference,
    orderType: order.category,
    timestamp: new Date()
  });
};

// Subscribing to events
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.RESULT_RECEIVED, (event) => {
    if (event.patientId === currentPatientId) {
      refreshLabResults();
      checkForAbnormals(event.resultId);
    }
  });
  
  return unsubscribe;
}, [currentPatientId]);
```

### Backend Event Processing
```python
# Event publisher
class EventPublisher:
    async def publish_clinical_event(self, event_type: str, payload: dict):
        # Store event
        await self.store_event(event_type, payload)
        
        # Send via WebSocket
        await self.websocket_manager.broadcast({
            "type": event_type,
            "payload": payload,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Trigger workflows
        await self.workflow_engine.process_event(event_type, payload)

# Event handlers
class ClinicalEventHandlers:
    async def handle_abnormal_result(self, event: dict):
        # Get result details
        observation = await get_observation(event["observationId"])
        
        # Check if critical
        if self.is_critical_value(observation):
            # Send urgent notification
            await self.send_critical_value_alert(observation)
            
            # Create task for follow-up
            await self.create_follow_up_task(observation)
            
            # Update patient risk score
            await self.update_risk_assessment(observation)
```

## Data Synchronization Patterns

### Optimistic Updates
```javascript
// Frontend: Optimistic update pattern
const updateCondition = async (conditionId, updates) => {
  // Optimistically update UI
  setConditions(prev => 
    prev.map(c => c.id === conditionId ? {...c, ...updates} : c)
  );
  
  try {
    // Make API call
    const updated = await fhirService.updateCondition(conditionId, updates);
    
    // Confirm with server response
    setConditions(prev =>
      prev.map(c => c.id === conditionId ? updated : c)
    );
  } catch (error) {
    // Rollback on error
    await refreshConditions();
    showError("Failed to update condition");
  }
};
```

### Real-Time Synchronization
```javascript
// WebSocket integration
const WebSocketProvider = ({ children }) => {
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'RESOURCE_UPDATED':
          handleResourceUpdate(message.payload);
          break;
        case 'PATIENT_CHANGED':
          handlePatientChange(message.payload);
          break;
        case 'SYSTEM_ALERT':
          handleSystemAlert(message.payload);
          break;
      }
    };
    
    return () => ws.close();
  }, []);
  
  return <WebSocketContext.Provider value={ws}>{children}</WebSocketContext.Provider>;
};
```

## Cross-Module Communication Patterns

### Service Layer Integration
```javascript
// Services calling other services
class PharmacyService {
  async dispenseMedication(prescriptionId, dispensingData) {
    // Get prescription details
    const prescription = await fhirService.getMedicationRequest(prescriptionId);
    
    // Validate with clinical service
    const validation = await clinicalService.validateDispensing(
      prescription,
      dispensingData
    );
    
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }
    
    // Create dispense record
    const dispense = await fhirService.createMedicationDispense({
      ...dispensingData,
      authorizingPrescription: [{
        reference: `MedicationRequest/${prescriptionId}`
      }]
    });
    
    // Update inventory (if implemented)
    await inventoryService.decrementStock(
      prescription.medicationReference,
      dispensingData.quantity
    );
    
    return dispense;
  }
}
```

### Context Composition
```javascript
// Multiple contexts working together
const ClinicalProvider = ({ children }) => {
  return (
    <AuthProvider>
      <PatientProvider>
        <FHIRResourceProvider>
          <ClinicalWorkflowProvider>
            <WebSocketProvider>
              {children}
            </WebSocketProvider>
          </ClinicalWorkflowProvider>
        </FHIRResourceProvider>
      </PatientProvider>
    </AuthProvider>
  );
};

// Consuming multiple contexts
const useClinicalData = () => {
  const { user } = useAuth();
  const { patient } = usePatient();
  const { conditions, medications } = useFHIRResources();
  const { publish } = useClinicalWorkflow();
  
  return {
    user,
    patient,
    clinicalData: { conditions, medications },
    publishEvent: publish
  };
};
```

## Security Integration

### Authentication Flow Across Modules
```python
# Backend: Auth middleware integration
async def verify_fhir_access(
    request: Request,
    resource_type: str,
    action: str,
    user: User = Depends(get_current_user)
):
    # Check base permission
    if not await auth_service.has_permission(user, resource_type, action):
        raise HTTPException(403, "Access denied")
    
    # Check resource-specific rules
    if resource_type == "MedicationRequest" and action == "create":
        if not user.has_prescribing_authority:
            raise HTTPException(403, "Prescribing authority required")
    
    # Audit access
    await audit_logger.log_access(
        user_id=user.id,
        resource_type=resource_type,
        action=action
    )
    
    return user
```

## Performance Optimization

### Caching Strategy
```javascript
// Frontend: Multi-level caching
const CacheProvider = ({ children }) => {
  const [cache] = useState(new Map());
  
  const getCached = useCallback(async (key, fetcher, ttl = 5000) => {
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    
    const data = await fetcher();
    cache.set(key, { data, timestamp: Date.now() });
    
    return data;
  }, [cache]);
  
  return (
    <CacheContext.Provider value={{ getCached }}>
      {children}
    </CacheContext.Provider>
  );
};
```

### Batch Operations
```python
# Backend: Batch processing
async def batch_create_observations(observations: List[dict], db: AsyncSession):
    # Validate all first
    for obs in observations:
        await validate_observation(obs)
    
    # Batch insert
    async with db.begin():
        created = []
        for obs in observations:
            resource = await storage.create("Observation", obs)
            created.append(resource)
        
        # Batch index
        await search_indexer.batch_index(created)
        
        # Single notification
        await event_publisher.publish_batch_created(created)
    
    return created
```

## Error Handling Across Modules

### Cascading Error Management
```javascript
// Frontend: Error boundary integration
class ModuleErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to error service
    errorService.logError({
      error: error.toString(),
      errorInfo,
      module: this.props.module,
      user: this.context.user
    });
    
    // Show user-friendly message
    this.setState({
      hasError: true,
      errorMessage: this.getErrorMessage(error)
    });
  }
  
  getErrorMessage(error) {
    if (error.code === 'FHIR_VALIDATION_ERROR') {
      return 'Invalid medical data format. Please check your input.';
    }
    return 'An error occurred. Please try again or contact support.';
  }
}
```

## Testing Integration Points

### Integration Test Example
```javascript
// Testing cross-module workflows
describe('Order to Result Workflow', () => {
  it('should create order and receive result notification', async () => {
    // Setup
    const { patient, provider } = await setupTestData();
    
    // Place order
    const order = await fhirService.createServiceRequest({
      subject: { reference: `Patient/${patient.id}` },
      code: { coding: [{ code: 'CBC', system: 'LOINC' }] }
    });
    
    // Simulate lab result
    const result = await labService.createResult({
      basedOn: [{ reference: `ServiceRequest/${order.id}` }],
      value: { value: 12.5, unit: 'g/dL' }
    });
    
    // Verify event published
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'RESULT_RECEIVED',
      expect.objectContaining({ orderId: order.id })
    );
    
    // Verify UI update
    await waitFor(() => {
      expect(screen.getByText('CBC - Complete')).toBeInTheDocument();
    });
  });
});
```

## Best Practices

### Module Communication
1. Use defined interfaces between modules
2. Avoid circular dependencies
3. Implement proper error boundaries
4. Use events for loose coupling
5. Document integration points

### Data Consistency
1. Use transactions for related operations
2. Implement optimistic locking
3. Handle concurrent updates
4. Maintain referential integrity
5. Audit all changes

### Performance
1. Minimize cross-module calls
2. Use caching strategically
3. Implement batch operations
4. Lazy load when possible
5. Monitor integration performance

### Security
1. Validate at module boundaries
2. Implement defense in depth
3. Audit cross-module access
4. Use principle of least privilege
5. Encrypt sensitive data in transit

## Troubleshooting Guide

### Common Integration Issues

1. **Module Version Mismatch**
   - Symptom: Unexpected API errors
   - Solution: Ensure all modules use compatible versions
   
2. **Event Loss**
   - Symptom: UI not updating after actions
   - Solution: Check event bus subscriptions and error handlers
   
3. **Data Inconsistency**
   - Symptom: Different data shown in different tabs
   - Solution: Verify cache invalidation and refresh logic
   
4. **Performance Degradation**
   - Symptom: Slow cross-module operations
   - Solution: Profile and optimize integration points
   
5. **Authentication Issues**
   - Symptom: Intermittent 401 errors
   - Solution: Check token refresh and session management

## Recent Updates - 2025-07-10

**🔧 FHIR CRUD Integration Fixes (Phase 1 & 2)**
- ✅ Fixed Chart Review tab refresh and dialog hanging issues
- ✅ Updated all fhirClient method calls to use generic CRUD methods
- ✅ Resolved Critical Clinical Workspace data persistence and error handling
- ✅ Implemented consistent event publishing for all resource operations
- ✅ Fixed medication edit dialog state management issues

**Critical Integration Improvements**:
- **Chart Review ↔ Pharmacy ↔ Orders Workflow**: Complete medication lifecycle integration
  - Prescription creation publishes `WORKFLOW_NOTIFICATION` events to Pharmacy tab
  - Medication dispensing updates status across Chart Review and Orders tabs
  - Cross-tab event synchronization via `ClinicalWorkflowContext`
- **FHIR Service Integration**: Standardized to generic CRUD operations
  - `fhirClient.create()`, `fhirClient.update()`, `fhirClient.delete()` methods
  - Consistent cache invalidation with `intelligentCache.clearPatient()`
  - Proper refresh key management for UI updates
- **Event-Driven Architecture**: Enhanced cross-module communication
  - `MEDICATION_STATUS_CHANGED` events for pharmacy integration
  - `CONDITION_UPDATED` events for problem list synchronization
  - `ALLERGY_UPDATED` events for allergy management workflows

**WebSocket Real-Time Updates**:
- ✅ Medication status changes broadcast to all connected clients
- ✅ Resource subscription patterns for MedicationRequest updates
- ✅ Automatic UI refresh on medication workflow events
- ✅ Cross-tab synchronization via WebSocket notifications

**Context Integration Patterns Verified**:
- `useFHIRResource()` - Data loading and caching
- `useClinicalWorkflow()` - Event publishing and subscription
- `useWebSocket()` - Real-time update subscriptions
- Progressive loading and intelligent caching maintained

**Quality Gates Enforced**:
- Fixed duplicate function declarations in EditMedicationDialog
- Consistent error handling across all medication workflows
- Proper loading states and user feedback mechanisms
- FHIR compliance validation maintained

**Integration Test Results**:
- ✅ ChartReview → Pharmacy workflow: Prescription events properly published
- ✅ Pharmacy → ChartReview workflow: Dispensing status updates reflected
- ✅ Orders → Results workflow: Real-time order status synchronization
- ✅ Cross-module context sharing: Patient data consistency maintained
- ✅ WebSocket integration: Real-time updates functional across all tabs

## Clinical Workflow Engine Integration

### Document-Communication-Task Orchestration
**Complete clinical workflow integration with linked resource management**

### Workflow Creation Integration
```javascript
// Frontend integration - creating a consultation workflow
import { fhirService } from '../services/fhirService';

const createConsultationWorkflow = async (patientId, consultationData) => {
  // Create workflow via FHIR storage engine
  const workflow = await fhirService.createClinicalWorkflow({
    workflowType: 'consultation',
    patientRef: `Patient/${patientId}`,
    encounterRef: `Encounter/${consultationData.encounterId}`,
    initiatorRef: `Practitioner/${consultationData.practitionerId}`,
    description: 'Cardiology consultation with follow-up planning',
    priority: 'high'
  });
  
  // Workflow creates linked resources:
  // - DocumentReference for consultation notes
  // - Communication for provider notifications
  // - Task for workflow orchestration
  
  return workflow;
};
```

### Cross-Module Workflow Events
```javascript
// Clinical Workspace integration
const { publish, subscribe } = useClinicalWorkflow();

// Publish workflow events
useEffect(() => {
  const handleWorkflowCreated = async (workflowData) => {
    await publish(CLINICAL_EVENTS.WORKFLOW_CREATED, {
      workflowId: workflowData.workflow_id,
      type: workflowData.type,
      patientId: workflowData.patientId,
      resources: workflowData.resources
    });
  };
}, []);

// Subscribe to workflow updates across modules
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.WORKFLOW_STATUS_CHANGED, (data) => {
    // Update UI across Chart Review, Communication, and Orders tabs
    if (data.workflowId === currentWorkflowId) {
      refreshWorkflowResources(data.workflowId);
      updateWorkflowStatus(data.newStatus);
    }
  });
  
  return unsubscribe;
}, [currentWorkflowId]);
```

### Resource Relationship Management
```javascript
// Cross-resource integration patterns
class WorkflowIntegrationService {
  async linkDocumentToWorkflow(documentId, workflowId) {
    // Link DocumentReference to existing workflow
    await fhirService.linkWorkflowResources(
      'DocumentReference', documentId,
      'Task', workflowId,
      'supports'
    );
    
    // Notify all modules of the relationship
    await publish(CLINICAL_EVENTS.RESOURCE_LINKED, {
      sourceType: 'DocumentReference',
      sourceId: documentId,
      targetType: 'Task', 
      targetId: workflowId,
      relationship: 'supports'
    });
  }
  
  async getWorkflowResources(workflowId) {
    // Get all resources in workflow
    const resources = await fhirService.getWorkflowResources(workflowId);
    
    return {
      documents: resources.DocumentReference || [],
      communications: resources.Communication || [],
      tasks: resources.Task || []
    };
  }
}
```

### Module Integration Points

#### Chart Review ↔ Workflow Engine
```javascript
// Chart Review tab workflow integration
const ChartReviewWorkflow = () => {
  const [workflowResources, setWorkflowResources] = useState({});
  
  // Load workflow documents in Chart Review
  useEffect(() => {
    const loadWorkflowDocuments = async () => {
      if (currentWorkflowId) {
        const resources = await fhirService.getWorkflowResources(currentWorkflowId);
        
        // Display DocumentReferences in Chart Review
        setDocuments(resources.DocumentReference || []);
        
        // Show linked communications
        setCommunications(resources.Communication || []);
      }
    };
    
    loadWorkflowDocuments();
  }, [currentWorkflowId]);
  
  // Create new workflow document
  const createWorkflowDocument = async (documentData) => {
    const document = await fhirService.createResource('DocumentReference', {
      ...documentData,
      identifier: [{
        system: 'http://example.org/clinical-workflow',
        value: currentWorkflowId
      }]
    });
    
    // Link to existing workflow
    await fhirService.linkWorkflowResources(
      'DocumentReference', document.id,
      'Task', currentTaskId,
      'supports'
    );
    
    return document;
  };
};
```

#### Communication Module Integration
```javascript
// Communication threading with workflow
const CommunicationWorkflow = () => {
  // Create threaded communication in workflow
  const createWorkflowCommunication = async (messageData) => {
    const communication = await fhirService.createResource('Communication', {
      ...messageData,
      identifier: [{
        system: 'http://example.org/clinical-workflow',
        value: currentWorkflowId
      }],
      about: [
        { reference: `DocumentReference/${relatedDocumentId}` },
        { reference: `Task/${workflowTaskId}` }
      ],
      basedOn: [{ reference: `Task/${workflowTaskId}` }]
    });
    
    // Publish communication event
    await publish(CLINICAL_EVENTS.COMMUNICATION_SENT, {
      workflowId: currentWorkflowId,
      communicationId: communication.id,
      participants: communication.recipient
    });
    
    return communication;
  };
  
  // Handle workflow communication responses
  const handleCommunicationResponse = async (responseData) => {
    const response = await fhirService.createResource('Communication', {
      ...responseData,
      inResponseTo: [{ reference: `Communication/${parentCommunicationId}` }],
      partOf: [{ reference: `Communication/${threadId}` }]
    });
    
    // Update workflow status based on response
    if (responseData.status === 'completed') {
      await fhirService.updateWorkflowStatus(
        currentWorkflowId,
        'in-progress',
        'Communication response received'
      );
    }
    
    return response;
  };
};
```

#### Orders ↔ Task Integration
```javascript
// Orders module workflow task creation
const OrdersWorkflowIntegration = () => {
  // Create task for order fulfillment
  const createOrderTask = async (orderData) => {
    const task = await fhirService.createResource('Task', {
      status: 'ready',
      intent: 'order',
      code: { text: 'Fulfill order' },
      for: { reference: `Patient/${orderData.patientId}` },
      focus: { reference: `ServiceRequest/${orderData.orderId}` },
      authoredOn: new Date().toISOString(),
      businessStatus: { text: 'Order received' }
    });
    
    // Link to workflow if part of larger process
    if (orderData.workflowId) {
      await fhirService.linkWorkflowResources(
        'Task', task.id,
        'Task', orderData.workflowId,
        'part-of'
      );
    }
    
    return task;
  };
  
  // Update task status on order completion
  const updateOrderTaskStatus = async (orderId, newStatus) => {
    const tasks = await fhirService.searchResources('Task', {
      focus: [`ServiceRequest/${orderId}`]
    });
    
    for (const task of tasks.entry || []) {
      await fhirService.updateResource('Task', task.resource.id, {
        ...task.resource,
        status: newStatus,
        lastModified: new Date().toISOString(),
        businessStatus: { text: `Order ${newStatus}` }
      });
    }
    
    // Publish status update
    await publish(CLINICAL_EVENTS.ORDER_STATUS_CHANGED, {
      orderId,
      newStatus,
      taskIds: tasks.entry?.map(t => t.resource.id) || []
    });
  };
};
```

### Workflow Search Integration
```javascript
// Cross-module workflow search capabilities
const WorkflowSearchIntegration = {
  // Find all workflow resources by patient
  async getPatientWorkflows(patientId) {
    const [documents, communications, tasks] = await Promise.all([
      fhirService.searchResources('DocumentReference', {
        patient: [patientId],
        identifier: ['http://example.org/clinical-workflow|*']
      }),
      fhirService.searchResources('Communication', {
        subject: [`Patient/${patientId}`],
        identifier: ['http://example.org/clinical-workflow|*']
      }),
      fhirService.searchResources('Task', {
        for: [`Patient/${patientId}`],
        identifier: ['http://example.org/clinical-workflow|*']
      })
    ]);
    
    return { documents, communications, tasks };
  },
  
  // Find workflow by specific resource
  async getWorkflowByResource(resourceType, resourceId) {
    const resource = await fhirService.getResource(resourceType, resourceId);
    const workflowIdentifier = resource.identifier?.find(
      id => id.system === 'http://example.org/clinical-workflow'
    );
    
    if (workflowIdentifier) {
      return await fhirService.getWorkflowResources(workflowIdentifier.value);
    }
    
    return null;
  },
  
  // Cross-reference workflow search
  async findRelatedWorkflowResources(resourceType, resourceId) {
    const queries = {
      'DocumentReference': {
        'Communication': { about: [`DocumentReference/${resourceId}`] },
        'Task': { focus: [`DocumentReference/${resourceId}`] }
      },
      'Communication': {
        'DocumentReference': { related: [`Communication/${resourceId}`] },
        'Task': { input: [`Communication/${resourceId}`] }
      },
      'Task': {
        'DocumentReference': { context: [`Task/${resourceId}`] },
        'Communication': { basedOn: [`Task/${resourceId}`] }
      }
    };
    
    const relatedQueries = queries[resourceType] || {};
    const results = {};
    
    for (const [targetType, searchParams] of Object.entries(relatedQueries)) {
      results[targetType] = await fhirService.searchResources(targetType, searchParams);
    }
    
    return results;
  }
};
```

### 2025-07-15 Clinical Workflow Integration
- **Major Addition**: Complete Document-Communication-Task workflow orchestration
- **Enhanced**: Cross-module workflow event system with real-time synchronization
- **Added**: Resource relationship management with automatic linking
- **Improved**: Chart Review ↔ Communication ↔ Orders workflow integration
- **Added**: Comprehensive workflow search capabilities across all modules
- **Enhanced**: Task-based workflow status management with cross-resource synchronization
- **Added**: Clinical workflow context integration with existing ClinicalWorkflowContext
- **Improved**: Event-driven architecture for workflow state management
- **Added**: Workflow resource lifecycle management (create, link, update, search)
- **Enhanced**: Cross-tab workflow synchronization via WebSocket integration

This update ensures robust medication workflow integration with proper event-driven communication between Chart Review, Pharmacy, and Orders modules.