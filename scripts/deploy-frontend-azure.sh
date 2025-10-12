#!/bin/bash

# Azure Frontend Deployment Script
# Builds and deploys frontend to Azure production environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AZURE_HOST="wintehr.eastus2.cloudapp.azure.com"
AZURE_USER="azureuser"
SSH_KEY="$HOME/.ssh/WintEHR-key.pem"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}   WintEHR Frontend Azure Deployment${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"

# Step 1: Verify .env.production exists
echo -e "\n${YELLOW}Step 1: Verifying production environment configuration...${NC}"
if [ ! -f "$FRONTEND_DIR/.env.production" ]; then
    echo -e "${RED}ERROR: .env.production not found!${NC}"
    echo "Please create frontend/.env.production with production configuration"
    exit 1
fi
echo -e "${GREEN}✓ Production environment file found${NC}"

# Step 2: Build frontend
echo -e "\n${YELLOW}Step 2: Building frontend...${NC}"
cd "$FRONTEND_DIR"

echo "Installing dependencies..."
npm install --legacy-peer-deps

echo "Building production bundle..."
npm run build

if [ ! -d "build" ]; then
    echo -e "${RED}ERROR: Build directory not created!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Frontend built successfully${NC}"

# Step 3: Package build
echo -e "\n${YELLOW}Step 3: Packaging build...${NC}"
cd build
tar czf ../frontend-build.tar.gz .
cd ..
BUILD_SIZE=$(du -h frontend-build.tar.gz | cut -f1)
echo -e "${GREEN}✓ Build packaged: ${BUILD_SIZE}${NC}"

# Step 4: Upload to Azure
echo -e "\n${YELLOW}Step 4: Uploading to Azure VM...${NC}"
echo "Uploading frontend-build.tar.gz..."
scp -i "$SSH_KEY" frontend-build.tar.gz ${AZURE_USER}@${AZURE_HOST}:~/frontend-build-$(date +%Y%m%d-%H%M%S).tar.gz
echo -e "${GREEN}✓ Upload complete${NC}"

# Step 5: Deploy on Azure
echo -e "\n${YELLOW}Step 5: Deploying on Azure VM...${NC}"
ssh -i "$SSH_KEY" ${AZURE_USER}@${AZURE_HOST} << 'ENDSSH'
    echo "Extracting build..."
    rm -rf /tmp/frontend-build
    mkdir -p /tmp/frontend-build
    tar xzf ~/frontend-build-*.tar.gz -C /tmp/frontend-build/

    echo "Deploying to Docker volume..."
    docker run --rm \
        -v wintehr_frontend_build:/data \
        -v /tmp/frontend-build:/source \
        alpine sh -c "rm -rf /data/* && cp -r /source/* /data/"

    echo "Restarting containers..."
    docker restart emr-frontend emr-nginx

    echo "Waiting for containers to start..."
    sleep 5

    echo "Verifying deployment..."
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "emr-frontend|emr-nginx"
ENDSSH

echo -e "${GREEN}✓ Deployment complete${NC}"

# Step 6: Verification
echo -e "\n${YELLOW}Step 6: Verifying deployment...${NC}"

echo "Testing FHIR endpoint with /R4 path..."
FHIR_TEST=$(curl -s "https://${AZURE_HOST}/fhir/R4/Patient?_count=1" | jq -r '.resourceType' 2>/dev/null || echo "FAILED")
if [ "$FHIR_TEST" == "Bundle" ]; then
    echo -e "${GREEN}✓ FHIR endpoint working${NC}"
else
    echo -e "${RED}✗ FHIR endpoint test failed${NC}"
fi

echo "Testing application accessibility..."
APP_TEST=$(curl -s "https://${AZURE_HOST}/" | grep -o "WintEHR" || echo "")
if [ -n "$APP_TEST" ]; then
    echo -e "${GREEN}✓ Application accessible${NC}"
else
    echo -e "${RED}✗ Application accessibility test failed${NC}"
fi

echo -e "\n${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Deployment Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "\nApplication URL: ${YELLOW}https://${AZURE_HOST}${NC}"
echo -e "\nNext steps:"
echo "  1. Open browser to https://${AZURE_HOST}"
echo "  2. Check browser console for any errors"
echo "  3. Test patient directory loading"
echo "  4. Verify WebSocket connections (should use wss://)"

# Cleanup
echo -e "\n${YELLOW}Cleaning up local build artifacts...${NC}"
rm -f "$FRONTEND_DIR/frontend-build.tar.gz"
echo -e "${GREEN}✓ Cleanup complete${NC}"
