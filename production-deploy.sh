#!/bin/bash

# WintEHR Production Deployment with HTTPS/SSL
# Automated Let's Encrypt SSL certificate generation and renewal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   WintEHR Production Deployment        ║${NC}"
echo -e "${GREEN}║   HTTPS/SSL with Let's Encrypt         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Configuration
DOMAIN=${1:-wintehr.eastus2.cloudapp.azure.com}
EMAIL=${2:-admin@${DOMAIN}}
PATIENT_COUNT=${3:-100}
STAGING=${4:-0}  # Use Let's Encrypt staging for testing

echo "Configuration:"
echo "  Domain: $DOMAIN"
echo "  Email: $EMAIL"
echo "  Patient Count: $PATIENT_COUNT"
echo "  SSL Staging Mode: $STAGING"
echo ""

# Function to check if docker and docker-compose are installed
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}Installing Docker...${NC}"
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        rm get-docker.sh
        echo -e "${GREEN}✓ Docker installed${NC}"
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${YELLOW}Installing Docker Compose...${NC}"
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        echo -e "${GREEN}✓ Docker Compose installed${NC}"
    fi
}

# Function to setup SSL certificates
setup_ssl() {
    echo -e "${BLUE}Setting up SSL certificates...${NC}"

    # Create directories
    mkdir -p certbot/conf certbot/www

    # Check if certificate already exists
    if [ -d "certbot/conf/live/$DOMAIN" ]; then
        echo -e "${GREEN}✓ SSL certificate already exists${NC}"
        return 0
    fi

    # Download recommended TLS parameters
    if [ ! -f "certbot/conf/options-ssl-nginx.conf" ]; then
        echo -e "${YELLOW}Downloading recommended TLS parameters...${NC}"
        curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "certbot/conf/options-ssl-nginx.conf"
    fi

    if [ ! -f "certbot/conf/ssl-dhparams.pem" ]; then
        echo -e "${YELLOW}Downloading DH parameters (this may take a while)...${NC}"
        curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "certbot/conf/ssl-dhparams.pem"
    fi

    # Create dummy certificate for initial nginx start
    echo -e "${YELLOW}Creating dummy certificate...${NC}"
    mkdir -p "certbot/conf/live/$DOMAIN"

    openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
        -keyout "certbot/conf/live/$DOMAIN/privkey.pem" \
        -out "certbot/conf/live/$DOMAIN/fullchain.pem" \
        -subj "/CN=$DOMAIN" 2>/dev/null

    echo -e "${GREEN}✓ Dummy certificate created${NC}"

    # Update nginx config with domain
    sed "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" nginx-prod.conf > nginx-prod-configured.conf

    # Start nginx with dummy certificate
    echo -e "${YELLOW}Starting nginx with dummy certificate...${NC}"
    docker-compose -f docker-compose.prod.yml up -d nginx
    sleep 5

    # Delete dummy certificate
    echo -e "${YELLOW}Removing dummy certificate...${NC}"
    sudo rm -rf "certbot/conf/live/$DOMAIN"

    # Request real certificate
    echo -e "${YELLOW}Requesting Let's Encrypt certificate...${NC}"

    STAGING_ARG=""
    if [ "$STAGING" -eq "1" ]; then
        STAGING_ARG="--staging"
        echo -e "${YELLOW}Using Let's Encrypt staging server (for testing)${NC}"
    fi

    docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        $STAGING_ARG \
        -d "$DOMAIN"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ SSL certificate obtained successfully${NC}"

        # Reload nginx with real certificate
        docker-compose -f docker-compose.prod.yml restart nginx
        echo -e "${GREEN}✓ Nginx reloaded with SSL certificate${NC}"
    else
        echo -e "${RED}✗ Failed to obtain SSL certificate${NC}"
        echo -e "${YELLOW}Check that:${NC}"
        echo "  1. Domain $DOMAIN points to this server"
        echo "  2. Ports 80 and 443 are open in firewall"
        echo "  3. Email address is valid"
        return 1
    fi
}

