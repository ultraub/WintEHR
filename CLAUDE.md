# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start Commands

### Start the entire system
```bash
./start.sh
```

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Frontend Development
```bash
cd frontend
npm install
npm start
```

### Testing
```bash
# Backend tests
docker exec emr-backend pytest tests/test_fhir_endpoints.py -v

# Frontend tests
cd frontend && npm test

# Run specific test
docker exec emr-backend pytest tests/test_fhir_endpoints.py::test_patient_crud -v

# Test content negotiation
docker exec emr-backend pytest tests/test_content_negotiation.py -v
```

### Synthea Data Generation
```bash
cd backend
# Generate 10 patients with full workflow
python scripts/synthea_workflow.py full --count 10

# Generate only (no import)
python scripts/synthea_workflow.py generate --count 5

# Import existing Synthea data
python scripts/synthea_workflow.py import

# Validate imported data
python scripts/synthea_workflow.py validate
```

## Architecture Overview

MedGenEMR is a **FHIR-native EMR system** built with:

- **Backend**: FastAPI (Python) with PostgreSQL JSONB storage
- **Frontend**: React with Material-UI, consuming FHIR R4 APIs
- **Database**: PostgreSQL with JSONB for flexible FHIR resource storage
- **Authentication**: Session-based with provider selection
- **Medical Imaging**: DICOM support with Cornerstone.js viewer
- **Real-time**: WebSocket support for notifications

### Key Architectural Principles

1. **FHIR-First**: All clinical data stored as FHIR R4 resources
2. **API Separation**: 
   - `/fhir/R4/*` - Standards-compliant FHIR API
   - `/api/emr/*` - EMR-specific extensions
   - `/cds-hooks/*` - Clinical decision support
   - `/api/clinical-canvas/*` - Advanced clinical workflows
3. **Frontend Agnostic**: React frontend can work with any FHIR R4 server
4. **PostgreSQL JSONB**: Flexible storage allowing standard SQL queries on FHIR resources
5. **Content Negotiation**: Full support for FHIR media types (application/fhir+json)

### Directory Structure

```
MedGenEMR/
├── backend/                     # FastAPI backend
│   ├── fhir_api/               # FHIR R4 API implementation
│   ├── emr_api/                # EMR-specific extensions
│   ├── api/                    # Legacy API routes (being migrated)
│   ├── core/fhir/              # Core FHIR operations (search, storage, validation)
│   ├── scripts/                # Utility scripts (Synthea, setup, etc.)
│   └── main.py                 # Main application entry point
├── frontend/                    # React frontend
│   ├── src/services/           # API clients (fhirClient.js, emrClient.js)
│   ├── src/components/         # UI components
│   └── src/pages/              # Page components
├── docs/                       # Documentation
│   └── consolidated/           # Architecture and migration guides
└── docker-compose.yml          # Container orchestration
```

## Key Files and Components

### Backend Entry Point
- `backend/main.py` - Main FastAPI application with router configuration

### FHIR Implementation
- `backend/fhir_api/router.py` - FHIR R4 API routes
- `backend/fhir_api/content_negotiation.py` - FHIR content type handling
- `backend/core/fhir/` - Core FHIR operations (search, storage, validation)
- `backend/api/fhir/` - FHIR-specific utilities and converters

### Frontend FHIR Client
- `frontend/src/services/fhirClient.js` - Main FHIR API client
- `frontend/src/services/emrClient.js` - EMR-specific API client

### Database Models
- `backend/models/models.py` - SQLAlchemy models for FHIR resources
- `backend/database.py` - Database configuration and connection

### Documentation
- `docs/consolidated/ARCHITECTURE.md` - Detailed technical architecture
- `docs/MIGRATION_PLAN.md` - Legacy to FHIR migration guide

## Development Workflow

### Adding New Features
1. For clinical features, implement as FHIR resources first
2. Use existing FHIR operations in `backend/core/fhir/`
3. Frontend should consume FHIR APIs directly via `fhirClient.js`
4. Only add EMR-specific APIs for non-FHIR functionality

### Working with FHIR Resources
- All clinical data is stored as FHIR R4 resources in PostgreSQL JSONB
- Use `backend/core/fhir/search.py` for FHIR search operations
- Use `backend/core/fhir/storage.py` for FHIR resource persistence
- Validate resources using `backend/core/fhir/validator.py`

### Common FHIR Operations

```python
# Create a Patient resource
POST /fhir/R4/Patient
Content-Type: application/fhir+json

# Search for Patients
GET /fhir/R4/Patient?name=Smith&birthdate=1970-01-01

# Get specific Patient
GET /fhir/R4/Patient/123

# Update Patient
PUT /fhir/R4/Patient/123
Content-Type: application/fhir+json

# Search with includes
GET /fhir/R4/Encounter?patient=123&_include=Encounter:practitioner
```

