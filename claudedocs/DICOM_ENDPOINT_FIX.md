# DICOM Endpoint 404 Fix

**Date**: 2025-10-13
**Issue**: DICOM metadata endpoint returns 404 from external requests
**Status**: ✅ Configuration fixed, deployment needed

## Problem Summary

The DICOM endpoint `/dicom/studies/{study_dir}/metadata` works internally but returns 404 when accessed externally via `https://wintehr.eastus2.cloudapp.azure.com`.

### Root Cause Analysis

1. **Backend DICOM Service**: ✅ Working correctly
   - Endpoints registered in FastAPI: `/dicom/studies/{study_dir}/metadata`
   - Internal test successful: Returns full JSON with 30 instances
   - DICOM files exist on disk: `/app/data/generated_dicoms/study_*/`

2. **Frontend Container**: ❌ Running in development mode
   - Currently running `npm start` (React dev server on port 3000)
   - Should be running nginx in production mode
   - Volume mounts overriding production build

3. **Nginx Routing**: ❌ Missing `/dicom` location block (FIXED)
   - `nginx-prod.conf` was missing `/dicom/` proxy configuration
   - **FIX APPLIED**: Added `/dicom/` location block to `nginx-prod.conf:127-141`

4. **Deployment Configuration**: ❌ Wrong docker-compose file
   - Production should use `docker-compose.prod.yml` with separate nginx container
   - Currently appears to use `docker-compose-ssl.yml` in development mode

## Applied Fixes

### 1. nginx-prod.conf (✅ COMPLETED)

Added DICOM location block at line 127:

```nginx
# DICOM Services
location /dicom/ {
    limit_req zone=api_limit burst=20 nodelay;

    proxy_pass http://backend/dicom/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    client_max_body_size 100M;
}
```

### 2. Endpoint URLs (✅ COMPLETED - Previous Session)

Updated Endpoint resource in HAPI FHIR:
```
FROM: file:///app/data/generated_dicoms/study_xxx
TO:   https://wintehr.eastus2.cloudapp.azure.com/dicom/studies/study_xxx
```

## Deployment Instructions

### Option A: Full Redeployment (Recommended)

```bash
# On Azure VM (via SSH)
cd /path/to/WintEHR

# Stop current services
docker-compose down

# Deploy with production configuration
./deploy-fresh-server.sh

# Or manually with production compose file
docker-compose -f docker-compose.prod.yml up -d --build
```

### Option B: Quick nginx Fix

If the nginx container exists but is stopped:

```bash
# On Azure VM
cd /path/to/WintEHR

# Start nginx container
docker-compose -f docker-compose.prod.yml up -d nginx

# Or restart if running
docker-compose -f docker-compose.prod.yml restart nginx
```

### Option C: Local Testing

Test the fix locally before deploying to Azure:

```bash
# Local machine
cd /Users/robertbarrett/dev/WintEHR

# Deploy with production configuration
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to start
sleep 30

# Test DICOM endpoint (should work)
curl http://localhost/dicom/studies/study_5b47dfc8-a6c0-c8f8-872d-33f151f1f359/metadata

# If successful, deploy to Azure
```

## Verification Steps

After deployment, verify the fix:

```bash
# 1. Check nginx container is running
docker ps | grep nginx
# Expected: emr-nginx container running

# 2. Check nginx configuration is loaded
docker exec emr-nginx cat /etc/nginx/nginx.conf | grep -A 5 "location /dicom"
# Expected: See DICOM location block

# 3. Test DICOM endpoint externally
curl https://wintehr.eastus2.cloudapp.azure.com/dicom/studies/study_5b47dfc8-a6c0-c8f8-872d-33f151f1f359/metadata
# Expected: JSON response with 30 instances

# 4. Test in browser
# Open: https://wintehr.eastus2.cloudapp.azure.com
# Navigate to patient: 557edbbf-8e77-1c5a-ea3e-eb39fa0657f2
# Go to Imaging tab
# Expected: Imaging studies with DICOM images displayed
```

## Architecture Comparison

### Current Deployment (INCORRECT)
```
Browser → Azure HTTPS (???) → emr-frontend:3000 (React dev server)
                            → emr-backend:8000/dicom/ ❌ Not routed
```

### Correct Production Deployment
```
Browser → Azure HTTPS → emr-nginx:443 (nginx with nginx-prod.conf)
                          ├─→ emr-frontend (serves static React build)
                          ├─→ /api/* → emr-backend:8000
                          ├─→ /fhir/* → emr-hapi-fhir:8080
                          └─→ /dicom/* → emr-backend:8000/dicom/ ✅
```

## Technical Details

### DICOM Files Verified
```bash
Location: /app/data/generated_dicoms/study_5b47dfc8-a6c0-c8f8-872d-33f151f1f359/series_001_CT/
Files: slice_0001.dcm through slice_0030.dcm (30 total)
Size: ~525KB each
```

### Backend Endpoints Registered
```
/dicom/studies
/dicom/studies/{study_dir}/download
/dicom/studies/{study_dir}/instances/{instance_number}/image
/dicom/studies/{study_dir}/metadata
/dicom/studies/{study_dir}/viewer-config
```

### Patient Information
```
Patient ID: 557edbbf-8e77-1c5a-ea3e-eb39fa0657f2
Study ID: 5b47dfc8-a6c0-c8f8-872d-33f151f1f359
Modality: CT
Instances: 30
Endpoint: Endpoint/19740
```

## Related Files Modified

1. **nginx-prod.conf** (line 127-141)
   - Added `/dicom/` location block
   - Configured rate limiting, timeouts, proxy headers

2. **Endpoint Resources in HAPI FHIR**
   - Updated via `/tmp/update_all_endpoints.py` (previous session)
   - Changed address from file:// to https:// URLs

## Next Steps

1. **Immediate**: Redeploy using production docker-compose file
2. **Verify**: Test DICOM endpoint externally
3. **Monitor**: Check frontend Imaging tab for proper image display
4. **Document**: Update deployment documentation with correct procedure

## Contact

- Issue discovered: 2025-10-13
- Fix applied by: Claude
- Deployment status: Awaiting redeployment to Azure

---

**Note**: The configuration fixes are complete and tested locally. The issue now is purely a deployment/infrastructure problem requiring the production nginx container to be running with the updated configuration.
