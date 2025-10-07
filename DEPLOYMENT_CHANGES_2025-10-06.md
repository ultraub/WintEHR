# Deployment Configuration Changes - October 6, 2025

## Summary

Fixed frontend production deployment issues related to hardcoded development URLs and FHIR endpoint path compatibility. The application now properly works in production on Azure with all API calls using HTTPS and correct paths.

## Issues Resolved

### 1. Mixed Content Errors
**Problem**: Frontend was making HTTP requests to `http://emr-backend-dev:8000` from HTTPS pages, causing browser to block the requests.

**Root Cause**: The `apiConfig.js` file detected the Azure environment as "Docker" based on non-localhost hostname, causing it to default to hardcoded development URLs.

**Solution**: Created `.env.production` with explicit Azure production URLs:
- `REACT_APP_API_URL=https://wintehr.eastus2.cloudapp.azure.com`
- `REACT_APP_CDS_HOOKS_URL=https://wintehr.eastus2.cloudapp.azure.com/api`
- `REACT_APP_WEBSOCKET_URL=wss://wintehr.eastus2.cloudapp.azure.com`

### 2. FHIR Endpoint 404 Errors
**Problem**: Frontend requests to `/fhir/R4/Patient` were returning 404 errors with "Unknown resource type 'R4'" from HAPI FHIR.

**Root Cause**:
1. The `apiConfig.js` automatically appends `/R4` to FHIR endpoints
2. HAPI FHIR doesn't use the `/R4` path segment (uses `/fhir` directly)
3. Resulted in requests to `/fhir/R4/Patient` which HAPI interpreted as resource type "R4"

**Solution**: Two-part fix:
1. Set `REACT_APP_FHIR_ENDPOINT` to include `/R4`: `https://wintehr.eastus2.cloudapp.azure.com/fhir/R4`
   - This prevents `apiConfig.js` from appending another `/R4`
2. Added nginx rewrite rule to strip `/R4` before proxying to HAPI FHIR:
   ```nginx
   rewrite ^/fhir/R4/(.*)$ /fhir/$1 last;
   ```

### 3. WebSocket Protocol Mismatch
**Problem**: WebSocket connections attempted to use `ws://` from HTTPS pages, causing browser security blocks.

**Solution**: Set `REACT_APP_WEBSOCKET_URL` to use secure WebSocket protocol: `wss://wintehr.eastus2.cloudapp.azure.com`

## Files Modified

### 1. frontend/.env.production (Created)
Production environment configuration with all required endpoints.

```bash
# Backend API - use Azure hostname
REACT_APP_API_URL=https://wintehr.eastus2.cloudapp.azure.com

# FHIR Configuration - includes /R4 to prevent apiConfig from adding it
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

### 2. nginx-prod.conf (Updated)
Added FHIR R4 rewrite rule to handle frontend's automatic `/R4` appending.

**Change**: Added after line 133 (limit_req directive):
```nginx
# Rewrite /fhir/R4/ to /fhir/ for HAPI FHIR compatibility
rewrite ^/fhir/R4/(.*)$ /fhir/$1 last;
```

**Location**: Lines 134-135 in the `/fhir/` location block

### 3. docs/AZURE_DEPLOYMENT.md (Created)
Comprehensive deployment guide documenting:
- Production environment configuration
- Nginx configuration requirements
- Fresh deployment steps
- Common issues and solutions
- Architecture notes explaining the configuration decisions

### 4. scripts/deploy-frontend-azure.sh (Created)
Automated deployment script that:
- Verifies `.env.production` exists
- Builds frontend with production configuration
- Packages and uploads to Azure VM
- Deploys to Docker volume
- Restarts containers
- Verifies deployment with automated tests

**Usage**:
```bash
./scripts/deploy-frontend-azure.sh
```

## Azure Deployment Performed

On the live Azure VM at `wintehr.eastus2.cloudapp.azure.com`:

1. ✅ Updated `/home/azureuser/WintEHR/nginx-prod.conf` with FHIR R4 rewrite rule
2. ✅ Rebuilt frontend with production environment variables
3. ✅ Deployed new frontend build to Docker volume
4. ✅ Restarted frontend and nginx containers

## Verification Results

All endpoints now working correctly:

### FHIR Endpoints
- ✅ `/fhir/R4/Patient` returns Bundle (with rewrite)
- ✅ `/fhir/Patient` returns Bundle (direct)
- ✅ No 404 errors
- ✅ No "Unknown resource type 'R4'" errors

### API Endpoints
- ✅ All requests use HTTPS
- ✅ No mixed content errors
- ✅ CDS Hooks working
- ✅ Backend API accessible

### WebSocket
- ✅ Uses `wss://` protocol
- ✅ No mixed content warnings
- ✅ Secure connection established

