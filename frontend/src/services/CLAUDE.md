# CLAUDE.md - Frontend Services Quick Reference

**Purpose**: Essential guide for AI agents working with WintEHR's frontend service layer and business logic.

**Last Updated**: 2025-01-20

## 🎯 Overview

This directory contains the service layer that bridges UI components with backend APIs:
- FHIR client and data operations
- Clinical decision support (CDS) integration
- Medication workflow management
- Provider and order services
- WebSocket real-time communication
- Clinical safety verification
- Search and data retrieval services

## 📁 Directory Structure

```
frontend/src/services/
├── Core Services
│   ├── fhirClient.js                    # Main FHIR client
│   ├── fhirService.js                   # FHIR operations wrapper
│   ├── api.js                           # Base API configuration
│   ├── emrClient.js                     # EMR-specific client
│   ├── websocket.js                     # WebSocket connection
│   └── HttpClientFactory.js             # HTTP client factory
├── Clinical Services
│   ├── cdsClinicalDataService.js        # CDS clinical data
│   ├── cdsHooksClient.js                # CDS Hooks client
│   ├── cdsHooksService.js               # CDS Hooks service
│   ├── clinicalCDSService.js            # Clinical CDS integration
│   ├── clinicalSafetyVerifier.js        # Safety checks
│   └── criticalValueDetectionService.js # Critical value alerts
├── Medication Services
│   ├── MedicationCRUDService.js         # Med CRUD operations
│   ├── MedicationWorkflowService.js     # Med workflows
│   ├── medicationSearchService.js       # Med search
│   ├── medicationDispenseService.js     # Dispensing
│   ├── medicationReconciliationService.js # Med rec
│   ├── prescriptionRefillService.js     # Refills
│   └── medicationWorkflowValidator.js   # Validation
├── Provider Services
│   ├── providerService.js               # Provider operations
│   ├── providerResolverService.js       # Provider resolution
│   └── providerAccountabilityService.js # Provider tracking
├── Documentation Services
│   ├── cdsDocumentationService.js       # CDS documentation
│   ├── noteTemplatesService.js          # Note templates
│   ├── resultDocumentationService.js    # Result docs
│   └── clinicalDocumentationLinkingService.js # Doc linking
├── Search & Results
│   ├── searchService.js                 # General search
│   ├── enhancedOrderSearch.js           # Order search
│   ├── enhancedImagingSearch.js         # Imaging search
│   └── resultsManagementService.js      # Results handling
└── __tests__/                           # Service tests
```

## 🔧 Core Services

### fhirClient.js / fhirService.js
Primary interface for all FHIR operations:
```javascript
// Main operations
fhirService.getPatient(patientId)
fhirService.searchResources(resourceType, params)
fhirService.createResource(resourceType, data)
fhirService.updateResource(resourceType, id, data)
fhirService.deleteResource(resourceType, id)

// Bundle operations
fhirService.fetchPatientBundle(patientId, useCache, priority)
fhirService.getPatientEverything(patientId)

// Search with proper parameters
fhirService.searchResources('Condition', {
  patient: patientId,
  'clinical-status': 'active',
  _sort: '-onset-date'
})
```

### websocket.js
Real-time communication for clinical events:
```javascript
// Connection management
const ws = getWebSocketConnection();

// Subscribe to events
ws.subscribe('patient-update', (data) => {
  // Handle patient updates
});

// Publish events
ws.publish('order-placed', {
  orderId: order.id,
  patientId: patient.id
});
```

### HttpClientFactory.js
Centralized HTTP client configuration:
```javascript
// Create configured axios instance
const client = HttpClientFactory.create({
  baseURL: '/api',
  timeout: 30000,
  withAuth: true
});
```

## 🏥 Clinical Services

### cdsClinicalDataService.js
Manages clinical catalogs and CDS data:
```javascript
// Get dynamic catalogs
const medications = await getClinicalCatalog('medications');
const labs = await getClinicalCatalog('labs');
const procedures = await getClinicalCatalog('procedures');

// Search across catalogs
const results = await searchClinicalCatalogs('aspirin');
```

### cdsHooksService.js
CDS Hooks integration:
```javascript
// Evaluate CDS rules
const alerts = await evaluateCDSHooks('medication-prescribe', {
  patient: patientId,
  medications: [newMedication]
});

// Get available hooks
const hooks = await getAvailableCDSHooks();
```

### clinicalSafetyVerifier.js
Safety verification for clinical operations:
```javascript
// Verify medication safety
const safety = await verifyMedicationSafety({
  patient: patientId,
  medication: medicationRequest,
  checkInteractions: true,
  checkAllergies: true
});

// Verify order appropriateness
const appropriate = await verifyOrderAppropriateness(order);
```

## 💊 Medication Services

