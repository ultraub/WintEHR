# CLAUDE.md - MedGenEMR AI Agent Quick Reference

**Purpose**: This is the primary operational guide for AI agents working with MedGenEMR. It provides essential context, critical rules, and quick references for effective development.

> **Important**: For detailed implementation patterns and comprehensive documentation, see [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md)

## 🎯 Project Overview

**MedGenEMR** is a production-ready Electronic Medical Records system with:
- Full FHIR R4 implementation (38 resource types)
- Real-time clinical workflows (WebSocket + event-driven)
- Dynamic clinical catalogs from actual patient data
- DICOM imaging with multi-slice viewer
- CDS Hooks with 10+ clinical rules

## 🚀 Quick Start

```bash
# Start system
./start.sh

# Fresh deployment with data
./fresh-deploy.sh

# Validate deployment
python scripts/validate_deployment.py --verbose

# View logs
docker-compose logs backend -f
```

### Authentication Modes
```bash
export JWT_ENABLED=false  # Dev mode (users: demo/nurse/pharmacist/admin, password: password)
export JWT_ENABLED=true   # Production JWT mode
```

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
MedGenEMR/
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

### Development
```bash
# Run tests
docker exec emr-backend pytest tests/ -v
cd frontend && npm test

# Data management
python backend/scripts/synthea_master.py full --count 10
python backend/scripts/generate_dicom_for_studies.py

# Quality checks
python .claude/agents/qa-agent.py --report
python .claude/agents/fhir-integration-checker.py
```

### Git Workflow
```bash
# Conventional commits REQUIRED
git commit -m "feat: Add medication interaction checking"
git commit -m "fix: Handle null medication references"
git commit -m "docs: Update pharmacy module guide"
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
The deployment automatically runs search parameter migration:
1. Data import (Phase 3)
2. **Search parameter indexing** (Phase 4) - NEW
3. DICOM generation (Phase 5)

### Troubleshooting
If searches return empty results:
```bash
# Manually re-index search parameters
docker exec emr-backend python scripts/active/run_migration.py

# Verify search parameters exist
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT param_name, COUNT(*) 
FROM fhir.search_params 
WHERE param_name IN ('patient', 'subject') 
GROUP BY param_name;"

# Monitor search parameter health
docker exec emr-backend python scripts/monitor_search_params.py

# Auto-fix search parameter issues
docker exec emr-backend python scripts/monitor_search_params.py --fix

# Verify after import
docker exec emr-backend python scripts/verify_search_params_after_import.py

# Test integration
docker exec emr-backend python scripts/test_search_param_integration.py
```

### Monitoring & Maintenance
The build process automatically maintains search parameters, but you can monitor health:
- **During import**: Step 6 verifies and auto-fixes missing parameters
- **After deployment**: Validation includes search parameter checks
- **Production**: Run `monitor_search_params.py` periodically

## 📋 Clinical Modules

| Module | Location | Key Features |
|--------|----------|--------------|
| Chart Review | `tabs/ChartReviewTab.js` | Problems, meds, allergies |
| Orders | `tabs/OrdersTab.js` | CPOE, status tracking |
| Results | `tabs/ResultsTab.js` | Labs, trends, alerts |
| Pharmacy | `pages/PharmacyDashboard.js` | Dispensing, queue |
| Imaging | `tabs/ImagingTab.js` | DICOM viewer |

## 🔍 Where to Find Things

- **FHIR Operations**: `frontend/src/services/fhirService.js`
- **Clinical Catalogs**: `frontend/src/services/cdsClinicalDataService.js`
- **Event System**: `frontend/src/contexts/ClinicalWorkflowContext.js`
- **WebSocket**: `frontend/src/contexts/WebSocketContext.js`
- **Auth System**: `backend/api/auth_enhanced.py`
- **FHIR Storage**: `backend/fhir/core/storage.py`

## 🤖 AI Agent Resources

- **Agent Documentation**: [.claude/agents/README.md](.claude/agents/README.md)
- **Agent Instructions**: [CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md)
- **Hook System**: [.claude/hooks/](.claude/hooks/)
- **Knowledge Base**: [.claude/knowledge/](.claude/knowledge/)

## 📚 Additional Documentation

- **Detailed Reference**: [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md) - Complete patterns, troubleshooting, architecture
- **API Documentation**: [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md)
- **Module Guides**: [docs/modules/](docs/modules/)
- **Integration Guide**: [docs/modules/integration/cross-module-integration.md](docs/modules/integration/cross-module-integration.md)

---

**Remember**: Patient safety and data integrity are paramount. When in doubt, check the detailed documentation or ask for clarification.