# MedGenEMR - Modern FHIR-Native Electronic Medical Records System

A comprehensive, educational EMR system built with React and FastAPI, featuring full FHIR R4 compliance, CDS Hooks integration, and modern clinical workflows.

## 🚀 Quick Start

**Prerequisites:**
- Python 3.9+
- Node.js 16+
- PostgreSQL 12+

**Start the entire system:**
```bash
./start.sh
```

That's it! The system will:
- Start the backend API server on http://localhost:8000
- Start the frontend React app on http://localhost:3000
- Set up all dependencies automatically

### Access Points
- **EMR Frontend**: http://localhost:3000
- **FHIR API**: http://localhost:8000/fhir/R4
- **API Documentation**: http://localhost:8000/docs

### Login
- Select any provider from the dropdown
- No password required for demo mode

## 🌟 Features

### Core FHIR Capabilities
- **Full FHIR R4 API**: Complete implementation of FHIR REST API
  - CRUD operations for all major resource types
  - Advanced search with chaining, modifiers, and includes
  - Transaction/batch bundle support
  - History and versioning
- **FHIR-Native Storage**: PostgreSQL with JSONB for flexible resource storage
- **Frontend Agnostic**: React frontend works with any FHIR R4 server

### Clinical Features
- **Patient Dashboard V2**: Comprehensive FHIR-native patient summary with:
  - Demographics & insurance coverage (FHIR Patient/Coverage)
  - Recent encounters with status tracking
  - Active conditions (problem list) with SNOMED/ICD-10 codes
  - Current medications with detailed information
  - Allergies & intolerances with severity alerts
  - Recent vital signs with trending
  - Care team and care plan management
  - Integrated timeline view of all resources
- **Clinical Workspace**: Advanced clinical tabs including:
  - **Chart Review**: Problem list, medications, allergies, immunizations
  - **Orders & Results**: Lab results with trending, diagnostic reports, imaging studies
  - **Care Management**: Care plans, care teams, goals tracking
  - **Financial**: Claims history, coverage details, billing summaries
- **Medication Reconciliation**: Complete workflow for admission/discharge
- **Vital Signs Flowsheet**: Tabular and chart views with LOINC mapping
- **Timeline Visualization**: Chronological view of all FHIR resources
- **Training Center**: Educational platform for physician/informaticist training
- **DICOM Viewer**: Full-featured medical imaging viewer
- **CDS Hooks**: Clinical decision support with 12+ built-in hooks:
  - Diabetes A1C monitoring and management alerts
  - Hypertension staging and treatment recommendations  
  - Kidney function alerts (eGFR monitoring)
  - Pain management follow-up reminders
  - Elderly care comprehensive assessments
  - Opioid risk assessment and safety alerts
  - Missing lab test reminders for chronic conditions
- **State Management**: Centralized FHIR resource context with caching
- **Custom Hooks**: Simplified React hooks for FHIR resource access

## 📁 Architecture

MedGenEMR uses a **FHIR-native architecture** with PostgreSQL JSONB storage:

```
MedGenEMR/
├── backend/                    # FastAPI backend application
│   ├── api/
│   │   └── fhir/              # FHIR R4 API implementation
│   ├── fhir_api/              # FHIR router and operations
│   ├── emr_api/               # EMR-specific extensions
│   ├── core/                  # Core business logic
│   ├── services/              # Service layer
│   └── scripts/               # Utility scripts
├── frontend/                   # React frontend (FHIR client)
│   ├── src/
│   │   ├── services/
│   │   │   └── fhirClient.js  # FHIR API client
│   │   ├── contexts/          # React contexts
│   │   └── components/        # UI components
└── docker-compose.yml         # Container orchestration
```

### Key Architectural Decisions:
- **FHIR-First**: All clinical data stored as FHIR resources
- **PostgreSQL JSONB**: Flexible storage for FHIR resources
- **API Separation**: `/fhir/R4/*` for FHIR, `/api/emr/*` for EMR extensions
- **Frontend Agnostic**: React app can work with any FHIR server
- **Component Architecture**: Modular clinical components with FHIR hooks
- **State Management**: Centralized FHIR resource context with relationship mapping

