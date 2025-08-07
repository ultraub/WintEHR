# WintEHR Architecture Documentation

**Version**: 1.0.0  
**Last Updated**: 2025-08-06

## Overview

WintEHR is a modern, FHIR-native Electronic Health Record system built on a microservices architecture with clear separation of concerns between the presentation, business logic, and data layers.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Web    │  │  Mobile  │  │   FHIR   │  │   CDS    │  │
│  │   App    │  │   App    │  │  Client  │  │  Hooks   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────┬──────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                        API Gateway                           │
│                    (Nginx Reverse Proxy)                     │
└─────────────┬──────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  FastAPI Backend                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │   Auth   │  │   FHIR   │  │   CDS Services   │  │  │
│  │  │  Module  │  │    API   │  │     Engine       │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ WebSocket│  │  Clinical│  │     DICOM        │  │  │
│  │  │  Server  │  │  Catalog │  │    Handler       │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────┬──────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   PostgreSQL     │  │    Redis     │  │   File       │ │
│  │   (FHIR Store)   │  │   (Cache)    │  │   Storage    │ │
│  └──────────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18.2.0
- **UI Library**: Material-UI v5
- **State Management**: React Context API + Custom Hooks
- **HTTP Client**: Axios
- **WebSocket**: Socket.io-client
- **FHIR Client**: fhir.js
- **Visualization**: D3.js
- **Build Tool**: Webpack 5

### Backend
- **Framework**: FastAPI (Python 3.9+)
- **ASGI Server**: Uvicorn
- **Database ORM**: SQLAlchemy 2.0 (async)
- **Validation**: Pydantic v2
- **Authentication**: python-jose[cryptography] (JWT)
- **WebSocket**: python-socketio
- **FHIR Parser**: fhir.resources
- **Task Queue**: Celery (optional)

### Database
- **Primary Database**: PostgreSQL 15
  - JSONB storage for FHIR resources
  - Full-text search capabilities
  - Advanced indexing strategies
- **Cache Layer**: Redis 7
  - Session management
  - Query result caching
  - Real-time event pub/sub
- **File Storage**: Local filesystem
  - DICOM images
  - Generated reports
  - Audit logs

### Infrastructure
- **Containerization**: Docker 24+
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Nginx
- **Monitoring**: Prometheus + Grafana (optional)
- **Logging**: ELK Stack (optional)

## Core Components

### 1. Frontend Application

#### Component Architecture
```
frontend/src/
├── components/          # Reusable UI components
│   ├── clinical/       # Clinical-specific components
│   ├── common/         # Shared components
│   └── fhir-explorer/  # FHIR Explorer v4
├── contexts/           # React contexts
│   ├── AuthContext.js
│   ├── FHIRResourceContext.js
│   └── ClinicalWorkflowContext.js
├── hooks/              # Custom React hooks
│   ├── useFHIRResource.js
│   ├── useWebSocket.js
│   └── useClinicalWorkflow.js
├── services/           # Business logic & API calls
│   ├── fhirClient.js
│   ├── authService.js
│   └── websocket.js
└── pages/              # Route components
    ├── ClinicalWorkspace.js
    ├── PharmacyDashboard.js
    └── AdminPanel.js
```

#### Key Design Patterns
- **Container/Presenter Pattern**: Separation of logic and presentation
- **Custom Hooks**: Encapsulation of stateful logic
- **Context Providers**: Global state management
- **Error Boundaries**: Graceful error handling
- **Code Splitting**: Dynamic imports for performance

### 2. Backend API

#### API Architecture
```
backend/
├── api/                    # API endpoints
│   ├── auth/              # Authentication endpoints
│   ├── fhir/              # FHIR REST API
│   ├── cds_hooks/         # CDS Hooks services
│   └── services/          # Business services
├── fhir/                  # FHIR implementation
│   ├── core/              # Core FHIR logic
│   │   ├── storage.py     # Storage engine
│   │   ├── search.py      # Search implementation
│   │   └── validation.py  # Resource validation
│   └── resources/         # Resource handlers
├── services/              # Domain services
│   ├── clinical_catalog.py
│   ├── dicom_handler.py
│   └── audit_service.py
└── database/              # Database models
    ├── models.py
    └── session.py
```

#### API Design Principles
- **RESTful Design**: Standard HTTP methods and status codes
- **FHIR Compliance**: Full FHIR R4 specification support
- **Async/Await**: Non-blocking I/O operations
- **Dependency Injection**: Clean separation of concerns
- **Middleware Pipeline**: Request/response processing

### 3. Database Schema

#### FHIR Storage Design
```sql
-- Core FHIR Tables
fhir.resources          -- Main resource storage (JSONB)
fhir.resource_history   -- Version history tracking
fhir.search_params      -- Indexed search parameters
fhir.references         -- Resource relationships
fhir.compartments       -- Patient compartments
fhir.audit_logs        -- Audit trail

-- CDS Hooks Tables
cds_hooks.hook_configurations  -- Hook definitions
cds_hooks.service_registry     -- Registered services

-- Application Tables
app.users              -- User accounts
app.sessions           -- Active sessions
app.permissions        -- Role-based permissions
```

#### Key Database Features
- **JSONB Storage**: Flexible schema for FHIR resources
- **GIN Indexes**: Fast JSON queries
- **Materialized Views**: Performance optimization
- **Partitioning**: Large table management
- **Row-Level Security**: Data access control

## Data Flow

### 1. FHIR Resource Creation
```
Client → API Gateway → FastAPI → Validation → Storage Engine → PostgreSQL
                                      ↓
                                 Search Indexing
                                      ↓
                                 Compartment Update
                                      ↓
                                 Audit Logging
                                      ↓
                                 WebSocket Event
```

