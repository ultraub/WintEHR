# WintEHR Deployment Guide

Complete guide for deploying WintEHR to production environments.

## Quick Start

### Full System Deployment (Recommended)

Deploy the complete WintEHR stack with a single command:

```bash
./scripts/deploy-full-system-azure.sh
```

This script will:
1. ✓ Build frontend with production configuration
2. ✓ Package all necessary files
3. ✓ Upload to Azure VM
4. ✓ Deploy backend, HAPI FHIR, PostgreSQL, Redis, and Nginx
5. ✓ Verify deployment health

### Frontend-Only Update

If you only need to update the frontend:

```bash
./scripts/deploy-frontend-azure.sh
```

## Deployment Scripts Overview

### 1. deploy-full-system-azure.sh (Complete Deployment)

**Purpose**: Deploy entire WintEHR system from scratch

**Usage**:
```bash
# Basic usage (uses defaults)
./scripts/deploy-full-system-azure.sh

# With custom configuration
AZURE_HOST=myserver.com \
AZURE_USER=myuser \
SSH_KEY=~/.ssh/my-key.pem \
./scripts/deploy-full-system-azure.sh
```

**Environment Variables**:
- `AZURE_HOST` - Azure hostname (default: wintehr.eastus2.cloudapp.azure.com)
- `AZURE_USER` - SSH user (default: azureuser)
- `SSH_KEY` - Path to SSH private key (default: ~/.ssh/WintEHR-key.pem)
- `PATIENT_COUNT` - Number of synthetic patients to generate (default: 50)

**What it deploys**:
- PostgreSQL 15 (database)
- Redis 7 (caching)
- HAPI FHIR JPA Server (FHIR R4 server)
- Backend API (FastAPI)
- Frontend (React SPA)
- Nginx (reverse proxy with SSL)
- Certbot (SSL certificate management)

**Duration**: ~5-10 minutes (HAPI FHIR initialization takes 2-3 minutes)

### 2. deploy-frontend-azure.sh (Frontend Update)

**Purpose**: Update frontend only (faster for UI-only changes)

**Usage**:
```bash
./scripts/deploy-frontend-azure.sh
```

**What it does**:
1. Verifies `.env.production` exists
2. Builds frontend with production config
3. Packages build (11MB compressed)
4. Uploads to Azure VM
5. Deploys to Docker volume
6. Restarts frontend and nginx containers
7. Verifies deployment

**Duration**: ~2-3 minutes

## Prerequisites

### Local Machine

1. **Node.js 18+** (for frontend build)
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **SSH Access** to Azure VM
   ```bash
   ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com
   ```

3. **Required Files**:
   - `frontend/.env.production` - Production environment config
   - `nginx-prod.conf` - Nginx configuration with FHIR R4 rewrite
   - `~/.ssh/WintEHR-key.pem` - SSH private key

### Azure VM

1. **Docker & Docker Compose** (auto-installed by deployment script)
2. **Ports Open**:
   - 80 (HTTP)
   - 443 (HTTPS)
   - 22 (SSH)

## Configuration Files

### frontend/.env.production

Production environment configuration for the React frontend:

```bash
# Backend API
REACT_APP_API_URL=https://wintehr.eastus2.cloudapp.azure.com

# FHIR Endpoint (includes /R4 to prevent double-appending)
REACT_APP_FHIR_ENDPOINT=https://wintehr.eastus2.cloudapp.azure.com/fhir/R4

# CDS Hooks
REACT_APP_CDS_HOOKS_URL=https://wintehr.eastus2.cloudapp.azure.com/api

# WebSocket (secure protocol)
REACT_APP_WEBSOCKET_URL=wss://wintehr.eastus2.cloudapp.azure.com

# Features
REACT_APP_EMR_FEATURES=true
REACT_APP_EMR_API=/api/emr
REACT_APP_CLINICAL_CANVAS_API=/api/clinical-canvas
REACT_APP_ENABLE_SEARCH=true
REACT_APP_ENABLE_HISTORY=true
REACT_APP_ENABLE_OPERATIONS=true
REACT_APP_ENABLE_BATCH=true
```

**Important**: Always update the hostname when deploying to a different server!

### nginx-prod.conf

Production Nginx configuration with critical FHIR R4 rewrite rule:

```nginx
location /fhir/ {
    # Rewrite /fhir/R4/ to /fhir/ for HAPI FHIR compatibility
    rewrite ^/fhir/R4/(.*)$ /fhir/$1 last;

    proxy_pass http://hapi_fhir/fhir/;
    # ... rest of config
}
```

**Why this is needed**: The frontend automatically appends `/R4` to FHIR endpoints. HAPI FHIR doesn't use `/R4` in its paths, so we include it in the environment variable to prevent double-appending, then strip it with nginx rewrite.

### docker-compose.prod.yml

Production Docker Compose configuration defining all services and their relationships.

## Deployment Workflow

### First-Time Deployment

1. **Prepare Configuration**:
   ```bash
   # Create frontend production config
   cp frontend/.env.example frontend/.env.production
   # Edit with production values
   nano frontend/.env.production
   ```

2. **Run Full Deployment**:
   ```bash
   ./scripts/deploy-full-system-azure.sh
   ```

3. **Wait for Initialization** (2-3 minutes for HAPI FHIR)

