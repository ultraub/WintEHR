# CDS Management Studio

**Purpose**: Developer tool for managing CDS Hooks services with complete transparency and ease of use.

**Version**: 1.0
**Status**: Phase 1 Complete (Backend API + Frontend Infrastructure)
**Last Updated**: 2025-10-18

---

## Overview

CDS Management Studio provides a comprehensive interface for creating, configuring, monitoring, and testing CDS Hooks services in WintEHR. It emphasizes transparency (viewing complete FHIR PlanDefinitions), ease of service creation, and production-grade service monitoring.

### Key Features

1. **Service Registry**: Browse all CDS services (built-in + external) with filtering
2. **Configuration Transparency**: View complete PlanDefinition JSON with human-readable breakdown
3. **Service Builder**: Create services with inline Python code editor
4. **External Service Registration**: Register and monitor external HTTP CDS services
5. **Service Testing**: Test services with synthetic patient data before deployment
6. **Simple Versioning**: Auto-increment versions with rollback capability
7. **Discovery Import**: Import services from external CDS discovery endpoints
8. **Credentials Manager**: Centralized API key and OAuth credential management
9. **Monitoring Dashboard**: Service health, performance metrics, and failure tracking

---

## Architecture

### Backend (Phase 1 - Complete)

**Location**: `backend/api/cds_studio/`

**Components**:
- `router.py` - FastAPI endpoints for all operations
- `service.py` - Business logic layer
- `models.py` - Pydantic models for requests/responses

**Key Endpoints**:

```
GET    /api/cds-studio/services                    # List all services
GET    /api/cds-studio/services/{id}/config        # Get configuration
GET    /api/cds-studio/services/{id}/config/view   # Get JSON + breakdown
POST   /api/cds-studio/services/built-in           # Create built-in service
POST   /api/cds-studio/services/external           # Register external service
POST   /api/cds-studio/services/{id}/test          # Test service
GET    /api/cds-studio/services/{id}/metrics       # Get metrics
PUT    /api/cds-studio/services/{id}/status        # Update status
DELETE /api/cds-studio/services/{id}               # Delete service
GET    /api/cds-studio/services/{id}/versions      # Version history
POST   /api/cds-studio/services/{id}/rollback      # Rollback to version
```

### Frontend (Phase 1 - In Progress)

**Location**: `frontend/src/modules/cds-studio/`

**Structure**:
```
cds-studio/
├── pages/              # Page-level components
├── components/         # Reusable UI components
├── hooks/              # Custom React hooks
├── services/           # API client (cdsStudioApi.js)
└── store/              # Redux state management
```

**API Client**: `services/cdsStudioApi.js` - Complete client for all backend operations

---

## Implementation Status

### ✅ Phase 1: Service Registry & Configuration Viewer (Complete)

**Backend**:
- [x] Service list endpoint with filtering (hook type, origin, status, search)
- [x] Service configuration endpoint (complete FHIR PlanDefinition + metadata)
- [x] Configuration view endpoint (JSON + human-readable breakdown)
- [x] Router registered with main FastAPI app

**Frontend**:
- [x] Directory structure created
- [x] API client service complete
- [ ] Services table/list view
- [ ] Service detail panel with tabs
- [ ] Configuration viewer (JSON + breakdown split view)

### 🚧 Phase 2: Service Builder

**Planned Features**:
- [ ] Monaco editor integration for Python code editing
- [ ] Built-in service creation form
- [ ] External service registration form (single hook)
- [ ] Simple versioning (auto-increment, rollback)

### 📋 Phase 3: Discovery Import

**Planned Features**:
- [ ] Discovery URL fetcher
- [ ] Service selection table
- [ ] Batch import workflow

### 📋 Phase 4: Credentials Manager

**Planned Features**:
- [ ] Credential CRUD interface
- [ ] Test credential functionality
- [ ] Service-credential association
- [ ] Audit logging

### 📋 Phase 5: Monitoring Dashboard

**Planned Features**:
- [ ] Health summary cards
- [ ] Per-service metrics
- [ ] Failure tracking
- [ ] Performance charts

### 📋 Phase 6: Version Management

**Planned Features**:
- [ ] Version history viewer
- [ ] Diff between versions
- [ ] Rollback functionality
- [ ] Version notes/changelog

### 📋 Phase 7: Polish & Integration

**Planned Features**:
- [ ] Material-UI theming
- [ ] Real-time updates via WebSocket
- [ ] Export/import configurations
- [ ] Inline help tooltips

---

## API Models

### Service List Response

```json
{
  "services": [
    {
      "id": 1,
      "service_id": "diabetes-screening",
      "title": "Diabetes Screening Reminder",
      "hook_type": "patient-view",
      "origin": "built-in",
      "status": "active",
      "version": "1.0.0",
      "last_executed": "2025-10-18T10:30:00Z",
      "execution_count_24h": 45,
      "success_rate": 98.5
    }
  ],
  "total": 1,
  "filters_applied": {}
}
```

