#!/bin/bash
# WintEHR Azure Production Deployment Script
# =====================================================================
# Automated one-shot deployment to Azure with complete server wipe
#
# CRITICAL REQUIREMENTS:
# - ALWAYS starts with complete server wipe
# - NO manual SSH interventions allowed
# - All steps fully automated
# - Deploys HTTPS, 100 patients, DICOM images in one run
#
# Usage:
#   ./deploy-azure-production.sh                # Full automated deployment
#   ./deploy-azure-production.sh --dry-run      # Preview without executing
# =====================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Configuration
AZURE_USER="azureuser"
AZURE_HOST="wintehr.eastus2.cloudapp.azure.com"
SSH_KEY="${HOME}/.ssh/WintEHR-key.pem"
REPO_URL="https://github.com/ultraub/WintEHR.git"
BRANCH="cleanup/post-hapi-migration"

# Default mode
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            cat << EOF
WintEHR Azure Production Deployment

Usage:
  ./deploy-azure-production.sh [OPTIONS]

Options:
  --dry-run          Preview deployment without executing
  --help, -h         Show this help message

Description:
  Performs automated one-shot deployment to Azure:
  1. Complete server wipe (MANDATORY)
  2. Fresh code checkout
  3. Environment setup
  4. Docker build and deployment
  5. HTTPS/SSL configuration
  6. 100 patient generation with DICOM
  7. Health verification

This script executes entirely via SSH with zero manual intervention.

Requirements:
  - SSH key at: ${SSH_KEY}
  - Azure VM at: ${AZURE_HOST}
  - Git repository access

Examples:
  ./deploy-azure-production.sh              # Full deployment
  ./deploy-azure-production.sh --dry-run    # Preview only

EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Print header
echo "=============================================================================="
echo "           WintEHR Azure Production Deployment (Automated)"
echo "=============================================================================="
echo ""
echo -e "${BLUE}Target:${NC} ${AZURE_USER}@${AZURE_HOST}"
echo -e "${BLUE}Mode:${NC} $([ "$DRY_RUN" = true ] && echo "DRY RUN" || echo "LIVE DEPLOYMENT")"
echo ""

if [ "$DRY_RUN" = false ]; then
    echo -e "${YELLOW}${BOLD}WARNING: This will completely wipe and redeploy the Azure server${NC}"
    echo -e "${YELLOW}All existing data will be permanently deleted${NC}"
    echo ""
    read -p "Type 'DEPLOY' to confirm automated deployment: " -r
    if [[ ! $REPLY = "DEPLOY" ]]; then
        echo -e "${GREEN}Deployment cancelled${NC}"
        exit 0
    fi
    echo ""
fi

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH key not found: $SSH_KEY${NC}"
    exit 1
fi

if ! ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o BatchMode=yes "${AZURE_USER}@${AZURE_HOST}" exit 2>/dev/null; then
    echo -e "${RED}❌ Cannot connect to Azure VM${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Helper for SSH commands
ssh_exec() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN] SSH:${NC} $*"
    else
        echo -e "${BLUE}Executing on Azure:${NC} $*"
        ssh -i "$SSH_KEY" "${AZURE_USER}@${AZURE_HOST}" "$@"
    fi
}

# Helper for file transfer
ssh_copy() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${BLUE}[DRY RUN] Copy:${NC} $1 -> ${AZURE_HOST}:$2"
    else
        echo -e "${BLUE}Copying to Azure:${NC} $1 -> $2"
        scp -i "$SSH_KEY" "$1" "${AZURE_USER}@${AZURE_HOST}:$2"
    fi
}

# ============================================================================
# STEP 1: Complete Server Wipe (MANDATORY)
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 1: Complete Server Wipe (MANDATORY)${NC}"
echo "=============================================================================="
echo ""

echo "Wiping server to ensure clean starting state..."
ssh_exec 'bash -s' << 'EOF'
set -e