# Function to wait for service
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=60
    local attempt=0

    echo -e "${YELLOW}Waiting for $service...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "$url" &>/dev/null; then
            echo -e "${GREEN}✓ $service is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 3
    done
    echo -e "${RED}✗ $service failed to start${NC}"
    return 1
}

# Main deployment process
echo -e "${YELLOW}Checking dependencies...${NC}"
check_dependencies

# Create necessary directories
echo -e "${YELLOW}Creating required directories...${NC}"
mkdir -p logs data/generated_dicoms certbot/conf certbot/www
echo -e "${GREEN}✓ Directories created${NC}"

# Set environment variables
export DOMAIN=$DOMAIN
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
export JWT_SECRET=$(openssl rand -base64 64)

# Save credentials
cat > .env.production << EOF
DOMAIN=$DOMAIN
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
EOF

echo -e "${GREEN}✓ Production environment configured${NC}"
echo -e "${YELLOW}⚠  Credentials saved to .env.production${NC}"

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true
docker-compose -f docker-compose.yml down -v 2>/dev/null || true

# Build production images
echo -e "${GREEN}Building production images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Setup SSL certificates
setup_ssl

# Start all services
echo -e "${YELLOW}Starting all services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for services
sleep 15

if ! wait_for_service "PostgreSQL" "postgresql://postgres:5432"; then
    docker exec emr-postgres pg_isready -U emr_user -d emr_db || {
        echo -e "${RED}PostgreSQL failed. Checking logs...${NC}"
        docker-compose -f docker-compose.prod.yml logs --tail=30 postgres
        exit 1
    }
fi

if ! wait_for_service "Backend API" "http://localhost:8000/api/health"; then
    echo -e "${RED}Backend failed. Checking logs...${NC}"
    docker-compose -f docker-compose.prod.yml logs --tail=30 backend
    exit 1
fi

if ! wait_for_service "HAPI FHIR" "http://localhost:8888/fhir/metadata"; then
    echo -e "${YELLOW}⚠ HAPI FHIR may still be initializing...${NC}"
fi

# Load patient data
if [ "$PATIENT_COUNT" -gt 0 ]; then
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}  Loading $PATIENT_COUNT Patients       ${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"

    # Wait for HAPI to be fully ready
    sleep 30

    if docker exec emr-backend python scripts/synthea_to_hapi_pipeline.py "$PATIENT_COUNT" Massachusetts; then
        echo -e "${GREEN}✓ Patient data loaded${NC}"

        # Populate catalogs
        echo -e "${YELLOW}Populating clinical catalogs...${NC}"
        docker exec emr-backend python scripts/active/consolidated_catalog_setup.py --extract-from-fhir
        echo -e "${GREEN}✓ Catalogs populated${NC}"
    else
        echo -e "${YELLOW}⚠ Data load incomplete. You can retry later.${NC}"
    fi
fi

# Display success message
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Production Deployment Complete!      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Access WintEHR at:${NC}"
echo -e "  ${GREEN}https://$DOMAIN${NC}"
echo ""
echo -e "${BLUE}API Endpoints:${NC}"
echo "  Backend API: https://$DOMAIN/api"
echo "  API Docs: https://$DOMAIN/docs"
echo "  HAPI FHIR: https://$DOMAIN/fhir"
echo ""
echo -e "${BLUE}Default credentials:${NC}"
echo "  Username: demo"
echo "  Password: password"
echo ""
echo -e "${YELLOW}Management Commands:${NC}"
echo "  View logs: docker-compose -f docker-compose.prod.yml logs -f [service]"
echo "  Check status: docker-compose -f docker-compose.prod.yml ps"
echo "  Stop: docker-compose -f docker-compose.prod.yml down"
echo "  Renew SSL: docker-compose -f docker-compose.prod.yml run --rm certbot renew"
echo ""
echo -e "${GREEN}✓ WintEHR is now running with HTTPS!${NC}"
echo -e "${YELLOW}SSL certificates will auto-renew every 12 hours${NC}"
