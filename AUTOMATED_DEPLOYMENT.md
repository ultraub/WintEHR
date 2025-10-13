# WintEHR Automated One-Shot Production Deployment

**Last Updated**: 2025-10-13
**Status**: Production Ready

---

## Overview

This deployment system provides **fully automated, one-shot deployment** to Azure production with **mandatory server wipe** before every deployment attempt. It ensures a clean, repeatable deployment process from scratch.

### Key Features

- ✅ **Mandatory Server Wipe**: Every deployment starts with complete cleanup
- ✅ **Zero Manual Intervention**: All steps fully automated via scripts
- ✅ **HTTPS/SSL Automatic**: Let's Encrypt certificate generation
- ✅ **100 Patients with DICOM**: Synthetic data generation with medical images
- ✅ **SSH-Based Deployment**: Remote execution without manual server access
- ✅ **Repeatable**: Same command, same result every time

---

## Critical Requirement: Server Wipe Protocol

**EVERY DEPLOYMENT ATTEMPT MUST BEGIN WITH A COMPLETE SERVER WIPE**

This includes:
- First deployment attempt
- All subsequent attempts after failures
- Even successful test runs before final deployment

### What Gets Wiped

1. **Docker Resources**
   - All containers (running and stopped)
   - All volumes (including data)
   - All images
   - All custom networks

2. **Application Data**
   - `/app/data/` - All FHIR resources
   - `/app/logs/` - All application logs
   - `backend/data/generated_dicoms/` - DICOM files

3. **Configuration**
   - SSL certificates (`/etc/letsencrypt/`)
   - Generated environment files

4. **Processes**
   - Lingering Node.js processes
   - Python/uvicorn processes

---

## Deployment Scripts

### 1. `cleanup-server.sh` - Complete Server Wipe

**Purpose**: Wipes ALL traces of previous deployments

**Usage**:
```bash
# Full wipe (production-safe - keeps Docker installed)
./cleanup-server.sh

# Preview what would be removed
./cleanup-server.sh --dry-run

# Nuclear option (removes Docker itself)
./cleanup-server.sh --nuclear
```

**What It Does**:
1. Stops all Docker containers
2. Removes all containers, volumes, images, networks
3. Cleans up data directories
4. Removes SSL certificates
5. Kills lingering processes
6. Cleans package caches

**Safety**: By default, Docker remains installed. Use `--nuclear` only for complete system reset.

---

### 2. `deploy.sh` - Enhanced Main Deployment Script

**Purpose**: Orchestrates complete deployment with optional cleanup

**New Flags**:
- `--clean-first` - Execute server wipe before deployment
- `--base-url URL` - Set base URL for DICOM endpoints

**Usage**:
```bash
# Development deployment
./deploy.sh --environment dev

# Production with cleanup (recommended)
./deploy.sh --clean-first --environment production --base-url https://wintehr.eastus2.cloudapp.azure.com

# Validate configuration only
./deploy.sh --validate-only
```

**Execution Flow**:
1. **[Optional] Cleanup**: If `--clean-first`, run cleanup-server.sh
2. **Prerequisites**: Check Docker, docker-compose, python3
3. **Configuration**: Load and validate config.yaml
4. **Build**: Docker image builds (skippable with `--skip-build`)
5. **Start Services**: Docker Compose up
6. **Wait for Health**: HAPI FHIR (5-6 min), Backend (1 min)
7. **Data Generation**:
   - Synthea patients (configurable count)
   - DICOM file generation
   - DICOM Endpoint creation (with --base-url if provided)
   - Demo Practitioner creation
8. **Azure NSG**: Network security group configuration (Azure only)
9. **SSL Setup**: Let's Encrypt certificate (if enabled)
10. **Verification**: Resource counts and health checks

---

### 3. `deploy-azure-production.sh` - SSH-Based Azure Deployment

**Purpose**: Fully automated Azure deployment via SSH with zero manual steps

**Usage**:
```bash
# Full automated deployment
./deploy-azure-production.sh

# Preview without executing
./deploy-azure-production.sh --dry-run
```

**Prerequisites**:
- SSH key at: `~/.ssh/WintEHR-key.pem`
- Azure VM at: `wintehr.eastus2.cloudapp.azure.com`
- Git repository access