### MedicationWorkflowService.js
Complete medication workflow management:
```javascript
// Prescribe medication
const prescription = await prescribeMedication({
  patient: patientId,
  medication: medicationData,
  prescriber: practitionerId
});

// Dispense medication
const dispense = await dispenseMedication({
  prescription: prescriptionId,
  quantity: 30,
  daysSupply: 30
});

// Track administration
const admin = await recordAdministration({
  medication: medicationId,
  patient: patientId,
  dose: doseData
});
```

### medicationReconciliationService.js
Medication reconciliation workflows:
```javascript
// Get reconciliation data
const reconData = await getMedicationReconciliation(patientId);

// Reconcile medications
const result = await reconcileMedications({
  patient: patientId,
  homeMeds: [...],
  hospitalMeds: [...],
  action: 'admission'
});
```

## 👥 Provider Services

### providerService.js
Provider management and lookup:
```javascript
// Search providers
const providers = await searchProviders({
  specialty: 'cardiology',
  location: 'building-a'
});

// Get provider schedule
const schedule = await getProviderSchedule(providerId);

// Assign patient to provider
await assignPatientToProvider(patientId, providerId);
```

## 📝 Documentation Services

### noteTemplatesService.js
Clinical note template management:
```javascript
// Get templates
const templates = await getNoteTemplates('progress-note');

// Apply template
const note = await applyNoteTemplate(templateId, {
  patient: patientId,
  encounter: encounterId,
  variables: {...}
});
```

### clinicalDocumentationLinkingService.js
Link documentation to clinical data:
```javascript
// Link note to results
await linkNoteToResults({
  noteId: documentId,
  resultIds: [lab1, lab2],
  relationship: 'documents'
});
```

## 🔍 Search Services

### searchService.js
Unified search across resources:
```javascript
// Global search
const results = await globalSearch('chest pain', {
  resourceTypes: ['Condition', 'Procedure', 'DocumentReference'],
  patient: patientId,
  dateRange: {
    start: '2024-01-01',
    end: '2024-12-31'
  }
});
```

### enhancedOrderSearch.js
Advanced order searching:
```javascript
// Search orders with filters
const orders = await searchOrders({
  patient: patientId,
  status: ['active', 'completed'],
  category: 'laboratory',
  dateRange: 'last-30-days'
});
```

## ⚠️ Critical Implementation Details

### Error Handling Pattern
```javascript
try {
  const result = await fhirService.operation();
  return { success: true, data: result };
} catch (error) {
  console.error('Service error:', error);
  
  // Check for specific error types
  if (error.response?.status === 404) {
    throw new ResourceNotFoundError(error.message);
  }
  
  // Re-throw with context
  throw new ServiceError(`Failed to ${operation}`, error);
}
```

### Caching Strategy
```javascript
// Use built-in caching for expensive operations
const medications = await getClinicalCatalog('medications', {
  useCache: true,
  cacheTTL: 300000 // 5 minutes
});

// Clear cache when data changes
await clearCatalogCache('medications');
```

### Authentication
```javascript
// Services automatically include auth headers
// In development: JWT disabled
// In production: JWT tokens required

// Manual auth header if needed
const response = await api.get('/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 🐛 Common Issues & Solutions

### FHIR Search Issues
```javascript
// Problem: Empty search results
// Solution: Ensure search parameters are indexed
const conditions = await fhirService.searchResources('Condition', {
  patient: `Patient/${patientId}`, // Include resource type
  _include: 'Condition:encounter'   // Proper include syntax
});
```

### WebSocket Reconnection
```javascript
// Problem: Lost WebSocket connection
// Solution: Implement reconnection logic
const ws = getWebSocketConnection();
ws.on('disconnect', () => {
  setTimeout(() => ws.reconnect(), 5000);
});
```

### Service Timeout
```javascript
// Problem: Long-running operations timeout
// Solution: Increase timeout for specific operations
const client = HttpClientFactory.create({
  timeout: 60000 // 60 seconds for bulk operations
});
```

## 📝 Best Practices

1. **Always Handle Errors**: Use try-catch and provide meaningful error messages
2. **Use Caching Wisely**: Cache catalog data, not patient-specific data
3. **Validate Input**: Check required fields before API calls
4. **Use Proper FHIR References**: Include resource type in references
5. **Test with Real Data**: Use Synthea patients, not mocked data
6. **Monitor Performance**: Log slow operations for optimization
7. **Clean Up Resources**: Cancel pending requests on component unmount

## 🔗 Related Documentation

- **Main CLAUDE.md**: `/CLAUDE.md` - Project overview
- **Clinical Components**: `/frontend/src/components/clinical/CLAUDE.md`
- **API Documentation**: `/docs/API_ENDPOINTS.md`
- **Service Architecture**: `/docs/modules/frontend/services.md`

## 💡 Quick Tips

- fhirService.js is the primary interface for FHIR operations
- Use service factories for consistent configuration
- Clinical catalogs are auto-generated from patient data
- WebSocket events enable real-time updates
- Services handle auth automatically in most cases
- Cache clinical catalogs but not patient data
- Always validate medication safety before prescribing

---

**Remember**: Services are the bridge between UI and data. Ensure reliability, performance, and safety in all operations.