# WintEHR Greenfield Architecture: Build from Scratch

**Document Version**: 1.0
**Date**: 2025-01-28
**Status**: System Design Specification
**Purpose**: Complete architecture for building WintEHR from the ground up

---

## Executive Summary

This document presents a **greenfield architecture** for WintEHR - a production-ready Electronic Medical Records (EMR) system built from scratch using modern healthcare technology standards. By leveraging HAPI FHIR JPA Server, modular domain-driven design, and event-driven architecture, we create a maintainable, scalable, and compliant healthcare application.

### Design Philosophy

1. **FHIR-Native**: HAPI FHIR as the foundation - never write custom FHIR code
2. **Modular**: Domain modules with clear boundaries and independent deployment
3. **Event-Driven**: Loose coupling through pub/sub event communication
4. **Thin Python Layer**: Business logic only, delegate data operations to HAPI
5. **Modern Frontend**: React 18, TypeScript, module-based state management
6. **Production-Ready**: Security, audit, monitoring, and compliance built-in

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Frontend (TypeScript)                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  7 Domain Modules (independently deployable)              │  │
│  │  Patient | Medications | Orders | Results | Imaging       │  │
│  │  Documentation | Clinical Decision Support                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Event Bus (pub/sub)  |  FHIR Client  |  Auth           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ REST API + WebSocket
┌─────────────────────────────────────────────────────────────────┐
│              Python FastAPI (Orchestration Layer)                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Module APIs (business logic only)                        │  │
│  │  - Drug interactions    - Order validation                │  │
│  │  - CDS Hooks           - Clinical calculations            │  │
│  │  - Pharmacy workflows  - Business rules                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ FHIR REST API
┌─────────────────────────────────────────────────────────────────┐
│                   HAPI FHIR JPA Server (Java)                    │
│  - Complete FHIR R4 implementation                              │
│  - Automatic search indexing & validation                       │
│  - Compartments & $operations                                   │
│  - Subscriptions & WebSocket                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓ JPA/Hibernate
┌─────────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                            │
│  - HAPI-managed FHIR schema (automatic)                         │
│  - Application tables (users, sessions, audit)                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Metrics

| Metric | Target Value | Rationale |
|--------|--------------|-----------|
| **Total Code** | ~12,000 lines | 0 custom FHIR code, business logic only |
| **Backend Files** | ~50 Python files | Modular, focused services |
| **Frontend Modules** | 7 independent modules | Domain-driven design |
| **Context Size** | 200 lines max per module | Maintainable state management |
| **API Response Time** | < 200ms (95th percentile) | HAPI optimization + thin layer |
| **Development Time** | 12-14 weeks (3 devs) | Greenfield with proven stack |
| **Deployment** | 4 Docker containers | Simple, scalable architecture |

---

## Table of Contents

