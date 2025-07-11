# MedGenEMR Deployment Guide

**Complete deployment guide for MedGenEMR with Docker, database initialization, and multi-environment support**

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git for repository access
- 4GB RAM minimum, 8GB recommended
- 10GB free disk space

### One-Command Deployment
```bash
# Clone and deploy with default settings (5 patients, local environment)
git clone <repository-url>
cd MedGenEMR
./unified-deploy.sh

# Custom deployment with more data
./unified-deploy.sh --fresh --patients 30 --providers 10 --orgs 5 --verbose
```

**Access Points After Deployment:**
- Frontend: http://localhost
- Backend API: http://localhost:8000  
- API Documentation: http://localhost:8000/docs
- FHIR API: http://localhost:8000/fhir/R4

**Default Login:** `demo` / `password`

## Deployment Options

### Local Development (Docker)
```bash
# Quick local deployment
./unified-deploy.sh

# Fresh deployment with custom data
./unified-deploy.sh --fresh --patients 50 --providers 15 --orgs 8

# Development mode with hot reload
./run-local.sh
```

### AWS Production Deployment
```bash
# AWS deployment (requires AWS CLI configured)
./unified-deploy.sh --environment aws --patients 100

# Or use dedicated AWS script
./deployment/aws/deploy-ec2-production.sh
```

### Azure Production Deployment  
```bash
# Azure deployment (requires Azure CLI configured)
./unified-deploy.sh --environment azure --patients 100

# Or use dedicated Azure script
./deployment/azure/deploy-azure-production.sh
```

## Database Architecture

### Automatic Initialization
The system automatically creates all required database tables during container startup:

**FHIR Tables:**
- `fhir.resources` - Main FHIR resource storage
- `fhir.resource_history` - Version history tracking
- `fhir.search_params` - Search parameter indexes
- `fhir.references` - Resource relationship tracking
- `fhir.compartments` - Patient compartment management
- `fhir.audit_logs` - Security and compliance logging

**Authentication Tables:**
- `auth.users` - User management
- `auth.roles` - Role-based access control
- `auth.user_roles` - User-role assignments

**CDS Hooks Tables:**
- `cds_hooks.hook_configurations` - CDS hook definitions
- `cds_hooks.execution_log` - CDS hook execution tracking

### Database Initialization Process
1. PostgreSQL container starts with initialization scripts in `postgres-init/`
2. `01-init-medgenemr.sql` creates all schemas, tables, indexes, and triggers
3. Backend container verifies schema completion during startup
4. Data generation scripts populate with realistic clinical data

### Data Generation
```bash
# Generate specific amounts of data
./unified-deploy.sh --patients 30 --providers 10 --orgs 5

# Data includes:
# - Patients with cleaned names (no numeric suffixes)
# - Healthcare providers with realistic specialties
# - Healthcare organizations with proper hierarchies
# - Clinical data (conditions, medications, lab results)
# - DICOM imaging studies with multi-slice capabilities
```

## Configuration

### Environment Variables
```bash
# Authentication Mode
JWT_ENABLED=false          # Training mode (default)
JWT_ENABLED=true           # Production JWT mode

# Database Configuration
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db

# API Keys (optional)
ANTHROPIC_API_KEY=your-key  # For UI Composer LLM features
OPENAI_API_KEY=your-key     # For multi-LLM provider support
GEMINI_API_KEY=your-key     # For Google Gemini support

# Security
JWT_SECRET=your-secret-key-change-in-production
```

### Docker Compose Configuration
```yaml
# Key services and their roles:
services:
  postgres:    # Database with automatic initialization
  backend:     # FastAPI server with FHIR R4 API
  frontend:    # React SPA with clinical workflows
```

### Authentication Modes

#### Training Mode (Default)
- `JWT_ENABLED=false`
- Pre-configured users: demo, nurse, pharmacist, admin
- All passwords: `password`
- Simplified authentication for development and training

#### Production Mode
- `JWT_ENABLED=true`
- Requires user registration
- JWT tokens with proper expiration
- bcrypt password hashing

## Data Management

### Synthea Integration
```bash
# Full data generation workflow
cd backend
python scripts/synthea_master.py full --count 30

# Individual steps
python scripts/synthea_master.py generate --count 20  # Generate only
python scripts/synthea_master.py import               # Import to database
python scripts/synthea_master.py validate             # Validate data integrity
```

