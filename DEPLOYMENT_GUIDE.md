# EMR System Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the EMR Training System on AWS EC2 or locally.

## Prerequisites

### Local Development
- Python 3.8+ (Python 3.7 will NOT work with FastAPI/Pydantic v2)
- Node.js 16+ and npm
- Java 8+ (for Synthea patient generation)
- Git

### AWS EC2 Deployment
- EC2 instance (t3.medium or larger recommended)
- Amazon Linux 2, Ubuntu, or similar
- Security group allowing ports: 22 (SSH), 80 (HTTP), 8000 (API)

## Quick Start

### Option 1: Automated AWS Deployment

1. **Launch EC2 instance** with Amazon Linux 2
2. **SSH into the instance**:
   ```bash
   ssh -i your-key.pem ec2-user@your-instance-ip
   ```
3. **Run deployment script**:
   ```bash
   curl -O https://raw.githubusercontent.com/your-repo/EMR/master/deploy-aws-v2.sh
   chmod +x deploy-aws-v2.sh
   ./deploy-aws-v2.sh
   ```

### Option 2: Docker Deployment

1. **Clone repository**:
   ```bash
   git clone https://github.com/your-repo/EMR.git
   cd EMR
   ```
2. **Build and run**:
   ```bash
   docker build -t emr-system .
   docker run -d -p 80:80 --name emr-system emr-system
   ```

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