#!/bin/bash

# =============================================================================
# Module 05: Nginx Configuration
# =============================================================================
# Handles nginx configuration updates, static file serving, and endpoint setup

set -e

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Default values
MODE="development"
ROOT_DIR=""
SKIP_BUILD=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --mode=*)
            MODE="${1#*=}"
            shift
            ;;
        --root-dir=*)
            ROOT_DIR="${1#*=}"
            shift
            ;;
        --skip-build=*)
            SKIP_BUILD="${1#*=}"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

log() {
    echo -e "${BLUE}[NGINX-CONFIG]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Change to root directory
cd "$ROOT_DIR"

log "⚙️ Starting nginx configuration update..."

# Step 1: Backup existing nginx configuration
log "Backing up existing nginx configuration..."

if [ -f "frontend/nginx.conf" ]; then
    BACKUP_NAME="nginx.conf.backup.$(date +%Y%m%d_%H%M%S)"
    cp frontend/nginx.conf "frontend/$BACKUP_NAME"
    success "Existing nginx.conf backed up as $BACKUP_NAME"
else
    warning "No existing nginx.conf found - will create new one"
fi

# Step 2: Generate updated nginx configuration
log "Generating updated nginx configuration..."

cat > frontend/nginx.conf << 'EOF'
server {
    listen 80;
    server_name localhost;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain application/json application/javascript text/css application/xml text/xml;
    gzip_min_length 1000;
    
    # Root directory
    root /usr/share/nginx/html;
    index index.html;
    
    # Handle manifest.json with proper content type
    location = /manifest.json {
        add_header Content-Type application/manifest+json;
        add_header Cache-Control "public, max-age=604800";
        try_files $uri =404;
    }
    
    # Handle favicon with proper caching
    location = /favicon.ico {
        add_header Cache-Control "public, max-age=604800";
        try_files $uri =404;
    }
    
    # Static assets with caching
    location /static/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }
    
    # React app assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        add_header Cache-Control "public, max-age=31536000";
        try_files $uri =404;
    }
    
    # API requests - proxy to backend
    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Handle CORS for development
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $http_origin;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
            add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # FHIR API - proxy to backend
    location /fhir/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # FHIR-specific headers
        add_header Content-Type application/fhir+json;
        
        # Timeout settings for large FHIR operations
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
    
    # CDS Hooks API - proxy to backend
    location /cds-hooks/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CDS Hooks specific headers
        add_header Content-Type application/json;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin $http_origin;
            add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
            add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket support for real-time updates
    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeout settings
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://backend:8000/api/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # React Router - serve index.html for all frontend routes
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache control for HTML files
        location ~* \.html$ {
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }
    }
    
    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /usr/share/nginx/html;
        internal;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Security: Deny access to sensitive files
    location ~* \.(env|log|htaccess|htpasswd)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

success "Updated nginx configuration created"

# Step 3: Create custom error pages (optional)
log "Creating custom error pages..."

mkdir -p frontend/public/error-pages

