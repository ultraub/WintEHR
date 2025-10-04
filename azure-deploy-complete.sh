#!/bin/bash
###############################################################################
# WintEHR Complete Azure Deployment Script with SSL/TLS
#
# Purpose: One-shot deployment of WintEHR to Azure VM with optional SSL/TLS
# Version: 3.0
# Date: 2025-10-03
#
# Usage: ./azure-deploy-complete.sh <server-ip> [options]
#
# Options:
#   --ssh-key <path>        SSH key path (default: ~/.ssh/WintEHR-key.pem)
#   --patients <count>      Number of patients (default: 20)
#   --domain <domain>       Domain name for SSL (optional)
#   --email <email>         Email for Let's Encrypt (required if --domain used)
#   --no-ssl                Skip SSL setup (HTTP only)
#
# Examples:
#   # HTTP only deployment
#   ./azure-deploy-complete.sh 20.55.250.5 --patients 20
#
#   # HTTPS deployment with domain
#   ./azure-deploy-complete.sh 20.55.250.5 \
#       --domain wintehr.eastus2.cloudapp.azure.com \
#       --email admin@example.com \
#       --patients 20
###############################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default configuration
SERVER_IP=""
SSH_KEY="$HOME/.ssh/WintEHR-key.pem"
PATIENT_COUNT=20
DOMAIN=""
EMAIL=""
SSL_ENABLED=true
SSH_USER="azureuser"
DEPLOY_DIR="WintEHR"
LOG_FILE="azure-deployment-$(date +%Y%m%d-%H%M%S).log"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --ssh-key)
            SSH_KEY="$2"
            shift 2
            ;;
        --patients)
            PATIENT_COUNT="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --no-ssl)
            SSL_ENABLED=false
            shift
            ;;
        *)
            if [ -z "$SERVER_IP" ]; then
                SERVER_IP="$1"
            else
                echo "Unknown option: $1"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validation
if [ -z "$SERVER_IP" ]; then
    echo "Usage: $0 <server-ip> [options]"
    echo ""
    echo "Options:"
    echo "  --ssh-key <path>    SSH key path (default: ~/.ssh/WintEHR-key.pem)"
    echo "  --patients <count>  Number of patients (default: 20)"
    echo "  --domain <domain>   Domain name for SSL (optional)"
    echo "  --email <email>     Email for Let's Encrypt (required if --domain used)"
    echo "  --no-ssl            Skip SSL setup (HTTP only)"
    exit 1
fi

if [ -n "$DOMAIN" ] && [ -z "$EMAIL" ]; then
    echo -e "${RED}Error: --email required when using --domain${NC}"
    exit 1
fi

if [ -n "$DOMAIN" ]; then
    SSL_ENABLED=true
fi

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Main deployment steps
main() {
    echo "═══════════════════════════════════════════════════════════════"
    echo "           WintEHR Complete Azure Deployment Script"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "Server: ${SERVER_IP}"
    echo "SSH Key: ${SSH_KEY}"
    echo "Patients: ${PATIENT_COUNT}"
    echo "Domain: ${DOMAIN:-None (HTTP only)}"
    echo "SSL: ${SSL_ENABLED}"
    echo "Log File: ${LOG_FILE}"
    echo ""

    # Step 1: Prerequisites
    log "Step 1/12: Checking prerequisites..."
    if [ ! -f "$SSH_KEY" ]; then
        error "SSH key not found: $SSH_KEY"
        exit 1
    fi
    if ! command -v rsync &> /dev/null; then
        error "rsync not found. Please install rsync"
        exit 1
    fi
    log "✓ Prerequisites check passed"

    # Step 2: SSH Key Permissions
    log "Step 2/12: Fixing SSH key permissions..."
    chmod 600 "$SSH_KEY"
    log "✓ SSH key permissions set to 600"

    # Step 3: Test SSH
    log "Step 3/12: Testing SSH connectivity..."
    if ssh -i "$SSH_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=no \
        ${SSH_USER}@${SERVER_IP} "echo 'SSH test successful'" >> "$LOG_FILE" 2>&1; then
        log "✓ SSH connection successful"
    else
        error "SSH connection failed"
        exit 1
    fi

    # Step 4: Install Docker
    log "Step 4/12: Installing Docker and Docker Compose..."
    ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} 'bash -s' << 'DOCKERINSTALL' 2>&1 | tee -a "$LOG_FILE"
# Check if Docker is already installed
if command -v docker &> /dev/null; then
    echo "Docker already installed, skipping..."
else
    # Update and install prerequisites
    sudo apt-get update -qq
    sudo apt-get install -y -qq ca-certificates curl gnupg lsb-release

    # Add Docker GPG key and repository
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    sudo apt-get update -qq
    sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Add user to docker group
    sudo usermod -aG docker azureuser

    # Install standalone docker-compose
    sudo curl -sL "https://github.com/docker/compose/releases/download/v2.39.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose

    echo "✓ Docker installation complete"
fi