1. [Functional Requirements](#1-functional-requirements)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Domain Module Specifications](#4-domain-module-specifications)
5. [Data Architecture](#5-data-architecture)
6. [API Design](#6-api-design)
7. [Security & Compliance](#7-security--compliance)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Operations & Monitoring](#10-operations--monitoring)

---

# 1. Functional Requirements

## 1.1 Core Clinical Capabilities

### Patient Management
- **Demographics**: Complete patient registration and profile management
- **Patient Search**: Name, DOB, MRN, SSN search with fuzzy matching
- **Patient Portal**: Access to own medical records
- **Patient Timeline**: Chronological view of all clinical events
- **Patient/$everything**: Complete patient record retrieval (FHIR operation)

### Chart Review
- **Problem List**: Active, resolved, and historical conditions
- **Medications**: Current medications, allergies, interactions
- **Vitals**: Latest vital signs with trending
- **Allergies**: Drug and environmental allergies with severity
- **Immunizations**: Vaccination history
- **Social History**: Smoking, alcohol, substance use

### Computerized Provider Order Entry (CPOE)
- **Medication Orders**: Prescribe with drug interaction checking
- **Lab Orders**: Order laboratory tests
- **Radiology Orders**: Order imaging studies
- **Referral Orders**: Create specialist referrals
- **Order Templates**: Commonly used order sets
- **Order Tracking**: Real-time status updates

### Results Management
- **Lab Results**: Receive and display laboratory results
- **Critical Alerts**: Automatic notification for critical values
- **Result Trending**: Graphical trends over time
- **Result Acknowledgment**: Provider sign-off workflow
- **Result Integration**: Link results to originating orders

### Pharmacy Workflows
- **Prescription Queue**: List of pending prescriptions to fill
- **Medication Dispensing**: Record medication dispensed
- **Inventory Management**: Track medication stock levels
- **Controlled Substances**: DEA tracking and reporting
- **Patient Counseling**: Document patient education

### Medical Imaging
- **DICOM Integration**: Import and store DICOM studies
- **Image Viewer**: Multi-slice viewer with window/level controls
- **Imaging Reports**: Radiology reports linked to studies
- **Study Comparison**: Side-by-side comparison of studies
- **Study Sharing**: Export and share imaging studies

### Clinical Documentation
- **Progress Notes**: SOAP notes with templates
- **Encounter Documentation**: Document patient visits
- **Clinical Templates**: Specialty-specific templates
- **Documentation Sharing**: Share notes with care team
- **Quality Measures**: Track clinical quality indicators

### Clinical Decision Support (CDS)
- **Drug Interactions**: Real-time interaction checking
- **Allergy Alerts**: Cross-check medications against allergies
- **Duplicate Therapy**: Detect duplicate drug classes
- **CDS Hooks Integration**: Standards-based CDS services
- **Clinical Guidelines**: Evidence-based recommendations

## 1.2 Administrative Requirements

### Authentication & Authorization
- **User Authentication**: Secure login with JWT tokens
- **Role-Based Access Control (RBAC)**: Doctor, Nurse, Pharmacist, Admin roles
- **Session Management**: Secure session handling
- **Audit Logging**: Track all PHI access (HIPAA requirement)

### Reporting & Analytics
- **Clinical Reports**: Standard clinical reports
- **Quality Dashboards**: Track quality measures
- **Usage Analytics**: System utilization metrics
- **Export Capabilities**: Export data for external analysis

### Interoperability
- **FHIR R4 API**: Complete RESTful FHIR interface
- **HL7 v2 Support**: (Optional) Interface engine for legacy systems
- **CDS Hooks**: Standards-based clinical decision support
- **SMART on FHIR**: Third-party app integration framework

## 1.3 Non-Functional Requirements

### Performance
- **Response Time**: < 200ms for 95% of requests
- **Concurrent Users**: Support 100+ simultaneous users
- **Data Volume**: Handle 100,000+ patients
- **Search Performance**: < 500ms for complex FHIR searches

### Scalability
- **Horizontal Scaling**: Scale frontend and backend independently
- **Database Scaling**: PostgreSQL replication and read replicas
- **Caching**: Redis for session and frequently accessed data
- **Load Balancing**: Distribute traffic across instances

### Reliability
- **Uptime**: 99.9% availability (8.76 hours downtime/year)
- **Backup**: Daily automated backups with point-in-time recovery
- **Disaster Recovery**: Recovery Time Objective (RTO) < 4 hours
- **Data Integrity**: Zero data loss (RPO = 0)

### Security
- **Encryption**: TLS 1.3 for data in transit
- **Data Encryption**: Database encryption at rest
- **HIPAA Compliance**: Full PHI protection
- **Audit Trail**: Comprehensive audit logging
- **Access Controls**: Role-based with least privilege principle

### Compliance
- **HIPAA**: Health Insurance Portability and Accountability Act
- **HITECH**: Health Information Technology for Economic and Clinical Health Act
- **21 CFR Part 11**: FDA electronic records requirements (if applicable)
- **FHIR R4**: HL7 FHIR Release 4 compliance

---

# 2. System Architecture

## 2.1 Architectural Principles

### 1. Domain-Driven Design (DDD)
- **Bounded Contexts**: Each clinical domain is a separate module
- **Ubiquitous Language**: Use FHIR terminology consistently
- **Aggregate Roots**: Patient, Encounter, MedicationRequest, etc.
- **Domain Events**: Clinical events drive module communication

### 2. Microservices-Ready (Start Monolithic)
- **Modular Monolith**: Begin with modules in one deployment
- **Independent Modules**: Each module can be extracted to microservice
- **Event-Driven**: Loose coupling enables future splitting
- **Database per Module**: HAPI for FHIR, app DB for business data

### 3. Clean Architecture (Hexagonal)
```
┌─────────────────────────────────────────────┐
│           Presentation Layer                │
│  (React Components, API Controllers)        │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│         Application Layer                   │
│  (Use Cases, Business Logic)                │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│           Domain Layer                      │
│  (Entities, Value Objects, Domain Events)   │
└─────────────────┬───────────────────────────┘
                  ↓
┌─────────────────────────────────────────────┐
│         Infrastructure Layer                │
│  (HAPI FHIR, Database, External Services)   │
└─────────────────────────────────────────────┘
```

### 4. Event-Driven Architecture
- **Event Bus**: Central pub/sub for module communication
- **Event Types**: Domain events (order.placed, medication.dispensed)
- **Asynchronous**: Non-blocking event processing
- **Event Sourcing**: (Optional) Maintain event log for audit

## 2.2 System Components

### Frontend (React + TypeScript)
```
frontend/
├── modules/
│   ├── patient/                    # Patient management
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── types.ts
│   ├── medications/                # Medication management
│   ├── orders/                     # CPOE
│   ├── results/                    # Lab/diagnostic results
│   ├── imaging/                    # Medical imaging
│   ├── documentation/              # Clinical notes
│   └── cds/                        # Clinical decision support
│
├── core/
│   ├── fhir/                       # FHIR client wrapper
│   ├── events/                     # Event bus
│   ├── auth/                       # Authentication
│   ├── ui/                         # Shared components
│   └── routing/                    # App routing
│
└── App.tsx                         # Application root
```

### Backend (Python + FastAPI)
```
backend/
├── modules/
│   ├── medications/
│   │   ├── router.py              # FastAPI routes
│   │   ├── service.py             # Business logic
│   │   ├── models.py              # Pydantic models
│   │   └── schemas.py             # API schemas
│   ├── orders/
│   ├── pharmacy/
│   ├── cds/
│   └── ...
│
├── core/
│   ├── fhir/
│   │   └── client.py              # fhirpy wrapper
│   ├── auth/
│   │   ├── jwt.py
│   │   └── permissions.py
│   ├── events/
│   │   └── bus.py                 # Backend event bus
│   └── database/
│       └── session.py             # SQLAlchemy session
│
├── config.py                      # Configuration
└── main.py                        # FastAPI app
```

### HAPI FHIR Server (Java)
- **Pre-built Docker Image**: `hapiproject/hapi:latest`
- **Configuration**: Environment variables and properties file
- **No Custom Code**: Use HAPI as-is with configuration only

### Database (PostgreSQL)
- **HAPI Schema**: Managed by HAPI (FHIR resources)
- **Application Schema**: Users, sessions, audit logs, application data

## 2.3 Module Architecture Pattern

Each module follows this standard structure:

### Frontend Module
```typescript
// modules/medications/context/MedicationContext.tsx
interface MedicationState {
  medications: Medication[];
  loading: boolean;
  error: Error | null;
}

// Actions
- loadMedications(patientId)
- createMedication(data)
- updateMedication(id, data)
- deleteMedication(id)
- dispenseMedication(id, dispenseData)

// Events Published
- medications.loaded
- medications.prescribed
- medications.dispensed
- medications.discontinued

// Events Subscribed
- orders.placed (if medication order)
```

### Backend Module
```python
# modules/medications/router.py
@router.get("/{patient_id}")
async def get_patient_medications(
    patient_id: str,
    fhir: FHIRClient = Depends(get_fhir_client)
):
    """Get medications from HAPI, add business logic"""
    medications = await fhir.search_medications(patient_id)
    # Business logic: enrich, transform, validate
    return medications

# modules/medications/service.py
class MedicationService:
    async def check_drug_interactions(self, medication_codes):
        """Business logic: call external drug interaction API"""
        # Not FHIR storage - pure business logic
        pass
```

## 2.4 Communication Patterns

### Synchronous (REST API)
```
Frontend → Python Backend → HAPI FHIR
         ← JSON Response ←
```
**Use Cases**: CRUD operations, searches, immediate data needs

### Asynchronous (Events)
```
Module A → Event Bus → Module B
         publish      subscribe
```
**Use Cases**: Cross-module workflows, notifications, audit logging

### WebSocket (Real-time)
```
HAPI → Python (Subscriptions) → Frontend (WebSocket)
     FHIR Subscription           Live Updates
```
**Use Cases**: Real-time result updates, critical alerts, chat

---

# 3. Technology Stack

## 3.1 Core Technologies

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **React** | 18.3.x | UI framework |
| **TypeScript** | 5.3.x | Type safety |
| **Vite** | 5.x | Build tool (fast) |
| **Material-UI (MUI)** | 5.15.x | UI component library |
| **React Router** | 6.x | Client-side routing |
| **TanStack Query** | 5.x | Server state management |
| **Zustand** | 4.x | Client state management |
| **Axios** | 1.6.x | HTTP client |
| **Socket.io Client** | 4.x | WebSocket client |
| **Chart.js** | 4.x | Data visualization |
| **date-fns** | 3.x | Date manipulation |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.11+ | Runtime |
| **FastAPI** | 0.109.x | Web framework |
| **fhirpy** | 2.0.x | FHIR client library |
| **SQLAlchemy** | 2.0.x | ORM (for app tables) |
| **Pydantic** | 2.6.x | Data validation |
| **python-jose** | 3.3.x | JWT handling |
| **passlib** | 1.7.x | Password hashing |
| **python-multipart** | 0.0.9 | File uploads |
| **httpx** | 0.26.x | Async HTTP client |
| **pytest** | 8.x | Testing framework |

### FHIR Server
| Technology | Version | Purpose |
|-----------|---------|---------|
| **HAPI FHIR JPA** | 7.0+ | FHIR server |
| **Java** | 17+ | HAPI runtime |
| **PostgreSQL** | 15+ | HAPI database |
| **Hibernate** | 6.x | JPA implementation |

### Infrastructure
| Technology | Version | Purpose |
|-----------|---------|---------|
| **Docker** | 24.x | Containerization |
| **Docker Compose** | 2.x | Local orchestration |
| **PostgreSQL** | 15.x | Database |
| **Redis** | 7.x | Caching & sessions |
| **Nginx** | 1.25.x | Reverse proxy |
| **Prometheus** | 2.x | Metrics |
| **Grafana** | 10.x | Monitoring dashboards |

## 3.2 Development Tools

| Tool | Purpose |
|------|---------|
| **VS Code** | IDE |
| **ESLint** | JavaScript linting |
| **Prettier** | Code formatting |
| **Black** | Python formatting |
| **mypy** | Python type checking |
| **Jest** | Frontend unit testing |
| **React Testing Library** | Component testing |
| **Playwright** | E2E testing |
| **Postman** | API testing |

## 3.3 Why This Stack?

### HAPI FHIR
- ✅ Production-proven FHIR server
- ✅ Zero custom FHIR code to maintain
- ✅ Automatic FHIR R4/R5 compliance
- ✅ Built-in search optimization
- ✅ Active community and support

### Python + FastAPI
- ✅ Fast development with async support
- ✅ Strong typing with Pydantic
- ✅ Excellent async performance
- ✅ Great healthcare library ecosystem
- ✅ Easy to learn and maintain

### React + TypeScript
- ✅ Most popular UI framework
- ✅ Large component ecosystem
- ✅ TypeScript for type safety
- ✅ Strong developer tooling
- ✅ Easy to find developers

### PostgreSQL
- ✅ ACID compliance for healthcare data
- ✅ JSON support (FHIR resources)
- ✅ Excellent performance at scale
- ✅ Proven reliability
- ✅ Open source

---

# 4. Domain Module Specifications

## 4.1 Patient Module

### Responsibilities
- Patient demographics (CRUD)
- Patient search and matching
- Patient timeline
- Patient context management

### Key Components

**Frontend**:
```typescript
// modules/patient/context/PatientContext.tsx
interface PatientState {
  currentPatient: Patient | null;
  patients: Patient[];
  loading: boolean;
  error: Error | null;
}

const PatientContext = {
  // Actions
  loadPatient: (patientId: string) => Promise<Patient>
  searchPatients: (query: string) => Promise<Patient[]>
  createPatient: (patient: PatientInput) => Promise<Patient>
  updatePatient: (id: string, updates: Partial<Patient>) => Promise<Patient>
  setCurrentPatient: (patient: Patient | null) => void

  // Computed
  patientAge: (patient: Patient) => number
  patientFullName: (patient: Patient) => string
}

// Events
- patient.selected
- patient.created
- patient.updated
```

**Backend**:
```python
# modules/patient/router.py
@router.get("/{patient_id}")
async def get_patient(patient_id: str) -> PatientResponse:
    """Get patient demographics from HAPI"""
    pass

@router.get("/")
async def search_patients(
    name: str = None,
    birthdate: str = None,
    identifier: str = None
) -> List[PatientResponse]:
    """Search patients with fuzzy matching"""
    pass

@router.get("/{patient_id}/$everything")
async def patient_everything(patient_id: str) -> Bundle:
    """Get complete patient record (FHIR $everything operation)"""
    pass

# modules/patient/service.py
class PatientService:
    async def enrich_patient_data(self, patient: dict) -> dict:
        """Add computed fields (age, coverage, etc.)"""
        pass

    async def get_patient_summary(self, patient_id: str) -> dict:
        """Aggregate summary from multiple resources"""
        pass
```

### FHIR Resources
- **Primary**: Patient
- **Related**: Person, RelatedPerson, Coverage

### API Endpoints
```
GET    /api/patients/{id}                 # Get patient by ID
GET    /api/patients?name=Smith           # Search patients
POST   /api/patients                      # Create patient
PUT    /api/patients/{id}                 # Update patient
GET    /api/patients/{id}/$everything     # Complete record
GET    /api/patients/{id}/summary         # Patient summary
```

---

## 4.2 Medications Module

### Responsibilities
- Medication orders (prescriptions)
- Active medication list
- Medication history
- Drug interaction checking
- Allergy cross-checking

### Key Components

**Frontend**:
```typescript
// modules/medications/context/MedicationContext.tsx
interface MedicationState {
  medications: MedicationRequest[];
  loading: boolean;
  error: Error | null;
  selectedMedication: MedicationRequest | null;
}

const MedicationContext = {
  // Actions
  loadMedications: (patientId: string, status?: string) => Promise<void>
  createMedication: (medication: MedicationInput) => Promise<MedicationRequest>
  updateMedication: (id: string, updates: Partial<MedicationRequest>) => Promise<void>
  discontinueMedication: (id: string, reason: string) => Promise<void>
  checkInteractions: (medicationCodes: string[]) => Promise<Interaction[]>

  // Events
  - medications.prescribed
  - medications.discontinued
  - medications.interaction.detected
}
```

**Backend**:
```python
# modules/medications/router.py
@router.get("/{patient_id}")
async def get_patient_medications(
    patient_id: str,
    status: str = "active"
) -> List[MedicationResponse]:
    """Get patient medications from HAPI"""
    pass

@router.post("/")
async def prescribe_medication(
    medication: MedicationInput,
    current_user: User = Depends(get_current_user)
) -> MedicationResponse:
    """
    Prescribe medication with safety checks:
    1. Check drug-drug interactions
    2. Check drug-allergy interactions
    3. Check duplicate therapy
    4. Create MedicationRequest in HAPI
    5. Publish medication.prescribed event
    """
    pass

@router.post("/check-interactions")
async def check_drug_interactions(
    codes: List[str]
) -> List[InteractionWarning]:
    """Check for drug-drug interactions"""
    pass

# modules/medications/service.py
class MedicationService:
    async def check_drug_interactions(
        self,
        medication_codes: List[str]
    ) -> List[dict]:
        """Call external drug interaction API (e.g., RxNorm, DailyMed)"""
        pass

    async def check_allergies(
        self,
        patient_id: str,
        medication_code: str
    ) -> List[dict]:
        """Cross-check medication against patient allergies"""
        pass

    async def check_duplicate_therapy(
        self,
        patient_id: str,
        medication_code: str
    ) -> List[dict]:
        """Check for duplicate drug classes"""
        pass
```

### FHIR Resources
- **Primary**: MedicationRequest, MedicationStatement
- **Related**: Medication, MedicationDispense, AllergyIntolerance

### API Endpoints
```
GET    /api/medications/{patient_id}                # Get patient medications
POST   /api/medications                             # Prescribe medication
PUT    /api/medications/{id}                        # Update prescription
DELETE /api/medications/{id}                        # Discontinue medication
POST   /api/medications/check-interactions          # Check interactions
```

---

## 4.3 Orders Module (CPOE)

### Responsibilities
- Computerized Provider Order Entry
- Lab orders, radiology orders, referrals
- Order templates and favorites
- Order status tracking
- Order transmission to ancillary systems

### Key Components

**Frontend**:
```typescript
// modules/orders/context/OrderContext.tsx
interface OrderState {
  orders: ServiceRequest[];
  orderTemplates: OrderTemplate[];
  loading: boolean;
  error: Error | null;
}

const OrderContext = {
  // Actions
  loadOrders: (patientId: string, status?: string) => Promise<void>
  createOrder: (order: OrderInput) => Promise<ServiceRequest>
  updateOrderStatus: (orderId: string, status: string) => Promise<void>
  cancelOrder: (orderId: string, reason: string) => Promise<void>
  loadOrderTemplates: (specialty: string) => Promise<void>

  // Events
  - orders.placed
  - orders.completed
  - orders.cancelled
  - orders.resulted
}
```

**Backend**:
```python
# modules/orders/router.py
@router.get("/{patient_id}")
async def get_patient_orders(
    patient_id: str,
    status: str = None,
    category: str = None
) -> List[ServiceRequest]:
    """Get patient orders from HAPI"""
    pass

@router.post("/")
async def create_order(
    order: OrderInput,
    current_user: User = Depends(get_current_user)
) -> ServiceRequest:
    """
    Create order:
    1. Validate order (required fields, appropriate tests)
    2. Check for duplicate orders
    3. Create ServiceRequest in HAPI
    4. Publish orders.placed event
    5. Trigger CDS Hooks (optional)
    """
    pass

@router.get("/templates")
async def get_order_templates(
    specialty: str = None
) -> List[OrderTemplate]:
    """Get commonly used order templates"""
    pass

# modules/orders/service.py
class OrderService:
    async def validate_order(self, order: dict) -> dict:
        """Validate order against business rules"""
        pass

    async def check_duplicate_orders(
        self,
        patient_id: str,
        order_code: str
    ) -> List[dict]:
        """Check for duplicate orders in last 24 hours"""
        pass

    async def get_order_catalog(
        self,
        category: str
    ) -> List[dict]:
        """Get available orders by category (lab, imaging, etc.)"""
        pass
```

### FHIR Resources
- **Primary**: ServiceRequest
- **Related**: DiagnosticReport, Observation, ImagingStudy

### API Endpoints
```
GET    /api/orders/{patient_id}              # Get patient orders
POST   /api/orders                            # Place order
PUT    /api/orders/{id}/status                # Update order status
DELETE /api/orders/{id}                       # Cancel order
GET    /api/orders/templates                  # Get order templates
GET    /api/orders/catalog/{category}         # Get order catalog
```

---

## 4.4 Results Module

### Responsibilities
- Lab results display and management
- Critical value alerts
- Result trending and graphing
- Result acknowledgment workflow
- Integration with orders (link results to orders)

### Key Components

**Frontend**:
```typescript
// modules/results/context/ResultsContext.tsx
interface ResultsState {
  results: DiagnosticReport[];
  observations: Observation[];
  criticalAlerts: Observation[];
  loading: boolean;
}

const ResultsContext = {
  // Actions
  loadResults: (patientId: string, category?: string) => Promise<void>
  acknowledgeResult: (resultId: string) => Promise<void>
  getTrend: (patientId: string, code: string) => Promise<Observation[]>

  // Events
  - results.received
  - results.acknowledged
  - results.critical
}
```

**Backend**:
```python
# modules/results/router.py
@router.get("/{patient_id}")
async def get_patient_results(
    patient_id: str,
    category: str = None,
    date_from: str = None
) -> List[DiagnosticReport]:
    """Get patient results from HAPI"""
    pass

@router.post("/{result_id}/acknowledge")
async def acknowledge_result(
    result_id: str,
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Mark result as acknowledged by provider:
    1. Update DiagnosticReport status to 'final'
    2. Add provenance record
    3. Publish results.acknowledged event
    """
    pass

@router.get("/{patient_id}/trend/{code}")
async def get_result_trend(
    patient_id: str,
    code: str,
    days: int = 365
) -> List[Observation]:
    """Get trend data for a specific test over time"""
    pass

# modules/results/service.py
class ResultsService:
    async def check_critical_values(
        self,
        observation: dict
    ) -> bool:
        """Check if result is in critical range"""
        pass

    async def create_alert(
        self,
        patient_id: str,
        observation: dict
    ) -> dict:
        """Create critical value alert"""
        pass

    async def link_result_to_order(
        self,
        result_id: str,
        order_id: str
    ) -> None:
        """Link DiagnosticReport to ServiceRequest"""
        pass
```

### FHIR Resources
- **Primary**: DiagnosticReport, Observation
- **Related**: ServiceRequest, Specimen

### API Endpoints
```
GET    /api/results/{patient_id}                # Get patient results
GET    /api/results/{patient_id}/trend/{code}   # Get result trend
POST   /api/results/{id}/acknowledge            # Acknowledge result
GET    /api/results/critical                    # Get critical alerts
```

---

## 4.5 Imaging Module

### Responsibilities
- DICOM study import and storage
- Image viewer (multi-slice, window/level controls)
- Imaging reports
- Study comparison
- Study export and sharing

### Key Components

**Frontend**:
```typescript
// modules/imaging/context/ImagingContext.tsx
interface ImagingState {
  studies: ImagingStudy[];
  selectedStudy: ImagingStudy | null;
  viewerState: ViewerState;
  loading: boolean;
}

const ImagingContext = {
  // Actions
  loadStudies: (patientId: string) => Promise<void>
  loadStudy: (studyId: string) => Promise<ImagingStudy>
  compareStudies: (studyId1: string, studyId2: string) => Promise<void>
  exportStudy: (studyId: string, format: string) => Promise<Blob>

  // Viewer controls
  setWindowLevel: (window: number, level: number) => void
  nextSlice: () => void
  previousSlice: () => void
}
```

**Backend**:
```python
# modules/imaging/router.py
@router.get("/{patient_id}")
async def get_patient_studies(
    patient_id: str,
    modality: str = None
) -> List[ImagingStudy]:
    """Get patient imaging studies from HAPI"""
    pass

@router.post("/upload")
async def upload_dicom(
    files: List[UploadFile],
    patient_id: str,
    current_user: User = Depends(get_current_user)
) -> ImagingStudy:
    """
    Upload DICOM files:
    1. Validate DICOM format
    2. Extract metadata
    3. Store DICOM files (filesystem or PACS)
    4. Create ImagingStudy in HAPI
    5. Publish imaging.study.available event
    """
    pass

@router.get("/{study_id}/dicom/{instance_id}")
async def get_dicom_instance(
    study_id: str,
    instance_id: str
) -> StreamingResponse:
    """Stream DICOM instance for viewer"""
    pass

# modules/imaging/service.py
class ImagingService:
    async def parse_dicom_metadata(
        self,
        dicom_file: bytes
    ) -> dict:
        """Extract DICOM tags"""
        pass

    async def store_dicom(
        self,
        dicom_file: bytes,
        study_id: str
    ) -> str:
        """Store DICOM file and return instance ID"""
        pass

    async def generate_thumbnail(
        self,
        dicom_file: bytes
    ) -> bytes:
        """Generate thumbnail image"""
        pass
```

### FHIR Resources
- **Primary**: ImagingStudy
- **Related**: DiagnosticReport (radiology report), ServiceRequest

### API Endpoints
```
GET    /api/imaging/{patient_id}                    # Get patient studies
GET    /api/imaging/study/{study_id}                # Get study details
POST   /api/imaging/upload                          # Upload DICOM
GET    /api/imaging/{study_id}/dicom/{instance_id}  # Get DICOM instance
POST   /api/imaging/export/{study_id}               # Export study
```

---

## 4.6 Documentation Module

### Responsibilities
- Clinical notes (progress notes, SOAP notes)
- Encounter documentation
- Note templates
- Note sharing with care team
- Quality measure documentation

### Key Components

**Frontend**:
```typescript
// modules/documentation/context/DocumentationContext.tsx
interface DocumentationState {
  notes: DocumentReference[];
  templates: NoteTemplate[];
  currentNote: DocumentReference | null;
  loading: boolean;
}

const DocumentationContext = {
  // Actions
  loadNotes: (patientId: string) => Promise<void>
  createNote: (note: NoteInput) => Promise<DocumentReference>
  updateNote: (noteId: string, content: string) => Promise<void>
  signNote: (noteId: string) => Promise<void>
  shareNote: (noteId: string, recipientIds: string[]) => Promise<void>
  loadTemplates: (specialty: string) => Promise<void>

  // Events
  - documentation.created
  - documentation.signed
  - documentation.shared
}
```

**Backend**:
```python
# modules/documentation/router.py
@router.get("/{patient_id}")
async def get_patient_notes(
    patient_id: str,
    type: str = None
) -> List[DocumentReference]:
    """Get patient clinical notes from HAPI"""
    pass

@router.post("/")
async def create_note(
    note: NoteInput,
    current_user: User = Depends(get_current_user)
) -> DocumentReference:
    """
    Create clinical note:
    1. Validate note content
    2. Create DocumentReference in HAPI
    3. Store note content (Base64 in attachment)
    4. Link to encounter if provided
    5. Publish documentation.created event
    """
    pass

@router.post("/{note_id}/sign")
async def sign_note(
    note_id: str,
    current_user: User = Depends(get_current_user)
) -> DocumentReference:
    """Sign and finalize note (add digital signature)"""
    pass

@router.get("/templates")
async def get_note_templates(
    specialty: str = None
) -> List[NoteTemplate]:
    """Get note templates by specialty"""
    pass

# modules/documentation/service.py
class DocumentationService:
    async def apply_template(
        self,
        template_id: str,
        patient_data: dict
    ) -> str:
        """Apply template and populate with patient data"""
        pass

    async def extract_quality_measures(
        self,
        note_content: str
    ) -> dict:
        """Extract quality measure data from note"""
        pass
```

### FHIR Resources
- **Primary**: DocumentReference, Composition
- **Related**: Encounter, Provenance

### API Endpoints
```
GET    /api/documentation/{patient_id}     # Get patient notes
POST   /api/documentation                  # Create note
PUT    /api/documentation/{id}             # Update note
POST   /api/documentation/{id}/sign        # Sign note
POST   /api/documentation/{id}/share       # Share note
GET    /api/documentation/templates        # Get templates
```

---

## 4.7 Clinical Decision Support (CDS) Module

### Responsibilities
- CDS Hooks integration
- Clinical rules engine
- Drug interaction alerts
- Allergy alerts
- Clinical guideline recommendations
- Preventive care reminders

### Key Components

**Frontend**:
```typescript
// modules/cds/context/CDSContext.tsx
interface CDSState {
  cards: CDSCard[];
  alerts: CDSAlert[];
  recommendations: CDSRecommendation[];
  loading: boolean;
}

const CDSContext = {
  // Actions
  triggerCDSHook: (hookType: string, context: any) => Promise<CDSCard[]>
  dismissCard: (cardId: string) => Promise<void>
  acceptRecommendation: (recommendationId: string) => Promise<void>

  // Events
  - cds.card.displayed
  - cds.recommendation.accepted
  - cds.alert.dismissed
}
```

**Backend**:
```python
# modules/cds/router.py
@router.post("/cds-services/discovery")
async def cds_discovery() -> dict:
    """
    CDS Hooks discovery endpoint.
    Returns list of available CDS services.
    """
    return {
        "services": [
            {
                "hook": "medication-prescribe",
                "title": "Drug Safety Advisor",
                "description": "Checks for drug interactions and allergies",
                "id": "drug-safety-advisor"
            },
            {
                "hook": "order-select",
                "title": "Duplicate Order Check",
                "description": "Checks for duplicate orders",
                "id": "duplicate-order-check"
            }
        ]
    }

@router.post("/cds-services/drug-safety-advisor")
async def drug_safety_hook(
    request: CDSHookRequest
) -> CDSHookResponse:
    """
    CDS Hook: medication-prescribe

    Checks:
    1. Drug-drug interactions
    2. Drug-allergy interactions
    3. Duplicate therapy
    4. Contraindications

    Returns CDS cards with warnings/recommendations
    """
    pass

# modules/cds/service.py
class CDSService:
    async def run_clinical_rules(
        self,
        patient_id: str,
        context: dict
    ) -> List[CDSCard]:
        """Execute clinical decision support rules"""
        pass

    async def check_preventive_care(
        self,
        patient: dict
    ) -> List[CDSRecommendation]:
        """Check for due preventive care (vaccines, screenings)"""
        pass
```

### CDS Hooks Supported
- **medication-prescribe**: Triggered when prescribing medication
- **order-select**: Triggered when selecting an order
- **patient-view**: Triggered when viewing patient chart
- **encounter-start**: Triggered at start of encounter

### API Endpoints
```
POST   /api/cds/cds-services/discovery              # CDS Hooks discovery
POST   /api/cds/cds-services/drug-safety-advisor    # Drug safety hook
POST   /api/cds/cds-services/duplicate-order-check  # Duplicate order hook
GET    /api/cds/recommendations/{patient_id}        # Get recommendations
```

---

## 5. Data Architecture

### 5.1 Core FHIR Resources

WintEHR uses 15 primary FHIR R4 resources, all stored in HAPI FHIR JPA Server:

#### Patient Management Resources
```
Patient          - Demographics, identifiers, contacts
Practitioner     - Healthcare providers, credentials
Organization     - Healthcare facilities, departments
Location         - Physical locations, rooms, beds
```

#### Clinical Resources
```
Encounter        - Patient visits, admissions, appointments
Condition        - Diagnoses, problems, health concerns
AllergyIntolerance - Drug/environmental allergies, reactions
```

#### Medication Resources
```
MedicationRequest  - Prescriptions, orders
MedicationDispense - Pharmacy dispensing records
MedicationStatement - Patient-reported medication history
```

#### Diagnostic Resources
```
Observation       - Lab results, vitals, measurements
DiagnosticReport  - Lab reports, imaging reports
ServiceRequest    - Orders for labs, imaging, procedures
ImagingStudy      - DICOM metadata, series information
```

#### Documentation Resources
```
DocumentReference - Clinical documents, scanned records
```

### 5.2 FHIR Resource Relationships

```
Patient (Root)
├── Encounter (subject → Patient)
│   ├── Condition (subject → Patient, encounter → Encounter)
│   ├── Observation (subject → Patient, encounter → Encounter)
│   ├── DiagnosticReport (subject → Patient, encounter → Encounter)
│   │   └── Observation (result references)
│   ├── ServiceRequest (subject → Patient, encounter → Encounter)
│   │   ├── DiagnosticReport (basedOn → ServiceRequest)
│   │   └── ImagingStudy (basedOn → ServiceRequest)
│   ├── MedicationRequest (subject → Patient, encounter → Encounter)
│   │   └── MedicationDispense (authorizingPrescription → MedicationRequest)
│   └── DocumentReference (subject → Patient, context.encounter → Encounter)
├── AllergyIntolerance (patient → Patient)
└── MedicationStatement (subject → Patient)
```

### 5.3 Database Schema (HAPI FHIR JPA)

HAPI FHIR JPA Server manages all database tables automatically. Key tables:

#### Core Resource Tables
```sql
-- Primary resource storage (all FHIR resources)
HFJ_RESOURCE (
    RES_ID BIGINT PRIMARY KEY,
    RES_TYPE VARCHAR(40),        -- 'Patient', 'Observation', etc.
    RES_VERSION VARCHAR(7),      -- FHIR version
    RES_DELETED_AT TIMESTAMP,    -- Soft delete
    RES_PUBLISHED TIMESTAMP,     -- Creation time
    RES_UPDATED TIMESTAMP,       -- Last update time
    RES_TEXT CLOB,               -- Narrative text
    RES_ENCODING VARCHAR(5),     -- JSON or XML
    RES_VER BIGINT               -- Version number
)

-- JSON/XML content storage
HFJ_RES_VER (
    PID BIGINT PRIMARY KEY,
    RES_ID BIGINT,               -- FK to HFJ_RESOURCE
    RES_TEXT CLOB,               -- Full FHIR JSON/XML
    RES_ENCODING VARCHAR(5),
    RES_VER BIGINT
)
```

#### Search Parameter Indexes
```sql
-- String search parameters (name, identifier, etc.)
HFJ_SPIDX_STRING (
    SP_ID BIGINT PRIMARY KEY,
    RES_ID BIGINT,               -- FK to HFJ_RESOURCE
    SP_NAME VARCHAR(100),        -- Parameter name (e.g., 'name')
    SP_VALUE_NORMALIZED VARCHAR(200), -- Normalized value for searching
    SP_VALUE_EXACT VARCHAR(200), -- Original value
    HASH_IDENTITY BIGINT         -- Hash for fast lookup
)

-- Token search parameters (identifiers, codes, status)
HFJ_SPIDX_TOKEN (
    SP_ID BIGINT PRIMARY KEY,
    RES_ID BIGINT,
    SP_NAME VARCHAR(100),
    SP_SYSTEM VARCHAR(200),      -- Code system URL
    SP_VALUE VARCHAR(200),       -- Code value
    HASH_IDENTITY BIGINT,
    HASH_SYS BIGINT,
    HASH_SYS_AND_VALUE BIGINT,
    HASH_VALUE BIGINT
)

-- Date search parameters (birthdate, date, etc.)
HFJ_SPIDX_DATE (
    SP_ID BIGINT PRIMARY KEY,
    RES_ID BIGINT,
    SP_NAME VARCHAR(100),
    SP_VALUE_LOW TIMESTAMP,      -- Range start
    SP_VALUE_HIGH TIMESTAMP,     -- Range end
    SP_VALUE_LOW_DATE_ORDINAL INT,
    SP_VALUE_HIGH_DATE_ORDINAL INT
)

-- Reference search parameters (subject, patient, encounter)
HFJ_SPIDX_REF (
    SP_ID BIGINT PRIMARY KEY,
    RES_ID BIGINT,
    SP_NAME VARCHAR(100),
    TARGET_RESOURCE_ID BIGINT,   -- FK to referenced resource
    TARGET_RESOURCE_TYPE VARCHAR(40)
)

-- Quantity search parameters (value[x] with units)
HFJ_SPIDX_QUANTITY (
    SP_ID BIGINT PRIMARY KEY,
    RES_ID BIGINT,
    SP_NAME VARCHAR(100),
    SP_VALUE DOUBLE,             -- Numeric value
    SP_SYSTEM VARCHAR(200),      -- Unit system (UCUM)
    SP_UNITS VARCHAR(200)        -- Unit code
)

-- URI search parameters (url, system)
HFJ_SPIDX_URI (
    SP_ID BIGINT PRIMARY KEY,
    RES_ID BIGINT,
    SP_NAME VARCHAR(100),
    SP_URI VARCHAR(500)
)
```

#### Resource Links and History
```sql
-- Resource reference tracking
HFJ_RES_LINK (
    PID BIGINT PRIMARY KEY,
    SRC_RESOURCE_ID BIGINT,      -- Source resource
    TARGET_RESOURCE_ID BIGINT,   -- Target resource
    SRC_PATH VARCHAR(500),       -- FHIRPath expression
    TARGET_RESOURCE_TYPE VARCHAR(40)
)

-- Resource tags, profiles, security labels
HFJ_RES_TAG (
    PID BIGINT PRIMARY KEY,
    RES_ID BIGINT,
    TAG_ID BIGINT,               -- FK to HFJ_TAG_DEF
    TAG_TYPE VARCHAR(40)         -- 'TAG', 'PROFILE', 'SECURITY'
)

HFJ_TAG_DEF (
    TAG_ID BIGINT PRIMARY KEY,
    TAG_SYSTEM VARCHAR(200),
    TAG_CODE VARCHAR(200),
    TAG_DISPLAY VARCHAR(200),
    TAG_TYPE VARCHAR(40)
)
```

### 5.4 Application Database Schema

Custom application tables (non-FHIR data):

```sql
-- User management (authentication/authorization)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    practitioner_id VARCHAR(255),    -- FK to FHIR Practitioner.id
    role VARCHAR(50) NOT NULL,       -- 'physician', 'nurse', 'pharmacist', etc.
    active BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit trail (HIPAA compliance)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT NOW(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,    -- 'CREATE', 'READ', 'UPDATE', 'DELETE'
    resource_type VARCHAR(40),       -- FHIR resource type
    resource_id VARCHAR(255),        -- FHIR resource ID
    patient_id VARCHAR(255),         -- Patient identifier (for patient-related actions)
    ip_address INET,
    user_agent TEXT,
    details JSONB,                   -- Additional context
    success BOOLEAN DEFAULT true
);

CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp);
CREATE INDEX idx_audit_patient ON audit_log(patient_id, timestamp);
CREATE INDEX idx_audit_action ON audit_log(action, timestamp);

-- Event bus persistence (optional - for event replay)
CREATE TABLE event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT NOW(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    published_by VARCHAR(100),       -- Module name
    processed BOOLEAN DEFAULT false,
    retry_count INT DEFAULT 0
);

CREATE INDEX idx_event_type ON event_log(event_type, timestamp);
CREATE INDEX idx_event_processed ON event_log(processed, timestamp);

-- User preferences and UI state
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB,
    UNIQUE(user_id, preference_key)
);

-- Session management (for JWT blacklist/revocation)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_jti VARCHAR(255) UNIQUE NOT NULL,  -- JWT ID
    issued_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_session_token ON user_sessions(token_jti);
CREATE INDEX idx_session_user ON user_sessions(user_id, expires_at);
```

### 5.5 Data Flow Patterns

#### Pattern 1: Resource Creation
```
Frontend Component
    ↓ (POST /api/medications)
Backend Router (FastAPI)
    ↓ (Validate input, check permissions)
Backend Service (Business logic)
    ↓ (Check drug interactions, allergies)
FHIR Client (fhirpy)
    ↓ (POST /fhir/MedicationRequest)
HAPI FHIR Server
    ↓ (Validate FHIR, generate ID, index search params)
PostgreSQL Database
    ↓ (Store resource, create indexes)
Backend Service
    ↓ (Publish event)
Event Bus
    ↓ (Notify subscribers)
Other Modules (e.g., Pharmacy)
```

#### Pattern 2: Search/Read
```
Frontend Component
    ↓ (GET /api/results/observations?patient=123&category=laboratory)
Backend Router
    ↓ (Check permissions, parse filters)
Backend Service
    ↓ (Translate to FHIR search)
FHIR Client
    ↓ (GET /fhir/Observation?patient=Patient/123&category=laboratory)
HAPI FHIR Server
    ↓ (Query search parameter indexes)
PostgreSQL Database
    ↓ (Join HFJ_RESOURCE + HFJ_SPIDX_* tables)
HAPI FHIR Server
    ↓ (Construct FHIR Bundle)
Frontend Component
    ↓ (Render observations)
```

#### Pattern 3: Event-Driven Updates
```
Medications Module
    ↓ (Publish 'medications.prescribed' event)
Event Bus (in-memory or Redis)
    ↓ (Broadcast to subscribers)
├── Pharmacy Module
│       ↓ (Update prescription queue UI)
├── Results Module
│       ↓ (Check for baseline labs if needed)
└── CDS Module
        ↓ (Re-evaluate clinical rules)
```

### 5.6 Caching Strategy

#### Redis Cache Layers
```
L1: Hot Patient Data (5 min TTL)
- Current patient demographics
- Active medications
- Recent vitals
Key pattern: patient:{id}:summary

L2: Search Results (10 min TTL)
- Recent search queries
- Observation trends
- Medication lists
Key pattern: search:{hash}

L3: Reference Data (24 hour TTL)
- Drug interaction rules
- Lab reference ranges
- Code system lookups
Key pattern: reference:{type}:{code}
```

#### Cache Invalidation
```python
# core/cache/invalidator.py
class CacheInvalidator:
    async def invalidate_patient_data(self, patient_id: str):
        """Invalidate patient cache when resources updated"""
        await redis.delete(f"patient:{patient_id}:*")

    async def invalidate_search_cache(self, resource_type: str, patient_id: str = None):
        """Invalidate search result caches"""
        pattern = f"search:*{resource_type}*"
        if patient_id:
            pattern = f"search:*patient={patient_id}*"

        keys = await redis.keys(pattern)
        if keys:
            await redis.delete(*keys)

# Event listener for cache invalidation
@event_bus.subscribe('medications.prescribed')
async def invalidate_medication_cache(event: dict):
    patient_id = event['patient_id']
    await cache.invalidate_patient_data(patient_id)
    await cache.invalidate_search_cache('MedicationRequest', patient_id)
```

### 5.7 Data Migration Strategy (If Applicable)

For organizations with existing EHR data:

#### Step 1: Data Assessment
```
- Identify source systems (HL7 v2, CDA documents, proprietary formats)
- Map source data to FHIR resources
- Identify data quality issues
- Estimate data volume
```

#### Step 2: ETL Pipeline
```python
# scripts/migration/etl_pipeline.py
class FHIRMigrationPipeline:
    async def extract_from_source(self, source_type: str):
        """Extract data from source system (HL7, CDA, SQL)"""
        pass

    async def transform_to_fhir(self, source_data: dict) -> dict:
        """Transform source data to FHIR R4 resources"""
        pass

    async def validate_fhir(self, resource: dict) -> bool:
        """Validate against FHIR R4 specification"""
        pass

    async def load_to_hapi(self, resource: dict):
        """Load validated resource into HAPI FHIR"""
        async with fhir_client.transaction() as tx:
            await tx.create(resource)
```

#### Step 3: Validation
```
- Verify resource counts match source
- Validate resource references
- Test search parameters
- Run integration tests with UI
```

---

## 6. API Design

### 6.1 API Architecture

WintEHR exposes two API layers:

1. **FHIR API** (HAPI FHIR): Standard FHIR R4 RESTful API
   - Base URL: `http://localhost:8080/fhir/`
   - Direct FHIR operations (search, read, create, update, delete)
   - Standard FHIR search parameters
   - FHIR Bundle responses

2. **Business API** (FastAPI): Domain-specific convenience endpoints
   - Base URL: `http://localhost:8000/api/`
   - Domain-specific operations (prescribe medication, order lab)
   - Simplified request/response formats
   - Business logic and validations

### 6.2 FHIR API (HAPI FHIR)

#### Base Operations
```
# Create
POST   /fhir/Patient                    # Create patient
POST   /fhir/MedicationRequest          # Create medication order
POST   /fhir/Observation                # Create observation

# Read
GET    /fhir/Patient/{id}               # Get patient by ID
GET    /fhir/Observation/{id}           # Get observation by ID

# Update
PUT    /fhir/Patient/{id}               # Update patient
PATCH  /fhir/Patient/{id}               # Partial update

# Delete (soft delete)
DELETE /fhir/Patient/{id}               # Mark patient as deleted

# Search
GET    /fhir/Patient?name=Smith         # Search patients by name
GET    /fhir/Observation?patient=123&category=vital-signs

# History
GET    /fhir/Patient/{id}/_history      # Patient version history
GET    /fhir/_history                   # Global history

# Batch/Transaction
POST   /fhir                            # Batch or transaction bundle
```

#### Search Examples
```http
# Search patients by name
GET /fhir/Patient?name=Smith&birthdate=ge1970-01-01

# Search active medications for patient
GET /fhir/MedicationRequest?patient=Patient/123&status=active

# Search lab observations with date range
GET /fhir/Observation?patient=Patient/123&category=laboratory&date=ge2024-01-01&date=le2024-12-31

# Search with _include (include referenced resources)
GET /fhir/MedicationRequest?patient=Patient/123&_include=MedicationRequest:medication

# Search with _revinclude (include resources that reference this)
GET /fhir/Patient/123?_revinclude=Observation:patient

# Complex search with chaining
GET /fhir/DiagnosticReport?subject.name=Smith&category=LAB

# Pagination
GET /fhir/Observation?patient=Patient/123&_count=20&_offset=40
```

#### Patient $everything Operation
```http
# Get all resources in patient compartment
GET /fhir/Patient/123/$everything

Response: Bundle with all resources related to patient 123
- Patient resource
- All Encounters
- All Conditions
- All Observations
- All MedicationRequests
- All DiagnosticReports
- All ImagingStudies
- All DocumentReferences
```

### 6.3 Business API (FastAPI)

#### 6.3.1 Patient Module API

```http
# Patient registration
POST /api/patients
Content-Type: application/json
Authorization: Bearer {jwt_token}

Request:
{
  "firstName": "John",
  "lastName": "Smith",
  "birthDate": "1970-05-15",
  "gender": "male",
  "ssn": "123-45-6789",
  "mrn": "MR-2024-001",
  "phone": "+1-555-1234",
  "email": "john.smith@example.com",
  "address": {
    "line": ["123 Main St", "Apt 4B"],
    "city": "Boston",
    "state": "MA",
    "postalCode": "02101"
  },
  "insurance": {
    "payer": "Blue Cross Blue Shield",
    "memberId": "BCB-12345",
    "groupNumber": "GRP-999"
  }
}

Response: 201 Created
{
  "id": "Patient/abc-123",
  "mrn": "MR-2024-001",
  "fullName": "John Smith",
  "birthDate": "1970-05-15",
  "age": 54,
  "createdAt": "2024-01-15T10:30:00Z"
}

# Search patients (simplified)
GET /api/patients?q=Smith&limit=20&offset=0

Response: 200 OK
{
  "total": 1,
  "offset": 0,
  "limit": 20,
  "patients": [
    {
      "id": "Patient/abc-123",
      "mrn": "MR-2024-001",
      "fullName": "John Smith",
      "birthDate": "1970-05-15",
      "age": 54,
      "gender": "male",
      "phone": "+1-555-1234"
    }
  ]
}

# Get patient summary
GET /api/patients/{id}/summary

Response: 200 OK
{
  "demographics": {...},
  "activeProblems": [...],
  "activeMedications": [...],
  "allergies": [...],
  "recentVitals": {...},
  "upcomingAppointments": [...]
}
```

#### 6.3.2 Medications Module API

```http
# Prescribe medication
POST /api/medications
Content-Type: application/json
Authorization: Bearer {jwt_token}

Request:
{
  "patientId": "Patient/abc-123",
  "encounterId": "Encounter/enc-456",
  "medication": {
    "code": "197361",
    "display": "Lisinopril 10 MG Oral Tablet",
    "system": "http://www.nlm.nih.gov/research/umls/rxnorm"
  },
  "dosage": {
    "dose": 10,
    "unit": "mg",
    "frequency": "once daily",
    "route": "oral",
    "duration": 90,
    "durationUnit": "days"
  },
  "indication": "Hypertension",
  "notes": "Take with food if stomach upset"
}

Response: 201 Created
{
  "id": "MedicationRequest/med-789",
  "patientId": "Patient/abc-123",
  "status": "active",
  "medication": "Lisinopril 10 MG Oral Tablet",
  "prescribedAt": "2024-01-15T10:45:00Z",
  "warnings": [
    {
      "severity": "moderate",
      "type": "drug-interaction",
      "message": "May increase potassium levels. Monitor potassium.",
      "affectedMedications": ["Spironolactone 25 MG"]
    }
  ]
}

# Check drug interactions
POST /api/medications/check-interactions
Request:
{
  "patientId": "Patient/abc-123",
  "newMedicationCode": "197361"
}

Response: 200 OK
{
  "interactions": [
    {
      "severity": "moderate",
      "drug1": "Lisinopril",
      "drug2": "Ibuprofen",
      "description": "NSAIDs may reduce antihypertensive effect",
      "recommendation": "Monitor blood pressure closely"
    }
  ],
  "allergyConflicts": [],
  "duplicateTherapy": false
}

# Discontinue medication
POST /api/medications/{id}/discontinue
Request:
{
  "reason": "Medication no longer needed",
  "discontinueDate": "2024-01-15"
}

Response: 200 OK
{
  "id": "MedicationRequest/med-789",
  "status": "stopped",
  "discontinuedAt": "2024-01-15T11:00:00Z"
}
```

#### 6.3.3 Orders Module API

```http
# Place lab order
POST /api/orders/lab
Request:
{
  "patientId": "Patient/abc-123",
  "encounterId": "Encounter/enc-456",
  "tests": [
    {
      "code": "2093-3",
      "display": "Cholesterol Total",
      "system": "http://loinc.org"
    },
    {
      "code": "2085-9",
      "display": "HDL Cholesterol",
      "system": "http://loinc.org"
    }
  ],
  "priority": "routine",
  "clinicalInfo": "Annual wellness check",
  "notes": "Fasting required"
}

Response: 201 Created
{
  "id": "ServiceRequest/order-111",
  "patientId": "Patient/abc-123",
  "orderType": "laboratory",
  "status": "active",
  "tests": ["Cholesterol Total", "HDL Cholesterol"],
  "orderedAt": "2024-01-15T09:00:00Z",
  "orderedBy": "Dr. Jane Wilson"
}

# Place imaging order
POST /api/orders/imaging
Request:
{
  "patientId": "Patient/abc-123",
  "encounterId": "Encounter/enc-456",
  "modality": "CT",
  "bodyRegion": "chest",
  "indication": "Evaluate for pulmonary embolism",
  "urgency": "stat",
  "contrast": true
}

Response: 201 Created
{
  "id": "ServiceRequest/order-222",
  "patientId": "Patient/abc-123",
  "orderType": "imaging",
  "modality": "CT",
  "bodyRegion": "chest",
  "status": "active",
  "urgency": "stat",
  "orderedAt": "2024-01-15T14:30:00Z"
}

# Get order status
GET /api/orders/{id}

Response: 200 OK
{
  "id": "ServiceRequest/order-111",
  "status": "completed",
  "orderedAt": "2024-01-15T09:00:00Z",
  "collectedAt": "2024-01-15T10:00:00Z",
  "resultAvailableAt": "2024-01-15T14:00:00Z",
  "results": [
    {
      "test": "Cholesterol Total",
      "value": 185,
      "unit": "mg/dL",
      "referenceRange": "< 200 mg/dL",
      "interpretation": "normal"
    }
  ]
}
```

#### 6.3.4 Results Module API

```http
# Get lab results for patient
GET /api/results/labs?patientId=Patient/abc-123&category=chemistry&fromDate=2024-01-01

Response: 200 OK
{
  "total": 3,
  "results": [
    {
      "id": "DiagnosticReport/report-333",
      "date": "2024-01-15T14:00:00Z",
      "category": "chemistry",
      "status": "final",
      "tests": [
        {
          "name": "Cholesterol Total",
          "value": 185,
          "unit": "mg/dL",
          "referenceRange": "< 200 mg/dL",
          "interpretation": "normal"
        },
        {
          "name": "HDL Cholesterol",
          "value": 45,
          "unit": "mg/dL",
          "referenceRange": "> 40 mg/dL",
          "interpretation": "normal"
        }
      ]
    }
  ]
}

# Get result trends
GET /api/results/trends?patientId=Patient/abc-123&testCode=2093-3&period=6m

Response: 200 OK
{
  "test": "Cholesterol Total",
  "unit": "mg/dL",
  "referenceRange": "< 200 mg/dL",
  "dataPoints": [
    {"date": "2023-07-15", "value": 195},
    {"date": "2023-10-15", "value": 190},
    {"date": "2024-01-15", "value": 185}
  ],
  "trend": "decreasing",
  "inRange": true
}
```

#### 6.3.5 Imaging Module API

```http
# Get imaging studies for patient
GET /api/imaging/studies?patientId=Patient/abc-123&modality=CT

Response: 200 OK
{
  "total": 2,
  "studies": [
    {
      "id": "ImagingStudy/study-444",
      "date": "2024-01-15T15:00:00Z",
      "modality": "CT",
      "bodyRegion": "chest",
      "description": "CT Chest with Contrast",
      "status": "available",
      "numberOfSeries": 3,
      "numberOfInstances": 120
    }
  ]
}

# Get DICOM metadata
GET /api/imaging/studies/{studyId}/metadata

Response: 200 OK
{
  "studyInstanceUID": "1.2.840.113619.2.55.3...",
  "patientId": "Patient/abc-123",
  "modality": "CT",
  "series": [
    {
      "seriesInstanceUID": "1.2.840.113619.2.55.3...",
      "seriesNumber": 1,
      "modality": "CT",
      "bodyPartExamined": "CHEST",
      "numberOfInstances": 45,
      "instances": [...]
    }
  ]
}

# Get DICOM image (WADO-RS)
GET /api/imaging/studies/{studyId}/series/{seriesId}/instances/{instanceId}

Response: 200 OK
Content-Type: application/dicom
[Binary DICOM file]
```

### 6.4 Authentication & Authorization

#### JWT Authentication Flow
```http
# Login
POST /api/auth/login
Content-Type: application/json

Request:
{
  "username": "dr.wilson",
  "password": "secure_password_here"
}

Response: 200 OK
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "username": "dr.wilson",
    "role": "physician",
    "practitionerId": "Practitioner/prac-789"
  }
}

# Refresh token
POST /api/auth/refresh
Content-Type: application/json

Request:
{
  "refreshToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}

Response: 200 OK
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}

# Logout (revoke tokens)
POST /api/auth/logout
Authorization: Bearer {jwt_token}

Response: 204 No Content
```

#### Authorization Headers
```http
# All authenticated requests must include JWT
GET /api/patients/123/summary
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Role-Based Access Control (RBAC)
```python
# Roles and permissions
ROLES = {
    "physician": [
        "patient:read", "patient:write",
        "medication:prescribe", "medication:discontinue",
        "order:place", "order:cancel",
        "results:view", "imaging:view",
        "document:read", "document:write"
    ],
    "nurse": [
        "patient:read", "patient:write",
        "medication:view", "medication:administer",
        "order:view", "results:view",
        "vitals:record", "document:read"
    ],
    "pharmacist": [
        "patient:read",
        "medication:view", "medication:dispense",
        "medication:verify", "medication:counsel"
    ],
    "lab_technician": [
        "patient:read",
        "order:view", "results:create", "results:view"
    ],
    "admin": ["*"]  # All permissions
}

# Permission check in endpoint
@router.post("/medications")
async def prescribe_medication(
    medication: MedicationInput,
    current_user: User = Depends(get_current_user),
    _: None = Depends(require_permission("medication:prescribe"))
):
    # Only users with medication:prescribe permission can access
    pass
```

### 6.5 Error Handling

#### Standard Error Response Format
```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Patient with ID 'Patient/999' not found",
    "details": {
      "resourceType": "Patient",
      "resourceId": "999"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/patients/999/summary",
    "requestId": "req-abc-123"
  }
}
```

#### HTTP Status Codes
```
200 OK                  - Successful GET, PUT, PATCH
201 Created             - Successful POST (resource created)
204 No Content          - Successful DELETE
400 Bad Request         - Invalid input, validation error
401 Unauthorized        - Missing or invalid authentication
403 Forbidden           - Insufficient permissions
404 Not Found           - Resource does not exist
409 Conflict            - Resource conflict (duplicate, version mismatch)
422 Unprocessable Entity - FHIR validation error
429 Too Many Requests   - Rate limit exceeded
500 Internal Server Error - Unexpected server error
503 Service Unavailable - HAPI FHIR server down
```

#### Error Codes
```python
ERROR_CODES = {
    "VALIDATION_ERROR": 400,
    "AUTHENTICATION_FAILED": 401,
    "INSUFFICIENT_PERMISSIONS": 403,
    "RESOURCE_NOT_FOUND": 404,
    "DUPLICATE_RESOURCE": 409,
    "FHIR_VALIDATION_ERROR": 422,
    "RATE_LIMIT_EXCEEDED": 429,
    "DRUG_INTERACTION_ERROR": 422,
    "ALLERGY_CONFLICT": 422,
    "HAPI_SERVER_ERROR": 503,
    "INTERNAL_ERROR": 500
}
```

#### Error Handling Example
```python
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

class WintEHRException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}

@app.exception_handler(WintEHRException)
async def wintehr_exception_handler(request: Request, exc: WintEHRException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "path": str(request.url.path),
                "requestId": request.state.request_id
            }
        }
    )

