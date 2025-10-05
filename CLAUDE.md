# CLAUDE.md - WintEHR AI Agent Quick Reference

**Purpose**: This is the primary operational guide for AI agents working with WintEHR. It provides essential context, critical rules, and quick references for effective development.

> **Important**: For detailed implementation patterns and comprehensive documentation, see [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md)

**Last Updated**: 2025-10-05
**Version**: 3.2

> **NEW**: Simplified deployment! See [DEPLOYMENT_SIMPLIFIED.md](./DEPLOYMENT_SIMPLIFIED.md) for the new streamlined approach.

> **🔄 HAPI FHIR MIGRATION** (2025-10-05): WintEHR has migrated from custom FHIR backend to industry-standard HAPI FHIR JPA Server. Old FHIR backend archived to `backend/archived/old_fhir_backend/`. Essential FHIR utilities preserved in `backend/shared/fhir_resources/`. See [backend/docs/HAPI_FHIR_MIGRATION_2025-10-05.md](backend/docs/HAPI_FHIR_MIGRATION_2025-10-05.md) for details.

## 🎯 Project Overview

**WintEHR** is a production-ready Electronic Medical Records system featuring:
- Full FHIR R4 implementation (38 resource types)
- Real-time clinical workflows (WebSocket + event-driven architecture)
- Dynamic clinical catalogs generated from actual patient data
- DICOM medical imaging with multi-slice viewer
- CDS Hooks integration with 10+ clinical decision support rules
- Comprehensive clinical modules (Chart Review, Orders, Results, Pharmacy, Imaging)
- Modern React 18 frontend with Material-UI
- FastAPI backend with async Python and PostgreSQL

## 📚 Module Documentation

**Each major functional area has its own detailed CLAUDE.md for focused development:**

| Module | Location | Purpose |
|--------|----------|---------|
| **Backend API** | [`backend/api/CLAUDE.md`](backend/api/CLAUDE.md) | FastAPI endpoints, routers, services, middleware |
| **Frontend Clinical UI** | [`frontend/src/CLAUDE.md`](frontend/src/CLAUDE.md) | React components, state management, FHIR client |
| **FHIR Engine** | [`backend/archived/old_fhir_backend/CLAUDE.md`](backend/archived/old_fhir_backend/CLAUDE.md) | ⚠️ **ARCHIVED** - Migrated to HAPI FHIR |
| **Data Management** | [`backend/scripts/CLAUDE.md`](backend/scripts/CLAUDE.md) | Deployment scripts, data import, validation |
| **Clinical Workflows** | [`backend/api/clinical/CLAUDE.md`](backend/api/clinical/CLAUDE.md) | CDS Hooks, orders, pharmacy, results, imaging |
| **Security/Auth** | [`backend/api/auth/CLAUDE.md`](backend/api/auth/CLAUDE.md) | Authentication, authorization, audit, compliance |

> **🎯 Pro Tip**: Start with the module-specific CLAUDE.md when working on a particular area. Each provides deep context, patterns, and troubleshooting specific to that module.

## 🚀 Quick Start (Simplified!)

### Development Environment (Recommended)
```bash
# ONE COMMAND for complete deployment with 20 patients
./deploy.sh dev

# Custom patient count
./deploy.sh dev --patients 50
```

### Production Deployment
```bash
# Production deployment with 100 patients
./deploy.sh prod --patients 100
```

### Other Operations
```bash
# Check system status
./deploy.sh status

# Stop all services
./deploy.sh stop

# Clean deployment (removes all data)
./deploy.sh clean
```

### Data Management (Simplified!)
```bash
# All data operations through one script
docker exec emr-backend python scripts/manage_data.py load     # Load patients
docker exec emr-backend python scripts/manage_data.py validate  # Validate data
docker exec emr-backend python scripts/manage_data.py status    # Check status
```

### Authentication Modes
- **Development**: JWT disabled, demo users (demo/nurse/pharmacist/admin, password: password)
- **Production**: JWT enabled, secure authentication required

## ⚠️ CRITICAL RULES (MUST FOLLOW)

