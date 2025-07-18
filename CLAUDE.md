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

### Development Environment (Recommended)
```bash
# Fresh deployment with 20 patients and hot reload
./fresh-deploy.sh

# Quick start (preserves existing data)
./dev-start.sh

# Load additional patients
./load-patients.sh 50

# Stop services
./dev-start.sh --stop
```

### Production Deployment
```bash
# Production deployment with 100 patients
./fresh-deploy.sh --mode production --patients 100

# Standard production start
./start.sh
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

## 🔎 FHIR Search Parameters

### Key Points
- Search parameters are automatically extracted during resource storage
- All FHIR R4 standard search parameters are supported
- Token parameters use `value_token_code` column (not `value_string`)
- Reference parameters use `value_reference` column

### Common Search Examples
```bash
# Patient searches
/fhir/R4/Patient?name=Smith
/fhir/R4/Patient?birthdate=1970-01-01

# Clinical searches
/fhir/R4/Condition?patient=Patient/123&clinical-status=active
/fhir/R4/MedicationRequest?patient=Patient/123&status=active
/fhir/R4/Observation?patient=Patient/123&category=vital-signs

# Date range searches
/fhir/R4/Encounter?patient=Patient/123&date=ge2024-01-01&date=le2024-12-31
```

### Troubleshooting Search Issues
```bash
# Check search parameter extraction
docker exec emr-backend python scripts/validate_search_params.py

# Fix search parameter issues (if any)
docker exec emr-backend python scripts/fix_search_params_tokens.py

# Verify specific resource search params
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT param_name, param_type, COUNT(*) 
FROM fhir.search_params 
WHERE resource_type = 'MedicationRequest' 
GROUP BY param_name, param_type;"
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

## 🚀 Deployment Scripts

### Core Scripts
- **`fresh-deploy.sh`**: Complete clean deployment with patient data
- **`dev-start.sh`**: Quick development startup with hot reload
- **`load-patients.sh`**: Add or replace patient data
- **`start.sh`**: Production deployment

### Script Options
```bash
# fresh-deploy.sh
./fresh-deploy.sh                    # Dev mode, 20 patients
./fresh-deploy.sh --patients 50      # Custom patient count
./fresh-deploy.sh --mode production  # Production deployment

# dev-start.sh  
./dev-start.sh              # Start with hot reload
./dev-start.sh --logs       # Start and tail logs
./dev-start.sh --stop       # Stop services

# load-patients.sh
./load-patients.sh          # Load 20 patients
./load-patients.sh 50       # Load 50 patients
./load-patients.sh --wipe 30  # Clear data, load 30 patients
```

## 📚 Additional Documentation

- **Deployment Guide**: [docs/DEPLOYMENT-GUIDE.md](docs/DEPLOYMENT-GUIDE.md) - Complete deployment instructions
- **Detailed Reference**: [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md) - Complete patterns, troubleshooting, architecture
- **API Documentation**: [docs/API_ENDPOINTS.md](docs/API_ENDPOINTS.md)
- **Module Guides**: [docs/modules/](docs/modules/)
- **Integration Guide**: [docs/modules/integration/cross-module-integration.md](docs/modules/integration/cross-module-integration.md)

---

**Remember**: Patient safety and data integrity are paramount. When in doubt, check the detailed documentation or ask for clarification.