4. **Verify Deployment**:
   ```bash
   # Check FHIR endpoint
   curl https://wintehr.eastus2.cloudapp.azure.com/fhir/metadata

   # Check application
   curl https://wintehr.eastus2.cloudapp.azure.com/

   # Check patient data
   curl https://wintehr.eastus2.cloudapp.azure.com/fhir/Patient?_count=1
   ```

5. **Load Patient Data** (if needed):
   ```bash
   ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com
   cd ~/WintEHR
   docker-compose -f docker-compose.prod.yml exec backend python scripts/load_synthea_data.py --count 50
   ```

### Updating Frontend Only

```bash
# Make your frontend changes
cd frontend/src
# ... edit files ...

# Deploy updated frontend
cd ../..
./scripts/deploy-frontend-azure.sh
```

### Updating Backend Only

```bash
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com
cd ~/WintEHR

# Pull latest backend code
git pull origin main

# Rebuild and restart backend
docker-compose -f docker-compose.prod.yml up -d --build backend
```

### Updating Nginx Configuration

```bash
# Edit nginx-prod.conf locally
nano nginx-prod.conf

# Deploy changes
scp -i ~/.ssh/WintEHR-key.pem nginx-prod.conf azureuser@wintehr.eastus2.cloudapp.azure.com:~/WintEHR/

# Restart nginx on VM
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com
cd ~/WintEHR
docker-compose -f docker-compose.prod.yml restart nginx
```

## Monitoring & Maintenance

### Check Service Status

```bash
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com
cd ~/WintEHR
docker-compose -f docker-compose.prod.yml ps
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f hapi-fhir
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
docker-compose -f docker-compose.prod.yml restart nginx
```

### SSL Certificate Renewal

```bash
# Check certificate status
docker exec emr-certbot certbot certificates

# Renew certificate
docker exec emr-certbot certbot renew
docker-compose -f docker-compose.prod.yml restart nginx
```

## Troubleshooting

### Common Issues

#### 1. Mixed Content Errors in Browser

**Symptom**: Console shows "Mixed Content" errors with HTTP requests

**Solution**:
1. Verify `frontend/.env.production` uses HTTPS URLs
2. Rebuild frontend: `./scripts/deploy-frontend-azure.sh`

#### 2. FHIR 404 Errors on /R4 Paths

**Symptom**: Requests to `/fhir/R4/Patient` return 404

**Solution**:
1. Verify nginx-prod.conf has rewrite rule
2. Restart nginx: `docker-compose restart nginx`

#### 3. WebSocket Connection Failures

**Symptom**: WebSocket errors in browser console

**Solution**:
1. Verify `REACT_APP_WEBSOCKET_URL` uses `wss://` protocol
2. Rebuild and redeploy frontend

#### 4. HAPI FHIR Not Starting

**Symptom**: HAPI FHIR health check fails

**Solution**:
```bash
# Check logs
docker logs emr-hapi-fhir

# Common fix: Restart with database ready
docker-compose restart hapi-fhir
```

#### 5. Frontend Shows Old Version

**Symptom**: Changes not visible after deployment

**Solution**:
```bash
# Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
# Or hard refresh with DevTools open
```

### Health Check Commands

```bash
# PostgreSQL
docker exec emr-postgres pg_isready -U emr_user -d emr_db

# HAPI FHIR
curl http://localhost:8888/fhir/metadata

# Backend
curl http://localhost:8000/api/health

# Frontend (via nginx)
curl https://wintehr.eastus2.cloudapp.azure.com/

# FHIR (via nginx with SSL)
curl https://wintehr.eastus2.cloudapp.azure.com/fhir/metadata
```

## Rollback Procedure

If a deployment causes issues:

1. **Stop Current Deployment**:
   ```bash
   cd ~/WintEHR
   docker-compose -f docker-compose.prod.yml down
   ```

2. **Restore Previous Version**:
   ```bash
   # Restore from git
   git checkout [previous-commit]

   # Or restore from backup
   cp -r ~/WintEHR-backup/* ~/WintEHR/
   ```

3. **Redeploy**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Performance Tips

1. **Frontend Build Time**: Use incremental builds for faster iterations
2. **Docker Layer Caching**: Don't use `--no-cache` unless necessary
3. **Parallel Uploads**: Use `rsync` with compression for large file transfers
4. **Service Startup**: Wait for health checks before testing endpoints

## Security Checklist

- [ ] SSH key permissions: `chmod 600 ~/.ssh/WintEHR-key.pem`
- [ ] SSL certificate valid and auto-renewing
- [ ] `.env.production` not committed to git
- [ ] Database passwords changed from defaults
- [ ] JWT secret set in production environment
- [ ] Firewall rules configured (only ports 80, 443, 22 open)
- [ ] Regular security updates: `docker-compose pull && docker-compose up -d`

## Additional Resources

- **Azure Deployment Guide**: [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)
- **Deployment Changes Log**: [DEPLOYMENT_CHANGES_2025-10-06.md](DEPLOYMENT_CHANGES_2025-10-06.md)
- **Frontend Services Guide**: [frontend/src/services/CLAUDE.md](frontend/src/services/CLAUDE.md)
- **Backend API Guide**: [backend/api/CLAUDE.md](backend/api/CLAUDE.md)

## Support

For deployment issues:
1. Check service logs: `docker-compose logs [service]`
2. Verify configuration files match examples
3. Review [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md) for detailed troubleshooting
4. Check GitHub issues for known problems

---

**Last Updated**: 2025-10-06
**Version**: 4.2.0
**Deployment Target**: Azure Production Environment