# Usage in endpoint
@router.get("/patients/{patient_id}")
async def get_patient(patient_id: str, fhir: WintEHRFHIRClient = Depends(get_fhir_client)):
    try:
        patient = await fhir.client.resources('Patient').search(_id=patient_id).first()
        if not patient:
            raise WintEHRException(
                code="RESOURCE_NOT_FOUND",
                message=f"Patient with ID '{patient_id}' not found",
                status_code=404,
                details={"resourceType": "Patient", "resourceId": patient_id}
            )
        return patient.serialize()
    except Exception as e:
        logger.error(f"Error fetching patient {patient_id}: {e}")
        raise WintEHRException(
            code="INTERNAL_ERROR",
            message="Failed to fetch patient",
            status_code=500
        )
```

### 6.6 Rate Limiting

```python
# core/middleware/rate_limiter.py
from fastapi import Request, HTTPException
from redis import asyncio as aioredis
import time

class RateLimiter:
    def __init__(self, redis_client: aioredis.Redis):
        self.redis = redis_client

    async def check_rate_limit(self, key: str, limit: int, window: int) -> bool:
        """
        Check if request is within rate limit

        Args:
            key: Rate limit key (e.g., user ID, IP address)
            limit: Max requests allowed
            window: Time window in seconds

        Returns:
            True if within limit, raises HTTPException if exceeded
        """
        current_time = int(time.time())
        window_key = f"rate_limit:{key}:{current_time // window}"

        count = await self.redis.incr(window_key)
        if count == 1:
            await self.redis.expire(window_key, window)

        if count > limit:
            raise HTTPException(
                status_code=429,
                detail={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Rate limit exceeded: {limit} requests per {window} seconds",
                        "retryAfter": window - (current_time % window)
                    }
                }
            )

        return True

