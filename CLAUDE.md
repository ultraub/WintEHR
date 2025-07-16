# CLAUDE.md - WintEHR Developer Guide

**Production-Ready FHIR-Native EMR**  
**Version**: 2025-07-12  
**Stack**: React 18 + FastAPI + PostgreSQL + Docker  
**Standards**: FHIR R4, CDS Hooks 1.0, DICOM  
**Data**: 20,115+ Synthea Resources, 10+ Patients

> **⚠️ CRITICAL**: Every task MUST start with research using `context7` and web searches to ensure alignment with current standards. See Task Management Protocol section.

## 🚀 Quick Start

```bash
# Start system with validation
./start.sh

# Fresh deployment with sample data
./fresh-deploy.sh

# Validate deployment
python scripts/validate_deployment.py --verbose

# View logs
docker-compose logs backend -f

# Common fixes
docker-compose down -v          # Full reset
cd frontend && npm install      # Fix dependencies
```

### Authentication Modes
```bash
export JWT_ENABLED=false  # Training mode (default users: demo/nurse/pharmacist/admin, password: password)
export JWT_ENABLED=true   # Production JWT mode (requires registration)
```

## 📋 CRITICAL: Task Management Protocol

**⚠️ EVERY task MUST follow this structure - NO EXCEPTIONS**

### 1️⃣ Research First (MANDATORY)
- Research affected modules in `docs/modules/`
- Review all related documentation
- Use `context7` for latest patterns/standards
- Web search current best practices
- Update any outdated docs BEFORE coding

### 2️⃣ Implementation 
- Break into logical subtasks using TodoWrite
- Follow established patterns
- Test with real Synthea data

### 3️⃣ Final Review (MANDATORY)
- Two-pass code review
- Git commit and push
- Update ALL affected documentation

**See "Task Management Protocol" section for detailed breakdown**

## 🎯 System Overview

### What This System Is
A **complete, production-ready EMR** featuring:
- ✅ Full FHIR R4 implementation (38 resource types)
- ✅ Complete clinical workflows (order-to-result, prescribe-to-dispense)
- ✅ Real-time WebSocket updates with event-driven architecture
- ✅ Dynamic clinical catalogs from actual patient data
- ✅ Context7 MCP integration for real-time documentation
- ✅ DICOM imaging with multi-slice viewer
- ✅ CDS Hooks with 10+ clinical rules

### Clinical Modules
| Module | Features | Integration |
|--------|----------|-------------|
| **Chart Review** | Problems, medications, allergies, immunizations | CRUD + Export |
| **Results** | Lab trends, reference ranges, abnormal alerts | Real-time updates |
| **Orders** | Multi-category CPOE, status tracking | Workflow events |
| **Pharmacy** | Queue management, dispensing, lot tracking | MedicationDispense |
| **Imaging** | DICOM viewer, multi-slice navigation | Study generation |
| **Encounters** | Summary views, clinical documentation | Timeline view |

## ⚠️ Critical Development Rules

### 0. Task Structure (ABSOLUTE REQUIREMENT)
**EVERY task MUST**:
- ✅ Start with research phase (modules, docs, context7, web search)
- ✅ Be broken into clear subtasks using TodoWrite
- ✅ End with two-pass review + git commit + doc updates
- ✅ See "Task Management Protocol" section for mandatory structure

### 1. Data Standards
**ALWAYS**:
- ✅ Use ONLY Synthea-generated FHIR data
- ✅ Test with multiple real patients from database
- ✅ Handle missing/null data gracefully
- ✅ Use `fhirService.js` for all FHIR operations

**NEVER**:
- ❌ Create mock patients (John Doe, Jane Smith)
- ❌ Hardcode resource IDs
- ❌ Use array indexes for data access
- ❌ Skip validation or error handling

### 2. Implementation Standards
**ALWAYS**:
- ✅ Complete ALL features end-to-end
- ✅ Implement loading states and error handling
- ✅ Use Context + Reducer pattern for complex state
- ✅ Follow event-driven architecture

**NEVER**:
- ❌ Leave console.log() statements
- ❌ Create partial implementations
- ❌ Skip cross-module integration
- ❌ Bypass the caching layer

### 3. Component Communication
**ALWAYS**:
- ✅ Use `ClinicalWorkflowContext` for cross-tab events
- ✅ Implement pub/sub for workflow orchestration
- ✅ Follow progressive loading patterns

**NEVER**:
- ❌ Direct component coupling
- ❌ Create redundant data fetching

## 📋 Task Management Protocol

