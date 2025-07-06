# MedGenEMR Deployment Guide

This guide covers deployment options for MedGenEMR, supporting both Docker and local development environments.

## Prerequisites

### For Docker Deployment
- Docker Desktop installed and running
- Docker Compose v2.0+
- 8GB+ RAM allocated to Docker
- Ports 3000, 8000, and 5432 available

### For Local Deployment
- Python 3.9+
- Node.js 16+ and npm
- PostgreSQL 13+ (or Docker for just the database)
- Ports 3000, 8000, and 5432 available

## Environment Configuration

### 1. Backend Configuration

Copy the example environment file:
```bash
cd backend
cp .env.example .env
```

Update `.env` based on your deployment:

#### Docker Deployment
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@postgres:5432/medgenemr
```

#### Local with Docker PostgreSQL
```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/medgenemr
```

#### Local with Local PostgreSQL
```env
DATABASE_URL=postgresql+asyncpg://username@localhost:5432/emr_db
```

### 2. Frontend Configuration

The frontend `.env` is already configured:
```env
REACT_APP_FHIR_ENDPOINT=http://localhost:8000/fhir/R4
REACT_APP_API_URL=http://localhost:8000
```

## Deployment Options

### Option 1: Full Docker Deployment

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

3. **Initialize the database (first time only):**
   ```bash
   docker exec emr-backend python scripts/init_database.py
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Option 2: Local Development (Hybrid)

This option runs PostgreSQL in Docker but the application locally.

1. **Start PostgreSQL only:**
   ```bash
   docker-compose up -d postgres
   ```

2. **Set up backend:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   
   # Update .env for local PostgreSQL access
   # DATABASE_URL=postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/medgenemr
   ```

3. **Initialize database:**
   ```bash
   python scripts/init_database.py
   ```

4. **Start backend:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Set up frontend (new terminal):**
   ```bash
   cd frontend
   npm install
   ```

6. **Start frontend:**
   ```bash
   npm start
   ```

### Option 3: Fully Local Deployment

1. **Ensure PostgreSQL is running locally**
   
2. **Create database:**
   ```bash
   createdb emr_db
   ```

3. **Update backend/.env:**
   ```env
   DATABASE_URL=postgresql+asyncpg://yourusername@localhost:5432/emr_db
   ```

4. **Follow steps 2-6 from Option 2**

## Database Management

### Initialize Search Parameters

The system requires search parameters for proper FHIR search functionality:

```bash
# For Docker deployment
docker exec emr-backend python scripts/init_database.py

# For local deployment
cd backend
python scripts/init_database.py
```

### Import Synthea Data

Generate and import test data:

```bash
# For Docker deployment
docker exec emr-backend python scripts/synthea_master.py full --count 10

# For local deployment
cd backend
python scripts/synthea_master.py full --count 10
```

**Note**: Synthea generates FHIR resources with URN references (e.g., `urn:uuid:...`). The database initialization script automatically converts these to proper FHIR references (e.g., `Patient/123`) during startup.

## Common Issues and Solutions

### Issue: Search returns 0 results
**Solution:** Run the database initialization script to ensure search parameters are populated.

### Issue: Frontend shows no patient data (labs, vitals, conditions, medications)
**Cause:** Synthea generates URN references that need to be converted to FHIR references.
**Solution:** The database initialization script automatically fixes this. If the issue persists:
```bash
# For Docker
docker exec emr-backend python scripts/init_database.py

# For local
cd backend && python scripts/init_database.py
```

### Issue: "role postgres does not exist"
**Solution:** You have conflicting PostgreSQL installations. Either:
- Stop local PostgreSQL: `brew services stop postgresql`
- Or use 127.0.0.1 instead of localhost in DATABASE_URL

### Issue: Frontend not connecting to backend
**Solution:** 
1. Ensure backend is running on port 8000
2. Check frontend .env has correct API URLs
3. Restart frontend to pick up environment changes

### Issue: Port already in use
**Solution:**
```bash
# Find and kill process on port
lsof -ti:8000 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
lsof -ti:5432 | xargs kill -9  # PostgreSQL
```

## Health Checks

### Verify Backend
```bash
curl http://localhost:8000/health
curl http://localhost:8000/fhir/R4/metadata
```

### Verify FHIR Search
```bash
# Test vital signs search
curl "http://localhost:8000/fhir/R4/Observation?category=vital-signs&_count=5"
```

### Check Database
```bash
# For Docker PostgreSQL
docker exec emr-postgres psql -U postgres -d medgenemr -c "SELECT COUNT(*) FROM fhir.resources;"

# For local PostgreSQL
psql -d emr_db -c "SELECT COUNT(*) FROM fhir.resources;"
```

## Stopping Services

### Docker Deployment
```bash
docker-compose down
# To also remove volumes: docker-compose down -v
```

### Local Deployment
```bash
# Stop backend: Ctrl+C in backend terminal
# Stop frontend: Ctrl+C in frontend terminal
# Stop PostgreSQL (if using Docker): docker stop emr-postgres
```

## Production Considerations

1. **Environment Variables:** Never commit real secrets. Use a secrets management system.
2. **Database:** Use managed PostgreSQL service (AWS RDS, Google Cloud SQL, etc.)
3. **HTTPS:** Enable HTTPS using the nginx configuration
4. **Monitoring:** Enable metrics and tracing in .env
5. **Backup:** Regular database backups are essential
6. **Security:** Update all default passwords and secrets

## Support

For issues or questions:
1. Check the logs: `docker logs emr-backend` or backend terminal output
2. Verify database connectivity
3. Ensure all required ports are available
4. Check the [troubleshooting guide](docs/TROUBLESHOOTING.md)