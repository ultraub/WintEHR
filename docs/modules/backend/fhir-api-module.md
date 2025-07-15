# FHIR API Module

## Overview
The FHIR API Module implements a complete FHIR R4-compliant RESTful API with full CRUD operations, advanced search capabilities, and PostgreSQL-based storage. This module demonstrates enterprise-grade FHIR server implementation patterns.

## Architecture
```
FHIR API Module
├── Router Layer (fhir_router.py)
├── Operations Layer (operations.py)
├── Search Engine (search.py)
├── Storage Engine (storage.py)
├── Validation Layer (validator.py)
├── Search Indexer (search_indexer.py)
└── Profile Transformer (profile_transformer.py)
```

## Core Components

### FHIR Router (fhir_router.py)
**Purpose**: RESTful endpoint implementation for all FHIR resources

**Endpoints**:
```python
# Instance-level operations
GET    /fhir/R4/{resourceType}/{id}
PUT    /fhir/R4/{resourceType}/{id}
DELETE /fhir/R4/{resourceType}/{id}
PATCH  /fhir/R4/{resourceType}/{id}

# Type-level operations
GET    /fhir/R4/{resourceType}
POST   /fhir/R4/{resourceType}
POST   /fhir/R4/{resourceType}/_search

# System-level operations
GET    /fhir/R4/metadata
POST   /fhir/R4/
```

**Request Handling**:
```python
@router.get("/{resource_type}/{resource_id}")
async def read_resource(
    resource_type: str,
    resource_id: str,
    db: AsyncSession = Depends(get_db)
):
    # Validation
    if resource_type not in SUPPORTED_RESOURCES:
        raise HTTPException(404, f"Resource type {resource_type} not supported")
    
    # Storage operation
    storage = FHIRStorage(db)
    resource = await storage.read(resource_type, resource_id)
    
    if not resource:
        raise HTTPException(404, f"{resource_type}/{resource_id} not found")
    
    # Response formatting
    return JSONResponse(
        content=resource,
        headers={"ETag": f'W/"{resource["meta"]["versionId"]}"'}
    )
```

### Operations Layer (operations.py)
**Purpose**: FHIR operations and extended functionality

**Implemented Operations**:
```python
# Validation
async def validate_operation(resource_type: str, resource: dict) -> OperationOutcome

# Batch/Transaction
async def transaction_operation(bundle: dict) -> Bundle

# History
async def history_operation(resource_type: str, resource_id: str) -> Bundle

# Search operations
async def search_operation(resource_type: str, parameters: dict) -> Bundle

# Custom operations
async def expand_valueset(url: str, filter: str) -> ValueSet
```

**Transaction Processing**:
```python
async def process_transaction(bundle: dict, db: AsyncSession):
    async with db.begin():
        results = []
        
        for entry in bundle.get("entry", []):
            try:
                result = await process_entry(entry, db)
                results.append(result)
            except Exception as e:
                # Rollback entire transaction
                raise TransactionError(f"Transaction failed: {str(e)}")
        
        return create_transaction_response(results)
```

### Search Engine (search.py)
**Purpose**: Advanced FHIR search parameter handling

**Search Parameter Types**:
- **String**: Case-insensitive partial matching
- **Token**: Exact code/system matching
- **Reference**: Resource reference resolution
- **Date**: Range and period searches
- **Number**: Numeric comparisons
- **Quantity**: Value and unit searches

**Search Features**:
```python
# Chained parameters
GET /Patient?general-practitioner.name=Smith

# Reverse chaining
GET /Patient?_has:Observation:patient:code=1234-5

# Including referenced resources
GET /Patient?_include=Patient:general-practitioner

# Search result modifiers
GET /Patient?name:exact=John
GET /Patient?birthdate:missing=true
```

**Implementation Example**:
```python
class FHIRSearch:
    async def search(
        self,
        resource_type: str,
        parameters: Dict[str, Any]
    ) -> SearchResult:
        query = select(FHIRResource).where(
            FHIRResource.resource_type == resource_type,
            FHIRResource.deleted.is_(False)
        )
        
        # Apply search parameters
        for param_name, param_value in parameters.items():
            if param_name.startswith("_"):
                query = self._apply_special_parameter(query, param_name, param_value)
            else:
                query = self._apply_search_parameter(query, param_name, param_value)
        
        # Execute with pagination
        return await self._execute_search(query, parameters)
```

