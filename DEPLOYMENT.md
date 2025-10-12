# WintEHR Production Deployment Guide

Complete guide for deploying WintEHR on a fresh server with HTTPS/SSL.

## Quick Start

### Prerequisites

- Ubuntu 20.04+ or Debian 11+ server
- Domain name pointing to server IP
- SSH access (for remote deployment)
- Ports 80 and 443 open in firewall

### One-Command Deployment

**Remote Deployment (Recommended):**
```bash
./deploy-fresh-server.sh azureuser@your-domain.com ~/.ssh/your-key.pem
```

**Local Deployment:**
```bash
./deploy-fresh-server.sh
```

## Deployment Options

### Environment Variables

Configure deployment by setting environment variables:

```bash
# Required
export DOMAIN="your-domain.com"
export EMAIL="admin@your-domain.com"

# Optional
export PATIENT_COUNT=100                    # Number of synthetic patients (default: 100)
export USE_STAGING_SSL=1                    # Use Let's Encrypt staging (testing)
export ANTHROPIC_API_KEY="your-api-key"     # Optional: AI features

# Deploy
./deploy-fresh-server.sh
```

### Remote Deployment

Deploy from your local machine to a remote server:

```bash
./deploy-fresh-server.sh <ssh-host> <ssh-key-path>
```

**Examples:**

```bash
# Azure VM
./deploy-fresh-server.sh azureuser@wintehr.eastus2.cloudapp.azure.com ~/.ssh/azure-key.pem

# AWS EC2
./deploy-fresh-server.sh ubuntu@ec2-xx-xxx-xx-xxx.compute.amazonaws.com ~/.ssh/aws-key.pem

# DigitalOcean Droplet
./deploy-fresh-server.sh root@your-droplet-ip ~/.ssh/do-key
```

### Local Deployment

Deploy directly on the server:

```bash
# SSH to your server
ssh user@your-server

# Clone repository
git clone <your-repo-url> WintEHR
cd WintEHR

# Run deployment
export DOMAIN="your-domain.com"
export EMAIL="admin@your-domain.com"
./deploy-fresh-server.sh
```

## What Gets Deployed

### Services

- **PostgreSQL 15**: FHIR resource database
- **HAPI FHIR Server**: Standards-compliant FHIR R4 server
- **Backend API**: FastAPI application
- **Frontend**: React SPA with Material-UI
- **Nginx**: Reverse proxy with SSL termination
- **Redis**: Caching layer
- **Certbot**: SSL certificate management

### Features

✅ HTTPS/SSL with Let's Encrypt (auto-renewal)
✅ HAPI FHIR R4 compliant storage
✅ Synthetic patient data (Synthea)
✅ Clinical catalogs (medications, conditions, labs)
✅ Rate limiting and security headers
✅ Automatic health checks
✅ Database backups ready

## Post-Deployment

### Access Your Installation

```
Frontend:    https://your-domain.com
Backend API: https://your-domain.com/api
API Docs:    https://your-domain.com/docs
HAPI FHIR:   https://your-domain.com/fhir
```

**Default Credentials:**
- Username: `demo`
- Password: `password`

### Management Commands

```bash
# View all service logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f hapi-fhir

# Check service status
docker-compose -f docker-compose.prod.yml ps

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Stop all services
docker-compose -f docker-compose.prod.yml down

# Start services
docker-compose -f docker-compose.prod.yml up -d
```

### SSL Certificate Management

```bash
# Check certificate expiry
docker-compose -f docker-compose.prod.yml run --rm certbot certificates

# Renew certificates manually
docker-compose -f docker-compose.prod.yml run --rm certbot renew

# Test renewal process
docker-compose -f docker-compose.prod.yml run --rm certbot renew --dry-run
```

**Note:** Certificates auto-renew every 12 hours via the certbot container.

### Database Operations

```bash
# Access PostgreSQL
docker exec -it emr-postgres psql -U emr_user -d emr_db

# Create backup
docker exec emr-postgres pg_dump -U emr_user emr_db > backup.sql

# Restore backup
cat backup.sql | docker exec -i emr-postgres psql -U emr_user -d emr_db

# Check resource counts
docker exec emr-postgres psql -U emr_user -d emr_db -c \
  "SELECT resource_type, COUNT(*) FROM fhir.resources GROUP BY resource_type ORDER BY count DESC;"
```

### Load Additional Patient Data

```bash
# Load more patients (e.g., 50 additional patients)
docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py 50 Massachusetts

# Refresh clinical catalogs
docker exec emr-backend python scripts/active/consolidated_catalog_setup.py --extract-from-fhir
```

## Cloud Provider Setup

### Azure

```bash
# Create VM
az vm create \
  --resource-group myResourceGroup \
  --name wintehr-vm \
  --image Ubuntu2204 \
  --admin-username azureuser \
  --generate-ssh-keys

# Open ports
az vm open-port --port 80 --resource-group myResourceGroup --name wintehr-vm
az vm open-port --port 443 --resource-group myResourceGroup --name wintehr-vm

# Get public IP
az vm show -d --resource-group myResourceGroup --name wintehr-vm --query publicIps -o tsv

# Deploy
./deploy-fresh-server.sh azureuser@<public-ip> ~/.ssh/id_rsa
```

### AWS