### Content Negotiation

The system supports FHIR content types:
```bash
# Request FHIR JSON
curl -H "Accept: application/fhir+json" http://localhost:8000/fhir/R4/Patient

# Send FHIR JSON
curl -X POST -H "Content-Type: application/fhir+json" -d @patient.json http://localhost:8000/fhir/R4/Patient
```

### Testing Strategy
- Backend tests focus on FHIR compliance: `backend/tests/test_fhir_endpoints.py`
- Content negotiation tests: `backend/tests/test_content_negotiation.py`
- Frontend tests use React Testing Library
- Use included test patients for development

## Data and Test Patients

### Included Test Data
The system includes 6 comprehensive test patients:
- John Doe: Diabetes, hypertension
- Jane Smith: Healthy with preventive care
- Robert Johnson: Multiple chronic conditions
- Maria Garcia: Pediatric patient
- William Brown: Elderly with polypharmacy
- Sarah Davis: Pregnancy and women's health

### Synthetic Data Generation
```bash
# Generate with default settings
python scripts/synthea_workflow.py full

# Generate specific number of patients
python scripts/synthea_workflow.py generate --count 20

# Generate with specific demographics
python scripts/synthea_workflow.py generate --state MA --city Boston

# Validate after import
python scripts/synthea_workflow.py validate
```

## CDS Hooks Integration

Built-in clinical decision support with 12+ hooks:
- Diabetes A1C monitoring
- Hypertension management
- Drug-drug interactions
- Preventive care reminders
- Kidney function monitoring
- Pregnancy care guidelines

Extend by adding new services in `backend/api/cds_hooks/cds_services.py`

## Medical Imaging (DICOM)

- Full DICOM support with Cornerstone.js viewer
- DICOM files stored in `backend/data/dicom_uploads/`
- Integrated with FHIR ImagingStudy resources

## WebSocket Support

Real-time notifications available at:
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8000/ws');

// Subscribe to patient updates
ws.send(JSON.stringify({
  type: 'subscribe',
  resource: 'Patient',
  id: '123'
}));
```

## Debugging Tips

### FHIR Search Issues
- Check search parameter extraction in `backend/core/fhir/search.py`
- Verify indexed parameters in PostgreSQL
- Use `_debug=true` parameter for detailed search info

### Content Type Issues
- Ensure proper Content-Type headers (application/fhir+json)
- Check content negotiation middleware logs
- Verify Accept headers in requests

### Database Performance
- Monitor JSONB query performance
- Use GIN indexes for frequently searched fields
- Check search parameter extraction logs

## Deployment

### Local Development
```bash
./start.sh  # Starts both backend and frontend
```

### Docker Compose
```bash
docker-compose up
```

### Production Deployment
```bash
# AWS EC2
./deployment/aws/deploy-ec2-production.sh

# Azure
./deployment/azure/deploy-azure-production.sh
```

## Key Dependencies

### Backend
- FastAPI 0.104.1 - Web framework
- SQLAlchemy 2.0.23 - ORM
- fhir.resources 7.1.0 - FHIR R4 models
- psycopg2-binary 2.9.9 - PostgreSQL driver
- pydicom 2.4.4 - DICOM image processing
- pytest-asyncio 0.21.1 - Async testing

### Frontend
- React 18.2.0 - UI framework
- Material-UI 5.14.0 - UI components
- cornerstone-core 2.6.1 - DICOM viewer
- axios 1.4.0 - HTTP client

## Migration Notes

This system is actively migrating from legacy APIs to FHIR-native implementation:
- Legacy routes in `backend/api/` are being phased out
- Frontend is being updated to use FHIR APIs directly
- Some legacy compatibility layers remain for transition period
- See `docs/MIGRATION_PLAN.md` for detailed migration status

## Troubleshooting

### Common Issues

1. **Port conflicts**: Use `lsof -i :8000` and `lsof -i :3000` to check
2. **Database connection**: Ensure PostgreSQL is running on port 5432
3. **CORS errors**: Check allowed origins in `backend/main.py`
4. **Synthea failures**: Verify Java is installed for Synthea generation
5. **Search not working**: Run `python scripts/reindex_search_params.py` to rebuild indexes

### Performance Optimization

- Use `_count` parameter to limit search results
- Implement pagination with `_offset` and `_count`
- Cache frequently accessed resources
- Monitor JSONB query patterns with `EXPLAIN ANALYZE`