### 1. Task Management Protocol
**EVERY task MUST**:
1. ✅ Start with research phase (check docs, modules, patterns, context7)
2. ✅ Break into subtasks using TodoWrite with clear phases
3. ✅ Implement completely - no partial features or TODOs
4. ✅ End with two-pass code review + git commit + doc updates

### 2. Data Standards
**ALWAYS**: 
- Use Synthea-generated FHIR data (never mock data)
- Test with multiple real patients from database
- Handle all null/undefined cases gracefully
- Use fhirClient for all FHIR operations (not fhirService)
- Validate resources against FHIR R4 spec

**NEVER**: 
- Create mock/fake patient data
- Hardcode resource IDs or references
- Use array indexes for lookups
- Skip data validation
- Assume data exists without checking

### 3. Code Quality
**ALWAYS**: 
- Implement complete features (no TODOs or placeholders)
- Add proper loading states and skeletons
- Implement comprehensive error handling
- Use event patterns for cross-module communication
- Keep code clean, simple, and readable
- Follow existing patterns in codebase

**NEVER**: 
- Leave console.log() statements in code
- Ship partial implementations
- Create direct coupling between modules
- Skip integration testing
- Add unnecessary complexity

### 4. Documentation
**ALWAYS**: 
- Update module docs immediately after changes
- Cross-reference related documentation
- Add dates to all updates (format: YYYY-MM-DD)
- Document breaking changes prominently
- Update integration guides when needed

**NEVER**: 
- Leave outdated documentation
- Skip documentation updates
- Create unnecessary documentation files
- Document without testing first

## 📁 Project Structure

```
WintEHR/
├── frontend/
│   ├── src/
│   │   ├── components/clinical/    # Clinical UI components
│   │   ├── services/               # FHIR & business logic
│   │   ├── contexts/               # React contexts
│   │   └── hooks/                  # Custom React hooks
│   └── package.json
├── backend/
│   ├── api/                        # FastAPI endpoints
│   ├── fhir/                       # FHIR storage engine
│   ├── services/                   # Business services
│   └── scripts/                    # Data management
├── .claude/                        # AI agent configuration
│   ├── agents/                     # Automation scripts
│   ├── hooks/                      # Lifecycle hooks
│   └── knowledge/                  # Pattern library
└── docs/                          # All documentation
```

## 💻 Common Development Workflows

### Feature Implementation Workflow
```bash
# 1. Research and understand the requirement
# Check docs, existing patterns, and FHIR specifications

# 2. Create feature branch
git checkout -b feat/your-feature-name

# 3. Start development environment
./deploy.sh dev  # Simplified!

# 4. Run quality checks
docker exec emr-backend pytest tests/ -v
docker exec emr-frontend npm test
docker exec emr-frontend npm run lint

# 5. Update documentation
# Update relevant module docs in docs/modules/
# Update CLAUDE.md if adding new patterns

# 6. Commit with conventional message
git commit -m "feat: Add your feature description"
```

### Debugging Workflow
```bash
# 1. Check system status
./deploy.sh status

# 2. Enable verbose logging
docker-compose logs -f backend frontend

# 3. Validate data integrity
docker exec emr-backend python scripts/manage_data.py validate --verbose

# 4. Test specific FHIR queries
curl http://localhost:8000/fhir/R4/Patient?name=Smith
```

### Performance Testing
```bash
# 1. Monitor frontend performance
# Use Chrome DevTools Performance tab
# Check bundle sizes: npm run analyze

# 2. Backend performance
docker exec emr-backend python -m cProfile -o profile.stats your_script.py

# 3. Database query analysis
docker exec emr-postgres psql -U emr_user -d emr_db -c "EXPLAIN ANALYZE your_query;"
```

## 🔧 Common Commands (Simplified!)

### Development Workflow
```bash
# Start development environment
./deploy.sh dev

# Stop services
./deploy.sh stop

# Check status
./deploy.sh status

# Run tests
docker exec emr-backend pytest tests/ -v
docker exec emr-frontend npm test

# View logs
docker-compose logs -f backend     # Backend logs
docker-compose logs -f frontend    # Frontend logs
```

