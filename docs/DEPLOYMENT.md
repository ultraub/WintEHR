# WintEHR Deployment Guide

**Version**: 1.0.0  
**Last Updated**: 2025-08-06

## Table of Contents
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Configuration](#configuration)
- [Data Management](#data-management)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)

## Quick Start

### One-Command Deployment
```bash
# Development environment with 50 patients
./deploy.sh dev --patients 50

# Production environment with 100 patients
./deploy.sh prod --patients 100
```

The system will be available at:
- **Clinical Portal**: http://localhost
- **FHIR API**: http://localhost:8000/fhir/R4
- **API Documentation**: http://localhost:8000/docs

## Prerequisites

### System Requirements

#### Minimum Requirements
- **OS**: Ubuntu 20.04+, macOS 12+, Windows 10+ (WSL2)
- **CPU**: 2 cores
- **RAM**: 8GB
- **Storage**: 20GB free space
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+

#### Recommended for Production
- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4+ cores
- **RAM**: 16GB+
- **Storage**: 100GB SSD
- **Network**: 1Gbps connection

### Software Dependencies
```bash
# Check Docker installation
docker --version  # Should be 20.10+
docker-compose --version  # Should be 2.0+

# Check available resources
docker system df
docker system info
```

### Network Requirements
- Port 80 (HTTP)
- Port 443 (HTTPS - production)
- Port 8000 (Backend API)
- Port 5432 (PostgreSQL - internal)
- Port 6379 (Redis - internal)

## Development Deployment

### Standard Development Setup
```bash
# Clone repository
git clone https://github.com/ultraub/WintEHR.git
cd WintEHR

# Deploy with default settings (20 patients)
./deploy.sh dev

# Or specify patient count
./deploy.sh dev --patients 50
```

### Manual Development Setup
```bash
# 1. Set environment variables
export NODE_ENV=development
export JWT_ENABLED=false

# 2. Start services
docker-compose up -d

# 3. Initialize database
docker exec emr-backend python scripts/setup/init_database_definitive.py

# 4. Load sample data
docker exec emr-backend python scripts/active/synthea_master.py full --count 20

# 5. Generate DICOM images
docker exec emr-backend python scripts/active/generate_dicom_for_studies.py
```

### Development Features
- JWT authentication disabled
- Demo users enabled
- Hot-reload for frontend
- Debug logging enabled
- Error details exposed

### Demo Users
| Username | Password | Role | Access Level |
|----------|----------|------|--------------|
| demo | password | Physician | Full clinical access |
| nurse | password | Nurse | Limited prescribing |
| pharmacist | password | Pharmacist | Pharmacy module only |
| admin | password | Administrator | System configuration |

## Production Deployment

### Production Setup
```bash
# 1. Set production environment
export NODE_ENV=production
export JWT_ENABLED=true
export JWT_SECRET=$(openssl rand -base64 32)

# 2. Configure SSL certificates
mkdir -p ./nginx/certs
cp /path/to/fullchain.pem ./nginx/certs/
cp /path/to/privkey.pem ./nginx/certs/

# 3. Deploy production
./deploy.sh prod --patients 100
```

### Production Configuration

#### Environment Variables
Create `.env.production`:
```env
# Application
NODE_ENV=production
APP_URL=https://ehr.yourdomain.com

# Security
JWT_ENABLED=true
JWT_SECRET=your-secure-secret-key
JWT_EXPIRY=3600
SESSION_SECRET=your-session-secret

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=emr_db
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=secure-password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis-password

# CORS
CORS_ORIGINS=https://ehr.yourdomain.com

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=3600
```

#### Docker Compose Override
Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      target: production
    environment:
      - NODE_ENV=production
    restart: always

  backend:
    build:
      context: ./backend
      target: production
    environment:
      - NODE_ENV=production
      - JWT_ENABLED=true
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 4G

  postgres:
    volumes:
      - postgres_data_prod:/var/lib/postgresql/data
    restart: always
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G

  redis:
    command: redis-server --requirepass ${REDIS_PASSWORD}
    restart: always

  nginx:
    volumes:
      - ./nginx/certs:/etc/nginx/certs
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf
    ports:
      - "443:443"
    restart: always

volumes:
  postgres_data_prod:
    driver: local
```

### Security Hardening

#### SSL/TLS Configuration
```nginx
# nginx/nginx.prod.conf
server {
    listen 443 ssl http2;
    server_name ehr.yourdomain.com;

    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'" always;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Cloud Deployment

### AWS Deployment

#### EC2 Instance Setup
```bash
# 1. Launch EC2 instance (t3.xlarge recommended)
# 2. Install Docker
sudo apt update
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker ubuntu

# 3. Clone repository
git clone https://github.com/ultraub/WintEHR.git
cd WintEHR

# 4. Configure AWS-specific settings
export DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/emr_db
export REDIS_URL=redis://elasticache-endpoint:6379

# 5. Deploy
./deploy.sh prod --patients 100
```

#### AWS Services Integration
- **RDS PostgreSQL**: Managed database
- **ElastiCache Redis**: Managed cache
- **S3**: File storage for DICOM images
- **CloudFront**: CDN for static assets
- **ALB**: Application Load Balancer
- **ECS/EKS**: Container orchestration

### Docker Swarm Deployment
```bash
# Initialize swarm
docker swarm init

# Create overlay network
docker network create --driver overlay emr-network

# Deploy stack
docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml emr

# Scale services
docker service scale emr_backend=3
docker service scale emr_frontend=2
```

### Kubernetes Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wintehr-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wintehr-backend
  template:
    metadata:
      labels:
        app: wintehr-backend
    spec:
      containers:
      - name: backend
        image: wintehr/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/
kubectl get pods
kubectl get services
```

## Configuration

### Application Configuration

#### Frontend Configuration
```javascript
// frontend/src/config.js
export const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:8000',
  AUTH_ENABLED: process.env.REACT_APP_AUTH_ENABLED === 'true',
  ENVIRONMENT: process.env.NODE_ENV || 'development'
};
```

#### Backend Configuration
```python
# backend/config.py
from pydantic import BaseSettings

class Settings(BaseSettings):
    # Application
    app_name: str = "WintEHR"
    version: str = "1.0.0"
    environment: str = "development"
    
    # Database
    database_url: str = "postgresql://emr_user:password@postgres/emr_db"
    database_pool_size: int = 20
    database_max_overflow: int = 40
    
    # Redis
    redis_url: str = "redis://redis:6379"
    
    # Security
    jwt_enabled: bool = False
    jwt_secret: str = "change-this-secret"
    jwt_algorithm: str = "HS256"
    jwt_expiry: int = 3600
    
    # CORS
    cors_origins: list = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
```

### Database Configuration

#### PostgreSQL Tuning
```sql
-- Optimize for FHIR workload
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET work_mem = '64MB';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET random_page_cost = 1.1;

-- Apply changes
SELECT pg_reload_conf();
```

#### Connection Pooling
```python
# Using PgBouncer
[databases]
emr_db = host=postgres port=5432 dbname=emr_db

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
```

## Data Management

### Initial Data Load
```bash
# Load Synthea patients
docker exec emr-backend python scripts/active/synthea_master.py full --count 100

# Validate data
docker exec emr-backend python scripts/active/synthea_master.py validate

# Check data status
docker exec emr-backend python scripts/manage_data.py status
```

### Data Import/Export

#### Export Data
```bash
# Export all patients
docker exec emr-backend python scripts/export_data.py \
  --format json \
  --output /data/export/patients.json

# Export specific resource types
docker exec emr-backend python scripts/export_data.py \
  --resource-type Patient,Observation \
  --output /data/export/
```

#### Import Data
```bash
# Import FHIR bundle
docker exec emr-backend python scripts/import_bundle.py \
  --file /data/import/bundle.json \
  --validate

# Import from another FHIR server
docker exec emr-backend python scripts/import_from_server.py \
  --source-url https://other-fhir-server.com/fhir \
  --resource-type Patient,Observation
```

### Database Maintenance
```bash
# Backup database
docker exec emr-postgres pg_dump -U emr_user emr_db > backup.sql

# Restore database
docker exec -i emr-postgres psql -U emr_user emr_db < backup.sql

# Vacuum and analyze
docker exec emr-postgres psql -U emr_user -d emr_db -c "VACUUM ANALYZE;"

# Reindex
docker exec emr-postgres psql -U emr_user -d emr_db -c "REINDEX DATABASE emr_db;"
```

## Monitoring

### Health Checks
```bash
# Check service health
curl http://localhost:8000/health/status

# Check database connection
docker exec emr-backend python -c "from database import check_connection; check_connection()"

# Check Redis connection
docker exec emr-backend python -c "import redis; r = redis.Redis(host='redis'); r.ping()"
```

### Logging
```bash
# View backend logs
docker-compose logs -f backend

# View all logs
docker-compose logs -f

# Export logs
docker-compose logs > deployment.log
```

### Performance Monitoring
```bash
# Monitor resource usage
docker stats

# Database performance
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;"
```

### Prometheus Metrics
```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Backup & Recovery

### Automated Backups
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Backup database
docker exec emr-postgres pg_dump -U emr_user emr_db > $BACKUP_DIR/database.sql

# Backup files
docker cp emr-backend:/data/dicom $BACKUP_DIR/dicom

# Compress
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR.tar.gz s3://your-backup-bucket/

# Clean old backups (keep 30 days)
find /backups -type f -mtime +30 -delete
EOF

# Schedule daily backup
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### Disaster Recovery
```bash
# 1. Stop services
docker-compose down

# 2. Restore database
docker-compose up -d postgres
docker exec -i emr-postgres psql -U emr_user emr_db < backup.sql

# 3. Restore files
docker cp backup/dicom emr-backend:/data/

# 4. Start all services
docker-compose up -d

# 5. Verify restoration
docker exec emr-backend python scripts/validate_deployment.py
```

## Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Check disk space
df -h

# Clean Docker resources
docker system prune -a
```

#### Database Connection Failed
```bash
# Check PostgreSQL status
docker-compose ps postgres
docker-compose logs postgres

# Test connection
docker exec emr-backend python -c "
from sqlalchemy import create_engine
engine = create_engine('postgresql://emr_user:password@postgres/emr_db')
engine.connect()"
```

#### Slow Performance
```bash
# Check resource usage
docker stats

# Analyze slow queries
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT * FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"

# Increase resources
docker-compose down
# Edit docker-compose.yml to increase CPU/memory limits
docker-compose up -d
```

#### Data Import Failures
```bash
# Check import logs
tail -f backend/scripts/logs/synthea_master.log

# Validate Synthea data
ls -la output/fhir/*.json

# Retry with verbose logging
docker exec emr-backend python scripts/active/synthea_master.py \
  import --count 10 --verbose
```

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
docker-compose up

# Interactive shell
docker exec -it emr-backend /bin/bash

# Python shell with app context
docker exec -it emr-backend python
>>> from app import app
>>> from database import db
>>> # Debug here
```

### Recovery Procedures

#### Emergency Rollback
```bash
# 1. Stop current deployment
docker-compose down

# 2. Checkout previous version
git checkout v0.9.0

# 3. Restore database backup
docker-compose up -d postgres
docker exec -i emr-postgres psql -U emr_user emr_db < last-known-good.sql

# 4. Restart services
docker-compose up -d
```

#### Data Corruption Recovery
```bash
# 1. Identify corrupted resources
docker exec emr-backend python scripts/testing/validate_fhir_data.py

# 2. Export valid data
docker exec emr-backend python scripts/export_valid_data.py

# 3. Clear database
docker exec emr-backend python scripts/active/synthea_master.py wipe

# 4. Reimport valid data
docker exec emr-backend python scripts/import_bundle.py --file valid_data.json
```

## Performance Optimization

### Frontend Optimization
```bash
# Build optimized production bundle
cd frontend
npm run build

# Analyze bundle size
npm run analyze

# Enable compression
npm install compression
```

### Backend Optimization
```python
# Use connection pooling
from sqlalchemy.pool import QueuePool

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,
    max_overflow=40,
    pool_pre_ping=True
)
```

### Database Optimization
```sql
-- Create optimized indexes
CREATE INDEX idx_resources_type_date ON fhir.resources(resource_type, last_updated);
CREATE INDEX idx_search_params_composite ON fhir.search_params(resource_type, param_name, value_string);

-- Partition large tables
CREATE TABLE fhir.resources_2025 PARTITION OF fhir.resources
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

## Scaling Guidelines

### Vertical Scaling
- **Database**: Increase to 8+ CPU cores, 32GB+ RAM
- **Backend**: 4+ CPU cores, 8GB+ RAM per instance
- **Frontend**: 2+ CPU cores, 4GB+ RAM per instance

### Horizontal Scaling
```yaml
# Scale backend replicas
deploy:
  replicas: 5
  update_config:
    parallelism: 2
    delay: 10s
  restart_policy:
    condition: on-failure
```

### Load Balancing
```nginx
upstream backend {
    least_conn;
    server backend1:8000;
    server backend2:8000;
    server backend3:8000;
}
```

---

Built with ❤️ for the healthcare community.