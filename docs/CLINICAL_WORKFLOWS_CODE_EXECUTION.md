# Clinical Workflows - Code Execution Paths
**Generated**: 2025-01-27
**Purpose**: Detailed code execution paths for each user workflow

---

## 1. SUMMARY TAB WORKFLOWS

### Workflow: "Reviewing Patient Status at Start of Visit"

**Code Execution Path:**
```
1. User clicks patient → Router navigation
   File: /frontend/src/components/clinical/ClinicalWorkspaceEnhanced.js:127
   - useParams() extracts patientId
   - decodeFhirId() decodes the ID

2. SummaryTab component mounts
   File: /frontend/src/components/clinical/workspace/tabs/SummaryTab.js:123
   - Component receives patientId prop

3. Data fetching initiates
   File: /frontend/src/components/clinical/workspace/tabs/SummaryTab.js:342-371
   - useEffect triggers on patientId change
   - Checks if resources exist in cache
   - If no cache: calls fetchPatientBundle(patientId, false, 'critical')

4. FHIR Context loads data
   File: /frontend/src/contexts/FHIRResourceContext.js
   - fetchPatientBundle() → fhirClient.search()
   - Fetches: Condition, MedicationRequest, Observation, Encounter, AllergyIntolerance

5. Resources filtered
   File: /frontend/src/components/clinical/workspace/tabs/SummaryTab.js:207-251
   - useMemo filters by patient reference
   - Handles both "Patient/id" and "urn:uuid:id" formats

6. Stats calculation
   File: /frontend/src/components/clinical/workspace/tabs/SummaryTab.js:262-339
   - loadDashboardData() called
   - Counts active conditions, medications, recent labs
   - Updates stats state

7. UI Renders
   File: /frontend/src/components/clinical/workspace/tabs/SummaryTab.js:500+
   - ClinicalSummaryCard components display counts
   - RecentItem components show recent data
```

**Expected Behavior:**
- Data loads within 2 seconds
- Shows skeleton loaders while loading
- Displays accurate counts for each category
- Auto-refreshes on clinical events

---

### Workflow: "Navigating to Problem Details"

**Code Execution Path:**
```
1. User clicks Problems card
   File: /frontend/src/components/clinical/workspace/tabs/SummaryTab.js:520
   - onClick handler triggered

2. Navigation callback
   File: /frontend/src/components/clinical/workspace/tabs/SummaryTab.js:525
   - Calls onNavigateToTab(TAB_IDS.CHART_REVIEW)
   - TAB_IDS.CHART_REVIEW = 'chart-review'

3. Parent component handles navigation
   File: /frontend/src/components/clinical/ClinicalWorkspaceEnhanced.js:160
   - onModuleChange('chart-review') called
   - Updates activeModule state

4. Chart Review tab activates
   File: /frontend/src/components/clinical/workspace/tabs/ChartReviewTabOptimized.js:128
   - Component mounts/updates with patientId
   - expandedSections.conditions = true (default)

5. Problems section auto-expands
   File: /frontend/src/components/clinical/workspace/tabs/ChartReviewTabOptimized.js:166
   - Conditions section visible by default
```

**Expected Behavior:**
- Immediate navigation (< 100ms)
- Chart Review tab opens with problems expanded
- Smooth transition animation

---

## 2. CHART REVIEW TAB WORKFLOWS

### Workflow: "Adding a New Problem/Diagnosis"

