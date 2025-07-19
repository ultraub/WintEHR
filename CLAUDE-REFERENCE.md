# CLAUDE-REFERENCE.md - MedGenEMR Detailed Implementation Reference

**Last Updated**: 2025-01-19  
**Version**: 2.0

This document contains comprehensive implementation details, patterns, and troubleshooting guides for the MedGenEMR (WintEHR) system. It serves as the detailed reference companion to the main [CLAUDE.md](./CLAUDE.md) quick reference guide.

> **Quick Links**: [PROJECT_INDEX.md](./PROJECT_INDEX.md) | [CLAUDE.md](./CLAUDE.md) | [CLAUDE-AGENTS.md](./CLAUDE-AGENTS.md)

## Table of Contents

1. [Task Management Protocol](#task-management-protocol)
2. [Architecture Patterns](#architecture-patterns)
3. [Implementation Patterns](#implementation-patterns)
4. [Clinical Workflows](#clinical-workflows)
5. [Data Management](#data-management)
6. [State Management Patterns](#state-management-patterns)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [Agent System Details](#agent-system-details)
9. [Testing Guidelines](#testing-guidelines)
10. [Documentation System](#documentation-system)
11. [Recent Improvements](#recent-improvements)

---

## 📋 Task Management Protocol

### Detailed Task Breakdown Structure

Every task **MUST** be broken into subtasks using TodoWrite following this pattern:

#### Starting a Task

```javascript
// Use TodoWrite to create task structure with priorities
TodoWrite([
  { content: "Research Phase: Review module documentation", status: "pending", priority: "high" },
  { content: "Research Phase: Check context7 for latest patterns", status: "pending", priority: "high" },
  { content: "Research Phase: Analyze existing implementations", status: "pending", priority: "high" },
  { content: "Research Phase: Update outdated documentation", status: "pending", priority: "medium" },
  { content: "Implementation: Core functionality", status: "pending", priority: "high" },
  { content: "Implementation: Error handling and edge cases", status: "pending", priority: "high" },
  { content: "Implementation: Loading states and UI feedback", status: "pending", priority: "medium" },
  { content: "Implementation: Integration with existing modules", status: "pending", priority: "high" },
  { content: "Testing: Test with multiple patients", status: "pending", priority: "high" },
  { content: "Review: First pass - check completeness", status: "pending", priority: "high" },
  { content: "Review: Second pass - verify integration", status: "pending", priority: "high" },
  { content: "Finalize: Git commit with conventional message", status: "pending", priority: "medium" },
  { content: "Finalize: Update all affected documentation", status: "pending", priority: "medium" }
]);
```

#### 1. Research Phase (ALWAYS FIRST)

For EVERY task, create these research subtasks:

- [ ] Research affected modules in `docs/modules/`
- [ ] Review related documentation files
- [ ] Use `context7` to check latest React/FastAPI patterns
- [ ] Check existing implementations for patterns to follow
- [ ] Identify integration points with other modules
- [ ] Web search for current best practices if needed
- [ ] Document any discrepancies or outdated patterns found
- [ ] Update outdated documentation BEFORE coding
- [ ] Review recent commits for context (`git log --oneline -20`)

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
// State Management with Error Handling
const { resources, loading, error } = useFHIRResource();

// Cross-Module Events with Error Handling
const { publish, subscribe } = useClinicalWorkflow();
try {
  await publish(CLINICAL_EVENTS.ORDER_PLACED, orderData);
} catch (error) {
  showError('Failed to publish order event');
}

// Progressive Loading with Priorities
// Priority levels: 'critical', 'important', 'optional'
await fetchPatientBundle(patientId, false, 'critical');

// WebSocket Integration
const { subscribe: wsSubscribe, lastMessage } = useWebSocket();
wsSubscribe('patient-updates', ['Observation', 'Condition'], [patientId]);
```

### Backend: Repository + Service + DI

```python
# Repository Pattern with Complete Implementation
class FHIRStorageEngine:
    async def create_resource(self, resource_type: str, data: dict) -> dict:
        # 1. Validate FHIR resource against R4 spec
        # 2. Store in fhir.resources table
        # 3. Extract and index search parameters
        # 4. Update patient compartments
        # 5. Create audit log entry
        # 6. Return created resource with id and meta

# Service Layer with Business Logic
class PharmacyService:
    def __init__(self, storage: FHIRStorageEngine):
        self.storage = storage
    
    async def dispense_medication(self, request_id: str, data: dict) -> dict:
        # 1. Validate prescription exists and is active
        # 2. Check for drug interactions
        # 3. Create MedicationDispense resource
        # 4. Update MedicationRequest status
        # 5. Publish dispense event
        # 6. Return dispense record

# Dependency Injection with Type Hints
async def endpoint(
    request_data: dict,
    storage: FHIRStorageEngine = Depends(get_storage),
    current_user: dict = Depends(get_current_user)
) -> JSONResponse:
    # Implementation with proper error handling
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

### Deployment Process

```bash
# Primary deployment method - fresh-deploy.sh
./fresh-deploy.sh                    # Default: 20 patients, dev mode
./fresh-deploy.sh --patients 50      # Custom patient count
./fresh-deploy.sh --mode production --patients 100  # Production mode

# Alternative: Master deployment script
./scripts/master-deploy.sh           # Full modular deployment
./scripts/master-deploy.sh --production --patients=100
```

### Synthea Integration

```bash
# Direct synthea_master.py usage (inside container)
docker exec emr-backend python scripts/active/synthea_master.py full --count 20
docker exec emr-backend python scripts/active/synthea_master.py wipe
docker exec emr-backend python scripts/active/synthea_master.py validate

# Load patients script (wrapper)
./load-patients.sh 20                # Add 20 patients
./load-patients.sh --wipe 50        # Clear and load 50 patients
```

### DICOM Generation

```bash
# Generate multi-slice medical imaging studies
docker exec emr-backend python scripts/generate_dicom_for_studies.py
```

### Database Tables

All 6 FHIR tables are created by `init_database_definitive.py`:

| Table | Purpose | Auto-Population |
|-------|---------|-----------------|
| `fhir.resources` | Main resource storage | During import |
| `fhir.resource_history` | Version tracking | On create/update |
| `fhir.search_params` | Search indexes | During import + indexing |
| `fhir.references` | Resource relationships | On create/update |
| `fhir.compartments` | Patient compartments | Post-import script |
| `fhir.audit_logs` | Audit trail | Requires implementation |

### Data Import Patterns

```python
# Bulk FHIR import with proper error handling
from fhir.core.storage import FHIRStorageEngine

storage = FHIRStorageEngine()
for bundle in bundles:
    try:
        result = await storage.import_bundle(bundle)
        logger.info(f"Imported bundle with {len(result)} resources")
    except Exception as e:
        logger.error(f"Failed to import bundle: {e}")
        # Continue with next bundle
```

## 🔄 State Management Patterns

### Frontend State Architecture

```javascript
// Centralized Loading State Management
import { useLoadingState } from '@/hooks/useLoadingState';

const MyComponent = () => {
  const { setGlobalLoading, setComponentLoading } = useLoadingState();
  
  // Component-level loading
  setComponentLoading('myComponent', true);
  
  // Global loading for major operations
  setGlobalLoading(true);
};
```

### Context Hierarchy

```javascript
// 1. AuthContext - Authentication state
// 2. PatientContext - Current patient selection
// 3. ClinicalWorkflowContext - Event system
// 4. WebSocketContext - Real-time updates
// 5. FHIRContext - Resource management

// Proper context ordering in App.js
<AuthProvider>
  <PatientProvider>
    <ClinicalWorkflowProvider>
      <WebSocketProvider>
        <FHIRProvider>
          <App />
        </FHIRProvider>
      </WebSocketProvider>
    </ClinicalWorkflowProvider>
  </PatientProvider>
</AuthProvider>
```

### Resource Loading Patterns

```javascript
// Progressive Loading Strategy
const loadPatientData = async (patientId) => {
  // Phase 1: Critical data (immediate display)
  const critical = await fetchPatientBundle(patientId, false, 'critical');
  setCriticalData(critical);
  
  // Phase 2: Important data (enhanced view)
  const important = await fetchPatientBundle(patientId, false, 'important');
  setImportantData(important);
  
  // Phase 3: Optional data (complete view)
  const optional = await fetchPatientBundle(patientId, false, 'optional');
  setOptionalData(optional);
};
```

### Event-Driven State Updates

```javascript
// Publisher component
const OrdersTab = () => {
  const { publish } = useClinicalWorkflow();
  
  const createOrder = async (orderData) => {
    const order = await fhirService.createResource('ServiceRequest', orderData);
    await publish(CLINICAL_EVENTS.ORDER_PLACED, {
      orderId: order.id,
      patientId: order.subject.reference,
      type: order.category?.[0]?.coding?.[0]?.code
    });
  };
};

// Subscriber component
const ResultsTab = () => {
  const { subscribe } = useClinicalWorkflow();
  
  useEffect(() => {
    const unsubscribe = subscribe(CLINICAL_EVENTS.ORDER_PLACED, async (event) => {
      if (event.type === 'laboratory') {
        // Create pending result placeholder
        await refreshResults();
      }
    });
    return unsubscribe;
  }, []);
};
```

### Error Boundary Implementation

```javascript
// Global error boundary
class ErrorBoundary extends React.Component {
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to monitoring service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

## 🐛 Troubleshooting Guide

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Export 'X' not found | Import from `@mui/icons-material` not `@mui/material` |
| Objects not valid as React child | Use `obj?.text \|\| obj?.coding?.[0]?.display` |
| Medications show "Unknown" | Use `useMedicationResolver` hook with proper error handling |
| Missing patient data | Check `resources` not `result.entry`, verify search params indexed |
| CORS errors | Ensure backend running: `docker-compose ps`, check nginx.conf |
| WebSocket connection fails | Check auth token, ensure JWT_ENABLED matches frontend/backend |
| Export fails (large data) | Implement pagination or streaming for large datasets |
| CDS hook validation fails | Check hook ID uniqueness, validate against CDS Hooks spec |
| Dynamic catalog 404 | Service bypasses proxy, uses direct backend connection |
| High memory usage (500MB+) | Fixed: Reduced resource counts, added cleanup mechanisms |
| Loading states stuck | Check for unhandled promise rejections, add finally blocks |
| Race conditions | Use proper async/await, implement request debouncing |
| Search returns empty | Run `verify_search_params_after_import.py --fix` |
| Compartments missing | Run `populate_compartments.py` after data import |

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

## 🆕 Recent Improvements

### Clinical Enhancements (2025)

#### Comprehensive Clinical Catalog System
- **Dynamic Catalogs**: Real-time extraction from patient data
- **57 Conditions**: With frequency counts from actual diagnoses
- **27 Medications**: Including dosage patterns and usage statistics
- **47 Lab Tests**: With calculated 5th-95th percentile reference ranges
- **91 Procedures**: Frequency-based ordering from patient records

#### FHIR Relationship Visualization
- **RelationshipMapper Component**: Visual graph of resource connections
- **Interactive Navigation**: Click to explore related resources
- **Automatic Updates**: Real-time sync with resource changes

#### Enhanced State Management
- **Centralized Loading States**: Global and component-level tracking
- **Race Condition Prevention**: Proper request queuing and debouncing
- **Error Recovery**: Automatic retry with exponential backoff

### Performance Optimizations

#### Database Index Optimization
```sql
-- New composite indexes for common queries
CREATE INDEX idx_patient_date ON fhir.resources(resource_type, patient_id, date);
CREATE INDEX idx_status_patient ON fhir.resources(status, patient_id);
```

#### Progressive Resource Loading
- **3-Phase Loading**: Critical → Important → Optional
- **Bundle Support**: Efficient multi-resource fetching
- **Smart Caching**: TTL-based with invalidation

#### Search Parameter Improvements
- **Consolidated Indexing**: Single script for all resources
- **Auto-Fix Capability**: Detect and repair missing parameters
- **Performance Monitoring**: Real-time indexing health checks

### UI/UX Improvements

#### Modern Clinical Workspace
- **Redesigned Patient Portal**: Intuitive tab-based navigation
- **Skeleton Loading**: Better perceived performance
- **Responsive Design**: Full mobile support
- **Accessibility**: WCAG 2.1 AA compliance

#### WebSocket Enhancements
- **Connection Pooling**: Reduced overhead
- **Automatic Reconnection**: With exponential backoff
- **Message Queuing**: No lost updates during reconnection

### Infrastructure Updates

#### Deployment Improvements
- **fresh-deploy.sh**: Streamlined deployment process
- **Parallel Processing**: Faster data import and indexing
- **Health Checks**: Comprehensive validation post-deployment

#### Development Experience
- **Hot Module Replacement**: Faster frontend development
- **Improved Error Messages**: Clear, actionable feedback
- **Enhanced Logging**: Structured logs with correlation IDs

### Code Quality Improvements

#### Testing Infrastructure
- **E2E Test Suite**: Playwright-based clinical workflows
- **Integration Tests**: Cross-module interaction validation
- **Performance Tests**: Automated performance regression detection

#### Documentation Updates
- **PROJECT_INDEX.md**: Central navigation guide
- **Updated Module Docs**: Current as of 2025-01-19
- **Interactive Examples**: Runnable code snippets

---

**Last Updated**: 2025-01-19  
**Version**: 2.0

For quick reference and critical rules, see [CLAUDE.md](./CLAUDE.md)