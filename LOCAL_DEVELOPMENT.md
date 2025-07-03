# Local Development Setup

This guide will help you set up MedGenEMR for local development with full control over both frontend and backend.

## Quick Start

For a quick setup, run the simplified setup script:

```bash
# From the project root directory
./setup_local_dev_simple.sh
```

Then start the services:

```bash
# Start backend and frontend together
./start_dev_simple.sh

# Or start them separately:
./start_backend_simple.sh    # Terminal 1
./start_frontend_simple.sh   # Terminal 2
```

## Manual Setup

### Prerequisites

- Python 3.11+ (tested with 3.13)
- Node.js 16+
- PostgreSQL (via Docker)
- Git

### Step 1: Database Setup

Start PostgreSQL in Docker:

```bash
docker run -d \
  --name emr-postgres-local \
  -e POSTGRES_DB=emr_db \
  -e POSTGRES_USER=emr_user \
  -e POSTGRES_PASSWORD=emr_password \
  -p 5432:5432 \
  postgres:15-alpine
```

### Step 2: Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements_local_dev.txt

# Set environment variables
export DATABASE_URL="postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db"
export ENVIRONMENT="development"

# Run database migrations
alembic upgrade head

# Start backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
REACT_APP_API_URL=http://localhost:8000
REACT_APP_FHIR_URL=http://localhost:8000/fhir
EOF

# Start frontend server
npm start
```

## Development URLs

Once both servers are running:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **FHIR API**: http://localhost:8000/fhir/R4
- **Database**: postgresql://emr_user:emr_password@localhost:5432/emr_db

## Current Status ✅

The local development environment is **WORKING** with:

✅ **Backend Server**: Running on port 8000 with FHIR R4 support  
✅ **Frontend Server**: Can be started on port 3000  
✅ **PostgreSQL Database**: Running in Docker with migrations applied  
✅ **Synthea Data Generation**: 5 test patients generated successfully  
✅ **Navigation Fixed**: All frontend routes work (no more broken links)  

### Generated Test Data

5 Synthea patients have been generated with complete medical records:
- **Alexander630 Davis923** (10 y/o M) - 418 FHIR resources
- **Bobby524 Kohler843** (38 y/o M) - 449 FHIR resources  
- **Ivory697 Balistreri607** (51 y/o M) - 590 FHIR resources
- **Nicholas495 Wiegand701** (26 y/o M) - 374 FHIR resources
- **Reinaldo138 Gulgowski816** (71 y/o M) - 1,074 FHIR resources

**Total**: ~2,900 FHIR resources including encounters, observations, procedures, medications, immunizations, and conditions.

## Working with Test Data

### Synthea Patient Data (5 patients)

The system is configured to work with 5 Synthea-generated test patients:

```bash
cd backend/scripts

# Generate Synthea data (if not already done)
./setup_synthea.sh

# Import Synthea data
python import_synthea.py
```

### Available Test Patients

The system includes realistic test patients with:
- Complete medical histories
- Encounters and procedures
- Laboratory results
- Medication records
- FHIR-compliant data structure

## Development Workflow

### Making Changes

1. **Backend changes**: Edit files in `backend/` - the server will auto-reload
2. **Frontend changes**: Edit files in `frontend/src/` - the browser will auto-refresh
3. **Database changes**: Create new Alembic migrations:
   ```bash
   cd backend
   alembic revision --autogenerate -m "Description of change"
   alembic upgrade head
   ```

### Testing Navigation

All frontend navigation has been fixed and tested:

- **Dashboard** → All buttons and links work correctly  
- **Patients** → Full patient list and individual patient views
- **Clinical Workspace** → All 7 tabs functional (Overview, Documentation, Orders, Results, Trends, Inbox, Tasks)
- **Lab Results** → Fully functional with search and filtering
- **Missing routes** → Show friendly "under construction" pages

### API Testing

- Backend API docs: http://localhost:8000/docs
- FHIR endpoints: http://localhost:8000/fhir/
- Health check: http://localhost:8000/health

## Troubleshooting

### Backend Issues

```bash
# Check if backend is running
curl http://localhost:8000/health

# Check database connection
psql postgresql://emr_user:emr_password@localhost:5432/emr_db -c "SELECT 1;"

# View backend logs
# Check the terminal where uvicorn is running
```

### Frontend Issues

```bash
# Check if frontend is building correctly
cd frontend
npm run build

# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Database Issues

```bash
# Restart PostgreSQL container
docker restart emr-postgres-local

# Check database status
docker exec emr-postgres-local pg_isready -U emr_user -d emr_db

# Reset database (WARNING: destroys all data)
docker rm -f emr-postgres-local
# Then restart the container as shown in Step 1
```

## Key Dependencies

### Backend (Python)
- **FastAPI**: Web framework
- **SQLAlchemy**: Database ORM  
- **Alembic**: Database migrations
- **fhir.resources**: FHIR resource handling
- **asyncpg**: Async PostgreSQL driver

### Frontend (Node.js)
- **React**: UI framework
- **Material-UI**: Component library
- **React Router**: Navigation
- **Recharts**: Data visualization

## Environment Variables

### Backend
```bash
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@localhost:5432/emr_db
ENVIRONMENT=development
```

### Frontend
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_FHIR_URL=http://localhost:8000/fhir
```

## Production vs Development

This setup is optimized for local development with:

- **Hot reloading** for both backend and frontend
- **Debug mode** enabled
- **Local database** in Docker
- **Detailed error messages**
- **No authentication** required for development

For production deployment, use the Docker Compose setup instead.