### MANDATORY: Task Breakdown Structure

**Every task MUST be broken into subtasks using TodoWrite following this pattern:**

#### Starting a Task
```javascript
// Use TodoWrite to create task structure
TodoWrite([
  { content: "Research Phase: Review module documentation", status: "pending" },
  { content: "Research Phase: Check context7 for latest patterns", status: "pending" },
  { content: "Research Phase: Update outdated documentation", status: "pending" },
  { content: "Implementation: [specific subtask]", status: "pending" },
  { content: "Review: First pass - check completeness", status: "pending" },
  { content: "Review: Second pass - verify integration", status: "pending" },
  { content: "Finalize: Git commit and push", status: "pending" },
  { content: "Finalize: Update all documentation", status: "pending" }
]);
```

#### 1. Research Phase (ALWAYS FIRST)
```bash
# For EVERY task, create these research subtasks:
- [ ] Research affected modules in docs/modules/
- [ ] Review related documentation files
- [ ] Use context7 to check latest library patterns/standards
- [ ] Web search for current best practices if needed
- [ ] Document any discrepancies found
- [ ] Update outdated documentation BEFORE coding
```

#### 2. Implementation Phase
```bash
# Break feature into logical subtasks:
- [ ] Core functionality implementation
- [ ] Integration with existing modules
- [ ] Error handling and edge cases
- [ ] Loading states and UI feedback
- [ ] Event publishing/subscribing
- [ ] Testing with multiple patients
```

#### 3. Review & Finalization (MANDATORY LAST SUBTASK)
```bash
# EVERY task MUST end with:
- [ ] First code review pass:
    - Check for incompletions (no TODOs)
    - Verify module integrations
    - Ensure consistent patterns
    - Remove all console.log statements
- [ ] Second code review pass:
    - Validate FHIR compliance
    - Check event handling
    - Verify error handling
    - Ensure code is clean and simple
    - Refactor complex code for clarity
    - Remove unnecessary abstractions
- [ ] Git commit with descriptive message
- [ ] Git push to repository
- [ ] Update documentation:
    - Current module docs
    - Related/dependent module docs
    - Add "Recent Updates" with date
    - Update integration guides if needed
```

### Code Quality Standards
**Clean and Simple Code**:
- Prefer clarity over cleverness
- Use descriptive variable names
- Keep functions focused and small
- Avoid premature optimization
- Remove commented-out code
- Consolidate duplicate logic

**Review Focus Areas**:
- ✅ No incomplete features (search for TODO, FIXME, XXX)
- ✅ All edge cases handled
- ✅ Consistent error messages
- ✅ Proper loading and error states
- ✅ Cross-browser compatibility
- ✅ Mobile responsiveness considered
- ✅ Accessibility requirements met

### Git Commit Standards
```bash
# Use conventional commit format:
feat: Add new feature
fix: Fix bug
docs: Update documentation
refactor: Refactor code
test: Add tests
chore: Update dependencies

# Examples:
git commit -m "feat: Add medication interaction checking with CDS integration"
git commit -m "fix: Handle null medication references in resolver"
git commit -m "docs: Update pharmacy module with interaction patterns"
```

### Quick Task Template
```markdown
## Task: [Task Description]

### 1. Research Phase
- [ ] Research modules: _______________
- [ ] Review docs: _______________
- [ ] Context7 check: _______________
- [ ] Web search: _______________
- [ ] Update outdated docs

### 2. Implementation
- [ ] [Subtask 1]
- [ ] [Subtask 2]
- [ ] [Subtask 3]

### 3. Review & Finalization
- [ ] First review pass
- [ ] Second review pass
- [ ] Git commit: "type: description"
- [ ] Git push
- [ ] Update module docs
- [ ] Update related docs
```

## 🔍 Research Standards

### Use Context7 For:
- Latest React patterns and hooks
- TypeScript best practices
- FHIR R4 implementation details
- Library-specific documentation
- Performance optimization techniques

### Web Search For:
- Current healthcare IT standards
- FHIR community best practices
- Security recommendations
- Accessibility guidelines
- Browser compatibility issues

### Documentation Verification:
```bash
# Before coding, ALWAYS:
1. Check if docs match current implementation
2. Note any discrepancies in TodoWrite
3. Update docs BEFORE implementing
4. Reference updated docs during coding
5. If docs are missing, create them first
```

**IMPORTANT**: Never code based on outdated documentation. Always update docs first to establish the correct implementation pattern.

## 🏗️ Architecture Patterns

**⚠️ IMPORTANT**: Always verify patterns with context7 and current React/TypeScript best practices before implementing.

