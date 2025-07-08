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

## Module Dependencies
```
FHIR API Module
├── Database Module (PostgreSQL)
├── Auth Module (OAuth2/JWT)
├── Validation Module (FHIR schemas)
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