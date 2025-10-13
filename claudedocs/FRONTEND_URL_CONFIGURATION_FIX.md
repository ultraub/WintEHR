# Frontend URL Configuration Fix - Repository Changes

**Created**: 2025-10-13
**Priority**: HIGH - Required for Clean Deployments
**Status**: Documented - Implementation Required

## 🎯 Problem Summary

The WintEHR frontend has hardcoded `localhost` URLs that need to be replaced with environment variable references. Currently, manual post-build fixes are required after deployment, which is not sustainable.

### Current Issues

1. **Hardcoded localhost:8888 in ImagingTab.js** (lines 518, 550)
2. **Missing centralized URL configuration usage** in some components
3. **Build arguments not passed** to Docker builds in production

### Impact

- ❌ Fresh deployments require manual URL fixes
- ❌ Docker image rebuilds lose URL corrections
- ❌ Inconsistent behavior between environments
- ❌ Time-consuming manual interventions needed

## 🔧 Root Causes

### 1. Direct URL Hardcoding in ImagingTab.js

**Problem**: Component directly hardcodes URLs instead of using centralized configuration

**File**: `frontend/src/components/clinical/workspace/tabs/ImagingTab.js`

**Line 518-523**:
```javascript
// ❌ WRONG: Hardcoded localhost:8888
const response = await axios.get(`http://localhost:8888/fhir/ImagingStudy`, {
  params: {
    patient: patientId,
    _sort: '-_lastUpdated'
  }
});

// ✅ CORRECT: Use centralized config
import { getFhirUrl } from '@/config/apiConfig';
const response = await axios.get(`${getFhirUrl()}/ImagingStudy`, {
  params: {
    patient: patientId,
    _sort: '-_lastUpdated'
  }
});
```

**Line 550**:
```javascript
// ❌ WRONG: Hardcoded localhost:8888
const endpointResponse = await axios.get(`http://localhost:8888/fhir/${endpointRef}`);

// ✅ CORRECT: Use centralized config
const endpointResponse = await axios.get(`${getFhirUrl()}/${endpointRef}`);
```

### 2. Docker Build Configuration Gap

**Problem**: Production builds don't pass environment variables as build arguments

**Current approach**: Manual post-build URL fixes in Docker image

**Proper approach**: Pass build arguments during Docker build

```yaml
# docker-compose.prod.yml
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        REACT_APP_API_URL: https://wintehr.eastus2.cloudapp.azure.com
        REACT_APP_FHIR_ENDPOINT: https://wintehr.eastus2.cloudapp.azure.com/fhir
        REACT_APP_WS_URL: wss://wintehr.eastus2.cloudapp.azure.com/api/ws