### Storage Engine (storage.py)
**Purpose**: PostgreSQL-based FHIR resource persistence

**Database Schema**:
```sql
CREATE TABLE fhir_resources (
    id UUID PRIMARY KEY,
    resource_type VARCHAR(50),
    resource_id VARCHAR(64),
    version_id INTEGER,
    data JSONB,
    last_updated TIMESTAMP,
    deleted BOOLEAN DEFAULT FALSE,
    
    UNIQUE(resource_type, resource_id, version_id)
);

CREATE INDEX idx_resource_lookup ON fhir_resources(resource_type, resource_id);
CREATE INDEX idx_jsonb_data ON fhir_resources USING GIN(data);
CREATE INDEX idx_last_updated ON fhir_resources(last_updated);
```

**Storage Operations**:
```python
class FHIRStorage:
    async def create(self, resource_type: str, resource: dict) -> dict:
        # Generate ID and metadata
        resource_id = str(uuid.uuid4())
        version_id = 1
        
        # Add metadata
        resource["id"] = resource_id
        resource["meta"] = {
            "versionId": str(version_id),
            "lastUpdated": datetime.utcnow().isoformat()
        }
        
        # Store in database
        db_resource = FHIRResource(
            id=uuid.uuid4(),
            resource_type=resource_type,
            resource_id=resource_id,
            version_id=version_id,
            data=resource,
            last_updated=datetime.utcnow()
        )
        
        self.db.add(db_resource)
        await self.db.commit()
        
        # Index for searching
        await self.indexer.index_resource(resource_type, resource)
        
        return resource
```

### Search Indexer (search_indexer.py)
**Purpose**: Extract and index searchable parameters

**Indexing Strategy**:
```python
class SearchIndexer:
    def __init__(self):
        self.parameter_definitions = load_search_parameters()
    
    async def index_resource(self, resource_type: str, resource: dict):
        parameters = self.parameter_definitions.get(resource_type, {})
        
        for param_name, param_def in parameters.items():
            values = self.extract_parameter_values(resource, param_def)
            
            for value in values:
                await self.store_index_entry(
                    resource_type=resource_type,
                    resource_id=resource["id"],
                    parameter_name=param_name,
                    value=value
                )
```

**Search Parameter Extraction**:
```python
def extract_parameter_values(self, resource: dict, param_def: dict) -> List[Any]:
    path = param_def["expression"]
    param_type = param_def["type"]
    
    # FHIRPath evaluation
    values = evaluate_fhirpath(resource, path)
    
    # Type-specific processing
    if param_type == "string":
        return [self.normalize_string(v) for v in values]
    elif param_type == "token":
        return [self.extract_token(v) for v in values]
    elif param_type == "reference":
        return [self.extract_reference(v) for v in values]
    # ... other types
```

### Validation Layer (validator.py)
**Purpose**: FHIR resource validation and profile compliance

**Validation Levels**:
```python
class ValidationLevel(Enum):
    SYNTAX = "syntax"      # JSON structure
    SCHEMA = "schema"      # FHIR schema compliance
    PROFILE = "profile"    # Profile constraints
    BUSINESS = "business"  # Business rules
```

**Validation Implementation**:
```python
async def validate_resource(
    resource_type: str,
    resource: dict,
    level: ValidationLevel = ValidationLevel.SCHEMA
) -> OperationOutcome:
    outcome = OperationOutcome()
    
    # Syntax validation
    if not is_valid_json(resource):
        outcome.add_issue("error", "structure", "Invalid JSON")
        return outcome
    
    # Schema validation
    schema = load_fhir_schema(resource_type)
    errors = validate_against_schema(resource, schema)
    
    for error in errors:
        outcome.add_issue("error", "value", str(error))
    
    # Profile validation
    if level >= ValidationLevel.PROFILE:
        profile_errors = validate_against_profiles(resource)
        outcome.issues.extend(profile_errors)
    
    return outcome
```

