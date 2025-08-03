# HTTPS Enforcement and Security Headers Guide

**Created**: 2025-08-03  
**Status**: IMPLEMENTED

## Overview

WintEHR now includes comprehensive security middleware that enforces HTTPS in production, adds security headers, and provides enhanced CORS protection. This guide covers configuration and deployment.

## Features

### 1. HTTPS Enforcement
- Automatic redirect from HTTP to HTTPS in production
- Handles proxy headers (X-Forwarded-Proto, etc.)
- Permanent redirect (301) for SEO and caching
- Configurable via environment variables

### 2. Security Headers
Implements OWASP recommended headers:
- **X-Frame-Options**: DENY (prevents clickjacking)
- **X-Content-Type-Options**: nosniff (prevents MIME sniffing)
- **X-XSS-Protection**: 1; mode=block (enables XSS filter)
- **Content-Security-Policy**: Restrictive CSP rules
- **Strict-Transport-Security**: HSTS in production
- **Referrer-Policy**: strict-origin-when-cross-origin
- **Permissions-Policy**: Restricts browser features
- **Cache-Control**: No-cache for API endpoints

### 3. Enhanced CORS
- Environment-based origin restrictions
- Credentials support with security
- Preflight request handling
- Customizable allowed methods/headers

### 4. Request Logging
- Security monitoring and suspicious pattern detection
- Request ID tracking
- Slow request warnings
- Attack pattern detection (XSS, SQL injection, etc.)

## Configuration

### Environment Variables

```bash
# Production environment (enables HTTPS redirect and HSTS)
export ENVIRONMENT=production

# Force HTTPS even in development
export FORCE_HTTPS=true

# Frontend URL for CORS in production
export FRONTEND_URL=https://app.wintehr.com

# Disable security middleware (development only!)
export DISABLE_SECURITY_MIDDLEWARE=false
```

### Development Setup

In development, HTTPS is not enforced by default:

```bash
# Development mode - no HTTPS enforcement
export ENVIRONMENT=development
```

### Production Setup

For production deployment:

```bash
# Enable all security features
export ENVIRONMENT=production
export JWT_ENABLED=true
export USE_SECURE_AUTH=true
export FRONTEND_URL=https://app.wintehr.com
```

## Deployment with HTTPS

### Option 1: Reverse Proxy (Recommended)

Use NGINX or Apache as reverse proxy:

```nginx
# nginx.conf
server {
    listen 80;
    server_name app.wintehr.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.wintehr.com;
    
    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    
    # Security headers (some duplicated for extra security)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    
    # Proxy to backend
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option 2: Direct HTTPS with Uvicorn

For smaller deployments:

```bash
# Generate self-signed cert for testing
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Run with HTTPS
uvicorn main:app --host 0.0.0.0 --port 443 --ssl-keyfile=key.pem --ssl-certfile=cert.pem
```

### Option 3: Cloud Load Balancer

Configure HTTPS termination at load balancer:
- AWS ALB/ELB with ACM certificates
- Google Cloud Load Balancer
- Azure Application Gateway

Ensure proxy headers are forwarded:
- X-Forwarded-Proto
- X-Forwarded-For
- X-Real-IP

## Security Headers Explained

### Content Security Policy (CSP)

Default CSP configuration:
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self' ws: wss:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

To customize CSP:
```python
# In security_middleware.py configuration
csp_config = {
    "script-src": ["'self'"],  # Remove unsafe-inline in production
    "style-src": ["'self'", "https://cdn.example.com"],
    # ... other directives
}
```

### HSTS (HTTP Strict Transport Security)

Enabled automatically in production:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

To enable HSTS preload:
1. Ensure HTTPS works perfectly
2. Set `hsts_preload=True` in middleware config
3. Submit to https://hstspreload.org/

## Testing Security

### Check HTTPS Redirect

```bash
# Should return 301 redirect
curl -I http://app.wintehr.com

# Should return 200 with security headers
curl -I https://app.wintehr.com
```

### Verify Security Headers

```bash
# Check all security headers
curl -I https://app.wintehr.com/api/health | grep -E "X-Frame-Options|X-Content-Type|Strict-Transport"
```

### Test with Security Scanner

Use online tools:
- https://securityheaders.com/
- https://observatory.mozilla.org/
- https://www.ssllabs.com/ssltest/

### Local Testing

```bash
# Force HTTPS in development
export FORCE_HTTPS=true
export ENVIRONMENT=development

# Test redirect
curl -I http://localhost:8000
# Should redirect to https://localhost:8000
```

## Troubleshooting

### Redirect Loop

If you get infinite redirects:
1. Check proxy headers are correctly forwarded
2. Ensure load balancer passes X-Forwarded-Proto
3. Verify SSL termination point

### CORS Issues

If frontend can't connect:
1. Set FRONTEND_URL environment variable
2. Check browser console for specific CORS errors
3. Verify credentials are included in requests

### Missing Headers

If security headers are missing:
1. Check middleware is loaded
2. Verify DISABLE_SECURITY_MIDDLEWARE is not true
3. Check response headers in browser DevTools

### Development Issues

For local development without HTTPS:
```bash
# Disable HTTPS enforcement
export ENVIRONMENT=development
export FORCE_HTTPS=false

# Or disable all security middleware
export DISABLE_SECURITY_MIDDLEWARE=true
```

## Security Checklist

- [ ] HTTPS certificate valid and not self-signed
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header present with long max-age
- [ ] CSP header configured appropriately
- [ ] X-Frame-Options set to DENY
- [ ] X-Content-Type-Options set to nosniff
- [ ] API endpoints have no-cache headers
- [ ] CORS origins restricted in production
- [ ] Request logging enabled for monitoring
- [ ] Regular security scans scheduled

## Best Practices

1. **Always use HTTPS in production** - No exceptions for healthcare data
2. **Tighten CSP gradually** - Start permissive, remove unsafe-inline over time
3. **Monitor security logs** - Watch for attack patterns
4. **Regular updates** - Keep dependencies and certificates current
5. **Defense in depth** - Use multiple layers of security

## Compliance Notes

This implementation helps with:
- **HIPAA**: Encryption in transit requirement
- **GDPR**: Security by design principle
- **PCI DSS**: If handling payment data
- **SOC 2**: Security controls for Type II compliance

---

**Remember**: HTTPS is just one layer of security. Combine with secure authentication, audit logging, and regular security reviews for comprehensive protection.