**Execution Flow (All via SSH)**:
1. **Server Wipe (MANDATORY)**
   - Stop/remove all Docker resources
   - Delete application directories
   - Remove SSL certificates
   - Kill lingering processes

2. **Fresh Code Checkout**
   - Clone repository
   - Checkout correct branch

3. **Environment Setup**
   - Copy production config
   - Generate secure passwords
   - Create `.env` file

4. **Build & Deploy**
   - Build Docker images with Azure URLs
   - Start all services

5. **Wait for Services**
   - HAPI FHIR readiness (5-6 min)
   - Backend readiness (1 min)

6. **Data Generation**
   - 100 synthetic patients
   - DICOM files for imaging studies
   - DICOM Endpoints with HTTPS URLs
   - Demo practitioners

7. **HTTPS/SSL Setup**
   - Install certbot
   - Get Let's Encrypt certificate
   - Configure Nginx SSL

8. **Verification**
   - HTTPS endpoint check
   - Patient count verification
   - Endpoint count verification

**No Manual Steps Required**: Everything executes via SSH automatically.

---

## Configuration Files

### `config.azure-prod.yaml` - Azure Production Configuration

Production-ready settings for Azure deployment:

```yaml
deployment:
  environment: production
  patient_count: 100              # 100 patients with DICOM
  enable_ssl: true                # HTTPS required
  enable_monitoring: false

azure:
  resource_group: wintehr-rg
  vm_name: wintehr-vm
  nsg_name: wintehr-nsg
  location: eastus2

ssl:
  domain_name: wintehr.eastus2.cloudapp.azure.com
  ssl_email: admin@wintehr.com
  provider: letsencrypt

hapi_fhir:
  memory: 4g                      # Increased for 100 patients
  validation_mode: NEVER

synthea:
  state: Massachusetts
  seed: 12345
```

**Usage**: Automatically used by `deploy-azure-production.sh`

---

## Execution Patterns

### Pattern 1: Local Development with Cleanup

```bash
# Wipe and deploy locally
./deploy.sh --clean-first --environment dev

# Or use separate commands
./cleanup-server.sh && ./deploy.sh --environment dev
```

### Pattern 2: Azure Production Deployment

```bash
# One-shot automated deployment (recommended)
./deploy-azure-production.sh

# This internally executes:
# 1. Server wipe via SSH
# 2. Fresh code checkout
# 3. Build and deployment
# 4. Data generation
# 5. HTTPS setup
# 6. Verification
```

### Pattern 3: Iterative Development

```bash
# First attempt
./deploy.sh --clean-first --environment production

# If it fails, fix scripts locally, then:
./deploy.sh --clean-first --environment production

# Always start with clean slate - never skip wipe
```

---

## Success Criteria

Deployment is successful when:

1. ✅ **Server wipe completes** without errors
2. ✅ **Deploy script completes** without errors
3. ✅ **HTTPS endpoint responds** with valid certificate
4. ✅ **Exactly 100 patients** exist in HAPI FHIR
5. ✅ **DICOM Endpoints created** for all imaging studies
6. ✅ **Imaging tab works** with DICOM viewer
7. ✅ **No manual intervention** was required

---

## Verification Commands

### After Deployment

```bash
# Check HTTPS
curl -I https://wintehr.eastus2.cloudapp.azure.com

# Check patient count
curl "https://wintehr.eastus2.cloudapp.azure.com/fhir/Patient?_summary=count"

# Check DICOM endpoints
curl "https://wintehr.eastus2.cloudapp.azure.com/fhir/Endpoint?_summary=count"

# Check specific imaging study
curl "https://wintehr.eastus2.cloudapp.azure.com/fhir/ImagingStudy?patient=PATIENT_ID"

# Test DICOM metadata
curl "https://wintehr.eastus2.cloudapp.azure.com/dicom/studies/study_ID/metadata"
```

### SSH Verification

```bash
# SSH into Azure VM
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com

# Check containers
docker ps

# Check logs
cd WintEHR && docker-compose logs -f

# Check resource counts in database
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT res_type, COUNT(*)
FROM hfj_resource
WHERE res_deleted_at IS NULL
GROUP BY res_type
ORDER BY COUNT(*) DESC;"
```

---

## Failure Recovery

### If Deployment Fails

1. **Analyze error logs**
   - Check script output for error messages
   - Review Docker container logs