### Frontend: Context + Events + Progressive Loading
```javascript
// State Management
const { resources, loading } = useFHIRResource();

// Cross-Module Events
const { publish, subscribe } = useClinicalWorkflow();
await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);

// Progressive Loading
await fetchPatientBundle(patientId, false, 'critical');
```

### Backend: Repository + Service + DI
```python
# Repository Pattern
class FHIRStorageEngine:
    async def create_resource(self, resource_type: str, data: dict)

# Service Layer
class PharmacyService:
    async def dispense_medication(self, data: dict)

# Dependency Injection
async def endpoint(storage: FHIRStorageEngine = Depends(get_storage)):
```

### Caching Strategy
```javascript
// TTL Configuration
resources: 10min | searches: 5min | bundles: 15min | computed: 30min

// Loading Priority
critical: ['Condition', 'MedicationRequest', 'AllergyIntolerance']
important: ['Observation', 'Procedure', 'DiagnosticReport']
optional: ['CarePlan', 'CareTeam', 'DocumentReference']
```

## 💻 Common Implementation Patterns

### Adding New Clinical Feature
```javascript
// 1. Create component
src/components/clinical/workspace/tabs/NewFeatureTab.js

// 2. Use FHIR hooks
const { resources, loading } = usePatientResources(patient?.id, 'ResourceType');

// 3. Integrate workflows
const { publish, subscribe } = useClinicalWorkflow();
useEffect(() => {
  const unsubscribe = subscribe(CLINICAL_EVENTS.RELEVANT_EVENT, handleEvent);
  return unsubscribe;
}, []);

// 4. Implement CRUD
await fhirService.createResource('ResourceType', resourceData);
await refreshPatientResources(patient.id);
```

### Dynamic Clinical Catalogs
```javascript
// Use dynamic catalogs from patient data
import { cdsClinicalDataService } from '../services/cdsClinicalDataService';

// Get conditions from real diagnoses with frequency
const conditions = await cdsClinicalDataService.getDynamicConditionCatalog('diabetes', 20);

// Get medications with usage patterns
const medications = await cdsClinicalDataService.getDynamicMedicationCatalog('insulin', 20);

// Get lab tests with calculated reference ranges
const labTests = await cdsClinicalDataService.getLabCatalog('glucose', null, 20);

// Search across all catalogs
const allResults = await cdsClinicalDataService.searchAllDynamicCatalogs('blood pressure', 10);

// Refresh after data changes
await cdsClinicalDataService.refreshDynamicCatalogs(100);
```

**Dynamic Catalog Features**:
- **Conditions**: 57 conditions with frequency counts from diagnoses
- **Medications**: 27 medications with usage patterns and dosing
- **Lab Tests**: 47 tests with 5th-95th percentile reference ranges
- **Procedures**: 91 procedures with frequency from actual data
- **Real-time**: Extracted from actual patient FHIR resources

### FHIR Reference Handling
```javascript
// Handle both reference formats
const patientRef = reference.startsWith('urn:uuid:') 
  ? reference.replace('urn:uuid:', '') 
  : reference.split('/')[1];

// Safe navigation
const medicationDisplay = medication?.code?.text || 
                         medication?.code?.coding?.[0]?.display || 
                         'Unknown medication';
```

### Cross-Module Workflow
```javascript
// Publisher (Orders Tab)
await publish(CLINICAL_EVENTS.ORDER_PLACED, {
  orderId: order.id,
  type: 'laboratory',
  patient: patient.id
});

// Subscriber (Results Tab)
subscribe(CLINICAL_EVENTS.ORDER_PLACED, async (data) => {
  if (data.type === 'laboratory') {
    await createPendingResultPlaceholder(data);
  }
});
```

### WebSocket Integration
```javascript
import { useWebSocket } from '../contexts/WebSocketContext';

const { subscribe, unsubscribe, lastMessage } = useWebSocket();

useEffect(() => {
  subscribe('patient-updates', ['Observation', 'Condition'], [patientId]);
  return () => unsubscribe('patient-updates');
}, [patientId]);
```

## 🔗 Context7 MCP Integration

**Context7 enhances all development with real-time documentation and pattern access**

### Setup and Configuration
```bash
# Context7 MCP via HTTP transport
claude mcp add --transport http context7 https://mcp.context7.com/mcp

# Verify setup
claude mcp list
# Should show: context7: https://mcp.context7.com/mcp (HTTP)
```

