# CLAUDE-REFERENCE.md - MedGenEMR Detailed Implementation Reference

This document contains comprehensive implementation details, patterns, and troubleshooting guides for the MedGenEMR system. It serves as the detailed reference companion to the main [CLAUDE.md](./CLAUDE.md) quick reference guide.

## Table of Contents

1. [Task Management Protocol](#task-management-protocol)
2. [Architecture Patterns](#architecture-patterns)
3. [Implementation Patterns](#implementation-patterns)
4. [Clinical Workflows](#clinical-workflows)
5. [Data Management](#data-management)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Agent System Details](#agent-system-details)
8. [Testing Guidelines](#testing-guidelines)
9. [Documentation System](#documentation-system)

---

## 📋 Task Management Protocol

### Detailed Task Breakdown Structure

Every task **MUST** be broken into subtasks using TodoWrite following this pattern:

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

For EVERY task, create these research subtasks:

- [ ] Research affected modules in `docs/modules/`
- [ ] Review related documentation files
- [ ] Use `context7` to check latest library patterns/standards
- [ ] Web search for current best practices if needed
- [ ] Document any discrepancies found
- [ ] Update outdated documentation BEFORE coding

#### 2. Implementation Phase

Break feature into logical subtasks:

- [ ] Core functionality implementation
- [ ] Integration with existing modules
- [ ] Error handling and edge cases
- [ ] Loading states and UI feedback
- [ ] Event publishing/subscribing
- [ ] Testing with multiple patients

#### 3. Review & Finalization (MANDATORY)

EVERY task **MUST** end with:

- [ ] First code review pass:
  - Check for incompletions (no TODOs)
  - Verify module integrations
  - Ensure consistent patterns
  - Remove all `console.log` statements
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

## 🏗️ Architecture Patterns

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

## 💻 Implementation Patterns

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

### Encounter Management Flow

1. **Check-in**: Create/update Encounter resource
2. **Vitals**: Record observations linked to encounter
3. **Assessment**: Document conditions and procedures
4. **Plan**: Create care plans and follow-up tasks
5. **Discharge**: Update encounter status and summaries

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

### Data Import Patterns

```python
# Bulk FHIR import
from fhir.core.storage import FHIRStorageEngine

storage = FHIRStorageEngine()
for bundle in bundles:
    await storage.import_bundle(bundle)
```

## 🐛 Troubleshooting Guide

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Export 'X' not found | Import from `@mui/icons-material` not `@mui/material` |
| Objects not valid as React child | Use `obj?.text || obj?.coding?.[0]?.display` |
| Medications show "Unknown" | Use `useMedicationResolver` hook |
| Missing patient data | Check `resources` not `result.entry` |
| CORS errors | Ensure backend running: `docker-compose ps` |
| WebSocket fails | Check auth token, ensure JWT_ENABLED matches |
| Export fails (large data) | Implement pagination or chunking |
| CDS hook validation | Check hook ID uniqueness |
| Dynamic catalog 404 | Service bypasses proxy, uses direct backend connection |
| High memory usage (500MB+) | Fixed: Reduced resource counts, added cleanup mechanisms |

### Debugging Techniques

```javascript
// Enable debug logging
localStorage.setItem('DEBUG_MODE', 'true');

// Check WebSocket connection
console.log(window.__WS_CONNECTION_STATUS__);

// Verify FHIR context
console.log(window.__FHIR_CONTEXT__);
```

## 🤖 Agent System Details

### Agent Architecture

```
.claude/agents/
├── core/
│   ├── feature-analyzer.py     # Analyzes and breaks down features
│   ├── feature-scaffold.py     # Generates boilerplate code
│   └── feature-workflow.py     # Orchestrates development workflow
├── quality/
│   ├── qa-agent.py            # Code quality checks
│   ├── fhir-integration-checker.py  # FHIR compliance
│   └── integration-validator.py     # Cross-module validation
└── clinical/
    ├── clinical-workflow-agent.py   # Clinical process automation
    └── compliance-checker.py        # Healthcare compliance
```

### Context7 Integration

The agent system integrates with Context7 MCP for real-time knowledge:

```python
from .utils.context7_integration import Context7Client

client = Context7Client()
context = await client.get_context("FHIR R4 Patient resource")
client.update_knowledge("New pattern", pattern_data)
```

### Quality Gates

The agent system enforces:
- ❌ No `console.log` statements (auto-fixed)
- ✅ FHIR compliance validated
- ✅ Cross-module integration verified
- ✅ Error handling implemented
- ✅ Documentation updated
- ✅ Context7 knowledge updated

## 🧪 Testing Guidelines

### Backend Testing

```bash
# Run all tests
docker exec emr-backend pytest tests/ -v

# Run specific test file
docker exec emr-backend pytest tests/test_fhir_storage.py -v

# Run with coverage
docker exec emr-backend pytest tests/ --cov=backend --cov-report=html
```

### Frontend Testing

```bash
# Run tests
cd frontend && npm test

# Run with coverage
cd frontend && npm run test:coverage

# Run specific test
cd frontend && npm test -- ChartReviewTab.test.js
```

### Integration Testing

```javascript
// Test cross-module events
describe('Cross-Module Integration', () => {
  it('should handle order-to-result flow', async () => {
    const { publish } = useClinicalWorkflow();
    await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);
    // Verify result creation
  });
});
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

- **System Architecture**: `docs/ARCHITECTURE.md`
- **Module Docs**: `docs/modules/[frontend|backend|standalone]/`
- **API Reference**: `docs/API_ENDPOINTS.md`
- **Integration Guide**: `docs/modules/integration/cross-module-integration.md`

### Documentation Standards

1. **Module Documentation**: Each module must have:
   - Overview and purpose
   - Key components
   - Integration points
   - Usage examples
   - Recent updates section

2. **API Documentation**: Each endpoint must have:
   - Method and path
   - Request/response schemas
   - Authentication requirements
   - Example requests
   - Error responses

3. **Component Documentation**: Each component must have:
   - Props interface
   - Usage examples
   - Event handlers
   - State management
   - Integration with contexts

---

**Last Updated**: 2025-01-17

For quick reference and critical rules, see [CLAUDE.md](./CLAUDE.md)