# Apply rate limits
RATE_LIMITS = {
    "default": (100, 60),      # 100 requests per minute
    "auth": (5, 60),           # 5 login attempts per minute
    "search": (30, 60),        # 30 searches per minute
    "prescribe": (20, 60)      # 20 prescriptions per minute
}

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    rate_limiter = request.app.state.rate_limiter
    user_id = request.state.user_id if hasattr(request.state, "user_id") else request.client.host

    # Determine rate limit based on endpoint
    limit, window = RATE_LIMITS.get("default")
    if "/auth/" in request.url.path:
        limit, window = RATE_LIMITS["auth"]
    elif "/search" in request.url.path:
        limit, window = RATE_LIMITS["search"]
    elif "/medications" in request.url.path:
        limit, window = RATE_LIMITS["prescribe"]

    await rate_limiter.check_rate_limit(user_id, limit, window)

    response = await call_next(request)
    return response
```

### 6.7 API Versioning

```python
# Support multiple API versions
API_VERSION = "v1"

# Version in URL path
@app.include_router(patients_router, prefix=f"/api/{API_VERSION}/patients")
@app.include_router(medications_router, prefix=f"/api/{API_VERSION}/medications")

# Version negotiation via Accept header
@app.middleware("http")
async def version_negotiation(request: Request, call_next):
    accept_header = request.headers.get("Accept", "")
    if "application/vnd.wintehr.v2+json" in accept_header:
        request.state.api_version = "v2"
    else:
        request.state.api_version = "v1"

    response = await call_next(request)
    return response
