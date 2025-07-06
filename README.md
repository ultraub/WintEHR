# MedGenEMR - Modern FHIR-Native Electronic Medical Records System

A comprehensive, educational EMR system built with React and FastAPI, featuring full FHIR R4 compliance, real-time clinical workflows, and modern medical imaging support.

## 🚀 Quick Start (Recommended)

**Prerequisites:**
- Docker Desktop (required)
- Git

**One Command Setup:**
```bash
# Clone and start everything
git clone https://github.com/yourusername/MedGenEMR.git
cd MedGenEMR

# Complete fresh start with sample data
make fresh PATIENT_COUNT=20
```

**That's it!** The system will:
- ✅ Build and start all containers (PostgreSQL, Backend API, Frontend)
- ✅ Initialize database with complete FHIR schema
- ✅ Generate 20 realistic patients with medical histories
- ✅ Set up DICOM imaging studies with real medical images
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
MedGenEMR/
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

### Docker Development (Recommended)
```bash
# Start development environment
make up

# View logs in real-time
make logs

# Access backend shell for debugging
make shell

# Run backend tests
docker-compose exec backend pytest tests/ -v

# Generate additional test data
docker-compose exec backend python scripts/synthea_master.py generate --count 10
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

### Common Development Commands
```bash
make build          # Rebuild all containers
make clean          # Clean up containers and volumes
make fresh          # Complete fresh start with new data
make health         # Check all services
make db-backup      # Backup database
make stats          # View container resource usage
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
./deployment/aws/deploy-ec2-production.sh
```

### Azure Container Instances
```bash  
./deployment/azure/deploy-azure-production.sh
```

### Custom Docker Deployment
```bash
# Production-ready stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# With automatic scaling
make prod-up
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
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment procedures
- **[Tech Stack Modernization](docs/TECH_STACK_MODERNIZATION.md)** - Architecture decisions
- **[CQL Analysis](docs/CQL_ANALYSIS.md)** - Clinical Quality Language support

## 🛠️ Troubleshooting

### Docker Issues
```bash
# Docker not running
# → Start Docker Desktop and wait for full startup

# Port conflicts
docker-compose down && docker-compose up -d

# Database connection issues  
make clean && make fresh

# Clear everything and restart
docker system prune -a && make fresh
```

### Common Issues
1. **"Cannot connect to Docker daemon"**
   - Ensure Docker Desktop is running and fully started
   - Check Docker icon in system tray shows "Running"

2. **Port 3000 or 8000 already in use**
   - Modify ports in `docker-compose.yml` if needed
   - Or stop conflicting services: `lsof -ti:3000 | xargs kill`

3. **Database initialization fails**
   - Run: `make clean && make fresh`
   - Check logs: `make logs`

4. **Missing clinical data**
   - Regenerate patients: `make init-data PATIENT_COUNT=20`
   - Verify data: `curl http://localhost:8000/fhir/R4/Patient`

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

**Ready to explore modern healthcare technology?** Start with `make fresh PATIENT_COUNT=20` and access the EMR at http://localhost:3000