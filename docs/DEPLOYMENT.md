# WintEHR Deployment Guide

**Last Updated**: 2026-11-03

This guide covers all deployment options for WintEHR, from local development to production deployment.

> **Which guide do I need?** This file is the canonical operator guide.
> - **Just trying it out** → the [README quick start](../README.md) (`./deploy.sh`, login `demo`/`password`)
> - **Deploying into a client/on-prem environment** (hardening, networking, day-2 ops) → [CLIENT_DEPLOYMENT.md](CLIENT_DEPLOYMENT.md)
> - **Azure VM specifics** → [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md)
> - `AUTOMATED_DEPLOYMENT.md` (repo root) is a **historical design doc** — its scripts never shipped; don't follow it.
>
> When these documents disagree, this file and `./deploy.sh --help` win.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [Build Process](#build-process)
5. [Troubleshooting](#troubleshooting)
6. [Advanced Configuration](#advanced-configuration)

---

## Quick Start

### Prerequisites

- **Docker**: 20.10+ with Docker Compose v2
- **Resources**: 8GB RAM minimum (16GB recommended), 20GB disk space
- **Azure/AWS** (for production): Active subscription with VM access

### Fastest Path to Running System

```bash
# Clone and configure
git clone https://github.com/ultraub/WintEHR.git
cd WintEHR
cp .env.example .env

# Deploy (one command)
./deploy.sh
```

**Access at**: http://localhost:3000 (development mode)

---

## Local Development

### Standard Development Deployment

```bash
# 1. Configure environment
cp .env.example .env

# 2. (Optional) Edit .env for custom settings
vim .env
```

**Default development settings** (from .env.example):
```bash
ENVIRONMENT=dev
FRONTEND_PORT=3000
BACKEND_PORT=8000
HAPI_FHIR_PORT=8888
```

```bash
# 3. Deploy with dev profile (default)
./deploy.sh

# 4. Access the system
open http://localhost:3000
```

### Development with Hot Reload

The dev profile automatically enables hot reload for both backend and frontend:

```bash
# Start all services with hot reload (default profile)
./deploy.sh

# Or explicitly specify dev profile
./deploy.sh --environment dev
```

**Volume Mounts** (automatic in dev profile):
- Backend: `./backend:/app` - Python code changes reload automatically
- Frontend: `./frontend:/app` - React dev server with HMR

**For standalone development** (without full Docker stack):

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

# Run dev server (Vite on :3000; `npm start` is an alias)
npm run dev
```

**HAPI FHIR (containerized):**
```bash
docker compose --profile dev up -d postgres redis hapi-fhir
```

---

## Production Deployment

### Unified Production Deployment

WintEHR uses Docker Compose profiles for environment-specific deployment. Production deployment includes nginx reverse proxy and SSL support.

#### Prerequisites

1. **Server** (Ubuntu 22.04 LTS recommended)
   - Size: 4 vCPU, 8GB RAM minimum
   - Public IP with DNS name
   - Ports open: 22 (SSH), 80 (HTTP), 443 (HTTPS)

2. **Domain Name**
   - Configure DNS to point to your server IP
   - Example: `wintehr.yourdomain.com`

#### Production Configuration

**Option 1: Automated Setup (Recommended)**

The `--domain` flag automatically configures all production settings:

```bash
# One-command production deployment with automatic configuration
./deploy.sh --environment prod --domain wintehr.yourdomain.com
```

This automatically:
- Sets `DOMAIN` in `.env`
- Configures all `REACT_APP_*` URLs for HTTPS
- Renders `deploy/nginx-prod.conf.template` → `deploy/rendered/nginx.conf` (gitignored)
- Obtains Let's Encrypt SSL certificates (`deploy/init-ssl.sh`)
- Generates 100 synthetic patients

**Option 2: Manual Configuration**

```bash
# 1. Copy and edit environment file
cp .env.example .env
vim .env
```

**Required production settings:**
```bash
# Production profile
ENVIRONMENT=prod
RESTART_POLICY=unless-stopped

# Your domain for SSL
DOMAIN=wintehr.yourdomain.com

# Strong passwords (generate new values!)
POSTGRES_PASSWORD=<strong-password>
SECRET_KEY=<generate-with-secrets.token_urlsafe(50)>
JWT_SECRET_KEY=<generate-with-secrets.token_urlsafe(50)>   # JWT_SECRET is accepted as a fallback
HAPI_ADMIN_TOKEN=<generate-with-secrets.token_urlsafe(50)>

# Production URLs (auto-configured if using --domain flag)
REACT_APP_API_URL=https://wintehr.yourdomain.com
REACT_APP_FHIR_ENDPOINT=https://wintehr.yourdomain.com/fhir/R4
REACT_APP_WS_URL=wss://wintehr.yourdomain.com/ws
```

```bash
# 2. Deploy with production profile
./deploy.sh --environment prod
```

#### What Happens During Deployment

**Step 1: Prerequisites Check** (~30 seconds)
- Docker and Docker Compose v2 verification
- Environment file validation
- Configuration loading

**Step 2: Build Images** (~10-15 minutes)
- Backend: Python dependencies, Synthea JAR download
- Frontend: npm install, React production build

**Step 3: Start Services** (~1 minute)
- Infrastructure: PostgreSQL, Redis
- FHIR Server: HAPI FHIR (local overlay on `hapiproject/hapi:v8.8.0-1`)
- Imaging: dcm4chee VNA (`dicom` profile, on by default; `--skip-dicom` to omit)
- Application: Backend, Frontend
- Proxy: Nginx (production only)

**Step 4: Health Checks** (~3-5 minutes)
- HAPI FHIR initialization (may take several minutes on first startup)
- Backend API health endpoint
- Database connectivity

**Step 5: Data Generation** (~5-8 minutes)
- Synthea patient generation (100 patients for prod)
- FHIR bundle loading to HAPI server
- CDS services loaded as `PlanDefinition`s
- DICOM file generation, STOW-RS upload into dcm4chee, `Endpoint` linking
- Demo practitioner creation
- Terminology index + HAPI load, only if vocabularies or `UMLS_API_KEY` are present ([TERMINOLOGY_SETUP.md](TERMINOLOGY_SETUP.md))

**Step 6: SSL Setup** (production only, ~2 minutes)
- Let's Encrypt certificate via Certbot
- Nginx SSL configuration
- HTTPS verification

**Total Time**: ~20-30 minutes for complete deployment

### Post-Deployment Verification

```bash
# Check service status
./deploy.sh status

# Check patient count
curl -s "https://your-domain.com/fhir/Patient?_summary=count" | jq '.total'

# View logs
./deploy.sh logs

# Access the application
open https://your-domain.com
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

### Dockerfile Variants

WintEHR provides multiple Dockerfile variants for different use cases:

| File | Purpose | Use Case |
|------|---------|----------|
| `Dockerfile` (root) | All-in-one container | Single-container experiments; not used by compose |
| `backend/Dockerfile` | Production backend image (non-root `emruser`, Synthea SHA256 check) | `backend-prod` |
| `backend/Dockerfile.dev` | Development backend | `backend-dev` (hot reload) |
| `frontend/Dockerfile` | Vite build served by nginx | `frontend-prod` |
| `frontend/Dockerfile.dev` | Vite dev server | `frontend-dev` (HMR) |
| `frontend/Dockerfile.production`, `frontend/Dockerfile.build` | Alternative/CI builds | Not referenced by compose |
| `deploy/hapi-overlay/Dockerfile` | HAPI FHIR + CR cache-flush admin controller | `hapi-fhir-dev|prod` |

**Note**: `docker-compose.yml` picks the Dockerfile per profile (dev/prod).

### Manual Build Process

If you need to build manually without deployment scripts:

```bash
# 1. Build images (use appropriate profile)
docker compose --profile dev build    # Development
docker compose --profile prod build   # Production

# 2. Start services
docker compose --profile dev up -d    # Development
docker compose --profile prod up -d   # Production

# 3. Wait for HAPI FHIR (check logs)
docker compose logs -f hapi-fhir

# 4. Load patient data
docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py 20 Massachusetts

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
docker compose restart hapi-fhir

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
docker compose run --rm certbot certonly --standalone \
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

### Environment Profiles

WintEHR uses Docker Compose profiles for environment-specific configurations:

```bash
# Development (default)
./deploy.sh                    # or --environment dev

# Production
./deploy.sh --environment prod
```

**Profile differences**:
| Feature | dev | prod |
|---------|-----|------|
| Hot reload | ✅ Volume mounts | ❌ Built images |
| Nginx | ❌ Direct ports | ✅ Reverse proxy |
| SSL | ❌ HTTP only | ✅ HTTPS with Certbot |
| Patient count | 20 | 100 |
| Restart policy | no | unless-stopped |
| Published ports | 3000/8000/8888/5432/6379 | 80/443 only (dcm4chee on `127.0.0.1`) |

Both profiles add the `dicom` profile (dcm4chee VNA) unless you pass `--skip-dicom`.

A prod deploy aborts if `.env` still carries example secrets
(`POSTGRES_PASSWORD=emr_password`, the example JWT key); see
[CONFIGURATION.md § Validation](CONFIGURATION.md#validation). `--skip-validation`
overrides, `--validate-only` just reports.

### Custom Configuration

Override settings via `.env` file:

```bash
# Copy example and customize
cp .env.example .env
vim .env
```

### Custom Docker Compose

Override services for specific needs:

```yaml
# docker-compose.override.yml
services:
  backend-dev:
    environment:
      - DEBUG=true
      - LOG_LEVEL=debug
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
docker compose --profile prod up -d --scale backend-prod=3
```

**Load balancing**: Configure the nginx upstream in `deploy/nginx-prod.conf.template` (then re-run `deploy.sh` to re-render):

```nginx
upstream backend {
    server backend-prod-1:8000;
    server backend-prod-2:8000;
    server backend-prod-3:8000;
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Host created and accessible (Azure: see [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md))
- [ ] SSH key configured
- [ ] DNS/domain configured
- [ ] Ports 80, 443 open in the firewall / NSG (80 must be open to the whole internet for Let's Encrypt)
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

**Last Updated**: 2026-11-03