## Advanced Features

### Batch Operations
```python
async def process_batch(bundle: dict) -> dict:
    results = []
    
    for entry in bundle.get("entry", []):
        request = entry.get("request", {})
        
        try:
            result = await route_request(
                method=request.get("method"),
                url=request.get("url"),
                resource=entry.get("resource")
            )
            results.append(create_success_entry(result))
        except Exception as e:
            results.append(create_error_entry(str(e)))
    
    return create_batch_response(results)
```

### Conditional Operations
```python
# Conditional create (POST with If-None-Exist)
POST /Patient
If-None-Exist: identifier=12345

# Conditional update (PUT with search parameters)
PUT /Patient?identifier=12345

# Conditional delete
DELETE /Patient?identifier=12345
```

### History Tracking
```python
async def get_resource_history(resource_type: str, resource_id: str) -> Bundle:
    versions = await self.db.execute(
        select(FHIRResource)
        .where(
            FHIRResource.resource_type == resource_type,
            FHIRResource.resource_id == resource_id
        )
        .order_by(FHIRResource.version_id.desc())
    )
    
    entries = []
    for version in versions:
        entries.append({
            "fullUrl": f"{resource_type}/{resource_id}/_history/{version.version_id}",
            "resource": version.data,
            "request": {
                "method": "GET",
                "url": f"{resource_type}/{resource_id}/_history/{version.version_id}"
            }
        })
    
    return create_history_bundle(entries)
```

## Integration Points

### Database Integration
- PostgreSQL with asyncpg
- JSONB for resource storage
- GIN indexes for search
- Transaction support

### Authentication/Authorization
- OAuth2 integration ready
- SMART on FHIR support
- Role-based access control
- Audit logging

### External Systems
- Terminology service integration
- External reference validation
- Subscription notifications
- Bulk data export

## Key Features

### Performance Optimization
- Connection pooling
- Query optimization
- Response caching
- Batch processing
- Async operations

### Scalability
- Horizontal scaling ready
- Database sharding support
- Load balancing compatible
- Stateless design

### Compliance
- FHIR R4 compliant
- US Core profile support
- Audit trail maintenance
- HIPAA considerations

## Educational Value

### FHIR Implementation
- RESTful API design
- FHIR resource lifecycle
- Search parameter handling
- Operation implementation
- Validation strategies

### Database Patterns
- JSONB usage
- Indexing strategies
- Transaction handling
- Version management
- Soft deletes

### API Design
- Error handling
- Response formatting
- Content negotiation
- Caching strategies
- Rate limiting

## Missing Features & Improvements

### Planned Enhancements
- GraphQL support
- Subscription implementation
- Bulk operations
- Patch support
- Custom search parameters

### Performance Improvements
- Query optimization
- Caching layer (Redis)
- Connection pooling
- Response compression
- CDN integration

### Compliance Features
- Provenance tracking
- Consent management
- Audit enhancements
- Security labels
- Compartment support

## Best Practices

### API Design
- Consistent error responses
- Proper HTTP status codes
- ETag support
- Content negotiation
- CORS handling

### Data Management
- Transactional integrity
- Soft delete pattern
- Version management
- Referential integrity
- Data migration support

### Security
- Input validation
- SQL injection prevention
- Rate limiting
- Authentication required
- Audit all operations

## Documentation and Infrastructure Resources

### Enhanced DocumentReference Support
**Complete FHIR R4 search parameter implementation with workflow integration**

**Enhanced Search Parameters**:
```python
# Core parameters
GET /DocumentReference?status=current
GET /DocumentReference?type=http://loinc.org|34133-9
GET /DocumentReference?category=clinical-note
GET /DocumentReference?patient=Patient/123

# Enhanced parameters (newly added)
GET /DocumentReference?facility=hospital-main
GET /DocumentReference?period=2023-01-01
GET /DocumentReference?relatesto=DocumentReference/456
GET /DocumentReference?security-label=restricted
GET /DocumentReference?content-format=application/pdf
GET /DocumentReference?content-size=gt1000000
```