docker --version
docker-compose --version
DOCKERINSTALL
    log "✓ Docker and Docker Compose ready"

    # Step 5: Transfer Files
    log "Step 5/12: Transferring application files..."
    ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} "mkdir -p ~/${DEPLOY_DIR}"

    info "Syncing files (this may take a few minutes)..."
    rsync -avz --progress -e "ssh -i $SSH_KEY" \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude '__pycache__' \
        --exclude '*.pyc' \
        --exclude '.pytest_cache' \
        --exclude 'build' \
        --exclude 'dist' \
        --exclude '.env.local' \
        --exclude 'postgres_data' \
        --exclude 'synthea_data' \
        --exclude '.DS_Store' \
        --exclude '*.log' \
        ./ ${SSH_USER}@${SERVER_IP}:~/${DEPLOY_DIR}/ 2>&1 | tee -a "$LOG_FILE"
    log "✓ Files transferred successfully"

    # Step 6: Configure Environment
    log "Step 6/12: Configuring environment variables..."

    # Determine URLs based on SSL configuration
    if [ "$SSL_ENABLED" = true ] && [ -n "$DOMAIN" ]; then
        PROTOCOL="https"
        BASE_URL="https://${DOMAIN}"
    else
        PROTOCOL="http"
        BASE_URL="http://${SERVER_IP}"
    fi

    ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} bash -s << ENVCONFIG 2>&1 | tee -a "$LOG_FILE"
cd ~/WintEHR

# Generate secure secrets
SECRET_KEY=\$(openssl rand -hex 32)
JWT_SECRET_KEY=\$(openssl rand -hex 32)

# Create backend .env
cat > backend/.env << 'BACKEND_ENV'
DATABASE_URL=postgresql+asyncpg://emr_user:emr_password@postgres:5432/emr_db
DB_HOST=postgres
DB_PORT=5432
DB_NAME=emr_db
DB_USER=emr_user
DB_PASSWORD=emr_password
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=INFO
HOST=0.0.0.0
PORT=8000
FHIR_BASE_URL=${BASE_URL}/fhir/R4
FHIR_VALIDATION_LEVEL=strict
SECRET_KEY=\${SECRET_KEY}
JWT_SECRET_KEY=\${JWT_SECRET_KEY}
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=1440
CORS_ORIGINS=${BASE_URL},http://localhost:3000
REDIS_URL=redis://redis:6379/0
ENABLE_METRICS=true
BACKEND_ENV

# Create frontend .env
cat > frontend/.env << 'FRONTEND_ENV'
REACT_APP_API_URL=${BASE_URL}
REACT_APP_FHIR_URL=${BASE_URL}/fhir/R4
REACT_APP_WS_URL=ws${PROTOCOL#http}://${DOMAIN:-${SERVER_IP}}/ws
REACT_APP_ENVIRONMENT=production
REACT_APP_DEBUG=false
FRONTEND_ENV

echo "✓ Environment files created"
ENVCONFIG
    log "✓ Environment configured for ${PROTOCOL}"

    # Step 7: SSL Setup (if enabled)
    if [ "$SSL_ENABLED" = true ] && [ -n "$DOMAIN" ]; then
        log "Step 7/12: Setting up SSL/TLS with Let's Encrypt..."

        ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} bash -s << SSLSETUP 2>&1 | tee -a "$LOG_FILE"
# Install certbot if needed
if ! command -v certbot &> /dev/null; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq certbot
    echo "✓ Certbot installed"
else
    echo "✓ Certbot already installed"
fi

# Stop any service on port 80
sudo docker stop emr-frontend 2>/dev/null || true

# Get certificate
sudo certbot certonly --standalone \
    -d ${DOMAIN} \
    --non-interactive \
    --agree-tos \
    --email ${EMAIL}

if [ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]; then
    echo "✓ SSL certificate obtained successfully"
else
    echo "ERROR: Failed to obtain SSL certificate"
    exit 1
fi
SSLSETUP

        # Update docker-compose for SSL
        ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} bash << 'SSLCONFIG'
cd ~/WintEHR

# Update Dockerfile to use SSL config
sed -i 's/nginx-default.conf/nginx-ssl.conf/g' frontend/Dockerfile

# Update docker-compose for SSL
cat > docker-compose.yml << 'COMPOSE'
services:
  redis:
    image: redis:7-alpine
    container_name: emr-redis
    ports:
      - "6379:6379"
    networks:
      - emr-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru

  postgres:
    image: postgres:15-alpine
    container_name: emr-postgres
    environment:
      POSTGRES_USER: emr_user
      POSTGRES_PASSWORD: emr_password
      POSTGRES_DB: emr_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres-init:/docker-entrypoint-initdb.d:ro
    networks:
      - emr-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U emr_user -d emr_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: emr-backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - PYTHONUNBUFFERED=1
    env_file:
      - ./backend/.env
    networks:
      - emr-network
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: emr-frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
    env_file:
      - ./frontend/.env
    networks:
      - emr-network
    depends_on:
      - backend

networks:
  emr-network:
    driver: bridge

volumes:
  postgres_data:
COMPOSE

