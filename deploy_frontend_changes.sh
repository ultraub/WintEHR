#!/bin/bash
# Deploy frontend changes to Azure production server
# This script updates the frontend code and rebuilds the Docker image

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Azure server details
AZURE_HOST="wintehr.eastus2.cloudapp.azure.com"
AZURE_USER="azureuser"
SSH_KEY="$HOME/.ssh/WintEHR-key.pem"
REMOTE_DIR="/home/azureuser/WintEHR"

echo -e "${BLUE}🚀 Deploying Frontend Changes to Azure${NC}"
echo ""

# Step 1: Copy changed files to server
echo -e "${YELLOW}Step 1: Copying updated files to server...${NC}"

# ClinicalAppBar.js
scp -i "$SSH_KEY" \
    frontend/src/components/clinical/navigation/ClinicalAppBar.js \
    ${AZURE_USER}@${AZURE_HOST}:${REMOTE_DIR}/frontend/src/components/clinical/navigation/

# EnhancedClinicalLayout.js
scp -i "$SSH_KEY" \
    frontend/src/components/clinical/layouts/EnhancedClinicalLayout.js \
    ${AZURE_USER}@${AZURE_HOST}:${REMOTE_DIR}/frontend/src/components/clinical/layouts/

echo -e "${GREEN}✓ Files copied${NC}"
echo ""

# Step 2: Rebuild frontend Docker image on server
echo -e "${YELLOW}Step 2: Rebuilding frontend Docker image...${NC}"

ssh -i "$SSH_KEY" ${AZURE_USER}@${AZURE_HOST} << 'ENDSSH'
cd /home/azureuser/WintEHR

# Set Azure environment variables
export AZURE_URL=https://wintehr.eastus2.cloudapp.azure.com
export AZURE_WS_URL=wss://wintehr.eastus2.cloudapp.azure.com/api/ws

# Build new frontend image
echo "Building frontend Docker image with Azure production config..."
docker-compose -f docker-compose.yml -f docker-compose.azure.yml build --no-cache frontend

echo "Frontend image built successfully"
ENDSSH

echo -e "${GREEN}✓ Docker image rebuilt${NC}"
echo ""

# Step 3: Restart frontend container
echo -e "${YELLOW}Step 3: Restarting frontend container...${NC}"

ssh -i "$SSH_KEY" ${AZURE_USER}@${AZURE_HOST} << 'ENDSSH'
cd /home/azureuser/WintEHR

# Stop and remove old container
docker stop emr-frontend
docker rm emr-frontend

# Start new container with Azure config
export AZURE_URL=https://wintehr.eastus2.cloudapp.azure.com
export AZURE_WS_URL=wss://wintehr.eastus2.cloudapp.azure.com/api/ws

docker-compose -f docker-compose.yml -f docker-compose.azure.yml up -d frontend

echo "Frontend container restarted"
ENDSSH

echo -e "${GREEN}✓ Container restarted${NC}"
echo ""

# Step 4: Verify deployment
echo -e "${YELLOW}Step 4: Verifying deployment...${NC}"

ssh -i "$SSH_KEY" ${AZURE_USER}@${AZURE_HOST} << 'ENDSSH'
# Wait for container to be healthy
sleep 5

# Check container status
docker ps --filter name=emr-frontend --format "table {{.Names}}\t{{.Status}}"

# Check if we can access index.html
docker exec emr-frontend ls -lah /usr/share/nginx/html/index.html

echo ""
echo "Deployment complete!"
ENDSSH

echo ""
echo -e "${GREEN}✅ Frontend deployment successful!${NC}"
echo ""
echo -e "${BLUE}The following changes are now live:${NC}"
echo "  • Patient name: Ivan Cyrus Mertz (numbers removed)"
echo "  • Department header: 'Clinic' (changed from 'Emergency')"
echo ""
echo -e "${BLUE}You can verify at: https://wintehr.eastus2.cloudapp.azure.com/patients/139915/${NC}"
echo ""