**Workflow Integration**:
```python
# Create workflow-linked document
workflow_result = await storage.create_clinical_workflow(
    workflow_type="consultation",
    patient_ref="Patient/123",
    encounter_ref="Encounter/456",
    description="Cardiology consultation workflow"
)

# Links DocumentReference with Communication and Task resources
# - DocumentReference contains consultation notes
# - Communication handles notifications 
# - Task orchestrates workflow completion
```

### Communication Resource Implementation
**Complete threading and workflow notification capabilities**

**Threading Support**:
```python
# Parent communication
POST /Communication
{
  "status": "in-progress",
  "topic": {"text": "Patient care coordination"},
  "identifier": [{"value": "thread-001"}]
}

# Response communication with threading
POST /Communication  
{
  "status": "completed",
  "inResponseTo": [{"reference": "Communication/parent-123"}],
  "partOf": [{"reference": "Communication/thread-001"}]
}
```

**Search Capabilities**:
```python
# Find all communications in a thread
GET /Communication?part-of=Communication/thread-001

# Find responses to specific communication
GET /Communication?in-response-to=Communication/parent-123

# Search by participants
GET /Communication?sender=Practitioner/dr-smith
GET /Communication?recipient=Patient/123

# Search by workflow context
GET /Communication?about=DocumentReference/consultation-notes
```

### Task Resource Orchestration
**Comprehensive workflow management and business process support**

**Workflow Orchestration**:
```python
# Create coordinating task
POST /Task
{
  "status": "ready",
  "intent": "plan",
  "code": {"text": "Care coordination"},
  "for": {"reference": "Patient/123"},
  "focus": {"reference": "DocumentReference/care-plan"},
  "basedOn": [{"reference": "ServiceRequest/referral"}],
  "partOf": [{"reference": "Task/master-workflow"}]
}
```

**Advanced Search**:
```python
# Find tasks by workflow
GET /Task?based-on=ServiceRequest/referral
GET /Task?part-of=Task/master-workflow
GET /Task?focus=DocumentReference/care-plan

# Business status tracking
GET /Task?business-status=pending-review
GET /Task?status=in-progress&priority=high

# Date-based workflow queries  
GET /Task?authored-on=ge2023-01-01
GET /Task?modified=today
```

### Bundle Processing Enhancement
**Atomic transaction processing with rollback and performance optimization**

**Transaction Processing**:
```python
# Atomic workflow creation
POST /Bundle
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "request": {"method": "POST", "url": "DocumentReference"},
      "resource": {/* DocumentReference for workflow */}
    },
    {
      "request": {"method": "POST", "url": "Communication"},
      "resource": {/* Communication for notifications */}
    },
    {
      "request": {"method": "POST", "url": "Task"},
      "resource": {/* Task for orchestration */}
    }
  ]
}
```

**Enhanced Features**:
- ✅ Atomic transaction processing with full rollback
- ✅ Performance optimization for bulk operations
- ✅ Support for all Bundle types (transaction, batch, collection, searchset, history, document)
- ✅ Enhanced error reporting with detailed diagnostics
- ✅ Reference resolution within Bundle entries

### OperationOutcome Enhancement
**Detailed diagnostic generation with clinical context**

**Enhanced Diagnostics**:
```python
# Detailed validation errors
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "invalid",
      "details": {
        "text": "DocumentReference.status is required"
      },
      "diagnostics": "Resource validation failed: missing required field 'status' in DocumentReference",
      "expression": ["DocumentReference.status"],
      "location": ["line 15, column 3"]
    }
  ]
}
```

**Clinical Context Integration**:
- ✅ Resource-specific error messages
- ✅ Expression paths for precise error location  
- ✅ Clinical context in diagnostic messages
- ✅ Severity levels (fatal, error, warning, information)
- ✅ Integration with workflow validation

### Parameters Resource Support
**Comprehensive FHIR operation parameter handling**

