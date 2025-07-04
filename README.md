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
- **Patient Management**: Comprehensive patient demographics with insurance coverage display
- **Clinical Workspace**: Integrated view of:
  - Medications (FHIR MedicationRequest) with provider names and vital signs mapping
  - Conditions (FHIR Condition) 
  - Vitals (FHIR Observation) with standardized LOINC code mapping
  - Lab Results (FHIR Observation/DiagnosticReport)
  - Allergies (FHIR AllergyIntolerance) with severity-based alerts
  - Clinical Notes (FHIR DocumentReference)
  - Insurance Coverage (FHIR Coverage) with payer organization resolution
- **Dedicated Clinical Pages**: 
  - Patient Medications with prescription history and status tracking
  - Patient Allergies with reaction management and safety alerts
  - Patient Problems (conditions) with comprehensive clinical status
- **DICOM Viewer**: Full-featured medical imaging viewer
- **CDS Hooks**: Clinical decision support with 12+ built-in hooks:
  - Diabetes A1C monitoring and management alerts
  - Hypertension staging and treatment recommendations  
  - Kidney function alerts (eGFR monitoring)
  - Pain management follow-up reminders
  - Elderly care comprehensive assessments
  - Opioid risk assessment and safety alerts
  - Missing lab test reminders for chronic conditions
- **Provider Management**: Centralized provider resolution with FHIR Practitioner resources
- **Authentication System**: Session-based auth with provider selection and patient assignments

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

- [Architecture Guide](ARCHITECTURE.md) - System design and technical details
- [FHIR Implementation](docs/FHIR_README.md) - FHIR API documentation
- [Migration Guide](MIGRATION_GUIDE.md) - Migrating from legacy to FHIR
- [Testing Guide](docs/TESTING.md) - Comprehensive testing procedures
- [Additional Docs](docs/) - DICOM, CDS Hooks, and more

## 🧪 Test Data & Synthea Integration

### Included Test Patients
The system includes 6 comprehensive test patients with full clinical histories:
- John Q Test (Hypertension, Diabetes)
- David Williams (CAD, Hyperlipidemia)
- Linda Brown (Asthma, Anxiety)
- Michael Brown (COPD, Osteoarthritis)
- Patricia Brown (Hypothyroidism, Depression)
- Mary Brown (Atrial fibrillation, Osteoporosis)

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