# MedGenEMR FHIR-Native API Endpoints Reference

## Base URLs
- **Local Development**: `http://localhost:8000`
- **Production**: `http://your-domain.com`

## Overview
MedGenEMR provides a complete FHIR R4 compliant API with optional EMR extensions. All clinical data is accessed through standard FHIR endpoints, ensuring interoperability with any FHIR client.

## FHIR R4 Endpoints

All FHIR endpoints follow the pattern: `/fhir/R4/{resource}`

### Common FHIR Operations

1. **Capability Statement**
   ```
   GET /fhir/R4/metadata
   ```

2. **Patient Search**
   ```
   GET /fhir/R4/Patient
   GET /fhir/R4/Patient?_count=10
   GET /fhir/R4/Patient?name=Smith
   ```

3. **Get Specific Patient**
   ```
   GET /fhir/R4/Patient/{patient-id}
   ```

4. **Condition (Diagnosis) Search**
   ```
   GET /fhir/R4/Condition?patient={patient-id}
   ```

5. **Medication Request Search**
   ```
   GET /fhir/R4/MedicationRequest?patient={patient-id}
   ```

6. **Observation (Labs/Vitals) Search**
   ```
   GET /fhir/R4/Observation?patient={patient-id}
   GET /fhir/R4/Observation?patient={patient-id}&code=http://loinc.org|2160-0  # Creatinine
   ```

7. **Encounter Search**
   ```
   GET /fhir/R4/Encounter?patient={patient-id}
   ```

### Bulk Export
```
POST /fhir/R4/$export
GET /fhir/R4/$export-status/{export-id}
GET /fhir/R4/$export-download/{export-id}/{filename}
```

## CDS Hooks Endpoints

### Discovery Endpoint
```
GET /cds-hooks/
```
Returns available CDS services

### Available CDS Services

1. **Diabetes A1C Monitoring**
   ```
   POST /cds-hooks/diabetes-a1c-monitoring
   ```

2. **Kidney Function Alert**
   ```
   POST /cds-hooks/kidney-function-alert
   ```

3. **Glucose Management**
   ```
   POST /cds-hooks/glucose-management
   ```

4. **Pain Assessment Follow-up**
   ```
   POST /cds-hooks/pain-assessment-followup
   ```

5. **Elderly Comprehensive Care**
   ```
   POST /cds-hooks/elderly-comprehensive-care
   ```

6. **Opioid Risk Assessment**
   ```
   POST /cds-hooks/opioid-risk-assessment
   ```

### CDS Hook Request Format
```json
{
  "hookInstance": "unique-instance-id",
  "hook": "patient-view",
  "context": {
    "patientId": "patient-id-here"
  }
}
```

## EMR Extension API Endpoints

**Note**: These are optional extensions to core FHIR functionality. All clinical data should be accessed via FHIR endpoints when possible.

### Authentication (EMR Extension)
```
GET /api/emr/auth/providers          # List all providers
POST /api/emr/auth/login             # Provider login
POST /api/emr/auth/logout            # Logout
GET /api/emr/auth/me                 # Current user info
```

### Clinical Decision Support
```
GET /api/emr/clinical/alerts         # Active clinical alerts
POST /api/emr/clinical/evaluate      # Evaluate CDS rules
```

### Workflow Extensions
```
GET /api/emr/workflow/tasks          # Workflow tasks
POST /api/emr/workflow/complete      # Complete workflow step
```

### UI State Management
```
GET /api/emr/ui/state                # User UI preferences
POST /api/emr/ui/state               # Save UI state
```

**⚠️ Deprecated Legacy Endpoints**
The following endpoints have been removed in favor of FHIR APIs:
- ~~`/api/patients/*`~~ → Use `/fhir/R4/Patient`
- ~~`/api/encounters/*`~~ → Use `/fhir/R4/Encounter`
- ~~`/api/observations/*`~~ → Use `/fhir/R4/Observation`
- ~~`/api/conditions/*`~~ → Use `/fhir/R4/Condition`
- ~~`/api/medications/*`~~ → Use `/fhir/R4/MedicationRequest`
- ~~`/api/allergies/*`~~ → Use `/fhir/R4/AllergyIntolerance`
- ~~`/api/notes/*`~~ → Use `/fhir/R4/DocumentReference`
- ~~`/api/orders/*`~~ → Use `/fhir/R4/ServiceRequest`
- ~~`/api/catalogs/*`~~ → Use FHIR terminology services

## Testing Endpoints

### Health Check
```
GET /health
GET /api/health
```

### API Documentation
```
GET /docs          # Swagger UI
GET /redoc         # ReDoc
GET /openapi.json  # OpenAPI spec
```

## Example Usage

### Get Patient List (FHIR)
```bash
curl http://localhost:8000/fhir/R4/Patient?_count=10
```

### Get Patient Everything Bundle (FHIR)
```bash
curl "http://localhost:8000/fhir/R4/Patient/[id]/$everything"
```

### Search Patient Resources (FHIR)
```bash
# Get all conditions for a patient
curl "http://localhost:8000/fhir/R4/Condition?patient=PATIENT_ID"

# Get recent lab results
curl "http://localhost:8000/fhir/R4/Observation?patient=PATIENT_ID&category=laboratory&_sort=-date"

# Get active medications
curl "http://localhost:8000/fhir/R4/MedicationRequest?patient=PATIENT_ID&status=active"
```

### Create FHIR Resources
```bash
# Create a new patient
curl -X POST http://localhost:8000/fhir/R4/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "name": [{"given": ["John"], "family": "Doe"}],
    "gender": "male",
    "birthDate": "1990-01-01"
  }'
```

### Trigger CDS Hook
```bash
curl -X POST http://localhost:8000/cds-hooks/diabetes-a1c-monitoring \
  -H "Content-Type: application/json" \
  -d '{
    "hookInstance": "test-123",
    "hook": "patient-view",
    "context": {
      "patientId": "PATIENT_ID"
    }
  }'
```

### EMR Login
```bash
curl -X POST http://localhost:8000/api/emr/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "PROVIDER_ID"
  }'
```