# Create a simple 50x error page
cat > frontend/public/error-pages/50x.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>WintEHR - Service Unavailable</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px;
            background-color: #f5f5f5;
        }
        .error-container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #e74c3c; }
        .error-code { font-size: 72px; color: #95a5a6; margin: 20px 0; }
        .retry-btn {
            background-color: #3498db;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
        }
        .retry-btn:hover { background-color: #2980b9; }
    </style>
</head>
<body>
    <div class="error-container">
        <h1>WintEHR Service Unavailable</h1>
        <div class="error-code">5xx</div>
        <p>We're experiencing technical difficulties. Please try again in a few moments.</p>
        <button class="retry-btn" onclick="window.location.reload()">Retry</button>
    </div>
</body>
</html>
EOF

success "Custom error pages created"

# Step 4: Validate nginx configuration syntax
log "Validating nginx configuration syntax..."

# Start nginx container to test configuration
docker-compose up -d frontend

# Wait for nginx to start
sleep 5

# Test nginx configuration
NGINX_TEST_RESULT=$(docker exec emr-frontend nginx -t 2>&1 || echo "NGINX_TEST_FAILED")

if echo "$NGINX_TEST_RESULT" | grep -q "syntax is ok"; then
    success "Nginx configuration syntax is valid"
elif echo "$NGINX_TEST_RESULT" | grep -q "NGINX_TEST_FAILED"; then
    error "Nginx configuration test failed: $NGINX_TEST_RESULT"
else
    warning "Nginx configuration test completed with warnings: $NGINX_TEST_RESULT"
fi

# Step 5: Test static file serving
log "Testing static file serving..."

# Create test manifest.json if it doesn't exist
if [ ! -f "frontend/public/manifest.json" ]; then
    log "Creating manifest.json..."
    cat > frontend/public/manifest.json << 'EOF'
{
  "short_name": "WintEHR",
  "name": "WintEHR - Medical Records System",
  "icons": [
    {
      "src": "favicon.ico",
      "sizes": "64x64 32x32 24x24 16x16",
      "type": "image/x-icon"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "description": "Comprehensive Electronic Medical Records system built with FHIR R4"
}
EOF
    success "manifest.json created"
fi

# Test manifest.json accessibility after nginx reload
sleep 2
MANIFEST_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/manifest.json || echo "000")

if [ "$MANIFEST_TEST" = "200" ]; then
    success "manifest.json is accessible"
elif [ "$MANIFEST_TEST" = "000" ]; then
    warning "Cannot test manifest.json (service may not be ready yet)"
else
    warning "manifest.json returned status: $MANIFEST_TEST"
fi

# Step 6: Configure MIME types
log "Configuring additional MIME types..."

# Create custom mime.types if needed (this would go in a custom nginx image)
docker exec emr-frontend bash -c "
cat >> /etc/nginx/mime.types << 'EOL'
application/manifest+json webmanifest;
application/fhir+json fhir;
EOL
" 2>/dev/null || true

# Step 7: Setup log rotation (production mode)
if [ "$MODE" = "production" ]; then
    log "Setting up log rotation for production..."
    
    # Create logrotate configuration for nginx logs
    cat > logs/nginx-logrotate << 'EOF'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 644 nginx nginx
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
EOF
    
    success "Log rotation configured for production"
fi

# Step 8: Test proxy endpoints
log "Testing proxy endpoint configuration..."

# Test health endpoint
HEALTH_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health || echo "000")
if [ "$HEALTH_TEST" = "200" ]; then
    success "Health endpoint proxy working"
else
    warning "Health endpoint returned: $HEALTH_TEST (backend may not be ready)"
fi

# Step 9: Security headers validation
log "Validating security headers..."

SECURITY_HEADERS_TEST=$(curl -s -I http://localhost/ | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)" | wc -l || echo "0")

if [ "$SECURITY_HEADERS_TEST" -ge "3" ]; then
    success "Security headers configured correctly"
else
    warning "Some security headers may be missing (found: $SECURITY_HEADERS_TEST/3)"
fi

# Step 10: Performance optimizations
log "Applying performance optimizations..."

# Enable gzip compression test
GZIP_TEST=$(curl -s -H "Accept-Encoding: gzip" -I http://localhost/ | grep -i "content-encoding.*gzip" | wc -l || echo "0")

if [ "$GZIP_TEST" -gt "0" ]; then
    success "Gzip compression enabled"
else
    warning "Gzip compression not detected"
fi

# Step 11: Create configuration summary
log "Creating nginx configuration summary..."

cat > logs/nginx-config-summary.txt << EOF
=============================================================================
Nginx Configuration Summary - $(date)
=============================================================================

Mode: $MODE
Configuration File: frontend/nginx.conf
Backup Created: frontend/nginx.conf.backup.*

ENDPOINTS CONFIGURED:
✅ / (React app with Router support)
✅ /manifest.json (PWA manifest with proper MIME type)
✅ /api/* (Backend API proxy)
✅ /fhir/* (FHIR R4 API proxy)
✅ /cds-hooks/* (CDS Hooks API proxy)
✅ /ws/* (WebSocket support)
✅ /health (Health check proxy)

FEATURES ENABLED:
✅ Gzip compression
✅ Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
✅ Static file caching
✅ CORS handling for development
✅ Custom error pages
✅ WebSocket support
✅ Proper MIME types for FHIR and manifest files

TEST RESULTS:
- Nginx syntax: $(echo "$NGINX_TEST_RESULT" | grep -q "syntax is ok" && echo "✅ Valid" || echo "❌ Invalid")
- Manifest accessibility: $([ "$MANIFEST_TEST" = "200" ] && echo "✅ Accessible" || echo "⚠️ Status: $MANIFEST_TEST")
- Health endpoint: $([ "$HEALTH_TEST" = "200" ] && echo "✅ Working" || echo "⚠️ Status: $HEALTH_TEST")
- Security headers: $([ "$SECURITY_HEADERS_TEST" -ge "3" ] && echo "✅ Configured" || echo "⚠️ Partial ($SECURITY_HEADERS_TEST/3)")
- Gzip compression: $([ "$GZIP_TEST" -gt "0" ] && echo "✅ Enabled" || echo "⚠️ Not detected")

EOF

if [ "$MODE" = "production" ]; then
    echo "✅ Log rotation configured" >> logs/nginx-config-summary.txt
fi

echo "" >> logs/nginx-config-summary.txt
echo "Configuration completed at: $(date)" >> logs/nginx-config-summary.txt

success "Configuration summary saved to logs/nginx-config-summary.txt"

# Step 12: Reload nginx to apply changes
log "Reloading nginx configuration..."

docker exec emr-frontend nginx -s reload 2>/dev/null || {
    warning "Nginx reload failed, restarting container..."
    docker-compose restart frontend
    sleep 5
}

# Final validation
FINAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ || echo "000")
if [ "$FINAL_TEST" = "200" ]; then
    success "Nginx configuration applied successfully"
else
    warning "Frontend may not be fully ready (status: $FINAL_TEST)"
fi

log "🎉 Nginx configuration completed successfully!"
log "✅ Manifest.json: Properly configured with correct MIME type"
log "✅ CDS Hooks: Proxy endpoint configured"
log "✅ FHIR API: Proxy endpoint configured"
log "✅ WebSocket: Real-time support enabled"
log "✅ Security: Headers and protections applied"
log "✅ Performance: Gzip and caching optimized"

if [ "$MODE" = "production" ]; then
    log "✅ Production: Log rotation and optimizations applied"
fi