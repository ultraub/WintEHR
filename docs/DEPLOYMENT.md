# WintEHR Deployment Guide

**Version**: 1.1.0
**Last Updated**: October 15, 2025

This guide covers all deployment options for WintEHR, from local development to production Azure deployment.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Local Development](#local-development)
3. [Azure Production Deployment](#azure-production-deployment)
4. [Build Process](#build-process)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Configuration](#advanced-configuration)

---

## Quick Start

### Prerequisites

- **Docker**: 20.10+ with Docker Compose
- **Python**: 3.9+ for configuration validation
- **Resources**: 8GB RAM minimum (16GB recommended), 20GB disk space
- **Azure** (for production): Active subscription with VM access

### Fastest Path to Running System

```bash
# Clone and configure
git clone https://github.com/ultraub/WintEHR.git
cd WintEHR
cp config.example.yaml config.yaml

# Deploy (one command)
./deploy.sh
```

**Access at**: http://localhost:3000 (development mode)

---

## Local Development

### Standard Development Deployment

```bash
# 1. Configure for development
cp config.example.yaml config.yaml

# 2. Edit config.yaml
vim config.yaml
```

**Recommended dev settings:**
```yaml
deployment:
  environment: dev
  patient_count: 20
  enable_ssl: false

services:
  ports:
    frontend: 3000
    backend: 8000
    hapi_fhir: 8888
```

```bash
# 3. Deploy
./deploy.sh

# 4. Access the system
open http://localhost:3000
```

### Development with Hot Reload

For active development with immediate code changes:

**Backend (FastAPI):**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend (React):**
```bash
cd frontend
npm install

# Run dev server
npm start
```

**HAPI FHIR (containerized):**
```bash
docker-compose up -d postgres redis hapi-fhir
```

---

## Azure Production Deployment

### Fully Automated Production Deployment

WintEHR includes a **fully automated deployment script** that handles everything from server wipe to SSL configuration.

#### Prerequisites

1. **Azure VM** (Ubuntu 22.04 LTS recommended)
   - Size: Standard_D4s_v3 or larger
   - Public IP with DNS name
   - Ports open: 22 (SSH), 80 (HTTP), 443 (HTTPS)

2. **SSH Access**
   ```bash
   # Generate SSH key
   ssh-keygen -t rsa -b 4096 -f ~/.ssh/WintEHR-key.pem

   # Add public key to Azure VM
   # (via Azure Portal or during VM creation)
   ```

3. **Domain Name**
   - Configure Azure DNS: `your-vm-name.region.cloudapp.azure.com`
   - Or use custom domain pointing to VM public IP

#### Deployment Steps

```bash
# 1. Configure Azure settings
cp config.azure-prod.yaml config.yaml
vim config.yaml
```

**Required configuration:**
```yaml
deployment:
  environment: production
  patient_count: 100
  enable_ssl: true

azure:
  resource_group: your-resource-group
  vm_name: your-vm-name
  location: eastus2
  ssh_user: azureuser
  ssh_key: ~/.ssh/WintEHR-key.pem

ssl:
  domain_name: your-vm-name.eastus2.cloudapp.azure.com
  ssl_email: your-email@example.com
```

```bash
# 2. Run automated deployment
./deploy-azure-production.sh --yes
```

#### What Happens During Deployment

**STEP 1: Complete Server Wipe** (~2 minutes)
- Stops all Docker containers
- Removes all volumes and images
- Clears build cache
- Ensures fresh deployment environment

**STEP 2: Clone Fresh Code** (~1 minute)
- Clones latest code from GitHub
- Checks out specified branch

**STEP 3: Setup Environment** (~30 seconds)
- Copies configuration files
- Creates .env file with secrets
- Sets up directory structure

**STEP 4: Build and Deploy Services** (~10-12 minutes)
- Builds backend Docker image (Python dependencies)
- Builds frontend Docker image (npm build)
- Starts all containers with health checks
- **Fix #21**: Build runs asynchronously to prevent SSH timeout
- **Fix #22**: Polling uses direct SSH to avoid output interference

**STEP 5: Wait for Services** (~3-5 minutes)
- HAPI FHIR server initialization
- Backend health check validation
- **Fix #17**: Uses Docker inspect for health status

**STEP 6: Generate Patients with DICOM** (~5-8 minutes)
- Generates 100 synthetic patients via Synthea
- Loads FHIR bundles to HAPI server
- Creates DICOM files for imaging studies
- Generates DICOM endpoints

**STEP 7: Setup HTTPS/SSL** (~2 minutes)
- Obtains Let's Encrypt certificate
- Configures nginx with SSL
- Restarts nginx with HTTPS enabled
- **Fix #20**: Non-blocking certificate verification

**STEP 8: Deployment Verification** (~1 minute)
- Verifies HTTPS endpoint accessible
- Confirms patient count
- Checks DICOM endpoints created
- Displays deployment summary

**Total Time**: ~25-30 minutes for complete automated deployment

#### Deployment Fixes (Version 1.1.0)

The automated deployment includes 6 critical fixes for reliability:

- **Fix #17**: Backend health check using `docker inspect` instead of curl (port not exposed to host)
- **Fix #18**: SSH keepalive configuration (`ServerAliveInterval=60`) prevents timeout during long builds
- **Fix #19**: Simplified Docker build (removed complex heredoc monitoring)
- **Fix #20**: Non-blocking SSL certificate verification (permission check made optional)
- **Fix #21**: Asynchronous Docker build with `nohup` prevents SSH connection timeout
- **Fix #22**: Direct SSH in polling loop avoids colored output breaking integer comparison

### Post-Deployment Verification

```bash
# Check deployment status
ssh -i ~/.ssh/WintEHR-key.pem azureuser@your-domain.cloudapp.azure.com \
  'cd WintEHR && docker ps'

# Check patient count
curl -s "https://your-domain.cloudapp.azure.com/fhir/Patient?_summary=count" | jq '.total'

# Check DICOM endpoints
curl -s "https://your-domain.cloudapp.azure.com/fhir/Endpoint?_summary=count" | jq '.total'

# Access the application
open https://your-domain.cloudapp.azure.com
```

**Default credentials:**
- Username: `demo`
- Password: `password`

---

## Build Process

### Docker Build Architecture

WintEHR uses multi-stage Docker builds for optimized images:

#### Backend Build (Python/FastAPI)

```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user -r requirements.txt

# Stage 2: Runtime image
FROM python:3.11-slim
COPY --from=builder /root/.local /root/.local
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]
```

**Build command:**
```bash
docker build -t wintehr-backend:latest -f backend/Dockerfile backend/
```

#### Frontend Build (React)

```dockerfile
# Stage 1: Build React app
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
```

**Build command:**
```bash
docker build -t wintehr-frontend:latest -f frontend/Dockerfile frontend/
```

#### Build Performance

| Component | Build Time | Image Size |
|-----------|------------|------------|
| Backend | ~8-10 min | ~1.2GB |
| Frontend | ~10-12 min | ~150MB |
| Total | ~12-15 min | ~1.35GB |

**Optimization tips:**
- Use Docker layer caching for faster rebuilds
- `.dockerignore` excludes unnecessary files
- Multi-stage builds reduce final image size

### Manual Build Process

If you need to build manually without deployment scripts:

```bash
# 1. Build images
docker-compose -f docker-compose.prod.yml build

# 2. Start services
docker-compose -f docker-compose.prod.yml up -d

# 3. Wait for HAPI FHIR
docker exec emr-backend curl -sf http://hapi-fhir:8080/fhir/metadata

# 4. Load patient data
docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py 100 Massachusetts

# 5. Generate DICOM files
docker exec emr-backend python scripts/active/generate_dicom_from_hapi.py
```

---

## Troubleshooting

### Common Build Issues

#### Issue: Docker build timeout or OOM

**Symptoms**: Build process crashes or hangs during npm install or pip install

**Solution**:
```bash
# Increase Docker resources
# Docker Desktop: Settings → Resources → Memory: 8GB+

# Or build with reduced parallelism
docker build --build-arg JOBS=2 -t wintehr-backend backend/
```

#### Issue: Frontend build fails with memory error

**Symptoms**: `FATAL ERROR: Ineffective mark-compacts near heap limit`

**Solution**:
```bash
# Set Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Or in Dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096"
```

#### Issue: SSH timeout during Azure deployment

**Status**: Fixed in v1.1.0 (Fix #21, Fix #22)

**Legacy workaround** (if using older version):
```bash
# Increase SSH timeout manually
ssh -i ~/.ssh/WintEHR-key.pem \
  -o ServerAliveInterval=60 \
  -o ServerAliveCountMax=10 \
  azureuser@your-domain.cloudapp.azure.com
```

### Deployment Failures

#### Issue: HAPI FHIR not starting

**Check logs**:
```bash
docker logs emr-hapi-fhir --tail 100
```

**Common causes**:
- Insufficient memory (increase to 2GB minimum)
- PostgreSQL not ready (wait longer)
- Port conflict (check port 8080)

**Solution**:
```bash
# Restart HAPI with more memory
docker-compose restart hapi-fhir

# Check PostgreSQL
docker exec emr-postgres pg_isready
```

#### Issue: SSL certificate generation fails

**Check error**:
```bash
docker logs emr-certbot
```

**Common causes**:
- Domain not pointing to server IP
- Port 80 not accessible (firewall/NSG)
- Rate limit exceeded (Let's Encrypt)

**Solution**:
```bash
# Verify DNS
nslookup your-domain.cloudapp.azure.com

# Check port 80 accessible
curl http://your-domain.cloudapp.azure.com

# Manual certificate generation
docker-compose run --rm certbot certonly --standalone \
  --email your-email@example.com \
  -d your-domain.cloudapp.azure.com
```

#### Issue: Patient data not loading

**Check pipeline**:
```bash
docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py 10 Massachusetts --debug
```

**Verify HAPI FHIR**:
```bash
curl http://localhost:8888/fhir/Patient?_summary=count
```

### Health Check Failures

**Check container status**:
```bash
docker ps -a
docker inspect emr-backend | jq '.[0].State.Health'
```

**Backend health endpoint**:
```bash
docker exec emr-backend curl http://localhost:8000/api/health
```

**HAPI FHIR metadata**:
```bash
docker exec emr-backend curl http://hapi-fhir:8080/fhir/metadata
```

---

## Advanced Configuration

### Environment-Specific Configurations

WintEHR supports environment overrides:

```bash
# Development
./deploy.sh --environment dev

# Staging
./deploy.sh --environment staging

# Production
./deploy.sh --environment production
```

**Configuration precedence**:
1. `config.{environment}.yaml` (highest priority)
2. `config.yaml`
3. `config.example.yaml` (defaults)

### Custom Docker Compose

Override services for specific needs:

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  backend:
    environment:
      - DEBUG=true
      - LOG_LEVEL=debug
    volumes:
      - ./backend:/app  # Hot reload
```

### Resource Limits

Production resource limits:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### Scaling Services

**Horizontal scaling**:
```bash
docker-compose up -d --scale backend=3
```

**Load balancing**: Configure nginx upstream

```nginx
upstream backend {
    server backend-1:8000;
    server backend-2:8000;
    server backend-3:8000;
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Azure VM created and accessible
- [ ] SSH key configured
- [ ] DNS/domain configured
- [ ] Ports 80, 443 open in NSG
- [ ] Configuration files validated
- [ ] Sufficient disk space (100GB+)

### Post-Deployment

- [ ] HTTPS accessible
- [ ] Patient count >= 100
- [ ] DICOM endpoints created
- [ ] Login successful with demo user
- [ ] All modules functional (Chart, Orders, Imaging)
- [ ] Health checks passing
- [ ] SSL certificate valid

### Maintenance

- [ ] Regular backups configured
- [ ] Log rotation enabled
- [ ] Monitoring/alerts setup
- [ ] SSL renewal automated (certbot)
- [ ] Update schedule established

---

## Support

For deployment issues:
- **GitHub Issues**: https://github.com/ultraub/WintEHR/issues
- **Documentation**: https://github.com/ultraub/WintEHR/wiki
- **Discussions**: https://github.com/ultraub/WintEHR/discussions

---

**Last Updated**: October 15, 2025
**WintEHR Version**: 1.1.0