### Integration Features
- **Pre-task Hooks**: Automatically warm Context7 cache with relevant patterns
- **Agent Enhancement**: All agents query Context7 for latest standards
- **Post-task Hooks**: Update Context7 knowledge base with discoveries
- **Error Context**: Context7 provides debugging guidance
- **Cross-session Persistence**: Context and learnings persist

### Context7 Usage
```python
# Direct usage in agents
from context7_integration import Context7Client

client = Context7Client()
context = client.get_context("FHIR R5 validation patterns")
agent_context = client.get_agent_context("fhir-checker", "task")
client.update_knowledge("validation_pattern", data, "fhir-checker")
```

### Command Line Usage
```bash
# Cache warmup
python .claude/utils/context7_integration.py --cache-warmup

# Direct queries
python .claude/utils/context7_integration.py --query "React patterns"

# Agent context
python .claude/utils/context7_integration.py --agent-context fhir-checker

# Knowledge updates
python .claude/utils/context7_integration.py --update-knowledge
```

## 🤖 Agent System with Context7

### Integration with Task Protocol
The agent system supports the mandatory task structure:
1. **Research Phase**: Use `feature-analyzer.py` with Context7
2. **Implementation**: Use `feature-scaffold.py` for boilerplate
3. **Review Phase**: Use `qa-agent.py` and `integration-validator.py`

### Master Feature Workflow
```bash
# Complete feature development with Context7
python .claude/agents/feature-workflow.py "Add medication allergy checking"

# Quick analysis only
python .claude/agents/feature-workflow.py "New lab viewer" --check-only
```

### Individual Agents (Context7 Enhanced)

| Agent | Purpose | Context7 Integration |
|-------|---------|---------------------|
| **feature-scaffold.py** | Generate boilerplate | Queries latest WintEHR patterns |
| **fhir-integration-checker.py** | Validate FHIR compliance | Real-time R5 standards validation |
| **integration-validator.py** | Check cross-module patterns | Current integration patterns |
| **qa-agent.py** | Code quality & cleanup | Latest React/FastAPI practices |
| **feature-analyzer.py** | Analyze & create todos | Context-aware analysis |

