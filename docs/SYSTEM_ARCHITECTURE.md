# WintEHR System Architecture

**Educational Healthcare IT Platform**
**Last Updated**: November 2025
**Version**: 1.1.0

---

## 🎓 Educational Purpose

> **⚠️ IMPORTANT**: This is an educational platform for learning healthcare IT concepts. This documentation describes a system designed for synthetic patient data only - **NEVER use with real Protected Health Information (PHI)**.

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Component Details](#component-details)
4. [Data Flow](#data-flow)
5. [Network Architecture](#network-architecture)
6. [Deployment Modes](#deployment-modes)
7. [Technology Stack](#technology-stack)
8. [Integration Points](#integration-points)

---

## System Overview

WintEHR is a complete, FHIR-native Electronic Health Record system built on a modern microservices architecture. It demonstrates production-grade healthcare IT patterns while remaining accessible for learning and experimentation.

### Core Principles

- **FHIR R4 Native**: All clinical data stored as FHIR resources
- **Async-First**: Non-blocking I/O throughout the stack
- **Microservices**: Independent, scalable components
- **Container-Based**: Docker orchestration for consistent deployment
- **Real-Time**: WebSocket integration for live clinical events
- **Educational**: Clear separation of concerns, extensive documentation

### Key Capabilities

- 38+ FHIR resource types with full CRUD operations
- Complete clinical workflows (orders, pharmacy, imaging, results)
- CDS Hooks 2.0 clinical decision support
- Automated DICOM medical imaging generation
- Real-time clinical event streaming
- FHIR Explorer with visual query builder

---

## Architecture Diagram

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         External Layer                               │
│                                                                       │
│  User Browser ──► HTTPS ──► Let's Encrypt SSL (Production)          │
│                             │                                         │
│                             ▼                                         │
│                      ┌──────────────┐                                │
│                      │    Nginx     │  Port 80/443                   │
│                      │   (Reverse   │  - SSL Termination             │
│                      │    Proxy)    │  - Static Asset Caching        │
│                      │              │  - Rate Limiting               │
│                      │              │  - Security Headers            │
│                      └──────┬───────┘                                │
└─────────────────────────────┼─────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────────┐
│                    Application Layer                                  │
│                              │                                         │
│        ┌─────────────────────┼─────────────────────┐                  │
│        │                     ▼                     │                  │
│  ┌─────▼─────┐        ┌─────────────┐      ┌─────▼────────┐         │
│  │ Frontend  │◄──────►│   Backend   │◄────►│  HAPI FHIR   │         │
│  │  (React)  │        │  (FastAPI)  │      │  JPA Server  │         │
│  │           │  HTTP  │             │ HTTP │   (Java)     │         │
│  │ Port 3000 │        │ Port 8000   │      │  Port 8888   │         │
│  │           │        │             │      │              │         │
│  │ • React 18│        │ • FastAPI   │      │ • FHIR R4    │         │
│  │ • MUI 5   │        │ • Python 3.9│      │ • Search     │         │
│  │ • TypeScript       │ • Async/Await      │ • Validation │         │
│  │ • WebSocket│        │ • WebSocket │      │ • Versioning │         │
│  │ • DICOM    │        │ • CDS Hooks │      │              │         │
│  │   Viewer   │        │ • JWT Auth  │      │              │         │
│  └────────────┘        └──────┬──────┘      └──────┬───────┘         │
│                               │                     │                 │
│                               │                     │                 │
└───────────────────────────────┼─────────────────────┼─────────────────┘
                                │                     │
┌───────────────────────────────┼─────────────────────┼─────────────────┐
│                        Data Layer                   │                 │
│                                │                     │                 │
│                         ┌──────▼─────────────────────▼───────┐        │
│                         │      PostgreSQL 15                 │        │
│                         │      Port 5432                      │        │
│                         │                                     │        │
│                         │  ┌──────────────────────────────┐  │        │
│                         │  │   HAPI FHIR Schema           │  │        │
│                         │  │   (100+ tables)              │  │        │
│                         │  │   • hfj_resource             │  │        │
│                         │  │   • hfj_spidx_* (indexes)    │  │        │
│                         │  │   • hfj_res_link             │  │        │
│                         │  │   • hfj_res_tag              │  │        │
│                         │  └──────────────────────────────┘  │        │
│                         │                                     │        │
│                         │  ┌──────────────────────────────┐  │        │
│                         │  │   Clinical Workflow Tables   │  │        │
│                         │  │   • clinical_notes           │  │        │
│                         │  │   • orders                   │  │        │
│                         │  │   • tasks                    │  │        │
│                         │  │   • clinical_catalogs        │  │        │
│                         │  └──────────────────────────────┘  │        │
│                         └─────────────────────────────────────┘        │
│                                                                         │
│                         ┌─────────────────────────────┐                │
│                         │       Redis 7                │                │
│                         │       Port 6379              │                │
│                         │                              │                │
│                         │   • Session Storage          │                │
│                         │   • FHIR Response Cache      │                │
│                         │   • WebSocket State          │                │
│                         │   • Rate Limit Counters      │                │
│                         │   LRU: 256MB max             │                │
│                         └─────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────────────┐
                         │    emr-network (Bridge)     │
                         │    All containers connected │
                         └─────────────────────────────┘
```

### Request Flow Diagram

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ HTTPS (443) or HTTP (80)
       ▼
┌──────────────┐
│    Nginx     │
│ Rate Limit   │──► Security Headers
│ SSL Term     │──► Static Caching
└──────┬───────┘
       │
       ├─────► /api/* ────────────┐
       │                          ▼
       │                   ┌──────────────┐
       │                   │   Backend    │
       │                   │   FastAPI    │
       │                   └──────┬───────┘
       │                          │
       │                          ├─► GET/POST to HAPI FHIR
       │                          ├─► Redis Cache Check
       │                          ├─► PostgreSQL Direct
       │                          ├─► WebSocket Events
       │                          └─► CDS Hooks Processing
       │
       ├─────► /fhir/* ───────────┐
       │                          ▼
       │                   ┌──────────────┐
       │                   │  HAPI FHIR   │
       │                   │  JPA Server  │
       │                   └──────┬───────┘
       │                          │
       │                          ├─► PostgreSQL (hfj_* tables)
       │                          ├─► Search Parameter Indexing
       │                          └─► FHIR Resource Validation
       │
       └─────► / (root) ──────────┐
                                  ▼
                          ┌──────────────┐
                          │   Frontend   │
                          │   React App  │
                          └──────────────┘
                                  │
                                  ├─► Static HTML/JS/CSS
                                  ├─► Client-side Routing
                                  └─► WebSocket Connection
```

---

## Component Details

### 1. Frontend (React Application)

**Purpose**: User interface for all clinical workflows and FHIR interactions

**Technology Stack**:
- React 18.2 with functional components and hooks
- Material-UI (MUI) 5.18 for UI components
- TypeScript 4.9 for type safety
- Axios 1.4 for HTTP requests
- Cornerstone.js for DICOM medical imaging viewer
- Chart.js and Recharts for data visualization

**Container**: `emr-frontend`
**Port**: 3000
**Build**: Multi-stage Docker build with nginx serving static files

**Key Features**:
- **Patient Portal**: Search, selection, and demographics
- **Clinical Modules**:
  - Chart Review (problems, medications, allergies, vitals)
  - Orders & Results (CPOE, lab results, trending)
  - Pharmacy (prescription management, dispensing)
  - Imaging (DICOM viewer with multi-modality support)
- **FHIR Explorer v4**: Interactive FHIR resource browser and query builder
- **Real-time Updates**: WebSocket integration for live clinical events
- **Design System**: Comprehensive clinical UI component library

**Environment Variables**:
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_FHIR_URL=http://localhost:8888/fhir
REACT_APP_FHIR_ENDPOINT=http://localhost:8000/fhir/R4
```

**Directory Structure**:
```
frontend/src/
├── components/
│   ├── clinical/      # Clinical UI components
│   ├── fhir/         # FHIR Explorer components
│   └── ui/           # General UI components
├── contexts/         # React context providers
│   ├── PatientContext.js
│   ├── ClinicalWorkflowContext.js
│   └── WebSocketContext.js
├── core/fhir/
│   └── services/
│       └── fhirClient.js  # FHIR R4 client
├── services/         # Business logic services
├── hooks/            # Custom React hooks
└── pages/            # Page components
```

**Communication Patterns**:
- REST API calls to Backend via Axios
- WebSocket connection for real-time events
- Direct FHIR API calls for resource operations
- State management via React Context API

---

### 2. Backend (FastAPI Application)

**Purpose**: Business logic layer, FHIR proxy, and clinical workflow orchestration

**Technology Stack**:
- FastAPI 0.104+ (async Python web framework)
- Python 3.9+ with async/await
- SQLAlchemy 2.0+ (async ORM)
- Pydantic 2.5+ (data validation)
- WebSockets 12.0 (real-time connections)
- HTTPX 0.25 (async HTTP client)

**Container**: `emr-backend`
**Port**: 8000
**Runtime**: Uvicorn with hot reload in development

**Key Features**:
- **FHIR Proxy**: Intelligent proxy to HAPI FHIR with caching
- **Clinical Workflows**: Custom endpoints for orders, pharmacy, results
- **CDS Hooks 2.0**: Clinical decision support integration
- **WebSocket Server**: Real-time clinical event broadcasting
- **Authentication**: JWT-based auth (educational mode available)
- **Catalog Management**: Dynamic clinical catalogs (medications, labs, conditions)
- **DICOM Generation**: Automated DICOM image generation from FHIR ImagingStudy resources

**Environment Variables**:
```bash
DATABASE_URL=postgresql+asyncpg://emr_user:password@postgres:5432/emr_db
REDIS_URL=redis://redis:6379/0
HAPI_FHIR_URL=http://hapi-fhir:8080/fhir
JWT_ENABLED=false  # Development mode
USE_REDIS_CACHE=true
```

**API Endpoints Structure**:
```
/api/
├── auth/              # Authentication endpoints
├── clinical/          # Clinical workflow endpoints
│   ├── orders/       # Order management
│   ├── pharmacy/     # Pharmacy workflows
│   └── results/      # Results and reports
├── cds-hooks/        # CDS Hooks services
├── catalogs/         # Clinical catalog APIs
├── imaging/          # Medical imaging services
├── fhir/             # FHIR proxy endpoints
└── websocket/        # WebSocket connections

/docs                 # Swagger UI documentation
/redoc                # ReDoc documentation
/health               # Health check endpoint
```

**Database Access Patterns**:
1. **FHIR Resources**: Proxied to HAPI FHIR server (does NOT access hfj_* tables directly)
2. **Clinical Workflows**: Direct PostgreSQL access for custom tables
3. **Caching**: Redis for FHIR response caching and session storage

**Example Backend Patterns**:
```python
# FHIR Proxy Pattern
@router.get("/fhir/R4/Patient/{patient_id}")
async def get_patient(patient_id: str):
    """Proxy to HAPI FHIR with caching"""
    # Check cache first
    cached = await redis.get(f"patient:{patient_id}")
    if cached:
        return json.loads(cached)

    # Fetch from HAPI FHIR
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{HAPI_FHIR_URL}/Patient/{patient_id}")
        data = response.json()

    # Cache for future requests
    await redis.setex(f"patient:{patient_id}", 3600, json.dumps(data))
    return data
```

---

### 3. HAPI FHIR JPA Server

**Purpose**: Industry-standard FHIR R4 server for healthcare data storage

**Technology Stack**:
- Java-based HAPI FHIR JPA Server (latest version)
- Spring Boot framework
- Hibernate JPA for persistence
- PostgreSQL dialect for database

**Container**: `emr-hapi-fhir`
**Port**: 8888 (mapped to internal 8080)
**Image**: `hapiproject/hapi:latest`

**Key Features**:
- **FHIR R4 Compliance**: Full FHIR R4 specification support
- **Search Parameters**: Automatic indexing of search parameters
- **Resource Versioning**: Complete version history tracking
- **Validation**: FHIR resource validation against profiles
- **Subscriptions**: FHIR subscription support
- **Cascading Deletes**: Safe resource deletion with cascading

**Configuration**:
```yaml
hapi.fhir.fhir_version: R4
hapi.fhir.server_address: http://localhost:8080/fhir
hapi.fhir.allow_external_references: true
hapi.fhir.allow_multiple_delete: true
hapi.fhir.allow_cascading_deletes: true
hapi.fhir.cors.allowed_origin: "*"
hapi.fhir.default_page_size: 20
hapi.fhir.max_page_size: 500
```

**Database Schema**:
HAPI FHIR uses 100+ tables for complete FHIR functionality:

**Core Tables**:
- `hfj_resource` - Main resource storage with JSON/XML content
- `hfj_res_ver` - Complete version history
- `hfj_forced_id` - Custom resource IDs

**Search Index Tables** (automatic indexing):
- `hfj_spidx_string` - String search parameters
- `hfj_spidx_token` - Token/code search parameters
- `hfj_spidx_date` - Date/DateTime search parameters
- `hfj_spidx_number` - Numeric search parameters
- `hfj_spidx_quantity` - Quantity search parameters
- `hfj_spidx_coords` - Geolocation search parameters
- `hfj_spidx_uri` - URI search parameters

**Relationship Tables**:
- `hfj_res_link` - Resource references and relationships
- `hfj_res_tag` - Tags, security labels, and profiles
- `hfj_idx_cmb_tok_nu` - Composite search parameter indexes
- `hfj_idx_cmp_string_uniq` - Unique composite indexes

**Operations Supported**:
- `GET /fhir/Patient/123` - Read single resource
- `POST /fhir/Patient` - Create resource
- `PUT /fhir/Patient/123` - Update resource
- `DELETE /fhir/Patient/123` - Delete resource
- `GET /fhir/Patient?name=Smith` - Search with parameters
- `GET /fhir/Patient/123/_history` - Version history
- `POST /fhir/Patient/$validate` - Validate resource
- `GET /fhir/metadata` - Server capability statement

**Why HAPI FHIR?**:
- Industry-standard, production-grade FHIR server
- Handles all FHIR search parameters automatically
- Manages resource versioning and validation
- Provides complete FHIR R4 compliance
- Used by major healthcare organizations worldwide

---

### 4. PostgreSQL Database

**Purpose**: Persistent storage for FHIR resources and clinical workflow data

**Technology Stack**:
- PostgreSQL 15 Alpine
- pgcrypto extension
- pg_trgm extension for fuzzy search

**Container**: `emr-postgres`
**Port**: 5432
**Database**: `emr_db`

**Schema Organization**:

**HAPI FHIR Schema** (100+ tables, auto-managed by HAPI):
- Stores all FHIR resources as structured data
- Automatic search parameter indexing
- Version history and audit trail
- Full-text search capabilities
- Reference integrity management

**Clinical Workflow Schema** (custom tables):
```sql
-- Clinical notes with rich text
clinical_notes (
    id, patient_id, encounter_id, note_type,
    note_text, author_id, created_at
)

-- Order management
orders (
    id, patient_id, order_type, status,
    ordered_by, order_date, catalog_item_id
)

-- Task tracking
tasks (
    id, patient_id, task_type, status,
    assigned_to, due_date, priority
)

-- Clinical catalogs (medications, labs, conditions)
clinical_catalogs (
    id, catalog_type, code, display_name,
    system, description, is_active
)
```

**Performance Optimizations**:
- Connection pooling (20-30 connections)
- Indexed foreign keys
- Partial indexes for active records
- Materialized views for reporting
- Automatic vacuum and analyze

**Backup Strategy**:
```bash
# Volume persistence
volumes:
  postgres_data:
    driver: local

# Regular backups (production)
pg_dump emr_db > backup_$(date +%Y%m%d).sql
```

---

### 5. Redis Cache

**Purpose**: High-performance caching and session management

**Technology Stack**:
- Redis 7 Alpine
- LRU eviction policy
- Hiredis for performance

**Container**: `emr-redis`
**Port**: 6379
**Memory**: 256MB maximum

**Configuration**:
```bash
maxmemory 256mb
maxmemory-policy allkeys-lru
```

**Use Cases**:

1. **FHIR Response Caching**:
```python
# Cache frequently accessed patients
key = f"fhir:patient:{patient_id}"
ttl = 3600  # 1 hour

# Set
await redis.setex(key, ttl, json.dumps(patient_data))

# Get
cached = await redis.get(key)
```

2. **Session Storage**:
```python
# User session
session_key = f"session:{user_id}"
session_data = {"user": user_id, "role": "clinician"}
await redis.setex(session_key, 86400, json.dumps(session_data))
```

3. **Rate Limiting**:
```python
# API rate limiting
limit_key = f"ratelimit:{user_id}:{endpoint}"
count = await redis.incr(limit_key)
if count == 1:
    await redis.expire(limit_key, 60)  # 1 minute window
if count > 100:
    raise HTTPException(status_code=429, detail="Rate limit exceeded")
```

4. **WebSocket State**:
```python
# Track connected clients
await redis.sadd("ws:connected", connection_id)
await redis.srem("ws:connected", connection_id)
```

**Cache Invalidation**:
- Time-based expiration (TTL)
- Event-based invalidation (on resource updates)
- Manual invalidation via admin API

---

### 6. Nginx Reverse Proxy

**Purpose**: Entry point for all HTTP traffic with SSL, routing, and security

**Technology Stack**:
- Nginx Alpine
- Let's Encrypt for SSL (production)
- Rate limiting and security headers

**Container**: `emr-nginx` (production only)
**Ports**: 80 (HTTP), 443 (HTTPS)

**Development vs Production**:

**Development** (`nginx.conf`):
- HTTP only (port 80)
- No SSL
- Direct container access
- Minimal security headers

**Production** (`nginx-prod.conf`):
- HTTPS with Let's Encrypt SSL
- HTTP → HTTPS redirect
- Rate limiting
- Full security headers
- Gzip compression

**Routing Rules**:
```nginx
# Frontend (React app)
location / {
    proxy_pass http://frontend:80;
}

# Backend API
location /api/ {
    proxy_pass http://backend:8000;
    limit_req zone=api_limit burst=20;
}

# HAPI FHIR Server
location /fhir/ {
    proxy_pass http://hapi-fhir:8080/fhir/;
    limit_req zone=api_limit burst=30;
}

# API Documentation
location /docs {
    proxy_pass http://backend:8000;
}
```

**Security Headers** (Production):
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

**Rate Limiting**:
```nginx
# API endpoints: 10 requests/second
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# General traffic: 100 requests/second
limit_req_zone $binary_remote_addr zone=general_limit:10m rate=100r/s;
```

**SSL Configuration** (Production with Let's Encrypt):
```nginx
ssl_certificate /etc/letsencrypt/live/wintehr.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/wintehr.example.com/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

---

## Data Flow

### 1. Patient Data Retrieval Flow

```
User clicks "Search Patient" in Browser
    │
    ├─► Frontend sends GET /api/fhir/R4/Patient?name=Smith
    │
    ├─► Nginx receives request, applies rate limit
    │
    ├─► Backend FastAPI receives request
    │   │
    │   ├─► Check Redis cache: "fhir:patient:search:Smith"
    │   │   └─► Cache HIT → Return cached results (fast path)
    │   │
    │   └─► Cache MISS → Continue to HAPI FHIR
    │
    ├─► Backend proxies to HAPI FHIR: GET /fhir/Patient?name=Smith
    │
    ├─► HAPI FHIR Server
    │   │
    │   ├─► Query PostgreSQL hfj_spidx_string table for name search
    │   ├─► Retrieve matching resource IDs from hfj_resource table
    │   ├─► Build FHIR Bundle response
    │   └─► Return Bundle to Backend
    │
    ├─► Backend caches results in Redis (TTL: 1 hour)
    │
    ├─► Backend returns FHIR Bundle to Frontend
    │
    └─► Frontend displays patient list with MUI DataGrid
```

### 2. Creating a Lab Order Flow

```
Clinician fills out lab order form
    │
    ├─► Frontend POST /api/clinical/orders
    │   {
    │     patient_id: "123",
    │     order_type: "lab",
    │     catalog_item_id: "LOINC-12345",
    │     priority: "routine"
    │   }
    │
    ├─► Backend validates order request (Pydantic model)
    │
    ├─► Backend business logic:
    │   │
    │   ├─► Check patient exists via HAPI FHIR
    │   ├─► Verify ordering privileges
    │   ├─► Create ServiceRequest FHIR resource
    │   └─► POST to HAPI FHIR: /fhir/ServiceRequest
    │
    ├─► HAPI FHIR stores ServiceRequest:
    │   │
    │   ├─► Insert into hfj_resource table (resource content)
    │   ├─► Index search parameters (status, code, patient, date)
    │   ├─► Create reference links in hfj_res_link
    │   └─► Return created resource with ID
    │
    ├─► Backend creates workflow record:
    │   │
    │   └─► INSERT into orders table (PostgreSQL)
    │
    ├─► Backend broadcasts WebSocket event:
    │   │
    │   └─► ws.broadcast("ORDER_CREATED", {order_id, patient_id})
    │
    ├─► Backend invalidates relevant Redis cache entries
    │
    ├─► Backend returns success response to Frontend
    │
    └─► Frontend updates UI and shows success notification
    │
    └─► WebSocket listener in Results tab receives event
        └─► Auto-refreshes results list
```

### 3. DICOM Image Viewing Flow

```
User clicks "View Imaging" for patient
    │
    ├─► Frontend GET /api/fhir/R4/ImagingStudy?patient=Patient/123
    │
    ├─► Backend proxies to HAPI FHIR
    │
    ├─► HAPI FHIR searches ImagingStudy resources
    │   │
    │   └─► Returns FHIR Bundle with ImagingStudy resources
    │
    ├─► Frontend displays study list
    │
    ├─► User clicks "View Images" for specific study
    │
    ├─► Frontend requests DICOM generation (if not exists):
    │   │
    │   └─► POST /api/imaging/generate-dicom/{study_id}
    │
    ├─► Backend DICOM generation:
    │   │
    │   ├─► Fetch ImagingStudy from HAPI FHIR
    │   ├─► Generate realistic synthetic DICOM files (PyDICOM)
    │   │   └─► Creates .dcm files with proper headers and pixel data
    │   └─► Store in /data/generated_dicoms/{study_id}/
    │
    ├─► Frontend loads DICOM viewer (Cornerstone.js)
    │   │
    │   └─► GET /api/imaging/dicom/{study_id}/{instance_id}
    │
    ├─► Backend streams DICOM file
    │
    └─► Cornerstone renders DICOM image with:
        ├─► Windowing controls
        ├─► Multi-slice navigation
        ├─► Measurement tools
        └─► Zoom and pan
```

### 4. CDS Hooks Alert Flow

```
Clinician prescribes medication
    │
    ├─► Frontend POST /api/clinical/medications
    │
    ├─► Backend CDS Hooks trigger:
    │   │
    │   ├─► POST /cds-services/medication-interaction-check
    │   │   {
    │   │     context: {
    │   │       patientId: "123",
    │   │       medications: [{code: "RxNorm-12345"}]
    │   │     }
    │   │   }
    │   │
    │   ├─► CDS Hook Service:
    │   │   │
    │   │   ├─► Fetch patient's active medications from HAPI FHIR
    │   │   ├─► Check drug interaction database
    │   │   ├─► Evaluate business rules
    │   │   └─► Return cards with alerts/suggestions
    │   │
    │   └─► Returns CDS Hooks response:
    │       {
    │         cards: [
    │           {
    │             summary: "Drug Interaction Warning",
    │             indicator: "warning",
    │             detail: "Interaction between Drug A and Drug B"
    │           }
    │         ]
    │       }
    │
    ├─► Backend creates MedicationRequest in HAPI FHIR
    │
    └─► Frontend displays CDS alert modal
        └─► Clinician acknowledges or modifies order
```

---

## Network Architecture

### Docker Network Configuration

**Network**: `emr-network` (Bridge driver)

**Container Communication**:
```
All containers connected to emr-network:
├─ emr-frontend (frontend:80)
├─ emr-backend (backend:8000)
├─ emr-hapi-fhir (hapi-fhir:8080)
├─ emr-postgres (postgres:5432)
├─ emr-redis (redis:6379)
└─ emr-nginx (nginx:80/443) [Production only]
```

**Service Discovery**: Docker DNS resolution
```python
# Backend can access HAPI FHIR by service name
HAPI_FHIR_URL = "http://hapi-fhir:8080/fhir"

# Database connection
DATABASE_URL = "postgresql+asyncpg://emr_user:password@postgres:5432/emr_db"

# Redis connection
REDIS_URL = "redis://redis:6379/0"
```

### Port Mapping

**External Access** (from host machine):
```
http://localhost:3000  → Frontend React app
http://localhost:8000  → Backend API
http://localhost:8888  → HAPI FHIR server
http://localhost:5432  → PostgreSQL (database clients)
http://localhost:6379  → Redis (redis-cli)
```

**Internal Communication** (within Docker network):
```
frontend:80         → Nginx serving React build
backend:8000        → FastAPI Uvicorn server
hapi-fhir:8080      → HAPI FHIR JPA Server
postgres:5432       → PostgreSQL database
redis:6379          → Redis cache
```

### Health Checks

All services have health checks for orchestration:

```yaml
# PostgreSQL health check
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U emr_user -d emr_db"]
  interval: 15s
  timeout: 10s
  retries: 10

# Redis health check
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5

# HAPI FHIR health check
healthcheck:
  test: ["CMD-SHELL", "curl -f http://localhost:8080/fhir/metadata || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

**Startup Order** (via depends_on with health checks):
```
1. PostgreSQL (wait until healthy)
2. Redis (wait until healthy)
3. HAPI FHIR (depends on PostgreSQL)
4. Backend (depends on PostgreSQL, Redis)
5. Frontend (depends on Backend)
6. Nginx (depends on Frontend, Backend) [Production only]
```

---

## Deployment Modes

### Development Mode

**Configuration**: `config.yaml` with `environment: dev`

**Characteristics**:
- HTTP only (no SSL)
- JWT authentication disabled
- Demo users enabled (demo/password, nurse/password)
- Hot reload enabled for backend and frontend
- 20 synthetic patients with basic DICOM
- Direct container port access (no nginx)
- Detailed logging and debugging

**Services Running**:
```
✓ emr-postgres (PostgreSQL 15)
✓ emr-redis (Redis 7)
✓ emr-hapi-fhir (HAPI FHIR)
✓ emr-backend (FastAPI with reload)
✓ emr-frontend (React dev server)
✗ emr-nginx (not used in dev)
```

**Deployment**:
```bash
cp config.example.yaml config.yaml
# Edit: environment: dev, enable_ssl: false, patient_count: 20
./deploy.sh
```

**Access**:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **HAPI FHIR**: http://localhost:8888/fhir
- **PostgreSQL**: localhost:5432 (via pgAdmin or psql)

---

### Production Mode (Azure)

**Configuration**: `config.azure-prod.yaml`

**Characteristics**:
- HTTPS with Let's Encrypt SSL certificates
- JWT authentication required
- 100+ synthetic patients with comprehensive DICOM
- Nginx reverse proxy for all traffic
- Rate limiting and security headers
- Production logging and monitoring
- Automated deployment with server wipe

**Services Running**:
```
✓ emr-postgres (PostgreSQL 15)
✓ emr-redis (Redis 7)
✓ emr-hapi-fhir (HAPI FHIR)
✓ emr-backend (FastAPI production)
✓ emr-frontend (Nginx serving static build)
✓ emr-nginx (Reverse proxy with SSL)
```

**Infrastructure**:
- **Cloud**: Azure VM (Standard_D4s_v3 recommended)
- **OS**: Ubuntu 22.04 LTS
- **Domain**: Azure CloudApp DNS (e.g., wintehr.eastus2.cloudapp.azure.com)
- **SSL**: Let's Encrypt automatic certificate
- **Firewall**: Azure NSG with ports 80, 443, 22 open

**Deployment**:
```bash
# One-command automated deployment
cp config.azure-prod.yaml config.yaml
# Edit: Set domain, Azure details
./deploy-azure-production.sh --yes

# What this does:
# 1. Wipes server completely (fresh start)
# 2. Clones latest code from GitHub
# 3. Builds Docker images (backend + frontend)
# 4. Deploys all services with health checks
# 5. Generates 100+ synthetic patients with DICOM
# 6. Obtains Let's Encrypt SSL certificate
# 7. Configures nginx with HTTPS
# 8. Verifies deployment success
```

**Access**:
- **Frontend**: https://your-domain.cloudapp.azure.com
- **Backend API**: https://your-domain.cloudapp.azure.com/api
- **API Docs**: https://your-domain.cloudapp.azure.com/docs
- **HAPI FHIR**: https://your-domain.cloudapp.azure.com/fhir

**Total Deployment Time**: ~25-30 minutes

---

## Technology Stack

### Complete Technology Matrix

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** |
| Framework | React | 18.2 | UI library |
| UI Components | Material-UI | 5.18 | Design system |
| Language | TypeScript | 4.9 | Type safety |
| State Management | React Context | - | Global state |
| HTTP Client | Axios | 1.4 | API requests |
| Routing | React Router | 6.11 | Client routing |
| DICOM Viewer | Cornerstone.js | 2.6 | Medical imaging |
| Charts | Chart.js, Recharts | - | Data viz |
| Build Tool | CRACO | 7.1 | CRA config |
| **Backend** |
| Framework | FastAPI | 0.104+ | Web framework |
| Language | Python | 3.9+ | Backend language |
| ASGI Server | Uvicorn | 0.24+ | Async server |
| ORM | SQLAlchemy | 2.0+ | Database ORM |
| Validation | Pydantic | 2.5+ | Data validation |
| HTTP Client | HTTPX | 0.25 | Async HTTP |
| WebSocket | websockets | 12.0 | Real-time |
| FHIR | fhir.resources | 7.1 | FHIR validation |
| DICOM | PyDICOM | 2.4 | Medical imaging |
| Testing | Pytest | 7.4 | Test framework |
| **FHIR Server** |
| FHIR Server | HAPI FHIR | Latest | FHIR R4 server |
| Language | Java | 17+ | JVM runtime |
| Framework | Spring Boot | - | Application framework |
| ORM | Hibernate JPA | - | Persistence |
| **Database** |
| RDBMS | PostgreSQL | 15 | Primary database |
| Cache | Redis | 7 | Caching layer |
| **Infrastructure** |
| Container | Docker | 20.10+ | Containerization |
| Orchestration | Docker Compose | 2.0+ | Multi-container |
| Reverse Proxy | Nginx | Alpine | Web server |
| SSL | Let's Encrypt | - | TLS certificates |
| Data Gen | Synthea | 3.2.0 | Synthetic patients |

---

## Integration Points

### 1. Frontend ↔ Backend

**Communication Method**: REST API over HTTP/HTTPS

**Authentication**: JWT tokens (production) or demo mode (development)

**Request Pattern**:
```javascript
// Frontend (React)
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

// Get patient data
const response = await axios.get(`${API_URL}/api/fhir/R4/Patient/123`, {
  headers: {
    'Authorization': `Bearer ${jwtToken}`
  }
});
```

**WebSocket Integration**:
```javascript
// Frontend establishes WebSocket connection
const ws = new WebSocket('ws://localhost:8000/ws/clinical-events');

ws.onmessage = (event) => {
  const clinicalEvent = JSON.parse(event.data);
  // Update UI based on event
};
```

---

### 2. Backend ↔ HAPI FHIR

**Communication Method**: HTTP REST API (FHIR R4 standard)

**Pattern**: Backend acts as intelligent proxy

**Request Flow**:
```python
# Backend proxies FHIR requests to HAPI FHIR
import httpx

HAPI_FHIR_URL = "http://hapi-fhir:8080/fhir"

async def get_patient(patient_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{HAPI_FHIR_URL}/Patient/{patient_id}"
        )
        return response.json()
```

**Why Proxy?**:
- Add business logic and validation
- Implement caching layer (Redis)
- Enforce authentication and authorization
- Broadcast real-time events
- Custom clinical workflows

---

### 3. HAPI FHIR ↔ PostgreSQL

**Communication Method**: JDBC connection (Java database connectivity)

**Configuration**:
```yaml
spring.datasource.url: jdbc:postgresql://postgres:5432/emr_db
spring.datasource.username: emr_user
spring.datasource.password: emr_password
spring.datasource.driverClassName: org.postgresql.Driver
spring.jpa.properties.hibernate.dialect: ca.uhn.fhir.jpa.model.dialect.HapiFhirPostgres94Dialect
```

**Schema Management**:
- HAPI FHIR automatically creates and maintains its schema
- Uses Hibernate JPA auto-DDL
- Tables prefixed with `hfj_*`

---

### 4. Backend ↔ Redis

**Communication Method**: Redis protocol (RESP)

**Use Cases**:
```python
import redis.asyncio as redis

redis_client = redis.from_url("redis://redis:6379/0")

# FHIR response caching
await redis_client.setex(
    f"fhir:patient:{patient_id}",
    3600,  # 1 hour TTL
    json.dumps(patient_data)
)

# Session management
await redis_client.setex(
    f"session:{user_id}",
    86400,  # 24 hours
    json.dumps(session_data)
)

# Rate limiting
count = await redis_client.incr(f"ratelimit:{ip}:{endpoint}")
if count == 1:
    await redis_client.expire(f"ratelimit:{ip}:{endpoint}", 60)
```

---

### 5. Nginx ↔ Services (Production)

**Communication Method**: HTTP proxy with upstream configuration

**Routing Logic**:
```nginx
# Route to frontend container
location / {
    proxy_pass http://frontend:80;
}

# Route to backend API
location /api/ {
    proxy_pass http://backend:8000;
}

# Route to HAPI FHIR
location /fhir/ {
    proxy_pass http://hapi-fhir:8080/fhir/;
}
```

**Benefits**:
- Single entry point for all traffic
- SSL termination
- Load balancing (future)
- Rate limiting
- Static asset caching

---

## Summary

WintEHR demonstrates a production-grade healthcare IT architecture while remaining accessible for educational purposes:

**Key Architectural Principles**:
1. **FHIR-Native**: All clinical data stored as FHIR R4 resources via HAPI FHIR
2. **Microservices**: Independent, scalable services communicating via REST and WebSocket
3. **Async-First**: Non-blocking I/O throughout the stack for high performance
4. **Container-Based**: Docker orchestration for consistent deployment across environments
5. **Educational**: Clear separation of concerns, extensive documentation, safe for learning

**Data Flow Summary**:
- User interacts with React frontend
- Frontend calls FastAPI backend for business logic
- Backend proxies FHIR operations to HAPI FHIR server
- HAPI FHIR persists data in PostgreSQL with automatic indexing
- Redis provides caching and session management
- WebSocket enables real-time clinical event broadcasting
- Nginx (production) provides SSL, routing, and security

This architecture supports the complete EHR workflow while teaching modern healthcare IT development patterns in a safe, synthetic data environment.

---

**For More Information**:
- [Main README](../README.md) - Project overview
- [CLAUDE.md](../CLAUDE.md) - Development guide
- [Deployment Guide](DEPLOYMENT.md) - Deployment instructions
- [Configuration Reference](CONFIGURATION.md) - All configuration options
- [Backend Architecture](../backend/CLAUDE.md) - Backend details
- [Frontend Architecture](../frontend/CLAUDE.md) - Frontend details

