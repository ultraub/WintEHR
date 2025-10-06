# WintEHR Deployment Files Overview

This document describes all deployment-related files and their purposes.

## Quick Reference

| File | Purpose | Usage |
|------|---------|-------|
| `deploy-fresh-server.sh` | Master deployment script | **Primary deployment tool** |
| `QUICKSTART.md` | Quick reference guide | Fast deployment lookup |
| `DEPLOYMENT.md` | Complete deployment guide | Full documentation |
| `.deployment-checklist` | Deployment checklist | Quality assurance |
| `docker-compose.prod.yml` | Production Docker config | Service definitions |
| `nginx-prod.conf` | Production nginx config | Reverse proxy & SSL |
| `production-deploy.sh` | Legacy production script | Alternative method |

## File Descriptions

### deploy-fresh-server.sh
**The main deployment script - use this for all fresh deployments**

- Handles both remote and local deployments
- Installs Docker, configures firewall, sets up SSL
- Deploys all services with HAPI FHIR
- Loads patient data automatically
- One command to complete deployment

**Usage:**
```bash
# Remote deployment
./deploy-fresh-server.sh user@server.com ~/.ssh/key.pem

# Local deployment
export DOMAIN="your-domain.com"
./deploy-fresh-server.sh
```

### QUICKSTART.md
Quick reference card for common deployment scenarios

- One-page quick start
- Common cloud provider examples
- Essential commands
- Troubleshooting tips

### DEPLOYMENT.md
Comprehensive deployment documentation

- Detailed deployment options
- Cloud provider setup guides
- Post-deployment configuration
- Security hardening
- Troubleshooting guide
- Scaling recommendations

### .deployment-checklist
Quality assurance checklist for deployments

- Pre-deployment requirements
- Deployment verification steps
- Post-deployment security
- Production readiness checks
- Maintenance schedule

### docker-compose.prod.yml
Production Docker Compose configuration

- All services (PostgreSQL, HAPI FHIR, Backend, Frontend, Nginx, Redis, Certbot)
- Production environment variables
- Health checks and restart policies
- Volume management
- Network configuration

### nginx-prod.conf
Production nginx configuration

- SSL/TLS configuration
- Reverse proxy setup
- Security headers
- Rate limiting
- CORS configuration
- Static file caching

### production-deploy.sh
Alternative production deployment script

- Direct server deployment
- SSL certificate automation
- Patient data loading
- Service health checks

## Deployment Workflow

```
┌─────────────────────────────────────────────────┐
│  1. Choose Deployment Method                    │
│     • Remote: deploy-fresh-server.sh + SSH     │
│     • Local: deploy-fresh-server.sh directly   │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  2. Script Handles Everything                   │
│     • System dependencies                       │
│     • Docker installation                       │
│     • Firewall configuration                    │
│     • SSL certificate setup                     │
│     • Service deployment                        │
│     • Patient data loading                      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  3. Access Your System                          │
│     • https://your-domain.com                   │
│     • Login: demo/password                      │
│     • 100 patients with complete records        │
└─────────────────────────────────────────────────┘
```

## Recommended Deployment Path

### For First-Time Deployment

1. **Read:** `QUICKSTART.md` (2 minutes)
2. **Prepare:** Review `.deployment-checklist` pre-deployment section
3. **Deploy:** Run `deploy-fresh-server.sh`
4. **Verify:** Use checklist verification steps
5. **Secure:** Follow post-deployment security steps

### For Production Deployment

1. **Read:** `DEPLOYMENT.md` completely
2. **Plan:** Complete `.deployment-checklist` planning
3. **Test:** Deploy to staging with `USE_STAGING_SSL=1`
4. **Deploy:** Production deployment
5. **Harden:** Security hardening steps
6. **Monitor:** Set up monitoring and alerts

### For Updates/Maintenance

1. **Backup:** Database and SSL certificates
2. **Update:** Pull latest changes
3. **Rebuild:** `docker-compose -f docker-compose.prod.yml up -d --build`
4. **Verify:** Health checks and smoke tests

## Environment Variables

### Required
- `DOMAIN` - Your domain name
- `EMAIL` - Email for SSL certificate alerts

### Optional
- `PATIENT_COUNT` - Number of patients to generate (default: 100)
- `USE_STAGING_SSL` - Use Let's Encrypt staging (default: 0)
- `ANTHROPIC_API_KEY` - Enable AI features

### Generated Automatically
- `POSTGRES_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing key

All credentials saved to `.env.production` (keep secure!)

## Security Notes

### Files to Protect
- `.env.production` - Contains all credentials
- `certbot/conf/` - SSL certificates and keys
- Database backups

### Post-Deployment Security
1. Change default credentials immediately
2. Enable JWT authentication for production
3. Set up fail2ban for SSH protection
4. Regular security updates
5. Monitor access logs

## Troubleshooting Quick Reference

### Deployment Issues
```bash
# Check what's running
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f [service]

# Restart service
docker-compose -f docker-compose.prod.yml restart [service]
```

### SSL Issues
```bash
# Check certificates
docker-compose -f docker-compose.prod.yml run --rm certbot certificates

# Manual renewal
docker-compose -f docker-compose.prod.yml run --rm certbot renew
```

### Database Issues
```bash
# Check connection
docker exec emr-postgres pg_isready -U emr_user -d emr_db

# Access database
docker exec -it emr-postgres psql -U emr_user -d emr_db
```

## Support Resources

- **Quick Start:** `QUICKSTART.md`
- **Full Docs:** `DEPLOYMENT.md`
- **Checklist:** `.deployment-checklist`
- **Main README:** `README.md`
- **License:** `LICENSE`
- **Contributing:** `CONTRIBUTING.md`

## Version History

- **v1.0.0** - Initial release with complete deployment automation
  - Fresh server deployment script
  - HTTPS/SSL automation
  - HAPI FHIR integration
  - Production-ready configuration
  - Comprehensive documentation

---

**Quick Deploy Command:**
```bash
./deploy-fresh-server.sh user@server.com ~/.ssh/key.pem
```

**Time to Deploy:** ~15-20 minutes

**Result:** Production-ready FHIR EMR with HTTPS
