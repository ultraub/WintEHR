# MedGenEMR System Architecture

**Version**: 2.0  
**Updated**: 2025-01-06  
**Status**: Production-Ready Training Environment

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────────┐ │
│  │   Patient      │  │    Clinical     │  │     FHIR Explorer    │ │
│  │   Registry     │  │   Workspace     │  │   & Dev Tools        │ │
│  │               │  │                 │  │                       │ │
│  │ • PatientList  │  │ • ChartReview   │  │ • FHIR Resource       │ │
│  │ • Search       │  │ • Results/Labs  │  │   Browser             │ │
│  │ • Dashboard    │  │ • Medications   │  │ • CDS Hooks Testing   │ │
│  │               │  │ • Orders        │  │ • API Explorer        │ │
│  │               │  │ • Pharmacy      │  │                       │ │
│  │               │  │ • Imaging       │  │                       │ │
│  │               │  │ • Encounters    │  │                       │ │
│  └────────────────┘  └─────────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ HTTP/WebSocket
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                       Backend (FastAPI)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │   FHIR R4 API   │  │  Clinical APIs   │  │   Support APIs    │  │
│  │                 │  │                  │  │                   │  │
│  │ • CRUD Ops      │  │ • Search Catalog │  │ • Authentication  │  │
│  │ • Search        │  │ • Pharmacy       │  │ • WebSocket       │  │
│  │ • Operations    │  │ • DICOM/Imaging  │  │ • Notifications   │  │
│  │ • Validation    │  │ • CDS Hooks      │  │ • File Upload     │  │
│  │ • Bundle        │  │ • Quality        │  │                   │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ SQL
                                  │
┌─────────────────────────────────────────────────────────────────────┐
│                      Database (PostgreSQL)                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  FHIR Storage   │  │  Search Indexes  │  │   System Data     │  │
│  │                 │  │                  │  │                   │  │
│  │ • fhir.resources│  │ • search_params  │  │ • users           │  │
│  │ • fhir.bundles  │  │ • token_index    │  │ • sessions        │  │
│  │ • fhir.history  │  │ • reference_idx  │  │ • audit_log       │  │
│  │                 │  │                  │  │ • notifications   │  │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Architecture

### 1. Clinical Workflow Data Flow

```
Patient Selection → FHIR Resource Loading → Clinical Context
       │                    │                      │
       ├─ Patient/xxx ──────┼─ Conditions ─────────┼─ Active Problems
       │                    ├─ Observations ───────┼─ Recent Results  
       │                    ├─ MedicationRequests ─┼─ Current Meds
       │                    ├─ Encounters ─────────┼─ Visit History
       │                    └─ ServiceRequests ────┼─ Pending Orders
                                                    │
                              Real-time Updates ←──┘
                                     │
┌─────────────────────────────────────────────────────────────────┐
│                Cross-Module Communication                       │
├─────────────────────────────────────────────────────────────────┤
│  Event Bus (ClinicalWorkflowContext)                           │
│                                                                 │
│  ┌──────────────┐    ┌────────────────┐    ┌──────────────────┐│
│  │ Chart Review │───▶│ Event Publisher │───▶│  Results Tab     ││
│  │   (Problem   │    │                │    │  (Lab Trends)    ││
│  │    Added)    │    │ CLINICAL_EVENTS│    │                  ││
│  └──────────────┘    │                │    └──────────────────┘│
│                      │ • ORDER_PLACED │                        │
│  ┌──────────────┐    │ • RESULT_RX    │    ┌──────────────────┐│
│  │ Orders Tab   │───▶│ • MED_DISPENSED│───▶│  Pharmacy Tab    ││
│  │              │    │ • ENCOUNTER    │    │                  ││
│  └──────────────┘    │ • CRITICAL_ALERT│   └──────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2. FHIR Resource Management

```
Frontend Request → FHIR Service → HTTP API → FHIR Router → Storage Engine
       │               │            │           │              │
   Component ──── fhirService.js ── axios ── fhir_router.py ── storage.py
       │               │            │           │              │
       └─ Auto-refresh ┘            │           │              │
                                    │           │              │
                             Content-Type       │              │
                             Negotiation        │              │
                                    │           │              │
                              JSON/XML ←────────┼──────────────┘
                                                │
                                         Search Indexing
                                                │
                                    ┌───────────────────┐
                                    │  Search Params    │
                                    │                   │
                                    │ • Token Values    │
                                    │ • Reference IDs   │  
                                    │ • Date Ranges     │
                                    │ • Quantity Values │
                                    └───────────────────┘
```

## 🧩 Component Architecture

### Frontend Architecture

```
App.js (Route Configuration)
├── Providers (Context Layer)
│   ├── AuthProvider ─────────────── Authentication state
│   ├── FHIRResourceProvider ────── Resource caching & refresh
│   ├── ClinicalWorkflowProvider ── Cross-module communication
│   ├── WebSocketProvider ─────── Real-time notifications
│   └── Theme/Localization ────── UI configuration
│
├── Layouts
│   ├── LayoutV3 ──────────────── Main app layout
│   └── ClinicalLayout ──────── Clinical workspace layout
│
├── Pages
│   ├── PatientList ──────────── Patient registry
│   ├── PatientDashboard ────── Patient overview  
│   ├── ClinicalWorkspace ───── Main clinical interface
│   └── Developer Tools ────── FHIR explorer, CDS Hooks
│
└── Components
    ├── Clinical
    │   ├── Workspace
    │   │   ├── Tabs ──────────── Chart, Results, Orders, Pharmacy, Imaging
    │   │   └── Dialogs ─────── Problem, Medication, Encounter management
    │   ├── Charts ──────────── Lab trends, vital signs visualization
    │   ├── Imaging ─────────── DICOM viewer with real image loading
    │   └── Medications ───── Prescription workflows
    └── Shared ─────────────── Reusable UI components
