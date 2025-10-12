#!/bin/bash

################################################################################
# WintEHR Fresh Server Deployment Script
#
# This script handles complete deployment on a fresh Ubuntu/Debian server:
# - System dependencies and Docker installation
# - Firewall configuration
# - SSL certificate setup with Let's Encrypt
# - Application deployment with HAPI FHIR
# - Patient data loading
#
# Usage:
#   Local deployment:  ./deploy-fresh-server.sh
#   Remote deployment: ./deploy-fresh-server.sh <ssh-host> [ssh-key-path]
#
# Examples:
#   ./deploy-fresh-server.sh
#   ./deploy-fresh-server.sh azureuser@wintehr.eastus2.cloudapp.azure.com ~/.ssh/WintEHR-key.pem
#
################################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SSH_HOST=${1:-""}
SSH_KEY=${2:-""}
DOMAIN=${DOMAIN:-"wintehr.eastus2.cloudapp.azure.com"}
EMAIL=${EMAIL:-"admin@${DOMAIN}"}
PATIENT_COUNT=${PATIENT_COUNT:-100}
USE_STAGING_SSL=${USE_STAGING_SSL:-0}  # Set to 1 for testing

################################################################################
# Banner
################################################################################

print_banner() {
    echo -e "${CYAN}"
    cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║           WintEHR Production Deployment System                ║
║           FHIR-Native EMR with HAPI FHIR Backend              ║
║                                                               ║
║  Features:                                                    ║
║  • HTTPS/SSL with Let's Encrypt                              ║
║  • HAPI FHIR R4 Server                                       ║
║  • PostgreSQL Database                                       ║
║  • Redis Caching                                             ║
║  • Nginx Reverse Proxy                                       ║
║  • Synthetic Patient Data                                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

################################################################################
# Remote Deployment
################################################################################

deploy_remote() {
    local remote_host=$1
    local ssh_key=$2

    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Remote Deployment Mode${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "Target: ${CYAN}${remote_host}${NC}"
    echo -e "SSH Key: ${CYAN}${ssh_key}${NC}"
    echo -e "Domain: ${CYAN}${DOMAIN}${NC}"
    echo ""

    # Build SSH command
    SSH_CMD="ssh -i ${ssh_key} -o StrictHostKeyChecking=no ${remote_host}"
    SCP_CMD="scp -i ${ssh_key} -o StrictHostKeyChecking=no"

    # Test connection
    echo -e "${YELLOW}Testing SSH connection...${NC}"
    if ! $SSH_CMD "echo 'Connected successfully'"; then
        echo -e "${RED}✗ Failed to connect to remote server${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ SSH connection successful${NC}"
    echo ""

    # Create deployment package
    echo -e "${YELLOW}Creating deployment package...${NC}"
    TEMP_DIR=$(mktemp -d)
    DEPLOY_ARCHIVE="${TEMP_DIR}/wintehr-deployment.tar.gz"

    tar --exclude='.git' \
        --exclude='node_modules' \
        --exclude='frontend/node_modules' \
        --exclude='frontend/build' \
        --exclude='backend/__pycache__' \
        --exclude='backend/**/__pycache__' \
        --exclude='logs' \
        --exclude='.claude' \
        --exclude='*.pyc' \
        --exclude='*.log' \
        -czf "${DEPLOY_ARCHIVE}" \
        -C "$(dirname "$(pwd)")" \
        "$(basename "$(pwd)")"

    echo -e "${GREEN}✓ Package created: $(du -h "${DEPLOY_ARCHIVE}" | cut -f1)${NC}"
    echo ""

    # Upload to server
    echo -e "${YELLOW}Uploading to server...${NC}"
    $SCP_CMD "${DEPLOY_ARCHIVE}" "${remote_host}:~/wintehr-deploy.tar.gz"
    echo -e "${GREEN}✓ Upload complete${NC}"
    echo ""

    # Extract and setup on remote
    echo -e "${YELLOW}Setting up on remote server...${NC}"
    $SSH_CMD << EOF
set -e

# Stop any existing deployment
if [ -d "WintEHR" ]; then
    cd WintEHR
    docker-compose down -v 2>/dev/null || true
    cd ..
    sudo rm -rf WintEHR
fi

# Extract new deployment
tar -xzf wintehr-deploy.tar.gz
rm wintehr-deploy.tar.gz
cd WintEHR

echo "Extracted to remote server"
EOF

    echo -e "${GREEN}✓ Files extracted on remote server${NC}"
    echo ""

    # Run deployment on remote
    echo -e "${YELLOW}Starting remote deployment...${NC}"
    echo -e "${CYAN}This will take 15-20 minutes...${NC}"
    echo ""

    $SSH_CMD "cd WintEHR && bash deploy-fresh-server.sh local ${DOMAIN} ${EMAIL} ${PATIENT_COUNT} ${USE_STAGING_SSL}"

    # Cleanup
    rm -rf "${TEMP_DIR}"

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Remote Deployment Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}Access your application:${NC}"
    echo -e "  ${CYAN}https://${DOMAIN}${NC}"
    echo ""
}

################################################################################
# Local Deployment
################################################################################

deploy_local() {
    local deployment_mode=$1
    local domain=${2:-$DOMAIN}
    local email=${3:-$EMAIL}
    local patient_count=${4:-$PATIENT_COUNT}
    local staging_ssl=${5:-$USE_STAGING_SSL}

    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Local Deployment Configuration${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "Domain: ${CYAN}${domain}${NC}"
    echo -e "Email: ${CYAN}${email}${NC}"
    echo -e "Patients: ${CYAN}${patient_count}${NC}"
    echo -e "SSL Staging: ${CYAN}${staging_ssl}${NC}"
    echo ""

    # System setup
    setup_system

    # Install Docker
    install_docker

    # Configure firewall
    configure_firewall

    # Deploy application
    deploy_application "$domain" "$email" "$patient_count" "$staging_ssl"

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
    echo ""
}

################################################################################
# System Setup
################################################################################

setup_system() {
    echo -e "${BLUE}Step 1: System Setup${NC}"
    echo -e "${YELLOW}Updating system packages...${NC}"

    sudo apt-get update -qq
    sudo apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        software-properties-common \
        git \
        openssl \
        > /dev/null 2>&1

    echo -e "${GREEN}✓ System packages updated${NC}"
    echo ""
}

################################################################################
# Docker Installation
################################################################################

install_docker() {
    echo -e "${BLUE}Step 2: Docker Installation${NC}"

    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓ Docker already installed${NC}"
    else
        echo -e "${YELLOW}Installing Docker...${NC}"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh > /dev/null 2>&1
        rm get-docker.sh
        sudo usermod -aG docker $USER
        echo -e "${GREEN}✓ Docker installed${NC}"
    fi

    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}✓ Docker Compose already installed${NC}"
    else
        echo -e "${YELLOW}Installing Docker Compose...${NC}"
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
            -o /usr/local/bin/docker-compose > /dev/null 2>&1
        sudo chmod +x /usr/local/bin/docker-compose
        echo -e "${GREEN}✓ Docker Compose installed${NC}"
    fi

    echo ""
}

################################################################################
# Firewall Configuration
################################################################################

configure_firewall() {
    echo -e "${BLUE}Step 3: Firewall Configuration${NC}"

    if command -v ufw &> /dev/null; then
        echo -e "${YELLOW}Configuring UFW firewall...${NC}"

        # Allow SSH
        sudo ufw allow 22/tcp > /dev/null 2>&1 || true

        # Allow HTTP/HTTPS
        sudo ufw allow 80/tcp > /dev/null 2>&1 || true
        sudo ufw allow 443/tcp > /dev/null 2>&1 || true

        # Enable firewall (if not already enabled)
        echo "y" | sudo ufw enable > /dev/null 2>&1 || true

        echo -e "${GREEN}✓ Firewall configured (ports 22, 80, 443)${NC}"
    else
        echo -e "${YELLOW}⚠ UFW not available, skipping firewall configuration${NC}"
        echo -e "${YELLOW}⚠ Ensure ports 80 and 443 are open in cloud provider firewall${NC}"
    fi

    echo ""
}

################################################################################
# Application Deployment
################################################################################

deploy_application() {
    local domain=$1
    local email=$2
    local patient_count=$3
    local staging_ssl=$4

    echo -e "${BLUE}Step 4: Application Deployment${NC}"

    # Create directories
    echo -e "${YELLOW}Creating required directories...${NC}"
    mkdir -p logs data/generated_dicoms certbot/conf certbot/www
    echo -e "${GREEN}✓ Directories created${NC}"

    # Generate credentials
    echo -e "${YELLOW}Generating secure credentials...${NC}"
    export DOMAIN=$domain
    export POSTGRES_PASSWORD=$(openssl rand -base64 32)
    export JWT_SECRET=$(openssl rand -base64 64)

    # Save credentials
    cat > .env.production << EOF
# WintEHR Production Configuration
# Generated: $(date)

DOMAIN=$domain
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}

# Patient data
PATIENT_COUNT=$patient_count
EOF

    chmod 600 .env.production
    echo -e "${GREEN}✓ Credentials generated and saved to .env.production${NC}"
    echo ""

    # Update nginx config with domain
    echo -e "${YELLOW}Configuring nginx...${NC}"
    sed "s/DOMAIN_PLACEHOLDER/$domain/g" nginx-prod.conf > nginx-prod-configured.conf
    echo -e "${GREEN}✓ Nginx configured${NC}"

    # Stop any existing containers
    echo -e "${YELLOW}Stopping existing containers...${NC}"
    docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    docker-compose -f docker-compose.yml down -v 2>/dev/null || true
    echo -e "${GREEN}✓ Existing containers stopped${NC}"
    echo ""

    # Build images
    echo -e "${BLUE}Step 5: Building Docker Images${NC}"
    echo -e "${CYAN}This will take 5-10 minutes...${NC}"
    docker-compose -f docker-compose.prod.yml build --no-cache
    echo -e "${GREEN}✓ Images built${NC}"
    echo ""

    # Setup SSL
    echo -e "${BLUE}Step 6: SSL Certificate Setup${NC}"
    setup_ssl "$domain" "$email" "$staging_ssl"
    echo ""

    # Start services
    echo -e "${BLUE}Step 7: Starting Services${NC}"
    start_services
    echo ""

    # Load patient data
    echo -e "${BLUE}Step 8: Loading Patient Data${NC}"
    load_patient_data "$patient_count"
    echo ""

    # Print access information
    print_access_info "$domain"
}

