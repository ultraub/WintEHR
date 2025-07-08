# CLAUDE.md - MedGenEMR Developer Guide

**Status**: Production-Ready FHIR-Native EMR  
**Stack**: React 18 + FastAPI + PostgreSQL + Docker  
**Architecture**: Event-Driven with Real-Time Integration  
**Standards**: FHIR R4, CDS Hooks 1.0, DICOM  
**Data**: 20,115+ Synthea Resources, 10+ Patients  
**Updated**: 2025-01-08

## 🎯 What This System Is

A **complete, production-ready EMR** with:
- ✅ Full FHIR R4 implementation (38 resource types)
- ✅ Complete clinical workflows (order-to-result, prescribe-to-dispense)
- ✅ Real-time WebSocket updates and event-driven architecture
- ✅ Sophisticated caching and progressive loading
- ✅ Dual-mode authentication (training + JWT)
- ✅ DICOM imaging with multi-slice viewer
- ✅ CDS Hooks with 10+ clinical rules

## 🚀 Quick Start Commands

```bash
# Start entire system with validation
./start.sh

# Fresh deployment with comprehensive checks
./fresh-deploy.sh

# Validate deployment after startup
python scripts/validate_deployment.py --verbose

# Common troubleshooting
docker-compose down -v          # Full reset if errors
cd frontend && npm install      # Fix missing dependencies
docker-compose logs backend -f  # View backend logs

# Authentication modes
export JWT_ENABLED=false  # Training mode (default)
export JWT_ENABLED=true   # Production JWT mode

# Data management
cd backend && python scripts/synthea_master.py full --count 10
```

## ⛔ Critical Development Rules

### 1. Data Requirements
**ALWAYS**:
- ✅ Use ONLY Synthea-generated FHIR data (no mock data)
- ✅ Test with multiple real patients from the database
- ✅ Handle missing/null data gracefully
- ✅ Use `fhirService.js` for all FHIR operations

**NEVER**:
- ❌ Create test patients (John Doe, Jane Smith, etc.)
- ❌ Hardcode resource IDs or mock data
- ❌ Use array indexes for data access
- ❌ Skip validation or error handling

### 2. Implementation Standards
**ALWAYS**:
- ✅ Complete ALL features end-to-end (no TODOs)
- ✅ Implement loading states and error handling
- ✅ Follow existing component patterns
- ✅ Use Context + Reducer pattern for complex state

**NEVER**:
- ❌ Leave console.log() statements
- ❌ Create partial implementations
- ❌ Skip cross-module integration
- ❌ Ignore the event-driven architecture

### 3. Component Communication
**ALWAYS**:
- ✅ Use `ClinicalWorkflowContext` for cross-tab events
- ✅ Implement pub/sub for workflow orchestration
- ✅ Use `FHIRResourceContext` for data management
- ✅ Follow progressive loading patterns

**NEVER**:
- ❌ Direct component coupling
- ❌ Skip workflow notifications
- ❌ Bypass the caching layer
- ❌ Create redundant data fetching

## 📊 System Components

### Clinical Modules (Complete)
| Module | Features | Status |
|--------|----------|--------|
| **Chart Review** | Problems, medications, allergies, immunizations | ✅ CRUD + Export |
| **Results** | Lab trends, reference ranges, abnormal alerts | ✅ Real-time |
| **Orders** | Multi-category CPOE, status tracking | ✅ Workflow integration |
| **Pharmacy** | Queue management, dispensing, lot tracking | ✅ MedicationDispense |
| **Imaging** | DICOM viewer, multi-slice navigation | ✅ Study generation |
| **Encounters** | Summary views, clinical documentation | ✅ Timeline view |

### API Endpoints
- `/fhir/R4/{resourceType}` - Complete FHIR R4 REST API
- `/api/emr/clinical/` - Clinical services and catalogs
- `/cds-hooks/` - Clinical decision support (10+ rules)
- `/api/ws/` - WebSocket real-time updates
- `/api/dicom/` - Medical imaging services

## 🏗️ Core Architecture Patterns

### Frontend: Context + Events + Progressive Loading
```javascript
// 1. State Management: Context + Reducer
const { resources, loading } = useFHIRResource();

// 2. Cross-Module Communication: Event System
const { publish, subscribe } = useClinicalWorkflow();
await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);

// 3. Performance: Progressive Loading
// Critical → Important → Optional
await fetchPatientBundle(patientId, false, 'critical');
```