### Quality Gates
- ❌ No console.log statements (auto-fixed)
- ✅ FHIR compliance validated
- ✅ Cross-module integration verified
- ✅ Error handling implemented
- ✅ Documentation updated
- ✅ Context7 knowledge updated

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
python scripts/generate_dicom_for_studies.py  # Multi-slice CT/MR studies
```

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Export 'X' not found | Import from `@mui/icons-material` not `@mui/material` |
| Objects not valid as React child | Use `obj?.text \|\| obj?.coding?.[0]?.display` |
| Medications show "Unknown" | Use `useMedicationResolver` hook |
| Missing patient data | Check `resources` not `result.entry` |
| CORS errors | Ensure backend running: `docker-compose ps` |
| WebSocket fails | Check auth token, ensure JWT_ENABLED matches |
| Export fails (large data) | Implement pagination or chunking |
| CDS hook validation | Check hook ID uniqueness |
| Dynamic catalog 404 | Service bypasses proxy, uses direct backend connection |

## 📁 Critical Files Reference

### Frontend Core
```
src/services/fhirService.js              # FHIR CRUD operations
src/services/cdsClinicalDataService.js   # Dynamic clinical catalogs
src/contexts/FHIRResourceContext.js      # Resource state management
src/contexts/ClinicalWorkflowContext.js  # Cross-module events
src/hooks/useFHIRResources.js           # Data fetching hooks
src/hooks/useMedicationResolver.js      # Medication display logic
```

### Backend Core
```
backend/fhir/core/storage.py                    # FHIR storage engine
backend/fhir/api/router.py                      # FHIR R4 endpoints
backend/api/clinical/dynamic_catalog_router.py  # Dynamic catalogs API
backend/services/dynamic_catalog_service.py     # Catalog extraction logic
backend/api/auth_enhanced.py                    # Dual-mode auth
backend/scripts/synthea_master.py               # Data management
```

### Context7 Integration
```
.claude/utils/context7_integration.py    # Context7 client and utilities
.claude/agents/*                         # All agents Context7-enhanced
.claude/settings.json                    # Hook configuration
```

## 🔄 Clinical Workflows

### Order-to-Result Flow
1. **Order**: Create ServiceRequest → Publish ORDER_PLACED
2. **Lab**: Create Observation → Link to order
3. **Results**: Check ranges → Publish RESULT_RECEIVED
4. **Alerts**: Detect abnormals → Create alerts
5. **Response**: Suggest follow-up → Update care plan

### Prescription-to-Dispense Flow
1. **Prescribe**: Create MedicationRequest → Notify pharmacy
2. **Queue**: Load pending → Verify prescription
3. **Dispense**: Create MedicationDispense → Update status
4. **Notify**: Publish MEDICATION_DISPENSED → Update chart

## 🧪 Testing

```bash
# Backend tests
docker exec emr-backend pytest tests/ -v

# Frontend tests
cd frontend && npm test
cd frontend && npm run test:coverage
```

## 📚 Documentation System

### Automatic Documentation Tracking
1. **Pre/Post Implementation Hooks** in `.claude/hooks/`
2. **Documentation Tracker** analyzes changes
3. **Documentation Rules** in `.claude/DOCUMENTATION_RULES.md`
4. **Settings Configuration** in `.claude/settings.json`

### Documentation Workflow
```bash
# Check what needs updating
python .claude/hooks/documentation-tracker.py

# Find module docs
find docs/modules -name "*.md" | grep -i "module-name"

# Check uncommitted docs
git status docs/ --porcelain
```

### Key Documentation Locations
- **System Architecture**: `docs/architecture/overview.md`
- **Module Docs**: `docs/modules/[frontend|backend|standalone]/`
- **API Reference**: `docs/API_ENDPOINTS.md`
- **Integration Guide**: `docs/modules/integration/cross-module-integration.md`

## 📋 Session Checklist

**Pre-Session**:
- [ ] System running: `docker-compose ps`
- [ ] Auth mode correct: `curl http://localhost:8000/api/auth/config`
- [ ] Data loaded: Check Patient count in UI
- [ ] Context7 connected: `claude mcp list`

**During Development**:
- [ ] EVERY task broken into subtasks
- [ ] Research phase completed first
- [ ] Using context7/web search for standards
- [ ] Documentation updated continuously
- [ ] Following event patterns
- [ ] Testing with multiple patients

**Post-Implementation**:
- [ ] Two-pass code review completed
- [ ] Git commit and push done
- [ ] All documentation updated
- [ ] No console.log() statements
- [ ] Integration points verified

## 🎯 Known Gaps & Priorities

**Critical**: Frontend E2E tests, Load testing  
**Medium**: Analytics dashboard, Mobile support  
**Future**: SMART on FHIR, AI integration

---

**Remember**: This is a production EMR. Patient safety and data integrity are paramount.

## 📅 Recent Updates

### 2025-07-16
- Consolidated all FHIR-related code into unified `backend/fhir/` module structure
- Resolved Python namespace conflicts (renamed `fhir/resources/` to `fhir/resource_definitions/`)
- Fixed FastAPI type validation issues with custom Pydantic models
- Updated all import paths across 88 files to use new FHIR module structure
- Verified all FHIR endpoints functional with proper Bundle structure
- Created comprehensive backend consolidation documentation
- Implemented complete FHIR R4 _has parameter (reverse chaining) functionality
- Added support for all major search parameter types in _has queries
- Implemented nested _has for recursive reverse chaining
- Created comprehensive test suite and manual testing script for _has parameter
- Updated search documentation with _has parameter guide

### 2025-07-14
- Implemented R4/R5 agnostic handling for medication resources
- Fixed MedicationRequest and MedicationDispense R5 to R4B conversion
- Resolved reason field and numberOfRepeatsAllowed validation errors
- All medication workflows (prescribe, verify, dispense) working correctly
- Fixed DocumentReference validation "integer is required" errors
- Resolved dict() to json() conversion for preserving data types
- Simplified document validation to avoid reconstruction issues
- Fixed encounterId null issue using activeEncounter from context
- Removed console.warn statements from EnhancedNoteEditor
- Integrated noteTemplatesService replacing hardcoded templates
- Enhanced smart phrase expansion with date/time macros

### 2025-07-12
- Fixed dynamic clinical catalog 404 errors
- Resolved frontend proxy configuration conflicts
- Implemented direct backend connection for development
- Verified all dynamic catalog endpoints working
- Confirmed autocomplete search functionality

### 2025-01-10
- Integrated Context7 MCP server via HTTP transport
- Enhanced all agents with Context7 real-time capabilities
- Updated hook system for automatic Context7 integration
- Added cross-session knowledge persistence
- Implemented CLI support for direct Context7 queries

### 2025-01-08
- Implemented comprehensive agent system
- Added automated quality gates
- Removed all console.log/print statements
- Enhanced security and testing infrastructure
- Improved error handling with ErrorBoundary
- Added pagination and performance enhancements