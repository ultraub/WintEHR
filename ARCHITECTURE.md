# MedGenEMR - FHIR-Native Architecture

## Overview

MedGenEMR is being redesigned as a fully FHIR-compliant Electronic Medical Record (EMR) system that uses FHIR R4 as its primary data model while extending it with EMR-specific functionality for workflows, UI state management, and operational features.

## Core Architecture Principles

1. **FHIR as Primary Data Model**: All clinical data is stored in FHIR-compliant format
2. **PostgreSQL with JSONB**: Leverages PostgreSQL's JSONB for flexible FHIR resource storage
3. **EMR Extensions**: Supplementary tables for workflows, UI state, auditing, and non-clinical operations
4. **API-First Design**: Everything accessible via FHIR APIs, with custom operations for EMR functions

## Database Architecture

### Schema Design

The database is organized into two primary schemas:

#### 1. FHIR Schema (`fhir`)

Stores all FHIR resources and related data:

- **resources**: Main table storing all FHIR resources as JSONB
- **resource_history**: Complete version history for all resources
- **search_params**: Extracted and indexed search parameters for fast querying
- **references**: Tracks references between resources for integrity

#### 2. EMR Schema (`emr`)

Extends FHIR with EMR-specific functionality:

- **users**: User management (links to FHIR Practitioner)
- **sessions**: Authentication and session management
- **workflows**: Clinical workflows and pathways
- **task_extensions**: Extends FHIR Task with UI state and assignments
- **audit_logs**: Comprehensive audit trail
- **ui_states**: User-specific UI state persistence
- **cds_rules**: Clinical decision support rules
- **templates**: Note templates, order sets, forms

### Key Design Decisions

1. **Single Table for All Resources**: Uses PostgreSQL table inheritance pattern with a single `resources` table
2. **JSONB Storage**: Complete FHIR resources stored as JSONB for flexibility
3. **Search Parameter Extraction**: Automated extraction and indexing of searchable values
4. **Reference Tracking**: Maintains referential integrity between FHIR resources

## API Architecture

### FHIR APIs (`/fhir/R4/*`)

Full FHIR R4 compliance including:

- **CRUD Operations**: `GET/POST/PUT/DELETE /{resourceType}/{id}`
- **Search**: `GET /{resourceType}?{parameters}` with full parameter support
- **Operations**: `POST /{resourceType}/${operation}`
- **Batch/Transaction**: `POST /` for bundle operations
- **History**: `GET /{resourceType}/{id}/_history`
- **Capabilities**: `GET /metadata` returns CapabilityStatement

### EMR Extension APIs (`/api/emr/*`)

EMR-specific functionality:

- **Authentication**: `/api/emr/auth/*` - Login, logout, session management
- **Workflow**: `/api/emr/workflow/*` - Clinical workflows, task management
- **UI State**: `/api/emr/ui/*` - UI state persistence, templates
- **Clinical Tools**: `/api/emr/clinical/*` - Note generation, decision support

## Service Architecture

```
backend/
├── core/
│   ├── fhir/
│   │   ├── storage.py          # FHIR resource storage engine
│   │   ├── search.py           # Search parameter handling
│   │   ├── validator.py        # FHIR validation using fhir.resources
│   │   └── operations.py       # FHIR operations implementation
│   ├── database/
│   │   ├── connection.py       # Database connection management
│   │   ├── migrations/         # Alembic migrations
│   │   └── indexes.py          # Search index management
│   └── security/
│       ├── auth.py             # Authentication logic
│       ├── permissions.py      # Role-based access control
│       └── audit.py            # Audit logging
├── fhir_api/
│   ├── resources/              # Resource-specific endpoints
│   ├── operations/             # Custom FHIR operations
│   └── router.py               # FHIR API routing
├── emr_api/
│   ├── workflow/               # Workflow management
│   ├── clinical/               # Clinical tools
│   ├── ui/                     # UI state management
│   └── router.py               # EMR API routing
├── services/
│   ├── search_indexer.py       # Async search parameter indexing
│   ├── reference_validator.py  # Reference integrity validation
│   ├── cds_engine.py          # Clinical decision support engine
│   └── terminology.py          # Terminology services
└── importers/
    └── synthea_fhir.py         # Direct FHIR bundle import
```

