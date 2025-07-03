# MedGenEMR FHIR-Native Implementation

This branch contains the complete FHIR-native redesign of MedGenEMR, implementing a truly interoperable Electronic Medical Record system.

## 🏗️ Architecture Overview

The system is built with two main components:

1. **FHIR Layer**: Fully compliant FHIR R4 server for all clinical data
2. **EMR Extensions**: Optional features for workflows, UI state, and operational functionality

### Key Features

- ✅ **100% FHIR R4 Compliant**: Works as a standard FHIR server
- ✅ **PostgreSQL JSONB Storage**: Flexible, performant FHIR resource storage
- ✅ **Frontend Agnostic**: Can work with ANY FHIR R4 server
- ✅ **AI-Powered UI**: Clinical Canvas for dynamic interface generation
- ✅ **Comprehensive Search**: Full FHIR search with chaining, modifiers, and includes
- ✅ **EMR Features**: Authentication, workflows, audit trails (all optional)

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 16+ (for local development)
- Python 3.9+ (for local development)

### Starting the System

```bash
# Clone and checkout the FHIR branch
git clone https://github.com/ultraub/MedGenEMR.git
cd MedGenEMR
git checkout fhir-native-redesign

# Run the startup script
./scripts/startup.sh
```

This will:
1. Create necessary configuration files
2. Build all Docker containers
3. Start PostgreSQL, Backend API, and Frontend
4. Run database migrations
5. Perform health checks

### Manual Setup

```bash
# Start all services
docker-compose up -d

# Check service health
./scripts/health_check.sh

# View logs
docker-compose logs -f backend
```

## 📊 Importing Data

### Import Synthea FHIR Bundles

```bash
# Generate Synthea data (if needed)
cd synthea
./run_synthea -p 10

# Import into MedGenEMR
docker exec -it emr-backend python scripts/import_synthea.py /app/synthea/output/fhir
```

### Direct FHIR Import

You can POST any FHIR bundle directly:

```bash
curl -X POST http://localhost:8000/fhir/R4/ \
  -H "Content-Type: application/fhir+json" \
  -d @your-bundle.json
```

## 🔌 API Endpoints

### FHIR API (Works with any FHIR client)
- Base URL: `http://localhost:8000/fhir/R4`
- Capability Statement: `GET /fhir/R4/metadata`
- Resources: All standard FHIR R4 resources
- Operations: CRUD, Search, History, Operations

### EMR Extensions API (Optional)
- Base URL: `http://localhost:8000/api/emr`
- Authentication: JWT-based
- Features: Workflows, UI State, Audit Logs

### Clinical Canvas API
- Base URL: `http://localhost:8000/api/clinical-canvas`
- Natural language UI generation
- Works with any FHIR backend

## 🌐 Frontend Configuration

The frontend can work with ANY FHIR R4 server. Configure in `frontend/.env`:

```env
# Use local MedGenEMR
REACT_APP_FHIR_ENDPOINT=http://localhost:8000/fhir/R4

# Or use public FHIR servers
REACT_APP_FHIR_ENDPOINT=https://hapi.fhir.org/baseR4
# REACT_APP_FHIR_ENDPOINT=https://launch.smarthealthit.org/v/r4/fhir
```

## 🧪 Testing the Implementation

### Test FHIR Compliance

```bash
# Create a patient
curl -X POST http://localhost:8000/fhir/R4/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
    "resourceType": "Patient",
    "name": [{"given": ["Test"], "family": "Patient"}],
    "gender": "male",
    "birthDate": "1990-01-01"
  }'

# Search patients
curl "http://localhost:8000/fhir/R4/Patient?name=Test"

# Get patient everything
curl "http://localhost:8000/fhir/R4/Patient/[id]/$everything"
```

### Test Clinical Canvas

```bash
# Generate UI with natural language
curl -X POST http://localhost:8000/api/clinical-canvas/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Show patient vitals with trending for the last week",
    "context": {"patientId": "123"}
  }'
```

## 📁 Project Structure

```
MedGenEMR/
├── backend/
│   ├── core/
│   │   └── fhir/          # FHIR storage engine
│   ├── fhir_api/          # FHIR R4 REST API
│   ├── emr_api/           # EMR extensions
│   ├── clinical_canvas/   # AI-powered UI generation
│   └── importers/         # Synthea FHIR importer
├── frontend/
│   ├── src/
│   │   ├── services/      # FHIR & EMR clients
│   │   ├── hooks/         # React hooks for FHIR
│   │   └── components/    # FHIR-agnostic components
└── scripts/               # Utility scripts
```

## 🔧 Development

### Backend Development

```bash
# Install dependencies
cd backend
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn main:app --reload
```

### Frontend Development

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm start
```

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker logs emr-postgres

# Connect to database
docker exec -it emr-postgres psql -U postgres -d medgenemr
```

### FHIR API Issues

```bash
# Check backend logs
docker logs emr-backend

# Test FHIR endpoint
curl http://localhost:8000/fhir/R4/metadata
```

### Clear Everything and Restart

```bash
# Stop all containers and remove volumes
docker-compose down -v

# Rebuild and start fresh
docker-compose build --no-cache
docker-compose up -d
```

## 📚 Documentation

- [Architecture Overview](ARCHITECTURE.md)
- [FHIR API Documentation](http://localhost:8000/docs)
- [Clinical Canvas Guide](backend/clinical_canvas/README.md)
- [Frontend Integration](frontend/README.md)

## 🤝 Contributing

This is a demonstration of FHIR-native architecture. Key principles:

1. All clinical data must use FHIR resources
2. Frontend must work with any FHIR server
3. EMR extensions are optional
4. Follow FHIR R4 specification strictly

## 📄 License

See main repository for license information.