### Backend: Repository + Service + DI
```python
# Repository Pattern for data access
class FHIRStorageEngine:
    async def create_resource(self, resource_type: str, data: dict)

# Service Layer for business logic  
class PharmacyService:
    async def dispense_medication(self, data: dict)

# Dependency Injection via FastAPI
async def endpoint(storage: FHIRStorageEngine = Depends(get_storage)):
```

## 🔧 Common Implementation Tasks

### Adding New Clinical Feature
```javascript
// 1. Create component in appropriate location
src/components/clinical/workspace/tabs/NewFeatureTab.js

// 2. Use FHIR hooks for data
const { resources, loading } = usePatientResources(patient?.id, 'ResourceType');

// 3. Integrate with workflow context
const { publish, subscribe } = useClinicalWorkflow();
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.RELEVANT_EVENT, handleEvent);
  return unsubscribe;
}, []);

// 4. Implement CRUD with fhirService
await fhirService.createResource('ResourceType', resourceData);
await refreshPatientResources(patient.id);
```

### Handling FHIR References
```javascript
// ✅ CORRECT - Handle both formats
const patientRef = reference.startsWith('urn:uuid:') 
  ? reference.replace('urn:uuid:', '') 
  : reference.split('/')[1];

// ✅ CORRECT - Safe navigation
const medicationDisplay = medication?.code?.text || 
                         medication?.code?.coding?.[0]?.display || 
                         'Unknown medication';
```

### Cross-Module Workflow
```javascript
// ✅ CORRECT - Event-driven workflow
// In Orders Tab
await publish(CLINICAL_EVENTS.ORDER_PLACED, {
  orderId: order.id,
  type: 'laboratory',
  patient: patient.id
});

// In Results Tab (subscribes to event)
subscribe(CLINICAL_EVENTS.ORDER_PLACED, async (data) => {
  if (data.type === 'laboratory') {
    await createPendingResultPlaceholder(data);
  }
});
```

### WebSocket Real-time Updates
```javascript
// ✅ CORRECT - Subscribe to resource updates
import { useWebSocket } from '../contexts/WebSocketContext';

const { subscribe, unsubscribe, lastMessage } = useWebSocket();

// Subscribe to patient-specific updates
useEffect(() => {
  subscribe('patient-updates', ['Observation', 'Condition'], [patientId]);
  return () => unsubscribe('patient-updates');
}, [patientId]);

// Handle incoming messages
useEffect(() => {
  if (lastMessage?.data) {
    const message = JSON.parse(lastMessage.data);
    handleResourceUpdate(message);
  }
}, [lastMessage]);
```

### Export Clinical Data
```javascript
// ✅ CORRECT - Export data in multiple formats
import { exportClinicalData, EXPORT_COLUMNS } from '../utils/exportUtils';

exportClinicalData({
  patient: currentPatient,
  data: conditions,
  columns: EXPORT_COLUMNS.conditions,
  format: 'csv', // or 'json', 'pdf'
  title: 'Problem List',
  formatForPrint: formatConditionsForPrint
});
```

### Print Clinical Documents
```javascript
// ✅ CORRECT - Print formatted clinical documents
import { printDocument, formatLabResultsForPrint } from '../utils/printUtils';

printDocument({
  title: 'Lab Results Report',
  patient: patientInfo,
  content: formatLabResultsForPrint(labResults),
  footer: 'Printed from MedGenEMR'
});
```

### Data Migration
```javascript
// ✅ CORRECT - Run FHIR data migrations
import { MigrationManager } from '../utils/migrations';

const migrationManager = new MigrationManager();
const result = await migrationManager.migrateResource(resource);
if (result.success && result.changed) {
  // Handle migrated resource
  await fhirService.updateResource(resourceType, resource.id, result.resource);
}
```

### Clinical Catalog Search
```javascript
// ✅ CORRECT - Search clinical catalogs with caching
import { searchService } from '../services/searchService';

// Search for conditions
const conditions = await searchService.searchConditions('diabetes', 10);

// Search with allergen categories
const foodAllergies = await searchService.searchAllergens('peanut', 10, 'food');

// Universal search across all catalogs
const results = await searchService.searchAll('aspirin', 5);
```

