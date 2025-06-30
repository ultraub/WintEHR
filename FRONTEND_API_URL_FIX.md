# Frontend API URL Configuration Guide

## Overview

One of the most common deployment issues with the EMR system is the frontend attempting to connect to `http://localhost:8000` instead of using relative URLs to reach the backend through the nginx proxy. This guide explains the issue and provides multiple solutions.

## The Problem

By default, the frontend's `api.js` file contains:
```javascript
const API_BASE_URL = process.env.REACT_APP_API_URL === undefined ? 'http://localhost:8000' : process.env.REACT_APP_API_URL;
```

This causes the frontend to try connecting to localhost:8000 when `REACT_APP_API_URL` is not set, which fails in production deployments where the frontend runs in the user's browser.

## Solutions

### Solution 1: Fix During Build (Recommended)

Set `REACT_APP_API_URL` to an empty string during the build process:

```bash
cd frontend
REACT_APP_API_URL="" npm run build
```

This makes the frontend use relative URLs (e.g., `/api/health` instead of `http://localhost:8000/api/health`).

### Solution 2: Update Source Code

Modify `frontend/src/services/api.js`:

```javascript
// Change from:
const API_BASE_URL = process.env.REACT_APP_API_URL === undefined ? 'http://localhost:8000' : process.env.REACT_APP_API_URL;

// To:
const API_BASE_URL = process.env.REACT_APP_API_URL || '';
```

Then rebuild the frontend.

### Solution 3: Fix Existing Deployments

For already deployed systems, use the provided fix script:

```bash
./fix-frontend-api-url.sh
```

Or manually fix in Docker:

```bash
# Find the container
docker ps | grep frontend

# Fix the built files
docker exec emr-frontend sh -c 'find /usr/share/nginx/html/static/js -name "*.js" -exec sed -i "s|http://localhost:8000||g" {} \;'

# Reload nginx
docker exec emr-frontend nginx -s reload
```

### Solution 4: Use Updated Deployment Scripts

The updated deployment scripts and Dockerfiles now handle this automatically:

- `aws-deploy.sh` - Updates api.js before building
- `Dockerfile` - Sets `ENV REACT_APP_API_URL=""`
- `Dockerfile.standalone` - Includes api.js fix
- `Dockerfile.standalone.fixed` - Includes api.js fix
- `frontend/Dockerfile` - Includes api.js fix

## Environment Variable Guide

### Development
```bash
# When frontend and backend run on different ports
REACT_APP_API_URL=http://localhost:8000
```

### Production (Same Domain)
```bash
# Use relative URLs when behind nginx proxy
REACT_APP_API_URL=""
```

### Production (Different Domains)
```bash
# When API is on a different domain
REACT_APP_API_URL=https://api.yourdomain.com
```

## Docker Compose Configuration

### Development
```yaml
frontend:
  environment:
    - REACT_APP_API_URL=http://localhost:8000
```

### Production
```yaml
frontend:
  environment:
    - REACT_APP_API_URL=  # Empty for relative URLs
```

## Nginx Configuration

Ensure your nginx configuration properly proxies API requests:

```nginx
location /api/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /fhir/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
}

location /cds-hooks/ {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
}
```

## Verification

After applying the fix, verify it's working:

1. Open browser developer tools (F12)
2. Go to Network tab
3. Refresh the page
4. Check that API calls go to `/api/...` not `http://localhost:8000/api/...`

## Common Symptoms

If you see these issues, you likely have the API URL problem:

- "Network Error" or "ERR_CONNECTION_REFUSED" in browser console
- API calls to `http://localhost:8000` in Network tab
- Frontend loads but shows no data
- Login fails with connection errors

## Prevention

To prevent this issue in future deployments:

1. Always use the updated Dockerfiles
2. Set `REACT_APP_API_URL=""` in production builds
3. Test the deployment from a different machine
4. Use the provided deployment scripts which handle this automatically

## Additional Notes

- Clear browser cache after applying fixes
- Some browsers aggressively cache JavaScript files
- Try incognito/private mode to test fixes
- The fix only needs to be applied once per deployment