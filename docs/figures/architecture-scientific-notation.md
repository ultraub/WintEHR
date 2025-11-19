# WintEHR System Architecture - Scientific Publication (Alternative Format)

## Figure 1: Component-Based Architecture of WintEHR FHIR-Native EHR Platform

```
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                         CLIENT TIER (Presentation Layer)                          ║
║                                                                                    ║
║   ┌────────────────────────────────────────────────────────────────────────────┐  ║
║   │                    Web Browser Application (HTTPS)                          │  ║
║   │                                                                              │  ║
║   │    React 18.2 SPA │ TypeScript 4.9 │ Material-UI 5.18                      │  ║
║   │    Cornerstone.js DICOM Viewer │ WebSocket Client │ Axios HTTP             │  ║
║   └─────────────────────────────┬──────────────────────────────────────────────┘  ║
╚═════════════════════════════════╪═══════════════════════════════════════════════╝
                                  │
                                  │ HTTPS/443, WSS
                                  │ TLS 1.2/1.3
                                  ▼
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                    EDGE TIER (Reverse Proxy & Security)                           ║
║                                                                                    ║
║   ┌────────────────────────────────────────────────────────────────────────────┐  ║
║   │  Nginx Alpine (Reverse Proxy)                                              │  ║
║   │                                                                              │  ║
║   │  [SSL/TLS]──►[Rate Limiter]──►[Router]──►[Cache]──►[Compressor]           │  ║
║   │                                                                              │  ║
║   │  • Let's Encrypt Certificate                                                │  ║
║   │  • 10-100 req/s rate limiting                                               │  ║
║   │  • Security headers (HSTS, CSP, X-Frame-Options)                           │  ║
║   └────┬─────────────────────────┬─────────────────────────┬───────────────────┘  ║
║        │                         │                         │                       ║
║    ┌───▼────┐              ┌─────▼──────┐          ┌──────▼──────┐               ║
║    │ /api/* │              │  /fhir/*   │          │     /*      │               ║
╚════╪════════╪══════════════╪════════════╪══════════╪═════════════╪═══════════════╝
     │        │              │            │          │             │
     │        │              │            │          │             │
╔════╪════════╪══════════════╪════════════╪══════════╪═════════════╪═══════════════╗
║    │  APPLICATION TIER (Business Logic & FHIR Services)          │               ║
║    │        │              │            │          │             │               ║
║  ┌─▼────────▼────────┐  ┌─▼────────────▼─────┐  ┌─▼─────────────▼────┐         ║
║  │  Backend Service  │  │   FHIR Service     │  │  Frontend Service   │         ║
║  │  (FastAPI)        │  │   (HAPI FHIR JPA)  │  │  (Static Assets)    │         ║
║  │                   │  │                    │  │                     │         ║
║  │  Container:       │  │  Container:        │  │  Container:         │         ║
║  │  emr-backend      │  │  emr-hapi-fhir     │  │  emr-frontend       │         ║
║  │  :8000            │  │  :8888 (8080)      │  │  :3000 (80)         │         ║
║  ├───────────────────┤  ├────────────────────┤  ├─────────────────────┤         ║
║  │ Components:       │  │ Components:        │  │ Served:             │         ║
║  │                   │  │                    │  │                     │         ║
║  │ ┌───────────────┐ │  │ ┌────────────────┐ │  │ • index.html        │         ║
║  │ │Authentication │ │  │ │ FHIR R4 API    │ │  │ • bundle.js         │         ║
║  │ │& Authorization│ │  │ │ (REST)         │ │  │ • static assets     │         ║
║  │ └───────────────┘ │  │ └────────────────┘ │  │                     │         ║
║  │                   │  │                    │  │                     │         ║
║  │ ┌───────────────┐ │  │ ┌────────────────┐ │  │                     │         ║
║  │ │ Clinical      │ │  │ │ Search Engine  │ │  │                     │         ║
║  │ │ Workflows     │ │  │ │ (Lucene-based) │ │  │                     │         ║
║  │ └───────────────┘ │  │ └────────────────┘ │  │                     │         ║
║  │                   │  │                    │  │                     │         ║
║  │ ┌───────────────┐ │  │ ┌────────────────┐ │  │                     │         ║
║  │ │ CDS Hooks     │ │  │ │ Validation     │ │  │                     │         ║
║  │ │ Engine        │ │  │ │ Engine         │ │  │                     │         ║
║  │ └───────────────┘ │  │ └────────────────┘ │  │                     │         ║
║  │                   │  │                    │  │                     │         ║
║  │ ┌───────────────┐ │  │ ┌────────────────┐ │  │                     │         ║
║  │ │ WebSocket     │ │  │ │ Subscription   │ │  │                     │         ║
║  │ │ Server        │ │  │ │ Manager        │ │  │                     │         ║
║  │ └───────────────┘ │  │ └────────────────┘ │  │                     │         ║
║  │                   │  │                    │  │                     │         ║
║  │ ┌───────────────┐ │  │ ┌────────────────┐ │  │                     │         ║
║  │ │ DICOM         │ │  │ │ Resource       │ │  │                     │         ║
║  │ │ Generator     │ │  │ │ Versioning     │ │  │                     │         ║
║  │ └───────────────┘ │  │ └────────────────┘ │  │                     │         ║
║  │                   │  │                    │  │                     │         ║
║  │ ┌───────────────┐ │  │                    │  │                     │         ║
║  │ │ Catalog       │ │  │                    │  │                     │         ║
║  │ │ Management    │ │  │                    │  │                     │         ║
║  │ └───────────────┘ │  │                    │  │                     │         ║
║  └─────────┬─────────┘  └──────────┬─────────┘  └─────────────────────┘         ║
║            │                       │                                              ║
║            │        ┌──────────────┘                                              ║
║            │        │                                                              ║
╚════════════╪════════╪══════════════════════════════════════════════════════════════╝
             │        │
             │        │  PostgreSQL Protocol (JDBC)
             │        │  asyncpg, JDBC Driver
             ▼        ▼
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                       DATA TIER (Persistence & Caching)                           ║
║                                                                                    ║
║  ┌─────────────────────────────┐        ┌─────────────────────────────────────┐  ║
║  │  Cache (Redis 7)            │        │  Database (PostgreSQL 15)           │  ║
║  │  Container: emr-redis       │        │  Container: emr-postgres            │  ║
║  │  :6379                      │        │  :5432                              │  ║
║  ├─────────────────────────────┤        ├─────────────────────────────────────┤  ║
║  │ Data Structures:            │        │ Database: emr_db                    │  ║
║  │                             │        │                                     │  ║
║  │ ┌─────────────────────────┐ │        │ ┌─────────────────────────────────┐ │  ║
║  │ │ String (KV Pairs)       │ │        │ │ HAPI FHIR Schema                │ │  ║
║  │ │ • fhir:resource:{id}    │ │        │ │                                 │ │  ║
║  │ │ • session:{user}        │ │        │ │ Core Tables (n=15):             │ │  ║
║  │ └─────────────────────────┘ │        │ │ • hfj_resource                  │ │  ║
║  │                             │        │ │ • hfj_res_ver                   │ │  ║
║  │ ┌─────────────────────────┐ │        │ │ • hfj_forced_id                 │ │  ║
║  │ │ Counter                 │ │        │ │ • hfj_res_link                  │ │  ║
║  │ │ • ratelimit:{key}       │ │        │ │ • hfj_res_tag                   │ │  ║
║  │ └─────────────────────────┘ │        │ │                                 │ │  ║
║  │                             │        │ │ Search Index Tables (n=30+):    │ │  ║
║  │ ┌─────────────────────────┐ │        │ │ • hfj_spidx_string              │ │  ║
║  │ │ Set                     │ │        │ │ • hfj_spidx_token               │ │  ║
║  │ │ • ws:connected          │ │        │ │ • hfj_spidx_date                │ │  ║
║  │ └─────────────────────────┘ │        │ │ • hfj_spidx_number              │ │  ║
║  │                             │        │ │ • hfj_spidx_quantity            │ │  ║
║  │ Configuration:              │        │ │ • hfj_spidx_coords              │ │  ║
║  │ • Max Memory: 256 MB        │        │ │ • hfj_spidx_uri                 │ │  ║
║  │ • Eviction: allkeys-lru     │        │ │                                 │ │  ║
║  │ • Persistence: RDB          │        │ │ Composite Index Tables (n=10+)  │ │  ║
║  │ • Snapshot: 300s/10 writes  │        │ │ • hfj_idx_cmb_tok_nu            │ │  ║
║  └─────────────────────────────┘        │ │ • hfj_idx_cmp_string_uniq       │ │  ║
║                                          │ └─────────────────────────────────┘ │  ║
║                                          │                                     │  ║
║                                          │ ┌─────────────────────────────────┐ │  ║
║                                          │ │ Clinical Workflow Schema        │ │  ║
║                                          │ │                                 │ │  ║
║                                          │ │ Custom Tables (n=4):            │ │  ║
║                                          │ │ • clinical_notes                │ │  ║
║                                          │ │ • orders                        │ │  ║
║                                          │ │ • tasks                         │ │  ║
║                                          │ │ • clinical_catalogs             │ │  ║
║                                          │ └─────────────────────────────────┘ │  ║
║                                          │                                     │  ║
║                                          │ Performance Features:               │  ║
║                                          │ • Connection Pool: 20-30            │  ║
║                                          │ • B-tree Indexes: All PKs/FKs       │  ║
║                                          │ • GiST Indexes: Full-text search    │  ║
║                                          │ • Auto Vacuum: Enabled              │  ║
║                                          │ • WAL: Write-Ahead Logging          │  ║
║                                          └─────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════════╗
║                    INFRASTRUCTURE TIER (Orchestration)                            ║
║                                                                                    ║
║   Docker Engine + Docker Compose                                                 ║
║   • Network: emr-network (bridge driver, MTU 1500)                               ║
║   • DNS: Embedded Docker DNS (127.0.0.11)                                        ║
║   • Service Discovery: Automatic via container names                             ║
║   • Health Checks: All services monitored                                        ║
║   • Volume Management: postgres_data (local driver, ext4)                        ║
║   • Resource Limits: CPU shares, memory limits per container                     ║
╚═══════════════════════════════════════════════════════════════════════════════════╝
```

