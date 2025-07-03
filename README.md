# MedGenEMR - FHIR-Native Teaching EMR System

A modern, FHIR R4 compliant Electronic Medical Records (EMR) system designed for healthcare education and training. Built with a FHIR-first architecture, featuring complete FHIR API support, Clinical Decision Support (CDS) Hooks, DICOM medical imaging, and production-ready deployment.

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- 8GB RAM minimum
- 10GB free disk space

### Local Development

```bash
# Clone repository
git clone https://github.com/ultraub/MedGenEMR.git
cd MedGenEMR

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f
```

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
- **Patient Management**: Comprehensive patient demographics and clinical data
- **Clinical Workspace**: Integrated view of:
  - Medications (FHIR MedicationRequest)
  - Conditions (FHIR Condition)
  - Vitals (FHIR Observation)
  - Lab Results (FHIR Observation/DiagnosticReport)
  - Allergies (FHIR AllergyIntolerance)
  - Clinical Notes (FHIR DocumentReference)
- **DICOM Viewer**: Full-featured medical imaging viewer
- **CDS Hooks**: Clinical decision support integration
- **Provider Management**: Multiple provider support with FHIR Practitioner resources

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

## 🧪 Test Data

The system includes 6 test patients with comprehensive clinical data:
- John Q Test (Hypertension, Diabetes)
- David Williams (CAD, Hyperlipidemia)
- Linda Brown (Asthma, Anxiety)
- Michael Brown (COPD, Osteoarthritis)
- Patricia Brown (Hypothyroidism, Depression)
- Mary Brown (Atrial fibrillation, Osteoporosis)

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