### Configuration View

```json
{
  "plan_definition_json": {
    "resourceType": "PlanDefinition",
    "id": "diabetes-screening",
    "status": "active",
    "title": "Diabetes Screening Reminder",
    "extension": [...]
  },
  "breakdown": {
    "service_origin": "built-in",
    "service_origin_explanation": "This service runs within WintEHR using Python code...",
    "hook_type": "patient-view",
    "hook_type_description": "Fires when a clinician opens a patient's chart",
    "execution_method": "LocalServiceProvider",
    "execution_details": "Python class: api.cds_hooks.services.diabetes_screening.DiabetesScreeningService",
    "prefetch_summary": "2 prefetch queries defined: patient, conditions",
    "extensions": [...]
  }
}
```

### Create Built-in Service Request

```json
{
  "service_id": "new-service",
  "hook_type": "medication-prescribe",
  "title": "Medication Safety Check",
  "description": "Checks for drug interactions and allergies",
  "source_code": "class MedicationSafetyService:\n    def evaluate(self, context, prefetch):\n        ...",
  "prefetch_template": {
    "patient": "Patient/{{context.patientId}}",
    "medications": "MedicationRequest?patient={{context.patientId}}&status=active"
  },
  "status": "draft",
  "version_notes": "Initial version"
}
```

### Test Service Request

```json
{
  "patient_id": "Patient/123",
  "user_id": "Practitioner/456",
  "encounter_id": "Encounter/789",
  "context_override": {},
  "prefetch_override": {}
}
```

### Test Service Response

```json
{
  "success": true,
  "execution_time_ms": 245,
  "cards": [
    {
      "summary": "Patient due for diabetes screening",
      "indicator": "info",
      "source": {"label": "Diabetes Screening Service"}
    }
  ],
  "prefetch_data": {...},
  "logs": ["Checking patient age...", "Patient is 66 years old"],
  "errors": []
}
```

---

## Development Notes

### Design Decisions

1. **Monaco Editor for Code**: Users can write/edit Python service code directly in the UI
2. **Single Hook Registration**: Simplified UI - one hook per registration (no batch complexity)
3. **Discovery Import Included**: Full wizard for importing from external CDS services
4. **Simple Versioning**: Auto-increment versions with rollback, not full Git-like version control
5. **HAPI FHIR Integration**: All services stored as PlanDefinition resources in HAPI FHIR
6. **Proxy Pattern**: Backend acts as intelligent proxy, HAPI handles storage/search

### Security Considerations

- All endpoints require authentication (user dependency)
- Python code validation before deployment (syntax check, security scan)
- Credentials encrypted in database (Fernet encryption)
- Audit logging for service creation/modification
- Sandbox mode for testing (doesn't affect production metrics)

### Performance Optimization

- Service list: Cached results from HAPI FHIR search
- Metrics: Aggregated from service_executions table (future)
- Code validation: Async operations, timeout protection
- WebSocket updates: Real-time service status changes (future)

---

## Next Steps

**Immediate (Phase 1 Completion)**:
1. Create frontend services table component
2. Implement service detail panel with tabs
3. Build configuration viewer with JSON/breakdown split view

**Short-term (Phase 2)**:
1. Integrate Monaco editor for Python code editing
2. Create service builder forms (built-in + external)
3. Implement versioning system backend + frontend

**Medium-term (Phases 3-5)**:
1. Discovery import wizard
2. Credentials management UI
3. Monitoring dashboard with charts

**Long-term (Phases 6-7)**:
1. Version comparison and diff viewer
2. Material-UI theming polish
3. Real-time WebSocket integration

---

## Testing

### Backend Testing

```bash
# Test service registry endpoints
curl http://localhost:8000/api/cds-studio/services

# Test service configuration
curl http://localhost:8000/api/cds-studio/services/diabetes-screening/config

# Test configuration view (JSON + breakdown)
curl http://localhost:8000/api/cds-studio/services/diabetes-screening/config/view
```

### Frontend Testing (Once Complete)

```bash
# Navigate to CDS Studio
http://localhost:3000/cds-studio

# Test service list filtering
# Test service detail panel
# Test configuration viewer
# Test service creation
# Test service testing
```

---

## References

- **CDS Hooks Specification**: https://cds-hooks.hl7.org/
- **FHIR PlanDefinition**: https://hl7.org/fhir/R4/plandefinition.html
- **HAPI FHIR Documentation**: https://hapifhir.io/hapi-fhir/docs/
- **Monaco Editor**: https://microsoft.github.io/monaco-editor/

---

## Contact & Support

For issues or questions about CDS Management Studio:
1. Check this README
2. Review API documentation at `/docs` (Swagger UI)
3. Check existing services for patterns
4. Consult main project documentation

**Educational Purpose**: This is a learning tool - experiment, break things, and understand how CDS Hooks services work!
