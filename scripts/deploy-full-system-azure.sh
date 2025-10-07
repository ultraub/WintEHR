#!/bin/bash

# WintEHR Complete System Deployment Script for Azure
# Deploys entire stack: Frontend, Backend, HAPI FHIR, Nginx, PostgreSQL, Redis

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AZURE_HOST="${AZURE_HOST:-wintehr.eastus2.cloudapp.azure.com}"
AZURE_USER="${AZURE_USER:-azureuser}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/WintEHR-key.pem}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PATIENT_COUNT="${PATIENT_COUNT:-50}"

# Print banner
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   WintEHR Complete System Deployment          ║${NC}"
echo -e "${GREEN}║   Target: Azure Production Environment        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print step header
step() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
}

# Function to print success
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print warning
warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check prerequisites
step "Step 1: Checking Prerequisites"

if [ ! -f "$SSH_KEY" ]; then
    error "SSH key not found: $SSH_KEY"
    echo "Please set AZURE_HOST, AZURE_USER, and SSH_KEY environment variables"
    exit 1
fi
success "SSH key found"

if [ ! -f "$FRONTEND_DIR/.env.production" ]; then
    error ".env.production not found in frontend/"
    echo "Please create frontend/.env.production with production configuration"
    exit 1
fi
success "Frontend production environment found"

if [ ! -f "$PROJECT_ROOT/nginx-prod.conf" ]; then
    error "nginx-prod.conf not found"
    exit 1
fi
success "Nginx production config found"

# Build frontend
step "Step 2: Building Frontend"

echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install --legacy-peer-deps > /dev/null 2>&1

echo "Building production bundle..."
npm run build

if [ ! -d "build" ]; then
    error "Frontend build failed"
    exit 1
fi

BUILD_SIZE=$(du -sh build | cut -f1)
success "Frontend built successfully (${BUILD_SIZE})"

# Package frontend
echo "Packaging frontend build..."
cd build
tar czf ../frontend-build.tar.gz .
cd ..
PACKAGE_SIZE=$(du -h frontend-build.tar.gz | cut -f1)
success "Frontend packaged: ${PACKAGE_SIZE}"

# Prepare deployment files
step "Step 3: Preparing Deployment Files"

cd "$PROJECT_ROOT"

# Create temporary deployment directory
TEMP_DEPLOY=$(mktemp -d)
echo "Created temporary deployment directory: $TEMP_DEPLOY"

# Copy required files
cp docker-compose.prod.yml "$TEMP_DEPLOY/" 2>/dev/null || warn "docker-compose.prod.yml not found locally"
cp nginx-prod.conf "$TEMP_DEPLOY/"
cp .env.example "$TEMP_DEPLOY/.env" 2>/dev/null || warn ".env.example not found"
cp "$FRONTEND_DIR/frontend-build.tar.gz" "$TEMP_DEPLOY/"

# Copy backend directory (excluding node_modules, __pycache__, etc.)
echo "Preparing backend files..."
rsync -a --exclude='__pycache__' --exclude='*.pyc' --exclude='node_modules' \
    --exclude='.pytest_cache' --exclude='venv' \
    backend/ "$TEMP_DEPLOY/backend/"
success "Backend files prepared"

# Create deployment script for Azure VM
cat > "$TEMP_DEPLOY/remote-deploy.sh" << 'EOFREMOTE'
#!/bin/bash
set -e

echo "Starting WintEHR deployment on Azure VM..."

# Stop existing containers
echo "Stopping existing containers..."
cd ~/WintEHR
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true

# Update nginx configuration
echo "Updating nginx configuration..."
cp nginx-prod.conf ~/WintEHR/nginx-prod.conf

# Deploy frontend build
echo "Deploying frontend build..."
rm -rf /tmp/frontend-build
mkdir -p /tmp/frontend-build
tar xzf frontend-build.tar.gz -C /tmp/frontend-build/
docker run --rm \
    -v wintehr_frontend_build:/data \
    -v /tmp/frontend-build:/source \
    alpine sh -c "rm -rf /data/* && cp -r /source/* /data/"
rm -rf /tmp/frontend-build

# Update backend files
echo "Updating backend files..."
rsync -a --delete backend/ ~/WintEHR/backend/

# Start services
echo "Starting services with docker-compose..."
docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services
echo "Waiting for services to start..."
sleep 10

# Check service status
echo ""
echo "Service Status:"
docker-compose -f docker-compose.prod.yml ps

# Health checks
echo ""
echo "Running health checks..."

# Check PostgreSQL
if docker exec emr-postgres pg_isready -U emr_user -d emr_db > /dev/null 2>&1; then
    echo "✓ PostgreSQL: Healthy"
else
    echo "✗ PostgreSQL: Not ready"
fi