################################################################################
# SSL Certificate Setup
################################################################################

setup_ssl() {
    local domain=$1
    local email=$2
    local staging=$3

    # Check if certificate exists
    if [ -d "certbot/conf/live/$domain" ]; then
        echo -e "${GREEN}✓ SSL certificate already exists${NC}"
        return 0
    fi

    echo -e "${YELLOW}Setting up SSL certificates...${NC}"

    # Download TLS parameters
    if [ ! -f "certbot/conf/options-ssl-nginx.conf" ]; then
        curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
            > "certbot/conf/options-ssl-nginx.conf"
    fi

    if [ ! -f "certbot/conf/ssl-dhparams.pem" ]; then
        curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
            > "certbot/conf/ssl-dhparams.pem"
    fi

    # Create dummy certificate
    echo -e "${YELLOW}Creating temporary certificate...${NC}"
    mkdir -p "certbot/conf/live/$domain"
    openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
        -keyout "certbot/conf/live/$domain/privkey.pem" \
        -out "certbot/conf/live/$domain/fullchain.pem" \
        -subj "/CN=$domain" 2>/dev/null

    # Start nginx with dummy cert
    docker-compose -f docker-compose.prod.yml up -d nginx
    sleep 5

    # Remove dummy cert
    sudo rm -rf "certbot/conf/live/$domain"

    # Request real certificate
    echo -e "${YELLOW}Requesting Let's Encrypt certificate...${NC}"

    STAGING_ARG=""
    if [ "$staging" -eq "1" ]; then
        STAGING_ARG="--staging"
        echo -e "${YELLOW}Using staging server (for testing)${NC}"
    fi

    if docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$email" \
        --agree-tos \
        --no-eff-email \
        $STAGING_ARG \
        -d "$domain"; then

        echo -e "${GREEN}✓ SSL certificate obtained${NC}"
        docker-compose -f docker-compose.prod.yml restart nginx
        echo -e "${GREEN}✓ Nginx reloaded with SSL${NC}"
    else
        echo -e "${RED}✗ Failed to obtain SSL certificate${NC}"
        echo -e "${YELLOW}Continuing with self-signed certificate...${NC}"
    fi
}