```bash
# Launch EC2 instance (Ubuntu 22.04 LTS)
# Security Group: Allow ports 22, 80, 443

# Get instance public DNS
aws ec2 describe-instances --instance-ids i-xxxxx --query 'Reservations[0].Instances[0].PublicDnsName'

# Deploy
./deploy-fresh-server.sh ubuntu@<public-dns> ~/.ssh/aws-key.pem
```

### DigitalOcean

```bash
# Create droplet (Ubuntu 22.04)
doctl compute droplet create wintehr \
  --image ubuntu-22-04-x64 \
  --size s-2vcpu-4gb \
  --region nyc1

# Get droplet IP
doctl compute droplet list

# Deploy
./deploy-fresh-server.sh root@<droplet-ip> ~/.ssh/do-key
```

### Google Cloud Platform

```bash
# Create instance
gcloud compute instances create wintehr-instance \
  --image-family ubuntu-2204-lts \
  --image-project ubuntu-os-cloud \
  --machine-type e2-medium

# Create firewall rules
gcloud compute firewall-rules create allow-http --allow tcp:80
gcloud compute firewall-rules create allow-https --allow tcp:443

# Get external IP
gcloud compute instances describe wintehr-instance --format='get(networkInterfaces[0].accessConfigs[0].natIP)'

# Deploy
./deploy-fresh-server.sh <username>@<external-ip> ~/.ssh/google_compute_engine
```

## Troubleshooting

### SSL Certificate Issues

**Problem:** Let's Encrypt rate limit exceeded

```bash
# Use staging server for testing
export USE_STAGING_SSL=1
./deploy-fresh-server.sh
```

**Problem:** Domain not resolving

```bash
# Check DNS propagation
dig your-domain.com
nslookup your-domain.com

# Wait for DNS to propagate (can take up to 48 hours)
```

### Service Issues

**Problem:** HAPI FHIR not starting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs hapi-fhir

# Common issue: Not enough memory
# Solution: Increase server RAM to at least 4GB
```

**Problem:** Backend API failing

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend

# Check database connection
docker exec emr-postgres pg_isready -U emr_user -d emr_db

# Restart services
docker-compose -f docker-compose.prod.yml restart backend
```

**Problem:** Frontend not accessible

```bash
# Check nginx
docker-compose -f docker-compose.prod.yml logs nginx

# Verify SSL certificate
docker-compose -f docker-compose.prod.yml run --rm certbot certificates

# Check nginx config
docker exec emr-nginx nginx -t
```

### Performance Tuning

**Increase HAPI FHIR memory:**

Edit `docker-compose.prod.yml`:
```yaml
hapi-fhir:
  environment:
    - JAVA_OPTS=-Xmx2048m  # Increase from default
```

**Optimize PostgreSQL:**

```bash
# Edit postgresql.conf in container or add to docker-compose
docker exec emr-postgres psql -U emr_user -d emr_db -c \
  "ALTER SYSTEM SET shared_buffers = '1GB';"
docker-compose -f docker-compose.prod.yml restart postgres
```

**Increase Redis cache:**

Edit `docker-compose.prod.yml`:
```yaml
redis:
  command: redis-server --maxmemory 1gb --maxmemory-policy allkeys-lru
```

## Security Recommendations

### Production Hardening

1. **Change default credentials immediately**
2. **Enable JWT authentication** (set `JWT_ENABLED=true` in backend environment)
3. **Restrict database access** (PostgreSQL should not be exposed publicly)
4. **Enable fail2ban** for SSH brute force protection
5. **Regular security updates**: `sudo apt update && sudo apt upgrade`
6. **Backup encryption keys** (stored in `.env.production`)
7. **Monitor logs** for suspicious activity

### Firewall Configuration

```bash
# UFW (Ubuntu Firewall)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Block PostgreSQL from external access
sudo ufw deny 5432/tcp
```

### Regular Maintenance

```bash
# Weekly: Update system
sudo apt update && sudo apt upgrade -y

# Monthly: Update Docker images
cd WintEHR
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Monthly: Database backup
docker exec emr-postgres pg_dump -U emr_user emr_db | gzip > backup-$(date +%Y%m%d).sql.gz

# Check disk space
df -h
```

## Support

### Logs Location

- Application logs: `./logs/`
- Docker logs: `docker-compose -f docker-compose.prod.yml logs`
- System logs: `/var/log/`

### Health Checks

```bash
# Backend API
curl https://your-domain.com/api/health

# HAPI FHIR
curl https://your-domain.com/fhir/metadata

# Database
docker exec emr-postgres pg_isready -U emr_user -d emr_db
```

### Configuration Files

- Production environment: `.env.production`
- Docker Compose: `docker-compose.prod.yml`
- Nginx config: `nginx-prod-configured.conf`
- SSL certificates: `certbot/conf/live/<domain>/`

## Scaling Considerations

### Horizontal Scaling

For high-availability deployments:

1. **Database**: Use managed PostgreSQL (AWS RDS, Azure Database, etc.)
2. **Load Balancer**: Add nginx load balancer for multiple backend instances
3. **Redis**: Use managed Redis (ElastiCache, Azure Cache, etc.)
4. **File Storage**: Use object storage (S3, Azure Blob) for generated files

### Monitoring

Recommended monitoring stack:
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards
- **Loki**: Log aggregation
- **AlertManager**: Alerts

See `docs/monitoring-setup.md` for detailed setup instructions.

## License

See LICENSE file for details.

## Contributing

See CONTRIBUTING.md for development setup and guidelines.