echo "Stopping all Docker containers..."
docker ps -q | xargs -r docker stop || true

echo "Removing all Docker containers..."
docker ps -aq | xargs -r docker rm -f || true

echo "Removing all Docker volumes..."
docker volume ls -q | xargs -r docker volume rm -f || true

echo "Removing all Docker images..."
docker images -q | xargs -r docker rmi -f || true

echo "Removing all Docker networks..."
docker network ls --filter "type=custom" -q | xargs -r docker network rm || true

echo "Docker system prune..."
docker system prune -af --volumes || true

echo "Removing application directories..."
sudo rm -rf WintEHR/ || true
rm -rf /app/data/ || true
rm -rf /app/logs/ || true
rm -rf certbot/ || true
sudo rm -rf /etc/letsencrypt/ || true

echo "Killing lingering processes..."
pkill -9 node || true
pkill -9 python || true
pkill -9 uvicorn || true

echo "Server wipe complete"
EOF

echo -e "${GREEN}✓ Server wiped and ready for deployment${NC}"
echo ""

# ============================================================================
# STEP 2: Clone Fresh Code
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 2: Clone Fresh Code${NC}"
echo "=============================================================================="
echo ""

echo "Cloning WintEHR repository..."
ssh_exec "git clone -b ${BRANCH} ${REPO_URL} WintEHR || (cd WintEHR && git fetch && git checkout ${BRANCH} && git pull)"

echo -e "${GREEN}✓ Code cloned${NC}"
echo ""

# ============================================================================
# STEP 3: Setup Environment
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 3: Setup Environment${NC}"
echo "=============================================================================="
echo ""

echo "Copying production configuration..."
ssh_copy "config.azure-prod.yaml" "WintEHR/config.yaml"

echo "Creating .env file..."
ssh_exec 'bash -s' << 'EOF'
cat > WintEHR/.env << 'ENVEOF'
POSTGRES_USER=emr_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=emr_db
JWT_SECRET=$(openssl rand -base64 32)
AZURE_URL=https://wintehr.eastus2.cloudapp.azure.com
AZURE_WS_URL=wss://wintehr.eastus2.cloudapp.azure.com/api/ws
BASE_URL=https://wintehr.eastus2.cloudapp.azure.com
ENVEOF
EOF

echo -e "${GREEN}✓ Environment configured${NC}"
echo ""

# ============================================================================
# STEP 4: Build and Deploy Services
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 4: Build and Deploy Services${NC}"
echo "=============================================================================="
echo ""

echo "Building Docker images..."
ssh_exec 'cd WintEHR && docker-compose -f docker-compose.yml -f docker-compose.azure.yml build'

echo "Starting services..."
ssh_exec 'cd WintEHR && docker-compose -f docker-compose.yml -f docker-compose.azure.yml up -d'

echo -e "${GREEN}✓ Services deployed${NC}"
echo ""

# ============================================================================
# STEP 5: Wait for Services
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 5: Waiting for Services${NC}"
echo "=============================================================================="
echo ""

echo "Waiting for HAPI FHIR (may take 5-6 minutes)..."
ssh_exec 'bash -s' << 'EOF'
for i in {1..180}; do
    if curl -sf http://localhost:8888/fhir/metadata > /dev/null 2>&1; then
        echo "HAPI FHIR ready"
        break
    fi
    [ $i -eq 180 ] && echo "ERROR: HAPI FHIR timeout" && exit 1
    [ $((i % 15)) -eq 0 ] && echo "Still waiting... ($((i * 3 / 60)) minutes)"
    sleep 3
done
EOF

echo "Waiting for backend..."
ssh_exec 'bash -s' << 'EOF'
for i in {1..30}; do
    if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "Backend ready"
        break
    fi
    sleep 2
done
EOF

echo -e "${GREEN}✓ Services ready${NC}"
echo ""

# ============================================================================
# STEP 6: Generate Patient Data and DICOM
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 6: Generate 100 Patients with DICOM${NC}"
echo "=============================================================================="
echo ""

