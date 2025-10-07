# WintEHR Deployment Quick Reference

## 🚀 One-Command Deployments

### Full System Deployment
```bash
./scripts/deploy-full-system-azure.sh
```
**When to use**: First deployment, major updates, complete system refresh
**Duration**: ~5-10 minutes
**What it does**: Deploys entire stack (Frontend, Backend, HAPI FHIR, Nginx, PostgreSQL, Redis)

### Frontend-Only Update
```bash
./scripts/deploy-frontend-azure.sh
```
**When to use**: UI changes, frontend bug fixes, style updates
**Duration**: ~2-3 minutes
**What it does**: Rebuilds and deploys React frontend only

## 📋 Quick Checks

### Verify Deployment Health
```bash
# FHIR endpoint
curl https://wintehr.eastus2.cloudapp.azure.com/fhir/metadata | jq .resourceType

# Application accessible
curl https://wintehr.eastus2.cloudapp.azure.com/ | grep WintEHR

# Patient data loaded
curl https://wintehr.eastus2.cloudapp.azure.com/fhir/Patient?_count=1 | jq .total
```

### Check Service Status on Azure
```bash
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com \
  "cd ~/WintEHR && docker-compose -f docker-compose.prod.yml ps"
```

## 🔧 Common Operations

### Restart Services
```bash
# All services
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com \
  "cd ~/WintEHR && docker-compose -f docker-compose.prod.yml restart"

# Single service (backend example)
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com \
  "cd ~/WintEHR && docker-compose -f docker-compose.prod.yml restart backend"
```

### View Logs
```bash
# All services (tail last 100 lines, follow)
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com \
  "cd ~/WintEHR && docker-compose -f docker-compose.prod.yml logs -f --tail=100"

# Specific service
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com \
  "cd ~/WintEHR && docker-compose -f docker-compose.prod.yml logs -f --tail=100 backend"
```

## 🔑 Key Files Locations

### Local Repository
```
WintEHR/
├── scripts/
│   ├── deploy-full-system-azure.sh     # Complete system deployment
│   └── deploy-frontend-azure.sh        # Frontend-only deployment
├── frontend/.env.production            # Frontend production config
├── nginx-prod.conf                     # Nginx config (with FHIR R4 rewrite)
├── docker-compose.prod.yml             # Production docker-compose
├── DEPLOYMENT_README.md                # Complete deployment guide
└── DEPLOYMENT_QUICK_REFERENCE.md       # This file
```

### Azure VM
```
~/WintEHR/
├── docker-compose.prod.yml             # Production docker-compose
├── nginx-prod.conf                     # Nginx configuration
├── backend/                            # Backend source code
├── data/                               # Application data
└── logs/                               # Application logs
```

## 🐛 Quick Troubleshooting

### Issue: Mixed Content Errors
**Fix**: Verify `frontend/.env.production` uses HTTPS URLs, then redeploy frontend

### Issue: FHIR 404 on /R4 paths
**Fix**: Verify nginx-prod.conf has rewrite rule, restart nginx

### Issue: WebSocket failures
**Fix**: Verify `REACT_APP_WEBSOCKET_URL` uses `wss://`, redeploy frontend

### Issue: Service won't start
**Fix**: Check logs → `docker-compose logs [service]` → fix issue → restart

## 📊 Environment Variables

### Required in frontend/.env.production
```bash
REACT_APP_API_URL=https://wintehr.eastus2.cloudapp.azure.com
REACT_APP_FHIR_ENDPOINT=https://wintehr.eastus2.cloudapp.azure.com/fhir/R4
REACT_APP_CDS_HOOKS_URL=https://wintehr.eastus2.cloudapp.azure.com/api
REACT_APP_WEBSOCKET_URL=wss://wintehr.eastus2.cloudapp.azure.com
```

### Optional Deployment Script Variables
```bash
export AZURE_HOST=wintehr.eastus2.cloudapp.azure.com
export AZURE_USER=azureuser
export SSH_KEY=~/.ssh/WintEHR-key.pem
```

## ⏱️ Deployment Timelines

| Operation | Duration | Notes |
|-----------|----------|-------|
| Full system deploy | 5-10 min | HAPI FHIR takes 2-3 min to initialize |
| Frontend update | 2-3 min | Just frontend build and deploy |
| Backend update | 3-5 min | Includes rebuild and restart |
| Nginx config update | < 1 min | Just config copy and restart |
| SSL certificate renewal | 1-2 min | Automatic via certbot |

## 🔐 Security Checklist

Before deployment:
- [ ] SSH key permissions: `chmod 600 ~/.ssh/WintEHR-key.pem`
- [ ] `.env.production` not in git
- [ ] All URLs use HTTPS in production config
- [ ] Database password changed from default
- [ ] JWT secret set in production

## 📞 Quick Help

**Full Documentation**: See [DEPLOYMENT_README.md](DEPLOYMENT_README.md)
**Azure Details**: See [docs/AZURE_DEPLOYMENT.md](docs/AZURE_DEPLOYMENT.md)
**Recent Changes**: See [DEPLOYMENT_CHANGES_2025-10-06.md](DEPLOYMENT_CHANGES_2025-10-06.md)

---
**Last Updated**: 2025-10-06
