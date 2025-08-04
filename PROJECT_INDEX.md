# MedGenEMR (WintEHR) Project Index

**Generated**: 2025-07-19  
**Version**: 1.0  
**Purpose**: Comprehensive navigation guide for the MedGenEMR project

## 📚 Table of Contents

1. [Project Overview](#project-overview)
2. [Quick Navigation](#quick-navigation)
3. [Directory Structure](#directory-structure)
4. [Documentation Map](#documentation-map)
5. [Key Components](#key-components)
6. [Development Resources](#development-resources)
7. [Clinical Modules](#clinical-modules)
8. [Technical Architecture](#technical-architecture)

## 🎯 Project Overview

**MedGenEMR (WintEHR)** is a production-ready Electronic Medical Records system featuring:
- Full FHIR R4 compliance with 38 resource types
- Real-time clinical workflows via WebSocket
- Dynamic clinical catalogs from patient data
- DICOM medical imaging with multi-slice viewer
- CDS Hooks integration with 10+ clinical rules

## 🚀 Quick Navigation

### Essential Documentation
- **[CLAUDE.md](./CLAUDE.md)** - AI agent operational guide
- **[CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md)** - Detailed patterns & troubleshooting
- **[README.md](./README.md)** - Project overview
- **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** - Common commands

### Deployment & Setup
- **[fresh-deploy.sh](./fresh-deploy.sh)** - Quick deployment script
- **[docs/DEPLOYMENT_CHECKLIST.md](./docs/DEPLOYMENT_CHECKLIST.md)** - Complete deployment guide
- **[docs/BUILD_PROCESS_ANALYSIS.md](./docs/BUILD_PROCESS_ANALYSIS.md)** - Build system deep dive

### Development Guides
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System architecture
- **[docs/API_ENDPOINTS.md](./docs/API_ENDPOINTS.md)** - API reference

## 📁 Directory Structure

```
MedGenEMR/
├── 🎨 frontend/                    # React SPA application
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   │   ├── clinical/         # Clinical-specific components
│   │   │   ├── common/           # Shared components
│   │   │   └── layout/           # Layout components
│   │   ├── services/             # API clients & business logic
│   │   │   ├── fhirService.js   # FHIR operations
│   │   │   └── cdsClinicalDataService.js # Clinical catalogs
│   │   ├── contexts/             # React context providers
│   │   │   ├── ClinicalWorkflowContext.js # Event system
│   │   │   └── WebSocketContext.js # Real-time updates
│   │   ├── hooks/                # Custom React hooks
│   │   └── pages/                # Main application pages
│   │       ├── PatientPortal.js  # Main patient interface
│   │       └── PharmacyDashboard.js # Pharmacy interface
│   └── public/                    # Static assets
│
├── 🔧 backend/                     # FastAPI server
│   ├── api/                       # API endpoints
│   │   ├── auth_enhanced.py      # Authentication
│   │   ├── fhir_r4_endpoints.py  # FHIR endpoints
│   │   └── routers/              # API routers
│   ├── fhir/                      # FHIR implementation
│   │   ├── core/                 # Core FHIR engine
│   │   └── resources/            # Resource definitions
│   ├── services/                  # Business services
│   ├── models/                    # Database models
│   └── scripts/                   # Management scripts
│       ├── active/               # Active data scripts
│       │   └── synthea_master.py # Patient data generation
│       ├── setup/                # Setup scripts
│       │   └── init_database_definitive.py # DB initialization
│       └── utilities/            # Utility scripts
│
├── 📚 docs/                        # Documentation
│   ├── modules/                   # Module-specific docs
│   │   ├── chart-review/         # Chart review guide
│   │   ├── orders/               # Orders system guide
│   │   ├── pharmacy/             # Pharmacy guide
│   │   └── integration/          # Integration patterns
│   ├── state/                     # State management docs
│   └── frontend/                  # Frontend architecture
│
├── 🤖 .claude/                     # AI agent configuration
│   ├── agents/                    # Automation scripts
│   ├── hooks/                     # Lifecycle hooks
│   └── knowledge/                 # Pattern library
│
├── 🐳 Docker files
│   ├── docker-compose.yml         # Main orchestration
│   ├── docker-compose.dev.yml     # Dev overrides
│   ├── Dockerfile.frontend        # Frontend container
│   └── Dockerfile.backend         # Backend container
│
└── 📋 Configuration
    ├── nginx.conf                 # Reverse proxy
    ├── Makefile                   # Dev shortcuts
    └── .env.example              # Environment template
```

## 📑 Documentation Map

### Core Documentation
| Document | Purpose | Location |
|----------|---------|----------|
| Project Overview | Main project introduction | [README.md](./README.md) |
| AI Agent Guide | AI development instructions | [CLAUDE.md](./CLAUDE.md) |
| Architecture | System design & patterns | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| API Reference | Endpoint documentation | [docs/API_ENDPOINTS.md](./docs/API_ENDPOINTS.md) |

### Module Documentation
| Module | Guide | Location |
|--------|-------|----------|
| Chart Review | Clinical data viewing | [docs/modules/chart-review/](./docs/modules/chart-review/) |
| Orders | CPOE system | [docs/modules/orders/](./docs/modules/orders/) |
| Results | Lab results viewing | [docs/modules/results/](./docs/modules/results/) |
| Pharmacy | Medication dispensing | [docs/modules/pharmacy/](./docs/modules/pharmacy/) |
| Imaging | DICOM viewer | [docs/modules/imaging/](./docs/modules/imaging/) |

### Technical Documentation
| Topic | Description | Location |
|-------|-------------|----------|
| Real-Time Updates | Multi-user synchronization | [docs/REAL_TIME_UPDATES_*.md](./docs/) |
| WebSocket Architecture | Real-time communication | [docs/REAL_TIME_UPDATES_ARCHITECTURE.md](./docs/REAL_TIME_UPDATES_ARCHITECTURE.md) |
| Implementation Guide | Adding real-time features | [docs/REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md](./docs/REAL_TIME_UPDATES_IMPLEMENTATION_GUIDE.md) |
| Frontend State | State management patterns | [docs/state/](./docs/state/) |
| Build Process | Deployment pipeline | [docs/BUILD_PROCESS_ANALYSIS.md](./docs/BUILD_PROCESS_ANALYSIS.md) |
| Search Parameters | FHIR search indexing | [docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md](./docs/SEARCH_PARAM_BUILD_INTEGRATION_SUMMARY.md) |
| Integration | Cross-module communication | [docs/modules/integration/cross-module-integration.md](./docs/modules/integration/cross-module-integration.md) |

## 🔑 Key Components

### Frontend Services
- **[fhirService.js](./frontend/src/services/fhirService.js)** - FHIR API operations
- **[cdsClinicalDataService.js](./frontend/src/services/cdsClinicalDataService.js)** - Clinical catalogs
- **[ClinicalWorkflowContext.js](./frontend/src/contexts/ClinicalWorkflowContext.js)** - Event system
- **[WebSocketContext.js](./frontend/src/contexts/WebSocketContext.js)** - Real-time updates

### Backend Services
- **[auth_enhanced.py](./backend/api/auth_enhanced.py)** - JWT authentication
- **[storage.py](./backend/fhir/core/storage.py)** - FHIR storage engine
- **[synthea_master.py](./backend/scripts/active/synthea_master.py)** - Patient data generation

### Critical Scripts
- **[consolidated_search_indexing.py](./backend/scripts/consolidated_search_indexing.py)** - Search parameter indexing
- **[populate_compartments.py](./backend/scripts/populate_compartments.py)** - Patient compartments
- **[verify_all_fhir_tables.py](./backend/scripts/verify_all_fhir_tables.py)** - Database validation

## 🛠️ Development Resources

### Quick Commands
```bash
# Development
./fresh-deploy.sh                  # Quick deployment
./dev-start.sh                     # Start dev environment
./load-patients.sh 20              # Load 20 patients

# Testing
docker exec emr-backend pytest tests/ -v
docker exec emr-frontend npm test

# Validation
docker exec emr-backend python scripts/validate_deployment.py --docker --verbose
```

### Git Workflow
- **Conventional Commits Required**: feat:, fix:, docs:, chore:
- **Branch Strategy**: feature/*, bugfix/*, release/*
- **PR Requirements**: Tests pass, documentation updated

## 🏥 Clinical Modules

### Patient Portal
- **Location**: [frontend/src/pages/PatientPortal.js](./frontend/src/pages/PatientPortal.js)
- **Features**: Chart review, orders, results, medications, imaging

### Pharmacy Dashboard
- **Location**: [frontend/src/pages/PharmacyDashboard.js](./frontend/src/pages/PharmacyDashboard.js)
- **Features**: Prescription queue, dispensing, medication history

### Clinical Components
- **Chart Review**: [ChartReviewTab.js](./frontend/src/components/tabs/ChartReviewTab.js)
- **Orders**: [OrdersTab.js](./frontend/src/components/tabs/OrdersTab.js)
- **Results**: [ResultsTab.js](./frontend/src/components/tabs/ResultsTab.js)
- **Imaging**: [ImagingTab.js](./frontend/src/components/tabs/ImagingTab.js)

## 🏗️ Technical Architecture

### Database Schema
- **6 FHIR Tables**: resources, resource_history, search_params, references, compartments, audit_logs
- **Search Indexing**: Automatic during resource creation/update
- **Patient Compartments**: Groups all patient-related resources

### API Architecture
- **FHIR Endpoints**: `/fhir/R4/{ResourceType}`
- **Custom Endpoints**: `/api/clinical/`, `/api/pharmacy/`
- **WebSocket**: `/ws` for real-time updates

### Frontend Architecture
- **State Management**: React Context API with custom hooks
- **Event System**: Pub/sub pattern for cross-module communication
- **Progressive Loading**: Bundle-based resource fetching

---

**Note**: This index is maintained as part of the project documentation. For detailed implementation patterns and troubleshooting, refer to [CLAUDE-REFERENCE.md](./CLAUDE-REFERENCE.md).