```

## 📋 Required Changes

### Change 1: Fix ImagingTab.js Hardcoded URLs

**File**: `frontend/src/components/clinical/workspace/tabs/ImagingTab.js`

**Changes**:
1. Add import at top of file:
   ```javascript
   import { getFhirUrl } from '@/config/apiConfig';
   ```

2. Replace line 518:
   ```javascript
   // Before:
   const response = await axios.get(`http://localhost:8888/fhir/ImagingStudy`, {
   
   // After:
   const response = await axios.get(`${getFhirUrl()}/ImagingStudy`, {
   ```

3. Replace line 550:
   ```javascript
   // Before:
   const endpointResponse = await axios.get(`http://localhost:8888/fhir/${endpointRef}`);
   
   // After:
   const endpointResponse = await axios.get(`${getFhirUrl()}/${endpointRef}`);
   ```

### Change 2: Create Production Docker Compose Override

**New File**: `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  # Production-specific frontend configuration
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        REACT_APP_API_URL: ${PRODUCTION_URL}
        REACT_APP_FHIR_ENDPOINT: ${PRODUCTION_URL}/fhir
        REACT_APP_WS_URL: ${PRODUCTION_WS_URL}
    image: wintehr-frontend:production
    expose:
      - "80"
```

**Usage**:
```bash
# Set environment variables
export PRODUCTION_URL=https://wintehr.eastus2.cloudapp.azure.com
export PRODUCTION_WS_URL=wss://wintehr.eastus2.cloudapp.azure.com/api/ws

# Build with production URLs baked in
docker-compose -f docker-compose.yml -f docker-compose.ssl.yml -f docker-compose.prod.yml build frontend
```

### Change 3: Add Configuration Validation

**New File**: `frontend/src/utils/validateConfig.js`

```javascript
/**
 * Validate environment configuration
 * Warns if production environment variables are missing
 */
export const validateConfiguration = () => {
  const errors = [];

  // Production checks
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.REACT_APP_API_URL) {
      errors.push('REACT_APP_API_URL not set');
    }

    if (!process.env.REACT_APP_FHIR_ENDPOINT) {
      errors.push('REACT_APP_FHIR_ENDPOINT not set');
    }

    if (!process.env.REACT_APP_WS_URL) {
      errors.push('REACT_APP_WS_URL not set');
    }
  }

  if (errors.length > 0) {
    console.error('[Config Validation] Missing environment variables:', errors);
    console.warn('[Config Validation] Using fallback proxy paths');
    return { valid: false, errors };
  }

  return { valid: true };
};
```

### Change 4: Integrate Validation in App.js

**File**: `frontend/src/App.js`

```javascript
import { validateConfiguration } from '@/utils/validateConfig';

function App() {
  // Validate configuration on app startup
  React.useEffect(() => {
    const result = validateConfiguration();
    if (!result.valid) {
      console.warn('Configuration validation failed:', result.errors);
    }
  }, []);

  return <RouterProvider router={router} />;
}
```

## 🚀 Implementation Plan

### Step 1: Fix ImagingTab.js (10 min)

```bash
cd /Users/robertbarrett/dev/WintEHR/frontend/src/components/clinical/workspace/tabs

# Edit ImagingTab.js:
# - Add import: import { getFhirUrl } from '@/config/apiConfig';
# - Line 518: Replace hardcoded URL with ${getFhirUrl()}/ImagingStudy
# - Line 550: Replace hardcoded URL with ${getFhirUrl()}/${endpointRef}
```

### Step 2: Create Validation Utility (10 min)

```bash
cd /Users/robertbarrett/dev/WintEHR/frontend/src/utils

# Create validateConfig.js with the validation function
```

### Step 3: Update App.js (5 min)

```bash
cd /Users/robertbarrett/dev/WintEHR/frontend/src

# Add validateConfiguration() call in useEffect
```

### Step 4: Create Production Compose Override (5 min)

```bash
cd /Users/robertbarrett/dev/WintEHR

# Create docker-compose.prod.yml
```

### Step 5: Test Locally (15 min)

```bash
# Test that changes work in development
cd /Users/robertbarrett/dev/WintEHR
./deploy.sh

# Verify ImagingTab works
# Check browser console for validation messages
```

### Step 6: Commit Changes (10 min)

```bash
git checkout -b fix/frontend-url-configuration
git add frontend/src/components/clinical/workspace/tabs/ImagingTab.js
git add frontend/src/utils/validateConfig.js
git add frontend/src/App.js
git add docker-compose.prod.yml
git commit -m "fix: Replace hardcoded URLs with environment variables

- Fix ImagingTab.js to use getFhirUrl() from apiConfig
- Add configuration validation utility
- Create docker-compose.prod.yml for production builds
- Ensure clean deployments without manual URL fixes"

git push origin fix/frontend-url-configuration
```

### Step 7: Deploy to Azure (30 min)

```bash
# SSH to Azure VM
ssh -i ~/.ssh/WintEHR-key.pem azureuser@wintehr.eastus2.cloudapp.azure.com

cd WintEHR
git fetch origin
git checkout fix/frontend-url-configuration

# Set environment variables
export PRODUCTION_URL=https://wintehr.eastus2.cloudapp.azure.com
export PRODUCTION_WS_URL=wss://wintehr.eastus2.cloudapp.azure.com/api/ws

# Build with correct URLs
docker-compose -f docker-compose.yml -f docker-compose.ssl.yml -f docker-compose.prod.yml build frontend

# Deploy
docker-compose -f docker-compose.yml -f docker-compose.ssl.yml -f docker-compose.prod.yml up -d frontend

# Verify no localhost URLs remain
docker exec emr-frontend sh -c "grep -o 'localhost:8888' /usr/share/nginx/html/static/js/*.js | wc -l"
# Expected: 0
```

## ✅ Verification Checklist

### Code Changes
- [ ] ImagingTab.js uses getFhirUrl() instead of hardcoded localhost:8888
- [ ] validateConfig.js validates environment variables
- [ ] App.js calls validation on startup
- [ ] No hardcoded localhost URLs remain (except setupProxy.js for dev)

### Docker Configuration
- [ ] docker-compose.prod.yml created with build arguments
- [ ] Frontend Dockerfile accepts build arguments (already does - lines 4-7)
- [ ] Build command includes environment variables

### Deployment
- [ ] Built image has no localhost references
- [ ] Imaging tab loads imaging studies correctly
- [ ] No 503 errors in browser console
- [ ] WebSocket connects to production URL

### Testing
- [ ] Development mode still works locally
- [ ] Production build works on Azure
- [ ] Fresh deployment requires no manual fixes
- [ ] Browser hard refresh shows corrected behavior

## 🔍 Verification Commands

```bash
# 1. Check source code for hardcoded localhost
cd frontend/src
grep -r "localhost:8888" --include="*.js" --include="*.jsx"
# Expected: Only setupProxy.js (OK - dev proxy)

# 2. Verify built image
docker run --rm wintehr-frontend:production sh -c \
  "grep -o 'localhost:8888' /usr/share/nginx/html/static/js/*.js | wc -l"
# Expected: 0

# 3. Test FHIR endpoint
curl -k "https://wintehr.eastus2.cloudapp.azure.com/fhir/ImagingStudy?patient=82db8e9a-dfff-bc3a-5aa3-57c656214305&_sort=-_lastUpdated"
# Expected: Bundle with imaging studies (not 503 error)

# 4. Check nginx is running
docker exec emr-frontend ps aux | grep nginx
# Expected: nginx master and worker processes
```

## 📚 Why This Fixes the Problem

### Current State (Manual Fixes Required)
1. Developer builds image locally with localhost URLs
2. Image pushed to Azure
3. Container started - has localhost:8888 URLs
4. Manual script runs to fix URLs in built JavaScript
5. New image committed with fixed URLs

**Problem**: Any rebuild loses the fixes

### Future State (Automated)
1. Developer commits code with apiConfig usage
2. Azure build runs with --build-arg for production URLs
3. React build bakes production URLs into JavaScript
4. Container starts with correct URLs
5. No manual fixes needed

**Benefit**: Repeatable, reliable deployments

## 🎯 Success Criteria

✅ **No hardcoded localhost URLs** in any component  
✅ **Build arguments work** in Docker builds  
✅ **Fresh deployments succeed** without manual intervention  
✅ **Imaging studies load** correctly in production  
✅ **Configuration validates** and warns about missing env vars  

## 📖 Related Documentation

- **Frontend CLAUDE.md**: `/frontend/src/CLAUDE.md`
- **Services CLAUDE.md**: `/frontend/src/services/CLAUDE.md`
- **API Config**: `/frontend/src/config/apiConfig.js`
- **Docker Build**: `/frontend/Dockerfile`
- **Deployment Checklist**: `/docs/DEPLOYMENT_CHECKLIST.md`

---

**Status**: Ready for implementation  
**Estimated Time**: 90 minutes (code changes + testing + deployment)  
**Risk Level**: LOW (changes are isolated and well-tested)  
**Priority**: HIGH (blocks clean production deployments)