**Code Execution Path:**
```
1. User clicks "+" button
   File: /frontend/src/components/clinical/workspace/tabs/ChartReviewTabOptimized.js:890
   - handleAddCondition() called
   - Sets openDialogs.condition = true

2. Dialog opens
   File: /frontend/src/components/clinical/workspace/dialogs/ConditionDialogEnhanced.js
   - Dialog component mounts
   - Receives patientId prop

3. User searches for diagnosis
   File: /frontend/src/components/clinical/workspace/dialogs/ConditionDialogEnhanced.js:250
   - handleSearch() triggered on input
   - Searches local condition catalog

4. User fills form and clicks Save
   File: /frontend/src/components/clinical/workspace/dialogs/ConditionDialogEnhanced.js:320
   - handleSave() called
   - Validates required fields

5. FHIR resource created
   File: /frontend/src/components/clinical/workspace/dialogs/ConditionDialogEnhanced.js:335
   - Creates Condition resource object:
   {
     resourceType: "Condition",
     subject: { reference: `Patient/${patientId}` },
     code: { coding: [...], text: "..." },
     clinicalStatus: { coding: [...] },
     severity: { coding: [...] },
     onsetDateTime: "2025-01-27",
     note: [{ text: "..." }]
   }

6. Save to backend
   File: /frontend/src/core/fhir/services/fhirClient.js
   - fhirClient.create('Condition', conditionResource)
   - POST to /fhir/R4/Condition

7. Event published
   File: /frontend/src/contexts/ClinicalWorkflowContext.js
   - publish(CLINICAL_EVENTS.CONDITION_ADDED, { condition, patientId })

8. Chart Review updates
   File: /frontend/src/hooks/useChartReviewResources.js:380
   - Event subscription triggers
   - Refreshes condition list
   - Updates UI
```

**Expected Behavior:**
- Dialog opens immediately
- Search returns results within 500ms
- Save completes within 2 seconds
- New condition appears in list without page refresh

---

### Workflow: "Prescribing a New Medication"

**Code Execution Path:**
```
1. User clicks "+" button for medications
   File: /frontend/src/components/clinical/workspace/tabs/ChartReviewTabOptimized.js:910
   - handleAddMedication() called
   - Sets openDialogs.medication = true

2. MedicationDialogEnhanced opens
   File: /frontend/src/components/clinical/workspace/dialogs/MedicationDialogEnhanced.js:340
   - Component mounts with patientId

3. Fetch patient allergies
   File: /frontend/src/components/clinical/workspace/dialogs/MedicationDialogEnhanced.js:478-496
   - useEffect triggers on dialog open
   - fhirClient.search('AllergyIntolerance', { patient })
   - Stores in patientAllergies state

4. User searches medication
   File: /frontend/src/components/clinical/workspace/dialogs/MedicationDialogEnhanced.js:400
   - searchMedications() called
   - cdsClinicalDataService.getDynamicMedicationCatalog()

5. User completes form
   File: /frontend/src/components/clinical/workspace/dialogs/MedicationDialogEnhanced.js:631
   - Form data collected in formData state

6. Save clicked - Safety checks
   File: /frontend/src/components/clinical/workspace/dialogs/MedicationDialogEnhanced.js:635
   - checkAllergyInteractions(medication, patientAllergies)
   - checkDrugInteractions(allMedications)
   - If conflicts found, shows confirmation dialog

7. Create MedicationRequest
   File: /frontend/src/components/clinical/workspace/dialogs/MedicationDialogEnhanced.js:651
   {
     resourceType: "MedicationRequest",
     status: "active",
     intent: "order",
     medicationCodeableConcept: { ... },
     subject: { reference: `Patient/${patientId}` },
     dosageInstruction: [{ ... }],
     dispenseRequest: { ... }
   }

8. Save to backend
   File: /frontend/src/core/fhir/services/fhirClient.js
   - fhirClient.create('MedicationRequest', medicationRequest)

9. Event published
   - publish(CLINICAL_EVENTS.MEDICATION_PRESCRIBED, { medication, patientId })

10. Pharmacy notified (if integrated)
    - WebSocket message sent to pharmacy queue
```

**Expected Behavior:**
- Allergy check completes before save enabled
- Drug interactions display if found
- Confirmation required for allergy conflicts
- Prescription sends to pharmacy immediately

---

## 3. ENCOUNTERS TAB WORKFLOWS

### Workflow: "Creating a New Encounter"