```

---

## 7. Security & Compliance

### 7.1 HIPAA Compliance Requirements

WintEHR must comply with HIPAA Security Rule (45 CFR Part 164 Subpart C):

#### Administrative Safeguards
- **Security Management Process**: Risk analysis, risk management, sanctions policy
- **Assigned Security Responsibility**: Designated security officer
- **Workforce Security**: Authorization, supervision, termination procedures
- **Information Access Management**: Access authorization, access establishment/modification
- **Security Awareness and Training**: Security reminders, protection from malicious software
- **Security Incident Procedures**: Response and reporting procedures
- **Contingency Plan**: Data backup plan, disaster recovery plan, emergency mode operation
- **Evaluation**: Periodic technical and non-technical evaluations

#### Physical Safeguards
- **Facility Access Controls**: Contingency operations, facility security plan, access control
- **Workstation Use**: Policies for workstation functions and access
- **Workstation Security**: Physical safeguards to restrict access
- **Device and Media Controls**: Disposal, media re-use, accountability, data backup/storage

#### Technical Safeguards
- **Access Control**: Unique user identification, emergency access, automatic logoff, encryption/decryption
- **Audit Controls**: Hardware, software, and procedural mechanisms to record access
- **Integrity**: Mechanisms to ensure ePHI is not improperly altered or destroyed
- **Person or Entity Authentication**: Verify identity before allowing access
- **Transmission Security**: Integrity controls, encryption

### 7.2 Authentication Implementation

#### Password Requirements
```python
# core/security/password.py
from passlib.context import CryptContext
import re

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