### CDS Hooks Management
```javascript
// ✅ CORRECT - Create and manage custom CDS hooks
import { cdsHooksService } from '../services/cdsHooksService';

// Create new hook
const hookData = {
  id: 'custom-diabetes-check',
  title: 'Diabetes Screening Alert',
  hook: 'patient-view',
  conditions: [{type: 'age', operator: 'greater_than', value: 45}],
  cards: [{summary: 'Consider diabetes screening', indicator: 'warning'}]
};
await cdsHooksService.createHook(hookData);

// Test hook with patient context
const testResult = await cdsHooksService.testHook(hookData, {patientId});
```

## 🐛 Error Solutions

| Error | Solution |
|-------|----------|
| `export 'X' not found` | Import from `@mui/icons-material` not `@mui/material` |
| `Objects are not valid as React child` | Use `obj?.text \|\| obj?.coding?.[0]?.display` |
| `TypeError: Cannot read property of undefined` | Add optional chaining: `resource?.property?.value` |
| Medications show "Unknown" | Use `useMedicationResolver` hook |
| Missing patient data | Check `resources` not `result.entry` |
| CORS errors | Backend running? Check `docker-compose ps` |
| WebSocket connection fails | Check auth token validity, ensure JWT_ENABLED matches backend |
| Export fails with large datasets | Implement pagination or chunking for large exports |
| Print layout issues | Check print CSS media queries in printUtils.js |
| CDS hook validation errors | Ensure all required fields, check hook ID uniqueness |
| Migration fails | Check resource validation, ensure proper FHIR structure |
| Search service timeout | Check cache (5-min timeout), increase limit parameter |

## 📁 Critical Files to Know

### Frontend Core
```
src/services/fhirService.js          # FHIR CRUD operations
src/contexts/FHIRResourceContext.js  # Resource state management
src/contexts/ClinicalWorkflowContext.js # Cross-module events
src/hooks/useFHIRResources.js        # Data fetching hooks
src/hooks/useMedicationResolver.js   # Medication display logic
```

### Backend Core
```
backend/core/fhir/storage.py         # FHIR storage engine
backend/api/fhir/fhir_router.py      # FHIR R4 endpoints
backend/core/fhir/search.py          # Search implementation
backend/api/auth_enhanced.py         # Dual-mode auth
backend/scripts/synthea_master.py    # Data management
```

### Clinical Components
```
src/components/clinical/workspace/tabs/ChartReviewTab.js  # Problems/meds
src/components/clinical/workspace/tabs/ResultsTab.js      # Lab results
src/components/clinical/workspace/tabs/OrdersTab.js       # Order entry
src/components/clinical/workspace/tabs/PharmacyTab.js     # Dispensing
src/components/clinical/imaging/DICOMViewer.js           # Image viewer
```

### Utility Services
```
src/utils/printUtils.js              # Clinical document printing
src/utils/exportUtils.js             # Multi-format data export (CSV/JSON/PDF)
src/utils/migrations.js              # FHIR data migration framework
src/utils/fhirFormatters.js          # Resource display formatting
src/utils/fhirValidation.js          # Resource validation utilities
src/utils/intelligentCache.js        # Multi-level caching system
```

### Real-time & Integration Services
```
src/services/searchService.js        # Clinical catalog search with caching
src/services/websocket.js            # Raw WebSocket operations
src/contexts/WebSocketContext.js     # WebSocket React integration
src/services/cdsHooksClient.js       # CDS Hooks integration client
src/services/cdsHooksService.js      # Custom CDS hooks CRUD
src/services/providerService.js      # Provider management
src/services/vitalSignsService.js    # Vital signs operations
```

### CDS Components
```
src/components/clinical/cds/CDSHookManager.js    # Hook presentation modes
src/components/clinical/cds/CDSAlertsPanel.js    # Alert display
src/components/clinical/cds/CDSTestingPanel.js   # Hook testing UI
```

## 🧪 Testing Status

- **Backend**: ✅ Complete test coverage (pytest)
- **Frontend**: ❌ No tests (critical gap)
- **E2E**: ❌ No integration tests

```bash
# Run backend tests
docker exec emr-backend pytest tests/ -v
```

## 🚀 Deployment Options

```bash
# Local Development
./start.sh              # Start all services
./fresh-deploy.sh       # Clean start with sample data

# AWS Production
./deploy.sh             # Automated deployment (EC2, RDS, ALB)
```

## 📊 Data Management

