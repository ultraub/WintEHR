# WintEHR - Modern FHIR-Native Electronic Medical Records System

A comprehensive, educational EMR system built with React and FastAPI, featuring full FHIR R4 compliance, real-time clinical workflows, and modern medical imaging support.

## 🚀 Quick Start (Recommended)

**Prerequisites:**
- Docker Desktop (required)
- Git

**One Command Setup:**
```bash
# Clone and start everything
git clone https://github.com/yourusername/WintEHR.git
cd WintEHR

# Complete deployment with patient data and DICOM images
./deploy.sh

# Or for quick testing (no patient generation)
./quick-start.sh
```

**That's it!** The deployment script will:
- ✅ Auto-detect your environment (macOS, Linux, AWS)
- ✅ Install and configure Docker if needed
- ✅ Build and start all containers with proper health checks
- ✅ Initialize database with definitive FHIR schema
- ✅ Generate realistic patients with complete medical histories
- ✅ Create DICOM imaging studies with real medical images
- ✅ Configure all clinical workflows and integrations

### Access Points
- **EMR Frontend**: http://localhost:3000
- **FHIR API**: http://localhost:8000/fhir/R4  
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/api/health

### Login
- **Training Mode** (default): Select any provider, no password required
- **JWT Mode**: Set `JWT_ENABLED=true` for secure authentication

## 🌟 Key Features

### 🏥 Complete Clinical Workflows
- **Clinical Workspace V3**: Full-featured EMR with multiple specialized tabs
  - **Chart Review**: Problem list management, medication reconciliation, allergy tracking
  - **Results & Labs**: Lab trends with reference ranges, abnormal value highlighting
  - **Orders**: Comprehensive ordering system with status tracking
  - **Encounters**: Visit summaries with expandable clinical details
  - **Pharmacy**: Complete dispensing workflow with queue management
  - **Imaging**: DICOM viewer with real medical images and multi-slice navigation
- **Patient Dashboard**: Real-time FHIR-native patient summary with full medical timeline
- **Cross-Module Integration**: Event-driven workflow orchestration between clinical tabs

### 🔬 Advanced FHIR Capabilities  
- **Complete FHIR R4 API**: All CRUD operations, advanced search, batch/transaction support
- **Real-Time Updates**: WebSocket-powered clinical notifications and data synchronization
- **FHIR-Native Storage**: PostgreSQL with JSONB for flexible, scalable resource storage
- **Search & Indexing**: Advanced parameter indexing with reference resolution

### 🖼️ Medical Imaging & DICOM
- **Full DICOM Support**: Real medical image viewing with multi-slice navigation
- **Integrated Workflow**: DICOM studies linked to patient records and orders
- **Medical Image Generation**: Realistic CT, MRI, and X-ray studies for training

### 🧠 Clinical Decision Support
- **CDS Hooks Integration**: 12+ built-in clinical decision support hooks
- **Real-Time Alerts**: Diabetes monitoring, hypertension management, kidney function tracking
- **Safety Alerts**: Opioid risk assessment, drug interaction checking
- **Care Gaps**: Automated reminders for preventive care and follow-ups

### 📊 Analytics & Quality
- **Lab Reference Ranges**: Automatic abnormal value detection with 40+ LOINC codes
- **Clinical Trends**: Multi-year data visualization and trend analysis
- **Quality Measures**: Built-in clinical quality tracking and reporting

## 🏗️ Architecture

**Modern Container-Based Architecture:**

```
WintEHR/
├── frontend/                   # React SPA (Port 3000)
│   ├── src/components/clinical # Clinical workspace components
│   ├── src/services/          # FHIR client and API services  
│   └── src/contexts/          # State management & workflows
├── backend/                   # FastAPI API (Port 8000)
│   ├── api/fhir/             # FHIR R4 REST API implementation
│   ├── api/clinical/         # EMR-specific clinical workflows
│   ├── core/fhir/            # FHIR storage engine & operations
│   └── scripts/              # Data management and utilities
├── synthea/                  # Synthetic patient data generator
├── Makefile                  # Primary build automation
└── docker-compose.yml       # Container orchestration
```

**Key Architectural Principles:**
- **FHIR-First Design**: All clinical data stored as valid FHIR R4 resources
- **Event-Driven Workflows**: Real-time cross-module communication
- **Microservice Ready**: Clean API separation for scalability
- **Container Native**: Docker-first deployment and development

## 🛠️ Development

### Quick Development Commands
```bash
# Complete fresh deployment
./deploy.sh --patients 10

# Development with quick setup
./quick-start.sh

# Infrastructure only (no data generation)
./deploy.sh --skip-data --no-dicom

# AWS deployment
./deploy.sh --environment aws --patients 20

# Custom configuration
./deploy.sh --patients 50 --validation strict --no-dicom
```

### Manual Docker Development 
```bash
# Start containers manually
docker-compose up -d

# Initialize database
docker exec emr-backend python scripts/init_database_definitive.py

# Generate test data
docker exec emr-backend python scripts/synthea_master.py generate --count 10
docker exec emr-backend python scripts/synthea_master.py import --validation-mode light

# View logs
docker-compose logs -f backend
```

### Local Development (Advanced)
```bash
# Backend (requires Python 3.9+, PostgreSQL)
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# Frontend (requires Node.js 16+)
cd frontend  
npm install
npm start
```

### Health Checks & Debugging
```bash
# Check deployment status
curl http://localhost:8000/health
curl http://localhost:8000/fhir/R4/Patient

# View deployment configuration
cat .deployment-config

# Stop everything
docker-compose down -v
```

## 🧪 Synthetic Patient Data