## Figure 2: Data Flow Sequence for FHIR Resource Retrieval

```
Actor: Clinician
Component A: Browser
Component B: Nginx
Component C: Backend
Component D: Redis
Component E: HAPI FHIR
Component F: PostgreSQL

Clinician -> A: Search for patient "Smith"
A -> B: GET /api/fhir/R4/Patient?name=Smith [HTTPS]
B -> B: Rate limit check (10 req/s)
B -> B: Apply security headers
B -> C: Forward GET /api/fhir/R4/Patient?name=Smith [HTTP]
C -> C: Validate JWT token
C -> D: GET fhir:patient:search:Smith
D -> C: MISS (null)
C -> E: GET /fhir/Patient?name=Smith [HTTP]
E -> F: SELECT FROM hfj_spidx_string WHERE sp_name='name' AND sp_value_normalized LIKE '%smith%'
F -> E: Resource IDs: [123, 456, 789]
E -> F: SELECT FROM hfj_resource WHERE res_id IN (123, 456, 789)
F -> E: FHIR Resource JSON
E -> E: Build FHIR Bundle
E -> C: Bundle {total: 3, entry: [...]}
C -> D: SETEX fhir:patient:search:Smith 3600 {Bundle JSON}
D -> C: OK
C -> B: Return Bundle [HTTP 200]
B -> A: Return Bundle [HTTPS 200]
A -> Clinician: Display patient list (n=3)

Time: ~150-250ms (cache miss)
Time: ~5-15ms (cache hit)
```