################################################################################
# Start Services
################################################################################

start_services() {
    echo -e "${YELLOW}Starting all services...${NC}"
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services
    echo -e "${YELLOW}Waiting for services to initialize...${NC}"
    sleep 15

    # Check PostgreSQL
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if docker exec emr-postgres pg_isready -U emr_user -d emr_db &>/dev/null; then
            echo -e "${GREEN}✓ PostgreSQL ready${NC}"
            break
        fi
        attempts=$((attempts + 1))
        sleep 2
    done

    # Check Backend
    attempts=0
    while [ $attempts -lt 30 ]; do
        if curl -sf http://localhost:8000/api/health &>/dev/null; then
            echo -e "${GREEN}✓ Backend API ready${NC}"
            break
        fi
        attempts=$((attempts + 1))
        sleep 2
    done

    # HAPI FHIR takes longer
    echo -e "${YELLOW}Waiting for HAPI FHIR (may take 2-3 minutes)...${NC}"
    attempts=0
    while [ $attempts -lt 60 ]; do
        if curl -sf http://localhost:8888/fhir/metadata &>/dev/null; then
            echo -e "${GREEN}✓ HAPI FHIR ready${NC}"
            break
        fi
        attempts=$((attempts + 1))
        sleep 3
    done

    echo -e "${GREEN}✓ All services started${NC}"
}

