# Legacy to FHIR API Migration Plan

## Overview
This document outlines the migration from legacy API endpoints to FHIR-compliant APIs, aligning with the FHIR-native architecture described in ARCHITECTURE.md.

## Migration Categories

### 1. Direct FHIR Mappings (High Priority)
These endpoints can be directly replaced with FHIR API calls:

| Legacy Endpoint | FHIR Replacement | Notes |
|----------------|------------------|-------|
| `GET /api/patients` | `GET /fhir/R4/Patient` | Use FHIR search parameters |
| `POST /api/patients` | `POST /fhir/R4/Patient` | Direct FHIR resource creation |
| `GET /api/patients/{id}` | `GET /fhir/R4/Patient/{id}` | Direct FHIR read |
| `GET /api/encounters` | `GET /fhir/R4/Encounter` | Use FHIR search |
| `POST /api/encounters` | `POST /fhir/R4/Encounter` | Direct FHIR creation |
| `GET /api/observations` | `GET /fhir/R4/Observation` | Use category parameter for types |
| `POST /api/allergies` | `POST /fhir/R4/AllergyIntolerance` | Direct FHIR |
| `POST /api/medications` | `POST /fhir/R4/MedicationRequest` | Direct FHIR |
| `POST /api/conditions` | `POST /fhir/R4/Condition` | Direct FHIR |
| `GET /api/providers` | `GET /fhir/R4/Practitioner` | Direct FHIR |

### 2. FHIR with Search Parameters
These require specific FHIR search parameters:

| Legacy Endpoint | FHIR Replacement | Search Parameters |
|----------------|------------------|-------------------|
| `GET /api/observations?observation_type=laboratory` | `GET /fhir/R4/Observation?category=laboratory` | Use category search |
| `GET /api/lab-results` | `GET /fhir/R4/Observation?category=laboratory&_sort=-date` | Category + sorting |
| `GET /api/tasks` | `GET /fhir/R4/Task` | May need status filters |

### 3. EMR Extensions (Keep as EMR APIs)
These remain in the EMR extension layer as per architecture:

- `/api/emr/auth/*` - Authentication and session management
- `/api/emr/workflow/*` - Workflow orchestration
- `/api/emr/ui/*` - UI state persistence
- `/api/emr/clinical/*` - Clinical tools (note generation, CDS)

### 4. Complex Aggregations (Need EMR Operations)
These require custom FHIR operations or EMR extensions:

| Legacy Endpoint | Solution | Implementation |
|----------------|----------|----------------|
| `GET /api/dashboard/stats` | Custom FHIR operation | `$stats` operation on Patient |
| `GET /api/dashboard/recent-activity` | EMR extension | Aggregate from audit logs |
| `GET /api/analytics/demographics` | Custom FHIR operation | `$demographics` on Patient |
| `GET /api/analytics/disease-prevalence` | Custom FHIR operation | `$prevalence` on Condition |
| `GET /api/quality/measures` | EMR extension | Complex quality calculations |

### 5. Clinical Workflows (Hybrid Approach)
Combine FHIR Task with EMR extensions:

| Feature | FHIR Component | EMR Extension |
|---------|----------------|---------------|
| Inbox | FHIR Task | UI state, filtering, bulk actions |
| Orders | FHIR ServiceRequest | Order sets, workflows |
| Notes | FHIR DocumentReference | Templates, AI generation |

## Frontend Service Architecture

### 1. FHIRClient (fhirClient.js)
Primary service for all clinical data:
```javascript
// All clinical resources go through FHIR
const patient = await fhirClient.read('Patient', patientId);
const encounters = await fhirClient.search('Encounter', { patient: patientId });
const observations = await fhirClient.search('Observation', { 
  patient: patientId,
  category: 'laboratory',
  _sort: '-date'
});
```

### 2. EMRClient (emrClient.js)
Optional extensions for enhanced functionality:
```javascript
// EMR-specific features
const stats = await emrClient.getDashboardStats();
const noteTemplate = await emrClient.getNoteTemplate(templateId);
const aiSuggestion = await emrClient.generateClinicalNote(context);
```

### 3. AuthService
Remains separate for authentication:
```javascript
// Authentication is EMR-specific
const session = await authService.login(credentials);
const user = await authService.getCurrentUser();
```

## Migration Steps

### Phase 1: Update Core Clinical Components
1. Patient List/Detail - Use FHIR Patient API
2. Encounter Management - Use FHIR Encounter API
3. Observations/Labs - Use FHIR Observation API
4. Medications - Use FHIR MedicationRequest API
5. Allergies - Use FHIR AllergyIntolerance API
6. Conditions - Use FHIR Condition API

### Phase 2: Update Clinical Context
1. Refactor ClinicalContext to work with FHIR resources
2. Update data transformations to handle FHIR format
3. Implement proper FHIR references

### Phase 3: Complex Features
1. Implement custom FHIR operations for analytics
2. Update dashboard to use aggregated data
3. Migrate quality measures to use FHIR queries

### Phase 4: Remove Legacy Code
1. Remove compatibility layers (/api/patients, /api/encounters)
2. Remove legacy API service code
3. Clean up unused transformations

## Benefits After Migration

1. **True FHIR Compliance**: Frontend can work with any FHIR server
2. **Simplified Architecture**: Remove duplicate API layers
3. **Better Interoperability**: Standard FHIR format throughout
4. **Cleaner Codebase**: Remove transformation logic
5. **Future-Proof**: Ready for FHIR extensions and new features

## Testing Strategy

1. **Unit Tests**: Test FHIR client methods
2. **Integration Tests**: Test against FHIR server
3. **E2E Tests**: Verify complete workflows
4. **Compatibility Tests**: Test against public FHIR servers