### Synthea Integration
```bash
cd backend
python scripts/synthea_master.py full --count 10      # Complete workflow
python scripts/synthea_master.py generate --count 20  # Generate only
python scripts/synthea_master.py import               # Import to database
python scripts/synthea_master.py validate             # Validate data
```

### DICOM Generation
```bash
python scripts/generate_dicom_for_studies.py  # Create DICOM studies
# Generates multi-slice CT/MR studies linked to ImagingStudy resources
```

## 🔄 Workflow Patterns

### Order-to-Result Flow
1. **Order**: Create ServiceRequest → Publish ORDER_PLACED
2. **Lab System**: Create Observation → Link to order
3. **Results**: Check reference ranges → Publish RESULT_RECEIVED
4. **Alerts**: Abnormal detection → Create critical alerts
5. **Response**: Suggest follow-up → Update care plan

### Prescription-to-Dispense Flow
1. **Prescribe**: Create MedicationRequest → Notify pharmacy
2. **Queue**: PharmacyTab loads pending → Verify prescription
3. **Dispense**: Create MedicationDispense → Update status
4. **Notify**: Publish MEDICATION_DISPENSED → Update chart

## 💡 Performance & Caching

```javascript
// Multi-level caching with TTL
resources: 10min | searches: 5min | bundles: 15min | computed: 30min

// Progressive loading priority
critical: ['Condition', 'MedicationRequest', 'AllergyIntolerance']
important: ['Observation', 'Procedure', 'DiagnosticReport']
optional: ['CarePlan', 'CareTeam', 'DocumentReference']
```

## 🔒 Authentication

| Mode | Setting | Users | Features |
|------|---------|-------|----------|
| **Training** | `JWT_ENABLED=false` | demo/nurse/pharmacist/admin (all: password) | Simple auth |
| **Production** | `JWT_ENABLED=true` | Requires registration | JWT + bcrypt |

## 📋 Pre-Session Checklist

**Before ANY work**:
- [ ] System running: `docker-compose ps`
- [ ] Auth mode correct: `curl http://localhost:8000/api/auth/config`
- [ ] Data loaded: Check Patient count in UI
- [ ] No console errors in browser

**During development**:
- [ ] Using Synthea data only
- [ ] Following event-driven patterns
- [ ] Implementing complete features
- [ ] Testing with multiple patients

**Before completion**:
- [ ] No console.log() statements
- [ ] All CRUD operations work
- [ ] Cross-module events fire
- [ ] Error states handled

## 🎯 Known Gaps & Priorities

**Critical**: Frontend testing, E2E tests, Load testing  
**Medium**: Analytics dashboard, Mobile support  
**Future**: SMART on FHIR, AI integration

---

**Remember**: This is a production EMR. Patient safety and data integrity are paramount.

## 🤖 Automatic Documentation Protocol

### MANDATORY DOCUMENTATION WORKFLOW

**BEFORE ANY CODE CHANGE:**
1. Use TodoWrite to create task list including "Update documentation for [module]"
2. Search for ALL related documentation files:
   - Module-specific docs in `docs/modules/`
   - Component-level .md files near the code
   - API documentation if endpoints are affected
   - Integration guides if cross-module changes
3. Read identified documentation files
4. Note current state and planned changes

**DURING IMPLEMENTATION:**
1. Keep documentation task in "pending" status
2. Track all changes that affect:
   - Public APIs or interfaces
   - User-facing features
   - Integration points
   - Configuration options
   - Performance characteristics

**AFTER CODE CHANGES:**
1. Mark documentation task as "in_progress"
2. Update ALL affected documentation:
   - Feature descriptions
   - Code examples
   - Integration points
   - Configuration changes
   - Breaking changes
   - New capabilities
3. Add "Recent Updates" section with date
4. Update cross-references in related docs
5. Mark documentation task as "completed"

**DOCUMENTATION SEARCH PATTERN:**
```bash
# When working on a component:
Glob: **/*ComponentName*.md
Glob: **/ComponentDirectory/*.md
Grep: "ComponentName" in docs/

# When working on a feature:
Glob: docs/modules/**/*feature*.md
Grep: "feature" in docs/
```

Documentation Locations:

### Architecture & Analysis
- System Architecture → `docs/architecture/overview.md`
- Gap Analysis → `docs/analysis/gap-analysis.md`
- Development Patterns → `docs/development/patterns.md`
- Current State Analysis → `docs/analysis/current-state.md`