### Data Management
```bash
# Load patient data
docker exec emr-backend python scripts/manage_data.py load --patients 20

# Validate data
docker exec emr-backend python scripts/manage_data.py validate

# Check data status
docker exec emr-backend python scripts/manage_data.py status

# Re-index search parameters
docker exec emr-backend python scripts/manage_data.py index
```

### Git Workflow
```bash
# Conventional commits REQUIRED
git commit -m "feat: Add medication interaction checking"
git commit -m "fix: Handle null medication references"
git commit -m "docs: Update pharmacy module guide"
git commit -m "chore: Update deployment scripts"
```

## 📝 Code Style & Conventions

### JavaScript/React
```javascript
// Use ES6+ features
import { useState, useEffect } from 'react';

// Destructure props and state
const { patient, loading, error } = usePatientData();

// Use async/await over promises
const fetchData = async () => {
  try {
    const data = await fhirService.getPatient(id);
    setPatient(data);
  } catch (error) {
    handleError(error);
  }
};

// Prefer functional components with hooks
const ComponentName = ({ prop1, prop2 }) => {
  // Component logic
};

// Use proper error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <ClinicalComponent />
</ErrorBoundary>
```

### Python/FastAPI
```python
# Use type hints
from typing import Optional, List, Dict

async def get_patient(patient_id: str) -> Optional[Dict]:
    """Get patient by ID with proper error handling."""
    try:
        return await storage.get_resource("Patient", patient_id)
    except ResourceNotFound:
        raise HTTPException(404, f"Patient {patient_id} not found")

# Use dependency injection
async def endpoint(
    request: Request,
    storage: FHIRStorageEngine = Depends(get_storage)
):
    # Implementation

# Follow PEP 8 strictly
# Use descriptive variable names
# Add docstrings to all functions
```

### Testing Conventions
```javascript
// Frontend tests
describe('ComponentName', () => {
  it('should handle patient data correctly', async () => {
    // Arrange
    const mockPatient = createMockPatient();
    
    // Act
    const { result } = renderHook(() => usePatientData(mockPatient.id));
    
    // Assert
    expect(result.current.patient).toEqual(mockPatient);
  });
});
```

```python
# Backend tests
@pytest.mark.asyncio
async def test_patient_creation():
    """Test patient resource creation with validation."""
    # Arrange
    patient_data = generate_test_patient()
    
    # Act
    result = await storage.create_resource("Patient", patient_data)
    
    # Assert
    assert result["id"] is not None
    assert result["resourceType"] == "Patient"
```

## 🏗️ Key Patterns

### Frontend State Management
```javascript
// Use contexts for complex state management
const { resources, loading, error } = useFHIRResource();
const { publish, subscribe } = useClinicalWorkflow();

// Progressive loading with proper error handling
try {
  setLoading(true);
  await fetchPatientBundle(patientId, false, 'critical');
} catch (error) {
  showError('Failed to load patient data');
} finally {
  setLoading(false);
}
```

### Backend Services
```python
# Repository pattern with async/await
class FHIRStorageEngine:
    async def create_resource(self, resource_type: str, data: dict) -> dict:
        # Validate FHIR resource
        # Store in database
        # Index search parameters
        # Update compartments
        # Return created resource

# Dependency injection
async def endpoint(
    storage: FHIRStorageEngine = Depends(get_storage)
) -> JSONResponse:
    # Implementation
```

### Cross-Module Event System
```javascript
// Event types defined in constants
import { CLINICAL_EVENTS } from '@/constants/clinicalEvents';

// Publisher with error handling
try {
  await publish(CLINICAL_EVENTS.ORDER_PLACED, {
    orderId: order.id,
    patientId: patient.id,
    timestamp: new Date().toISOString()
  });
} catch (error) {
  console.error('Failed to publish event:', error);
}

// Subscriber with cleanup
useEffect(() => {
  const unsubscribe = subscribe(
    CLINICAL_EVENTS.ORDER_PLACED, 
    handleOrderPlaced
  );
  return () => unsubscribe();
}, []);
```

## 🗄️ Database Architecture

WintEHR uses 6 critical FHIR tables:

| Table | Purpose | Population Method |
|-------|---------|-------------------|
| `fhir.resources` | Main resource storage | Direct during import |
| `fhir.resource_history` | Version tracking | Auto on create/update |
| `fhir.search_params` | Search indexes | During import + re-indexing |
| `fhir.references` | Resource relationships | Auto on create/update |
| `fhir.compartments` | Patient compartments | Script after import |
| `fhir.audit_logs` | Audit trail | Requires code implementation |

All tables are created by `init_database_definitive.py` during deployment.

## 🔎 FHIR Search Parameter Indexing

### Important Requirements
- **Search parameters MUST be indexed** for all FHIR resources during deployment
- The backend extracts search params during resource creation/update
- A migration step re-indexes existing resources during deployment
- **Critical**: Synthea uses URN format (`urn:uuid:`) for references - search must handle this

### Key Search Parameters
- **patient/subject**: Required for Condition, Observation, MedicationRequest, etc.
  - Note: `patient` is an alias for `subject` reference in many resources
  - Synthea stores these as `urn:uuid:patient-id` in `value_string` column
- **_id**: Resource identifier
- **code**: Clinical codes (conditions, medications, observations)
- **status**: Resource status
- **date**: Temporal queries

### Reference Format Support
The system supports multiple reference formats:
- **Standard FHIR**: `Patient/123` or `Observation/456`
- **URN format**: `urn:uuid:123` (used by Synthea)
- **Relative**: Just the ID like `123`
All formats are checked in both `value_reference` and `value_string` columns.

### Build Process Integration
The deployment automatically runs search parameter indexing:
1. Data import (Phase 3)
2. **Search parameter indexing** (Phase 4) - Consolidated script
3. **URN reference fix** (Phase 4, Step 5) - Maps UUIDs to patient IDs (Added 2025-07-31)
4. DICOM generation (Phase 5)

### URN Reference Fix (Added 2025-07-31)
Synthea data uses URN format references that need special handling:
- **Issue**: Resources reference patients as `urn:uuid:patient-uuid` instead of `Patient/id`
- **Affected**: AllergyIntolerance, Condition, Observation, MedicationRequest, Procedure, Immunization
- **Fix**: Run `fix_allergy_intolerance_search_params_v2.py` to map UUIDs to patient IDs
- **Integrated**: Automatically runs during deployment at Module 04, Step 5

### Common Search Examples
```bash
# Patient searches
/fhir/R4/Patient?name=Smith
/fhir/R4/Patient?birthdate=1970-01-01

# Clinical searches - REQUIRE indexed patient/subject params
/fhir/R4/Condition?patient=Patient/123&clinical-status=active
/fhir/R4/MedicationRequest?patient=Patient/123&status=active
/fhir/R4/Observation?patient=Patient/123&category=vital-signs

# Date range searches
/fhir/R4/Encounter?patient=Patient/123&date=ge2024-01-01&date=le2024-12-31
```

### Troubleshooting
If searches return empty results:
```bash
# Verify search parameters after import
docker exec emr-backend python scripts/testing/verify_search_params_after_import.py

# Auto-fix missing search parameters
docker exec emr-backend python scripts/testing/verify_search_params_after_import.py --fix

# Or use consolidated indexing script
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode index

# Monitor search parameter health
docker exec emr-backend python scripts/consolidated_search_indexing.py --mode monitor

# Verify specific resource type
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT param_name, COUNT(*) 
FROM fhir.search_params 
WHERE param_name IN ('patient', 'subject') 
GROUP BY param_name;"
```

### Monitoring & Maintenance
- **During import**: Validation verifies and auto-fixes missing parameters
- **After deployment**: Run verification script to check health
- **Production**: Monitor with `consolidated_search_indexing.py --mode monitor`

## 🔎 Patient Compartments

### Overview
Patient compartments group all resources related to a specific patient, enabling efficient Patient/$everything operations.

### Automatic Population
- Compartments are automatically populated during resource creation/update
- The `fhir.compartments` table tracks patient-resource relationships
- Build process includes compartment population (Step 5 in data processing)

### Manual Operations
```bash
# Populate compartments for existing resources
docker exec emr-backend python scripts/populate_compartments.py

# Verify compartment health
docker exec emr-backend python scripts/testing/verify_compartments.py

# Test compartment functionality (if available)
docker exec emr-backend python scripts/test_compartment_functionality.py
```