**Extended Search Parameters**:
```python
# Parameter name and value searches
GET /Parameters?parameter=patient-id
GET /Parameters?value-string=Patient/123
GET /Parameters?value-boolean=true
GET /Parameters?value-integer=42

# Date and time parameter searches
GET /Parameters?value-date=2023-01-01
GET /Parameters?value-datetime=ge2023-01-01T00:00:00Z

# Complex parameter searches
GET /Parameters?value-reference=Patient/123
GET /Parameters?value-quantity=gt100
GET /Parameters?operation=validate
```

**Operation Context Support**:
```python
# Track operation parameters
POST /Parameters
{
  "parameter": [
    {
      "name": "resource",
      "valueReference": {"reference": "Patient/123"}
    },
    {
      "name": "mode", 
      "valueCode": "validate"
    }
  ],
  "meta": {
    "tag": [
      {
        "system": "http://hl7.org/fhir/operation",
        "code": "validate"
      }
    ]
  }
}
```

### Clinical Workflow Integration
**Orchestrated Document-Communication-Task workflows**

**Workflow Creation API**:
```python
# Create complete clinical workflow
async def create_consultation_workflow():
    workflow = await storage.create_clinical_workflow(
        workflow_type="consultation",
        patient_ref="Patient/123",
        encounter_ref="Encounter/456", 
        initiator_ref="Practitioner/dr-smith",
        description="Cardiology consultation with follow-up",
        priority="high"
    )
    
    # Returns:
    # {
    #   "workflow_id": "uuid-123",
    #   "resources": {
    #     "document": "DocumentReference/doc-456",
    #     "communication": "Communication/comm-789", 
    #     "task": "Task/task-101"
    #   }
    # }
```

**Workflow Management**:
```python
# Get all workflow resources
workflow_resources = await storage.get_workflow_resources("uuid-123")

# Update workflow status
await storage.update_workflow_status(
    "uuid-123", 
    "completed",
    "Consultation completed successfully"
)

# Link additional resources
await storage.link_workflow_resources(
    "Task", "task-101",
    "ServiceRequest", "follow-up-456", 
    "references"
)
```

**Workflow Search**:
```python
# Find all resources in workflow
GET /DocumentReference?identifier=http://example.org/clinical-workflow|uuid-123
GET /Communication?identifier=http://example.org/clinical-workflow|uuid-123  
GET /Task?identifier=http://example.org/clinical-workflow|uuid-123

# Cross-resource workflow queries
GET /Task?focus:DocumentReference.identifier=uuid-123
GET /Communication?about:Task.identifier=uuid-123
```

## Module Dependencies
```
FHIR API Module
├── Database Module (PostgreSQL)
├── Auth Module (OAuth2/JWT)
├── Validation Module (FHIR schemas)
├── Clinical Workflow Engine (NEW)
│   ├── Document Management
│   ├── Communication Threading
│   └── Task Orchestration
└── External Services
    ├── Terminology Server
    ├── Identity Provider
    └── Audit Service
```

## Testing Strategy
- Unit tests for each operation
- Integration tests with database
- API contract tests
- Performance tests
- Compliance test suite
- Comprehensive test harnesses for documentation/infrastructure resources
- SQL database validation framework for search parameter accuracy
- Clinical workflow orchestration testing

## Recent Updates

### 2025-07-15
- **Major Enhancement**: Comprehensive Documentation and Infrastructure resource support
- **Added**: Complete DocumentReference search parameters (category, facility, period, relatesto, security-label)
- **Added**: Full Communication resource with threading capabilities and workflow notifications
- **Added**: Complete Task resource with workflow orchestration and business process support
- **Enhanced**: Bundle processing with atomic transactions, rollback capability, and performance optimization
- **Enhanced**: OperationOutcome with detailed diagnostics, clinical context, and expression paths
- **Added**: Comprehensive Parameters resource search support for all FHIR data types
- **Added**: Clinical workflow integration with Document-Communication-Task orchestration
- **Added**: Extensive test harnesses and validation frameworks for infrastructure testing
- **Improved**: Search parameter extraction accuracy and database query performance
- **Enhanced**: Cross-resource workflow queries and reference resolution
- **Compliance**: Full FHIR R4 compliance for all enhanced resources and search parameters