**Powered by Synthea™** - Generate unlimited realistic patients:

```bash
# Most common: Generate patients with all features
python backend/scripts/synthea_master.py full --count 20 --include-dicom --clean-names

# Advanced: Custom generation
python backend/scripts/synthea_master.py generate --count 50 --state California --city "Los Angeles"

# Individual operations
python backend/scripts/synthea_master.py setup     # Setup Synthea
python backend/scripts/synthea_master.py generate  # Generate patients only
python backend/scripts/synthea_master.py wipe      # Clear all data
python backend/scripts/synthea_master.py import    # Import existing data
```

**What You Get:**
- **Complete Medical Histories**: Multi-year patient timelines with realistic conditions
- **Comprehensive Resources**: 12,000+ FHIR resources across 24+ resource types
- **Real Clinical Data**: Lab results with reference ranges, medications with RxNorm codes
- **Medical Imaging**: Realistic DICOM studies (CT, MRI, X-ray) with actual image files
- **Provider Networks**: Healthcare organizations, practitioners, and care teams
- **Insurance Coverage**: Realistic payer and coverage information

## 📦 Production Deployment

### AWS EC2 (Automated)
```bash
# On fresh EC2 instance
git clone <repo-url>
cd WintEHR
./deploy.sh --environment aws --patients 25

# With AWS-specific optimizations
docker-compose -f docker-compose.yml -f docker-compose.aws.yml up -d
```

### Local Production Setup
```bash
# Production deployment with comprehensive data
./deploy.sh --patients 100 --validation strict

# Infrastructure ready for external connections
./deploy.sh --skip-data  # Then load your own FHIR data
```

### Custom Docker Deployment
```bash
# Environment-specific deployment
export PATIENT_COUNT=50
export INCLUDE_DICOM=true
export VALIDATION_MODE=strict
./deploy.sh
```

## 📚 Documentation

### Essential Documentation
- **[Quick Reference](CLAUDE.md)** - Developer quick start and best practices
- **[System Architecture](docs/SYSTEM_ARCHITECTURE.md)** - Complete technical architecture
- **[API Endpoints](docs/API_ENDPOINTS.md)** - Comprehensive API reference
- **[Project Integrity Guide](PROJECT_INTEGRITY_GUIDE.md)** - Common issues and solutions

### Advanced Documentation  
- **[FHIR Implementation](docs/FHIR_README.md)** - FHIR R4 API details and compliance
- **[Testing Guide](docs/TESTING.md)** - Comprehensive testing procedures
- **[DICOM Deployment](docs/AZURE_DICOM_DEPLOYMENT.md)** - Medical imaging setup
- **[WebSocket Implementation](docs/websocket-implementation.md)** - Real-time features

### Configuration & Deployment
- **[Deployment Guide](DEPLOYMENT.md)** - Complete deployment procedures for all environments
- **[Tech Stack Modernization](docs/TECH_STACK_MODERNIZATION.md)** - Architecture decisions
- **[CQL Analysis](docs/CQL_ANALYSIS.md)** - Clinical Quality Language support

## 🛠️ Troubleshooting

### Quick Fixes
```bash
# Complete reset and restart
docker-compose down -v
./deploy.sh

# Just restart services
./quick-start.sh

# Check service health
curl http://localhost:8000/health
docker-compose ps
```

### Common Issues
1. **"Cannot connect to Docker daemon"**
   - Start Docker Desktop and wait for full startup
   - Check Docker icon shows "Running"

2. **Port conflicts (3000, 8000, 5432)**
   - Stop conflicting services: `lsof -ti:3000 | xargs kill`
   - Or modify ports in `docker-compose.yml`

3. **Database schema errors**
   - Run: `docker exec emr-backend python scripts/init_database_definitive.py`
   - Or full reset: `./deploy.sh`

4. **Missing patient data**
   - Generate data: `./deploy.sh --patients 20`
   - Verify: `curl http://localhost:8000/fhir/R4/Patient`

5. **AWS deployment issues**
   - Ensure security groups allow ports 22, 80, 3000, 8000, 5432
   - Check instance has sufficient resources (t3.medium+)
   - Verify Docker is installed: `sudo systemctl status docker`

## 🎯 Use Cases

### Educational Training
- **Medical Informatics**: Complete FHIR implementation for teaching
- **Clinical Workflows**: Real EMR experience with synthetic patients
- **Interoperability**: Standards-based integration patterns

### Development & Integration
- **FHIR Development**: Full R4 server for application development
- **Integration Testing**: Realistic test data and workflows
- **Standards Compliance**: Production-ready FHIR implementation

### Research & Analysis
- **Clinical Analytics**: Large datasets with realistic patterns
- **Algorithm Development**: Standardized data for ML/AI development
- **Quality Measurement**: Clinical quality reporting and analysis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes with tests
4. Run full test suite: `make test`
5. Submit a pull request

**Development Guidelines:**
- Follow existing code patterns and architecture
- Use only Synthea-generated FHIR data for testing
- Include comprehensive tests for new features
- Update documentation for user-facing changes

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **FHIR®** is a registered trademark of HL7 International
- **Synthea™** synthetic patient data generator
- Built with **FastAPI**, **React**, **PostgreSQL**, and **Docker**
- Medical imaging powered by **DICOM** standards
- Clinical decision support via **CDS Hooks**

---

**Ready to explore modern healthcare technology?** Start with `./deploy.sh` and access the EMR at http://localhost:3000

### Quick Commands Reference
```bash
./deploy.sh                    # Full deployment with patient data
./quick-start.sh              # Quick setup for immediate testing  
./deploy.sh --help            # Show all deployment options
docker-compose down -v        # Stop and reset everything
```