### Database Operations
```bash
# Manual database initialization (if needed)
docker-compose exec backend python scripts/init_complete_database.py

# Clean patient names
docker-compose exec backend python scripts/clean_patient_names.py

# Generate DICOM studies
docker-compose exec backend python scripts/generate_dicom_for_studies.py
```

### Data Backup and Restore
```bash
# Backup database
docker-compose exec postgres pg_dump -U emr_user emr_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U emr_user emr_db < backup.sql

# Volume backup
docker run --rm -v medgenemr_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data
```

## Monitoring and Maintenance

### Health Checks
```bash
# System health
curl http://localhost:8000/health

# Database health
docker-compose exec postgres pg_isready -U emr_user

# FHIR API health
curl http://localhost:8000/fhir/R4/metadata
```

### Log Management
```bash
# View service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Backend application logs
docker-compose exec backend tail -f logs/application.log
```

### Performance Monitoring
```bash
# Database performance
docker-compose exec postgres psql -U emr_user emr_db -c "
  SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
  FROM pg_stat_user_tables 
  WHERE schemaname = 'fhir';"

# Container resource usage
docker stats
```

## Troubleshooting

### Common Issues

**Port Conflicts:**
```bash
# Check port usage
lsof -i :80 -i :8000 -i :5432

# Stop conflicting services
sudo systemctl stop apache2  # If using Apache
sudo systemctl stop nginx    # If using Nginx
```

**Database Connection Issues:**
```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres
# Wait for initialization, then start other services
```

**Frontend Build Issues:**
```bash
# Clear Docker build cache
docker system prune -f
docker-compose build --no-cache frontend
```

**Memory Issues:**
```bash
# Increase Docker memory limit (Docker Desktop)
# Settings -> Resources -> Advanced -> Memory: 8GB

# Monitor memory usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Diagnostic Scripts
```bash
# Comprehensive validation
python scripts/validate_deployment.py --verbose

# Database schema verification
docker-compose exec backend python scripts/validate_database_schema.py

# FHIR data validation
docker-compose exec backend python test_fhir_comprehensive.py
```

## Security Considerations

### Production Deployment Checklist
- [ ] Change default JWT_SECRET
- [ ] Enable JWT authentication (JWT_ENABLED=true)
- [ ] Configure proper SSL/TLS certificates
- [ ] Set up proper firewall rules
- [ ] Configure database access restrictions
- [ ] Enable audit logging
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategies
- [ ] Review and configure CORS settings

### Network Security
```bash
# Recommended firewall configuration
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw deny 5432/tcp   # PostgreSQL (internal only)
ufw deny 8000/tcp   # Backend API (behind reverse proxy)
```

## Scaling and Performance

### Horizontal Scaling
- Frontend: Can be scaled with multiple container instances behind a load balancer
- Backend: Stateless design allows multiple API server instances
- Database: Consider PostgreSQL read replicas for high-read workloads

### Performance Optimization
```bash
# Database optimization
docker-compose exec postgres psql -U emr_user emr_db -c "
  REINDEX DATABASE emr_db;
  VACUUM ANALYZE;
"

# Container resource limits
# Add to docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
```

## Multi-Environment Deployment

### Environment-Specific Configurations

**Development:**
- Local Docker deployment
- Hot reload enabled
- Debug logging
- Sample data (5-10 patients)

**Staging:**
- Cloud deployment
- Production-like data volumes (100+ patients)
- Performance testing enabled
- Full audit logging

**Production:**
- High availability setup
- Automated backups
- Monitoring and alerting
- SSL/TLS encryption
- Proper access controls

### CI/CD Integration
```yaml
# Example GitHub Actions workflow
name: Deploy MedGenEMR
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to staging
        run: ./unified-deploy.sh --environment staging --patients 50
      - name: Run tests
        run: ./test-automation/run-all-tests.sh
```

## Support and Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Database performance review, log rotation
2. **Monthly**: Security updates, backup verification
3. **Quarterly**: Full system performance review, capacity planning

### Getting Help
- Check logs first: `docker-compose logs`
- Review troubleshooting section
- Validate deployment: `python scripts/validate_deployment.py`
- Run diagnostic tests: `./test-automation/run-all-tests.sh`

### Updates and Upgrades
```bash
# Update system
git pull origin main
docker-compose down
docker-compose build
docker-compose up -d

# Verify update
./test-automation/run-all-tests.sh --smoke
```