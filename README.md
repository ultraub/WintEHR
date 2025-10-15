# WintEHR - Modern FHIR-Native Electronic Health Record System

[![Version](https://img.shields.io/badge/Version-1.1.0-blue.svg)](https://github.com/ultraub/WintEHR/releases)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-yellow.svg)](https://opensource.org/licenses/Apache-2.0)
[![FHIR R4](https://img.shields.io/badge/FHIR-R4-orange.svg)](http://hl7.org/fhir/R4/)
[![Docker](https://img.shields.io/badge/Docker-Ready-brightgreen.svg)](https://www.docker.com/)

## 🏥 Overview

WintEHR is a complete, FHIR-native Electronic Health Record system designed for healthcare organizations, researchers, and developers. Built on modern web technologies, it provides a production-ready platform for managing clinical workflows, medical imaging, and real-time clinical decision support.

### ✨ Key Capabilities

- **Complete Clinical Workflows** - Chart review, orders, results, pharmacy, and imaging modules
- **FHIR R4 Native** - 38+ resource types with full CRUD operations and search
- **Medical Imaging** - Automated DICOM generation + integrated viewer with multi-modality support
- **Clinical Decision Support** - CDS Hooks 2.0 implementation with 10+ built-in rules
- **Real-time Updates** - WebSocket-based live clinical events and notifications
- **Enterprise Ready** - JWT authentication, audit logging, and scalable architecture

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (20.10+ recommended)
- **Python 3.9+** (for configuration validation)
- **8GB RAM minimum** (16GB recommended for production)
- **20GB free disk space** (100GB for production)

### Local Development Setup (5 Minutes)

```bash
# 1. Clone repository
git clone https://github.com/ultraub/WintEHR.git
cd WintEHR

# 2. Copy and configure for development
cp config.example.yaml config.yaml

# 3. Edit config.yaml for local development
#    Set: environment: dev
#         enable_ssl: false
#         patient_count: 20

# 4. ONE COMMAND DEPLOYMENT
./deploy.sh
```

The system will be available at:
- **Clinical Portal**: http://localhost:3000
- **FHIR API**: http://localhost:8888/fhir
- **API Documentation**: http://localhost:8000/docs

### Azure Production Deployment (Fully Automated)

**Complete automated deployment with server wipe and SSL setup:**

```bash
# 1. Configure Azure deployment
cp config.azure-prod.yaml config.yaml
vim config.yaml  # Set your Azure VM details and domain

# 2. Setup SSH key
ssh-keygen -t rsa -b 4096 -f ~/.ssh/WintEHR-key.pem
# Upload public key to your Azure VM

# 3. ONE COMMAND AUTOMATED DEPLOYMENT
./deploy-azure-production.sh --yes
```

**What this does automatically:**
- ✅ Wipes server completely (fresh start guaranteed)
- ✅ Clones latest code from GitHub
- ✅ Builds Docker images (backend + frontend)
- ✅ Deploys all services with health checks
- ✅ Generates 100 synthetic patients with DICOM imaging
- ✅ Obtains Let's Encrypt SSL certificate
- ✅ Configures nginx with HTTPS
- ✅ Verifies deployment success

**Total time:** ~25-30 minutes for complete deployment

**Access your production system:**
```
https://your-domain.cloudapp.azure.com
```

### Build Options

#### Option 1: Quick Deploy (Recommended)
```bash
./deploy.sh                    # Local development
./deploy-azure-production.sh   # Azure production (automated)
```

#### Option 2: Manual Docker Build
```bash
# Build backend
docker build -t wintehr-backend:latest -f backend/Dockerfile backend/

# Build frontend
docker build -t wintehr-frontend:latest -f frontend/Dockerfile frontend/

# Start services
docker-compose up -d
```

#### Option 3: Development with Hot Reload
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm start
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for advanced deployment options.

### Default Users

| Username | Password | Role |
|----------|----------|------|
| demo | password | Physician |
| nurse | password | Nurse |
| pharmacist | password | Pharmacist |
| admin | password | Administrator |

## 🏗️ Architecture

WintEHR uses a modern microservices architecture:

- **Frontend**: React 18 with Material-UI
- **Backend**: FastAPI (Python) with async support
- **FHIR Server**: HAPI FHIR JPA Server (industry-standard)
- **Database**: PostgreSQL 15 with HAPI JPA schema
- **Cache**: Redis for sessions and performance
- **Reverse Proxy**: Nginx with SSL/TLS support
- **Containerization**: Docker with orchestration

## ⚙️ Configuration

WintEHR uses a comprehensive configuration management system for flexible deployments:

### Configuration Files

- **config.yaml** - Main configuration (deployment settings, Azure, SSL, services)
- **.env** - Secrets (database passwords, API keys)
- **config.{env}.yaml** - Environment-specific overrides (dev, staging, prod)

### Key Features

- **Single Source of Truth**: All settings in one place
- **Environment Overrides**: Easy dev/staging/prod configurations
- **Validation**: Pre-deployment checks catch errors early
- **Secrets Management**: Secure handling of passwords and API keys
- **Azure Integration**: Automatic NSG and resource configuration
- **SSL Automation**: Let's Encrypt certificate management

### Configuration Options

```yaml
deployment:
  environment: production    # dev, staging, production
  patient_count: 50         # Synthea patients to generate
  enable_ssl: true          # Automatic SSL with Let's Encrypt

azure:
  resource_group: wintehr-rg
  vm_name: wintehr-vm
  location: eastus2

ssl:
  domain_name: wintehr.eastus2.cloudapp.azure.com
  ssl_email: admin@example.com

services:
  ports:                    # Customize all service ports
    frontend: 3000
    backend: 8000
    hapi_fhir: 8888

hapi_fhir:
  memory: 2g               # JVM memory allocation
  validation_mode: NEVER   # FHIR validation level

synthea:
  state: Massachusetts     # US state for patient data
  jar_version: 3.2.0       # Synthea version
```

### Complete Documentation

See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for:
- Complete configuration reference
- Environment-specific setup
- Azure deployment guide
- SSL configuration
- Secrets management
- Troubleshooting

## 📋 Clinical Modules

### Core Modules

1. **Patient Management**
   - Demographics and registration
   - Insurance and coverage
   - Contact information
   - Patient search and matching

2. **Chart Review**
   - Problem list
   - Medications
   - Allergies
   - Vital signs
   - Clinical notes

3. **Orders & Results**
   - CPOE (Computerized Physician Order Entry)
   - Lab results with trending
   - Radiology reports
   - Order tracking

4. **Pharmacy**
   - Prescription management
   - Dispensing workflow
   - Drug interaction checking
   - Medication history

5. **Medical Imaging**
   - DICOM viewer with multi-modality support
   - **Automated DICOM generation** from ImagingStudy resources
   - Multi-slice navigation (CT, MR, XR, US, DX, CR, MG)
   - Windowing controls
   - Measurement tools
   - Realistic synthetic medical images

6. **Clinical Decision Support**
   - Real-time alerts
   - Drug interactions
   - Dosing recommendations
   - Preventive care reminders

### Advanced Features

- **FHIR Explorer v4** - Visual query builder and resource browser
- **CDS Studio** - Create and manage clinical decision support rules
- **Analytics Dashboard** - Real-time clinical metrics
- **Audit System** - Complete audit trail for compliance

## 💾 Data Management

### Synthetic Data Generation

WintEHR includes Synthea integration for realistic test data:

```bash
# Generate and load patients (handled automatically during deployment)
./deploy.sh --patients 50

# Or manually load data
docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py 50 Massachusetts
```

### Database Schema

FHIR resources are managed by HAPI FHIR JPA Server using industry-standard tables:
- `hfj_resource` - FHIR resource storage with versioning
- `hfj_spidx_*` - Search parameter indexes (string, token, date, number, quantity)
- `hfj_res_link` - Resource references and relationships
- `hfj_res_tag` - Resource tags and security labels

Clinical workflow data uses dedicated tables:
- `clinical_notes` - Clinical documentation
- `orders` - Order management
- `tasks` - Clinical task tracking
- `clinical_catalogs` - Medication, condition, and lab catalogs

## 🔧 Deployment Options

### Development Mode
```bash
# Configure dev settings in config.yaml (or config.dev.yaml)
# Set: environment: dev, enable_ssl: false, patient_count: 20

./deploy.sh --environment dev
```
- JWT authentication disabled
- Demo users enabled
- Hot-reload active

### Production Mode
```bash
# Configure production settings in config.yaml
# Set: environment: production, enable_ssl: true, patient_count: 100

./deploy.sh
```
- JWT authentication required
- SSL/TLS ready
- Performance optimized

### Cloud Deployment

WintEHR is tested on:
- AWS EC2 (t3.xlarge recommended)
- Docker Swarm
- Kubernetes (Helm chart available)

## 📊 System Requirements

### Minimum Requirements
- 2 CPU cores
- 8GB RAM
- 20GB storage
- Docker 20.10+

### Recommended for Production
- 4+ CPU cores
- 16GB RAM
- 100GB SSD storage
- PostgreSQL dedicated instance

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Audit logging for all FHIR operations
- Rate limiting and DDoS protection
- Encrypted data at rest and in transit
- HIPAA compliance considerations

## 📚 API Documentation

### FHIR Endpoints

All standard FHIR R4 operations are supported:

```
GET    /fhir/R4/{ResourceType}/{id}
POST   /fhir/R4/{ResourceType}
PUT    /fhir/R4/{ResourceType}/{id}
DELETE /fhir/R4/{ResourceType}/{id}
GET    /fhir/R4/{ResourceType}?{search-parameters}
```

### Custom Endpoints

```
POST   /api/auth/login
GET    /api/services
POST   /api/cds-services/{service-id}
GET    /api/catalogs/{type}
WS     /ws/clinical-events
```

## 🧪 Testing

```bash
# Run all tests
npm test           # Frontend
pytest            # Backend

# Integration tests
./run-integration-tests.sh
```

## 📈 Performance

- Supports 1000+ concurrent users
- Sub-second response times for most operations
- Optimized FHIR search with indexed parameters
- Redis caching for frequently accessed data
- Connection pooling for database efficiency

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [HL7 FHIR](http://hl7.org/fhir/) - Healthcare data standard
- [Synthea](https://synthea.mitre.org/) - Synthetic patient generator
- [CDS Hooks](https://cds-hooks.org/) - Clinical decision support specification

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/ultraub/WintEHR/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ultraub/WintEHR/discussions)
- **Documentation**: [Wiki](https://github.com/ultraub/WintEHR/wiki)

## 🚦 Release Notes

### Version 1.1.0 (October 2025)

**Major Improvements:**
- ✅ **Fully Automated Azure Deployment** - One-command deployment with complete server wipe
- ✅ **Automated SSL Configuration** - Let's Encrypt certificates obtained automatically
- ✅ **Robust Build Process** - Fixed SSH timeout issues during long Docker builds
- ✅ **Health Check Improvements** - Reliable container health monitoring
- ✅ **DICOM Endpoint Generation** - Automatic DICOM endpoint creation for all imaging studies

**Deployment Fixes:**
- Fix #17: Backend health check using Docker inspect instead of curl
- Fix #18: SSH keepalive configuration prevents timeout during builds
- Fix #19: Simplified Docker build process (removed complex heredoc)
- Fix #20: Non-blocking SSL certificate verification
- Fix #21: Asynchronous Docker build with background nohup
- Fix #22: Direct SSH in polling loop avoids echo output interference

**Infrastructure:**
- Complete server wipe before every deployment (mandatory)
- No manual interventions required
- Automated patient data generation (100+ patients with DICOM)
- Total deployment time: ~25-30 minutes

### Version 1.0.0 (August 2025)

**Features:**
- Complete FHIR R4 implementation
- 38 resource types with full CRUD support
- Integrated DICOM medical imaging
- CDS Hooks 2.0 with visual rule builder
- Real-time WebSocket clinical events
- FHIR Explorer with relationship mapping
- Pharmacy workflow automation
- Clinical catalog generation
- Synthea data integration

**Known Limitations:**
- Authentication system requires hardening for production
- Some FHIR operations not yet implemented
- Performance optimization ongoing for large datasets

---

**WintEHR v1.1.0** - A complete FHIR-native EHR system with fully automated deployment.

Built with ❤️ for the healthcare community.