# Check HAPI FHIR
if curl -sf http://localhost:8888/fhir/metadata > /dev/null 2>&1; then
    echo "✓ HAPI FHIR: Healthy"
else
    echo "⚠ HAPI FHIR: May still be starting (can take 2-3 minutes)"
fi

# Check Backend
if curl -sf http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "✓ Backend API: Healthy"
else
    echo "⚠ Backend API: May still be starting"
fi

# Check Frontend
if curl -sf http://localhost:80 > /dev/null 2>&1; then
    echo "✓ Frontend: Healthy"
else
    echo "⚠ Frontend: May still be starting"
fi

# Check Nginx
if curl -sf https://localhost/fhir/metadata > /dev/null 2>&1; then
    echo "✓ Nginx: Healthy"
else
    echo "⚠ Nginx: May still be starting"
fi

echo ""
echo "Deployment complete!"
echo "Note: HAPI FHIR may take 2-3 minutes to fully initialize"
EOFREMOTE

chmod +x "$TEMP_DEPLOY/remote-deploy.sh"

# Upload to Azure
step "Step 4: Uploading Files to Azure VM"

echo "Uploading deployment package..."
rsync -avz --progress -e "ssh -i $SSH_KEY" \
    "$TEMP_DEPLOY/" \
    "${AZURE_USER}@${AZURE_HOST}:~/WintEHR-deploy/"

success "Files uploaded to Azure VM"

# Execute deployment on Azure
step "Step 5: Executing Deployment on Azure VM"

ssh -i "$SSH_KEY" "${AZURE_USER}@${AZURE_HOST}" << 'EOFSSH'
    cd ~/WintEHR-deploy

    # Ensure WintEHR directory exists
    mkdir -p ~/WintEHR

    # Copy docker-compose if it exists
    if [ -f docker-compose.prod.yml ]; then
        cp docker-compose.prod.yml ~/WintEHR/
    fi

    # Run deployment script
    chmod +x remote-deploy.sh
    ./remote-deploy.sh
EOFSSH

success "Deployment executed on Azure VM"

# Verify deployment
step "Step 6: Verifying Deployment"

echo "Testing FHIR endpoint..."
sleep 5  # Give services a moment to stabilize

FHIR_TEST=$(curl -s "https://${AZURE_HOST}/fhir/metadata" | jq -r '.resourceType' 2>/dev/null || echo "FAILED")
if [ "$FHIR_TEST" == "CapabilityStatement" ]; then
    success "FHIR endpoint responding"
else
    warn "FHIR endpoint not yet ready (HAPI FHIR may still be initializing)"
fi

echo "Testing application..."
APP_TEST=$(curl -s "https://${AZURE_HOST}/" | grep -o "WintEHR" || echo "")
if [ -n "$APP_TEST" ]; then
    success "Application accessible"
else
    warn "Application not yet accessible"
fi

echo "Testing FHIR R4 rewrite..."
FHIR_R4_TEST=$(curl -s "https://${AZURE_HOST}/fhir/R4/metadata" | jq -r '.resourceType' 2>/dev/null || echo "FAILED")
if [ "$FHIR_R4_TEST" == "CapabilityStatement" ]; then
    success "FHIR R4 rewrite working"
else
    warn "FHIR R4 endpoint not yet ready"
fi

# Cleanup
step "Step 7: Cleanup"

echo "Removing temporary files..."
rm -rf "$TEMP_DEPLOY"
rm -f "$FRONTEND_DIR/frontend-build.tar.gz"
success "Cleanup complete"

# Final summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Deployment Complete!                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo "Application URL: ${BLUE}https://${AZURE_HOST}${NC}"
echo ""
echo "Next Steps:"
echo "  1. Wait 2-3 minutes for HAPI FHIR to fully initialize"
echo "  2. Check service logs: ssh -i $SSH_KEY ${AZURE_USER}@${AZURE_HOST} 'cd ~/WintEHR && docker-compose -f docker-compose.prod.yml logs -f'"
echo "  3. Verify patient data loaded: curl https://${AZURE_HOST}/fhir/Patient?_count=1"
echo "  4. Open browser to: https://${AZURE_HOST}"
echo ""
echo "Monitoring Commands:"
echo "  Service status: ssh -i $SSH_KEY ${AZURE_USER}@${AZURE_HOST} 'cd ~/WintEHR && docker-compose -f docker-compose.prod.yml ps'"
echo "  View logs: ssh -i $SSH_KEY ${AZURE_USER}@${AZURE_HOST} 'cd ~/WintEHR && docker-compose -f docker-compose.prod.yml logs -f [service]'"
echo "  Restart service: ssh -i $SSH_KEY ${AZURE_USER}@${AZURE_HOST} 'cd ~/WintEHR && docker-compose -f docker-compose.prod.yml restart [service]'"
echo ""