### Module Documentation
- **Frontend Modules** → `docs/modules/frontend/`
  - Clinical Workspace → `clinical-workspace-module.md`
  - Services Layer → `services-module.md`
  - State Management → `contexts-module.md`
  - React Hooks → `hooks-module.md`
  - UI Components → `common-components-module.md`
- **Backend Modules** → `docs/modules/backend/`
  - FHIR API → `fhir-api-module.md`
  - Clinical Services → `clinical-services-module.md`
  - Authentication → `authentication-module.md`
  - Data Management → `data-management-module.md`
  - Core Infrastructure → `core-infrastructure-module.md`
- **Standalone Modules** → `docs/modules/standalone/`
  - CDS Hooks → `cds-hooks-module.md`
  - FHIR Explorer → `fhir-explorer-module.md`
- **Integration Guide** → `docs/modules/integration/cross-module-integration.md`

### API Documentation
- FHIR Endpoints → `docs/API_ENDPOINTS.md`
- Clinical Workflows → `docs/CLINICAL_WORKSPACE_BUTTON_INTEGRATION_PLAN.md`

### System Documentation
- System Architecture → `docs/SYSTEM_ARCHITECTURE.md`
- Frontend Redesign → `docs/FRONTEND_REDESIGN_TRACKER.md`
- Workspace Plan → `docs/WORKSPACE_REDESIGN_PLAN.md`
- Deployment Guide → `DEPLOYMENT.md`

### Component-Level Docs
- Clinical Tabs → Individual .md files in respective component directories
- Key Services → Individual README.md in service directories


## Session Management

### Session Start Checklist
1. Review this CLAUDE.md file
2. Run system checks: `docker-compose ps`
3. Check for uncommitted documentation: `git status docs/`
4. Create session todo list with documentation tasks

### During Session
1. Follow established patterns
2. Update docs in real-time (not at end)
3. Use TodoWrite to track documentation tasks
4. Cross-reference related documentation

### Session End Checklist
1. Verify all documentation tasks completed
2. Check for consistency across docs
3. Update CLAUDE.md if new patterns established
4. Commit documentation changes

## 🤖 Claude Code Agent System

**MedGenEMR includes a comprehensive agent system for reliable feature development**

### 🚀 Master Feature Workflow

**Primary Command**: `python .claude/agents/feature-workflow.py 'feature request'`

The master workflow orchestrates all agents for complete feature development:
1. ✅ **Analysis** - Feature analyzer creates comprehensive todo lists
2. ✅ **Scaffolding** - Generate boilerplate following MedGenEMR patterns  
3. ✅ **Validation** - FHIR compliance and integration checks
4. ✅ **Quality** - Code cleanup and error detection
5. ✅ **Documentation** - Automatic doc updates and cross-referencing

```bash
# Complete feature development workflow
python .claude/agents/feature-workflow.py "Add medication allergy checking"

# Quick analysis and scaffolding only
python .claude/agents/feature-workflow.py "New lab result viewer" --check-only

# Run with all agents for comprehensive validation
python .claude/agents/feature-workflow.py "Patient timeline view" --auto
```

### 🛠️ Individual Agents

#### Feature Scaffold Agent
**File**: `.claude/agents/feature-scaffold.py`  
**Purpose**: Generate boilerplate code following MedGenEMR patterns

```bash
# Generate complete feature scaffolding
python .claude/agents/feature-scaffold.py "Patient medication history tab"

# Output includes:
# - Clinical tab component with Context integration
# - Service layer with FHIR operations
# - Dialog components with validation
# - Event integration code
# - API endpoint templates (if needed)
```

**Generated Components**:
- ✅ Clinical tabs with proper Context usage
- ✅ FHIR service integration
- ✅ Dialog components with form validation
- ✅ Event-driven workflow integration
- ✅ Error handling and loading states

#### FHIR Integration Checker
**File**: `.claude/agents/fhir-integration-checker.py`  
**Purpose**: Validate FHIR resource usage and compliance

```bash
# Check entire codebase for FHIR compliance
python .claude/agents/fhir-integration-checker.py

# Check specific file
python .claude/agents/fhir-integration-checker.py src/components/clinical/NewComponent.js

# Generate compliance report
python .claude/agents/fhir-integration-checker.py --report
```