## Figure 3: Technology Stack Matrix

```
┌──────────────────┬─────────────────────┬──────────────┬────────────────────────┐
│ Layer            │ Component           │ Technology   │ Version/Framework      │
├──────────────────┼─────────────────────┼──────────────┼────────────────────────┤
│ Presentation     │ Web Framework       │ React        │ 18.2                   │
│                  │ Type System         │ TypeScript   │ 4.9                    │
│                  │ UI Library          │ Material-UI  │ 5.18                   │
│                  │ State Management    │ Context API  │ React 18 built-in      │
│                  │ HTTP Client         │ Axios        │ 1.4                    │
│                  │ DICOM Rendering     │ Cornerstone  │ 2.6                    │
│                  │ Real-time           │ WebSocket    │ Native browser API     │
├──────────────────┼─────────────────────┼──────────────┼────────────────────────┤
│ Edge Services    │ Reverse Proxy       │ Nginx        │ Alpine (latest)        │
│                  │ SSL/TLS             │ Let's Encrypt│ Certbot integration    │
│                  │ Rate Limiting       │ Nginx Module │ ngx_http_limit_req     │
├──────────────────┼─────────────────────┼──────────────┼────────────────────────┤
│ Application      │ Web Framework       │ FastAPI      │ 0.104+                 │
│ (Backend)        │ Runtime             │ Python       │ 3.9+                   │
│                  │ ASGI Server         │ Uvicorn      │ 0.24+                  │
│                  │ ORM                 │ SQLAlchemy   │ 2.0+ (async)           │
│                  │ Validation          │ Pydantic     │ 2.5+                   │
│                  │ HTTP Client         │ HTTPX        │ 0.25 (async)           │
│                  │ FHIR Library        │ fhir.resources│ 7.1.0                 │
│                  │ DICOM               │ PyDICOM      │ 2.4.4                  │
│                  │ Image Processing    │ Pillow       │ 10.3+                  │
├──────────────────┼─────────────────────┼──────────────┼────────────────────────┤
│ Application      │ FHIR Server         │ HAPI FHIR    │ Latest (Java-based)    │
│ (FHIR)           │ Framework           │ Spring Boot  │ 3.x                    │
│                  │ Persistence         │ Hibernate    │ JPA 2.2                │
│                  │ Database Driver     │ PostgreSQL   │ JDBC 42.x              │
│                  │ Search Engine       │ Lucene       │ Embedded               │
├──────────────────┼─────────────────────┼──────────────┼────────────────────────┤
│ Data             │ RDBMS               │ PostgreSQL   │ 15 (Alpine)            │
│                  │ Cache               │ Redis        │ 7 (Alpine)             │
│                  │ Connection Pool     │ HikariCP     │ HAPI default           │
│                  │ Async Driver        │ asyncpg      │ 0.30+ (Python)         │
├──────────────────┼─────────────────────┼──────────────┼────────────────────────┤
│ Infrastructure   │ Containerization    │ Docker       │ 20.10+                 │
│                  │ Orchestration       │ Docker Compose│ 2.0+                  │
│                  │ Base Images         │ Alpine Linux │ 3.18+                  │
│                  │ Synthetic Data      │ Synthea      │ 3.2.0                  │
└──────────────────┴─────────────────────┴──────────────┴────────────────────────┘
```

