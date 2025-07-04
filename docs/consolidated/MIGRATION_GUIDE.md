# MedGenEMR FHIR Migration Guide

## Overview

MedGenEMR has been successfully migrated from a traditional EMR API to a FHIR-native architecture. This guide documents the changes and provides guidance for developers.

## Architecture Changes

### Before (Legacy)
- Custom API endpoints: `/api/patients`, `/api/encounters`, `/api/medications`
- Proprietary data models
- SQLAlchemy ORM with traditional relational tables
- Tight coupling between frontend and backend APIs

### After (FHIR-Native)
- Standard FHIR R4 API: `/fhir/R4/Patient`, `/fhir/R4/Encounter`, `/fhir/R4/MedicationRequest`
- FHIR resource models with PostgreSQL JSONB storage
- Frontend works with any FHIR R4 compliant server
- Clean separation between FHIR and EMR-specific functionality

## API Endpoint Mapping

| Legacy Endpoint | FHIR Endpoint | Notes |
|-----------------|---------------|-------|
| `GET /api/patients` | `GET /fhir/R4/Patient` | Returns FHIR Bundle |
| `GET /api/patients/{id}` | `GET /fhir/R4/Patient/{id}` | Returns FHIR Patient |
| `POST /api/patients` | `POST /fhir/R4/Patient` | Create FHIR Patient |
| `GET /api/encounters` | `GET /fhir/R4/Encounter` | Returns FHIR Bundle |
| `GET /api/medications` | `GET /fhir/R4/MedicationRequest` | Returns FHIR Bundle |
| `GET /api/conditions` | `GET /fhir/R4/Condition` | Returns FHIR Bundle |
| `GET /api/observations` | `GET /fhir/R4/Observation` | Returns FHIR Bundle |
| `GET /api/allergies` | `GET /fhir/R4/AllergyIntolerance` | Returns FHIR Bundle |

## Frontend Changes

### Service Layer
The frontend now uses a FHIR client (`fhirClient.js`) instead of the legacy API service:

```javascript
// Before (Legacy)
const response = await api.get('/api/patients');
const patients = response.data;

// After (FHIR)
const bundle = await fhirClient.searchPatients();
const patients = bundle.resources.map(transformFHIRPatient);
```

### Data Transformation
FHIR resources need to be transformed for UI consumption:

```javascript
// Transform FHIR Patient to UI format
const transformFHIRPatient = (fhirPatient) => {
  const name = fhirPatient.name?.[0] || {};
  return {
    id: fhirPatient.id,
    firstName: name.given?.join(' ') || '',
    lastName: name.family || '',
    dateOfBirth: fhirPatient.birthDate,
    gender: fhirPatient.gender,
    // ... other mappings
  };
};
```

### Context Updates
The `ClinicalContext` now fetches all data via FHIR:

```javascript
// Load patient with related resources
const loadPatient = async (patientId) => {
  const patient = await fhirClient.getPatient(patientId);
  const conditions = await fhirClient.searchConditions({ patient: patientId });
  const medications = await fhirClient.searchMedicationRequests({ patient: patientId });
  // ... etc
};
```

## Database Changes

### Schema Structure
```
public schema (legacy - removed)
├── patients (removed)
├── encounters (removed)
└── ... other legacy tables

fhir schema (new)
├── resources (stores all FHIR resources as JSONB)
├── resource_history (version history)
├── search_params (extracted search parameters)
└── references (resource relationships)

emr schema (EMR extensions)
├── users
├── sessions
├── workflows
└── ... EMR-specific tables
```

### Querying FHIR Data
```sql
-- Get all patients
SELECT * FROM fhir.resources 
WHERE resource_type = 'Patient' 
AND NOT deleted;

-- Get patient by ID
SELECT * FROM fhir.resources 
WHERE resource_type = 'Patient' 
AND fhir_id = 'patient-123';
```

## Removed Files

The following legacy files have been removed:
- `/backend/api/app/` - Entire legacy API directory
- `/backend/api/patients.py` - Legacy patient endpoints
- `/backend/api/encounters.py` - Legacy encounter endpoints
- `/backend/api/medications.py` - Legacy medication endpoints
- `/backend/models/` - Legacy SQLAlchemy models (if using FHIR-only)

## Testing

### API Testing
Test against the FHIR endpoints:

```bash
# Get capability statement
curl http://localhost:8000/fhir/R4/metadata

# Search patients
curl http://localhost:8000/fhir/R4/Patient

# Get specific patient
curl http://localhost:8000/fhir/R4/Patient/{id}
```

### Frontend Testing
1. Clear browser cache and localStorage
2. Login with test credentials
3. Verify all clinical data loads via FHIR APIs
4. Check browser network tab - should only see `/fhir/R4/*` calls

## Benefits of Migration

1. **Standards Compliance**: Full FHIR R4 compliance
2. **Interoperability**: Frontend works with any FHIR server
3. **Flexibility**: JSONB storage allows schema evolution
4. **Maintainability**: Clear separation of concerns
5. **Testing**: Can test against public FHIR servers

## Troubleshooting

### Common Issues

1. **404 Errors on Legacy Endpoints**
   - Clear browser cache and localStorage
   - Ensure frontend is using latest build
   - Check that legacy API imports are removed

2. **Data Format Errors**
   - FHIR resources need transformation for UI
   - Check transformation functions in components
   - Verify FHIR resource structure in API responses

3. **Search Parameter Issues**
   - FHIR uses different search syntax
   - Use `?name=smith` not `?search=smith`
   - Check FHIR search parameter documentation

## Next Steps

1. Implement remaining FHIR operations (patch, conditional operations)
2. Add SMART on FHIR authentication
3. Implement FHIR Subscriptions for real-time updates
4. Add Bulk Data Export capability
5. Enhance terminology service integration