### 2. Clinical Decision Support
```
Clinical Action → CDS Hooks → Service Selection → Rule Evaluation
                                    ↓
                              Data Prefetch
                                    ↓
                              Decision Logic
                                    ↓
                              Card Generation → Client Display
```

### 3. Real-time Updates
```
Database Change → Trigger → Redis Pub/Sub → WebSocket Server
                                               ↓
                                         Connected Clients
                                               ↓
                                         UI State Update
```

## Security Architecture

### Authentication & Authorization
- **JWT-based Authentication**: Stateless token authentication
- **Role-Based Access Control (RBAC)**: Granular permission system
- **Session Management**: Redis-backed session storage
- **Multi-Factor Authentication**: Optional 2FA support

### Data Security
- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: TLS 1.3 for all connections
- **API Rate Limiting**: DDoS protection
- **Input Validation**: Comprehensive sanitization
- **SQL Injection Prevention**: Parameterized queries

### Audit & Compliance
- **Complete Audit Trail**: All FHIR operations logged
- **HIPAA Compliance**: PHI protection measures
- **Access Logging**: User activity tracking
- **Data Retention**: Configurable retention policies

## Performance Optimization

### Frontend Optimizations
- **Code Splitting**: Lazy loading of components
- **Bundle Optimization**: Tree shaking and minification
- **Image Optimization**: WebP format, lazy loading
- **Service Workers**: Offline capability
- **Virtual Scrolling**: Large list performance

### Backend Optimizations
- **Database Connection Pooling**: Efficient connection management
- **Query Optimization**: Indexed search parameters
- **Caching Strategy**: Multi-level caching
- **Async Operations**: Non-blocking I/O
- **Load Balancing**: Horizontal scaling ready

### Database Optimizations
- **Index Strategy**: Covering indexes for common queries
- **Query Plans**: Optimized execution plans
- **Vacuum & Analyze**: Regular maintenance
- **Partitioning**: Time-based partitioning for history
- **Connection Pooling**: PgBouncer integration

## Scalability

### Horizontal Scaling
- **Stateless Services**: Easy to scale horizontally
- **Database Replication**: Read replicas for query distribution
- **Cache Distribution**: Redis Cluster support
- **Load Balancing**: Round-robin or least-connections

### Vertical Scaling
- **Resource Monitoring**: CPU, memory, I/O metrics
- **Auto-scaling Policies**: Dynamic resource allocation
- **Performance Profiling**: Bottleneck identification

## Deployment Architecture

### Development Environment
```yaml
Services:
  - Frontend (React Dev Server): Port 3000
  - Backend (FastAPI): Port 8000
  - PostgreSQL: Port 5432
  - Redis: Port 6379
  - Nginx: Port 80
```

### Production Environment
```yaml
Services:
  - Frontend (Nginx Static): Port 443 (HTTPS)
  - Backend (Gunicorn/Uvicorn): Multiple workers
  - PostgreSQL: Primary + Read Replicas
  - Redis: Sentinel for HA
  - Load Balancer: AWS ALB/NLB
```

## Monitoring & Observability

### Metrics Collection
- **Application Metrics**: Response times, error rates
- **System Metrics**: CPU, memory, disk, network
- **Business Metrics**: User activity, resource usage

### Logging Strategy
- **Structured Logging**: JSON format for parsing
- **Log Levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Centralized Logging**: ELK Stack or CloudWatch

### Health Checks
- **Liveness Probes**: Service availability
- **Readiness Probes**: Service readiness
- **Dependency Checks**: Database, cache, external services

## Disaster Recovery

### Backup Strategy
- **Database Backups**: Daily automated backups
- **Point-in-Time Recovery**: Transaction log archiving
- **Geo-Replication**: Multi-region backup storage

### Recovery Procedures
- **RTO Target**: < 4 hours
- **RPO Target**: < 1 hour
- **Failover Process**: Automated with manual override
- **Data Validation**: Post-recovery integrity checks

## Integration Points

### External Systems
- **HL7 Integration**: Future HL7 v2 message support
- **DICOM PACS**: Medical imaging integration
- **Laboratory Systems**: Lab result interfaces
- **Pharmacy Systems**: Medication dispensing
- **HIE Integration**: Health Information Exchange

### Standards Compliance
- **FHIR R4**: Full specification support
- **CDS Hooks 2.0**: Clinical decision support
- **SMART on FHIR**: App platform capabilities
- **OAuth 2.0**: Authorization framework
- **OpenID Connect**: Identity layer

## Development Workflow

### CI/CD Pipeline
```
Code Push → GitHub Actions → Build → Test → Security Scan → Deploy
                ↓
           Code Quality
                ↓
           Unit Tests
                ↓
           Integration Tests
                ↓
           E2E Tests
```

### Environment Promotion
```
Development → Staging → UAT → Production
```

## Future Architecture Considerations

### Microservices Migration
- **Service Decomposition**: Breaking monolith into services
- **Service Mesh**: Istio or Linkerd for service communication
- **API Gateway**: Kong or AWS API Gateway

### Cloud-Native Features
- **Kubernetes Deployment**: Container orchestration
- **Serverless Functions**: AWS Lambda for event processing
- **Managed Services**: RDS, ElastiCache, S3

### Advanced Features
- **GraphQL API**: Alternative query interface
- **Event Sourcing**: Complete audit trail
- **CQRS Pattern**: Read/write separation
- **Machine Learning**: Clinical insights and predictions

---

Built with ❤️ for the healthcare community.