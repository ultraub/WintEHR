# FHIR Consolidation Context for Claude Code

## Current State Overview

### Two FHIR Router Implementations
1. **Active Router** (`backend/fhir_api/router.py`)
   - Mounted at `/fhir/R4` in main.py
   - Clean architecture using FHIRStorageEngine
   - Missing critical features (lot tracking, _has, composites)
   
2. **Enhanced Router** (`backend/api/fhir/fhir_router.py`)
   - NOT mounted in main.py (inactive)
   - Contains all Phase 1-3 enhancements
   - Uses hybrid storage approach

### Key Files and Locations
```
backend/
├── main.py                               # App entry point - mounts routers
├── fhir_api/
│   └── router.py                        # ACTIVE router (clean but limited)
├── api/
│   └── fhir/
│       ├── fhir_router.py              # ENHANCED router (feature-rich but inactive)
│       ├── query_builder.py            # Advanced JSONB queries
│       └── composite_search.py         # Composite parameter support
└── core/
    └── fhir/
        ├── storage.py                  # Core storage engine
        ├── search.py                   # Search parameter handler
        └── validator.py                # FHIR validation

frontend/src/
├── services/
│   ├── fhirClient.js                   # Main FHIR client
│   └── fhirService.js                  # Compatibility wrapper
└── contexts/
    └── FHIRResourceContext.js          # Resource state management
```

## Target State

### Single Consolidated Router
- Mount enhanced router at `/fhir/R4` 
- Preserve all Phase 1-3 features
- Standardize on FHIRStorageEngine
- Remove duplicate/inactive code

### Required Changes

#### 1. Router Activation
```python
# In backend/main.py, change:
from fhir_api.router import fhir_router
# To:
from api.fhir.fhir_router import router as fhir_router
```

#### 2. Storage Integration
The enhanced router needs updating to use FHIRStorageEngine consistently:
- Replace direct SQLAlchemy queries
- Use storage engine search methods
- Standardize reference handling

#### 3. Import Cleanup
```python
# Remove unused imports in enhanced router:
- from models.synthea_models import ...
- from models.clinical_data_models import ...

# Add storage engine import:
+ from core.fhir.storage import FHIRStorageEngine
```

## Migration Steps

### Phase 1: Test Environment Setup
1. Create parallel mount for testing:
```python
# In main.py
from api.fhir.fhir_router import router as enhanced_fhir_router
app.include_router(enhanced_fhir_router, prefix="/fhir/R4-beta", tags=["FHIR Beta"])
```

2. Update frontend to use beta endpoint:
```javascript
// In .env.development
REACT_APP_FHIR_ENDPOINT=/fhir/R4-beta
```

### Phase 2: Storage Migration
Convert enhanced router methods to use storage engine:

```python
# OLD (direct query)
query = db.query(Observation).filter(Observation.patient_id == patient_id)

# NEW (storage engine)
resources, total = await storage.search_resources(
    "Observation",
    {"patient": f"Patient/{patient_id}"}
)
```

### Phase 3: Feature Verification
Test critical features:
- Medication lot tracking: `GET /fhir/R4/MedicationDispense?lot-number=XXX`
- Order linking: `GET /fhir/R4/Observation?based-on=ServiceRequest/123`
- _has queries: `GET /fhir/R4/Patient?_has:Observation:patient:code=2339-0`
- Composites: `GET /fhir/R4/Observation?code-value-quantity=8480-6$gt140`

### Phase 4: Production Switch
1. Remove old router import
2. Update main.py to use enhanced router
3. Remove beta endpoint
4. Clean up unused files

## Code Patterns to Follow

### Search Parameter Handling
```python
# Use storage engine search
async def search_resources(resource_type: str, params: dict):
    storage = FHIRStorageEngine(db)
    search_handler = SearchParameterHandler()
    
    # Parse parameters
    search_params, result_params = search_handler.parse_search_params(
        resource_type, params
    )
    
    # Execute search
    resources, total = await storage.search_resources(
        resource_type, search_params
    )
```

### Reference Resolution
```python
# Use storage engine for includes
if "_include" in result_params:
    included = await storage.resolve_references(
        resources, result_params["_include"]
    )
```

### Error Handling
```python
try:
    result = await storage.operation()
except Exception as e:
    raise HTTPException(
        status_code=500,
        detail=create_operation_outcome(str(e))
    )
```

## Testing Checklist

### Unit Tests
- [ ] All search parameters work
- [ ] Composite searches return correct results
- [ ] _has queries filter properly
- [ ] Include/revinclude populate bundle

### Integration Tests
- [ ] Frontend can load patient data
- [ ] Pharmacy workflow functions
- [ ] Lab results display correctly
- [ ] Clinical notes save/load

### Performance Tests
- [ ] Search < 500ms for 1000 resources
- [ ] Bundle operations < 2s
- [ ] No memory leaks
- [ ] Concurrent request handling

## Rollback Plan

If issues arise:
1. Revert main.py import change
2. Restart backend services
3. Clear any caches
4. Verify frontend still works

Keep both routers until migration is verified in production.

## Common Issues and Solutions

### Issue: "Resource type not found"
- Ensure RESOURCE_MAPPINGS includes all types
- Check storage engine SUPPORTED_RESOURCES

### Issue: Search parameters not working
- Verify parameter in allowed list
- Check modifier support
- Ensure proper parsing

### Issue: References not resolving
- Check reference format (absolute vs relative)
- Verify target resources exist
- Ensure proper include syntax

## Success Criteria

1. All existing frontend functionality works
2. New search features accessible
3. No performance degradation
4. Clean code architecture
5. Comprehensive test coverage

## Next Steps

1. Create feature branch for consolidation
2. Set up parallel test environment
3. Run automated tests
4. Manual verification of critical paths
5. Gradual production rollout

This context document provides everything needed to execute the FHIR consolidation successfully.