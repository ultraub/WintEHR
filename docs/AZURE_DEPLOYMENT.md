# Azure Deployment Guide

This guide documents the production deployment configuration for WintEHR on Azure.

## Production Environment Configuration

### Frontend Environment Variables

The frontend requires specific production environment variables in `.env.production`:

```bash
# Production Environment Configuration for Azure Deployment

# Backend API - use Azure hostname
REACT_APP_API_URL=https://wintehr.eastus2.cloudapp.azure.com

# FHIR Configuration - includes /R4 to prevent apiConfig from adding it
# Nginx will rewrite /fhir/R4/ to /fhir/ for HAPI FHIR
REACT_APP_FHIR_ENDPOINT=https://wintehr.eastus2.cloudapp.azure.com/fhir/R4

# CDS Hooks - routed through backend
REACT_APP_CDS_HOOKS_URL=https://wintehr.eastus2.cloudapp.azure.com/api

# WebSocket - use secure WebSocket protocol
REACT_APP_WEBSOCKET_URL=wss://wintehr.eastus2.cloudapp.azure.com

# EMR Features
REACT_APP_EMR_FEATURES=true
REACT_APP_EMR_API=/api/emr
REACT_APP_CLINICAL_CANVAS_API=/api/clinical-canvas

# Features
REACT_APP_ENABLE_SEARCH=true
REACT_APP_ENABLE_HISTORY=true
REACT_APP_ENABLE_OPERATIONS=true
REACT_APP_ENABLE_BATCH=true
```

### Nginx Configuration

The production nginx configuration (`nginx-prod.conf`) includes a critical rewrite rule for FHIR R4 compatibility:

```nginx
# HAPI FHIR Server
location /fhir/ {
    limit_req zone=api_limit burst=30 nodelay;
    # Rewrite /fhir/R4/ to /fhir/ for HAPI FHIR compatibility
    rewrite ^/fhir/R4/(.*)$ /fhir/$1 last;

    proxy_pass http://hapi_fhir/fhir/;
    # ... rest of config
}
```

**Why this is needed**: The frontend's `apiConfig.js` automatically appends `/R4` to FHIR endpoints unless the endpoint already contains `/R4`. HAPI FHIR doesn't use the `/R4` path segment, so we include it in the environment variable to prevent double-appending, and nginx rewrites it away before proxying to HAPI FHIR.

## Fresh Deployment Steps

### 1. Build Frontend with Production Configuration

```bash
cd frontend
npm install --legacy-peer-deps
npm run build
```

### 2. Package and Upload Build

```bash
cd build
tar czf ../frontend-build.tar.gz .
cd ..
scp -i ~/.ssh/WintEHR-key.pem frontend-build.tar.gz azureuser@wintehr.eastus2.cloudapp.azure.com:~
```

### 3. Deploy on Azure VM

```bash
# SSH to Azure VM
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com

# Extract and deploy frontend build
rm -rf /tmp/frontend-build
mkdir -p /tmp/frontend-build
tar xzf ~/frontend-build.tar.gz -C /tmp/frontend-build/
docker run --rm -v wintehr_frontend_build:/data -v /tmp/frontend-build:/source alpine sh -c "rm -rf /data/* && cp -r /source/* /data/"

# Restart containers
docker restart emr-frontend emr-nginx
```

### 4. Verify Deployment

```bash
# Check FHIR endpoint (should work with /R4 path)
curl -s 'https://wintehr.eastus2.cloudapp.azure.com/fhir/R4/Patient?_count=1' | jq '.resourceType'
# Expected: "Bundle"

# Check FHIR endpoint (should work without /R4 path)
curl -s 'https://wintehr.eastus2.cloudapp.azure.com/fhir/Patient?_count=1' | jq '.resourceType'
# Expected: "Bundle"

# Check application accessibility
curl -s https://wintehr.eastus2.cloudapp.azure.com/ | grep -o "WintEHR"
# Expected: "WintEHR"
```

## SSL Certificate Management

SSL certificates are managed by Let's Encrypt via Certbot:

### Check Certificate Status
```bash
docker exec emr-certbot certbot certificates
```

### Renew Certificate (if needed)
```bash
docker exec emr-certbot certbot renew
docker exec emr-nginx nginx -s reload
```

## Common Issues and Solutions

### Issue: Mixed Content Errors

**Symptom**: Browser console shows errors about HTTP requests from HTTPS pages
```
Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure XMLHttpRequest endpoint 'http://...'
```

**Solution**:
1. Verify `.env.production` uses HTTPS URLs for all endpoints
2. Rebuild frontend with production environment
3. Redeploy to Azure

### Issue: FHIR 404 Errors on /R4 Paths

**Symptom**: Requests to `/fhir/R4/Patient` return 404
```
HAPI-0302: Unknown resource type 'R4'
```

**Solution**:
1. Verify nginx-prod.conf has the rewrite rule for /fhir/R4/
2. Update nginx config on Azure VM
3. Restart nginx container

### Issue: WebSocket Connection Failures

**Symptom**: WebSocket connections fail with mixed content errors
```
attempted to connect to the insecure WebSocket endpoint 'ws://...'
```

**Solution**:
1. Verify `REACT_APP_WEBSOCKET_URL` uses `wss://` protocol
2. Rebuild and redeploy frontend

## Architecture Notes

### Frontend Configuration Detection

The frontend's `apiConfig.js` uses hostname-based Docker detection:
- Non-localhost hostnames are detected as "Docker" environment
- In Docker mode, it defaults to `http://emr-backend-dev:8000`
- **This is why explicit production environment variables are critical**

### FHIR Endpoint Path Handling

The `apiConfig.js` automatically appends `/R4` to FHIR endpoints:
```javascript
// From apiConfig.js
buildFhirConfig() {
  const envUrl = process.env.REACT_APP_FHIR_ENDPOINT;
  if (envUrl) {
    return {
      baseUrl: envUrl,
      r4Path: envUrl.includes('/R4') ? '' : '/R4',
      fullUrl: envUrl.includes('/R4') ? envUrl : `${envUrl}/R4`
    };
  }
  // ...
}
```

Strategy:
1. Include `/R4` in `REACT_APP_FHIR_ENDPOINT` environment variable
2. This prevents apiConfig from appending another `/R4`
3. Nginx rewrites `/fhir/R4/` → `/fhir/` for HAPI FHIR compatibility

## Files Modified for Production

1. **frontend/.env.production** - Production environment configuration
2. **nginx-prod.conf** - Nginx configuration with FHIR R4 rewrite rule
3. **docs/AZURE_DEPLOYMENT.md** - This deployment guide

## Deployment Checklist

- [ ] Update `.env.production` with correct Azure hostname
- [ ] Verify nginx-prod.conf has FHIR R4 rewrite rule
- [ ] Build frontend with production configuration
- [ ] Package and upload build to Azure
- [ ] Deploy build to frontend volume
- [ ] Restart frontend and nginx containers
- [ ] Verify FHIR endpoints work with both /R4 and without
- [ ] Verify no mixed content errors in browser console
- [ ] Verify WebSocket connections use wss://
- [ ] Verify SSL certificate is valid

## Contact and Support

For deployment issues:
1. Check container logs: `docker logs emr-frontend`, `docker logs emr-nginx`
2. Check nginx config: `docker exec emr-nginx nginx -t`
3. Verify environment: Browser DevTools → Console → Check for errors