################################################################################
# Load Patient Data
################################################################################

load_patient_data() {
    local count=$1

    if [ "$count" -eq "0" ]; then
        echo -e "${YELLOW}Skipping patient data load${NC}"
        return 0
    fi

    echo -e "${YELLOW}Loading $count synthetic patients...${NC}"
    echo -e "${CYAN}This will take 5-10 minutes depending on patient count...${NC}"

    # Wait a bit more for HAPI to be fully ready
    sleep 30

    if docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py "$count" Massachusetts; then
        echo -e "${GREEN}✓ Patient data loaded${NC}"

        # Populate catalogs
        echo -e "${YELLOW}Populating clinical catalogs...${NC}"
        docker exec emr-backend python scripts/active/consolidated_catalog_setup.py --extract-from-fhir 2>/dev/null
        echo -e "${GREEN}✓ Catalogs populated${NC}"

        # Show summary
        echo ""
        echo -e "${CYAN}Data Summary:${NC}"
        docker exec emr-backend python -c "
import asyncio
import asyncpg

async def summary():
    conn = await asyncpg.connect('postgresql://emr_user:${POSTGRES_PASSWORD}@postgres:5432/emr_db')
    patients = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\'')
    total = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources')
    await conn.close()
    print(f'  Patients: {patients}')
    print(f'  Total FHIR Resources: {total}')

asyncio.run(summary())
" 2>/dev/null
    else
        echo -e "${YELLOW}⚠ Patient data load had issues${NC}"
    fi
}

################################################################################
# Print Access Information
################################################################################

print_access_info() {
    local domain=$1

    echo -e "${GREEN}╔═══════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}║         Access Your WintEHR Installation          ${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${CYAN}Primary URL:${NC}"
    echo -e "  ${GREEN}https://$domain${NC}"
    echo ""
    echo -e "${CYAN}API Endpoints:${NC}"
    echo -e "  Backend API:  https://$domain/api"
    echo -e "  API Docs:     https://$domain/docs"
    echo -e "  HAPI FHIR:    https://$domain/fhir"
    echo ""
    echo -e "${CYAN}Default Credentials:${NC}"
    echo -e "  Username: ${GREEN}demo${NC}"
    echo -e "  Password: ${GREEN}password${NC}"
    echo ""
    echo -e "${CYAN}Management Commands:${NC}"
    echo -e "  View logs:    docker-compose -f docker-compose.prod.yml logs -f [service]"
    echo -e "  Check status: docker-compose -f docker-compose.prod.yml ps"
    echo -e "  Restart:      docker-compose -f docker-compose.prod.yml restart"
    echo -e "  Stop:         docker-compose -f docker-compose.prod.yml down"
    echo -e "  Renew SSL:    docker-compose -f docker-compose.prod.yml run --rm certbot renew"
    echo ""
    echo -e "${YELLOW}Important Files:${NC}"
    echo -e "  Credentials:  ${GREEN}.env.production${NC}"
    echo -e "  SSL Certs:    certbot/conf/live/$domain/"
    echo -e "  Logs:         logs/"
    echo ""
}

################################################################################
# Main
################################################################################

main() {
    print_banner

    if [ -n "$SSH_HOST" ]; then
        # Remote deployment
        if [ -z "$SSH_KEY" ]; then
            echo -e "${RED}Error: SSH key path required for remote deployment${NC}"
            echo -e "Usage: $0 <ssh-host> <ssh-key-path>"
            exit 1
        fi
        deploy_remote "$SSH_HOST" "$SSH_KEY"
    else
        # Local deployment
        deploy_local "local" "$DOMAIN" "$EMAIL" "$PATIENT_COUNT" "$USE_STAGING_SSL"
    fi
}

# Run main function
main "$@"