class PasswordValidator:
    @staticmethod
    def validate(password: str) -> tuple[bool, str]:
        """
        Validate password meets security requirements

        Requirements:
        - Minimum 12 characters
        - At least one uppercase letter
        - At least one lowercase letter
        - At least one digit
        - At least one special character
        - Not in common password list
        """
        if len(password) < 12:
            return False, "Password must be at least 12 characters"

        if not re.search(r"[A-Z]", password):
            return False, "Password must contain at least one uppercase letter"

        if not re.search(r"[a-z]", password):
            return False, "Password must contain at least one lowercase letter"

        if not re.search(r"\d", password):
            return False, "Password must contain at least one digit"

        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            return False, "Password must contain at least one special character"

        # Check against common password list (implement as needed)
        if password.lower() in COMMON_PASSWORDS:
            return False, "Password is too common"

        return True, ""

    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using Argon2"""
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return pwd_context.verify(plain_password, hashed_password)
```

#### JWT Token Management
```python
# core/security/jwt_handler.py
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional
import secrets

# Use RS256 (RSA) instead of HS256 for better security
# Generate RSA key pair: openssl genrsa -out private.pem 4096
# Extract public key: openssl rsa -in private.pem -pubout -out public.pem

ALGORITHM = "RS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 30

class JWTHandler:
    def __init__(self, private_key_path: str, public_key_path: str):
        with open(private_key_path, 'r') as f:
            self.private_key = f.read()
        with open(public_key_path, 'r') as f:
            self.public_key = f.read()

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "jti": secrets.token_urlsafe(32),  # Unique token ID for revocation
            "type": "access"
        })

        return jwt.encode(to_encode, self.private_key, algorithm=ALGORITHM)

    def create_refresh_token(self, data: dict) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "jti": secrets.token_urlsafe(32),
            "type": "refresh"
        })

        return jwt.encode(to_encode, self.private_key, algorithm=ALGORITHM)

    def decode_token(self, token: str) -> dict:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, self.public_key, algorithms=[ALGORITHM])

            # Check if token is revoked (check database)
            if await self.is_token_revoked(payload["jti"]):
                raise JWTError("Token has been revoked")

            return payload
        except JWTError as e:
            raise HTTPException(
                status_code=401,
                detail={"error": {"code": "INVALID_TOKEN", "message": str(e)}}
            )

    async def revoke_token(self, jti: str):
        """Revoke token by adding to blacklist"""
        # Store in database or Redis with expiration
        await redis.setex(f"revoked_token:{jti}", REFRESH_TOKEN_EXPIRE_DAYS * 86400, "1")

    async def is_token_revoked(self, jti: str) -> bool:
        """Check if token is revoked"""
        return await redis.exists(f"revoked_token:{jti}") == 1
```

#### Multi-Factor Authentication (MFA)
```python
# core/security/mfa.py
import pyotp
import qrcode
from io import BytesIO

class MFAHandler:
    @staticmethod
    def generate_secret() -> str:
        """Generate TOTP secret for user"""
        return pyotp.random_base32()

    @staticmethod
    def generate_qr_code(username: str, secret: str) -> bytes:
        """Generate QR code for authenticator app setup"""
        totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=username,
            issuer_name="WintEHR"
        )

        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(totp_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        return buffer.getvalue()

    @staticmethod
    def verify_totp(secret: str, token: str) -> bool:
        """Verify TOTP token"""
        totp = pyotp.TOTP(secret)
        return totp.verify(token, valid_window=1)  # Allow 30s window

# Enable MFA for user
@router.post("/auth/mfa/enable")
async def enable_mfa(current_user: User = Depends(get_current_user)):
    secret = MFAHandler.generate_secret()
    qr_code = MFAHandler.generate_qr_code(current_user.username, secret)

    # Store secret temporarily (user must verify before activation)
    await redis.setex(f"mfa_setup:{current_user.id}", 300, secret)

    return {
        "secret": secret,
        "qrCode": base64.b64encode(qr_code).decode(),
        "message": "Scan QR code with authenticator app and verify"
    }

# Verify and activate MFA
@router.post("/auth/mfa/verify")
async def verify_mfa(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    secret = await redis.get(f"mfa_setup:{current_user.id}")
    if not secret:
        raise HTTPException(400, "MFA setup expired")

    if not MFAHandler.verify_totp(secret, token):
        raise HTTPException(400, "Invalid verification code")

    # Activate MFA for user
    current_user.mfa_secret = secret
    current_user.mfa_enabled = True
    await db.commit()

    await redis.delete(f"mfa_setup:{current_user.id}")

    return {"message": "MFA enabled successfully"}
```

### 7.3 Authorization & Access Control

#### Role-Based Access Control (RBAC)
```python
# core/security/rbac.py
from enum import Enum
from typing import List

class Permission(str, Enum):
    # Patient permissions
    PATIENT_READ = "patient:read"
    PATIENT_WRITE = "patient:write"
    PATIENT_DELETE = "patient:delete"

    # Medication permissions
    MEDICATION_VIEW = "medication:view"
    MEDICATION_PRESCRIBE = "medication:prescribe"
    MEDICATION_DISPENSE = "medication:dispense"
    MEDICATION_ADMINISTER = "medication:administer"

    # Order permissions
    ORDER_VIEW = "order:view"
    ORDER_PLACE = "order:place"
    ORDER_CANCEL = "order:cancel"

    # Results permissions
    RESULTS_VIEW = "results:view"
    RESULTS_CREATE = "results:create"

    # Admin permissions
    USER_MANAGE = "user:manage"
    AUDIT_VIEW = "audit:view"
    SYSTEM_CONFIG = "system:config"

class Role(str, Enum):
    PHYSICIAN = "physician"
    NURSE = "nurse"
    PHARMACIST = "pharmacist"
    LAB_TECH = "lab_technician"
    RADIOLOGIST = "radiologist"
    ADMIN = "admin"

ROLE_PERMISSIONS = {
    Role.PHYSICIAN: [
        Permission.PATIENT_READ, Permission.PATIENT_WRITE,
        Permission.MEDICATION_VIEW, Permission.MEDICATION_PRESCRIBE,
        Permission.ORDER_VIEW, Permission.ORDER_PLACE, Permission.ORDER_CANCEL,
        Permission.RESULTS_VIEW
    ],
    Role.NURSE: [
        Permission.PATIENT_READ, Permission.PATIENT_WRITE,
        Permission.MEDICATION_VIEW, Permission.MEDICATION_ADMINISTER,
        Permission.ORDER_VIEW, Permission.RESULTS_VIEW
    ],
    Role.PHARMACIST: [
        Permission.PATIENT_READ,
        Permission.MEDICATION_VIEW, Permission.MEDICATION_DISPENSE
    ],
    Role.LAB_TECH: [
        Permission.PATIENT_READ,
        Permission.ORDER_VIEW, Permission.RESULTS_VIEW, Permission.RESULTS_CREATE
    ],
    Role.ADMIN: list(Permission)  # All permissions
}

def require_permission(permission: Permission):
    """Dependency to check if user has required permission"""
    async def permission_checker(current_user: User = Depends(get_current_user)):
        user_permissions = ROLE_PERMISSIONS.get(current_user.role, [])
        if permission not in user_permissions and current_user.role != Role.ADMIN:
            raise HTTPException(
                status_code=403,
                detail={
                    "error": {
                        "code": "INSUFFICIENT_PERMISSIONS",
                        "message": f"User lacks required permission: {permission}"
                    }
                }
            )
        return current_user
    return permission_checker

# Usage in endpoint
@router.post("/medications")
async def prescribe_medication(
    medication: MedicationInput,
    current_user: User = Depends(require_permission(Permission.MEDICATION_PRESCRIBE))
):
    # Only users with medication:prescribe permission can access
    pass
```

#### Patient Data Access Control
```python
# core/security/patient_access.py
from typing import Optional

class PatientAccessControl:
    @staticmethod
    async def check_patient_access(
        user_id: str,
        patient_id: str,
        db: AsyncSession
    ) -> bool:
        """
        Check if user has access to patient data

        Rules:
        1. Physicians can access their assigned patients
        2. Nurses can access patients on their unit
        3. Pharmacists can access patients with active prescriptions
        4. Admins can access all patients
        5. Emergency access flag bypasses rules (logged)
        """
        # Check patient assignment
        assignment = await db.execute(
            select(PatientAssignment).where(
                PatientAssignment.user_id == user_id,
                PatientAssignment.patient_id == patient_id,
                PatientAssignment.active == True
            )
        )
        if assignment.scalar_one_or_none():
            return True

        # Check same care unit
        user = await db.get(User, user_id)
        if user.role == Role.NURSE:
            patient = await fhir_client.resources('Patient').search(_id=patient_id).first()
            if patient and patient.get('managingOrganization'):
                # Check if nurse is assigned to same unit
                pass

        return False

    @staticmethod
    async def log_patient_access(
        user_id: str,
        patient_id: str,
        action: str,
        emergency: bool = False
    ):
        """Log all patient data access for HIPAA audit trail"""
        await audit_logger.log(
            user_id=user_id,
            action=action,
            resource_type="Patient",
            resource_id=patient_id,
            details={"emergency_access": emergency}
        )

def require_patient_access(patient_id_param: str = "patient_id"):
    """Dependency to check patient data access"""
    async def access_checker(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ):
        # Extract patient_id from path or query params
        patient_id = request.path_params.get(patient_id_param)
        if not patient_id:
            patient_id = request.query_params.get(patient_id_param)

        if not patient_id:
            raise HTTPException(400, "Patient ID required")

        # Check access
        has_access = await PatientAccessControl.check_patient_access(
            current_user.id, patient_id, db
        )

        if not has_access and current_user.role != Role.ADMIN:
            # Log unauthorized access attempt
            await PatientAccessControl.log_patient_access(
                current_user.id, patient_id, "ACCESS_DENIED"
            )
            raise HTTPException(
                status_code=403,
                detail={"error": {"code": "PATIENT_ACCESS_DENIED"}}
            )

        # Log successful access
        await PatientAccessControl.log_patient_access(
            current_user.id, patient_id, "ACCESS_GRANTED"
        )

        return current_user

    return access_checker

# Usage
@router.get("/patients/{patient_id}/summary")
async def get_patient_summary(
    patient_id: str,
    current_user: User = Depends(require_patient_access())
):
    # User has verified access to this patient
    pass
```

### 7.4 Audit Logging

#### Comprehensive Audit Trail
```python
# core/security/audit_logger.py
from datetime import datetime
from typing import Optional, Dict
import json

class AuditLogger:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        user_id: Optional[str],
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        patient_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict] = None,
        success: bool = True
    ):
        """
        Log HIPAA-compliant audit entry

        Required fields per HIPAA:
        - Date and time of event
        - User identification
        - Type of event
        - Patient identification (if applicable)
        - Description of event
        """
        audit_entry = AuditLog(
            timestamp=datetime.utcnow(),
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            patient_id=patient_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=json.dumps(details) if details else None,
            success=success
        )

        self.db.add(audit_entry)
        await self.db.commit()

        # Also log to external SIEM system (e.g., Splunk, ELK)
        await self.forward_to_siem(audit_entry)

    async def forward_to_siem(self, audit_entry: AuditLog):
        """Forward audit log to external SIEM system"""
        # Implement based on SIEM solution (Splunk, ELK, etc.)
        pass

# Middleware to automatically log all API requests
@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    start_time = datetime.utcnow()

    # Extract user info if authenticated
    user_id = None
    if hasattr(request.state, "user"):
        user_id = request.state.user.id

    # Extract patient ID from request (if applicable)
    patient_id = None
    if "patient" in request.path_params:
        patient_id = request.path_params["patient"]
    elif "patientId" in request.query_params:
        patient_id = request.query_params["patientId"]

    # Process request
    try:
        response = await call_next(request)
        success = response.status_code < 400
    except Exception as e:
        success = False
        raise
    finally:
        # Log request
        await audit_logger.log(
            user_id=user_id,
            action=f"{request.method} {request.url.path}",
            patient_id=patient_id,
            ip_address=request.client.host,
            user_agent=request.headers.get("User-Agent"),
            details={
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "duration_ms": (datetime.utcnow() - start_time).total_seconds() * 1000
            },
            success=success
        )

    return response
```

#### Audit Log Queries
```python
# Get audit trail for specific patient
@router.get("/audit/patient/{patient_id}")
async def get_patient_audit_trail(
    patient_id: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    current_user: User = Depends(require_permission(Permission.AUDIT_VIEW)),
    db: AsyncSession = Depends(get_db)
):
    query = select(AuditLog).where(AuditLog.patient_id == patient_id)

    if from_date:
        query = query.where(AuditLog.timestamp >= from_date)
    if to_date:
        query = query.where(AuditLog.timestamp <= to_date)

    query = query.order_by(AuditLog.timestamp.desc())

    result = await db.execute(query)
    logs = result.scalars().all()

    return {
        "patientId": patient_id,
        "totalEntries": len(logs),
        "entries": [
            {
                "timestamp": log.timestamp.isoformat(),
                "user": log.user_id,
                "action": log.action,
                "resourceType": log.resource_type,
                "resourceId": log.resource_id,
                "success": log.success
            }
            for log in logs
        ]
    }
```

### 7.5 Encryption

#### Data at Rest
```yaml
# Encrypt database using PostgreSQL transparent data encryption (TDE)
# Or use full-disk encryption at infrastructure level (LUKS, BitLocker)

# PostgreSQL configuration
# Enable SSL for database connections
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'
ssl_ca_file = '/path/to/root.crt'

# Encrypt sensitive columns
CREATE EXTENSION pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY,
    username VARCHAR(255),
    password_hash VARCHAR(255),
    ssn_encrypted BYTEA  -- Encrypted SSN
);

-- Encrypt data
INSERT INTO users (id, username, ssn_encrypted)
VALUES (
    gen_random_uuid(),
    'john.smith',
    pgp_sym_encrypt('123-45-6789', 'encryption_key_from_env')
);

-- Decrypt data
SELECT pgp_sym_decrypt(ssn_encrypted, 'encryption_key_from_env') FROM users;
```

#### Data in Transit
```python
# Force HTTPS only
@app.middleware("http")
async def force_https(request: Request, call_next):
    if request.url.scheme != "https" and not settings.DEBUG:
        url = request.url.replace(scheme="https")
        return RedirectResponse(url, status_code=301)
    return await call_next(request)

# SSL/TLS configuration for production
# Use Let's Encrypt or commercial certificate
# Configure Nginx/Apache as reverse proxy with SSL termination

# nginx.conf
server {
    listen 443 ssl http2;
    server_name wintehr.example.com;

    ssl_certificate /etc/letsencrypt/live/wintehr.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wintehr.example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256...';
    ssl_prefer_server_ciphers on;

    # HSTS (force HTTPS for 1 year)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
    }
}
```

### 7.6 Security Headers

```python
# core/middleware/security_headers.py
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # Prevent MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # Content Security Policy
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "font-src 'self' data:; "
        "connect-src 'self' wss: https:;"
    )

    # Referrer policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Permissions policy
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=()"
    )

    return response
```

### 7.7 Input Validation & Sanitization

```python
# core/security/validators.py
from pydantic import BaseModel, validator, Field
import bleach
import re

class PatientInput(BaseModel):
    firstName: str = Field(..., min_length=1, max_length=100)
    lastName: str = Field(..., min_length=1, max_length=100)
    birthDate: str = Field(..., regex=r'^\d{4}-\d{2}-\d{2}$')
    email: Optional[str] = Field(None, regex=r'^[\w\.-]+@[\w\.-]+\.\w+$')

    @validator('firstName', 'lastName')
    def sanitize_name(cls, v):
        """Remove HTML tags and limit to alphanumeric + spaces"""
        v = bleach.clean(v, tags=[], strip=True)
        if not re.match(r'^[a-zA-Z\s\'-]+$', v):
            raise ValueError("Name contains invalid characters")
        return v.strip()

    @validator('email')
    def validate_email(cls, v):
        """Validate email format"""
        if v and not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', v):
            raise ValueError("Invalid email format")
        return v

# Prevent SQL injection (use parameterized queries)
# SQLAlchemy automatically parameterizes queries
query = select(User).where(User.username == username)  # Safe

# Prevent XSS (sanitize user input)
def sanitize_html(content: str) -> str:
    """Remove potentially dangerous HTML"""
    allowed_tags = ['p', 'br', 'strong', 'em', 'u']
    return bleach.clean(content, tags=allowed_tags, strip=True)

# Prevent path traversal
def safe_file_path(filename: str, base_dir: str) -> str:
    """Ensure file path is within base directory"""
    safe_filename = os.path.basename(filename)  # Remove directory traversal
    full_path = os.path.join(base_dir, safe_filename)

    # Verify path is within base_dir
    if not os.path.abspath(full_path).startswith(os.path.abspath(base_dir)):
        raise ValueError("Invalid file path")

    return full_path
```

### 7.8 Secrets Management

```python
# core/config/secrets.py
from pydantic_settings import BaseSettings
from typing import Optional
import boto3
import json

class Settings(BaseSettings):
    # Load from environment variables
    DATABASE_URL: str
    REDIS_URL: str
    JWT_PRIVATE_KEY_PATH: str
    JWT_PUBLIC_KEY_PATH: str
    HAPI_FHIR_BASE_URL: str

    # AWS Secrets Manager (for production)
    AWS_SECRET_NAME: Optional[str] = None
    AWS_REGION: Optional[str] = "us-east-1"

    class Config:
        env_file = ".env"
        case_sensitive = True

    def load_secrets_from_aws(self):
        """Load secrets from AWS Secrets Manager"""
        if not self.AWS_SECRET_NAME:
            return

        client = boto3.client('secretsmanager', region_name=self.AWS_REGION)
        response = client.get_secret_value(SecretId=self.AWS_SECRET_NAME)
        secrets = json.loads(response['SecretString'])

        # Override settings with secrets from AWS
        for key, value in secrets.items():
            setattr(self, key, value)

settings = Settings()
if not settings.DEBUG:
    settings.load_secrets_from_aws()

# Never commit secrets to version control
# Use .env for local development (add to .gitignore)
# Use AWS Secrets Manager, HashiCorp Vault, or Azure Key Vault for production
```

### 7.9 Security Monitoring & Alerting

```python
# core/security/monitoring.py
from datetime import datetime, timedelta
from typing import List

class SecurityMonitor:
    @staticmethod
    async def detect_suspicious_activity(user_id: str, db: AsyncSession) -> List[dict]:
        """Detect suspicious user activity patterns"""
        alerts = []

        # Check for rapid failed login attempts
        failed_logins = await db.execute(
            select(AuditLog).where(
                AuditLog.user_id == user_id,
                AuditLog.action == "LOGIN_FAILED",
                AuditLog.timestamp > datetime.utcnow() - timedelta(minutes=15)
            )
        )
        if failed_logins.scalar().count() >= 5:
            alerts.append({
                "type": "BRUTE_FORCE_ATTEMPT",
                "severity": "high",
                "message": f"5+ failed login attempts in 15 minutes"
            })

        # Check for access from unusual locations
        recent_ips = await db.execute(
            select(AuditLog.ip_address).where(
                AuditLog.user_id == user_id,
                AuditLog.timestamp > datetime.utcnow() - timedelta(hours=1)
            ).distinct()
        )
        if len(recent_ips.scalars().all()) > 3:
            alerts.append({
                "type": "MULTIPLE_LOCATIONS",
                "severity": "medium",
                "message": "Access from 3+ different IP addresses in 1 hour"
            })

        # Check for unusual access patterns
        access_count = await db.execute(
            select(func.count()).where(
                AuditLog.user_id == user_id,
                AuditLog.action.like("%PATIENT%"),
                AuditLog.timestamp > datetime.utcnow() - timedelta(hours=1)
            )
        )
        if access_count.scalar() > 50:
            alerts.append({
                "type": "EXCESSIVE_PATIENT_ACCESS",
                "severity": "high",
                "message": "Accessed 50+ patient records in 1 hour"
            })

        return alerts

    @staticmethod
    async def alert_security_team(alerts: List[dict], user_id: str):
        """Send alerts to security team"""
        # Send email, Slack, PagerDuty notification
        for alert in alerts:
            logger.warning(f"Security alert for user {user_id}: {alert}")
            # Implement notification system
```

---

## 8. Implementation Roadmap

### 8.1 Development Timeline

**Total Duration**: 14-16 weeks (3.5-4 months)
**Team Size**: 3-4 developers (1 full-stack lead, 2 backend, 1 frontend)

### 8.2 Phase Breakdown

#### Phase 1: Foundation (Weeks 1-3)
**Goal**: Establish development environment and core infrastructure

**Week 1: Environment Setup**
- Set up development infrastructure (Git, Docker, CI/CD)
- Deploy HAPI FHIR JPA Server (Docker)
- Set up PostgreSQL 15 with initial schema
- Configure Redis for caching
- Set up development, staging, and production environments
- Establish code review and testing processes

**Deliverables**:
- ✅ Docker Compose environment working
- ✅ HAPI FHIR server accessible and tested
- ✅ Database migrations framework (Alembic)
- ✅ CI/CD pipeline configured (GitHub Actions or GitLab CI)

**Week 2: Backend Foundation**
- Create FastAPI project structure
- Implement core/fhir/client.py (fhirpy wrapper)
- Set up SQLAlchemy models (users, audit_log, user_sessions)
- Implement authentication system (JWT, password hashing)
- Create middleware (CORS, security headers, logging)
- Set up pytest test framework

**Deliverables**:
- ✅ FastAPI app structure complete
- ✅ FHIR client working with HAPI server
- ✅ Authentication endpoints (/login, /refresh, /logout)
- ✅ Test coverage ≥80% for auth module

**Week 3: Frontend Foundation**
- Create React 18 + TypeScript + Vite project
- Set up routing (React Router v6)
- Implement Material-UI theme and layout
- Create authentication flow (login, token management)
- Set up TanStack Query for data fetching
- Create shared UI components (buttons, forms, tables)

**Deliverables**:
- ✅ React app running with authentication
- ✅ Login page with token storage
- ✅ Protected routes working
- ✅ Material-UI design system implemented

#### Phase 2: Core Modules (Weeks 4-8)
**Goal**: Implement primary clinical modules

**Week 4: Patient Module**
- Backend: Patient registration API, search, demographics
- Frontend: Patient search UI, patient details page
- FHIR: Patient resource create/read/update via HAPI
- Test: Patient CRUD operations, search functionality

**Deliverables**:
- ✅ Patient registration working end-to-end
- ✅ Patient search with filters
- ✅ Patient demographics display
- ✅ Test coverage ≥75%

**Week 5: Medications Module (Part 1)**
- Backend: Medication API, drug interaction service
- Frontend: Medication list, prescribe dialog
- FHIR: MedicationRequest resource via HAPI
- External API: Integrate drug interaction API (RxNorm or equivalent)

**Deliverables**:
- ✅ Medication prescribing workflow
- ✅ Drug interaction checking
- ✅ Active medications list

**Week 6: Medications Module (Part 2) + Pharmacy**
- Backend: MedicationDispense API, pharmacy queue
- Frontend: Pharmacy dashboard, dispense workflow
- FHIR: MedicationDispense resource
- Event system: Publish "medications.prescribed" event

**Deliverables**:
- ✅ Pharmacy queue showing pending prescriptions
- ✅ Medication dispensing workflow
- ✅ Event bus working between modules

**Week 7: Orders Module**
- Backend: ServiceRequest API (lab, imaging orders)
- Frontend: Order entry dialogs, order status tracking
- FHIR: ServiceRequest resource
- Event system: Publish "orders.placed" event

**Deliverables**:
- ✅ Lab order entry working
- ✅ Imaging order entry working
- ✅ Order status tracking

**Week 8: Results Module**
- Backend: Observation, DiagnosticReport API
- Frontend: Results viewer, trend charts
- FHIR: Observation, DiagnosticReport resources
- Data visualization: Chart.js or Recharts integration

**Deliverables**:
- ✅ Lab results display
- ✅ Result trend charts
- ✅ Critical result alerts

#### Phase 3: Advanced Features (Weeks 9-11)
**Goal**: Add imaging, documentation, and CDS features

**Week 9: Imaging Module**
- Backend: ImagingStudy API, DICOM metadata
- Frontend: DICOM viewer (Cornerstone.js), study list
- FHIR: ImagingStudy resource
- DICOM: Basic WADO-RS implementation

**Deliverables**:
- ✅ Imaging study list
- ✅ Basic DICOM viewer
- ✅ Multi-slice navigation

**Week 10: Documentation Module**
- Backend: DocumentReference API
- Frontend: Document upload, document viewer
- FHIR: DocumentReference resource
- Storage: File storage (S3 or local)

**Deliverables**:
- ✅ Document upload working
- ✅ Document viewer (PDF, images)
- ✅ Document search and filtering

**Week 11: CDS Module**
- Backend: CDS Hooks service implementation
- Frontend: CDS cards display
- Rules engine: Basic rule evaluation (drug safety, preventive care)
- FHIR: CDS Hooks specification compliance

**Deliverables**:
- ✅ medication-prescribe hook working
- ✅ Drug interaction cards displayed
- ✅ Preventive care recommendations

#### Phase 4: Security & Compliance (Week 12)
**Goal**: Implement comprehensive security and audit features

**Tasks**:
- Implement MFA (TOTP) support
- Complete audit logging for all patient data access
- Add patient data access controls
- Implement rate limiting
- Security testing (OWASP Top 10 checks)
- HIPAA compliance audit

**Deliverables**:
- ✅ MFA enrollment and verification working
- ✅ Complete audit trail for all patient access
- ✅ Patient access control enforced
- ✅ Security penetration test completed
- ✅ HIPAA compliance checklist completed

#### Phase 5: Testing & Optimization (Weeks 13-14)
**Goal**: Comprehensive testing and performance optimization

**Week 13: Integration Testing**
- End-to-end testing (Playwright or Cypress)
- Cross-module integration testing
- Load testing (K6 or Locust)
- Performance optimization (query optimization, caching)

**Deliverables**:
- ✅ E2E test suite covering critical workflows
- ✅ Load test results (target: 100 concurrent users)
- ✅ Performance benchmarks met

**Week 14: User Acceptance Testing (UAT)**
- Deploy to staging environment
- Clinical workflow testing with users
- Bug fixes and refinements
- Documentation completion (user guides, API docs)

**Deliverables**:
- ✅ UAT sign-off from stakeholders
- ✅ All critical bugs resolved
- ✅ User documentation complete

#### Phase 6: Deployment & Launch (Weeks 15-16)
**Goal**: Production deployment and go-live

**Week 15: Production Preparation**
- Production environment setup
- Data migration (if applicable)
- Production smoke tests
- Disaster recovery testing
- Security final review

**Deliverables**:
- ✅ Production environment ready
- ✅ Backup and recovery tested
- ✅ Monitoring and alerting configured

**Week 16: Go-Live**
- Production deployment
- Post-deployment verification
- User training sessions
- On-call support rotation established
- Performance monitoring

**Deliverables**:
- ✅ Application live in production
- ✅ All users trained
- ✅ 24/7 support established
- ✅ No critical issues in first week

### 8.3 Team Structure & Responsibilities

#### Full-Stack Lead (1 person)
**Responsibilities**:
- Architecture decisions and technical leadership
- Code review and quality assurance
- Sprint planning and task assignment
- Production deployment and DevOps
- Mentoring junior developers

**Focus Areas**: All modules, architecture, DevOps, security

#### Backend Developer 1 (1 person)
**Responsibilities**:
- FastAPI API development
- FHIR client integration with HAPI
- Database schema and migrations
- Backend testing (pytest)

**Focus Areas**: Patient, Medications, Pharmacy, Orders modules

#### Backend Developer 2 (1 person)
**Responsibilities**:
- FastAPI API development
- CDS Hooks implementation
- Security and authentication
- Audit logging and compliance

**Focus Areas**: Results, Imaging, Documentation, CDS, Security modules

#### Frontend Developer (1 person)
**Responsibilities**:
- React + TypeScript UI development
- Material-UI component development
- State management (TanStack Query, Zustand)
- Frontend testing (Jest, React Testing Library)

**Focus Areas**: All UI modules, design system, event bus, user workflows

### 8.4 Risk Management

#### High-Risk Items
| Risk | Impact | Mitigation Strategy |
|------|--------|---------------------|
| HAPI FHIR learning curve | Schedule delay (1-2 weeks) | Allocate Week 1 for HAPI research and proof-of-concept |
| Drug interaction API availability | Medications module blocked | Identify backup API providers (RxNorm, OpenFDA) |
| DICOM viewer complexity | Imaging module scope creep | Use existing library (Cornerstone.js), limit to basic viewing |
| Security vulnerabilities | Production deployment blocked | Weekly security reviews, automated scanning (Snyk, Dependabot) |
| Performance issues | Poor user experience | Performance testing from Week 8, optimize early |
| Team member unavailability | Schedule delay (1-2 weeks) | Cross-training, detailed documentation, pair programming |

#### Medium-Risk Items
| Risk | Impact | Mitigation Strategy |
|------|--------|---------------------|
| Third-party API downtime | Feature unavailable | Implement graceful degradation, caching |
| Browser compatibility | QA delays | Test on Chrome, Firefox, Safari from Week 3 |
| Data migration complexity | Deployment delay | Validate migration scripts in staging (Week 15) |
| HIPAA compliance gaps | Deployment blocked | Weekly compliance reviews, external audit (Week 12) |

### 8.5 Success Criteria

#### Technical Metrics
- **Test Coverage**: ≥80% for backend, ≥70% for frontend
- **Performance**:
  - API response time <200ms (95th percentile)
  - Page load time <3s on 3G network
  - No memory leaks (24-hour soak test)
- **Availability**: 99.9% uptime target (8.7h downtime/year)
- **Security**:
  - Zero critical vulnerabilities (OWASP Top 10)
  - All patient data encrypted at rest and in transit
  - Complete audit trail for all patient access

#### Functional Metrics
- **Core Workflows**:
  - Patient registration: <2 minutes
  - Medication prescribing: <1 minute
  - Lab order entry: <1 minute
  - Results review: <30 seconds
- **User Satisfaction**: ≥4.0/5.0 rating from UAT
- **Clinical Accuracy**:
  - Drug interaction detection: 100% recall for critical interactions
  - FHIR resource validation: 100% compliance with R4 spec

### 8.6 Dependencies & Prerequisites

#### External Dependencies
- **HAPI FHIR JPA Server**: Version 7.0+
- **Drug Interaction API**: RxNorm, DailyMed, or OpenFDA
- **Code Systems**:
  - LOINC (lab tests, vitals)
  - RxNorm (medications)
  - SNOMED CT (conditions, procedures)
  - ICD-10 (diagnoses)
- **Infrastructure**:
  - Docker support (development, production)
  - PostgreSQL 15+ hosting
  - Redis hosting
  - SSL certificates (Let's Encrypt or commercial)

#### Team Prerequisites
- **Backend**:
  - Python 3.11+ experience
  - FastAPI or similar async framework
  - FHIR basics (FHIR R4 spec)
  - PostgreSQL and SQLAlchemy
- **Frontend**:
  - React 18 with TypeScript
  - Material-UI or similar component library
  - Modern state management (TanStack Query)
- **DevOps**:
  - Docker and Docker Compose
  - CI/CD (GitHub Actions or GitLab CI)
  - Cloud hosting (AWS, Azure, or GCP)

### 8.7 Post-Launch Roadmap (Months 5-12)

#### Month 5-6: Stabilization
- Monitor production metrics (performance, errors, usage)
- Address user feedback and bug reports
- Performance tuning based on real usage patterns
- Security hardening based on production logs

#### Month 7-8: Feature Enhancements
- Advanced CDS rules (chronic disease management)
- Patient portal (self-service appointment scheduling, messaging)
- Mobile app (React Native or Progressive Web App)
- Reporting module (clinical quality measures, analytics)

#### Month 9-10: Integration & Interoperability
- HL7 v2 interface engine (inbound ADT, ORU messages)
- C-CDA document import/export
- External lab interface (bidirectional)
- External pharmacy interface (e-prescribing)

#### Month 11-12: Advanced Features
- Telemedicine module (video visits)
- Advanced DICOM features (3D reconstruction, MPR)
- Natural language processing (clinical note extraction)
- Machine learning (risk prediction, readmission prevention)

---

## 9. Deployment Architecture

### 9.1 Infrastructure Overview

WintEHR supports three deployment models:
1. **Development**: Local Docker Compose
2. **Staging/Testing**: Cloud VM with Docker Compose
3. **Production**: Kubernetes cluster with high availability

### 9.2 Development Deployment

#### Docker Compose Stack
```yaml
# docker-compose.yml
version: '3.8'

services:
  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: wintehr
      POSTGRES_USER: wintehr_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wintehr_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # HAPI FHIR JPA Server
  hapi-fhir:
    image: hapiproject/hapi:7.0.2
    environment:
      spring.datasource.url: jdbc:postgresql://postgres:5432/wintehr
      spring.datasource.username: wintehr_user
      spring.datasource.password: ${POSTGRES_PASSWORD}
      hapi.fhir.fhir_version: R4
      hapi.fhir.subscription.resthook_enabled: true
      hapi.fhir.subscription.websocket_enabled: true
      hapi.fhir.cors.allowed_origin: "*"
      hapi.fhir.allow_multiple_delete: true
      hapi.fhir.reuse_cached_search_results_millis: 60000
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/fhir/metadata"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Redis cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # FastAPI backend
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql+asyncpg://wintehr_user:${POSTGRES_PASSWORD}@postgres:5432/wintehr
      REDIS_URL: redis://redis:6379/0
      HAPI_FHIR_BASE_URL: http://hapi-fhir:8080/fhir
      JWT_PRIVATE_KEY_PATH: /app/keys/private.pem
      JWT_PUBLIC_KEY_PATH: /app/keys/public.pem
      DEBUG: "true"
    volumes:
      - ./backend:/app
      - ./keys:/app/keys
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      hapi-fhir:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  # React frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      VITE_API_BASE_URL: http://localhost:8000/api
      VITE_FHIR_BASE_URL: http://localhost:8080/fhir
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    depends_on:
      - backend
    command: npm run dev -- --host 0.0.0.0

volumes:
  postgres_data:
  redis_data:
```

#### Backend Dockerfile
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run database migrations on startup
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"]
```

#### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json .
RUN npm ci

# Copy application code
COPY . .

# Development mode
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### 9.3 Production Deployment (Kubernetes)

#### Kubernetes Architecture
```
                    ┌─────────────────┐
                    │   Load Balancer  │
                    │   (Nginx Ingress)│
                    └────────┬─────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
      ┌───────▼──────┐              ┌──────▼──────┐
      │   Frontend    │              │   Backend    │
      │   (React)     │              │  (FastAPI)   │
      │   3 replicas  │              │  3 replicas  │
      └───────┬───────┘              └──────┬───────┘
              │                             │
              └──────────────┬──────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
      ┌───────▼──────┐              ┌──────▼──────┐
      │  HAPI FHIR    │              │   Redis     │
      │  (StatefulSet)│              │  (Sentinel) │
      │  3 replicas   │              │  3 replicas │
      └───────┬───────┘              └─────────────┘
              │
      ┌───────▼──────┐
      │  PostgreSQL   │
      │  (StatefulSet)│
      │  Primary + 2  │
      │  Replicas     │
      └───────────────┘
```

#### Kubernetes Manifests

**Namespace**
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: wintehr-prod
```

**PostgreSQL (StatefulSet)**
```yaml
# k8s/postgres-statefulset.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: wintehr-prod
spec:
  serviceName: postgres
  replicas: 1  # Use managed database in production (RDS, CloudSQL)
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: wintehr
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: "fast-ssd"
      resources:
        requests:
          storage: 100Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: wintehr-prod
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
```

**HAPI FHIR (Deployment)**
```yaml
# k8s/hapi-fhir-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hapi-fhir
  namespace: wintehr-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hapi-fhir
  template:
    metadata:
      labels:
        app: hapi-fhir
    spec:
      containers:
      - name: hapi-fhir
        image: hapiproject/hapi:7.0.2
        env:
        - name: spring.datasource.url
          value: jdbc:postgresql://postgres:5432/wintehr
        - name: spring.datasource.username
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: spring.datasource.password
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: hapi.fhir.fhir_version
          value: R4
        - name: hapi.fhir.subscription.resthook_enabled
          value: "true"
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /fhir/metadata
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /fhir/metadata
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
---
apiVersion: v1
kind: Service
metadata:
  name: hapi-fhir
  namespace: wintehr-prod
spec:
  selector:
    app: hapi-fhir
  ports:
  - port: 8080
    targetPort: 8080
```

**Backend (Deployment)**
```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: wintehr-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
      - name: backend
        image: wintehr/backend:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: backend-secret
              key: database_url
        - name: REDIS_URL
          value: redis://redis:6379/0
        - name: HAPI_FHIR_BASE_URL
          value: http://hapi-fhir:8080/fhir
        - name: JWT_PRIVATE_KEY_PATH
          value: /app/keys/private.pem
        - name: JWT_PUBLIC_KEY_PATH
          value: /app/keys/public.pem
        ports:
        - containerPort: 8000
        volumeMounts:
        - name: jwt-keys
          mountPath: /app/keys
          readOnly: true
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: jwt-keys
        secret:
          secretName: jwt-keys
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: wintehr-prod
spec:
  selector:
    app: backend
  ports:
  - port: 8000
    targetPort: 8000
```

**Frontend (Deployment)**
```yaml
# k8s/frontend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: wintehr-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: wintehr/frontend:latest
        ports:
        - containerPort: 80
        livenessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: wintehr-prod
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 80
```

**Ingress (Nginx)**
```yaml
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wintehr-ingress
  namespace: wintehr-prod
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - wintehr.example.com
    secretName: wintehr-tls
  rules:
  - host: wintehr.example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: /fhir
        pathType: Prefix
        backend:
          service:
            name: hapi-fhir
            port:
              number: 8080
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

### 9.4 CI/CD Pipeline

#### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov
      - name: Run tests
        run: |
          cd backend
          pytest tests/ --cov=. --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      - name: Run tests
        run: |
          cd frontend
          npm test -- --coverage

  build-and-push:
    needs: [test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/staging'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v3
      - name: Log in to registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Build backend image
      - name: Build and push backend
        uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:latest

      # Build frontend image
      - name: Build and push frontend
        uses: docker/build-push-action@v4
        with:
          context: ./frontend
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:latest

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/staging'
    steps:
      - name: Deploy to staging
        uses: appleboy/ssh-action@v0.1.10
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/wintehr
            docker-compose pull
            docker-compose up -d
            docker-compose ps

  deploy-production:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v3
      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBECONFIG }}" > kubeconfig
          export KUBECONFIG=kubeconfig
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/backend backend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:${{ github.sha }} -n wintehr-prod
          kubectl set image deployment/frontend frontend=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${{ github.sha }} -n wintehr-prod
          kubectl rollout status deployment/backend -n wintehr-prod
          kubectl rollout status deployment/frontend -n wintehr-prod
```

### 9.5 Infrastructure as Code (Terraform)

**Example: AWS EKS Cluster**
```hcl
# terraform/main.tf
provider "aws" {
  region = var.aws_region
}

# VPC for EKS cluster
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "wintehr-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  enable_dns_hostnames = true

  tags = {
    Environment = "production"
    Project     = "WintEHR"
  }
}

# EKS cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "19.0.0"

  cluster_name    = "wintehr-prod"
  cluster_version = "1.27"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    main = {
      min_size     = 3
      max_size     = 10
      desired_size = 3

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"
    }
  }

  tags = {
    Environment = "production"
    Project     = "WintEHR"
  }
}

# RDS PostgreSQL
module "db" {
  source  = "terraform-aws-modules/rds/aws"
  version = "6.0.0"

  identifier = "wintehr-prod-db"

  engine               = "postgres"
  engine_version       = "15.3"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = "db.r5.xlarge"

  allocated_storage     = 100
  max_allocated_storage = 500

  db_name  = "wintehr"
  username = "wintehr_admin"
  port     = 5432

  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [module.security_group.security_group_id]

  backup_retention_period = 7
  skip_final_snapshot     = false
  deletion_protection     = true

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Environment = "production"
    Project     = "WintEHR"
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "wintehr-prod-redis"
  replication_group_description = "Redis for WintEHR caching"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = "cache.r5.large"
  number_cache_clusters = 3

  parameter_group_name = "default.redis7"
  port                 = 6379

  subnet_group_name          = module.vpc.elasticache_subnet_group_name
  security_group_ids         = [module.security_group.security_group_id]

  automatic_failover_enabled = true
  multi_az_enabled           = true

  tags = {
    Environment = "production"
    Project     = "WintEHR"
  }
}
```

### 9.6 Backup & Disaster Recovery

#### Backup Strategy
```yaml
# Automated backups
Database (PostgreSQL):
  - Continuous backup to S3 (Point-in-Time Recovery)
  - Daily snapshots retained for 30 days
  - Monthly snapshots retained for 1 year

HAPI FHIR (PostgreSQL):
  - Same as database backup strategy
  - FHIR resources are in PostgreSQL

File Storage (Documents, Images):
  - S3 with versioning enabled
  - Cross-region replication to DR region
  - Lifecycle policy: Transition to Glacier after 90 days

Redis:
  - RDB snapshots every 6 hours
  - AOF enabled for durability
  - Replicas in multiple availability zones
```

#### Disaster Recovery Plan
```
RPO (Recovery Point Objective): 1 hour
RTO (Recovery Time Objective): 4 hours

DR Procedures:
1. Database: Restore from latest snapshot (automated via RDS)
2. Application: Deploy from container registry to DR region
3. File Storage: S3 cross-region replication (automatic)
4. DNS: Update Route 53 to point to DR region (5 min TTL)

DR Testing:
- Quarterly DR drills
- Automated DR environment provisioning
- Verify data integrity and application functionality
```

---

## 10. Operations & Monitoring

### 10.1 Health Checks

#### Application Health Endpoints
```python
# backend/main.py
@app.get("/health")
async def health_check():
    """Basic health check - is the service running?"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": app.version
    }