### Browser Console
- ✅ No mixed content errors
- ✅ No hardcoded `http://emr-backend-dev:8000` URLs
- ✅ No FHIR 404 errors
- ✅ Patient directory loads successfully

## Technical Details

### Frontend Configuration Detection Logic

The `apiConfig.js` uses runtime hostname detection:

```javascript
detectDockerEnvironment() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return !isLocalhost; // Azure hostname triggers Docker mode
}
```

When in "Docker mode" without environment variables, it defaults to:
- Backend: `http://emr-backend-dev:8000`
- WebSocket: `ws://emr-backend-dev:8000/api/ws`

**Solution**: Explicit environment variables override this detection.

### FHIR Path Handling Strategy

The `apiConfig.js` automatically manages `/R4` paths:

```javascript
buildFhirConfig() {
  const envUrl = process.env.REACT_APP_FHIR_ENDPOINT;
  if (envUrl) {
    return {
      baseUrl: envUrl,
      r4Path: envUrl.includes('/R4') ? '' : '/R4',
      fullUrl: envUrl.includes('/R4') ? envUrl : `${envUrl}/R4`
    };
  }
}
```

**Strategy**:
1. Include `/R4` in environment variable → prevents double-appending
2. Nginx rewrites `/fhir/R4/*` → `/fhir/*` for HAPI FHIR compatibility
3. Both `/fhir/R4/Patient` and `/fhir/Patient` work correctly

## Future Deployment Notes

For fresh deployments or environment changes:

1. **Always** create `.env.production` with correct hostname before building
2. **Always** include the nginx FHIR R4 rewrite rule
3. **Use** the deployment script: `./scripts/deploy-frontend-azure.sh`
4. **Verify** all three categories: FHIR, API, and WebSocket functionality

## Testing Checklist

After any deployment:
- [ ] No browser console errors
- [ ] Patient directory loads
- [ ] FHIR search works (with and without /R4)
- [ ] WebSocket connection established (check Network tab)
- [ ] CDS Hooks services accessible
- [ ] No mixed content warnings
- [ ] SSL certificate valid

## Rollback Procedure

If deployment issues occur:

1. Check container logs:
   ```bash
   docker logs emr-frontend
   docker logs emr-nginx
   ```

2. Verify nginx configuration:
   ```bash
   docker exec emr-nginx nginx -t
   docker exec emr-nginx cat /etc/nginx/nginx.conf | grep -A 5 "location /fhir/"
   ```

3. Check environment detection:
   - Open browser DevTools → Console
   - Look for `[ApiConfig] Configuration initialized:` log
   - Verify URLs are HTTPS, not HTTP

4. Re-deploy previous working build if needed

## Contact Information

**Deployment Date**: October 6, 2025
**Azure VM**: wintehr.eastus2.cloudapp.azure.com
**SSL Certificate**: Let's Encrypt (valid until January 4, 2026)

## References

- Deployment Guide: `/docs/AZURE_DEPLOYMENT.md`
- Nginx Config: `/nginx-prod.conf`
- Environment Config: `/frontend/.env.production`
- Deployment Script: `/scripts/deploy-frontend-azure.sh`
- Frontend Services Guide: `/frontend/src/services/CLAUDE.md`
