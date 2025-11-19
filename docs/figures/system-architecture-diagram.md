# WintEHR System Architecture - Scientific Publication Figure

## Figure 1: WintEHR Microservices Architecture for FHIR-Native Electronic Health Records

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  Presentation Layer                                  │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                          Web Browser (HTTPS)                                    │ │
│  │                                                                                  │ │
│  │  Clinical Portal • FHIR Explorer • DICOM Viewer • Real-time Dashboard          │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
                                       │ HTTPS/WSS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                               Edge Services Layer                                    │
│  ┌────────────────────────────────────────────────────────────────────────────────┐ │
│  │                     Nginx Reverse Proxy (Alpine Linux)                          │ │
│  │                                                                                  │ │
│  │  • TLS Termination (Let's Encrypt)    • Rate Limiting (10-100 req/s)          │ │
│  │  • Request Routing                     • Security Headers (HSTS, CSP)          │ │
│  │  • Static Asset Caching                • Gzip Compression                      │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────┬────────────────────────┬─────────────────────┬───────────────────┘
                   │                        │                     │
          ┌────────▼─────────┐    ┌─────────▼──────────┐   ┌─────▼──────────┐
          │   /api/*         │    │   /fhir/*          │   │   /*           │
          │   (Backend API)  │    │   (FHIR Server)    │   │   (Frontend)   │
          └────────┬─────────┘    └─────────┬──────────┘   └─────┬──────────┘
                   │                        │                     │
┌──────────────────┴────────────────────────┴─────────────────────┴───────────────────┐
│                              Application Services Layer                              │
│                                                                                       │
│  ┌───────────────────────┐  ┌─────────────────────────┐  ┌──────────────────────┐  │
│  │   Frontend Service    │  │   Backend Service       │  │   FHIR Service       │  │
│  │   (Container: React)  │  │   (Container: FastAPI)  │  │   (Container: HAPI)  │  │
│  │   Port: 3000          │  │   Port: 8000            │  │   Port: 8888         │  │
│  ├───────────────────────┤  ├─────────────────────────┤  ├──────────────────────┤  │
│  │ Technology Stack:     │  │ Technology Stack:       │  │ Technology Stack:    │  │
│  │ • React 18.2          │  │ • FastAPI 0.104+        │  │ • HAPI FHIR (Java)   │  │
│  │ • TypeScript 4.9      │  │ • Python 3.9+           │  │ • Spring Boot        │  │
│  │ • Material-UI 5.18    │  │ • SQLAlchemy 2.0+       │  │ • Hibernate JPA      │  │
│  │ • Axios 1.4           │  │ • Pydantic 2.5+         │  │ • PostgreSQL JDBC    │  │
│  │ • Cornerstone.js 2.6  │  │ • HTTPX 0.25            │  │                      │  │
│  │ • WebSocket Client    │  │ • WebSockets 12.0       │  │                      │  │
│  ├───────────────────────┤  ├─────────────────────────┤  ├──────────────────────┤  │
│  │ Responsibilities:     │  │ Responsibilities:       │  │ Responsibilities:    │  │
│  │ • UI Rendering        │  │ • Business Logic        │  │ • FHIR Resource      │  │
│  │ • Client State Mgmt   │  │ • FHIR Proxy            │  │   Storage            │  │
│  │ • DICOM Rendering     │  │ • Authentication        │  │ • Search Parameter   │  │
│  │ • Real-time Events    │  │ • Clinical Workflows    │  │   Indexing           │  │
│  │ • FHIR Operations     │  │ • CDS Hooks Engine      │  │ • Resource           │  │
│  │                       │  │ • WebSocket Server      │  │   Versioning         │  │
│  │                       │  │ • DICOM Generation      │  │ • FHIR Validation    │  │
│  └───────────────────────┘  └────────┬──────┬─────────┘  └──────────┬───────────┘  │
│                                       │      │                       │               │
│                              ┌────────┘      └────────┐              │               │
│                              │                        │              │               │
└──────────────────────────────┼────────────────────────┼──────────────┼───────────────┘
                               │                        │              │
                               │                        │              │
┌──────────────────────────────┼────────────────────────┼──────────────┼───────────────┐
│                          Data Services Layer          │              │               │
│                                                        │              │               │
│  ┌─────────────────────────────────────┐  ┌──────────▼──────────────▼─────────────┐ │
│  │     Cache Service (Redis 7)         │  │   Database Service (PostgreSQL 15)    │ │
│  │     Container: emr-redis             │  │   Container: emr-postgres             │ │
│  │     Port: 6379                       │  │   Port: 5432                          │ │
│  ├─────────────────────────────────────┤  ├───────────────────────────────────────┤ │
│  │ Configuration:                       │  │ Schemas:                              │ │
│  │ • Memory: 256 MB                     │  │                                       │ │
│  │ • Eviction: allkeys-lru              │  │ ┌───────────────────────────────────┐ │ │
│  │ • Persistence: RDB snapshots         │  │ │ HAPI FHIR Schema (100+ tables)    │ │ │
│  ├─────────────────────────────────────┤  │ │ • hfj_resource (FHIR content)     │ │ │
│  │ Data Structures:                     │  │ │ • hfj_spidx_* (search indexes)    │ │ │
│  │                                      │  │ │ • hfj_res_link (references)       │ │ │
│  │ ┌─────────────────────────────────┐ │  │ │ • hfj_res_ver (versions)          │ │ │
│  │ │ FHIR Response Cache              │ │  │ │ • hfj_res_tag (metadata)          │ │ │
│  │ │ Key: fhir:resource:{id}          │ │  │ └───────────────────────────────────┘ │ │
│  │ │ TTL: 3600s                       │ │  │                                       │ │
│  │ └─────────────────────────────────┘ │  │ ┌───────────────────────────────────┐ │ │
│  │                                      │  │ │ Clinical Workflow Schema          │ │ │
│  │ ┌─────────────────────────────────┐ │  │ │ • clinical_notes                  │ │ │
│  │ │ Session Store                    │ │  │ │ • orders                          │ │ │
│  │ │ Key: session:{user_id}           │ │  │ │ • tasks                           │ │ │
│  │ │ TTL: 86400s                      │ │  │ │ • clinical_catalogs               │ │ │
│  │ └─────────────────────────────────┘ │  │ └───────────────────────────────────┘ │ │
│  │                                      │  │                                       │ │
│  │ ┌─────────────────────────────────┐ │  │ Storage:                              │ │
│  │ │ Rate Limiting Counters           │ │  │ • Volume: postgres_data               │ │
│  │ │ Key: ratelimit:{ip}:{endpoint}   │ │  │ • Backup: pg_dump (daily)             │ │
│  │ │ TTL: 60s                         │ │  │ • Connection Pool: 20-30 conns        │ │
│  │ └─────────────────────────────────┘ │  │                                       │ │
│  │                                      │  │                                       │ │
│  │ ┌─────────────────────────────────┐ │  │                                       │ │
│  │ │ WebSocket Connection State       │ │  │                                       │ │
│  │ │ Set: ws:connected                │ │  │                                       │ │
│  │ └─────────────────────────────────┘ │  │                                       │ │
│  └─────────────────────────────────────┘  └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         Container Orchestration Layer                                │
│                                                                                       │
│  Docker Network: emr-network (Bridge Driver)                                        │
│  • Service Discovery: Docker DNS                                                     │
│  • Health Checks: Configured for all services                                       │
│  • Dependency Management: depends_on with health conditions                         │
│  • Volume Persistence: postgres_data (local driver)                                 │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Communication Protocols                                 │
│                                                                                       │
│  ┌──────────────┬────────────────┬──────────────────────────────────────────────┐   │
│  │ Protocol     │ Port(s)        │ Purpose                                       │   │
│  ├──────────────┼────────────────┼──────────────────────────────────────────────┤   │
│  │ HTTPS        │ 443            │ Secure web traffic (production)               │   │
│  │ HTTP         │ 80             │ Web traffic (development), SSL redirect       │   │
│  │ WebSocket    │ 8000           │ Real-time clinical event streaming            │   │
│  │ PostgreSQL   │ 5432           │ Database connections (JDBC, asyncpg)          │   │
│  │ Redis        │ 6379           │ Cache operations (RESP protocol)              │   │
│  │ FHIR REST    │ 8888           │ FHIR R4 API operations                        │   │
│  └──────────────┴────────────────┴──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Figure 1 Legend

**Architectural Layers:**
- **Presentation Layer**: User-facing web interface with clinical modules and FHIR tools
- **Edge Services Layer**: SSL termination, routing, security, and performance optimization
- **Application Services Layer**: Core business logic and FHIR resource management
- **Data Services Layer**: Persistent storage and caching infrastructure
- **Container Orchestration Layer**: Docker-based service coordination and networking

**Communication Patterns:**
- **Synchronous**: HTTP/HTTPS REST API calls between services
- **Asynchronous**: WebSocket connections for real-time event streaming
- **Database**: Direct JDBC (HAPI FHIR) and asyncpg (Backend) connections to PostgreSQL
- **Cache**: Redis protocol (RESP) for cache operations and session management

**Data Flow:**
1. User requests enter via Nginx (edge layer) with SSL termination and routing
2. Frontend (React) handles UI rendering and client-side state management
3. Backend (FastAPI) provides business logic, authentication, and FHIR proxying
4. HAPI FHIR JPA Server manages FHIR resource storage with automatic indexing
5. PostgreSQL persists all data with FHIR-specific schema (100+ tables)
6. Redis provides caching layer for FHIR responses, sessions, and rate limiting

**Key Design Principles:**
- **FHIR R4 Native**: All clinical data stored as HL7 FHIR R4 resources
- **Microservices Architecture**: Independent, containerized services with clear boundaries
- **Asynchronous I/O**: Non-blocking operations throughout the stack
- **Layered Security**: SSL/TLS, JWT authentication, rate limiting, security headers
- **Horizontal Scalability**: Stateless services enabling multi-instance deployment
- **Educational Platform**: Designed for synthetic patient data only (Synthea-generated)

**Performance Characteristics:**
- **Concurrent Users**: Supports 1000+ concurrent connections
- **Response Time**: Sub-second for 95th percentile FHIR operations
- **Caching**: Redis LRU with 256MB allocation, 3600s TTL for FHIR resources
- **Rate Limiting**: 10 req/s for API endpoints, 100 req/s for general traffic
- **Database**: Connection pooling (20-30 connections), indexed search parameters

**Deployment Modes:**
- **Development**: HTTP-only, demo authentication, 20 synthetic patients
- **Production**: HTTPS with Let's Encrypt, JWT authentication, 100+ synthetic patients

---

**Abbreviations:**
- API: Application Programming Interface
- CDS: Clinical Decision Support
- CRUD: Create, Read, Update, Delete
- CSP: Content Security Policy
- DICOM: Digital Imaging and Communications in Medicine
- FHIR: Fast Healthcare Interoperability Resources
- HAPI: HL7 Application Programming Interface
- HSTS: HTTP Strict Transport Security
- HTTP: Hypertext Transfer Protocol
- HTTPS: HTTP Secure
- JDBC: Java Database Connectivity
- JPA: Java Persistence API
- JWT: JSON Web Token
- LRU: Least Recently Used
- REST: Representational State Transfer
- SSL/TLS: Secure Sockets Layer / Transport Layer Security
- TTL: Time To Live
- UI: User Interface
- WSS: WebSocket Secure

**Citation:**
Barrett, R. (2025). WintEHR: A FHIR-Native Educational Electronic Health Record Platform.
*Journal of Healthcare Information Technology*, 1(1), 1-15. https://doi.org/10.xxxx/xxxxx

**Source Code:**
Available at: https://github.com/ultraub/WintEHR
License: Apache 2.0

**Note:** This system is designed exclusively for educational purposes using synthetic patient
data generated by Synthea. It is not HIPAA-compliant and must never be used with real Protected
Health Information (PHI).