@app.get("/ready")
async def readiness_check(
    db: AsyncSession = Depends(get_db),
    redis: Redis = Depends(get_redis)
):
    """
    Readiness check - is the service ready to accept traffic?
    Checks all dependencies:
    - Database connectivity
    - Redis connectivity
    - HAPI FHIR connectivity
    """
    checks = {}
    overall_status = "ready"

    # Check database
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "healthy"
    except Exception as e:
        checks["database"] = "unhealthy"
        overall_status = "not_ready"
        logger.error(f"Database health check failed: {e}")

    # Check Redis
    try:
        await redis.ping()
        checks["redis"] = "healthy"
    except Exception as e:
        checks["redis"] = "unhealthy"
        overall_status = "not_ready"
        logger.error(f"Redis health check failed: {e}")

    # Check HAPI FHIR
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.HAPI_FHIR_BASE_URL}/metadata",
                timeout=5.0
            )
            if response.status_code == 200:
                checks["hapi_fhir"] = "healthy"
            else:
                checks["hapi_fhir"] = "unhealthy"
                overall_status = "not_ready"
    except Exception as e:
        checks["hapi_fhir"] = "unhealthy"
        overall_status = "not_ready"
        logger.error(f"HAPI FHIR health check failed: {e}")

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": checks
    }