echo "✓ Docker Compose updated for SSL"
SSLCONFIG

        log "✓ SSL/TLS configuration complete"
    else
        log "Step 7/12: Skipping SSL setup (HTTP mode)"
    fi

    # Step 8: Build and Deploy
    log "Step 8/12: Building and deploying application..."
    ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} bash << 'BUILD' 2>&1 | tee -a "$LOG_FILE"
cd ~/WintEHR

# Build containers
echo "Building Docker images..."
sg docker -c 'docker-compose build'

# Start services
echo "Starting services..."
sg docker -c 'docker-compose up -d'

echo "✓ Application deployed"
BUILD
    log "✓ Application deployed"

    # Step 9: Wait for Services
    log "Step 9/12: Waiting for services to be ready..."
    info "Waiting 60 seconds for services to initialize..."
    sleep 60
    ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} 'cd ~/WintEHR && docker-compose ps' 2>&1 | tee -a "$LOG_FILE"
    log "✓ Services started"

    # Step 10: Import Data
    log "Step 10/12: Importing patient data (this may take 5-10 minutes)..."
    ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} bash << IMPORT 2>&1 | tee -a "$LOG_FILE"
cd ~/WintEHR
docker exec emr-backend python scripts/active/synthea_master.py full \
    --count ${PATIENT_COUNT} \
    --validation-mode light
IMPORT
    log "✓ Patient data imported"

    # Step 11: Verify Deployment
    log "Step 11/12: Verifying deployment..."
    ssh -i "$SSH_KEY" ${SSH_USER}@${SERVER_IP} bash << 'VERIFY' 2>&1 | tee -a "$LOG_FILE"
cd ~/WintEHR

echo "=== Container Status ==="
docker-compose ps

echo ""
echo "=== Database Resource Counts ==="
docker exec emr-postgres psql -U emr_user -d emr_db -c "
SELECT resource_type, COUNT(*) as count
FROM fhir.resources
GROUP BY resource_type
ORDER BY count DESC
LIMIT 10;"
VERIFY
    log "✓ Deployment verification complete"

    # Step 12: Generate Documentation
    log "Step 12/12: Generating deployment documentation..."

    local DOC_FILE="DEPLOYMENT_${SERVER_IP}_$(date +%Y%m%d).md"
    cat > "$DOC_FILE" << DOCEOF
# WintEHR Azure Deployment Report

**Date**: $(date '+%Y-%m-%d %H:%M:%S')
**Server**: ${SERVER_IP}
**Domain**: ${DOMAIN:-None (HTTP only)}
**SSL**: ${SSL_ENABLED}
**Patient Count**: ${PATIENT_COUNT}

## Access Information

- **Application URL**: ${BASE_URL}
- **API Documentation**: ${BASE_URL}/docs
- **FHIR API**: ${BASE_URL}/fhir/R4

## Default Credentials

- demo/password (Admin)
- nurse/password (Nurse)
- pharmacist/password (Pharmacist)

## Services Deployed

- ✅ PostgreSQL 15
- ✅ Redis 7
- ✅ Backend API (FastAPI)
- ✅ Frontend (React + Nginx)
$([ "$SSL_ENABLED" = true ] && [ -n "$DOMAIN" ] && echo "- ✅ SSL/TLS (Let's Encrypt)")

## Next Steps

1. Test application in browser
2. Configure Azure Network Security Group
3. Set up monitoring and backups
$([ "$SSL_ENABLED" = true ] && [ -n "$DOMAIN" ] && echo "4. Configure certificate auto-renewal monitoring")

## Troubleshooting

\`\`\`bash
# Check container status
ssh -i ${SSH_KEY} ${SSH_USER}@${SERVER_IP}
cd ~/WintEHR
docker-compose ps

# View logs
docker logs emr-backend --tail 100
docker logs emr-frontend --tail 100

# Restart services
docker-compose restart
\`\`\`

---

**Deployment Log**: ${LOG_FILE}
DOCEOF

    log "✓ Documentation generated: $DOC_FILE"

    # Final Summary
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    log "🎉 Deployment Complete!"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo -e "${GREEN}✓ Application successfully deployed${NC}"
    echo ""
    echo "📋 Access Information:"
    echo -e "   Application:  ${BLUE}${BASE_URL}${NC}"
    echo -e "   API Docs:     ${BLUE}${BASE_URL}/docs${NC}"
    echo -e "   FHIR API:     ${BLUE}${BASE_URL}/fhir/R4${NC}"
    echo ""
    echo "📝 Documentation:"
    echo -e "   Deployment log:    ${YELLOW}${LOG_FILE}${NC}"
    echo -e "   Deployment report: ${YELLOW}${DOC_FILE}${NC}"
    echo ""
    echo "👤 Default Users:"
    echo "   demo/password (Admin)"
    echo "   nurse/password (Nurse)"
    echo "   pharmacist/password (Pharmacist)"
    echo ""
    if [ "$SSL_ENABLED" = true ] && [ -n "$DOMAIN" ]; then
        echo "🔒 SSL/TLS:"
        echo "   Certificate expires: Check with 'sudo certbot certificates' on server"
        echo "   Auto-renewal: Enabled via certbot systemd timer"
        echo ""
    fi
    echo "═══════════════════════════════════════════════════════════════"
}

# Run main function
main "$@"