**Validation Rules**:
- ❌ No hardcoded resource IDs
- ❌ No mock data (John Doe, etc.)
- ✅ Proper fhirService usage
- ✅ Correct reference handling
- ✅ Resource validation

#### Integration Validator
**File**: `.claude/agents/integration-validator.py`  
**Purpose**: Validate cross-module integration patterns

```bash
# Validate integration patterns
python .claude/agents/integration-validator.py

# Get integration suggestions for new component
python .claude/agents/integration-validator.py --suggest PatientTimelineTab

# Generate integration report
python .claude/agents/integration-validator.py --report
```

**Integration Checks**:
- ✅ Context usage (FHIRResourceContext, ClinicalWorkflowContext)
- ✅ Event subscription patterns
- ✅ Progressive loading implementation
- ✅ WebSocket integration
- ✅ Cross-tab communication

#### Quality Assurance Agent
**File**: `.claude/agents/qa-agent.py`  
**Purpose**: Code quality and cleanup

```bash
# Run QA checks with auto-fix
python .claude/agents/qa-agent.py --fix

# Generate quality report
python .claude/agents/qa-agent.py --report

# Check specific severity level
python .claude/agents/qa-agent.py --severity error
```

**Quality Checks**:
- ❌ Remove console.log statements (auto-fixable)
- ✅ Error handling validation
- ✅ Loading state implementation
- ✅ React best practices
- ✅ TypeScript compliance

#### Feature Analyzer
**File**: `.claude/agents/feature-analyzer.py`  
**Purpose**: Analyze feature requests and generate todo lists

```bash
# Analyze feature and generate todo list
python .claude/agents/feature-analyzer.py "Add drug interaction checking" --output todo

# Generate analysis report
python .claude/agents/feature-analyzer.py "Patient search enhancement" --output report

# Export as JSON for integration
python .claude/agents/feature-analyzer.py "Allergy management" --output json
```

**Analysis Output**:
- ✅ Comprehensive todo list with priorities
- ✅ Integration point identification
- ✅ Component suggestions
- ✅ FHIR resource requirements
- ✅ Testing recommendations

### 🔧 Agent Integration in .claude/settings.json

**Full configuration with automated hooks:**

```json
{
  "hooks": {
    "pre-task": [
      "python .claude/agents/fhir-integration-checker.py --quiet",
      "python .claude/hooks/documentation-tracker.py"
    ],
    "post-task": [
      "python .claude/agents/qa-agent.py --severity error",
      "python .claude/agents/integration-validator.py --quick"
    ],
    "feature-request": [
      "python .claude/agents/feature-analyzer.py \"$1\" --output todo"
    ]
  },
  "workflows": {
    "new-feature": [
      "python .claude/agents/feature-workflow.py '{feature_request}'",
      "Review generated todo list and scaffolding",
      "Implement feature following MedGenEMR patterns",
      "Run post-implementation validation"
    ]
  }
}
```

### 🎯 Quality Gates & Enforcement

**Mandatory Before Completion**:
- ❌ No console.log statements (qa-agent auto-fixes)
- ✅ FHIR compliance validated (fhir-integration-checker)
- ✅ Cross-module integration verified (integration-validator)
- ✅ Error handling implemented
- ✅ Loading states present
- ✅ Event integration working
- ✅ Documentation updated

**Agent Workflow Integration**:
```bash
# 1. Feature Analysis (creates TodoWrite list)
python .claude/agents/feature-analyzer.py "Feature request"

# 2. Generate Scaffolding
python .claude/agents/feature-scaffold.py "Feature request"

# 3. Development (manual implementation)

# 4. Continuous Validation
python .claude/agents/fhir-integration-checker.py [file]
python .claude/agents/integration-validator.py --suggest ComponentName

# 5. Final Quality Check
python .claude/agents/qa-agent.py --fix
```

### 📋 Common Agent Workflows

#### New Clinical Feature
```bash
# Complete workflow with all agents
python .claude/agents/feature-workflow.py "Add patient vital signs monitoring"
```

#### Quick Component Addition
```bash
# Analysis + Scaffolding
python .claude/agents/feature-analyzer.py "New dialog component" --output todo
python .claude/agents/feature-scaffold.py "New dialog component"
```

#### Code Quality Check
```bash
# Comprehensive quality validation
python .claude/agents/qa-agent.py --fix
python .claude/agents/fhir-integration-checker.py --report
python .claude/agents/integration-validator.py --report
```