## 🔧 Development

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Frontend Development
```bash
cd frontend
npm install
npm start
```

### Running Tests
```bash
# Backend tests
docker exec emr-backend pytest tests/test_fhir_endpoints.py -v

# Frontend tests
cd frontend && npm test
```

## 📦 Production Deployment

### AWS EC2
```bash
./deployment/aws/deploy-ec2-production.sh
```

### Azure
```bash
./deployment/azure/deploy-azure-production.sh
```

### Docker Standalone
```bash
docker build -t medgenemr .
docker run -d -p 80:80 -p 8000:8000 medgenemr
```

## 📚 Documentation

- [Architecture Guide](docs/consolidated/ARCHITECTURE.md) - System design and technical details
- [FHIR Implementation](docs/FHIR_README.md) - FHIR API documentation
- [Frontend Redesign Plan](docs/FRONTEND_REDESIGN_PLAN.md) - Comprehensive redesign strategy
- [Frontend Redesign Tracker](docs/FRONTEND_REDESIGN_TRACKER.md) - Implementation progress
- [Project Integrity Guide](PROJECT_INTEGRITY_GUIDE.md) - Error patterns and best practices
- [Document Index](DOCUMENT_INDEX.md) - Complete documentation registry
- [Migration Plan](docs/MIGRATION_PLAN.md) - Legacy to FHIR migration status
- [Testing Guide](docs/TESTING.md) - Comprehensive testing procedures
- [API Endpoints](docs/API_ENDPOINTS.md) - Complete API reference
- [Additional Docs](docs/) - DICOM, CDS Hooks, and more

## 🧪 Test Data & Synthea Integration

### Available FHIR Resources
The system contains **3,461 FHIR resources** across multiple resource types:
- **Patients**: 11 comprehensive test patients with full clinical histories
- **Encounters**: 209 clinical encounters across all care settings
- **Observations**: 1,090 lab results and vital signs with LOINC codes
- **Conditions**: 161 diagnosed conditions with SNOMED/ICD-10 coding
- **Medications**: 70 medication requests with detailed prescribing information
- **Procedures**: 421 medical procedures with CPT coding
- **Claims**: 279 insurance claims with coverage details
- **Plus**: Allergies, immunizations, care plans, care teams, imaging studies, and more

### Synthea Synthetic Data Generation
Generate unlimited realistic patient data using our consolidated Synthea workflow:

```bash
# Generate 10 patients with full clinical data
cd backend
python scripts/synthea_workflow.py full --count 10

# Generate patients for specific location
python scripts/synthea_workflow.py generate --count 5 --state California --city "Los Angeles"

# Import existing FHIR files
python scripts/synthea_workflow.py import --files patient*.json

# Validate imported data integrity
python scripts/synthea_workflow.py validate
```

The Synthea integration provides:
- **Realistic Demographics**: Age-appropriate conditions and medications
- **Complete Medical Histories**: Multi-year patient timelines
- **Provider Networks**: Realistic healthcare provider assignments  
- **Insurance Coverage**: Payer and coverage information
- **Clinical Encounters**: Hospital, outpatient, and emergency visits
- **FHIR Compliance**: All data as valid FHIR R4 resources

## 🛠️ Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Change ports in docker-compose.yml if needed
   ports:
     - "3001:80"  # Frontend
     - "8001:8000"  # Backend
   ```

2. **Database Connection**
   ```bash
   # Check database is running
   docker exec emr-postgres psql -U postgres -d medgenemr -c "SELECT 1"
   ```

3. **Clear Browser Cache**
   - Open Developer Tools (F12)
   - Application tab → Clear Storage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- FHIR® is a registered trademark of HL7
- Built with FastAPI, React, and PostgreSQL
- Synthetic patient data generated with Synthea™