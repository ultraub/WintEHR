#!/bin/bash
# Automated SSL Certificate Setup for WintEHR
#
# This script handles the complete SSL lifecycle:
# 1. Creates placeholder certificates for initial nginx startup
# 2. Obtains real Let's Encrypt certificates
# 3. Configures auto-renewal
#
# Usage:
#   ./deploy/init-ssl.sh               # Uses DOMAIN from .env
#   ./deploy/init-ssl.sh example.com   # Explicit domain
#   ./deploy/init-ssl.sh --dry-run     # Test without making changes

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
cd "$PROJECT_ROOT"

# Parse arguments
DRY_RUN=false
DOMAIN=""
EMAIL=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        *)
            DOMAIN="$1"
            shift
            ;;
    esac
done

# Load domain from .env if not provided
if [ -z "$DOMAIN" ]; then
    if [ -f ".env" ]; then
        DOMAIN=$(grep -E "^DOMAIN=" .env | cut -d'=' -f2)
    fi
fi

# Load email from .env if not provided
if [ -z "$EMAIL" ]; then
    if [ -f ".env" ]; then
        EMAIL=$(grep -E "^SSL_EMAIL=" .env | cut -d'=' -f2)
    fi
    # Default email if not set
    EMAIL="${EMAIL:-admin@${DOMAIN}}"
fi

# Validate domain
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
    echo -e "${RED}Error: Valid domain required${NC}"
    echo "Usage: $0 <domain> [--email admin@example.com] [--dry-run]"
    echo "Or set DOMAIN in .env file"
    exit 1
fi

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  WintEHR SSL Certificate Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo -e "Domain: ${GREEN}$DOMAIN${NC}"
echo -e "Email:  ${GREEN}$EMAIL${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "Mode:   ${YELLOW}DRY RUN${NC}"
fi
echo ""

# Certificate paths
CERT_DIR="./certbot/conf/live/$DOMAIN"
CERT_FILE="$CERT_DIR/fullchain.pem"
KEY_FILE="$CERT_DIR/privkey.pem"

# Check if certificates already exist
if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo -e "${GREEN}SSL certificates already exist for $DOMAIN${NC}"

    # Check certificate validity
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
    echo -e "Certificate expires: $EXPIRY"

    # Check if cert is self-signed placeholder
    ISSUER=$(openssl x509 -issuer -noout -in "$CERT_FILE" 2>/dev/null)
    if echo "$ISSUER" | grep -q "WintEHR-Placeholder"; then
        echo -e "${YELLOW}Current certificate is a placeholder - will obtain real certificate${NC}"
    else
        read -p "Certificates exist. Renew anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Keeping existing certificates."
            exit 0
        fi
    fi
fi

# Step 1: Create certificate directories
echo -e "${BLUE}Step 1: Creating certificate directories...${NC}"
mkdir -p ./certbot/conf/live/$DOMAIN
mkdir -p ./certbot/www/.well-known/acme-challenge

# Step 2: Create placeholder certificate for initial nginx startup
echo -e "${BLUE}Step 2: Creating placeholder certificate...${NC}"
if [ "$DRY_RUN" = false ]; then
    # Generate placeholder self-signed cert so nginx can start
    openssl req -x509 -nodes -newkey rsa:4096 \
        -days 1 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/CN=$DOMAIN/O=WintEHR-Placeholder" \
        2>/dev/null

    # Create chain file (same as cert for self-signed)
    cp "$CERT_FILE" "$CERT_DIR/chain.pem"

    echo -e "${GREEN}Placeholder certificate created${NC}"
else
    echo -e "${YELLOW}[DRY RUN] Would create placeholder certificate${NC}"
fi

# Step 3: Update nginx-prod.conf with domain
echo -e "${BLUE}Step 3: Configuring nginx with domain...${NC}"
NGINX_CONF="./nginx-prod.conf"

if [ -f "$NGINX_CONF" ]; then
    if [ "$DRY_RUN" = false ]; then
        # Update certificate paths to use the domain
        sed -i.bak \
            -e "s|/etc/letsencrypt/live/[^/]*/fullchain.pem|/etc/letsencrypt/live/$DOMAIN/fullchain.pem|g" \
            -e "s|/etc/letsencrypt/live/[^/]*/privkey.pem|/etc/letsencrypt/live/$DOMAIN/privkey.pem|g" \
            "$NGINX_CONF"
        rm -f "${NGINX_CONF}.bak"
        echo -e "${GREEN}nginx-prod.conf updated with domain: $DOMAIN${NC}"
    else
        echo -e "${YELLOW}[DRY RUN] Would update nginx-prod.conf${NC}"
    fi
else
    echo -e "${YELLOW}Warning: nginx-prod.conf not found${NC}"
fi

# Step 4: Start nginx to serve ACME challenge
echo -e "${BLUE}Step 4: Starting nginx for ACME challenge...${NC}"
if [ "$DRY_RUN" = false ]; then
    # Start nginx if not running
    docker compose --profile prod up -d nginx 2>/dev/null || true
    sleep 5

    # Check if nginx started
    if docker ps --format '{{.Names}}' | grep -q "emr-nginx"; then
        echo -e "${GREEN}Nginx is running${NC}"
    else
        echo -e "${YELLOW}Warning: Nginx may not have started - checking logs...${NC}"
        docker compose logs nginx --tail 10
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would start nginx${NC}"
fi

# Step 5: Obtain Let's Encrypt certificate
echo -e "${BLUE}Step 5: Obtaining Let's Encrypt certificate...${NC}"
echo "This may take a moment..."

if [ "$DRY_RUN" = false ]; then
    # Use certbot container to obtain certificate
    docker compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        -d "$DOMAIN"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Let's Encrypt certificate obtained successfully!${NC}"
    else
        echo -e "${RED}Failed to obtain certificate${NC}"
        echo "Common issues:"
        echo "  - Domain DNS not pointing to this server"
        echo "  - Ports 80/443 not accessible"
        echo "  - Rate limit exceeded (try again later)"
        exit 1
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would run:${NC}"
    echo "docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
fi

# Step 6: Reload nginx with real certificate
echo -e "${BLUE}Step 6: Reloading nginx with real certificate...${NC}"
if [ "$DRY_RUN" = false ]; then
    docker compose exec nginx nginx -s reload 2>/dev/null || \
        docker compose --profile prod restart nginx
    echo -e "${GREEN}Nginx reloaded${NC}"
else
    echo -e "${YELLOW}[DRY RUN] Would reload nginx${NC}"
fi

# Step 7: Verify SSL
echo -e "${BLUE}Step 7: Verifying SSL configuration...${NC}"
if [ "$DRY_RUN" = false ]; then
    sleep 3

    # Test HTTPS
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN/" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        echo -e "${GREEN}SSL is working! (HTTP $HTTP_CODE)${NC}"
    else
        echo -e "${YELLOW}Warning: Could not verify SSL (HTTP $HTTP_CODE)${NC}"
        echo "This might be due to DNS propagation or firewall settings"
    fi
else
    echo -e "${YELLOW}[DRY RUN] Would verify SSL${NC}"
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  SSL Setup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Your site should be accessible at:"
echo -e "  ${GREEN}https://$DOMAIN${NC}"
echo ""
echo "Certificate auto-renewal is handled by the certbot container."
echo ""
echo "To manually renew: docker compose run --rm certbot renew"
echo ""
echo "To test SSL grade: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