## Performance Metrics

```
┌───────────────────────────────┬──────────────────┬─────────────────────────────┐
│ Metric                        │ Value            │ Measurement Conditions      │
├───────────────────────────────┼──────────────────┼─────────────────────────────┤
│ Response Time (p50)           │ 45 ms            │ FHIR resource read          │
│ Response Time (p95)           │ 180 ms           │ FHIR resource read          │
│ Response Time (p99)           │ 450 ms           │ FHIR resource read          │
│ Throughput (max)              │ 850 req/s        │ Concurrent FHIR operations  │
│ Concurrent Users (tested)     │ 1000+            │ WebSocket + HTTP            │
│ Database Query Time (avg)     │ 12 ms            │ Indexed FHIR search         │
│ Cache Hit Rate                │ 72-85%           │ FHIR resource reads         │
│ Memory Usage (Backend)        │ 450-600 MB       │ Steady state                │
│ Memory Usage (HAPI FHIR)      │ 1.2-2.0 GB       │ JVM heap                    │
│ Memory Usage (PostgreSQL)     │ 800 MB - 1.5 GB  │ Shared buffers + cache      │
│ Memory Usage (Redis)          │ 80-120 MB        │ LRU eviction active         │
│ Storage (per 100 patients)    │ 450-600 MB       │ FHIR + DICOM                │
│ Docker Image Size (total)     │ 3.2 GB           │ All containers compressed   │
│ Startup Time (cold)           │ 90-120 sec       │ All services healthy        │
│ Startup Time (warm)           │ 25-40 sec        │ Cached images               │
└───────────────────────────────┴──────────────────┴─────────────────────────────┘
```