#### Debug Integration Issues
```bash
# Integration troubleshooting
python .claude/agents/integration-validator.py --suggest ExistingComponent
python .claude/agents/fhir-integration-checker.py src/problematic/file.js
```

### 🚨 Agent Triggers in Claude Code

**Agents are automatically triggered by:**
- **Pre-task hooks** - FHIR compliance and documentation checks
- **Post-task hooks** - Quality assurance and integration validation  
- **Feature requests** - Automatic analysis and todo generation
- **Error conditions** - Diagnostic agent execution
- **Code changes** - Quality gates enforcement

**Manual Agent Usage**:
- Use individual agents during development for targeted validation
- Run master workflow for complete feature development
- Integrate agents into CI/CD for automated quality gates

## 📚 Enhanced Documentation System

### Automatic Documentation Tracking

**Claude Code now includes:**
1. **Pre/Post Implementation Hooks** in `.claude/hooks/`
2. **Documentation Tracker** - Python script that analyzes changes
3. **Documentation Rules** in `.claude/DOCUMENTATION_RULES.md`
4. **Settings Configuration** in `.claude/settings.json`

### How It Works

**1. Before Any Task:**
```bash
# Claude automatically runs:
python .claude/hooks/documentation-tracker.py
# This identifies which docs need updating
```

**2. Task Creation:**
```javascript
// TodoWrite automatically includes doc tasks:
[
  { content: "Implement feature X", status: "pending" },
  { content: "Update module documentation", status: "pending" },
  { content: "Update API documentation", status: "pending" }
]
```

**3. Documentation Search:**
```bash
# For component work:
Glob: **/*ComponentName*.md
Glob: docs/modules/**/*feature*.md

# For API work:
Grep: "endpoint" docs/API_ENDPOINTS.md
```

**4. After Implementation:**
- Check `.claude/documentation-checklist.md`
- Update all identified documentation
- Add "Recent Updates" sections
- Verify code examples work

### Documentation Standards

**Every documentation update MUST include:**
1. **Recent Updates section** with date
2. **Working code examples**
3. **Integration points** if cross-module
4. **Migration notes** for breaking changes

### Quick Commands

```bash
# Check what docs need updating
python .claude/hooks/documentation-tracker.py

# Find all module docs
find docs/modules -name "*.md" | grep -i "module-name"

# Check for uncommitted docs
git status docs/ --porcelain
```

### Enforcement

**Documentation is enforced through:**
1. TodoWrite tasks (mandatory doc tasks)
2. Git hooks (warn on missing docs)
3. Session reminders in Claude Code
4. Documentation checklist generation

### Recent Updates - 2025-01-08

**🤖 Agent System Implementation**
- ✅ Created comprehensive agent system for feature development
- ✅ Implemented master feature workflow orchestrator
- ✅ Added 5 specialized agents: feature-scaffold, fhir-checker, integration-validator, qa-agent, feature-analyzer
- ✅ Enhanced .claude/settings.json with automated hooks and workflows
- ✅ Integrated TodoWrite for task management throughout agent workflows
- ✅ Added quality gates and enforcement mechanisms
- ✅ Created agent trigger system for automatic validation

**Key Agent Features**:
- **feature-workflow.py**: Master orchestrator for complete feature development lifecycle
- **feature-scaffold.py**: Generates boilerplate code following MedGenEMR patterns
- **fhir-integration-checker.py**: Validates FHIR compliance and prevents mock data usage
- **integration-validator.py**: Ensures proper cross-module integration patterns
- **qa-agent.py**: Code quality assurance with auto-fix capabilities
- **feature-analyzer.py**: Analyzes feature requests and creates comprehensive todo lists

**Workflow Integration**:
- Pre-task hooks run FHIR compliance and documentation checks
- Post-task hooks ensure quality assurance and integration validation
- Feature-request hooks automatically analyze requirements and generate todos
- Error conditions trigger diagnostic agent execution

**Quality Gates Established**:
- Mandatory FHIR compliance validation
- Automatic console.log removal
- Cross-module event integration verification
- Documentation update enforcement
- Error handling and loading state validation

This agent system ensures reliable, consistent feature development following MedGenEMR patterns and maintains code quality standards automatically.

**Remember: No code is complete without documentation!**