## Key Features

### 1. Search Implementation

- Full FHIR search parameter support including:
  - Chained parameters (e.g., `Patient?general-practitioner.name=Smith`)
  - Reverse chaining with `_has`
  - Search modifiers (`:exact`, `:contains`, `:above`, `:below`)
  - `_include` and `_revinclude` for resource inclusion
  - Composite search parameters

### 2. Resource Validation

- Uses `fhir.resources` library for strict FHIR validation
- Profile validation support
- Cardinality and required element checking

### 3. Clinical Decision Support

- Rule-based CDS engine
- Integrates with FHIR resources
- Real-time alerts and recommendations

### 4. Workflow Management

- FHIR Task-based workflow engine
- Custom workflow definitions
- UI state tracking

## Technology Stack

- **Database**: PostgreSQL 15+ with JSONB
- **Backend Framework**: FastAPI (async Python)
- **FHIR Library**: fhir.resources for validation
- **Search**: PostgreSQL full-text search + GIN indexes
- **Cache**: Redis for session and query caching
- **Message Queue**: RabbitMQ for async processing

## Migration from Previous Architecture

The system is being completely redesigned without concern for backwards compatibility. The migration strategy involves:

1. Creating new database with FHIR/EMR schemas
2. Re-importing all Synthea data as native FHIR bundles
3. Replacing all APIs with FHIR-compliant versions
4. Updating Clinical Canvas to work as a FHIR client

## Benefits

1. **True FHIR Compliance**: Native FHIR storage and APIs ensure interoperability
2. **Flexibility**: JSONB allows schema evolution without migrations
3. **Performance**: Indexed search parameters enable fast queries
4. **Scalability**: Can partition by resource type or date
5. **Maintainability**: Clean separation between FHIR and EMR concerns
6. **Interoperability**: Works with any FHIR client or server

## Frontend Architecture

The frontend is designed as a **FHIR-endpoint-agnostic client** that can work with any FHIR R4 compliant server:

### Design Principles

1. **FHIR-First Communication**: All clinical data operations use standard FHIR APIs
2. **Server Agnostic**: Frontend can point to any FHIR R4 endpoint
3. **EMR Extensions Optional**: EMR-specific features gracefully degrade if not available
4. **Configuration-Based**: FHIR endpoint and capabilities discovered via CapabilityStatement

### Implementation Strategy

```javascript
// Frontend service configuration
const fhirClient = new FHIRClient({
  baseUrl: process.env.FHIR_ENDPOINT || '/fhir/R4',
  auth: getAuthConfig(),
  
  // Discover server capabilities
  onReady: async (client) => {
    const capabilities = await client.request('metadata');
    configureFeatures(capabilities);
  }
});

// EMR extensions are optional
const emrClient = new EMRClient({
  baseUrl: process.env.EMR_API || '/api/emr',
  enabled: process.env.EMR_FEATURES !== 'false'
});
```

### Feature Separation

**FHIR-Only Features** (work with any FHIR server):
- Patient demographics and search
- Clinical documents (observations, conditions, procedures)
- Medication management
- Allergy tracking
- Care plans and goals
- Basic workflows using FHIR Task

**EMR Extension Features** (require our backend):
- Advanced workflow orchestration
- UI state persistence
- Clinical decision support rules
- Custom templates and forms
- Audit trails with extended metadata
- Real-time collaboration features

### Benefits

1. **Portability**: Frontend can be deployed against any FHIR server
2. **Interoperability**: Works with existing FHIR infrastructure
3. **Testing**: Can test against public FHIR sandboxes
4. **Gradual Adoption**: Organizations can start with basic FHIR features

## Future Enhancements

- GraphQL interface for FHIR
- Bulk data export (FHIR Bulk Data Access)
- Subscriptions for real-time updates
- Multi-tenancy support
- Advanced analytics with FHIR data warehouse
- SMART on FHIR app platform support