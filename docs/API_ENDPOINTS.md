# EMR System API Endpoints Reference

## Base URLs
- **Local Development**: `http://localhost:8000`
- **Production**: `http://your-domain.com`

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

## Application API Endpoints

### Authentication
```
GET /api/auth/providers              # List all providers
POST /api/auth/login                 # Login
POST /api/auth/logout                # Logout
GET /api/auth/me                     # Current user info
```

### Patients
```
GET /api/patients                    # List all patients
GET /api/patients/{patient-id}       # Get patient details
GET /api/patients/{patient-id}/summary  # Patient summary
```

### Clinical Data
```
GET /api/patients/{patient-id}/conditions      # Conditions/Diagnoses
GET /api/patients/{patient-id}/medications     # Medications
GET /api/patients/{patient-id}/observations    # Labs/Vitals
GET /api/patients/{patient-id}/encounters      # Encounters
GET /api/patients/{patient-id}/allergies       # Allergies
```

### Documentation & Notes
```
GET /api/notes/patient/{patient-id}            # Get notes
POST /api/notes                                 # Create note
PUT /api/notes/{note-id}                        # Update note
```

### Orders
```
GET /api/orders/patient/{patient-id}           # Get orders
POST /api/orders                                # Create order
```

### Clinical Catalogs
```
GET /api/catalogs/medications                   # Medication catalog
GET /api/catalogs/lab-tests                     # Lab test catalog
GET /api/catalogs/imaging                       # Imaging catalog
```

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
curl http://your-domain/fhir/R4/Patient?_count=10
```

### Get Patient Conditions (FHIR)
```bash
curl http://your-domain/fhir/R4/Condition?patient=PATIENT_ID
```

### Trigger CDS Hook
```bash
curl -X POST http://your-domain/cds-hooks/diabetes-a1c-monitoring \
  -H "Content-Type: application/json" \
  -d '{
    "hookInstance": "test-123",
    "hook": "patient-view",
    "context": {
      "patientId": "PATIENT_ID"
    }
  }'
```

### Login
```bash
curl -X POST http://your-domain/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "PROVIDER_ID"
  }'
```