**Code Execution Path:**
```
1. User clicks New Encounter
   File: /frontend/src/components/clinical/workspace/tabs/EncountersTab.js:240
   - handleNewEncounter() called
   - setEncounterCreationDialogOpen(true)

2. EncounterCreationDialog opens
   File: /frontend/src/components/clinical/workspace/dialogs/EncounterCreationDialog.js
   - Component mounts with patientId

3. User fills form
   - Encounter type, reason, provider, date/time

4. Save clicked
   File: /frontend/src/components/clinical/workspace/dialogs/EncounterCreationDialog.js:150
   - handleCreate() called
   - Creates Encounter resource:
   {
     resourceType: "Encounter",
     status: "in-progress",
     class: { system: "...", code: "AMB" },
     subject: { reference: `Patient/${patientId}` },
     participant: [{ individual: { reference: `Practitioner/${providerId}` }}],
     period: { start: "2025-01-27T10:00:00" },
     reasonCode: [{ text: "Follow-up for diabetes" }]
   }

5. Save to backend
   - fhirClient.create('Encounter', encounterResource)

6. Event published
   - publish(CLINICAL_EVENTS.ENCOUNTER_CREATED, { encounter, patientId })

7. Encounters list updates
   File: /frontend/src/components/clinical/workspace/tabs/EncountersTab.js:243
   - handleEncounterCreated() shows success message
   - List refreshes
```

**Expected Behavior:**
- Encounter creates immediately
- Appears at top of encounter list
- Status shows as "in-progress"

---

### Workflow: "Writing a Clinical Note"

**Code Execution Path:**
```
1. User clicks Add Note
   File: /frontend/src/components/clinical/workspace/tabs/EncountersTab.js:217
   - handleAddNoteToEncounter(encounter) called
   - setNoteEditorOpen(true)

2. EnhancedNoteEditor opens
   File: /frontend/src/components/clinical/workspace/dialogs/EnhancedNoteEditor.js
   - Receives encounter reference

3. User types in sections
   - Form tracks content in state

4. Save Note clicked
   File: /frontend/src/components/clinical/workspace/dialogs/EnhancedNoteEditor.js:200
   - handleSave() called
   - Creates DocumentReference:
   {
     resourceType: "DocumentReference",
     status: "current",
     type: { coding: [{ code: "34133-9", display: "Clinical Note" }] },
     subject: { reference: `Patient/${patientId}` },
     context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
     content: [{ attachment: { contentType: "text/plain", data: base64(noteText) }}]
   }

5. Save to backend
   - fhirClient.create('DocumentReference', documentResource)

6. Note linked to encounter
   - Encounter updated with reference to DocumentReference
```

**Expected Behavior:**
- Note saves and links to encounter
- Appears in encounter summary
- Available for signing

---

## 4. RESULTS TAB WORKFLOWS

### Workflow: "Reviewing New Lab Results"

**Code Execution Path:**
```
1. Component loads
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:211
   - fetchAllData() called

2. Parallel data fetch
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:217
   - Promise.all([
     fhirClient.search('Observation', { patient, category: 'laboratory' }),
     fhirClient.search('Observation', { patient, category: 'vital-signs' }),
     fhirClient.search('DiagnosticReport', { patient })
   ])

3. Results processed
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:247
   - enhanceObservationWithReferenceRange() adds reference ranges
   - Results stored in allData state

4. User clicks on result
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:515
   - handleViewDetails(result) called
   - setSelectedResult(result)
   - setDetailsDialogOpen(true)

5. Details dialog shows
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:848
   - Dialog displays full result details
   - Shows value, reference range, interpretation

6. User acknowledges result
   - Updates Observation with acknowledged timestamp
   - publish(CLINICAL_EVENTS.RESULT_ACKNOWLEDGED)
```

**Expected Behavior:**
- Results load grouped by type
- Abnormal results highlighted
- Acknowledgment tracked

---

### Workflow: "Responding to Critical Value"

**Code Execution Path:**
```
1. Critical value received
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:381
   - Event: CLINICAL_EVENTS.CRITICAL_VALUE_ALERT
   - showCriticalValueAlert(result) called

2. Alert displayed
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:413
   - JavaScript alert() shows critical value
   - (Should be replaced with proper modal)

3. Result added to list
   File: /frontend/src/components/clinical/workspace/tabs/ResultsTabOptimized.js:394
   - updateResultsList() adds to beginning of list
   - Marked with critical indicator

4. User takes action
   - Clicks result to open details
   - Documents action taken
   - Marks as addressed
```

**Expected Behavior:**
- Immediate alert notification
- Result appears at top with red indicator
- Requires acknowledgment

---

## 5. ORDERS TAB WORKFLOWS

### Workflow: "Placing a Lab Order"

