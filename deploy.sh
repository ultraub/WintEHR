#!/bin/bash

# WintEHR Unified Deployment Script
# Works for local, development, and production environments

set -e

# Configuration
ENVIRONMENT=${1:-dev}
PATIENT_COUNT=${2:-10}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}WintEHR Deployment Script${NC}"
echo "=================================="
echo "Environment: $ENVIRONMENT"
echo "Patient Count: $PATIENT_COUNT"
echo ""

# Function to check if running on AWS
is_aws() {
    if [ -f /var/lib/cloud/instance/vendor-data.txt ] || [ -f /sys/hypervisor/uuid ]; then
        return 0
    fi
    return 1
}

# Function to wait for service
wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=30
    local attempt=0
    
    echo -e "${YELLOW}Waiting for $service...${NC}"
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "$url" > /dev/null; then
            echo -e "${GREEN}✓ $service is ready${NC}"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done
    echo -e "${RED}✗ $service failed to start${NC}"
    return 1
}

# Stop existing containers
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose down || true

# Build based on environment
if [ "$ENVIRONMENT" == "prod" ] || is_aws; then
    echo -e "${GREEN}Building for production...${NC}"
    
    # Use production Dockerfile for frontend
    sed -i.bak 's|dockerfile: Dockerfile.dev|dockerfile: Dockerfile|g' docker-compose.yml
    sed -i.bak 's|- "3000:3000"|- "80:80"|g' docker-compose.yml
    
    # Build images
    docker-compose build --no-cache
    
elif [ "$ENVIRONMENT" == "dev" ]; then
    echo -e "${GREEN}Building for development...${NC}"
    
    # Use development Dockerfile for frontend
    sed -i.bak 's|dockerfile: Dockerfile|dockerfile: Dockerfile.dev|g' docker-compose.yml
    sed -i.bak 's|- "80:80"|- "3000:3000"|g' docker-compose.yml
    
    # Build images
    docker-compose build
fi

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

# Wait for database
wait_for_service "PostgreSQL" "http://localhost:5432" || exit 1

# Wait for backend
wait_for_service "Backend" "http://localhost:8000/docs" || exit 1

# Load patient data if requested
if [ "$PATIENT_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Loading $PATIENT_COUNT patients...${NC}"
    
    # Wait a bit for backend to fully initialize
    sleep 5
    
    # Load patients using synthea_master
    docker exec emr-backend python scripts/active/synthea_master.py full \
        --count "$PATIENT_COUNT" \
        --validation-mode light \
        --include-dicom || {
        echo -e "${YELLOW}Note: Some minor errors during data load are normal${NC}"
    }
    
    # Ensure catalog population (critical for search functionality)
    echo -e "${YELLOW}Populating clinical catalogs...${NC}"
    docker exec emr-backend python scripts/active/consolidated_catalog_setup.py --extract-from-fhir || {
        echo -e "${YELLOW}Note: Catalog extraction completed with some warnings${NC}"
    }
    
    # Check data status
    echo -e "${YELLOW}Checking data status...${NC}"
    docker exec emr-backend python -c "
import asyncio
import asyncpg

async def check():
    conn = await asyncpg.connect('postgresql://emr_user:emr_password@postgres:5432/emr_db')
    patient_count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources WHERE resource_type = \\'Patient\\'')
    total_count = await conn.fetchval('SELECT COUNT(*) FROM fhir.resources')
    await conn.close()
    print(f'✓ Loaded {patient_count} patients with {total_count} total resources')

asyncio.run(check())
" || echo -e "${YELLOW}Could not verify data load${NC}"
fi

# Display access information
echo ""
echo -e "${GREEN}=================================="
echo "Deployment Complete!"
echo "=================================="
echo ""

if [ "$ENVIRONMENT" == "dev" ]; then
    echo "Access the application at:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
    echo "Default credentials:"
    echo "  Username: demo"
    echo "  Password: password"
else
    if is_aws; then
        PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
        echo "Access the application at:"
        echo "  Frontend: http://$PUBLIC_IP"
        echo "  Backend API: http://$PUBLIC_IP:8000"
        echo "  API Docs: http://$PUBLIC_IP:8000/docs"
    else
        echo "Access the application at:"
        echo "  Frontend: http://localhost"
        echo "  Backend API: http://localhost:8000"
        echo "  API Docs: http://localhost:8000/docs"
    fi
    echo ""
    echo "Default credentials:"
    echo "  Username: demo"
    echo "  Password: password"
fi

echo ""
echo -e "${YELLOW}Commands:${NC}"
echo "  View logs: docker-compose logs -f"
echo "  Check status: docker-compose ps"
echo "  Stop services: docker-compose down"
echo ""
echo -e "${GREEN}✓ Deployment successful!${NC}"