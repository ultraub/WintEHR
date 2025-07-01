# Teaching EMR System - Production Deployment Guide

This guide provides comprehensive instructions for deploying the Teaching EMR System on AWS, Azure, or local infrastructure.

## Table of Contents
- [Quick Start](#quick-start)
- [System Requirements](#system-requirements)
- [Deployment Profiles](#deployment-profiles)
- [Deployment Methods](#deployment-methods)
- [Configuration](#configuration)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Automated Deployment (Recommended)

```bash
# Clone the repository
git clone https://github.com/ultraub/MedGenEMR.git
cd MedGenEMR/EMR

# Run unified deployment setup
python3 scripts/unified_deployment_setup.py --profile production

# Or for local development (10 patients)
python3 scripts/unified_deployment_setup.py --profile local_dev
```

### Docker Deployment

```bash
# Using Docker Compose
docker-compose -f docker-compose.standalone.yml up -d

# Or for AWS deployment
docker-compose -f docker-compose.aws.yml up -d
```

## System Requirements

### Minimum Requirements
- **RAM**: 4GB
- **Storage**: 30GB free space
- **CPU**: 2 vCPU cores
- **OS**: Ubuntu 20.04+ or Amazon Linux 2

### Recommended for Production
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **CPU**: 4 vCPU cores
- **Instance Types**:
  - AWS: t3.medium or larger
  - Azure: Standard_B2ms or larger

### Software Prerequisites
- Python 3.8+ (3.9+ recommended)
- Node.js 16+ (18+ recommended)
- Java 11+ (for Synthea)
- Docker & Docker Compose (for containerized deployment)
- Git

## Deployment Profiles

The system includes three pre-configured deployment profiles in `deployment.config.json`:

### 1. local_dev
- **Purpose**: Local development and testing
- **Patients**: 10
- **Providers**: 3
- **Features**: All enabled
- **Database**: SQLite

### 2. production
- **Purpose**: Production deployment
- **Patients**: 100
- **Providers**: 15
- **Features**: All enabled
- **Database**: SQLite (configurable)
- **Performance**: Optimized batch processing

### 3. cloud
- **Purpose**: Cloud deployment (AWS/Azure)
- **Patients**: 200
- **Providers**: 20
- **Features**: All enabled
- **Database**: PostgreSQL ready
- **Performance**: High concurrency settings

## Deployment Methods

### Method 1: Unified Deployment Script (Recommended)

The unified deployment script handles the complete setup automatically:

```bash
# Basic usage
python3 scripts/unified_deployment_setup.py --profile production

# With options
python3 scripts/unified_deployment_setup.py \
  --profile production \
  --skip-tests \
  --config custom-deployment.json
```

What it does:
1. Checks prerequisites
2. Downloads and configures Synthea
3. Generates patient data with clinical notes and imaging
4. Creates database and imports data
5. Creates provider accounts
6. Assigns patients to providers
7. Adds lab reference ranges
8. Generates DICOM files
9. Builds frontend
10. Runs validation tests

### Method 2: Docker Deployment

#### Local Docker Deployment

```bash
# Build and run
docker-compose -f docker-compose.standalone.yml up -d

# Check status
docker-compose -f docker-compose.standalone.yml ps

# View logs
docker-compose -f docker-compose.standalone.yml logs -f
```

#### AWS EC2 Deployment

```bash
# Quick deploy script
curl -sSL https://raw.githubusercontent.com/ultraub/MedGenEMR/main/EMR/deploy-ec2-simple.sh | bash

# Or manual deployment
chmod +x deploy-ec2-simple.sh
./deploy-ec2-simple.sh
```

### Method 3: Manual Deployment

1. **Install Dependencies**
   ```bash
   # Backend
   cd backend
   pip install -r requirements.txt
   
   # Frontend
   cd ../frontend
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Backend .env
   echo "DATABASE_URL=sqlite:///./data/emr.db" > backend/.env
   echo "SECRET_KEY=your-secret-key-here" >> backend/.env
   
   # Frontend .env
   echo "REACT_APP_API_URL=" > frontend/.env
   ```

3. **Setup Database**
   ```bash
   cd backend
   python scripts/comprehensive_setup.py
   ```

4. **Build Frontend**
   ```bash
   cd frontend
   npm run build
   ```

5. **Start Services**
   ```bash
   # Backend
   cd backend
   python main.py
   
   # Frontend (development)
   cd frontend
   npm start
   ```

## Configuration

### Environment Variables

#### Backend Configuration
```env
# Required
DATABASE_URL=sqlite:///./data/emr.db
SECRET_KEY=change-this-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=8

# Optional
CORS_ORIGINS=http://localhost,http://localhost:3000
LOG_LEVEL=INFO
UPLOAD_MAX_SIZE_MB=50
DICOM_STORAGE_PATH=./uploads/dicom
```

#### Frontend Configuration
```env
# For production, leave empty to use relative URLs
REACT_APP_API_URL=

# For development with separate backend
REACT_APP_API_URL=http://localhost:8000
```

### Deployment Configuration

Edit `deployment.config.json` to customize:

```json
{
  "deployment_profiles": {
    "custom": {
      "description": "Custom deployment",
      "patient_count": 150,
      "provider_count": 20,
      "enable_clinical_notes": true,
      "enable_imaging": true,
      "enable_labs_with_ranges": true,
      "enable_patient_provider_assignment": true
    }
  }
}
```

### Synthea Configuration

The system generates comprehensive patient data including:
- Demographics and insurance
- Encounters and clinical notes
- Medications and allergies
- Lab results with reference ranges
- Imaging studies with DICOM files
- Vital signs and observations

To customize Synthea generation, modify the `synthea_settings` in `deployment.config.json`.

## Post-Deployment

### 1. Verify Deployment

Run the validation test suite:

```bash
python3 tests/test_deployment_validation.py
```

Expected output:
- ✅ API health check passed
- ✅ Provider authentication working
- ✅ Patient data accessible
- ✅ Clinical data present
- ✅ FHIR endpoints operational
- ✅ CDS Hooks services available

### 2. Access the System

1. Open http://localhost:3000 (or your server URL)
2. Select any provider from the dropdown
3. Default password: `password123`
4. Navigate through patients and clinical features

### 3. Initial Data Verification

Check data counts:
```bash
cd backend
python3 -c "
from database.database import SessionLocal
from models.models import Patient, Provider
db = SessionLocal()
print(f'Patients: {db.query(Patient).count()}')
print(f'Providers: {db.query(Provider).count()}')
db.close()
"
```

### 4. Security Hardening

For production deployments:

1. **Change default passwords**
   ```python
   # Update provider passwords
   cd backend
   python scripts/reset_provider_passwords.py
   ```

2. **Update SECRET_KEY**
   ```bash
   # Generate secure key
   openssl rand -hex 32
   # Update in backend/.env
   ```

3. **Configure HTTPS**
   - Use reverse proxy (nginx/Apache)
   - Obtain SSL certificates
   - Update CORS origins

4. **Restrict CORS**
   ```env
   CORS_ORIGINS=https://yourdomain.com
   ```

## Cloud-Specific Deployment

### AWS Deployment

1. **Using CloudFormation**
   ```bash
   aws cloudformation create-stack \
     --stack-name emr-system \
     --template-body file://cloudformation-emr-fixed.yaml \
     --parameters ParameterKey=InstanceType,ParameterValue=t3.medium
   ```

2. **Using EC2 Script**
   ```bash
   ./deploy-ec2-simple.sh
   ```

3. **Post-deployment**
   - Configure Security Groups (ports 80, 443, 8000)
   - Set up Application Load Balancer
   - Configure Auto Scaling (optional)

### Azure Deployment

1. **Using ARM Template**
   ```bash
   az deployment group create \
     --resource-group emr-rg \
     --template-file azure-deploy.json \
     --parameters vmSize=Standard_B2ms
   ```

2. **Using Deployment Script**
   ```bash
   ./deploy-azure.sh
   ```

3. **Post-deployment**
   - Configure Network Security Groups
   - Set up Application Gateway
   - Enable Azure Monitor

## Monitoring and Maintenance

### Health Checks

The system provides health endpoints:
- API Health: `http://localhost:8000/api/health`
- Metrics: `http://localhost:8000/metrics` (if configured)

### Logs

- Backend logs: `backend/logs/backend.log`
- Frontend build: `frontend/build.log`
- Deployment: `deployment_setup.log`

### Backup

Regular backups recommended:
```bash
# Backup database
cp backend/data/emr.db backup/emr_$(date +%Y%m%d).db

# Backup DICOM files
tar -czf backup/dicom_$(date +%Y%m%d).tar.gz backend/uploads/dicom/
```

## Troubleshooting

### Common Issues

1. **"No providers found"**
   ```bash
   cd backend
   python scripts/create_sample_providers_enhanced.py --count 20
   ```

2. **"No patients visible"**
   ```bash
   cd backend
   python scripts/assign_patients_to_providers_auto.py --force
   ```

3. **Frontend API connection failed**
   - Check `REACT_APP_API_URL` in frontend/.env
   - Ensure backend is running on port 8000
   - Check CORS configuration

4. **Out of memory during Synthea generation**
   - Reduce patient count
   - Increase Java heap size in deployment.config.json
   - Use batch processing

5. **Docker build failures**
   - Use `Dockerfile.standalone.fixed`
   - Check Docker daemon status
   - Ensure sufficient disk space

### Debug Mode

Enable detailed logging:
```bash
# Backend
export LOG_LEVEL=DEBUG
python main.py

# Frontend
export REACT_APP_DEBUG=true
npm start
```

## Performance Tuning

### Database Optimization

For production with 100+ patients:
1. Consider PostgreSQL instead of SQLite
2. Add database indexes
3. Enable query caching

### Frontend Optimization

1. Build for production: `npm run build`
2. Serve static files via nginx
3. Enable gzip compression
4. Use CDN for assets

### API Optimization

1. Enable response caching
2. Implement pagination
3. Use connection pooling
4. Add rate limiting

## Support

For issues or questions:
1. Check the [main README](README.md)
2. Review [CLAUDE.md](CLAUDE.md) for detailed guidance
3. Submit issues to the GitHub repository

## License

This is a teaching/demonstration EMR system. Not for production healthcare use.

---

Generated with comprehensive deployment configuration for production readiness.