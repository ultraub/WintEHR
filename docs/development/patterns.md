# WintEHR Development Patterns & Conventions

**Last Updated**: 2025-01-08  
**Purpose**: Definitive guide to coding patterns, conventions, and best practices used throughout the WintEHR codebase

## Table of Contents
1. [Frontend Patterns](#frontend-patterns)
2. [Backend Patterns](#backend-patterns)
3. [Data Management Patterns](#data-management-patterns)
4. [API Design Patterns](#api-design-patterns)
5. [Error Handling Patterns](#error-handling-patterns)
6. [Testing Patterns](#testing-patterns)
7. [Security Patterns](#security-patterns)

---

## Frontend Patterns

### 1. React Component Patterns

#### A. Context + Reducer Pattern
**Used For**: Complex state management with multiple actions
**Location**: `src/contexts/FHIRResourceContext.js`, `ClinicalWorkflowContext.js`

```javascript
// Pattern: Context + useReducer for complex state
const FHIRResourceContext = createContext();

// Action types as constants
const FHIR_ACTIONS = {
  SET_RESOURCES: 'SET_RESOURCES',
  ADD_RESOURCE: 'ADD_RESOURCE',
  UPDATE_RESOURCE: 'UPDATE_RESOURCE',
  // ... more actions
};

// Reducer with immutable updates
function fhirResourceReducer(state, action) {
  switch (action.type) {
    case FHIR_ACTIONS.SET_RESOURCES:
      return {
        ...state,
        resources: {
          ...state.resources,
          [action.payload.resourceType]: {
            ...state.resources[action.payload.resourceType],
            ...resourceMap
          }
        }
      };
    // ... other cases
  }
}

// Provider with business logic
export function FHIRResourceProvider({ children }) {
  const [state, dispatch] = useReducer(fhirResourceReducer, initialState);
  
  // Wrap dispatch in business logic functions
  const addResource = useCallback((resourceType, resource) => {
    dispatch({
      type: FHIR_ACTIONS.ADD_RESOURCE,
      payload: { resourceType, resource }
    });
    // Additional business logic here
  }, []);
  
  return (
    <FHIRResourceContext.Provider value={{ ...state, addResource }}>
      {children}
    </FHIRResourceContext.Provider>
  );
}
```

#### B. Custom Hook Pattern
**Used For**: Encapsulating reusable stateful logic
**Location**: `src/hooks/useFHIRResources.js`, `useMedicationResolver.js`

```javascript
// Pattern: Custom hooks for reusable logic
export function usePatientResources(patientId, resourceType = null) {
  const { getPatientResources, fetchPatientBundle, isLoading } = useFHIRResource();
  
  const resources = getPatientResources(patientId, resourceType);
  const loading = isLoading(resourceType || 'Patient');
  
  const loadResources = useCallback(async (forceRefresh = false) => {
    if (patientId) {
      return await fetchPatientBundle(patientId, forceRefresh);
    }
  }, [patientId, fetchPatientBundle]);

  return { resources, loading, loadResources };
}

// Usage in components
function ChartReviewTab() {
  const { patient } = useAuth();
  const { resources: conditions, loading } = usePatientResources(patient?.id, 'Condition');
  
  // Component logic here
}
```

#### C. Compound Component Pattern
**Used For**: Complex UI components with multiple parts
**Location**: Clinical workspace tabs

```javascript
// Pattern: Compound components for flexible composition
function ClinicalWorkspace({ children, patient }) {
  return (
    <div className="clinical-workspace">
      <WorkspaceHeader patient={patient} />
      <WorkspaceContent>
        {children}
      </WorkspaceContent>
    </div>
  );
}

ClinicalWorkspace.Tab = function WorkspaceTab({ label, children }) {
  return <div role="tabpanel">{children}</div>;
};

// Usage
<ClinicalWorkspace patient={currentPatient}>
  <ClinicalWorkspace.Tab label="Chart Review">
    <ChartReviewTab />
  </ClinicalWorkspace.Tab>
  <ClinicalWorkspace.Tab label="Results">
    <ResultsTab />
  </ClinicalWorkspace.Tab>
</ClinicalWorkspace>
```

### 2. State Management Patterns

#### A. Progressive Loading Pattern
**Used For**: Performance optimization with large datasets

```javascript
// Pattern: Load critical data first, then progressive enhancement
const fetchPatientBundle = useCallback(async (patientId, forceRefresh = false, priority = 'all') => {
  const resourceTypesByPriority = {
    critical: ['Encounter', 'Condition', 'MedicationRequest', 'AllergyIntolerance'],
    important: ['Observation', 'Procedure', 'DiagnosticReport', 'Coverage'],
    optional: ['Immunization', 'CarePlan', 'CareTeam', 'DocumentReference']
  };
  
  // Load critical first
  if (priority === 'critical') {
    resourceTypes = resourceTypesByPriority.critical;
  } else {
    // Progressive loading of all types
    resourceTypes = [...critical, ...important, ...optional];
  }
  
  // Parallel loading with Promise.all
  const promises = resourceTypes.map(type => loadResourceType(type, patientId));
  return await Promise.all(promises);
}, []);
```

#### B. Intelligent Caching Pattern
**Used For**: Performance optimization with cache invalidation

```javascript
// Pattern: Multi-level caching with TTL and intelligent invalidation
const getCachedData = useCallback((cacheType, key) => {
  // Check intelligent cache first
  const intelligentData = intelligentCache.get(`${cacheType}:${key}`);
  if (intelligentData) return intelligentData;
  
  // Fallback to state cache
  const cached = state.cache[cacheType]?.[key];
  if (!cached) return null;
  
  // Check TTL
  if (Date.now() - cached.timestamp > cached.ttl) {
    // Auto-invalidate expired cache
    dispatch({ type: FHIR_ACTIONS.INVALIDATE_CACHE, payload: { cacheType, key } });
    return null;
  }
  
  return cached.data;
}, [state.cache]);
```

### 3. Event-Driven Communication Pattern

#### A. Pub/Sub Pattern for Cross-Module Communication
**Used For**: Decoupled communication between clinical tabs

```javascript
// Pattern: Event-driven architecture with typed events
export const CLINICAL_EVENTS = {
  ORDER_PLACED: 'order.placed',
  RESULT_RECEIVED: 'result.received',
  MEDICATION_DISPENSED: 'medication.dispensed',
  // ... more events
};

// Publisher
const publish = useCallback(async (eventType, data) => {
  const listeners = eventListeners.get(eventType) || [];
  
  // Execute all listeners
  for (const listener of listeners) {
    try {
      await listener(data);
    } catch (error) {
      console.error(`Error in event listener for ${eventType}:`, error);
    }
  }
  
  // Handle automated workflows
  await handleAutomatedWorkflows(eventType, data);
}, [eventListeners]);

// Subscriber
const subscribe = useCallback((eventType, callback) => {
  const listeners = eventListeners.get(eventType) || [];
  listeners.push(callback);
  setEventListeners(prev => new Map(prev).set(eventType, listeners));
  
  // Return unsubscribe function
  return () => {
    const currentListeners = eventListeners.get(eventType) || [];
    const updatedListeners = currentListeners.filter(cb => cb !== callback);
    setEventListeners(prev => new Map(prev).set(eventType, updatedListeners));
  };
}, [eventListeners]);
```

---

## Backend Patterns

### 1. Repository Pattern

#### A. FHIR Storage Engine
**Used For**: Abstracting data access logic
**Location**: `backend/core/fhir/storage.py`

```python
# Pattern: Repository pattern for data access abstraction
class FHIRStorageEngine:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.validator = SyntheaFHIRValidator()
    
    async def create_resource(self, resource_type: str, resource_data: dict, 
                            if_none_exist: str = None) -> Tuple[str, int, datetime]:
        """Create a new FHIR resource with validation and indexing."""
        
        # Validate FHIR resource
        validated_resource = await self.validator.validate_resource(resource_type, resource_data)
        
        # Check conditional create
        if if_none_exist:
            existing = await self._find_existing_resource(resource_type, if_none_exist)
            if existing:
                raise ConditionalCreateExistingResource(existing)
        
        # Create with transaction
        async with self.db.begin():
            resource_id = await self._insert_resource(validated_resource)
            await self._index_search_parameters(resource_id, validated_resource)
            await self._create_references(resource_id, validated_resource)
        
        return resource_id, version_id, last_updated
```

#### B. Service Layer Pattern
**Used For**: Business logic separation
**Location**: Various service modules

```python
# Pattern: Service layer for business logic
class PharmacyService:
    def __init__(self, storage: FHIRStorageEngine):
        self.storage = storage
    
    async def dispense_medication(self, dispense_data: dict) -> dict:
        """Complete medication dispensing workflow."""
        
        # Validate dispensing business rules
        await self._validate_dispensing_rules(dispense_data)
        
        # Create MedicationDispense resource
        dispense_resource = await self._create_dispense_resource(dispense_data)
        
        # Update original MedicationRequest status
        await self._update_prescription_status(dispense_data['prescription_id'])
        
        # Trigger workflow events
        await self._notify_clinical_workflow(dispense_resource)
        
        return dispense_resource
```

### 2. Dependency Injection Pattern

#### A. FastAPI Dependency System
**Used For**: Clean dependency management

```python
# Pattern: Dependency injection for clean architecture
async def get_db_session() -> AsyncSession:
    """Database session dependency."""
    async with AsyncSessionLocal() as session:
        yield session

async def get_storage_engine(db: AsyncSession = Depends(get_db_session)) -> FHIRStorageEngine:
    """Storage engine dependency."""
    return FHIRStorageEngine(db)

# Usage in endpoints
@router.post("/{resource_type}")
async def create_resource(
    resource_type: str,
    request: Request,
    storage: FHIRStorageEngine = Depends(get_storage_engine)
):
    resource_data = await request.json()
    return await storage.create_resource(resource_type, resource_data)
```

### 3. Factory Pattern

#### A. FHIR Resource Factory
**Used For**: Resource creation with validation

```python
# Pattern: Factory for FHIR resource creation
class FHIRResourceFactory:
    @staticmethod
    def create_condition(patient_id: str, condition_data: dict) -> dict:
        """Create a properly formatted Condition resource."""
        return {
            "resourceType": "Condition",
            "id": str(uuid.uuid4()),
            "meta": {
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z"
            },
            "clinicalStatus": condition_data.get("clinicalStatus", {
                "coding": [{"system": "http://terminology.hl7.org/CodeSystem/condition-clinical", 
                           "code": "active"}]
            }),
            "subject": {"reference": f"Patient/{patient_id}"},
            "code": condition_data["code"],
            # ... other fields
        }
```

---

## Data Management Patterns

### 1. FHIR Data Access Pattern

#### A. Search Parameter Handling
**Used For**: Consistent FHIR search implementation

```python
# Pattern: Search parameter processing with type safety
class SearchParameterHandler:
    def parse_search_params(self, resource_type: str, query_params: dict) -> Tuple[dict, dict]:
        """Parse and validate FHIR search parameters."""
        
        search_params = {}
        result_params = {}
        
        for param_name, param_value in query_params.items():
            if param_name.startswith('_'):
                # Result parameters (_count, _include, etc.)
                result_params[param_name] = param_value
            else:
                # Search parameters
                param_def = self.get_parameter_definition(resource_type, param_name)
                parsed_value = self.parse_parameter_value(param_def, param_value)
                search_params[param_name] = parsed_value
        
        return search_params, result_params
```

#### B. Reference Resolution Pattern
**Used For**: Handling FHIR references consistently

```python
# Pattern: Reference resolution with dual format support
class ReferenceResolver:
    def resolve_reference(self, reference: str) -> Tuple[str, str]:
        """Resolve both Patient/123 and urn:uuid: formats."""
        
        if reference.startswith('urn:uuid:'):
            # Synthea format: urn:uuid:12345678-1234-1234-1234-123456789012
            uuid_part = reference.replace('urn:uuid:', '')
            return self._find_resource_by_uuid(uuid_part)
        elif '/' in reference:
            # Standard format: Patient/123
            resource_type, resource_id = reference.split('/', 1)
            return resource_type, resource_id
        else:
            raise ValueError(f"Invalid reference format: {reference}")
```

### 2. Database Pattern

#### A. JSONB Query Pattern
**Used For**: Efficient FHIR resource queries

```python
# Pattern: JSONB queries for FHIR data
class FHIRQueryBuilder:
    def build_search_query(self, resource_type: str, search_params: dict) -> str:
        """Build efficient PostgreSQL queries for FHIR search."""
        
        base_query = """
            SELECT resource, fhir_id, last_updated
            FROM fhir.resources 
            WHERE resource_type = :resource_type 
            AND deleted = false
        """
        
        conditions = []
        
        for param_name, param_value in search_params.items():
            if param_name == 'patient':
                # Handle patient reference
                conditions.append("""
                    (resource->'subject'->>'reference' = :patient_ref OR
                     resource->'patient'->>'reference' = :patient_ref OR
                     resource->'subject'->>'reference' = :patient_urn)
                """)
            elif param_name == '_lastUpdated':
                # Handle date range
                conditions.append("last_updated >= :date_from AND last_updated <= :date_to")
            # ... more parameter types
        
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        return base_query
```

---

## API Design Patterns

### 1. RESTful API Pattern

#### A. Resource-Oriented URLs
**Used For**: Consistent API design

```python
# Pattern: RESTful resource endpoints
@router.get("/{resource_type}")          # Search resources
@router.post("/{resource_type}")         # Create resource
@router.get("/{resource_type}/{id}")     # Read resource
@router.put("/{resource_type}/{id}")     # Update resource
@router.delete("/{resource_type}/{id}")  # Delete resource

# FHIR-specific operations
@router.get("/{resource_type}/{id}/_history")        # Instance history
@router.get("/{resource_type}/_history")             # Type history
@router.post("/{resource_type}/${operation}")        # Type operations
@router.post("/{resource_type}/{id}/${operation}")   # Instance operations
```

#### B. Consistent Response Pattern
**Used For**: Predictable API responses

```python
# Pattern: Consistent response structure
class APIResponse:
    @staticmethod
    def success(data=None, status_code=200):
        return JSONResponse(
            content=data,
            status_code=status_code,
            headers={
                "Cache-Control": "no-cache",
                "Content-Type": "application/fhir+json"
            }
        )
    
    @staticmethod
    def error(message: str, status_code: int, details=None):
        return JSONResponse(
            content={
                "resourceType": "OperationOutcome",
                "issue": [{
                    "severity": "error",
                    "code": "processing",
                    "details": {"text": message}
                }]
            },
            status_code=status_code
        )
```

### 2. Content Negotiation Pattern

#### A. FHIR Content Types
**Used For**: Proper FHIR content handling

```python
# Pattern: Content negotiation middleware
async def content_negotiation_middleware(request: Request, call_next):
    """Handle FHIR content negotiation."""
    
    # Set default content type for FHIR endpoints
    if request.url.path.startswith("/fhir/"):
        if not request.headers.get("accept"):
            request.headers.__dict__["accept"] = "application/fhir+json"
    
    response = await call_next(request)
    
    # Ensure FHIR responses have correct content type
    if request.url.path.startswith("/fhir/") and response.status_code < 400:
        response.headers["content-type"] = "application/fhir+json; charset=utf-8"
    
    return response
```

---

## Error Handling Patterns

### 1. Comprehensive Error Handling

#### A. Frontend Error Boundaries
**Used For**: Graceful error recovery in React

```javascript
// Pattern: Error boundaries with user-friendly messages
class ClinicalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    // Log to monitoring service
    console.error('Clinical workflow error:', error, errorInfo);
    
    // Send to error tracking service
    if (window.errorTracker) {
      window.errorTracker.captureException(error, {
        tags: { component: 'clinical-workflow' },
        extra: errorInfo
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error">
          <AlertTitle>Clinical Workflow Error</AlertTitle>
          An error occurred while loading clinical data. Please refresh the page or contact support.
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </Alert>
      );
    }
    
    return this.props.children;
  }
}
```

#### B. Backend Exception Handling
**Used For**: Consistent error responses

```python
# Pattern: Structured exception handling
class FHIRException(Exception):
    def __init__(self, message: str, status_code: int = 400, operation_outcome=None):
        self.message = message
        self.status_code = status_code
        self.operation_outcome = operation_outcome
        super().__init__(message)

@app.exception_handler(FHIRException)
async def fhir_exception_handler(request: Request, exc: FHIRException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "resourceType": "OperationOutcome",
            "issue": [{
                "severity": "error",
                "code": "processing",
                "details": {"text": exc.message}
            }]
        }
    )
```

### 2. Validation Pattern

#### A. Pydantic Model Validation
**Used For**: Data validation and serialization

```python
# Pattern: Pydantic models for validation
class ConditionCreate(BaseModel):
    clinicalStatus: Dict[str, Any]
    verificationStatus: Optional[Dict[str, Any]] = None
    code: Dict[str, Any]
    subject: Dict[str, str]
    recordedDate: Optional[str] = None
    
    @validator('subject')
    def validate_subject_reference(cls, v):
        if not v.get('reference', '').startswith(('Patient/', 'urn:uuid:')):
            raise ValueError('Subject must be a valid Patient reference')
        return v
    
    @validator('recordedDate')
    def validate_date_format(cls, v):
        if v:
            try:
                datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                raise ValueError('Invalid date format')
        return v
```

---

## Testing Patterns

### 1. Backend Testing Patterns

#### A. Pytest Fixture Pattern
**Used For**: Reusable test setup

```python
# Pattern: Pytest fixtures for test setup
@pytest.fixture
async def db_session():
    """Create a test database session."""
    async with AsyncSessionLocal() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def storage_engine(db_session):
    """Create a storage engine for testing."""
    return FHIRStorageEngine(db_session)

@pytest.fixture
def sample_patient():
    """Create a sample patient for testing."""
    return {
        "resourceType": "Patient",
        "id": "test-patient-123",
        "name": [{"family": "Doe", "given": ["John"]}],
        "gender": "male",
        "birthDate": "1990-01-01"
    }

# Test usage
async def test_create_patient(storage_engine, sample_patient):
    patient_id, version, updated = await storage_engine.create_resource(
        "Patient", sample_patient
    )
    assert patient_id == "test-patient-123"
    assert version == 1
```

#### B. Test Class Organization
**Used For**: Organized test structure

```python
# Pattern: Test classes organized by functionality
class TestFHIRResourceCRUD:
    """Test CRUD operations for FHIR resources."""
    
    async def test_create_resource(self, storage_engine):
        """Test resource creation."""
        pass
    
    async def test_read_resource(self, storage_engine):
        """Test resource reading."""
        pass
    
    async def test_update_resource(self, storage_engine):
        """Test resource updating."""
        pass
    
    async def test_delete_resource(self, storage_engine):
        """Test resource deletion."""
        pass

class TestFHIRSearch:
    """Test FHIR search functionality."""
    
    async def test_search_by_patient(self, storage_engine):
        """Test patient-scoped search."""
        pass
    
    async def test_search_by_date_range(self, storage_engine):
        """Test date range search."""
        pass
```

---

## Security Patterns

### 1. Authentication Pattern

#### A. Dual-Mode Authentication
**Used For**: Flexible authentication for training and production

```python
# Pattern: Dual-mode authentication strategy
class AuthenticationStrategy:
    def __init__(self, jwt_enabled: bool = False):
        self.jwt_enabled = jwt_enabled
        self.training_users = self._load_training_users()
    
    async def authenticate_user(self, credentials: dict) -> Optional[User]:
        if self.jwt_enabled:
            return await self._jwt_authentication(credentials)
        else:
            return await self._training_authentication(credentials)
    
    async def _jwt_authentication(self, credentials: dict) -> Optional[User]:
        """Production JWT authentication."""
        token = credentials.get('token')
        if not token:
            return None
        
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            return await self._get_user_by_id(payload['user_id'])
        except jwt.InvalidTokenError:
            return None
    
    async def _training_authentication(self, credentials: dict) -> Optional[User]:
        """Training mode authentication."""
        username = credentials.get('username')
        return self.training_users.get(username)
```

### 2. Permission Pattern

#### A. Role-Based Access Control
**Used For**: Granular permissions management

```python
# Pattern: RBAC with role hierarchy
class PermissionManager:
    ROLES = {
        'admin': ['read', 'write', 'admin', 'system'],
        'physician': ['read', 'write', 'admin'],
        'nurse': ['read', 'write'],
        'pharmacist': ['read', 'write'],
    }
    
    def check_permission(self, user_role: str, required_permission: str) -> bool:
        """Check if user role has required permission."""
        user_permissions = self.ROLES.get(user_role, [])
        return required_permission in user_permissions
    
    def require_permission(self, permission: str):
        """Decorator for permission checking."""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Extract user from request context
                user = get_current_user()
                if not self.check_permission(user.role, permission):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Insufficient permissions. Required: {permission}"
                    )
                return await func(*args, **kwargs)
            return wrapper
        return decorator
```

---

## Summary

This document outlines the key patterns and conventions used throughout the WintEHR codebase. These patterns ensure:

1. **Consistency**: Uniform approach across the entire codebase
2. **Maintainability**: Clear separation of concerns and responsibilities
3. **Scalability**: Patterns that support growth and evolution
4. **Testing**: Testable code with clear boundaries
5. **Security**: Built-in security considerations

When contributing to the codebase, follow these established patterns to maintain code quality and consistency. For new patterns or significant deviations, create an Architecture Decision Record (ADR) to document the reasoning and implications.