### Troubleshooting Compartments
If Patient/$everything returns incomplete results:
```bash
# Check compartment entries
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT COUNT(*) as total_compartments,
       COUNT(DISTINCT compartment_id) as unique_patients
FROM fhir.compartments
WHERE compartment_type = 'Patient';"

# Verify specific patient compartment
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT r.resource_type, COUNT(*) 
FROM fhir.compartments c
JOIN fhir.resources r ON r.id = c.resource_id
WHERE c.compartment_type = 'Patient'
AND c.compartment_id = 'YOUR_PATIENT_ID'
GROUP BY r.resource_type;"
```

## 📋 Clinical Modules

| Module | Location | Key Features |
|--------|----------|--------------|
| Chart Review | `components/tabs/ChartReviewTab.js` | Problems list, medications, allergies, vitals |
| Orders | `components/tabs/OrdersTab.js` | CPOE, order status tracking, clinical catalogs |
| Results | `components/tabs/ResultsTab.js` | Lab results, trends, critical alerts |
| Pharmacy | `pages/PharmacyDashboard.js` | Prescription queue, dispensing workflow |
| Imaging | `components/tabs/ImagingTab.js` | DICOM viewer, multi-slice support |

## 🎨 Clinical Design System

WintEHR now includes a comprehensive Clinical Design System:
- **Design Documentation**: [Clinical Design System](docs/CLINICAL_DESIGN_SYSTEM.md) - Complete design standards
- **Usage Examples**: [Clinical Design System Examples](docs/CLINICAL_DESIGN_SYSTEM_EXAMPLES.md) - Practical code examples
- **Shared Components**: 6 core clinical UI components with FHIR templates
- **Consistent Styling**: Sharp corners, clinical severity colors, professional appearance

## ⚠️ CRITICAL SECURITY WARNING

**This system has critical security vulnerabilities that MUST be fixed before production use:**
1. **Authentication accepts hardcoded passwords in production mode**
2. **No proper user database or password hashing**
3. **No role-based access control for controlled substances**
4. **JWT tokens have no server-side session management**

**See [CRITICAL_FIXES_2025-08-03.md](docs/CRITICAL_FIXES_2025-08-03.md) for recent security fixes and remaining issues.**

## 🆕 Recent Improvements (2025)

### Critical Security & Bug Fixes (2025-08-03)
- **Authentication Security**: Added audit logging, rate limiting, and security warnings
  - Created comprehensive audit service for security event tracking
  - Implemented basic rate limiting (5 attempts per 15 minutes)
  - Added prominent security warnings for production mode vulnerability
- **WebSocket Integration**: Implemented complete WebSocket service with auto-reconnection
  - Created websocket.js with exponential backoff reconnection
  - Integrated with ClinicalWorkflowContext for real-time events
  - Added WebSocket status indicator to clinical app bar
- **CDS Hooks**: Fixed data structure errors and added error handling
  - Fixed incorrect FHIR resource access patterns
  - Added try-catch blocks to prevent service crashes
  - Return user-friendly error cards on failures
- **Pharmacy Module**: Verified MedicationDispense FHIR resource creation
  - Complete FHIR-compliant MedicationDispense resources
  - Proper linking to MedicationRequest
  - Lot number and expiration tracking
- **Bug Fixes**: 
  - Fixed PharmacyQueue duplicate parameter error
  - Fixed WebSocket authentication import errors
  - Created missing frontend WebSocket service

### Major Architecture Changes
- **FHIR Service Migration**: Completed migration from fhirService to fhirClient (2025-01-21)
  - All components now use fhirClient for direct FHIR API calls
  - Removed fhirService wrapper layer for cleaner architecture
  - Updated all dialogs, tabs, and services to use new client
  - Fixed import paths and response format handling
  