**Code Execution Path:**
```
1. User clicks New Order
   File: /frontend/src/components/clinical/workspace/tabs/EnhancedOrdersTab.js:250
   - handleNewOrder() called
   - setCPOEDialogOpen(true)

2. CPOEDialog opens
   File: /frontend/src/components/clinical/workspace/dialogs/CPOEDialog.js:20
   - Component mounts with patientId

3. User searches for test
   File: /frontend/src/components/clinical/workspace/dialogs/components/ServiceRequestFormFields.js
   - Search through order catalog

4. User completes form
   - Priority, indication, scheduled date

5. Place Order clicked
   File: /frontend/src/components/clinical/workspace/dialogs/CPOEDialog.js:76
   - handleSave() called
   - createServiceRequestResource() creates:
   {
     resourceType: "ServiceRequest",
     status: "active",
     intent: "order",
     priority: "routine",
     code: { coding: [...], text: "CBC with Differential" },
     subject: { reference: `Patient/${patientId}` },
     requester: { reference: `Practitioner/${userId}` },
     occurrenceDateTime: "2025-01-28"
   }

6. Save to backend
   - fhirClient.create('ServiceRequest', serviceRequest)

7. Event published
   - publish(CLINICAL_EVENTS.ORDER_PLACED, { order, patientId })

8. Order appears in active orders
   File: /frontend/src/components/clinical/workspace/tabs/EnhancedOrdersTab.js
   - Orders list refreshes
   - Shows with "active" status
```

**Expected Behavior:**
- Order saves immediately
- Appears in active orders list
- Sent to appropriate department

---

## 6. PHARMACY TAB WORKFLOWS

### Workflow: "Dispensing Medication (Pharmacist)"

**Code Execution Path:**
```
1. Pharmacist views queue
   File: /frontend/src/components/clinical/workspace/tabs/PharmacyTab.js:180
   - loadPharmacyQueue() fetches prescriptions
   - Filters by status: "active"

2. Clicks Dispense
   File: /frontend/src/components/clinical/workspace/tabs/PharmacyTab.js:420
   - handleDispense(prescription) called
   - Opens dispensing dialog

3. Enters dispensing details
   - Lot number, expiration, quantity

4. Complete Dispensing clicked
   File: /frontend/src/hooks/useMedicationDispense.js:47
   - createDispense() called
   - Creates MedicationDispense:
   {
     resourceType: "MedicationDispense",
     status: "completed",
     medicationReference: { reference: `MedicationRequest/${rxId}` },
     subject: { reference: `Patient/${patientId}` },
     performer: [{ actor: { reference: `Practitioner/${pharmacistId}` }}],
     quantity: { value: 30, unit: "tablets" },
     whenHandedOver: "2025-01-27T14:30:00",
     dosageInstruction: [...]
   }

5. Save to backend
   File: /frontend/src/hooks/useMedicationDispense.js:86
   - fhirClient.create('MedicationDispense', dispenseResource)

6. Event published
   File: /frontend/src/hooks/useMedicationDispense.js:92
   - publish(CLINICAL_EVENTS.MEDICATION_DISPENSED, { ... })

7. Prescription status updated
   - MedicationRequest status changes to "completed"
```

**Expected Behavior:**
- Dispensing tracked in system
- Prescription marked as filled
- Patient notified if integrated

---

## COMMON PATTERNS ACROSS ALL WORKFLOWS

### Pattern: Event-Driven Updates
```
1. User action triggers FHIR resource change
2. Event published via ClinicalWorkflowContext
3. Other components subscribed to event update
4. No page refresh required
```

### Pattern: FHIR Resource Creation
```
1. Dialog collects user input
2. Validates required fields
3. Creates FHIR-compliant resource object
4. Saves via fhirClient.create()
5. Returns created resource with ID
6. Publishes relevant event
```

### Pattern: Real-time Synchronization
```
1. WebSocket connection established on app load
2. Subscribes to patient "room"
3. Receives updates from other users
4. Updates local state
5. UI reflects changes immediately
```

### Pattern: Error Handling
```
1. Try-catch wraps FHIR operations
2. Error logged to console
3. User-friendly error message shown
4. Operation can be retried
```