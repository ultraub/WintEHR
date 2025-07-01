# Teaching EMR System - Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Teaching EMR System with 100+ patients and full Synthea data integration across multiple platforms.

## System Requirements

### Minimum Requirements
- **CPU**: 2 vCPUs
- **RAM**: 4 GB
- **Storage**: 30 GB
- **OS**: Linux (Ubuntu 20.04+ or Amazon Linux 2)

### Recommended Production Requirements
- **CPU**: 4 vCPUs
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **OS**: Ubuntu 20.04 LTS or Amazon Linux 2

### Software Dependencies
- Docker 20.10+
- Docker Compose 2.0+
- Python 3.9+ (Python 3.7 will NOT work)
- Java 11+ (for Synthea patient generation)
- Git

## Deployment Profiles

The system supports three deployment profiles:

- **local_dev**: 10 patients, minimal resources, development testing
- **production**: 100 patients, full features, recommended for demos
- **cloud**: 200 patients, PostgreSQL, enhanced performance

## Quick Start

### Option 1: Automated Production Deployment

#### AWS CloudFormation (Recommended)
```bash
aws cloudformation create-stack \
  --stack-name emr-production \
  --template-body file://cloudformation-emr-production.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=your-key-pair \
    ParameterKey=DeploymentProfile,ParameterValue=production \
  --capabilities CAPABILITY_IAM
```

#### AWS EC2 Script
```bash
./deploy-ec2-production.sh
```

#### Azure ARM Template
```bash
az deployment group create \
  --resource-group emr-production \
  --template-file azure-deploy-production.json \
  --parameters deploymentProfile=production
```

### Option 2: Docker Deployment with 100+ Patients

1. **Clone repository**:
   ```bash
   git clone <repository-url> EMR
   cd EMR
   ```

2. **Deploy with production profile**:
   ```bash
   # Using docker-compose
   docker-compose -f docker-compose.deployment.yml up -d
   docker-compose -f docker-compose.deployment.yml --profile setup up data-init
   
   # Or using standalone Dockerfile
   docker build -f Dockerfile.standalone.fixed -t emr-system .
   docker run -d -p 80:80 --name emr-production emr-system
   ```

3. **Access the system**:
   - Frontend: http://localhost
   - API: http://localhost:8000/docs

### Option 3: Manual Setup

1. **Backend setup**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Frontend setup**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

3. **Initialize database**:
   ```bash
   cd backend
   python scripts/create_sample_providers.py
   python scripts/optimized_comprehensive_setup.py --patients 25
   ```

4. **Start services**:
   ```bash
   # Backend
   python main.py
   
   # Frontend (in another terminal)
   cd frontend && npm start
   ```

## Data Population

### Generate Synthetic Patients

The system uses Synthea to generate realistic patient data:

```bash
# In backend directory
python scripts/optimized_comprehensive_setup.py --patients 50
```

This will:
1. Download Synthea if not present
2. Generate synthetic patients with full medical histories
3. Import all FHIR data into the database
4. Assign patients to providers
5. Create reference ranges for lab results

### Expected Data

After successful setup, you should have:
- 20+ healthcare providers
- 25-50 patients with complete medical records
- Thousands of clinical encounters
- Medications, conditions, observations, and procedures

## Troubleshooting

### Common Issues

#### 1. Frontend shows "Failed to load provider list"
**Cause**: No providers in database
**Solution**:
```bash
docker exec emr-backend python scripts/create_sample_providers.py
```

#### 2. No patients visible after login
**Cause**: No patient data generated
**Solution**:
```bash
docker exec emr-backend python scripts/optimized_comprehensive_setup.py --patients 25
```

#### 3. 500 Internal Server Error
**Cause**: Backend not running or database issue
**Solution**:
```bash
# Check logs
docker logs emr-backend

# Restart backend
docker restart emr-backend
```

#### 4. API endpoint not found (404)
**Cause**: Frontend built with wrong API URL
**Solution**: Rebuild frontend with correct API URL:
```bash
cd frontend
REACT_APP_API_URL="" npm run build
```

### Verification Steps

1. **Check backend health**:
   ```bash
   curl http://localhost/api/health
   ```

2. **Check providers**:
   ```bash
   curl http://localhost/api/auth/providers | python3 -m json.tool
   ```

3. **Check data counts**:
   ```bash
   docker exec emr-backend python -c "
   from database.database import SessionLocal
   from models.synthea_models import Patient, Encounter
   db = SessionLocal()
   print(f'Patients: {db.query(Patient).count()}')
   print(f'Encounters: {db.query(Encounter).count()}')
   "
   ```

## Architecture Notes

### Frontend
- React 18 with Material-UI
- API calls use axios with base URL configuration
- Built files served by nginx in production

### Backend
- FastAPI with Pydantic v2
- SQLAlchemy ORM with SQLite database
- FHIR R4 compliant data models

### Deployment
- Single container with supervisor managing both services
- Nginx reverse proxy for API routing
- Data persisted in Docker volume

## Security Considerations

1. **Production deployment**:
   - Use HTTPS (configure SSL/TLS)
   - Restrict security groups to known IPs
   - Enable authentication for all endpoints
   - Use environment variables for sensitive config

2. **Data privacy**:
   - All patient data is synthetic (not real)
   - Still follow security best practices
   - Regular backups recommended

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs: `docker logs emr-system`
3. Create an issue in the repository