```

### 10.2 Logging Strategy

#### Structured Logging
```python
# core/logging/logger.py
import logging
import json
from datetime import datetime
from typing import Any, Dict

class StructuredLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)

        # JSON formatter for structured logs
        handler = logging.StreamHandler()
        handler.setFormatter(JSONFormatter())
        self.logger.addHandler(handler)

    def info(self, message: str, **kwargs):
        self.logger.info(message, extra=kwargs)

    def error(self, message: str, **kwargs):
        self.logger.error(message, extra=kwargs)

    def warning(self, message: str, **kwargs):
        self.logger.warning(message, extra=kwargs)

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }

        # Add extra fields
        if hasattr(record, "__dict__"):
            for key, value in record.__dict__.items():
                if key not in ["name", "msg", "args", "created", "filename", "funcName", "levelname", "levelno", "lineno", "module", "msecs", "message", "pathname", "process", "processName", "relativeCreated", "thread", "threadName"]:
                    log_data[key] = value

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)

# Usage
logger = StructuredLogger(__name__)

@router.post("/medications")
async def prescribe_medication(medication: MedicationInput):
    logger.info(
        "Prescribing medication",
        patient_id=medication.patient_id,
        medication_code=medication.medication.code,
        user_id=current_user.id
    )
```

#### Log Levels & Categories
```python
# Logging categories
CATEGORIES = {
    "access": "API access logs",
    "audit": "HIPAA audit logs",
    "error": "Application errors",
    "performance": "Performance metrics",
    "security": "Security events"
}

# Log retention
LOG_RETENTION = {
    "access": "30 days",
    "audit": "7 years (HIPAA requirement)",
    "error": "90 days",
    "performance": "30 days",
    "security": "1 year"
}
```

### 10.3 Monitoring & Alerting

#### Prometheus Metrics
```python
# core/monitoring/metrics.py
from prometheus_client import Counter, Histogram, Gauge
import time

# Request metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

# Business metrics
patient_registrations_total = Counter(
    'patient_registrations_total',
    'Total patient registrations'
)

medication_prescriptions_total = Counter(
    'medication_prescriptions_total',
    'Total medication prescriptions',
    ['medication_code']
)

drug_interactions_detected = Counter(
    'drug_interactions_detected',
    'Drug interactions detected',
    ['severity']
)

# System metrics
database_connections = Gauge(
    'database_connections_active',
    'Active database connections'
)

redis_cache_hits = Counter(
    'redis_cache_hits_total',
    'Redis cache hits'
)

redis_cache_misses = Counter(
    'redis_cache_misses_total',
    'Redis cache misses'
)

# Middleware to track requests
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()

    response = await call_next(request)

    duration = time.time() - start_time

    http_requests_total.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code
    ).inc()

    http_request_duration_seconds.labels(
        method=request.method,
        endpoint=request.url.path
    ).observe(duration)

    return response

# Expose metrics endpoint
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
```

#### Grafana Dashboards
```yaml
# Key dashboards to create:

1. Application Overview
   - Request rate (req/sec)
   - Error rate (%)
   - Response time (p50, p95, p99)
   - Active users

2. FHIR Operations
   - FHIR resource operations by type
   - HAPI FHIR response times
   - FHIR search performance
   - Resource create/update/delete rates

3. Clinical Workflows
   - Patient registrations
   - Medication prescriptions
   - Lab orders placed
   - Drug interactions detected
   - CDS alerts triggered

4. Infrastructure
   - CPU usage (%)
   - Memory usage (%)
   - Database connections
   - Redis cache hit rate
   - Disk usage

5. Security
   - Failed login attempts
   - Patient data access (by user, by patient)
   - Unusual access patterns
   - API rate limit violations
```

#### Alert Rules
```yaml
# Prometheus AlertManager rules

# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "High error rate detected"
    description: "Error rate is {{ $value }} errors/sec (threshold: 0.05)"

# Slow response time
- alert: SlowResponseTime
  expr: histogram_quantile(0.95, http_request_duration_seconds) > 2.0
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "95th percentile response time above 2s"

# Database connection pool exhaustion
- alert: DatabaseConnectionPoolExhausted
  expr: database_connections_active > 80
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Database connection pool near exhaustion"
    description: "Active connections: {{ $value }} (max: 100)"

# Redis cache low hit rate
- alert: RedisLowCacheHitRate
  expr: rate(redis_cache_hits_total[5m]) / (rate(redis_cache_hits_total[5m]) + rate(redis_cache_misses_total[5m])) < 0.8
  for: 15m
  labels:
    severity: warning
  annotations:
    summary: "Redis cache hit rate below 80%"

# HAPI FHIR down
- alert: HAPIFHIRDown
  expr: up{job="hapi-fhir"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "HAPI FHIR server is down"
    description: "HAPI FHIR has been down for more than 1 minute"

# Security: Multiple failed logins
- alert: MultipleFailedLogins
  expr: rate(failed_login_attempts_total[5m]) > 5
  for: 5m
  labels:
    severity: high
  annotations:
    summary: "Multiple failed login attempts detected"
    description: "{{ $value }} failed logins/sec in last 5 minutes"
```

### 10.4 Performance Monitoring

#### Application Performance Monitoring (APM)
```python
# Integration with APM tools (e.g., New Relic, DataDog, Elastic APM)

# Example: OpenTelemetry integration
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor

# Set up tracer
tracer_provider = TracerProvider()
tracer_provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint="http://otel-collector:4317"))
)
trace.set_tracer_provider(tracer_provider)

# Auto-instrument FastAPI
FastAPIInstrumentor.instrument_app(app)

# Auto-instrument SQLAlchemy
SQLAlchemyInstrumentor().instrument()

# Manual tracing for business logic
tracer = trace.get_tracer(__name__)

@router.post("/medications")
async def prescribe_medication(medication: MedicationInput):
    with tracer.start_as_current_span("prescribe_medication") as span:
        span.set_attribute("patient_id", medication.patient_id)
        span.set_attribute("medication_code", medication.medication.code)

        # Check drug interactions
        with tracer.start_as_current_span("check_drug_interactions"):
            interactions = await medication_service.check_interactions(
                medication.patient_id,
                medication.medication.code
            )

        # Create FHIR resource
        with tracer.start_as_current_span("create_fhir_medication_request"):
            med_request = await fhir_client.create_resource(
                "MedicationRequest",
                medication.to_fhir()
            )

        return med_request
```

### 10.5 Maintenance & Updates

#### Rolling Updates
```bash
# Kubernetes rolling update (zero downtime)
kubectl set image deployment/backend backend=wintehr/backend:v1.2.0 -n wintehr-prod
kubectl rollout status deployment/backend -n wintehr-prod

# Rollback if issues detected
kubectl rollout undo deployment/backend -n wintehr-prod
```

#### Database Migrations
```python
# Alembic migration workflow

# 1. Create migration
alembic revision --autogenerate -m "Add patient_preferences table"

# 2. Review migration file
# alembic/versions/abc123_add_patient_preferences.py

# 3. Apply migration (development)
alembic upgrade head

# 4. Test migration rollback
alembic downgrade -1
alembic upgrade head

# 5. Apply to production (during maintenance window)
# Run as part of deployment pipeline
kubectl exec -it backend-pod -n wintehr-prod -- alembic upgrade head
```

#### Scheduled Maintenance
```yaml
# Maintenance windows
Schedule: Every Saturday 2:00-4:00 AM EST

Activities:
  - Database vacuum and analyze (PostgreSQL)
  - Log rotation and archival
  - Security patch application
  - Performance tuning based on metrics
  - Backup verification

Communication:
  - Notify users 7 days in advance
  - Send reminder 24 hours before
  - Post maintenance banner 1 hour before
  - Status page updates during maintenance
```

### 10.6 Incident Response

#### On-Call Rotation
```yaml
Rotation: Weekly, 24/7 coverage
Team: 3 developers (1 primary, 1 secondary, 1 escalation)

Escalation Path:
  Level 1: On-call developer (5 min response time)
  Level 2: Team lead (15 min response time)
  Level 3: CTO / Infrastructure team (30 min response time)

Runbooks: Documented procedures for common incidents
  - HAPI FHIR server down
  - Database connection pool exhausted
  - High error rate (5xx errors)
  - Security incident (unauthorized access)
  - Performance degradation
```

#### Incident Response Procedures
```yaml
1. Detection
   - Alert triggered (PagerDuty, Slack, email)
   - User report via support ticket

2. Triage (5 minutes)
   - Assess severity (critical, high, medium, low)
   - Identify affected users
   - Check recent deployments

3. Response (varies by severity)
   Critical (P0): All hands on deck, resolve within 1 hour
   High (P1): Primary on-call, resolve within 4 hours
   Medium (P2): Primary on-call, resolve within 24 hours
   Low (P3): Next business day

4. Resolution
   - Implement fix (hotfix deployment or rollback)
   - Verify fix in production
   - Monitor for 30 minutes

5. Post-Mortem (within 48 hours)
   - Root cause analysis
   - Timeline of events
   - Action items to prevent recurrence
   - Share learnings with team
```

---

**Document Status**: COMPLETE (All 10 Sections)
**Document Version**: 1.0
**Last Updated**: 2025-01-29
**Total Lines**: ~3,250

---

## Summary

This greenfield architecture document provides a complete blueprint for building WintEHR from scratch:

### Key Highlights:
1. **Zero Custom FHIR Code**: HAPI FHIR JPA Server handles all FHIR operations (~12,500 lines eliminated)
2. **Modular Architecture**: 7 domain modules with event-driven communication
3. **Production-Ready**: Complete security, compliance, deployment, and monitoring specifications
4. **14-16 Week Timeline**: Realistic implementation roadmap with team structure
5. **Kubernetes-Ready**: Full production deployment architecture with HA, DR, and CI/CD

### Next Steps:
1. Review and approve architecture with stakeholders
2. Assemble development team (3-4 developers)
3. Set up development environment (Week 1)
4. Begin Phase 1 implementation (Weeks 1-3)

**Ready to build**.