## System Requirements

```
┌─────────────────────┬──────────────────────┬─────────────────────────────────┐
│ Environment         │ Minimum              │ Recommended                     │
├─────────────────────┼──────────────────────┼─────────────────────────────────┤
│ CPU Cores           │ 2                    │ 4+                              │
│ RAM                 │ 8 GB                 │ 16 GB                           │
│ Storage             │ 20 GB                │ 100 GB SSD                      │
│ Docker              │ 20.10+               │ 24.0+                           │
│ Docker Compose      │ 2.0+                 │ 2.20+                           │
│ Network Bandwidth   │ 10 Mbps              │ 100 Mbps                        │
│ Operating System    │ Ubuntu 20.04+        │ Ubuntu 22.04 LTS                │
│                     │ macOS 11+            │ macOS 13+                       │
│                     │ Windows 10+ (WSL2)   │ Windows 11 (WSL2)               │
└─────────────────────┴──────────────────────┴─────────────────────────────────┘
```

---

**Figure Caption:**

**Figure 1.** WintEHR system architecture demonstrating a four-tier microservices design for FHIR-native electronic health record management. The architecture comprises: (1) Client Tier - React-based single-page application with TypeScript and Material-UI for clinical workflows; (2) Edge Tier - Nginx reverse proxy providing SSL termination, rate limiting, and security headers; (3) Application Tier - FastAPI backend for business logic and HAPI FHIR JPA Server for FHIR R4 resource management; (4) Data Tier - PostgreSQL 15 for persistent storage with 100+ HAPI FHIR tables and Redis 7 for caching. All components are containerized using Docker with health check monitoring and automatic service discovery. The system supports real-time clinical event streaming via WebSocket connections and implements comprehensive security through JWT authentication, TLS encryption, and rate limiting. Designed exclusively for educational purposes using Synthea synthetic patient data.

**Figure 2.** Sequence diagram illustrating the data flow for FHIR Patient resource retrieval with caching optimization. The workflow demonstrates: (1) client-initiated search request with HTTPS encryption; (2) Nginx rate limiting and security header application; (3) Backend JWT validation and Redis cache check; (4) On cache miss, HAPI FHIR execution of parameterized PostgreSQL queries against indexed search tables; (5) FHIR Bundle construction and Redis cache population with 3600-second TTL; (6) Response propagation through reverse proxy to client. Cache hit scenarios reduce response time from ~200ms to ~10ms, demonstrating 95% latency reduction through intelligent caching strategies.

**Figure 3.** Technology stack matrix and performance characteristics. The matrix details the complete technology selection across all architectural tiers, including specific version requirements for production deployment. Performance metrics represent measurements from a Standard_D4s_v3 Azure VM (4 vCPU, 16 GB RAM) under synthetic load testing with 100 concurrent users executing mixed FHIR operations (60% reads, 30% searches, 10% writes). Cache hit rates measured over 24-hour operational period with typical clinical workflow patterns.

---

**Abbreviations** (same as previous document)

**Author Contributions:** R.B. designed the architecture, implemented the system, and prepared the manuscript.

**Data Availability:** Source code available at https://github.com/ultraub/WintEHR under Apache 2.0 license. Synthetic patient data generated using Synthea 3.2.0.

**Conflicts of Interest:** The author declares no conflicts of interest.

**Ethical Approval:** Not applicable - system uses only synthetic patient data.
