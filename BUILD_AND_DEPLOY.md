# MedGenEMR Build and Deployment Guide

## Quick Start

For most users, simply run:
```bash
./fresh-deploy.sh
```

This script handles the complete setup including Docker containers, database initialization, and sample data loading.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ and npm (for frontend development)
- Python 3.9+ (for backend development)
- PostgreSQL client tools (optional, for database access)
- At least 4GB RAM available
- 10GB free disk space

## Build Scripts

### 1. Complete Fresh Deployment
```bash
./fresh-deploy.sh
```
This script:
- Stops and removes existing containers
- Rebuilds all Docker images
- Initializes the database with FHIR schema
- Loads sample Synthea data (10 patients)
- Validates the deployment
- Starts all services

### 2. Standard Startup
```bash
./start.sh
```
Use this for regular startup when you already have data.

### 3. Development Build

#### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend Development
```bash
cd frontend
npm install
npm start
```

### 4. Docker Build Commands

Build all services:
```bash
docker-compose build
```

Build specific service:
```bash
docker-compose build backend
docker-compose build frontend
```

Build with no cache:
```bash
docker-compose build --no-cache
```

## Configuration

### Environment Variables

Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=emr_password
POSTGRES_DB=emr_db

# Authentication
JWT_SECRET_KEY=your-secret-key-here
JWT_ENABLED=false  # Set to true for production

# API Keys (optional)
OPENAI_API_KEY=your-openai-key
GOOGLE_API_KEY=your-google-key

# Frontend
REACT_APP_API_URL=http://localhost:8000
```

### Authentication Modes

1. **Training Mode** (default):
   ```bash
   JWT_ENABLED=false
   ```
   Users: demo/admin/nurse/pharmacist (password: "password")

2. **Production Mode**:
   ```bash
   JWT_ENABLED=true
   ```
   Requires user registration and JWT tokens

## Data Management

### Load Sample Data
```bash
cd backend
python scripts/synthea_master.py full --count 10
```

### Generate More Patients
```bash
cd backend
python scripts/synthea_master.py generate --count 50
python scripts/synthea_master.py import
```

### Validate Data
```bash
python scripts/validate_deployment.py --verbose
```

## Deployment Options

### Local Development
```bash
docker-compose up -d
```

### Production Deployment

#### Using Docker Compose
```bash
# Production configuration
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### AWS Deployment
```bash
./deploy.sh
```
This script handles:
- EC2 instance setup
- RDS PostgreSQL configuration
- Application Load Balancer
- Auto-scaling groups
- CloudWatch monitoring

#### Manual Production Setup

1. **Database Setup**:
   ```sql
   CREATE DATABASE emr_db;
   CREATE USER emr_user WITH PASSWORD 'secure-password';
   GRANT ALL PRIVILEGES ON DATABASE emr_db TO emr_user;
   ```

2. **Initialize Schema**:
   ```bash
   cd backend
   python scripts/init_database_definitive.py
   ```

3. **Run Migrations**:
   ```bash
   cd backend
   alembic upgrade head
   ```

4. **Start Services**:
   ```bash
   # Backend
   gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000

   # Frontend (production build)
   cd frontend
   npm run build
   # Serve with nginx or similar
   ```

## Monitoring and Maintenance

### Check Service Health
```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/fhir/R4/metadata
```

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Database Backup
```bash
docker exec emr-postgres pg_dump -U emr_user emr_db > backup.sql
```

### Database Restore
```bash
docker exec -i emr-postgres psql -U emr_user emr_db < backup.sql
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**:
   ```bash
   # Find process using port
   lsof -i :8000
   # Kill process
   kill -9 <PID>
   ```

2. **Database Connection Failed**:
   ```bash
   # Check PostgreSQL is running
   docker-compose ps postgres
   # Check logs
   docker-compose logs postgres
   ```

3. **Frontend Can't Connect to Backend**:
   - Check CORS settings in backend
   - Verify REACT_APP_API_URL in frontend .env
   - Check network connectivity between containers

4. **Missing Dependencies**:
   ```bash
   # Backend
   cd backend && pip install -r requirements.txt
   # Frontend
   cd frontend && npm install
   ```

5. **FHIR Validation Errors**:
   - Ensure you're using Synthea-generated data
   - Check FHIR R4 compliance
   - Run validation script: `python scripts/validate_deployment.py`

## Performance Tuning

### PostgreSQL Optimization
Edit `postgresql.conf`:
```conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
work_mem = 4MB
max_connections = 200
```

### Backend Optimization
```python
# In main.py or .env
WORKERS=4  # Number of worker processes
CONNECTION_POOL_SIZE=20
```

### Frontend Optimization
```bash
# Production build with optimizations
npm run build
```

## Security Considerations

1. **Change Default Passwords**:
   - Database password
   - JWT secret key
   - Default user passwords

2. **Enable HTTPS**:
   - Use reverse proxy (nginx)
   - Configure SSL certificates
   - Update CORS settings

3. **Firewall Rules**:
   - Only expose necessary ports
   - Restrict database access
   - Use security groups in cloud

4. **Regular Updates**:
   ```bash
   # Update dependencies
   cd backend && pip install --upgrade -r requirements.txt
   cd frontend && npm update
   ```

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Build and Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Docker images
        run: docker-compose build
      - name: Run tests
        run: |
          docker-compose up -d
          docker exec emr-backend pytest tests/
      - name: Validate deployment
        run: docker exec emr-backend python scripts/validate_deployment.py
```

## Support

For issues and questions:
- Check logs: `docker-compose logs`
- Review documentation in `/docs`
- Check CLAUDE.md for development guidelines
- Submit issues to the project repository