```

### Backend Architecture

```
main.py (FastAPI Application)
├── Routers
│   ├── /fhir/R4/* ──────────── Complete FHIR R4 implementation
│   ├── /api/emr/* ─────────── Extended clinical APIs
│   ├── /api/pharmacy/* ───── Medication dispensing workflows
│   ├── /api/dicom/* ──────── Medical imaging services
│   ├── /cds-hooks/* ─────── Clinical decision support
│   └── /api/auth/* ──────── Dual-mode authentication
│
├── Core FHIR Engine
│   ├── storage.py ───────── PostgreSQL FHIR storage
│   ├── search.py ──────── Advanced search with reference resolution
│   ├── operations.py ─── All FHIR operations ($validate, $expand, etc.)
│   ├── validator.py ──── Resource validation
│   └── indexer.py ────── Search parameter indexing
│
├── Clinical Services
│   ├── pharmacy/ ─────── MedicationDispense workflows
│   ├── imaging/ ────── DICOM study management
│   ├── catalog/ ────── Clinical catalog search
│   └── quality/ ────── Quality measures & reporting
│
└── Infrastructure
    ├── database.py ──── Database connection management
    ├── auth.py ─────── Authentication & authorization
    └── websocket.py ── Real-time notification system
```

## 🔌 Integration Points

### 1. Authentication Integration

```
Frontend Login → Auth API → User Validation → Session/JWT Token
       │             │           │                    │
   AuthContext ── /api/auth ── auth_enhanced.py ── Token Response
       │             │           │                    │
   Simple Mode       │      Training Users     Base64 Session Token
   JWT Mode          │      DB Users           JWT with Claims
```

### 2. Real-time Clinical Workflow

```
Clinical Action → Workflow Event → Cross-Module Notification → UI Update
       │                │                    │                     │
Order Placed ─── ORDER_PLACED ────── Subscribe Handlers ─── Tab Refresh
Result Ready ─── RESULT_RECEIVED ── Critical Alert ───── Alert Dialog
Med Dispensed ── MED_DISPENSED ───── Status Update ───── Chart Update
```

### 3. FHIR Operations Integration

```
UI Action → Service Call → FHIR API → Storage → Search Index → Cache Refresh
    │           │            │          │          │             │
Add Problem → createCondition → POST → INSERT → INDEX_UPDATE → AUTO_REFRESH
Edit Order  → updateServiceReq → PUT → UPDATE → RE_INDEX → CONTEXT_UPDATE
View Results → searchObservations → GET → SELECT → SEARCH_PARAMS → DISPLAY
```

## 📊 Performance & Scalability

### Caching Strategy
- **Frontend**: React Context with automatic refresh
- **Backend**: FHIR resource caching with TTL
- **Database**: Indexed search parameters for fast queries
- **Real-time**: WebSocket connections for live updates

### Search Optimization
- **Token Search**: Dedicated token index tables
- **Reference Search**: Efficient cross-resource lookups  
- **Date Range**: Optimized temporal queries
- **Full-text**: PostgreSQL GIN indexes for text search

### Resource Management
- **Memory**: Efficient FHIR resource loading with pagination
- **Network**: Optimized payload sizes with selective field loading
- **Storage**: JSONB compression with indexing strategy
- **Connections**: Connection pooling for database efficiency

## 🔒 Security Architecture

### Authentication Flow
```
User Login → Credential Validation → Token Generation → Session Management
     │              │                      │                   │
Simple Mode ── Training Users ──── Base64 Session ─── Client Storage
JWT Mode ────── DB Validation ──── JWT Claims ────── Secure Headers
```

### Authorization Model
- **Role-Based**: Physician, Nurse, Pharmacist, Admin roles
- **Resource-Level**: Patient-specific data access controls
- **API-Level**: Endpoint access based on role permissions
- **Field-Level**: Sensitive data masking for certain roles

### Data Protection
- **Encryption**: TLS for all communications
- **Validation**: FHIR schema validation on all inputs
- **Audit**: Complete audit trail for all CRUD operations
- **Compliance**: HIPAA-ready architecture patterns

## 🧪 Testing Architecture

### Frontend Testing
- **Unit Tests**: Component testing with React Testing Library
- **Integration Tests**: Full workflow testing with mock FHIR data
- **E2E Tests**: Clinical workflow automation with real scenarios

### Backend Testing
- **Unit Tests**: Individual FHIR operation testing
- **Integration Tests**: Complete API workflow testing
- **Performance Tests**: Load testing with realistic data volumes
- **Validation Tests**: FHIR compliance and schema validation

### Data Testing
- **Synthea Integration**: Realistic patient data generation
- **FHIR Validation**: Complete resource validation testing
- **Search Testing**: Advanced search parameter testing
- **Workflow Testing**: End-to-end clinical workflow validation

---

This architecture supports a complete, production-ready EMR training environment with real FHIR R4 compliance, comprehensive clinical workflows, and modern web application patterns.