- **FHIR Explorer v4 Fixes**: Resolved critical issues (2025-01-21)
  - Fixed import errors: Changed from non-existent fhirService to fhirClient
  - Aligned all components to use FHIRResourceContext for consistency
  - Standardized data structures across all FHIR Explorer components
  - Fixed double `/api/api/` path issue in Login.js
  - Updated API method calls from `searchResources()` to `search()`
  - Ensured all components handle the standardized response format:
    ```javascript
    {
      resources: [...],  // Array of FHIR resources
      total: 0,         // Total count
      bundle: {...}     // Original FHIR Bundle
    }
    ```

### Clinical Enhancements
- **Comprehensive Clinical Catalog System**: Dynamic medication and lab catalogs from patient data
- **FHIR Relationship Visualization**: New RelationshipMapper component for resource connections
- **Enhanced WebSocket**: Connection pooling and automatic reconnection
- **Improved State Management**: Centralized loading states, better error handling

### Performance Optimizations
- **Database Index Optimization**: Improved query performance for clinical searches
- **Progressive Resource Loading**: Fetch only needed data with bundle support
- **Efficient Search Parameter Indexing**: Consolidated indexing during deployment

### UI/UX Improvements
- **Modern Clinical Workspace**: Redesigned patient portal with intuitive navigation
- **Skeleton Loading States**: Better perceived performance during data fetching
- **Responsive Design**: Full mobile support for clinical workflows
- **Lazy Loading**: Tab components with webpack chunk optimization
- **Virtual Scrolling**: Efficient rendering for long lists
- **Performance Monitoring**: Built-in performance tracking utilities

### Critical Security & Bug Fixes (2025-08-03)
- **Security**: Added audit logging for authentication events
- **Security**: Implemented basic rate limiting for login attempts
- **Bug Fix**: Fixed PharmacyQueue duplicate parameter bug
- **Bug Fix**: Fixed WebSocket authentication import errors
- **Bug Fix**: Fixed CDS Hooks data structure access patterns
- **Feature**: Created missing websocket.js service with auto-reconnection
- **Enhancement**: Added comprehensive error handling to CDS services
- **Documentation**: Created [CRITICAL_FIXES_2025-08-03.md](docs/CRITICAL_FIXES_2025-08-03.md)

### FHIR Explorer Enhancements (2025-01-26)
- **Query Studio**: Unified query building experience combining Visual Builder and Playground
- **Full Dark Mode Support**: Comprehensive theme integration across all FHIR Explorer components
- **Multi-Mode Interface**: Visual, Code, and Split view modes with real-time synchronization
- **Enhanced Export**: Export queries as cURL, JavaScript, Python, Postman, or OpenAPI
- **Improved Performance**: Real-time metrics and optimization suggestions

## 🔍 Where to Find Things

### Frontend Services
- **FHIR Operations**: `frontend/src/core/fhir/services/fhirClient.js`
- **Clinical Catalogs**: `frontend/src/services/cdsClinicalDataService.js`
- **Event System**: `frontend/src/contexts/ClinicalWorkflowContext.js`
- **WebSocket Service**: `frontend/src/services/websocket.js` (NEW - auto-reconnection, event system)
- **WebSocket Context**: `frontend/src/contexts/WebSocketContext.js` (if exists)
- **Performance Utils**: `frontend/src/components/clinical/performance/optimizations.js`

### Backend Services
- **Auth System**: `backend/api/auth/` (router.py, service.py, jwt_handler.py)
- **Audit Service**: `backend/api/services/audit_service.py` (NEW - security event logging)
- **FHIR Storage**: `backend/fhir/core/storage.py`
- **Database Init**: `backend/scripts/setup/init_database_definitive.py`

### Critical Scripts
- **Data Management**: `backend/scripts/active/synthea_master.py`
- **Search Indexing**: `backend/scripts/consolidated_search_indexing.py`
- **Compartments**: `backend/scripts/populate_compartments.py`
- **Table Verification**: `backend/scripts/testing/verify_all_fhir_tables.py`
- **CDS Fix**: `backend/scripts/fix_cds_hooks_enabled_column.py`

### Testing & Validation
- **Testing Directory**: `backend/scripts/testing/` - Centralized testing scripts
- **Data Validation**: `backend/scripts/testing/validate_fhir_data.py`
- **Quick Resource Check**: `backend/scripts/testing/check_synthea_resources.py`
- **Test Data Summary**: `backend/scripts/testing/test_data_summary.py`
- **FHIR Data Reference**: `backend/scripts/testing/FHIR_DATA_REFERENCE.md`

