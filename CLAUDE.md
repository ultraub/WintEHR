# CLAUDE.md - WintEHR AI Agent Quick Reference

**Purpose**: This is the primary operational guide for AI agents working with WintEHR. It provides essential context, critical rules, and quick references for effective development.

> **Important**: For detailed implementation patterns and comprehensive documentation, see [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md)

## 🎯 Project Overview

**WintEHR** is a production-ready Electronic Medical Records system with:
- Full FHIR R4 implementation (38 resource types)
- Real-time clinical workflows (WebSocket + event-driven)
- Dynamic clinical catalogs from actual patient data
- DICOM imaging with multi-slice viewer
- CDS Hooks with 10+ clinical rules

## 🚀 Quick Start

### Development Environment (Recommended)
```bash
# Fresh deployment with 20 patients (creates all 6 FHIR tables)
./fresh-deploy.sh

# Custom patient count
./fresh-deploy.sh --patients 50

# Alternative: Master deployment (full modular process)
./scripts/master-deploy.sh
```

### Production Deployment
```bash
# Production deployment with 100 patients
./fresh-deploy.sh --mode production --patients 100

# Alternative: Master deployment in production mode
./scripts/master-deploy.sh --production --patients=100
```

### Validation Commands
```bash
# Validate deployment (use --docker flag when running in container)
docker exec emr-backend python scripts/validate_deployment.py --docker --verbose

# Verify all 6 FHIR tables
docker exec emr-backend python scripts/verify_all_fhir_tables.py

# Check search parameter health
docker exec emr-backend python scripts/monitor_search_params.py
```

### Authentication Modes
- **Development**: JWT disabled, demo users (demo/nurse/pharmacist/admin, password: password)
- **Production**: JWT enabled, secure authentication required

## ⚠️ CRITICAL RULES (MUST FOLLOW)

### 1. Task Management Protocol
**EVERY task MUST**:
1. ✅ Start with research phase (check docs, modules, patterns)
2. ✅ Break into subtasks using TodoWrite
3. ✅ End with two-pass review + git commit + doc updates

### 2. Data Standards
**ALWAYS**: Use Synthea FHIR data | Test with real patients | Handle nulls | Use fhirService.js  
**NEVER**: Mock patients | Hardcode IDs | Use array indexes | Skip validation

### 3. Code Quality
**ALWAYS**: Complete features | Loading states | Error handling | Event patterns  
**NEVER**: console.log() | Partial implementations | Direct coupling | Skip integration

### 4. Documentation
**ALWAYS**: Update affected module docs | Cross-reference changes | Add dates  
**NEVER**: Leave outdated docs | Skip documentation | Create unnecessary files

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

## 🔧 Common Commands

### Development Workflow
```bash
# Start development environment
./dev-start.sh

# Load patient data
./load-patients.sh 20              # Add 20 patients
./load-patients.sh --wipe 50       # Clear and load 50 patients

# Run tests
docker exec emr-backend pytest tests/ -v
docker exec emr-frontend npm test

# View logs
docker-compose logs -f backend     # Backend logs
docker-compose logs -f frontend    # Frontend logs
```

### Data Management
```bash
# Using synthea_master.py directly
docker exec emr-backend python scripts/active/synthea_master.py full --count 20
docker exec emr-backend python scripts/active/synthea_master.py wipe
docker exec emr-backend python scripts/active/synthea_master.py validate

# DICOM generation
docker exec emr-backend python scripts/generate_dicom_for_studies.py
```

### Git Workflow
```bash
# Conventional commits REQUIRED
git commit -m "feat: Add medication interaction checking"
git commit -m "fix: Handle null medication references"
git commit -m "docs: Update pharmacy module guide"
git commit -m "chore: Update deployment scripts"
```

## 🏗️ Key Patterns

### Frontend State Management
```javascript
// Use contexts for complex state
const { resources, loading } = useFHIRResource();
const { publish, subscribe } = useClinicalWorkflow();

// Progressive loading
await fetchPatientBundle(patientId, false, 'critical');
```

### Backend Services
```python
# Repository pattern
class FHIRStorageEngine:
    async def create_resource(self, resource_type: str, data: dict)

# Dependency injection
async def endpoint(storage: FHIRStorageEngine = Depends(get_storage)):
```

### Cross-Module Events
```javascript
// Publisher
await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);

// Subscriber
subscribe(CLINICAL_EVENTS.ORDER_PLACED, handleOrder);
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

### Key Search Parameters
- **patient/subject**: Required for Condition, Observation, MedicationRequest, etc.
- **_id**: Resource identifier
- **code**: Clinical codes (conditions, medications, observations)
- **status**: Resource status
- **date**: Temporal queries

### Build Process Integration
The deployment automatically runs search parameter indexing:
1. Data import (Phase 3)
2. **Search parameter indexing** (Phase 4) - Consolidated script
3. DICOM generation (Phase 5)

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
docker exec emr-backend python scripts/verify_search_params_after_import.py

# Auto-fix missing search parameters
docker exec emr-backend python scripts/verify_search_params_after_import.py --fix

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
docker exec emr-backend python scripts/verify_compartments.py

# Test compartment functionality
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
| Chart Review | `tabs/ChartReviewTab.js` | Problems, meds, allergies |
| Orders | `tabs/OrdersTab.js` | CPOE, status tracking |
| Results | `tabs/ResultsTab.js` | Labs, trends, alerts |
| Pharmacy | `pages/PharmacyDashboard.js` | Dispensing, queue |
| Imaging | `tabs/ImagingTab.js` | DICOM viewer |

## 🔍 Where to Find Things

### Frontend Services
- **FHIR Operations**: `frontend/src/services/fhirService.js`
- **Clinical Catalogs**: `frontend/src/services/cdsClinicalDataService.js`
- **Event System**: `frontend/src/contexts/ClinicalWorkflowContext.js`
- **WebSocket**: `frontend/src/contexts/WebSocketContext.js`

### Backend Services
- **Auth System**: `backend/api/auth_enhanced.py`
- **FHIR Storage**: `backend/fhir/core/storage.py`
- **Database Init**: `backend/scripts/setup/init_database_definitive.py`

### Critical Scripts
- **Data Management**: `backend/scripts/active/synthea_master.py`
- **Search Indexing**: `backend/scripts/consolidated_search_indexing.py`
- **Compartments**: `backend/scripts/populate_compartments.py`
- **Table Verification**: `backend/scripts/verify_all_fhir_tables.py`
- **CDS Fix**: `backend/scripts/fix_cds_hooks_enabled_column.py`

## 🤖 AI Agent Resources

- **Agent Documentation**: [.claude/agents/README.md](.claude/agents/README.md)
- **Agent Instructions**: [CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md)
- **Hook System**: [.claude/hooks/](.claude/hooks/)
- **Knowledge Base**: [.claude/knowledge/](.claude/knowledge/)

## 📚 Additional Documentation

- **Deployment Checklist**: [docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md) - Complete deployment guide
- **Build Process Analysis**: [docs/BUILD_PROCESS_ANALYSIS.md](docs/BUILD_PROCESS_ANALYSIS.md) - Deep dive into build system
- **Search Parameter Summary**: [docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md](docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md)
- **Detailed Reference**: [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md) - Patterns, troubleshooting, architecture
- **API Documentation**: [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md)
- **Module Guides**: [docs/modules/](docs/modules/)
- **Integration Guide**: [docs/modules/integration/cross-module-integration.md](docs/modules/integration/cross-module-integration.md)

---

**Remember**: Patient safety and data integrity are paramount. When in doubt, check the detailed documentation or ask for clarification.