2. **Fix scripts locally**
   - Update deployment scripts as needed
   - Modify configuration files

3. **ALWAYS wipe server before retry**
   ```bash
   # NEVER try incremental fixes
   # ALWAYS start fresh
   ./cleanup-server.sh && ./deploy.sh --clean-first --environment production
   ```

4. **Repeat until successful**
   - Each attempt must start with wipe
   - No exceptions to this rule

### Common Issues

**Issue**: HAPI FHIR timeout during startup

**Solution**:
- Increase wait time in deploy script
- Check VM memory (4GB minimum recommended)
- Review HAPI logs: `docker logs hapi-fhir`

**Issue**: SSL certificate generation fails

**Solution**:
- Verify domain DNS points to VM public IP
- Check port 80 is accessible (Azure NSG rules)
- Ensure no other process using port 80

**Issue**: DICOM endpoints return 404

**Solution**:
- Verify `--base-url` was passed correctly
- Check endpoint addresses in FHIR resources
- Confirm DICOM files exist in `/app/data/generated_dicoms/`

---

## Security Notes

### Production Security Checklist

- [x] HTTPS/SSL enabled with valid certificate
- [x] Secure passwords generated automatically
- [x] `.env` file contains secrets (not committed)
- [x] Azure NSG restricts unnecessary ports
- [x] CORS configured for production domains

### Educational Platform Reminder

**This is an EDUCATIONAL platform**:
- ✅ Use with synthetic Synthea data only
- ✅ Perfect for learning healthcare IT concepts
- ❌ NOT HIPAA compliant
- ❌ NOT suitable for real patient data
- ❌ NOT for production medical use

---

## Troubleshooting

### Debug Mode

```bash
# Enable bash debug mode
bash -x ./deploy.sh --clean-first --environment production

# Check individual components
./cleanup-server.sh --dry-run
./deploy.sh --validate-only
```

### Component-by-Component Testing

```bash
# Test Docker
docker ps
docker images
docker volume ls

# Test HAPI FHIR
curl http://localhost:8888/fhir/metadata

# Test Backend
curl http://localhost:8000/health

# Test Frontend
curl http://localhost:3000
```

---

## Performance Considerations

### Resource Requirements

**Minimum Azure VM**:
- CPU: 4 vCPUs
- RAM: 8 GB
- Disk: 50 GB SSD
- Network: Standard public IP

**Recommended for 100 Patients**:
- CPU: 4-8 vCPUs
- RAM: 16 GB
- Disk: 100 GB SSD
- HAPI Memory: 4g (configured in config.yaml)

### Deployment Time

- **Server Wipe**: 2-3 minutes
- **Docker Build**: 5-10 minutes (first time), <1 minute (cached)
- **HAPI FHIR Startup**: 5-6 minutes
- **Patient Generation**: 10-15 minutes (100 patients)
- **DICOM Generation**: 5-10 minutes
- **SSL Setup**: 1-2 minutes

**Total**: ~30-40 minutes for complete fresh deployment

---

## Support and Maintenance

### Regular Maintenance

```bash
# Update Docker images
docker-compose pull

# Clean up unused resources
docker system prune -af

# Backup database
docker exec emr-postgres pg_dump -U emr_user emr_db > backup.sql

# Check disk usage
df -h
docker system df
```

### Monitoring

```bash
# Container status
docker-compose ps

# Resource usage
docker stats

# Logs
docker-compose logs -f --tail=100

# Specific service logs
docker-compose logs -f backend
```

---

## Related Documentation

- **[CLAUDE.md](CLAUDE.md)** - Main project documentation
- **[README.md](README.md)** - Project overview
- **[docs/DEPLOYMENT_CHECKLIST.md](docs/DEPLOYMENT_CHECKLIST.md)** - Detailed deployment guide
- **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** - Configuration reference

---

## Quick Reference

```bash
# Complete automated production deployment
./deploy-azure-production.sh

# Local deployment with cleanup
./deploy.sh --clean-first --environment production \
  --base-url https://wintehr.eastus2.cloudapp.azure.com

# Just wipe server
./cleanup-server.sh

# Verify deployment
curl -I https://wintehr.eastus2.cloudapp.azure.com
```

---

**Remember**: Every deployment starts with a wipe. No exceptions. This ensures clean, repeatable deployments every time.