## 🤖 AI Agent Resources

- **Agent Documentation**: [.claude/agents/README.md](.claude/agents/README.md)
- **Agent Instructions**: [CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md)
- **Hook System**: [.claude/hooks/](.claude/hooks/)
- **Knowledge Base**: [.claude/knowledge/](.claude/knowledge/)

## 📚 Additional Documentation

### Core Documentation
- **[PROJECT_INDEX.md](./PROJECT_INDEX.md)** - Comprehensive project navigation guide
- **[CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md)** - Detailed patterns, troubleshooting, architecture
- **[CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md)** - AI agent system documentation

### Deployment & Architecture
- **[docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)** - Complete deployment guide
- **[docs/BUILD_PROCESS_ANALYSIS.md](docs/BUILD_PROCESS_ANALYSIS.md)** - Deep dive into build system
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture overview

### Technical References
- **[docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md)** - API endpoint documentation
- **[docs/FHIR_API_TEST_SUMMARY.md](docs/FHIR_API_TEST_SUMMARY.md)** - Comprehensive FHIR API test suite
- **[docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md](docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md)** - Search indexing details
- **[docs/SETUP_FROM_SCRATCH.md](docs/SETUP_FROM_SCRATCH.md)** - Complete setup guide from empty system
- **[docs/FHIR_SEARCH_PARAMETER_FIX.md](docs/FHIR_SEARCH_PARAMETER_FIX.md)** - URN reference search fix details
- **[docs/modules/](docs/modules/)** - Individual module guides
- **[docs/modules/integration/cross-module-integration.md](docs/modules/integration/cross-module-integration.md)** - Integration patterns
- **[docs/modules/fhir-explorer/QUERY_STUDIO_GUIDE.md](docs/modules/fhir-explorer/QUERY_STUDIO_GUIDE.md)** - Query Studio user guide
- **[docs/modules/fhir-explorer/FHIR_EXPLORER_V4_IMPROVEMENTS.md](docs/modules/fhir-explorer/FHIR_EXPLORER_V4_IMPROVEMENTS.md)** - v4 improvements summary

## 🛡️ Best Practices Summary

1. **Always Research First**: Check documentation, use context7, understand patterns
2. **Test with Real Data**: Use Synthea patients, never mock data
3. **Complete Implementation**: No TODOs, full error handling, proper loading states
4. **Document Everything**: Update docs immediately, add dates, cross-reference
5. **Follow Patterns**: Use existing patterns, don't reinvent wheels
6. **Think Integration**: Consider how modules interact, use event system
7. **Prioritize Safety**: Patient data integrity is paramount

## 📖 Documentation Navigation Guide

### How to Use the Documentation Hierarchy

1. **Start Here (CLAUDE.md)**: Quick reference for overall project context and critical rules
2. **Module-Specific CLAUDE.md**: Deep dive into specific functional areas when working on them
3. **CLAUDE-REFERENCE.md**: Detailed patterns, troubleshooting, and architecture reference
4. **docs/ Directory**: Technical specifications, API docs, and deployment guides

### When to Use Each Documentation Level

| Working On | Primary Reference | Secondary Reference |
|------------|------------------|-------------------|
| New Feature | Module CLAUDE.md | CLAUDE-REFERENCE.md |
| Bug Fix | Module CLAUDE.md | Troubleshooting sections |
| API Endpoint | backend/api/CLAUDE.md | API_ENDPOINTS.md |
| FHIR Query | backend/fhir/CLAUDE.md | FHIR_API_TEST_SUMMARY.md |
| UI Component | frontend/src/CLAUDE.md | Clinical Design System |
| Deployment | backend/scripts/CLAUDE.md | DEPLOYMENT_CHECKLIST.md |
| Security | backend/api/auth/CLAUDE.md | CRITICAL_FIXES_*.md |

---

**Remember**: Patient safety and data integrity are paramount. When in doubt, check the detailed documentation or ask for clarification. This is a healthcare system - quality and completeness are non-negotiable.