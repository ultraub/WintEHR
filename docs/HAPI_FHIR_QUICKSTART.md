# HAPI FHIR Quick Start Guide

**Branch**: `experimental/hapi-fhir-migration`
**Status**: Experimental - Ready for Testing

---

## Overview

This setup uses the official **HAPI FHIR JPA Server** Docker image instead of the custom Python FHIR backend.

```
Frontend (React) → HAPI FHIR Server (Java) → PostgreSQL
                    ↑
        Python Services (fhirclient)
```

---

## Quick Start

### 1. Start HAPI FHIR Server

```bash
# Start just HAPI FHIR and PostgreSQL
docker-compose up -d postgres hapi-fhir

# Check logs
docker-compose logs -f hapi-fhir
```

Wait for HAPI FHIR to be ready (watch for "Started Application" in logs).

### 2. Verify HAPI FHIR is Running

```bash
# Check metadata endpoint
curl http://localhost:8888/fhir/metadata

# Or visit in browser:
open http://localhost:8888/fhir
```

### 3. Generate & Import Synthea Data

```bash
# Generate Synthea FHIR data (if needed)
# This creates ./data/synthea_fhir/ with patient bundles
cd synthea
./run_synthea -p 20  # Generate 20 patients
cd ..

# Import to HAPI FHIR
docker-compose exec backend python scripts/import_synthea_to_hapi.py /app/data/synthea_fhir
```

### 4. Verify Data Imported

```bash
# Check patient count
curl "http://localhost:8080/fhir/Patient?_summary=count"

# Search for patients
curl "http://localhost:8080/fhir/Patient?_count=5"

# Get specific patient
curl "http://localhost:8080/fhir/Patient/patient-uuid-here"
```

---

## HAPI FHIR Endpoints

| Endpoint | Description |
|----------|-------------|
| `http://localhost:8888/fhir` | FHIR base URL |
| `http://localhost:8888/fhir/metadata` | Capability statement |
| `http://localhost:8888/fhir/Patient` | Patient resources |
| `http://localhost:8888/fhir/Observation` | Observations |
| `http://localhost:8888/fhir/Condition` | Conditions |
| `http://localhost:8888/fhir/MedicationRequest` | Medication requests |

---

## Configuration

HAPI FHIR is configured via environment variables in `docker-compose.yml`:

```yaml
hapi-fhir:
  image: hapiproject/hapi:latest
  environment:
    # Database
    spring.datasource.url: jdbc:postgresql://postgres:5432/emr_db
    spring.datasource.username: emr_user
    spring.datasource.password: emr_password

    # FHIR Settings
    hapi.fhir.fhir_version: R4
    hapi.fhir.server_address: http://localhost:8080/fhir
    hapi.fhir.allow_external_references: true
    hapi.fhir.cors.allowed_origin: "*"
```

---

## Testing FHIR Operations

### Search Examples

```bash
# Search patients by name
curl "http://localhost:8080/fhir/Patient?name=Smith"

# Search conditions for a patient
curl "http://localhost:8080/fhir/Condition?patient=Patient/abc123"

# Search with date range
curl "http://localhost:8080/fhir/Observation?date=ge2024-01-01&date=le2024-12-31"

# Patient $everything operation
curl "http://localhost:8080/fhir/Patient/abc123/\$everything"
```

### Create/Update Examples

```bash
# Create a new Patient
curl -X POST http://localhost:8080/fhir/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "name": [{"family": "Test", "given": ["John"]}],
    "gender": "male"
  }'

# Update a Patient
curl -X PUT http://localhost:8080/fhir/Patient/abc123 \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "id": "abc123",
    "name": [{"family": "Updated", "given": ["John"]}],
    "gender": "male"
  }'
```

---

## Troubleshooting

### HAPI FHIR not starting

```bash
# Check logs
docker-compose logs hapi-fhir

# Common issues:
# - PostgreSQL not ready: Wait for postgres health check
# - Port 8080 in use: Stop conflicting services
# - Database connection: Verify postgres credentials
```

### Data import fails

```bash
# Verify Synthea directory exists
ls -la data/synthea_fhir/

# Check HAPI FHIR is accessible
curl http://localhost:8080/fhir/metadata

# Try manual bundle import
curl -X POST http://localhost:8080/fhir \
  -H "Content-Type: application/fhir+json" \
  -d @data/synthea_fhir/patient_bundle.json
```

### Empty search results

```bash
# Verify data exists
curl "http://localhost:8080/fhir/Patient?_summary=count"

# Check HAPI FHIR logs for indexing
docker-compose logs hapi-fhir | grep -i "search parameter"
```

---

## Next Steps

Once HAPI FHIR is working:

1. **Migrate Python Services** to use `fhirclient`:
   ```bash
   pip install fhirclient
   # Update services to use fhirclient instead of direct DB
   ```

2. **Migrate Frontend** to use `fhir.js`:
   ```bash
   cd frontend
   npm install fhirclient
   # Update components to use SMART client
   ```

3. **Test Clinical Workflows**:
   - Chart Review
   - Orders
   - Results
   - Pharmacy

---

## Resources

- **HAPI FHIR Docs**: https://hapifhir.io/hapi-fhir/docs/
- **HAPI FHIR Docker**: https://hub.docker.com/r/hapiproject/hapi
- **FHIR R4 Spec**: https://www.hl7.org/fhir/R4/
- **Migration Spec**: [HAPI_FHIR_MIGRATION_SPEC.md](./HAPI_FHIR_MIGRATION_SPEC.md)