echo "Generating 100 synthetic patients..."
ssh_exec 'cd WintEHR && docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py 100 Massachusetts'

echo "Generating DICOM files..."
ssh_exec 'cd WintEHR && docker exec emr-backend python scripts/active/generate_dicom_from_hapi.py'

echo "Creating DICOM endpoints with production URLs..."
ssh_exec 'cd WintEHR && docker exec emr-backend python scripts/active/create_dicom_endpoints.py --base-url https://wintehr.eastus2.cloudapp.azure.com'

echo "Creating demo practitioners..."
ssh_exec 'cd WintEHR && docker exec emr-backend python scripts/active/create_demo_practitioners.py'

echo -e "${GREEN}✓ Data generation complete${NC}"
echo ""

# ============================================================================
# STEP 7: Setup HTTPS/SSL
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 7: Setup HTTPS/SSL${NC}"
echo "=============================================================================="
echo ""

echo "Configuring SSL certificate..."
ssh_exec 'bash -s' << 'EOF'
cd WintEHR

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Stop nginx temporarily
docker-compose stop nginx || true

# Get certificate
sudo certbot certonly --standalone \
    --non-interactive \
    --agree-tos \
    --email admin@wintehr.com \
    --domains wintehr.eastus2.cloudapp.azure.com

# Copy certificates to Docker volume
sudo mkdir -p ./certbot/conf/live/wintehr.eastus2.cloudapp.azure.com/
sudo cp /etc/letsencrypt/live/wintehr.eastus2.cloudapp.azure.com/* \
    ./certbot/conf/live/wintehr.eastus2.cloudapp.azure.com/ || true

# Restart with SSL
docker-compose -f docker-compose.yml -f docker-compose-ssl.yml up -d

echo "SSL configured"
EOF

echo -e "${GREEN}✓ HTTPS enabled${NC}"
echo ""

# ============================================================================
# STEP 8: Verification
# ============================================================================
echo "=============================================================================="
echo -e "${BOLD}STEP 8: Deployment Verification${NC}"
echo "=============================================================================="
echo ""

echo "Verifying HTTPS endpoint..."
if curl -sf "https://${AZURE_HOST}/" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS working${NC}"
else
    echo -e "${YELLOW}⚠ HTTPS not responding yet (may need time)${NC}"
fi

echo "Checking patient count..."
PATIENT_COUNT=$(ssh_exec "curl -s https://${AZURE_HOST}/fhir/Patient?_summary=count | grep -o '\"total\":[0-9]*' | cut -d: -f2" || echo "0")
echo "  Patients: $PATIENT_COUNT"

echo "Checking DICOM endpoints..."
ENDPOINT_COUNT=$(ssh_exec "curl -s https://${AZURE_HOST}/fhir/Endpoint?_summary=count | grep -o '\"total\":[0-9]*' | cut -d: -f2" || echo "0")
echo "  Endpoints: $ENDPOINT_COUNT"

echo ""

# ============================================================================
# Completion
# ============================================================================
echo "=============================================================================="
echo -e "${GREEN}${BOLD}Deployment Complete! 🎉${NC}"
echo "=============================================================================="
echo ""
echo "Deployment Summary:"
echo "  URL:       https://${AZURE_HOST}"
echo "  Patients:  ${PATIENT_COUNT} (target: 100)"
echo "  Endpoints: ${ENDPOINT_COUNT} (should match imaging studies)"
echo ""
echo "Next Steps:"
echo "  1. Open: https://${AZURE_HOST}"
echo "  2. Login with demo credentials"
echo "  3. Navigate to Imaging tab to verify DICOM viewer"
echo "  4. Check logs: ssh -i ${SSH_KEY} ${AZURE_USER}@${AZURE_HOST} 'cd WintEHR && docker-compose logs'"
echo ""
echo "=============================================================================="
