# WintEHR Quick Start Guide

Deploy WintEHR in minutes with this quick reference.

## One-Command Deployment

### Remote Server (Recommended)

```bash
./deploy-fresh-server.sh user@your-server.com ~/.ssh/your-key.pem
```

### Local Server

```bash
export DOMAIN="your-domain.com"
export EMAIL="admin@your-domain.com"
./deploy-fresh-server.sh
```

## Common Deployment Scenarios

### Azure
```bash
./deploy-fresh-server.sh azureuser@wintehr.eastus2.cloudapp.azure.com ~/.ssh/WintEHR-key.pem
```

### AWS
```bash
./deploy-fresh-server.sh ubuntu@ec2-xx-xxx-xx-xxx.compute.amazonaws.com ~/.ssh/aws-key.pem
```

### DigitalOcean
```bash
./deploy-fresh-server.sh root@your-droplet-ip ~/.ssh/do-key
```

### GCP
```bash
./deploy-fresh-server.sh username@external-ip ~/.ssh/google_compute_engine
```

## What You Get

✅ **HTTPS/SSL** - Automatic Let's Encrypt certificates
✅ **HAPI FHIR R4** - Standards-compliant FHIR server
✅ **100 Patients** - Synthetic medical data loaded
✅ **Production Ready** - Nginx, Redis, PostgreSQL, security headers
✅ **Auto-Renewal** - SSL certificates renew automatically

## Access Your System

```
Frontend:    https://your-domain.com
Backend:     https://your-domain.com/api
API Docs:    https://your-domain.com/docs
HAPI FHIR:   https://your-domain.com/fhir
```

**Login:** `demo` / `password`

## Essential Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart services
docker-compose -f docker-compose.prod.yml restart

# Check status
docker-compose -f docker-compose.prod.yml ps

# Stop all
docker-compose -f docker-compose.prod.yml down

# Backup database
docker exec emr-postgres pg_dump -U emr_user emr_db > backup.sql
```

## Configuration Options

```bash
# Custom patient count
export PATIENT_COUNT=200

# Use staging SSL (testing)
export USE_STAGING_SSL=1

# Enable AI features
export ANTHROPIC_API_KEY="your-key"

# Then deploy
./deploy-fresh-server.sh
```

## Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Domain pointing to server
- Ports 80 & 443 open
- 4GB+ RAM recommended
- 20GB+ disk space

## Deployment Time

- **Build phase**: 5-10 minutes
- **SSL setup**: 1-2 minutes
- **Patient data**: 5-10 minutes
- **Total**: ~15-20 minutes

## Troubleshooting

### SSL Certificate Failed
```bash
# Check DNS
dig your-domain.com

# Use staging for testing
export USE_STAGING_SSL=1
./deploy-fresh-server.sh
```

### Service Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs <service>

# Restart specific service
docker-compose -f docker-compose.prod.yml restart <service>
```

### Low Memory
```bash
# Check usage
docker stats

# Increase swap (temporary fix)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## Need Help?

- **Full Documentation**: See `DEPLOYMENT.md`
- **Logs**: `docker-compose -f docker-compose.prod.yml logs -f`
- **Health Check**: `curl https://your-domain.com/api/health`
- **Database**: `docker exec -it emr-postgres psql -U emr_user -d emr_db`

## Next Steps

1. **Change default password** (critical!)
2. **Enable JWT authentication** (production security)
3. **Set up backups** (database + SSL certs)
4. **Configure monitoring** (optional)
5. **Review security settings** (firewall, fail2ban)

See `DEPLOYMENT.md` for detailed information on all topics.
